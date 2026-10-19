package hms.medications.domain.medicationadministration

import hms.kernel.statemachine.Outcome
import hms.kernel.statemachine.Transition
import hms.kernel.testing.statemachine.RunStats
import hms.kernel.testing.statemachine.SequenceConfig
import hms.kernel.testing.statemachine.Step
import hms.kernel.testing.statemachine.StepCheck
import hms.kernel.testing.statemachine.runSequences
import hms.medications.domain.medicationadministration.MedicationAdministrationCommand.BackEnterAdministration
import hms.medications.domain.medicationadministration.MedicationAdministrationCommand.Complete
import hms.medications.domain.medicationadministration.MedicationAdministrationCommand.Give
import hms.medications.domain.medicationadministration.MedicationAdministrationCommand.GiveWithOverride
import hms.medications.domain.medicationadministration.MedicationAdministrationCommand.RecordOfflineAdministration
import hms.medications.domain.medicationadministration.MedicationAdministrationCommand.StartInfusion
import hms.medications.domain.medicationadministration.MedicationAdministrationCommand.StartInfusionWithOverride
import hms.medications.domain.medicationadministration.MedicationAdministrationCommand.Stop
import hms.medications.domain.medicationadministration.MedicationAdministrationEffect.CREATE_ADMINISTRATION_REVIEW_TASK
import hms.medications.domain.medicationadministration.MedicationAdministrationEffect.CREATE_INFUSION_STOP_TASK
import hms.medications.domain.medicationadministration.MedicationAdministrationEffect.CREATE_PHARMACIST_REVIEW_TASK
import hms.medications.domain.medicationadministration.MedicationAdministrationEffect.CREATE_WRISTBAND_REPRINT_TASK
import hms.medications.domain.medicationadministration.MedicationAdministrationEffect.EMIT_MEDICATION_ADMINISTERED
import hms.medications.domain.medicationadministration.MedicationAdministrationEffect.EMIT_MEDICATION_NOT_GIVEN
import hms.medications.domain.medicationadministration.MedicationAdministrationEffect.REPORT_OVERRIDE
import hms.medications.domain.medicationadministration.MedicationAdministrationPredicate.ACTIVE_VERIFIED_ORDER
import hms.medications.domain.medicationadministration.MedicationAdministrationPredicate.BACK_ENTRY_DOCUMENTED
import hms.medications.domain.medicationadministration.MedicationAdministrationPredicate.CLINICAL_TIME_CONTEMPORANEOUS
import hms.medications.domain.medicationadministration.MedicationAdministrationPredicate.EMERGENCY_OVERRIDE_LISTED
import hms.medications.domain.medicationadministration.MedicationAdministrationPredicate.FIRST_DOSE_OF_ORDER
import hms.medications.domain.medicationadministration.MedicationAdministrationPredicate.HIGH_ALERT_CHECK_SATISFIED
import hms.medications.domain.medicationadministration.MedicationAdministrationPredicate.ISSUED_OFFLINE_AND_SYNCED
import hms.medications.domain.medicationadministration.MedicationAdministrationPredicate.LATE_DOSE_WINDOW_ELAPSED
import hms.medications.domain.medicationadministration.MedicationAdministrationPredicate.MANUAL_TWO_IDENTIFIERS_CONFIRMED
import hms.medications.domain.medicationadministration.MedicationAdministrationPredicate.OFFLINE_ALLOWED
import hms.medications.domain.medicationadministration.MedicationAdministrationPredicate.ORDER_AWAITING_VERIFICATION
import hms.medications.domain.medicationadministration.MedicationAdministrationPredicate.OVERRIDE_REASON_ENTERED
import hms.medications.domain.medicationadministration.MedicationAdministrationPredicate.PATIENT_SUPPLIED_CLEARED
import hms.medications.domain.medicationadministration.MedicationAdministrationPredicate.PRIVILEGED_AND_AUDITED
import hms.medications.domain.medicationadministration.MedicationAdministrationPredicate.PRODUCT_IDENTITY_MATCHES
import hms.medications.domain.medicationadministration.MedicationAdministrationPredicate.PRODUCT_NOT_IDENTIFIED
import hms.medications.domain.medicationadministration.MedicationAdministrationPredicate.REASON_ON_IDENTITY_OVERRIDE_LIST
import hms.medications.domain.medicationadministration.MedicationAdministrationPredicate.REASON_ON_SCAN_OVERRIDE_LIST
import hms.medications.domain.medicationadministration.MedicationAdministrationPredicate.REASON_ON_VERIFICATION_OVERRIDE_LIST
import hms.medications.domain.medicationadministration.MedicationAdministrationPredicate.WRISTBAND_SCAN_MATCHES
import hms.medications.domain.medicationadministration.MedicationAdministrationPredicate.WRISTBAND_SCAN_UNUSABLE
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldContainAll
import io.kotest.matchers.collections.shouldNotContain
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import java.lang.reflect.ParameterizedType
import java.lang.reflect.Type
import java.time.Duration
import java.time.LocalDate

// Machine-level properties of the medication-administration machine (docs/specs/state-machines/medication-administration.yaml
// and .md "Properties this file supports"; WP-0.5 spec §3.3, §4; hazard H2 through HAZ-0001, HAZ-0002, HAZ-0003, HAZ-0005,
// HAZ-0010, HAZ-0012, HAZ-0013, HAZ-0015). Each test runs random command sequences at the property budget
// (PropertyTestBudget, through SequenceConfig) with StepChecks whose appliesTo names the steps the property speaks about,
// and asserts with requireFired that the transitions it is about fired. Where a check can, it reads the raw facts rather
// than the predicates, so it does not merely repeat MedicationAdministrationGuards. Specification layer only: the MAR
// aggregate does not exist yet. Synthetic facts only (MedicationAdministrationArbs; NOT FOR CLINICAL USE).

private typealias MarStep =
    Step<
        MedicationAdministrationState,
        MedicationAdministrationCommand,
        MedicationAdministrationPredicate,
        MedicationAdministrationEffect,
        MedicationAdministrationFacts,
    >
private typealias MarCheck =
    StepCheck<
        MedicationAdministrationState,
        MedicationAdministrationCommand,
        MedicationAdministrationPredicate,
        MedicationAdministrationEffect,
        MedicationAdministrationFacts,
    >
private typealias MarTransition =
    Transition<
        MedicationAdministrationState,
        MedicationAdministrationCommand,
        MedicationAdministrationPredicate,
        MedicationAdministrationEffect,
    >
private typealias MarOutcome =
    Outcome<
        MedicationAdministrationState,
        MedicationAdministrationCommand,
        MedicationAdministrationPredicate,
        MedicationAdministrationEffect,
    >

// Transition indexes in medication-administration.yaml's transitions list (0-based); a test below checks them.
private const val GIVE = 0
private const val START_INFUSION = 1
private const val GIVE_SCAN_OVERRIDE = 2
private const val GIVE_VERIFICATION_OVERRIDE = 3
private const val GIVE_WRISTBAND_OVERRIDE = 4
private const val START_SCAN_OVERRIDE = 5
private const val START_VERIFICATION_OVERRIDE = 6
private const val START_WRISTBAND_OVERRIDE = 7
private const val RECORD_OFFLINE_GIVE = 8
private const val RECORD_OFFLINE_INFUSION = 9
private const val BACK_ENTRY = 10
private const val COMPLETE = 13
private const val STOP = 14
private const val ORDER_ENDED_SCHEDULED = 15
private const val ORDER_ENDED_RUNNING = 16

private val SCAN_OVERRIDES = intArrayOf(GIVE_SCAN_OVERRIDE, START_SCAN_OVERRIDE)
private val VERIFICATION_OVERRIDES = intArrayOf(GIVE_VERIFICATION_OVERRIDE, START_VERIFICATION_OVERRIDE)
private val WRISTBAND_OVERRIDES = intArrayOf(GIVE_WRISTBAND_OVERRIDE, START_WRISTBAND_OVERRIDE)
private val OVERRIDES = SCAN_OVERRIDES + VERIFICATION_OVERRIDES + WRISTBAND_OVERRIDES
private val RECORDS_AFTER_THE_FACT = intArrayOf(RECORD_OFFLINE_GIVE, RECORD_OFFLINE_INFUSION, BACK_ENTRY)
private val LIVE_ADMINISTRATIONS = intArrayOf(GIVE, START_INFUSION) + OVERRIDES
private val ADMINISTRATIONS = LIVE_ADMINISTRATIONS + RECORDS_AFTER_THE_FACT
private val LIVE_GIVES = intArrayOf(GIVE, GIVE_SCAN_OVERRIDE, GIVE_VERIFICATION_OVERRIDE, GIVE_WRISTBAND_OVERRIDE)
private val RECORD_OFFLINE = intArrayOf(RECORD_OFFLINE_GIVE, RECORD_OFFLINE_INFUSION)
private val ORDER_ENDED = intArrayOf(ORDER_ENDED_SCHEDULED, ORDER_ENDED_RUNNING)
private val RECORDED_AND_REVIEWED = listOf(REPORT_OVERRIDE, CREATE_ADMINISTRATION_REVIEW_TASK, EMIT_MEDICATION_ADMINISTERED)
private val VERIFICATION_REPLACEMENT =
    listOf(ORDER_AWAITING_VERIFICATION, EMERGENCY_OVERRIDE_LISTED, FIRST_DOSE_OF_ORDER, REASON_ON_VERIFICATION_OVERRIDE_LIST)

private val ADMINISTERED =
    setOf(MedicationAdministrationState.COMPLETED, MedicationAdministrationState.IN_PROGRESS, MedicationAdministrationState.STOPPED)
private val OVERRIDE_COMMANDS = setOf(GiveWithOverride, StartInfusionWithOverride)
private val ADMINISTERING_COMMANDS = setOf(Give, StartInfusion, RecordOfflineAdministration, BackEnterAdministration) + OVERRIDE_COMMANDS

/** Words that would name a financial fact (SI-12): no property of the facts may contain one. */
private val FINANCIAL_WORDS =
    listOf("pay", "deposit", "bill", "price", "charge", "invoice", "preauth", "authorisation", "coverage", "insur", "tariff", "balance")

private val spec = MedicationAdministrationMachine.spec

private fun fire(
    state: MedicationAdministrationState,
    command: MedicationAdministrationCommand,
    facts: MedicationAdministrationFacts,
): MarOutcome = MedicationAdministrationMachine.fire(state, command, MedicationAdministrationGuards, facts)

private fun MarStep.fired(): MarTransition? = (outcome as? Outcome.Fired)?.transition

private fun MarStep.firedIndex(): Int? = fired()?.index

private fun MarStep.firedOneOf(indexes: IntArray): Boolean = firedIndex()?.let { it in indexes } == true

private fun MarStep.effects(): List<MedicationAdministrationEffect> = fired()?.effects.orEmpty()

private fun MarOutcome.summary(): Pair<MedicationAdministrationState, Int?> = state to (this as? Outcome.Fired)?.transition?.index

private fun check(
    name: String,
    appliesTo: (MarStep) -> Boolean,
    check: (MarStep) -> Unit,
): MarCheck = StepCheck(name, appliesTo, check)

private fun run(
    name: String,
    vararg checks: MarCheck,
): RunStats =
    runSequences(
        name = name,
        spec = spec,
        holds = { predicate, facts -> MedicationAdministrationMachine.holds(predicate, MedicationAdministrationGuards, facts) },
        facts = MedicationAdministrationArbs.facts,
        config = SequenceConfig(),
        checks = checks.toList(),
    )

// ---- Independent readings of the raw facts (test oracles, not the guards)

private fun MedicationAdministrationFacts.clinicalDate(): LocalDate? =
    context.envelope
        ?.issuedAt
        ?.atZone(configuration.facilityZone)
        ?.toLocalDate()

/** The products this dose may be given from, read straight from the order, the dispense records and the brand master. */
private fun MedicationAdministrationFacts.acceptableProducts(): Set<String> =
    when (order.verificationStatus) {
        VerificationStatus.VERIFIED -> {
            order.verifiedProductLine?.productIds.orEmpty() +
                supplies.dispenseRecords
                    .filter { it.patientId == dose.patientId && it.orderId == order.orderId }
                    .flatMap { it.productIds }
        }

        VerificationStatus.PENDING -> {
            configuration.formulary.filterValues { it.orderableId == order.orderableId }.keys
        }

        VerificationStatus.RETURNED, null -> {
            emptySet()
        }
    }

private fun MedicationAdministrationFacts.isMismatch(scan: ProductScan.Identified): Boolean {
    val date = clinicalDate()
    val expiry = scan.expiry
    val expired = expiry != null && (date == null || expiry.isBefore(date))
    return scan.productId !in acceptableProducts() || expired
}

/** An identified product scan on the dose's log that failed the identity match and that no pharmacist cleared. */
private fun MedicationAdministrationFacts.hasUnclearedProductMismatch(): Boolean =
    scans.log.productScans.any { logged ->
        val scan = logged.scan
        !logged.clearedByPharmacist && scan is ProductScan.Identified && isMismatch(scan)
    }

/** A wristband scan (the command's or the log's) that decoded an MRN not confirmed as this patient's. */
private fun MedicationAdministrationFacts.hasWrongPatientScan(): Boolean =
    (scans.log.wristbandScans + listOfNotNull(scans.wristband)).any { scan ->
        val identity = scan.identity
        scan.decodedMrn != null && (identity == null || !identity.checkDigitValid || identity.patientId != dose.patientId)
    }

private fun MrnIdentity?.isCurrentMrnOf(patientId: String): Boolean = this != null && this.patientId == patientId && currentForPatient

private fun MedicationAdministrationFacts.isHighAlert(): Boolean {
    val scan = scans.product as? ProductScan.Identified
    return order.orderableHighAlert != false || (scan != null && configuration.formulary[scan.productId]?.highAlert != false)
}

private fun MedicationAdministrationFacts.issuedOffline(): Boolean = context.envelope?.mode?.offline != false

/** Every class reachable from the facts through properties declared in this package (SI-12 structural check). */
private fun factsClasses(): Set<Class<*>> {
    val found = linkedSetOf<Class<*>>()
    val pending = ArrayDeque<Class<*>>(listOf(MedicationAdministrationFacts::class.java))
    while (pending.isNotEmpty()) {
        val type = pending.removeFirst()
        if (type.packageName != MedicationAdministrationFacts::class.java.packageName || !found.add(type)) continue
        pending += type.declaredClasses
        type.declaredFields.forEach { field -> pending += classesOf(field.genericType) }
    }
    return found
}

private fun classesOf(type: Type): List<Class<*>> =
    when (type) {
        is Class<*> -> listOf(type)
        is ParameterizedType -> classesOf(type.rawType) + type.actualTypeArguments.flatMap { classesOf(it) }
        else -> emptyList()
    }

/**
 * The machine-level safety properties of the medication-administration machine. Test names start with the SI they
 * serve and carry the hazard log's planned `PropertyTest:SI-nn-...` name where one exists (docs/safety/hazard-log.yaml).
 */
class MedicationAdministrationPropertyTest :
    FunSpec({
        test("the transition index constants of this test match medication-administration.yaml") {
            val expected =
                mapOf(
                    GIVE to Give,
                    START_INFUSION to StartInfusion,
                    GIVE_SCAN_OVERRIDE to GiveWithOverride,
                    GIVE_VERIFICATION_OVERRIDE to GiveWithOverride,
                    GIVE_WRISTBAND_OVERRIDE to GiveWithOverride,
                    START_SCAN_OVERRIDE to StartInfusionWithOverride,
                    START_VERIFICATION_OVERRIDE to StartInfusionWithOverride,
                    START_WRISTBAND_OVERRIDE to StartInfusionWithOverride,
                    RECORD_OFFLINE_GIVE to RecordOfflineAdministration,
                    RECORD_OFFLINE_INFUSION to RecordOfflineAdministration,
                    BACK_ENTRY to BackEnterAdministration,
                    ORDER_ENDED_SCHEDULED to MedicationAdministrationCommand.OrderEnded,
                    ORDER_ENDED_RUNNING to MedicationAdministrationCommand.OrderEnded,
                    COMPLETE to Complete,
                    STOP to Stop,
                )
            expected.forEach { (index, command) -> spec.transitions[index].on shouldBe command }
            SCAN_OVERRIDES.forEach { spec.transitions[it].guard shouldContain PRODUCT_NOT_IDENTIFIED }
            VERIFICATION_OVERRIDES.forEach { spec.transitions[it].guard shouldContain ORDER_AWAITING_VERIFICATION }
            WRISTBAND_OVERRIDES.forEach { spec.transitions[it].guard shouldContain WRISTBAND_SCAN_UNUSABLE }
            spec.transitions[ORDER_ENDED_SCHEDULED].from shouldBe setOf(MedicationAdministrationState.SCHEDULED)
            spec.transitions[ORDER_ENDED_RUNNING].from shouldBe setOf(MedicationAdministrationState.IN_PROGRESS)
            spec.transitions
                .filter { it.from == setOf(MedicationAdministrationState.SCHEDULED) && it.to in ADMINISTERED }
                .map { it.index }
                .sorted() shouldBe ADMINISTRATIONS.sorted()
        }

        test(
            "SI-02 (medication-administration): no administration without an active verified order or a documented override " +
                "(PropertyTest:SI-02-no-administration-without-active-verified-order-or-documented-override)",
        ) {
            var administeredInSequence = false
            val stats =
                run(
                    "medication-administration SI-02-no-administration-without-active-verified-order-or-documented-override",
                    check(
                        "a live give holds an active verified order, a matching wristband and the identified product",
                        appliesTo = { it.firedOneOf(intArrayOf(GIVE, START_INFUSION)) },
                    ) { step ->
                        step.holding shouldContainAll listOf(ACTIVE_VERIFIED_ORDER, WRISTBAND_SCAN_MATCHES, PRODUCT_IDENTITY_MATCHES)
                        val order = step.facts.order
                        withClue("raw order facts") {
                            order.kind shouldBe OrderKind.MEDICATION
                            order.patientId shouldBe step.facts.dose.patientId
                            order.state shouldBe OrderState.ACTIVE
                            order.verificationStatus shouldBe VerificationStatus.VERIFIED
                        }
                    },
                    check(
                        "an override replaces exactly one check, holds its replacement, a chosen listed reason, and is reported",
                        appliesTo = { it.firedOneOf(OVERRIDES) },
                    ) { step ->
                        val holding = step.holding
                        val replaced =
                            listOf(ACTIVE_VERIFIED_ORDER, WRISTBAND_SCAN_MATCHES, PRODUCT_IDENTITY_MATCHES).filter { it !in holding }
                        withClue("replaced checks $replaced") { replaced.size shouldBe 1 }
                        holding shouldContain OVERRIDE_REASON_ENTERED
                        val replacement =
                            when (replaced.single()) {
                                ACTIVE_VERIFIED_ORDER -> {
                                    VERIFICATION_REPLACEMENT
                                }

                                WRISTBAND_SCAN_MATCHES -> {
                                    listOf(WRISTBAND_SCAN_UNUSABLE, MANUAL_TWO_IDENTIFIERS_CONFIRMED, REASON_ON_IDENTITY_OVERRIDE_LIST)
                                }

                                else -> {
                                    listOf(PRODUCT_NOT_IDENTIFIED, REASON_ON_SCAN_OVERRIDE_LIST)
                                }
                            }
                        holding shouldContainAll replacement
                        step.effects() shouldContain REPORT_OVERRIDE
                    },
                    check(
                        "a record after the fact is reported and reviewed",
                        appliesTo = { it.firedOneOf(RECORDS_AFTER_THE_FACT) },
                    ) { step ->
                        step.effects() shouldContainAll RECORDED_AND_REVIEWED
                        if (step.command == BackEnterAdministration) {
                            val backEntry = listOf(PRIVILEGED_AND_AUDITED, BACK_ENTRY_DOCUMENTED, MANUAL_TWO_IDENTIFIERS_CONFIRMED)
                            step.holding shouldContainAll backEntry
                        } else {
                            step.holding shouldContain ISSUED_OFFLINE_AND_SYNCED
                        }
                    },
                    // A path property (md "Properties this file supports"): appliesTo also records, for the step's sequence,
                    // whether a transition from scheduled into an administered state has fired yet.
                    check(
                        "every sequence that reaches an administered state passed through an administration from scheduled",
                        appliesTo = { step ->
                            if (step.index == 0) administeredInSequence = false
                            if (step.firedOneOf(ADMINISTRATIONS)) administeredInSequence = true
                            step.fired() != null && step.outcome.state in ADMINISTERED
                        },
                    ) { withClue("no administration from scheduled earlier in the sequence") { administeredInSequence shouldBe true } },
                )
            stats.requireFired(*ADMINISTRATIONS, COMPLETE, STOP)
        }

        test(
            "SI-02 (medication-administration): an override never waives SI-01, SI-12, SI-13 or SI-15 " +
                "(PropertyTest:SI-02-override-never-waives-SI-01-SI-12-SI-13-SI-15)",
        ) {
            val stats =
                run(
                    "medication-administration SI-02-override-never-waives-SI-01-SI-12-SI-13-SI-15",
                    check("an override holds every SI-01, SI-12, SI-13 and SI-15 guard", appliesTo = { it.firedOneOf(OVERRIDES) }) { step ->
                        step.holding shouldContainAll listOf(HIGH_ALERT_CHECK_SATISFIED, PATIENT_SUPPLIED_CLEARED, OFFLINE_ALLOWED)
                        withClue("SI-01: the wristband scan or the keyed two identifiers") {
                            (WRISTBAND_SCAN_MATCHES in step.holding || MANUAL_TWO_IDENTIFIERS_CONFIRMED in step.holding) shouldBe true
                        }
                    },
                    check(
                        "SI-13 on an override: a high-alert dose has a double check by a second person (raw facts)",
                        appliesTo = { it.firedOneOf(OVERRIDES) && it.facts.isHighAlert() },
                    ) { step ->
                        val check = step.facts.doubleCheck
                        check shouldNotBe null
                        check?.checkerUserId shouldNotBe step.facts.actor.userId
                    },
                    check(
                        "SI-15 on an override: offline only against an order verified before the outage (raw facts)",
                        appliesTo = { it.firedOneOf(OVERRIDES) && it.facts.issuedOffline() },
                    ) { step ->
                        val verifiedAt = step.facts.order.verifiedAt
                        val outageStart =
                            step.facts.context.envelope
                                ?.outageStart
                        withClue("verified $verifiedAt, outage $outageStart") {
                            (verifiedAt != null && outageStart != null && verifiedAt.isBefore(outageStart)) shouldBe true
                        }
                    },
                )
            stats.requireFired(*OVERRIDES)
        }

        test(
            "SI-02 (medication-administration): every override and every record after the fact is reported " +
                "(PropertyTest:SI-02-every-override-reportable)",
        ) {
            val stats =
                run(
                    "medication-administration SI-02-every-override-reportable",
                    check(
                        "an override or a record after the fact emits reportOverride, and a live give does not",
                        appliesTo = { it.command in ADMINISTERING_COMMANDS && it.fired() != null },
                    ) { step ->
                        if (step.command in OVERRIDE_COMMANDS || step.firedOneOf(RECORDS_AFTER_THE_FACT)) {
                            step.effects() shouldContain REPORT_OVERRIDE
                        } else {
                            step.effects() shouldNotContain REPORT_OVERRIDE
                        }
                    },
                    check(
                        "an override's reason was chosen by the administering user, never defaulted " +
                            "(PropertyTest:SI-02-override-reason-never-defaulted)",
                        appliesTo = { it.firedOneOf(OVERRIDES) },
                    ) { step ->
                        val reason = step.facts.entries.overrideReason
                        reason?.chosenByUser shouldBe true
                        reason?.enteredBy shouldBe step.facts.actor.userId
                    },
                    check(
                        "a wristband-failure override raises the wristband reprint task",
                        appliesTo = { it.firedOneOf(WRISTBAND_OVERRIDES) },
                    ) { step -> step.effects() shouldContain CREATE_WRISTBAND_REPRINT_TASK },
                )
            stats.requireFired(*OVERRIDES, *RECORDS_AFTER_THE_FACT)
        }

        test(
            "SI-02 (medication-administration): an identified product mismatch blocks the product-scan override, " +
                "and a wrong-patient scan the wristband-failure override",
        ) {
            val stats =
                run(
                    "medication-administration SI-02-identified-mismatch-blocks-the-override",
                    check(
                        "a product-scan override fires only with no product identified and no uncleared mismatch on the log (raw facts)",
                        appliesTo = { it.firedOneOf(SCAN_OVERRIDES) },
                    ) { step ->
                        (step.facts.scans.product is ProductScan.Identified) shouldBe false
                        step.facts.hasUnclearedProductMismatch() shouldBe false
                    },
                    check(
                        "an override command with an uncleared product mismatch on the log never fires a product-scan override",
                        appliesTo = { it.command in OVERRIDE_COMMANDS && it.facts.hasUnclearedProductMismatch() },
                    ) { step -> step.firedOneOf(SCAN_OVERRIDES) shouldBe false },
                    check(
                        "an override command with a wrong-patient wristband scan never fires a wristband-failure override",
                        appliesTo = { it.command in OVERRIDE_COMMANDS && it.facts.hasWrongPatientScan() },
                    ) { step -> step.firedOneOf(WRISTBAND_OVERRIDES) shouldBe false },
                    check(
                        "a wristband-failure override fires only when every decoded MRN is this patient's (raw facts)",
                        appliesTo = { it.firedOneOf(WRISTBAND_OVERRIDES) },
                    ) { step -> step.facts.hasWrongPatientScan() shouldBe false },
                )
            stats.requireFired(*SCAN_OVERRIDES, *WRISTBAND_OVERRIDES)
        }

        test(
            "SI-05 (medication-administration): every dose given before verification creates the pharmacist review task " +
                "(PropertyTest:SI-05-review-task-within-4h-of-dose-before-verification)",
        ) {
            val stats =
                run(
                    "medication-administration SI-05-review-task-within-4h-of-dose-before-verification",
                    check(
                        "an administration without an active verified order is a reviewed verification override or a reviewed record",
                        appliesTo = { it.firedOneOf(ADMINISTRATIONS) && ACTIVE_VERIFIED_ORDER !in it.holding },
                    ) { step ->
                        if (step.firedOneOf(RECORDS_AFTER_THE_FACT)) {
                            step.effects() shouldContain CREATE_ADMINISTRATION_REVIEW_TASK
                        } else {
                            step.firedOneOf(VERIFICATION_OVERRIDES) shouldBe true
                            step.effects() shouldContain CREATE_PHARMACIST_REVIEW_TASK
                            step.holding shouldContainAll VERIFICATION_REPLACEMENT
                            step.facts.order.verificationStatus shouldBe VerificationStatus.PENDING
                        }
                    },
                    check(
                        "a live give: the entered amount equals the fixed ordered dose exactly, in the same unit (raw facts)",
                        appliesTo = { it.firedOneOf(LIVE_GIVES) },
                    ) { step ->
                        val ordered = (step.facts.order.orderedDose as? OrderedDose.Fixed)?.quantity
                        val entered =
                            step.facts.entries.enteredAmount
                                ?.quantity
                        withClue("entered $entered, ordered $ordered") {
                            val exact =
                                ordered != null &&
                                    entered != null &&
                                    entered.unit == ordered.unit &&
                                    entered.value.compareTo(ordered.value) == 0
                            exact shouldBe true
                        }
                    },
                )
            stats.requireFired(*VERIFICATION_OVERRIDES)
        }

        test(
            "SI-13 (medication-administration): a high-alert dose needs an independent double check by two different people " +
                "(PropertyTest:SI-13-double-check-needs-two-different-people)",
        ) {
            val stats =
                run(
                    "medication-administration SI-13-double-check-needs-two-different-people",
                    check(
                        "a live high-alert administration has an attested check by another authenticated, privileged user (raw facts)",
                        appliesTo = { it.firedOneOf(LIVE_ADMINISTRATIONS) && it.facts.isHighAlert() },
                    ) { step ->
                        val check = step.facts.doubleCheck
                        check shouldNotBe null
                        check?.checkerUserId shouldNotBe step.facts.actor.userId
                        check?.doseId shouldBe step.facts.dose.doseId
                        check?.checkerAuthenticated shouldBe true
                        check?.checkerPrivileged shouldBe true
                        check?.attested shouldBe true
                    },
                )
            stats.requireFired(GIVE, START_INFUSION)
        }

        test(
            "SI-15 (medication-administration): offline, a dose is given only against an order verified before the outage " +
                "(PropertyTest:SI-15-offline-administration-only-against-orders-verified-before-outage)",
        ) {
            val stats =
                run(
                    "medication-administration SI-15-offline-administration-only-against-orders-verified-before-outage",
                    check(
                        "a live administration issued offline: the order was verified strictly before that outage (raw facts)",
                        appliesTo = { it.firedOneOf(LIVE_ADMINISTRATIONS) && it.facts.issuedOffline() },
                    ) { step ->
                        val verifiedAt = step.facts.order.verifiedAt
                        val outageStart =
                            step.facts.context.envelope
                                ?.outageStart
                        withClue("verified $verifiedAt, outage $outageStart") {
                            (verifiedAt != null && outageStart != null && verifiedAt.isBefore(outageStart)) shouldBe true
                        }
                        step.firedOneOf(VERIFICATION_OVERRIDES) shouldBe false
                    },
                    check(
                        "an offline-issued dose the server refused is recorded, reported and reviewed, never dropped (CTRL-0015-9)",
                        appliesTo = { it.firedOneOf(RECORD_OFFLINE) },
                    ) { step ->
                        step.facts.issuedOffline() shouldBe true
                        step.effects() shouldContainAll RECORDED_AND_REVIEWED
                    },
                )
            stats.requireFired(RECORD_OFFLINE_GIVE, RECORD_OFFLINE_INFUSION)
        }

        test(
            "SI-01 (medication-administration): a location label never identifies the patient " +
                "(PropertyTest:SI-01-location-never-an-identifier)",
        ) {
            val stats =
                run(
                    "medication-administration SI-01-location-never-an-identifier",
                    check(
                        "a scan read from a bed, room, chart, other location or unknown label neither matches nor counts as unusable",
                        appliesTo = { step ->
                            step.facts.scans.wristband
                                ?.let { it.labelKind != LabelKind.PATIENT_WRISTBAND } == true
                        },
                    ) { step ->
                        step.holding shouldNotContain WRISTBAND_SCAN_MATCHES
                        step.holding shouldNotContain WRISTBAND_SCAN_UNUSABLE
                    },
                    check(
                        "a live administration or back-entry confirms two identifiers of this patient (raw facts)",
                        appliesTo = { it.firedOneOf(LIVE_ADMINISTRATIONS + BACK_ENTRY) },
                    ) { step ->
                        val facts = step.facts
                        val band = facts.scans.wristband?.takeIf { it.labelKind == LabelKind.PATIENT_WRISTBAND }
                        val scanned = band?.identity.isCurrentMrnOf(facts.dose.patientId)
                        val keyed =
                            facts.entries.manualIdentification
                                ?.keyedMrnIdentity
                                .isCurrentMrnOf(facts.dose.patientId)
                        withClue("wristband scan or keyed identifiers of ${facts.dose.patientId}") { (scanned || keyed) shouldBe true }
                    },
                )
            stats.requireFired(*WRISTBAND_OVERRIDES, BACK_ENTRY)
        }

        test(
            "SI-10 (medication-administration): back-dating is privileged and audited " +
                "(PropertyTest:SI-10-back-dating-is-privileged-and-audited)",
        ) {
            val stats =
                run(
                    "medication-administration SI-10-back-dating-is-privileged-and-audited",
                    check(
                        "a live administration takes the device's issue time, no later than receipt plus the allowance (raw facts)",
                        appliesTo = { it.firedOneOf(LIVE_ADMINISTRATIONS) },
                    ) { step ->
                        val facts = step.facts
                        val issuedAt = facts.context.envelope?.issuedAt
                        val allowance = facts.configuration.clockSkewAllowance ?: Duration.ZERO
                        step.holding shouldContain CLINICAL_TIME_CONTEMPORANEOUS
                        facts.entries.userEnteredClinicalTime shouldBe null
                        issuedAt shouldNotBe null
                        issuedAt?.isAfter(facts.context.receivedAt.plus(allowance)) shouldBe false
                    },
                    check(
                        "a back-entry is privileged, audited, labelled and keeps a paper time no later than receipt (raw facts)",
                        appliesTo = { it.firedOneOf(intArrayOf(BACK_ENTRY)) },
                    ) { step ->
                        val facts = step.facts
                        step.holding shouldContain PRIVILEGED_AND_AUDITED
                        facts.context.auditWritable shouldBe true
                        facts.entries.backEntry?.labelledBackEntry shouldBe true
                        facts.entries.backEntry
                            ?.paperClinicalTime
                            ?.isAfter(facts.context.receivedAt) shouldBe false
                    },
                )
            stats.requireFired(BACK_ENTRY)
        }

        test(
            "SI-12 (medication-administration): an unverified outside medicine is never given " +
                "(PropertyTest:SI-12-unverified-outside-medicine-cannot-be-scanned)",
        ) {
            val stats =
                run(
                    "medication-administration SI-12-unverified-outside-medicine-cannot-be-scanned",
                    check(
                        "a patient-supplied item is given only through its own administrable relabel naming this patient (raw facts)",
                        appliesTo = { step -> step.firedOneOf(LIVE_ADMINISTRATIONS) },
                    ) { step ->
                        val facts = step.facts
                        val scan = facts.scans.product
                        val label = (scan as? ProductScan.Identified)?.label
                        if (label is ProductLabel.PatientSuppliedRelabel) {
                            label.namedPatientId shouldBe facts.dose.patientId
                            val item = facts.supplies.patientSuppliedItems.firstOrNull { it.itemId == label.itemId }
                            item?.patientId shouldBe facts.dose.patientId
                            item?.stage shouldBe PatientSuppliedStage.ADMINISTRABLE
                        }
                        if (scan !is ProductScan.Identified) {
                            facts.scans.namedSupply shouldNotBe null
                            (facts.scans.namedSupply is NamedSupply.PatientSupplied) shouldBe false
                        }
                    },
                )
            stats.requireFired(*SCAN_OVERRIDES)
        }

        test("SI-12 (medication-administration): the facts carry no financial value, so no money rule can refuse or delay a dose") {
            val classes = factsClasses()
            classes shouldContainAll listOf(DoseFacts::class.java, ProductScan.Identified::class.java, DoubleCheck::class.java)
            val financial =
                classes.flatMap { type ->
                    type.declaredFields.map { "${type.simpleName}.${it.name}" }.filter { field ->
                        FINANCIAL_WORDS.any { word -> field.substringAfter('.').contains(word, ignoreCase = true) }
                    }
                }
            financial.shouldBeEmpty()
        }

        test("§9.10 (medication-administration): the late-dose window flags a dose and never blocks or changes an administration") {
            spec.transitions.filter { it.index in ADMINISTRATIONS }.forEach { it.guard shouldNotContain LATE_DOSE_WINDOW_ELAPSED }
            val stats =
                run(
                    "medication-administration late-dose-window-never-blocks-a-give",
                    check(
                        "an administering command decides the same whether the dose is late, flagged or not",
                        appliesTo = { it.from == MedicationAdministrationState.SCHEDULED && it.command in ADMINISTERING_COMMANDS },
                    ) { step ->
                        val dose = step.facts.dose
                        val windowStart =
                            step.facts.context.receivedAt
                                .minus(dose.lateDoseWindow)
                        val variants =
                            listOf(
                                dose.copy(dueTime = windowStart, flaggedLate = false),
                                dose.copy(dueTime = windowStart.minusSeconds(1), flaggedLate = false),
                                dose.copy(flaggedLate = !dose.flaggedLate),
                            )
                        variants.forEach { variant ->
                            fire(step.from, step.command, step.facts.copy(dose = variant)).summary() shouldBe step.outcome.summary()
                        }
                    },
                )
            stats.requireFired(*ADMINISTRATIONS)
        }

        test("SI-03 (medication-administration): stopping or completing an infusion never depends on privilege configuration") {
            val stats =
                run(
                    "medication-administration SI-03-stop-never-blocked-by-privilege-configuration",
                    check(
                        "Complete and Stop decide the same without any privilege configuration or administration privilege",
                        appliesTo = { it.from == MedicationAdministrationState.IN_PROGRESS && it.command in setOf(Complete, Stop) },
                    ) { step ->
                        val unconfigured =
                            step.facts.copy(
                                configuration = step.facts.configuration.copy(administrationPrivilege = null, commandPrivilege = null),
                                actor = step.facts.actor.copy(privileges = emptySet()),
                            )
                        fire(step.from, step.command, unconfigured).summary() shouldBe step.outcome.summary()
                    },
                    check(
                        "an ended order closes a scheduled dose as not given, and tasks a running infusion",
                        appliesTo = { it.firedOneOf(ORDER_ENDED) },
                    ) { step ->
                        if (step.firedIndex() == ORDER_ENDED_SCHEDULED) {
                            step.outcome.state shouldBe MedicationAdministrationState.NOT_DONE
                            step.effects() shouldContain EMIT_MEDICATION_NOT_GIVEN
                        } else {
                            step.outcome.state shouldBe MedicationAdministrationState.IN_PROGRESS
                            step.effects() shouldContain CREATE_INFUSION_STOP_TASK
                        }
                    },
                )
            stats.requireFired(ORDER_ENDED_SCHEDULED, ORDER_ENDED_RUNNING)
        }
    })
