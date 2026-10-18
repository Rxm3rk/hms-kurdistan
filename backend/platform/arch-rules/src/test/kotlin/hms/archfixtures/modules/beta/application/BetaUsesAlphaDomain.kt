package hms.archfixtures.modules.beta.application

import hms.archfixtures.modules.alpha.domain.AlphaAggregate

/** Violating fixture for rule (b): module "beta" reaches into alpha's domain package. */
class BetaUsesAlphaDomain {
    fun load(id: String): AlphaAggregate = AlphaAggregate(id)
}
