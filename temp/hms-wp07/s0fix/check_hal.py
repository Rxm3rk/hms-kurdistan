"""Validate docs/specs/hal fixtures against hal-v1.schema.json, the README's cross-checks, and negative cases.

Scratch checker kept outside the repository. Usage: python -I check_hal.py <root>
"""

import copy
import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator

root = Path(sys.argv[1]) / "docs" / "specs" / "hal"
schema = json.loads((root / "hal-v1.schema.json").read_text(encoding="utf-8"))
Draft202012Validator.check_schema(schema)
validator = Draft202012Validator(schema)


def cross_checks(doc):
    """The checks the schema cannot make (README.md, "Fixtures and checks")."""
    errs = []
    if doc["response"]["auditId"] != doc["audit"]["auditId"]:
        errs.append("response auditId != audit auditId")
    events, audits = doc.get("events", []), doc.get("eventAudits", [])
    if len(events) != len(audits):
        errs.append("events and eventAudits differ in length")
    sub = doc["response"].get("value", {}).get("subscriptionId") if doc["response"]["ok"] else None
    for ev, au in zip(events, audits):
        if ev["subscriptionId"] != sub:
            errs.append("event subscriptionId != response subscriptionId")
        if ev["auditId"] != au["auditId"]:
            errs.append("event auditId != its audit record's auditId")
        if "outcome" in ev and (ev["outcome"] == "step-up-refused") != (au["outcome"] == "error"):
            errs.append("badge event outcome disagrees with its audit record")
    ids = [doc["audit"]["auditId"]] + [a["auditId"] for a in audits]
    if len(ids) != len(set(ids)):
        errs.append("audit ids repeat within the fixture")
    return errs


files = sorted((root / "fixtures").glob("*.json"))
bad = 0
calls = {}
all_ids = {}
for path in files:
    raw = path.read_bytes()
    assert b"\r" not in raw, path
    doc = json.loads(raw.decode("utf-8"))
    errors = [e.message for e in sorted(validator.iter_errors(doc), key=lambda e: list(e.path))]
    if doc.get("fixture") != path.stem:
        errors.append(f"fixture name {doc.get('fixture')} != file {path.stem}")
    errors += cross_checks(doc)
    for aid in [doc["audit"]["auditId"]] + [a["auditId"] for a in doc.get("eventAudits", [])]:
        if aid in all_ids:
            errors.append(f"audit id {aid} also in {all_ids[aid]}")
        all_ids[aid] = path.name
    for e in errors:
        bad += 1
        print(f"FAIL {path.name}: {e}")
    calls.setdefault(doc["call"], []).append(".".join(path.stem.split(".")[3 if doc["call"].count(".") == 2 else 2:]))
print(f"{len(files)} fixtures, {bad} errors; calls: {len(calls)}")
for c, kinds in calls.items():
    print(f"  {c}: {', '.join(sorted(kinds))}")


def expect_invalid(label, doc, cross=False):
    if validator.is_valid(doc) and not (cross and cross_checks(doc)):
        print(f"NEGATIVE NOT REJECTED: {label}")
        return 1
    return 0


load = lambda n: json.loads((root / "fixtures" / f"{n}.json").read_text(encoding="utf-8"))
neg = 0
n = 0


def case(label, name, mutate, cross=False):
    global neg, n
    d = load(name)
    mutate(d)
    neg += expect_invalid(label, d, cross)
    n += 1


def set_err(d, **kw):
    d["response"]["error"].update(kw)


case("PAN field in pay value", "hal.pay.request.ok", lambda d: d["response"]["value"].__setitem__("maskedPan", "************1234"))
case("patient id in audit", "hal.print.label.ok", lambda d: d["audit"].__setitem__("patientId", "SYN-MRN-0000001"))
case("barcode data in audit", "hal.scan.onBarcode.ok", lambda d: d["eventAudits"][0].__setitem__("data", "x"))
case("error kind not applicable to call", "hal.capabilities.unavailable",
     lambda d: (set_err(d, kind="cancelled", reason="user-cancelled", retryable=True, messageKey="hal.error.cancelled"),
                d["audit"].update(errorKind="cancelled", errorReason="user-cancelled")))
case("reason not of kind", "hal.print.label.unavailable", lambda d: set_err(d, reason="media-out"))
case("free-text error", "hal.print.label.unavailable", lambda d: set_err(d, message="free text"))
case("missing audit", "hal.print.label.ok", lambda d: d.pop("audit"))
case("missing auditId", "hal.print.label.ok", lambda d: d["response"].pop("auditId"))
case("UUIDv4 audit id", "hal.print.label.ok", lambda d: d["response"].__setitem__("auditId", "019a3c00-0000-4000-8000-000000000001"))
case("events on a non-subscription call", "hal.print.label.ok", lambda d: d.__setitem__("events", []))
case("eventAudits on a non-subscription call", "hal.print.label.ok", lambda d: d.__setitem__("eventAudits", []))
case("events without eventAudits", "hal.scan.onBarcode.ok", lambda d: d.pop("eventAudits"))
case("pdf label in utf-8", "hal.print.label.ok", lambda d: d["request"].__setitem__("format", "pdf"))
case("audit error without kind", "hal.print.label.ok", lambda d: d["audit"].__setitem__("outcome", "error"))
case("ok with error", "hal.print.label.ok",
     lambda d: d.__setitem__("response", {"ok": True, "error": load("hal.print.label.timeout")["response"]["error"], "auditId": d["response"]["auditId"]}))
case("fixture/call mismatch", "hal.print.label.ok", lambda d: d.__setitem__("call", "hal.print.raw"))
case("amount with separator", "hal.pay.request.ok", lambda d: d["request"].__setitem__("amount", "25,000"))
# The reviewers' mutations, which the first schema accepted.
case("ok response with an error audit", "hal.print.label.ok",
     lambda d: d["audit"].update(outcome="error", errorKind="device-error", errorReason="media-out"))
case("error response with an ok audit", "hal.print.label.timeout",
     lambda d: (d["audit"].update(outcome="ok"), d["audit"].pop("errorKind"), d["audit"].pop("errorReason")))
case("audit error kind differs from response", "hal.print.label.timeout",
     lambda d: d["audit"].update(errorKind="device-error", errorReason="media-out"))
case("audit error reason differs from response", "hal.scan.document.timeout", lambda d: d["audit"].update(errorReason="device-timeout"))
case("print call audit with event badge-tap", "hal.print.label.ok", lambda d: d["audit"].__setitem__("event", "badge-tap"))
case("barcode event audit marked badge-tap", "hal.scan.onBarcode.ok", lambda d: d["eventAudits"][0].__setitem__("event", "badge-tap"))
case("event subscriptionId mismatch", "hal.scan.onBarcode.ok",
     lambda d: d["events"][0].__setitem__("subscriptionId", "019a3c00-0000-7000-8000-0000000000ff"), cross=True)
case("event auditId differs from its audit record", "hal.scan.onBarcode.ok",
     lambda d: d["eventAudits"][0].__setitem__("auditId", "019a3c00-0000-7000-8000-0000000000fe"), cross=True)
case("raw badge credential on a badge event", "hal.auth.onBadge.ok", lambda d: d["events"][0].__setitem__("credential", "SYN-BADGE-0000000000000001"))
case("step-up reference on a refused tap", "hal.auth.onBadge.ok", lambda d: d["events"][1].__setitem__("stepUpRef", "SYN-STEPUP-0000000000000002"))
case("completed tap without a step-up reference", "hal.auth.onBadge.ok", lambda d: d["events"][0].pop("stepUpRef"))
case("print timeout marked retryable", "hal.print.label.timeout", lambda d: set_err(d, retryable=True, outcomeUnknown=False))
case("print device error with outcome known", "hal.print.label.device-error", lambda d: set_err(d, outcomeUnknown=False))
case("scan timeout with outcome unknown", "hal.scan.document.timeout", lambda d: set_err(d, retryable=False, outcomeUnknown=True))
case("error without outcomeUnknown", "hal.kiosk.lock.unavailable", lambda d: d["response"]["error"].pop("outcomeUnknown"))
case("fixture suffix names another reason", "hal.id.read.unavailable.no-shell", lambda d: d.__setitem__("fixture", "hal.id.read.unavailable.no-device"))
case("no-shell written by the shell", "hal.id.read.unavailable.no-shell", lambda d: d["audit"].__setitem__("writtenBy", "shell"))
case("hal-client record for a shell error", "hal.id.read.unavailable", lambda d: d["audit"].__setitem__("writtenBy", "hal-client"))
case("reprintOf that is not a job id", "hal.print.label.ok", lambda d: d["request"].__setitem__("reprintOf", "SYN-MRN-0000001"))
print(f"negative cases: {n}, not rejected: {neg}")
sys.exit(1 if bad or neg else 0)
