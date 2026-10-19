package hms.adt.domain.common

/** A patient's administrative sex as the record holds it (bed.yaml `bedRestrictionsAdmitPatient`). */
sealed interface RecordedSex {
    /** No sex is recorded. */
    data object NotRecorded : RecordedSex

    /** The sex is recorded as unknown. */
    data object RecordedUnknown : RecordedSex

    /** A recorded sex, as the tenant's code (governed configuration [HUMAN]; synthetic codes in tests). */
    data class Recorded(
        val code: String,
    ) : RecordedSex
}

/**
 * An active isolation requirement of a patient (a patient flag, §8.2). A null [kind] is a requirement of unknown kind,
 * which fails a bed's restrictions (bed.yaml `bedRestrictionsAdmitPatient`).
 */
data class IsolationRequirement(
    val kind: String?,
)

/**
 * What the bed restrictions read about the patient who would move into a bed.
 *
 * @property sex The administrative sex as recorded.
 * @property onUnidentifiedAlias The patient is registered on an unidentified-patient alias (SAC-06); the sex then counts
 *   as unknown.
 * @property isolation The patient's active isolation requirement, or null when the patient has none.
 */
data class PatientPlacement(
    val sex: RecordedSex,
    val onUnidentifiedAlias: Boolean,
    val isolation: IsolationRequirement?,
)

/** The pressure signal of a bed's room, as the building-signal adapter reports it (§9.12). */
enum class PressureSignal {
    /** The room has no pressure monitoring, so it has no alarm. */
    NOT_MONITORED,

    /** The room is monitored and no alarm is active. */
    NORMAL,

    /** A pressure alarm is active: the only signal that fails a reservation (§9.12 "pressure alarms ... block assignment"). */
    ALARM_ACTIVE,

    /** The signal is lost or stale: a warning with an owned task, never a block (bed.yaml `noActivePressureAlarm`). */
    UNKNOWN,
}

/**
 * The configured restrictions of a bed (location attributes, §8.2) and its area's declarations.
 *
 * @property genderRestriction The bed's gender restriction, or null when it has none.
 * @property isolationCapabilities The isolation kinds the bed can meet, or null when its capability is unknown.
 * @property activeCohortKinds The isolation kinds for which infection prevention and control has an active cohort
 *   declaration covering the bed's area (outbreak cohorting).
 * @property pressureSignal The pressure signal of the bed's room.
 */
data class BedAttributes(
    val genderRestriction: String?,
    val isolationCapabilities: Set<String>?,
    val activeCohortKinds: Set<String>,
    val pressureSignal: PressureSignal,
) {
    /** Named values. */
    companion object {
        /** A bed whose attributes the location tree does not hold: no known restriction, unknown capability and signal. */
        val NOT_RECORDED: BedAttributes = BedAttributes(null, null, emptySet(), PressureSignal.UNKNOWN)
    }
}

/**
 * The tenant's matching rule for one gender restriction (governed configuration [HUMAN]; synthetic values in tests are
 * NOT FOR CLINICAL USE): the sex codes the restricted bed admits and the codes it excludes. A code in neither set is
 * not covered by the rule.
 */
data class GenderRule(
    val admitted: Set<String>,
    val excluded: Set<String>,
)

/** A bed restriction a reservation or swap override names (bed.yaml and encounter.yaml `overrideReasonChosen`). */
enum class RestrictionKind {
    GENDER,
    ISOLATION,
    PRESSURE_ALARM,
}

/** The coded override reasons (bed.yaml and encounter.yaml `overrideReasonChosen`). */
enum class OverrideReason {
    CLINICAL_EMERGENCY,
    IPC_APPROVED_COHORT,
    RESTRICTION_DATA_WRONG_OR_UNKNOWN,
}

/** An override of bed restrictions: the reason and every restriction the command names as overridden. */
data class OverrideRequest(
    val reason: Chosen<OverrideReason>?,
    val overridden: Set<RestrictionKind>,
)

/**
 * The bed restrictions of §9.12 ("gender and isolation constraints"; "isolation-room pressure alarms from building
 * signals block assignment"), implemented once for bed `bedRestrictionsAdmitPatient` and `noActivePressureAlarm` and for
 * encounter `swappedBedsAdmitBothPatients` (DN-056 items 1 to 3; DN-051 item 11).
 */
@Suppress("ReturnCount") // Each unknown fact is an early guard clause ("an unknown ... fails").
object BedRestrictions {
    /**
     * True when the bed's gender restriction is known to exclude the patient: the bed has a restriction, the tenant has a
     * rule for it, the patient's sex is recorded (not unknown, not on an alias) and the rule excludes that code. An
     * unknown sex, a sex the rule does not cover and a restriction with no rule never exclude.
     */
    fun genderExcludes(
        bed: BedAttributes,
        patient: PatientPlacement,
        genderRules: Map<String, GenderRule>,
    ): Boolean {
        val restriction = bed.genderRestriction ?: return false
        val rule = genderRules[restriction] ?: return false
        val sex = patient.sex
        return sex is RecordedSex.Recorded && !patient.onUnidentifiedAlias && sex.code in rule.excluded
    }

    /**
     * True when the patient's isolation requirement is not met: a requirement of unknown kind; an unknown capability of
     * the bed, whatever the area's cohort declarations; or a known capability that meets neither the kind nor an active
     * cohort declaration for it. A patient with no requirement is always met.
     */
    fun isolationUnmet(
        bed: BedAttributes,
        patient: PatientPlacement,
    ): Boolean {
        val requirement = patient.isolation ?: return false
        val kind = requirement.kind ?: return true
        val capabilities = bed.isolationCapabilities ?: return true
        return kind !in capabilities && kind !in bed.activeCohortKinds
    }

    /** True when a pressure alarm is active for the bed's room; an unknown or stale signal is not an alarm. */
    fun pressureAlarmActive(bed: BedAttributes): Boolean = bed.pressureSignal == PressureSignal.ALARM_ACTIVE

    /** True when no configured restriction of the bed is known to exclude the patient (gender and isolation). */
    fun admits(
        bed: BedAttributes,
        patient: PatientPlacement,
        genderRules: Map<String, GenderRule>,
    ): Boolean = !genderExcludes(bed, patient, genderRules) && !isolationUnmet(bed, patient)

    /** Every restriction that would refuse placing the patient in the bed. */
    fun failing(
        bed: BedAttributes,
        patient: PatientPlacement,
        genderRules: Map<String, GenderRule>,
    ): Set<RestrictionKind> =
        buildSet {
            if (genderExcludes(bed, patient, genderRules)) add(RestrictionKind.GENDER)
            if (isolationUnmet(bed, patient)) add(RestrictionKind.ISOLATION)
            if (pressureAlarmActive(bed)) add(RestrictionKind.PRESSURE_ALARM)
        }

    /**
     * True when the user chose a coded override reason (never defaulted) and the command names at least one restriction
     * and every restriction in [failing]. SI-15 and the exclusion constraint are separate predicates and never
     * overridable.
     */
    fun overrideChosen(
        override: OverrideRequest?,
        failing: Set<RestrictionKind>,
    ): Boolean {
        if (override == null) return false
        val reason = override.reason ?: return false
        return reason.byUser && override.overridden.isNotEmpty() && override.overridden.containsAll(failing)
    }
}
