package hms.adt.domain.encounter

import hms.adt.domain.bed.BedState
import hms.adt.domain.common.Answer
import hms.adt.domain.common.BedAttributes
import hms.adt.domain.common.Chosen
import hms.adt.domain.common.CommandChannel
import hms.adt.domain.common.ConnectivityMode
import hms.adt.domain.common.FinanceFacts
import hms.adt.domain.common.GenderRule
import hms.adt.domain.common.LeaveEntry
import hms.adt.domain.common.LocationPeriod
import hms.adt.domain.common.OverrideRequest
import hms.adt.domain.common.PatientPlacement
import java.time.Instant

/**
 * What the ADT aggregate knows when it decides an encounter command: the facts every predicate of the encounter
 * machine reads (docs/specs/state-machines/encounter.yaml; docs/specs/modules/state-machines-and-invariants.md §3.1
 * "Facts, not aggregates"). Pure values; time arrives as data, never from a clock. A fact is another module's answer
 * only where that module owns it (the identity service, the bed aggregate, the Trust Plane, the record module, the
 * journal); otherwise the predicates compute their rule from the facts.
 *
 * Facts that only one kind of command carries (a triage record, a swap, paper periods, a correction) are null or empty
 * for other commands.
 *
 * @property encounterId This encounter (`SYN-` identifiers in tests).
 * @property patientId The patient this encounter is recorded on.
 * @property patientIdentification The two identifiers the command carries for its patient (SI-01).
 * @property channel How the command reached the domain.
 * @property clientModeAtIssue The client's connectivity mode when the command was issued; null when unknown.
 * @property wanReachable Whether the internet (WAN) was reachable. No predicate reads it: internet loss alone never makes
 *   the on-site cell offline (SI-15 clause h); a property test shows it changes no guard.
 * @property effectiveTime The command's effective (clinical) time; null when the command carries none (SI-10).
 * @property recordedTime The command's recorded (system) time, as data (SI-10).
 * @property arrivalTime When this encounter arrived; null when unknown.
 * @property triageConfiguration The tenant's triage configuration; null when absent.
 * @property commandTriageRecord The triage record a Triage command carries.
 * @property heldTriageRecords The triage records the encounter holds, entered-in-error ones included.
 * @property targetBedId The bed the command places the patient in (admit, transfer, swap, cancelled discharge).
 * @property beds The bed aggregate's view of every bed the command concerns, by bed id.
 * @property bedAttributes The location tree's restrictions of every bed the command concerns, by bed id.
 * @property genderRules The tenant's gender matching rules, by restriction (governed configuration [HUMAN]).
 * @property periods Every location period on the beds the command concerns, of every encounter, this one included,
 *   entered-in-error ones included (the encounters' location histories: R11 §5).
 * @property leaveEntries The leave entries of this encounter and of a swap partner.
 * @property patientPlacement The restriction facts of this encounter's patient (for a swap).
 * @property swap The swap partner a SwapBeds command names.
 * @property override The override of bed restrictions a SwapBedsWithOverride command carries.
 * @property disposition The discharge disposition the command carries.
 * @property tenantDispositions The tenant's governed disposition list; null when missing.
 * @property dischargeBeingCancelled The discharge a CancelDischarge command cancels.
 * @property lastTransfer The encounter's last transfer, for CancelTransfer.
 * @property boundaryCorrection The boundary a CorrectLocationTime command changes.
 * @property backEntry The paper location periods a BackEnterLocationPeriods command carries, in order.
 * @property downtimeSpells The downtime spells the site record holds.
 * @property errorReason The coded reason for marking the encounter in error.
 * @property replacement The real patient's encounter a wrong-patient CancelAdmission names.
 * @property handOver The hand-over a ReceiveBedHandOver command receives.
 * @property codingComplete The record module's answer: no open HIM coding task for this encounter.
 * @property chargeCaptureComplete The journal's answer: every charge event this encounter owes is written.
 * @property reason The reason the command carries.
 * @property authorisation The Trust Plane's and the audit writer's answers for this command.
 * @property finance Payment facts no predicate reads (SI-12).
 */
data class EncounterFacts(
    val encounterId: String,
    val patientId: String,
    val patientIdentification: PatientIdentification?,
    val channel: CommandChannel,
    val clientModeAtIssue: ConnectivityMode?,
    val wanReachable: Boolean?,
    val effectiveTime: Instant?,
    val recordedTime: Instant?,
    val arrivalTime: Instant?,
    val triageConfiguration: TriageConfiguration?,
    val commandTriageRecord: TriageRecord?,
    val heldTriageRecords: List<HeldTriageRecord>,
    val targetBedId: String?,
    val beds: Map<String, BedView>,
    val bedAttributes: Map<String, BedAttributes>,
    val genderRules: Map<String, GenderRule>,
    val periods: List<LocationPeriod>,
    val leaveEntries: List<LeaveEntry>,
    val patientPlacement: PatientPlacement,
    val swap: SwapPartner?,
    val override: OverrideRequest?,
    val disposition: Chosen<String>?,
    val tenantDispositions: Set<String>?,
    val dischargeBeingCancelled: DischargeRecord?,
    val lastTransfer: TransferRecord?,
    val boundaryCorrection: BoundaryCorrection?,
    val backEntry: List<PaperPeriod>,
    val downtimeSpells: List<DowntimeSpell>,
    val errorReason: Chosen<ErrorReason>?,
    val replacement: ReplacementEncounter?,
    val handOver: HandOver?,
    val codingComplete: Answer,
    val chargeCaptureComplete: Answer,
    val reason: Chosen<String>?,
    val authorisation: Authorisation,
    val finance: FinanceFacts,
)

/** A kind of identifier a command may present for a patient (SI-01). */
enum class IdentifierKind {
    MRN,
    DATE_OF_BIRTH,
    APPROXIMATE_DOB_FLAG,
    ROOM,
    BED,
    LOCATION,
    ;

    /** True for a room, bed or location, never accepted as a patient identifier (SI-01 clause b; CTRL-0001-4). */
    val isLocation: Boolean get() = this == ROOM || this == BED || this == LOCATION
}

/**
 * The identifiers a command presents for one patient and the identity service's answers for this command (SI-01
 * clause e; encounter.yaml `patientIdentityConfirmed`).
 *
 * @property presented The kinds of identifier the command presents.
 * @property mrnCheckDigitValid The identity service's answer: the MRN is this patient's, with a valid check digit.
 * @property secondIdentifierConfirmed The identity service's answer: the date of birth at its recorded precision, or the
 *   approximate-DOB flag, matches this patient.
 */
data class PatientIdentification(
    val presented: Set<IdentifierKind>,
    val mrnCheckDigitValid: Answer,
    val secondIdentifierConfirmed: Answer,
)

/**
 * The tenant's triage configuration (§9.14: the scale is chosen by the hospital; governed content [HUMAN]; synthetic
 * configurations in tests are NOT FOR CLINICAL USE).
 *
 * @property scale The configured triage scale.
 * @property levels The scale's configured levels.
 * @property requiredVitals The vital signs the triage form marks as required; may be empty.
 * @property notObtainedReasons The governed reasons a required vital may be "not obtained".
 */
data class TriageConfiguration(
    val scale: String,
    val levels: Set<String>,
    val requiredVitals: Set<String>,
    val notObtainedReasons: Set<String>,
)

/** One vital sign in a triage record. */
sealed interface VitalEntry {
    /** A value with its time (the value as recorded; the machine does no arithmetic on it). */
    data class Measured(
        val value: String,
        val time: Instant?,
    ) : VitalEntry

    /** "Not obtained", with the reason the user chose. */
    data class NotObtained(
        val reason: Chosen<String>?,
    ) : VitalEntry
}

/** The triage record a Triage command carries (§8.4 "scale, complaint, vitals, time"; R11 §5). */
data class TriageRecord(
    val scale: String?,
    val level: String?,
    val chiefComplaint: String?,
    val triageTime: Instant?,
    val triagingUser: String?,
    val vitals: Map<String, VitalEntry>,
)

/** A triage record the encounter holds. */
data class HeldTriageRecord(
    val id: String,
    val enteredInError: Boolean,
)

/** The bed aggregate's view of one bed: its state (null when unknown) and the encounter its reservation names. */
data class BedView(
    val state: BedState?,
    val reservedForEncounterId: String?,
)

/**
 * The swap partner a SwapBeds command names, chosen as a patient (encounter.yaml `swapPartnerIdentityConfirmed`).
 *
 * @property encounterId The partner's encounter.
 * @property state ADT's answer for the partner's state; null when unknown.
 * @property identification The two identifiers the command carries for the partner's patient.
 * @property placement The restriction facts of the partner's patient.
 */
data class SwapPartner(
    val encounterId: String,
    val state: EncounterState?,
    val identification: PatientIdentification?,
    val placement: PatientPlacement,
)

/**
 * The discharge a CancelDischarge command cancels.
 *
 * @property firedFrom The state the discharge was fired from; null when unknown.
 * @property effectiveTime The discharge's effective time.
 * @property closedBedId The bed whose period the discharge closed; null for a departure before admission.
 * @property died Whether the disposition recorded was a death, as the disposition list classifies it.
 */
data class DischargeRecord(
    val firedFrom: EncounterState?,
    val effectiveTime: Instant?,
    val closedBedId: String?,
    val died: Answer,
)

/** The encounter's last transfer: its effective time and the bed whose period it closed. */
data class TransferRecord(
    val effectiveTime: Instant?,
    val previousBedId: String?,
)

/** Which end of a bed period or leave entry a correction moves. */
enum class BoundaryEnd {
    START,
    END,
}

/** The boundary a CorrectLocationTime command changes: the entry, which end, and its new effective time. */
data class BoundaryCorrection(
    val entryId: String?,
    val end: BoundaryEnd,
    val newTime: Instant?,
)

/**
 * One paper location period of a downtime back-entry (SI-10 clause c; CTRL-0010-5; SAC-47).
 *
 * @property bedId The bed.
 * @property start The paper start.
 * @property end The paper end; null for the open-ended last period.
 * @property downtimeLabel Labelled as downtime entry.
 * @property paperSourceReference The reference of its paper source.
 */
data class PaperPeriod(
    val bedId: String?,
    val start: Instant?,
    val end: Instant?,
    val downtimeLabel: Boolean,
    val paperSourceReference: String?,
)

/** A downtime spell the site record holds: its kind (a mode other than on-site cell) and its interval. */
data class DowntimeSpell(
    val kind: ConnectivityMode,
    val start: Instant,
    val end: Instant?,
)

/** The coded reasons for marking an encounter in error (§9.12 "cancellations with a reason"). */
enum class ErrorReason {
    WRONG_PATIENT,
    DUPLICATE_ENCOUNTER,
    REGISTERED_IN_ERROR,
}

/**
 * The encounter of the patient who actually received the care, named by a wrong-patient CancelAdmission.
 *
 * @property encounterId Its encounter.
 * @property patientId Its patient.
 * @property state ADT's answer for its state; null when unknown.
 * @property identification The two identifiers the command carries for its patient.
 */
data class ReplacementEncounter(
    val encounterId: String,
    val patientId: String,
    val state: EncounterState?,
    val identification: PatientIdentification?,
)

/** A location period received by hand-over: bed and original times. */
data class HandedOverPeriod(
    val bedId: String,
    val start: Instant,
    val end: Instant?,
)

/**
 * The hand-over a ReceiveBedHandOver command receives from a wrong-patient CancelAdmission (encounter.yaml
 * `handOverPeriodValid`).
 *
 * @property sourceEncounterId The encounter being cancelled.
 * @property inSameTransaction The cancellation is in the same transaction as this command.
 * @property sourceErrorReason The error reason the cancellation carries.
 * @property sourceReplacementEncounterId The replacement encounter the cancellation names.
 * @property receivedPeriods The periods this encounter receives.
 */
data class HandOver(
    val sourceEncounterId: String,
    val inSameTransaction: Boolean,
    val sourceErrorReason: ErrorReason?,
    val sourceReplacementEncounterId: String?,
    val receivedPeriods: List<HandedOverPeriod>,
)

/**
 * The Trust Plane's and the audit writer's answers for one command (encounter.yaml `privilegedAndAudited`).
 *
 * @property commandPrivilege The user holds the privilege this command requires (governed configuration: back-entry and
 *   time correction need supervisor rights).
 * @property deathReversalPrivilege The user holds the separate death-reversal privilege (DN-051 item 16).
 * @property auditAccepted The audit event (actor, reason, effective and recorded time) is accepted for writing.
 */
data class Authorisation(
    val commandPrivilege: Answer,
    val deathReversalPrivilege: Answer,
    val auditAccepted: Answer,
)
