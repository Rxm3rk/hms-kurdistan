package hms.kernel.archrules

import hms.archfixtures.workflow.medications.application.StartsTemporalDirectly
import hms.archfixtures.workflow.platform.workflow.api.WorkflowPort
import hms.archfixtures.workflow.platform.workflow.domain.LeaksTemporalOptions
import hms.archfixtures.workflow.platform.workflow.infrastructure.TemporalWorkflowAdapter
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.DynamicTest.dynamicTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory

/** Rule (c): no Temporal type outside the platform-workflow adapter (ADR-010). */
class TemporalBoundaryRuleTest {
    private val rule = HmsArchitectureRules.temporalOnlyInWorkflowAdapter("hms.archfixtures.workflow")

    @TestFactory
    fun `fails on Temporal types outside the workflow adapter`(): List<DynamicTest> =
        listOf(StartsTemporalDirectly::class, LeaksTemporalOptions::class).map { fixture ->
            dynamicTest(fixture.java.simpleName) { assertRuleFails(rule, importFixtures(fixture), fixture) }
        }

    @Test
    fun `passes on the adapter behind WorkflowPort`() {
        val compliant = arrayOf(WorkflowPort::class, TemporalWorkflowAdapter::class)
        assertRulePasses(rule, importFixtures(*compliant), *compliant)
    }
}
