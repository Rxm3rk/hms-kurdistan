package hms.archfixtures.clock.violating.kernel.journal

/** Violating fixture for the extended rule (d): the journal's pure model reads the system clock. */
class JournalModelReadsClock {
    fun read(): Long = System.currentTimeMillis()
}
