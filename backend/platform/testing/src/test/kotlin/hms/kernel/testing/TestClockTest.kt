package hms.kernel.testing

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeSameInstanceAs
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset
import java.util.concurrent.Callable
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors

/** `UnitTest:test-clock-controllable` (platform-kernel spec §8, §17). Synthetic instants only. */
class TestClockTest :
    FunSpec({
        val start = Instant.parse("2026-10-19T08:30:00.123456789Z")
        val erbil = ZoneId.of("Asia/Baghdad")

        test("test-clock-controllable: time stands still until the test moves it; the default zone is UTC") {
            val clock = TestClock(start)
            clock.instant() shouldBe start
            clock.instant() shouldBe start
            clock.millis() shouldBe start.toEpochMilli()
            clock.zone shouldBe ZoneOffset.UTC
            TestClock(start, erbil).zone shouldBe erbil
        }

        test("test-clock-controllable: advanceBy moves time forward by exactly the duration, nanoseconds included") {
            val clock = TestClock(start)
            clock.advanceBy(Duration.ofMinutes(5))
            clock.instant() shouldBe start.plusSeconds(300)
            clock.advanceBy(Duration.ofNanos(1))
            clock.instant() shouldBe start.plusSeconds(300).plusNanos(1)
            clock.advanceBy(Duration.ZERO)
            clock.instant() shouldBe start.plusSeconds(300).plusNanos(1)
        }

        test("test-clock-controllable: advanceBy refuses a negative duration and leaves time unchanged") {
            val clock = TestClock(start)
            shouldThrow<IllegalArgumentException> { clock.advanceBy(Duration.ofMillis(-1)) }
            shouldThrow<IllegalArgumentException> { clock.advanceBy(Duration.ofNanos(-1)) }
            clock.instant() shouldBe start
        }

        test("test-clock-controllable: setTo moves time backwards and forwards (rollback and skew, §18.3)") {
            val clock = TestClock(start)
            val earlier = start.minus(Duration.ofHours(3))
            clock.setTo(earlier)
            clock.instant() shouldBe earlier
            clock.setTo(start.plus(Duration.ofDays(2)))
            clock.instant() shouldBe start.plus(Duration.ofDays(2))
            clock.setTo(Instant.EPOCH.minusSeconds(1))
            clock.millis() shouldBe -1000L
        }

        test("test-clock-controllable: withZone views share the time and carry their own zone") {
            val clock = TestClock(start)
            val view = clock.withZone(erbil)
            view.zone shouldBe erbil
            view.instant() shouldBe start
            view.instant().atZone(view.zone).offset shouldBe ZoneOffset.ofHours(3)

            clock.advanceBy(Duration.ofSeconds(10))
            view.instant() shouldBe start.plusSeconds(10)
            clock.setTo(start.minusSeconds(60))
            view.instant() shouldBe start.minusSeconds(60)

            // A view is a TestClock too: moving it moves the original and every other view.
            (view as TestClock).advanceBy(Duration.ofSeconds(1))
            clock.instant() shouldBe start.minusSeconds(59)
            view.withZone(ZoneOffset.UTC).instant() shouldBe start.minusSeconds(59)
            clock.withZone(ZoneOffset.UTC) shouldBeSameInstanceAs clock
        }

        test("test-clock-controllable: concurrent advanceBy calls lose no time (thread safety)") {
            val threads = 8
            val stepsPerThread = 5_000
            val clock = TestClock(start)
            val ready = CountDownLatch(1)
            Executors.newFixedThreadPool(threads).use { pool ->
                val futures =
                    (1..threads).map {
                        pool.submit(
                            Callable {
                                ready.await()
                                repeat(stepsPerThread) {
                                    clock.advanceBy(Duration.ofMillis(1))
                                    clock.instant()
                                }
                            },
                        )
                    }
                ready.countDown()
                futures.forEach { it.get() }
            }
            clock.instant() shouldBe start.plusMillis(threads.toLong() * stepsPerThread)
        }

        test("test-clock-controllable: toString names the instant and the zone") {
            TestClock(start, erbil).toString() shouldBe "TestClock[2026-10-19T08:30:00.123456789Z, Asia/Baghdad]"
        }
    })
