package hms.adt.domain.bed

import hms.adt.domain.common.Answer
import hms.adt.domain.common.CommandChannel
import hms.adt.domain.common.ConnectivityMode
import hms.adt.domain.common.EntrySource
import hms.adt.domain.common.FinanceFacts
import hms.adt.domain.common.Occupancy
import hms.adt.domain.common.PreApprovalStatus
import hms.adt.domain.common.PressureSignal
import hms.adt.domain.common.RecordedSex
import hms.adt.domain.common.RestrictionKind
import hms.adt.domain.encounter.EncounterState
import hms.kernel.statemachine.Outcome
import hms.kernel.testing.statemachine.SequenceConfig
import hms.kernel.testing.statemachine.Step
import hms.kernel.testing.statemachine.StepCheck
import hms.kernel.testing.statemachine.runSequences
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.shouldBe

private typealias BedStep = Step<BedState, BedCommand, BedPredicate, BedEffect, BedFacts>
private typealias BedCheck = StepCheck<BedState, BedCommand, BedPredicate, BedEffect, BedFacts>

/**
 * The bed machine's own safety properties at the specification layer: the generated model driven by [BedGuards] over
 * [BedArbs.facts] (docs/specs/modules/state-machines-and-invariants.md §3.3; docs/specs/state-machines/bed.md §4, §5).
 * Each property recomputes its rule from the raw facts after every step it applies to, and asserts that the
 * transitions it is about fired. Budget from [hms.kernel.testing.PropertyTestBudget] through [SequenceConfig]. Not a
 * domain-layer verification and not the database exclusion constraint (KA-062; bed.md "What this file does not prove").
 */
class BedPropertyTest :
    FunSpec({
        fun run(
            name: String,
            vararg checks: BedCheck,
        ) = runSequences(
            name = name,
            spec = BedMachine.spec,
            holds = { predicate, facts -> BedMachine.holds(predicate, BedGuards, facts) },
            facts = BedArbs.facts,
            config = SequenceConfig(),
            checks = checks.toList(),
        )

        test("SI-15-no-bed-or-ot-allocation-offline (bed): no reservation or occupancy comes from a command issued offline") {
            val check =
                BedCheck(
                    name = "an allocating transition fired only for an in-cell channel or a client in the on-site-cell mode at issue",
                    appliesTo = { step -> step.firedIndex() in ALLOCATING },
                    check = { step ->
                        val facts = step.facts
                        val inCell = facts.channel == CommandChannel.IN_CELL
                        (inCell || facts.clientModeAtIssue == ConnectivityMode.ON_SITE_CELL) shouldBe true
                    },
                )
            run("bed-SI-15-no-bed-allocation-offline", check).requireFired(*ALLOCATING.toIntArray())
        }

        test("SI-15-no-bed-or-ot-allocation-offline (bed): internet loss alone never changes any guard") {
            val check =
                BedCheck(
                    name = "changing WAN reachability changes no predicate",
                    appliesTo = { true },
                    check = { step ->
                        listOf(true, false, null).forEach { wan ->
                            holding(step.facts.copy(wanReachable = wan)) shouldBe step.holding
                        }
                    },
                )
            run("bed-SI-15-wan-loss-is-not-offline", check).requireFired(0, 1, 2, 14)
        }

        test("SI-12-no-rcm-state-blocks-a-clinical-command (bed): payment facts never change any guard") {
            val check =
                BedCheck(
                    name = "changing the balance, deposit or pre-approval changes no predicate",
                    appliesTo = { true },
                    check = { step ->
                        FINANCE_VARIANTS.forEach { finance ->
                            withClue("finance $finance") { holding(step.facts.copy(finance = finance)) shouldBe step.holding }
                        }
                    },
                )
            run("bed-SI-12-payment-facts-never-change-a-guard", check).requireFired(*(0..15).toList().toIntArray())
        }

        test("HAZ-0001 (bed): one occupant per bed: no occupancy overlaps another encounter's, no occupied bed is vacated") {
            val occupancy =
                BedCheck(
                    name = "after a fired Occupy, Reoccupy or back-entered occupancy no other valid period overlaps the new one",
                    appliesTo = { step -> step.firedIndex() in OCCUPYING },
                    check = { step ->
                        val facts = step.facts
                        val start = requireNotNull(facts.occupancyStart)
                        val others =
                            facts.periods.filter {
                                it.bedId == facts.bedId && !it.enteredInError && it.encounterId != facts.commandEncounterId
                            }
                        others.none { Occupancy.overlaps(start, null, it.start, it.end) } shouldBe true
                    },
                )
            val vacate =
                BedCheck(
                    name = "a fired Vacate left no valid open period on the bed",
                    appliesTo = { step -> step.firedIndex() == VACATE },
                    check = { step ->
                        step.facts.periods
                            .none { it.bedId == step.facts.bedId && !it.enteredInError && it.end == null } shouldBe true
                    },
                )
            run("bed-HAZ-0001-one-occupant-per-bed", occupancy, vacate).requireFired(*(OCCUPYING + VACATE).toIntArray())
        }

        test("Emergency access (bed; DN-056 items 1-3): an unknown sex or stale pressure signal never refuses a reservation") {
            val check =
                BedCheck(
                    name = "with the sex unknown and the pressure signal stale, only an isolation mismatch can fail the restrictions",
                    appliesTo = { step -> step.command == BedCommand.Reserve && step.from == BedState.AVAILABLE },
                    check = { step ->
                        val facts = step.facts
                        val unknown =
                            facts.copy(
                                patientPlacement = facts.patientPlacement.copy(sex = RecordedSex.NotRecorded),
                                attributes = facts.attributes.copy(pressureSignal = PressureSignal.UNKNOWN),
                            )
                        val held = holding(unknown)
                        (BedPredicate.NO_ACTIVE_PRESSURE_ALARM in held) shouldBe true
                        (BedPredicate.BED_RESTRICTIONS_ADMIT_PATIENT in held) shouldBe !isolationUnmetRaw(facts)
                    },
                )
            run("bed-emergency-unknown-sex-and-stale-signal-never-block", check).requireFired(0)
        }

        test("Emergency access (bed; DN-056 items 1-3): an override naming every restriction is never refused for bed attributes") {
            val check =
                BedCheck(
                    name = "ReserveWithOverride fires whenever the cell is reached, the encounter can take a bed, the user is privileged " +
                        "and audited and a user-chosen reason names every restriction",
                    appliesTo = { step ->
                        val override = step.facts.override
                        step.command == BedCommand.ReserveWithOverride &&
                            step.from == BedState.AVAILABLE &&
                            override != null &&
                            override.overridden == RestrictionKind.entries.toSet() &&
                            override.reason?.source == EntrySource.USER
                    },
                    check = { step ->
                        val facts = step.facts
                        val online =
                            facts.channel == CommandChannel.IN_CELL || facts.clientModeAtIssue == ConnectivityMode.ON_SITE_CELL
                        val open = facts.commandEncounterId != null && facts.commandEncounterState in BED_TAKING
                        val authorised = facts.commandPrivilege == Answer.YES && facts.auditAccepted == Answer.YES
                        (step.outcome is Outcome.Fired) shouldBe (online && open && authorised)
                    },
                )
            run("bed-emergency-override-never-blocked-by-attributes", check).requireFired(1)
        }

        test("Bed reuse after isolation (bed; DN-056 item 12; proposed hazard): a bed returns to use only after the required clean") {
            val check =
                BedCheck(
                    name = "a fired FinishCleaning recorded a completed clean of the required type, an unknown type counting as terminal",
                    appliesTo = { step -> step.firedIndex() == FINISH_CLEANING },
                    check = { step ->
                        val job = requireNotNull(step.facts.cleaningJob)
                        job.completedClean shouldBe (job.requiredType ?: CleanType.TERMINAL)
                    },
                )
            run("bed-terminal-clean-before-reuse", check).requireFired(FINISH_CLEANING)
        }

        test("SI-03-owner-and-sla-on-every-work-item (bed): dirty beds get an owned cleaning job; no silent reservation release") {
            val cleaning =
                BedCheck(
                    name = "a fired transition into dirty carries ensureCleaningJob",
                    appliesTo = { step -> (step.outcome as? Outcome.Fired)?.transition?.to == BedState.DIRTY },
                    check = { step ->
                        (step.outcome as Outcome.Fired).transition.effects shouldContain BedEffect.ENSURE_CLEANING_JOB
                    },
                )
            val release =
                BedCheck(
                    name = "a fired release had its encounter ended or a user's reason, and returned or closed the request",
                    appliesTo = { step -> step.firedIndex() in RELEASES },
                    check = { step ->
                        val facts = step.facts
                        val effects = (step.outcome as Outcome.Fired).transition.effects
                        if (step.firedIndex() == RELEASE_RESERVATION) {
                            (facts.reservationEncounterState in ENDED) shouldBe true
                            effects shouldContain BedEffect.CLOSE_BED_REQUEST
                        } else {
                            val reason = facts.reason
                            (reason != null && reason.byUser && reason.value.isNotBlank()) shouldBe true
                            effects shouldContain BedEffect.RETURN_BED_REQUEST_TO_QUEUE
                        }
                    },
                )
            run("bed-SI-03-cleaning-job-and-reservation-release", cleaning, release).requireFired(3, 9, 12, 6, 7)
        }
    }) {
    private companion object {
        val ALLOCATING = listOf(0, 1, 2, 14, 15)
        val OCCUPYING = listOf(2, 14, 15)
        const val VACATE = 3
        const val FINISH_CLEANING = 5
        const val RELEASE_RESERVATION = 7
        val RELEASES = listOf(6, 7)
        val BED_TAKING = setOf(EncounterState.PLANNED, EncounterState.ARRIVED, EncounterState.TRIAGED, EncounterState.IN_PROGRESS)
        val ENDED =
            setOf(EncounterState.DISCHARGED_NOT_CLOSED, EncounterState.FINISHED, EncounterState.CANCELLED, EncounterState.ENTERED_IN_ERROR)
        val FINANCE_VARIANTS =
            listOf(
                FinanceFacts(null, Answer.UNKNOWN, PreApprovalStatus.UNKNOWN),
                FinanceFacts(Long.MAX_VALUE, Answer.NO, PreApprovalStatus.DENIED),
                FinanceFacts(0, Answer.YES, PreApprovalStatus.APPROVED),
                FinanceFacts(1_500_000, Answer.NO, PreApprovalStatus.MISSING),
            )

        fun holding(facts: BedFacts): Set<BedPredicate> =
            BedPredicate.entries.filter { BedMachine.holds(it, BedGuards, facts) }.toSet()

        fun BedStep.firedIndex(): Int? = (outcome as? Outcome.Fired)?.transition?.index

        /** The isolation clause of bedRestrictionsAdmitPatient, recomputed from the raw facts. */
        fun isolationUnmetRaw(facts: BedFacts): Boolean {
            val requirement = facts.patientPlacement.isolation ?: return false
            val kind = requirement.kind ?: return true
            val capabilities = facts.attributes.isolationCapabilities ?: return true
            return kind !in capabilities && kind !in facts.attributes.activeCohortKinds
        }
    }
}
