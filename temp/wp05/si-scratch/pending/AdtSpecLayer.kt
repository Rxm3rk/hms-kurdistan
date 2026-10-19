package hms.tests.invariants

import hms.adt.domain.bed.BedArbs
import hms.adt.domain.bed.BedCommand
import hms.adt.domain.bed.BedEffect
import hms.adt.domain.bed.BedFacts
import hms.adt.domain.bed.BedGuards
import hms.adt.domain.bed.BedMachine
import hms.adt.domain.bed.BedPredicate
import hms.adt.domain.bed.BedState
import hms.adt.domain.common.Answer
import hms.adt.domain.common.CommandChannel
import hms.adt.domain.common.ConnectivityMode
import hms.adt.domain.common.FinanceFacts
import hms.adt.domain.common.PreApprovalStatus
import hms.adt.domain.encounter.EncounterArbs
import hms.adt.domain.encounter.EncounterCommand
import hms.adt.domain.encounter.EncounterEffect
import hms.adt.domain.encounter.EncounterFacts
import hms.adt.domain.encounter.EncounterGuards
import hms.adt.domain.encounter.EncounterMachine
import hms.adt.domain.encounter.EncounterPredicate
import hms.adt.domain.encounter.EncounterState
import io.kotest.assertions.withClue
import io.kotest.matchers.shouldBe

private typealias EncounterProperty = SpecLayerCheck<EncounterState, EncounterCommand, EncounterPredicate, EncounterEffect, EncounterFacts>
private typealias BedProperty = SpecLayerCheck<BedState, BedCommand, BedPredicate, BedEffect, BedFacts>

/**
 * Payment facts at their extremes (synthetic, NOT FOR CLINICAL USE): a large unpaid balance with no deposit and a denied
 * pre-approval, everything unknown or missing, and everything settled. SI-12: no adt outcome may depend on them.
 */
private val financeVariants =
    listOf(
        FinanceFacts(outstandingBalanceMinor = 1_000_000_000L, depositPaid = Answer.NO, preApproval = PreApprovalStatus.DENIED),
        FinanceFacts(outstandingBalanceMinor = null, depositPaid = Answer.UNKNOWN, preApproval = PreApprovalStatus.MISSING),
        FinanceFacts(outstandingBalanceMinor = 0L, depositPaid = Answer.YES, preApproval = PreApprovalStatus.APPROVED),
        FinanceFacts(outstandingBalanceMinor = 1L, depositPaid = Answer.NO, preApproval = PreApprovalStatus.PENDING),
    )

/** SI-15 clause b: the command was issued in the on-site-cell mode (an in-cell channel is in it by construction). */
private fun onSiteCell(
    channel: CommandChannel,
    mode: ConnectivityMode?,
): Boolean = channel == CommandChannel.IN_CELL || mode == ConnectivityMode.ON_SITE_CELL

/**
 * The specification-layer properties the encounter machine encodes (docs/specs/modules/state-machines-and-invariants.md
 * §4; docs/specs/state-machines/encounter.yaml), keyed by the test names the hazard log plans.
 */
internal object EncounterSpecLayer {
    /** The effects that put the patient in a bed: a bed allocation (SI-15 clause b). */
    private val allocating =
        setOf(
            EncounterEffect.APPEND_LOCATION_PERIOD,
            EncounterEffect.SWAP_LOCATION_PERIODS,
            EncounterEffect.REVERT_LAST_TRANSFER,
            EncounterEffect.RESTORE_LOCATION_AFTER_CANCELLED_DISCHARGE,
            EncounterEffect.APPLY_BACK_ENTERED_PERIODS,
        )

    /** The properties, by hazard-log name. */
    val layer by lazy {
        MachineSpecLayer(
            spec = EncounterMachine.spec,
            holds = { predicate, facts -> EncounterMachine.holds(predicate, EncounterGuards, facts) },
            facts = EncounterArbs.facts,
            properties = properties,
        )
    }

    private val properties: Map<String, EncounterProperty> =
        mapOf(
            "PropertyTest:SI-12-pre-authorisation-never-blocks-discharge-or-emergency-care" to
                EncounterProperty({ true }, { it.on == EncounterCommand.Discharge }) { step ->
                    financeVariants.forEach { finance ->
                        withClue("SI-12 clause a: ${step.command} in ${step.from} never depends on payment facts ($finance)") {
                            val other = step.facts.copy(finance = finance)
                            val refired = EncounterMachine.fire(step.from, step.command, EncounterGuards, other)
                            refired shouldBe step.outcome
                        }
                    }
                },
            "PropertyTest:SI-15-no-bed-or-ot-allocation-offline" to
                EncounterProperty(
                    { step -> step.fired?.effects?.any { it in allocating } == true },
                    { transition -> transition.effects.any { it in allocating } },
                ) { step ->
                    withClue("SI-15 clause b: no bed allocation unless issued in the on-site-cell mode") {
                        onSiteCell(step.facts.channel, step.facts.clientModeAtIssue) shouldBe true
                    }
                },
            "PropertyTest:SI-17-pending-results-at-discharge-go-to-owned-queue" to
                EncounterProperty({ it.fired?.on == EncounterCommand.Discharge }, { it.on == EncounterCommand.Discharge }) { step ->
                    withClue("SI-17 clause a: a discharge routes the pending results to owned queues") {
                        (step.fired?.effects?.contains(EncounterEffect.ROUTE_PENDING_RESULTS_TO_OWNED_QUEUES) == true) shouldBe true
                    }
                },
            "PropertyTest:SI-10-back-dating-is-privileged-and-audited" to
                EncounterProperty(
                    { it.fired?.on in setOf(EncounterCommand.BackEnterLocationPeriods, EncounterCommand.CorrectLocationTime) },
                    { it.on == EncounterCommand.BackEnterLocationPeriods || it.on == EncounterCommand.CorrectLocationTime },
                ) { step ->
                    withClue("SI-10 clause b: back-entered and corrected location times are privileged and audited") {
                        (EncounterPredicate.PRIVILEGED_AND_AUDITED in step.holding) shouldBe true
                    }
                },
        )
}

/**
 * The specification-layer properties the bed machine encodes (docs/specs/modules/state-machines-and-invariants.md §4;
 * docs/specs/state-machines/bed.yaml), keyed by the test names the hazard log plans.
 */
internal object BedSpecLayer {
    private val allocated = setOf(BedState.RESERVED, BedState.OCCUPIED)

    /** The properties, by hazard-log name. */
    val layer by lazy {
        MachineSpecLayer(
            spec = BedMachine.spec,
            holds = { predicate, facts -> BedMachine.holds(predicate, BedGuards, facts) },
            facts = BedArbs.facts,
            properties = properties,
        )
    }

    private val properties: Map<String, BedProperty> =
        mapOf(
            "PropertyTest:SI-12-no-rcm-state-blocks-a-clinical-command" to
                BedProperty({ true }, { it.to in allocated }) { step ->
                    financeVariants.forEach { finance ->
                        withClue("SI-12: the outcome of ${step.command} in ${step.from} never depends on payment facts ($finance)") {
                            BedMachine.fire(step.from, step.command, BedGuards, step.facts.copy(finance = finance)) shouldBe step.outcome
                        }
                    }
                },
            "PropertyTest:SI-15-no-bed-or-ot-allocation-offline" to
                BedProperty({ it.fired?.to in allocated }, { it.to in allocated }) { step ->
                    withClue("SI-15 clause b: a bed is reserved or occupied only by a command issued in the on-site-cell mode") {
                        onSiteCell(step.facts.channel, step.facts.clientModeAtIssue) shouldBe true
                    }
                },
        )
}
