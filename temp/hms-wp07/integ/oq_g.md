## (g) Engineering choices [P] and readings made in WP-0.7, awaiting confirmation

Choices WP-0.7 made where the plan of record sets no value, and readings of the plan it uses until a human confirms them. They bind until a human confirms or changes them; changing one is an ordinary change with a recorded reason, except where a [HUMAN] role is named. The WP-0.7 readings of safety invariants are not here: they are decisions for the CSO, DN-026 to DN-032 in `DECISIONS-NEEDED.md`.

### OQ-140: Two frontend packages beyond §6.1
- **Choice:** `frontend/packages/ui-core` (DOM-free: the banner model, patient context, `clinical-number`, the clock; shared by web and mobile) and `frontend/packages/hal-client` (the typed HAL contract and its transports).
- **Sources:** §6.1 [P] and ADR-019 "Layout [P]" list design-system, regulated-ui, i18n and api-client. ADR-019 is not edited; this entry records the addition.
- **Status:** open

### OQ-141: Western digits for every number in the staff UI; dates as YYYY-MM-DD
- **Choice:** a tightening of §6.5, applied to all staff workspaces:
  - the UI locales are `en`, `ckb-u-ca-gregory-nu-latn` and `ar-u-ca-gregory-nu-latn` (canonical BCP 47 form);
  - no Eastern Arabic-Indic digit appears anywhere in the staff workspaces;
  - the banner shows dates as `YYYY-MM-DD` (`docs/specs/modules/design-system.md` §2.6, §3).
- The grouping of clinical numbers is DN-031. The §6.5 option of Eastern digits for patient-facing text is kept for those surfaces.
- **Sources:** §6.5, §11.1, §14.6, §18.9 "Digits".
- **Who confirms:** the human lead. WP-0.8's wristband date format must match the banner's.
- **Status:** open

### OQ-142: The demo route is left out of production builds
- **Choice:** `/demo/*` is registered only when the build sets `VITE_HMS_DEMO=1`, and the route-tree test checks that the production tree has no `/demo`. Demo pages use synthetic fixtures only and carry a "NOT FOR CLINICAL USE" watermark.
- **Sources:** §21 WP-0.7 exit ("A demo route renders the banner…"); §3.3, §18.10. The plan says nothing about production builds.
- **Status:** open

### OQ-144: The API-client generator waits for WP-0.4
- **Choice:** WP-0.7 does not build the `packages/api-client` generator. The banner reads synthetic fixtures. The first OpenAPI contracts come with WP-0.3 and WP-0.4 (`docs/specs/api/README.md`).
- **Sources:** §6.3; §21 WP-0.7 scope does not name the API client.
- **Status:** open

### OQ-145: `shell-fast` fails on the Windows checkout
- **Choice:** the new fast-tier step `shell-fast` (`cargo test`, `clippy -D warnings` and `fmt --check` for `frontend/apps/shell`) runs in the WSL clone. On the Windows checkout, which has no Rust toolchain, it fails with an explicit "Rust toolchain missing" message. It never skips silently. Windows runs are not evidence of record (KA-001, OQ-100).
- **Status:** open

### OQ-146: Changing the UI language on mobile needs an app restart
- **Choice:** the mobile app applies a language change after a restart, because switching React Native's layout direction needs a reload. The web app changes language in place.
- **Sources:** §11.1 (UI language per user), §14.6.
- **Status:** open

### OQ-147: The HAL audit log stays on the workstation until WP-0.4
- **Choice:** `hal-core` writes its audit records (a closed allowlist of fields, no PHI, no payload hash; `docs/specs/hal/README.md`) as JSON lines to a local file. Shipping them to the BALP audit store, and the canary scan over them, come with WP-0.4 (`TRU-AUD-01`).
- **Sources:** §13.5 ("every call is audited"), §12.8, §21 WP-0.4.
- **Status:** open

### OQ-148: One font family for the UI and for WP-0.8's prints
- **Choice:** slice S4 chooses one OFL family (Noto Sans Arabic with Noto Sans, or Vazirmatn), decided by the `font-coverage` and `glyph-render` tests. WP-0.8 uses the same family and reuses `packages/i18n/src/sorani-letters.json`, and keeps its own font-coverage test.
- **Sources:** §4.1 "Fonts" [P]; §21 WP-0.8.
- **Status:** open

### OQ-149: Who approves the patient-context state machine
- **Reading in use:**
  - Approval is requested from `cso`, `physician-panel` and `nurse-panel` (`docs/specs/state-machines/patient-context.yaml`; `approved_by` empty, `record: null`).
  - Every transition is marked proposed, because R11 draws no such machine; R11 §15 item 6 states only the rule.
  - The readings the machine encodes are DN-026, DN-027, DN-028 and DN-032.
- **Sources:** §8.4 names approvers for each of its machines, but none for patient context; OQ-083.
- **Who confirms:** the human lead and the CSO [HUMAN]. The approval itself is written only from a sign-off record (§3.5). The request can join WP-0.5's approval requests.
- **Status:** open

### OQ-150: The shapes and error vocabulary of HAL contract v1
- **Choice:** `docs/specs/hal/` (README, `hal-v1.schema.json`, 69 fixtures):
  - a closed result envelope `{ok, value | error, auditId}`;
  - six error kinds, each with fixed reasons, a `retryable` flag, an `outcomeUnknown` flag (true, with `retryable` false, for timeouts and device errors on print and payment calls) and a catalogue key, with no free text;
  - `reprintOf` for an explicit, audited reprint;
  - `blobRef` handles for scans, photos and signatures;
  - subscriptions for barcode reads, delivered only to the focused window;
  - subscriptions for badge taps, delivered to every window. The shell runs the Keycloak step-up over the workstation certificate and sends only the outcome and an opaque, single-use, short-lived `stepUpRef`; the badge credential never crosses the bridge, and WP-0.4 designs the redemption;
  - captures bound in `hal-client` to the window's patient and discarded after a context change;
  - with no shell, `no-shell` for every call (`not-implemented` comes from the shell);
  - an audit-record allowlist with no payload hash, and audit records for subscription events;
  - amounts as decimal strings;
  - a payment value with no card data, and "declined" as a result rather than an error;
  - `contractVersion` 1, changed only by addition.
- **Sources:** §12.8 names the calls, requires "a typed result and an audit ID" and routes the badge "reader → shell → Keycloak step-up bound to the workstation certificate"; R16 §9.6 and §14.2. Neither gives shapes.
- **Who confirms:** the human lead and the security owner (the badge routing).
- **Status:** open
