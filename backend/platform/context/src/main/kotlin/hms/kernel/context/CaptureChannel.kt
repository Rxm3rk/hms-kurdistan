package hms.kernel.context

import hms.kernel.ids.FacilityId
import hms.kernel.ids.UuidV7
import hms.kernel.time.BackEntryEpisode
import java.util.UUID

/** How the command reached the server (platform-kernel.md §7.1, §7.6): online, or queued offline on a device and synchronised later. */
sealed interface CaptureChannel {
    /** Sent while the client was online. */
    data object Online : CaptureChannel

    /** Captured offline on [device] and synchronised later; selects `OFFLINE_CAPTURE` (platform-kernel.md §7.3). */
    class OfflineQueued private constructor(
        val device: DeviceRef,
    ) : CaptureChannel {
        init {
            require(UuidV7.isV7(device.id)) { "OfflineQueued device id must be a UUIDv7" }
        }

        override fun equals(other: Any?): Boolean = other is OfflineQueued && device == other.device

        override fun hashCode(): Int = device.hashCode()

        override fun toString(): String = "OfflineQueued(${device.id})"

        companion object {
            /**
             * Only the offline sync endpoint, from the authenticated device session (platform-kernel.md §7.2).
             * Allow-list `OFFLINE_SYNC_ENDPOINT`: test sources only in WP-0.3.
             */
            @ActorKindRestricted
            @JvmStatic
            @JvmName("of")
            fun of(device: DeviceRef): OfflineQueued = OfflineQueued(device)
        }
    }
}

/**
 * Issued by the back-entry tooling after its permission check and a server-side episode lookup (TRU-BCP-03;
 * platform-kernel.md §7.2). Selects `BACK_ENTRY` (§7.3); its facility must equal the context's facility.
 * [permissionDecision] is the id of the permission decision the tooling obtained.
 */
class BackEntryAuthority private constructor(
    val episode: BackEntryEpisode,
    val facility: FacilityId,
    val permissionDecision: UUID,
) {
    init {
        require(UuidV7.isV7(facility.value)) { "BackEntryAuthority facility must be a UUIDv7" }
    }

    override fun equals(other: Any?): Boolean =
        other is BackEntryAuthority &&
            episode == other.episode &&
            facility == other.facility &&
            permissionDecision == other.permissionDecision

    override fun hashCode(): Int = listOf(episode, facility, permissionDecision).hashCode()

    override fun toString(): String =
        "BackEntryAuthority(episode=${episode.episodeId}, facility=${facility.value}, decision=$permissionDecision)"

    companion object {
        /** Allow-list `BACK_ENTRY_TOOLING`: test sources only in WP-0.3 (`ArchTest:back-entry-authority-only-from-back-entry-tooling`). */
        @BackEntryToolingOnly
        @JvmStatic
        @JvmName("issue")
        fun issue(
            episode: BackEntryEpisode,
            facility: FacilityId,
            permissionDecision: UUID,
        ): BackEntryAuthority = BackEntryAuthority(episode, facility, permissionDecision)
    }
}
