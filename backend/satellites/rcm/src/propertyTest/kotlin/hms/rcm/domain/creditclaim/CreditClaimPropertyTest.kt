package hms.rcm.domain.creditclaim

import hms.kernel.statemachine.Outcome
import hms.kernel.statemachine.Transition
import hms.kernel.testing.statemachine.RunStats
import hms.kernel.testing.statemachine.SequenceConfig
import hms.kernel.testing.statemachine.Step
import hms.kernel.testing.statemachine.StepCheck
import hms.kernel.testing.statemachine.runSequences
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.string.shouldContain

private typealias ClaimStep = Step<CreditClaimState, CreditClaimCommand, CreditClaimPredicate, CreditClaimEffect, CreditClaimFacts>
private typealias ClaimCheck = StepCheck<CreditClaimState, CreditClaimCommand, CreditClaimPredicate, CreditClaimEffect, CreditClaimFacts>
private typealias ClaimTransition = Transition<CreditClaimState, CreditClaimCommand, CreditClaimPredicate, CreditClaimEffect>

private val holds: (CreditClaimPredicate, CreditClaimFacts) -> Boolean =
    { predicate, facts -> CreditClaimMachine.holds(predicate, CreditClaimGuards, facts) }

private fun run(
    name: String,
    checks: List<ClaimCheck>,
): RunStats = runSequences(name, CreditClaimMachine.spec, holds, CreditClaimArbs.facts, SequenceConfig(), checks)

private fun indexesOf(filter: (ClaimTransition) -> Boolean): IntArray =
    CreditClaimMachine.spec.transitions
        .filter(filter)
        .map { it.index }
        .toIntArray()

private val ClaimStep.fired: ClaimTransition? get() = (outcome as? Outcome.Fired)?.transition

private val ClaimStep.effects: List<CreditClaimEffect> get() = fired?.effects.orEmpty()

// ---- The reviewed effect-to-module map (SI-12; credit-claim.md "Where effects land"). The `when` is exhaustive, so a
// new effect does not compile until it is mapped here and reviewed.

private const val RCM = "rcm"
private const val TASKS = "platform-tasks"
private const val HUB = "hub"

/** The modules each effect acts on (BUILD-PROMPT §5.2 module names). */
private fun targets(effect: CreditClaimEffect): Set<String> =
    when (effect) {
        CreditClaimEffect.START_SLA_CLOCK,
        CreditClaimEffect.PAUSE_SLA_CLOCK,
        CreditClaimEffect.RESUME_SLA_CLOCK,
        CreditClaimEffect.STOP_SLA_CLOCK,
        CreditClaimEffect.ASSIGN_QUERY_TO_DESK,
        CreditClaimEffect.OPEN_NEXT_STEP_TASK,
        CreditClaimEffect.OPEN_RECONCILIATION_TASK,
        -> setOf(TASKS)

        CreditClaimEffect.ROUTE_TO_DENIAL_QUEUE -> setOf(RCM, TASKS)

        CreditClaimEffect.SEND_DOCUMENT_PACK, CreditClaimEffect.NOTIFY_PAYER_OF_WITHDRAWAL -> setOf(HUB)

        CreditClaimEffect.RECORD_PACK_COMPLETENESS,
        CreditClaimEffect.REFRESH_PAYER_PATIENT_SPLIT,
        CreditClaimEffect.POST_REMITTANCE,
        CreditClaimEffect.RELEASE_PAYER_LIABILITY,
        CreditClaimEffect.EMIT_CLAIM_SUBMITTED,
        CreditClaimEffect.EMIT_CLAIM_ADJUDICATED,
        -> setOf(RCM)
    }

/** The clinical modules of BUILD-PROMPT §5.2 (Safety Kernel, Tier 2, clinical record, specialties, diagnostics, cds). */
private val CLINICAL_MODULES: Set<String> =
    setOf(
        "adt",
        "orders",
        "medications",
        "results",
        "record",
        "nursing",
        "ed",
        "periop",
        "icu",
        "maternity",
        "lis",
        "ris",
        "transfusion",
        "reg-ews",
        "reg-transfusion",
        "reg-screening",
        "reg-lis-rules",
        "reg-dose",
        "cds",
    )

// ---- The SLA clock model (credit-claim.md "SLA clocks form an effect pair").

/** The payer-turnaround clock of the current request. */
private enum class Clock { NONE, RUNNING, PAUSED }

/** The states in which a request awaits the payer, so its clock runs. */
private val REQUEST_STATES =
    setOf(
        CreditClaimState.PRE_APPROVAL_REQUESTED,
        CreditClaimState.ENHANCEMENT_REQUESTED,
        CreditClaimState.DISCHARGE_AUTH_REQUESTED,
        CreditClaimState.CLAIM_DOCS_SUBMITTED,
        CreditClaimState.APPEAL,
        CreditClaimState.QUERY_RESPONSE,
    )

/** The clock every state implies: running while a request or an answered query awaits the payer, paused in query. */
private fun expectedClock(state: CreditClaimState): Clock =
    when (state) {
        CreditClaimState.QUERY -> Clock.PAUSED
        in REQUEST_STATES -> Clock.RUNNING
        else -> Clock.NONE
    }

/**
 * Applies a transition's clock effects to the clock its source state implies; returns the clock after it, or a
 * violation: start only when no clock runs, pause only a running clock, resume only a paused one (stop ends any clock).
 */
private fun applyClock(
    from: CreditClaimState,
    effects: List<CreditClaimEffect>,
): Pair<Clock?, String?> {
    var clock = expectedClock(from)
    for (effect in effects) {
        val (next, legal) =
            when (effect) {
                CreditClaimEffect.START_SLA_CLOCK -> Clock.RUNNING to (clock == Clock.NONE)
                CreditClaimEffect.PAUSE_SLA_CLOCK -> Clock.PAUSED to (clock == Clock.RUNNING)
                CreditClaimEffect.RESUME_SLA_CLOCK -> Clock.RUNNING to (clock == Clock.PAUSED)
                CreditClaimEffect.STOP_SLA_CLOCK -> Clock.NONE to true
                else -> clock to true
            }
        if (!legal) return null to "$effect with the clock $clock"
        clock = next
    }
    return clock to null
}

private fun checkClock(
    from: CreditClaimState,
    transition: ClaimTransition,
) {
    val (after, violation) = applyClock(from, transition.effects)
    withClue("transition ${transition.index} ${transition.on} from $from to ${transition.to}") {
        violation shouldBe null
        after shouldBe expectedClock(transition.to)
    }
}

private val DISCHARGED = setOf(EncounterStatus.DISCHARGED_NOT_CLOSED, EncounterStatus.FINISHED)

private val DECISION_STATES =
    setOf(
        CreditClaimState.PRE_APPROVAL_APPROVED,
        CreditClaimState.PRE_APPROVAL_DENIED,
        CreditClaimState.ENHANCEMENT_APPROVED,
        CreditClaimState.FINAL_APPROVED,
        CreditClaimState.SETTLED,
        CreditClaimState.PARTIALLY_SETTLED,
        CreditClaimState.DENIED,
    )

/** The reference amount of a settlement, re-read from the raw facts (credit-claim.yaml settledInFull). */
private fun CreditClaimFacts.oracleReference(): Money? =
    when {
        finalApproval != null -> finalApproval.payerPayable
        appeal != null -> appeal.amountAppealed
        else -> dischargeAuthRequest?.amountRequested
    }

/**
 * The credit-claim machine's own properties (docs/specs/state-machines/credit-claim.yaml, credit-claim.md; WP-0.5 spec
 * §3.3), beside the generated P1 to P7: SI-12 (no effect on a clinical module or a clinician's queue; the discharge
 * authorisation follows the clinical discharge), SI-03 (the SLA clock pause/resume pairing, owned desk tasks after
 * every query and decision), and the DN-058 money and withdrawal readings. Each run uses the configured budget, checks
 * the raw facts with independent oracles, and requires the transitions it is about.
 */
class CreditClaimPropertyTest :
    FunSpec({
        test("SI-12 (credit-claim): SI-12-no-rcm-state-blocks-a-clinical-command: no effect targets a clinical module") {
            CreditClaimEffect.entries.forEach { effect ->
                withClue(effect.id) {
                    targets(effect).filter { it in CLINICAL_MODULES }.shouldBeEmpty()
                    targets(effect).isNotEmpty() shouldBe true
                }
            }
            val stats =
                run(
                    "SI-12-no-rcm-state-blocks-a-clinical-command (credit-claim)",
                    listOf(
                        ClaimCheck(
                            name = "no fired effect targets a clinical module",
                            appliesTo = { it.fired != null && it.effects.isNotEmpty() },
                            check = { step ->
                                step.effects
                                    .flatMap(::targets)
                                    .filter { it in CLINICAL_MODULES }
                                    .shouldBeEmpty()
                            },
                        ),
                    ),
                )
            indexesOf { it.effects.isNotEmpty() }.forEach { stats.requireFired(it) }
        }

        test("SI-12 (credit-claim): every desk task and SLA escalation says it never goes to a clinician (structural)") {
            listOf(CreditClaimEffect.START_SLA_CLOCK, CreditClaimEffect.ASSIGN_QUERY_TO_DESK, CreditClaimEffect.OPEN_NEXT_STEP_TASK)
                .forEach { effect ->
                    withClue(effect.id) {
                        val text = effect.description.lowercase()
                        text shouldContain "desk"
                        text shouldContain "never"
                        text shouldContain "clinician"
                    }
                }
        }

        test("SI-12 (credit-claim): SI-12-pre-authorisation-never-blocks-discharge-or-emergency-care: the request follows the discharge") {
            val requests = indexesOf { it.on == CreditClaimCommand.RequestDischargeAuth }
            CreditClaimMachine.spec.transitions.filter { it.index in requests }.forEach { transition ->
                transition.guard shouldContain CreditClaimPredicate.CLINICAL_DISCHARGE_RECORDED
            }
            val stats =
                run(
                    "SI-12-pre-authorisation-never-blocks-discharge-or-emergency-care (credit-claim)",
                    listOf(
                        ClaimCheck(
                            name = "a discharge authorisation is requested only after adt reports the clinical discharge",
                            appliesTo = { it.fired?.on == CreditClaimCommand.RequestDischargeAuth },
                            check = { step -> DISCHARGED shouldContain step.facts.episode.encounterStatus },
                        ),
                    ),
                )
            requests.forEach { stats.requireFired(it) }
        }

        test("SI-03 (credit-claim): SLA clocks pair: start when none runs, pause only running, resume only paused (every transition)") {
            CreditClaimMachine.spec.transitions.forEach { transition ->
                transition.from.forEach { from -> checkClock(from, transition) }
            }
        }

        test("SI-03 (credit-claim): SI-03-owner-and-sla-on-every-work-item: clock pairing and owned desk tasks over sequences") {
            val stats =
                run(
                    "SI-03-owner-and-sla-on-every-work-item (credit-claim)",
                    listOf(
                        ClaimCheck(
                            name = "every fired transition keeps the SLA clock paired with the state",
                            appliesTo = { it.fired != null },
                            check = { step -> step.fired?.let { checkClock(step.from, it) } },
                        ),
                        ClaimCheck(
                            name = "every entry into query pauses the clock and assigns the query to the desk",
                            appliesTo = { it.fired?.to == CreditClaimState.QUERY },
                            check = { step ->
                                step.effects shouldContain CreditClaimEffect.PAUSE_SLA_CLOCK
                                step.effects shouldContain CreditClaimEffect.ASSIGN_QUERY_TO_DESK
                            },
                        ),
                        ClaimCheck(
                            name = "every payer decision stops the clock and opens the owned next-step task",
                            appliesTo = { it.fired?.to in DECISION_STATES },
                            check = { step ->
                                step.effects shouldContain CreditClaimEffect.STOP_SLA_CLOCK
                                step.effects shouldContain CreditClaimEffect.OPEN_NEXT_STEP_TASK
                            },
                        ),
                        ClaimCheck(
                            name = "every entry into reconciliation opens the owned reconciliation task",
                            appliesTo = { it.fired?.to == CreditClaimState.RECONCILIATION },
                            check = { step -> step.effects shouldContain CreditClaimEffect.OPEN_RECONCILIATION_TASK },
                        ),
                    ),
                )
            indexesOf { it.effects.any { effect -> effect.name.endsWith("_SLA_CLOCK") } }.forEach { stats.requireFired(it) }
        }

        test("DN-058 item 5 (credit-claim): settled in full only at or above the reference amount, in the same currency") {
            val stats =
                run(
                    "credit-claim-settlement-exact-same-currency",
                    listOf(
                        ClaimCheck(
                            name = "a settlement in full is in the reference currency and not below the reference amount",
                            appliesTo = { it.fired?.on == CreditClaimCommand.RecordSettlement && it.fired?.to == CreditClaimState.SETTLED },
                            check = { step ->
                                val total = step.facts.settlement?.totalSettled
                                val reference = step.facts.oracleReference()
                                (total != null && reference != null) shouldBe true
                                total?.currency shouldBe reference?.currency
                                (total != null && reference != null && total.amount >= reference.amount) shouldBe true
                            },
                        ),
                        ClaimCheck(
                            name = "a partial settlement in another currency carries the governed exchange-difference reason",
                            appliesTo = { step ->
                                val total = step.facts.settlement?.totalSettled
                                val reference = step.facts.oracleReference()
                                step.fired?.to == CreditClaimState.PARTIALLY_SETTLED &&
                                    total != null &&
                                    reference != null &&
                                    total.currency != reference.currency
                            },
                            check = { step ->
                                step.facts.settlement
                                    ?.deductions
                                    .orEmpty()
                                    .map { it.reasonCode } shouldContain step.facts.config.exchangeDifferenceReason
                            },
                        ),
                    ),
                )
            indexesOf { it.on == CreditClaimCommand.RecordSettlement }.forEach { stats.requireFired(it) }
        }

        test("DN-058 item 8 (credit-claim): a submitted claim is never withdrawn") {
            val submitted =
                setOf(
                    CreditClaimState.CLAIM_DOCS_SUBMITTED,
                    CreditClaimState.SETTLED,
                    CreditClaimState.PARTIALLY_SETTLED,
                    CreditClaimState.DENIED,
                    CreditClaimState.RECONCILIATION,
                    CreditClaimState.APPEAL,
                    CreditClaimState.CLOSED,
                )
            submitted.forEach { state -> CreditClaimMachine.spec.candidates(state, CreditClaimCommand.Withdraw).shouldBeEmpty() }
            val stats =
                run(
                    "credit-claim-submitted-claim-never-withdrawn",
                    listOf(
                        ClaimCheck(
                            name = "a withdrawal during a query never happens on a claim query",
                            appliesTo = {
                                it.fired?.on == CreditClaimCommand.Withdraw &&
                                    (it.from == CreditClaimState.QUERY || it.from == CreditClaimState.QUERY_RESPONSE)
                            },
                            check = { step -> step.facts.currentQueryStage shouldNotBe QueryStage.CLAIM },
                        ),
                    ),
                )
            indexesOf { it.on == CreditClaimCommand.Withdraw }.forEach { stats.requireFired(it) }
        }
    })
