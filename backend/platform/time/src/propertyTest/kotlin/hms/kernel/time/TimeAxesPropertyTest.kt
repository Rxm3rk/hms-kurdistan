package hms.kernel.time

import hms.kernel.testing.PropertyTestBudget
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.property.Arb
import io.kotest.property.arbitrary.arbitrary
import io.kotest.property.arbitrary.choice
import io.kotest.property.arbitrary.int
import io.kotest.property.arbitrary.long
import io.kotest.property.arbitrary.map
import io.kotest.property.arbitrary.orNull
import io.kotest.property.checkAll
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.time.temporal.ChronoUnit

// Years 0004 to 9995, so that every offset keeps the local year within RFC 3339's four digits.
private const val MIN_EPOCH_SECOND = -62_000_000_000L
private const val MAX_EPOCH_SECOND = 253_000_000_000L
private const val MAX_NANO = 999_999_999L
private const val MAX_OFFSET_QUARTERS = 72
private const val SECONDS_PER_QUARTER_HOUR = 900
private const val MAX_SPAN_NANOS = 5_000L
private const val NANOS_PER_MICRO = 1_000L
private const val NEAR_PERIOD_NANOS = 3_000_000L

/** The two time axes: truncation, offsets, half-open periods (platform-kernel.md §6.1, §17). */
class TimeAxesPropertyTest :
    FunSpec({
        val budget = PropertyTestBudget.sequences()
        val instants =
            arbitrary { Instant.ofEpochSecond(Arb.long(MIN_EPOCH_SECOND..MAX_EPOCH_SECOND).bind(), Arb.long(0L..MAX_NANO).bind()) }
        // Bounds close together, so that truncation decides emptiness often.
        val nearInstants =
            arbitrary {
                val base = instants.bind()
                base to base.plusNanos(Arb.long(-MAX_SPAN_NANOS..MAX_SPAN_NANOS).bind())
            }
        val offsets = Arb.int(-MAX_OFFSET_QUARTERS..MAX_OFFSET_QUARTERS).map { ZoneOffset.ofTotalSeconds(it * SECONDS_PER_QUARTER_HOUR) }

        test("recorded-and-clinical-time-round-trip-microseconds: values survive truncation; restore equals now at that instant") {
            checkAll(budget, instants, offsets) { instant, offset ->
                val micros = instant.truncatedTo(ChronoUnit.MICROS)
                val recorded = RecordedTime.now(Clock.fixed(instant, offset))
                recorded.instant shouldBe micros

                @OptIn(PersistenceOnly::class)
                val restored = RecordedTime.restore(instant)
                restored shouldBe recorded

                @OptIn(PersistenceOnly::class)
                val reread = RecordedTime.restore(recorded.instant)
                reread shouldBe recorded

                val clinical = ClinicalTime.of(instant, offset)
                clinical.instant shouldBe micros
                clinical.offset shouldBe offset
                ClinicalTime.of(clinical.instant, ZoneOffset.ofTotalSeconds(clinical.offset.totalSeconds)) shouldBe clinical
                ClinicalTime.of(clinical.toOffsetDateTime()) shouldBe clinical
                ClinicalTime.parse(clinical.toString()) shouldBe ClinicalTimeParseResult.Valid(clinical)
            }
        }

        test("valid-period-half-open: contains start, not end; empty and reversed refused after truncation") {
            checkAll(budget, Arb.choice(nearInstants, arbitrary { instants.bind() to instants.bind() })) { (a, b) ->
                val start = a.truncatedTo(ChronoUnit.MICROS)
                val end = b.truncatedTo(ChronoUnit.MICROS)
                when (val result = ValidPeriod.of(a, b)) {
                    ValidPeriodResult.EmptyOrReversed -> end.isAfter(start) shouldBe false
                    is ValidPeriodResult.Valid -> {
                        val period = result.period
                        (period.start to period.endExclusive) shouldBe (start to end)
                        period.contains(start) shouldBe true
                        period.contains(end) shouldBe false
                        period.contains(end.minusNanos(1)) shouldBe true
                        period.contains(start.minusNanos(1)) shouldBe false
                        period.overlaps(period) shouldBe true
                        ValidPeriod.from(end).overlaps(period) shouldBe false
                        (ValidPeriod.of(end, end.plusSeconds(1)) as ValidPeriodResult.Valid).period.overlaps(period) shouldBe false
                    }
                }
            }
        }

        test("valid-period-half-open: overlaps is symmetric and agrees with a shared instant") {
            val periods =
                arbitrary {
                    val start = instants.bind()
                    val length = Arb.long(1L..MAX_SPAN_NANOS).orNull(nullProbability = 0.2).bind()
                    if (length == null) {
                        ValidPeriod.from(start)
                    } else {
                        (ValidPeriod.of(start, start.plusNanos(length * NANOS_PER_MICRO)) as ValidPeriodResult.Valid).period
                    }
                }
            val nearPeriods =
                arbitrary {
                    val first = periods.bind()
                    val shift = Arb.long(-MAX_SPAN_NANOS..MAX_SPAN_NANOS).bind() * NANOS_PER_MICRO
                    val second = ValidPeriod.of(first.start.plusNanos(shift), first.start.plusNanos(shift + NEAR_PERIOD_NANOS))
                    first to (second as ValidPeriodResult.Valid).period
                }
            checkAll(budget, nearPeriods) { (p, q) ->
                p.overlaps(q) shouldBe q.overlaps(p)
                val latestStart = maxOf(p.start, q.start)
                val earliestEnd = listOfNotNull(p.endExclusive, q.endExclusive).minOrNull()
                p.overlaps(q) shouldBe (earliestEnd == null || latestStart.isBefore(earliestEnd))
                p.overlaps(q) shouldBe (p.contains(latestStart) && q.contains(latestStart))
            }
        }

        test("valid-time-keeps-offsets-and-maps-to-period: offsets and instants kept; empty and reversed refused") {
            checkAll(budget, nearInstants, offsets, offsets) { (a, b), startOffset, endOffset ->
                val start = ClinicalTime.of(a, startOffset)
                val end = ClinicalTime.of(b, endOffset)
                when (val result = ValidTime.of(start, end)) {
                    ValidTimeResult.EmptyOrReversed -> end.instant.isAfter(start.instant) shouldBe false
                    is ValidTimeResult.Valid -> {
                        val validTime = result.validTime
                        validTime.start.offset shouldBe startOffset
                        validTime.endExclusive?.offset shouldBe endOffset
                        val period = validTime.toValidPeriod()
                        (period.start to period.endExclusive) shouldBe (start.instant to end.instant)
                    }
                }
                ValidTime.from(start).toValidPeriod() shouldBe ValidPeriod.from(a)
            }
        }
    })
