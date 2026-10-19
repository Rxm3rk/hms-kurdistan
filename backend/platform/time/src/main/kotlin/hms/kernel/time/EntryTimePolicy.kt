package hms.kernel.time

import java.time.Duration
import java.util.UUID

/**
 * Tolerances for one timing class (platform-kernel.md §6.2, §6.3; SI-10; CTRL-0010-1). Built only by
 * [fromResolved] from resolved settings (D11, §6.5); `init` checks every invariant, so a reflective
 * construction with invalid values throws.
 */
class EntryTimePolicy private constructor(
    val timingClass: TimingClass,
    val contemporaneousTolerance: Duration,
    val futureTolerance: Duration,
    val interfaceLatenessTolerance: Duration,
    val offlineCaptureTolerance: Duration,
    /** Key, provenance and source of each value, in the order of [keys]. */
    val sources: List<ResolvedParameter<Duration>>,
) {
    init {
        val tolerances = listOf(contemporaneousTolerance, futureTolerance, interfaceLatenessTolerance, offlineCaptureTolerance)
        require(tolerances.none { it.isNegative }) { "EntryTimePolicy tolerances must not be negative: $tolerances" }
        require(sources.map { it.key } == keys(timingClass)) {
            "EntryTimePolicy sources must carry the keys ${keys(timingClass)}, got ${sources.map { it.key }}"
        }
        require(sources.map { it.value } == tolerances) { "EntryTimePolicy sources must carry the tolerance values" }
    }

    override fun toString(): String =
        "EntryTimePolicy(timingClass=${timingClass.name}, contemporaneous=$contemporaneousTolerance, future=$futureTolerance, " +
            "interfaceLateness=$interfaceLatenessTolerance, offlineCapture=$offlineCaptureTolerance, sources=$sources)"

    companion object {
        /** The shared namespace of the tolerance keys (platform-kernel.md §6.3). */
        const val KEY_PREFIX: String = "platform.time.entry"

        private val KEY_SUFFIXES =
            listOf("contemporaneous-tolerance", "future-tolerance", "interface-lateness-tolerance", "offline-capture-tolerance")

        /**
         * The four setting keys of [timingClass], in the order contemporaneous, future, interface lateness,
         * offline capture: `platform.time.entry.<timing-class>.<tolerance>` (platform-kernel.md §6.3).
         */
        @JvmStatic
        fun keys(timingClass: TimingClass): List<String> = KEY_SUFFIXES.map { "$KEY_PREFIX.${timingClass.name}.$it" }

        /**
         * Builds the policy from four resolved values. Refuses, in this order: a parameter whose key is not the
         * timing class's key for that tolerance (`KEY_MISMATCH`); a synthetic value in TRAIN or PROD
         * (`SYNTHETIC_IN_TRAIN_OR_PROD`); a negative duration (`VALUE_OUT_OF_RANGE`). Each refusal names the
         * first offending key.
         */
        @Suppress("LongParameterList") // The signature is fixed by platform-kernel.md §6.2.
        @SafetyParameterFactory
        @JvmStatic
        fun fromResolved(
            timingClass: TimingClass,
            contemporaneous: ResolvedParameter<Duration>,
            future: ResolvedParameter<Duration>,
            interfaceLateness: ResolvedParameter<Duration>,
            offlineCapture: ResolvedParameter<Duration>,
            environment: EnvironmentClass,
        ): SafetyParameterResult<EntryTimePolicy> {
            val parameters = listOf(contemporaneous, future, interfaceLateness, offlineCapture)
            val refusal =
                parameters
                    .zip(keys(timingClass))
                    .firstOrNull { (parameter, key) -> parameter.key != key }
                    ?.let { SafetyParameterResult.Refused(SafetyParameterRefusal.KEY_MISMATCH, it.first.key) }
                    ?: syntheticRefusal(environment, parameters)
                    ?: parameters
                        .firstOrNull { it.value.isNegative }
                        ?.let { SafetyParameterResult.Refused(SafetyParameterRefusal.VALUE_OUT_OF_RANGE, it.key) }
            return refusal ?: SafetyParameterResult.Built(
                EntryTimePolicy(
                    timingClass,
                    contemporaneous.value,
                    future.value,
                    interfaceLateness.value,
                    offlineCapture.value,
                    parameters,
                ),
            )
        }
    }
}

/** What `EntryTimePolicySource` answers for a timing class (platform-kernel.md §6.2, §7.6). */
sealed interface EntryTimePolicyLookup {
    data class Available(
        val policy: EntryTimePolicy,
    ) : EntryTimePolicyLookup

    /** A definition or its value is missing (until DN-KN1: always, since no tolerance has a value). */
    data class NotConfigured(
        val timingClass: TimingClass,
        val missingKeys: List<String>,
    ) : EntryTimePolicyLookup

    /** Configuration could not be read. */
    data object Unavailable : EntryTimePolicyLookup

    /** The caller did not look a policy up because needsPolicy was false. */
    data object NotLookedUp : EntryTimePolicyLookup
}

/**
 * A downtime episode as held by the episode registry (TRU-BCP-03; platform-site), whose window bounds the
 * clinical start of a back-entry (platform-kernel.md §6.2). Never built from a command payload.
 */
class BackEntryEpisode private constructor(
    val episodeId: UUID,
    val window: ValidPeriod,
) {
    override fun equals(other: Any?): Boolean = other is BackEntryEpisode && episodeId == other.episodeId && window == other.window

    override fun hashCode(): Int = 31 * episodeId.hashCode() + window.hashCode()

    override fun toString(): String = "BackEntryEpisode(episodeId=$episodeId, window=$window)"

    companion object {
        /** ArchUnit: callable only from the episode registry's package (none in WP-0.3) and test sources (platform-kernel.md §11). */
        @EpisodeRegistryOnly
        @JvmStatic
        fun fromRegistry(
            episodeId: UUID,
            window: ValidPeriod,
        ): BackEntryEpisode = BackEntryEpisode(episodeId, window)
    }
}

/** Kotlin opt-in marker for the episode registry's factory; the binding check is the ArchUnit rule (platform-kernel.md §6.2, §11). */
@RequiresOptIn(level = RequiresOptIn.Level.ERROR, message = "Episode registry only (platform-kernel.md §11).")
@Retention(AnnotationRetention.RUNTIME)
@Target(AnnotationTarget.FUNCTION)
annotation class EpisodeRegistryOnly
