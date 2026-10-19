package hms.kernel.time

import java.time.Clock
import java.time.Instant

/**
 * Recorded (system, transaction) time: a UTC instant read from the injected [Clock] when the server
 * records, truncated to microseconds (platform-kernel.md §6.1; SI-10; §6.2). Never supplied by a client,
 * a command, a device or an interface, and never turned into a [ClinicalTime] by any kernel function.
 */
@JvmInline
value class RecordedTime private constructor(
    val instant: Instant,
) : Comparable<RecordedTime> {
    init {
        require(instant.isMicros()) { "RecordedTime must be truncated to microseconds, got $instant" }
    }

    override fun compareTo(other: RecordedTime): Int = instant.compareTo(other.instant)

    companion object {
        /** The only way application code gets a recorded time. */
        @JvmStatic
        fun now(clock: Clock): RecordedTime = RecordedTime(clock.instant().toMicros())

        /**
         * Rebuilds a stored value. ArchUnit: callable only from `..infrastructure.persistence..`,
         * `hms.kernel.journal.infrastructure..` and `hms.kernel.journal.inmemory..` (platform-kernel.md §11).
         */
        @PersistenceOnly
        @JvmStatic
        fun restore(instant: Instant): RecordedTime = RecordedTime(instant.toMicros())
    }
}

/** Kotlin opt-in marker for persistence-only factories; the binding check is the ArchUnit rule (platform-kernel.md §6.1, §11). */
@RequiresOptIn(level = RequiresOptIn.Level.ERROR, message = "Persistence mapping only (platform-kernel.md §11).")
@Retention(AnnotationRetention.RUNTIME)
@Target(AnnotationTarget.FUNCTION)
annotation class PersistenceOnly
