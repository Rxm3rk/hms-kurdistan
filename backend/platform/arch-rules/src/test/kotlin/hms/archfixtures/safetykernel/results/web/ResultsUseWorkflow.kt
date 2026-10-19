package hms.archfixtures.safetykernel.results.web

import hms.archfixtures.safetykernel.platform.workflow.api.WorkflowPort

/** Violating fixture for rule (e): results depending on the workflow port. */
class ResultsUseWorkflow(
    val port: WorkflowPort,
)
