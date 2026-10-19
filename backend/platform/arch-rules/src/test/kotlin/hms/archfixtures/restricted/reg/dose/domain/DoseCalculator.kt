package hms.archfixtures.restricted.reg.dose.domain

import hms.archfixtures.restricted.kernel.quantity.DoseMagnitudeAccess
import hms.archfixtures.restricted.kernel.quantity.DoseQuantity
import hms.archfixtures.restricted.kernel.quantity.Quantity
import java.math.BigDecimal

/** Compliant: reg-dose is the one place that does dose arithmetic (§2.1, §6.8 #1). */
class DoseCalculator {
    @OptIn(DoseMagnitudeAccess::class)
    fun twice(dose: DoseQuantity): Quantity = Quantity.ofMagnitude(dose.magnitude().multiply(BigDecimal.TWO), "mg")
}
