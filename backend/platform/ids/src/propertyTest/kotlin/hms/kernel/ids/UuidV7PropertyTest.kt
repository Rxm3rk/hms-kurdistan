package hms.kernel.ids

import hms.kernel.testing.PropertyTestBudget
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.property.Arb
import io.kotest.property.arbitrary.bind
import io.kotest.property.arbitrary.boolean
import io.kotest.property.arbitrary.element
import io.kotest.property.arbitrary.int
import io.kotest.property.arbitrary.list
import io.kotest.property.arbitrary.long
import io.kotest.property.checkAll
import java.nio.ByteBuffer
import java.util.Arrays
import java.util.UUID
import kotlin.math.sign

private const val UUID_BYTES = 16
private const val CANONICAL_LENGTH = 36
private const val VERSION_INDEX = 14
private const val VARIANT_INDEX = 19
private const val MAX_EDITS = 3
private const val VERSION_7_NUMBER = 7
private const val RFC_VARIANT_NUMBER = 2

// Clears the version nibble and the variant bits, then sets version 7 and variant 10.
private const val VERSION_CLEAR = 0xFFFF_FFFF_FFFF_0FFFuL
private const val VERSION_7 = 0x7000uL
private const val VARIANT_CLEAR = 0x3FFF_FFFF_FFFF_FFFFuL
private const val VARIANT_10 = 0x8000_0000_0000_0000uL

private val strictShape = Regex("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")

private fun bytesOf(uuid: UUID): ByteArray =
    ByteBuffer
        .allocate(UUID_BYTES)
        .putLong(uuid.mostSignificantBits)
        .putLong(uuid.leastSignificantBits)
        .array()

private fun asV7(
    msb: Long,
    lsb: Long,
): UUID =
    UUID(
        ((msb.toULong() and VERSION_CLEAR) or VERSION_7).toLong(),
        ((lsb.toULong() and VARIANT_CLEAR) or VARIANT_10).toLong(),
    )

private val anyUuid = Arb.bind(Arb.long(), Arb.long()) { msb, lsb -> UUID(msb, lsb) }
private val v7Uuid = Arb.bind(Arb.long(), Arb.long(), ::asV7)

// Characters an edit may put in: hex of both cases, separators, and look-alikes that are not ASCII hex.
private val editChars =
    Arb.element(
        listOf('0', '7', '8', '9', 'a', 'B', 'f', 'F', '-', 'g', ' ', '+', '_', '{', '０', '٠', '१'),
    )

private sealed interface Edit {
    fun applyTo(text: StringBuilder)
}

private data class Replace(
    val position: Int,
    val char: Char,
) : Edit {
    override fun applyTo(text: StringBuilder) {
        if (text.isNotEmpty()) text.setCharAt(position % text.length, char)
    }
}

private data class Insert(
    val position: Int,
    val char: Char,
) : Edit {
    override fun applyTo(text: StringBuilder) {
        text.insert(position % (text.length + 1), char)
    }
}

private data class Delete(
    val position: Int,
) : Edit {
    override fun applyTo(text: StringBuilder) {
        if (text.isNotEmpty()) text.deleteCharAt(position % text.length)
    }
}

private val position = Arb.int(0 until CANONICAL_LENGTH + 1)
private val edit: Arb<Edit> =
    Arb.bind(Arb.int(0..2), position, editChars) { kind, at, char ->
        when (kind) {
            0 -> Replace(at, char)
            1 -> Insert(at, char)
            else -> Delete(at)
        }
    }

/** The independent oracle for [UuidV7.parse]: the strict regex, then the version and variant characters. */
private fun expectedParse(text: String): UuidParseResult =
    when {
        !strictShape.matches(text) -> UuidParseResult.Invalid(UuidParseError.MALFORMED)
        text[VERSION_INDEX] != '7' -> UuidParseResult.Invalid(UuidParseError.NOT_VERSION_7)
        text[VARIANT_INDEX].lowercaseChar() !in "89ab" -> UuidParseResult.Invalid(UuidParseError.NOT_RFC_9562_VARIANT)
        else -> UuidParseResult.Valid(UUID.fromString(text))
    }

/** Ordering, parsing and formatting of UUIDv7 (platform-kernel spec §5, §17). */
class UuidV7PropertyTest :
    FunSpec({
        test("uuidv7-compare-matches-byte-order: UuidV7.compare equals unsigned byte-wise comparison (PostgreSQL's uuid order)") {
            checkAll(PropertyTestBudget.sequences(), anyUuid, anyUuid, Arb.boolean()) { a, other, sameHigh ->
                // Half the pairs share the high long, so the low long decides.
                val b = if (sameHigh) UUID(a.mostSignificantBits, other.leastSignificantBits) else other
                val expected = Arrays.compareUnsigned(bytesOf(a), bytesOf(b)).sign
                UuidV7.compare(a, b).sign shouldBe expected
                UuidV7.compare(b, a).sign shouldBe -expected
                UuidV7.compare(a, a) shouldBe 0
            }
        }

        test("uuidv7-parse-strict: parse accepts exactly canonical text with version 7 and the RFC 9562 variant") {
            checkAll(
                PropertyTestBudget.sequences(),
                v7Uuid,
                Arb.list(Arb.boolean(), CANONICAL_LENGTH..CANONICAL_LENGTH),
                Arb.list(edit, 0..MAX_EDITS),
            ) { uuid, upper, edits ->
                val text = StringBuilder(UuidV7.format(uuid))
                upper.forEachIndexed { i, up -> if (up) text.setCharAt(i, text[i].uppercaseChar()) }
                edits.forEach { it.applyTo(text) }
                UuidV7.parse(text.toString()) shouldBe expectedParse(text.toString())
            }
        }

        test("uuidv7-format-parse-round-trip: format gives lower-case canonical text that parses back to the same UUID") {
            checkAll(PropertyTestBudget.sequences(), v7Uuid) { uuid ->
                val text = UuidV7.format(uuid)
                text shouldBe text.lowercase()
                text.length shouldBe CANONICAL_LENGTH
                UuidV7.parse(text) shouldBe UuidParseResult.Valid(uuid)
                UuidV7.parse(text.uppercase()) shouldBe UuidParseResult.Valid(uuid)
                UuidV7.isV7(uuid) shouldBe true
            }
        }

        test("isV7 is true exactly for version 7 with variant 10") {
            checkAll(PropertyTestBudget.sequences(), anyUuid) { uuid ->
                UuidV7.isV7(uuid) shouldBe (uuid.version() == VERSION_7_NUMBER && uuid.variant() == RFC_VARIANT_NUMBER)
            }
        }
    })
