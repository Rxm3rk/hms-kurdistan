package hms.archfixtures.modules.beta.domain

import hms.archfixtures.modules.alpha.AlphaModule

/** Violating fixture for rule (b): module "beta" uses alpha's root package, which is not its api. */
class BetaUsesAlphaModuleRoot {
    fun alphaName(): String = AlphaModule.name()
}
