package hms.archfixtures.restricted.platform.tasks.application.system

import hms.archfixtures.restricted.kernel.context.ActorKindRestricted
import hms.archfixtures.restricted.kernel.context.ActorRef
import hms.archfixtures.restricted.kernel.context.SystemProcess

/** Compliant: the platform-tasks alarm paths act as SYSTEM (D14). */
class OrphanScan {
    @OptIn(ActorKindRestricted::class)
    fun actor(): ActorRef = ActorRef.system(SystemProcess("platform-tasks.orphan-scan"))
}
