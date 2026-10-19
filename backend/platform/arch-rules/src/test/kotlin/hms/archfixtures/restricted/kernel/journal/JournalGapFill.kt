package hms.archfixtures.restricted.kernel.journal

import hms.archfixtures.restricted.kernel.context.ActorKindRestricted
import hms.archfixtures.restricted.kernel.context.ActorRef
import hms.archfixtures.restricted.kernel.context.SystemProcess

/** Compliant: the journal's publication watermark check acts as SYSTEM. */
class JournalGapFill {
    @OptIn(ActorKindRestricted::class)
    fun actor(): ActorRef = ActorRef.system(SystemProcess("journal.gap-fill"))
}
