package hms.archfixtures.clock.violating.domain

import java.time.Clock
import java.time.Instant
import java.time.InstantSource
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.MonthDay
import java.time.OffsetDateTime
import java.time.OffsetTime
import java.time.Year
import java.time.YearMonth
import java.time.ZoneOffset
import java.time.ZonedDateTime
import java.util.Calendar
import java.util.Date
import java.util.GregorianCalendar
import kotlin.time.TimeSource
import kotlin.time.Clock as KotlinClock
import kotlin.time.Instant as KotlinInstant

// Violating fixtures for rule (d): one domain class per way of reading the system clock.

// The eight calls BUILD-PROMPT §6.2 and the WP-0.1 task name.

class CallsInstantNow {
    fun read(): Instant = Instant.now()
}

class CallsLocalDateNow {
    fun read(): LocalDate = LocalDate.now()
}

class CallsLocalDateTimeNow {
    fun read(): LocalDateTime = LocalDateTime.now()
}

class CallsZonedDateTimeNow {
    fun read(): ZonedDateTime = ZonedDateTime.now()
}

class CallsOffsetDateTimeNow {
    fun read(): OffsetDateTime = OffsetDateTime.now()
}

class CallsSystemCurrentTimeMillis {
    fun read(): Long = System.currentTimeMillis()
}

class CallsClockSystemUtc {
    fun read(): Clock = Clock.systemUTC()
}

class CallsClockSystemDefaultZone {
    fun read(): Clock = Clock.systemDefaultZone()
}

// The tightening: other hidden time sources.

class CallsLocalDateNowWithZone {
    fun read(): LocalDate = LocalDate.now(ZoneOffset.UTC)
}

class CallsLocalTimeNow {
    fun read(): LocalTime = LocalTime.now()
}

class CallsOffsetTimeNow {
    fun read(): OffsetTime = OffsetTime.now()
}

class CallsYearNow {
    fun read(): Year = Year.now()
}

class CallsYearMonthNow {
    fun read(): YearMonth = YearMonth.now()
}

class CallsMonthDayNow {
    fun read(): MonthDay = MonthDay.now()
}

class CallsClockSystemWithZone {
    fun read(): Clock = Clock.system(ZoneOffset.UTC)
}

class CallsClockTickSeconds {
    fun read(): Clock = Clock.tickSeconds(ZoneOffset.UTC)
}

class CallsInstantSourceSystem {
    fun read(): InstantSource = InstantSource.system()
}

class CallsSystemNanoTime {
    fun read(): Long = System.nanoTime()
}

class ConstructsDate {
    fun read(): Date = Date()
}

class CallsCalendarGetInstance {
    fun read(): Calendar = Calendar.getInstance()
}

class ConstructsGregorianCalendar {
    fun read(): Calendar = GregorianCalendar()
}

class CallsKotlinClockSystem {
    fun read(): KotlinInstant = KotlinClock.System.now()
}

class MarksKotlinMonotonicTime {
    fun read(): TimeSource.Monotonic.ValueTimeMark = TimeSource.Monotonic.markNow()
}
