package hms.archfixtures.clock.violating.kernel.journal.inmemory

import java.time.Clock

/** Violating fixture for the extended rule (d): the journal's in-memory adapter is outside infrastructure, so it takes a Clock too. */
class InMemoryJournalReadsClock {
    fun clock(): Clock = Clock.systemUTC()
}
