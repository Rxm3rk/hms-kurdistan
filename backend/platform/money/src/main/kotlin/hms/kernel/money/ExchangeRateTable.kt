package hms.kernel.money

import java.time.Instant
import java.util.Currency

/**
 * An effective-dated exchange-rate table (platform-kernel.md §9; BUILD-PROMPT §9.21): answers the rate
 * effective at an instant for a currency pair. A pair is directed ([ExchangeRate.from] to [ExchangeRate.to]);
 * the periods of one pair never overlap, so at most one rate is effective at any instant.
 */
class ExchangeRateTable private constructor(
    val rates: List<ExchangeRate>,
) {
    init {
        require(firstOverlap(rates) == null) { "the periods of one currency pair must not overlap" }
    }

    /** The rate for [from] to [to] whose half-open effective period contains [at]. */
    fun rateAt(
        from: Currency,
        to: Currency,
        at: Instant,
    ): RateLookup =
        rates
            .firstOrNull { it.from == from && it.to == to && it.effective.contains(at) }
            ?.let { RateLookup.Found(it) }
            ?: RateLookup.NoRateEffective

    companion object {
        /** Refuses a table in which two rates of one pair have overlapping periods. */
        @JvmStatic
        fun of(rates: List<ExchangeRate>): ExchangeRateTableResult {
            val copy = rates.toList()
            val overlap = firstOverlap(copy)
            return if (overlap == null) {
                ExchangeRateTableResult.Valid(ExchangeRateTable(copy))
            } else {
                ExchangeRateTableResult.OverlappingPeriods(overlap.from, overlap.to)
            }
        }

        /** The first rate, in list order, whose period overlaps an earlier rate of the same pair. */
        private fun firstOverlap(rates: List<ExchangeRate>): ExchangeRate? =
            rates.withIndex().firstOrNull { (index, rate) ->
                rates.subList(0, index).any { earlier ->
                    earlier.from == rate.from && earlier.to == rate.to && earlier.effective.overlaps(rate.effective)
                }
            }?.value
    }
}

/** The answer of [ExchangeRateTable.rateAt] (platform-kernel.md §9). */
sealed interface RateLookup {
    /** The rate effective at the instant. */
    data class Found(
        val rate: ExchangeRate,
    ) : RateLookup

    /** No rate of the pair is effective at the instant. */
    data object NoRateEffective : RateLookup
}

/** The outcome of building an [ExchangeRateTable] (platform-kernel.md §9). */
sealed interface ExchangeRateTableResult {
    /** A valid table. */
    data class Valid(
        val table: ExchangeRateTable,
    ) : ExchangeRateTableResult

    /** Two rates of the pair [from] to [to] have overlapping effective periods. */
    data class OverlappingPeriods(
        val from: Currency,
        val to: Currency,
    ) : ExchangeRateTableResult
}
