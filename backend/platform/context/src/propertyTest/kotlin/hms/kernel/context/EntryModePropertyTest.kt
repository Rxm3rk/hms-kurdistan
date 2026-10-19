// Generator ranges and the combination count are test data, not domain values.
@file:Suppress("MagicNumber")
@file:OptIn(SafetyParameterFactory::class, EpisodeRegistryOnly::class)

package hms.kernel.context

import hms.kernel.context.CommandContextRefusal.BACK_ENTRY_FACILITY_MISMATCH
import hms.kernel.context.CommandContextRefusal.BACK_ENTRY_NEEDS_USER_ACTOR
import hms.kernel.context.CommandContextRefusal.BACK_ENTRY_WHILE_OFFLINE
import hms.kernel.context.CommandContextRefusal.DEVICE_ACTOR_NEEDS_MATCHING_DEVICE
import hms.kernel.context.CommandContextRefusal.OFFLINE_CAPTURE_DEVICE_MISMATCH
import hms.kernel.context.CommandContextRefusal.OFFLINE_CAPTURE_NEEDS_CLINICAL_TIME
import hms.kernel.context.CommandContextRefusal.OFFLINE_CAPTURE_NEEDS_USER_ACTOR
import hms.kernel.context.CommandContextRefusal.ON_BEHALF_OF_NEEDS_USER_ACTOR
import hms.kernel.context.CommandContextRefusal.ON_BEHALF_OF_SELF
import hms.kernel.testing.PropertyTestBudget
import hms.kernel.time.BackEntryEpisode
import hms.kernel.time.ClinicalTime
import hms.kernel.time.ContentProvenance
import hms.kernel.time.EntryMode
import hms.kernel.time.EntryTimeClassifier
import hms.kernel.time.EntryTimePolicy
import hms.kernel.time.EntryTimePolicyLookup
import hms.kernel.time.EntryTimingCode
import hms.kernel.time.EntryTimingResult
import hms.kernel.time.EnvironmentClass
import hms.kernel.time.EpisodeRegistryOnly
import hms.kernel.time.RecordedTime
import hms.kernel.time.ResolvedParameter
import hms.kernel.time.SafetyParameterFactory
import hms.kernel.time.SafetyParameterResult
import hms.kernel.time.TimingClass
import hms.kernel.time.ValidPeriod
import hms.kernel.time.ValidTime
import hms.kernel.time.ValidTimeInput
import hms.kernel.time.ValidTimeKind
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldNotContain
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import io.kotest.property.Arb
import io.kotest.property.arbitrary.arbitrary
import io.kotest.property.arbitrary.boolean
import io.kotest.property.arbitrary.enum
import io.kotest.property.arbitrary.int
import io.kotest.property.arbitrary.long
import io.kotest.property.checkAll
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneOffset

private enum class OnBehalf { NONE, OTHER_USER, SELF }

private enum class DeviceChoice { NONE, MATCHING, OTHER }

private enum class Channel { ONLINE, OFFLINE }

private enum class BackEntryChoice { NONE, SAME_FACILITY, OTHER_FACILITY }

/** One combination of the context fields that decide the refusals and the entry mode. */
private data class Shape(
    val kind: ActorKind,
    val atFacility: Boolean,
    val onBehalfOf: OnBehalf,
    val device: DeviceChoice,
    val clinicalTime: Boolean,
    val channel: Channel,
    val backEntry: BackEntryChoice,
) {
    val offline: Boolean get() = channel == Channel.OFFLINE
    val hasBackEntry: Boolean get() = backEntry != BackEntryChoice.NONE

    fun build(clinical: ClinicalTime = ContextFixtures.CLINICAL_TIME): CommandContextResult {
        val actor = ContextFixtures.actor(kind)
        val onBehalfOfUser =
            when (onBehalfOf) {
                OnBehalf.NONE -> null
                OnBehalf.OTHER_USER -> ContextFixtures.OTHER_USER
                // For a non-user actor any on-behalf-of is refused; the fixture user stands in.
                OnBehalf.SELF -> ContextFixtures.USER
            }
        val deviceRef =
            when (device) {
                DeviceChoice.NONE -> null
                DeviceChoice.MATCHING -> ContextFixtures.DEVICE
                DeviceChoice.OTHER -> ContextFixtures.OTHER_DEVICE
            }
        val authority =
            when (backEntry) {
                BackEntryChoice.NONE -> null
                BackEntryChoice.SAME_FACILITY -> ContextFixtures.authority(ContextFixtures.FACILITY)
                BackEntryChoice.OTHER_FACILITY -> ContextFixtures.authority(ContextFixtures.OTHER_FACILITY)
            }
        return ContextFixtures.context(
            actor = actor,
            facility = if (atFacility) ContextFixtures.FACILITY else null,
            onBehalfOf = onBehalfOfUser,
            device = deviceRef,
            clinicalTime = if (clinicalTime) clinical else null,
            capture = if (offline) ContextFixtures.offline() else CaptureChannel.Online,
            backEntry = authority,
        )
    }
}

/** The refusals of platform-kernel.md §7.1 and §7.3, written out independently of CommandContext. */
private val REFUSAL_RULES: List<Pair<CommandContextRefusal, (Shape) -> Boolean>> =
    listOf(
        ON_BEHALF_OF_NEEDS_USER_ACTOR to { it.onBehalfOf != OnBehalf.NONE && it.kind != ActorKind.USER },
        ON_BEHALF_OF_SELF to { it.onBehalfOf == OnBehalf.SELF && it.kind == ActorKind.USER },
        DEVICE_ACTOR_NEEDS_MATCHING_DEVICE to { it.kind == ActorKind.DEVICE && it.device != DeviceChoice.MATCHING },
        OFFLINE_CAPTURE_NEEDS_USER_ACTOR to { it.offline && it.kind != ActorKind.USER },
        OFFLINE_CAPTURE_NEEDS_CLINICAL_TIME to { it.offline && !it.clinicalTime },
        OFFLINE_CAPTURE_DEVICE_MISMATCH to { it.offline && it.device != DeviceChoice.MATCHING },
        BACK_ENTRY_NEEDS_USER_ACTOR to { it.hasBackEntry && it.kind != ActorKind.USER },
        BACK_ENTRY_WHILE_OFFLINE to { it.hasBackEntry && it.offline },
        BACK_ENTRY_FACILITY_MISMATCH to { it.backEntry == BackEntryChoice.OTHER_FACILITY || (it.hasBackEntry && !it.atFacility) },
    )

/** The platform-kernel.md §7.3 table: (actor kind, channel, back-entry authority present) to the mode. */
private val MODE_TABLE: Map<Triple<ActorKind, Channel, Boolean>, EntryMode> =
    mapOf(
        Triple(ActorKind.USER, Channel.ONLINE, false) to EntryMode.USER,
        Triple(ActorKind.USER, Channel.OFFLINE, false) to EntryMode.OFFLINE_CAPTURE,
        Triple(ActorKind.USER, Channel.ONLINE, true) to EntryMode.BACK_ENTRY,
        Triple(ActorKind.DEVICE, Channel.ONLINE, false) to EntryMode.DEVICE,
        Triple(ActorKind.INTERFACE, Channel.ONLINE, false) to EntryMode.INTERFACE,
        Triple(ActorKind.MIGRATION_LOADER, Channel.ONLINE, false) to EntryMode.MIGRATION,
        Triple(ActorKind.SYSTEM, Channel.ONLINE, false) to EntryMode.SYSTEM,
    )

private val ALL_SHAPES: List<Shape> =
    ActorKind.entries.flatMap { kind ->
        listOf(true, false).flatMap { atFacility ->
            OnBehalf.entries.flatMap { onBehalfOf ->
                DeviceChoice.entries.flatMap { device ->
                    listOf(true, false).flatMap { clinicalTime ->
                        Channel.entries.flatMap { channel ->
                            BackEntryChoice.entries.map { backEntry ->
                                Shape(kind, atFacility, onBehalfOf, device, clinicalTime, channel, backEntry)
                            }
                        }
                    }
                }
            }
        }
    }

private val SHAPE: Arb<Shape> =
    arbitrary {
        Shape(
            Arb.enum<ActorKind>().bind(),
            Arb.boolean().bind(),
            Arb.enum<OnBehalf>().bind(),
            Arb.enum<DeviceChoice>().bind(),
            Arb.boolean().bind(),
            Arb.enum<Channel>().bind(),
            Arb.enum<BackEntryChoice>().bind(),
        )
    }

private fun checkShape(
    shape: Shape,
    result: CommandContextResult,
) {
    val expected = REFUSAL_RULES.filter { (_, applies) -> applies(shape) }.map { it.first }.toSet()
    withClue(shape) {
        if (expected.isEmpty()) {
            val mode = MODE_TABLE[Triple(shape.kind, shape.channel, shape.hasBackEntry)]
            withClue("a combination outside the section 7.3 table must be refused") { (mode != null) shouldBe true }
            result.shouldBeInstanceOf<CommandContextResult.Valid>().context.entryMode shouldBe mode
        } else {
            result shouldBe CommandContextResult.Refused(expected)
        }
    }
}

private const val MIN_RECORDED_SECOND = 1_700_000_000L
private const val MAX_RECORDED_SECOND = 1_900_000_000L
private const val MAX_LAG_MINUTES = 6L * 24 * 60
private const val MAX_TOLERANCE_MINUTES = 2L * 24 * 60
private const val MAX_OFFSET_QUARTERS = 56
private const val MINUTES_PER_QUARTER = 15

private val VITAL_SIGN = TimingClass("vital-sign")

private fun syntheticPolicy(tolerances: List<Duration>): EntryTimePolicy {
    val parameters =
        EntryTimePolicy.keys(VITAL_SIGN).zip(tolerances) { key, value ->
            ResolvedParameter(key, value, ContentProvenance.SYNTHETIC, "test-$key", null)
        }
    val result = EntryTimePolicy.fromResolved(VITAL_SIGN, parameters[0], parameters[1], parameters[2], parameters[3], EnvironmentClass.TEST)
    return result.shouldBeInstanceOf<SafetyParameterResult.Built<EntryTimePolicy>>().parameter
}

/** One entry a USER actor might append. */
private data class UserEntry(
    val recorded: RecordedTime,
    val input: ValidTimeInput,
    val kind: ValidTimeKind,
    val policy: EntryTimePolicy,
    val episode: BackEntryEpisode?,
)

/** The timing codes a USER actor can only reach through an object it cannot build (platform-kernel.md §7.2, §7.3). */
private val PRIVILEGED_CODES =
    setOf(EntryTimingCode.LATE_ARRIVAL, EntryTimingCode.MIGRATED, EntryTimingCode.BACK_ENTRY, EntryTimingCode.OFFLINE_CAPTURE)

/** The entry mode is derived from the context, never asserted (platform-kernel.md §7.3; D10; HAZ-0010 CTRL-0010-4). */
class EntryModePropertyTest :
    FunSpec({
        test("kernel-entry-mode-derived-from-context: every combination gives the section 7.3 mode or exactly its refusals") {
            ALL_SHAPES.size shouldBe ActorKind.entries.size * 2 * 3 * 3 * 2 * 2 * 3
            ALL_SHAPES.forEach { shape -> checkShape(shape, shape.build()) }
        }

        test("kernel-entry-mode-derived-from-context: random contexts with random clinical times agree with the table") {
            val clinical =
                arbitrary {
                    val second = Arb.long(MIN_RECORDED_SECOND..MAX_RECORDED_SECOND).bind()
                    val quarters = Arb.int(-MAX_OFFSET_QUARTERS..MAX_OFFSET_QUARTERS).bind()
                    ClinicalTime.of(Instant.ofEpochSecond(second), ZoneOffset.ofTotalSeconds(quarters * MINUTES_PER_QUARTER * 60))
                }
            checkAll(PropertyTestBudget.sequences(), SHAPE, clinical) { shape, time ->
                checkShape(shape, shape.build(time))
            }
        }

        test("kernel-entry-mode-derived-from-context: a USER actor without the allowed objects never gets a privileged timing") {
            val context =
                ContextFixtures
                    .context()
                    .shouldBeInstanceOf<CommandContextResult.Valid>()
                    .context
            context.entryMode shouldBe EntryMode.USER
            val tolerance = Arb.long(0L..MAX_TOLERANCE_MINUTES)
            val entries =
                arbitrary {
                    val recordedAt = Instant.ofEpochSecond(Arb.long(MIN_RECORDED_SECOND..MAX_RECORDED_SECOND).bind())
                    val lag = Duration.ofMinutes(Arb.long(-MAX_LAG_MINUTES..MAX_LAG_MINUTES).bind())
                    val start = ClinicalTime.of(recordedAt.minus(lag), ZoneOffset.ofHours(3))
                    UserEntry(
                        recorded = RecordedTime.now(Clock.fixed(recordedAt, ZoneOffset.UTC)),
                        input = if (Arb.boolean().bind()) ValidTimeInput.AtRecording else ValidTimeInput.Given(ValidTime.from(start)),
                        kind = Arb.enum<ValidTimeKind>().bind(),
                        policy = syntheticPolicy(List(4) { Duration.ofMinutes(tolerance.bind()) }),
                        // Even an episode handed to the classifier cannot make a USER entry a back-entry.
                        episode =
                            if (Arb.boolean().bind()) {
                                BackEntryEpisode.fromRegistry(ContextFixtures.newId(), ValidPeriod.from(Instant.EPOCH))
                            } else {
                                null
                            },
                    )
                }
            checkAll(PropertyTestBudget.sequences(), entries) { entry ->
                val result =
                    EntryTimeClassifier.classify(
                        entry.input,
                        entry.kind,
                        entry.recorded,
                        context.entryMode,
                        EntryTimePolicyLookup.Available(entry.policy),
                        entry.episode,
                    )
                if (result is EntryTimingResult.Accepted) {
                    withClue(result) { PRIVILEGED_CODES shouldNotContain result.timing.code }
                }
            }
        }
    })
