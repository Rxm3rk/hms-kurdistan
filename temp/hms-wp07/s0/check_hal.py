"""Validate docs/specs/hal fixtures against hal-v1.schema.json, plus negative cases. Usage: python -I check_hal.py <root>"""

import copy
import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator

root = Path(sys.argv[1]) / "docs" / "specs" / "hal"
schema = json.loads((root / "hal-v1.schema.json").read_text(encoding="utf-8"))
Draft202012Validator.check_schema(schema)
validator = Draft202012Validator(schema)

files = sorted((root / "fixtures").glob("*.json"))
bad = 0
calls = {}
for path in files:
    raw = path.read_bytes()
    assert b"\r" not in raw, path
    doc = json.loads(raw.decode("utf-8"))
    errors = sorted(validator.iter_errors(doc), key=lambda e: list(e.path))
    if doc.get("fixture") != path.stem:
        errors.append(f"fixture name {doc.get('fixture')} != file {path.stem}")
    if doc["response"]["auditId"] != doc["audit"]["auditId"]:
        errors.append("auditId mismatch")
    if not doc["response"]["ok"]:
        if doc["audit"].get("errorKind") != doc["response"]["error"]["kind"]:
            errors.append("audit errorKind mismatch")
        if doc["audit"].get("errorReason") != doc["response"]["error"]["reason"]:
            errors.append("audit errorReason mismatch")
    for e in errors:
        bad += 1
        print(f"FAIL {path.name}: {getattr(e, 'message', e)}")
    calls.setdefault(doc["call"], []).append(path.stem.split(".")[-1])
print(f"{len(files)} fixtures, {bad} errors; calls: {len(calls)}")
for c, kinds in calls.items():
    print(f"  {c}: {', '.join(sorted(kinds))}")


def expect_invalid(label, doc):
    if validator.is_valid(doc):
        print(f"NEGATIVE NOT REJECTED: {label}")
        return 1
    return 0


load = lambda n: json.loads((root / "fixtures" / f"{n}.json").read_text(encoding="utf-8"))
neg = 0
d = load("hal.pay.request.ok"); d["response"]["value"]["maskedPan"] = "************1234"; neg += expect_invalid("PAN field in pay value", d)
d = load("hal.print.label.ok"); d["audit"]["patientId"] = "SYN-MRN-0000001"; neg += expect_invalid("patient id in audit", d)
d = load("hal.scan.onBarcode.ok"); d["audit"]["data"] = "x"; neg += expect_invalid("barcode data in audit", d)
d = load("hal.capabilities.unavailable"); d["response"]["error"]["kind"] = "cancelled"; d["response"]["error"]["reason"] = "user-cancelled"; d["response"]["error"]["retryable"] = True; d["response"]["error"]["messageKey"] = "hal.error.cancelled"; neg += expect_invalid("error kind not applicable to call", d)
d = load("hal.print.label.unavailable"); d["response"]["error"]["reason"] = "media-out"; neg += expect_invalid("reason not of kind", d)
d = load("hal.print.label.unavailable"); d["response"]["error"]["message"] = "free text"; neg += expect_invalid("free-text error", d)
d = load("hal.print.label.ok"); d.pop("audit"); neg += expect_invalid("missing audit", d)
d = load("hal.print.label.ok"); d["response"].pop("auditId"); neg += expect_invalid("missing auditId", d)
d = load("hal.print.label.ok"); d["response"]["auditId"] = "019a3c00-0000-4000-8000-000000000001"; neg += expect_invalid("UUIDv4 audit id", d)
d = load("hal.print.label.ok"); d["events"] = []; neg += expect_invalid("events on a non-subscription call", d)
d = load("hal.print.label.ok"); d["request"]["format"] = "pdf"; neg += expect_invalid("pdf label in utf-8", d)
d = load("hal.print.label.ok"); d["audit"]["outcome"] = "error"; neg += expect_invalid("audit error without kind", d)
d = load("hal.print.label.ok"); d["response"] = {"ok": True, "error": load("hal.print.label.timeout")["response"]["error"], "auditId": d["response"]["auditId"]}; neg += expect_invalid("ok with error", d)
d = load("hal.print.label.ok"); d["call"] = "hal.print.raw"; neg += expect_invalid("fixture/call mismatch", d)
d = load("hal.pay.request.ok"); d["request"]["amount"] = "25,000"; neg += expect_invalid("amount with separator", d)
print(f"negative cases not rejected: {neg}")
sys.exit(1 if bad or neg else 0)
