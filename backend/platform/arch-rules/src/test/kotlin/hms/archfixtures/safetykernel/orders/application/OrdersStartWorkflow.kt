package hms.archfixtures.safetykernel.orders.application

import hms.archfixtures.safetykernel.platform.workflow.api.WorkflowPort

/** Violating fixture for rule (e): an orders command that starts a workflow. */
class OrdersStartWorkflow(
    private val port: WorkflowPort,
) {
    fun place(): String = port.start("order-follow-up")
}
