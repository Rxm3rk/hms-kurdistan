package hms.archfixtures.modules.alpha.infrastructure

import hms.archfixtures.modules.alpha.domain.AlphaAggregate

/** Module fixture: internal infrastructure of module "alpha"; it may use its own domain. */
class AlphaStore {
    private val rows = mutableMapOf<String, AlphaAggregate>()

    fun save(aggregate: AlphaAggregate) {
        rows[aggregate.id] = aggregate
    }

    fun find(id: String): AlphaAggregate? = rows[id]
}
