package hms.kernel.testing.statemachine.archfixtures.domain

import java.time.Instant
import java.util.UUID
import java.util.concurrent.ThreadLocalRandom
import kotlin.random.Random

// Fixture classes for the determinism rules of the ArchitectureTest template (DomainDeterminismTest). They sit in a
// `domain` package on purpose and are never production code: the project's own ArchitectureTest imports main classes
// only. NOT FOR CLINICAL USE.

/** Pure: no clock, no randomness. */
class PureFixture {
    /** Adds two numbers. */
    fun add(
        left: Int,
        right: Int,
    ): Int = left + right
}

/** Draws from the seeded generators only: allowed in test fixtures, forbidden in main domain code. */
class SeededRandomFixture {
    /** Draws from a Kotlin generator seeded with [seed]. */
    fun kotlinDraw(seed: Long): Int = Random(seed).nextInt()

    /** Draws from a Java generator seeded with [seed]. */
    fun javaDraw(seed: Long): Int =
        java.util
            .Random(seed)
            .nextInt()
}

/** Uses kotlin.random.Random.Default. */
class RandomDefaultFixture {
    /** Draws from the default generator. */
    fun draw(): Int = Random.nextInt()
}

/** Uses an unseeded java.util.Random. */
class UnseededJavaRandomFixture {
    /** Draws from a self-seeded generator. */
    fun draw(): Int = java.util.Random().nextInt()
}

/** Uses Math.random. */
class MathRandomFixture {
    /** Draws from Math.random. */
    fun draw(): Double = Math.random()
}

/** Uses ThreadLocalRandom. */
class ThreadLocalRandomFixture {
    /** Draws from the thread's generator. */
    fun draw(): Int = ThreadLocalRandom.current().nextInt()
}

/** Uses UUID.randomUUID. */
class RandomUuidFixture {
    /** A random identifier. */
    fun draw(): UUID = UUID.randomUUID()
}

/** Shuffles without a Random. */
class ShuffleFixture {
    /** The list in a hidden random order. */
    fun draw(values: List<Int>): List<Int> = values.shuffled()
}

/** Reads the system clock. */
class SystemClockFixture {
    /** The system time. */
    fun draw(): Instant = Instant.now()
}
