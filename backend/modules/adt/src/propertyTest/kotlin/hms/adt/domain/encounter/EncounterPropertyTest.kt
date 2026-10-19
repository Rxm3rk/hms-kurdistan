package hms.adt.domain.encounter

import hms.adt.domain.common.Answer
import hms.adt.domain.common.CommandChannel
import hms.adt.domain.common.ConnectivityMode
import hms.adt.domain.common.FinanceFacts
import hms.adt.domain.common.Occupancy
import hms.adt.domain.common.PreApprovalStatus
import hms.kernel.statemachine.Outcome
import hms.kernel.testing.statemachine.SequenceConfig
import hms.kernel.testing.statemachine.Step
import hms.kernel.testing.statemachine.StepCheck
import hms.kernel.testing.statemachine.runSequences
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldNotContain
import io.kotest.matchers.shouldBe

private typealias EncounterStep = Step<EncounterState, EncounterCommand, EncounterPredicate, EncounterEffect, EncounterFacts>
private typealias EncounterCheck = StepCheck<EncounterState, EncounterCommand, EncounterPredicate, EncounterEffect, EncounterFacts>

/**
 * The encounter machine's own safety properties at the specification layer: the generated model driven by
 * [EncounterGuards] over [EncounterArbs.facts] (docs/specs/modules/state-machines-and-invariants.md §3.3;
 * docs/specs/state-machines/encounter.md §5). Each property recomputes its rule from the raw facts, independently of
 * the predicates, after every step it applies to; each asserts that the transitions it is about fired. The sequence
 * budget is [hms.kernel.testing.PropertyTestBudget] (through [SequenceConfig]). Not a domain-layer verification (KA-062).
 */
class EncounterPropertyTest :
    FunSpec({
        fun run(
            name: String,
            vararg checks: EncounterCheck,
        ) = runSequences(
            name = name,
            spec = EncounterMachine.spec,
            holds = { predicate, facts -> EncounterMachine.holds(predicate, EncounterGuards, facts) },
            facts = EncounterArbs.facts,
            config = SequenceConfig(),
            checks = checks.toList(),
        )

        test("SI-12-no-rcm-state-blocks-a-clinical-command (encounter): payment facts never change any guard") {
            val check =
                EncounterCheck(
                    name = "changing the balance, deposit or pre-approval changes no predicate",
                    appliesTo = { true },
                    check = { step ->
                        FINANCE_VARIANTS.forEach { finance ->
                            withClue("finance $finance") { holding(step.facts.copy(finance = finance)) shouldBe step.holding }
                        }
                    },
                )
            run("encounter-SI-12-payment-facts-never-change-a-guard", check).requireFired(*(0..34).toList().toIntArray())
        }

        test("SI-12-pre-authorisation-never-blocks-discharge-or-emergency-care (encounter): discharge needs identity, disposition, time") {
            val check =
                EncounterCheck(
                    name = "Discharge fires whenever identity, disposition and (after admission) the time guard hold",
                    appliesTo = { step -> step.command == EncounterCommand.Discharge && step.from in DISCHARGEABLE },
                    check = { step ->
                        val facts = step.facts
                        val timeOk = step.from in BEFORE_ADMISSION || effectiveTimeAfterOpenEntries(facts)
                        val expected = identityConfirmed(facts.patientIdentification) && dispositionChosenRaw(facts) && timeOk
                        (step.outcome is Outcome.Fired) shouldBe expected
                    },
                )
            run("encounter-SI-12-discharge-refused-only-for-identity-disposition-time", check).requireFired(10, 11, 12)
        }

        test("SI-15-no-bed-or-ot-allocation-offline (encounter): no command issued offline places a patient in a bed") {
            val check =
                EncounterCheck(
                    name = "an allocating transition fired only for an in-cell channel or a client in the on-site-cell mode at issue",
                    appliesTo = { step -> step.firedIndex() in ALLOCATING },
                    check = { step ->
                        val facts = step.facts
                        val inCell = facts.channel == CommandChannel.IN_CELL
                        (inCell || facts.clientModeAtIssue == ConnectivityMode.ON_SITE_CELL) shouldBe true
                    },
                )
            run("encounter-SI-15-no-bed-allocation-offline", check).requireFired(*ALLOCATING.toIntArray())
        }

        test("SI-15-no-bed-or-ot-allocation-offline (encounter): internet loss alone never changes any guard") {
            val check =
                EncounterCheck(
                    name = "changing WAN reachability changes no predicate",
                    appliesTo = { true },
                    check = { step ->
                        listOf(true, false, null).forEach { wan ->
                            holding(step.facts.copy(wanReachable = wan)) shouldBe step.holding
                        }
                    },
                )
            run("encounter-SI-15-wan-loss-is-not-offline", check).requireFired(3, 4, 5)
        }

        test("SI-01-two-identifiers-on-every-patient-affecting-command (encounter): all but AdministrativeClose confirm two identifiers") {
            val patient =
                EncounterCheck(
                    name = "a fired patient-affecting transition carried an MRN and a DOB or approximate-DOB flag, both confirmed",
                    appliesTo = { step -> step.firedIndex() != null && step.command != EncounterCommand.AdministrativeClose },
                    check = { step -> identityConfirmed(step.facts.patientIdentification) shouldBe true },
                )
            val partner =
                EncounterCheck(
                    name = "a fired swap identified the partner as a patient with two confirmed identifiers",
                    appliesTo = { step -> step.firedIndex() in SWAPS },
                    check = { step -> identityConfirmed(step.facts.swap?.identification) shouldBe true },
                )
            val patientAffecting = (0..34).filter { it != ADMINISTRATIVE_CLOSE }.toIntArray()
            run("encounter-SI-01-two-identifiers", patient, partner).requireFired(*patientAffecting)
        }

        test("SI-01-location-never-an-identifier (encounter): no transition fires on a room, bed or location as an identifier") {
            val check =
                EncounterCheck(
                    name = "no fired transition's identification presents a location",
                    appliesTo = { step -> step.firedIndex() != null && step.command != EncounterCommand.AdministrativeClose },
                    check = { step ->
                        noLocation(step.facts.patientIdentification) shouldBe true
                        if (step.firedIndex() in SWAPS) noLocation(step.facts.swap?.identification) shouldBe true
                    },
                )
            run("encounter-SI-01-location-never-an-identifier", check).requireFired(0, 3, 5, 10)
        }

        test("SI-17-pending-results-at-discharge-go-to-owned-queue (encounter): every end of stay routes pending work to owners") {
            val check =
                EncounterCheck(
                    name = "a fired transition that ends the stay routes results and orders, or sends the record to identity correction",
                    appliesTo = { step -> step.firedIndex() in ENDS_OF_STAY },
                    check = { step ->
                        val effects = (step.outcome as Outcome.Fired).transition.effects
                        val routed =
                            EncounterEffect.ROUTE_PENDING_RESULTS_TO_OWNED_QUEUES in effects &&
                                EncounterEffect.NOTIFY_ORDERS_OF_ENCOUNTER_END in effects
                        (routed || EncounterEffect.ROUTE_TO_IDENTITY_CORRECTION_QUEUE in effects) shouldBe true
                        effects shouldContain EncounterEffect.DISSOCIATE_DEVICES
                    },
                )
            run("encounter-SI-17-every-end-of-stay-routes", check).requireFired(*ENDS_OF_STAY.toIntArray())
        }

        test("HAZ-0001 (encounter): a wrong-patient correction never sends the record to ordinary follow-up") {
            val check =
                EncounterCheck(
                    name = "a fired correction whose reason is wrong-patient routes to identity correction only",
                    appliesTo = { step ->
                        val wrongPatient = step.facts.errorReason?.value == ErrorReason.WRONG_PATIENT
                        step.firedIndex() != null && step.command in CORRECTIONS && wrongPatient
                    },
                    check = { step ->
                        val effects = (step.outcome as Outcome.Fired).transition.effects
                        effects shouldContain EncounterEffect.ROUTE_TO_IDENTITY_CORRECTION_QUEUE
                        effects shouldNotContain EncounterEffect.ROUTE_PENDING_RESULTS_TO_OWNED_QUEUES
                    },
                )
            run("encounter-HAZ-0001-wrong-patient-to-identity-correction", check).requireFired(23, 25)
        }

        test("HAZ-0001 (encounter): an admission or transfer never places the patient in a bed another encounter holds") {
            val check =
                EncounterCheck(
                    name = "after a fired admission or transfer no other encounter's valid period on the target bed overlaps the new one",
                    appliesTo = { step -> step.firedIndex() in ADMIT_OR_TRANSFER },
                    check = { step ->
                        val facts = step.facts
                        val bedId = requireNotNull(facts.targetBedId)
                        val start = requireNotNull(facts.effectiveTime)
                        val others =
                            facts.periods.filter { it.bedId == bedId && it.encounterId != facts.encounterId && !it.enteredInError }
                        others.none { Occupancy.overlaps(start, null, it.start, it.end) } shouldBe true
                    },
                )
            run("encounter-HAZ-0001-one-occupant-per-bed", check).requireFired(*ADMIT_OR_TRANSFER.toIntArray())
        }

        test("SI-10-back-dating-is-privileged-and-audited (encounter): back-entry and time correction fire only privileged and audited") {
            val check =
                EncounterCheck(
                    name = "a fired back-entry or time correction had the privilege and an accepted audit",
                    appliesTo = { step -> step.firedIndex() in BACK_DATING },
                    check = { step ->
                        step.facts.authorisation.commandPrivilege shouldBe Answer.YES
                        step.facts.authorisation.auditAccepted shouldBe Answer.YES
                    },
                )
            run("encounter-SI-10-back-dating-privileged-and-audited", check).requireFired(*BACK_DATING.toIntArray())
        }

        test("SI-10-back-entry-keeps-clinical-time-and-label (encounter): applied back-entries are labelled paper periods") {
            val check =
                EncounterCheck(
                    name = "every paper period of an applied back-entry is labelled, referenced and before the recorded time",
                    appliesTo = { step -> step.firedIndex() in BACK_ENTRY_APPLIED },
                    check = { step ->
                        val facts = step.facts
                        val recorded = requireNotNull(facts.recordedTime)
                        facts.backEntry.forEach { period ->
                            period.downtimeLabel shouldBe true
                            period.paperSourceReference.isNullOrBlank() shouldBe false
                            (requireNotNull(period.start) < recorded) shouldBe true
                        }
                    },
                )
            run("encounter-SI-10-back-entry-labelled", check).requireFired(*BACK_ENTRY_APPLIED.toIntArray())
        }
    }) {
    private companion object {
        const val ADMINISTRATIVE_CLOSE = 13
        val ALLOCATING = listOf(3, 4, 5, 6, 7, 14, 15, 16, 17, 27, 30)
        val SWAPS = listOf(5, 6)
        val ADMIT_OR_TRANSFER = listOf(3, 4)
        val ENDS_OF_STAY = listOf(1, 10, 11, 12, 22, 23, 24, 25)
        val BACK_DATING = (27..34).toList()
        val BACK_ENTRY_APPLIED = listOf(27, 30)
        val CORRECTIONS = setOf(EncounterCommand.CancelAdmission, EncounterCommand.MarkEnteredInError)
        val DISCHARGEABLE = setOf(EncounterState.IN_PROGRESS, EncounterState.ON_LEAVE, EncounterState.ARRIVED, EncounterState.TRIAGED)
        val BEFORE_ADMISSION = setOf(EncounterState.ARRIVED, EncounterState.TRIAGED)
        val FINANCE_VARIANTS =
            listOf(
                FinanceFacts(null, Answer.UNKNOWN, PreApprovalStatus.UNKNOWN),
                FinanceFacts(Long.MAX_VALUE, Answer.NO, PreApprovalStatus.DENIED),
                FinanceFacts(0, Answer.YES, PreApprovalStatus.APPROVED),
                FinanceFacts(1_500_000, Answer.NO, PreApprovalStatus.MISSING),
            )

        fun holding(facts: EncounterFacts): Set<EncounterPredicate> =
            EncounterPredicate.entries.filter { EncounterMachine.holds(it, EncounterGuards, facts) }.toSet()

        fun noLocation(identification: PatientIdentification?): Boolean =
            identification?.presented.orEmpty().none { it.isLocation }

        fun EncounterStep.firedIndex(): Int? = (outcome as? Outcome.Fired)?.transition?.index

        /** SI-01 recomputed from the raw facts. */
        fun identityConfirmed(identification: PatientIdentification?): Boolean {
            if (identification == null) return false
            val presented = identification.presented
            return IdentifierKind.MRN in presented &&
                (IdentifierKind.DATE_OF_BIRTH in presented || IdentifierKind.APPROXIMATE_DOB_FLAG in presented) &&
                presented.none { it.isLocation } &&
                identification.mrnCheckDigitValid == Answer.YES &&
                identification.secondIdentifierConfirmed == Answer.YES
        }

        fun dispositionChosenRaw(facts: EncounterFacts): Boolean {
            val chosen = facts.disposition ?: return false
            val list = facts.tenantDispositions?.takeIf { it.isNotEmpty() } ?: EncounterGuards.BASELINE_DISPOSITIONS
            return chosen.byUser && chosen.value in list
        }

        fun effectiveTimeAfterOpenEntries(facts: EncounterFacts): Boolean {
            val at = if (facts.backEntry.isNotEmpty()) facts.backEntry.first().start else facts.effectiveTime
            if (at == null) return false
            val own = facts.encounterId
            val starts =
                facts.periods.filter { it.encounterId == own && !it.enteredInError && it.end == null }.map { it.start } +
                    facts.leaveEntries.filter { it.encounterId == own && !it.enteredInError && it.end == null }.map { it.start }
            return starts.isNotEmpty() && starts.all { at > it }
        }
    }
}
