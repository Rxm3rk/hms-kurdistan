package hms.archfixtures.restricted.kernel.context

import hms.archfixtures.restricted.kernel.time.BackEntryEpisode
import java.util.UUID

// Fixtures that mirror the restricted functions of hms.kernel.context (platform-kernel.md §7.2). The reference
// types are value classes, as in the kernel, so Kotlin mangles the factory names and Java cannot call them.

@RequiresOptIn(level = RequiresOptIn.Level.ERROR)
@Retention(AnnotationRetention.RUNTIME)
@Target(AnnotationTarget.FUNCTION)
annotation class ActorKindRestricted

@RequiresOptIn(level = RequiresOptIn.Level.ERROR)
@Retention(AnnotationRetention.RUNTIME)
@Target(AnnotationTarget.FUNCTION)
annotation class BackEntryToolingOnly

@JvmInline
value class UserId(
    val id: UUID,
)

@JvmInline
value class DeviceRef(
    val id: UUID,
)

@JvmInline
value class InterfaceChannelRef(
    val id: UUID,
)

@JvmInline
value class MigrationRunRef(
    val id: UUID,
)

@JvmInline
value class SystemProcess(
    val name: String,
)

@JvmInline
value class FacilityId(
    val id: UUID,
)

/** Like the kernel's ActorRef, plus one annotated factory that no allow-list names. */
class ActorRef private constructor(
    val kind: String,
    val id: String,
) {
    companion object {
        @JvmStatic
        fun user(user: UserId): ActorRef = ActorRef("USER", user.id.toString())

        @ActorKindRestricted
        @JvmStatic
        fun device(device: DeviceRef): ActorRef = ActorRef("DEVICE", device.id.toString())

        @ActorKindRestricted
        @JvmStatic
        fun interfaceChannel(channel: InterfaceChannelRef): ActorRef = ActorRef("INTERFACE", channel.id.toString())

        @ActorKindRestricted
        @JvmStatic
        fun migrationLoader(run: MigrationRunRef): ActorRef = ActorRef("MIGRATION_LOADER", run.id.toString())

        @ActorKindRestricted
        @JvmStatic
        fun system(process: SystemProcess): ActorRef = ActorRef("SYSTEM", process.name)

        /** Not in any allow-list: every production call must fail (platform-kernel.md §16). */
        @ActorKindRestricted
        @JvmStatic
        fun unlisted(process: SystemProcess): ActorRef = ActorRef("UNLISTED", process.name)
    }
}

/** Like the kernel's CaptureChannel. */
sealed interface CaptureChannel {
    data object Online : CaptureChannel

    class OfflineQueued private constructor(
        val device: DeviceRef,
    ) : CaptureChannel {
        companion object {
            @ActorKindRestricted
            @JvmStatic
            fun of(device: DeviceRef): OfflineQueued = OfflineQueued(device)
        }
    }
}

/** Like the kernel's BackEntryAuthority. */
class BackEntryAuthority private constructor(
    val episode: BackEntryEpisode,
    val facility: FacilityId,
) {
    companion object {
        @BackEntryToolingOnly
        @JvmStatic
        fun issue(
            episode: BackEntryEpisode,
            facility: FacilityId,
        ): BackEntryAuthority = BackEntryAuthority(episode, facility)
    }
}
