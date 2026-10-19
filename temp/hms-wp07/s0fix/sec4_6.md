## 4. The web frame and routes

- Code-based TanStack Router routes. Every route declares `staticData.clinical` (required by type, `true` or `false`). Clinical routes sit under the `_clinical` layout, which renders the banner and requires a patient context; a clinical route with no patient in the window shows the patient chooser, never a blank or a stale banner.
- `route-tree.test.ts` (`ArchTest:banner-present-on-every-clinical-route`, CTRL-0016-5) walks the route tree and fails when a clinical route is outside the `_clinical` layout, when a route lacks the flag, or when `/demo` is present in the production route tree.
- **The patient context, not the URL, selects the patient** (§2.2). A patient id in the route is a request to the patient-context machine. Clinical route components and their queries read the context's patient id only; a route whose patient id differs from the context's renders nothing patient-specific until the switch is confirmed, and a cancelled or refused switch replaces the URL with the current patient's.
- The TanStack Query cache keys patient data by patient id and removes the previous patient's entries on every context change (§2.2).
- No request leaves the cell's origin: fonts, icons and catalogues are bundled (tested by `no-external-requests`).

## 5. The demo route

- `/demo/banner?locale=<en|ckb|ar>&density=<comfortable|compact>&fixture=<id>` renders the banner and the sign and co-sign pattern over synthetic fixtures, with the command palette and the locale and density switches. It is the evidence route for the WP-0.7 exit criteria (§21: "A demo route renders the banner in three languages with correct RTL").
- **Synthetic fixtures only** (§18.10, §3.4 item 7): every fixture carries `provenance: synthetic` and is validated by the banner schema; invalid fixtures exist on purpose to show the missing and unavailable states. The set covers at least: a complete record with all three name forms; NKA; not assessed; a long allergy list; missing allergy data; contradictory allergy data (NKA with items); an approximate date of birth (year only); an invalid date of birth; no photo; a missing Latin name; a missing third name form; long four-part names in Sorani and in Arabic, including two patients whose names differ only in the grandfather's name; active isolation; an unknown isolation code; code status documented and not documented; no dated weight; an invalid weight; a label missing in the user's locale; a Latin-script patient; an alias name; a newborn name.
- **"NOT FOR CLINICAL USE" watermark**: a fixed, non-interactive overlay on every demo screen and in every screenshot, in English in every locale (the plan's label, §3.3, §18.10) with the locale's translation beside it in `ckb` and `ar` (`demo.watermark`).
- **Absent from production builds** (OQ-new-3): the demo routes are registered only when the build sets `VITE_HMS_DEMO=1`; otherwise they are not in the bundle, and the route-tree test checks the production tree.

## 6. The Tauri shell and the HAL contract (summary)

The shell hosts the web app on workstations and implements the hardware abstraction layer of §12.8 (plane A). The contract is `docs/specs/hal/` (README, `hal-v1.schema.json`, 69 synthetic fixtures). Summary:

- **Twelve calls**: `hal.print.label`, `hal.print.raw`, `hal.print.document`, `hal.scan.onBarcode`, `hal.scan.document`, `hal.id.read`, `hal.auth.onBadge`, `hal.sign.capture`, `hal.pay.request`, `hal.camera.photo`, `hal.kiosk.lock`, `hal.capabilities`.
- **Every call returns `{ok, value | error, auditId}`**, a closed object; calls never throw across the bridge.
- **Errors**: `unavailable`, `not-permitted`, `invalid-request`, `device-error`, `timeout`, `cancelled`, each with a fixed set of reasons, a `retryable` flag, an `outcomeUnknown` flag and a catalogue key (`hal.error.*`, `hal.reason.*`); no free text and no device output. A timeout or device error on a print or payment call has `outcomeUnknown: true` and `retryable: false`: the job may already have printed or the card may have been charged, so the screen asks the user to check the printer or terminal (`hal.error.outcomeUnknown`), and a reprint is an explicit, audited request that names the earlier job (`reprintOf`).
- **Fail closed**: with no shell, `transport-none` returns `unavailable` / `no-shell` for every call, `hal.id.read` and `hal.pay.request` included; the shell returns `unavailable` / `not-implemented` for those two until the simulators of WP-1.2 and WP-1.9 exist (KA-new-3). Printing without the shell fails until the site print service exists (KA-new-4).
- **Bound to the window and the patient** (§2.2): the shell delivers a barcode read only to the window that has the focus; `hal-client` binds every capture to the window's patient id and context-change time and discards a result that arrives after a context change; a capture waiting for a device counts as a modal, so no switch starts meanwhile.
- **Badge taps never carry the credential across the bridge**: the shell redeems the badge with the Keycloak step-up bound to the workstation certificate (§12.8), and the event carries only the outcome and an opaque, single-use, short-lived step-up reference (OQ-new-11).
- **No PHI in the audit log (H13, SI-20)**: every call and event writes a local audit record whose closed shape has no field for patient data, payload content, credentials or amounts, and no payload hash. The log stays on the workstation until WP-0.4 (OQ-new-8, KA-new-10).
- **No card PAN** reaches the HMS (§12.8); the payment value has no field for card data.
- **Security**: IPC only from the cell's origin; capabilities per workstation profile and role, every call audited (§13.5); simulated devices only in WP-0.7 (KA-new-11).
- **Shell build**: Linux `.deb` in the WSL build host; the Windows bundle is decision DN-new-4 (KA-new-5).

