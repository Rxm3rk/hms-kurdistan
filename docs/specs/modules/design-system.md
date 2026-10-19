# Design system and client shells (`design-system`)

The module specification of the design system, the web workspace frame, the Tauri 2 workstation shell and the React Native skeleton, written before the code it governs (BUILD-PROMPT §3.2 step 2, §22.1 item 1) in WP-0.7 slice S0. Features: `PLT-UX-01` design system, `PLT-UX-02` workstation shell, `PLT-UX-03` (base) i18n and RTL, `KRI-LOC-01` (base) trilingual UI (§21 Phase 0 row 0.7; `docs/program/work-packages/WP-0.7.md`). Sources: §2.1 SI-01, SI-05 and SI-16; §4.1; §5.4; §6.5; §9.1 and §9.4 (the banner); §11.1; §12.8 (the HAL); §13.5; §14.1, §14.2, §14.4, §14.7; §15; §18.9; §18.10; R11 §15; R16 §14.2; ADR-011 and ADR-019.

The design system is a frontend package and has no §5.2 module. SI-16's hazard entry (HAZ-0016) is owned by `record-squad`, because the banner is `CLN-CHT-01` of the `record` module (`docs/safety/README.md`, open question 5); this specification follows that ownership. Everything here is a specification: no code exists yet, no test named below has run, and every hazard-log control it cites is `planned`.

**Status of the human decisions.** The human lead decided two WP-0.7 questions on 18 October 2026 (decision entries DN-021 and DN-022): the Sorani (`ckb`) and Arabic (`ar`) UI text is drafted by the agent and marked unreviewed, and a clinician review stays a gate before any hospital use (a recorded deviation from the `packages/i18n` README rule against invented or machine translation); and 0BSD, Unicode-3.0 and Zlib are added to the shipped-code licence allowlist. Neither changes this specification. This document holds English text only; the `ckb` and `ar` catalogue text is slice S2's work.

**Readings of safety invariants are the CSO's decisions.** Where this specification has to read SI-01, SI-05 or SI-16 more precisely than the plan states, the reading is not the agent's to decide (§3.4 items 1 and 8): each is a decision entry for the CSO [HUMAN], DN-026 to DN-032, with options. The default in use is the stricter reading wherever one reading is stricter, and every default that adds to an invariant is recorded as a tightening in the control's `notes` and in the "Tightenings" table of `docs/safety/README.md`. One default leaves a stricter option open: a missing name form is flagged on the banner but does not block signing (DN-032). SI-16 sets no blocking rule for it, so this does not narrow the invariant, but the stricter option is put to the CSO.

## 1. Packages and slices

| Package | Holds | Slice |
|---|---|---|
| `frontend/packages/ui-core` (new, [P], open question OQ-140) | DOM-free logic shared by web and mobile: `clinical-number.ts` (number display, §2.6), `banner-model.ts` (Zod schemas for the banner data, §2.1), `patient-context.ts` (the machine of §2.2), `clock.ts` (a monotonic clock that tests can replace) | S3 |
| `frontend/packages/i18n` (exists) | Catalogues for `en`, `ckb`, `ar`; `ui-intl.ts` (locales with Western digits and the Gregorian calendar); in-memory pseudo-locales; `sorani-letters.json`; the clinical-keys lint | S2 |
| `frontend/packages/design-system` (exists, placeholder) | Tokens and logical CSS, fonts, `LocaleProvider`, `DensityProvider`, `Bdi`, `ClinicalNumber`, `Modal`, the banner, the sign and co-sign pattern, the command palette | S4, S5a, S5b |
| `frontend/packages/hal-client` (new, [P], OQ-140) | The typed HAL contract (`docs/specs/hal/`) and its transports: Tauri, none (no shell), simulator | S8 |
| `frontend/apps/web` (exists, placeholder) | The workspace frame, routes, the `_clinical` layout and the demo route | S6, S7 |
| `frontend/apps/shell` (exists, placeholder) | The Tauri 2 shell: `hal-core` (pure Rust), Tauri commands, simulated devices | S9 |
| `frontend/apps/mobile` (exists, placeholder) | The Expo skeleton with nurse and physician modes | S10 |

Every interactive primitive is a React Aria Component (§6.5). Strings come only from the catalogues (`hms/no-jsx-literals`), and CSS uses logical properties only (`hms/no-physical-css`; `frontend/packages/eslint-plugin-hms/README.md`).

## 2. Components

### 2.1 The banner (SI-16, SI-01)

One design-system component, `PatientBanner`, never a per-screen implementation (§14.2; CTRL-0016-3). The `_clinical` route layout renders it on every clinical route (§4, CTRL-0016-5). It is a landmark region (`<section>` named by `banner.region.label`), not an ARIA `banner` landmark, which means the page header.

**Fields**, in reading order from the start edge (mirrored in RTL by logical layout):

| Field | Shows | When the data is missing or invalid |
|---|---|---|
| Photo | The registration photo (§9.1; CTRL-0016-8), with `banner.photo.alt` | "No photo" (`banner.photo.missing`) in the photo's place, never an empty frame or a silhouette that looks like a photo |
| Name | Every name form, each labelled and in its own script: the Kurdish form (Arabic script), the Arabic form and the Latin transliteration (SI-01; SI-16 "trilingual name display"; §11.2 stores all three). The form in the patient's own script comes first. The default reading expects all three forms for every patient (decision DN-029) | Each missing or invalid form is shown in its place: "Kurdish name missing", "Arabic name missing" or "Latin name missing". A missing form in the patient's own script, or a missing Latin form, also shows the "Identity incomplete" marker (`banner.identity.incomplete`, the wording of CTRL-0001-6). For a patient whose own script is Latin, the Latin form is both. A missing third form is flagged but does not show the marker |
| MRN | The MRN as stored, with its check digit (SI-01), in `<bdi dir="ltr">` | Banner error state (rule 4) |
| Date of birth | The date at its recorded precision: `YYYY-MM-DD` for an exact date, `YYYY-MM` or `YYYY` for a partial one, in Western digits. The approximate-DOB flag (`banner.dob.approximateFlag`) is shown beside the date whenever the date is approximate or its precision is less than a day, so a partial or estimated date is never read as exact; the placeholder day or month of an estimate (§18.10: 1 January, 1 July) is never shown (CTRL-0001-7) | "Date of birth missing" (`banner.dob.missing`) or, for an invalid value, "Date of birth unavailable" (`banner.dob.unavailable`), each with "Identity incomplete". Either disables signing (rule 4) |
| Allergies | One of three statuses, each visually and textually distinct (CTRL-0016-4): `nka` shows "No known allergies (NKA)"; `not-assessed` shows "Allergies not assessed"; `list` shows every allergy (substance, and reaction and severity where recorded), each substance whole, wrapping onto more lines, never collapsed behind a "more" control | "Allergy status unavailable" (`banner.allergies.unavailable`), styled as a warning. **Missing, invalid or contradictory allergy data never shows NKA**, and one malformed item makes the whole field unavailable (data model, below) |
| Code status | The documented code status, from governed content with its own trilingual label, and the date recorded (§9.4) | Valid data that records none: "Code status not documented". Missing or invalid data, or a code the client vocabulary does not know: "Code status unavailable" |
| Isolation | Active precautions, from governed content with their own trilingual labels (§9.4: contact, droplet, airborne) | Valid data that records none: "No isolation recorded". Missing or invalid data, or a code the client vocabulary does not know: "Isolation status unavailable" |
| Weight | The current dosing weight through `ClinicalNumber` with its unit, its source (measured, stated or estimated; R11 §15 item 3) and the date measured (SI-05, CTRL-0005-3) | Valid data that records no weight: "No dated weight" (`banner.weight.missing`). Invalid data, a weight without a date, or a value that is not a decimal greater than zero: "Weight unavailable" (`banner.weight.unavailable`), styled as a warning. Neither is ever shown as a weight |

**Rules.**

1. **Identifiers are never room or bed** (SI-01; CTRL-0001-4). The banner data model has no location field. The input is parsed field by field: keys that are not banner fields, a room, bed or location among them, are ignored and never rendered, and no location value can fill an identifier. A screen may show a location elsewhere, never as an identifier.
2. **Colour is never the only carrier** (§6.5). Every status (each allergy status, isolation, code status, every missing or unavailable state) has its own text and its own icon shape; colour only repeats what text and shape already say. Text contrast is at least 4.5:1 in every state and density.
3. **Identity text wraps and is never truncated** (§18.9 "Names"), in the banner and wherever a patient is shown to be chosen or confirmed: the switch confirmation (§2.2), the re-verification step (§2.3), the command palette's patient results (§2.4) and every patient list or chooser. Four-part names (given, father's, grandfather's and family or tribal name; §11.2) in every script wrap at word boundaries onto further lines, and the element grows; MRNs and allergy substances are always shown whole too. No ellipsis, `line-clamp`, fixed height with hidden overflow or tooltip-only text for any of them, so two patients whose long names differ only in the grandfather's or family name never look alike. The same holds for alias names ("Trauma Zulu-17") and newborn names ("Baby of …", §9.1).
4. **Fail visibly.** Each field is parsed on its own (`banner-model.ts`): an invalid field shows that field's missing or unavailable state, and the other fields still render. When the patient id, the MRN or every name form is missing or invalid, the banner shows its error state, "Patient banner data unavailable" (`banner.dataUnavailable`), and the `_clinical` layout disables the clinical actions of the route, sign and co-sign included, until valid data arrives. A missing or invalid date of birth also disables signing, because the second identifier is then incomplete (SI-01); an approximate date at its recorded precision is valid. A missing name form alone is flagged and does not block. These blocking rules are decision DN-032 for the CSO; the patient-context machine encodes them as `bannerIdentityValid` and `requestedPatientIdentityValid`.
5. **Bidi isolation.** Every value of unknown direction (names, MRN, dates, numbers with units, allergy substances, content labels) is rendered through `Bdi` (§2.7) with its own `dir` and `lang`, so a Sorani name next to a Latin MRN and a weight in kilograms keeps each part in order in every locale.
6. **Governed labels are never empty.** Code-status, isolation and allergy-substance labels come from governed content in three languages. When a label is missing in the user's locale, the label of another available locale is shown with its own `lang` and the marker "Not translated" (`banner.label.untranslated`). An allergy substance with no label in any locale is shown as its recorded code with the same marker, so an allergy is never hidden. A code-status or isolation code that the client vocabulary does not know makes that field show its unavailable state.
7. **Not in WP-0.7:** sensitivity indicators "where the user is entitled to see them" (§9.4) need the policy enforcement point of WP-0.4, so CTRL-0016-3 is only partly built and stays short of `verified` (KA-033); the banner on mobile views and on prints is tested later (KA-026); the banner data, the patient context and the re-verification rule are client-side only, with no server-side model yet (CTRL-0016-1; KA-025); the banner data is synthetic (KA-033).

**Data model** (`ui-core/banner-model.ts`, S3): `patientId`; `photo` (`present` with a same-origin source, or `absent`); `name` (`ckb`, `ar` and `latin` forms, each optional text, and `ownScript`, one of the three); `mrn`; `dob` (`value`, `precision` of `day`, `month` or `year`, `approximate`); `allergies` (exactly one of `{status: nka}`, `{status: not-assessed}` or `{status: list, items}` with at least one item, each item a content-coded substance with optional reaction and severity); `codeStatus` (`documented` with a content code, trilingual label and date, or `not-documented`); `isolation` (`none-recorded`, or `active` with at least one content precaution); `weight` (a decimal string greater than zero, checked by pattern and never by arithmetic; UCUM unit `kg`; `measuredOn`; `source`). Each field's value is parsed with a strict schema (closed objects and, for allergies, a discriminated union with no extra keys): a missing field, an unknown key, an unknown status, a list with no items and contradictory data (an `nka` or `not-assessed` status that carries items) are all invalid. Any malformed allergy item makes the whole allergy field "Allergy status unavailable"; an item is never dropped. Code-status and isolation vocabularies are clinical content (§3.4 item 3): WP-0.7 ships synthetic sample entries only, labelled NOT FOR CLINICAL USE, with a content request (OQ-143).

### 2.2 Patient context (SI-16 clause e; CTRL-0016-6)

The executable machine is `docs/specs/state-machines/patient-context.yaml` (Appendix B.3; approval requested, every transition proposed). It is the client half only: CTRL-0016-1 requires the patient context to be server-side, with the shell only rendering it, and that server-side context is not built in WP-0.7 (KA-025). Until it is, this machine stands alone; afterwards it mirrors the server's context and stays as a second line of defence. In short:

- **One patient context per window** (§6.5). A window (a browser tab, a Tauri window, the mobile app) holds no patient or exactly one. Each window has its own context; windows never share or merge one. §2.1 notes that SI-16 does not impose one open chart per workstation, and neither does this design.
- **The context decides whose data is shown.** Clinical routes read patient data only by the context's patient id, never by a URL or route parameter. A URL is a request: when its patient id differs from the context's (a deep link, the browser history, a typed address), the route renders nothing patient-specific and the switch confirmation opens. A confirmed switch changes the context, then the data. A cancelled or refused switch restores the URL to the current patient by replacing the history entry, so the address, the banner and the content always name the same patient.
- **A context switch needs confirmation** (CTRL-0016-6, a tightening recorded in `docs/safety/README.md`). Selecting another patient while one is open, from the command palette, a list, a deep link or the browser history, opens a confirmation that shows the current and the requested patient side by side (photo, every name form, MRN, and the date of birth at its recorded precision with the approximate-DOB flag where it applies), each field with its missing or unavailable state and never truncated (§2.1 rule 3). The confirm control names the requested patient's panel, is never the default action, is never focused when the dialog opens and is never activated by Enter alone; "Keep current patient" is the safe choice. While the requested patient's identity data is invalid (patient id, MRN or every name form missing or invalid), the confirm control is disabled with `patientContext.switch.requestedInvalid`, and only "Keep current patient" is offered (DN-032). Until the user confirms, the current patient stays. Opening the first patient in an empty window replaces nothing and needs no confirmation.
- **No switch while a modal is open.** A switch requested while a dialog is open (signing, for example) or while a HAL capture waits for a device (§6) is refused with `patientContext.switch.blockedByModal`; it is not queued (§2.8).
- **What a switch clears.** Confirming replaces the context, records the change time and clears the re-verification. The TanStack Query cache is keyed by patient and the previous patient's entries are removed (§4). Drafts autosave against their own patient (§5.4) and are never carried to the new one.
- **What counts as a context change**: any change of the window's patient id, including from none to a patient and from a patient to none; selecting the patient already open is not one (DN-028).
- **A change of user clears the context of every window** [P] (DN-028): when a badge tap or a sign-in changes the user, every window of the workstation session returns to no patient, any open dialog closes without signing, and each shows `patientContext.clearedByUserChange`. The shell sends the user change to each of its windows. In a plain browser, tabs of the same origin learn it through a `BroadcastChannel`, and every window also compares the user its context was opened under with the session's user when it gains focus and before every clinical action, and clears its context on a mismatch (fail closed). The badge flow itself arrives with WP-0.4.
- **Device results are bound to the window and its patient** (§6; `docs/specs/hal/README.md`). A barcode read goes only to the window that has the focus. A capture (photo, document scan, ID read, signature) is bound to the window's patient id and context-change time when it is requested; a result that arrives after a context change is discarded with `hal.capture.discardedAfterContextChange`, and its blob is released.

### 2.3 Sign and co-sign (SI-16 clause f; CTRL-0016-7)

**One pattern everywhere** (§6.5, §14.2): `SignDialog` serves both signing and co-signing, with the same steps in the same order and the same controls. Two things differ: the intent statement, and the strength of authentication, because a co-signature needs badge tap plus PIN (§12.8; R16 §9.6), as controlled drugs and break-the-glass will.

1. **Review**: what is being signed and for which patient (the banner stays visible above the dialog).
2. **Re-verification, when required**: see below.
3. **Authentication**: the signer authenticates for this signature (§9.4: authentication, intent and manifestation); a co-signer taps a badge and enters a PIN. The Trust Plane provides both from WP-0.4; the WP-0.7 demo simulates both, the PIN step included, and says so on screen (KA-032).
4. **Intent and sign**: the intent statement (`sign.intent.author` or `sign.intent.cosign`) and the Sign or Co-sign control, which is never focused on open.

**The sign step cannot open on an incomplete identity.** While the banner is in its error state or the date of birth is missing or invalid (§2.1 rule 4), opening the sign or co-sign step is refused with `sign.blockedByBanner` (`bannerIdentityValid` in the machine); the `_clinical` layout also disables the action.

**Re-verification at signing within 60 s of a context change.** When the sign or co-sign step opens, `ui-core` compares the time since the window's last patient-context change with the re-verification window (60 000 ms). If the change happened **within 60 s, read inclusively** (an elapsed time of exactly 60.000 s still requires re-verification: the stricter reading, decision DN-026) and no re-verification has been confirmed in the window since that change, the dialog shows the re-verification step before authentication. It shows the photo (or "No photo"), every name form, the MRN and the date of birth at its recorded precision with the approximate-DOB flag where it applies, none of them truncated (§2.1 rule 3), and asks the person at the dialog to confirm "This is the right patient" with a control that is never preselected or focused on open. What re-verification consists of is decision DN-027 for the CSO.

- Elapsed time is measured on a monotonic clock (`clock.ts`), never on the wall clock. An unknown change time, an unreadable clock or a negative elapsed time counts as within the window (fail closed), and with an unknown change time no earlier re-verification counts.
- **Bound to the signer.** The re-verification step records the session user who confirmed it. If the user who then authenticates for the signature is not that user (for example a co-signer authenticating at the same workstation), submitting returns the dialog to re-verification for the person signing (`sign.reverify.signerDiffers`).
- **"Not this patient"** ends the dialog without signing and shows `sign.reverify.rejected` ("Close or change the patient"); focus goes to the banner's close and change controls, never to a clinical action. Until the context changes or a re-verification is confirmed, every sign step in the window requires re-verification, even after 60 s (the identity is disputed).
- A co-signer is re-verified against the co-signer's own window: a context change in that window within 60 s requires re-verification there.
- The window is a vendor-locked parameter: a tenant may lengthen it and never shorten it (CTRL-0016-1). In WP-0.7 it is a constant in `ui-core`; the configuration chain arrives with WP-0.3.
- **Submitting.** The sign command carries the time of the window's last context change, the time of re-verification and an idempotency key created when the sign step opened (§6.2), so the server can refuse a signature without re-verification (CTRL-0016-7) and never records one twice. Outcomes: accepted (`sign.done`); refused because re-verification is required, which returns to the re-verification step (`sign.refused.reverify`); rejected for another reason, with nothing saved and the dialog left open (`sign.failed`); or unknown after a timeout or a lost response (`sign.outcomeUnknown`), with the dialog left open, where the user is asked to check the record and a retry reuses the same idempotency key. The server-side refusal and the server's handling of the key are not built in WP-0.7 (KA-025).
- If the window's context changed after the sign step opened (switches are refused while the dialog is open, so this is a defect or a forced change), submitting closes the dialog without signing (`sign.contextChanged`).

### 2.4 Command palette

- Opened with Ctrl+K (Cmd+K on macOS) and from a visible button (`commandPalette.open.label`). It is a modal, so the stack guard applies.
- **Keyboard-first and fully operable from the keyboard** (§6.5, §14.2): arrow keys move, Enter runs the highlighted command, Escape closes; every command is reachable without a pointer.
- **Never preselects** (§6.5: defaults never select a patient): no item is highlighted when the palette opens or when results change, even when only one result matches. Enter with no highlighted item does nothing.
- **Choosing a patient closes the palette first.** The palette closes, and only then requests the patient, with no modal open; when another patient is open, the context-switch confirmation of §2.2 opens after the palette has closed. A confirmation never opens over the palette, and the palette is never exempt from the stack guard.
- Patient results show every name form, the MRN and the date of birth, never truncated (§2.1 rule 3).
- WP-0.7 commands: navigation, density, language and the demo fixtures (demo builds only). Typo-tolerant brand and generic medicine search (§14.2) comes with the formulary.

### 2.5 Density modes

Two modes, `comfortable` (default) and `compact`, set as `data-density` on `<html>` by `DensityProvider` and stored per user on the device (no PHI). Tokens change spacing and the type scale. Targets stay at least 24 × 24 CSS px in both modes (§6.5), text contrast at least 4.5:1, and the banner's wrapping rules hold in both.

### 2.6 `ClinicalNumber` and number display (SI-05; CTRL-0005-17)

`ClinicalNumber` renders a clinical numeral and its unit. It takes a **decimal string** exactly as entered or as returned by a knowledge base, never a JavaScript number, and only normalises the string for display (`ui-core/clinical-number.ts`):

| Input | Shown | Rule |
|---|---|---|
| `.5` | `0.5` | A leading zero before a decimal point, never a naked decimal (ISMP) |
| `5.0`, `2.50` | `5`, `2.5` | No trailing zero after a decimal point (ISMP; for results, decision DN-030) |
| `0.0`, `-0` | `0` | Zero has one form [P] |
| `007`, `00.5` | `7`, `0.5` | Redundant leading zeros of the integer part are removed [P] |
| `1000`, `150000`, `999` | `1 000`, `150 000`, `999` (the space is U+202F) | Integer parts of 1000 and above are grouped in threes with a narrow no-break space (U+202F), never with a comma or a full stop; decimal digits are not grouped. ISMP asks for a separator in large numbers so that 100000 is not misread as 10000; a comma beside right-to-left text can be read as the Arabic decimal separator `٫`, so this specification uses the narrow space. This departs from the letter of ISMP's comma and is decision DN-031 for the CSO |
| `-1.5` | `-1.5` | A minus sign is kept (results, balances), inside the isolated left-to-right run |
| `1e3`, `1,5`, `1 000`, `٠٫٥`, `+2`, text | invalid marker | Anything outside `-?[0-9]*(\.[0-9]+)?` with at least one digit is shown as "Invalid value" (`clinical.number.invalid`), never guessed or converted. Input is never accepted already grouped |
| empty | missing marker | "Not recorded" (`clinical.value.missing`) |

- **No arithmetic, and the numeric value never changes** (SI-05 and its §2.1 definition). The function works on characters only. It never calls `Number`, `parseFloat`, `parseInt`, `Math`, `toFixed`, `toPrecision` or `Intl.NumberFormat`, never rounds and never converts a unit. It changes only the display form, under the ISMP rules of CTRL-0005-17: a leading zero, no trailing zero, one form of zero, the grouping space. The numeric value is the one entered or returned, which §2.1 allows under (a). CTRL-0005-6 requires entered and knowledge-base values to be "displayed unchanged"; this specification reads a display-form normalisation that keeps the numeric value as no change under CTRL-0005-6. Removing a trailing zero does drop the precision a value was written with (a result of `4.0` shows as `4`). Both points are decision DN-030 for the CSO and the laboratory CSO, before WP-1.7 shows results.
- **Western digits only**, ASCII 0–9 with `.` as the decimal point, on every locale (§6.5, §11.1).
- **Units through a governed display map.** The unit is stored as a UCUM code and shown through a display map from UCUM code to an ISMP-safe form, in Latin script and never translated: for example `ug` is shown as `mcg`, `U` as `units` and `[iU]` as `units`, because `ug`, `U` and `IU` are on ISMP's list of error-prone abbreviations (misread as mg, as 0 or 4, and as IV or 10). A unit that is not in the map is never shown as its raw code: the value and unit are shown as "Invalid value". The map is clinical content (§3.4 item 3): WP-0.7 ships a synthetic sample (`kg`, `g`, `mg`, `ug` → `mcg`, `mL`, `L`, `U` → `units`, `mmol/L`, `%`), labelled NOT FOR CLINICAL USE, with a content request (OQ-152).
- The number and its unit sit together in one `<bdi dir="ltr">` with a no-break space between them, so `0.5 mg` keeps its order inside right-to-left text.
- **Not in WP-0.7:** tall-man lettering for look-alike names (it needs the governed LASA list, §3.4 item 3), the CSO-approved unit display map (OQ-152) and number display on prints (WP-0.8). CTRL-0005-17 is therefore only partly built (KA-036).

**Western digits in the whole staff UI** (a recorded tightening of §6.5, OQ-141). §6.5 and §11.1 require Western digits for clinical numerals and allow Eastern Arabic-Indic digits, by configuration, only for non-clinical numbers in patient-facing Kurdish and Arabic text. The staff workspaces built here use Western digits for every number: the UI locales are `en`, `ckb-u-ca-gregory-nu-latn` and `ar-u-ca-gregory-nu-latn` (`ui-intl.ts`; canonical BCP 47 form, with the Unicode extension keys in alphabetical order, which is what `Intl` reports back), and no UI path formats digits from U+0660–U+0669 or U+06F0–U+06F9. The §6.5 configuration for patient-facing text (templates, signage, the front door) is not removed; it comes with those surfaces.

### 2.7 `Bdi`

`Bdi` renders `<bdi>` with `unicode-bidi: isolate`, an explicit `dir` (`ltr` for MRNs, numbers with units, dates, drug names and Latin names; `rtl` for Sorani and Arabic names; `auto` only for free text of unknown direction) and the value's `lang` where known (for example `ckb`, `ar`, `ckb-Latn`). Message placeholders that carry such values are filled with `Bdi` elements, never with bare strings.

### 2.8 `Modal` and the stack guard

`Modal` wraps the React Aria modal and registers itself in a per-window stack guard. **No stacked modals** (§6.5, §14.2): while one modal is open, a request to open another is refused. In development and tests the refusal throws, so the defect is found; in production the second modal does not open and a polite live-region message (`modal.blocked`) asks the user to finish or cancel the open dialog. Steps inside one dialog (review, re-verification, authentication, sign) are views of the same modal, not modals of their own. A confirmation never opens inside a confirmation. A HAL capture that waits for a device (a photo, a document scan, an ID read, a signature) holds the guard as a modal does (§2.2, §6).

### 2.9 `LocaleProvider`

`LocaleProvider` holds the user's UI locale (`en`, `ckb` or `ar`; §11.1: one choice per user), sets `lang` and `dir` on `<html>` (`en` → `ltr`; `ckb` and `ar` → `rtl`, from `textDirection(locale)` in `@hms/i18n`) and supplies the FormatJS `IntlProvider` with the `ui-intl` locale and the catalogue. A language change re-renders in place, without a reload, and keeps the patient context. Pseudo-locales (expanded text; mirrored text) exist only in development and test builds, built in memory, because the catalogue lint rejects catalogue files outside the UI locales. A missing key fails the build for clinical paths (§6.5); at run time a missing key is reported (no PHI) and shown as its key in a visible error style, never as an empty string.

## 3. RTL, bidi and digits

- **CSS logical properties only** (§6.5, §14.7): `margin-inline-start`, `inset-inline-end` and the like; `hms/no-physical-css` and the stylesheet check fail the build on physical directions.
- **`dir` and `lang` on `<html>`** come from the locale (§2.9). Components never set a direction of their own except through `Bdi`.
- **Icons**: direction-bearing icons (arrows, chevrons, "back", progress) mirror in RTL; icons without direction (clock, check mark, warning, the photo placeholder) do not.
- **Bidi isolation** of every mixed string (§14.7, §18.9 "Bidi"): a Sorani or Arabic name with a Latin drug name, a dose and a unit keeps each part in order (§2.7).
- **Digits**: Western digits for every number in the staff UI (§2.6). Dates are Gregorian (§11.7; the optional Hijri display is not built here) and the banner shows dates as `YYYY-MM-DD` [P] (OQ-141), so a date is never ambiguous between day-month and month-day orders; the wristband format of WP-0.8 must match it.
- **Fonts**: one OFL-licensed family bundled with the app covers every Sorani letter (پ چ ژ گ ڤ ڕ ڵ ۆ ێ ە), the Arabic and Kurdish forms of ي/ی, ك/ک and ه/ە, Arabic and the Western digits (§4.1, §11.1); the same family serves WP-0.8's prints (OQ-148). No font is loaded from the network.

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
- **Absent from production builds** (OQ-142): the demo routes are registered only when the build sets `VITE_HMS_DEMO=1`; otherwise they are not in the bundle, and the route-tree test checks the production tree.

## 6. The Tauri shell and the HAL contract (summary)

The shell hosts the web app on workstations and implements the hardware abstraction layer of §12.8 (plane A). The contract is `docs/specs/hal/` (README, `hal-v1.schema.json`, 69 synthetic fixtures). Summary:

- **Twelve calls**: `hal.print.label`, `hal.print.raw`, `hal.print.document`, `hal.scan.onBarcode`, `hal.scan.document`, `hal.id.read`, `hal.auth.onBadge`, `hal.sign.capture`, `hal.pay.request`, `hal.camera.photo`, `hal.kiosk.lock`, `hal.capabilities`.
- **Every call returns `{ok, value | error, auditId}`**, a closed object; calls never throw across the bridge.
- **Errors**: `unavailable`, `not-permitted`, `invalid-request`, `device-error`, `timeout`, `cancelled`, each with a fixed set of reasons, a `retryable` flag, an `outcomeUnknown` flag and a catalogue key (`hal.error.*`, `hal.reason.*`); no free text and no device output. A timeout or device error on a print or payment call has `outcomeUnknown: true` and `retryable: false`: the job may already have printed or the card may have been charged, so the screen asks the user to check the printer or terminal (`hal.error.outcomeUnknown`), and a reprint is an explicit, audited request that names the earlier job (`reprintOf`).
- **Fail closed**: with no shell, `transport-none` returns `unavailable` / `no-shell` for every call, `hal.id.read` and `hal.pay.request` included; the shell returns `unavailable` / `not-implemented` for those two until the simulators of WP-1.2 and WP-1.9 exist (KA-027). Printing without the shell fails until the site print service exists (KA-028).
- **Bound to the window and the patient** (§2.2): the shell delivers a barcode read only to the window that has the focus; `hal-client` binds every capture to the window's patient id and context-change time and discards a result that arrives after a context change; a capture waiting for a device counts as a modal, so no switch starts meanwhile.
- **Badge taps never carry the credential across the bridge**: the shell redeems the badge with the Keycloak step-up bound to the workstation certificate (§12.8), and the event carries only the outcome and an opaque, single-use, short-lived step-up reference (OQ-150).
- **No PHI in the audit log (H13, SI-20)**: every call and event writes a local audit record whose closed shape has no field for patient data, payload content, credentials or amounts, and no payload hash. The log stays on the workstation until WP-0.4 (OQ-147, KA-034).
- **No card PAN** reaches the HMS (§12.8); the payment value has no field for card data.
- **Security**: IPC only from the cell's origin; capabilities per workstation profile and role, every call audited (§13.5); simulated devices only in WP-0.7 (KA-035).
- **Shell build**: Linux `.deb` in the WSL build host; the Windows bundle is decision DN-023 (KA-029).

## 7. The mobile skeleton

One Expo app (React Native, New Architecture) with a nurse mode and a physician mode (§15), sharing `ui-core`: the banner is built on the same banner model and its rules (§2.1). WP-0.7 builds the JavaScript skeleton, `tsc`, unit tests and an offline `expo export --platform android` smoke run (`EXPO_OFFLINE=1`, `EXPO_NO_TELEMETRY=1`; no Expo network calls, telemetry or cloud builds, §3.7). Device builds need the Android SDK and, for iOS, macOS (DN-024, KA-030). Changing the UI language on mobile needs an app restart (OQ-146). The encrypted offline store is `PLT-UX-04` (WP-3.3).

## 8. Configuration, permissions and audit

| Item | WP-0.7 value | Rule |
|---|---|---|
| Re-verification window | 60 000 ms, inclusive (DN-026) | Vendor-locked; a tenant may lengthen it, never shorten it (CTRL-0016-1); a constant until the WP-0.3 configuration chain |
| UI locale | per user: `en`, `ckb` or `ar` | §11.1 |
| Density | per user on the device | §2.5 |
| Demo routes | build flag `VITE_HMS_DEMO=1` | Never set in production builds (§5) |
| Workstation profile (shell) | local synthetic profile with simulated devices | Capabilities per profile and role (§13.5); real roles from WP-0.4 |

The design system publishes no domain event. Opening a patient's chart is a PHI read that the Trust Plane audits server-side (WP-0.4); the HAL's own audit records are described in §6.

## 9. Hazards, controls and tests

Hazards touched: H1 wrong patient (HAZ-0001 for SI-01, HAZ-0016 for SI-16), H2 dose errors through misread numbers (HAZ-0005 for SI-05), H8 transfusion (HAZ-0011 for SI-11, through `PLT-UX-02`: the HAL carries the barcode reads of the scripted two-person check, CTRL-0011-11, and the label printing of the relabel template, CTRL-0011-8; WP-0.7 builds the contract and simulated devices only, and verifies no HAZ-0011 control), plus H13 for the HAL audit log (HAZ-0020). Control identifiers are those of `docs/safety/hazard-log.yaml`. "No control yet" means no hazard-log control names the test; the lead decides at close-out (S12) whether to add it to a control's `planned_verification`. A test named in a control's `planned_verification` is a safety test (§3.4 item 10).

**Controls that WP-0.7 builds only in part**, which stay short of `verified` at S12: CTRL-0016-3 (no sensitivity indicators until WP-0.4; the banner on mobile views and prints, KA-026; KA-033), CTRL-0016-5 (clinical routes only; mobile views and prints, KA-026), CTRL-0016-7 (the client rule only; the server refusal, KA-025), CTRL-0016-1 (not built; KA-025) and CTRL-0005-17 (screens only, no tall-man lettering, a synthetic unit map; KA-036).

| Test (kind:name) | Slice | Checks | Control |
|---|---|---|---|
| `PropertyTest:pseudo-locale-preserves-placeholders` (`pseudo.property.test.ts`) | S2 | Pseudo-locales keep every ICU placeholder and tag | No control yet |
| `UnitTest:ui-intl-western-digits` (`ui-intl.test.ts`) | S2 | No UI locale formats U+0660–U+0669 or U+06F0–U+06F9; the locales resolve to `ckb-u-ca-gregory-nu-latn` and `ar-u-ca-gregory-nu-latn` | CTRL-0005-17 (Western digits in every locale); not named there yet |
| `UnitTest:sorani-letters` (`sorani-letters.test.ts`) | S2 | The ten letters and the three letter pairs are listed exactly once | No control yet |
| `UnitTest:clinical-keys-lint` (lint tests) | S2 | Under `banner.*` and `clinical.*`, a `ckb` or `ar` value equal to the English one fails; an `ar` plural with a clinical count keeps `#` in every branch | No control yet |
| `UnitTest:clinical-number-ismp-display-rules` | S3 | §2.6 table, including grouping, invalid and missing inputs, and the unit display map (`ug` → `mcg`, `U` → `units`, `[iU]` → `units`, an unmapped unit → invalid) | **CTRL-0005-17** (named there) |
| `PropertyTest:clinical-number-*` (leading zero, no trailing zero, ASCII digits only) | S3 | For generated decimal strings: never a naked decimal, never a trailing zero after the point, only ASCII digits and U+202F, the digit sequence otherwise unchanged | CTRL-0005-17; not named there yet |
| `StaticAnalysis:clinical-number-no-arithmetic` (added by this specification) | S3 | `clinical-number.ts` references none of `Number`, `parseFloat`, `parseInt`, `Math`, `toFixed`, `toPrecision`, `Intl.NumberFormat` | CTRL-0005-6 (values shown unchanged, never recalculated; reading in DN-030); not named there yet |
| `UnitTest:allergy-status-nka-distinct-from-not-assessed` | S3 | `nka`, `not-assessed` and `list` parse distinctly; missing, null, unknown, empty-list, malformed, extra-key and contradictory data (`nka` or `not-assessed` with items) never yield NKA; one malformed item makes the whole field unavailable | **CTRL-0016-4** (named there) |
| `PropertyTest:SI-16-re-verification-at-signing-after-recent-context-change` | S3 | With a fake monotonic clock: required at 59.999 s and 60.000 s, not required at 60.001 s; required for an unknown change time, an unreadable clock and negative elapsed time; cleared only by re-verification after the last change; required again after "Not this patient" until a change or a re-verification; a re-verification confirmed by another user than the signer does not count; no sign step on an invalid banner identity | **CTRL-0016-7** (named there); client part only, the server refusal is KA-025 |
| `UnitTest:context-switch-requires-confirmation` | S3 | Another patient never replaces the context without `ConfirmSwitch`; cancel keeps the patient and the change time; selecting the same patient changes nothing; no switch while a modal or a HAL capture is open; confirm is impossible while the requested patient's identity is invalid | CTRL-0016-6; not named there yet |
| `UnitTest:tokens-contrast` | S4 | Every text and background token pair is at least 4.5:1, in both densities | No control yet (§6.5) |
| `UnitTest:font-coverage` | S4 | The bundled woff2 cmap holds every Sorani letter, every letter variant and the Western digits | No control yet (WP-0.8 repeats it for prints) |
| `UnitTest:modal-no-stacking` | S4 | A second modal is refused while one is open | No control yet (§6.5) |
| `UnitTest:locale-sets-dir-and-lang` | S4 | `<html>` gets `lang` and `dir` for `en`, `ckb` and `ar`, and updates on change | No control yet |
| `UnitTest:banner-renders-every-field` | S5a | Photo, every name form, MRN, date of birth with the approximate-DOB flag for an approximate or partial date, allergies, code status, isolation, dated weight with source | **CTRL-0016-3** (named there; partly built, see above); also CTRL-0001-7 (approximate-DOB flag) and CTRL-0005-3 (dated, sourced weight), not named there yet |
| `UnitTest:banner-missing-data-visible` | S5a | Each missing or invalid field shows its own text; a missing name form in the patient's script or Latin shows "Identity incomplete" and a missing third form is flagged; "No dated weight" and "Weight unavailable" (invalid, undated, zero or negative) are distinct; a label missing in the user's locale shows another locale's label with "Not translated"; an unknown code-status or isolation code shows the field unavailable; the error state and a missing or invalid date of birth disable signing | CTRL-0016-3 and CTRL-0001-6; not named there yet |
| `UnitTest:banner-identifiers-never-room-or-bed` | S5a | Input with room, bed and location values renders none of them in the banner | CTRL-0001-4; not named there yet |
| `UnitTest:colour-not-only-carrier` | S5a | Every status variant has distinct text and a distinct icon with an accessible name | No control yet (§6.5) |
| `UnitTest:bidi-isolation` | S5a | Names, MRN, dates and numbers with units are each inside `<bdi>` with the expected `dir` | No control yet (§14.7) |
| `UnitTest:banner-long-names-wrap` and the long-name case of `E2E:visual` | S5a, S7 | Four-part names in every script, MRNs and allergy substances are fully present and not clipped (no ellipsis, line clamp or hidden overflow) at the narrowest supported width in both densities, in the banner, the switch confirmation, the re-verification step, the palette's patient results and the patient chooser; two patients whose names differ only in the grandfather's name are told apart | CTRL-0016-3; not named there yet |
| `UnitTest:sign-requires-reverification` | S5b | Within the window the dialog shows re-verification before authentication; Sign stays disabled until it is confirmed; "Not this patient" ends the dialog with `sign.reverify.rejected` and moves focus away from clinical actions | CTRL-0016-7; not named there yet |
| `UnitTest:cosign-same-pattern` | S5b | Co-sign uses the same steps, controls and re-verification rule against the co-signer's window, and its authentication step asks for badge tap plus PIN (simulated) | CTRL-0016-7; not named there yet |
| `UnitTest:sign-outcome-unknown-reuses-idempotency-key` | S5b | A rejected command shows `sign.failed`; a timeout shows `sign.outcomeUnknown` and a retry sends the same idempotency key | No control yet (§6.2) |
| `UnitTest:palette-keyboard-only` | S5b | Every palette command can be found and run from the keyboard alone | No control yet |
| `UnitTest:palette-never-preselects-patient` | S5b | Nothing is highlighted on open or on new results; Enter with nothing highlighted does nothing | No control yet (§6.5 "defaults never select a patient") |
| `UnitTest:palette-selects-patient-via-confirmation` | S5b | Choosing another patient in the palette closes the palette first; the switch confirmation opens only after it has closed, and never over it | CTRL-0016-6; not named there yet |
| `ArchTest:banner-present-on-every-clinical-route` (`route-tree.test.ts`) | S6 | Every clinical route sits under `_clinical`; every route declares `staticData.clinical`; `/demo` is absent from the production route tree | **CTRL-0016-5** (named there) for the banner; no control yet for the demo exclusion |
| `E2E:banner-trilingual-rtl` | S7 | In `en`, `ckb` and `ar`: `dir`, computed direction, every name form, `<bdi>` isolation | **CTRL-0016-3** (named there) |
| `E2E:axe` | S7 | axe with tags up to `wcag22aa`, zero violations | No control yet (§14.4) |
| `E2E:visual` | S7 | Screenshot baselines per locale × density (Linux) | No control yet (§14.7, §18.9) |
| `E2E:pseudo-locale` | S7 | No hard-coded text; no truncation under expansion, on the banner and on every surface that rule 3 of §2.1 names | No control yet (§14.7) |
| `E2E:targets-24px` | S7 | Every target at least 24 × 24 px in compact density | No control yet (§6.5) |
| `E2E:glyph-render` | S7 | Only the bundled font renders the banner text (CDP `CSS.getPlatformFontsForNode`, `isCustomFont`) | No control yet |
| `E2E:digits-western` | S7 | No Eastern Arabic-Indic digit on any demo screen in any locale | CTRL-0005-17; not named there yet |
| `E2E:no-external-requests` | S7 | No request leaves the app's origin | No control yet (relates to SI-20; CTRL-0020-3 is the cell's egress policy, not this) |
| `E2E:one-patient-context-per-window` | S7 | A window never shows two patients; a switch needs confirmation; the previous patient's data is gone after a switch | **CTRL-0016-6** (named there) |
| `E2E:url-never-overrides-patient-context` | S7 | Browser-history and deep-link navigation to another patient show nothing patient-specific until confirmed; after a cancel the URL, the banner and the content all name the current patient | CTRL-0016-6; not named there yet |
| `E2E:user-change-clears-every-window` | S7 | With two windows open on different patients, a simulated user change clears the patient context of both and closes an open sign dialog without signing | CTRL-0016-6; not named there yet |
| `E2E:sign-after-context-change-forces-re-verification` | S7 | Signing within 60 s of a switch shows re-verification; after 60 s it does not | **CTRL-0016-7** (named there); client part only |
| `UnitTest:hal-contract-fixtures` | S8 | Every fixture in `docs/specs/hal/fixtures/` validates and round-trips through the TypeScript types, with the cross-checks listed in `docs/specs/hal/README.md` | No control yet; the closed audit record applies CTRL-0020-7's allowlist principle |
| `UnitTest:no-shell-fails-closed` | S8 | With no shell, every call, `hal.id.read` and `hal.pay.request` included, returns `unavailable` / `no-shell` with an audit ID | No control yet (§3.5 fail closed) |
| `UnitTest:hal-capture-discarded-after-context-change` | S8 | A capture result that arrives after the window's context changed is discarded with `hal.capture.discardedAfterContextChange`, and its blob is released | CTRL-0016-6; not named there yet |
| `test_printer_capture` (Python) | S8 | The label-printer simulator stores the ZPL or PDF it receives on port 9100 | No control yet (simulator, §3.7) |
| `cargo test` for `hal-core` | S9 | The same fixtures round-trip through serde with the README's cross-checks; audit records serialise with only the allowlisted fields; simulated devices behave as the fixtures say | No control yet; CTRL-0020-7's allowlist principle |
| Tauri mock-runtime test per HAL call (twelve) | S9 | Each call returns a typed result and an audit ID; `hal.id.read` and `hal.pay.request` return `unavailable` / `not-implemented`; a barcode read reaches only the focused window; a badge event carries no credential | No control yet (the focused-window routing serves CTRL-0016-6) |
| `clippy -D warnings`, `fmt --check` | S9 | Rust lint and format | No control (build hygiene) |
| `modes.test.ts` | S10 | Nurse and physician modes | No control yet |
| `mobile-banner-model.test.ts` | S10 | The mobile banner uses the `ui-core` model and its missing-data rules | CTRL-0016-3 (partly); the mobile view test `E2E:banner-on-every-mobile-clinical-view` of CTRL-0016-5 is not built (KA-026) |
| `tsc` and the offline `expo export` smoke run | S10 | The mobile skeleton type-checks and bundles | No control (build hygiene) |
| `badge-tap-switch.spec.ts` | S13, after WP-0.4 | Simulated reader → shell → Keycloak step-up → session swap in ≤2 s | No control yet (§12.8, §14.4); KA-032 |
| Package smoke tests (one per new package) and the CI runner tests | S1, S11 | Workspace wiring | No control (build hygiene) |

## 10. Message keys

The keys slices S2 to S6 add to the catalogues, in `en`. Keys follow the catalogue rules (`frontend/packages/i18n/README.md`). Notes for translators:

- **Clinical meaning first.** Several pairs must never read alike: "No known allergies (NKA)" versus "Allergies not assessed" versus "Allergy status unavailable"; "not documented" versus "unavailable"; "No dated weight" versus "Weight unavailable"; "Not signed" versus "It is not known whether this was signed". Under `banner.*` and `clinical.*` a `ckb` or `ar` text equal to the English text fails the lint.
- **No length limit means the text wraps.** Banner labels and statuses wrap and are never truncated, so no maximum is set; keep them short. Where a maximum is given, it is for controls that must stay on one line.
- **Placeholders** use ICU syntax. A plain argument (`{weight}`, `{date}`, `{status}`, `{patientName}`) receives a value already rendered and bidi-isolated by the design system (`ClinicalNumber`, `Bdi`, `ui-intl`): keep it, move it where the language needs it, and never add `number` or `date` formatting to it. Keep units such as `kg` in Latin script.
- **Plurals.** `{count, plural, …}` renders `#` with Western digits. Arabic (`ar`) has the CLDR categories `zero`, `one`, `two`, `few`, `many` and `other`, and 60 falls in `many`: give every category the message can reach, and keep `#` in every branch of a clinical count, because the Arabic `one` and `two` forms are often written without the numeral. Sorani (`ckb`) uses `one` and `other`. The catalogue lint requires only `other`, so it does not catch a missing Arabic category; the reviewer checks it.
- **Gender.** Text that addresses the user, or asks the user to act ("Confirm the patient", "Check the record"), is gendered in Arabic and can be in Sorani. Use gender-neutral forms: a verbal noun, the passive or an impersonal construction.
- **Punctuation.** In `ar` and `ckb` use the Arabic comma `،` (U+060C) between the parts of a composed value such as `banner.weight.value` and `banner.codeStatus.recordedOn`, and keep the parentheses of the English where the language uses them.
- Every `ckb` and `ar` text is an unreviewed draft until a clinician reviews it (DN-021; the review is content request OQ-151).

| Key | English | Note for translators |
|---|---|---|
| `banner.region.label` | Patient banner | Accessible name of the banner region, read by screen readers |
| `banner.photo.alt` | Patient photo | Alternative text of the registration photo |
| `banner.photo.missing` | No photo | Shown in place of the photo when none is recorded; must not suggest the patient has no face or identity |
| `banner.name.kurdish.label` | Name (Kurdish) | Label of the patient's name in Kurdish, written in Arabic script |
| `banner.name.arabic.label` | Name (Arabic) | Label of the patient's name in Arabic |
| `banner.name.latin.label` | Name (Latin) | Label of the Latin transliteration of the name |
| `banner.name.kurdishMissing` | Kurdish name missing | A registration gap: the Kurdish form of the name is not recorded |
| `banner.name.arabicMissing` | Arabic name missing | A registration gap: the Arabic form of the name is not recorded |
| `banner.name.latinMissing` | Latin name missing | A registration gap: the Latin transliteration is not recorded; identity is incomplete |
| `banner.identity.incomplete` | Identity incomplete | Warning marker; same wording as the print refusal of CTRL-0001-6 |
| `banner.mrn.label` | MRN | Medical record number, the hospital's patient identifier; translate the abbreviation in the form clinicians use, do not leave it in English |
| `banner.dob.label` | Date of birth | Label of the date of birth |
| `banner.dob.approximateFlag` | Approximate date of birth | Flag shown beside an estimated date of birth, or one recorded only to the month or year; the date must not be read as exact |
| `banner.dob.missing` | Date of birth missing | A registration gap; identity is incomplete |
| `banner.dob.unavailable` | Date of birth unavailable | The recorded date of birth could not be read; identity is incomplete and signing is blocked |
| `banner.allergies.label` | Allergies | Label of the allergy field |
| `banner.allergies.nka` | No known allergies (NKA) | The allergy history was taken and no allergy is known. Keep the sense of "known"; never "no allergies". Keep the abbreviation NKA in Latin script after the translated words |
| `banner.allergies.notAssessed` | Allergies not assessed | Nobody has asked yet; the patient may have allergies. Must read clearly differently from NKA |
| `banner.allergies.unavailable` | Allergy status unavailable | The system could not read the allergy data; treat as unknown. Must read differently from both NKA and "not assessed" |
| `banner.allergies.count` | {count, plural, one {# allergy} other {# allergies}} | Number of recorded allergies; `count` is at least 1. In `ar` give `one`, `two`, `few`, `many` and `other`, each with `#` |
| `banner.codeStatus.label` | Code status | Resuscitation status (for example whether to attempt CPR); use the term clinicians use |
| `banner.codeStatus.notDocumented` | Code status not documented | No decision is recorded; not the same as "full resuscitation" |
| `banner.codeStatus.unavailable` | Code status unavailable | The system could not read it; treat as unknown |
| `banner.codeStatus.recordedOn` | {status}, recorded {date} | A whole message: `status` is the governed code-status label, `date` the date it was recorded. Use `،` in `ar` and `ckb` |
| `banner.isolation.label` | Isolation | Infection-control isolation precautions |
| `banner.isolation.noneRecorded` | No isolation recorded | No precautions are recorded; not a statement that the patient is non-infectious |
| `banner.isolation.unavailable` | Isolation status unavailable | The system could not read it; treat as unknown |
| `banner.weight.label` | Weight | The current dosing weight |
| `banner.weight.value` | {weight} ({source}, {date}) | `weight` is the number with its unit (for example `70 kg`), `source` one of the three source texts below, `date` the date measured. Reorder as the language needs; keep all three; use `،` between source and date in `ar` and `ckb` |
| `banner.weight.source.measured` | measured | Weight measured on a scale |
| `banner.weight.source.stated` | stated | Weight reported by the patient or family |
| `banner.weight.source.estimated` | estimated | Weight estimated by staff |
| `banner.weight.missing` | No dated weight | No usable dosing weight is recorded |
| `banner.weight.unavailable` | Weight unavailable | The weight data could not be read or is not valid; treat as unknown. Must read differently from "No dated weight" |
| `banner.label.untranslated` | Not translated | Marker beside a governed label shown in another language because no translation exists |
| `banner.dataUnavailable` | Patient banner data unavailable | Error state; clinical actions are disabled until data arrives |
| `patientContext.none` | No patient selected | The window holds no patient |
| `patientContext.close` | Close patient record | Control that empties the window's patient context; "record" means the chart, never the person's body; at most 30 characters |
| `patientContext.switch.title` | Change patient? | Title of the switch confirmation |
| `patientContext.switch.body` | This window holds one patient. Opening another patient replaces the current one. | Explains the replacement; the two patients are shown below it by the component |
| `patientContext.switch.current` | Current patient | Heading over the patient now open |
| `patientContext.switch.requested` | Requested patient | Heading over the patient the user asked to open |
| `patientContext.switch.confirm` | Switch to requested patient | Confirms the switch to the patient under the heading "Requested patient", never the current one; it opens that patient's record and never means an act on the person's body; at most 30 characters |
| `patientContext.switch.cancel` | Keep current patient | The safe choice; at most 30 characters |
| `patientContext.switch.requestedInvalid` | The requested patient's identity data is unavailable, so this switch cannot be confirmed. | Shown in the switch confirmation; only "Keep current patient" is offered |
| `patientContext.switch.blockedByModal` | Finish or cancel the open dialog before changing patient. | Shown when a switch is requested while a dialog is open |
| `patientContext.clearedByUserChange` | The patient was closed because the user changed. | Shown in every window after a badge tap or sign-in by another user |
| `sign.title` | Sign | Title of the sign dialog |
| `sign.cosign.title` | Co-sign | Title of the co-sign dialog; a second clinician countersigns |
| `sign.review.heading` | Review before signing | Heading of the review step |
| `sign.intent.author` | I am the author of this entry and I sign it. | Legal intent statement of the author; wording to be reviewed by HIM |
| `sign.intent.cosign` | I have reviewed this entry and I co-sign it. | Legal intent statement of the co-signer; wording to be reviewed by HIM |
| `sign.action` | Sign | Signs; at most 20 characters |
| `sign.cosign.action` | Co-sign | Co-signs; at most 20 characters |
| `sign.cancel` | Cancel | Leaves without signing; at most 20 characters |
| `sign.blockedByBanner` | Signing is not possible: the patient's identity data is incomplete or unavailable. | Shown when the banner is in its error state or the date of birth is missing or invalid |
| `sign.authenticate.heading` | Confirm it is you | Heading of the authentication step; use a gender-neutral form |
| `sign.authenticate.simulated` | Simulated sign-in (demonstration only) | Demo builds only, until the Trust Plane exists |
| `sign.authenticate.cosignPin` | Co-signing needs a badge tap and a PIN. | Shown in the authentication step of a co-signature (§12.8) |
| `sign.reverify.title` | Confirm the patient | Heading of the re-verification step; use a gender-neutral form |
| `sign.reverify.reason` | {windowSeconds, plural, one {The patient in this window changed in the last # second. Check that this is the right patient before signing.} other {The patient in this window changed in the last # seconds. Check that this is the right patient before signing.}} | `windowSeconds` is the re-verification window (60 unless a hospital lengthens it). In `ar`, 60 falls in `many`: give every category, each with `#` |
| `sign.reverify.confirm` | This is the right patient | Confirms the patient's identity; at most 40 characters |
| `sign.reverify.reject` | Not this patient | Ends signing because the patient shown is not the intended one; at most 40 characters |
| `sign.reverify.rejected` | This is not the right patient. Nothing was signed. Close or change the patient. | Shown after "Not this patient"; use a gender-neutral form |
| `sign.reverify.signerDiffers` | The person signing must confirm the patient. Confirm the patient again. | Shown when someone other than the person who confirmed the patient authenticates |
| `sign.refused.reverify` | Signing was refused. Confirm the patient again. | Server refusal; nothing was signed |
| `sign.done` | Signed | Status after a successful signature |
| `sign.failed` | Not signed. Nothing was saved. | Only when the server confirmed that it rejected the signature; never for a timeout or a lost response (see `sign.outcomeUnknown`) |
| `sign.outcomeUnknown` | It is not known whether this was signed. Check the record before signing again. | A timeout or lost response: the signature may have been saved; must never read as "not signed" |
| `sign.contextChanged` | Not signed: the patient in this window changed. Nothing was saved. | The window's patient changed after the sign step opened |
| `commandPalette.open.label` | Open command palette | Accessible name of the button that opens the palette |
| `commandPalette.dialog.label` | Command palette | Accessible name of the palette dialog |
| `commandPalette.search.label` | Search commands | Accessible name of the search field |
| `commandPalette.search.placeholder` | Type a command or search | Placeholder in the search field; at most 40 characters |
| `commandPalette.noResults` | No matching commands | Shown when nothing matches |
| `commandPalette.resultCount` | {count, plural, one {# result} other {# results}} | Announced to screen readers; `count` may be 0. In `ar` give `zero`, `one`, `two`, `few`, `many` and `other`, each with `#` |
| `commandPalette.hint` | Arrow keys to choose, Enter to run, Escape to close. | Keyboard hint |
| `commandPalette.group.navigation` | Go to | Group heading for navigation commands |
| `commandPalette.group.patients` | Patients | Group heading for patient results |
| `commandPalette.group.settings` | Settings | Group heading for settings commands |
| `commandPalette.command.changeLanguage` | Change language | Command name |
| `commandPalette.command.changeDensity` | Change density | Command name; density is how compact the screen layout is |
| `density.label` | Density | Setting name: spacing of the screen layout |
| `density.comfortable` | Comfortable | More spacing |
| `density.compact` | Compact | Less spacing, more on screen |
| `language.picker.label` | Language | Label of the UI language choice; the choices show each language's own name (existing `language.*.endonym` keys) |
| `modal.close` | Close | Closes a dialog; at most 20 characters |
| `modal.blocked` | Finish or cancel the open dialog first. | Announced when a second dialog is refused |
| `app.skipToContent` | Skip to main content | Keyboard skip link |
| `app.mainNav.label` | Main navigation | Accessible name of the main navigation |
| `clinical.number.invalid` | Invalid value | Shown instead of a malformed number; nothing is guessed |
| `clinical.value.missing` | Not recorded | Shown when a clinical value is absent |
| `demo.watermark` | NOT FOR CLINICAL USE | Watermark on synthetic demonstration screens; keep capitals where the script has them |
| `demo.banner.title` | Banner demonstration (synthetic patients) | Title of the demo page |
| `demo.syntheticNotice` | Every patient on this page is synthetic. | Notice on the demo page |
| `demo.fixture.label` | Synthetic patient | Label of the fixture chooser |
| `hal.error.unavailable` | This device function is unavailable. | HAL error kind `unavailable` |
| `hal.error.notPermitted` | This workstation or your role may not use this device. | HAL error kind `not-permitted`; do not say which of the two |
| `hal.error.invalidRequest` | The device could not accept this request. | HAL error kind `invalid-request` |
| `hal.error.deviceError` | The device reported a problem. | HAL error kind `device-error` |
| `hal.error.timeout` | The device did not respond in time. | HAL error kind `timeout` |
| `hal.error.cancelled` | Cancelled. | HAL error kind `cancelled` |
| `hal.error.outcomeUnknown` | The device may already have done this. Check the printer or terminal before trying again. | A print or payment timed out or failed after it was sent; a second attempt could print twice or charge twice |
| `hal.reason.noShell` | Open this workspace in the HMS workstation app to use devices. | No shell present (plain browser) |
| `hal.reason.notImplemented` | This device function is not available in this version. | The call is not built yet |
| `hal.reason.noDevice` | No device of this kind is connected. | — |
| `hal.reason.capabilityNotGranted` | Ask your administrator if you need this device here. | Use a gender-neutral form |
| `hal.reason.stepUpRefused` | The badge was not accepted. | A badge tap whose sign-in step was refused; does not say why |
| `hal.reason.invalidRequest` | The request did not match what the device expects. | — |
| `hal.reason.unsupportedFormat` | The device cannot handle this format. | — |
| `hal.reason.unknownDevice` | The selected device is not known to this workstation. | — |
| `hal.reason.deviceOffline` | The device is offline. | — |
| `hal.reason.mediaOut` | The device is out of paper or labels. | Printers |
| `hal.reason.deviceFault` | The device reported a fault. | — |
| `hal.reason.deviceTimeout` | The device did not answer. | — |
| `hal.reason.userTimeout` | Nothing was received in time. | The user did not present a card, document or signature in time |
| `hal.reason.userCancelled` | Cancelled at the device. | The capture was cancelled at the device or in the shell's capture window |
| `hal.sign.prompt.consent` | Sign below to confirm your consent. | Prompt on the signature pad; the consent form itself is versioned content |
| `hal.sign.prompt.receipt` | Sign below to confirm receipt. | Prompt on the signature pad |
| `hal.sign.prompt.document` | Sign below. | Prompt on the signature pad |
| `hal.capture.discardedAfterContextChange` | The capture was discarded because the patient in this window changed. Nothing was saved. | A photo, scan or signature arrived after the patient changed |

Code-status, isolation and allergy-substance labels are not catalogue keys: they come with the governed content that defines them, in three languages (§2.1, OQ-143). The unit display map of §2.6 is governed content too (OQ-152).

## 11. Not built in WP-0.7, decisions and open questions

They are recorded in `docs/program/KNOWN-ANOMALIES.md`, `docs/program/DECISIONS-NEEDED.md` and `docs/program/OPEN-QUESTIONS.md` under the numbers below.

- **Known anomalies**: SI-16 enforced client-side only, with no server-side patient context, banner model, re-verification rule or sign refusal (CTRL-0016-1 and CTRL-0016-7; KA-025); the banner on mobile views and prints (KA-026); `hal.id.read` and `hal.pay.request` fail closed (KA-027); no site print service without the shell (KA-028); no Windows shell bundle (KA-029); no mobile device builds (KA-030); unreviewed `ckb` and `ar` text (KA-031); the badge tap and the co-signature's tap plus PIN wait for WP-0.4 (KA-032); synthetic banner data, no sensitivity indicators and CTRL-0016-3 partly built (KA-033); the HAL audit log stays local (KA-034); simulated devices only (KA-035); CTRL-0005-17 partly built (KA-036).
- **Decisions**: branch base and ID allocation (DN-020); `ckb` and `ar` text (DN-021, decided); licences (DN-022, decided); Windows packaging (DN-023); Android SDK and macOS (DN-024); Expo and pnpm (DN-025). Readings of safety invariants for the CSO [HUMAN] (§3.4 items 1 and 8), each with the stricter reading as its default: the inclusive 60 s window (DN-026); what re-verification consists of (DN-027); what counts as a context change, and a change of user clearing every window (DN-028); trilingual name display (DN-029); `ClinicalNumber` normalisation and result precision against CTRL-0005-6 (DN-030); grouping of large numbers (DN-031); the banner's blocking rules (DN-032).
- **Open questions**: OQ-140 to OQ-152 (`docs/program/OPEN-QUESTIONS.md`).
