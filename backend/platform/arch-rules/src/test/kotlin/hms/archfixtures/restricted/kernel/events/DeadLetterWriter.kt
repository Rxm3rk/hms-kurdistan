package hms.archfixtures.restricted.kernel.events

import hms.archfixtures.restricted.kernel.context.ActorKindRestricted
import hms.archfixtures.restricted.kernel.context.ActorRef
import hms.archfixtures.restricted.kernel.context.SystemProcess

/** Compliant: the event library writes dead-letter rows as SYSTEM. */
class DeadLetterWriter {
    @OptIn(ActorKindRestricted::class)
    fun actor(): ActorRef = ActorRef.system(SystemProcess("events.dead-letter"))
}
