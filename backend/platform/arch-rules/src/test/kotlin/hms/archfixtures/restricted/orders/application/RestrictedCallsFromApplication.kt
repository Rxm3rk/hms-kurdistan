package hms.archfixtures.restricted.orders.application

import hms.archfixtures.restricted.kernel.context.ActorKindRestricted
import hms.archfixtures.restricted.kernel.context.ActorRef
import hms.archfixtures.restricted.kernel.context.BackEntryAuthority
import hms.archfixtures.restricted.kernel.context.BackEntryToolingOnly
import hms.archfixtures.restricted.kernel.context.CaptureChannel
import hms.archfixtures.restricted.kernel.context.DeviceRef
import hms.archfixtures.restricted.kernel.context.FacilityId
import hms.archfixtures.restricted.kernel.context.InterfaceChannelRef
import hms.archfixtures.restricted.kernel.context.MigrationRunRef
import hms.archfixtures.restricted.kernel.context.SystemProcess
import hms.archfixtures.restricted.kernel.context.UserId
import hms.archfixtures.restricted.kernel.quantity.DoseMagnitudeAccess
import hms.archfixtures.restricted.kernel.quantity.DoseQuantity
import hms.archfixtures.restricted.kernel.quantity.DoseRate
import hms.archfixtures.restricted.kernel.quantity.GovernedThreshold
import hms.archfixtures.restricted.kernel.quantity.Quantity
import hms.archfixtures.restricted.kernel.time.BackEntryEpisode
import hms.archfixtures.restricted.kernel.time.EntryTimePolicy
import hms.archfixtures.restricted.kernel.time.EnvironmentClass
import hms.archfixtures.restricted.kernel.time.EpisodeRegistryOnly
import hms.archfixtures.restricted.kernel.time.PersistenceOnly
import hms.archfixtures.restricted.kernel.time.RecordedTime
import hms.archfixtures.restricted.kernel.time.ResolvedValue
import hms.archfixtures.restricted.kernel.time.SafetyParameterFactory
import java.math.BigDecimal
import java.time.Instant
import java.util.UUID

// Application-layer callers of the restricted kernel functions. Each class calls through the companion, as Kotlin
// code does; the Java fixtures beside them call the @JvmStatic methods. Violating unless the KDoc says compliant.

class RestoresRecordedTime {
    @OptIn(PersistenceOnly::class)
    fun read(instant: Instant): RecordedTime = RecordedTime.restore(instant)
}

class RestoresByReference {
    @OptIn(PersistenceOnly::class)
    val restore: (Instant) -> RecordedTime = RecordedTime.Companion::restore
}

class BuildsEntryTimePolicy {
    @OptIn(SafetyParameterFactory::class)
    fun build(): EntryTimePolicy = EntryTimePolicy.fromResolved(ResolvedValue("platform.time.entry.x"), EnvironmentClass.TEST)
}

class BuildsGovernedThreshold {
    @OptIn(SafetyParameterFactory::class)
    fun build(): GovernedThreshold = GovernedThreshold.fromResolved(ResolvedValue("medications.factor"), EnvironmentClass.TEST)
}

class BuildsDeviceActor {
    @OptIn(ActorKindRestricted::class)
    fun actor(): ActorRef = ActorRef.device(DeviceRef(UUID(0, 1)))
}

class BuildsInterfaceActor {
    @OptIn(ActorKindRestricted::class)
    fun actor(): ActorRef = ActorRef.interfaceChannel(InterfaceChannelRef(UUID(0, 1)))
}

class BuildsMigrationActor {
    @OptIn(ActorKindRestricted::class)
    fun actor(): ActorRef = ActorRef.migrationLoader(MigrationRunRef(UUID(0, 1)))
}

class BuildsSystemActor {
    @OptIn(ActorKindRestricted::class)
    fun actor(): ActorRef = ActorRef.system(SystemProcess("orders.sweep"))
}

class BuildsUnlistedActor {
    @OptIn(ActorKindRestricted::class)
    fun actor(): ActorRef = ActorRef.unlisted(SystemProcess("orders.sweep"))
}

class BuildsOfflineCapture {
    @OptIn(ActorKindRestricted::class)
    fun channel(): CaptureChannel = CaptureChannel.OfflineQueued.of(DeviceRef(UUID(0, 1)))
}

class IssuesBackEntryAuthority {
    @OptIn(BackEntryToolingOnly::class)
    fun issue(episode: BackEntryEpisode): BackEntryAuthority = BackEntryAuthority.issue(episode, FacilityId(UUID(0, 1)))
}

class LoadsBackEntryEpisode {
    @OptIn(EpisodeRegistryOnly::class)
    fun load(): BackEntryEpisode = BackEntryEpisode.fromRegistry(UUID(0, 1), Instant.EPOCH)
}

class ReadsQuantityMagnitude {
    @OptIn(DoseMagnitudeAccess::class)
    fun read(quantity: Quantity): BigDecimal = quantity.magnitude()
}

class ReadsDoseMagnitude {
    @OptIn(DoseMagnitudeAccess::class)
    fun read(dose: DoseQuantity): BigDecimal = dose.magnitude()
}

class ReadsRateMagnitude {
    @OptIn(DoseMagnitudeAccess::class)
    fun read(rate: DoseRate): BigDecimal = rate.magnitude()
}

class BuildsQuantityFromMagnitude {
    @OptIn(DoseMagnitudeAccess::class)
    fun build(): Quantity = Quantity.ofMagnitude(BigDecimal.ONE, "mg")
}

/** Compliant: a user actor may be built anywhere in WP-0.3 (KA-KN7). */
class BuildsUserActor {
    fun actor(): ActorRef = ActorRef.user(UserId(UUID(0, 1)))
}

/** Compliant: holding and reading an authority issued elsewhere calls no restricted function. */
class UsesBackEntryAuthority {
    fun facility(authority: BackEntryAuthority): FacilityId = authority.facility
}

/** Compliant: an unrelated function that happens to share a restricted name. */
class CallsUnrelatedRestore {
    fun restore(instant: Instant): Instant = Archive.restore(instant)

    private object Archive {
        fun restore(instant: Instant): Instant = instant
    }
}
