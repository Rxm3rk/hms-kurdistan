# WP-0.5 phase 2: specimen (`hms.lis.domain.specimen`, `:modules:lis`)

Status: code complete; Gradle verification in progress (see "Runs"). Windows host, not evidence of record.

## Files (all new unless noted)
- backend/modules/lis/src/main/kotlin/hms/lis/domain/specimen/SpecimenFacts.kt
- backend/modules/lis/src/main/kotlin/hms/lis/domain/specimen/SpecimenGuards.kt
- backend/modules/lis/src/main/kotlin/hms/lis/domain/specimen/SpecimenMachine.kt (regenerated after the spec edits)
- backend/modules/lis/src/propertyTest/kotlin/hms/lis/domain/specimen/SpecimenGeneratedPropertyTest.kt (regenerated)
- backend/modules/lis/src/test/kotlin/hms/lis/domain/specimen/SpecimenGuardsTest.kt
- backend/modules/lis/src/test/kotlin/hms/lis/ArchitectureTest.kt (copy of the platform template, package hms.lis)
- backend/modules/lis/src/testFixtures/kotlin/hms/lis/domain/specimen/SpecimenSamples.kt
- backend/modules/lis/src/testFixtures/kotlin/hms/lis/domain/specimen/SpecimenArbs.kt
- backend/modules/lis/src/propertyTest/kotlin/hms/lis/domain/specimen/SpecimenPropertyTest.kt
- docs/specs/state-machines/specimen.yaml and specimen.md (minimal edits, below)

## Spec changes (need re-review)
1. caveatAllowedForSpecimen: now also requires "an acceptability check was recorded at or after receipt and the specimen has at least one eligible test, as in acceptableForEveryTest". Without it an irreplaceable specimen could be accepted with a caveat with no acceptability check at all (notAcceptableForEveryTest holds when no check exists).
2. allTestsFinished: "A specimen that serves no test has not finished (fails closed)" (was vacuously true).
3. notTransfusionSample: "an unknown flag, or a specimen that serves no test, counts as a transfusion sample".
4. retentionNotRequired: "an unknown retention rule, or a specimen that serves no test, counts as required".
5. retentionElapsed: "an unknown period, or a specimen that serves no test, never elapses".
specimen.md: matching sentences in "Accept with caveat" and "Mark resulted". Regenerated with `sh tools/hms statemachines generate --machine specimen` (sha256 86c027c8f4724c14929cc5e876eb4da13260cbd888291ccd645bea95a9062ea9).

## Runs (Windows host, not evidence of record)
1. `sh tools/hms statemachines generate --machine specimen`: PASS (transitions=24, predicates=37, effects=14, generated_files_written=2).
2. `sh tools/hms statemachines check --machine specimen --json`: PASS, ok=true, errors=[] (all 13 rules).
3. `sh .../gradle.sh :modules:lis:ktlintFormat --console=plain` (11:48, after 43 min waiting for a slot): formatted main, test, testFixtures; FAILED on propertyTest (parse error from a bad edit of mine: escaped quotes). Fixed.
4. Batched run started ~12:00: ktlintFormat test propertyTest detekt ktlintCheck verifyArchitectureTest -Phms.pbt.sequences=1000 --continue (result pending).

## Readings the Kotlin takes (each the stricter one; for the second review)
- "The wristband scan read for this command" = the last wristband read of the bedside session; the session's identification (its start, for collectionTimeRecorded and labelledAtBedside) = its first read that decoded an MRN, which must be the specimen patient's, or, when no band decoded, the active two-identifier check. A session opened by another patient's band identifies nobody here.
- The session itself (which reads belong to it) is delimited by the device's session layer as the YAML defines it (ends on another band, another patient, or close). The facts carry it; the guards do not rebuild it from a device event log.
- labelledAtBedside: "after" is strictly after (a label scanned at the identification instant does not count).
- Time windows include both ends: collection time in [session start, recording time]; stability limit (elapsed <= limit); downtime episode [start, end] (open end = still running); retention elapsed at storedAt + longest period.
- Unknown order state: counts as eligible for acceptability (must pass its criteria) and as open for recollection (a task is raised). Unknown patientCollected flag: not patient-collected (no earlier stated time). Unknown irreplaceable flag or waivable list: not irreplaceable, nothing waivable.
- Volumes in different units fail the volume criterion (no conversion, SI-05 spirit). HIL and clotting are integer grades compared with the governed per-test maximum (recorded <= maximum).
- The "label or identity criterion" of caveatAllowedForSpecimen is the "label matched at receipt" criterion (LABEL); it is never waived.
- noUsableWristband reads the same record as identityOverrideReasonChosen (the user's no-wristband / unreadable record); the chosen mark is read only by the latter.
- accessionFromPermittedSource: online needs only the cell's issuance record (the description asks no reuse check online); offline needs the number in a site-prefixed block assigned to the command's device and absent from the used-number ledger. downtimeLabelConfirmed (no existing accession): any site-prefixed downtime block (the description does not tie it to a device).
- Reprint, caveat and entered-in-error reasons are strings: the spec gives no coded list for reprint or caveat reasons (governed, [HUMAN]); the error reason must be in the governed list supplied with the facts (unknown list fails).
- No money facts exist in SpecimenFacts (SI-12: nothing to show unread).

## Proposed DN / OQ / KA text (for the integrator)
- DN-054 addendum (lab CSO), options and default used: (a) [default] the five "serves no test" and "caveat needs a recorded check" readings above; (b) vacuous truth for a specimen that serves no test (allows MarkResulted, direct disposal and the override for such a specimen). Default (a): fails closed and keeps the specimen visible as open work.
- DN-054 addendum (lab CSO): labelledAtBedside "after": (a) [default] strictly after; (b) at or after (same clock tick). Default (a).
- OQ (lis, WP-1.7): governed coded lists for reprint reasons and caveat reasons (today free strings, chosen and non-blank); the HIL/clotting grading scale (integer grades assumed).
- KA (new, or extend KA-062): the bedside session boundary rule (a session ends on another band, another patient, or close) is assumed to be enforced by the device session layer that assembles SpecimenFacts; no such layer exists yet, so the guards trust the session they are given.

## Arbs and coverage design
SpecimenArbs: 92 % of draws use a "good" profile (every main-path aspect holds, wristband 65 % / override 35 %, acceptability all 70 % / some 25 % / none 5 %, results clean 65 % / recollection 35 %); 8 % set each aspect independently (about 80 % ok, otherwise one of several refusal or edge breakers). Ending aspects in both profiles: orders ended 3 %, rejection reason chosen 9 % (half label defects), loss declared 10 %, entered-in-error privilege 10 % x governed reason 10 %, back-entry 40 %, caveat privilege 60 %. A Python simulation of the abstract machine (gen-scratch/specimen-sim/tune.py, 60 seeds x 1,000 sequences) gave every transition a mean of at least 13 firings (weakest: stored -> lost, mean 13, min 5).
