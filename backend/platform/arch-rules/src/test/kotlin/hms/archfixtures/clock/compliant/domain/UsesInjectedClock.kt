package hms.archfixtures.clock.compliant.domain

import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZonedDateTime

/** Compliant fixture for rule (d): domain code reads time only from an injected Clock (§6.2). */
class UsesInjectedClock(
    private val clock: Clock,
) {
    fun instant(): Instant = Instant.now(clock)

    fun date(): LocalDate = LocalDate.now(clock)

    fun dateTime(): LocalDateTime = LocalDateTime.now(clock)

    fun zoned(): ZonedDateTime = ZonedDateTime.now(clock)

    fun offset(): OffsetDateTime = OffsetDateTime.now(clock)

    fun millis(): Long = clock.millis()
}
