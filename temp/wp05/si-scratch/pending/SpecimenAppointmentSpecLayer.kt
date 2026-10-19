package hms.tests.invariants

import hms.kernel.testing.statemachine.Step
import hms.lis.domain.specimen.SpecimenArbs
import hms.lis.domain.specimen.SpecimenCommand
import hms.lis.domain.specimen.SpecimenEffect
import hms.lis.domain.specimen.SpecimenFacts
import hms.lis.domain.specimen.SpecimenGuards
import hms.lis.domain.specimen.SpecimenMachine
import hms.lis.domain.specimen.SpecimenPredicate
import hms.lis.domain.specimen.SpecimenState
import hms.lis.domain.specimen.TwoIdentifierMethod
import hms.scheduling.domain.appointment.AppointmentArbs
import hms.scheduling.domain.appointment.AppointmentCommand
import hms.scheduling.domain.appointment.AppointmentEffect
import hms.scheduling.domain.appointment.AppointmentFacts
import hms.scheduling.domain.appointment.AppointmentGuards
import hms.scheduling.domain.appointment.AppointmentMachine
import hms.scheduling.domain.appointment.AppointmentPredicate
import hms.scheduling.domain.appointment.AppointmentState
import io.kotest.assertions.withClue
import io.kotest.matchers.shouldBe

private typealias SpecimenStep = Step<SpecimenState, SpecimenCommand, SpecimenPredicate, SpecimenEffect, SpecimenFacts>
private typealias SpecimenProperty = SpecLayerCheck<SpecimenState, SpecimenCommand, SpecimenPredicate, SpecimenEffect, SpecimenFacts>
private typealias AppointmentProperty =
    SpecLayerCheck<AppointmentState, AppointmentCommand, AppointmentPredicate, AppointmentEffect, AppointmentFacts>

/**
 * The specification-layer properties the specimen machine encodes (docs/specs/modules/state-machines-and-invariants.md
 * §4; docs/specs/state-machines/specimen.yaml), keyed by the test names the hazard log plans. "Bedside" commands are the
 * ones that label or collect a specimen at the patient: PrintLabels, AssignKitLabels, Collect and their identity overrides.
 */
internal object SpecimenSpecLayer {
    private val bedside =
        setOf(
            SpecimenCommand.PrintLabels,
            SpecimenCommand.PrintLabelsWithIdentityOverride,
            SpecimenCommand.AssignKitLabels,
            SpecimenCommand.Collect,
            SpecimenCommand.CollectWithIdentityOverride,
        )
    private val printing = setOf(SpecimenCommand.PrintLabels, SpecimenCommand.PrintLabelsWithIdentityOverride)
    private val identityOverrides = setOf(SpecimenCommand.PrintLabelsWithIdentityOverride, SpecimenCommand.CollectWithIdentityOverride)

    /** The properties, by hazard-log name. */
    val layer by lazy {
        MachineSpecLayer(
            spec = SpecimenMachine.spec,
            holds = { predicate, facts -> SpecimenMachine.holds(predicate, SpecimenGuards, facts) },
            facts = SpecimenArbs.facts,
            properties = properties,
        )
    }

    private fun firedOn(
        step: SpecimenStep,
        commands: Set<SpecimenCommand>,
    ): Boolean = step.fired?.on in commands

    private val properties: Map<String, SpecimenProperty> =
        mapOf(
            "PropertyTest:SI-01-two-identifiers-on-every-patient-affecting-command" to
                SpecimenProperty({ firedOn(it, bedside) }, { it.on in bedside }) { step ->
                    withClue("SI-01 clauses a, d: labelled or collected only after a wristband match or an active two-identifier check") {
                        (
                            SpecimenPredicate.WRISTBAND_SCAN_MATCHES in step.holding ||
                                SpecimenPredicate.TWO_IDENTIFIERS_ACTIVELY_CONFIRMED in step.holding
                        ) shouldBe true
                    }
                },
            "PropertyTest:SI-01-location-never-an-identifier" to
                SpecimenProperty({ firedOn(it, printing + identityOverrides) }, { it.on in printing + identityOverrides }) { step ->
                    withClue("SI-01 clause b: no label identifier slot holds a room or bed; no identity check rests on a location") {
                        if (step.command in printing) step.facts.labelContent?.roomOrBedInIdentifierSlot shouldBe false
                        if (step.command in identityOverrides) {
                            (step.facts.session?.twoIdentifierCheck?.method != TwoIdentifierMethod.ROOM_BED_OR_LOCATION) shouldBe true
                        }
                    }
                },
            "PropertyTest:SI-11-wristband-unit-order-sample-match" to
                SpecimenProperty({ firedOn(it, identityOverrides) }, { it.on in identityOverrides }) { step ->
                    withClue("SI-11 clause a (sample): a pre-transfusion sample is never labelled or collected without a wristband match") {
                        (SpecimenPredicate.NOT_TRANSFUSION_SAMPLE in step.holding) shouldBe true
                    }
                },
        )
}

/**
 * The specification-layer properties the appointment machine encodes (docs/specs/modules/state-machines-and-invariants.md
 * §4; docs/specs/state-machines/appointment.yaml), keyed by the test names the hazard log plans.
 */
internal object AppointmentSpecLayer {
    private val checkIns = setOf(AppointmentCommand.CheckIn, AppointmentCommand.CheckInWalkIn)

    /** The properties, by hazard-log name. */
    val layer by lazy {
        MachineSpecLayer(
            spec = AppointmentMachine.spec,
            holds = { predicate, facts -> AppointmentMachine.holds(predicate, AppointmentGuards, facts) },
            facts = AppointmentArbs.facts,
            properties = properties,
        )
    }

    private val properties: Map<String, AppointmentProperty> =
        mapOf(
            "PropertyTest:SI-01-two-identifiers-on-every-patient-affecting-command" to
                AppointmentProperty({ it.fired?.on in checkIns }, { it.on in checkIns }) { step ->
                    withClue("SI-01 clauses a, d: a patient is checked in only when identified by two identifiers") {
                        (AppointmentPredicate.PATIENT_IDENTIFIED_BY_TWO_IDENTIFIERS in step.holding) shouldBe true
                    }
                },
        )
}
