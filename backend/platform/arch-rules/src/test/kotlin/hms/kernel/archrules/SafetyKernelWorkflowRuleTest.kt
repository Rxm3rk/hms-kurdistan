package hms.kernel.archrules

import hms.archfixtures.safetykernel.adt.application.AdtStartsWorkflow
import hms.archfixtures.safetykernel.medications.application.MedicationsUseWorkflow
import hms.archfixtures.safetykernel.orders.application.OrdersStartWorkflow
import hms.archfixtures.safetykernel.platform.tasks.application.TasksRunOwnTimers
import hms.archfixtures.safetykernel.platform.tasks.domain.TaskWaitsOnWorkflow
import hms.archfixtures.safetykernel.platform.workflow.api.WorkflowPort
import hms.archfixtures.safetykernel.results.web.ResultsUseWorkflow
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.DynamicTest.dynamicTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory

/** Rule (e), `ArchTest:safety-kernel-never-uses-workflow` (platform-workflow.md §10; D7; SI-03). */
class SafetyKernelWorkflowRuleTest {
    private val rule = HmsArchitectureRules.safetyKernelNeverUsesWorkflow("hms.archfixtures.safetykernel")

    @TestFactory
    fun `safety-kernel-never-uses-workflow fails on each Safety Kernel module that uses the workflow port`(): List<DynamicTest> =
        listOf(
            OrdersStartWorkflow::class,
            TaskWaitsOnWorkflow::class,
            MedicationsUseWorkflow::class,
            ResultsUseWorkflow::class,
        ).map { fixture ->
            dynamicTest(fixture.java.simpleName) { assertRuleFails(rule, importFixtures(fixture, WorkflowPort::class), fixture) }
        }

    @Test
    fun `safety-kernel-never-uses-workflow passes on adt starting a workflow and on tasks running its own timers`() {
        val compliant = arrayOf(AdtStartsWorkflow::class, TasksRunOwnTimers::class, WorkflowPort::class)
        assertRulePasses(rule, importFixtures(*compliant), *compliant)
    }

    @Test
    fun `safety-kernel-never-uses-workflow covers exactly orders, medications, results and platform-tasks`() {
        assertEquals(listOf("orders", "medications", "results", "platform.tasks"), HmsArchitectureRules.SAFETY_KERNEL_MODULES)
    }
}
