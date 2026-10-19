package hms.tests.invariants

import hms.kernel.statemachine.Transition
import hms.kernel.testing.statemachine.Step
import hms.medications.domain.medicationadministration.LabelKind
import hms.medications.domain.medicationadministration.MedicationAdministrationArbs
import hms.medications.domain.medicationadministration.MedicationAdministrationCommand
import hms.medications.domain.medicationadministration.MedicationAdministrationCommand.BackEnterAdministration
import hms.medications.domain.medicationadministration.MedicationAdministrationCommand.Give
import hms.medications.domain.medicationadministration.MedicationAdministrationCommand.GiveWithOverride
import hms.medications.domain.medicationadministration.MedicationAdministrationCommand.StartInfusion
import hms.medications.domain.medicationadministration.MedicationAdministrationCommand.StartInfusionWithOverride
import hms.medications.domain.medicationadministration.MedicationAdministrationEffect
import hms.medications.domain.medicationadministration.MedicationAdministrationEffect.CREATE_PHARMACIST_REVIEW_TASK
import hms.medications.domain.medicationadministration.MedicationAdministrationEffect.EMIT_MEDICATION_ADMINISTERED
import hms.medications.domain.medicationadministration.MedicationAdministrationEffect.REPORT_OVERRIDE
import hms.medications.domain.medicationadministration.MedicationAdministrationFacts
import hms.medications.domain.medicationadministration.MedicationAdministrationGuards
import hms.medications.domain.medicationadministration.MedicationAdministrationMachine
import hms.medications.domain.medicationadministration.MedicationAdministrationPredicate
import hms.medications.domain.medicationadministration.MedicationAdministrationPredicate.HIGH_ALERT_CHECK_SATISFIED
import hms.medications.domain.medicationadministration.MedicationAdministrationPredicate.MANUAL_TWO_IDENTIFIERS_CONFIRMED
import hms.medications.domain.medicationadministration.MedicationAdministrationPredicate.OFFLINE_ALLOWED
import hms.medications.domain.medicationadministration.MedicationAdministrationPredicate.PATIENT_SUPPLIED_CLEARED
import hms.medications.domain.medicationadministration.MedicationAdministrationPredicate.PRIVILEGED_AND_AUDITED
import hms.medications.domain.medicationadministration.MedicationAdministrationPredicate.PRODUCT_IDENTITY_MATCHES
import hms.medications.domain.medicationadministration.MedicationAdministrationPredicate.WRISTBAND_SCAN_MATCHES
import hms.medications.domain.medicationadministration.MedicationAdministrationState
import hms.medications.domain.medicationadministration.OrderState
import hms.medications.domain.medicationadministration.VerificationStatus
import io.kotest.assertions.withClue
import io.kotest.matchers.shouldBe

private typealias MarStep = Step<
    MedicationAdministrationState,
    MedicationAdministrationCommand,
    MedicationAdministrationPredicate,
    MedicationAdministrationEffect,
    MedicationAdministrationFacts,
>
private typealias MarTransition = Transition<
    MedicationAdministrationState,
    MedicationAdministrationCommand,
    MedicationAdministrationPredicate,
    MedicationAdministrationEffect,
>

private typealias MarProperty = SpecLayerCheck<
    MedicationAdministrationState,
    MedicationAdministrationCommand,
    MedicationAdministrationPredicate,
    MedicationAdministrationEffect,
    MedicationAdministrationFacts,
>

/**
 * The specification-layer properties the medication-administration machine encodes (docs/specs/modules/
 * state-machines-and-invariants.md §4; docs/specs/state-machines/medication-administration.yaml), keyed by the test
 * names the hazard log plans. Each states its SI over the outcome of every step, independently of which transitions the
 * table holds: a transition added later that records an administration without the SI's condition fails it. Each reads
 * the step's facts directly where the facts carry the answer, and the predicates the harness evaluated (`holding`) where
 * only the guard can decide.
 *
 * Scope (the register's `covers`): an administration is a step that moved a scheduled dose to in-progress or completed
 * and journaled MedicationAdministered. Live administrations are the four commands a user issues at the bedside (Give,
 * StartInfusion and their overrides). RecordOfflineAdministration (the sync handler) and BackEnterAdministration record
 * doses given earlier without the live checks; only the properties that say so cover them.
 */
internal object MedicationAdministrationSpecLayer {
    private val liveGives = setOf(Give, StartInfusion, GiveWithOverride, StartInfusionWithOverride)
    private val userOverrides = setOf(GiveWithOverride, StartInfusionWithOverride)
    private val administeredStates = setOf(MedicationAdministrationState.IN_PROGRESS, MedicationAdministrationState.COMPLETED)

    /** A transition that records an administration of a scheduled dose. */
    private fun records(transition: MarTransition): Boolean =
        MedicationAdministrationState.SCHEDULED in transition.from &&
            transition.to in administeredStates &&
            EMIT_MEDICATION_ADMINISTERED in transition.effects

    /** The effects of the step when it recorded an administration of a scheduled dose; null otherwise. */
    private fun administration(step: MarStep): List<MedicationAdministrationEffect>? =
        step.fired?.takeIf { step.from == MedicationAdministrationState.SCHEDULED && records(it) }?.effects

    private fun live(step: MarStep): Boolean = administration(step) != null && step.command in liveGives

    private fun liveTransition(transition: MarTransition): Boolean = records(transition) && transition.on in liveGives

    private fun backEntry(step: MarStep): Boolean = administration(step) != null && step.command == BackEnterAdministration

    /** The properties, by hazard-log name. */
    val layer by lazy {
        MachineSpecLayer(
            spec = MedicationAdministrationMachine.spec,
            holds = { predicate, facts -> MedicationAdministrationMachine.holds(predicate, MedicationAdministrationGuards, facts) },
            facts = MedicationAdministrationArbs.facts,
            properties = properties,
        )
    }

    private val properties: Map<String, MarProperty> =
        mapOf(
            "PropertyTest:SI-01-two-identifiers-on-every-patient-affecting-command" to
                MarProperty(::live, ::liveTransition) { step ->
                    withClue("SI-01: a live administration needs wristbandScanMatches or manualTwoIdentifiersConfirmed") {
                        (WRISTBAND_SCAN_MATCHES in step.holding || MANUAL_TWO_IDENTIFIERS_CONFIRMED in step.holding) shouldBe true
                    }
                },
            "PropertyTest:SI-01-location-never-an-identifier" to
                MarProperty(
                    { live(it) && WRISTBAND_SCAN_MATCHES in it.holding },
                    { liveTransition(it) && WRISTBAND_SCAN_MATCHES in it.guard },
                ) { step ->
                    withClue("SI-01 clause b: never room or bed") {
                        step.facts.scans.wristband?.labelKind shouldBe LabelKind.PATIENT_WRISTBAND
                    }
                },
            "PropertyTest:SI-02-no-administration-without-active-verified-order-or-documented-override" to
                MarProperty({ administration(it) != null }, ::records) { step ->
                    val order = step.facts.order
                    val activeVerified = order.state == OrderState.ACTIVE && order.verificationStatus == VerificationStatus.VERIFIED
                    withClue("SI-02 clause a: no administration without an active verified order or a documented override") {
                        (activeVerified || REPORT_OVERRIDE in administration(step).orEmpty()) shouldBe true
                    }
                },
            "PropertyTest:SI-02-override-never-waives-SI-01-SI-12-SI-13-SI-15" to
                MarProperty({ live(it) && it.command in userOverrides }, { records(it) && it.on in userOverrides }) { step ->
                    withClue("SI-02: an override keeps SI-01 (identifiers), SI-12 (supply), SI-13 (double check), SI-15 (offline)") {
                        (WRISTBAND_SCAN_MATCHES in step.holding || MANUAL_TWO_IDENTIFIERS_CONFIRMED in step.holding) shouldBe true
                        val kept = listOf(PATIENT_SUPPLIED_CLEARED, HIGH_ALERT_CHECK_SATISFIED, OFFLINE_ALLOWED)
                        step.holding.containsAll(kept) shouldBe true
                    }
                },
            "PropertyTest:SI-02-override-reason-never-defaulted" to
                MarProperty({ live(it) && it.command in userOverrides }, { records(it) && it.on in userOverrides }) { step ->
                    val reason = step.facts.entries.overrideReason
                    withClue("SI-02 clause b: override reasons are never defaulted") {
                        reason?.chosenByUser shouldBe true
                        reason?.enteredBy shouldBe step.facts.actor.userId
                    }
                },
            "PropertyTest:SI-02-every-override-reportable" to
                MarProperty({ administration(it) != null && !fullyChecked(it) }, ::records) { step ->
                    withClue("SI-02 clause c: an administration that did not pass every live check is reported as an override") {
                        (REPORT_OVERRIDE in administration(step).orEmpty()) shouldBe true
                    }
                },
            "PropertyTest:SI-05-review-task-within-4h-of-dose-before-verification" to
                MarProperty(
                    { live(it) && it.facts.order.verificationStatus != VerificationStatus.VERIFIED },
                    { records(it) && CREATE_PHARMACIST_REVIEW_TASK in it.effects },
                ) { step ->
                    withClue("SI-05 clause j: a live dose given before verification creates the pharmacist review task") {
                        (CREATE_PHARMACIST_REVIEW_TASK in administration(step).orEmpty()) shouldBe true
                    }
                },
            "PropertyTest:SI-10-clinical-time-distinct-from-system-time" to
                MarProperty(::live, ::liveTransition) { step ->
                    withClue("SI-10 clause a: a live administration carries no user-entered clinical time") {
                        step.facts.entries.userEnteredClinicalTime shouldBe null
                    }
                },
            "PropertyTest:SI-10-back-dating-is-privileged-and-audited" to
                MarProperty(::backEntry, { it.on == BackEnterAdministration }) { step ->
                    withClue("SI-10 clause b: back-dating is privileged and audited") {
                        (PRIVILEGED_AND_AUDITED in step.holding) shouldBe true
                        step.facts.context.auditWritable shouldBe true
                    }
                },
            "PropertyTest:SI-10-back-entry-keeps-clinical-time-and-label" to
                MarProperty(::backEntry, { it.on == BackEnterAdministration }) { step ->
                    val entry = step.facts.entries.backEntry
                    val clinicalTime = entry?.paperClinicalTime
                    withClue("SI-10 clause c: back-entry keeps the original clinical time, not later than receipt, and is labelled") {
                        entry?.labelledBackEntry shouldBe true
                        (clinicalTime != null && !clinicalTime.isAfter(step.facts.context.receivedAt)) shouldBe true
                    }
                },
            "PropertyTest:SI-12-unverified-outside-medicine-cannot-be-scanned" to
                MarProperty(::live, ::liveTransition) { step ->
                    withClue("SI-12 clause e: no live administration of a supply that is not cleared") {
                        (PATIENT_SUPPLIED_CLEARED in step.holding) shouldBe true
                    }
                },
            "PropertyTest:SI-13-high-alert-administration-needs-documented-independent-double-check" to
                MarProperty({ live(it) && it.facts.order.orderableHighAlert != false }, ::liveTransition) { step ->
                    withClue("SI-13: a live administration of a high-alert (or unknown-flag) order holds a double check of this dose") {
                        (HIGH_ALERT_CHECK_SATISFIED in step.holding) shouldBe true
                        step.facts.doubleCheck?.doseId shouldBe step.facts.dose.doseId
                    }
                },
            "PropertyTest:SI-13-double-check-needs-two-different-people" to
                MarProperty({ live(it) && it.facts.order.orderableHighAlert == true }, ::liveTransition) { step ->
                    val check = step.facts.doubleCheck
                    withClue("SI-13: the double check is by a second, authenticated, privileged person who attested") {
                        (check != null && check.checkerUserId != step.facts.actor.userId) shouldBe true
                        (check != null && check.checkerAuthenticated && check.checkerPrivileged && check.attested) shouldBe true
                    }
                },
            "PropertyTest:SI-15-offline-administration-only-against-orders-verified-before-outage" to
                MarProperty({ live(it) && it.facts.context.envelope?.mode?.offline == true }, ::liveTransition) { step ->
                    val verifiedAt = step.facts.order.verifiedAt
                    val outageStart = step.facts.context.envelope?.outageStart
                    withClue("SI-15: a live administration issued offline is against an order verified before the outage") {
                        (verifiedAt != null && outageStart != null && verifiedAt.isBefore(outageStart)) shouldBe true
                    }
                },
        )

    /** Every live check passed: a live command, an active verified order, the wristband scan and the product identity. */
    private fun fullyChecked(step: MarStep): Boolean {
        val order = step.facts.order
        return live(step) &&
            order.state == OrderState.ACTIVE &&
            order.verificationStatus == VerificationStatus.VERIFIED &&
            step.holding.containsAll(listOf(WRISTBAND_SCAN_MATCHES, PRODUCT_IDENTITY_MATCHES))
    }
}
