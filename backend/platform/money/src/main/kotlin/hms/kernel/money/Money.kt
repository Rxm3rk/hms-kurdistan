package hms.kernel.money

import java.math.BigDecimal
import java.math.BigInteger
import java.math.RoundingMode
import java.util.Currency

/**
 * An amount of money in one ISO 4217 currency (platform-kernel.md §9; BUILD-PROMPT §6.2, §9.21).
 *
 * The amount is a [BigDecimal] whose scale always equals the currency's minor units, read from the JDK
 * (`Currency.getDefaultFractionDigits`). There is no floating point anywhere in the API. Exact operations
 * ([plus], [minus], [unaryMinus], [times] by a count, [allocate], [split]) never round; every operation that
 * can lose precision takes an explicit [RoundingMode]. Mixing currencies is a programming error and throws;
 * conversion is always explicit through [ExchangeRate].
 */
@Suppress("TooManyFunctions") // The public API is fixed by platform-kernel.md §9.
class Money private constructor(
    val amount: BigDecimal,
    val currency: Currency,
) : Comparable<Money> {
    init {
        val digits = currency.defaultFractionDigits
        require(digits >= 0) { "${currency.currencyCode} has no ISO 4217 minor units" }
        require(amount.scale() == digits) {
            "the scale of $amount must equal the ${currency.currencyCode} minor units ($digits)"
        }
    }

    /** True when the amount is zero. */
    val isZero: Boolean get() = amount.signum() == 0

    /** -1, 0 or 1 as the amount is negative, zero or positive. */
    val signum: Int get() = amount.signum()

    /** Exact sum; a different currency throws. */
    operator fun plus(other: Money): Money = Money(amount.add(sameCurrency(other).amount), currency)

    /** Exact difference; a different currency throws. */
    operator fun minus(other: Money): Money = Money(amount.subtract(sameCurrency(other).amount), currency)

    /** Exact negation. */
    operator fun unaryMinus(): Money = Money(amount.negate(), currency)

    /** Exact: the amount times a whole count. */
    fun times(count: Long): Money = Money(amount.multiply(BigDecimal.valueOf(count)), currency)

    /** The amount times [factor], rounded to the currency's minor units with [rounding]. */
    fun times(
        factor: BigDecimal,
        rounding: RoundingMode,
    ): Money = Money(amount.multiply(factor).setScale(amount.scale(), rounding), currency)

    /**
     * Exact: the result sums to this amount. In minor units each share is the floor of its exact proportion,
     * and the remaining minor units go one each to the largest remainders, ties to the lower index. A negative
     * amount is allocated as its absolute value and negated. Weights are non-negative with a positive sum.
     */
    fun allocate(weights: List<BigDecimal>): List<Money> {
        require(weights.isNotEmpty()) { "at least one weight is needed" }
        require(weights.all { it.signum() >= 0 }) { "weights must not be negative" }
        val total = weights.fold(BigDecimal.ZERO, BigDecimal::add)
        require(total.signum() > 0) { "the weights must have a positive sum" }

        val minorUnits = amount.unscaledValue()
        val magnitude = BigDecimal(minorUnits.abs())
        val products = weights.map { magnitude.multiply(it) }
        val shares = products.map { it.divideToIntegralValue(total).toBigIntegerExact() }.toMutableList()
        val remainders = products.map { it.remainder(total) }
        val leftover = minorUnits.abs() - shares.fold(BigInteger.ZERO, BigInteger::add)
        remainders.indices
            .sortedWith(compareByDescending<Int> { remainders[it] }.thenBy { it })
            .take(leftover.intValueExact())
            .forEach { shares[it] = shares[it] + BigInteger.ONE }

        val negative = minorUnits.signum() < 0
        return shares.map { share -> Money(BigDecimal(if (negative) share.negate() else share, amount.scale()), currency) }
    }

    /** Exact: [parts] equal shares as [allocate] gives them; [parts] must be positive. */
    fun split(parts: Int): List<Money> {
        require(parts > 0) { "parts must be positive, got $parts" }
        return allocate(List(parts) { BigDecimal.ONE })
    }

    /** Same currency only; a mismatch throws. */
    override fun compareTo(other: Money): Int = amount.compareTo(sameCurrency(other).amount)

    override fun equals(other: Any?): Boolean = other is Money && amount == other.amount && currency == other.currency

    override fun hashCode(): Int = 31 * amount.hashCode() + currency.hashCode()

    override fun toString(): String = "${currency.currencyCode} ${amount.toPlainString()}"

    private fun sameCurrency(other: Money): Money {
        require(other.currency == currency) {
            "currency mismatch: ${currency.currencyCode} and ${other.currency.currencyCode}; convert through an ExchangeRate"
        }
        return other
    }

    companion object {
        /** Throws for a currency without minor units (programming error). */
        @JvmStatic
        fun zero(currency: Currency): Money = Money(BigDecimal.ZERO.setScale(minorUnitsOf(currency)), currency)

        /** Throws for a currency without minor units (programming error). */
        @JvmStatic
        fun ofMinorUnits(
            minorUnits: Long,
            currency: Currency,
        ): Money = Money(BigDecimal.valueOf(minorUnits, minorUnitsOf(currency)), currency)

        /** Pads a shorter scale with zeros; refuses a longer scale and a currency without minor units. */
        @JvmStatic
        fun ofExact(
            amount: BigDecimal,
            currency: Currency,
        ): MoneyResult {
            val digits = currency.defaultFractionDigits
            return when {
                digits < 0 -> MoneyResult.Refused(MoneyRefusal.CURRENCY_HAS_NO_MINOR_UNITS)
                amount.scale() > digits -> MoneyResult.Refused(MoneyRefusal.MORE_DECIMALS_THAN_THE_CURRENCY_HAS)
                else -> MoneyResult.Valid(Money(amount.setScale(digits), currency))
            }
        }

        /**
         * Rounds to the currency's minor units with [rounding]. Refuses a currency without minor units, and
         * refuses with [MoneyRefusal.MORE_DECIMALS_THAN_THE_CURRENCY_HAS] when [rounding] is
         * [RoundingMode.UNNECESSARY] and the amount has more decimals than the currency.
         */
        @JvmStatic
        fun ofRounded(
            amount: BigDecimal,
            currency: Currency,
            rounding: RoundingMode,
        ): MoneyResult {
            val digits = currency.defaultFractionDigits
            return when {
                digits < 0 -> MoneyResult.Refused(MoneyRefusal.CURRENCY_HAS_NO_MINOR_UNITS)
                rounding == RoundingMode.UNNECESSARY && amount.stripTrailingZeros().scale() > digits ->
                    MoneyResult.Refused(MoneyRefusal.MORE_DECIMALS_THAN_THE_CURRENCY_HAS)
                else -> MoneyResult.Valid(Money(amount.setScale(digits, rounding), currency))
            }
        }

        /** For this library: [amount] rounded to the minor units of a currency already validated. */
        internal fun rounded(
            amount: BigDecimal,
            currency: Currency,
            rounding: RoundingMode,
        ): Money = Money(amount.setScale(minorUnitsOf(currency), rounding), currency)

        private fun minorUnitsOf(currency: Currency): Int {
            val digits = currency.defaultFractionDigits
            require(digits >= 0) { "${currency.currencyCode} has no ISO 4217 minor units" }
            return digits
        }
    }
}

/** The outcome of building [Money] from input (platform-kernel.md §9). */
sealed interface MoneyResult {
    /** A valid amount. */
    data class Valid(
        val money: Money,
    ) : MoneyResult

    /** Refused, with the reason. */
    data class Refused(
        val reason: MoneyRefusal,
    ) : MoneyResult
}

/** Why an amount was refused (platform-kernel.md §9). */
enum class MoneyRefusal {
    /** The JDK has no ISO 4217 minor units for the currency (for example XXX). */
    CURRENCY_HAS_NO_MINOR_UNITS,

    /** The amount has more decimals than the currency's minor units. */
    MORE_DECIMALS_THAN_THE_CURRENCY_HAS,
}
