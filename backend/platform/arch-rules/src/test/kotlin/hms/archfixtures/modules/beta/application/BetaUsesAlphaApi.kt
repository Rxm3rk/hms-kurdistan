package hms.archfixtures.modules.beta.application

import hms.archfixtures.modules.alpha.api.AlphaSummary
import hms.archfixtures.modules.kernel.ids.FixtureId

/** Compliant fixture for rule (b): module "beta" uses alpha's api and the shared kernel. */
class BetaUsesAlphaApi {
    fun summarise(id: FixtureId): AlphaSummary = AlphaSummary(id.value)
}
