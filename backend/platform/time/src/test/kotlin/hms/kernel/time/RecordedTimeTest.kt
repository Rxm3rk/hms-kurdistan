package hms.kernel.time

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import java.lang.reflect.InvocationTargetException
import java.time.Clock
import java.time.Instant
import java.time.ZoneId

/** RecordedTime, ValidPeriod and AsOf (platform-kernel.md §6.1, §3). */
class RecordedTimeTest :
    FunSpec({
        val instant = Instant.parse("2026-10-19T05:00:00.123456789Z")

        test("RecordedTime comes from the injected clock, truncated to microseconds, whatever the clock's zone") {
            RecordedTime.now(Clock.fixed(instant, ZoneId.of("Asia/Baghdad"))).instant shouldBe Instant.parse("2026-10-19T05:00:00.123456Z")
        }

        test("RecordedTime.restore truncates and equals the value read from the clock") {
            @OptIn(PersistenceOnly::class)
            val restored = RecordedTime.restore(instant)
            restored shouldBe TimeFixtures.recordedAt(instant)
        }

        test("RecordedTime: a reflective construction with sub-microsecond digits throws") {
            val constructor = RecordedTime::class.java.getDeclaredMethod("constructor-impl", Instant::class.java)
            constructor.isAccessible = true
            val thrown = shouldThrow<InvocationTargetException> { constructor.invoke(null, instant) }
            thrown.cause.shouldBeInstanceOf<IllegalArgumentException>()
        }

        test("as-of-query-coordinates: an AsOf is built from any Instant without a persistence-only factory") {
            val validAt = Instant.parse("2026-10-01T00:00:00Z")
            val knownAt = Instant.parse("2026-10-19T09:12:00.000000001Z")
            AsOf(validAt, knownAt).knownAt shouldBe knownAt
            AsOf(validAt).knownAt shouldBe null
            AsOf.latest(validAt) shouldBe AsOf(validAt, null)
        }

        test("as-of-query-coordinates: AsOf.knownAt(validAt, recorded) equals the recorded instant") {
            val validAt = Instant.parse("2026-10-01T00:00:00Z")
            val recorded = TimeFixtures.recordedAt(instant)
            AsOf.knownAt(validAt, recorded) shouldBe AsOf(validAt, recorded.instant)
        }

        test("ValidPeriod: half-open, truncated, empty and reversed refused") {
            val start = Instant.parse("2026-10-19T05:00:00Z")
            val end = Instant.parse("2026-10-19T06:00:00Z")
            val period = (ValidPeriod.of(start, end) as ValidPeriodResult.Valid).period
            period.contains(start) shouldBe true
            period.contains(end) shouldBe false
            period.contains(end.minusNanos(1)) shouldBe true
            period.isOpenEnded shouldBe false
            ValidPeriod.of(start, start) shouldBe ValidPeriodResult.EmptyOrReversed
            ValidPeriod.of(start, start.plusNanos(999)) shouldBe ValidPeriodResult.EmptyOrReversed
            ValidPeriod.of(end, start) shouldBe ValidPeriodResult.EmptyOrReversed
            ValidPeriod.from(start.plusNanos(1)).start shouldBe start
            ValidPeriod.from(start).contains(Instant.MAX) shouldBe true
            ValidPeriod.from(end).overlaps(period) shouldBe false
            ValidPeriod.from(end.minusSeconds(1)).overlaps(period) shouldBe true
        }
    })
