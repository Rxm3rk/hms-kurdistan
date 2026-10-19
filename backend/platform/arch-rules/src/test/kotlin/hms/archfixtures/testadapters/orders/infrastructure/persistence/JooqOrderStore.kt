package hms.archfixtures.testadapters.orders.infrastructure.persistence

import java.time.Clock

/** Compliant D8 fixture: a production adapter on the injected clock. */
class JooqOrderStore(
    val clock: Clock,
)
