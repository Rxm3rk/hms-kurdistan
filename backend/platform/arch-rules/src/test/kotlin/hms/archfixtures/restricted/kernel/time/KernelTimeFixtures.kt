package hms.archfixtures.restricted.kernel.time

import java.time.Instant
import java.util.UUID

// Fixtures that mirror the restricted functions of hms.kernel.time (platform-kernel.md §6.1, §6.2, §6.5) under
// the fixture root, so the rules, which match by name below the root, can be aimed at them.

@RequiresOptIn(level = RequiresOptIn.Level.ERROR)
@Retention(AnnotationRetention.RUNTIME)
@Target(AnnotationTarget.FUNCTION)
annotation class PersistenceOnly

@RequiresOptIn(level = RequiresOptIn.Level.ERROR)
@Retention(AnnotationRetention.RUNTIME)
@Target(AnnotationTarget.FUNCTION)
annotation class SafetyParameterFactory

@RequiresOptIn(level = RequiresOptIn.Level.ERROR)
@Retention(AnnotationRetention.RUNTIME)
@Target(AnnotationTarget.FUNCTION)
annotation class EpisodeRegistryOnly

/** Like the kernel's RecordedTime: a value class, so Kotlin mangles `restore` and Java cannot call it. */
@JvmInline
value class RecordedTime private constructor(
    val instant: Instant,
) {
    companion object {
        @PersistenceOnly
        @JvmStatic
        fun restore(instant: Instant): RecordedTime = RecordedTime(instant)
    }
}

/** A resolved configuration value. */
class ResolvedValue(
    val key: String,
)

/** The deployment environment. */
enum class EnvironmentClass { TEST, PROD }

/** Like the kernel's EntryTimePolicy: built only by its safety-parameter factory. */
class EntryTimePolicy private constructor(
    val key: String,
    val environment: EnvironmentClass,
) {
    companion object {
        @SafetyParameterFactory
        @JvmStatic
        fun fromResolved(
            value: ResolvedValue,
            environment: EnvironmentClass,
        ): EntryTimePolicy = EntryTimePolicy(value.key, environment)
    }
}

/** Like the kernel's BackEntryEpisode: built only by the episode registry. */
class BackEntryEpisode private constructor(
    val episodeId: UUID,
    val start: Instant,
) {
    companion object {
        @EpisodeRegistryOnly
        @JvmStatic
        fun fromRegistry(
            episodeId: UUID,
            start: Instant,
        ): BackEntryEpisode = BackEntryEpisode(episodeId, start)
    }
}
