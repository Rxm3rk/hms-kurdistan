package hms.archfixtures.restricted.orders.infrastructure

import hms.archfixtures.restricted.kernel.quantity.DoseMagnitudeAccess
import hms.archfixtures.restricted.kernel.quantity.DoseQuantity
import hms.archfixtures.restricted.kernel.time.PersistenceOnly
import hms.archfixtures.restricted.kernel.time.RecordedTime
import java.math.BigDecimal
import java.time.Instant

/** Violating fixture for persistence-only-factories: infrastructure, but outside `..infrastructure.persistence..`. */
class InfrastructureRestoresRecordedTime {
    @OptIn(PersistenceOnly::class)
    fun read(instant: Instant): RecordedTime = RecordedTime.restore(instant)
}

/** Violating fixture for dose-and-quantity-operations-only-in-reg-dose: infrastructure outside persistence mapping. */
class InfrastructureReadsMagnitude {
    @OptIn(DoseMagnitudeAccess::class)
    fun read(dose: DoseQuantity): BigDecimal = dose.magnitude()
}
