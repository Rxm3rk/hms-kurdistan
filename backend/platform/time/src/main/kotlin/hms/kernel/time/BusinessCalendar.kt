package hms.kernel.time

import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.Year
import java.time.ZoneId
import java.time.temporal.ChronoUnit
import java.util.Collections
import java.util.EnumSet
import java.util.NavigableSet
import java.util.TreeSet

/**
 * A tenant's business calendar: weekend days and whole-day holidays in [zone], with the years whose holiday
 * list configuration confirms as complete (platform-kernel.md §6.4; §7 item 1; L-20). No day or date is written
 * in code; the values come from tenancy's configuration.
 *
 * Coverage: a day in a year outside [confirmedYears] is treated as a business day unless it is a weekend day,
 * so a deadline comes earlier, never later, and every answer lists the unconfirmed years it touched. A holiday
 * dated in an unconfirmed year is refused by [of]. Which days an answer touches: [isBusinessDay] its date;
 * [plusBusinessDays] the days after `date` up to the result (none for 0 days); [businessDaysBetween] the range.
 */
class BusinessCalendar private constructor(
    val zone: ZoneId,
    val weekend: Set<DayOfWeek>,
    val holidays: Set<LocalDate>,
    val confirmedYears: Set<Year>,
) {
    private val sortedHolidays: NavigableSet<LocalDate> = TreeSet(holidays)
    private val workingDaysPerWeek: Int = DAYS_PER_WEEK - weekend.size

    init {
        require(weekend.size < DAYS_PER_WEEK) { "A business calendar needs at least one business day in the week" }
        require(holidays.all { Year.of(it.year) in confirmedYears }) { "Every holiday must lie in a confirmed year" }
    }

    fun isBusinessDay(date: LocalDate): CalendarAnswer<Boolean> = CalendarAnswer(isBusiness(date), uncovered(date, date))

    /** days >= 0; negative throws. 0 returns date. n >= 1: the n-th business day strictly after date, whether or not date is one. */
    fun plusBusinessDays(
        date: LocalDate,
        days: Int,
    ): CalendarAnswer<LocalDate> {
        require(days >= 0) { "days must not be negative, got $days" }
        if (days == 0) return CalendarAnswer(date, emptySet())
        var cursor = date.plusDays(1)
        var remaining = days.toLong()
        // Jump whole weeks while that leaves at least one business day to find: a week holds at most
        // workingDaysPerWeek business days, so the jump never passes the answer.
        var weeks = (remaining - 1) / workingDaysPerWeek
        while (weeks > 0) {
            val next = cursor.plusWeeks(weeks)
            remaining -= count(cursor, next)
            cursor = next
            weeks = (remaining - 1) / workingDaysPerWeek
        }
        while (true) {
            if (isBusiness(cursor)) {
                remaining--
                if (remaining == 0L) return CalendarAnswer(cursor, uncovered(date.plusDays(1), cursor))
            }
            cursor = cursor.plusDays(1)
        }
    }

    /**
     * The same local time in [zone] on `plusBusinessDays(start's local date, days)`. In a DST gap the result is
     * the transition instant (the first instant after the gap); in a DST overlap, the earlier offset. days = 0
     * returns [start] unchanged. days >= 0; negative throws.
     */
    fun plusBusinessDaysAtLocalTime(
        start: Instant,
        days: Int,
    ): CalendarAnswer<Instant> {
        require(days >= 0) { "days must not be negative, got $days" }
        if (days == 0) return CalendarAnswer(start, emptySet())
        val local = LocalDateTime.ofInstant(start, zone)
        val date = plusBusinessDays(local.toLocalDate(), days)
        val target = LocalDateTime.of(date.value, local.toLocalTime())
        val offsets = zone.rules.getValidOffsets(target)
        val instant =
            when {
                offsets.isEmpty() -> zone.rules.getTransition(target).instant
                else -> offsets.minOf { target.toInstant(it) }
            }
        return CalendarAnswer(instant, date.uncoveredYears)
    }

    /** Business days in [startInclusive, endExclusive); a reversed range throws. */
    fun businessDaysBetween(
        startInclusive: LocalDate,
        endExclusive: LocalDate,
    ): CalendarAnswer<Int> {
        require(!endExclusive.isBefore(startInclusive)) { "Reversed range: [$startInclusive, $endExclusive)" }
        val years = if (endExclusive == startInclusive) emptySet() else uncovered(startInclusive, endExclusive.minusDays(1))
        return CalendarAnswer(Math.toIntExact(count(startInclusive, endExclusive)), years)
    }

    override fun toString(): String =
        "BusinessCalendar(zone=$zone, weekend=$weekend, holidays=$sortedHolidays, confirmedYears=$confirmedYears)"

    private fun isBusiness(date: LocalDate): Boolean = date.dayOfWeek !in weekend && date !in sortedHolidays

    /** Business days in [from, toExclusive), in constant time per whole week plus one step per holiday. */
    private fun count(
        from: LocalDate,
        toExclusive: LocalDate,
    ): Long {
        val days = ChronoUnit.DAYS.between(from, toExclusive)
        val weeks = days / DAYS_PER_WEEK
        val tail = (0 until days % DAYS_PER_WEEK).count { from.plusDays(weeks * DAYS_PER_WEEK + it).dayOfWeek in weekend }
        val weekendDays = weeks * weekend.size + tail
        val weekdayHolidays = sortedHolidays.subSet(from, true, toExclusive, false).count { it.dayOfWeek !in weekend }
        return days - weekendDays - weekdayHolidays
    }

    private fun uncovered(
        fromInclusive: LocalDate,
        toInclusive: LocalDate,
    ): Set<Year> =
        (fromInclusive.year..toInclusive.year)
            .map { Year.of(it) }
            .filterNot { it in confirmedYears }
            .toCollection(TreeSet())

    companion object {
        private const val DAYS_PER_WEEK = 7

        /** Builds a calendar, refusing a week with no business day and a holiday dated in an unconfirmed year. */
        @JvmStatic
        fun of(
            zone: ZoneId,
            weekend: Set<DayOfWeek>,
            holidays: Set<LocalDate>,
            confirmedYears: Set<Year>,
        ): BusinessCalendarResult {
            val years = Collections.unmodifiableSet(TreeSet(confirmedYears))
            val weekendDays = if (weekend.isEmpty()) EnumSet.noneOf(DayOfWeek::class.java) else EnumSet.copyOf(weekend)
            val outside = holidays.filterNot { Year.of(it.year) in years }.toCollection(TreeSet())
            return when {
                weekend.size == DAYS_PER_WEEK -> BusinessCalendarResult.NoBusinessDayInWeek
                outside.isNotEmpty() -> BusinessCalendarResult.HolidayOutsideConfirmedYears(Collections.unmodifiableSet(outside))
                else ->
                    BusinessCalendarResult.Valid(
                        BusinessCalendar(
                            zone,
                            Collections.unmodifiableSet(weekendDays),
                            Collections.unmodifiableSet(TreeSet(holidays)),
                            years,
                        ),
                    )
            }
        }
    }
}

/** A calendar answer with the unconfirmed years it touched (platform-kernel.md §6.4, "Coverage"). */
data class CalendarAnswer<T>(
    val value: T,
    val uncoveredYears: Set<Year>,
) {
    val isComplete: Boolean get() = uncoveredYears.isEmpty()
}

/** The result of [BusinessCalendar.of] (platform-kernel.md §6.4). */
sealed interface BusinessCalendarResult {
    data class Valid(
        val calendar: BusinessCalendar,
    ) : BusinessCalendarResult

    data object NoBusinessDayInWeek : BusinessCalendarResult

    /** A holiday whose year is not in confirmedYears. */
    data class HolidayOutsideConfirmedYears(
        val dates: Set<LocalDate>,
    ) : BusinessCalendarResult
}
