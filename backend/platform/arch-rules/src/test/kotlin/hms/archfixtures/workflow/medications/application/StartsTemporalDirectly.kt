package hms.archfixtures.workflow.medications.application

import io.temporal.client.WorkflowClient

/** Violating fixture for rule (c): a clinical module using Temporal instead of WorkflowPort. */
class StartsTemporalDirectly(
    val client: WorkflowClient,
)
