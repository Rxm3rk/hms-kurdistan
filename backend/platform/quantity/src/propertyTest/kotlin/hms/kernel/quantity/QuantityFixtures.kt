package hms.kernel.quantity

import hms.kernel.time.ContentProvenance
import hms.kernel.time.EnvironmentClass
import hms.kernel.time.ResolvedParameter
import hms.kernel.time.SafetyParameterFactory
import hms.kernel.time.SafetyParameterResult
import java.math.BigDecimal

/**
 * Property-test fixtures, a copy of src/test's (the source sets do not share code). Unit codes are the few that
 * BUILD-PROMPT itself uses (`mg`, `mL`, `mL/h`); thresholds are synthetic (ContentProvenance.SYNTHETIC, §19.4) and
 * never clinical values.
 */
object QuantityFixtures {
    /** A synthetic setting key, not a medications or CDS key. */
    const val THRESHOLD_KEY: String = "synthetic.quantity.test-threshold-factor"

    fun unit(code: String): UcumUnit = (UcumUnit.parse(code) as UcumParseResult.Valid).unit

    fun quantity(
        entered: String,
        unitCode: String,
    ): Quantity = (Quantity.parse(entered, unit(unitCode)) as QuantityParseResult.Valid).quantity

    fun dose(
        entered: String,
        unitCode: String,
    ): DoseQuantity = (DoseQuantity.parse(entered, unitCode) as DoseQuantityResult.Valid).dose

    fun rate(
        entered: String,
        unitCode: String,
    ): DoseRate = (DoseRate.parse(entered, unitCode) as DoseRateResult.Valid).rate

    fun parameter(
        factor: String,
        provenance: ContentProvenance = ContentProvenance.SYNTHETIC,
    ): ResolvedParameter<BigDecimal> = ResolvedParameter(THRESHOLD_KEY, BigDecimal(factor), provenance, "synthetic-entry-1", null)

    @OptIn(SafetyParameterFactory::class)
    fun threshold(factor: String): GovernedThreshold =
        (GovernedThreshold.fromResolved(parameter(factor), EnvironmentClass.TEST) as SafetyParameterResult.Built).parameter
}
