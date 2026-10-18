package hms.archfixtures.modules.trust.policy.domain

import hms.archfixtures.modules.trust.identity.domain.Session

/**
 * Violating fixture for rule (b): "trust.policy" and "trust.identity" are different modules even though
 * both sit under "trust", so policy may not use identity's domain package.
 */
class PolicyUsesIdentityDomain(
    val session: Session,
)
