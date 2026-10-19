package hms.kernel.ids

import java.time.Clock
import java.util.UUID
import java.util.concurrent.locks.ReentrantLock
import java.util.random.RandomGenerator
import kotlin.concurrent.withLock

/**
 * RFC 9562 UUIDv7 with the Method 1 counter, monotonic per instance, also when the clock goes backwards
 * (platform-kernel spec §5).
 *
 * `rand_a` is a 12-bit counter, seeded from [random] with its top bit clear at each new millisecond and
 * incremented for every further id in that millisecond; when it would pass `0xFFF` the logical timestamp
 * moves one millisecond ahead and the counter is reseeded. `rand_b` is 62 fresh random bits per id. The
 * logical timestamp is `max(clock.millis(), last)`, so the generator never sleeps and its ids stay strictly
 * increasing under [UuidV7.compare]. One lock guards the state and the random draws, so a [random] that is
 * not thread-safe (`SplittableRandom` in tests) is still used safely.
 *
 * An id's timestamp is never a recorded or clinical time, and id order is never event order.
 */
class UuidV7Generator(
    private val clock: Clock,
    private val random: RandomGenerator,
) : IdGenerator {
    private val lock = ReentrantLock()
    private var lastMillis: Long = NO_ID_YET
    private var counter: Int = 0

    /**
     * Throws IllegalStateException when the clock reads before 1970 or beyond 48 bits of milliseconds, or
     * when the counter rollover would move the logical timestamp beyond 48 bits.
     */
    override fun newId(): UUID =
        lock.withLock {
            val clockMillis = readClock()
            when {
                clockMillis > lastMillis -> {
                    lastMillis = clockMillis
                    counter = seed()
                }

                counter < MAX_COUNTER -> {
                    counter += 1
                }

                else -> {
                    check(lastMillis < MAX_MILLIS) { "UUIDv7 counter rollover would pass 48 bits of milliseconds" }
                    lastMillis += 1
                    counter = seed()
                }
            }
            val randB = random.nextLong() ushr RAND_B_SHIFT
            UUID((lastMillis shl TIMESTAMP_SHIFT) or VERSION_BITS or counter.toLong(), VARIANT_BITS or randB)
        }

    private fun readClock(): Long {
        val millis =
            try {
                clock.millis()
            } catch (e: ArithmeticException) {
                throw IllegalStateException("the clock reads beyond the range of epoch milliseconds", e)
            }
        check(millis in 0..MAX_MILLIS) { "the clock reads $millis ms since the epoch, outside 0..2^48-1 for UUIDv7" }
        return millis
    }

    private fun seed(): Int = random.nextInt() and SEED_MASK

    private companion object {
        const val NO_ID_YET: Long = -1
        const val MAX_MILLIS: Long = (1L shl 48) - 1
        const val TIMESTAMP_SHIFT: Int = 16
        const val VERSION_BITS: Long = 0x7000
        const val MAX_COUNTER: Int = 0xFFF
        const val SEED_MASK: Int = 0x7FF
        const val RAND_B_SHIFT: Int = 2
        const val VARIANT_BITS: Long = Long.MIN_VALUE
    }
}
