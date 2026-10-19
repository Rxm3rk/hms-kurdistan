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

/**
 * `PropertyTest:money-arithmetic-exact` and `PropertyTest:money-allocation-sums-exactly` (platform-kernel.md §9, §17).
 * Synthetic amounts in IQD (3 minor units) and USD (2 minor units).
 */
class MoneyPropertyTest :
    FunSpec({
        val currencies = Arb.element(Currency.getInstance("IQD"), Currency.getInstance("USD"))
        val minorUnits = Arb.long(-1_000_000_000_000_000L..1_000_000_000_000_000L)
        val weight = Arb.bind(Arb.long(0L..1_000_000L), Arb.int(0..4)) { unscaled, scale -> BigDecimal.valueOf(unscaled, scale) }
        val weights = Arb.list(weight, 1..8)

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
            checkAll(PropertyTestBudget.sequences(), currencies, minorUnits, Arb.int(-25..25)) { currency, units, count ->
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
            checkAll(PropertyTestBudget.sequences(), currencies, minorUnits, Arb.int(1..50)) { currency, units, parts ->
                val money = Money.ofMinorUnits(units, currency)
                val shares = money.split(parts)
                shares.fold(Money.zero(currency)) { sum, share -> sum + share } shouldBe money
                val minor = shares.map { it.amount.unscaledValue() }
                ((minor.max() - minor.min()).abs() <= java.math.BigInteger.ONE) shouldBe true
            }
        }
    })
