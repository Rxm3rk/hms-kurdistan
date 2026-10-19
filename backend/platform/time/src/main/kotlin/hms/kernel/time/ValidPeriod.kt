package hms.kernel.time

import java.time.Instant

/**
 * Validity of a fact or a setting as instants: half-open `[start, endExclusive)`, `endExclusive` null means
 * open-ended, never empty, both bounds truncated to microseconds. Maps to `tstzrange '[)'`
 * (platform-kernel.md §6.1, §14; BUILD-PROMPT §6.4).
 */
class ValidPeriod private constructor(
    val start: Instant,
    val endExclusive: Instant?,
) {
    init {
        require(start.isMicros() && (endExclusive == null || endExclusive.isMicros())) {
            "ValidPeriod bounds must be truncated to microseconds: [$start, $endExclusive)"
        }
        require(endExclusive == null || endExclusive.isAfter(start)) { "ValidPeriod must not be empty or reversed: [$start, $endExclusive)" }
    }

    val isOpenEnded: Boolean get() = endExclusive == null

    /** True when `start <= instant < endExclusive`. */
    fun contains(instant: Instant): Boolean = !instant.isBefore(start) && (endExclusive == null || instant.isBefore(endExclusive))

    /** True when the two periods share at least one instant; adjacent periods do not overlap. */
    fun overlaps(other: ValidPeriod): Boolean = startsBeforeEndOf(other) && other.startsBeforeEndOf(this)

    private fun startsBeforeEndOf(other: ValidPeriod): Boolean = other.endExclusive == null || start.isBefore(other.endExclusive)

    override fun equals(other: Any?): Boolean = other is ValidPeriod && start == other.start && endExclusive == other.endExclusive

    override fun hashCode(): Int = 31 * start.hashCode() + (endExclusive?.hashCode() ?: 0)

    override fun toString(): String = "[$start, ${endExclusive ?: "∞"})"

    companion object {
        @JvmStatic
        fun from(start: Instant): ValidPeriod = ValidPeriod(start.toMicros(), null)

        /** Both bounds are truncated to microseconds first; then emptiness is checked. */
        @JvmStatic
        fun of(
            start: Instant,
            endExclusive: Instant,
        ): ValidPeriodResult {
            val from = start.toMicros()
            val to = endExclusive.toMicros()
            return if (to.isAfter(from)) ValidPeriodResult.Valid(ValidPeriod(from, to)) else ValidPeriodResult.EmptyOrReversed
        }
    }
}

sealed interface ValidPeriodResult {
    data class Valid(
        val period: ValidPeriod,
    ) : ValidPeriodResult

    /** endExclusive is not after start. */
    data object EmptyOrReversed : ValidPeriodResult
}
