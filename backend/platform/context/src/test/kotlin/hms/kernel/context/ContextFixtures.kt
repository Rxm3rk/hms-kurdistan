// Fixture values are test data; the context builder mirrors CommandContext.of, so it takes as many parameters.
@file:Suppress("MagicNumber", "LongParameterList")
@file:OptIn(ActorKindRestricted::class, BackEntryToolingOnly::class, EpisodeRegistryOnly::class)

package hms.kernel.context

import hms.kernel.ids.FacilityId
import hms.kernel.ids.TenantId
import hms.kernel.ids.UserId
import hms.kernel.ids.UuidV7Generator
import hms.kernel.time.BackEntryEpisode
import hms.kernel.time.ClinicalTime
import hms.kernel.time.EpisodeRegistryOnly
import hms.kernel.time.ValidPeriod
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.SplittableRandom
import java.util.UUID

/** Synthetic values for hms.kernel.context tests (§19.4); ids come from a seeded generator on a fixed clock. */
internal object ContextFixtures {
    private val ids = UuidV7Generator(Clock.fixed(Instant.parse("2026-03-01T08:00:00Z"), ZoneOffset.UTC), SplittableRandom(20_261_019L))

    fun newId(): UUID = ids.newId()

    val TENANT: TenantId = TenantId(newId())
    val FACILITY: FacilityId = FacilityId(newId())
    val OTHER_FACILITY: FacilityId = FacilityId(newId())
    val USER: UserId = UserId(newId())
    val OTHER_USER: UserId = UserId(newId())
    val DEVICE: DeviceRef = DeviceRef(newId())
    val OTHER_DEVICE: DeviceRef = DeviceRef(newId())
    val INTERFACE_CHANNEL: InterfaceChannelRef = InterfaceChannelRef(newId())
    val MIGRATION_RUN: MigrationRunRef = MigrationRunRef(newId())
    val ORPHAN_SCAN: SystemProcess = SystemProcess("platform-tasks.orphan-scan")
    val PURPOSE: PurposeOfUse = PurposeOfUse("synthetic-treatment")
    val KEY: IdempotencyKey = IdempotencyKey("synthetic-key-0001")
    val CORRELATION: CorrelationId = CorrelationId(newId())
    val CLINICAL_TIME: ClinicalTime = ClinicalTime.of(Instant.parse("2026-03-01T07:30:00Z"), ZoneOffset.ofHours(3))

    /** One actor of each kind; the DEVICE actor is [DEVICE]. */
    fun actor(kind: ActorKind): ActorRef =
        when (kind) {
            ActorKind.USER -> ActorRef.user(USER)
            ActorKind.DEVICE -> ActorRef.device(DEVICE)
            ActorKind.INTERFACE -> ActorRef.interfaceChannel(INTERFACE_CHANNEL)
            ActorKind.MIGRATION_LOADER -> ActorRef.migrationLoader(MIGRATION_RUN)
            ActorKind.SYSTEM -> ActorRef.system(ORPHAN_SCAN)
        }

    fun episode(): BackEntryEpisode = BackEntryEpisode.fromRegistry(newId(), ValidPeriod.from(Instant.parse("2026-02-28T00:00:00Z")))

    fun authority(facility: FacilityId = FACILITY): BackEntryAuthority = BackEntryAuthority.issue(episode(), facility, newId())

    fun offline(device: DeviceRef = DEVICE): CaptureChannel = CaptureChannel.OfflineQueued.of(device)

    /** A USER actor, online, at [FACILITY], unless told otherwise. */
    fun context(
        actor: ActorRef = actor(ActorKind.USER),
        facility: FacilityId? = FACILITY,
        onBehalfOf: UserId? = null,
        device: DeviceRef? = null,
        clinicalTime: ClinicalTime? = null,
        capture: CaptureChannel = CaptureChannel.Online,
        backEntry: BackEntryAuthority? = null,
    ): CommandContextResult =
        CommandContext.of(TENANT, facility, actor, onBehalfOf, device, PURPOSE, clinicalTime, capture, backEntry, KEY, CORRELATION, null)
}
