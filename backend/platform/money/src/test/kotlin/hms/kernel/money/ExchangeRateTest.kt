package hms.kernel.money

import hms.kernel.time.RecordedTime
import hms.kernel.time.ValidPeriod
import hms.kernel.time.ValidPeriodResult
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.Currency

/**
 * `UnitTest:exchange-rate-effective-at-instant` (platform-kernel.md §9, §17) and the [ExchangeRate] factory.
 * Rates, sources and dates are synthetic, not real market data.
 */
class ExchangeRateTest :
    FunSpec({
        val iqd = Currency.getInstance("IQD")
        val usd = Currency.getInstance("USD")
        val eur = Currency.getInstance("EUR")
        val recordedAt = RecordedTime.now(Clock.fixed(Instant.parse("2026-01-01T00:00:00Z"), ZoneOffset.UTC))
        val jan = Instant.parse("2026-01-01T00:00:00Z")
        val feb = Instant.parse("2026-02-01T00:00:00Z")
        val mar = Instant.parse("2026-03-01T00:00:00Z")

        fun period(
            start: Instant,
            end: Instant,
        ): ValidPeriod = (ValidPeriod.of(start, end) as ValidPeriodResult.Valid).period

        fun rate(
            value: String,
            effective: ValidPeriod,
            from: Currency = usd,
            to: Currency = iqd,
        ): ExchangeRate =
            ExchangeRate
                .of(from, to, BigDecimal(value), effective, "synthetic-test-source", recordedAt)
                .shouldBeInstanceOf<ExchangeRateResult.Valid>()
                .rate

        fun table(vararg rates: ExchangeRate): ExchangeRateTable =
            ExchangeRateTable.of(rates.toList()).shouldBeInstanceOf<ExchangeRateTableResult.Valid>().table

        val january = rate("1300", period(jan, feb))
        val february = rate("1310.5", period(feb, mar))
        val open = rate("1320", ValidPeriod.from(mar))

        context("exchange-rate-effective-at-instant") {
            test("exchange-rate-effective-at-instant: rateAt picks the period containing the instant, half-open") {
                val rates = table(january, february, open)
                rates.rateAt(usd, iqd, jan) shouldBe RateLookup.Found(january)
                rates.rateAt(usd, iqd, feb.minusNanos(1_000)) shouldBe RateLookup.Found(january)
                rates.rateAt(usd, iqd, feb) shouldBe RateLookup.Found(february)
                rates.rateAt(usd, iqd, mar) shouldBe RateLookup.Found(open)
                rates.rateAt(usd, iqd, Instant.parse("2099-12-31T23:59:59Z")) shouldBe RateLookup.Found(open)
            }

            test("exchange-rate-effective-at-instant: no rate effective gives NoRateEffective") {
                val rates = table(january, february)
                rates.rateAt(usd, iqd, jan.minusSeconds(1)) shouldBe RateLookup.NoRateEffective
                rates.rateAt(usd, iqd, mar) shouldBe RateLookup.NoRateEffective
                rates.rateAt(iqd, usd, jan) shouldBe RateLookup.NoRateEffective
                rates.rateAt(eur, iqd, jan) shouldBe RateLookup.NoRateEffective
                table().rateAt(usd, iqd, jan) shouldBe RateLookup.NoRateEffective
            }

            test("exchange-rate-effective-at-instant: overlapping periods for one pair are refused") {
                val overlapping = rate("1305", period(jan.plusSeconds(86_400), feb.plusSeconds(86_400)))
                ExchangeRateTable.of(listOf(january, february, overlapping)) shouldBe ExchangeRateTableResult.OverlappingPeriods(usd, iqd)
                ExchangeRateTable.of(listOf(open, rate("1", ValidPeriod.from(jan)))) shouldBe
                    ExchangeRateTableResult.OverlappingPeriods(usd, iqd)
            }

            test("exchange-rate-effective-at-instant: other pairs and the reverse direction may share a period") {
                val reverse = rate("0.00077", period(jan, feb), from = iqd, to = usd)
                val euro = rate("1400", period(jan, feb), from = eur)
                val rates = table(january, reverse, euro)
                rates.rateAt(iqd, usd, jan) shouldBe RateLookup.Found(reverse)
                rates.rateAt(eur, iqd, jan) shouldBe RateLookup.Found(euro)
            }

            test("exchange-rate-effective-at-instant: conversion uses the explicit rounding mode and the target scale") {
                february.convert(Money.ofMinorUnits(1_001, usd), RoundingMode.HALF_UP) shouldBe Money.ofMinorUnits(13_118_105, iqd)
                val third = rate("0.333", period(jan, feb), from = iqd, to = usd)
                third.convert(Money.ofMinorUnits(1_005, iqd), RoundingMode.HALF_UP) shouldBe Money.ofMinorUnits(33, usd)
                third.convert(Money.ofMinorUnits(1_005, iqd), RoundingMode.DOWN) shouldBe Money.ofMinorUnits(33, usd)
                third.convert(Money.ofMinorUnits(1_520, iqd), RoundingMode.HALF_UP) shouldBe Money.ofMinorUnits(51, usd)
                third.convert(Money.ofMinorUnits(1_520, iqd), RoundingMode.DOWN) shouldBe Money.ofMinorUnits(50, usd)
                third.convert(Money.ofMinorUnits(1_000, iqd), RoundingMode.UP).amount.scale() shouldBe 2
            }

            test("exchange-rate-effective-at-instant: convertBack divides by the rate with the explicit rounding mode") {
                january.convertBack(Money.ofMinorUnits(1_000_000, iqd), RoundingMode.HALF_UP) shouldBe Money.ofMinorUnits(77, usd)
                january.convertBack(Money.ofMinorUnits(1_000_000, iqd), RoundingMode.UP) shouldBe Money.ofMinorUnits(77, usd)
                january.convertBack(Money.ofMinorUnits(1_000_000, iqd), RoundingMode.DOWN) shouldBe Money.ofMinorUnits(76, usd)
                january.convertBack(Money.ofMinorUnits(13_000_000, iqd), RoundingMode.UNNECESSARY) shouldBe Money.ofMinorUnits(1_000, usd)
            }

            test("exchange-rate-effective-at-instant: converting an amount in the wrong currency throws") {
                shouldThrow<IllegalArgumentException> { january.convert(Money.ofMinorUnits(1, iqd), RoundingMode.HALF_UP) }
                shouldThrow<IllegalArgumentException> { january.convertBack(Money.ofMinorUnits(1, usd), RoundingMode.HALF_UP) }
            }
        }

        test("the factory refuses the same currency, a non-positive rate, a blank source and a currency without minor units") {
            val effective = period(jan, feb)
            ExchangeRate.of(usd, usd, BigDecimal.ONE, effective, "s", recordedAt) shouldBe
                ExchangeRateResult.Refused(ExchangeRateRefusal.SAME_CURRENCY)
            ExchangeRate.of(usd, iqd, BigDecimal.ZERO, effective, "s", recordedAt) shouldBe
                ExchangeRateResult.Refused(ExchangeRateRefusal.RATE_NOT_POSITIVE)
            ExchangeRate.of(usd, iqd, BigDecimal("-1"), effective, "s", recordedAt) shouldBe
                ExchangeRateResult.Refused(ExchangeRateRefusal.RATE_NOT_POSITIVE)
            ExchangeRate.of(usd, iqd, BigDecimal.ONE, effective, " ", recordedAt) shouldBe
                ExchangeRateResult.Refused(ExchangeRateRefusal.SOURCE_MISSING)
            ExchangeRate.of(usd, Currency.getInstance("XXX"), BigDecimal.ONE, effective, "s", recordedAt) shouldBe
                ExchangeRateResult.Refused(ExchangeRateRefusal.CURRENCY_HAS_NO_MINOR_UNITS)
        }

        test("a valid rate keeps what it was given") {
            february.from shouldBe usd
            february.to shouldBe iqd
            february.rate shouldBe BigDecimal("1310.5")
            february.effective shouldBe period(feb, mar)
            february.source shouldBe "synthetic-test-source"
            february.recordedAt shouldBe recordedAt
        }
    })
