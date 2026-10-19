package hms.archfixtures.restrictedbyname.orders.application

import hms.archfixtures.restrictedbyname.kernel.quantity.DoseQuantity
import hms.archfixtures.restrictedbyname.kernel.time.RecordedTime
import java.math.BigDecimal
import java.time.Instant

// Violating fixtures for the name fallback: calls to restricted functions that carry no marker.

class RestoresUnannotated {
    fun read(instant: Instant): RecordedTime = RecordedTime.restore(instant)
}

class ReadsUnannotatedMagnitude {
    fun read(dose: DoseQuantity): BigDecimal = dose.magnitude()
}
