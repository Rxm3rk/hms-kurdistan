package hms.kernel.money

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import java.lang.reflect.InvocationTargetException
import java.math.RoundingMode
import java.util.Currency

/**
 * Unit tests for [CashRoundingPolicy] (platform-kernel.md §9). The increment of IQD 250 is a synthetic example
 * (K §8 names it as an example only, L-14), never a default.
 */
class CashRoundingTest :
    FunSpec({
        val iqd = Currency.getInstance("IQD")
        val usd = Currency.getInstance("USD")
        val increment = Money.ofMinorUnits(250_000, iqd)

        fun policy(rounding: RoundingMode): CashRoundingPolicy.ToIncrement =
            (CashRoundingPolicy.toIncrement(increment, rounding) as CashRoundingPolicyResult.Valid).policy

        fun dinars(whole: Long): Money = Money.ofMinorUnits(whole * 1_000, iqd)

        test("rounds to the increment with the given mode and keeps the difference") {
            policy(RoundingMode.HALF_UP).round(dinars(1_130)) shouldBe CashRoundingOutcome.Rounded(dinars(1_250), dinars(120))
            policy(RoundingMode.HALF_UP).round(dinars(1_120)) shouldBe CashRoundingOutcome.Rounded(dinars(1_000), dinars(-120))
            policy(RoundingMode.HALF_UP).round(dinars(1_125)) shouldBe CashRoundingOutcome.Rounded(dinars(1_250), dinars(125))
            policy(RoundingMode.HALF_EVEN).round(dinars(1_125)) shouldBe CashRoundingOutcome.Rounded(dinars(1_000), dinars(-125))
            policy(RoundingMode.DOWN).round(dinars(1_249)) shouldBe CashRoundingOutcome.Rounded(dinars(1_000), dinars(-249))
            policy(RoundingMode.CEILING).round(dinars(-1_249)) shouldBe CashRoundingOutcome.Rounded(dinars(-1_000), dinars(249))
            policy(RoundingMode.UP).round(dinars(1_500)) shouldBe CashRoundingOutcome.Rounded(dinars(1_500), dinars(0))
        }

        test("NotConfigured is a value and answers NotConfigured for any currency") {
            CashRoundingPolicy.NotConfigured.round(dinars(1_130)) shouldBe CashRoundingOutcome.NotConfigured
            CashRoundingPolicy.NotConfigured.round(Money.ofMinorUnits(1, usd)) shouldBe CashRoundingOutcome.NotConfigured
        }

        test("a zero or negative increment is refused") {
            CashRoundingPolicy.toIncrement(Money.zero(iqd), RoundingMode.HALF_UP) shouldBe CashRoundingPolicyResult.IncrementNotPositive
            CashRoundingPolicy.toIncrement(-increment, RoundingMode.HALF_UP) shouldBe CashRoundingPolicyResult.IncrementNotPositive
        }

        test("rounding an amount in another currency throws") {
            shouldThrow<IllegalArgumentException> { policy(RoundingMode.HALF_UP).round(Money.ofMinorUnits(100, usd)) }
        }

        test("a reflective constructor call with a non-positive increment throws IllegalArgumentException") {
            val constructor =
                CashRoundingPolicy.ToIncrement::class.java.getDeclaredConstructor(Money::class.java, RoundingMode::class.java)
            constructor.isAccessible = true
            val thrown = shouldThrow<InvocationTargetException> { constructor.newInstance(Money.zero(iqd), RoundingMode.HALF_UP) }
            (thrown.cause is IllegalArgumentException) shouldBe true
        }

        test("policies with the same increment and mode are equal") {
            policy(RoundingMode.HALF_UP) shouldBe policy(RoundingMode.HALF_UP)
            policy(RoundingMode.HALF_UP).hashCode() shouldBe policy(RoundingMode.HALF_UP).hashCode()
        }
    })
