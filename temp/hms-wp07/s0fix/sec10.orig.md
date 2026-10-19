## 10. Message keys

The keys slices S2 to S6 add to the catalogues, in `en`. Keys follow the catalogue rules (`frontend/packages/i18n/README.md`). Notes for translators:

- **Clinical meaning first.** Several pairs must never read alike: "No known allergies (NKA)" versus "Allergies not assessed" versus "Allergy status unavailable"; "not documented" versus "unavailable". Under `banner.*` and `clinical.*` a `ckb` or `ar` text equal to the English text fails the lint.
- **No length limit means the text wraps.** Banner labels and statuses wrap and are never truncated, so no maximum is set; keep them short. Where a maximum is given, it is for controls that must stay on one line.
- **Placeholders** use ICU syntax. A plain argument (`{weight}`, `{date}`, `{patientName}`) receives a value already rendered and bidi-isolated by the design system (`ClinicalNumber`, `Bdi`, `ui-intl`): keep it, move it where the language needs it, and never add `number` or `date` formatting to it. `{count, plural, …}` renders `#` with Western digits. Keep units such as `kg` in Latin script.
- Every `ckb` and `ar` text is an unreviewed draft until a clinician reviews it (DN-new-2).

| Key | English | Note for translators |
|---|---|---|
| `banner.region.label` | Patient banner | Accessible name of the banner region, read by screen readers |
| `banner.photo.alt` | Patient photo | Alternative text of the registration photo |
| `banner.photo.missing` | No photo | Shown in place of the photo when none is recorded; must not suggest the patient has no face or identity |
| `banner.name.script.label` | Name | Label of the name in the patient's own script |
| `banner.name.latin.label` | Name (Latin) | Label of the Latin transliteration of the name |
| `banner.name.scriptMissing` | Name in the patient's script missing | A registration gap; identity is incomplete |
| `banner.name.latinMissing` | Latin name missing | A registration gap; identity is incomplete |
| `banner.identity.incomplete` | Identity incomplete | Warning marker; same wording as the print refusal of CTRL-0001-6 |
| `banner.mrn.label` | MRN | Medical record number, the hospital's patient identifier; translate the abbreviation in the form clinicians use, do not leave it in English |
| `banner.dob.label` | Date of birth | Label of the date of birth |
| `banner.dob.approximateFlag` | Approximate date of birth | Flag shown beside an estimated date of birth; the date must not be read as exact |
| `banner.dob.missing` | Date of birth missing | A registration gap; identity is incomplete |
| `banner.allergies.label` | Allergies | Label of the allergy field |
| `banner.allergies.nka` | No known allergies (NKA) | The allergy history was taken and no allergy is known. Keep the sense of "known"; never "no allergies". Keep the abbreviation NKA in Latin script after the translated words |
| `banner.allergies.notAssessed` | Allergies not assessed | Nobody has asked yet; the patient may have allergies. Must read clearly differently from NKA |
| `banner.allergies.unavailable` | Allergy status unavailable | The system could not read the allergy data; treat as unknown. Must read differently from both NKA and "not assessed" |
| `banner.allergies.count` | {count, plural, one {# allergy} other {# allergies}} | Number of recorded allergies; `count` is at least 1 |
| `banner.codeStatus.label` | Code status | Resuscitation status (for example whether to attempt CPR); use the term clinicians use |
| `banner.codeStatus.notDocumented` | Code status not documented | No decision is recorded; not the same as "full resuscitation" |
| `banner.codeStatus.unavailable` | Code status unavailable | The system could not read it; treat as unknown |
| `banner.codeStatus.recordedOn` | recorded {date} | `date` is a rendered date |
| `banner.isolation.label` | Isolation | Infection-control isolation precautions |
| `banner.isolation.noneRecorded` | No isolation recorded | No precautions are recorded; not a statement that the patient is non-infectious |
| `banner.isolation.unavailable` | Isolation status unavailable | The system could not read it; treat as unknown |
| `banner.weight.label` | Weight | The current dosing weight |
| `banner.weight.value` | {weight} ({source}, {date}) | `weight` is the number with its unit (for example `70 kg`), `source` one of the three source texts below, `date` the date measured. Reorder as the language needs; keep all three |
| `banner.weight.source.measured` | measured | Weight measured on a scale |
| `banner.weight.source.stated` | stated | Weight reported by the patient or family |
| `banner.weight.source.estimated` | estimated | Weight estimated by staff |
| `banner.weight.missing` | No dated weight | No usable dosing weight is recorded |
| `banner.dataUnavailable` | Patient banner data unavailable | Error state; clinical actions are disabled until data arrives |
| `patientContext.none` | No patient selected | The window holds no patient |
| `patientContext.close` | Close patient | Control that empties the window's patient context; at most 30 characters |
| `patientContext.switch.title` | Change patient? | Title of the switch confirmation |
| `patientContext.switch.body` | This window holds one patient. Opening another patient replaces the current one. | Explains the replacement; the two patients are shown below it by the component |
| `patientContext.switch.current` | Current patient | Heading over the patient now open |
| `patientContext.switch.requested` | Patient to open | Heading over the requested patient |
| `patientContext.switch.confirm` | Open this patient | Confirms the switch; at most 30 characters |
| `patientContext.switch.cancel` | Keep current patient | The safe choice; at most 30 characters |
| `patientContext.switch.blockedByModal` | Finish or cancel the open dialog before changing patient. | Shown when a switch is requested while a dialog is open |
| `patientContext.clearedByUserChange` | The patient was closed because the user changed. | Shown after a badge tap or sign-in by another user |
| `sign.title` | Sign | Title of the sign dialog |
| `sign.cosign.title` | Co-sign | Title of the co-sign dialog; a second clinician countersigns |
| `sign.review.heading` | Review before signing | Heading of the review step |
| `sign.intent.author` | I am the author of this entry and I sign it. | Legal intent statement of the author; wording to be reviewed by HIM |
| `sign.intent.cosign` | I have reviewed this entry and I co-sign it. | Legal intent statement of the co-signer; wording to be reviewed by HIM |
| `sign.action` | Sign | Signs; at most 20 characters |
| `sign.cosign.action` | Co-sign | Co-signs; at most 20 characters |
| `sign.cancel` | Cancel | Leaves without signing; at most 20 characters |
| `sign.authenticate.heading` | Confirm it is you | Heading of the authentication step |
| `sign.authenticate.simulated` | Simulated sign-in (demonstration only) | Demo builds only, until the Trust Plane exists |
| `sign.reverify.title` | Confirm the patient | Heading of the re-verification step |
| `sign.reverify.reason` | {windowSeconds, plural, one {The patient in this window changed in the last # second. Check that this is the right patient before you sign.} other {The patient in this window changed in the last # seconds. Check that this is the right patient before you sign.}} | `windowSeconds` is the re-verification window (60 unless a hospital lengthens it) |
| `sign.reverify.confirm` | This is the right patient | Confirms the patient's identity; at most 40 characters |
| `sign.reverify.reject` | Not this patient | Cancels signing; at most 40 characters |
| `sign.refused.reverify` | Signing was refused. Confirm the patient again. | Server refusal; nothing was signed |
| `sign.done` | Signed | Status after a successful signature |
| `sign.failed` | Not signed. Nothing was saved. | Signing failed for another reason |
| `commandPalette.open.label` | Open command palette | Accessible name of the button that opens the palette |
| `commandPalette.dialog.label` | Command palette | Accessible name of the palette dialog |
| `commandPalette.search.label` | Search commands | Accessible name of the search field |
| `commandPalette.search.placeholder` | Type a command or search | Placeholder in the search field; at most 40 characters |
| `commandPalette.noResults` | No matching commands | Shown when nothing matches |
| `commandPalette.resultCount` | {count, plural, one {# result} other {# results}} | Announced to screen readers; `count` may be 0 |
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
| `hal.reason.noShell` | Open this workspace in the HMS workstation app to use devices. | No shell present (plain browser) |
| `hal.reason.notImplemented` | This device function is not available in this version. | The call is not built yet |
| `hal.reason.noDevice` | No device of this kind is connected. | — |
| `hal.reason.capabilityNotGranted` | Ask your administrator if you need this device here. | — |
| `hal.reason.invalidRequest` | The request did not match what the device expects. | — |
| `hal.reason.unsupportedFormat` | The device cannot handle this format. | — |
| `hal.reason.unknownDevice` | The selected device is not known to this workstation. | — |
| `hal.reason.deviceOffline` | The device is offline. | — |
| `hal.reason.mediaOut` | The device is out of paper or labels. | Printers |
| `hal.reason.deviceFault` | The device reported a fault. | — |
| `hal.reason.deviceTimeout` | The device did not answer. | — |
| `hal.reason.userTimeout` | Nothing was received in time. | The user did not present a card, document or signature in time |
| `hal.reason.userCancelled` | You cancelled. | — |
| `hal.sign.prompt.consent` | Sign below to confirm your consent. | Prompt on the signature pad; the consent form itself is versioned content |
| `hal.sign.prompt.receipt` | Sign below to confirm receipt. | Prompt on the signature pad |
| `hal.sign.prompt.document` | Sign below. | Prompt on the signature pad |

Code-status, isolation and allergy-substance labels are not catalogue keys: they come with the governed content that defines them, in three languages (§2.1, OQ-new-4).

## 11. Not built in WP-0.7, decisions and open questions
