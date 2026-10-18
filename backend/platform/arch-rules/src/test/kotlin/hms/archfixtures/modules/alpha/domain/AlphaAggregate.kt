package hms.archfixtures.modules.alpha.domain

import hms.archfixtures.modules.alpha.api.AlphaSummary

/** Module fixture: internal domain code of module "alpha"; it may use its own api. */
class AlphaAggregate(
    val id: String,
) {
    fun summary(): AlphaSummary = AlphaSummary(id)
}
