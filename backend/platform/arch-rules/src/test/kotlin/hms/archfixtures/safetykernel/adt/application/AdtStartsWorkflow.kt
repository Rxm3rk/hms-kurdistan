package hms.archfixtures.safetykernel.adt.application

import hms.archfixtures.safetykernel.platform.workflow.api.WorkflowPort

/** Compliant fixture for rule (e): adt is not in the Safety Kernel and may start a workflow through the port. */
class AdtStartsWorkflow(
    private val port: WorkflowPort,
) {
    fun admit(): String = port.start("admission-follow-up")
}
