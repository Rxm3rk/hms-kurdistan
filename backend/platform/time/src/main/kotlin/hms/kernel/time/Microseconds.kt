package hms.kernel.time

import java.time.Instant
import java.time.temporal.ChronoUnit

/** Kernel instants keep microseconds, as PostgreSQL `timestamptz` does (platform-kernel.md §3). */
internal fun Instant.toMicros(): Instant = truncatedTo(ChronoUnit.MICROS)

/** True when the instant has no digits below the microsecond. */
internal fun Instant.isMicros(): Boolean = nano % NANOS_PER_MICRO == 0

private const val NANOS_PER_MICRO = 1000
