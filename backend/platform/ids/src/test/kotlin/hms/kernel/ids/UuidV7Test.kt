package hms.kernel.ids

import io.kotest.assertions.throwables.shouldNotThrowAny
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.ints.shouldBeGreaterThan
import io.kotest.matchers.ints.shouldBeLessThan
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeSameInstanceAs
import java.time.Instant
import java.util.UUID

/** Parsing, validation, ordering and formatting of UUIDv7 (platform-kernel spec §5, §17). */
class UuidV7Test :
    FunSpec({
        // RFC 9562 Appendix A.6, the UUIDv7 example: 2022-02-22T19:22:22Z.
        val rfcExample = "017F22E2-79B0-7CC3-98C4-DC0C0C07398F"
        val rfcExampleUuid = UUID(0x017F22E279B07CC3L, 0x98C4DC0C0C07398FuL.toLong())

        test("uuidv7-layout-rfc9562: the RFC 9562 example parses, has its timestamp and formats in lower case") {
            UuidV7.parse(rfcExample) shouldBe UuidParseResult.Valid(rfcExampleUuid)
            (rfcExampleUuid.mostSignificantBits ushr 16) shouldBe Instant.parse("2022-02-22T19:22:22Z").toEpochMilli()
            UuidV7.format(rfcExampleUuid) shouldBe "017f22e2-79b0-7cc3-98c4-dc0c0c07398f"
        }

        test("upper, lower and mixed case parse to the same UUID") {
            listOf(rfcExample, rfcExample.lowercase(), "017f22E2-79b0-7CC3-98c4-Dc0C0c07398F").forEach { text ->
                UuidV7.parse(text) shouldBe UuidParseResult.Valid(rfcExampleUuid)
            }
        }

        val malformed =
            listOf(
                "",
                "017f22e2-79b0-7cc3-98c4-dc0c0c07398",
                "017f22e2-79b0-7cc3-98c4-dc0c0c07398f0",
                "017f22e279b07cc398c4dc0c0c07398f",
                "017f22e279-b0-7cc3-98c4-dc0c0c07398f",
                "017f22e2-79b0-7cc3-98c4-dc0c0c07398g",
                "017f22e2_79b0_7cc3_98c4_dc0c0c07398f",
                "017f22e2-+9b0-7cc3-98c4-dc0c0c07398f",
                " 017f22e2-79b0-7cc3-98c4-dc0c0c07398",
                "017f22e2-79b0-7cc3-98c4-dc0c0c07398f ",
                "{017f22e2-79b0-7cc3-98c4-dc0c0c0739}",
                "urn:uuid:017f22e2-79b0-7cc3-98c4-dc0c0c07398f",
                // Non-ASCII digits that Character.digit would accept: fullwidth and Arabic-Indic zero.
                "017f22e2-79b0-7cc3-98c4-dc0c0c07398０",
                "017f22e2-79b0-7cc3-98c4-dc0c0c07398٠",
            )
        malformed.forEach { text ->
            test("uuidv7-parse-rejects-non-v7: malformed text '$text'") {
                UuidV7.parse(text) shouldBe UuidParseResult.Invalid(UuidParseError.MALFORMED)
            }
        }

        // UUID.fromString accepts each of these (short or long groups); the strict parser does not.
        listOf(
            "0-0-7000-8000-0",
            "1-2-3-4-5",
            "17f22e2-79b0-7cc3-98c4-dc0c0c07398f",
            "017f22e2-79b0-7cc3-98c4-c0c0c07398f",
            "017f22e2-79b0-7cc3-8c4-dc0c0c07398f0",
        ).forEach { text ->
            test("uuidv7-parse-rejects-non-v7: short groups that UUID.fromString accepts, '$text'") {
                shouldNotThrowAny { UUID.fromString(text) }
                UuidV7.parse(text) shouldBe UuidParseResult.Invalid(UuidParseError.MALFORMED)
            }
        }

        listOf(
            "c232ab00-9414-11ec-b3c8-9f6bdeced846",
            "919108f7-52d1-4320-9bac-f847db4148a8",
            "1ec9414c-232a-6b00-b3c8-9f6bdeced846",
            "2489e9ad-2ee2-8e00-8ec9-32d5f69181c0",
            "00000000-0000-0000-0000-000000000000",
            "ffffffff-ffff-ffff-ffff-ffffffffffff",
        ).forEach { text ->
            test("uuidv7-parse-rejects-non-v7: other versions, '$text'") {
                UuidV7.parse(text) shouldBe UuidParseResult.Invalid(UuidParseError.NOT_VERSION_7)
                UuidV7.isV7(UUID.fromString(text)) shouldBe false
            }
        }

        listOf(
            "017f22e2-79b0-7cc3-08c4-dc0c0c07398f",
            "017f22e2-79b0-7cc3-78c4-dc0c0c07398f",
            "017f22e2-79b0-7cc3-c8c4-dc0c0c07398f",
            "017f22e2-79b0-7cc3-d8c4-dc0c0c07398f",
            "017f22e2-79b0-7cc3-e8c4-dc0c0c07398f",
            "017f22e2-79b0-7cc3-f8c4-dc0c0c07398f",
        ).forEach { text ->
            test("uuidv7-parse-rejects-non-v7: other variants, '$text'") {
                UuidV7.parse(text) shouldBe UuidParseResult.Invalid(UuidParseError.NOT_RFC_9562_VARIANT)
                UuidV7.isV7(UUID.fromString(text)) shouldBe false
            }
        }

        test("requireV7 returns a v7 UUID and throws IllegalArgumentException for any other") {
            UuidV7.requireV7(rfcExampleUuid) shouldBeSameInstanceAs rfcExampleUuid
            shouldThrow<IllegalArgumentException> { UuidV7.requireV7(UUID.fromString("919108f7-52d1-4320-9bac-f847db4148a8")) }
            shouldThrow<IllegalArgumentException> { UuidV7.requireV7(UUID.fromString("017f22e2-79b0-7cc3-c8c4-dc0c0c07398f")) }
            shouldThrow<IllegalArgumentException> { UuidV7.requireV7(UUID(0, 0)) }
        }

        test("uuidv7-compare-matches-byte-order: unsigned where UUID.compareTo is signed") {
            val below = UUID(0x7FFF_FFFF_FFFF_7000L, Long.MIN_VALUE)
            val above = UUID(0x8000_0000_0000_7000uL.toLong(), Long.MIN_VALUE)
            below.compareTo(above) shouldBeGreaterThan 0
            UuidV7.compare(below, above) shouldBeLessThan 0
            UuidV7.compare(above, below) shouldBeGreaterThan 0

            val lowTail = UUID(0x017F22E279B07CC3L, 0x8000_0000_0000_0000uL.toLong())
            val highTail = UUID(0x017F22E279B07CC3L, 0x7FFF_FFFF_FFFF_FFFFL)
            lowTail.compareTo(highTail) shouldBeLessThan 0
            UuidV7.compare(lowTail, highTail) shouldBeGreaterThan 0

            UuidV7.compare(rfcExampleUuid, UUID(0x017F22E279B07CC3L, 0x98C4DC0C0C07398FuL.toLong())) shouldBe 0
        }

        test("format gives the lower-case canonical form, and parse reads it back") {
            val uuid = UUID(0xABCDEF0123457ABCuL.toLong(), 0xBCDEF0123456789AuL.toLong())
            UuidV7.format(uuid) shouldBe "abcdef01-2345-7abc-bcde-f0123456789a"
            UuidV7.parse(UuidV7.format(uuid)) shouldBe UuidParseResult.Valid(uuid)
        }
    })
