package hms.archfixtures.testadapters.app.devwiring

import hms.archfixtures.testadapters.orders.infrastructure.inmemory.InMemoryOrderStore

/** D8 fixture: app-hms's dev and test wiring package; it passes only when the rule is given it as the exemption. */
class DevWiring(
    val store: InMemoryOrderStore,
)
