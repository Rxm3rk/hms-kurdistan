package hms.kernel.time

import java.time.Duration
import java.util.UUID

/** How an entry reached the record. Derived by `CommandContext.entryMode` (platform-kernel.md §7.3); never read from request input. */
enum class EntryMode { USER, OFFLINE_CAPTURE, BACK_ENTRY, DEVICE, INTERFACE, MIGRATION, SYSTEM }

/**
 * The class of record whose tolerances apply (for example "vital-sign"); declared per event type in the
 * event catalogue (platform-kernel.md §6.2, §6.3). The name is `[a-z][a-z0-9-]*`.
 */
@JvmInline
value class TimingClass(
    val name: String,
) {
    init {
        require(NAME.matches(name)) { "TimingClass name must match [a-z][a-z0-9-]*, got '$name'" }
    }

    private companion object {
        val NAME = Regex("[a-z][a-z0-9-]*")
    }
}

/** The classifier's answer (platform-kernel.md §6.2). */
sealed interface EntryTimingResult {
    /** validTime is the stamped value for AtRecording, otherwise the given one. policy is null when none was needed. */
    data class Accepted(
        val timing: EntryTiming,
        val validTime: ValidTime,
        val policy: EntryTimePolicy?,
    ) : EntryTimingResult

    data class Refused(
        val reason: EntryTimeRefusal,
    ) : EntryTimingResult
}

/**
 * Accepted classifications only: a refused entry has no EntryTiming and cannot be appended. code, source and
 * requirements are fixed per subtype (platform-kernel.md §6.2, "Requirements of each accepted result"); each
 * subtype checks its source and the sign of its lag in `init`.
 */
sealed interface EntryTiming {
    val code: EntryTimingCode
    val source: ClinicalTimeSource
    val requirements: Set<TimingRequirement>

    /** Within the tolerance; the source (`ENTERED`, `DEVICE`, `INTERFACE`, `AT_RECORDING`) is stored. */
    data class Contemporaneous(
        override val source: ClinicalTimeSource,
    ) : EntryTiming {
        init {
            require(source in CONTEMPORANEOUS_SOURCES) { "Contemporaneous source must be one of $CONTEMPORANEOUS_SOURCES, got $source" }
        }

        override val code: EntryTimingCode get() = EntryTimingCode.CONTEMPORANEOUS
        override val requirements: Set<TimingRequirement> get() = emptySet()
    }

    /** source ENTERED for a CLINICAL_* kind, EFFECTIVE_DATE for a retroactive EFFECTIVE change. lag > 0. */
    data class BackDated(
        val lag: Duration,
        override val source: ClinicalTimeSource,
    ) : EntryTiming {
        init {
            require(source == ClinicalTimeSource.ENTERED || source == ClinicalTimeSource.EFFECTIVE_DATE) {
                "BackDated source must be ENTERED or EFFECTIVE_DATE, got $source"
            }
            require(lag > Duration.ZERO) { "BackDated lag must be positive, got $lag" }
        }

        override val code: EntryTimingCode get() = EntryTimingCode.BACK_DATED
        override val requirements: Set<TimingRequirement> get() = BACK_DATED_REQUIREMENTS
    }

    /** Back-entry inside a registry episode; keeps the given clinical time. lag >= 0. */
    data class BackEntry(
        val lag: Duration,
        val episodeId: UUID,
    ) : EntryTiming {
        init {
            require(!lag.isNegative) { "BackEntry lag must not be negative, got $lag" }
        }

        override val code: EntryTimingCode get() = EntryTimingCode.BACK_ENTRY
        override val source: ClinicalTimeSource get() = ClinicalTimeSource.ENTERED
        override val requirements: Set<TimingRequirement> get() = BACK_ENTRY_REQUIREMENTS
    }

    /** Captured offline on a device and synchronised later; the lag may be negative within the future tolerance. */
    data class OfflineCapture(
        val lag: Duration,
    ) : EntryTiming {
        override val code: EntryTimingCode get() = EntryTimingCode.OFFLINE_CAPTURE
        override val source: ClinicalTimeSource get() = ClinicalTimeSource.ENTERED
        override val requirements: Set<TimingRequirement> get() = CHANNEL_REQUIREMENTS
    }

    /** Device or interface data later than its lateness tolerance. lag > 0. */
    data class LateArrival(
        val lag: Duration,
        override val source: ClinicalTimeSource,
    ) : EntryTiming {
        init {
            require(source == ClinicalTimeSource.DEVICE || source == ClinicalTimeSource.INTERFACE) {
                "LateArrival source must be DEVICE or INTERFACE, got $source"
            }
            require(lag > Duration.ZERO) { "LateArrival lag must be positive, got $lag" }
        }

        override val code: EntryTimingCode get() = EntryTimingCode.LATE_ARRIVAL
        override val requirements: Set<TimingRequirement> get() = CHANNEL_REQUIREMENTS
    }

    /** Migrated data with its original times (§8.3). lag >= 0. */
    data class Migrated(
        val lag: Duration,
    ) : EntryTiming {
        init {
            require(!lag.isNegative) { "Migrated lag must not be negative, got $lag" }
        }

        override val code: EntryTimingCode get() = EntryTimingCode.MIGRATED
        override val source: ClinicalTimeSource get() = ClinicalTimeSource.MIGRATED
        override val requirements: Set<TimingRequirement> get() = MIGRATED_REQUIREMENTS
    }

    /** An effective date not earlier than the recorded time; no kernel requirement. */
    data object EffectiveDated : EntryTiming {
        override val code: EntryTimingCode get() = EntryTimingCode.EFFECTIVE_DATED
        override val source: ClinicalTimeSource get() = ClinicalTimeSource.EFFECTIVE_DATE
        override val requirements: Set<TimingRequirement> get() = emptySet()
    }
}

private val CONTEMPORANEOUS_SOURCES =
    setOf(ClinicalTimeSource.ENTERED, ClinicalTimeSource.DEVICE, ClinicalTimeSource.INTERFACE, ClinicalTimeSource.AT_RECORDING)

private val BACK_DATED_REQUIREMENTS =
    setOf(
        TimingRequirement.BACK_DATING_AUTHORIZATION,
        TimingRequirement.USER_ENTERED_REASON,
        TimingRequirement.AUDIT_BOTH_TIMES,
        TimingRequirement.LABEL_ON_DISPLAY_PRINT_EXPORT,
    )

private val BACK_ENTRY_REQUIREMENTS =
    setOf(TimingRequirement.BACK_ENTRY_AUTHORITY, TimingRequirement.AUDIT_BOTH_TIMES, TimingRequirement.LABEL_ON_DISPLAY_PRINT_EXPORT)

private val CHANNEL_REQUIREMENTS =
    setOf(TimingRequirement.CHANNEL_IDENTITY, TimingRequirement.AUDIT_BOTH_TIMES, TimingRequirement.LABEL_ON_DISPLAY_PRINT_EXPORT)

private val MIGRATED_REQUIREMENTS =
    setOf(TimingRequirement.MIGRATION_PROVENANCE, TimingRequirement.AUDIT_BOTH_TIMES, TimingRequirement.LABEL_ON_DISPLAY_PRINT_EXPORT)

/**
 * The one stored entry-timing vocabulary (D10): the journal's `entry_timing` column and the envelope's
 * `entrytiming` extension (platform-kernel.md §6.2, §14). Adding a value is a journal migration and an envelope change.
 */
enum class EntryTimingCode(
    val labelled: Boolean,
) {
    CONTEMPORANEOUS(false),
    BACK_DATED(true),
    BACK_ENTRY(true),
    OFFLINE_CAPTURE(true),
    LATE_ARRIVAL(true),
    MIGRATED(true),
    EFFECTIVE_DATED(false),
}

/** Why the classifier refused an entry (platform-kernel.md §6.2). */
enum class EntryTimeRefusal {
    CLINICAL_TIME_IN_FUTURE,
    CAPTURE_TIME_REQUIRED,
    SYSTEM_CANNOT_SUPPLY_CLINICAL_TIME,
    TIMING_POLICY_NOT_CONFIGURED,
    OFFLINE_CAPTURE_TOO_LATE,
    BACK_ENTRY_WITHOUT_EPISODE,
    OUTSIDE_BACK_ENTRY_WINDOW,
}

/** What the journal must enforce for an accepted result; the kernel only states it (platform-kernel.md §6.2). */
enum class TimingRequirement {
    BACK_DATING_AUTHORIZATION,
    BACK_ENTRY_AUTHORITY,
    USER_ENTERED_REASON,
    CHANNEL_IDENTITY,
    MIGRATION_PROVENANCE,
    AUDIT_BOTH_TIMES,
    LABEL_ON_DISPLAY_PRINT_EXPORT,
}
