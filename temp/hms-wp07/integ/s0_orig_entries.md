The numbers are placeholders for you to assign. design-system.md, hal/README.md and patient-context.yaml/.md use the same placeholders (DN-new-1..6, OQ-new-1..18, KA-new-1..12); `grep -rn "\-new-" docs/specs` finds them all.

=== DECISIONS-NEEDED.md ===

## DN-new-1: WP-0.7 branch base and how it allocates IDs

- **Status:** open
- **Blocks:** nothing now (the default is in use); it settles how `wp/0.7-design-system` reaches `main`
- **Default in use:** `wp/0.7-design-system` stacks on `wp/0.1-programme-bootstrap` (from `6ca3e3a`; DN-011). The lead rebases it onto the WP-0.1 review-fix commit. WP-0.7 adds no ADR: it records its own engineering choices [P] as OPEN-QUESTIONS entries, as WP-0.1 did. Its DN, OQ and KA numbers are given by the lead when the entries are applied, so they cannot collide with WP-0.2's. The ADR-002 rows for WP-0.7's pinned set are added in slice S1. The dependency-scorecard rows are kept in the WP-0.7 evidence until the scorecard file, which exists only on `wp/0.2-environments`, reaches this branch (OQ-104).
- **Who decides:** the human lead.
- **Context:** `wp/0.2-environments` already holds ADR-029 and `docs/program/dependency-scorecard.md`. `sh tools/hms repo check` rejects any gap in ADR numbers (rule b). An ADR written on WP-0.7 would either take ADR-029 and collide with WP-0.2, or take ADR-030 and leave a gap on this branch, depending on the order the stacks merge.
- **Options:**
  1. **Stack on `wp/0.1-programme-bootstrap` with no new ADR (default).** Engineering choices go in as OQ entries.
  2. Stack on `wp/0.2-environments`. WP-0.7 gets ADR-029 and the scorecard, but then waits for WP-0.2's review and inherits its lite-cell question (DN-005, OQ-084).
  3. Another rule the lead states.

## DN-new-2: Sorani and Arabic text for the banner and the UI

- **Status:** closed (2026-10-18)
- **Resolution:** the human lead answered through the question tool on 18 October 2026 (answer recorded at 2026-10-18T19:12:56Z).
  - The question was: "The screens need Kurdish (Sorani) and Arabic text: about 40 labels for the patient banner, things like "Allergies", "No known allergies", "Not assessed", "Weight (dated)". The plan's rule says no invented or machine translation, because wrong clinical wording is a safety risk. How do you want to handle it?"
  - The answer was "AI drafts, you check (Recommended)", whose option read: "I draft Sorani and Arabic, each label marked 'unreviewed'. You (or a clinician) correct them, and the clinician review stays a gate before any hospital use. Recorded as a deviation from the rule."
  - This deviates from `frontend/packages/i18n/README.md` ("Never machine-translate, and never invent clinical wording or translations"). The human's answer is the authority.
  - The build agent writes the `ckb` and `ar` drafts in its own session. No catalogue text goes to any other translation or LLM service (§3.7).
  - Every drafted message carries a machine-readable `unreviewed` status per key (mechanism chosen in slice S2). Slice S2 also adds a note of this deviation to the i18n README.
  - Clinician review stays a [HUMAN] gate before any hospital use (§11.1, §18.9; OQ-new-17). The WP-0.7 "three languages" evidence is labelled "unreviewed drafts" (KA-new-7).
- **Blocks:** nothing now; hospital use waits for the clinician review.
- **Default in use:** agent-drafted text, marked unreviewed.
- **Who decides:** the human lead (decided); a clinician reviews the text [HUMAN].
- **Context:** WP-0.7 needs three UI languages (§21 exit: "A demo route renders the banner in three languages"). The i18n README forbids invented or machine translation.
- **Options (at the time):** AI drafts that a human checks (chosen); the human writes the text; marked placeholders until real text arrives.

## DN-new-3: Licences not on the shipped allowlist: 0BSD, Unicode-3.0 and Zlib

- **Status:** closed (2026-10-18)
- **Resolution:** the human lead answered through the question tool on 18 October 2026 (answer recorded at 2026-10-18T19:12:56Z).
  - The question was: "The UI libraries will probably pull in small pieces of code under three permissive open-source licences that aren't on the project's approved list yet: 0BSD, Unicode-3.0 and Zlib. All three let you ship them in a commercial product. Add them to the approved list?"
  - The answer was "Approve all three (Recommended)", whose option read: "Add 0BSD, Unicode-3.0 and Zlib to the shipped-code allowlist, recorded as your decision. The build carries on without stopping."
  - This is stop-and-ask item 2 (§3.4), decided by the human. It extends the §4.3 allowlist by exactly these three SPDX identifiers and no others.
  - Slice S1 adds them to `allowed` in `tools/licence/policy.yaml` and to `tools/licence/ort/license-classifications.yml` in the same change, citing this entry. Slice S1 also gives ADR-022 a dated note citing this entry; ADR-022's decision is otherwise unchanged.
  - 0BSD was already acceptable for build-only tools (OQ-097); it is now allowed in shipped code too.
- **Blocks:** nothing (decided).
- **Who decides:** the human lead (decided).
- **Context:** the likely sources are tslib (0BSD), unicode-ident and ICU4X through `url`/`idna` (Unicode-3.0), and foldhash (Zlib), in the npm and Rust dependency trees of WP-0.7.

## DN-new-4: Windows packaging of the Tauri shell

- **Status:** open
- **Blocks:** WP-0.7's Windows shell bundle only (the release step `desktop-shell` for Windows). It does not block the exit criteria.
- **Default in use:** the shell is built and packaged as a Linux `.deb` in the WSL build host. The Windows bundle is a NOT-BUILT [HUMAN] step in `tools/ci/run` (slice S11; KA-new-5).
- **Who decides:** the human lead (host owner); option 1 needs administrator rights (§3.4 item 9).
- **Context:** ADR-019: "building the Windows shell bundle needs a Windows Rust toolchain or a Windows build agent, which is not yet decided (WP-0.7)". Hospital workstations are expected to run Windows, with the shell on WebView2. The Windows host has no Rust toolchain and no MSVC build tools.
- **Options:**
  1. Install Rust (rustup, MSVC target) and the Microsoft C++ Build Tools on the Windows host. The human runs the commands, for example `winget install --id Rustlang.Rustup -e` and `winget install --id Microsoft.VisualStudio.2022.BuildTools -e --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"`, after checking the vendors' current pages. WebView2 ships with Windows 11. This accepts the Build Tools licence terms.
  2. A Windows build agent in hosted CI, once DN-010 is answered.
  3. Cross-compile from Linux (for example with cargo-xwin). Tauri marks this experimental, and it downloads the Windows SDK under Microsoft's licence terms, which a human must accept.
  - Windows code signing is a separate, later release decision.

## DN-new-5: Android SDK and macOS for mobile device builds

- **Status:** open
- **Blocks:** device builds of the mobile skeleton (the `mobile-builds` step), the Maestro mobile banner test `E2E:banner-on-every-mobile-clinical-view` (CTRL-0016-5; KA-new-2), and iOS builds. It does not block the WP-0.7 exit criteria.
- **Default in use:** WP-0.7 builds the JavaScript skeleton with `tsc`, its unit tests and an offline `expo export --platform android` bundle (`EXPO_OFFLINE=1`, `EXPO_NO_TELEMETRY=1`). `mobile-builds` stays NOT-BUILT [HUMAN] (KA-new-6). Device builds are planned with WP-3.3 (`PLT-UX-04`, R2b).
- **Who decides:** the human lead (host owner). Accepting the Android SDK licences (`sdkmanager --licenses`) is the human's step.
- **Context:** neither host has an Android SDK. iOS builds need macOS ("Before the first session"). An Android emulator in WSL2 needs nested virtualisation (KVM).
- **Options:**
  1. Install the Android SDK command-line tools and the JDK version the Android Gradle plugin requires, in the WSL host, and accept the SDK licences [HUMAN]. Use a physical device or an emulator.
  2. **Defer device builds to WP-3.3 and keep the JavaScript skeleton only (default).**
  3. For iOS: a macOS build host, or hosted macOS CI after DN-010.

## DN-new-6: Expo and pnpm workspace settings

- **Status:** open
- **Blocks:** WP-0.7 slice S10 (the mobile skeleton) only.
- **Default in use:** keep pnpm's isolated linker and strict peer dependencies for the whole workspace. S10 starts with a spike: whether Metro and Expo work with them. If they do not, S10 stops and this entry asks for a choice. If web and mobile need different React versions (Expo's React Native version pins React), a named pnpm catalog is the fallback.
- **Who decides:** the human lead (a workspace-wide setting that affects every package and the ADR-002 pinned set).
- **Context:** Expo projects in pnpm monorepos often need `nodeLinker: hoisted` or relaxed peers. Either changes a setting for the whole workspace and weakens phantom-dependency detection for every package.
- **Options:**
  1. **Isolated linker and strict peers (default)**, if the spike passes.
  2. Workspace-wide `nodeLinker: hoisted` and/or relaxed peers.
  3. A separate pnpm workspace with its own lockfile for `apps/mobile`.
  4. A named catalog for diverging React versions, together with 1, 2 or 3.

=== OPEN-QUESTIONS.md ===
Put OQ-new-5 and OQ-new-17 in section (e) "Content requests". Put the others in a new section after (f), titled "(g) Engineering choices [P] and readings made in WP-0.7, awaiting confirmation".

### OQ-new-1: "Within the last 60 s" is read inclusively
- **Reading in use:** identity re-verification is required when the window's last patient-context change happened 60 s or less before the sign or co-sign step opens, 60.000 s included. Time is measured on a monotonic clock. An unknown change time, an unreadable clock or a negative elapsed time counts as within the window (`docs/specs/state-machines/patient-context.yaml`, predicate `contextChangedWithinWindow`; `docs/specs/modules/design-system.md` §2.3).
- **Sources:** §2.1 SI-16 ("if the context changed within the last 60 s"), §9.4 acceptance ("within 60 s") and §8.4 order Sign ("<60 s ago"). §8.4 reads as exclusive, and SI-16 and §9.4 do not say. The inclusive reading requires re-verification in more cases, so it is the stricter one (§1).
- **Who confirms:** the CSO [HUMAN].
- **Status:** open

### OQ-new-2: Two frontend packages beyond §6.1
- **Choice:** `frontend/packages/ui-core` (DOM-free: the banner model, patient context, `clinical-number`, the clock; shared by web and mobile) and `frontend/packages/hal-client` (the typed HAL contract and its transports).
- **Sources:** §6.1 [P] and ADR-019 "Layout [P]" list design-system, regulated-ui, i18n and api-client. ADR-019 is not edited; this entry records the addition.
- **Status:** open

### OQ-new-3: Western digits for every number in the staff UI; no grouping; dates as YYYY-MM-DD
- **Choice:** a tightening of §6.5, applied to all staff workspaces:
  - the UI locales are `en`, `ckb-u-nu-latn-ca-gregory` and `ar-u-nu-latn-ca-gregory`;
  - no Eastern Arabic-Indic digit appears anywhere in the staff workspaces;
  - clinical numbers have no grouping separator;
  - the banner shows dates as `YYYY-MM-DD` (`docs/specs/modules/design-system.md` §2.6, §3).
  §6.5 still allows Eastern digits, by configuration, for non-clinical numbers in patient-facing Kurdish and Arabic text. That option is kept for patient-facing surfaces (templates, signage, front door) when they are built.
- **Sources:** §6.5, §11.1, §14.6, §18.9 "Digits".
- **Who confirms:** the human lead. WP-0.8's wristband date format must match the banner's.
- **Status:** open

### OQ-new-4: The demo route is left out of production builds
- **Choice:** `/demo/*` is registered only when the build sets `VITE_HMS_DEMO=1`, and the route-tree test checks that the production tree has no `/demo`. Demo pages use synthetic fixtures only and carry a "NOT FOR CLINICAL USE" watermark.
- **Sources:** §21 WP-0.7 exit ("A demo route renders the banner…"); §3.3, §18.10. The plan says nothing about production builds.
- **Status:** open

### OQ-new-5 (content request): Code-status and isolation vocabularies
- **Content needed:** the code-status vocabulary (values, definitions, labels in en, ckb and ar) and the isolation-precaution vocabulary (§9.4: contact, droplet, airborne, and any others), approved for clinical use [HUMAN] (§3.4 item 3).
- **In use:** synthetic sample entries (`provenance: synthetic`, NOT FOR CLINICAL USE) in the WP-0.7 demo fixtures only (`docs/specs/modules/design-system.md` §2.1).
- **Needed by:** WP-1.4 (`CLN-IPC-01`) and R2a (`CLN-ACP-01`), before any clinical use.
- **Status:** open

### OQ-new-6: The API-client generator waits for WP-0.4
- **Choice:** WP-0.7 does not build the `packages/api-client` generator. The banner reads synthetic fixtures. The first OpenAPI contracts come with WP-0.3 and WP-0.4 (`docs/specs/api/README.md`).
- **Sources:** §6.3; §21 WP-0.7 scope does not name the API client.
- **Status:** open

### OQ-new-7: `shell-fast` fails on the Windows checkout
- **Choice:** the new fast-tier step `shell-fast` (`cargo test`, `clippy -D warnings` and `fmt --check` for `frontend/apps/shell`) runs in the WSL clone. On the Windows checkout, which has no Rust toolchain, it fails with an explicit "Rust toolchain missing" message. It never skips silently. Windows runs are not evidence of record (KA-001, OQ-100).
- **Status:** open

### OQ-new-8: Changing the UI language on mobile needs an app restart
- **Choice:** the mobile app applies a language change after a restart, because switching React Native's layout direction needs a reload. The web app changes language in place.
- **Sources:** §11.1 (UI language per user), §14.6.
- **Status:** open

### OQ-new-9: The HAL audit log stays on the workstation until WP-0.4
- **Choice:** `hal-core` writes its audit records (a closed allowlist of fields, no PHI, no payload hash; `docs/specs/hal/README.md`) as JSON lines to a local file. Shipping them to the BALP audit store, and the canary scan over them, come with WP-0.4 (`TRU-AUD-01`).
- **Sources:** §13.5 ("every call is audited"), §12.8, §21 WP-0.4.
- **Status:** open

### OQ-new-10: One font family for the UI and for WP-0.8's prints
- **Choice:** slice S4 chooses one OFL family (Noto Sans Arabic with Noto Sans, or Vazirmatn), decided by the `font-coverage` and `glyph-render` tests. WP-0.8 uses the same family and reuses `packages/i18n/src/sorani-letters.json`, and keeps its own font-coverage test.
- **Sources:** §4.1 "Fonts" [P]; §21 WP-0.8.
- **Status:** open

### OQ-new-11: What "identity is re-verified at signing" means
- **Reading in use:** within the window, the sign and co-sign dialog shows a re-verification step before authentication. It shows the photo (or "No photo"), the name in the patient's script and in Latin, the MRN, and the date of birth or the approximate-DOB flag. The signer confirms with a control that is never preselected, never focused on open and never the default action. This is in addition to authenticating the signer for every signature (§9.4).
- **Stricter alternatives:** re-authenticate the signer as well within the window (badge tap plus PIN), or have the signer select or type an identifier.
- **Sources:** §2.1 SI-16; §8.4 order Sign; §9.4 acceptance ("forces re-verification").
- **Who confirms:** the CSO [HUMAN]. This is a reading of a safety invariant (§3.4 items 1 and 8).
- **Status:** open

### OQ-new-12: What counts as a patient-context change; a change of user clears the context
- **Reading in use:** any change of the window's patient id counts: from none to a patient, from one patient to another after confirmation, and from a patient to none. Selecting the patient already open does not count. A badge tap or sign-in that changes the user clears the window's patient context and closes any open dialog without signing [P].
- **Sources:** §2.1 SI-16; §12.8 (badge tap); `docs/specs/state-machines/patient-context.yaml`.
- **Who confirms:** the CSO [HUMAN].
- **Status:** open

### OQ-new-13: "Trilingual name display" on the banner
- **Reading in use:**
  - The banner always shows the name in the patient's script and its Latin transliteration (SI-01).
  - It also shows the other Arabic-script form (Kurdish or Arabic) when the record holds it.
  - A missing script form or Latin form is flagged "Identity incomplete"; a missing third form is not flagged.
  - For a patient whose own script is Latin, one Latin form satisfies both.
- **Sources:** §2.1 SI-16 and SI-01; §9.1; §11.2 (Kurdish, Arabic and Latin forms, with a display name per locale).
- **Who confirms:** the CSO [HUMAN].
- **Status:** open

### OQ-new-14: Who approves the patient-context state machine
- **Reading in use:** approval is requested from `cso`, `physician-panel` and `nurse-panel` (`docs/specs/state-machines/patient-context.yaml`; `approved_by` empty, `record: null`). Every transition is marked proposed, because R11 draws no such machine; R11 §15 item 6 states only the rule.
- **Sources:** §8.4 names approvers for each of its machines, but none for patient context; OQ-083.
- **Who confirms:** the human lead and the CSO [HUMAN]. The approval itself is written only from a sign-off record (§3.5). The request can join WP-0.5's approval requests.
- **Status:** open

### OQ-new-15: The shapes and error vocabulary of HAL contract v1
- **Choice:** `docs/specs/hal/` (README, `hal-v1.schema.json`, 67 fixtures):
  - a closed result envelope `{ok, value | error, auditId}`;
  - six error kinds, each with fixed reasons, a `retryable` flag and a catalogue key, and no free text;
  - `blobRef` handles for scans, photos and signatures;
  - subscriptions for barcode reads and badge taps;
  - an audit-record allowlist with no payload hash;
  - amounts as decimal strings;
  - a payment value with no card data, and "declined" as a result rather than an error;
  - `contractVersion` 1, changed only by addition.
- **Sources:** §12.8 names the calls and requires "a typed result and an audit ID"; R16 §14.2. Neither gives shapes.
- **Status:** open

### OQ-new-16: The ISMP trailing-zero rule for results
- **Reading in use:** `ClinicalNumber` removes trailing zeros from every clinical numeral, results included. This is the stricter reading of §2.1 ("no trailing zeros"). It can drop the reported precision of a laboratory result (4.0 is shown as 4).
- **Sources:** §2.1 (acceptance criteria: ISMP display rules), §6.5 (doses), R11 §15 item 8, SAC-50, CTRL-0005-17.
- **Who confirms:** the CSO and the laboratory CSO [HUMAN], before WP-1.7 shows results.
- **Status:** open

### OQ-new-17 (content request): Clinician review of the ckb and ar UI text
- **Content needed:** a clinician review [HUMAN] of every `ckb` and `ar` message the agent drafted (DN-new-2), starting with the `banner.*`, `clinical.*` and `sign.*` keys; and a translation memory owned by the content team (§11.1).
- **In use:** agent-drafted text, marked `unreviewed` per key (KA-new-7).
- **Needed by:** before any hospital use; it is part of the release translation gate (§11.1, §18.9; Phase 1 exit).
- **Status:** open

### OQ-new-18: Banner display rules [P]
- **Choice:**
  - every allergy is shown, wrapping onto more lines, never collapsed;
  - the date of birth is shown at its recorded precision with the approximate-DOB flag, and the placeholder day of an estimate is never shown;
  - the weight shows its source and date, and a weight without a date is not shown;
  - each invalid field shows its own "unavailable" state;
  - the banner error state (patient id, MRN or every name form missing) disables clinical actions;
  - a missing date of birth with no approximate flag disables signing;
  - a missing script form or Latin form alone is flagged but does not block. The alternative is to block signing too.
  (`docs/specs/modules/design-system.md` §2.1.)
- **Sources:** §2.1 SI-16 and SI-01; §9.4; R11 §15 items 2 and 3.
- **Who confirms:** the CSO [HUMAN], for the blocking rules.
- **Status:** open

=== KNOWN-ANOMALIES.md (table rows; Since 2026-10-19; all open) ===
| KA-new-1 | The server-side refusal to sign without identity re-verification (the server part of CTRL-0016-7) is not built. WP-0.7 builds only the client rule: within 60 s of a context change, the sign and co-sign dialog requires re-verification (`ui-core`). The sign-command contract carries the context-change and re-verification times for the server. No sign command exists yet | H1; SI-16 (HAZ-0016, CTRL-0016-7) | `PLT-UX-01` | 2026-10-19 | open | WP-1.4 [P] (the first sign commands: notes and orders) |
| KA-new-2 | The banner is not verified on mobile views or prints. `E2E:banner-on-every-mobile-clinical-view` needs Maestro and an Android build (DN-new-5), and `TemplateLint:banner-on-every-clinical-print` needs WP-0.8's templates; both are CTRL-0016-5 tests. `mobile-banner-model.test.ts` covers the shared model only | H1; SI-16 (CTRL-0016-3, CTRL-0016-5) | `PLT-UX-01`, `PLT-UX-04` | 2026-10-19 | open | WP-0.8 (prints); DN-new-5 and WP-3.3 (mobile) |
| KA-new-3 | `hal.id.read` and `hal.pay.request` fail closed: every transport returns `unavailable` / `not-implemented`, so there is no ID-document capture and no card payment through the shell. Their success fixtures only define the shape | H1 (registration identity capture, SI-01); none for payments | `PLT-UX-02` | 2026-10-19 | open | WP-1.2 (ID-card and MRZ reader simulators), WP-1.9 (card-terminal simulator) (§3.7) |
| KA-new-4 | There is no site print service to fall back on without the shell. §12.8 says the UI degrades to the site print service, which does not exist yet. In a plain browser every print returns `unavailable` / `no-shell` and the screen says so; wristbands and labels cannot be printed from a plain browser | H1 (SI-01 wristbands and labels) | `PLT-UX-02` | 2026-10-19 | open | WP-0.8 or WP-1.13 (`PLT-EDGE-01`, the site print spool) [P] |
| KA-new-5 | No Windows bundle of the shell: the release step `desktop-shell` builds the Linux `.deb` only; the Windows bundle is NOT-BUILT [HUMAN] | None directly | `PLT-UX-02` | 2026-10-19 | open | DN-new-4 [HUMAN] |
| KA-new-6 | No mobile device builds: no Android APK or AAB and no iOS build; `mobile-builds` is NOT-BUILT [HUMAN]. Only the JavaScript skeleton and an offline `expo export` bundle exist | None directly (the mobile banner is KA-new-2) | `PLT-UX-04` | 2026-10-19 | open | DN-new-5 [HUMAN]; WP-3.3 |
| KA-new-7 | The `ckb` and `ar` UI text are agent drafts, marked `unreviewed` per key. This is a recorded deviation from the `packages/i18n` README rule (DN-new-2). The three-language exit evidence shows these drafts. Not for hospital use until a clinician has reviewed them | H1, H2 (misread clinical wording, for example "NKA" against "not assessed") | `KRI-LOC-01`, `PLT-UX-03` | 2026-10-19 | open | OQ-new-17 [HUMAN] clinician review; the release translation gate (§11.1, §18.9) |
| KA-new-8 | The exit criterion "a simulated badge tap switches users in ≤2 s" is not met in WP-0.7. The badge reader is simulated, but the Keycloak step-up and session swap come with WP-0.4. `badge-tap-switch.spec.ts` (slice S13) runs after WP-0.4 | None directly (§14.4 target) | `PLT-UX-02` | 2026-10-19 | open | WP-0.4, then WP-0.7 slice S13 |
| KA-new-9 | Banner data is synthetic and client-side only. There is no server-side banner model or BFF (CTRL-0016-1). There are no sensitivity indicators (§9.4; they need the PEP of WP-0.4 and the SI-21 labels). MRN check digits are not validated (CTRL-0001-7, WP-1.2). Code-status and isolation vocabularies are synthetic (OQ-new-5) | H1, H14; SI-16, SI-01, SI-21 | `PLT-UX-01` | 2026-10-19 | open | WP-0.4 (PEP, labels); WP-1.2 (identity, MRN); WP-1.4 (`CLN-CHT-01`, `CLN-IPC-01`); R2a (`CLN-ACP-01`) |
| KA-new-10 | HAL audit records stay on the workstation in a local JSON-lines file. They are not in the BALP audit store and not covered by the canary scan | H13; SI-20 | `PLT-UX-02` | 2026-10-19 | open | WP-0.4 (`TRU-AUD-01`) |
| KA-new-11 | Simulated devices only: no physical printer, scanner, badge reader, signature pad or camera has been tested. Sorani and Arabic shaping on printers is S7-K | H1 (SI-01 wristband and label printing) | `PLT-UX-02` | 2026-10-19 | open | S7-K [HUMAN: printers]; WP-0.8 |
| KA-new-12 | CTRL-0005-17 is only partly built: `ClinicalNumber` applies the ISMP rules (leading zero, no trailing zero, no naked decimal) with Western digits on screens. Tall-man lettering needs the governed LASA list (§3.4 item 3), and number display on prints is WP-0.8 | H2; SI-05 (CTRL-0005-17) | `PLT-UX-01` | 2026-10-19 | open | WP-0.8 (prints); the work package that builds the formulary (`MED-FRM-01`) for tall-man lettering |

=== backlog.yaml (edit only status and notes; hazards stays derived) ===
- PLT-UX-01: status todo → spec. notes: ["WP-0.7 S0: module specification docs/specs/modules/design-system.md (components, banner rules, number display, RTL, test table §9, message keys §10) and docs/specs/state-machines/patient-context.yaml (approval requested; every transition proposed). Anomalies KA-new-1, KA-new-2, KA-new-9, KA-new-12."]
- PLT-UX-02: status todo → spec. notes: ["WP-0.7 S0: HAL contract v1 in docs/specs/hal/ (README, hal-v1.schema.json, 67 synthetic fixtures). hal.id.read and hal.pay.request fail closed until WP-1.2 and WP-1.9 (KA-new-3); Windows bundle DN-new-4 (KA-new-5); badge tap ≤2 s after WP-0.4 (KA-new-8). FHIRcast, in this feature's A.1 scope, is not in WP-0.7."]
- PLT-UX-03: status todo → spec. notes: ["WP-0.7 (base) S0: RTL, bidi and digit rules in docs/specs/modules/design-system.md §2.6 to §3 (Western digits throughout the staff UI, OQ-new-3). Hijri display, bilingual prints and multi-script phonetic name search are not in WP-0.7."]
- KRI-LOC-01: status todo → spec. notes: ["WP-0.7 (base) S0: message keys in docs/specs/modules/design-system.md §10. The ckb and ar text is agent-drafted and unreviewed (DN-new-2, KA-new-7, OQ-new-17); trilingual outputs come with WP-1.10."]
- Optional, PLT-UX-04: add the extra work_packages entry "WP-0.7 (skeleton)". notes: ["WP-0.7 S10 builds only the Expo skeleton (nurse and physician modes, shared ui-core banner model); the framework and the encrypted offline store are WP-3.3. Device builds: DN-new-5 (KA-new-6)."]
If you would rather keep "spec" for when slices begin, leave status at todo and add only the notes.

=== WORK-PACKAGES.md ===
- WP-0.7 row, "State" column: "**in-progress**: S0 specification written on `wp/0.7-design-system`, stacked on `wp/0.1-programme-bootstrap` (DN-new-1): `docs/specs/modules/design-system.md`, `docs/specs/state-machines/patient-context.yaml` (approval requested), `docs/specs/hal/`. DN-new-2 (ckb and ar text: AI drafts, human checks) and DN-new-3 (0BSD, Unicode-3.0, Zlib allowed) were closed by the human lead on 18 October 2026. Still open: DN-new-4 (Windows bundle), DN-new-5 (Android SDK, macOS), DN-new-6 (Expo and pnpm). The badge-tap criterion needs WP-0.4 (KA-new-8)."
- Notes item 4, append: "WP-0.7 started on 19 October 2026 beside WP-0.2. Its plan runs slices S0 to S13. Programme files change only at the S0 and S12 checkpoints; slice S13 (the badge-tap measurement) follows WP-0.4."
- `work-packages/WP-0.7.md`, optional: under "[HUMAN] gates", add "Clinician review of the agent-drafted ckb and ar text before any hospital use (DN-new-2, OQ-new-17)" and "Approval of the patient-context state machine (OQ-new-14)".