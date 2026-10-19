package hms.kernel.context

import hms.kernel.ids.UserId
import hms.kernel.ids.UuidV7
import java.util.UUID

/** Who acts (platform-kernel.md §7.2). There is no AI kind: an AI draft is accepted by a USER. */
enum class ActorKind { USER, DEVICE, INTERFACE, MIGRATION_LOADER, SYSTEM }

/**
 * The actor of a command, with its kind (platform-kernel.md §7.2, §7.6). [id] is the user, device, interface
 * channel or migration run id (a UUIDv7); for SYSTEM it is a name-based UUID of [systemProcess], the same for
 * the same process name on every node. Only [user] is open to any caller; the other factories are
 * [ActorKindRestricted] and allowed only from their allow-lists (`ArchTest:actor-kinds-only-from-allowed-packages`).
 *
 * The factories carry `@JvmName` so that Java can call them under their own names; the `init` block checks
 * every invariant again, so a raw value passed from Java or by reflection cannot make an invalid actor.
 */
class ActorRef private constructor(
    val kind: ActorKind,
    val id: UUID,
    val systemProcess: SystemProcess?,
) {
    init {
        if (kind == ActorKind.SYSTEM) {
            val name = requireNotNull(systemProcess) { "a SYSTEM actor needs its SystemProcess" }.name
            require(SystemProcess.isValid(name)) { "SystemProcess name must match [a-z][a-z0-9.-]*, got '$name'" }
            require(id == systemIdOf(name)) { "a SYSTEM actor's id is the name-based UUID of its process" }
        } else {
            require(systemProcess == null) { "only a SYSTEM actor has a SystemProcess" }
            require(UuidV7.isV7(id)) { "a $kind actor's id must be a UUIDv7" }
        }
    }

    override fun equals(other: Any?): Boolean =
        other is ActorRef && kind == other.kind && id == other.id && systemProcess == other.systemProcess

    override fun hashCode(): Int = 31 * kind.hashCode() + id.hashCode()

    override fun toString(): String = if (systemProcess == null) "ActorRef($kind, $id)" else "ActorRef($kind, ${systemProcess.name})"

    companion object {
        private const val SYSTEM_ID_NAMESPACE = "hms.kernel.context.SystemProcess:"

        /** A person's HMS account. Open to any caller in WP-0.3; WP-0.4 binds it to the authenticated principal (KA-KN7). */
        @JvmStatic
        @JvmName("user")
        fun user(user: UserId): ActorRef = ActorRef(ActorKind.USER, user.value, null)

        /** A registered device. Allow-list `DEVICE_INBOUND`: test sources only in WP-0.3. */
        @ActorKindRestricted
        @JvmStatic
        @JvmName("device")
        fun device(device: DeviceRef): ActorRef = ActorRef(ActorKind.DEVICE, device.id, null)

        /** A registered interface channel. Allow-list `INTERFACE_INBOUND`: test sources only in WP-0.3. */
        @ActorKindRestricted
        @JvmStatic
        @JvmName("interfaceChannel")
        fun interfaceChannel(channel: InterfaceChannelRef): ActorRef = ActorRef(ActorKind.INTERFACE, channel.id, null)

        /** The migration loader identity (§8.3). Allow-list `MIGRATION_LOADER`: test sources only in WP-0.3. */
        @ActorKindRestricted
        @JvmStatic
        @JvmName("migrationLoader")
        fun migrationLoader(run: MigrationRunRef): ActorRef = ActorRef(ActorKind.MIGRATION_LOADER, run.id, null)

        /** A named platform process. Allow-list `SYSTEM_PROCESSES` (platform-kernel.md §7.2) and test sources. */
        @ActorKindRestricted
        @JvmStatic
        @JvmName("system")
        fun system(process: SystemProcess): ActorRef = ActorRef(ActorKind.SYSTEM, systemIdOf(process.name), process)

        private fun systemIdOf(name: String): UUID = UUID.nameUUIDFromBytes((SYSTEM_ID_NAMESPACE + name).toByteArray(Charsets.UTF_8))
    }
}
