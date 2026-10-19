package hms.archfixtures.testadapters.platform.tasks.testing

import hms.archfixtures.testadapters.orders.infrastructure.inmemory.InMemoryOrderStore

/** Compliant D8 fixture: a module's testing package may use in-memory adapters. */
class TaskTestSupport(
    val store: InMemoryOrderStore,
)
