package hms.adt.domain.bed

import hms.adt.domain.common.Answer
import hms.adt.domain.common.BedAttributes
import hms.adt.domain.common.Chosen
import hms.adt.domain.common.CommandChannel
import hms.adt.domain.common.ConnectivityMode
import hms.adt.domain.common.FinanceFacts
import hms.adt.domain.common.GenderRule
import hms.adt.domain.common.LocationPeriod
import hms.adt.domain.common.OverrideRequest
import hms.adt.domain.common.PatientPlacement
import hms.adt.domain.encounter.EncounterState
import java.time.Instant

/**
 * What the bed aggregate knows when it decides a bed command: the facts every predicate of the bed machine reads
 * (docs/specs/state-machines/bed.yaml; docs/specs/modules/state-machines-and-invariants.md §3.1). Pure values; time
 * arrives as data. Occupancy is read from the encounters' location histories ([periods]), never from a table of the
 * bed's own (R11 §5 key rule). Facts only one kind of command carries are null for the others.
 *
 * @property bedId This bed (`SYN-` identifiers in tests).
 * @property channel How the command reached the domain.
 * @property clientModeAtIssue The client's connectivity mode when the command was issued; null when unknown.
 * @property wanReachable Whether the internet was reachable. No predicate reads it (SI-15 clause h).
 * @property commandEncounterId The encounter the command names: to reserve for, to place, returning, back-entered.
 * @property commandEncounterState ADT's answer for that encounter's state; null when unknown.
 * @property reservationEncounterId The encounter the bed's current reservation names, if any.
 * @property reservationEncounterState ADT's answer for that encounter's state, counting the state the same transaction
 *   moves it to; null when unknown.
 * @property patientPlacement The restriction facts of the patient of [commandEncounterId].
 * @property attributes The bed's configured restrictions (location tree, §8.2).
 * @property genderRules The tenant's gender matching rules, by restriction (governed configuration [HUMAN]).
 * @property override The override of restrictions a ReserveWithOverride command carries.
 * @property periods Every location period on this bed, of every encounter, entered-in-error ones included.
 * @property occupancyStart The start of the occupancy period the command begins: the occupying command's effective time
 *   (Occupy), the time the cancelled discharge or transfer closed the returning period (Reoccupy), or the paper start
 *   of the back-entered open period (RecordBackEnteredOccupancy); null when unknown.
 * @property cancelledClosure The discharge or transfer a Reoccupy cancels.
 * @property backEnteredOccupancy The back-entered period a RecordBackEnteredOccupancy records.
 * @property cleaningJob The bed's cleaning task.
 * @property blockReason The block reason a Block command carries.
 * @property reason The reason the command carries.
 * @property outOfUseSpell The current out-of-use spell (consecutive blocked and closed states); null when unknown.
 * @property commandPrivilege The Trust Plane's answer: the user holds the privilege this command requires.
 * @property auditAccepted The audit event is accepted for writing.
 * @property finance Payment facts no predicate reads (SI-12).
 */
data class BedFacts(
    val bedId: String,
    val channel: CommandChannel,
    val clientModeAtIssue: ConnectivityMode?,
    val wanReachable: Boolean?,
    val commandEncounterId: String?,
    val commandEncounterState: EncounterState?,
    val reservationEncounterId: String?,
    val reservationEncounterState: EncounterState?,
    val patientPlacement: PatientPlacement,
    val attributes: BedAttributes,
    val genderRules: Map<String, GenderRule>,
    val override: OverrideRequest?,
    val periods: List<LocationPeriod>,
    val occupancyStart: Instant?,
    val cancelledClosure: CancelledClosure?,
    val backEnteredOccupancy: BackEnteredOccupancy?,
    val cleaningJob: CleaningJob?,
    val blockReason: Chosen<BlockReason>?,
    val reason: Chosen<String>?,
    val outOfUseSpell: OutOfUseSpell?,
    val commandPrivilege: Answer,
    val auditAccepted: Answer,
    val finance: FinanceFacts,
)

/** What closed the period a Reoccupy returns to. */
enum class ClosureKind {
    DISCHARGE,
    TRANSFER,
}

/** The discharge or transfer a Reoccupy cancels: its kind and the location period it closed. */
data class CancelledClosure(
    val kind: ClosureKind,
    val closedPeriodId: String,
)

/**
 * The occupancy a RecordBackEnteredOccupancy records: the last period of a back-entered location history that the
 * encounter's BackEnterLocationPeriods applies.
 *
 * @property encounterId The back-entering encounter.
 * @property bedId The bed the period names.
 * @property start The paper start.
 * @property end The paper end; null for the open-ended last period.
 * @property lastOfBackEntry The period is the last period of the back-entered history.
 * @property appliedInSameTransaction The encounter's back-entry is applied in the same transaction.
 */
data class BackEnteredOccupancy(
    val encounterId: String,
    val bedId: String,
    val start: Instant,
    val end: Instant?,
    val lastOfBackEntry: Boolean,
    val appliedInSameTransaction: Boolean,
)

/** Cleaning types (bed.yaml `requiredCleanRecorded`; checklists are infection prevention and control content [HUMAN]). */
enum class CleanType {
    STANDARD,
    TERMINAL,
}

/** The bed's cleaning task: the type its job requires (null when unknown) and the completed clean recorded, if any. */
data class CleaningJob(
    val requiredType: CleanType?,
    val completedClean: CleanType?,
)

/** Block reasons (§8.4; R11 §10.6). */
enum class BlockReason {
    ISOLATION,
    CONTAMINATION,
    MAINTENANCE,
    STAFFING,
}

/**
 * The current out-of-use spell: the state the bed entered it from, and every block reason during it (empty for a bed
 * only closed). Null fields are unknown.
 */
data class OutOfUseSpell(
    val enteredFrom: BedState?,
    val blockReasons: List<BlockReason>?,
)
