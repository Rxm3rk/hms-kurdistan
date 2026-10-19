package hms.kernel.time

import java.time.Duration
import java.time.ZoneOffset

/**
 * The SI-10 entry-time classifier, the only one (D10; platform-kernel.md §6.2). Pure: the same inputs give the
 * same answer on every channel. The journal appender is its only binding caller; a module may call it to
 * predict a result, which binds nothing.
 *
 * The rows of the §6.2 table are checked top to bottom and the first match decides; a lag equal to a
 * tolerance is accepted. Lag = recorded instant minus clinical start instant (positive: the clinical time is
 * earlier). For `CLINICAL_*` kinds a given end may not be later than the recorded time by more than the
 * future bound either.
 */
object EntryTimeClassifier {
    private val POLICY_MODES = setOf(EntryMode.USER, EntryMode.OFFLINE_CAPTURE, EntryMode.DEVICE, EntryMode.INTERFACE)

    /** True when classify needs an EntryTimePolicy for this combination (§6.2 table, column "Policy"). */
    fun needsPolicy(
        input: ValidTimeInput,
        kind: ValidTimeKind,
        mode: EntryMode,
    ): Boolean = input is ValidTimeInput.Given && kind != ValidTimeKind.EFFECTIVE && mode in POLICY_MODES

    /**
     * Classifies one entry. [policy] is used only where [needsPolicy] is true (otherwise `Accepted.policy` is
     * null); [episode], from the context's `BackEntryAuthority`, is used only in [EntryMode.BACK_ENTRY].
     */
    @Suppress("LongParameterList") // The signature is fixed by platform-kernel.md §6.2.
    fun classify(
        input: ValidTimeInput,
        kind: ValidTimeKind,
        recorded: RecordedTime,
        mode: EntryMode,
        policy: EntryTimePolicyLookup,
        episode: BackEntryEpisode?,
    ): EntryTimingResult =
        when (input) {
            ValidTimeInput.AtRecording -> {
                classifyAtRecording(kind, recorded, mode)
            }

            is ValidTimeInput.Given -> {
                if (kind == ValidTimeKind.EFFECTIVE) {
                    classifyEffective(input.validTime, recorded)
                } else {
                    classifyGivenClinical(input.validTime, recorded, mode, policy, episode)
                }
            }
        }

    /** Rows 1 and 2: an effective date is back-dated when it starts before the recorded time, otherwise effective-dated. */
    private fun classifyEffective(
        validTime: ValidTime,
        recorded: RecordedTime,
    ): EntryTimingResult {
        val lag = lagOf(validTime, recorded)
        val timing = if (lag > Duration.ZERO) EntryTiming.BackDated(lag, ClinicalTimeSource.EFFECTIVE_DATE) else EntryTiming.EffectiveDated
        return EntryTimingResult.Accepted(timing, validTime, null)
    }

    /** Rows 2 to 5: `AtRecording` is stamped with the recorded time, offset UTC, open end, where it is lawful. */
    private fun classifyAtRecording(
        kind: ValidTimeKind,
        recorded: RecordedTime,
        mode: EntryMode,
    ): EntryTimingResult {
        val stamped = ValidTime.from(ClinicalTime.of(recorded.instant, ZoneOffset.UTC))
        return when {
            kind == ValidTimeKind.EFFECTIVE -> {
                EntryTimingResult.Accepted(EntryTiming.EffectiveDated, stamped, null)
            }

            kind == ValidTimeKind.CLINICAL_CAPTURED -> {
                EntryTimingResult.Refused(EntryTimeRefusal.CAPTURE_TIME_REQUIRED)
            }

            mode == EntryMode.USER || mode == EntryMode.SYSTEM -> {
                EntryTimingResult.Accepted(EntryTiming.Contemporaneous(ClinicalTimeSource.AT_RECORDING), stamped, null)
            }

            else -> {
                EntryTimingResult.Refused(EntryTimeRefusal.CAPTURE_TIME_REQUIRED)
            }
        }
    }

    /** Rows 6 to 19: a given time on a `CLINICAL_*` kind. */
    private fun classifyGivenClinical(
        validTime: ValidTime,
        recorded: RecordedTime,
        mode: EntryMode,
        policy: EntryTimePolicyLookup,
        episode: BackEntryEpisode?,
    ): EntryTimingResult =
        when (mode) {
            EntryMode.SYSTEM -> {
                EntryTimingResult.Refused(EntryTimeRefusal.SYSTEM_CANNOT_SUPPLY_CLINICAL_TIME)
            }

            EntryMode.BACK_ENTRY -> {
                classifyBackEntry(validTime, recorded, episode)
            }

            EntryMode.MIGRATION -> {
                classifyMigration(validTime, recorded)
            }

            EntryMode.USER, EntryMode.OFFLINE_CAPTURE, EntryMode.DEVICE, EntryMode.INTERFACE -> {
                when (policy) {
                    is EntryTimePolicyLookup.Available -> classifyWithPolicy(validTime, recorded, mode, policy.policy)
                    else -> EntryTimingResult.Refused(EntryTimeRefusal.TIMING_POLICY_NOT_CONFIGURED)
                }
            }
        }

    /** Rows 8, 10 to 13, 17 and 18. */
    private fun classifyWithPolicy(
        validTime: ValidTime,
        recorded: RecordedTime,
        mode: EntryMode,
        policy: EntryTimePolicy,
    ): EntryTimingResult {
        if (isLaterThan(validTime, recorded, policy.futureTolerance)) {
            return EntryTimingResult.Refused(EntryTimeRefusal.CLINICAL_TIME_IN_FUTURE)
        }
        val lag = lagOf(validTime, recorded)
        val timing =
            when (mode) {
                EntryMode.USER -> {
                    if (lag <= policy.contemporaneousTolerance) {
                        EntryTiming.Contemporaneous(ClinicalTimeSource.ENTERED)
                    } else {
                        EntryTiming.BackDated(lag, ClinicalTimeSource.ENTERED)
                    }
                }

                EntryMode.OFFLINE_CAPTURE -> {
                    if (lag <= policy.offlineCaptureTolerance) EntryTiming.OfflineCapture(lag) else null
                }

                else -> {
                    val source = if (mode == EntryMode.DEVICE) ClinicalTimeSource.DEVICE else ClinicalTimeSource.INTERFACE
                    if (lag <= policy.interfaceLatenessTolerance) {
                        EntryTiming.Contemporaneous(source)
                    } else {
                        EntryTiming.LateArrival(lag, source)
                    }
                }
            }
        return timing?.let { EntryTimingResult.Accepted(it, validTime, policy) }
            ?: EntryTimingResult.Refused(EntryTimeRefusal.OFFLINE_CAPTURE_TOO_LATE)
    }

    /** Rows 9 and 14 to 16. */
    private fun classifyBackEntry(
        validTime: ValidTime,
        recorded: RecordedTime,
        episode: BackEntryEpisode?,
    ): EntryTimingResult =
        when {
            isLaterThan(validTime, recorded, Duration.ZERO) -> {
                EntryTimingResult.Refused(EntryTimeRefusal.CLINICAL_TIME_IN_FUTURE)
            }

            episode == null -> {
                EntryTimingResult.Refused(EntryTimeRefusal.BACK_ENTRY_WITHOUT_EPISODE)
            }

            episode.window.contains(validTime.start.instant) -> {
                EntryTimingResult.Accepted(EntryTiming.BackEntry(lagOf(validTime, recorded), episode.episodeId), validTime, null)
            }

            else -> {
                EntryTimingResult.Refused(EntryTimeRefusal.OUTSIDE_BACK_ENTRY_WINDOW)
            }
        }

    /** Rows 9 and 19. */
    private fun classifyMigration(
        validTime: ValidTime,
        recorded: RecordedTime,
    ): EntryTimingResult =
        if (isLaterThan(validTime, recorded, Duration.ZERO)) {
            EntryTimingResult.Refused(EntryTimeRefusal.CLINICAL_TIME_IN_FUTURE)
        } else {
            EntryTimingResult.Accepted(EntryTiming.Migrated(lagOf(validTime, recorded)), validTime, null)
        }

    private fun lagOf(
        validTime: ValidTime,
        recorded: RecordedTime,
    ): Duration = Duration.between(validTime.start.instant, recorded.instant)

    /** True when the start or the given end is later than the recorded time by more than [bound]. */
    private fun isLaterThan(
        validTime: ValidTime,
        recorded: RecordedTime,
        bound: Duration,
    ): Boolean = listOfNotNull(validTime.start, validTime.endExclusive).any { Duration.between(recorded.instant, it.instant) > bound }
}
