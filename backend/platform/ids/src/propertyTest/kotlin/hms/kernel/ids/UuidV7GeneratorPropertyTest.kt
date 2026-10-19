package hms.kernel.ids

import hms.kernel.testing.PropertyTestBudget
import hms.kernel.testing.TestClock
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.ints.shouldBeLessThan
import io.kotest.matchers.longs.shouldBeGreaterThanOrEqual
import io.kotest.matchers.shouldBe
import io.kotest.property.Arb
import io.kotest.property.arbitrary.bind
import io.kotest.property.arbitrary.choose
import io.kotest.property.arbitrary.constant
import io.kotest.property.arbitrary.int
import io.kotest.property.arbitrary.list
import io.kotest.property.arbitrary.long
import io.kotest.property.checkAll
import java.time.Duration
import java.time.Instant
import java.util.SplittableRandom
import java.util.UUID
import java.util.concurrent.Callable
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors

private const val MAX_MILLIS = (1L shl 48) - 1
private const val TIMESTAMP_SHIFT = 16

// Room above the start for every forward step a sequence can take, so the clock stays in range.
private const val HEADROOM_MILLIS = 1_000_000_000L
private const val MAX_STEP_MILLIS = 100_000L
private const val MAX_STEPS = 12
private const val SMALL_BURST = 64

// More than 0x800 ids in one millisecond always rolls the counter over (the seed is at most 0x7FF).
private const val ROLLOVER_BURST_MIN = 0x801
private const val ROLLOVER_BURST_MAX = 4_200
private const val COMMON_WEIGHT = 24
private const val RARE_WEIGHT = 1

private const val MAX_BACKWARD_MOVE_MILLIS = 5_000_000L
private const val BACKWARD_BURST = 40
private const val MAX_BACKWARD_STEPS = 20

private const val THREADS = 4
private const val MAX_IDS_PER_THREAD = 200
private const val ADVANCE_EVERY = 16

private fun timestampOf(id: UUID): Long = id.mostSignificantBits ushr TIMESTAMP_SHIFT

private val startMillis = Arb.long(0L..(MAX_MILLIS - HEADROOM_MILLIS))

private val forwardStep: Arb<Long> =
    Arb.choose<Long>(
        COMMON_WEIGHT to Arb.constant(0L),
        COMMON_WEIGHT to Arb.long(1L..MAX_STEP_MILLIS),
    )

private val burst: Arb<Int> =
    Arb.choose<Int>(
        COMMON_WEIGHT to Arb.int(1..SMALL_BURST),
        RARE_WEIGHT to Arb.int(ROLLOVER_BURST_MIN..ROLLOVER_BURST_MAX),
    )

/**
 * Monotonicity, uniqueness and thread safety of [UuidV7Generator] (platform-kernel spec §5, §17, §18 item 3),
 * driven by a [TestClock] and a seeded `SplittableRandom`.
 */
class UuidV7GeneratorPropertyTest :
    FunSpec({
        test("uuidv7-monotonic-and-unique: random steps and bursts, counter rollover included, give strictly increasing distinct ids") {
            checkAll(
                PropertyTestBudget.sequences(),
                Arb.long(),
                startMillis,
                Arb.list(Arb.bind(forwardStep, burst) { step, size -> step to size }, 1..MAX_STEPS),
            ) { seed, start, steps ->
                val clock = TestClock(Instant.ofEpochMilli(start))
                val generator = UuidV7Generator(clock, SplittableRandom(seed))
                val seen = HashSet<UUID>()
                var previous: UUID? = null
                steps.forEach { (step, size) ->
                    clock.advanceBy(Duration.ofMillis(step))
                    repeat(size) {
                        val id = generator.newId()
                        UuidV7.isV7(id) shouldBe true
                        timestampOf(id) shouldBeGreaterThanOrEqual clock.millis()
                        previous?.let { UuidV7.compare(it, id) shouldBeLessThan 0 }
                        seen.add(id) shouldBe true
                        previous = id
                    }
                }
            }
        }

        test("uuidv7-monotonic-and-unique: several threads sharing one generator with a SplittableRandom") {
            Executors.newFixedThreadPool(THREADS).use { pool ->
                checkAll(
                    PropertyTestBudget.sequences(),
                    Arb.long(),
                    startMillis,
                    Arb.list(Arb.int(1..MAX_IDS_PER_THREAD), THREADS..THREADS),
                ) { seed, start, counts ->
                    val clock = TestClock(Instant.ofEpochMilli(start))
                    val generator = UuidV7Generator(clock, SplittableRandom(seed))
                    val ready = CountDownLatch(1)
                    val futures =
                        counts.mapIndexed { thread, count ->
                            pool.submit(
                                Callable {
                                    ready.await()
                                    List(count) { index ->
                                        if (thread == 0 && index % ADVANCE_EVERY == 0) clock.advanceBy(Duration.ofMillis(1))
                                        generator.newId()
                                    }
                                },
                            )
                        }
                    ready.countDown()
                    val perThread = futures.map { it.get() }
                    perThread.forEach { ids ->
                        ids.zipWithNext().forEach { (earlier, later) -> UuidV7.compare(earlier, later) shouldBeLessThan 0 }
                    }
                    perThread.flatten().toSet() shouldHaveSize counts.sum()
                }
            }
        }

        test("uuidv7-monotonic-when-clock-goes-backwards: TestClock.setTo moving back and forth keeps ids strictly increasing") {
            checkAll(
                PropertyTestBudget.sequences(),
                Arb.long(),
                startMillis,
                Arb.list(
                    Arb.bind(
                        Arb.long(-MAX_BACKWARD_MOVE_MILLIS..MAX_BACKWARD_MOVE_MILLIS),
                        Arb.int(1..BACKWARD_BURST),
                    ) { move, size -> move to size },
                    1..MAX_BACKWARD_STEPS,
                ),
            ) { seed, start, moves ->
                val clock = TestClock(Instant.ofEpochMilli(start))
                val generator = UuidV7Generator(clock, SplittableRandom(seed))
                var highWater = -1L
                var previous: UUID? = null
                moves.forEach { (move, size) ->
                    clock.setTo(Instant.ofEpochMilli((clock.millis() + move).coerceIn(0L, MAX_MILLIS)))
                    highWater = maxOf(highWater, clock.millis())
                    repeat(size) {
                        val id = generator.newId()
                        // At most 20 x 40 ids share a logical millisecond here, so the counter never rolls
                        // over and every id carries the highest clock reading so far.
                        timestampOf(id) shouldBe highWater
                        previous?.let { UuidV7.compare(it, id) shouldBeLessThan 0 }
                        previous = id
                    }
                }
            }
        }
    })
