"""The object-store WORM test (BUILD-PROMPT.md §4.1 object storage row; WP-0.2 exit criterion
"the object store refuses to delete a locked object").

An S3 server passes only if Object Lock in COMPLIANCE mode really protects a locked object version:
no delete (with or without the governance-bypass header), no shortened retention, no downgrade to
GOVERNANCE, no bucket deletion while the locked version exists, and the bytes stay intact. A positive
control (an unlocked object in the same bucket can be deleted) shows the refusals are not just a
broken delete path.
"""

from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Callable, Optional

from .s3 import Response, S3Client, parse_retention, retention_xml


def refused(r: Response) -> bool:
    """A refusal is a 4xx other than 404: a 404 means the version is gone, so the lock did not protect it."""
    return 400 <= r.status < 500 and r.status != 404


@dataclass
class Case:
    id: str
    title: str
    expected: str
    observed: str = ""
    passed: bool = False
    informational: bool = False  # recorded, but not part of the verdict

    def to_dict(self) -> dict:
        return {"id": self.id, "title": self.title, "expected": self.expected, "observed": self.observed,
                "result": "INFO" if self.informational else ("PASS" if self.passed else "FAIL")}


@dataclass
class WormReport:
    endpoint: str
    bucket: str
    cases: list[Case] = field(default_factory=list)
    error: Optional[str] = None
    key: str = "locked.bin"
    version: Optional[str] = None
    sha256: Optional[str] = None

    @property
    def passed(self) -> bool:
        required = [c for c in self.cases if not c.informational]
        return self.error is None and bool(required) and all(c.passed for c in required)

    def to_dict(self) -> dict:
        return {"endpoint": self.endpoint, "bucket": self.bucket, "key": self.key, "version": self.version,
                "sha256": self.sha256, "error": self.error, "result": "PASS" if self.passed else "FAIL",
                "cases": [c.to_dict() for c in self.cases]}


def run_worm(client: S3Client, now: Callable[[], datetime] = lambda: datetime.now(timezone.utc),
             retention: timedelta = timedelta(days=2)) -> WormReport:
    bucket = "worm-" + secrets.token_hex(6)
    report = WormReport(client.endpoint, bucket)
    body = b"SYNTHETIC WORM TEST OBJECT - NOT PATIENT DATA - " + secrets.token_bytes(32)
    digest = hashlib.sha256(body).hexdigest()
    report.sha256 = digest
    until = (now() + retention).replace(microsecond=0)

    def case(cid: str, title: str, expected: str, informational: bool = False) -> Case:
        c = Case(cid, title, expected, informational=informational)
        report.cases.append(c)
        return c

    try:
        c = case("W01", "create a bucket with Object Lock enabled", "2xx")
        r = client.request("PUT", bucket, headers={"x-amz-bucket-object-lock-enabled": "true"})
        c.observed, c.passed = r.summary(), r.ok
        if not r.ok:
            report.error = "cannot create an Object Lock bucket; nothing else can be tested"
            return report

        c = case("W02", "store an object under COMPLIANCE retention", "2xx with a version id")
        r = client.request("PUT", bucket, "locked.bin", body=body, headers={
            "x-amz-object-lock-mode": "COMPLIANCE",
            "x-amz-object-lock-retain-until-date": until.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
        })
        version = r.header("x-amz-version-id")
        report.version = version
        c.observed = r.summary() + (f", version {version}" if version else ", no version id")
        c.passed = r.ok and bool(version)
        if not c.passed:
            report.error = "cannot store a locked object version; nothing else can be tested"
            return report

        c = case("W03", "read back the retention", "mode COMPLIANCE, retain-until as set")
        r = client.request("GET", bucket, "locked.bin", query={"retention": "", "versionId": version})
        mode, stamp = parse_retention(r.body) if r.ok else (None, None)
        c.observed = f"{r.summary()}, mode={mode}, until={stamp}"
        c.passed = r.ok and mode == "COMPLIANCE" and bool(stamp) and stamp.startswith(until.strftime("%Y-%m-%dT%H:%M:%S"))

        c = case("W04", "delete the locked version", "refused (4xx other than 404)")
        r = client.request("DELETE", bucket, "locked.bin", query={"versionId": version})
        c.observed, c.passed = r.summary(), refused(r)

        c = case("W05", "delete the locked version with x-amz-bypass-governance-retention", "refused (4xx other than 404)")
        r = client.request("DELETE", bucket, "locked.bin", query={"versionId": version},
                           headers={"x-amz-bypass-governance-retention": "true"})
        c.observed, c.passed = r.summary(), refused(r)

        c = case("W06", "shorten the retention", "refused (4xx other than 404)")
        r = client.request("PUT", bucket, "locked.bin", query={"retention": "", "versionId": version},
                           body=retention_xml("COMPLIANCE", now() + timedelta(hours=1)))
        c.observed, c.passed = r.summary(), refused(r)

        c = case("W07", "downgrade the mode to GOVERNANCE", "refused (4xx other than 404)")
        r = client.request("PUT", bucket, "locked.bin", query={"retention": "", "versionId": version},
                           body=retention_xml("GOVERNANCE", until),
                           headers={"x-amz-bypass-governance-retention": "true"})
        c.observed, c.passed = r.summary(), refused(r)

        c = case("W08", "delete the bucket while the locked version exists", "refused (4xx other than 404)")
        r = client.request("DELETE", bucket)
        c.observed, c.passed = r.summary(), refused(r)

        c = case("W09", "the locked version is still there and unchanged", "2xx and the same SHA-256")
        r = client.request("GET", bucket, "locked.bin", query={"versionId": version})
        same = r.ok and hashlib.sha256(r.body).hexdigest() == digest
        c.observed, c.passed = r.summary() + (", bytes intact" if same else ", bytes differ or missing"), same

        c = case("W10", "positive control: an unlocked object version can be deleted", "2xx, then 404 on read")
        r = client.request("PUT", bucket, "unlocked.bin", body=b"SYNTHETIC CONTROL OBJECT")
        control_version = r.header("x-amz-version-id")
        query = {"versionId": control_version} if control_version else {}
        d = client.request("DELETE", bucket, "unlocked.bin", query=query)
        g = client.request("GET", bucket, "unlocked.bin", query=query)
        c.observed = f"put {r.summary()}, delete {d.summary()}, read {g.summary()}"
        c.passed = r.ok and d.ok and g.status == 404

        c = case("W11", "extend the retention (allowed in COMPLIANCE mode)", "2xx", informational=True)
        r = client.request("PUT", bucket, "locked.bin", query={"retention": "", "versionId": version},
                           body=retention_xml("COMPLIANCE", until + timedelta(days=1)))
        c.observed, c.passed = r.summary(), r.ok
    except OSError as exc:
        report.error = f"cannot reach {client.endpoint}: {exc}"
    return report


def recheck_worm(client: S3Client, bucket: str, key: str, version: str, sha256: str) -> WormReport:
    """After a server restart: the same locked version still refuses deletion and is unchanged."""
    report = WormReport(client.endpoint, bucket, key=key, version=version, sha256=sha256)
    try:
        c = Case("R01", "after restart: retention still COMPLIANCE", "2xx, mode COMPLIANCE")
        report.cases.append(c)
        r = client.request("GET", bucket, key, query={"retention": "", "versionId": version})
        mode, stamp = parse_retention(r.body) if r.ok else (None, None)
        c.observed, c.passed = f"{r.summary()}, mode={mode}, until={stamp}", r.ok and mode == "COMPLIANCE"

        c = Case("R02", "after restart: delete the locked version", "refused (4xx other than 404)")
        report.cases.append(c)
        r = client.request("DELETE", bucket, key, query={"versionId": version})
        c.observed, c.passed = r.summary(), refused(r)

        c = Case("R03", "after restart: the locked version is unchanged", "2xx and the same SHA-256")
        report.cases.append(c)
        r = client.request("GET", bucket, key, query={"versionId": version})
        same = r.ok and hashlib.sha256(r.body).hexdigest() == sha256
        c.observed, c.passed = r.summary() + (", bytes intact" if same else ", bytes differ or missing"), same
    except OSError as exc:
        report.error = f"cannot reach {client.endpoint}: {exc}"
    return report
