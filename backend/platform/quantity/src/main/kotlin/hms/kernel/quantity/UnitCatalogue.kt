package hms.kernel.quantity

/**
 * Port: semantic UCUM validation by the terminology service (PLT-CORE-05, WP-1.1; platform-kernel.md §10.2; §8.1 P6).
 * The kernel claims only the answer of [UnavailableUnitCatalogue]; refusing on anything but [UnitCheck.Known] is the
 * medications module's control (KA-KN1).
 */
fun interface UnitCatalogue {
    fun check(unit: UcumUnit): UnitCheck
}

/** What the [UnitCatalogue] knows about a unit (platform-kernel.md §10.2). */
sealed interface UnitCheck {
    data object Known : UnitCheck

    data object Unknown : UnitCheck

    /** A valid unit that is not metric (SAC-11: weights and doses are metric only). */
    data object NotMetric : UnitCheck

    /** The terminology service is not built or not reachable. */
    data object Unavailable : UnitCheck
}

/** Production binding until WP-1.1: always [UnitCheck.Unavailable] (platform-kernel.md §10.2). */
object UnavailableUnitCatalogue : UnitCatalogue {
    override fun check(unit: UcumUnit): UnitCheck = UnitCheck.Unavailable
}
