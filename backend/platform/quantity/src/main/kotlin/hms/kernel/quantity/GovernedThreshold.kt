package hms.kernel.quantity

import hms.kernel.time.ContentProvenance
import hms.kernel.time.EnvironmentClass
import hms.kernel.time.ResolvedParameter
import hms.kernel.time.SafetyParameterFactory
import hms.kernel.time.SafetyParameterRefusal
import hms.kernel.time.SafetyParameterResult
import java.math.BigDecimal

/**
 * The governed SI-05 threshold factor, for example the 10× hard stop (platform-kernel.md §10.5, §6.5; CTRL-0005-1).
 * Never a kernel constant: a vendor-locked, tighten-only setting owned by medications and CDS configuration, built
 * only by [fromResolved] from a resolved setting. `init` checks that the factor is greater than zero and is the
 * resolved value, so a reflective construction with an invalid value throws.
 */
class GovernedThreshold private constructor(
    val factor: BigDecimal,
    val source: ResolvedParameter<BigDecimal>,
) {
    init {
        require(factor.signum() > 0) { "GovernedThreshold factor must be greater than zero, got ${factor.toPlainString()}" }
        require(source.value == factor) { "GovernedThreshold factor must be the resolved value of ${source.key}" }
    }

    override fun equals(other: Any?): Boolean = other is GovernedThreshold && factor == other.factor && source == other.source

    override fun hashCode(): Int = 31 * factor.hashCode() + source.hashCode()

    override fun toString(): String = "GovernedThreshold(factor=${factor.toPlainString()}, source=$source)"

    companion object {
        /**
         * Builds the threshold from its resolved setting. Refuses, in this order: a synthetic value in TRAIN or PROD
         * (`SYNTHETIC_IN_TRAIN_OR_PROD`); a factor of zero or less (`VALUE_OUT_OF_RANGE`). The setting key belongs to
         * medications and CDS configuration, so the kernel checks no key. ArchUnit: callable only from the
         * `SAFETY_PARAMETER_RESOLVERS` allow-list and test sources (platform-kernel.md §6.5, §11).
         */
        @SafetyParameterFactory
        @JvmStatic
        fun fromResolved(
            factor: ResolvedParameter<BigDecimal>,
            environment: EnvironmentClass,
        ): SafetyParameterResult<GovernedThreshold> {
            val synthetic =
                factor.provenance == ContentProvenance.SYNTHETIC &&
                    (environment == EnvironmentClass.TRAIN || environment == EnvironmentClass.PROD)
            return when {
                synthetic -> SafetyParameterResult.Refused(SafetyParameterRefusal.SYNTHETIC_IN_TRAIN_OR_PROD, factor.key)
                factor.value.signum() <= 0 -> SafetyParameterResult.Refused(SafetyParameterRefusal.VALUE_OUT_OF_RANGE, factor.key)
                else -> SafetyParameterResult.Built(GovernedThreshold(factor.value, factor))
            }
        }
    }
}
