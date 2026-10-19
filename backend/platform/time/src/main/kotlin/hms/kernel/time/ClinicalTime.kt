package hms.kernel.time

import java.time.Instant
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

/**
 * Clinical (valid) time: an instant supplied by the user, the device or the interface message, with the
 * UTC offset it came with, truncated to microseconds (platform-kernel.md §6.1; SI-10; §5.3). An offset
 * with non-zero seconds is refused. No kernel function makes one from a [RecordedTime] (CTRL-0010-3).
 */
class ClinicalTime private constructor(
    val instant: Instant,
    val offset: ZoneOffset,
) : Comparable<ClinicalTime> {
    init {
        require(instant.isMicros()) { "ClinicalTime must be truncated to microseconds, got $instant" }
        require(offset.totalSeconds % SECONDS_PER_MINUTE == 0) { "ClinicalTime offset must be whole minutes, got $offset" }
    }

    fun toOffsetDateTime(): OffsetDateTime = OffsetDateTime.ofInstant(instant, offset)

    fun atZone(zone: ZoneId): ZonedDateTime = instant.atZone(zone)

    fun isSameInstantAs(other: ClinicalTime): Boolean = instant == other.instant

    /** By instant, then by offset, so that it agrees with equals. */
    override fun compareTo(other: ClinicalTime): Int =
        compareValuesBy(this, other, { it.instant }, { it.offset.totalSeconds })

    override fun equals(other: Any?): Boolean = other is ClinicalTime && instant == other.instant && offset == other.offset

    override fun hashCode(): Int = 31 * instant.hashCode() + offset.hashCode()

    /** RFC 3339 text with the original offset, seconds always present; [parse] reads it back. */
    override fun toString(): String = DateTimeFormatter.ISO_OFFSET_DATE_TIME.format(toOffsetDateTime())

    companion object {
        /** Input from a user, device or message: RFC 3339 date-time with an explicit offset ("Z" is +00:00). */
        @JvmStatic
        fun parse(text: String): ClinicalTimeParseResult = ClinicalTimeParser.parse(text)

        /** Throws IllegalArgumentException for an offset with non-zero seconds (a programming error once input went through parse). */
        @JvmStatic
        fun of(dateTime: OffsetDateTime): ClinicalTime = of(dateTime.toInstant(), dateTime.offset)

        /** Throws IllegalArgumentException for an offset with non-zero seconds. */
        @JvmStatic
        fun of(
            instant: Instant,
            offset: ZoneOffset,
        ): ClinicalTime = ClinicalTime(instant.toMicros(), offset)

        /**
         * Resolves a wall-clock time in a zone without guessing across DST transitions (R11 §15 item 9): a time
         * in a gap is [LocalTimeResolution.InGap], a time in an overlap is [LocalTimeResolution.Ambiguous] with
         * both candidates. The local time is truncated to microseconds first. Throws IllegalArgumentException
         * where the zone's offset at that time has seconds (historic local mean time only).
         */
        @JvmStatic
        fun resolveLocal(
            local: LocalDateTime,
            zone: ZoneId,
        ): LocalTimeResolution {
            val wallClock = local.truncatedTo(ChronoUnit.MICROS)
            val candidates = zone.rules.getValidOffsets(wallClock).map { of(wallClock.toInstant(it), it) }.sorted()
            return when (candidates.size) {
                0 -> LocalTimeResolution.InGap(local, zone)
                1 -> LocalTimeResolution.Resolved(candidates.single())
                else -> LocalTimeResolution.Ambiguous(earlier = candidates.first(), later = candidates.last())
            }
        }

        private const val SECONDS_PER_MINUTE = 60
    }
}

sealed interface ClinicalTimeParseResult {
    data class Valid(
        val time: ClinicalTime,
    ) : ClinicalTimeParseResult

    data class Invalid(
        val error: ClinicalTimeParseError,
    ) : ClinicalTimeParseResult
}

/** Why [ClinicalTime.parse] refused its input (platform-kernel.md §6.1). */
enum class ClinicalTimeParseError { MALFORMED, OFFSET_MISSING, OFFSET_HAS_SECONDS, OUT_OF_RANGE }

/** The result of [ClinicalTime.resolveLocal] (platform-kernel.md §6.1, "Time zones and DST"). */
sealed interface LocalTimeResolution {
    data class Resolved(
        val time: ClinicalTime,
    ) : LocalTimeResolution

    /** DST overlap: the wall-clock time happened twice; the user chooses. */
    data class Ambiguous(
        val earlier: ClinicalTime,
        val later: ClinicalTime,
    ) : LocalTimeResolution

    /** DST gap: the wall-clock time never happened in this zone; refused. */
    data class InGap(
        val local: LocalDateTime,
        val zone: ZoneId,
    ) : LocalTimeResolution
}
