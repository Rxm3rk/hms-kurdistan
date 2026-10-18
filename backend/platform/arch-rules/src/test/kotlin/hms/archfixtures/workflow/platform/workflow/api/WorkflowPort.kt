package hms.archfixtures.workflow.platform.workflow.api

/** Workflow fixture: the port every module uses for long-running processes (ADR-010). */
interface WorkflowPort {
    fun namespace(): String
}
