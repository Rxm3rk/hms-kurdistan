"""A minimal S3 client for the cell's own tests (WORM test, smoke test). Standard library only.

Implements AWS Signature Version 4 for path-style requests (http://host:port/bucket/key), which is
all the dev cell's object store needs. It is test tooling, not a product component: the product
reaches object storage through `platform-files` (BUILD-PROMPT.md §5.2) from WP-0.3 on.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import http.client
import urllib.parse
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

EMPTY_SHA256 = hashlib.sha256(b"").hexdigest()
S3_NS = "{http://s3.amazonaws.com/doc/2006-03-01/}"
_UNRESERVED = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.~"


def uri_encode(text: str, keep_slash: bool) -> str:
    """Percent-encode as SigV4 requires: every byte except the unreserved set (and '/' in paths)."""
    safe = _UNRESERVED + ("/" if keep_slash else "")
    return "".join(ch if ch in safe else "".join(f"%{b:02X}" for b in ch.encode("utf-8")) for ch in text)


def _hmac(key: bytes, msg: str) -> bytes:
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()


def signing_key(secret: str, date: str, region: str, service: str = "s3") -> bytes:
    k_date = _hmac(("AWS4" + secret).encode("utf-8"), date)
    k_region = _hmac(k_date, region)
    k_service = _hmac(k_region, service)
    return _hmac(k_service, "aws4_request")


def canonical_query(query: dict[str, str]) -> str:
    pairs = sorted((uri_encode(k, False), uri_encode(v, False)) for k, v in query.items())
    return "&".join(f"{k}={v}" for k, v in pairs)


def sign(
    method: str,
    path: str,
    query: dict[str, str],
    headers: dict[str, str],
    payload_sha256: str,
    access_key: str,
    secret_key: str,
    region: str,
    amz_date: str,
) -> dict[str, str]:
    """Return the headers to send, including x-amz-date, x-amz-content-sha256 and Authorization.

    `headers` must already contain Host. `amz_date` is YYYYMMDD'T'HHMMSS'Z'.
    """
    out = {k.lower(): " ".join(str(v).strip().split()) for k, v in headers.items()}
    out["x-amz-date"] = amz_date
    out["x-amz-content-sha256"] = payload_sha256
    signed = sorted(out)
    canonical_headers = "".join(f"{name}:{out[name]}\n" for name in signed)
    signed_headers = ";".join(signed)
    canonical_request = "\n".join(
        [method, uri_encode(path, True), canonical_query(query), canonical_headers, signed_headers, payload_sha256]
    )
    date = amz_date[:8]
    scope = f"{date}/{region}/s3/aws4_request"
    string_to_sign = "\n".join(
        ["AWS4-HMAC-SHA256", amz_date, scope, hashlib.sha256(canonical_request.encode("utf-8")).hexdigest()]
    )
    signature = hmac.new(signing_key(secret_key, date, region), string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()
    out["authorization"] = (
        f"AWS4-HMAC-SHA256 Credential={access_key}/{scope}, SignedHeaders={signed_headers}, Signature={signature}"
    )
    return out


@dataclass
class Response:
    status: int
    headers: dict[str, str]
    body: bytes

    @property
    def ok(self) -> bool:
        return 200 <= self.status < 300

    def header(self, name: str) -> Optional[str]:
        return self.headers.get(name.lower())

    def error_code(self) -> Optional[str]:
        """The <Code> of an S3 error body, if any."""
        if not self.body:
            return None
        try:
            root = ET.fromstring(self.body)
        except ET.ParseError:
            return None
        code = root.find("Code")
        if code is None:
            code = root.find(f"{S3_NS}Code")
        return code.text if code is not None else None

    def summary(self) -> str:
        code = self.error_code()
        return f"HTTP {self.status}" + (f" {code}" if code else "")


@dataclass
class S3Client:
    endpoint: str  # for example http://127.0.0.1:7070
    access_key: str
    secret_key: str
    region: str = "us-east-1"
    timeout: float = 30.0
    clock: object = field(default=None)  # a callable returning an aware datetime; tests inject one

    def _now(self) -> datetime:
        return self.clock() if callable(self.clock) else datetime.now(timezone.utc)

    def request(
        self,
        method: str,
        bucket: str = "",
        key: str = "",
        query: Optional[dict[str, str]] = None,
        body: bytes = b"",
        headers: Optional[dict[str, str]] = None,
        content_md5: bool = False,
    ) -> Response:
        url = urllib.parse.urlsplit(self.endpoint)
        if url.scheme not in ("http", "https") or not url.hostname:
            raise ValueError(f"bad endpoint {self.endpoint!r}")
        path = "/" + "/".join(part for part in (bucket, key) if part)
        query = dict(query or {})
        hdrs = {"Host": url.netloc}
        hdrs.update(headers or {})
        if body or content_md5:
            hdrs["Content-MD5"] = base64.b64encode(hashlib.md5(body).digest()).decode("ascii")  # S3 integrity header
        hdrs["Content-Length"] = str(len(body))
        amz_date = self._now().astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        signed = sign(method, path, query, hdrs, hashlib.sha256(body).hexdigest(), self.access_key,
                      self.secret_key, self.region, amz_date)
        conn_cls = http.client.HTTPSConnection if url.scheme == "https" else http.client.HTTPConnection
        conn = conn_cls(url.hostname, url.port, timeout=self.timeout)
        target = uri_encode(path, True) + ("?" + canonical_query(query) if query else "")
        try:
            conn.request(method, target, body=body or None, headers=signed)
            resp = conn.getresponse()
            data = resp.read()
            return Response(resp.status, {k.lower(): v for k, v in resp.getheaders()}, data)
        finally:
            conn.close()


def retention_xml(mode: str, retain_until: datetime) -> bytes:
    stamp = retain_until.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Retention xmlns="http://s3.amazonaws.com/doc/2006-03-01/">'
        f"<Mode>{mode}</Mode><RetainUntilDate>{stamp}</RetainUntilDate></Retention>"
    ).encode("utf-8")


def parse_retention(body: bytes) -> tuple[Optional[str], Optional[str]]:
    """(mode, retain-until-date text) from a GetObjectRetention body, namespaced or not."""
    try:
        root = ET.fromstring(body)
    except ET.ParseError:
        return None, None

    def find(name: str) -> Optional[str]:
        node = root.find(name)
        if node is None:
            node = root.find(f"{S3_NS}{name}")
        return node.text if node is not None else None

    return find("Mode"), find("RetainUntilDate")
