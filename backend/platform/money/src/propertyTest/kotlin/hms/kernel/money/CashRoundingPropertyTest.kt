package hms.kernel.money

import hms.kernel.testing.PropertyTestBudget
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import io.kotest.property.Arb
import io.kotest.property.arbitrary.element
import io.kotest.property.arbitrary.long
import io.kotest.property.checkAll
import java.math.RoundingMode
import java.util.Currency

/**
 * `PropertyTest:cash-rounding-multiple-of-increment` (platform-kernel.md §9, §17). Increments are synthetic;
 * the kernel has no default increment or mode (L-14, OQ-KN7).
 */
class CashRoundingPropertyTest :
    FunSpec({
        val iqd = Currency.getInstance("IQD")
        val usd = Currency.getInstance("USD")
        val currencies = Arb.element(iqd, usd)
        val amounts = Arb.long(-1_000_000_000_000_000L..1_000_000_000_000_000L)
        val increments = Arb.long(1L..10_000_000L)
        val modes = Arb.element(RoundingMode.entries.filter { it != RoundingMode.UNNECESSARY })

        test("cash-rounding-multiple-of-increment: payable is a whole multiple of the increment and payable = amount + difference") {
            checkAll(PropertyTestBudget.sequences(), currencies, amounts, increments, modes) { currency, units, step, mode ->
                val amount = Money.ofMinorUnits(units, currency)
                val increment = Money.ofMinorUnits(step, currency)
                val policy = CashRoundingPolicy.toIncrement(increment, mode).shouldBeInstanceOf<CashRoundingPolicyResult.Valid>().policy
                val outcome = policy.round(amount).shouldBeInstanceOf<CashRoundingOutcome.Rounded>()

                outcome.payable.amount.remainder(increment.amount).signum() shouldBe 0
                outcome.payable shouldBe amount + outcome.difference
                (outcome.difference.amount.abs() < increment.amount) shouldBe true
                val expected = amount.amount.divide(increment.amount, 0, mode).multiply(increment.amount)
                outcome.payable.amount.compareTo(expected) shouldBe 0
            }
        }

        test("cash-rounding-multiple-of-increment: NotConfigured returns NotConfigured") {
            checkAll(PropertyTestBudget.sequences(), currencies, amounts) { currency, units ->
                CashRoundingPolicy.NotConfigured.round(Money.ofMinorUnits(units, currency)) shouldBe CashRoundingOutcome.NotConfigured
            }
        }

        test("cash-rounding-multiple-of-increment: a non-positive increment is refused") {
            checkAll(PropertyTestBudget.sequences(), currencies, Arb.long(-10_000_000L..0L), modes) { currency, step, mode ->
                CashRoundingPolicy.toIncrement(Money.ofMinorUnits(step, currency), mode) shouldBe
                    CashRoundingPolicyResult.IncrementNotPositive
            }
        }

        test("cash-rounding-multiple-of-increment: an amount in another currency throws") {
            checkAll(PropertyTestBudget.sequences(), amounts, increments, modes) { units, step, mode ->
                val result = CashRoundingPolicy.toIncrement(Money.ofMinorUnits(step, iqd), mode)
                val policy = result.shouldBeInstanceOf<CashRoundingPolicyResult.Valid>().policy
                shouldThrow<IllegalArgumentException> { policy.round(Money.ofMinorUnits(units, usd)) }
            }
        }
    })
