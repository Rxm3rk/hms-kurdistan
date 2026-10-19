package hms.kernel.time

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import java.time.Instant
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.ZoneOffset

/** ClinicalTime, ValidTime and their offsets (platform-kernel.md §6.1, §14; SI-10). */
class ClinicalTimeTest :
    FunSpec({
        fun parsed(text: String): ClinicalTime = (ClinicalTime.parse(text) as ClinicalTimeParseResult.Valid).time

        fun error(text: String): ClinicalTimeParseError = (ClinicalTime.parse(text) as ClinicalTimeParseResult.Invalid).error

        // A persistence mapping fixture as section 14 describes: timestamptz plus integer offset seconds.
        data class Row(
            val instant: Instant,
            val offsetSeconds: Int,
        )

        fun write(time: ClinicalTime) = Row(time.instant, time.offset.totalSeconds)

        fun read(row: Row) = ClinicalTime.of(row.instant, ZoneOffset.ofTotalSeconds(row.offsetSeconds))

        test("clinical-time-offset-round-trip: a ClinicalTime keeps its offset through toOffsetDateTime, parse and the mapping fixture") {
            listOf("2026-10-19T08:15:30.123456+03:00", "2026-03-29T01:30:00-04:30", "2026-01-01T00:00:00Z", "2026-06-30T23:59:59.5+14:00")
                .forEach { text ->
                    val time = parsed(text)
                    time.toOffsetDateTime() shouldBe OffsetDateTime.parse(text)
                    parsed(time.toString()) shouldBe time
                    ClinicalTime.of(time.toOffsetDateTime()) shouldBe time
                    read(write(time)) shouldBe time
                    read(write(time)).offset shouldBe OffsetDateTime.parse(text).offset
                }
        }

        test("clinical-time-offset-round-trip: a ValidTime keeps both offsets") {
            val start = parsed("2026-10-19T08:00:00+03:00")
            val end = parsed("2026-10-19T07:30:00+01:00")
            val validTime = (ValidTime.of(start, end) as ValidTimeResult.Valid).validTime
            validTime.start.offset shouldBe ZoneOffset.ofHours(3)
            validTime.endExclusive?.offset shouldBe ZoneOffset.ofHours(1)
            read(write(validTime.start)) shouldBe start
            validTime.endExclusive?.let { read(write(it)) } shouldBe end
            validTime.toValidPeriod().start shouldBe start.instant
            validTime.toValidPeriod().endExclusive shouldBe end.instant
        }

        test("clinical-time-parse-strict: valid RFC 3339 forms are accepted and truncated to microseconds") {
            parsed("2026-10-19T08:00:00Z").offset shouldBe ZoneOffset.UTC
            parsed("2026-10-19t08:00:00z").offset shouldBe ZoneOffset.UTC
            parsed("2026-10-19T08:00:00+00:00").offset shouldBe ZoneOffset.UTC
            parsed("2026-10-19T08:00:00.1234567891+03:00").instant shouldBe Instant.parse("2026-10-19T05:00:00.123456Z")
            parsed("2024-02-29T12:00:00-18:00").offset shouldBe ZoneOffset.ofHours(-18)
            parsed("0000-01-01T00:00:00+18:00").instant shouldBe OffsetDateTime.parse("0000-01-01T00:00:00+18:00").toInstant()
        }

        test("clinical-time-parse-strict: the offset is required") {
            error("2026-10-19T08:00:00") shouldBe ClinicalTimeParseError.OFFSET_MISSING
            error("2026-10-19T08:00:00.5") shouldBe ClinicalTimeParseError.OFFSET_MISSING
            error("2026-10-19T08:00:00-00:00") shouldBe ClinicalTimeParseError.OFFSET_MISSING
        }

        test("clinical-time-parse-strict: offsets with seconds are refused") {
            error("2026-10-19T08:00:00+03:00:30") shouldBe ClinicalTimeParseError.OFFSET_HAS_SECONDS
            error("1880-01-01T08:00:00+02:57:40") shouldBe ClinicalTimeParseError.OFFSET_HAS_SECONDS
            shouldThrow<IllegalArgumentException> {
                ClinicalTime.of(Instant.parse("1880-01-01T05:00:00Z"), ZoneOffset.ofHoursMinutesSeconds(2, 57, 40))
            }
            shouldThrow<IllegalArgumentException> {
                ClinicalTime.of(OffsetDateTime.of(LocalDateTime.of(1880, 1, 1, 8, 0), ZoneOffset.ofTotalSeconds(10_660)))
            }
        }

        test("clinical-time-parse-strict: malformed text is refused") {
            listOf(
                "",
                "2026-10-19",
                "2026-10-19 08:00:00Z",
                "2026-10-19T08:00Z",
                "2026-10-19T8:00:00Z",
                "26-10-19T08:00:00Z",
                "2026-10-19T08:00:00.Z",
                "2026-10-19T08:00:00+0300",
                "2026-10-19T08:00:00+3:00",
                "2026-10-19T08:00:00+03:60",
                "2026-10-19T08:00:00+24:00",
                "2026-10-19T08:00:00 +03:00",
                " 2026-10-19T08:00:00Z",
                "2026-10-19T08:00:00ZZ",
                "2026-13-19T08:00:00Z",
                "2026-02-30T08:00:00Z",
                "2026-10-19T24:00:00Z",
                "2026-10-19T08:60:00Z",
                "+2026-10-19T08:00:00Z",
                "２０２６-10-19T08:00:00Z",
                "٢٠٢٦-10-19T08:00:00Z",
                "2026-10-19T08:00:00+03:00[Asia/Baghdad]",
            ).forEach { text -> (text to error(text)) shouldBe (text to ClinicalTimeParseError.MALFORMED) }
        }

        test("clinical-time-parse-strict: RFC 3339 values java.time cannot hold are out of range") {
            error("2026-12-31T23:59:60Z") shouldBe ClinicalTimeParseError.OUT_OF_RANGE
            error("2026-10-19T08:00:00+19:00") shouldBe ClinicalTimeParseError.OUT_OF_RANGE
            error("2026-10-19T08:00:00-18:01") shouldBe ClinicalTimeParseError.OUT_OF_RANGE
        }

        // Fixture zone with DST transitions in the JDK data; not a claim about any Kurdistan rule.
        val fixtureZone = ZoneId.of("Europe/Berlin")

        test("clinical-time-dst-gap-and-overlap-not-guessed: a time in the spring gap is InGap") {
            val local = LocalDateTime.of(2026, 3, 29, 2, 30)
            ClinicalTime.resolveLocal(local, fixtureZone) shouldBe LocalTimeResolution.InGap(local, fixtureZone)
        }

        test("clinical-time-dst-gap-and-overlap-not-guessed: a time in the autumn overlap returns both candidates") {
            val local = LocalDateTime.of(2026, 10, 25, 2, 30)
            val result = ClinicalTime.resolveLocal(local, fixtureZone).shouldBeInstanceOf<LocalTimeResolution.Ambiguous>()
            result.earlier shouldBe ClinicalTime.of(Instant.parse("2026-10-25T00:30:00Z"), ZoneOffset.ofHours(2))
            result.later shouldBe ClinicalTime.of(Instant.parse("2026-10-25T01:30:00Z"), ZoneOffset.ofHours(1))
        }

        test("clinical-time-dst-gap-and-overlap-not-guessed: an ordinary time resolves, also in a zone without DST") {
            ClinicalTime.resolveLocal(LocalDateTime.of(2026, 10, 19, 8, 0), fixtureZone) shouldBe
                LocalTimeResolution.Resolved(ClinicalTime.of(Instant.parse("2026-10-19T06:00:00Z"), ZoneOffset.ofHours(2)))
            ClinicalTime.resolveLocal(LocalDateTime.of(2026, 10, 19, 8, 0, 0, 123_456_789), ZoneId.of("Asia/Baghdad")) shouldBe
                LocalTimeResolution.Resolved(ClinicalTime.of(Instant.parse("2026-10-19T05:00:00.123456Z"), ZoneOffset.ofHours(3)))
        }

        test("ClinicalTime: equality and order use the instant and the offset") {
            val a = parsed("2026-10-19T08:00:00+03:00")
            val b = parsed("2026-10-19T05:00:00Z")
            a.isSameInstantAs(b) shouldBe true
            (a == b) shouldBe false
            (a.compareTo(b) == 0) shouldBe false
            a.compareTo(parsed("2026-10-19T08:00:00+03:00")) shouldBe 0
            a.atZone(ZoneId.of("Asia/Baghdad")).toLocalDateTime() shouldBe LocalDateTime.of(2026, 10, 19, 8, 0)
        }

        test("ValidTime: empty and reversed are refused; an open end is allowed") {
            val start = parsed("2026-10-19T08:00:00+03:00")
            ValidTime.of(start, parsed("2026-10-19T05:00:00Z")) shouldBe ValidTimeResult.EmptyOrReversed
            ValidTime.of(start, parsed("2026-10-19T04:59:59Z")) shouldBe ValidTimeResult.EmptyOrReversed
            ValidTime.of(start, parsed("2026-10-19T08:00:00.0000009+03:00")) shouldBe ValidTimeResult.EmptyOrReversed
            ValidTime.from(start).endExclusive shouldBe null
            ValidTime.from(start).toValidPeriod().isOpenEnded shouldBe true
        }
    })
