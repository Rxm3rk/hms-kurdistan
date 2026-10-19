package hms.kernel.archrules

import hms.archfixtures.kernelpurity.compliant.kernel.journal.infrastructure.JournalAdapterUsesFrameworks
import hms.archfixtures.kernelpurity.compliant.kernel.time.PureKernelType
import hms.archfixtures.kernelpurity.violating.kernel.context.ContextDependsOnJakarta
import hms.archfixtures.kernelpurity.violating.kernel.ids.IdsDependOnSpring
import hms.archfixtures.kernelpurity.violating.kernel.journal.JournalModelDependsOnDebezium
import hms.archfixtures.kernelpurity.violating.kernel.journal.inmemory.InMemoryJournalDependsOnApicurio
import hms.archfixtures.kernelpurity.violating.kernel.money.MoneyDependsOnJooq
import hms.archfixtures.kernelpurity.violating.kernel.quantity.QuantityDependsOnCloudEvents
import hms.archfixtures.kernelpurity.violating.kernel.time.TimeDependsOnJackson
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.DynamicTest.dynamicTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory

/**
 * `ArchTest:kernel-libraries-framework-free` (platform-kernel.md §11; D7) and
 * `ArchTest:kernel-journal-framework-free-outside-infrastructure` (platform-journal.md §3).
 */
class KernelFrameworkFreeRuleTest {
    private val violatingRoot = "hms.archfixtures.kernelpurity.violating"
    private val compliantRoot = "hms.archfixtures.kernelpurity.compliant"

    @TestFactory
    fun `kernel-libraries-framework-free fails on a framework type anywhere in each kernel library`(): List<DynamicTest> =
        listOf(
            IdsDependOnSpring::class,
            TimeDependsOnJackson::class,
            ContextDependsOnJakarta::class,
            MoneyDependsOnJooq::class,
            QuantityDependsOnCloudEvents::class,
        ).map { fixture ->
            dynamicTest(fixture.java.simpleName) {
                assertRuleFails(KernelArchitectureRules.kernelLibrariesFrameworkFree(violatingRoot), importFixtures(fixture), fixture)
            }
        }

    @TestFactory
    fun `kernel-journal-framework-free-outside-infrastructure fails on the journal model and its in-memory adapter`(): List<DynamicTest> =
        listOf(JournalModelDependsOnDebezium::class, InMemoryJournalDependsOnApicurio::class).map { fixture ->
            dynamicTest(fixture.java.simpleName) {
                val rule = KernelArchitectureRules.kernelJournalFrameworkFreeOutsideInfrastructure(violatingRoot)
                assertRuleFails(rule, importFixtures(fixture), fixture)
            }
        }

    @Test
    fun `kernel-libraries-framework-free passes on pure kernel types and on the journal infrastructure adapter`() {
        val classes = importFixturePackage(compliantRoot)
        assertRulePasses(KernelArchitectureRules.kernelLibrariesFrameworkFree(compliantRoot), classes, PureKernelType::class)
        assertRulePasses(
            KernelArchitectureRules.kernelJournalFrameworkFreeOutsideInfrastructure(compliantRoot),
            classes,
            JournalAdapterUsesFrameworks::class,
        )
    }
}
