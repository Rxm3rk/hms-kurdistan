package hms.scheduling.domain.appointment

import java.time.Duration
import java.time.Instant
import java.time.LocalDate

// The facts the appointment predicates read (docs/specs/state-machines/appointment.yaml; WP-0.5 spec §3.1
// "Facts, not aggregates"). Pure values: time arrives as data (now, today), never from the system clock. Answers
// owned by another module (empi's name matching and MRN check digit, adt's encounter states, record's consultation
// flag, the Trust Plane's privileges) are facts here because that module owns them; every other rule is computed by
// AppointmentGuards from these values.
//
// SI-12: no fact below is a payment, deposit, bill, balance, estimate, pre-approval, coverage or any other financial
// value (appointment.yaml header). AppointmentPropertyTest checks this structurally over every field.

/**
 * Everything the appointment aggregate knows when it decides one command (appointment.yaml header).
 *
 * @property appointmentId The appointment's identifier.
 * @property patientId The appointment's patient (empi's identifier).
 * @property now The clock reading for this decision (time arrives as data, WP-0.5 spec §3.1).
 * @property today The tenant-calendar date of [now].
 * @property config The tenant's configured windows and governed lists [HUMAN].
 * @property appointmentSlot The slot the appointment currently holds or books, if any.
 * @property targetSlot The schedule's answer for the command's target slot in the appointment resource's schedule;
 *   null when no such slot exists there.
 * @property participants The appointment's participants with their latest responses (R11 §4 AppointmentResponse).
 * @property hold The pending hold, when the appointment is held in pending.
 * @property waitlistEntry This appointment's waitlist entry (constraints and priority), if any.
 * @property competingEntries The other waitlist entries the aggregate lists for the target slot.
 * @property checkIn The identifiers the patient or companion states or presents at check-in, with empi's answers.
 * @property walkIn The walk-in request and the running sessions of the schedule.
 * @property linkedEncounter The linked outpatient encounter as adt and record report it.
 * @property patientEncounters The patient's encounters as adt reports them (for patientInHospital).
 * @property cancellation The cancellation the command carries, if any.
 * @property noShow The no-show record the command carries, if any.
 * @property modification The modification the command carries, if any.
 * @property correction The correction the command carries (UndoCheckIn, ReverseNoShow, MarkEnteredInError).
 */
data class AppointmentFacts(
    val appointmentId: String,
    val patientId: String,
    val now: Instant,
    val today: LocalDate,
    val config: AppointmentConfig,
    val appointmentSlot: AppointmentSlot?,
    val targetSlot: SlotFacts?,
    val participants: List<ParticipantFacts>,
    val hold: HoldFacts?,
    val waitlistEntry: WaitlistEntryFacts?,
    val competingEntries: List<WaitlistEntryFacts>,
    val checkIn: CheckInFacts?,
    val walkIn: WalkInFacts?,
    val linkedEncounter: LinkedEncounterFacts?,
    val patientEncounters: List<PatientEncounterFacts>,
    val cancellation: CancellationFacts?,
    val noShow: NoShowFacts?,
    val modification: ModificationFacts?,
    val correction: CorrectionFacts?,
)

/**
 * The tenant's configuration the predicates read: windows and governed lists, all [HUMAN] content. A missing window
 * counts as zero (appointment.yaml); a negative window is not a valid configuration and is also read as zero.
 *
 * @property earlyCheckInWindow How long before the slot start check-in opens (withinCheckInWindow).
 * @property lateCancelWindow How long before the start a cancellation counts as late; zero means never late.
 * @property noShowGrace How long after the slot end a no-show may be recorded.
 * @property waitlistPriorityRanks The governed waitlist-priority list: code to rank (a lower rank comes first).
 * @property cancellationReasons The governed cancellation-reason list: code to its rule.
 * @property noShowReasons The governed no-show-reason list.
 */
data class AppointmentConfig(
    val earlyCheckInWindow: Duration?,
    val lateCancelWindow: Duration?,
    val noShowGrace: Duration?,
    val waitlistPriorityRanks: Map<String, Int>,
    val cancellationReasons: Map<String, CancellationReasonRule>,
    val noShowReasons: Set<String>,
)

/**
 * One code of the governed cancellation-reason list [HUMAN].
 *
 * @property requiresText The code needs non-blank text (for example "other").
 * @property endsNeed The governed list marks the code as ending the patient's need (cancellationEndsNeed).
 */
data class CancellationReasonRule(
    val requiresText: Boolean,
    val endsNeed: Boolean,
)

/**
 * The slot the appointment currently holds or books.
 *
 * @property slotId The slot's identifier.
 * @property start The slot start, when known.
 * @property end The slot end, when known.
 * @property sessionEnd The end of the clinic session the slot belongs to (may be past midnight, §9.3).
 * @property date The tenant-calendar date of the slot start.
 */
data class AppointmentSlot(
    val slotId: String,
    val start: Instant?,
    val end: Instant?,
    val sessionEnd: Instant?,
    val date: LocalDate?,
)

/** The R4 slot statuses (R11 §4 Slot). */
enum class SlotStatus { FREE, BUSY_TENTATIVE, BUSY, BUSY_UNAVAILABLE, ENTERED_IN_ERROR }

/**
 * A slot of the schedule (R11 §4 Slot).
 *
 * @property slotId The slot's identifier.
 * @property status Its R4 status.
 * @property heldByAppointmentId The appointment that holds it tentatively or books it, if any.
 * @property overbookable Marked overbookable (§9.2 "capped overbooking").
 * @property overbookedCount Its count of overbooked appointments.
 * @property overbookCap Its overbook cap [HUMAN]; missing counts as zero.
 * @property start The slot start.
 * @property end The slot end.
 * @property date The tenant-calendar date of the slot start.
 * @property serviceType The slot's service type.
 * @property providerId The slot's provider.
 * @property locationId The slot's location.
 */
data class SlotFacts(
    val slotId: String,
    val status: SlotStatus,
    val heldByAppointmentId: String?,
    val overbookable: Boolean,
    val overbookedCount: Int,
    val overbookCap: Int?,
    val start: Instant,
    val end: Instant,
    val date: LocalDate,
    val serviceType: String,
    val providerId: String,
    val locationId: String,
)

/** A participant's response (R11 §4 AppointmentResponse); NEEDS_ACTION is no response yet. */
enum class ParticipantResponse { ACCEPTED, DECLINED, TENTATIVE, NEEDS_ACTION }

/**
 * A participant of the appointment (patient, practitioner, location, equipment; R11 §4).
 *
 * @property participantId The participant's identifier.
 * @property required Marked required on the appointment.
 * @property response The latest response.
 * @property responseSlotId The slot the latest response was given for.
 */
data class ParticipantFacts(
    val participantId: String,
    val required: Boolean,
    val response: ParticipantResponse,
    val responseSlotId: String?,
)

/** Why the appointment is in pending (waitlistOffer). */
enum class PendingReason { AWAITING_ACCEPTANCE, WAITLIST_OFFER }

/**
 * The pending hold.
 *
 * @property reason Why the appointment is held in pending; null when unknown (read as not a waitlist offer).
 * @property respondBy The respond-by instant fixed when the hold was created; null lapses the hold.
 */
data class HoldFacts(
    val reason: PendingReason?,
    val respondBy: Instant?,
)

/** What happened to an earlier offer of a slot to a waitlist entry. */
enum class OfferOutcome { DECLINED, LAPSED }

/**
 * An earlier offer of a slot to a waitlist entry.
 *
 * @property slotId The slot offered.
 * @property outcome Declined or lapsed.
 * @property deliveryConfirmed The offer's delivery was confirmed (a lapse counts against the entry only then).
 */
data class PastOffer(
    val slotId: String,
    val outcome: OfferOutcome,
    val deliveryConfirmed: Boolean,
)

/**
 * A waitlist entry (R11 §4 "Waitlist entry: constraints, priority"); only date ranges are modelled (DN-057 item 8).
 *
 * @property entryId The entry's identifier (the last ranking tie-break).
 * @property serviceType The service type wanted.
 * @property providers Acceptable providers; empty means any provider of the service.
 * @property locations Acceptable locations; empty means any location.
 * @property earliest The earliest acceptable date.
 * @property latest The latest acceptable date.
 * @property priorityCode The priority code from the governed list [HUMAN].
 * @property priorityOrigin How the priority was entered; only [ReasonOrigin.USER] counts as chosen by the user.
 * @property waitlistedAt When the entry was waitlisted (the second ranking key).
 * @property pastOffers Earlier offers to this entry.
 */
data class WaitlistEntryFacts(
    val entryId: String,
    val serviceType: String?,
    val providers: Set<String>,
    val locations: Set<String>,
    val earliest: LocalDate?,
    val latest: LocalDate?,
    val priorityCode: String?,
    val priorityOrigin: ReasonOrigin?,
    val waitlistedAt: Instant,
    val pastOffers: List<PastOffer>,
)

/** How a reason, code or priority was entered: only USER is chosen or entered by the acting user. */
enum class ReasonOrigin { USER, PREFILLED, DEFAULTED, CARRIED_OVER }

/** empi's answer to a matching question (cross-script name match, approximate age or birth year). */
enum class EmpiMatch { MATCH, NO_MATCH, UNAVAILABLE }

/**
 * Where an identifier came from at check-in. Only what the patient or companion states or presents counts; a value
 * the desk read from the screen and asked the patient to confirm never does, and a room, bed, token or appointment
 * number is never an identifier (SI-01 clause d; CTRL-0001-3).
 */
enum class IdentifierSource {
    /** Stated by the patient or companion. */
    PATIENT_STATED,

    /** Scanned from the patient's card. */
    CARD_SCAN,

    /** Scanned from the patient's wristband. */
    WRISTBAND_SCAN,

    /** From an empi search on the stated name and stated date of birth (DN-057 item 4). */
    EMPI_SEARCH,

    /** Read from the screen by the desk and confirmed by the patient: never an identifier. */
    SCREEN_CONFIRMED,

    /** A room, bed, token or appointment number: never an identifier. */
    LOCATION_TOKEN_OR_APPOINTMENT_NUMBER,
}

/** The precision at which the record's date of birth is recorded. */
enum class DobPrecision { DAY, MONTH, YEAR }

/**
 * The identifiers of the person checking in and empi's answers about the appointment's patient's record
 * (patientIdentifiedByTwoIdentifiers; SI-01 clauses a and d; DN-057 items 3 and 4).
 *
 * @property statedName The name the patient or companion states.
 * @property nameSource Where the name came from.
 * @property nameMatch empi's cross-script matching answer for the stated name against the record's name forms.
 * @property presentedMrn The MRN presented, scanned, stated or found by the empi search.
 * @property mrnSource Where the MRN came from.
 * @property mrnCheckDigitValid empi's check-digit answer for [presentedMrn]; null when unknown.
 * @property empiSearchCandidates The patients the empi search on stated name and DOB returned (EMPI_SEARCH only).
 * @property statedDob The date of birth the patient states.
 * @property dobSource Where the date of birth came from.
 * @property statedApproximateAgeMatch empi's answer for the stated approximate age or birth year (approximate DOB).
 * @property recordMrn The record's MRN; null when missing.
 * @property recordDob The record's date of birth; null when missing.
 * @property recordDobPrecision The precision of [recordDob].
 * @property recordApproximateDob The record's approximate-DOB flag; null when missing.
 */
data class CheckInFacts(
    val statedName: String?,
    val nameSource: IdentifierSource?,
    val nameMatch: EmpiMatch?,
    val presentedMrn: String?,
    val mrnSource: IdentifierSource?,
    val mrnCheckDigitValid: Boolean?,
    val empiSearchCandidates: List<String>,
    val statedDob: LocalDate?,
    val dobSource: IdentifierSource?,
    val statedApproximateAgeMatch: EmpiMatch?,
    val recordMrn: String?,
    val recordDob: LocalDate?,
    val recordDobPrecision: DobPrecision?,
    val recordApproximateDob: Boolean?,
)

/**
 * A clinic session of the schedule.
 *
 * @property serviceType The session's service.
 * @property providerId The session's provider.
 * @property acceptsWalkIns The session accepts walk-ins.
 * @property start The session start.
 * @property end The session end.
 */
data class SessionFacts(
    val serviceType: String,
    val providerId: String,
    val acceptsWalkIns: Boolean,
    val start: Instant,
    val end: Instant,
)

/**
 * A walk-in request and the sessions of the schedule (walkInSessionOpen).
 *
 * @property requestedService The service requested.
 * @property requestedProvider The provider requested, if one is.
 * @property sessions The schedule's sessions.
 */
data class WalkInFacts(
    val requestedService: String?,
    val requestedProvider: String?,
    val sessions: List<SessionFacts>,
)

/** The encounter machine's states (docs/specs/state-machines/encounter.yaml), as adt reports them. */
enum class EncounterStatus {
    PLANNED,
    ARRIVED,
    TRIAGED,
    IN_PROGRESS,
    ON_LEAVE,
    DISCHARGED_NOT_CLOSED,
    FINISHED,
    CANCELLED,
    ENTERED_IN_ERROR,
}

/**
 * The linked outpatient encounter (consultationCompleted, linkedEncounterEndedWithoutConsultation).
 *
 * @property status adt's answer for its state; null when unknown.
 * @property leftWithoutBeingSeen adt's disposition is left-without-being-seen; null when no disposition is known.
 * @property consultationRecorded record's answer: a consultation is recorded for it; null when unknown.
 */
data class LinkedEncounterFacts(
    val status: EncounterStatus?,
    val leftWithoutBeingSeen: Boolean?,
    val consultationRecorded: Boolean?,
)

/** The class of an encounter as adt reports it. */
enum class EncounterClass { EMERGENCY, INPATIENT, OUTPATIENT, OTHER }

/**
 * One encounter of the patient as adt reports it (patientInHospital).
 *
 * @property status Its state.
 * @property encounterClass Its class.
 * @property start Its start.
 * @property end Its end; null while it runs.
 */
data class PatientEncounterFacts(
    val status: EncounterStatus,
    val encounterClass: EncounterClass,
    val start: Instant,
    val end: Instant?,
)

/** Who asked for a cancellation (§8.4 "by whom"). */
enum class CancellingParty { PATIENT, REPRESENTATIVE, PRACTITIONER, HOSPITAL }

/** How a cancellation was entered. */
enum class EntryChannel { DESK_USER, FRONT_DOOR_LINK }

/**
 * The cancellation a command carries (Cancel, CancelForRebooking, RecordLeftBeforeSeen).
 *
 * @property reasonCode The reason code.
 * @property reasonOrigin How the reason was entered.
 * @property reasonText The free text, for a code that requires it.
 * @property requestingParty Who asked for the cancellation.
 * @property channel How it was entered.
 * @property entrantId Who entered it: the user, or the patient of the front-door session.
 * @property entrantAuthenticated The Trust Plane's answer for the user, or the front-door link's verified session.
 */
data class CancellationFacts(
    val reasonCode: String?,
    val reasonOrigin: ReasonOrigin?,
    val reasonText: String?,
    val requestingParty: CancellingParty?,
    val channel: EntryChannel?,
    val entrantId: String?,
    val entrantAuthenticated: Boolean,
)

/**
 * The no-show record a command carries (MarkNoShow).
 *
 * @property reasonCode The reason code.
 * @property reasonOrigin How the reason was entered.
 * @property enteredBy The user who entered it.
 * @property enteredByAuthenticated The Trust Plane's answer for that user.
 */
data class NoShowFacts(
    val reasonCode: String?,
    val reasonOrigin: ReasonOrigin?,
    val enteredBy: String?,
    val enteredByAuthenticated: Boolean,
)

/** An attribute a Modify command may change; the first six are a reschedule's, never a modification's. */
enum class AppointmentAttribute {
    SLOT,
    START,
    END,
    SCHEDULED_RESOURCE,
    LOCATION,

    /** A service type outside the slot's service changes what the slot is for: a reschedule. */
    SERVICE_TYPE_OUTSIDE_SLOT_SERVICE,
    REASON,
    SERVICE_TYPE_WITHIN_SLOT_SERVICE,
    NOTES,
    INTERPRETER_NEED,
    NON_SCHEDULED_PARTICIPANTS,
    WAITLIST_PRIORITY,
    WAITLIST_CONSTRAINTS,
}

/**
 * The modification a Modify command carries.
 *
 * @property changedAttributes The attributes it changes.
 */
data class ModificationFacts(
    val changedAttributes: Set<AppointmentAttribute>,
)

/**
 * The correction a command carries (privilegedAndAudited, correctionReasonEntered).
 *
 * @property command The correction command being decided (the aggregate knows it; a same-day ReverseNoShow needs only
 *   the front-desk reversal privilege, DN-057 item 9).
 * @property holdsCorrectionPrivilege The Trust Plane's answer: the user holds the privilege for this correction.
 * @property holdsFrontDeskReversalPrivilege The Trust Plane's answer: the user holds the front-desk reversal privilege.
 * @property auditWritable The audit record of the correction can be written with it.
 * @property reason The correction reason.
 * @property reasonOrigin How the reason was entered.
 */
data class CorrectionFacts(
    val command: AppointmentCommand?,
    val holdsCorrectionPrivilege: Boolean,
    val holdsFrontDeskReversalPrivilege: Boolean,
    val auditWritable: Boolean,
    val reason: String?,
    val reasonOrigin: ReasonOrigin?,
)
