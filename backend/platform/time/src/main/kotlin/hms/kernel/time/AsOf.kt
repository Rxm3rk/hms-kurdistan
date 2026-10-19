package hms.kernel.time

import java.time.Instant

/**
 * The coordinates of an as-was question on both axes (§7 item 3; R08 §3.7): what the record said, as known
 * at [knownAt], about [validAt]. knownAt null means the latest knowledge. The only as-of type (D4).
 * knownAt is a query bound, never a stamp, so it is an Instant (platform-kernel.md §6.1).
 */
data class AsOf(
    val validAt: Instant,
    val knownAt: Instant? = null,
) {
    companion object {
        /** The latest knowledge about [validAt]. */
        @JvmStatic
        fun latest(validAt: Instant): AsOf = AsOf(validAt, null)

        /** As known at a recorded time already held, for example a journal row's own recorded time. */
        @JvmStatic
        fun knownAt(
            validAt: Instant,
            recorded: RecordedTime,
        ): AsOf = AsOf(validAt, recorded.instant)
    }
}
