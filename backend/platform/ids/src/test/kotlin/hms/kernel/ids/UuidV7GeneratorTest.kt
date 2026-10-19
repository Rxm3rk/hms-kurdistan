package hms.kernel.ids

import hms.kernel.testing.TestClock
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.ints.shouldBeLessThan
import io.kotest.matchers.longs.shouldBeGreaterThanOrEqual
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldMatch
import java.time.Duration
import java.time.Instant
import java.util.SplittableRandom
import java.util.UUID
import java.util.concurrent.Callable
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.random.RandomGenerator

/** The UUIDv7 generator (platform-kernel spec §5, §17, §18 item 3). Synthetic clocks and seeds only. */
class UuidV7GeneratorTest :
    FunSpec({
        val start = Instant.parse("2026-10-19T08:30:00.123456Z")
        val maxMillis = (1L shl 48) - 1
        val allOnes = RandomGenerator { -1L }
        val allZeros = RandomGenerator { 0L }

        fun timestampOf(id: UUID): Long = id.mostSignificantBits ushr 16

        fun counterOf(id: UUID): Int = (id.mostSignificantBits and 0xFFF).toInt()

        fun shouldBeStrictlyIncreasing(ids: List<UUID>) {
            ids.zipWithNext().forEach { (earlier, later) -> UuidV7.compare(earlier, later) shouldBeLessThan 0 }
        }

        test("uuidv7-layout-rfc9562: version 7, variant 10, the clock's milliseconds, canonical lower-case text") {
            val clock = TestClock(start)
            val id = UuidV7Generator(clock, SplittableRandom(7)).newId()

            ((id.mostSignificantBits ushr 12) and 0xF) shouldBe 7L
            id.version() shouldBe 7
            (id.leastSignificantBits ushr 62) shouldBe 2L
            id.variant() shouldBe 2
            timestampOf(id) shouldBe start.toEpochMilli()
            UuidV7.isV7(id) shouldBe true
            UuidV7.format(id) shouldMatch Regex("[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}")
        }

        test("uuidv7-layout-rfc9562: the counter is seeded with its top bit clear and rand_b holds 62 random bits") {
            val clock = TestClock(start)
            val high = UuidV7Generator(clock, allOnes).newId()
            counterOf(high) shouldBe 0x7FF
            high.leastSignificantBits shouldBe 0xBFFF_FFFF_FFFF_FFFFuL.toLong()

            val low = UuidV7Generator(clock, allZeros).newId()
            counterOf(low) shouldBe 0
            low.leastSignificantBits shouldBe Long.MIN_VALUE
        }

        test("uuidv7-monotonic-and-unique: further ids in a millisecond increment the counter; a new millisecond reseeds") {
            val clock = TestClock(start)
            val generator = UuidV7Generator(clock, allZeros)
            val sameMillisecond = List(3) { generator.newId() }
            sameMillisecond.map(::counterOf) shouldBe listOf(0, 1, 2)
            sameMillisecond.map(::timestampOf).toSet() shouldBe setOf(start.toEpochMilli())

            // 08:30:00.123456 plus 0.5 ms is still in millisecond .123.
            clock.advanceBy(Duration.ofNanos(500_000))
            counterOf(generator.newId()) shouldBe 3

            clock.advanceBy(Duration.ofMillis(1))
            val next = generator.newId()
            timestampOf(next) shouldBe start.toEpochMilli() + 1
            counterOf(next) shouldBe 0
            shouldBeStrictlyIncreasing(sameMillisecond + next)
        }

        test("uuidv7-monotonic-and-unique: counter rollover moves the logical timestamp one millisecond ahead, without sleeping") {
            val clock = TestClock(start)
            val generator = UuidV7Generator(clock, allOnes)
            val ids = List(0x801) { generator.newId() }

            timestampOf(ids[0]) shouldBe start.toEpochMilli()
            counterOf(ids[0]) shouldBe 0x7FF
            timestampOf(ids[0x800]) shouldBe start.toEpochMilli()
            counterOf(ids[0x800]) shouldBe 0xFFF
            // The next id would pass 0xFFF in the same clock millisecond.
            val rolled = generator.newId()
            timestampOf(rolled) shouldBe start.toEpochMilli() + 1
            counterOf(rolled) shouldBe 0x7FF
            clock.instant() shouldBe start
            shouldBeStrictlyIncreasing(ids + rolled)
        }

        test("uuidv7-monotonic-and-unique: more than 4,096 ids in one clock millisecond stay strictly increasing and distinct") {
            val clock = TestClock(start)
            val generator = UuidV7Generator(clock, SplittableRandom(4096))
            val ids = List(20_000) { generator.newId() }
            shouldBeStrictlyIncreasing(ids)
            ids.toSet() shouldHaveSize ids.size
            timestampOf(ids.last()) shouldBeGreaterThanOrEqual start.toEpochMilli() + 4
        }

        test("uuidv7-monotonic-when-clock-goes-backwards: ids continue from the last timestamp with the counter") {
            val clock = TestClock(start)
            val generator = UuidV7Generator(clock, allZeros)
            val before = generator.newId()

            clock.setTo(start.minus(Duration.ofHours(1)))
            val afterStepBack = generator.newId()
            timestampOf(afterStepBack) shouldBe start.toEpochMilli()
            counterOf(afterStepBack) shouldBe counterOf(before) + 1

            clock.setTo(start.plusMillis(5))
            val afterCatchUp = generator.newId()
            timestampOf(afterCatchUp) shouldBe start.toEpochMilli() + 5
            shouldBeStrictlyIncreasing(listOf(before, afterStepBack, afterCatchUp))
        }

        test("uuidv7-clock-out-of-range-throws: a clock before 1970 or beyond 48 bits of milliseconds throws IllegalStateException") {
            listOf(
                Instant.ofEpochMilli(-1),
                Instant.parse("1969-12-31T23:59:59.999999999Z"),
                Instant.parse("1900-01-01T00:00:00Z"),
                Instant.ofEpochMilli(maxMillis + 1),
                Instant.ofEpochMilli(Long.MAX_VALUE),
                Instant.MAX,
                Instant.MIN,
            ).forEach { reading ->
                shouldThrow<IllegalStateException> { UuidV7Generator(TestClock(reading), SplittableRandom(1)).newId() }
            }
        }

        test("uuidv7-clock-out-of-range-throws: the range ends are usable, and the generator recovers when the clock returns") {
            val clock = TestClock(Instant.EPOCH)
            val generator = UuidV7Generator(clock, SplittableRandom(2))
            val first = generator.newId()
            timestampOf(first) shouldBe 0L

            clock.setTo(Instant.ofEpochMilli(-5))
            shouldThrow<IllegalStateException> { generator.newId() }

            clock.setTo(Instant.ofEpochMilli(maxMillis))
            val last = generator.newId()
            timestampOf(last) shouldBe maxMillis
            UuidV7.isV7(last) shouldBe true
            shouldBeStrictlyIncreasing(listOf(first, last))
        }

        test("uuidv7-clock-out-of-range-throws: counter rollover at the last millisecond would pass 48 bits and throws") {
            val generator = UuidV7Generator(TestClock(Instant.ofEpochMilli(maxMillis)), allOnes)
            repeat(0x801) { generator.newId() }
            shouldThrow<IllegalStateException> { generator.newId() }
        }

        test("uuidv7-monotonic-and-unique: several threads sharing one generator with a SplittableRandom (thread safety)") {
            val threads = 8
            val idsPerThread = 20_000
            val clock = TestClock(start)
            val generator = UuidV7Generator(clock, SplittableRandom(8))
            val ready = CountDownLatch(1)
            val perThread =
                Executors.newFixedThreadPool(threads).use { pool ->
                    val futures =
                        (0 until threads).map { thread ->
                            pool.submit(
                                Callable {
                                    ready.await()
                                    List(idsPerThread) { index ->
                                        if (thread == 0 && index % 500 == 0) clock.advanceBy(Duration.ofMillis(1))
                                        generator.newId()
                                    }
                                },
                            )
                        }
                    ready.countDown()
                    futures.map { it.get() }
                }
            perThread.forEach(::shouldBeStrictlyIncreasing)
            perThread.flatten().toSet() shouldHaveSize threads * idsPerThread
        }

        test("IdGenerator.next wraps a new id in a typed id") {
            val ids: IdGenerator = UuidV7Generator(TestClock(start), SplittableRandom(3))
            val tenant: TenantId = ids.next(::TenantId)
            val user: UserId = ids.next(::UserId)
            timestampOf(tenant.value) shouldBe start.toEpochMilli()
            UuidV7.compare(tenant.value, user.value) shouldBeLessThan 0
        }
    })
