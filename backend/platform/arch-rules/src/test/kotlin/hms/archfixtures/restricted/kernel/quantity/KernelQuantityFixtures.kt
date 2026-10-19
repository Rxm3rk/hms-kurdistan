package hms.archfixtures.restricted.kernel.quantity

import hms.archfixtures.restricted.kernel.time.EnvironmentClass
import hms.archfixtures.restricted.kernel.time.ResolvedValue
import hms.archfixtures.restricted.kernel.time.SafetyParameterFactory
import java.math.BigDecimal

// Fixtures that mirror the restricted functions of hms.kernel.quantity (platform-kernel.md §10.3, §10.5).

@RequiresOptIn(level = RequiresOptIn.Level.ERROR)
@Retention(AnnotationRetention.RUNTIME)
@Target(AnnotationTarget.FUNCTION)
annotation class DoseMagnitudeAccess

/** Like the kernel's Quantity. */
class Quantity private constructor(
    private val value: BigDecimal,
    val unit: String,
) {
    @DoseMagnitudeAccess
    fun magnitude(): BigDecimal = value

    companion object {
        @DoseMagnitudeAccess
        @JvmStatic
        fun ofMagnitude(
            magnitude: BigDecimal,
            unit: String,
        ): Quantity = Quantity(magnitude, unit)
    }
}

/** Like the kernel's DoseQuantity. */
class DoseQuantity(
    private val quantity: Quantity,
) {
    @DoseMagnitudeAccess
    fun magnitude(): BigDecimal = quantity.magnitude()
}

/** Like the kernel's DoseRate. */
class DoseRate(
    private val quantity: Quantity,
) {
    @DoseMagnitudeAccess
    fun magnitude(): BigDecimal = quantity.magnitude()
}

/** Like the kernel's GovernedThreshold: its factory carries the time library's safety-parameter marker. */
class GovernedThreshold private constructor(
    val key: String,
    val environment: EnvironmentClass,
) {
    companion object {
        @SafetyParameterFactory
        @JvmStatic
        fun fromResolved(
            factor: ResolvedValue,
            environment: EnvironmentClass,
        ): GovernedThreshold = GovernedThreshold(factor.key, environment)
    }
}

/** Compliant: the quantity library itself reads magnitudes (its comparison API). */
class DoseComparisons {
    @OptIn(DoseMagnitudeAccess::class)
    fun sameMagnitude(
        a: DoseQuantity,
        b: DoseQuantity,
    ): Boolean = a.magnitude().compareTo(b.magnitude()) == 0
}
