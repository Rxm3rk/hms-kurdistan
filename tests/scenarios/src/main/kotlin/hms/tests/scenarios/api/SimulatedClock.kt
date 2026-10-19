package hms.tests.scenarios.api

import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneId

/**
 * The simulated clock of a scenario world: a `java.time.Clock` whose instant only the scenario moves, so domain
 * ports given this clock see scenario time, never the host's (BUILD-PROMPT §6.2). The default zone is
 * `Asia/Baghdad`, the product default (§4.1: "Default time zone `Asia/Baghdad`, configurable per tenant").
 *
 * [advance] moves forward by an exact duration; [setInstant] may also move back, for clock-skew and back-entry
 * scenarios (§18.3, §18.5 #7). Calendar-aware advancing (the tenant calendar, the Friday–Saturday weekend,
 * Kurdistan holidays, §9.2) is not built: it is a later concern recorded with KA-064. The clock moves onto the
 * WP-0.3 kernel `Clock` and its test double when `wp/0.3-platform-kernel` is merged (KA-061).
 */
class SimulatedClock private constructor(
    private val time: Cell,
    private val zoneId: ZoneId,
) : Clock() {
    constructor(start: Instant, zone: ZoneId = DEFAULT_ZONE) : this(Cell(start), zone)

    override fun getZone(): ZoneId = zoneId

    /** A view of the same simulated time in another zone; moving either moves both. */
    override fun withZone(zone: ZoneId): SimulatedClock = SimulatedClock(time, zone)

    override fun instant(): Instant = time.instant

    /** Moves the clock forward by [duration], which must not be negative. */
    fun advance(duration: Duration) {
        require(!duration.isNegative) { "advance() moves forward only; use setInstant() to move back (clock skew)" }
        time.instant = time.instant.plus(duration)
    }

    /** Sets the clock to [instant], forward or back. */
    fun setInstant(instant: Instant) {
        time.instant = instant
    }

    override fun equals(other: Any?): Boolean = other is SimulatedClock && other.time === time && other.zoneId == zoneId

    override fun hashCode(): Int = System.identityHashCode(time) * HASH_FACTOR + zoneId.hashCode()

    override fun toString(): String = "SimulatedClock[${time.instant}, $zoneId]"

    private class Cell(
        var instant: Instant,
    )

    companion object {
        /** The default zone of a scenario world. */
        val DEFAULT_ZONE: ZoneId = ZoneId.of("Asia/Baghdad")

        /** The default start of a scenario world: a fixed synthetic instant, never the host's time. */
        val DEFAULT_START: Instant = Instant.parse("2026-01-01T06:00:00Z")

        private const val HASH_FACTOR = 31
    }
}
