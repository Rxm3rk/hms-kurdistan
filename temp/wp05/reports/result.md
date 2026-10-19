# WP-0.5 phase 2 report: result (`:modules:results`, `hms.results.domain.result`)

Status: IN PROGRESS. Code written; waiting for the harness API change (harness-fixes.md) before the verifying Gradle run.
All results: Windows host, not evidence of record.

## Files (all new, all in the worktree)
- backend/modules/results/src/main/kotlin/hms/results/domain/result/ResultFacts.kt
- backend/modules/results/src/main/kotlin/hms/results/domain/result/ResultGuards.kt
- backend/modules/results/src/test/kotlin/hms/results/domain/result/ResultGuardsTest.kt
- backend/modules/results/src/test/kotlin/hms/results/ArchitectureTest.kt
- backend/modules/results/src/testFixtures/kotlin/hms/results/domain/result/ResultSamples.kt
- backend/modules/results/src/testFixtures/kotlin/hms/results/domain/result/ResultArbs.kt
- backend/modules/results/src/propertyTest/kotlin/hms/results/domain/result/ResultPropertyTest.kt
- Regenerated (not hand-edited): ResultMachine.kt, ResultGeneratedPropertyTest.kt

## Spec changes (re-review needed)
result.yaml, regenerated with `sh tools/hms statemachines generate --machine result`:
1. specimenUsable: "a value from a reference laboratory must also carry that laboratory's own specimen reference (a missing one makes this false)" (was "carries", not stated as fail-closed).
2. qcAllowsRelease: current analyser QC "(valid from at or before now, valid until after now)" (was "valid until after now").
3. privilegedAndAudited: audit context names "the version acted on, which is the result's current version, or none when no version has been filed yet" (MarkEnteredInError from registered was otherwise unsatisfiable: a registered result has no version).
result.md: one sentence added under "Releasing a result" on the reference laboratory's own specimen reference.

## kotlin.Result
No declaration is named `Result`. Every type has the prefix plus a suffix (ResultFacts, ResultGuards, ResultValue, ...). No file uses kotlin.Result or runCatching, so nothing is shadowed and no import or qualification was needed.

## Decisions taken (implementation readings), and why
- Facts are what the aggregate will know at the command (spec §3.1). Another module's answers are modelled as answers, and the guard checks they are for the right subject: the validation privilege names the user and the test's laboratory section; the action privilege names the user and the result; the reg-lis-rules verdict names the version; the Register entry names the function, the function version and the jurisdiction.
- Per-value provenance (`ValueChange`: new measurement, changed without new measurement, carried unchanged) and per-value performer (`Performer.InHouse` with run QC and current analyser QC, or `Performer.ReferenceLaboratory` with its identification and own specimen reference). A withdrawn value is absent from the version, so a version that only withdraws values has nothing for the specimen and QC checks (qcAllowsRelease text, DN-055 item 6).
- Fail-closed unknowns, as the descriptions say: missing version, validation, privilege answer, audit context, QC record, QC validity times, specimen reference or specimen state, encounter link or class, verdict, Register entry or opinion all make the positive predicate false. `criticalValueFlagged` is true when there is no version (it only matters for totality; every guard that uses it also needs a version).
- Exact-complement pairs are literal negations of one private function each (`everyValueEvaluatedNotCritical`, `isDischarged`). `isDischarged` is an exhaustive `when` over the encounter class enum, so a class added later does not compile until someone decides it; ADT values this build does not know map to `UNKNOWN` (discharged, fails closed).
- Time windows: validation recorded at or after the last value change and not after now (both ends inclusive); QC "covers t" = valid from <= t < valid until (validity ending exactly at t is overdue); audit time not after now; opinion not expired = now < expiresAt (expiry exactly now is expired).
- Reasons: three slots (correction, cancellation, entered in error), one per governed list; a reason counts only with a non-blank code in that list's governed codes and selection USER_SELECTED; text alone never counts.
- autoverificationActive additionally refuses a blank running function version or tenant jurisdiction (unknown fails closed). "Lies within the scope" is implemented as membership of the full test tuple (section, analyte, specimen type, method, analyser) in the opinion's scope set (the strictest reading).
- autoverificationRulesPassed: "every rule of the §9.8 stack in order" = the verdict's list of rules run equals the eight rules in their §9.8 order.
- kotlin.Result: no declaration named `Result`; nothing uses kotlin.Result.

## Proposed DN items (for the integrator to add to DN-055, lab CSO and physician panel)
- DN-055 item 15 (specimenUsable deny-list vs allow-list). The description is a deny-list: a value is usable unless its specimen is rejected, lost, cancelled, entered-in-error or unknown. So a value on a specimen the LIS still shows as `ordered`, `label-printed`, `collected` or `in-transit` (an impossible measurement, or a stale LIS answer) counts as usable, and so does `disposed`. Options: (a) keep the deny-list (current default, as written); (b) an allow-list: received, in-process, resulted, stored, disposed only. (b) is stricter and refuses only on inconsistent data. Default used: (a), exactly as the reviewed text says.
- DN-055 item 16 (scope of an autoverification opinion). Default used: exact membership of the whole test tuple. Alternative: scope expressed by section/analyser patterns (needs a format the Register does not yet have).
- DN-055 item 17 (current analyser QC validity start). Spec edited to require "valid from at or before now" for the current QC (stricter; refuses only on a QC record that starts in the future). Alternative: the original "valid until after now" only.

## Proposed OQ / KA
- OQ (result, panels): the facts carry one `TestIdentity` per result (the description's "the result's test"). A panel whose values come from several analysers or methods has no single tuple; autoverification scope and the validation privilege's laboratory section would then need a per-value test identity. Proposed: decide in WP-1.7 with the catalogue.
- KA (result): the facts are assembled by no real aggregate yet; the property tests draw them from `ResultArbs`. The cross-machine property "no version holding a value from an unusable specimen is ever filed" is proved here against the specimen state as a fact only, not against the specimen machine's actual state (same pattern as KA-062).
