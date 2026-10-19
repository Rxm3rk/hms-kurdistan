package hms.archfixtures.clock.compliant.kernel.journal.infrastructure

import java.time.Clock

/** Compliant fixture for the extended rule (d): the journal's infrastructure is outside the rule. */
class JournalAdapterCreatesClock {
    fun clock(): Clock = Clock.systemUTC()
}
