# Hardware abstraction layer (HAL) contract, version 1

The versioned bridge between the web workspaces and the Tauri 2 workstation shell (BUILD-PROMPT §5.4, §12.8 plane A, §13.5; ADR-011, ADR-019). The web app calls it through `frontend/packages/hal-client`; the shell implements it in `frontend/apps/shell` (the pure-Rust crate `hal-core` and the Tauri commands). This directory is the contract both sides test against, written before either exists (§3.2, WP-0.7 slice S0):

| File | What it is |
|---|---|
| `hal-v1.schema.json` | JSON Schema 2020-12. Its `$defs` define every request, value, subscription event, error and the local audit record; the root validates one call exchange (a fixture) |
| `fixtures/<call>.<outcome>[.<reason>].json` | One fixture per call for success (`ok`) and one for each error kind that applies to the call, plus a `.no-shell` fixture for `hal.id.read` and `hal.pay.request` (below): 69 files, all synthetic (`provenance: synthetic`, NOT FOR CLINICAL USE, §18.10) |

The calls are the twelve of §12.8, unchanged. §12.8 names the calls and says that every call returns a typed result and an audit ID; the shapes below, the error vocabulary and the audit record are this build's engineering choices [P] (open question OQ-150).

## The result

Every call returns one of two closed objects, and nothing else:

```json
{ "ok": true,  "value": { … }, "auditId": "<UUIDv7>" }
{ "ok": false, "error": { "kind": "…", "reason": "…", "retryable": false, "outcomeUnknown": false, "messageKey": "hal.error.…" }, "auditId": "<UUIDv7>" }
```

- `auditId` is always present, on success and on error. It names the audit record the call produced (below).
- `value` is typed per call (table below). Every object in the contract is closed (`additionalProperties: false`), so a field outside the contract cannot carry data across the bridge, in either direction.
- Calls never throw across the bridge: a transport failure, a panic in a driver or a malformed reply becomes an error result in `hal-client`, never an exception that a screen could swallow.
- The error carries no display text and no device output. The UI shows the catalogue text for `messageKey` and for the reason (`hal.reason.<reason>` in lower camel case, for example `hal.reason.noShell`), so error text follows the user's locale (§6.5, message keys in `docs/specs/modules/design-system.md` §10).

## Errors

| Kind | Reasons | Retryable | Outcome unknown | Meaning |
|---|---|---|---|---|
| `unavailable` | `no-shell`, `not-implemented`, `no-device` | no | no | The call cannot run here: no shell is present (a plain browser), the call is not built in this version, or no device of the class is attached |
| `not-permitted` | `capability-not-granted`, `step-up-refused` | no | no | The workstation profile or the user's role does not grant the capability (§13.5); the reason does not say which, so the error does not disclose the policy. `step-up-refused` appears only in the audit record of a refused badge tap (below) |
| `invalid-request` | `invalid-request`, `unsupported-format`, `unknown-device` | no | no | The request matches the schema but the shell cannot carry it out, or it fails the shell's own validation |
| `device-error` | `device-offline`, `media-out`, `device-fault` | yes; **no** for print and payment calls | no; **yes** for print and payment calls | The device reports a fault |
| `timeout` | `device-timeout`, `user-timeout` | yes; **no** for print and payment calls | no; **yes** for print and payment calls | The device or the user did not respond within the call's time limit |
| `cancelled` | `user-cancelled` | yes | no | The user cancelled at the device or in the shell's capture window |

The schema ties each reason and `messageKey` to its kind, `retryable` and `outcomeUnknown` to the kind and the call, and each call to the kinds that apply to it (the "Errors" column below).

- **A screen treats every error as a failure**: it never falls back to a default value, a cached reading or a guess.
- **Outcome unknown.** After a timeout or device error on `hal.print.label`, `hal.print.raw`, `hal.print.document` or `hal.pay.request`, the job may already have printed or the card may already have been charged. The error then has `outcomeUnknown: true` and `retryable: false`, and the screen shows `hal.error.outcomeUnknown`, asking the user to check the printer or terminal. Nothing repeats such a call on its own. A reprint is a new request with `reprintOf` set to the earlier job's `jobId`, made by the user and audited; a duplicate wristband is a wrong-patient risk (SI-01). Repeating a payment is the cashiering module's decision (WP-1.9), against the terminal's own record.

**Fail closed.** With no shell present, `hal-client`'s `transport-none` returns `unavailable` / `no-shell` for every call, `hal.capabilities`, `hal.id.read` and `hal.pay.request` included: it cannot know what a shell would implement, and "no shell" is what the user can act on. With a shell, `hal.id.read` and `hal.pay.request` return `unavailable` / `not-implemented` until their simulators exist: the ID-card and MRZ readers in WP-1.2 and the card terminals in WP-1.9 (§3.7). Both outcomes have a fixture (`hal.id.read.unavailable.json` for the shell, `hal.id.read.unavailable.no-shell.json` without one; the same for `hal.pay.request`). Their success fixtures show the shape those work packages build to; WP-0.7 builds only the refusal (known anomaly KA-027). §12.8 says that without a shell the UI degrades to the site print service; that service does not exist yet, so in WP-0.7 printing without the shell fails with `no-shell` and the screen says so (KA-028).

## The calls

| Call | Request | Value | Errors | WP-0.7 builds |
|---|---|---|---|---|
| `hal.print.label` | a label already rendered for the printer: `labelType` (`wristband`, `specimen`, `medication`, `general`), `format` (`zpl` or `pdf`), `content`, `contentEncoding`, `templateId`, `templateVersion`, `copies` (1–10), optional `printerId`, and `reprintOf` on an explicit reprint | `jobId`, `printerId`, `status` (`sent` or `completed`) | unavailable, not-permitted, invalid-request, device-error, timeout | simulated printer: the capture endpoint `tools/simulators/label_printer/` stores the ZPL or PDF (§3.7) |
| `hal.print.raw` | `printerId`, `language` (`zpl`, `esc-pos`), `content`, `contentEncoding` | `jobId`, `printerId`, `bytesSent` | as above | simulated raw-port printer; raw print is a granted capability (§13.5) |
| `hal.print.document` | a PDF (`application/pdf`, base64), `templateId`, `templateVersion`, `copies`, `duplex`, optional `printerId` and `tray`, and `reprintOf` on an explicit reprint | `jobId`, `printerId`, `status` | as above | simulated document printer |
| `hal.scan.onBarcode` | optional `deviceId` | `subscriptionId`; then one event per read: `symbology`, optional AIM identifier, `data` exactly as read with GS1 FNC1 kept as U+001D (§12.8), its own `auditId` | unavailable, not-permitted, device-error | simulated scanner |
| `hal.scan.document` | `mediaType` (`application/pdf`, `image/png`), `resolutionDpi` (150, 200, 300), `colour`, `duplex`, optional `deviceId` | `mediaType`, `blobRef`, `sha256`, `byteLength`, `pageCount` | unavailable, not-permitted, invalid-request, device-error, timeout, cancelled | simulated scanner (TWAIN and WIA drivers are later work) |
| `hal.id.read` | `type` (`national-card-barcode`, `residency-card-barcode`, `passport-mrz`), optional `deviceId` | `type`, `format`, `raw` (unparsed barcode data or MRZ lines), optional `mrzCheckDigitsValid` | as `hal.scan.document` | **fails closed**: `unavailable` / `not-implemented` from the shell until WP-1.2. Card formats are Q-K12; parsing belongs to card-format plug-ins outside the HAL (§23) |
| `hal.auth.onBadge` | optional `deviceId` | `subscriptionId`; then one event per tap, after the shell has run the Keycloak step-up for it: `readerId`, `outcome` (`step-up-completed` or `step-up-refused`), on completion an opaque single-use `stepUpRef`, and its own `auditId`. The badge credential itself never crosses the bridge | unavailable, not-permitted, device-error | simulated badge reader and simulated step-up; the real step-up, the session swap and the ≤2 s measurement wait for WP-0.4 (§12.8, §14.4; KA-032) |
| `hal.sign.capture` | `purpose` (`consent`, `receipt`, `document`), `promptKey` (a catalogue key, never text), optional `deviceId` | `mediaType` (`image/svg+xml`, `image/png`), `blobRef`, `sha256`, `byteLength`, `strokeCount`, `capturedAt` | as `hal.scan.document` | simulated on-glass signature. This is a handwritten image, not the electronic signature of the sign and co-sign pattern |
| `hal.pay.request` | `amount` (a decimal string), `currency` (`IQD`, `USD`), `reference` (a payment reference, never a patient identifier), optional `terminalId` | `outcome` (`approved` or `declined`, a result and not an error), `amount`, `currency`, `terminalId`, `terminalTransactionId`, `batchId`. No card PAN, masked or not, and no card data (§12.8): the closed value has no field for them | as `hal.scan.document` | **fails closed**: `unavailable` / `not-implemented` from the shell until WP-1.9 |
| `hal.camera.photo` | `purpose` (`patient-photo`, `clinical-photo`, `document`), optional `deviceId` | `mediaType`, `blobRef`, `sha256`, `byteLength`, `widthPx`, `heightPx` | as `hal.scan.document` | simulated camera |
| `hal.kiosk.lock` | `state` (`locked`, `unlocked`) | `state` | unavailable, not-permitted, invalid-request | simulated lock; kiosk hardening is P2 (§13.5) |
| `hal.capabilities` | none (`{}`) | `contractVersion`, `supportedContractVersions`, `shell` (`version`, `simulated`), `workstationProfile`, `devices` (class, status, `permitted`, `simulated`), and for every call one of `available`, `not-permitted`, `no-device`, `not-implemented` | unavailable | reports the simulated devices and the profile (§12.8) |

**Blobs.** Scans, photos and signatures stay in the shell for the session and cross the bridge as a `blobRef` with a SHA-256; the web app reads the bytes through the shell and uploads them to the cell. The shell never writes them to a user folder or a device gallery (§9.4: clinical photos in-app only) and deletes them when the session ends.

**Subscriptions.** `hal.scan.onBarcode` and `hal.auth.onBadge` return a subscription; each event carries its own `auditId`. Closing a subscription is a local unlisten in `hal-client`, not a HAL call [P].

**Badge taps.** §12.8 routes a tap "reader → shell → Keycloak step-up bound to the workstation certificate → session swap". The shell therefore reads the badge, runs the step-up itself over the workstation certificate it holds, and sends the web app only the outcome. On success the event carries `stepUpRef`: an opaque, single-use, short-lived reference to that step-up, which the cell accepts once and only for the workstation that completed it [P]. It is not the badge credential, which stays in the shell, so no script in the web layer can read or replay it. How the web app redeems the reference for the session swap is designed in WP-0.4. In WP-0.7 the step-up is simulated. A co-signature needs tap plus PIN (§12.8); the PIN step belongs to the same WP-0.4 design and is simulated in the WP-0.7 demo.

**Amounts.** `hal.pay.request` carries amounts as decimal strings. Neither `hal-client` nor the shell parses or computes with them; the cashiering module of WP-1.9 owns the arithmetic (dual currency, §9.21).

## Windows and patients

The shell can host several windows, each with its own patient context (`docs/specs/modules/design-system.md` §2.2). A device result must reach only the window, and the patient, it was meant for:

- **Barcode reads go only to the focused window.** The shell delivers each read to the subscriptions of the window that has the input focus when the read arrives, never to every subscriber. A read that arrives while no HMS window has the focus is delivered to none.
- **Badge taps go to every window.** A completed step-up that changes the user clears the patient context of every window of the workstation session (design-system §2.2), so every window receives the tap's outcome.
- **Captures are bound to the window's patient.** The HAL request carries no patient identifier. Instead, `hal-client` records the window's patient id and context-change time when it sends `hal.camera.photo`, `hal.scan.document`, `hal.id.read` or `hal.sign.capture`, and discards a result that arrives after that window's context changed: the screen shows `hal.capture.discardedAfterContextChange`, and the blob is released. While a capture waits for a device, it holds the window's modal guard, so no patient switch starts meanwhile.

## Audit

Every call, and every subscription event, writes one local audit record with the closed shape `$defs/auditRecord`: `auditId`, `writtenBy` (`shell`, or `hal-client` for its own `no-shell` refusal only), `contractVersion`, `call`, `event` for subscription events (`barcode-read` or `badge-tap`), `at` (UTC), `outcome`, `errorKind` and `errorReason` on errors, `workstationId`, `sessionRef` (an opaque staff-session reference), and where they apply `deviceId`, `jobId`, `templateId`, `templateVersion` and `reprintOf`. A refused badge tap is recorded with `outcome: error`, `not-permitted` / `step-up-refused`.

**No PHI in the audit log (H13, SI-20; CTRL-0020-7's allowlist principle).** The record is an allowlist: it has no field for a patient identifier or name, label, document or barcode content, an image or signature, ID-document data, a badge credential or step-up reference, or a payment amount or reference, and the schema rejects any extra field. It also holds no hash of a payload, because a hash of a label or a barcode is PHI-derived (an MRN can be found by trying candidates). `hal-core` writes the records as JSON lines to a local file on the workstation; they stay there until WP-0.4 brings the BALP audit store, and then go to the cell (open question OQ-147, KA-034). The canary scan of WP-0.4 covers this log once it is shipped.

## Security

- The shell exposes the HAL over Tauri IPC only to the web app loaded from the cell's configured origin; the Tauri capabilities allow no other origin and no other command (§13.5: no arbitrary native code reachable from the web layer).
- Every capability (raw print, ID read, payment and the rest) is granted per workstation profile and role, and every call is audited (§13.5). In WP-0.7 the workstation profile is a local, synthetic configuration of the shell and roles are simulated; real roles come with the Trust Plane (WP-0.4).
- No authentication secret crosses the bridge: the badge credential stays in the shell (above).
- Drivers are signed plugins loaded only when signature and policy allow (§12.8). WP-0.7 ships simulated devices only; no physical device has been tested (S7-K, KA-035).

## Versioning

`contractVersion` is `1`. Within version 1 the contract changes only by addition (a new optional request field, a new call, a new reason under an existing kind), and the fixtures change with it. Removing or renaming a field, changing a type or adding an error kind makes version 2. The shell reports the versions it supports in `hal.capabilities`; R16 §14.2 asks the shell to support the current and the previous server version [E].

## Fixtures and checks

The fixtures are the shared oracle: `hal-client`'s `hal-contract-fixtures` test and the shell's `cargo test` serde round-trip read the same files (WP-0.7 slices S8 and S9). Each fixture holds the request, the response, the audit record, and for a subscription its events and their audit records (`eventAudits`, in the order of `events`). Its file name is `<fixture>.json`, where the fixture name is `<call>.<ok or error kind>`, with a `.<reason>` suffix where a call has more than one fixture of a kind.

The schema itself makes the response and the audit record agree on the outcome (`ok: true` with `outcome: ok`, `ok: false` with `outcome: error`), the error kind and the error reason; it allows `event` only with its own subscription call, and `events` and `eventAudits` only together and only on subscription calls; it makes a reason suffix in the fixture name match the error's reason; and it ties `writtenBy: hal-client` to the `no-shell` reason. A schema cannot compare two identifiers, so the tests must also check:

1. the response's `auditId` equals the audit record's;
2. every event's `subscriptionId` equals the response's `subscriptionId`;
3. there are as many `eventAudits` as `events`, and each event's `auditId` equals its audit record's;
4. a badge event's `outcome` agrees with its audit record (`step-up-refused` with `outcome: error`);
5. no audit ID repeats, within a fixture or across the fixtures.

Until those tests exist, validate the fixtures with the project venv's `jsonschema` (on the Windows checkout `.tools/venv/Scripts/python.exe`, in the WSL clone `.tools/venv/bin/python`). The command checks the schema, every fixture and checks 1 and 3:

```sh
.tools/venv/bin/python -I -c "import json,glob,sys; from jsonschema import Draft202012Validator as V; s=json.load(open('docs/specs/hal/hal-v1.schema.json',encoding='utf-8')); V.check_schema(s); v=V(s); docs=[(f,json.load(open(f,encoding='utf-8'))) for f in sorted(glob.glob('docs/specs/hal/fixtures/*.json'))]; bad=[(f,e.message) for f,d in docs for e in v.iter_errors(d)]+[(f,'auditId mismatch') for f,d in docs if d['response']['auditId']!=d['audit']['auditId'] or [e['auditId'] for e in d.get('events',[])]!=[a['auditId'] for a in d.get('eventAudits',[])]]; print(bad or 'all %d fixtures valid' % len(docs)); sys.exit(1 if bad else 0)"
```
