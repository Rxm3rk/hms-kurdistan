package hms.archfixtures.restricted.kernel.journal.infrastructure

import hms.archfixtures.restricted.kernel.time.PersistenceOnly
import hms.archfixtures.restricted.kernel.time.RecordedTime
import java.time.Instant

/** Compliant: the journal's jOOQ adapter rebuilds a row's recorded time. */
class JournalRowMapper {
    @OptIn(PersistenceOnly::class)
    fun recordedAt(column: Instant): RecordedTime = RecordedTime.restore(column)
}
