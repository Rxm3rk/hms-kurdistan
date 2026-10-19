# WP-0.5 phase 2 report: medication-administration

Slice: the Kotlin of `medication-administration` (`hms.medications.domain.medicationadministration`, `:modules:medications`)
plus `:modules:medications`'s ArchitectureTest. Resumed after the 08:03 cut-off: at start only the two generated files
existed; everything below was written in this session. All results: Windows host, not evidence of record.

## Files (all new unless noted)

backend/modules/medications/
- src/main/kotlin/hms/medications/domain/medicationadministration/MedicationAdministrationFacts.kt (facts and their groups)
- src/main/kotlin/.../MedicationAdministrationValues.kt (small value types: order state, verification status, scans,
  labels, supplies, quantities, reasons, connectivity mode)
- src/main/kotlin/.../MedicationAdministrationGuards.kt (`object MedicationAdministrationGuards`, the only implementation)
- src/main/kotlin/.../MedicationAdministrationMachine.kt (REGENERATED after the spec edits below; not hand-edited)
- src/propertyTest/kotlin/.../MedicationAdministrationGeneratedPropertyTest.kt (regenerated, header SHA only)
- src/test/kotlin/.../MedicationAdministrationGuardsTest.kt (unit tests, every predicate holds/fails, boundaries)
- src/test/kotlin/hms/medications/ArchitectureTest.kt (copy of platform/testing's, package hms.medications)
- src/testFixtures/kotlin/.../MedicationAdministrationSamples.kt (synthetic SYN- base facts, shared by tests and Arbs)
- src/testFixtures/kotlin/.../MedicationAdministrationArbs.kt (scenario + independent aspects + perturbations)
- src/propertyTest/kotlin/.../MedicationAdministrationPropertyTest.kt (14 tests, machine-level safety properties)

docs/specs/state-machines/medication-administration.yaml: three predicate descriptions edited (below); regenerated.
(build.gradle.kts untouched; the integrator had already switched it to testFixturesApi.)

## Spec changes (need re-review; predicates' descriptions only, no structural change; new SHA 871bf90b...)

Each makes an ambiguous safety-relevant description precise in the STRICTER direction, as implemented:
1. `wristbandScanUnusable`: "False when any wristband scan in the dose's scan log (this command's included) decoded an MRN
   that the identity service does not confirm, with a valid check digit, as this patient's: another patient's MRN, or
   one it gives no answer for". Before: "decoded another patient's MRN". An unconfirmed MRN now blocks the wristband
   override too.
2. `firstDoseOfOrder`: appended "false when that read cannot be made (an unknown fails)".
3. `patientSuppliedCleared` (a): "a dispense record for this patient and this order that lists the scanned product and,
   when the scanned label is a pharmacy or in-house label, is the record that label names". Before: "named by the
   scanned label OR listing the scanned product".
The .md was not changed (its DN-053 items stay accurate at their level of detail).

## Readings taken in the Kotlin (no spec change; listed for the safety review)

- Order predicates read `OrderState` (order.yaml's 7 states) and `VerificationStatus` (pending, returned, verified); an
  unknown value (null) fails every order predicate; the order's patient must equal the dose's patient.
- `productIdentityMatches`: product membership by brand-master product id (a different drug/form/route/strength is a
  different product id). The clinical date is the issue time in the facility zone (a test pins Erbil time: 22:30 UTC is
  the next day). A KNOWN expiry with an UNKNOWN clinical time fails (unknown fails); an unknown expiry passes (DN-053
  item 2). Logged scans are re-evaluated against the current order facts.
- `infusionContentMatchesOrder`: a scanned pharmacy (dispense) label takes the content from its dispense record (a
  compounded bag), otherwise the brand master's labelled content; exact equality of amount and volume, or of a
  concentration, in the same unit string; amount-in-volume never equals a concentration (no arithmetic).
- `administeredAmountMatchesOrder` / `sameQuantity`: exact `BigDecimal.compareTo == 0` (5 = 5.00) with an identical,
  case-sensitive UCUM unit string; 0.005 g against 5 mg fails; no conversion.
- `highAlertCheckSatisfied`: high-alert when the orderable flag is set or unknown, or the identified product's formulary
  flag is set or unknown (a product missing from the formulary counts as high-alert). Valid check: same dose; checker
  != administering user, authenticated (badge and PIN), privileged, attested; names the scanned product AND lot (lot
  compared including "no lot"), or on the scan override the named supply; recorded strictly after the scan, not after
  the command, and at most the window before it (window end inclusive); window null or negative fails.
- `clinicalTimeContemporaneous`: a NEGATIVE governed skew allowance fails (configuration error); null allowance = zero.
- `wristbandScanUnusable`: a scan from a location label, an invalid check digit or an unanswered MRN on the command is
  NOT "unusable" (the listed causes are: none read, unreadable, merged/retired MRN of this patient); a merged MRN must
  also have a valid check digit.
- `patientSuppliedCleared`: a relabel must name this patient AND the item must be this patient's, administrable, and of
  the scanned product.
- `privilegedAndAudited`: also requires an authenticated principal; unknown requirement fails.
- Reasons (`overrideReasonEntered`, `notDoneReasonValid`, back-entry reason, `errorReasonEntered`) require the channel's
  "chosen" mark and `enteredBy` == the acting user; not-done codes are exactly held, refused, missed, npo, off-unit.
- `lateDoseWindowElapsed` reads `context.receivedAt` as the clock reading; strictly after due + window.

## Commands and results (Windows host, not evidence of record)

1. `sh tools/hms statemachines check --machine medication-administration --json` (before spec edits): PASS, 13 rules,
   errors [].
2. `sh tools/hms statemachines generate --machine medication-administration`: PASS, generated_files_written=2.
3. `sh tools/hms statemachines check --machine medication-administration --json` (after edits and new tests): PASS, ok.
4. Gradle run 1 (`:modules:medications:ktlintFormat test propertyTest detekt ktlintCheck verifyArchitectureTest
   -Phms.pbt.sequences=1000 --continue`): FAILED on (a) compileTestKotlin: 2 "unnecessary safe call" warnings (-Werror)
   in GuardsTest; (b) detekt: TooManyFunctions (PropertyTest file), SpreadOperator x12, CyclomaticComplexMethod
   (Arbs.perturbDoubleCheck = 15); (c) ktlintCheck ran before ktlintFormat in the same invocation (all findings were
   autocorrectable; format then applied them). propertyTest PASSED: generated test 1/1 (P1-P7, 20/20 transitions,
   1000 sequences, 16,920 steps, 1,699 fired, 0 ambiguous; min firings 18 for transition 3), PropertyTest 14/14.
   All fixed after run 1.
5. Gradle run 2 (`test propertyTest detekt ktlintCheck verifyArchitectureTest -Phms.pbt.sequences=1000 --continue`):
   RESULT PENDING (see below).

## Open points, proposed DN/OQ/KA text

(see final section, being completed)
