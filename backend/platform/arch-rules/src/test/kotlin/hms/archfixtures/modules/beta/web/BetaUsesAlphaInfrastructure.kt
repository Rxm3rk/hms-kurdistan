package hms.archfixtures.modules.beta.web

import hms.archfixtures.modules.alpha.infrastructure.AlphaStore

/** Violating fixture for rule (b): module "beta" reaches into alpha's infrastructure package. */
class BetaUsesAlphaInfrastructure(
    val store: AlphaStore,
)
