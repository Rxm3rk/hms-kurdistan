package hms.archfixtures.restricted.platform.tenancy.application.settings

import hms.archfixtures.restricted.kernel.time.EntryTimePolicy
import hms.archfixtures.restricted.kernel.time.EnvironmentClass
import hms.archfixtures.restricted.kernel.time.ResolvedValue
import hms.archfixtures.restricted.kernel.time.SafetyParameterFactory

/** Compliant: the tenancy resolver that implements EntryTimePolicySource (platform-kernel.md §6.5). */
class EntryTimePolicyResolver {
    @OptIn(SafetyParameterFactory::class)
    fun resolve(environment: EnvironmentClass): EntryTimePolicy =
        EntryTimePolicy.fromResolved(ResolvedValue("platform.time.entry.x"), environment)
}
