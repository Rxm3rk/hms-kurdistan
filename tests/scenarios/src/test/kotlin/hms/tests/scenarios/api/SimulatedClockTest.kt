package hms.tests.scenarios.api

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import java.time.Duration
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZoneOffset

/** The simulated clock of a scenario world (spec §5): settable, advanced only by the scenario, zone Asia/Baghdad. */
class SimulatedClockTest :
    FunSpec({
        val start = Instant.parse("2026-03-01T05:00:00Z")

        test("it starts at the given instant, in Asia/Baghdad by default, and does not move by itself") {
            val clock = SimulatedClock(start)
            clock.zone shouldBe ZoneId.of("Asia/Baghdad")
            clock.instant() shouldBe start
            clock.instant() shouldBe start
            clock.millis() shouldBe start.toEpochMilli()
        }

        test("the default start is a fixed synthetic instant") {
            SimulatedClock.DEFAULT_START shouldBe Instant.parse("2026-01-01T06:00:00Z")
            SimulatedClock(SimulatedClock.DEFAULT_START).instant() shouldBe SimulatedClock.DEFAULT_START
        }

        test("java.time reads the simulated time through the clock, in its zone") {
            val clock = SimulatedClock(start)
            LocalDateTime.now(clock) shouldBe LocalDateTime.of(2026, 3, 1, 8, 0)
        }

        test("advance() moves forward by the exact duration and refuses a negative one") {
            val clock = SimulatedClock(start)
            clock.advance(Duration.ofMinutes(90))
            clock.instant() shouldBe start.plusSeconds(5400)
            clock.advance(Duration.ZERO)
            clock.instant() shouldBe start.plusSeconds(5400)
            shouldThrow<IllegalArgumentException> { clock.advance(Duration.ofSeconds(-1)) }
            clock.instant() shouldBe start.plusSeconds(5400)
        }

        test("setInstant() may move forward or back (clock skew, back-entry)") {
            val clock = SimulatedClock(start)
            clock.setInstant(start.minusSeconds(3600))
            clock.instant() shouldBe start.minusSeconds(3600)
            clock.setInstant(start.plusSeconds(60))
            clock.instant() shouldBe start.plusSeconds(60)
        }

        test("withZone() is a view of the same simulated time") {
            val clock = SimulatedClock(start)
            val utc = clock.withZone(ZoneOffset.UTC)
            utc.zone shouldBe ZoneOffset.UTC
            clock.advance(Duration.ofHours(1))
            utc.instant() shouldBe start.plusSeconds(3600)
            utc.setInstant(start)
            clock.instant() shouldBe start
            utc shouldNotBe clock
            utc.withZone(SimulatedClock.DEFAULT_ZONE) shouldBe clock
        }

        test("two clocks with the same instant are independent") {
            val a = SimulatedClock(start)
            val b = SimulatedClock(start)
            a.advance(Duration.ofDays(1))
            b.instant() shouldBe start
            a shouldNotBe b
        }
    })
