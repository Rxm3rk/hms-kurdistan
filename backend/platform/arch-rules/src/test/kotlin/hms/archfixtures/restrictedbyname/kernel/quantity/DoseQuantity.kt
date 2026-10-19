package hms.archfixtures.restrictedbyname.kernel.quantity

import java.math.BigDecimal

/** Name-fallback fixture: a DoseQuantity whose `magnitude()` has lost its opt-in marker. */
class DoseQuantity(
    private val value: BigDecimal,
) {
    fun magnitude(): BigDecimal = value
}
