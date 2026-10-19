package hms.kernel.time

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.Year
import java.time.ZoneId

/**
 * BusinessCalendar on synthetic data (platform-kernel.md §6.4; L-20). The weekend and holiday dates here are
 * test values, not the Kurdistan calendar, which is configuration.
 */
class BusinessCalendarTest :
    FunSpec({
        val zone = ZoneId.of("Asia/Baghdad")
        val weekend = setOf(DayOfWeek.FRIDAY, DayOfWeek.SATURDAY)
        val y2026 = Year.of(2026)
        val y2027 = Year.of(2027)
        val syntheticMarch21 = LocalDate.of(2026, 3, 21)
        val syntheticTuesday = LocalDate.of(2026, 10, 20)

        fun calendar(
            holidays: Set<LocalDate> = setOf(syntheticMarch21, syntheticTuesday),
            confirmed: Set<Year> = setOf(y2026),
            weekendDays: Set<DayOfWeek> = weekend,
            calendarZone: ZoneId = zone,
        ): BusinessCalendar = (BusinessCalendar.of(calendarZone, weekendDays, holidays, confirmed) as BusinessCalendarResult.Valid).calendar

        test("business days: weekend days and holidays are not business days") {
            val cal = calendar()
            cal.isBusinessDay(LocalDate.of(2026, 10, 19)) shouldBe CalendarAnswer(true, emptySet())
            cal.isBusinessDay(LocalDate.of(2026, 10, 23)) shouldBe CalendarAnswer(false, emptySet())
            cal.isBusinessDay(LocalDate.of(2026, 10, 24)) shouldBe CalendarAnswer(false, emptySet())
            cal.isBusinessDay(syntheticTuesday) shouldBe CalendarAnswer(false, emptySet())
        }

        test("plusBusinessDays: n-th business day strictly after the date; 0 returns the date") {
            val cal = calendar()
            cal.plusBusinessDays(LocalDate.of(2026, 10, 19), 0) shouldBe CalendarAnswer(LocalDate.of(2026, 10, 19), emptySet())
            cal.plusBusinessDays(LocalDate.of(2026, 10, 23), 0).value shouldBe LocalDate.of(2026, 10, 23)
            cal.plusBusinessDays(LocalDate.of(2026, 10, 19), 1).value shouldBe LocalDate.of(2026, 10, 21)
            cal.plusBusinessDays(LocalDate.of(2026, 10, 22), 2).value shouldBe LocalDate.of(2026, 10, 26)
            cal.plusBusinessDays(LocalDate.of(2026, 10, 23), 1).value shouldBe LocalDate.of(2026, 10, 25)
            cal.plusBusinessDays(LocalDate.of(2026, 10, 18), 10).value shouldBe LocalDate.of(2026, 11, 2)
            shouldThrow<IllegalArgumentException> { cal.plusBusinessDays(LocalDate.of(2026, 10, 19), -1) }
            shouldThrow<IllegalArgumentException> { cal.plusBusinessDaysAtLocalTime(Instant.parse("2026-10-19T05:00:00Z"), -1) }
        }

        test("businessDaysBetween counts [start, end); an empty range is 0; a reversed range throws") {
            val cal = calendar()
            cal.businessDaysBetween(LocalDate.of(2026, 10, 18), LocalDate.of(2026, 10, 25)) shouldBe CalendarAnswer(4, emptySet())
            cal.businessDaysBetween(LocalDate.of(2026, 10, 19), LocalDate.of(2026, 10, 19)) shouldBe CalendarAnswer(0, emptySet())
            cal.businessDaysBetween(LocalDate.of(2026, 1, 1), LocalDate.of(2027, 1, 1)).value shouldBe 261 - 1 // the synthetic 21 March 2026 is a Saturday
            shouldThrow<IllegalArgumentException> { cal.businessDaysBetween(LocalDate.of(2026, 10, 20), LocalDate.of(2026, 10, 19)) }
        }

        test("business-calendar-uncovered-years-reported: answers that touch an unconfirmed year list it") {
            val cal = calendar()
            cal.isBusinessDay(LocalDate.of(2027, 3, 21)) shouldBe CalendarAnswer(true, setOf(y2027))
            cal.plusBusinessDays(LocalDate.of(2026, 12, 30), 3) shouldBe CalendarAnswer(LocalDate.of(2027, 1, 4), setOf(y2027))
            cal.plusBusinessDays(LocalDate.of(2026, 12, 30), 1) shouldBe CalendarAnswer(LocalDate.of(2026, 12, 31), emptySet())
            cal.businessDaysBetween(LocalDate.of(2025, 12, 28), LocalDate.of(2026, 1, 4)) shouldBe CalendarAnswer(5, setOf(Year.of(2025)))
            cal.businessDaysBetween(LocalDate.of(2025, 6, 1), LocalDate.of(2028, 1, 1)).uncoveredYears shouldBe
                setOf(Year.of(2025), y2027)
            cal.plusBusinessDaysAtLocalTime(Instant.parse("2026-12-31T05:00:00Z"), 1) shouldBe
                CalendarAnswer(Instant.parse("2027-01-03T05:00:00Z"), setOf(y2027))
            cal.plusBusinessDays(LocalDate.of(2027, 6, 1), 0).isComplete shouldBe true
        }

        test("business-calendar-uncovered-years-reported: a recurring synthetic 21 March entry never confirms a year") {
            val recurring = setOf(syntheticMarch21, LocalDate.of(2027, 3, 21), LocalDate.of(2028, 3, 21))
            BusinessCalendar.of(zone, weekend, recurring, setOf(y2026)) shouldBe
                BusinessCalendarResult.HolidayOutsideConfirmedYears(setOf(LocalDate.of(2027, 3, 21), LocalDate.of(2028, 3, 21)))
            // Without its holiday list, a year with only that holiday stays unconfirmed: answers list it and count the day.
            val cal = calendar(setOf(syntheticMarch21))
            cal.isBusinessDay(LocalDate.of(2027, 3, 21)) shouldBe CalendarAnswer(true, setOf(y2027))
        }

        test("business-calendar-uncovered-years-reported: unknown days count as business days, so a deadline comes earlier") {
            val confirmed = calendar(setOf(LocalDate.of(2027, 1, 3)), setOf(y2026, y2027))
            val unconfirmed = calendar(emptySet(), setOf(y2026))
            confirmed.plusBusinessDays(LocalDate.of(2026, 12, 31), 1) shouldBe CalendarAnswer(LocalDate.of(2027, 1, 4), emptySet())
            unconfirmed.plusBusinessDays(LocalDate.of(2026, 12, 31), 1) shouldBe CalendarAnswer(LocalDate.of(2027, 1, 3), setOf(y2027))
        }

        test("of: a week without a business day is refused; an empty weekend and a covered year without holidays are valid") {
            BusinessCalendar.of(zone, DayOfWeek.entries.toSet(), emptySet(), setOf(y2026)) shouldBe BusinessCalendarResult.NoBusinessDayInWeek
            val cal = calendar(emptySet(), setOf(y2026), emptySet())
            cal.plusBusinessDays(LocalDate.of(2026, 10, 23), 1).value shouldBe LocalDate.of(2026, 10, 24)
            cal.weekend shouldBe emptySet()
            cal.zone shouldBe zone
        }

        test("plusBusinessDaysAtLocalTime: the same local time; DST gap gives the transition instant, overlap the earlier offset") {
            val fixtureZone = ZoneId.of("Europe/Berlin")
            val cal = calendar(emptySet(), setOf(y2026), emptySet(), fixtureZone)
            val friday = Instant.parse("2026-03-27T01:30:00Z") // 02:30 local, +01:00
            cal.plusBusinessDaysAtLocalTime(friday, 2) shouldBe CalendarAnswer(Instant.parse("2026-03-29T01:00:00Z"), emptySet())
            cal.plusBusinessDaysAtLocalTime(friday, 3) shouldBe CalendarAnswer(Instant.parse("2026-03-30T00:30:00Z"), emptySet())
            val autumn = Instant.parse("2026-10-23T00:30:00Z") // 02:30 local, +02:00
            cal.plusBusinessDaysAtLocalTime(autumn, 2) shouldBe CalendarAnswer(Instant.parse("2026-10-25T00:30:00Z"), emptySet())
            val laterInOverlap = Instant.parse("2026-10-25T01:30:00Z")
            cal.plusBusinessDaysAtLocalTime(laterInOverlap, 0) shouldBe CalendarAnswer(laterInOverlap, emptySet())
        }
    })
