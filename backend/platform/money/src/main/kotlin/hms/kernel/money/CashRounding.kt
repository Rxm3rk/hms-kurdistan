package hms.kernel.money

import java.math.RoundingMode

/**
 * A tenant's cash-rounding rule (platform-kernel.md §9; BUILD-PROMPT §9.21): round a payable amount to a
 * positive increment in the same currency with the tenant's [RoundingMode], keeping the difference so the
 * ledger can post it. The increment and mode come from tenant configuration (L-14, OQ-KN7); there is no
 * default. [NotConfigured] is a value: refusing on it is `rcm`'s control, never the kernel's.
 */
sealed interface CashRoundingPolicy {
    /** No cash rounding is configured; [round] answers [CashRoundingOutcome.NotConfigured]. */
    data object NotConfigured : CashRoundingPolicy {
        override fun round(amount: Money): CashRoundingOutcome = CashRoundingOutcome.NotConfigured
    }

    /** Rounds to a whole multiple of a positive [increment] with [rounding]. Built by [toIncrement]. */
    class ToIncrement private constructor(
        val increment: Money,
        val rounding: RoundingMode,
    ) : CashRoundingPolicy {
        init {
            require(increment.signum > 0) { "the cash-rounding increment must be positive, got $increment" }
        }

        override fun round(amount: Money): CashRoundingOutcome {
            require(amount.currency == increment.currency) {
                "cannot cash-round ${amount.currency.currencyCode} with a ${increment.currency.currencyCode} increment"
            }
            val multiples = amount.amount.divide(increment.amount, 0, rounding)
            val payable = Money.rounded(increment.amount.multiply(multiples), increment.currency, RoundingMode.UNNECESSARY)
            return CashRoundingOutcome.Rounded(payable = payable, difference = payable - amount)
        }

        override fun equals(other: Any?): Boolean = other is ToIncrement && increment == other.increment && rounding == other.rounding

        override fun hashCode(): Int = 31 * increment.hashCode() + rounding.hashCode()

        override fun toString(): String = "ToIncrement($increment, $rounding)"

        internal companion object {
            fun validated(
                increment: Money,
                rounding: RoundingMode,
            ): CashRoundingPolicyResult =
                if (increment.signum > 0) {
                    CashRoundingPolicyResult.Valid(ToIncrement(increment, rounding))
                } else {
                    CashRoundingPolicyResult.IncrementNotPositive
                }
        }
    }

    /** A different currency from the policy's increment throws. */
    fun round(amount: Money): CashRoundingOutcome

    companion object {
        /** Validates the increment: it must be positive. */
        @JvmStatic
        fun toIncrement(
            increment: Money,
            rounding: RoundingMode,
        ): CashRoundingPolicyResult = ToIncrement.validated(increment, rounding)
    }
}

/** The outcome of building a [CashRoundingPolicy.ToIncrement] (platform-kernel.md §9). */
sealed interface CashRoundingPolicyResult {
    /** A valid policy. */
    data class Valid(
        val policy: CashRoundingPolicy.ToIncrement,
    ) : CashRoundingPolicyResult

    /** The increment is zero or negative. */
    data object IncrementNotPositive : CashRoundingPolicyResult
}

/** The outcome of cash rounding (platform-kernel.md §9). */
sealed interface CashRoundingOutcome {
    /** payable = amount + difference; payable is a whole multiple of the increment. */
    data class Rounded(
        val payable: Money,
        val difference: Money,
    ) : CashRoundingOutcome

    /** No cash rounding is configured for the tenant. */
    data object NotConfigured : CashRoundingOutcome
}
