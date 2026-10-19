package hms.kernel.ids

import java.util.UUID

/**
 * Parsing, validation, ordering and formatting of RFC 9562 version 7 UUIDs (platform-kernel spec §5).
 *
 * [java.util.UUID.fromString] is lenient (it accepts short groups), so it is never used on input: [parse]
 * accepts exactly the 36-character `8-4-4-4-12` form. [java.util.UUID.compareTo] compares signed longs;
 * [compare] gives the unsigned byte-wise order that PostgreSQL uses for `uuid`.
 */
object UuidV7 {
    private const val CANONICAL_SHAPE = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    private const val HEX_RADIX = 16
    private const val VERSION = 7
    private const val RFC_9562_VARIANT = 2

    /** Parses canonical text, upper or lower case, and checks version 7 and the RFC 9562 variant. */
    fun parse(text: String): UuidParseResult {
        if (!hasCanonicalShape(text)) return UuidParseResult.Invalid(UuidParseError.MALFORMED)
        val hex = text.filter { it != '-' }
        val half = hex.length / 2
        val uuid = UUID(hex.take(half).toULong(HEX_RADIX).toLong(), hex.drop(half).toULong(HEX_RADIX).toLong())
        return errorOf(uuid)?.let { UuidParseResult.Invalid(it) } ?: UuidParseResult.Valid(uuid)
    }

    /** True when [uuid] has version 7 and the RFC 9562 variant (`10`). */
    fun isV7(uuid: UUID): Boolean = errorOf(uuid) == null

    /** Throws IllegalArgumentException when [uuid] is not a v7 UUID with the RFC 9562 variant (a programming error). */
    fun requireV7(uuid: UUID): UUID {
        require(isV7(uuid)) {
            "expected a version 7 UUID with the RFC 9562 variant, got version ${uuid.version()} variant ${uuid.variant()}"
        }
        return uuid
    }

    /** Unsigned byte-wise order, the order PostgreSQL uses. */
    fun compare(
        a: UUID,
        b: UUID,
    ): Int {
        val high = a.mostSignificantBits.toULong().compareTo(b.mostSignificantBits.toULong())
        return if (high != 0) high else a.leastSignificantBits.toULong().compareTo(b.leastSignificantBits.toULong())
    }

    /** Lower-case canonical form. */
    fun format(uuid: UUID): String = uuid.toString()

    private fun errorOf(uuid: UUID): UuidParseError? =
        when {
            uuid.version() != VERSION -> UuidParseError.NOT_VERSION_7
            uuid.variant() != RFC_9562_VARIANT -> UuidParseError.NOT_RFC_9562_VARIANT
            else -> null
        }

    private fun hasCanonicalShape(text: String): Boolean =
        text.length == CANONICAL_SHAPE.length &&
            text.indices.all { i -> if (CANONICAL_SHAPE[i] == '-') text[i] == '-' else isAsciiHex(text[i]) }

    private fun isAsciiHex(c: Char): Boolean = c in '0'..'9' || c in 'a'..'f' || c in 'A'..'F'
}
