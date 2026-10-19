package hms.archfixtures.safetykernel.medications.application

import hms.archfixtures.safetykernel.platform.workflow.api.WorkflowPort

/** Violating fixture for rule (e): medications depending on the workflow port. */
class MedicationsUseWorkflow(
    val port: WorkflowPort,
)
