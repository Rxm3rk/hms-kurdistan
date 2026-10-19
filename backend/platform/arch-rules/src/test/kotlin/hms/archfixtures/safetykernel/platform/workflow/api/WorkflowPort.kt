package hms.archfixtures.safetykernel.platform.workflow.api

/** Rule (e) fixture: the platform-workflow port (platform-workflow.md §10). */
interface WorkflowPort {
    fun start(definition: String): String
}
