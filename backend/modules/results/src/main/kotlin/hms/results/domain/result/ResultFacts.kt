package hms.results.domain.result

import java.time.Instant

/**
 * The facts the result machine's predicates read when a command is decided (docs/specs/state-machines/result.yaml;
 * docs/specs/modules/state-machines-and-invariants.md §3.1 "Facts, not aggregates").
 *
 * Every field is what the results aggregate will know at the moment of the command. Several are another module's answer,
 * as each predicate's description says: the Trust Plane's privileges (§9.26), the LIS's specimen states and QC (lis owns
 * them), ADT's encounter class and state, the critical-result policy's verdict per value (§9.7), the Regulatory Boundary
 * Register's entry (§10.2) and the reg-lis-rules verdict (§9.8). Time arrives as data in [now]; nothing here reads a clock.
 * The facts hold no threshold, reference range or code list: clinical content is governed configuration [HUMAN], and the
 * property tests use synthetic `SYN-` values only (NOT FOR CLINICAL USE).
 *
 * @property now The time of the command (the clock reading the command handler passes in).
 * @property resultId The result the command acts on.
 * @property test The result's test: laboratory section, analyte, specimen type, method and analyser.
 * @property currentVersionId The result's current filed version, or null when no version has been filed yet.
 * @property versionBeingFiled The version the command files (a release, a revised preliminary, an amendment or a
 *   correction), or null when the command files none (cancel, entered in error, a discharge notice).
 * @property actingUser The user issuing the command, as authenticated; null when unknown.
 * @property validation The technologist validation recorded for a version, if any.
 * @property validationPrivilege The Trust Plane's answer on the result-validation privilege, if any.
 * @property actionPrivilege The Trust Plane's answer on the privilege for this command's action on this result (amend,
 *   correct, cancel a released preliminary, mark entered in error), if any.
 * @property audit The audit context the command carries, if any.
 * @property specimens The LIS's answer at [now]: the state of each specimen, by specimen id. A specimen missing from the
 *   map has an unknown state.
 * @property encounter What the result's order says about its encounter, with ADT's answers.
 * @property correctionReason The reason given for a change (revised preliminary, amendment, correction), if any.
 * @property cancellationReason The reason given for a cancellation, if any.
 * @property errorReason The reason given for marking the result entered in error, if any.
 * @property governedReasons The governed reason lists (content [HUMAN]).
 * @property autoverification The facts autoverification depends on.
 */
data class ResultFacts(
    val now: Instant,
    val resultId: String,
    val test: TestIdentity,
    val currentVersionId: String?,
    val versionBeingFiled: FiledVersion?,
    val actingUser: ActingUser?,
    val validation: TechnologistValidation?,
    val validationPrivilege: ValidationPrivilege?,
    val actionPrivilege: ActionPrivilege?,
    val audit: AuditContext?,
    val specimens: Map<String, SpecimenStatus>,
    val encounter: EncounterLink,
    val correctionReason: ReasonEntry?,
    val cancellationReason: ReasonEntry?,
    val errorReason: ReasonEntry?,
    val governedReasons: GovernedReasonLists,
    val autoverification: AutoverificationFacts,
)

/** The kind of account behind a user (§9.26). Only [HUMAN] may validate or act with privilege (result.yaml). */
enum class AccountKind {
    /** A person who signed in. */
    HUMAN,

    /** A system account of the platform itself. */
    SYSTEM,

    /** An interface or integration account (an instrument gateway, a seam). */
    INTEGRATION,

    /** An AI agent's account (SI-07). */
    AI_AGENT,
}

/**
 * The user issuing the command.
 *
 * @property userId The user's id.
 * @property kind The kind of account.
 * @property authenticated Whether the user is authenticated for this command.
 */
data class ActingUser(
    val userId: String,
    val kind: AccountKind,
    val authenticated: Boolean,
)

/**
 * A laboratory test as the critical-result policy, the Trust Plane and an autoverification opinion name it
 * (result.yaml `autoverificationActive`: "laboratory section, analyte, specimen type, method and analyser").
 */
data class TestIdentity(
    val laboratorySection: String,
    val analyte: String,
    val specimenType: String,
    val method: String,
    val analyser: String,
)

/**
 * A version of the result, as filed by the command.
 *
 * A value the version withdraws is simply absent from [values]: a version that only withdraws values holds only values
 * carried unchanged, so the specimen and QC checks have nothing to check (result.yaml `qcAllowsRelease`).
 *
 * @property versionId The version's id.
 * @property lastValueChangeAt When a value of this version last changed.
 * @property values Every value of the version.
 */
data class FiledVersion(
    val versionId: String,
    val lastValueChangeAt: Instant,
    val values: List<ResultValue>,
)

/** How a value of the version being filed relates to the result's earlier versions (result.yaml `qcAllowsRelease`). */
enum class ValueChange {
    /** A value from a new measurement. */
    NEW_MEASUREMENT,

    /** A value changed with no new measurement: a transcription or unit correction. */
    CHANGED_WITHOUT_NEW_MEASUREMENT,

    /** A value carried unchanged from an earlier released version. */
    CARRIED_UNCHANGED,
}

/**
 * One value of a version.
 *
 * @property valueId The value's id.
 * @property change How it relates to earlier versions.
 * @property specimenId The specimen it was measured on, or the specimen sent to the reference laboratory; null when the
 *   value carries no specimen reference.
 * @property performer Who performed the measurement.
 * @property criticalVerdict The critical-result policy's verdict on this value (§9.7; another module's answer).
 * @property markedCriticalByTechnologist Whether the validating technologist marked it critical.
 */
data class ResultValue(
    val valueId: String,
    val change: ValueChange,
    val specimenId: String?,
    val performer: Performer,
    val criticalVerdict: CriticalVerdict,
    val markedCriticalByTechnologist: Boolean,
)

/** Who performed a value's measurement (§9.8 performing-lab identification). */
sealed interface Performer {
    /**
     * Measured in house. For a value changed with no new measurement, these are its original measurement's facts.
     *
     * @property measuredAt When it was measured.
     * @property runQc The LIS's answer on the QC covering the run, if any.
     * @property currentAnalyserQc The LIS's answer on the analyser's current QC for the test, if any.
     */
    data class InHouse(
        val measuredAt: Instant,
        val runQc: QcRecord?,
        val currentAnalyserQc: QcRecord?,
    ) : Performer

    /**
     * Performed by a reference laboratory.
     *
     * @property laboratoryId The reference laboratory's identification on the value, if any.
     * @property laboratorySpecimenRef The reference laboratory's own specimen reference on the value, if any.
     */
    data class ReferenceLaboratory(
        val laboratoryId: String?,
        val laboratorySpecimenRef: String?,
    ) : Performer
}

/** A QC state, as the LIS reports it (lis owns QC, DX-LAB-04). */
enum class QcStatus {
    /** QC passed. */
    PASSED,

    /** QC failed. */
    FAILED,

    /** The LIS does not know. */
    UNKNOWN,
}

/**
 * One QC answer from the LIS: its state and the period it covers. Overdue means the period has ended.
 *
 * @property status The QC state.
 * @property validFrom The start of the period it covers, if known.
 * @property validUntil The end of the period it covers (exclusive), if known.
 */
data class QcRecord(
    val status: QcStatus,
    val validFrom: Instant?,
    val validUntil: Instant?,
)

/**
 * The governed critical-result policy's verdict on one value (§9.7; thresholds [HUMAN]; result.yaml
 * `criticalValueFlagged`, DN-055 item 4). Only [NOT_CRITICAL] and [NO_CRITICAL_LIMITS] count as not critical.
 */
enum class CriticalVerdict {
    /** The value is critical. */
    CRITICAL,

    /** The value is evaluated and not critical. */
    NOT_CRITICAL,

    /** The policy records that the test has no critical limits: evaluated, not critical. */
    NO_CRITICAL_LIMITS,

    /** Not evaluated: the test is missing from the policy table (a catalogue error). Counts as critical. */
    NOT_EVALUATED_TEST_NOT_IN_POLICY,

    /** Not evaluated: context the test's policy needs (age, location) is missing. Counts as critical. */
    NOT_EVALUATED_CONTEXT_MISSING,
}

/**
 * A technologist validation (§8.4, §9.8).
 *
 * @property versionId The version it names.
 * @property validatedBy The validating user's id.
 * @property recordedAt When it was recorded.
 */
data class TechnologistValidation(
    val versionId: String,
    val validatedBy: String,
    val recordedAt: Instant,
)

/**
 * The Trust Plane's answer on the result-validation privilege (§9.26; another module's answer).
 *
 * @property userId The user asked about.
 * @property laboratorySection The laboratory section asked about.
 * @property granted Whether the user holds the privilege for that section.
 */
data class ValidationPrivilege(
    val userId: String,
    val laboratorySection: String,
    val granted: Boolean,
)

/**
 * The Trust Plane's answer on the privilege for the command's action on a result (§9.26; another module's answer).
 *
 * @property userId The user asked about.
 * @property resultId The result asked about.
 * @property granted Whether the user holds the privilege.
 */
data class ActionPrivilege(
    val userId: String,
    val resultId: String,
    val granted: Boolean,
)

/**
 * The audit context a command carries (B.3 `privilegedAndAudited`). A missing part is null.
 *
 * @property userId The acting user.
 * @property at The time of the action.
 * @property resultId The result acted on.
 * @property versionActedOn The version acted on; null when the command names none.
 */
data class AuditContext(
    val userId: String?,
    val at: Instant?,
    val resultId: String?,
    val versionActedOn: String?,
)

/**
 * A specimen's state as the LIS reports it: the specimen machine's states (docs/specs/state-machines/specimen.yaml;
 * lis owns them), plus [UNKNOWN].
 */
enum class SpecimenStatus {
    /** Specimen state `ordered`. */
    ORDERED,

    /** Specimen state `label-printed`. */
    LABEL_PRINTED,

    /** Specimen state `collected`. */
    COLLECTED,

    /** Specimen state `in-transit`. */
    IN_TRANSIT,

    /** Specimen state `received`. */
    RECEIVED,

    /** Specimen state `in-process`. */
    IN_PROCESS,

    /** Specimen state `resulted`. */
    RESULTED,

    /** Specimen state `stored`. */
    STORED,

    /** Specimen state `disposed`. */
    DISPOSED,

    /** Specimen state `rejected`. */
    REJECTED,

    /** Specimen state `cancelled`. */
    CANCELLED,

    /** Specimen state `lost`. */
    LOST,

    /** Specimen state `entered-in-error`. */
    ENTERED_IN_ERROR,

    /** The LIS does not know the state. */
    UNKNOWN,
}

/** An encounter's class, as ADT reports it. [UNKNOWN] covers any class ADT does not report as one of the others. */
enum class EncounterClass {
    /** An inpatient encounter. */
    INPATIENT,

    /** An emergency encounter. */
    EMERGENCY,

    /** A day-case encounter. */
    DAY_CASE,

    /** An outpatient visit. */
    OUTPATIENT,

    /** The class is unknown. */
    UNKNOWN,
}

/**
 * An encounter's state as ADT reports it: the encounter machine's states (docs/specs/state-machines/encounter.yaml; adt
 * owns them), plus [UNKNOWN].
 */
enum class EncounterStatus {
    /** Encounter state `planned`. */
    PLANNED,

    /** Encounter state `arrived`. */
    ARRIVED,

    /** Encounter state `triaged`. */
    TRIAGED,

    /** Encounter state `in-progress`. */
    IN_PROGRESS,

    /** Encounter state `on-leave`. */
    ON_LEAVE,

    /** Encounter state `discharged-not-closed`. */
    DISCHARGED_NOT_CLOSED,

    /** Encounter state `finished`. */
    FINISHED,

    /** Encounter state `cancelled`. */
    CANCELLED,

    /** Encounter state `entered-in-error`. */
    ENTERED_IN_ERROR,

    /** ADT does not know the state, or reports one this build does not know. */
    UNKNOWN,
}

/** What the result's order records about its encounter (result.yaml `patientDischarged`, DN-055 item 8). */
sealed interface EncounterLink {
    /** The order records positively, when placed, that it has no encounter (an external referrer's outpatient-tier order). */
    data object NoEncounterRecorded : EncounterLink

    /** The order's encounter link is missing. */
    data object Missing : EncounterLink

    /** The order's encounter link does not resolve. */
    data object Unresolved : EncounterLink

    /**
     * The link resolves; ADT's answers about the encounter at the time of the command.
     *
     * @property encounterClass The encounter's class.
     * @property status The encounter's state.
     */
    data class Resolved(
        val encounterClass: EncounterClass,
        val status: EncounterStatus,
    ) : EncounterLink
}

/** How a reason came to be on the command (result.yaml reason predicates, DN-055 item 10). */
enum class ReasonSelection {
    /** The user chose the coded reason. */
    USER_SELECTED,

    /** The screen preselected it. */
    PRESELECTED,

    /** A default filled it in. */
    DEFAULTED,
}

/**
 * A reason given with a command.
 *
 * @property code The coded reason, if any.
 * @property selection How the code came to be there.
 * @property text Free text, if any. Text alone never counts as a reason.
 */
data class ReasonEntry(
    val code: String?,
    val selection: ReasonSelection,
    val text: String?,
)

/**
 * The governed reason lists (content [HUMAN]; synthetic samples are marked NOT FOR CLINICAL USE).
 *
 * @property correction The codes of the correction-reason list.
 * @property cancellation The codes of the cancellation-reason list.
 * @property enteredInError The codes of the entered-in-error reason list.
 */
data class GovernedReasonLists(
    val correction: Set<String>,
    val cancellation: Set<String>,
    val enteredInError: Set<String>,
)

/** A Regulatory Boundary Register status (§10.2; SI-18). Only [CLEARED] and [NOT_REQUIRED] allow activation. */
enum class RegisterStatus {
    /** Not assessed. */
    NOT_ASSESSED,

    /** Clearance required and not given. */
    REQUIRED,

    /** Cleared. */
    CLEARED,

    /** Clearance not required. */
    NOT_REQUIRED,

    /** Withdrawn. */
    WITHDRAWN,
}

/** The intended purpose a written local opinion records (SI-18 clause b). */
enum class OpinionPurpose {
    /** The release of results by autoverification. */
    RELEASE_OF_RESULTS_BY_AUTOVERIFICATION,

    /** Any other purpose. */
    OTHER,
}

/**
 * The written local opinion behind a Register entry (SI-18 clauses a to c).
 *
 * @property documentRef The stored opinion document; null or blank when none is stored.
 * @property expiresAt When it expires, if recorded.
 * @property scope The tests it covers.
 * @property intendedPurpose Its intended purpose.
 * @property validatedRuleSetVersion The reg-lis-rules rule-set version validated under the entry, if recorded.
 */
data class RegisterOpinion(
    val documentRef: String?,
    val expiresAt: Instant?,
    val scope: Set<TestIdentity>,
    val intendedPurpose: OpinionPurpose,
    val validatedRuleSetVersion: String?,
)

/**
 * A Regulatory Boundary Register entry (§10.2; the Register's answer, another module owns it).
 *
 * @property function The Tier 2 function it is for.
 * @property functionVersion The function version it is for.
 * @property jurisdiction The jurisdiction it is for.
 * @property status Its status.
 * @property opinion Its written local opinion, if any.
 */
data class RegisterEntry(
    val function: String,
    val functionVersion: String,
    val jurisdiction: String,
    val status: RegisterStatus,
    val opinion: RegisterOpinion?,
)

/** The §9.8 autoverification rule stack, in its order (rules are governed content [HUMAN]). */
enum class AutoverificationRule {
    /** Instrument error codes and QC status. */
    INSTRUMENT_ERROR_CODES_AND_QC_STATUS,

    /** HIL indices. */
    HIL_INDICES,

    /** Measurement range and dilution. */
    MEASUREMENT_RANGE_AND_DILUTION,

    /** Absurd limits. */
    ABSURD_LIMITS,

    /** Critical value. */
    CRITICAL_VALUE,

    /** Delta check. */
    DELTA_CHECK,

    /** Cross-analyte consistency. */
    CROSS_ANALYTE_CONSISTENCY,

    /** Patient context. */
    PATIENT_CONTEXT,
}

/** A reg-lis-rules verdict's outcome. */
enum class RulesOutcome {
    /** Release the version. */
    RELEASE,

    /** Hold the version for manual review. */
    HOLD,
}

/**
 * A reg-lis-rules verdict (§9.8; another module's answer).
 *
 * @property versionId The version it is for.
 * @property outcome Release or hold.
 * @property ruleSetVersion The rule-set version it names, if any.
 * @property rulesRun The rules it ran, in the order run.
 */
data class RulesVerdict(
    val versionId: String,
    val outcome: RulesOutcome,
    val ruleSetVersion: String?,
    val rulesRun: List<AutoverificationRule>,
)

/**
 * The facts autoverification depends on (result.yaml `autoverificationActive`, `autoverificationRulesPassed`; SI-18).
 *
 * @property tenantFlagOn The tenant's autoverification flag. It never suffices alone (SI-18 clause d).
 * @property runningFunctionVersion The reg-lis-rules version that is running.
 * @property tenantJurisdiction The tenant's jurisdiction.
 * @property registerEntry The Register's entry for reg-lis-rules, if any.
 * @property verdict The reg-lis-rules verdict, if any.
 */
data class AutoverificationFacts(
    val tenantFlagOn: Boolean,
    val runningFunctionVersion: String,
    val tenantJurisdiction: String,
    val registerEntry: RegisterEntry?,
    val verdict: RulesVerdict?,
)
