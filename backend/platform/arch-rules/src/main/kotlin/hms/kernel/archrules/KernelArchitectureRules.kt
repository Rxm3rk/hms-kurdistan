package hms.kernel.archrules

import com.tngtech.archunit.base.DescribedPredicate
import com.tngtech.archunit.core.domain.JavaClass
import com.tngtech.archunit.lang.ArchRule
import com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes
import com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses

/**
 * The kernel architecture rules of platform-kernel.md §11 (D7, D8, D10, D11; BUILD-PROMPT §6.8 #1).
 *
 * The rules match the kernel's opt-in annotations and types by fully qualified name, so arch-rules does not
 * depend on the kernel projects. Every rule takes the root package so that tests can aim it at fixture
 * packages, and allows an empty subject set. They run only on production classes ([ProjectArchitecture]), so
 * "and test sources" in §11 needs no allow-list entry. [HmsArchitectureRules.all] includes [all], so every
 * backend project applies them: a restricted function is protected wherever it is called. The extension of
 * rule (d) to the kernel libraries (`ArchTest:no-now-in-domain`) lives in
 * [HmsArchitectureRules.domainDoesNotReadTheSystemClock].
 */
object KernelArchitectureRules {
    /** `ArchTest:dose-and-quantity-operations-only-in-reg-dose` (§6.8 #1; CTRL-0005-5). */
    fun doseAndQuantityOperationsOnlyInRegDose(root: String = HmsArchitectureRules.ROOT_PACKAGE): ArchRule {
        val quantity = "$root.kernel.quantity"
        val members =
            setOf(
                "$quantity.Quantity#magnitude",
                "$quantity.Quantity#ofMagnitude",
                "$quantity.DoseQuantity#magnitude",
                "$quantity.DoseRate#magnitude",
            )
        return restrictedCallRule(
            root,
            CallOnlyFromAllowList("@DoseMagnitudeAccess", RestrictedFunctions("$quantity.DoseMagnitudeAccess", members)) {
                KernelPackages.resolve(root, KernelAllowLists.DOSE_MAGNITUDE)
            },
            "no dose arithmetic outside reg-dose: a magnitude leaves a quantity only there and in persistence mapping (§6.8 #1)",
        )
    }

    /** `ArchTest:no-system-default-zone-or-locale`: in `..domain..` and in the kernel libraries (§3, §11; §4.1; §8.1 P10). */
    fun noSystemDefaultZoneOrLocale(root: String = HmsArchitectureRules.ROOT_PACKAGE): ArchRule {
        val subjects = listOf("$root..domain..") + KernelPackages.libraries(root)
        return classes()
            .that(KernelPackages.resideInAny(subjects))
            .should(DefaultZoneOrLocaleAccess.condition)
            .because("the zone and the locale always come from configuration, never from the JVM defaults (BUILD-PROMPT §4.1, §8.1 P10)")
            .allowEmptyShould(true)
    }

    /** `ArchTest:persistence-only-factories`: `@PersistenceOnly` (`RecordedTime.restore`) only in persistence mapping (SI-10; D7). */
    fun persistenceOnlyFactories(root: String = HmsArchitectureRules.ROOT_PACKAGE): ArchRule {
        val functions = RestrictedFunctions("$root.kernel.time.PersistenceOnly", setOf("$root.kernel.time.RecordedTime#restore"))
        return restrictedCallRule(
            root,
            CallOnlyFromAllowList("@PersistenceOnly", functions) { KernelPackages.resolve(root, KernelAllowLists.PERSISTENCE_MAPPING) },
            "a recorded time comes only from the injected Clock, except when persistence mapping rebuilds a stored value (SI-10)",
        )
    }

    /** `ArchTest:safety-parameter-factories-only-in-resolvers` (§6.5; D11; CTRL-0010-1, CTRL-0005-1). */
    fun safetyParameterFactoriesOnlyInResolvers(root: String = HmsArchitectureRules.ROOT_PACKAGE): ArchRule {
        val functions =
            RestrictedFunctions(
                "$root.kernel.time.SafetyParameterFactory",
                setOf("$root.kernel.time.EntryTimePolicy#fromResolved", "$root.kernel.quantity.GovernedThreshold#fromResolved"),
            )
        return restrictedCallRule(
            root,
            CallOnlyFromAllowList("@SafetyParameterFactory", functions) {
                KernelPackages.resolve(root, KernelAllowLists.SAFETY_PARAMETER_RESOLVERS)
            },
            "a safety parameter is built only from resolved, governed configuration (D11)",
        )
    }

    /** `ArchTest:actor-kinds-only-from-allowed-packages`: the non-user actor kinds and offline capture (§7.2; D10; CTRL-0010-4). */
    fun actorKindsOnlyFromAllowedPackages(root: String = HmsArchitectureRules.ROOT_PACKAGE): ArchRule {
        val context = "$root.kernel.context"
        val allowLists =
            mapOf(
                "$context.ActorRef#device" to KernelAllowLists.DEVICE_INBOUND,
                "$context.ActorRef#interfaceChannel" to KernelAllowLists.INTERFACE_INBOUND,
                "$context.ActorRef#migrationLoader" to KernelAllowLists.MIGRATION_LOADER,
                "$context.ActorRef#system" to KernelAllowLists.SYSTEM_PROCESSES,
                "$context.CaptureChannel\$OfflineQueued#of" to KernelAllowLists.OFFLINE_SYNC_ENDPOINT,
            ).mapValues { (_, entries) -> KernelPackages.resolve(root, entries) }
        val functions = RestrictedFunctions("$context.ActorKindRestricted", allowLists.keys)
        // An annotated function that is not in the map has no allow-list, so every production call fails (§16).
        val condition =
            CallOnlyFromAllowList("@ActorKindRestricted", functions) { target ->
                allowLists[RestrictedFunctions.memberKey(target)].orEmpty()
            }
        return restrictedCallRule(
            root,
            condition,
            "privileged entry modes are selected only by allow-listed packages, none of them WP-0.3 production code (D10)",
        )
    }

    /** `ArchTest:back-entry-authority-only-from-back-entry-tooling`: `@BackEntryToolingOnly` and `@EpisodeRegistryOnly` (§7.2; D10). */
    fun backEntryAuthorityOnlyFromBackEntryTooling(root: String = HmsArchitectureRules.ROOT_PACKAGE): ArchRule {
        val tooling =
            RestrictedFunctions("$root.kernel.context.BackEntryToolingOnly", setOf("$root.kernel.context.BackEntryAuthority#issue"))
        val registry =
            RestrictedFunctions("$root.kernel.time.EpisodeRegistryOnly", setOf("$root.kernel.time.BackEntryEpisode#fromRegistry"))
        val toolingPackages = KernelPackages.resolve(root, KernelAllowLists.BACK_ENTRY_TOOLING)
        val registryPackages = KernelPackages.resolve(root, KernelAllowLists.EPISODE_REGISTRY)
        return classes()
            .that()
            .resideInAPackage("$root..")
            .should(CallOnlyFromAllowList("@BackEntryToolingOnly", tooling) { toolingPackages })
            .andShould(CallOnlyFromAllowList("@EpisodeRegistryOnly", registry) { registryPackages })
            .because("back-entry is selected only by the back-entry tooling and the episode registry, none of them in WP-0.3 (D10)")
            .allowEmptyShould(true)
    }

    /**
     * `ArchTest:production-never-binds-test-adapters` (D8; SI-03): no main class outside `..testing..` and `..inmemory..`
     * depends on `hms.kernel.testing..` or on any `..testing..` or `..inmemory..` package, except [devWiringPackages]
     * (`app-hms`'s dev and test wiring package, as ArchUnit patterns; none until the app-hms specification names it).
     */
    fun productionNeverBindsTestAdapters(
        root: String = HmsArchitectureRules.ROOT_PACKAGE,
        devWiringPackages: List<String> = KernelPackages.resolve(HmsArchitectureRules.ROOT_PACKAGE, KernelAllowLists.APP_HMS_DEV_WIRING),
    ): ArchRule {
        val testAdapters = listOf("$root.kernel.testing..", "..testing..", "..inmemory..")
        val exempt = KernelPackages.resideInAny(listOf("..testing..", "..inmemory..") + devWiringPackages)
        return noClasses()
            .that()
            .resideInAPackage("$root..")
            .and(DescribedPredicate.not(exempt))
            .should()
            .dependOnClassesThat(KernelPackages.resideInAny(testAdapters))
            .because("production wiring never binds a test clock or an in-memory adapter (D8; SI-03)")
            .allowEmptyShould(true)
    }

    /** `ArchTest:kernel-libraries-framework-free`: the widened framework list applies to the whole of every kernel library (§6.1; D7). */
    fun kernelLibrariesFrameworkFree(root: String = HmsArchitectureRules.ROOT_PACKAGE): ArchRule =
        noClasses()
            .that(KernelPackages.resideInAny(KernelPackages.libraries(root)))
            .should()
            .dependOnClassesThat(HmsArchitectureRules.resideInAFrameworkPackage)
            .because("kernel libraries depend only on the JDK, the Kotlin standard library and each other (platform-kernel.md §1)")
            .allowEmptyShould(true)

    /** `ArchTest:kernel-journal-framework-free-outside-infrastructure` (platform-journal.md §3; D7). */
    fun kernelJournalFrameworkFreeOutsideInfrastructure(root: String = HmsArchitectureRules.ROOT_PACKAGE): ArchRule =
        noClasses()
            .that(
                DescribedPredicate.describe<JavaClass>("reside in $root.kernel.journal.. outside its infrastructure package") { type ->
                    KernelPackages.isJournalModel(type.packageName, root)
                },
            ).should()
            .dependOnClassesThat(HmsArchitectureRules.resideInAFrameworkPackage)
            .because("only the journal's infrastructure adapter touches jOOQ, CloudEvents, Debezium or Apicurio (platform-journal.md §3)")
            .allowEmptyShould(true)

    /** Every rule above. */
    fun all(root: String = HmsArchitectureRules.ROOT_PACKAGE): List<ArchRule> =
        listOf(
            doseAndQuantityOperationsOnlyInRegDose(root),
            noSystemDefaultZoneOrLocale(root),
            persistenceOnlyFactories(root),
            safetyParameterFactoriesOnlyInResolvers(root),
            actorKindsOnlyFromAllowedPackages(root),
            backEntryAuthorityOnlyFromBackEntryTooling(root),
            productionNeverBindsTestAdapters(root),
            kernelLibrariesFrameworkFree(root),
            kernelJournalFrameworkFreeOutsideInfrastructure(root),
        )
}
