package hms.archfixtures.workflow.platform.workflow.domain

import io.temporal.client.WorkflowOptions

/** Violating fixture for rule (c): inside platform-workflow, but outside its infrastructure adapter. */
class LeaksTemporalOptions(
    val options: WorkflowOptions,
)
