"""Generate docs/specs/hal/hal-v1.schema.json and docs/specs/hal/fixtures/*.json (WP-0.7 slice S0).

Scratch generator kept outside the repository. Usage: python -I gen_hal.py <worktree root>
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(sys.argv[1])
OUT = ROOT / "docs" / "specs" / "hal"
FIX = OUT / "fixtures"

CALLS = [
    "hal.print.label", "hal.print.raw", "hal.print.document", "hal.scan.onBarcode", "hal.scan.document",
    "hal.id.read", "hal.auth.onBadge", "hal.sign.capture", "hal.pay.request", "hal.camera.photo",
    "hal.kiosk.lock", "hal.capabilities",
]
KINDS = ["unavailable", "not-permitted", "invalid-request", "device-error", "timeout", "cancelled"]
REASONS = {
    "unavailable": ["no-shell", "not-implemented", "no-device"],
    "not-permitted": ["capability-not-granted", "step-up-refused"],
    "invalid-request": ["invalid-request", "unsupported-format", "unknown-device"],
    "device-error": ["device-offline", "media-out", "device-fault"],
    "timeout": ["device-timeout", "user-timeout"],
    "cancelled": ["user-cancelled"],
}
MESSAGE_KEY = {
    "unavailable": "hal.error.unavailable",
    "not-permitted": "hal.error.notPermitted",
    "invalid-request": "hal.error.invalidRequest",
    "device-error": "hal.error.deviceError",
    "timeout": "hal.error.timeout",
    "cancelled": "hal.error.cancelled",
}
RETRYABLE = {"unavailable": False, "not-permitted": False, "invalid-request": False, "device-error": True,
             "timeout": True, "cancelled": True}
# A timeout or device error after a print job or a payment was sent: the device may already have
# printed or charged, so the outcome is unknown and the call is not retryable as it stands.
OUTCOME_UNKNOWN_KINDS = ["device-error", "timeout"]
OUTCOME_UNKNOWN_CALLS = ["hal.print.label", "hal.print.raw", "hal.print.document", "hal.pay.request"]


def retry_flags(call: str, kind: str) -> tuple[bool, bool]:
    """(retryable, outcomeUnknown) for an error of this kind on this call."""
    if kind in OUTCOME_UNKNOWN_KINDS and call in OUTCOME_UNKNOWN_CALLS:
        return False, True
    return RETRYABLE[kind], False

PRINT_ERRORS = ["unavailable", "not-permitted", "invalid-request", "device-error", "timeout"]
INTERACTIVE_ERRORS = ["unavailable", "not-permitted", "invalid-request", "device-error", "timeout", "cancelled"]
ERRORS = {
    "hal.print.label": PRINT_ERRORS,
    "hal.print.raw": PRINT_ERRORS,
    "hal.print.document": PRINT_ERRORS,
    "hal.scan.onBarcode": ["unavailable", "not-permitted", "device-error"],
    "hal.scan.document": INTERACTIVE_ERRORS,
    "hal.id.read": INTERACTIVE_ERRORS,
    "hal.auth.onBadge": ["unavailable", "not-permitted", "device-error"],
    "hal.sign.capture": INTERACTIVE_ERRORS,
    "hal.pay.request": INTERACTIVE_ERRORS,
    "hal.camera.photo": INTERACTIVE_ERRORS,
    "hal.kiosk.lock": ["unavailable", "not-permitted", "invalid-request"],
    "hal.capabilities": ["unavailable"],
}
SUBSCRIPTIONS = {"hal.scan.onBarcode": "barcodeEvent", "hal.auth.onBadge": "badgeEvent"}
FAIL_CLOSED = {"hal.id.read": "WP-1.2", "hal.pay.request": "WP-1.9"}


def ref(name: str) -> dict:
    return {"$ref": f"#/$defs/{name}"}


def closed(required: list[str], props: dict, description: str | None = None) -> dict:
    out: dict = {"type": "object"}
    if description:
        out["description"] = description
    out["required"] = required
    out["additionalProperties"] = False
    out["properties"] = props
    return out


def camel(call: str) -> str:
    parts = call.split(".")[1:]
    return parts[0] + "".join(p[0].upper() + p[1:] for p in parts[1:])


# ------------------------------------------------------------------------------------------- schema

defs: dict = {
    "text": {"type": "string", "minLength": 1, "pattern": "\\S", "description": "Text with at least one visible character."},
    "uuid7": {
        "type": "string",
        "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
        "description": "A UUIDv7 in lower-case canonical form (BUILD-PROMPT.md §7: UUIDv7 identifiers).",
    },
    "auditId": {"$ref": "#/$defs/uuid7", "description": "Identifier of the audit record written for this call (README.md, \"Audit\")."},
    "utcTimestamp": {
        "type": "string",
        "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]{1,9})?Z$",
        "description": "An RFC 3339 timestamp in UTC with the Z suffix.",
    },
    "sha256": {"type": "string", "pattern": "^[0-9a-f]{64}$", "description": "Lower-case hexadecimal SHA-256 of the bytes the shell holds."},
    "blobRef": {
        "type": "string",
        "pattern": "^hal-blob:[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
        "description": "A handle to bytes held by the shell for this session (a scan, photo or signature). The web app reads the bytes through the shell and uploads them to the cell; the shell never writes them to a user folder or a device gallery (§9.4) and deletes them when the session ends.",
    },
    "opaqueId": {
        "type": "string",
        "pattern": "^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$",
        "description": "An opaque identifier of a device, printer, terminal, workstation, template or session. Never a patient identifier.",
    },
    "messageKey": {
        "type": "string",
        "pattern": "^[a-z][a-zA-Z0-9-]*(?:\\.[a-z][a-zA-Z0-9-]*)+$",
        "description": "A message key of the @hms/i18n catalogues (frontend/packages/i18n/README.md). The UI shows the catalogue text; the HAL carries no display text.",
    },
    "decimalAmount": {
        "type": "string",
        "pattern": "^(0|[1-9][0-9]{0,14})(\\.[0-9]{1,3})?$",
        "description": "A non-negative decimal amount as a string. Neither the HAL nor the web app does arithmetic on it.",
    },
    "callName": {"enum": CALLS, "description": "The HAL calls of BUILD-PROMPT.md §12.8."},
    "errorKind": {"enum": KINDS, "description": "The error vocabulary (README.md, \"Errors\")."},
    "errorReason": {"enum": [r for k in KINDS for r in REASONS[k]]},
}

error_allof = []
for kind in KINDS:
    props: dict = {"reason": {"enum": REASONS[kind]}, "messageKey": {"const": MESSAGE_KEY[kind]}}
    if kind not in OUTCOME_UNKNOWN_KINDS:
        # Fixed for the kind; device-error and timeout are fixed per call (the per-call branches below).
        props["retryable"] = {"const": RETRYABLE[kind]}
        props["outcomeUnknown"] = {"const": False}
    error_allof.append({"if": {"properties": {"kind": {"const": kind}}, "required": ["kind"]}, "then": {"properties": props}})
defs["error"] = closed(
    ["kind", "reason", "retryable", "outcomeUnknown", "messageKey"],
    {
        "kind": ref("errorKind"),
        "reason": ref("errorReason"),
        "retryable": {"type": "boolean", "description": "Whether repeating the same call may succeed without a change of configuration. False whenever outcomeUnknown is true."},
        "outcomeUnknown": {"type": "boolean", "description": "True when the device may already have acted (a print job printed, a card charged): a timeout or device error on a print or payment call. The screen then asks the user to check the device (hal.error.outcomeUnknown) and never repeats the call on its own; a reprint is a new, explicit request that names the earlier job (reprintOf)."},
        "messageKey": ref("messageKey"),
    },
    "A typed error. It carries no free text, no device output and no patient data.",
)
defs["error"]["allOf"] = error_allof

defs["okResult"] = closed(["ok", "value", "auditId"], {"ok": {"const": True}, "value": {"type": "object"}, "auditId": ref("auditId")})
defs["errorResult"] = closed(["ok", "error", "auditId"], {"ok": {"const": False}, "error": ref("error"), "auditId": ref("auditId")})
defs["result"] = {
    "description": "What every HAL call returns: {ok: true, value, auditId} or {ok: false, error, auditId}.",
    "oneOf": [ref("okResult"), ref("errorResult")],
}

labelProvenance = {
    "templateId": ref("opaqueId"),
    "templateVersion": ref("opaqueId"),
    "reprintOf": {"allOf": [ref("uuid7")], "description": "Present only on an explicit reprint: the jobId of the earlier job, so a reprint (of a wristband above all) is a deliberate, audited request and never an automatic retry."},
}
defs["printLabelRequest"] = closed(
    ["labelType", "format", "content", "contentEncoding", "templateId", "templateVersion", "copies"],
    {
        "printerId": ref("opaqueId"),
        "labelType": {"enum": ["wristband", "specimen", "medication", "general"]},
        "format": {"enum": ["zpl", "pdf"]},
        "content": {"type": "string", "minLength": 1, "maxLength": 1048576},
        "contentEncoding": {"enum": ["utf-8", "base64"]},
        **labelProvenance,
        "copies": {"type": "integer", "minimum": 1, "maximum": 10},
    },
    "A label already rendered for the target printer (ZPL text or PDF) by the renderer of WP-0.8; the template id and version go into the audit record and PrintJobCompleted (§12.8).",
)
defs["printLabelRequest"]["allOf"] = [
    {"if": {"properties": {"format": {"const": "pdf"}}, "required": ["format"]},
     "then": {"properties": {"contentEncoding": {"const": "base64"}}}},
]
defs["printJobValue"] = closed(
    ["jobId", "printerId", "status"],
    {
        "jobId": ref("uuid7"),
        "printerId": ref("opaqueId"),
        "status": {"enum": ["sent", "completed"], "description": "sent: the printer accepted the job; completed: the printer reported it printed."},
    },
)
defs["printRawRequest"] = closed(
    ["printerId", "language", "content", "contentEncoding"],
    {
        "printerId": ref("opaqueId"),
        "language": {"enum": ["zpl", "esc-pos"]},
        "content": {"type": "string", "minLength": 1, "maxLength": 1048576},
        "contentEncoding": {"enum": ["utf-8", "base64"]},
    },
    "Raw bytes for a raw-port printer. Raw print is a capability granted per workstation profile and role (§13.5).",
)
defs["printRawValue"] = closed(
    ["jobId", "printerId", "bytesSent"],
    {"jobId": ref("uuid7"), "printerId": ref("opaqueId"), "bytesSent": {"type": "integer", "minimum": 1}},
)
defs["printDocumentRequest"] = closed(
    ["mediaType", "content", "contentEncoding", "templateId", "templateVersion", "copies", "duplex"],
    {
        "printerId": ref("opaqueId"),
        "mediaType": {"const": "application/pdf"},
        "content": {"type": "string", "minLength": 1, "maxLength": 33554432},
        "contentEncoding": {"const": "base64"},
        **labelProvenance,
        "copies": {"type": "integer", "minimum": 1, "maximum": 10},
        "duplex": {"type": "boolean"},
        "tray": ref("opaqueId"),
    },
    "A rendered PDF document for a spooled document printer.",
)
defs["subscribeRequest"] = closed([], {"deviceId": ref("opaqueId")}, "Subscribe to events from one device, or from every permitted device of the class when deviceId is absent. The shell delivers a barcode read only to the subscriptions of the window that has the focus when the read arrives; a badge tap goes to every window of the shell, because a change of user clears every window's patient context (docs/specs/hal/README.md, \"Windows and patients\").")
defs["subscriptionValue"] = closed(["subscriptionId"], {"subscriptionId": ref("uuid7")},
                                   "The subscription handle. Each event carries its own audit ID; closing the subscription is a local unlisten, not a HAL call.")
defs["barcodeEvent"] = closed(
    ["subscriptionId", "deviceId", "symbology", "data", "auditId"],
    {
        "subscriptionId": ref("uuid7"),
        "deviceId": ref("opaqueId"),
        "symbology": {"enum": ["code128", "gs1-128", "datamatrix", "gs1-datamatrix", "qr", "pdf417", "ean13", "other"]},
        "aimId": {"type": "string", "pattern": "^\\][A-Za-z][0-9A-Za-z]$", "description": "The AIM symbology identifier when the scanner sends it."},
        "data": {"type": "string", "minLength": 1, "maxLength": 4096,
                 "description": "The decoded data exactly as read, with GS1 FNC1 sent as the group separator U+001D (§12.8: scanners preserve GS1 FNC1/GS)."},
        "auditId": ref("auditId"),
    },
    "One barcode read.",
)
defs["scanDocumentRequest"] = closed(
    ["mediaType", "resolutionDpi", "colour", "duplex"],
    {
        "deviceId": ref("opaqueId"),
        "mediaType": {"enum": ["application/pdf", "image/png"]},
        "resolutionDpi": {"enum": [150, 200, 300]},
        "colour": {"enum": ["colour", "greyscale", "mono"]},
        "duplex": {"type": "boolean"},
    },
)
defs["capturedBlobValue"] = closed(
    ["mediaType", "blobRef", "sha256", "byteLength"],
    {
        "mediaType": {"enum": ["application/pdf", "image/png", "image/jpeg", "image/svg+xml"]},
        "blobRef": ref("blobRef"),
        "sha256": ref("sha256"),
        "byteLength": {"type": "integer", "minimum": 1},
    },
)
defs["scanDocumentValue"] = closed(
    ["mediaType", "blobRef", "sha256", "byteLength", "pageCount"],
    {
        "mediaType": {"enum": ["application/pdf", "image/png"]},
        "blobRef": ref("blobRef"),
        "sha256": ref("sha256"),
        "byteLength": {"type": "integer", "minimum": 1},
        "pageCount": {"type": "integer", "minimum": 1},
    },
)
defs["idReadRequest"] = closed(
    ["type"],
    {
        "type": {"enum": ["national-card-barcode", "residency-card-barcode", "passport-mrz"],
                 "description": "The document technologies of §9.1 and §11.2. Card formats are open question Q-K12; parsing belongs to card-format plug-ins outside the HAL."},
        "deviceId": ref("opaqueId"),
    },
)
defs["idReadValue"] = closed(
    ["type", "format", "raw"],
    {
        "type": {"enum": ["national-card-barcode", "residency-card-barcode", "passport-mrz"]},
        "format": {"enum": ["pdf417", "qr", "datamatrix", "mrz-td1", "mrz-td2", "mrz-td3", "other"]},
        "raw": {"type": "string", "minLength": 1, "maxLength": 8192, "description": "The raw barcode data or MRZ lines (newline-separated), unparsed."},
        "mrzCheckDigitsValid": {"type": "boolean", "description": "MRZ only: whether every ICAO 9303 check digit matched."},
    },
    "The raw document read. hal.id.read returns unavailable (not-implemented) until the ID-card and MRZ reader simulators of WP-1.2 exist (§3.7).",
)
defs["badgeEvent"] = closed(
    ["subscriptionId", "readerId", "outcome", "auditId"],
    {
        "subscriptionId": ref("uuid7"),
        "readerId": ref("opaqueId"),
        "outcome": {"enum": ["step-up-completed", "step-up-refused"],
                    "description": "The result of the Keycloak step-up that the shell ran for this tap, bound to the workstation certificate (§12.8). A refusal does not say why (unknown badge, revoked, identity provider unreachable), so the event does not disclose the policy."},
        "stepUpRef": {"type": "string", "pattern": "^[A-Za-z0-9_-]{16,128}$",
                      "description": "Present only when the step-up completed: an opaque, single-use, short-lived reference to that step-up, which the cell accepts once and only for this workstation [P]; WP-0.4 designs its redemption for the session swap. It is not the badge credential: the badge credential never crosses the bridge. Never logged, never stored."},
        "auditId": ref("auditId"),
    },
    "One badge tap, after the shell has run the step-up. The raw badge credential stays in the shell.",
)
defs["badgeEvent"]["allOf"] = [
    {"if": {"properties": {"outcome": {"const": "step-up-completed"}}, "required": ["outcome"]},
     "then": {"required": ["stepUpRef"]},
     "else": {"not": {"required": ["stepUpRef"]}}},
]
defs["signCaptureRequest"] = closed(
    ["purpose", "promptKey"],
    {
        "purpose": {"enum": ["consent", "receipt", "document"]},
        "promptKey": ref("messageKey"),
        "deviceId": ref("opaqueId"),
    },
    "Capture an on-glass handwritten signature image. It is not the electronic signature of the sign and co-sign pattern, which is authenticated by the Trust Plane.",
)
defs["signCaptureValue"] = closed(
    ["mediaType", "blobRef", "sha256", "byteLength", "strokeCount", "capturedAt"],
    {
        "mediaType": {"enum": ["image/svg+xml", "image/png"]},
        "blobRef": ref("blobRef"),
        "sha256": ref("sha256"),
        "byteLength": {"type": "integer", "minimum": 1},
        "strokeCount": {"type": "integer", "minimum": 1},
        "capturedAt": ref("utcTimestamp"),
    },
)
defs["payRequestRequest"] = closed(
    ["amount", "currency", "reference"],
    {
        "terminalId": ref("opaqueId"),
        "amount": ref("decimalAmount"),
        "currency": {"enum": ["IQD", "USD"]},
        "reference": {"allOf": [ref("opaqueId")], "description": "The payment reference from the cashiering module; never a patient identifier."},
    },
)
defs["payRequestValue"] = closed(
    ["outcome", "amount", "currency", "terminalId", "terminalTransactionId", "batchId"],
    {
        "outcome": {"enum": ["approved", "declined"], "description": "A declined payment is a result, not an error."},
        "amount": ref("decimalAmount"),
        "currency": {"enum": ["IQD", "USD"]},
        "terminalId": ref("opaqueId"),
        "terminalTransactionId": ref("opaqueId"),
        "batchId": ref("opaqueId"),
    },
    "No card PAN, masked or not, and no card data ever reaches the HMS (§12.8); the closed object has no field for it. hal.pay.request returns unavailable (not-implemented) until the card-terminal simulator of WP-1.9 exists (§3.7).",
)
defs["cameraPhotoRequest"] = closed(
    ["purpose"],
    {"purpose": {"enum": ["patient-photo", "clinical-photo", "document"]}, "deviceId": ref("opaqueId")},
)
defs["cameraPhotoValue"] = closed(
    ["mediaType", "blobRef", "sha256", "byteLength", "widthPx", "heightPx"],
    {
        "mediaType": {"enum": ["image/jpeg", "image/png"]},
        "blobRef": ref("blobRef"),
        "sha256": ref("sha256"),
        "byteLength": {"type": "integer", "minimum": 1},
        "widthPx": {"type": "integer", "minimum": 1},
        "heightPx": {"type": "integer", "minimum": 1},
    },
)
defs["kioskLockRequest"] = closed(["state"], {"state": {"enum": ["locked", "unlocked"]}})
defs["kioskLockValue"] = closed(["state"], {"state": {"enum": ["locked", "unlocked"]}})
defs["emptyRequest"] = closed([], {}, "This call takes no arguments.")
defs["device"] = closed(
    ["deviceId", "class", "status", "permitted", "simulated"],
    {
        "deviceId": ref("opaqueId"),
        "class": {"enum": ["label-printer", "document-printer", "raw-printer", "barcode-scanner", "document-scanner", "id-reader",
                           "badge-reader", "signature-pad", "payment-terminal", "camera"]},
        "status": {"enum": ["healthy", "degraded", "offline"]},
        "permitted": {"type": "boolean", "description": "Granted to this workstation profile and user (§13.5)."},
        "simulated": {"type": "boolean"},
        "model": ref("opaqueId"),
    },
)
defs["callAvailability"] = {"enum": ["available", "not-permitted", "no-device", "not-implemented"]}
defs["capabilitiesValue"] = closed(
    ["contractVersion", "supportedContractVersions", "shell", "workstationProfile", "devices", "calls"],
    {
        "contractVersion": {"const": 1},
        "supportedContractVersions": {"type": "array", "items": {"type": "integer", "minimum": 1}, "minItems": 1, "uniqueItems": True},
        "shell": closed(["version", "simulated"], {
            "version": {"type": "string", "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+(-[0-9A-Za-z.-]+)?$"},
            "simulated": {"type": "boolean", "description": "True when every device is simulated (development and test builds)."},
        }),
        "workstationProfile": ref("opaqueId"),
        "devices": {"type": "array", "items": ref("device")},
        "calls": closed(CALLS, {c: ref("callAvailability") for c in CALLS}),
    },
    "What is attached, healthy and permitted for this workstation profile and user (§12.8).",
)
defs["auditRecord"] = closed(
    ["auditId", "writtenBy", "contractVersion", "call", "at", "outcome", "workstationId", "sessionRef"],
    {
        "auditId": ref("auditId"),
        "writtenBy": {"enum": ["shell", "hal-client"], "description": "hal-client writes the record only when no shell is present (outcome error, reason no-shell)."},
        "contractVersion": {"const": 1},
        "call": ref("callName"),
        "event": {"enum": ["call", "barcode-read", "badge-tap"], "description": "Absent or call for a call; the event kind for a subscription event (barcode-read only for hal.scan.onBarcode, badge-tap only for hal.auth.onBadge)."},
        "at": ref("utcTimestamp"),
        "outcome": {"enum": ["ok", "error"]},
        "errorKind": ref("errorKind"),
        "errorReason": ref("errorReason"),
        "workstationId": {"oneOf": [ref("opaqueId"), {"type": "null"}]},
        "sessionRef": {"oneOf": [ref("opaqueId"), {"type": "null"}], "description": "Opaque reference to the staff session; null before sign-in."},
        "deviceId": ref("opaqueId"),
        "jobId": ref("uuid7"),
        "templateId": ref("opaqueId"),
        "templateVersion": ref("opaqueId"),
        "reprintOf": ref("uuid7"),
    },
    "The local audit record of one call or event. A closed allowlist of fields with no PHI (H13, SI-20): no patient identifier or name, no label, document or barcode content, no image or signature, no ID-document data, no badge credential and no payment amount or reference.",
)
defs["auditRecord"]["allOf"] = [
    {"if": {"properties": {"outcome": {"const": "error"}}, "required": ["outcome"]},
     "then": {"required": ["errorKind", "errorReason"]},
     "else": {"not": {"anyOf": [{"required": ["errorKind"]}, {"required": ["errorReason"]}]}}},
    # hal-client writes a record only for its own refusal when no shell is present, and then always.
    {"if": {"properties": {"writtenBy": {"const": "hal-client"}}, "required": ["writtenBy"]},
     "then": {"properties": {"outcome": {"const": "error"}, "errorReason": {"const": "no-shell"}}, "required": ["errorReason"]}},
    {"if": {"properties": {"errorReason": {"const": "no-shell"}}, "required": ["errorReason"]},
     "then": {"properties": {"writtenBy": {"const": "hal-client"}}}},
    # Each error kind's reasons only (the error object ties them the same way).
    *[{"if": {"properties": {"errorKind": {"const": k}}, "required": ["errorKind"]},
       "then": {"properties": {"errorReason": {"enum": REASONS[k]}}}} for k in KINDS],
]

REQ = {
    "hal.print.label": ("printLabelRequest", "printJobValue"),
    "hal.print.raw": ("printRawRequest", "printRawValue"),
    "hal.print.document": ("printDocumentRequest", "printJobValue"),
    "hal.scan.onBarcode": ("subscribeRequest", "subscriptionValue"),
    "hal.scan.document": ("scanDocumentRequest", "scanDocumentValue"),
    "hal.id.read": ("idReadRequest", "idReadValue"),
    "hal.auth.onBadge": ("subscribeRequest", "subscriptionValue"),
    "hal.sign.capture": ("signCaptureRequest", "signCaptureValue"),
    "hal.pay.request": ("payRequestRequest", "payRequestValue"),
    "hal.camera.photo": ("cameraPhotoRequest", "cameraPhotoValue"),
    "hal.kiosk.lock": ("kioskLockRequest", "kioskLockValue"),
    "hal.capabilities": ("emptyRequest", "capabilitiesValue"),
}
del defs["capturedBlobValue"]

EVENT_KIND = {"hal.scan.onBarcode": "barcode-read", "hal.auth.onBadge": "badge-tap"}

per_call = []
for call in CALLS:
    req, val = REQ[call]
    flag_rules = []
    for kind in OUTCOME_UNKNOWN_KINDS:
        if kind in ERRORS[call]:
            retryable, unknown = retry_flags(call, kind)
            flag_rules.append({"if": {"properties": {"kind": {"const": kind}}, "required": ["kind"]},
                               "then": {"properties": {"retryable": {"const": retryable}, "outcomeUnknown": {"const": unknown}}}})
    error_rule: dict = {"properties": {"kind": {"enum": ERRORS[call]}}}
    if flag_rules:
        error_rule["allOf"] = flag_rules
    then: dict = {
        "properties": {
            "fixture": {"pattern": "^" + call.replace(".", "\\.") + "\\."},
            "request": ref(req),
            "response": {
                "if": {"properties": {"ok": {"const": True}}, "required": ["ok"]},
                "then": {"properties": {"value": ref(val)}},
                "else": {"properties": {"error": error_rule}},
            },
            "audit": {"properties": {"call": {"const": call}, "event": {"const": "call"}}},
        }
    }
    if call in SUBSCRIPTIONS:
        then["properties"]["events"] = {"type": "array", "items": ref(SUBSCRIPTIONS[call])}
        then["properties"]["eventAudits"] = {
            "type": "array",
            "items": {"allOf": [ref("auditRecord")], "required": ["event"],
                      "properties": {"call": {"const": call}, "event": {"const": EVENT_KIND[call]}}},
        }
        then["dependentRequired"] = {"events": ["eventAudits"], "eventAudits": ["events"]}
    else:
        then["not"] = {"anyOf": [{"required": ["events"]}, {"required": ["eventAudits"]}]}
    per_call.append({"if": {"properties": {"call": {"const": call}}, "required": ["call"]}, "then": then})

# The response and its audit record agree: the outcome, the error kind and the error reason.
ALL_REASONS = [r for k in KINDS for r in REASONS[k]]
agreement = [
    {"if": {"properties": {"response": {"properties": {"ok": {"const": True}}, "required": ["ok"]}}},
     "then": {"properties": {"audit": {"properties": {"outcome": {"const": "ok"}}}}},
     "else": {"properties": {"audit": {"properties": {"outcome": {"const": "error"}}}}}},
    *[{"if": {"properties": {"response": {"properties": {"error": {"properties": {"kind": {"const": k}}, "required": ["kind"]}}, "required": ["error"]}}},
       "then": {"properties": {"audit": {"properties": {"errorKind": {"const": k}}}}}} for k in KINDS],
    *[{"if": {"properties": {"response": {"properties": {"error": {"properties": {"reason": {"const": r}}, "required": ["reason"]}}, "required": ["error"]}}},
       "then": {"properties": {"audit": {"properties": {"errorReason": {"const": r}}}}}} for r in ALL_REASONS],
    # A fixture name with a reason suffix (<call>.<kind>.<reason>) holds that reason.
    *[{"if": {"properties": {"fixture": {"pattern": "\\.(" + "|".join(KINDS) + ")\\." + r + "$"}}, "required": ["fixture"]},
       "then": {"properties": {"response": {"properties": {"ok": {"const": False}, "error": {"properties": {"reason": {"const": r}}}}}}}}
      for r in ALL_REASONS],
]

schema = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "urn:hms-kurdistan:spec:hal:v1",
    "title": "HMS Kurdistan hardware abstraction layer (HAL) contract, version 1: one call exchange",
    "description": "One HAL call as a contract fixture: the request the web app sends, the typed result the Tauri shell returns ({ok, value | error, auditId}), the events of a subscription, and the local audit record the call produced. The request, value, event, error and audit-record definitions under $defs are the contract that frontend/packages/hal-client and the shell's hal-core implement (BUILD-PROMPT.md §12.8, §13.5; docs/specs/hal/README.md). Every object is closed, so no field outside the contract can carry data.",
    "type": "object",
    "required": ["fixture", "provenance", "description", "contractVersion", "call", "request", "response", "audit"],
    "additionalProperties": False,
    "properties": {
        "$schema": {"type": "string"},
        "fixture": {"type": "string", "pattern": "^hal\\.[a-z]+(\\.[a-zA-Z]+)?\\.(ok|" + "|".join(KINDS) + ")(\\.(" + "|".join(ALL_REASONS) + "))?$",
                    "description": "The fixture name: <call>.<ok or error kind>, with an optional .<reason> suffix where a call has more than one fixture of a kind; equal to the file name without .json."},
        "provenance": {"const": "synthetic", "description": "Every fixture is synthetic data, NOT FOR CLINICAL USE (§18.10)."},
        "description": ref("text"),
        "contractVersion": {"const": 1},
        "call": ref("callName"),
        "request": {"type": "object"},
        "response": ref("result"),
        "events": {"type": "array"},
        "audit": ref("auditRecord"),
        "eventAudits": {"type": "array", "description": "The audit record of each subscription event, in the order of events."},
    },
    "allOf": per_call + agreement,
    "$defs": defs,
}

# ------------------------------------------------------------------------------------------- fixtures

counter = [0]


def uid(prefix: str = "019a0000-0000") -> str:
    counter[0] += 1
    return f"019a3c00-0000-7000-8000-{counter[0]:012x}"


SYN_LABEL = "^XA^CI28^FO40,40^A0N,32,32^FDSYN-PATIENT-0001^FS^FO40,90^BXN,6,200^FDSYN-MRN-0000001^FS^XZ"
SYN_PDF_B64 = "JVBERi0xLjcKJSBTWU5USEVUSUMgLSBOT1QgRk9SIENMSU5JQ0FMIFVTRQo="  # "%PDF-1.7\n% SYNTHETIC - NOT FOR CLINICAL USE\n"
SHA = "3f1c7c5e0d2b4a6f8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b0a1f"
AT = "2026-10-19T09:00:00.000Z"

REQUESTS = {
    "hal.print.label": {"printerId": "SIM-LABEL-01", "labelType": "wristband", "format": "zpl", "content": SYN_LABEL,
                        "contentEncoding": "utf-8", "templateId": "SYN-WRISTBAND-ADULT", "templateVersion": "1", "copies": 1},
    "hal.print.raw": {"printerId": "SIM-RAW-01", "language": "esc-pos", "content": "G0BTWU4tVE9LRU4tMDQyCh1WAA==", "contentEncoding": "base64"},
    "hal.print.document": {"printerId": "SIM-DOC-01", "mediaType": "application/pdf", "content": SYN_PDF_B64, "contentEncoding": "base64",
                           "templateId": "SYN-DOCUMENT-A4", "templateVersion": "1", "copies": 1, "duplex": False},
    "hal.scan.onBarcode": {"deviceId": "SIM-SCANNER-01"},
    "hal.scan.document": {"deviceId": "SIM-DOCSCAN-01", "mediaType": "application/pdf", "resolutionDpi": 300, "colour": "greyscale", "duplex": False},
    "hal.id.read": {"type": "passport-mrz", "deviceId": "SIM-IDREADER-01"},
    "hal.auth.onBadge": {"deviceId": "SIM-BADGE-01"},
    "hal.sign.capture": {"purpose": "consent", "promptKey": "hal.sign.prompt.consent", "deviceId": "SIM-SIGNPAD-01"},
    "hal.pay.request": {"terminalId": "SIM-TERMINAL-01", "amount": "25000", "currency": "IQD", "reference": "SYN-PAYREF-0001"},
    "hal.camera.photo": {"purpose": "patient-photo", "deviceId": "SIM-CAMERA-01"},
    "hal.kiosk.lock": {"state": "locked"},
    "hal.capabilities": {},
}

DEVICE_OF = {
    "hal.print.label": "SIM-LABEL-01", "hal.print.raw": "SIM-RAW-01", "hal.print.document": "SIM-DOC-01",
    "hal.scan.onBarcode": "SIM-SCANNER-01", "hal.scan.document": "SIM-DOCSCAN-01", "hal.id.read": "SIM-IDREADER-01",
    "hal.auth.onBadge": "SIM-BADGE-01", "hal.sign.capture": "SIM-SIGNPAD-01", "hal.pay.request": "SIM-TERMINAL-01",
    "hal.camera.photo": "SIM-CAMERA-01",
}


def capabilities_value() -> dict:
    devices = [
        {"deviceId": "SIM-LABEL-01", "class": "label-printer", "status": "healthy", "permitted": True, "simulated": True, "model": "SIM-ZPL-203DPI"},
        {"deviceId": "SIM-RAW-01", "class": "raw-printer", "status": "healthy", "permitted": True, "simulated": True, "model": "SIM-ESCPOS"},
        {"deviceId": "SIM-DOC-01", "class": "document-printer", "status": "healthy", "permitted": True, "simulated": True},
        {"deviceId": "SIM-SCANNER-01", "class": "barcode-scanner", "status": "healthy", "permitted": True, "simulated": True},
        {"deviceId": "SIM-DOCSCAN-01", "class": "document-scanner", "status": "healthy", "permitted": True, "simulated": True},
        {"deviceId": "SIM-BADGE-01", "class": "badge-reader", "status": "healthy", "permitted": True, "simulated": True},
        {"deviceId": "SIM-SIGNPAD-01", "class": "signature-pad", "status": "healthy", "permitted": True, "simulated": True},
        {"deviceId": "SIM-CAMERA-01", "class": "camera", "status": "healthy", "permitted": True, "simulated": True},
    ]
    calls = {c: "available" for c in CALLS}
    calls["hal.id.read"] = "not-implemented"
    calls["hal.pay.request"] = "not-implemented"
    return {"contractVersion": 1, "supportedContractVersions": [1], "shell": {"version": "0.1.0", "simulated": True},
            "workstationProfile": "SYN-PROFILE-WARD-NURSE", "devices": devices, "calls": calls}


def ok_value(call: str) -> dict:
    if call in ("hal.print.label", "hal.print.document"):
        return {"jobId": uid(), "printerId": REQUESTS[call]["printerId"], "status": "sent"}
    if call == "hal.print.raw":
        return {"jobId": uid(), "printerId": "SIM-RAW-01", "bytesSent": 19}
    if call in SUBSCRIPTIONS:
        return {"subscriptionId": uid()}
    if call == "hal.scan.document":
        return {"mediaType": "application/pdf", "blobRef": "hal-blob:" + uid(), "sha256": SHA, "byteLength": 48213, "pageCount": 2}
    if call == "hal.id.read":
        line1 = "P<SYNSYNTHETIC<<EXAMPLE<PERSON".ljust(44, "<")
        line2 = "SYN000001" + "7" + "SYN" + "800101" + "4" + "M" + "300101" + "2" + "<" * 14 + "0" + "8"
        assert len(line1) == 44 and len(line2) == 44
        mrz = line1 + "\n" + line2
        return {"type": "passport-mrz", "format": "mrz-td3", "raw": mrz, "mrzCheckDigitsValid": False}
    if call == "hal.sign.capture":
        return {"mediaType": "image/svg+xml", "blobRef": "hal-blob:" + uid(), "sha256": SHA, "byteLength": 3120, "strokeCount": 7, "capturedAt": AT}
    if call == "hal.pay.request":
        return {"outcome": "approved", "amount": "25000", "currency": "IQD", "terminalId": "SIM-TERMINAL-01",
                "terminalTransactionId": "SIM-TXN-000001", "batchId": "SIM-BATCH-0001"}
    if call == "hal.camera.photo":
        return {"mediaType": "image/jpeg", "blobRef": "hal-blob:" + uid(), "sha256": SHA, "byteLength": 182044, "widthPx": 640, "heightPx": 800}
    if call == "hal.kiosk.lock":
        return {"state": "locked"}
    if call == "hal.capabilities":
        return capabilities_value()
    raise KeyError(call)


REASON_FOR = {
    "unavailable": "no-shell",
    "not-permitted": "capability-not-granted",
    "invalid-request": "invalid-request",
    "device-error": "device-offline",
    "timeout": "device-timeout",
    "cancelled": "user-cancelled",
}


def error_reason(call: str, kind: str) -> str:
    if kind == "unavailable" and call in FAIL_CLOSED:
        return "not-implemented"
    if kind == "device-error" and call.startswith("hal.print."):
        return "media-out"
    if kind == "timeout" and call in ("hal.sign.capture", "hal.id.read", "hal.pay.request", "hal.camera.photo", "hal.scan.document"):
        return "user-timeout"
    if kind == "invalid-request" and call in ("hal.print.label", "hal.print.document", "hal.scan.document", "hal.camera.photo", "hal.sign.capture"):
        return "unsupported-format" if call != "hal.sign.capture" else "invalid-request"
    if kind == "invalid-request" and call in ("hal.print.raw",):
        return "unknown-device"
    return REASON_FOR[kind]


def bad_request(call: str, kind: str) -> dict:
    req = json.loads(json.dumps(REQUESTS[call]))
    if kind != "invalid-request":
        return req
    # The request still matches the schema: invalid-request reports what only the shell can know
    # (an unsupported format or resolution for the attached device, an unknown device, a template the
    # shell does not hold) or a request that failed the shell's own validation.
    if call == "hal.print.raw":
        req["printerId"] = "SIM-RAW-99"
    elif call == "hal.scan.document":
        req["mediaType"] = "image/png"
        req["duplex"] = True
    elif call == "hal.camera.photo":
        req["purpose"] = "document"
    elif call == "hal.kiosk.lock":
        req["state"] = "unlocked"
    return req


DESCRIBE_OK = {
    "hal.print.label": "A simulated label printer accepts a synthetic wristband rendered as ZPL.",
    "hal.print.raw": "A simulated raw-port receipt printer accepts synthetic ESC/POS bytes for a queue token.",
    "hal.print.document": "A simulated document printer accepts a synthetic PDF.",
    "hal.scan.onBarcode": "A subscription to a simulated scanner and one GS1 DataMatrix read with a group separator (U+001D) preserved.",
    "hal.scan.document": "A simulated document scanner returns a two-page PDF as a shell-held blob.",
    "hal.id.read": "Shape for WP-1.2 only: a passport MRZ read from a future simulator. Until the WP-1.2 simulator exists the shell returns the unavailable fixture (not-implemented) for every hal.id.read call. The MRZ is synthetic and its check digits do not match.",
    "hal.auth.onBadge": "A subscription to a simulated badge reader and two taps after the shell's simulated step-up: one completed, with an opaque synthetic single-use step-up reference, and one refused. No badge credential crosses the bridge.",
    "hal.sign.capture": "A simulated signature pad returns an on-glass signature image as a shell-held blob.",
    "hal.pay.request": "Shape for WP-1.9 only: an approved card payment from a future terminal simulator, with no card data. Until the WP-1.9 simulator exists the shell returns the unavailable fixture (not-implemented) for every hal.pay.request call.",
    "hal.camera.photo": "A simulated camera returns a registration photo as a shell-held blob.",
    "hal.kiosk.lock": "The shell locks the workstation into kiosk mode (simulated).",
    "hal.capabilities": "A simulated workstation profile: every device simulated and permitted; hal.id.read and hal.pay.request not implemented.",
}

DESCRIBE_ERR = {
    "unavailable": "No shell is present (plain browser): hal-client refuses the call and writes its own audit record.",
    "not-permitted": "The workstation profile or the user's role does not grant this capability (§13.5).",
    "invalid-request": "The shell rejects a request that matches the schema but that it cannot carry out.",
    "device-error": "The device reports a fault.",
    "timeout": "The device or the user did not respond within the call's time limit.",
    "cancelled": "The user cancelled at the device.",
}


def audit(call: str, auditId: str, ok: bool, kind: str | None, reason: str | None, writtenBy: str = "shell",
          extra: dict | None = None, event: str | None = None) -> dict:
    record: dict = {
        "auditId": auditId,
        "writtenBy": writtenBy,
        "contractVersion": 1,
        "call": call,
    }
    if event:
        record["event"] = event
    record.update({
        "at": AT,
        "outcome": "ok" if ok else "error",
    })
    if not ok:
        record["errorKind"] = kind
        record["errorReason"] = reason
    record["workstationId"] = None if writtenBy == "hal-client" else "SYN-WS-0001"
    record["sessionRef"] = "SYN-SESSION-0001"
    if call in DEVICE_OF and writtenBy == "shell":
        record["deviceId"] = DEVICE_OF[call]
    if extra:
        record.update(extra)
    return record


def write(name: str, doc: dict) -> None:
    path = FIX / f"{name}.json"
    text = json.dumps(doc, ensure_ascii=False, indent=2) + "\n"
    path.write_text(text, encoding="utf-8", newline="\n")


FIX.mkdir(parents=True, exist_ok=True)
for old in FIX.glob("*.json"):
    old.unlink()

count = 0
for call in CALLS:
    # success
    aid = uid()
    value = ok_value(call)
    extra: dict = {}
    if call in ("hal.print.label", "hal.print.document"):
        extra = {"jobId": value["jobId"], "templateId": REQUESTS[call]["templateId"], "templateVersion": REQUESTS[call]["templateVersion"]}
    elif call == "hal.print.raw":
        extra = {"jobId": value["jobId"]}
    doc = {
        "$schema": "../hal-v1.schema.json",
        "fixture": f"{call}.ok",
        "provenance": "synthetic",
        "description": DESCRIBE_OK[call],
        "contractVersion": 1,
        "call": call,
        "request": REQUESTS[call],
        "response": {"ok": True, "value": value, "auditId": aid},
    }
    if call == "hal.scan.onBarcode":
        doc["events"] = [{"subscriptionId": value["subscriptionId"], "deviceId": "SIM-SCANNER-01", "symbology": "gs1-datamatrix",
                          "aimId": "]d2", "data": "0109506000134352\u001d10SYN0001", "auditId": uid()}]
    if call == "hal.auth.onBadge":
        doc["events"] = [
            {"subscriptionId": value["subscriptionId"], "readerId": "SIM-BADGE-01", "outcome": "step-up-completed",
             "stepUpRef": "SYN-STEPUP-0000000000000001", "auditId": uid()},
            {"subscriptionId": value["subscriptionId"], "readerId": "SIM-BADGE-01", "outcome": "step-up-refused", "auditId": uid()},
        ]
    doc["audit"] = audit(call, aid, True, None, None, extra=extra)
    if call in SUBSCRIPTIONS:
        audits = []
        for ev in doc["events"]:
            refused = ev.get("outcome") == "step-up-refused"
            audits.append(audit(call, ev["auditId"], not refused, "not-permitted" if refused else None,
                                "step-up-refused" if refused else None, event=EVENT_KIND[call]))
        doc["eventAudits"] = audits
    write(f"{call}.ok", doc)
    count += 1
    # errors; the fail-closed calls also get a no-shell fixture, because with no shell transport-none
    # answers no-shell for every call, these two included (README.md, "Fail closed").
    cases = [(kind, error_reason(call, kind), f"{call}.{kind}") for kind in ERRORS[call]]
    if call in FAIL_CLOSED:
        cases.append(("unavailable", "no-shell", f"{call}.unavailable.no-shell"))
    for kind, reason, name in cases:
        aid = uid()
        no_shell = kind == "unavailable" and reason == "no-shell"
        desc = DESCRIBE_ERR[kind]
        if kind == "unavailable" and reason == "not-implemented":
            desc = (f"Fail closed: the shell returns unavailable (not-implemented) for every {call} call until the "
                    f"simulator of {FAIL_CLOSED[call]} exists (§3.7). With no shell, hal-client's transport-none returns "
                    f"no-shell instead ({call}.unavailable.no-shell).")
        elif no_shell and call in FAIL_CLOSED:
            desc = (f"No shell is present (plain browser): hal-client's transport-none refuses {call} with no-shell, as it "
                    f"refuses every call, and writes its own audit record. With a shell, the call returns not-implemented "
                    f"until {FAIL_CLOSED[call]}.")
        elif call in FAIL_CLOSED:
            desc = f"Shape for {FAIL_CLOSED[call]} only: {desc[0].lower()}{desc[1:]} Until then every {call} call returns unavailable (not-implemented from the shell, no-shell without one)."
        retryable, unknown = retry_flags(call, kind)
        if unknown:
            desc += " The device may already have acted, so outcomeUnknown is true and the call is not retryable as it stands."
        error = {"kind": kind, "reason": reason, "retryable": retryable, "outcomeUnknown": unknown, "messageKey": MESSAGE_KEY[kind]}
        doc = {
            "$schema": "../hal-v1.schema.json",
            "fixture": name,
            "provenance": "synthetic",
            "description": desc,
            "contractVersion": 1,
            "call": call,
            "request": bad_request(call, kind),
            "response": {"ok": False, "error": error, "auditId": aid},
            "audit": audit(call, aid, False, kind, reason, writtenBy="hal-client" if no_shell else "shell"),
        }
        if no_shell or (kind == "unavailable") or kind == "not-permitted":
            doc["audit"].pop("deviceId", None)
        write(name, doc)
        count += 1

(OUT / "hal-v1.schema.json").write_text(json.dumps(schema, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
print(f"wrote schema and {count} fixtures")
