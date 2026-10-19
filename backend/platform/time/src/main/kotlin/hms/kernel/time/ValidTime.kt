package hms.kernel.time

/**
 * Clinical validity of a fact with its original offsets: `[start, endExclusive)`, `endExclusive` null means
 * open, never empty (platform-kernel.md §6.1; SI-10; §5.3).
 */
class ValidTime private constructor(
    val start: ClinicalTime,
    val endExclusive: ClinicalTime?,
) {
    init {
        require(endExclusive == null || endExclusive.instant.isAfter(start.instant)) {
            "ValidTime must not be empty or reversed: [$start, $endExclusive)"
        }
    }

    /** The same instants as a [ValidPeriod]; the offsets are dropped. */
    fun toValidPeriod(): ValidPeriod =
        when (endExclusive) {
            null -> ValidPeriod.from(start.instant)
            else -> (ValidPeriod.of(start.instant, endExclusive.instant) as ValidPeriodResult.Valid).period
        }

    override fun equals(other: Any?): Boolean = other is ValidTime && start == other.start && endExclusive == other.endExclusive

    override fun hashCode(): Int = 31 * start.hashCode() + (endExclusive?.hashCode() ?: 0)

    override fun toString(): String = "[$start, ${endExclusive ?: "∞"})"

    companion object {
        @JvmStatic
        fun from(start: ClinicalTime): ValidTime = ValidTime(start, null)

        /** Emptiness is checked after truncation to microseconds (both bounds are already truncated [ClinicalTime]s). */
        @JvmStatic
        fun of(
            start: ClinicalTime,
            endExclusive: ClinicalTime,
        ): ValidTimeResult =
            if (endExclusive.instant.isAfter(start.instant)) {
                ValidTimeResult.Valid(ValidTime(start, endExclusive))
            } else {
                ValidTimeResult.EmptyOrReversed
            }
    }
}

sealed interface ValidTimeResult {
    data class Valid(
        val validTime: ValidTime,
    ) : ValidTimeResult

    /** endExclusive is not after start. */
    data object EmptyOrReversed : ValidTimeResult
}

/** What an entry says about its valid time (platform-kernel.md §6.1, §6.2; D10). */
sealed interface ValidTimeInput {
    data class Given(
        val validTime: ValidTime,
    ) : ValidTimeInput

    /** The act is its own recording: the journal appender sets start = its recorded time, offset UTC, open end. */
    data object AtRecording : ValidTimeInput
}

/** Declared per event type in the event catalogue (hms.kernel.events), never by a command or a request (platform-kernel.md §6.1). */
enum class ValidTimeKind {
    /** A clinical act whose time the user, the device or the interface supplies (an observation, a dose given). */
    CLINICAL_CAPTURED,

    /** An act that happens when the server records it (for example a task state change); may also be given a time. */
    CLINICAL_AT_RECORDING,

    /**
     * An effective date of configuration or structure (tenancy, config); not a clinical time. A start earlier
     * than the recorded time is BackDated (§6.2).
     */
    EFFECTIVE,
}

/** Where the stored clinical time came from. Stored with the journal row and shown with the label (platform-kernel.md §6.1, §14). */
enum class ClinicalTimeSource { ENTERED, DEVICE, INTERFACE, AT_RECORDING, MIGRATED, EFFECTIVE_DATE }
