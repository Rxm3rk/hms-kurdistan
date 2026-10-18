package hms.archfixtures.workflow.platform.workflow.infrastructure

import hms.archfixtures.workflow.platform.workflow.api.WorkflowPort
import io.temporal.client.WorkflowClient

/** Compliant fixture for rule (c): Temporal types inside the platform-workflow adapter. */
class TemporalWorkflowAdapter(
    private val client: WorkflowClient,
) : WorkflowPort {
    override fun namespace(): String = client.options.namespace
}
