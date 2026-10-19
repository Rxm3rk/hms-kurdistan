package hms.kernel.time

import java.time.DateTimeException
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneOffset

/**
 * Strict RFC 3339 `date-time` parsing for [ClinicalTime.parse] (platform-kernel.md §6.1). Never lenient:
 * `java.time` parsers accept forms RFC 3339 does not, so the grammar is checked here first.
 *
 * - The date and time separator is `T` or `t` (RFC 3339 §5.6 is case-insensitive); fractional seconds may
 *   have any number of digits and are truncated to microseconds.
 * - No offset, and the RFC 3339 §4.3 "unknown local offset" `-00:00`, are [ClinicalTimeParseError.OFFSET_MISSING].
 * - An offset with a seconds part (`+03:00:30`, not RFC 3339) is [ClinicalTimeParseError.OFFSET_HAS_SECONDS].
 * - A leap second (`:60`) and an offset beyond ±18:00, both RFC 3339 syntax that `java.time` cannot hold,
 *   are [ClinicalTimeParseError.OUT_OF_RANGE]. Any other impossible field (month 13, 30 February, hour 24)
 *   is [ClinicalTimeParseError.MALFORMED].
 */
internal object ClinicalTimeParser {
    private val DATE_TIME =
        Regex("([0-9]{4})-([0-9]{2})-([0-9]{2})[Tt]([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\\.([0-9]+))?(.*)")
    private val OFFSET = Regex("([+-])([0-9]{2}):([0-9]{2})")
    private val OFFSET_WITH_SECONDS = Regex("[+-][0-9]{2}:[0-9]{2}:[0-9]{2}")

    private const val LEAP_SECOND = 60
    private const val MAX_RFC_HOUR = 23
    private const val MAX_MINUTE = 59
    private const val MAX_OFFSET_HOURS = 18
    private const val NANO_DIGITS = 9
    private const val SECONDS_PER_HOUR = 3600
    private const val SECONDS_PER_MINUTE = 60

    fun parse(text: String): ClinicalTimeParseResult {
        val match = DATE_TIME.matchEntire(text) ?: return invalid(ClinicalTimeParseError.MALFORMED)
        val groups = match.groupValues
        val offset = parseOffset(groups[OFFSET_GROUP])
        val local = parseLocal(groups)
        return when {
            local is Field.Refused -> invalid(local.error)
            offset is Field.Refused -> invalid(offset.error)
            else -> {
                val dateTime = (local as Field.Ok).value
                val zoneOffset = (offset as Field.Ok).value
                ClinicalTimeParseResult.Valid(ClinicalTime.of(dateTime.toInstant(zoneOffset), zoneOffset))
            }
        }
    }

    private fun parseLocal(groups: List<String>): Field<LocalDateTime> {
        val numbers = groups.subList(1, OFFSET_GROUP - 1).map { it.toInt() }
        val (year, month, day, hour, minute, second) = numbers
        val fraction = groups[FRACTION_GROUP].take(NANO_DIGITS).padEnd(NANO_DIGITS, '0')
        val nanos = if (groups[FRACTION_GROUP].isEmpty()) 0 else fraction.toInt()
        return when (second) {
            LEAP_SECOND -> Field.Refused(ClinicalTimeParseError.OUT_OF_RANGE)
            else ->
                try {
                    Field.Ok(LocalDateTime.of(LocalDate.of(year, month, day), LocalTime.of(hour, minute, second, nanos)))
                } catch (_: DateTimeException) {
                    Field.Refused(ClinicalTimeParseError.MALFORMED)
                }
        }
    }

    private fun parseOffset(text: String): Field<ZoneOffset> {
        val match = OFFSET.matchEntire(text)
        return when {
            text == "Z" || text == "z" -> Field.Ok(ZoneOffset.UTC)
            text.isEmpty() || text == "-00:00" -> Field.Refused(ClinicalTimeParseError.OFFSET_MISSING)
            OFFSET_WITH_SECONDS.matches(text) -> Field.Refused(ClinicalTimeParseError.OFFSET_HAS_SECONDS)
            match == null -> Field.Refused(ClinicalTimeParseError.MALFORMED)
            else -> offsetOf(match.groupValues[1], match.groupValues[2].toInt(), match.groupValues[3].toInt())
        }
    }

    private fun offsetOf(
        sign: String,
        hours: Int,
        minutes: Int,
    ): Field<ZoneOffset> {
        val total = (hours * SECONDS_PER_HOUR + minutes * SECONDS_PER_MINUTE) * (if (sign == "-") -1 else 1)
        return when {
            hours > MAX_RFC_HOUR || minutes > MAX_MINUTE -> Field.Refused(ClinicalTimeParseError.MALFORMED)
            hours > MAX_OFFSET_HOURS || (hours == MAX_OFFSET_HOURS && minutes > 0) -> Field.Refused(ClinicalTimeParseError.OUT_OF_RANGE)
            else -> Field.Ok(ZoneOffset.ofTotalSeconds(total))
        }
    }

    private fun invalid(error: ClinicalTimeParseError): ClinicalTimeParseResult = ClinicalTimeParseResult.Invalid(error)

    private operator fun <T> List<T>.component6(): T = this[5]

    private const val FRACTION_GROUP = 7
    private const val OFFSET_GROUP = 8

    private sealed interface Field<out T> {
        data class Ok<T>(
            val value: T,
        ) : Field<T>

        data class Refused(
            val error: ClinicalTimeParseError,
        ) : Field<Nothing>
    }
}
