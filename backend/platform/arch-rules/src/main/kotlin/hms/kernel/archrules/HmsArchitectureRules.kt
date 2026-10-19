package hms.kernel.archrules

import com.tngtech.archunit.base.DescribedPredicate
import com.tngtech.archunit.core.domain.JavaClass
import com.tngtech.archunit.core.domain.PackageMatcher
import com.tngtech.archunit.lang.ArchCondition
import com.tngtech.archunit.lang.ArchRule
import com.tngtech.archunit.lang.ConditionEvents
import com.tngtech.archunit.lang.SimpleConditionEvent
import com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes
import com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses

/**
 * The architecture fitness functions that can be expressed before any application module exists
 * (BUILD-PROMPT §6.8 #3, the §5.2 dependency rules, §6.2, ADR-010), rule (e) of D7 (platform-workflow.md §10)
 * and, through [all], the kernel rules of platform-kernel.md §11 ([KernelArchitectureRules]).
 *
 * Every rule takes the root package so that tests can aim it at fixture packages. Rules allow an empty
 * subject set, because they run against every backend project, including projects that have no domain
 * package yet. The fixture tests prove that each rule fails on a violation.
 */
object HmsArchitectureRules {
    /** The Java base package of the product (§6.1). */
    const val ROOT_PACKAGE: String = "hms"

    /** Framework packages that domain code never depends on (§6.1: domain is pure Kotlin). */
    val FRAMEWORK_PACKAGES: List<String> =
        listOf(
            "org.springframework..",
            "jakarta..",
            "javax..",
            "org.jooq..",
            "com.fasterxml.jackson..",
            "tools.jackson..",
            "io.temporal..",
            "org.apache.kafka..",
            "io.cloudevents..",
            "io.debezium..",
            "io.apicurio..",
        )

    /** The Safety Kernel modules that rule (e) keeps independent of the workflow engine (platform-workflow.md §10; D7). */
    val SAFETY_KERNEL_MODULES: List<String> = listOf("orders", "medications", "results", "platform.tasks")

    internal val resideInAFrameworkPackage: DescribedPredicate<JavaClass> =
        DescribedPredicate.describe("reside in a framework package $FRAMEWORK_PACKAGES") { type ->
            FRAMEWORK_PACKAGES.any { PackageMatcher.of(it).matches(type.packageName) }
        }

    /**
     * (a) Classes in `..domain..` packages depend on no framework type (§6.1, §6.8 #3). D7 widens the list with
     * CloudEvents, Debezium and Apicurio.
     */
    fun domainIsFrameworkFree(root: String = ROOT_PACKAGE): ArchRule =
        noClasses()
            .that()
            .resideInAPackage("$root..domain..")
            .should()
            .dependOnClassesThat(resideInAFrameworkPackage)
            .because("domain packages hold pure Kotlin aggregates, state machines and invariants (BUILD-PROMPT §6.1, §6.8 #3)")
            .allowEmptyShould(true)

    /**
     * (b) A class in module `<root>.<a>` uses another module `<root>.<b>` only through `<root>.<b>.api`.
     * The shared kernel `<root>.kernel` is always allowed (§5.2, §6.1).
     */
    fun modulesUseOtherModulesOnlyThroughApi(root: String = ROOT_PACKAGE): ArchRule =
        classes()
            .that()
            .resideInAPackage("$root..")
            .should(OnlyOtherModulesApi(ModuleLayout(root)))
            .because("a module imports only another module's api package (BUILD-PROMPT §5.2, §6.1)")
            .allowEmptyShould(true)

    /** (c) No Temporal type outside the platform-workflow adapter (ADR-010: Temporal only behind WorkflowPort). */
    fun temporalOnlyInWorkflowAdapter(root: String = ROOT_PACKAGE): ArchRule =
        noClasses()
            .that()
            .resideInAPackage("$root..")
            .and()
            .resideOutsideOfPackage("$root.platform.workflow.infrastructure..")
            .should()
            .dependOnClassesThat()
            .resideInAPackage("io.temporal..")
            .because("Temporal is used only behind WorkflowPort, in the platform-workflow adapter (ADR-010)")
            .allowEmptyShould(true)

    /**
     * (d) `ArchTest:no-now-in-domain`: domain code never reads the system clock; it is given a `java.time.Clock`
     * (§6.2). platform-kernel.md §11 extends the rule to the kernel libraries and to the journal's pure model
     * (`<root>.kernel.journal..` outside its infrastructure package; CTRL-0010-3).
     */
    fun domainDoesNotReadTheSystemClock(root: String = ROOT_PACKAGE): ArchRule =
        noClasses()
            .that(
                DescribedPredicate.describe<JavaClass>(
                    "reside in $root..domain.., a kernel library or the journal's pure model",
                ) { type ->
                    KernelPackages.matchesAny(type.packageName, listOf("$root..domain..") + KernelPackages.libraries(root)) ||
                        KernelPackages.isJournalModel(type.packageName, root)
                },
            ).should()
            .callCodeUnitWhere(SystemClockAccess.calls)
            .orShould()
            .dependOnClassesThat(SystemClockAccess.timeSources)
            .because("domain code takes an injected Clock and never calls now() itself (BUILD-PROMPT §6.2)")
            .allowEmptyShould(true)

    /**
     * (e) `ArchTest:safety-kernel-never-uses-workflow`: `orders`, `medications`, `results` and `platform-tasks` never
     * depend on `platform-workflow`, so the Safety Kernel's state and timers never wait on an engine that can be
     * absent (platform-workflow.md §10; D7; SI-03).
     */
    fun safetyKernelNeverUsesWorkflow(root: String = ROOT_PACKAGE): ArchRule =
        noClasses()
            .that(KernelPackages.resideInAny(SAFETY_KERNEL_MODULES.map { "$root.$it.." }))
            .should()
            .dependOnClassesThat()
            .resideInAPackage("$root.platform.workflow..")
            .because("the Safety Kernel never depends on the workflow engine (platform-workflow.md §10, ADR-010, SI-03)")
            .allowEmptyShould(true)

    /** Every rule above, in the order (a) to (e), then the kernel rules of platform-kernel.md §11. */
    fun all(root: String = ROOT_PACKAGE): List<ArchRule> =
        listOf(
            domainIsFrameworkFree(root),
            modulesUseOtherModulesOnlyThroughApi(root),
            temporalOnlyInWorkflowAdapter(root),
            domainDoesNotReadTheSystemClock(root),
            safetyKernelNeverUsesWorkflow(root),
        ) + KernelArchitectureRules.all(root)

    private class OnlyOtherModulesApi(
        private val layout: ModuleLayout,
    ) : ArchCondition<JavaClass>("use other modules only through their api package") {
        override fun check(
            item: JavaClass,
            events: ConditionEvents,
        ) {
            val sourceModule = layout.moduleOf(item.packageName) ?: return
            for (dependency in item.directDependenciesFromSelf) {
                val targetPackage = dependency.targetClass.baseComponentType.packageName
                val targetModule = layout.moduleOf(targetPackage)
                val crossesBoundary =
                    targetModule != null &&
                        targetModule != sourceModule &&
                        layout.layerOf(targetPackage) != ModuleLayout.API
                if (crossesBoundary) {
                    val message =
                        "${dependency.description} uses module '$targetModule' outside its api package " +
                            "(from module '$sourceModule')"
                    events.add(SimpleConditionEvent.violated(dependency, message))
                }
            }
        }
    }
}
