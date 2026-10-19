package hms.archfixtures.kernelpurity.violating.kernel.journal.inmemory

import io.apicurio.archfixtures.ApicurioStandIn

/** Violating fixture for kernel-journal-framework-free-outside-infrastructure: the in-memory journal depends on Apicurio. */
class InMemoryJournalDependsOnApicurio(
    val schema: ApicurioStandIn,
)
