package hms.kernel.money

import hms.kernel.testing.PropertyTestBudget
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.property.Arb
import io.kotest.property.arbitrary.bind
import io.kotest.property.arbitrary.element
import io.kotest.property.arbitrary.int
import io.kotest.property.arbitrary.list
import io.kotest.property.arbitrary.long
import io.kotest.property.checkAll
import java.math.BigDecimal
import java.util.Currency

/** Amounts up to 10^15 currency units, far beyond any bill. */
private const val MAX_MINOR_UNITS: Long = 1_000_000_000_000_000L

/** Weights are drawn as an unscaled value with up to [MAX_WEIGHT_SCALE] decimals. */
private const val MAX_WEIGHT_UNSCALED: Long = 1_000_000L
private const val MAX_WEIGHT_SCALE: Int = 4
private const val MAX_WEIGHTS: Int = 8

/** Counts for times(count) and parts for split. */
private const val MAX_COUNT: Int = 25
private const val MAX_PARTS: Int = 50

/**
 * `PropertyTest:money-arithmetic-exact` and `PropertyTest:money-allocation-sums-exactly` (platform-kernel.md §9, §17).
 * Synthetic amounts in IQD (3 minor units) and USD (2 minor units).
 */
class MoneyPropertyTest :
    FunSpec({
        val currencies = Arb.element(Currency.getInstance("IQD"), Currency.getInstance("USD"))
        val minorUnits = Arb.long(-MAX_MINOR_UNITS..MAX_MINOR_UNITS)
        val weight = Arb.bind(Arb.long(0L..MAX_WEIGHT_UNSCALED), Arb.int(0..MAX_WEIGHT_SCALE)) { unscaled, scale -> BigDecimal.valueOf(unscaled, scale) }
        val weights = Arb.list(weight, 1..MAX_WEIGHTS)

        test("money-arithmetic-exact: plus and minus are exact and associative") {
            checkAll(PropertyTestBudget.sequences(), currencies, minorUnits, minorUnits, minorUnits) { currency, a, b, c ->
                val x = Money.ofMinorUnits(a, currency)
                val y = Money.ofMinorUnits(b, currency)
                val z = Money.ofMinorUnits(c, currency)
                (x + y).amount shouldBe x.amount.add(y.amount)
                (x - y).amount shouldBe x.amount.subtract(y.amount)
                (x + y).amount.scale() shouldBe currency.defaultFractionDigits
                ((x + y) + z) shouldBe (x + (y + z))
                ((x + y) - y) shouldBe x
                (x - y) shouldBe (x + -y)
            }
        }

        test("money-arithmetic-exact: times(count) equals repeated plus") {
            checkAll(PropertyTestBudget.sequences(), currencies, minorUnits, Arb.int(-MAX_COUNT..MAX_COUNT)) { currency, units, count ->
                val money = Money.ofMinorUnits(units, currency)
                val step = if (count < 0) -money else money
                val repeated = (1..kotlin.math.abs(count)).fold(Money.zero(currency)) { sum, _ -> sum + step }
                money.times(count.toLong()) shouldBe repeated
            }
        }

        test("money-allocation-sums-exactly: shares sum to the amount, stay within one minor unit and are deterministic") {
            checkAll(PropertyTestBudget.sequences(), currencies, minorUnits, weights) { currency, units, drawn ->
                val positive = if (drawn.all { it.signum() == 0 }) listOf(BigDecimal.ONE) + drawn.drop(1) else drawn
                val money = Money.ofMinorUnits(units, currency)
                val shares = money.allocate(positive)

                shares.size shouldBe positive.size
                shares.fold(Money.zero(currency)) { sum, share -> sum + share } shouldBe money
                shares.all { it.currency == currency && it.amount.scale() == currency.defaultFractionDigits } shouldBe true

                // |share - amount * w / total| < 1 minor unit, i.e. |share * total - amount * w| < total, exactly.
                val total = positive.fold(BigDecimal.ZERO, BigDecimal::add)
                shares.zip(positive).forEach { (share, w) ->
                    val gap = BigDecimal(share.amount.unscaledValue()).multiply(total) - BigDecimal.valueOf(units).multiply(w)
                    (gap.abs() < total) shouldBe true
                }
                money.allocate(positive) shouldBe shares
            }
        }

        test("money-allocation-sums-exactly: split sums to the amount and its shares differ by at most one minor unit") {
            checkAll(PropertyTestBudget.sequences(), currencies, minorUnits, Arb.int(1..MAX_PARTS)) { currency, units, parts ->
                val money = Money.ofMinorUnits(units, currency)
                val shares = money.split(parts)
                shares.fold(Money.zero(currency)) { sum, share -> sum + share } shouldBe money
                val minor = shares.map { it.amount.unscaledValue() }
                ((minor.max() - minor.min()).abs() <= java.math.BigInteger.ONE) shouldBe true
            }
        }
    })
