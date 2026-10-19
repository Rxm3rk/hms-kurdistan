package hms.kernel.archrules

/**
 * The package allow-lists of the restricted kernel functions (platform-kernel.md §6.1, §6.5, §7.2, §10.1, §11).
 *
 * An entry is either a package relative to the root package (`platform.tasks.application.system` means
 * `hms.platform.tasks.application.system..`) or an ArchUnit pattern that starts with `..` and matches in
 * every module. Test sources are always allowed, because the rules run only on production classes
 * ([ProjectArchitecture]). An empty list means that no production package may call the function.
 *
 * Every change to a list is a revision of platform-kernel.md with safety code-owner review (§6.5, §7.2).
 * `KernelAllowListsTest` pins each list, so a change cannot slip in unnoticed.
 */
object KernelAllowLists {
    /** `@PersistenceOnly` (`RecordedTime.restore`): persistence mapping and the journal's adapters (§6.1, §11). */
    val PERSISTENCE_MAPPING: List<String> =
        listOf("..infrastructure.persistence..", "kernel.journal.infrastructure", "kernel.journal.inmemory")

    /** `@SafetyParameterFactory`: the tenancy resolver of `EntryTimePolicySource` and the platform-tasks resolver (§6.5). */
    val SAFETY_PARAMETER_RESOLVERS: List<String> =
        listOf("platform.tenancy.application.settings", "platform.tasks.infrastructure.config")

    /** `ActorRef.device`: none in WP-0.3 (§7.2). */
    val DEVICE_INBOUND: List<String> = emptyList()

    /** `ActorRef.interfaceChannel`: none in WP-0.3; the Hub joins later (§7.2). */
    val INTERFACE_INBOUND: List<String> = emptyList()

    /** `ActorRef.migrationLoader`: none in WP-0.3 (§7.2). */
    val MIGRATION_LOADER: List<String> = emptyList()

    /** `ActorRef.system`: the tasks alarm paths, the journal, the event library and the config reconciler (§7.2, D14). */
    val SYSTEM_PROCESSES: List<String> =
        listOf(
            "platform.tasks.application.system",
            "kernel.journal",
            "kernel.events",
            "platform.config.application.system",
        )

    /** `CaptureChannel.OfflineQueued.of`: none in WP-0.3 (§7.2). */
    val OFFLINE_SYNC_ENDPOINT: List<String> = emptyList()

    /** `BackEntryAuthority.issue`: none in WP-0.3; the `TRU-BCP-03` tooling joins when it is specified (§7.2). */
    val BACK_ENTRY_TOOLING: List<String> = emptyList()

    /** `BackEntryEpisode.fromRegistry`: none in WP-0.3; the `platform-site` episode registry joins later (§6.2). */
    val EPISODE_REGISTRY: List<String> = emptyList()

    /** `@DoseMagnitudeAccess`: `reg-dose`, the quantity library and persistence mapping (§6.8 #1, §10.1). */
    val DOSE_MAGNITUDE: List<String> = listOf("reg.dose", "kernel.quantity", "..infrastructure.persistence..")

    /** `app-hms`'s dev and test wiring package, exempt from the D8 rule; none until the app-hms specification names it. */
    val APP_HMS_DEV_WIRING: List<String> = emptyList()
}
