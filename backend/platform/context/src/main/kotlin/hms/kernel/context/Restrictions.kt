package hms.kernel.context

/**
 * Kotlin opt-in marker for the factories that select a non-user actor kind or offline capture
 * (`ActorRef.device`, `interfaceChannel`, `migrationLoader`, `system`, `CaptureChannel.OfflineQueued.of`).
 * The binding check is `ArchTest:actor-kinds-only-from-allowed-packages` (platform-kernel.md §7.2, §11).
 */
@RequiresOptIn(level = RequiresOptIn.Level.ERROR, message = "Allow-listed packages only (platform-kernel.md §7.2, §11).")
@Retention(AnnotationRetention.RUNTIME)
@Target(AnnotationTarget.FUNCTION)
annotation class ActorKindRestricted

/**
 * Kotlin opt-in marker for `BackEntryAuthority.issue`. The binding check is
 * `ArchTest:back-entry-authority-only-from-back-entry-tooling` (platform-kernel.md §7.2, §11).
 */
@RequiresOptIn(level = RequiresOptIn.Level.ERROR, message = "Back-entry tooling only (platform-kernel.md §7.2, §11).")
@Retention(AnnotationRetention.RUNTIME)
@Target(AnnotationTarget.FUNCTION)
annotation class BackEntryToolingOnly
