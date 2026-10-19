package hms.archfixtures.testadapters.orders.application

import hms.archfixtures.testadapters.orders.infrastructure.inmemory.InMemoryOrderStore
import hms.archfixtures.testadapters.orders.infrastructure.persistence.JooqOrderStore
import hms.archfixtures.testadapters.platform.tasks.testing.TaskTestSupport

/** Violating D8 fixture: production code binds an in-memory adapter. */
class BindsInMemoryStore(
    val store: InMemoryOrderStore,
)

/** Violating D8 fixture: production code uses another module's testing package. */
class UsesTaskTestSupport(
    val support: TaskTestSupport,
)

/** Compliant D8 fixture: production code binds the production adapter. */
class BindsProductionStore(
    val store: JooqOrderStore,
)
