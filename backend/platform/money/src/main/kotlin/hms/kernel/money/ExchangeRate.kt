package hms.kernel.money

import hms.kernel.time.RecordedTime
import hms.kernel.time.ValidPeriod
import java.math.BigDecimal
import java.math.RoundingMode
import java.util.Currency

/**
 * An exchange rate (platform-kernel.md §9; BUILD-PROMPT §9.21): [rate] units of [to] per one unit of [from],
 * effective over the half-open [effective] period, with its [source] and the time it was recorded. Conversion
 * always takes an explicit [RoundingMode] and gives the target currency's minor units. Whether change in the
 * other currency uses [convertBack] or a separately posted rate is OQ-KN8 for the `rcm` specification.
 */
class ExchangeRate private constructor(
    val from: Currency,
    val to: Currency,
    val rate: BigDecimal,
    val effective: ValidPeriod,
    val source: String,
    val recordedAt: RecordedTime,
) {
    init {
        require(from != to) { "an exchange rate needs two currencies, got ${from.currencyCode} twice" }
        require(rate.signum() > 0) { "an exchange rate must be positive, got $rate" }
        require(source.isNotBlank()) { "an exchange rate needs a source" }
        require(from.defaultFractionDigits >= 0 && to.defaultFractionDigits >= 0) {
            "both currencies need ISO 4217 minor units: ${from.currencyCode}, ${to.currencyCode}"
        }
    }

    /** [amount] in [from] to [to], rounded to [to]'s minor units with [rounding]; another currency throws. */
    fun convert(
        amount: Money,
        rounding: RoundingMode,
    ): Money {
        require(amount.currency == from) { "this rate converts ${from.currencyCode}, not ${amount.currency.currencyCode}" }
        return Money.rounded(amount.amount.multiply(rate), to, rounding)
    }

    /** [amount] in [to] back to [from] at the inverse of this rate, rounded with [rounding]; another currency throws. */
    fun convertBack(
        amount: Money,
        rounding: RoundingMode,
    ): Money {
        require(amount.currency == to) { "this rate converts back from ${to.currencyCode}, not ${amount.currency.currencyCode}" }
        return Money.rounded(amount.amount.divide(rate, from.defaultFractionDigits, rounding), from, rounding)
    }

    override fun toString(): String =
        "ExchangeRate(${from.currencyCode}->${to.currencyCode} ${rate.toPlainString()}, " +
            "from ${effective.start} to ${effective.endExclusive ?: "open"}, source=$source)"

    companion object {
        /** Validates the pair, the rate, the source and both currencies' minor units. */
        @JvmStatic
        fun of(
            from: Currency,
            to: Currency,
            rate: BigDecimal,
            effective: ValidPeriod,
            source: String,
            recordedAt: RecordedTime,
        ): ExchangeRateResult {
            val refusal =
                when {
                    from == to -> ExchangeRateRefusal.SAME_CURRENCY
                    rate.signum() <= 0 -> ExchangeRateRefusal.RATE_NOT_POSITIVE
                    source.isBlank() -> ExchangeRateRefusal.SOURCE_MISSING
                    from.defaultFractionDigits < 0 || to.defaultFractionDigits < 0 -> ExchangeRateRefusal.CURRENCY_HAS_NO_MINOR_UNITS
                    else -> null
                }
            return if (refusal == null) {
                ExchangeRateResult.Valid(ExchangeRate(from, to, rate, effective, source, recordedAt))
            } else {
                ExchangeRateResult.Refused(refusal)
            }
        }
    }
}

/** The outcome of building an [ExchangeRate] (platform-kernel.md §9). */
sealed interface ExchangeRateResult {
    /** A valid rate. */
    data class Valid(
        val rate: ExchangeRate,
    ) : ExchangeRateResult

    /** Refused, with the reason. */
    data class Refused(
        val reason: ExchangeRateRefusal,
    ) : ExchangeRateResult
}

/** Why an exchange rate was refused (platform-kernel.md §9). */
enum class ExchangeRateRefusal {
    /** [ExchangeRate.from] and [ExchangeRate.to] are the same currency. */
    SAME_CURRENCY,

    /** The rate is zero or negative. */
    RATE_NOT_POSITIVE,

    /** The source is blank. */
    SOURCE_MISSING,

    /** A currency has no ISO 4217 minor units in the JDK data. */
    CURRENCY_HAS_NO_MINOR_UNITS,
}
