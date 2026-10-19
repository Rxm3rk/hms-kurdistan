## DN-020: WP-0.7 branch base and how it allocates IDs

- **Status:** open
- **Blocks:** later (how `wp/0.7-design-system` reaches `main`); nothing now, because the default is in use
- **Default in use:** `wp/0.7-design-system` stacks on `wp/0.1-programme-bootstrap` (DN-011), from the WP-0.1 review-fix commit `05f159a`. WP-0.7 adds no ADR: it records its own engineering choices [P] as OPEN-QUESTIONS entries, as WP-0.1 did. Its DN, OQ, KA and hazard numbers come from the ranges `STATUS.md` reserves for it (DN-020…DN-039, OQ-140…OQ-159, KA-025…KA-044, HAZ-0030…HAZ-0034, no ADR), so they cannot collide with WP-0.2's. The ADR-002 rows for WP-0.7's pinned set are added in slice S1. The dependency-scorecard rows are kept in the WP-0.7 evidence until the scorecard file, which exists only on `wp/0.2-environments`, reaches this branch (OQ-104).
- **Who decides:** the human lead.
- **Context:** `wp/0.2-environments` already holds ADR-029 and `docs/program/dependency-scorecard.md`. `sh tools/hms repo check` rejects any gap in ADR numbers (rule b). An ADR written on WP-0.7 would either take ADR-029 and collide with WP-0.2, or take ADR-030 and leave a gap on this branch, depending on the order the stacks merge.
- **Options:**
  1. **Stack on `wp/0.1-programme-bootstrap` with no new ADR (default).** Engineering choices go in as OQ entries.
  2. Stack on `wp/0.2-environments`. WP-0.7 gets ADR-029 and the scorecard, but then waits for WP-0.2's review and inherits its lite-cell question (DN-005, OQ-084).
  3. Another rule the lead states.

## DN-021: Sorani and Arabic text for the banner and the UI

- **Status:** closed (2026-10-18)
- **Resolution:** answered in chat through the question tool by the human lead on 2026-10-18 (the tool recorded the answer at 2026-10-18T19:12:56Z).
  - The question was: "The screens need Kurdish (Sorani) and Arabic text: about 40 labels for the patient banner, things like "Allergies", "No known allergies", "Not assessed", "Weight (dated)". The plan's rule says no invented or machine translation, because wrong clinical wording is a safety risk. How do you want to handle it?"
  - The answer was "AI drafts, you check (Recommended)", whose option read: "I draft Sorani and Arabic, each label marked 'unreviewed'. You (or a clinician) correct them, and the clinician review stays a gate before any hospital use. Recorded as a deviation from the rule."
  - This deviates from `frontend/packages/i18n/README.md` ("Never machine-translate, and never invent clinical wording or translations"). The human's answer is the authority.
  - The build agent writes the `ckb` and `ar` drafts in its own session. No catalogue text goes to any other translation or LLM service (§3.7).
  - Every drafted message carries a machine-readable `unreviewed` status per key (mechanism chosen in slice S2). Slice S2 also adds a note of this deviation to the i18n README.
  - Clinician review stays a [HUMAN] gate before any hospital use (§11.1, §18.9; OQ-151). The WP-0.7 "three languages" evidence is labelled "unreviewed drafts" (KA-031).
- **Blocks:** nothing since it closed on 18 October 2026; hospital use waits for the clinician review (OQ-151)
- **Default in use:** agent-drafted text, marked unreviewed.
- **Who decides:** the human lead (decided); a clinician reviews the text [HUMAN].
- **Context:** WP-0.7 needs three UI languages (§21 exit: "A demo route renders the banner in three languages"). The i18n README forbids invented or machine translation.
- **Options (at the time):** AI drafts that a human checks (chosen); the human writes the text; marked placeholders until real text arrives.

## DN-022: Licences not on the shipped allowlist: 0BSD, Unicode-3.0 and Zlib

- **Status:** closed (2026-10-18)
- **Resolution:** answered in chat through the question tool by the human lead on 2026-10-18 (the tool recorded the answer at 2026-10-18T19:12:56Z).
  - The question was: "The UI libraries will probably pull in small pieces of code under three permissive open-source licences that aren't on the project's approved list yet: 0BSD, Unicode-3.0 and Zlib. All three let you ship them in a commercial product. Add them to the approved list?"
  - The answer was "Approve all three (Recommended)", whose option read: "Add 0BSD, Unicode-3.0 and Zlib to the shipped-code allowlist, recorded as your decision. The build carries on without stopping."
  - This is stop-and-ask item 2 (§3.4), decided by the human. It extends the §4.3 allowlist by exactly these three SPDX identifiers and no others.
  - Slice S1 adds them to `allowed` in `tools/licence/policy.yaml` and to `tools/licence/ort/license-classifications.yml` in the same change, citing this entry. Slice S1 also gives ADR-022 a dated note citing this entry; ADR-022's decision is otherwise unchanged.
  - 0BSD was already acceptable for build-only tools (OQ-097); it is now allowed in shipped code too.
- **Blocks:** nothing since it closed on 18 October 2026
- **Who decides:** the human lead (decided).
- **Context:** the likely sources are tslib (0BSD), unicode-ident and ICU4X through `url`/`idna` (Unicode-3.0), and foldhash (Zlib), in the npm and Rust dependency trees of WP-0.7.

## DN-023: Windows packaging of the Tauri shell

- **Status:** open
- **Blocks:** WP-0.7's Windows shell bundle only (the release step `desktop-shell` for Windows). It does not block the exit criteria.
- **Default in use:** the shell is built and packaged as a Linux `.deb` in the WSL build host. The Windows bundle is a NOT-BUILT [HUMAN] step in `tools/ci/run` (slice S11; KA-029).
- **Who decides:** the human lead (host owner); option 1 needs administrator rights (§3.4 item 9).
- **Context:** ADR-019: "building the Windows shell bundle needs a Windows Rust toolchain or a Windows build agent, which is not yet decided (WP-0.7)". Hospital workstations are expected to run Windows, with the shell on WebView2. The Windows host has no Rust toolchain and no MSVC build tools.
- **Options:**
  1. Install Rust (rustup, MSVC target) and the Microsoft C++ Build Tools on the Windows host. The human runs the commands, for example `winget install --id Rustlang.Rustup -e` and `winget install --id Microsoft.VisualStudio.2022.BuildTools -e --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"`, after checking the vendors' current pages. WebView2 ships with Windows 11. This accepts the Build Tools licence terms.
  2. A Windows build agent in hosted CI, once DN-010 is answered.
  3. Cross-compile from Linux (for example with cargo-xwin). Tauri marks this experimental, and it downloads the Windows SDK under Microsoft's licence terms, which a human must accept.
  - Windows code signing is a separate, later release decision.

## DN-024: Android SDK and macOS for mobile device builds

- **Status:** open
- **Blocks:** later: device builds of the mobile skeleton (the `mobile-builds` step), the Maestro mobile banner test `E2E:banner-on-every-mobile-clinical-view` (CTRL-0016-5; KA-026), and iOS builds. It does not block the WP-0.7 exit criteria.
- **Default in use:** WP-0.7 builds the JavaScript skeleton with `tsc`, its unit tests and an offline `expo export --platform android` bundle (`EXPO_OFFLINE=1`, `EXPO_NO_TELEMETRY=1`). `mobile-builds` stays NOT-BUILT [HUMAN] (KA-030). Device builds are planned with WP-3.3 (`PLT-UX-04`, R2b).
- **Who decides:** the human lead (host owner). Accepting the Android SDK licences (`sdkmanager --licenses`) is the human's step.
- **Context:** neither host has an Android SDK. iOS builds need macOS ("Before the first session"). An Android emulator in WSL2 needs nested virtualisation (KVM).
- **Options:**
  1. Install the Android SDK command-line tools and the JDK version the Android Gradle plugin requires, in the WSL host, and accept the SDK licences [HUMAN]. Use a physical device or an emulator.
  2. **Defer device builds to WP-3.3 and keep the JavaScript skeleton only (default).**
  3. For iOS: a macOS build host, or hosted macOS CI after DN-010.

## DN-025: Expo and pnpm workspace settings

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

## DN-026: The CSO's reading of SI-16's "within the last 60 s" [HUMAN]

- **Status:** open
- **Blocks:** WP-1.4 (the server-side refusal of CTRL-0016-7, which must apply the same reading); nothing now, because the stricter default is in use
- **Default in use:**
  - Re-verification is required when the window's last patient-context change happened 60 s or less before the sign or co-sign step opens; exactly 60.000 s counts.
  - Time is measured on a monotonic clock. An unknown change time, an unreadable clock or a negative elapsed time counts as within the window (fail closed).
  - The 60 s window is vendor-locked: a tenant may lengthen it and never shorten it (CTRL-0016-1).
  - Where: `docs/specs/state-machines/patient-context.yaml` (`contextChangedWithinWindow`) and `docs/specs/modules/design-system.md` §2.3.
  - It is recorded as a tightening in CTRL-0016-7's `notes`.
- **Who decides:** the CSO [HUMAN].
- **Context:** §2.1 SI-16 says "if the context changed within the last 60 s", §9.4's acceptance says "within 60 s", and §8.4 (order: Sign) says "<60 s ago". §8.4 reads as exclusive; the other two do not say. None says what happens when the time cannot be read. Choosing a bound is a reading of a safety invariant (§3.4 items 1 and 8).
- **Options:**
  1. **Inclusive, with a fail-closed clock (default).**
  2. Exclusive, as §8.4 reads: at exactly 60.000 s no re-verification is required. The fail-closed clock rules stay.
  3. Another reading the CSO states.

## DN-027: What identity re-verification at signing consists of [HUMAN]

- **Status:** open
- **Blocks:** WP-1.4 (its first sign commands); nothing now, because the stricter default is in use
- **Default in use** (design-system §2.3; patient-context predicates `reverificationConfirmedBySigner`, `reverificationHeldBySigner`, `identityDisputed`):
  - Within the window, the sign and co-sign dialog shows a re-verification step before authentication. It shows the photo (or "No photo"), every name form, the MRN and the date of birth at its recorded precision with the approximate-DOB flag, none of them truncated.
  - The person at the dialog confirms with a control that is never preselected, never focused on open and never the default action.
  - The step records who confirmed. If a different user authenticates for the signature, the dialog returns to re-verification.
  - "Not this patient" ends signing with a message. Re-verification is then required at every sign step in the window, even after 60 s, until the context changes or a re-verification is confirmed.
  - This is in addition to authenticating every signature (§9.4). A co-signature authenticates with badge tap plus PIN, as §12.8 requires.
  - It is recorded as a tightening in CTRL-0016-7's `notes`.
- **Who decides:** the CSO [HUMAN].
- **Context:** §2.1 SI-16 says "Identity is re-verified at signing" and §9.4's acceptance says signing "forces re-verification"; neither says what re-verifying means or who must do it. This is a reading of a safety invariant (§3.4 items 1 and 8).
- **Options:**
  1. **Confirmation by the person who signs, against the identity shown, with a disputed-identity flag (default).**
  2. Option 1, plus re-authenticating the signer within the window (badge tap plus PIN for every signature in the window).
  3. Active identification: the signer selects or types an identifier (for example the date of birth, or the last digits of the MRN) instead of confirming.
  4. Another reading the CSO states.

## DN-028: What counts as a patient-context change, and what a change of user does [HUMAN]

- **Status:** open
- **Blocks:** later; nothing now, because the stricter default is in use
- **Default in use** (design-system §2.2; `patient-context.yaml`):
  - Any change of the window's patient id counts: from none to a patient, from one patient to another after confirmation, and from a patient to none. Selecting the patient already open does not count.
  - A badge tap or sign-in that changes the user clears the patient context of every window of the workstation session [P]. The shell broadcasts it; browser tabs learn it through `BroadcastChannel`, and each window also checks its user on focus and before every clinical action.
  - The context, never a URL, selects whose data a clinical route shows.
  - A device capture whose result arrives after a context change is discarded, and a barcode read goes only to the focused window.
  - These are recorded as tightenings in CTRL-0016-6's `notes`.
- **Who decides:** the CSO [HUMAN].
- **Context:** §2.1 SI-16 says "One patient context per window" and "if the context changed"; it defines neither "change" nor what a change of user does. §12.8 badge tap-to-switch.
- **Options:**
  1. **Default.**
  2. A change of user keeps every window's context and counts as a context change for the new user, so the 60 s re-verification applies.
  3. Count only patient-to-patient replacements as changes. This is a narrower reading: the first patient opened in an empty window would need no re-verification at signing.
  4. Another reading the CSO states.

## DN-029: "Trilingual name display" on the banner [HUMAN]

- **Status:** open
- **Blocks:** WP-1.2 (registration sets which name forms are required); nothing now, because the stricter default is in use
- **Default in use** (design-system §2.1):
  - The banner shows the Kurdish form (Arabic script), the Arabic form and the Latin transliteration, each labelled, with the form in the patient's own script first.
  - Each missing form is flagged.
  - A missing own-script or Latin form also shows "Identity incomplete" (the wording of CTRL-0001-6). A missing third form is flagged without that marker.
  - For a patient whose own script is Latin, the Latin form is both.
  - It is recorded as a tightening in CTRL-0016-3's `notes`.
- **Who decides:** the CSO [HUMAN].
- **Context:**
  - §2.1 SI-16 clause c says "trilingual name display"; SI-01 says "name in the patient's script plus Latin"; §11.2 stores Kurdish, Arabic and Latin forms, with a display name per locale.
  - The first draft of the WP-0.7 specification read "trilingual" as two forms and did not flag a missing third form. An independent review found that this narrowed clause c, so the default was changed to the stricter reading.
- **Options:**
  1. **Three forms expected and displayed, each missing one flagged (default).**
  2. Two forms (the patient's script and Latin), with the third shown when held and not flagged when missing. This narrows clause c.
  3. Another reading the CSO states.

## DN-030: ClinicalNumber normalisation: result precision, and what "displayed unchanged" means [HUMAN]

- **Status:** open
- **Blocks:** WP-1.7 (results on screen); nothing now, because the stricter default is in use
- **Default in use** (design-system §2.6):
  - The ISMP display rules (a leading zero, no trailing zero, one form of zero, grouping per DN-031) apply to every clinical numeral, results included.
  - The numeric value never changes; only the display form does.
  - The reading in use is that this normalisation is not a "change" under CTRL-0005-6 ("displays entered and KB-returned values unchanged").
  - It is recorded as a tightening in CTRL-0005-17's `notes`.
- **Who decides:** the CSO and the laboratory CSO [HUMAN].
- **Context:**
  - §2.1 (acceptance criteria: ISMP display rules, "no trailing zeros, no naked decimals"), §6.5 ("doses always with a leading zero and never a trailing zero"), SAC-50, CTRL-0005-17 and CTRL-0005-6.
  - Removing trailing zeros drops the precision a laboratory reported (4.0 shows as 4).
- **Options:**
  1. **Apply the rules to every clinical numeral, results included (default).**
  2. Apply the trailing-zero rule to doses only, and show results at the precision the laboratory reported.
  3. Apply it to results in lists and the banner, and show the reported precision in the result detail.
  4. Another rule the CSO states.

## DN-031: Grouping of large clinical numbers (a departure from the letter of ISMP) [HUMAN]

- **Status:** open
- **Blocks:** later (any screen that shows doses, before it goes into clinical use); nothing now
- **Default in use** (design-system §2.6):
  - Integer parts of 1000 and above are grouped in threes with a narrow no-break space (U+202F), for example "150 000".
  - Never a comma or a full stop; decimal digits are not grouped.
  - It is recorded in CTRL-0005-17's `notes`.
- **Who decides:** the CSO, with the pharmacist panel [HUMAN].
- **Context:**
  - ISMP's list of error-prone abbreviations and dose designations asks for commas in doses of 1,000 and above (or the words "thousand" and "million"), because an ungrouped 100000 is misread tenfold.
  - In Sorani and Arabic text the Arabic decimal separator `٫` looks like a comma, so a comma can be read as a decimal point. The narrow space avoids that, but it departs from ISMP's letter.
  - The first draft of the WP-0.7 specification used no grouping and called that an ISMP rule; an independent review flagged it.
- **Options:**
  1. **Narrow no-break space (default).**
  2. Commas, as ISMP writes.
  3. No grouping.
  4. Words ("thousand", "million") from a threshold, translated per locale.
  5. Another rule the CSO states.

## DN-032: The banner's blocking rules [HUMAN]

- **Status:** open
- **Blocks:** later; nothing now, because the stricter default is in use
- **Default in use** (design-system §2.1 rule 4 and §2.2; predicates `bannerIdentityValid` and `requestedPatientIdentityValid`):
  - The banner's error state (patient id, MRN or every name form missing or invalid) disables the clinical actions of the route, sign and co-sign included.
  - A missing or invalid date of birth also disables signing; an approximate date at its recorded precision is valid.
  - A switch to another patient cannot be confirmed while the requested patient's identity data is invalid.
  - A missing name form alone is flagged and does not block.
  - These are recorded as tightenings in CTRL-0016-3's and CTRL-0016-6's `notes`.
- **Who decides:** the CSO [HUMAN].
- **Context:**
  - §2.1 SI-16 and SI-01 require the identifiers to be shown (SAC-01: "MRN plus DOB or the approximate-DOB flag"), but say nothing of what signing does when identity data is missing.
  - CTRL-0001-6 refuses prints that lack a name form.
  - Blocking signing on a missing Latin name could delay care for an emergency or alias registration.
- **Options:**
  1. **Default.**
  2. Option 1, plus blocking signing on a missing own-script or Latin form, as CTRL-0001-6 does for prints.
  3. Another rule the CSO states.
