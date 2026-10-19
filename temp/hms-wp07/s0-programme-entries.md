The placeholders are for the lead to number. After this round the spec files use DN-new-1…13, OQ-new-1…13 and KA-new-1…12; `grep -rn -- "-new-" docs/specs` finds every one. Since 2026-10-19.

=== DECISIONS-NEEDED.md ===

DN-new-1 to DN-new-6: keep the author's text with these reference changes:
- DN-new-2: "OQ-new-17" becomes "OQ-new-12".
- DN-new-5: unchanged ("KA-new-2", "KA-new-6").
- No other changes.

## DN-new-7: The CSO's reading of SI-16's "within the last 60 s" [HUMAN]
- **Status:** open
- **Blocks:** nothing now (the stricter default is in use). The answer is needed before WP-1.4 builds the server-side refusal of CTRL-0016-7, which must apply the same reading.
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

## DN-new-8: What identity re-verification at signing consists of [HUMAN]
- **Status:** open
- **Blocks:** nothing now. The answer is needed before WP-1.4's first sign commands.
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

## DN-new-9: What counts as a patient-context change, and what a change of user does [HUMAN]
- **Status:** open
- **Blocks:** nothing now.
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

## DN-new-10: "Trilingual name display" on the banner [HUMAN]
- **Status:** open
- **Blocks:** nothing now. The answer is needed before WP-1.2 (registration) sets which name forms are required.
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

## DN-new-11: ClinicalNumber normalisation: result precision, and what "displayed unchanged" means [HUMAN]
- **Status:** open
- **Blocks:** nothing now. The answer is needed before WP-1.7 shows results.
- **Default in use** (design-system §2.6):
  - The ISMP display rules (a leading zero, no trailing zero, one form of zero, grouping per DN-new-12) apply to every clinical numeral, results included.
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

## DN-new-12: Grouping of large clinical numbers (a departure from the letter of ISMP) [HUMAN]
- **Status:** open
- **Blocks:** nothing now. The answer is needed before any screen that shows doses goes into clinical use.
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

## DN-new-13: The banner's blocking rules [HUMAN]
- **Status:** open
- **Blocks:** nothing now.
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

=== OPEN-QUESTIONS.md ===
Put OQ-new-4, OQ-new-12 and OQ-new-13 in section (e) "Content requests". Put the others in a new section after (f): "(g) Engineering choices [P] and readings made in WP-0.7, awaiting confirmation".

### OQ-new-1: Two frontend packages beyond §6.1
The author's former OQ-new-2, unchanged.

### OQ-new-2: Western digits for every number in the staff UI; dates as YYYY-MM-DD
- **Choice:** a tightening of §6.5, applied to all staff workspaces:
  - the UI locales are `en`, `ckb-u-ca-gregory-nu-latn` and `ar-u-ca-gregory-nu-latn` (canonical BCP 47 form);
  - no Eastern Arabic-Indic digit appears anywhere in the staff workspaces;
  - the banner shows dates as `YYYY-MM-DD` (`docs/specs/modules/design-system.md` §2.6, §3).
- The grouping of clinical numbers is DN-new-12. The §6.5 option of Eastern digits for patient-facing text is kept for those surfaces.
- **Sources:** §6.5, §11.1, §14.6, §18.9 "Digits".
- **Who confirms:** the human lead. WP-0.8's wristband date format must match the banner's.
- **Status:** open

### OQ-new-3: The demo route is left out of production builds
The author's former OQ-new-4, unchanged.

### OQ-new-4 (content request): Code-status and isolation vocabularies
The author's former OQ-new-5, plus this sentence: "Until approved content exists, a code that the client vocabulary does not know shows the field as unavailable (design-system §2.1 rule 6)."

### OQ-new-5: The API-client generator waits for WP-0.4
The author's former OQ-new-6, unchanged.

### OQ-new-6: `shell-fast` fails on the Windows checkout
The author's former OQ-new-7, unchanged.

### OQ-new-7: Changing the UI language on mobile needs an app restart
The author's former OQ-new-8, unchanged.

### OQ-new-8: The HAL audit log stays on the workstation until WP-0.4
The author's former OQ-new-9, unchanged.

### OQ-new-9: One font family for the UI and for WP-0.8's prints
The author's former OQ-new-10, unchanged.

### OQ-new-10: Who approves the patient-context state machine
- **Reading in use:**
  - Approval is requested from `cso`, `physician-panel` and `nurse-panel` (`docs/specs/state-machines/patient-context.yaml`; `approved_by` empty, `record: null`).
  - Every transition is marked proposed, because R11 draws no such machine; R11 §15 item 6 states only the rule.
  - The readings the machine encodes are DN-new-7, DN-new-8, DN-new-9 and DN-new-13.
- **Sources:** §8.4 names approvers for each of its machines, but none for patient context; OQ-083.
- **Who confirms:** the human lead and the CSO [HUMAN]. The approval itself is written only from a sign-off record (§3.5). The request can join WP-0.5's approval requests.
- **Status:** open

### OQ-new-11: The shapes and error vocabulary of HAL contract v1
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

### OQ-new-12 (content request): Clinician review of the ckb and ar UI text
The author's former OQ-new-17, unchanged; it cites DN-new-2 and KA-new-7.

### OQ-new-13 (content request): The UCUM unit display map
- **Content needed:** a governed map from each UCUM unit code used on screens to its ISMP-safe display form (for example `ug` → `mcg`; `U` and `[iU]` → `units`), approved for clinical use [HUMAN] (§3.4 item 3). The ISMP list of error-prone abbreviations is the source.
- **In use:** a synthetic sample (`kg`, `g`, `mg`, `ug` → `mcg`, `mL`, `L`, `U` → `units`, `mmol/L`, `%`), labelled NOT FOR CLINICAL USE. A unit not in the map shows "Invalid value" (`docs/specs/modules/design-system.md` §2.6).
- **Needed by:** the work package that builds the formulary (`MED-FRM-01`) and WP-1.7 (results), before clinical use.
- **Status:** open

=== KNOWN-ANOMALIES.md (table rows; Since 2026-10-19; all open) ===
| KA-new-1 | SI-16 is enforced client-side only. CTRL-0016-1 is not built: the patient context, the banner data and the re-verification rule live only in the client (`frontend/packages/ui-core`), with no server-side model, and the vendor lock of the 60 s window is a constant in `ui-core`, not the configuration chain. The server part of CTRL-0016-7 is not built either: no server refuses a signature without re-verification, and no server handles the sign command's idempotency key, because no sign command exists yet. WP-0.7 builds only the client machine (`docs/specs/state-machines/patient-context.yaml`), whose sign command carries the context-change time, the re-verification time and an idempotency key | H1; SI-16 (HAZ-0016: CTRL-0016-1, CTRL-0016-7) | `PLT-UX-01` | 2026-10-19 | open | WP-0.3 (configuration chain); WP-0.4 (server-side context with the Trust Plane) [P]; WP-1.4 [P] (the first sign commands: notes and orders) |
| KA-new-2 | The author's row, unchanged |
| KA-new-3 | `hal.id.read` and `hal.pay.request` fail closed: the shell returns `unavailable` / `not-implemented`, and with no shell `hal-client` returns `unavailable` / `no-shell`. So there is no ID-document capture and no card payment through the shell. Their success fixtures only define the shape | H1 (registration identity capture, SI-01); none for payments | `PLT-UX-02` | 2026-10-19 | open | WP-1.2 (ID-card and MRZ reader simulators), WP-1.9 (card-terminal simulator) (§3.7) |
| KA-new-4 to KA-new-7 | The author's rows, unchanged; in KA-new-7, "OQ-new-17" becomes "OQ-new-12" |
| KA-new-8 | The exit criterion "a simulated badge tap switches users in ≤2 s" is not met in WP-0.7. The badge reader and its step-up are simulated, and the Keycloak step-up, the session swap and the redemption of `stepUpRef` come with WP-0.4. `badge-tap-switch.spec.ts` (slice S13) runs after WP-0.4. The co-signature's badge tap plus PIN (§12.8) is also simulated in the demo | H1 (co-signature authentication strength); §14.4 target | `PLT-UX-02` | 2026-10-19 | open | WP-0.4, then WP-0.7 slice S13 |
| KA-new-9 | Banner data is synthetic and client-side only (the server side is KA-new-1). There are no sensitivity indicators (§9.4; they need the PEP of WP-0.4 and the SI-21 labels), so CTRL-0016-3 is only partly built and must stay short of `verified` at S12. MRN check digits are not validated (CTRL-0001-7, WP-1.2). Code-status and isolation vocabularies are synthetic (OQ-new-4) | H1, H14; SI-16, SI-01, SI-21 (CTRL-0016-3) | `PLT-UX-01` | 2026-10-19 | open | WP-0.4 (PEP, labels); WP-1.2 (identity, MRN); WP-1.4 (`CLN-CHT-01`, `CLN-IPC-01`); R2a (`CLN-ACP-01`) |
| KA-new-10, KA-new-11 | The author's rows, unchanged |
| KA-new-12 | CTRL-0005-17 is only partly built. `ClinicalNumber` applies the ISMP rules (leading zero, no trailing zero, no naked decimal, grouping per DN-new-12) with Western digits on screens. The unit display map is a synthetic sample (OQ-new-13). Tall-man lettering needs the governed LASA list (§3.4 item 3), and number display on prints is WP-0.8 | H2; SI-05 (CTRL-0005-17) | `PLT-UX-01` | 2026-10-19 | open | WP-0.8 (prints); the work package that builds the formulary (`MED-FRM-01`) for tall-man lettering and the unit map |

KA-013, edit the description: replace "No state-machine spec exists yet" with "The first spec it affects is `docs/specs/state-machines/patient-context.yaml` (WP-0.7, `version: 1`, approval requested); until WP-0.5's tooling exists, every change to that file must raise its `version`."

=== docs/safety/hazard-log.yaml (notes only; every state stays planned) ===
- **CTRL-0016-7, add `notes`:** "Tightening [P] (§3.4 item 1): 'within the last 60 s' is read inclusively (exactly 60.000 s still requires re-verification) on a monotonic clock, and an unknown change time, an unreadable clock or a negative elapsed time counts as within the window; a re-verification counts only if the user who authenticates for the signature confirmed it; after a 'Not this patient' answer every sign step in the window requires re-verification until the context changes. §2.1 SI-16, §8.4 (order: sign, '<60 s ago') and §9.4 acceptance ('within 60 s') fix no bound, say nothing of an unreadable clock and do not say who re-verifies. These add to clause f and replace no clause; the CSO confirms or removes them [HUMAN] (DN-new-7, DN-new-8; docs/safety/README.md, 'Tightenings')."
- **CTRL-0016-6, append to `notes`:** "Further tightenings [P] proposed in WP-0.7 (DN-new-9, DN-new-13): a change of user clears the patient context of every window of the workstation session; the context, never a URL, selects whose data a clinical route shows; a device capture whose result arrives after a context change is discarded, and a barcode read goes only to the focused window; a switch cannot be confirmed while the requested patient's identity data is invalid. They add to clause e and replace no clause; the CSO confirms or removes them [HUMAN]."
- **CTRL-0016-3, add `notes`:** "Tightening [P] (§3.4 item 1; DN-new-10, DN-new-13): the banner shows the Kurdish, Arabic and Latin name forms and flags each missing one; its error state (patient id, MRN or every name form missing or invalid) disables clinical actions, and a missing or invalid date of birth disables signing. §2.1 SI-16 requires 'trilingual name display' and §11.2 stores the three forms, but neither says what a missing form shows or whether missing identity data blocks signing. They add to clauses a and c and replace no clause; the CSO confirms or removes them [HUMAN]. Gap: WP-0.7 builds no sensitivity indicators (WP-0.4) and no mobile or print banner (KA-new-2, KA-new-9)."
- **CTRL-0005-17, add `notes`:** "Tightening [P] (§3.4 item 1; OQ-new-2, DN-new-11, DN-new-12): the ISMP display rules apply to every clinical numeral, results included; Western digits are used for every number in the staff UI; units are shown through a governed UCUM display map that replaces ISMP's error-prone abbreviations (ug → mcg; U and IU → units), and an unmapped unit is shown as an invalid value; integer parts of 1000 and above are grouped with a narrow no-break space. §2.1 (acceptance criteria), §6.5 and SAC-50 name the leading-zero, trailing-zero and naked-decimal rules for doses and Western digits for clinical numerals, and say nothing of results, units or grouping. The grouping departs from the letter of ISMP's comma (DN-new-12), and the effect on reported result precision is DN-new-11. They add to clause b and replace no clause; the CSO confirms or removes them [HUMAN]."

=== docs/safety/README.md ===
Tightenings table, add rows:
| CTRL-0005-17 | ISMP display rules for every clinical numeral, results included; Western digits for every staff-UI number; a governed UCUM display map; grouping of large numbers with a narrow no-break space | §2.1 (acceptance criteria), §6.5 and SAC-50 give the rules for doses and Western digits for clinical numerals; they say nothing of results, units or grouping (DN-new-11, DN-new-12) |
| CTRL-0016-3 | All three name forms shown, each missing one flagged; the banner's error state and a missing or invalid date of birth block signing | SI-16 asks for "trilingual name display" and §11.2 stores three forms; neither says what a missing form shows or whether missing identity data blocks signing (DN-new-10, DN-new-13) |
| CTRL-0016-7 | An inclusive 60 s window on a monotonic clock that fails closed; re-verification bound to the signer; re-verification required again after "Not this patient" | SI-16 "within the last 60 s", §9.4 "within 60 s" and §8.4 "<60 s ago" fix no bound and say nothing of an unreadable clock or of who re-verifies (DN-new-7, DN-new-8) |

Change the existing CTRL-0016-6 row's "Tightening" cell to: "A confirmation before another patient replaces the window's patient context; from WP-0.7 (DN-new-9, DN-new-13), a change of user clears every window's context, the context and never a URL selects the patient, device results are bound to the window and its patient, and a switch cannot be confirmed while the requested identity is invalid".

Append to the paragraph after the table: "The WP-0.7 rows (CTRL-0005-17, CTRL-0016-3, CTRL-0016-7 and the additions to CTRL-0016-6) came from the independent review of the WP-0.7 specification."

"Open questions for CSO triage", add item 10: "**SI-16, SI-01 and SI-05 readings made for WP-0.7:** DN-new-7 to DN-new-13 (`docs/program/DECISIONS-NEEDED.md`). The defaults in use are the stricter readings, recorded as tightenings above."

At S12, not now, candidates for `planned_verification`; the lead decides:
- CTRL-0016-6: `UnitTest:context-switch-requires-confirmation`, `UnitTest:palette-selects-patient-via-confirmation`, `E2E:url-never-overrides-patient-context`, `E2E:user-change-clears-every-window`, `UnitTest:hal-capture-discarded-after-context-change`.
- CTRL-0016-7: `UnitTest:sign-requires-reverification`, `UnitTest:cosign-same-pattern`.
- CTRL-0016-3: `UnitTest:banner-missing-data-visible`, `UnitTest:banner-long-names-wrap`.
- CTRL-0001-4: `UnitTest:banner-identifiers-never-room-or-bed`.
- CTRL-0001-6: `UnitTest:banner-missing-data-visible`.
- CTRL-0005-17: `UnitTest:ui-intl-western-digits`, `PropertyTest:clinical-number-*`, `E2E:digits-western`.
- CTRL-0005-6: `StaticAnalysis:clinical-number-no-arithmetic`.

=== backlog.yaml (edit only status and notes; hazards stays derived) ===
- **PLT-UX-01:** status todo → spec. notes: ["WP-0.7 S0: module specification docs/specs/modules/design-system.md (components, banner rules, number display, RTL, tests §9, message keys §10) and docs/specs/state-machines/patient-context.yaml (approval requested; every transition proposed). SI-16/SI-01/SI-05 readings DN-new-7 to DN-new-13 await the CSO. Anomalies KA-new-1, KA-new-2, KA-new-9, KA-new-12."]
- **PLT-UX-02:** status todo → spec. notes: ["WP-0.7 S0: HAL contract v1 in docs/specs/hal/ (README, hal-v1.schema.json, 69 synthetic fixtures). The badge credential stays in the shell (OQ-new-11). hal.id.read and hal.pay.request fail closed until WP-1.2 and WP-1.9 (KA-new-3); Windows bundle DN-new-4 (KA-new-5); badge tap ≤2 s after WP-0.4 (KA-new-8). FHIRcast, in this feature's A.1 scope, is not in WP-0.7."]
- **PLT-UX-03:** status todo → spec. notes: ["WP-0.7 (base) S0: RTL, bidi and digit rules in docs/specs/modules/design-system.md §2.6 to §3 (Western digits throughout the staff UI, OQ-new-2; grouping DN-new-12). Hijri display, bilingual prints and multi-script phonetic name search are not in WP-0.7."]
- **KRI-LOC-01:** status todo → spec. notes: ["WP-0.7 (base) S0: message keys in docs/specs/modules/design-system.md §10. The ckb and ar text is agent-drafted and unreviewed (DN-new-2, KA-new-7, OQ-new-12); trilingual outputs come with WP-1.10."]
- **Optional, PLT-UX-04:** the author's entry, unchanged.

If the lead prefers to keep "spec" until slices begin, leave status at todo and add only the notes.

=== WORK-PACKAGES.md ===
- WP-0.7 row, "State": "**in-progress**: S0 specification written on `wp/0.7-design-system`, stacked on `wp/0.1-programme-bootstrap` (DN-new-1): `docs/specs/modules/design-system.md`, `docs/specs/state-machines/patient-context.yaml` (approval requested), `docs/specs/hal/`. DN-new-2 (ckb and ar text: AI drafts, human checks) and DN-new-3 (0BSD, Unicode-3.0, Zlib allowed) were closed by the human lead on 18 October 2026. Still open: DN-new-4 (Windows bundle), DN-new-5 (Android SDK, macOS), DN-new-6 (Expo and pnpm) and the CSO's readings DN-new-7 to DN-new-13 (stricter defaults in use). The badge-tap criterion needs WP-0.4 (KA-new-8)."
- Notes item 4: the author's sentence, unchanged.
- `work-packages/WP-0.7.md`, under "[HUMAN] gates":
  - "Clinician review of the agent-drafted ckb and ar text before any hospital use (DN-new-2, OQ-new-12)";
  - "Approval of the patient-context state machine (OQ-new-10)";
  - "The CSO's answers to DN-new-7 to DN-new-13".

=== CHANGELOG.md (optional) ===
"WP-0.7 S0: design-system module specification, patient-context state machine (approval requested), HAL contract v1 with 69 synthetic fixtures; CSO readings DN-new-7 to DN-new-13 requested."