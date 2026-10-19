package hms.results.domain.result

import hms.kernel.statemachine.Outcome
import hms.kernel.statemachine.Transition
import hms.kernel.testing.statemachine.RunStats
import hms.kernel.testing.statemachine.SequenceConfig
import hms.kernel.testing.statemachine.Step
import hms.kernel.testing.statemachine.StepCheck
import hms.kernel.testing.statemachine.runSequences
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldContainAll
import io.kotest.matchers.collections.shouldNotContain
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import java.time.Instant

// No declaration here or in the package is named `Result`: every type carries the prefix with a suffix (ResultFacts,
// ResultState, ...), so kotlin.Result is never shadowed, and this file never uses kotlin.Result.

private typealias ResultStep = Step<ResultState, ResultCommand, ResultPredicate, ResultEffect, ResultFacts>
private typealias ResultCheck = StepCheck<ResultState, ResultCommand, ResultPredicate, ResultEffect, ResultFacts>

/** Commands that file a version to clinicians (result.md "Releasing a result"). */
private val FILING: Set<ResultCommand> =
    setOf(
        ResultCommand.ReleasePreliminary,
        ResultCommand.RevisePreliminary,
        ResultCommand.ReleaseFinal,
        ResultCommand.Autoverify,
        ResultCommand.Amend,
        ResultCommand.Correct,
    )

/** Commands that replace a version clinicians may have acted on (result.md "Corrections"). */
private val CORRECTIONS: Set<ResultCommand> = setOf(ResultCommand.RevisePreliminary, ResultCommand.Amend, ResultCommand.Correct)

/** The specimen states the oracle accepts: every state of the specimen machine except the four unusable ones. */
private val ORACLE_USABLE_SPECIMEN: Set<SpecimenStatus> =
    SpecimenStatus.entries.toSet() -
        setOf(
            SpecimenStatus.REJECTED,
            SpecimenStatus.LOST,
            SpecimenStatus.CANCELLED,
            SpecimenStatus.ENTERED_IN_ERROR,
            SpecimenStatus.UNKNOWN,
        )

private val ORACLE_ACTIVE_ENCOUNTER: Set<EncounterStatus> =
    setOf(EncounterStatus.PLANNED, EncounterStatus.ARRIVED, EncounterStatus.TRIAGED, EncounterStatus.IN_PROGRESS, EncounterStatus.ON_LEAVE)

private val holds: (ResultPredicate, ResultFacts) -> Boolean = { predicate, facts -> ResultMachine.holds(predicate, ResultGuards, facts) }

private fun indexesOf(filter: (Transition<ResultState, ResultCommand, ResultPredicate, ResultEffect>) -> Boolean) =
    ResultMachine.spec.transitions
        .filter(filter)
        .map { it.index }

private fun run(
    name: String,
    checks: List<ResultCheck>,
): RunStats = runSequences(name, ResultMachine.spec, holds, ResultArbs.facts, SequenceConfig(), checks)

private fun RunStats.requireAllFired(indexes: List<Int>) = indexes.forEach { requireFired(it) }

private val ResultStep.firedTransition get() = (outcome as? Outcome.Fired)?.transition

private val ResultStep.effects: List<ResultEffect> get() = firedTransition?.effects.orEmpty()

private fun ResultStep.firedFiling(): Boolean = firedTransition != null && command in FILING

private fun ResultStep.applicable(): Boolean = ResultMachine.spec.candidates(from, command).isNotEmpty()

// --- Independent oracles: each re-reads the raw facts and does not call ResultGuards. ---------------------------------

private fun ResultFacts.newOrChangedValues(): List<ResultValue> =
    versionBeingFiled?.values.orEmpty().filter { it.change != ValueChange.CARRIED_UNCHANGED }

/** Some specimen behind a new or changed value is unusable or unknown, or a reference laboratory's reference is missing. */
private fun ResultFacts.oracleUnusableSpecimen(): Boolean =
    versionBeingFiled == null ||
        newOrChangedValues().any { value ->
            val id = value.specimenId
            val ownUsable = !id.isNullOrBlank() && specimens[id] in ORACLE_USABLE_SPECIMEN
            val performer = value.performer
            val referenceMissing = performer is Performer.ReferenceLaboratory && performer.laboratorySpecimenRef.isNullOrBlank()
            !ownUsable || referenceMissing
        }

/** Some QC behind a new or changed value has failed, is unknown, missing or overdue. */
private fun ResultFacts.oracleQcBlocks(): Boolean =
    versionBeingFiled == null ||
        newOrChangedValues().any { value ->
            when (val performer = value.performer) {
                is Performer.ReferenceLaboratory -> {
                    performer.laboratoryId.isNullOrBlank()
                }

                is Performer.InHouse -> {
                    val runBad = !covers(performer.runQc, performer.measuredAt)
                    val currentBad = value.change == ValueChange.NEW_MEASUREMENT && !covers(performer.currentAnalyserQc, now)
                    runBad || currentBad
                }
            }
        }

private fun covers(
    qc: QcRecord?,
    instant: Instant,
): Boolean {
    val from = qc?.validFrom
    val until = qc?.validUntil
    return qc?.status == QcStatus.PASSED && from != null && until != null && from <= instant && instant < until
}

/** Some value of the version is critical, not evaluated or marked critical; no version counts as critical. */
private fun ResultFacts.oracleCritical(): Boolean =
    versionBeingFiled?.values?.any {
        it.markedCriticalByTechnologist ||
            (it.criticalVerdict != CriticalVerdict.NOT_CRITICAL && it.criticalVerdict != CriticalVerdict.NO_CRITICAL_LIMITS)
    } ?: true

/** Not discharged only when positively known; everything else counts as discharged (DN-055 item 8). */
private fun ResultFacts.oracleDischarged(): Boolean {
    val link = encounter
    val knownNotDischarged =
        link == EncounterLink.NoEncounterRecorded ||
            (link is EncounterLink.Resolved && link.encounterClass == EncounterClass.OUTPATIENT) ||
            (
                link is EncounterLink.Resolved &&
                    link.encounterClass in setOf(EncounterClass.INPATIENT, EncounterClass.EMERGENCY, EncounterClass.DAY_CASE) &&
                    link.status in ORACLE_ACTIVE_ENCOUNTER
            )
    return !knownNotDischarged
}

/** The Register allows autoverification for this result's test, read from the raw facts (SI-18 clauses a to d). */
private fun ResultFacts.oracleRegisterAllows(): Boolean {
    val auto = autoverification
    val entry = auto.registerEntry ?: return false
    val opinion = entry.opinion
    val expiresAt = opinion?.expiresAt
    return auto.tenantFlagOn &&
        entry.function == "reg-lis-rules" &&
        entry.status in setOf(RegisterStatus.CLEARED, RegisterStatus.NOT_REQUIRED) &&
        entry.functionVersion == auto.runningFunctionVersion &&
        entry.jurisdiction == auto.tenantJurisdiction &&
        opinion != null &&
        !opinion.documentRef.isNullOrBlank() &&
        expiresAt != null &&
        now < expiresAt &&
        test in opinion.scope &&
        opinion.intendedPurpose == OpinionPurpose.RELEASE_OF_RESULTS_BY_AUTOVERIFICATION &&
        opinion.validatedRuleSetVersion != null &&
        opinion.validatedRuleSetVersion == auto.verdict?.ruleSetVersion
}

/**
 * The result machine's own properties (docs/specs/state-machines/result.yaml, result.md; spec §3.3), beside the
 * generated P1 to P7: hazards H3 and HAZ-0040 (no filing from an unusable specimen; every correction reaches the people
 * who saw the earlier version), SI-03, SI-04, SI-17 and SI-18. Each runs [runSequences] at the configured budget with
 * independent oracles over the raw facts, and requires the transitions it is about to have fired.
 */
class ResultPropertyTest :
    FunSpec({
        val filingTransitions = indexesOf { it.on in FILING }

        test("HAZ-0040 (result): result-no-filing-from-unusable-specimen: no version is filed while a specimen is unusable or unknown") {
            val stats =
                run(
                    "result-no-filing-from-unusable-specimen",
                    listOf(
                        ResultCheck(
                            name = "a filing command with an unusable or unknown specimen is never fired",
                            appliesTo = { it.command in FILING && it.applicable() && it.facts.oracleUnusableSpecimen() },
                            check = { step -> step.firedTransition shouldBe null },
                        ),
                        ResultCheck(
                            name = "every fired filing had every specimen behind a new or changed value usable",
                            appliesTo = { it.firedFiling() },
                            check = { step -> step.facts.oracleUnusableSpecimen() shouldBe false },
                        ),
                    ),
                )
            stats.requireAllFired(filingTransitions)
        }

        test("HAZ-0040 (result): every filing transition is guarded by specimenUsable and qcAllowsRelease") {
            ResultMachine.spec.transitions.filter { it.on in FILING }.forEach { transition ->
                withClue("transition ${transition.index}") {
                    transition.guard shouldContainAll listOf(ResultPredicate.SPECIMEN_USABLE, ResultPredicate.QC_ALLOWS_RELEASE)
                }
            }
        }

        test("HAZ-0040 (result): result-every-correction-notifies-orderer-and-acknowledgers") {
            val stats =
                run(
                    "result-every-correction-notifies-orderer-and-acknowledgers",
                    listOf(
                        ResultCheck(
                            name = "a correction supersedes, updates critical-result communications and notifies, with a chosen reason",
                            appliesTo = { it.firedTransition != null && it.command in CORRECTIONS },
                            check = { step ->
                                step.effects shouldContainAll
                                    listOf(
                                        ResultEffect.SUPERSEDE_EARLIER_VERSION,
                                        ResultEffect.UPDATE_CRITICAL_RESULT_COMMUNICATIONS,
                                        ResultEffect.NOTIFY_ORDERER_AND_ACKNOWLEDGERS,
                                    )
                                step.holding shouldContain ResultPredicate.CORRECTION_REASON_ENTERED
                            },
                        ),
                        ResultCheck(
                            name = "a final after a preliminary supersedes it and tells its acknowledgers and critical-result recipients",
                            appliesTo = {
                                it.firedTransition != null && it.command == ResultCommand.ReleaseFinal && it.from == ResultState.PRELIMINARY
                            },
                            check = { step ->
                                step.effects shouldContainAll
                                    listOf(
                                        ResultEffect.SUPERSEDE_EARLIER_VERSION,
                                        ResultEffect.UPDATE_CRITICAL_RESULT_COMMUNICATIONS,
                                        ResultEffect.NOTIFY_ACKNOWLEDGERS_OF_FINAL,
                                    )
                            },
                        ),
                        ResultCheck(
                            name = "a cancellation or entered-in-error notifies the orderer and acknowledgers",
                            appliesTo = {
                                it.firedTransition != null && it.command in setOf(ResultCommand.Cancel, ResultCommand.MarkEnteredInError)
                            },
                            check = { step -> step.effects shouldContain ResultEffect.NOTIFY_ORDERER_AND_ACKNOWLEDGERS },
                        ),
                        ResultCheck(
                            name = "withdrawing a released version closes its open critical-result communications",
                            appliesTo = {
                                it.firedTransition != null &&
                                    (
                                        it.command == ResultCommand.MarkEnteredInError ||
                                            (it.command == ResultCommand.Cancel && it.from == ResultState.PRELIMINARY)
                                    )
                            },
                            check = { step -> step.effects shouldContain ResultEffect.UPDATE_CRITICAL_RESULT_COMMUNICATIONS },
                        ),
                    ),
                )
            stats.requireAllFired(
                indexesOf {
                    it.on in CORRECTIONS ||
                        it.on == ResultCommand.Cancel ||
                        it.on == ResultCommand.MarkEnteredInError ||
                        (it.on == ResultCommand.ReleaseFinal && ResultState.PRELIMINARY in it.from)
                },
            )
        }

        test("SI-04 (result): every filed critical value goes to the critical-result service, and no other filing does") {
            val stats =
                run(
                    "SI-04-result-critical-value-handed-to-critical-result-service",
                    listOf(
                        ResultCheck(
                            name = "a filing hands values to the critical-result service exactly when a value is critical or not evaluated",
                            appliesTo = { it.firedFiling() },
                            check = { step ->
                                val handed = ResultEffect.HAND_TO_CRITICAL_RESULT_SERVICE in step.effects
                                val critical = step.facts.oracleCritical()
                                withClue("critical by the oracle: $critical") { handed shouldBe critical }
                            },
                        ),
                        ResultCheck(
                            name = "autoverification never releases a critical or not-evaluated value",
                            appliesTo = { it.command == ResultCommand.Autoverify && it.applicable() && it.facts.oracleCritical() },
                            check = { step -> step.firedTransition shouldBe null },
                        ),
                    ),
                )
            stats.requireAllFired(filingTransitions)
        }

        test("SI-17 (result): SI-17-result-for-discharged-patient-goes-to-owned-queue") {
            val stats =
                run(
                    "SI-17-result-for-discharged-patient-goes-to-owned-queue",
                    listOf(
                        ResultCheck(
                            name = "a filing goes to the discharged-patient queue exactly when the patient is discharged or unknown",
                            appliesTo = { it.firedFiling() },
                            check = { step ->
                                (ResultEffect.ROUTE_TO_DISCHARGED_PATIENT_QUEUE in step.effects) shouldBe step.facts.oracleDischarged()
                            },
                        ),
                    ),
                )
            stats.requireAllFired(filingTransitions)
        }

        test("SI-17 (result): SI-17-pending-results-at-discharge-go-to-owned-queue") {
            val pending = setOf(ResultState.REGISTERED, ResultState.PRELIMINARY)
            val stats =
                run(
                    "SI-17-pending-results-at-discharge-go-to-owned-queue",
                    listOf(
                        ResultCheck(
                            name = "a discharge notice queues a pending result in the pending-at-discharge queue and keeps its state",
                            appliesTo = {
                                it.command == ResultCommand.RecordPatientDischarged && it.from in pending && it.facts.oracleDischarged()
                            },
                            check = { step ->
                                step.outcome.shouldBeInstanceOf<Outcome.Fired<*, *, *, *>>()
                                step.effects shouldContain ResultEffect.ROUTE_TO_PENDING_AT_DISCHARGE_QUEUE
                                step.outcome.state shouldBe step.from
                            },
                        ),
                    ),
                )
            stats.requireAllFired(indexesOf { it.on == ResultCommand.RecordPatientDischarged })
        }

        test("SI-18 (result): SI-18-activation-only-when-cleared-or-not-required") {
            val stats =
                run(
                    "SI-18-activation-only-when-cleared-or-not-required",
                    listOf(
                        ResultCheck(
                            name = "autoverification fires only when the Register allows this test, version, jurisdiction and rule set",
                            appliesTo = { it.firedTransition != null && it.command == ResultCommand.Autoverify },
                            check = { step -> step.facts.oracleRegisterAllows() shouldBe true },
                        ),
                    ),
                )
            stats.requireAllFired(indexesOf { it.on == ResultCommand.Autoverify })
        }

        test("SI-18 (result): SI-18-configuration-toggle-cannot-override-register") {
            val allowing = setOf(RegisterStatus.CLEARED, RegisterStatus.NOT_REQUIRED)
            run(
                "SI-18-configuration-toggle-cannot-override-register",
                listOf(
                    ResultCheck(
                        name = "with the tenant flag on and no Register entry, or one with another status, autoverification never fires",
                        appliesTo = {
                            val entry = it.facts.autoverification.registerEntry
                            it.command == ResultCommand.Autoverify &&
                                it.from == ResultState.REGISTERED &&
                                it.facts.autoverification.tenantFlagOn &&
                                (entry == null || entry.status !in allowing)
                        },
                        check = { step ->
                            step.firedTransition shouldBe null
                            step.holding shouldNotContain ResultPredicate.AUTOVERIFICATION_ACTIVE
                        },
                    ),
                ),
            )
        }

        test("SI-18 (result): SI-18-any-change-expires-the-opinion: a changed version, jurisdiction, scope or rule set stops it") {
            run(
                "SI-18-any-change-expires-the-opinion",
                listOf(
                    ResultCheck(
                        name = "an entry whose version, jurisdiction, scope or validated rule set differs never lets autoverification fire",
                        appliesTo = {
                            val auto = it.facts.autoverification
                            val entry = auto.registerEntry
                            val opinion = entry?.opinion
                            it.command == ResultCommand.Autoverify &&
                                it.from == ResultState.REGISTERED &&
                                entry != null &&
                                opinion != null &&
                                (
                                    entry.functionVersion != auto.runningFunctionVersion ||
                                        entry.jurisdiction != auto.tenantJurisdiction ||
                                        it.facts.test !in opinion.scope ||
                                        opinion.validatedRuleSetVersion != auto.verdict?.ruleSetVersion
                                )
                        },
                        check = { step -> step.firedTransition shouldBe null },
                    ),
                ),
            )
        }

        test("SI-03 (result): SI-03-owner-and-sla-on-every-work-item: every filing has an owner and every measurement is queued") {
            val stats =
                run(
                    "SI-03-result-owner-and-sla-on-every-work-item",
                    listOf(
                        ResultCheck(
                            name = "every filing routes the version to the responsible clinician's inbox",
                            appliesTo = { it.firedFiling() },
                            check = { step -> step.effects shouldContain ResultEffect.ROUTE_TO_RESPONSIBLE_CLINICIAN },
                        ),
                        ResultCheck(
                            name = "every measurement before final is queued for validation and keeps the state",
                            appliesTo = { it.firedTransition != null && it.command == ResultCommand.RecordMeasurement },
                            check = { step ->
                                step.effects shouldContain ResultEffect.QUEUE_FOR_VALIDATION
                                step.outcome.state shouldBe step.from
                            },
                        ),
                        ResultCheck(
                            name = "entered in error raises the owned review task",
                            appliesTo = { it.firedTransition != null && it.command == ResultCommand.MarkEnteredInError },
                            check = { step ->
                                step.effects shouldContainAll
                                    listOf(ResultEffect.MARK_EVERY_VERSION_ENTERED_IN_ERROR, ResultEffect.RESULT_ERROR_REVIEW_TASK_RAISED)
                            },
                        ),
                    ),
                )
            stats.requireAllFired(filingTransitions + indexesOf { it.on == ResultCommand.RecordMeasurement })
        }

        test("H3 (result): every manual filing is validated, of exactly that version, by the authenticated human who issues it") {
            run(
                "H3-result-manual-filing-validated-by-issuing-human",
                listOf(
                    ResultCheck(
                        name = "a fired filing other than autoverification has a human validator who is the acting user",
                        appliesTo = { it.firedFiling() && it.command != ResultCommand.Autoverify },
                        check = { step ->
                            val facts = step.facts
                            val user = facts.actingUser
                            user?.kind shouldBe AccountKind.HUMAN
                            user?.authenticated shouldBe true
                            facts.validation?.validatedBy shouldBe user?.userId
                            facts.validation?.versionId shouldBe facts.versionBeingFiled?.versionId
                        },
                    ),
                    ResultCheck(
                        name = "a system, integration or AI-agent account never files by validation",
                        appliesTo = {
                            it.command in FILING &&
                                it.command != ResultCommand.Autoverify &&
                                it.applicable() &&
                                it.facts.actingUser?.kind != AccountKind.HUMAN
                        },
                        check = { step -> step.firedTransition shouldBe null },
                    ),
                ),
            ).requireAllFired(indexesOf { it.on in FILING && it.on != ResultCommand.Autoverify })
        }

        test("H3 (result): no filing while QC has failed, is unknown or overdue (§9.8 acceptance 2)") {
            run(
                "H3-result-qc-lockout",
                listOf(
                    ResultCheck(
                        name = "a filing command whose QC blocks it is never fired",
                        appliesTo = { it.command in FILING && it.applicable() && it.facts.oracleQcBlocks() },
                        check = { step -> step.firedTransition shouldBe null },
                    ),
                ),
            )
        }

        test("H6 (result): entered in error never waits on QC, specimen or validation, nothing leaves it, and a final is never cancelled") {
            val released = setOf(ResultState.FINAL, ResultState.AMENDED, ResultState.CORRECTED)
            run(
                "H6-result-entered-in-error-always-possible",
                listOf(
                    ResultCheck(
                        name = "entered in error fires from every other state whenever privileged, audited and with a chosen reason",
                        appliesTo = {
                            it.command == ResultCommand.MarkEnteredInError &&
                                it.from != ResultState.ENTERED_IN_ERROR &&
                                it.holding.containsAll(listOf(ResultPredicate.PRIVILEGED_AND_AUDITED, ResultPredicate.ERROR_REASON_ENTERED))
                        },
                        check = { step -> step.outcome.state shouldBe ResultState.ENTERED_IN_ERROR },
                    ),
                    ResultCheck(
                        name = "no command leaves entered-in-error",
                        appliesTo = { it.from == ResultState.ENTERED_IN_ERROR },
                        check = { step -> step.firedTransition shouldBe null },
                    ),
                    ResultCheck(
                        name = "a released final, amended or corrected result is never cancelled",
                        appliesTo = { it.command == ResultCommand.Cancel && it.from in released },
                        check = { step -> step.outcome.shouldBeInstanceOf<Outcome.NotApplicable<*, *, *, *>>() },
                    ),
                ),
            ).requireAllFired(indexesOf { it.on == ResultCommand.MarkEnteredInError })
        }
    })
