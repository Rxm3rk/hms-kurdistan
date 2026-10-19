package hms.kernel.money

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import java.lang.reflect.InvocationTargetException
import java.math.BigDecimal
import java.math.RoundingMode
import java.util.Currency

/** Unit tests for [Money] (platform-kernel.md §9, §17). Synthetic amounts only. */
class MoneyTest :
    FunSpec({
        val iqd = Currency.getInstance("IQD")
        val usd = Currency.getInstance("USD")
        // ISO 4217 code for "no currency": the JDK gives it no minor units (-1).
        val noMinorUnits = Currency.getInstance("XXX")

        fun usd(text: String): Money = (Money.ofExact(BigDecimal(text), usd) as MoneyResult.Valid).money

        fun iqd(text: String): Money = (Money.ofExact(BigDecimal(text), iqd) as MoneyResult.Valid).money

        context("money-minor-units-from-iso4217") {
            test("money-minor-units-from-iso4217: the JDK's minor units for IQD and USD match ISO 4217") {
                // Expected values from the ISO 4217 maintenance agency's list one, published 2026-09-17:
                // IRAQ, Iraqi Dinar, IQD 368, minor units 3; US Dollar, USD 840, minor units 2; XXX, minor units N.A.
                iqd.defaultFractionDigits shouldBe 3
                usd.defaultFractionDigits shouldBe 2
                noMinorUnits.defaultFractionDigits shouldBe -1
            }

            test("money-minor-units-from-iso4217: the scale always equals the currency's minor units") {
                Money.zero(iqd).amount.scale() shouldBe 3
                Money.zero(usd).amount.scale() shouldBe 2
                Money.ofMinorUnits(12_345, usd).amount shouldBe BigDecimal("123.45")
                Money.ofMinorUnits(-7, iqd).amount shouldBe BigDecimal("-0.007")
                (Money.ofRounded(BigDecimal("1"), iqd, RoundingMode.HALF_EVEN) as MoneyResult.Valid).money.amount.scale() shouldBe 3
            }

            test("money-minor-units-from-iso4217: ofExact pads a shorter scale with zeros") {
                usd("5").amount shouldBe BigDecimal("5.00")
                usd("1.5").amount shouldBe BigDecimal("1.50")
                iqd("250").amount shouldBe BigDecimal("250.000")
                (Money.ofExact(BigDecimal("1E+3"), usd) as MoneyResult.Valid).money.amount shouldBe BigDecimal("1000.00")
            }

            test("money-minor-units-from-iso4217: ofExact refuses more decimals than the currency has") {
                Money.ofExact(BigDecimal("1.505"), usd) shouldBe MoneyResult.Refused(MoneyRefusal.MORE_DECIMALS_THAN_THE_CURRENCY_HAS)
                Money.ofExact(BigDecimal("0.0001"), iqd) shouldBe MoneyResult.Refused(MoneyRefusal.MORE_DECIMALS_THAN_THE_CURRENCY_HAS)
            }

            test("money-minor-units-from-iso4217: a currency without minor units is refused by the factories for input") {
                Money.ofExact(BigDecimal.ONE, noMinorUnits) shouldBe MoneyResult.Refused(MoneyRefusal.CURRENCY_HAS_NO_MINOR_UNITS)
                Money.ofRounded(BigDecimal.ONE, noMinorUnits, RoundingMode.HALF_UP) shouldBe
                    MoneyResult.Refused(MoneyRefusal.CURRENCY_HAS_NO_MINOR_UNITS)
            }

            test("money-minor-units-from-iso4217: zero and ofMinorUnits throw for a currency without minor units") {
                shouldThrow<IllegalArgumentException> { Money.zero(noMinorUnits) }
                shouldThrow<IllegalArgumentException> { Money.ofMinorUnits(1, noMinorUnits) }
            }
        }

        test("ofRounded rounds with the given mode and refuses UNNECESSARY when it would round") {
            (Money.ofRounded(BigDecimal("1.005"), usd, RoundingMode.HALF_UP) as MoneyResult.Valid).money shouldBe usd("1.01")
            (Money.ofRounded(BigDecimal("1.005"), usd, RoundingMode.HALF_EVEN) as MoneyResult.Valid).money shouldBe usd("1.00")
            (Money.ofRounded(BigDecimal("-1.005"), usd, RoundingMode.FLOOR) as MoneyResult.Valid).money shouldBe usd("-1.01")
            Money.ofRounded(BigDecimal("1.005"), usd, RoundingMode.UNNECESSARY) shouldBe
                MoneyResult.Refused(MoneyRefusal.MORE_DECIMALS_THAN_THE_CURRENCY_HAS)
            (Money.ofRounded(BigDecimal("1.0100"), usd, RoundingMode.UNNECESSARY) as MoneyResult.Valid).money shouldBe usd("1.01")
        }

        test("a reflective constructor call with an invalid scale or currency throws IllegalArgumentException") {
            val constructor = Money::class.java.getDeclaredConstructor(BigDecimal::class.java, Currency::class.java)
            constructor.isAccessible = true
            shouldThrow<InvocationTargetException> { constructor.newInstance(BigDecimal("1.5"), usd) }
                .cause
                .shouldBeInstanceOf<IllegalArgumentException>()
            shouldThrow<InvocationTargetException> { constructor.newInstance(BigDecimal("1"), noMinorUnits) }
                .cause
                .shouldBeInstanceOf<IllegalArgumentException>()
        }

        test("exact operations keep the scale and never round") {
            (usd("10.25") + usd("0.75")) shouldBe usd("11.00")
            (usd("10.25") - usd("20.50")) shouldBe usd("-10.25")
            (-usd("3.10")) shouldBe usd("-3.10")
            usd("3.10").times(3) shouldBe usd("9.30")
            usd("3.10").times(-2) shouldBe usd("-6.20")
            usd("0").isZero shouldBe true
            usd("-0.01").signum shouldBe -1
            usd("0.01").signum shouldBe 1
        }

        test("times by a factor rounds to the minor units with the given mode") {
            usd("10.00").times(BigDecimal("0.333"), RoundingMode.HALF_UP) shouldBe usd("3.33")
            usd("10.00").times(BigDecimal("0.335"), RoundingMode.HALF_EVEN) shouldBe usd("3.35")
            iqd("1000").times(BigDecimal("0.0015"), RoundingMode.DOWN) shouldBe iqd("1.5")
        }

        test("a currency mismatch is a programming error and throws") {
            shouldThrow<IllegalArgumentException> { usd("1") + iqd("1") }
            shouldThrow<IllegalArgumentException> { usd("1") - iqd("1") }
            shouldThrow<IllegalArgumentException> { usd("1").compareTo(iqd("1")) }
        }

        test("compareTo orders by amount within one currency and agrees with equals") {
            (usd("1.00") < usd("1.01")) shouldBe true
            usd("2").compareTo(usd("2.00")) shouldBe 0
            usd("2") shouldBe usd("2.00")
            usd("2").hashCode() shouldBe usd("2.00").hashCode()
            usd("2").toString() shouldBe "USD 2.00"
        }

        test("split gives the remainder to the lowest indices and keeps negative amounts exact") {
            usd("1.00").split(3) shouldBe listOf(usd("0.34"), usd("0.33"), usd("0.33"))
            usd("-1.00").split(3) shouldBe listOf(usd("-0.34"), usd("-0.33"), usd("-0.33"))
            usd("0.02").split(3) shouldBe listOf(usd("0.01"), usd("0.01"), usd("0.00"))
            shouldThrow<IllegalArgumentException> { usd("1").split(0) }
        }

        test("allocate gives each share its floor and the rest to the largest remainders") {
            val weights = listOf(BigDecimal("1"), BigDecimal("2"), BigDecimal("0"), BigDecimal("3"))
            // 100 minor units: exact shares 16.67, 33.33, 0, 50; floors 16, 33, 0, 50; one left goes to index 0.
            usd("1.00").allocate(weights) shouldBe listOf(usd("0.17"), usd("0.33"), usd("0.00"), usd("0.50"))
            // Ties go to the lower index: 0.05 over two equal weights.
            usd("0.05").allocate(listOf(BigDecimal("0.5"), BigDecimal("0.5"))) shouldBe listOf(usd("0.03"), usd("0.02"))
        }

        test("allocate refuses empty, negative and all-zero weights") {
            shouldThrow<IllegalArgumentException> { usd("1").allocate(emptyList()) }
            shouldThrow<IllegalArgumentException> { usd("1").allocate(listOf(BigDecimal.ONE, BigDecimal("-1"))) }
            shouldThrow<IllegalArgumentException> { usd("1").allocate(listOf(BigDecimal.ZERO, BigDecimal.ZERO)) }
        }
    })
