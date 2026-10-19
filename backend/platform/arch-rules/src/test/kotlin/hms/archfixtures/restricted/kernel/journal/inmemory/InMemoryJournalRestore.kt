package hms.archfixtures.restricted.kernel.journal.inmemory

import hms.archfixtures.restricted.kernel.time.PersistenceOnly
import hms.archfixtures.restricted.kernel.time.RecordedTime
import java.time.Instant

/** Compliant: the journal's in-memory adapter is on the persistence-only allow-list. */
class InMemoryJournalRestore {
    @OptIn(PersistenceOnly::class)
    fun recordedAt(stored: Instant): RecordedTime = RecordedTime.restore(stored)
}
