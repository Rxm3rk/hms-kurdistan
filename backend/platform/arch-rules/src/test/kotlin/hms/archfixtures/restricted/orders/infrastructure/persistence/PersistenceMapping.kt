package hms.archfixtures.restricted.orders.infrastructure.persistence

import hms.archfixtures.restricted.kernel.quantity.DoseMagnitudeAccess
import hms.archfixtures.restricted.kernel.quantity.DoseQuantity
import hms.archfixtures.restricted.kernel.quantity.Quantity
import hms.archfixtures.restricted.kernel.time.PersistenceOnly
import hms.archfixtures.restricted.kernel.time.RecordedTime
import java.math.BigDecimal
import java.time.Instant

/** Compliant: a module's persistence adapter rebuilds its `recorded_at` column. */
class RecordedTimeColumn {
    @OptIn(PersistenceOnly::class)
    fun read(column: Instant): RecordedTime = RecordedTime.restore(column)
}

/** Compliant: persistence mapping of a quantity to and from its numeric column. */
class QuantityColumns {
    @OptIn(DoseMagnitudeAccess::class)
    fun write(dose: DoseQuantity): BigDecimal = dose.magnitude()

    @OptIn(DoseMagnitudeAccess::class)
    fun read(
        column: BigDecimal,
        unit: String,
    ): Quantity = Quantity.ofMagnitude(column, unit)
}
