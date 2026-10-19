package hms.archfixtures.restrictedbyname.kernel.time

import java.time.Instant

/**
 * Name-fallback fixture: a RecordedTime whose `restore` has lost its opt-in marker. The rules still match it by
 * owner and name (platform-kernel.md §11), so dropping the annotation cannot open the factory.
 */
@JvmInline
value class RecordedTime private constructor(
    val instant: Instant,
) {
    companion object {
        @JvmStatic
        fun restore(instant: Instant): RecordedTime = RecordedTime(instant)
    }
}
