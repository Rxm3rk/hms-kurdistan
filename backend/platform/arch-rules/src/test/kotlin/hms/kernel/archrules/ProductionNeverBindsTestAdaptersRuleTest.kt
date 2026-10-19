package hms.kernel.archrules

import hms.archfixtures.testadapters.app.devwiring.DevWiring
import hms.archfixtures.testadapters.app.wiring.ProductionWiringUsesTestClock
import hms.archfixtures.testadapters.kernel.testing.FixtureTestClock
import hms.archfixtures.testadapters.orders.application.BindsInMemoryStore
import hms.archfixtures.testadapters.orders.application.BindsProductionStore
import hms.archfixtures.testadapters.orders.application.UsesTaskTestSupport
import hms.archfixtures.testadapters.orders.infrastructure.inmemory.InMemoryOrderStore
import hms.archfixtures.testadapters.orders.infrastructure.persistence.JooqOrderStore
import hms.archfixtures.testadapters.platform.tasks.testing.TaskTestSupport
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.DynamicTest.dynamicTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory

/** `ArchTest:production-never-binds-test-adapters` (platform-kernel.md §4, §8, §11; D8; SI-03). */
class ProductionNeverBindsTestAdaptersRuleTest {
    private val root = "hms.archfixtures.testadapters"
    private val classes = importFixturePackage(root)

    @TestFactory
    fun `production-never-binds-test-adapters fails on production code binding test clocks or adapters`(): List<DynamicTest> {
        val details = violationDetails(KernelArchitectureRules.productionNeverBindsTestAdapters(root, emptyList()), classes)
        return listOf(
            ProductionWiringUsesTestClock::class,
            BindsInMemoryStore::class,
            UsesTaskTestSupport::class,
            DevWiring::class,
        ).map { fixture -> dynamicTest(fixture.java.simpleName) { assertViolationBy(details, fixture) } }
    }

    @Test
    fun `production-never-binds-test-adapters passes on test and in-memory packages themselves and on production adapters`() {
        val details = violationDetails(KernelArchitectureRules.productionNeverBindsTestAdapters(root, emptyList()), classes)
        listOf(
            FixtureTestClock::class,
            InMemoryOrderStore::class,
            TaskTestSupport::class,
            JooqOrderStore::class,
            BindsProductionStore::class,
        ).forEach { fixture ->
            assertTrue(classes.contain(fixture.java), "fixture ${fixture.qualifiedName} was not imported")
            assertNoViolationBy(details, fixture)
        }
    }

    @Test
    fun `production-never-binds-test-adapters exempts only the dev wiring package it is given`() {
        val rule = KernelArchitectureRules.productionNeverBindsTestAdapters(root, listOf("$root.app.devwiring.."))
        val details = violationDetails(rule, classes)
        assertNoViolationBy(details, DevWiring::class)
        assertViolationBy(details, ProductionWiringUsesTestClock::class)
    }
}
