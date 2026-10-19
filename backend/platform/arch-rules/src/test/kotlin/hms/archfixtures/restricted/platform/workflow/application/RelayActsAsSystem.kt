package hms.archfixtures.restricted.platform.workflow.application

import hms.archfixtures.restricted.kernel.context.ActorKindRestricted
import hms.archfixtures.restricted.kernel.context.ActorRef
import hms.archfixtures.restricted.kernel.context.SystemProcess

/** Violating fixture: a workflow signal relay acts as the actor of its cause, never as SYSTEM (platform-kernel.md §7.2). */
class RelayActsAsSystem {
    @OptIn(ActorKindRestricted::class)
    fun actor(): ActorRef = ActorRef.system(SystemProcess("platform-workflow.relay"))
}
