package hms.archfixtures.modules.trust.policy.application

import hms.archfixtures.modules.trust.identity.api.SessionView

/** Compliant fixture for rule (b): module "trust.policy" uses the api of "trust.identity". */
class PolicyUsesIdentityApi {
    fun sessionOf(view: SessionView): String = view.sessionId
}
