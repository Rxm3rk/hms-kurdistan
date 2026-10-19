package hms.archfixtures.locale.compliant.infrastructure

import java.time.ZoneId

/** Compliant fixture: the rule covers domain packages and the kernel libraries, not infrastructure. */
class ReadsDefaultZoneOutsideDomain {
    fun hostZone(): ZoneId = ZoneId.systemDefault()
}
