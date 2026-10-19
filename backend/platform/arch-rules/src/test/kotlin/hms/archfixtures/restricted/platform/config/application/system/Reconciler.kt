package hms.archfixtures.restricted.platform.config.application.system

import hms.archfixtures.restricted.kernel.context.ActorKindRestricted
import hms.archfixtures.restricted.kernel.context.ActorRef
import hms.archfixtures.restricted.kernel.context.SystemProcess

/** Compliant: the platform-config reconciler acts as SYSTEM. */
class Reconciler {
    @OptIn(ActorKindRestricted::class)
    fun actor(): ActorRef = ActorRef.system(SystemProcess("platform-config.reconciler"))
}
