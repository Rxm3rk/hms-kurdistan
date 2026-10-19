// Generator weights and ranges are test data, not domain values.
@file:Suppress("MagicNumber")

package hms.kernel.time

import hms.kernel.testing.PropertyTestBudget
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.comparables.shouldBeGreaterThan
import io.kotest.matchers.comparables.shouldBeGreaterThanOrEqualTo
import io.kotest.matchers.shouldBe
import io.kotest.property.Arb
import io.kotest.property.arbitrary.arbitrary
import io.kotest.property.arbitrary.element
import io.kotest.property.arbitrary.int
import io.kotest.property.arbitrary.long
import io.kotest.property.checkAll
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.Year
import java.time.ZoneId

private const val FIRST_YEAR = 2023
private const val LAST_YEAR = 2031

/** Synthetic calendars over FIRST_YEAR..LAST_YEAR in [zone]: random weekend, confirmed years and holidays inside them. */
private fun calendars(zone: ZoneId) =
    arbitrary {
        val weekend = DayOfWeek.entries.filter { Arb.int(0..6).bind() < 2 }.toSet().let { if (it.size == 7) it - DayOfWeek.MONDAY else it }
        val confirmed = (FIRST_YEAR..LAST_YEAR).filter { Arb.int(0..2).bind() > 0 }.map { Year.of(it) }.toSet()
        val holidays =
            if (confirmed.isEmpty()) {
                emptySet()
            } else {
                List(Arb.int(0..60).bind()) {
                    val year = Arb.element(confirmed.toList()).bind()
                    year.atDay(Arb.int(1..year.length()).bind())
                }.toSet()
            }
        (BusinessCalendar.of(zone, weekend, holidays, confirmed) as BusinessCalendarResult.Valid).calendar
    }

private val dates = arbitrary { LocalDate.of(FIRST_YEAR, 1, 1).plusDays(Arb.long(0L..(LAST_YEAR - FIRST_YEAR) * 365L).bind()) }

/** The calendar's rule written out day by day, independently of its week arithmetic. */
private fun BusinessCalendar.naiveIsBusiness(date: LocalDate) = date.dayOfWeek !in weekend && date !in holidays

private fun BusinessCalendar.naivePlus(
    date: LocalDate,
    days: Int,
): LocalDate {
    var cursor = date
    var remaining = days
    while (remaining > 0) {
        cursor = cursor.plusDays(1)
        if (naiveIsBusiness(cursor)) remaining--
    }
    return cursor
}

private fun BusinessCalendar.naiveUncovered(
    fromInclusive: LocalDate,
    toInclusive: LocalDate,
): Set<Year> = (fromInclusive.year..toInclusive.year).map { Year.of(it) }.filterNot { it in confirmedYears }.toSet()

/** Business-calendar arithmetic (platform-kernel.md §6.4, §17). */
class BusinessCalendarPropertyTest :
    FunSpec({
        val budget = PropertyTestBudget.sequences()
        val zone = ZoneId.of("Asia/Baghdad")

        test("business-calendar-monotonic: strictly increasing in days, non-decreasing in the date, a business day, agrees with between") {
            checkAll(budget, calendars(zone), dates, Arb.int(1..400)) { calendar, date, days ->
                val answer = calendar.plusBusinessDays(date, days)
                val result = answer.value
                withClue("$calendar $date $days") {
                    result shouldBe calendar.naivePlus(date, days)
                    answer.uncoveredYears shouldBe calendar.naiveUncovered(date.plusDays(1), result)
                    calendar.isBusinessDay(result).value shouldBe true
                    calendar.plusBusinessDays(date, days + 1).value shouldBeGreaterThan result
                    calendar.plusBusinessDays(date.plusDays(1), days).value shouldBeGreaterThanOrEqualTo result
                    calendar.businessDaysBetween(date.plusDays(1), result.plusDays(1)).value shouldBe days
                    calendar.businessDaysBetween(date.plusDays(1), result).value shouldBe days - 1
                    calendar.plusBusinessDays(date, 0) shouldBe CalendarAnswer(date, emptySet())
                }
            }
        }

        test("business-calendar-monotonic: businessDaysBetween counts business days day by day; negative days and reversed ranges throw") {
            checkAll(budget, calendars(zone), dates, Arb.int(0..800), Arb.int(Int.MIN_VALUE..-1)) { calendar, start, length, negative ->
                val end = start.plusDays(length.toLong())
                val answer = calendar.businessDaysBetween(start, end)
                answer.value shouldBe (0 until length).count { calendar.naiveIsBusiness(start.plusDays(it.toLong())) }
                answer.uncoveredYears shouldBe if (length == 0) emptySet() else calendar.naiveUncovered(start, end.minusDays(1))
                calendar.isBusinessDay(start) shouldBe CalendarAnswer(calendar.naiveIsBusiness(start), calendar.naiveUncovered(start, start))
                shouldThrow<IllegalArgumentException> { calendar.plusBusinessDays(start, negative) }
                shouldThrow<IllegalArgumentException> { calendar.plusBusinessDaysAtLocalTime(start.atStartOfDay(zone).toInstant(), negative) }
                if (length > 0) shouldThrow<IllegalArgumentException> { calendar.businessDaysBetween(end, start) }
            }
        }

        // Fixture zone with DST transitions in the JDK data; not a claim about any Kurdistan rule.
        val fixtureZone = ZoneId.of("Europe/Berlin")

        test("business-days-at-local-time: the start's local time on the n-th business day; DST gap and overlap take the earlier instant") {
            val starts = arbitrary { Instant.ofEpochSecond(Arb.long(1_672_531_200L..1_924_992_000L).bind(), Arb.long(0L..999_999_999L).bind()) }
            checkAll(budget, calendars(fixtureZone), starts, Arb.int(0..60)) { calendar, start, days ->
                val answer = calendar.plusBusinessDaysAtLocalTime(start, days)
                val local = LocalDateTime.ofInstant(start, fixtureZone)
                if (days == 0) {
                    answer shouldBe CalendarAnswer(start, emptySet())
                } else {
                    val date = calendar.plusBusinessDays(local.toLocalDate(), days)
                    answer.uncoveredYears shouldBe date.uncoveredYears
                    val target = LocalDateTime.of(date.value, local.toLocalTime())
                    val offsets = fixtureZone.rules.getValidOffsets(target)
                    when (offsets.size) {
                        1 -> LocalDateTime.ofInstant(answer.value, fixtureZone) shouldBe target
                        0 -> answer.value shouldBe fixtureZone.rules.getTransition(target).instant
                        else -> answer.value shouldBe offsets.minOf { target.toInstant(it) }
                    }
                }
            }
        }

        test("business-days-at-local-time: a target in a DST gap or overlap of the fixture zone takes the earlier instant") {
            val allDays =
                (BusinessCalendar.of(fixtureZone, emptySet(), emptySet(), (FIRST_YEAR..LAST_YEAR).map { Year.of(it) }.toSet())
                    as BusinessCalendarResult.Valid).calendar
            // The JDK lists recent transitions through its rules, not in ZoneRules.transitions: walk them.
            val transitions =
                generateSequence(fixtureZone.rules.nextTransition(Year.of(FIRST_YEAR + 1).atDay(1).atStartOfDay(fixtureZone).toInstant())) {
                    fixtureZone.rules.nextTransition(it.instant)
                }.takeWhile { it.dateTimeBefore.year <= LAST_YEAR }.toList()
            transitions.count { it.isGap } shouldBe LAST_YEAR - FIRST_YEAR
            transitions.count { it.isOverlap } shouldBe LAST_YEAR - FIRST_YEAR
            val cases =
                arbitrary {
                    val transition = Arb.element(transitions).bind()
                    // Gap: local times [before, after); overlap: [after, before). Either way from the earlier one.
                    val windowStart = minOf(transition.dateTimeBefore, transition.dateTimeAfter)
                    val windowMicros = transition.duration.abs().toNanos() / 1_000
                    val target = windowStart.plusNanos(Arb.long(0L until windowMicros).bind() * 1_000)
                    Triple(transition, Arb.int(1..10).bind(), target)
                }
            checkAll(budget, cases) { (transition, days, target) ->
                val startLocal = target.minusDays(days.toLong())
                val start = startLocal.atZone(fixtureZone).toInstant()
                LocalDateTime.ofInstant(start, fixtureZone) shouldBe startLocal
                fixtureZone.rules.getValidOffsets(target).size shouldBe if (transition.isGap) 0 else 2
                // In an overlap the offset before the transition is the earlier instant.
                val expected = if (transition.isGap) transition.instant else target.toInstant(transition.offsetBefore)
                allDays.plusBusinessDaysAtLocalTime(start, days) shouldBe CalendarAnswer(expected, emptySet())
                if (!transition.isGap) expected.isBefore(target.toInstant(transition.offsetAfter)) shouldBe true
            }
        }
    })
