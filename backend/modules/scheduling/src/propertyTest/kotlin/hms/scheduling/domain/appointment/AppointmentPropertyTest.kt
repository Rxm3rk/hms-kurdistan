package hms.scheduling.domain.appointment

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
import io.kotest.matchers.collections.shouldContainAll
import io.kotest.matchers.collections.shouldNotContain
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.types.shouldBeInstanceOf
import java.lang.reflect.Modifier
import java.lang.reflect.ParameterizedType
import java.lang.reflect.Type
import java.math.BigDecimal
import java.time.Duration
import java.time.Instant

private typealias AppointmentStep =
    Step<AppointmentState, AppointmentCommand, AppointmentPredicate, AppointmentEffect, AppointmentFacts>
private typealias AppointmentCheck =
    StepCheck<AppointmentState, AppointmentCommand, AppointmentPredicate, AppointmentEffect, AppointmentFacts>
private typealias AppointmentTransition = Transition<AppointmentState, AppointmentCommand, AppointmentPredicate, AppointmentEffect>

private val holds: (AppointmentPredicate, AppointmentFacts) -> Boolean =
    { predicate, facts -> AppointmentMachine.holds(predicate, AppointmentGuards, facts) }

private fun run(
    name: String,
    checks: List<AppointmentCheck>,
): RunStats = runSequences(name, AppointmentMachine.spec, holds, AppointmentArbs.facts, SequenceConfig(), checks)

private fun indexesOf(filter: (AppointmentTransition) -> Boolean): IntArray =
    AppointmentMachine.spec.transitions
        .filter(filter)
        .map { it.index }
        .toIntArray()

private val AppointmentStep.fired: AppointmentTransition? get() = (outcome as? Outcome.Fired)?.transition

private val AppointmentStep.effects: List<AppointmentEffect> get() = fired?.effects.orEmpty()

/** The step fired a transition that enters [state] from another state. */
private fun AppointmentStep.entered(state: AppointmentState): Boolean = fired?.to == state && from != state

// ---- The reviewed effect-to-module map (SI-12; appointment.md "Other safety invariants"). The `when` is exhaustive, so
// the compiler keeps the map total: a new effect does not compile until it is mapped here and reviewed.

private const val SCHEDULING = "scheduling"
private const val TASKS = "platform-tasks"
private const val FRONT_DOOR = "front-door"
private const val JOURNAL = "platform-journal"

/** The modules each effect acts on (BUILD-PROMPT §5.2 module names). */
private fun targets(effect: AppointmentEffect): Set<String> =
    when (effect) {
        AppointmentEffect.HOLD_SLOT_TENTATIVELY,
        AppointmentEffect.BOOK_SLOT,
        AppointmentEffect.RELEASE_SLOT,
        AppointmentEffect.OFFER_FREED_SLOT_TO_WAITLIST,
        AppointmentEffect.ISSUE_OPD_TOKEN,
        AppointmentEffect.WITHDRAW_OPD_TOKEN,
        AppointmentEffect.FLAG_LATE_CANCELLATION,
        -> setOf(SCHEDULING)

        AppointmentEffect.SEND_WAITLIST_OFFER, AppointmentEffect.NOTIFY_PATIENT_OF_CHANGE -> setOf(FRONT_DOOR, TASKS)

        AppointmentEffect.SCHEDULE_REMINDERS, AppointmentEffect.WITHDRAW_REMINDERS -> setOf(SCHEDULING, FRONT_DOOR)

        AppointmentEffect.REPORT_OUTCOME_TO_REFERRAL -> setOf(SCHEDULING, TASKS)

        AppointmentEffect.OPEN_BOOKING_TASK,
        AppointmentEffect.OPEN_OUTCOME_DUE_TASK,
        AppointmentEffect.OPEN_FOLLOW_UP_CONTACT_TASK,
        -> setOf(TASKS)

        AppointmentEffect.EMIT_APPOINTMENT_BOOKED,
        AppointmentEffect.EMIT_APPOINTMENT_RESCHEDULED,
        AppointmentEffect.EMIT_APPOINTMENT_MODIFIED,
        AppointmentEffect.EMIT_APPOINTMENT_CANCELLED,
        AppointmentEffect.EMIT_APPOINTMENT_NO_SHOW,
        AppointmentEffect.EMIT_PATIENT_CHECKED_IN,
        -> setOf(SCHEDULING, JOURNAL)
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

// ---- SI-12 structural check: no financial fact anywhere in the facts (appointment.yaml header).

/** Whole words (camelCase and SNAKE_CASE parts, lowercased) that name a financial value. */
private val FINANCIAL_WORDS =
    setOf(
        "deposit",
        "deposits",
        "balance",
        "estimate",
        "approval",
        "preapproval",
        "coverage",
        "price",
        "charge",
        "charges",
        "tariff",
        "amount",
        "currency",
        "money",
        "cash",
        "invoice",
        "debt",
        "cost",
        "fee",
        "fees",
    )

/** Word prefixes that name a financial value (pay, payment, payer; bill, billing; insurer, insurance). */
private val FINANCIAL_PREFIXES = listOf("pay", "bill", "insur", "financ")

private val CAMEL_BOUNDARY = Regex("(?<=[a-z0-9])(?=[A-Z])")

/** "Owner.someFieldName:Type" or "Enum.SOME_CONSTANT" contains a financial word (its camelCase and SNAKE_CASE parts). */
private fun financial(entry: String): Boolean =
    entry
        .split('.', ':', '_')
        .flatMap { it.split(CAMEL_BOUNDARY) }
        .map { it.lowercase() }
        .any { word -> word in FINANCIAL_WORDS || FINANCIAL_PREFIXES.any { word.startsWith(it) } }

private const val FACTS_PACKAGE = "hms.scheduling.domain.appointment"

/** Every field name, enum constant and field type reachable from [root] inside the facts package, as "Owner.name". */
private fun factVocabulary(root: Class<*>): List<String> {
    val seen = mutableSetOf<Class<*>>()
    val words = mutableListOf<String>()

    fun visit(type: Type) {
        when (type) {
            is ParameterizedType -> type.actualTypeArguments.forEach(::visit)
            is Class<*> -> if (type.packageName == FACTS_PACKAGE && seen.add(type)) visitClass(type, words, ::visit)
            else -> Unit
        }
    }
    visit(root)
    return words
}

private fun visitClass(
    type: Class<*>,
    words: MutableList<String>,
    visit: (Type) -> Unit,
) {
    type.enumConstants?.forEach { words += "${type.simpleName}.${(it as Enum<*>).name}" }
    type.declaredFields.filterNot { Modifier.isStatic(it.modifiers) }.forEach { field ->
        words += "${type.simpleName}.${field.name}"
        words += "${type.simpleName}.${field.name}:${field.type.simpleName}"
        visit(field.genericType)
    }
}

// ---- Independent oracles over the raw facts (they do not call AppointmentGuards).

private val PRESENTED_OR_STATED = setOf(IdentifierSource.CARD_SCAN, IdentifierSource.WRISTBAND_SCAN, IdentifierSource.PATIENT_STATED)

/** The stated name, matched by empi's cross-script answer. */
private val CheckInFacts.oracleName: Boolean
    get() = !statedName.isNullOrBlank() && nameSource == IdentifierSource.PATIENT_STATED && nameMatch == EmpiMatch.MATCH

/** The record's MRN with a valid check digit, from a card, a wristband, the patient, or a one-candidate empi search. */
private fun CheckInFacts.oracleMrn(patientId: String): Boolean {
    val searchFoundOnlyThisPatient = mrnSource == IdentifierSource.EMPI_SEARCH && empiSearchCandidates == listOf(patientId)
    return recordMrn != null &&
        presentedMrn == recordMrn &&
        mrnCheckDigitValid == true &&
        (mrnSource in PRESENTED_OR_STATED || searchFoundOnlyThisPatient)
}

/** The DOB the patient stated (at least its year equal to the record's), or empi's match of the stated approximate age. */
private val CheckInFacts.oracleDob: Boolean
    get() =
        recordDob != null &&
            when (recordApproximateDob) {
                true -> statedApproximateAgeMatch == EmpiMatch.MATCH
                false -> dobSource == IdentifierSource.PATIENT_STATED && statedDob?.year == recordDob.year
                null -> false
            }

/** SI-01 at check-in, re-read from the raw facts: stated name matched by empi; MRN valid and the patient's; DOB stated. */
private val AppointmentFacts.oracleIdentified: Boolean
    get() = checkIn?.let { it.oracleName && it.oracleMrn(patientId) && it.oracleDob } ?: false

/** adt reports an open ED or inpatient encounter overlapping the slot (or the slot time is unknown). */
private fun AppointmentFacts.oracleInHospital(): Boolean {
    val start = appointmentSlot?.start
    val end = appointmentSlot?.end
    val closed =
        setOf(EncounterStatus.DISCHARGED_NOT_CLOSED, EncounterStatus.FINISHED, EncounterStatus.CANCELLED, EncounterStatus.ENTERED_IN_ERROR)
    return patientEncounters.any { e ->
        e.status !in closed &&
            (e.encounterClass == EncounterClass.EMERGENCY || e.encounterClass == EncounterClass.INPATIENT) &&
            (start == null || end == null || (e.start < end && (e.end == null || e.end > start)))
    }
}

/** The no-show grace period has run from the slot end. */
private val AppointmentFacts.oracleGraceElapsed: Boolean
    get() {
        val end = appointmentSlot?.end ?: return false
        val grace = config.noShowGrace?.takeUnless { it.isNegative } ?: Duration.ZERO
        return now >= end.plus(grace)
    }

/** The cancellation falls inside a positive late-cancel window (or after the start). */
private val AppointmentFacts.oracleLate: Boolean
    get() {
        val window = config.lateCancelWindow?.takeUnless { it.isNegative } ?: Duration.ZERO
        val start: Instant = appointmentSlot?.start ?: return false
        return window > Duration.ZERO && now >= start.minus(window)
    }

private val TERMINAL = AppointmentMachine.spec.terminal
private val CANCELLABLE = setOf(AppointmentState.PROPOSED, AppointmentState.PENDING, AppointmentState.BOOKED, AppointmentState.WAITLIST)

/**
 * The appointment machine's own properties (docs/specs/state-machines/appointment.yaml, appointment.md; WP-0.5 spec
 * §3.3), beside the generated P1 to P7: SI-01 at check-in, SI-03 (owners, holds that expire, referral outcomes, no-show
 * only after the grace period and never for a patient in hospital, the late flag never gates), SI-12 (no financial fact,
 * no effect on a clinical module) and the SI-20/SI-21 content rule on patient messages (structural only). Each run uses
 * the configured budget, checks the raw facts with independent oracles, and requires the transitions it is about.
 */
class AppointmentPropertyTest :
    FunSpec({
        val arrivals = indexesOf { it.to == AppointmentState.ARRIVED && it.from != setOf(AppointmentState.ARRIVED) }

        test("SI-01 (appointment): SI-01-two-identifiers-on-every-patient-affecting-command: check-in needs name, MRN and DOB") {
            val stats =
                run(
                    "SI-01-two-identifiers-on-every-patient-affecting-command (appointment)",
                    listOf(
                        AppointmentCheck(
                            name = "every check-in into arrived had the stated name, the patient's valid MRN and the stated DOB",
                            appliesTo = { it.entered(AppointmentState.ARRIVED) },
                            check = { step -> step.facts.oracleIdentified shouldBe true },
                        ),
                        AppointmentCheck(
                            name = "a check-in without two confirmed identifiers is never fired",
                            appliesTo = {
                                (it.command == AppointmentCommand.CheckIn || it.command == AppointmentCommand.CheckInWalkIn) &&
                                    AppointmentMachine.spec.candidates(it.from, it.command).isNotEmpty() &&
                                    !it.facts.oracleIdentified
                            },
                            check = { step -> step.fired shouldBe null },
                        ),
                    ),
                )
            arrivals.forEach { stats.requireFired(it) }
        }

        test("SI-01 (appointment): SI-01-location-never-an-identifier: no screen value, room, bed, token or appointment number") {
            val never = setOf(IdentifierSource.SCREEN_CONFIRMED, IdentifierSource.LOCATION_TOKEN_OR_APPOINTMENT_NUMBER)
            val stats =
                run(
                    "SI-01-location-never-an-identifier (appointment)",
                    listOf(
                        AppointmentCheck(
                            name = "no check-in into arrived rests on a screen-confirmed value or a location, token or appointment number",
                            appliesTo = { it.entered(AppointmentState.ARRIVED) },
                            check = { step ->
                                val checkIn = step.facts.checkIn
                                listOf(checkIn?.nameSource, checkIn?.mrnSource, checkIn?.dobSource).forEach { source ->
                                    never shouldNotContain source
                                }
                            },
                        ),
                    ),
                )
            arrivals.forEach { stats.requireFired(it) }
        }

        test("SI-12 (appointment): SI-12-no-rcm-state-blocks-a-clinical-command: the facts carry no financial value") {
            val vocabulary = factVocabulary(AppointmentFacts::class.java)
            withClue("the facts vocabulary must be read (${vocabulary.size} entries)") { (vocabulary.size > 1) shouldBe true }
            vocabulary.filter(::financial).shouldBeEmpty()
            withClue("the word check itself recognises financial names") {
                listOf("Facts.depositAmount", "Facts.payerId", "Status.BILL_CLEARED").all(::financial) shouldBe true
                listOf("EncounterStatus.DISCHARGED_NOT_CLOSED", "Facts.pastOffers").none(::financial) shouldBe true
            }
            vocabulary.filter { it.endsWith(":${BigDecimal::class.java.simpleName}") }.shouldBeEmpty()
        }

        test("SI-12 (appointment): SI-12-no-rcm-state-blocks-a-clinical-command: no effect targets a clinical module") {
            AppointmentEffect.entries.forEach { effect ->
                withClue(effect.id) {
                    targets(effect).filter { it in CLINICAL_MODULES }.shouldBeEmpty()
                    (targets(effect).isNotEmpty()) shouldBe true
                }
            }
            val stats =
                run(
                    "SI-12-no-rcm-state-blocks-a-clinical-command (appointment)",
                    listOf(
                        AppointmentCheck(
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

        test("SI-03 (appointment): SI-03-owner-and-sla-on-every-work-item: every open state has an owner or a limit") {
            val stats =
                run(
                    "SI-03-owner-and-sla-on-every-work-item (appointment)",
                    listOf(
                        AppointmentCheck(
                            name = "every entry into proposed opens an owned booking task",
                            appliesTo = { it.entered(AppointmentState.PROPOSED) },
                            check = { step -> step.effects shouldContain AppointmentEffect.OPEN_BOOKING_TASK },
                        ),
                        AppointmentCheck(
                            name = "every entry into booked or arrived opens an owned outcome-due task",
                            appliesTo = { it.entered(AppointmentState.BOOKED) || it.entered(AppointmentState.ARRIVED) },
                            check = { step -> step.effects shouldContain AppointmentEffect.OPEN_OUTCOME_DUE_TASK },
                        ),
                        AppointmentCheck(
                            name = "every entry into pending holds the slot with a respond-by instant",
                            appliesTo = { it.entered(AppointmentState.PENDING) },
                            check = { step -> step.effects shouldContain AppointmentEffect.HOLD_SLOT_TENTATIVELY },
                        ),
                        AppointmentCheck(
                            name = "a pending hold without a respond-by instant always lapses",
                            appliesTo = {
                                it.from == AppointmentState.PENDING &&
                                    it.command == AppointmentCommand.ExpireHold &&
                                    it.facts.hold?.respondBy == null
                            },
                            check = { step -> step.outcome.shouldBeInstanceOf<Outcome.Fired<*, *, *, *>>() },
                        ),
                        AppointmentCheck(
                            name = "every ending, and every return of a booking for rebooking, reports to the referral",
                            appliesTo = { step ->
                                val to = step.fired?.to
                                to != null && (to in TERMINAL || (step.from == AppointmentState.BOOKED && to == AppointmentState.PROPOSED))
                            },
                            check = { step -> step.effects shouldContain AppointmentEffect.REPORT_OUTCOME_TO_REFERRAL },
                        ),
                    ),
                )
            indexesOf { it.to !in it.from }.forEach { stats.requireFired(it) }
        }

        test("SI-03 (appointment): no-show only after the grace period from the slot end, never for a patient in hospital") {
            val stats =
                run(
                    "appointment-no-show-never-for-a-patient-in-hospital",
                    listOf(
                        AppointmentCheck(
                            name = "MarkNoShow fired only after the grace period ran from the slot end",
                            appliesTo = { it.fired?.on == AppointmentCommand.MarkNoShow },
                            check = { step -> step.facts.oracleGraceElapsed shouldBe true },
                        ),
                        AppointmentCheck(
                            name = "MarkNoShow is never fired for a patient adt reports in an open ED or inpatient encounter",
                            appliesTo = {
                                it.from == AppointmentState.BOOKED &&
                                    it.command == AppointmentCommand.MarkNoShow &&
                                    it.facts.oracleInHospital()
                            },
                            check = { step -> step.fired shouldBe null },
                        ),
                    ),
                )
            indexesOf { it.on == AppointmentCommand.MarkNoShow || it.on == AppointmentCommand.RecordPatientInHospital }
                .forEach { stats.requireFired(it) }
        }

        test("SI-03 (appointment): the late-cancel flag never gates a cancellation and is set only inside the window") {
            val ready =
                setOf(
                    AppointmentPredicate.CANCELLATION_REASON_GIVEN,
                    AppointmentPredicate.CANCELLING_PARTY_RECORDED,
                    AppointmentPredicate.CANCELLATION_ENDS_NEED,
                )
            val stats =
                run(
                    "appointment-late-flag-never-gates",
                    listOf(
                        AppointmentCheck(
                            name = "a Cancel with reason, party and an ended need always fires, late or not",
                            appliesTo = {
                                it.command == AppointmentCommand.Cancel &&
                                    it.from in CANCELLABLE &&
                                    it.holding.containsAll(ready)
                            },
                            check = { step -> step.fired?.to shouldBe AppointmentState.CANCELLED },
                        ),
                        AppointmentCheck(
                            name = "the late flag is set exactly when the cancellation is inside the late window",
                            appliesTo = { it.fired?.on == AppointmentCommand.Cancel },
                            check = { step -> (AppointmentEffect.FLAG_LATE_CANCELLATION in step.effects) shouldBe step.facts.oracleLate },
                        ),
                        AppointmentCheck(
                            name = "a hospital cancellation for rebooking is never flagged late",
                            appliesTo = { it.fired?.on == AppointmentCommand.CancelForRebooking },
                            check = { step -> step.effects shouldNotContain AppointmentEffect.FLAG_LATE_CANCELLATION },
                        ),
                    ),
                )
            indexesOf { it.on == AppointmentCommand.Cancel || it.on == AppointmentCommand.CancelForRebooking }
                .forEach { stats.requireFired(it) }
        }

        test("SI-20 (appointment): every patient-message effect states the SI-20 and SI-21 content rule (structural only)") {
            val messages =
                listOf(
                    AppointmentEffect.SEND_WAITLIST_OFFER,
                    AppointmentEffect.SCHEDULE_REMINDERS,
                    AppointmentEffect.NOTIFY_PATIENT_OF_CHANGE,
                )
            AppointmentEffect.entries.filter { FRONT_DOOR in targets(it) } shouldContainAll messages
            messages.forEach { effect ->
                withClue(effect.id) {
                    effect.description shouldContain "SI-20"
                    effect.description shouldContain "SI-21"
                }
            }
        }
    })
