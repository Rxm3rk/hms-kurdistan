package hms.archfixtures.kernelpurity.compliant.kernel.journal.infrastructure

import io.cloudevents.CloudEvent
import org.jooq.DSLContext

/** Compliant fixture: the journal's infrastructure adapter is where jOOQ and CloudEvents belong (platform-journal.md §3). */
class JournalAdapterUsesFrameworks(
    val dsl: DSLContext,
    val event: CloudEvent,
)
