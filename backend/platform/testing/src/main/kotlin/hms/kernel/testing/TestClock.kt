package hms.kernel.testing

import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset
import java.util.concurrent.atomic.AtomicReference

/**
 * A controllable [java.time.Clock] for tests only (platform-kernel spec §8, D8). Thread-safe. Views made by
 * [withZone] share the same time: moving one moves them all.
 *
 * It never reads the system clock, so time moves only when a test calls [advanceBy] or [setTo]. Production
 * never binds it: a frozen clock would stop every SLA, escalation and orphan timer without an error
 * (`ArchTest:production-never-binds-test-adapters`). Deterministic ids in tests come from
 * `UuidV7Generator(testClock, SplittableRandom(seed))`.
 */
class TestClock private constructor(
    private val time: AtomicReference<Instant>,
    private val zone: ZoneId,
) : Clock() {
    constructor(initial: Instant, zone: ZoneId = ZoneOffset.UTC) : this(AtomicReference(initial), zone)

    override fun getZone(): ZoneId = zone

    override fun withZone(zone: ZoneId): Clock = if (zone == this.zone) this else TestClock(time, zone)

    override fun instant(): Instant = time.get()

    /** Moves time forward; a negative duration is a programming error (IllegalArgumentException). */
    fun advanceBy(duration: Duration) {
        require(!duration.isNegative) { "TestClock.advanceBy needs a duration of zero or more, got $duration; use setTo to go back" }
        time.updateAndGet { current -> current.plus(duration) }
    }

    /** Sets time, forwards or backwards, to test clock rollback and skew (BUILD-PROMPT §18.3). */
    fun setTo(instant: Instant) {
        time.set(instant)
    }

    override fun toString(): String = "TestClock[${instant()}, $zone]"
}
