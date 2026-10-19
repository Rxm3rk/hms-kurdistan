package hms.archfixtures.testadapters.orders.infrastructure.inmemory

import hms.archfixtures.testadapters.kernel.testing.FixtureTestClock

/** Compliant D8 fixture: an in-memory adapter may use test support, because it is itself test and dev only. */
class InMemoryOrderStore(
    val clock: FixtureTestClock,
)
