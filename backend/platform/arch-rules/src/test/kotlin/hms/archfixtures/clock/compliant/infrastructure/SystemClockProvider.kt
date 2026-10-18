package hms.archfixtures.clock.compliant.infrastructure

import java.time.Clock
import java.time.Instant

/** Compliant fixture for rule (d): outside the domain, code may create the system clock it injects. */
object SystemClockProvider {
    fun clock(): Clock = Clock.systemUTC()

    fun now(): Instant = Instant.now()
}
