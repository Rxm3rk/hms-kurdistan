package hms.archfixtures.safetykernel.platform.tasks.domain

import hms.archfixtures.safetykernel.platform.workflow.api.WorkflowPort

/** Violating fixture for rule (e): a platform-tasks domain class that depends on the workflow port. */
class TaskWaitsOnWorkflow(
    val port: WorkflowPort,
)
