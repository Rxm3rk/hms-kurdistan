package hms.archfixtures.restricted.platform.tenancy.application

import hms.archfixtures.restricted.kernel.time.EntryTimePolicy
import hms.archfixtures.restricted.kernel.time.EnvironmentClass
import hms.archfixtures.restricted.kernel.time.ResolvedValue
import hms.archfixtures.restricted.kernel.time.SafetyParameterFactory

/** Violating fixture: tenancy code outside its allow-listed settings package builds a safety parameter. */
class TenancyOutsideSettings {
    @OptIn(SafetyParameterFactory::class)
    fun build(): EntryTimePolicy = EntryTimePolicy.fromResolved(ResolvedValue("platform.time.entry.x"), EnvironmentClass.TEST)
}
