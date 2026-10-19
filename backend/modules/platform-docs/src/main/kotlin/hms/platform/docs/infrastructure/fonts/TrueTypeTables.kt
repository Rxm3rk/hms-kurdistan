package hms.platform.docs.infrastructure.fonts

import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * The few TrueType tables the print pipeline reads from the font bytes themselves rather than through
 * Java2D (docs/specs/modules/platform-docs.md §5.3, §9): `head` (units per em), `hhea` (ascender,
 * descender, line gap), `cmap` (the character map) and `name` (the version string, name ID 5).
 *
 * Why parse: the fit rule takes line height from the `hhea` metrics (spec §5.3), and Java's `LineMetrics`
 * may come from other tables (`OS/2` typo or win metrics); the coverage check needs the real character map,
 * and `Font.canDisplay` also answers true for characters Java2D maps to an invisible glyph. Layouts follow
 * the OpenType specification (`https://learn.microsoft.com/typography/opentype/spec/`), all big-endian.
 * A malformed or truncated file is a [FontIntegrityException]: the fonts are pinned build inputs, so a
 * file that does not parse is a broken build, not a business outcome.
 */
internal class TrueTypeTables private constructor(
    /** `head.unitsPerEm`. */
    val unitsPerEm: Int,
    /** `hhea` ascender, descender (negative below the baseline, as stored) and line gap, in font units. */
    val hhea: HheaMetrics,
    /** The character map: code point → glyph id, for every mapped code point whose glyph id is not 0. */
    val cmap: Map<Int, Int>,
    /** Name ID 5 (the version string, for example "Version 2.013; ttfautohint ..."), from a Unicode or Windows record. */
    val versionString: String,
) {
    /** Reads the tables from [bytes]; every read is checked against the end of the file first. */
    private class Reader(
        private val bytes: ByteArray,
    ) {
        private val buffer: ByteBuffer = ByteBuffer.wrap(bytes).order(ByteOrder.BIG_ENDIAN).asReadOnlyBuffer()
        private val directory: Map<String, Int> = readDirectory()

        private fun readDirectory(): Map<String, Int> {
            val version = u32(0)
            ensure(version == SFNT_TRUETYPE, "not a TrueType font (sfnt version 0x${java.lang.Long.toHexString(version)})")
            val tables = u16(U32)
            return (0 until tables).associate { i ->
                val record = OFFSET_TABLE_SIZE + i * TABLE_RECORD_SIZE
                need(record, U32)
                val tag = String(bytes, record, U32, Charsets.US_ASCII)
                val offset = u32(record + 2 * U32)
                val length = u32(record + 3 * U32)
                ensure(offset + length <= bytes.size, "table '$tag' lies outside the file")
                tag to offset.toInt()
            }
        }

        fun read(): TrueTypeTables {
            val head = table("head")
            ensure(u32(head + HEAD_MAGIC_OFFSET) == HEAD_MAGIC, "head.magicNumber is not 0x5F0F3CF5")
            val unitsPerEm = u16(head + HEAD_UNITS_PER_EM_OFFSET)
            ensure(unitsPerEm in MIN_UNITS_PER_EM..MAX_UNITS_PER_EM, "head.unitsPerEm $unitsPerEm out of range")
            val hhea = table("hhea")
            val metrics =
                HheaMetrics(
                    unitsPerEm = unitsPerEm,
                    ascender = s16(hhea + HHEA_ASCENDER_OFFSET),
                    descender = s16(hhea + HHEA_DESCENDER_OFFSET),
                    lineGap = s16(hhea + HHEA_LINE_GAP_OFFSET),
                )
            return TrueTypeTables(unitsPerEm, metrics, readCmap(), readName(NAME_ID_VERSION))
        }

        private fun table(tag: String): Int = directory[tag] ?: throw FontIntegrityException("the font has no '$tag' table")

        private fun readCmap(): Map<Int, Int> {
            val cmap = table("cmap")
            val count = u16(cmap + U16)
            val subtables =
                (0 until count).map { i ->
                    val record = cmap + U32 + i * CMAP_ENCODING_RECORD_SIZE
                    Triple(u16(record), u16(record + U16), cmap + u32(record + U32).toInt())
                }

            // Prefer a full-repertoire subtable (format 12), then the BMP subtable (format 4).
            fun pick(format: Int) =
                subtables.firstOrNull { (platform, encoding, offset) ->
                    u16(offset) == format && (platform == PLATFORM_UNICODE || (platform == PLATFORM_WINDOWS && encoding in WINDOWS_UNICODE))
                }
            val chosen =
                pick(CMAP_FORMAT_12) ?: pick(CMAP_FORMAT_4) ?: throw FontIntegrityException("no Unicode cmap subtable of format 12 or 4")
            return if (u16(chosen.third) == CMAP_FORMAT_12) cmapFormat12(chosen.third) else cmapFormat4(chosen.third)
        }

        private fun cmapFormat12(at: Int): Map<Int, Int> {
            val groups = u32(at + CMAP12_NUM_GROUPS_OFFSET)
            ensure(groups <= MAX_CMAP_GROUPS, "cmap format 12 has $groups groups")
            val map = HashMap<Int, Int>()
            for (g in 0 until groups.toInt()) {
                val group = at + CMAP12_GROUPS_OFFSET + g * CMAP12_GROUP_SIZE
                val start = u32(group)
                val end = u32(group + U32)
                val startGlyph = u32(group + 2 * U32)
                ensure(start <= end && end <= MAX_CODE_POINT, "cmap format 12 group $g is malformed")
                for (cp in start..end) {
                    val glyph = (startGlyph + (cp - start)).toInt()
                    if (glyph != 0) map[cp.toInt()] = glyph
                }
            }
            return map
        }

        private fun cmapFormat4(at: Int): Map<Int, Int> {
            val segments = u16(at + CMAP4_SEG_COUNT_X2_OFFSET) / 2
            val endCodes = at + CMAP4_END_CODES_OFFSET
            val startCodes = endCodes + segments * U16 + U16 // + reservedPad
            val idDeltas = startCodes + segments * U16
            val idRangeOffsets = idDeltas + segments * U16
            val map = HashMap<Int, Int>()
            for (s in 0 until segments) {
                val end = u16(endCodes + s * U16)
                val start = u16(startCodes + s * U16)
                val delta = u16(idDeltas + s * U16)
                val rangeOffsetAt = idRangeOffsets + s * U16
                val rangeOffset = u16(rangeOffsetAt)
                for (cp in start..minOf(end, LAST_BMP_CHARACTER)) {
                    // With idRangeOffset 0 the glyph is the code plus idDelta; otherwise it is read from the
                    // glyph id array the offset points into, where 0 stays the missing glyph and others get idDelta.
                    val raw = if (rangeOffset == 0) cp else u16(rangeOffsetAt + rangeOffset + (cp - start) * U16)
                    val glyph = if (rangeOffset != 0 && raw == 0) 0 else (raw + delta) and U16_MASK
                    if (glyph != 0) map[cp] = glyph
                }
            }
            return map
        }

        private fun readName(nameId: Int): String {
            val name = table("name")
            val count = u16(name + U16)
            val storage = name + u16(name + 2 * U16)
            for (i in 0 until count) {
                val record = name + NAME_RECORDS_OFFSET + i * NAME_RECORD_SIZE
                val platform = u16(record)
                val encoding = u16(record + U16)
                val unicode = platform == PLATFORM_UNICODE || (platform == PLATFORM_WINDOWS && encoding in WINDOWS_UNICODE)
                if (unicode && u16(record + NAME_ID_OFFSET) == nameId) {
                    val length = u16(record + NAME_LENGTH_OFFSET)
                    val offset = u16(record + NAME_STRING_OFFSET)
                    need(storage + offset, length)
                    return String(bytes, storage + offset, length, Charsets.UTF_16BE)
                }
            }
            throw FontIntegrityException("the font has no Unicode name record $nameId")
        }

        private fun need(
            at: Int,
            size: Int,
        ) = ensure(at >= 0 && at.toLong() + size <= bytes.size, "the font file is truncated or malformed (read at $at)")

        private fun u16(at: Int): Int = need(at, U16).let { buffer.getShort(at).toInt() and U16_MASK }

        private fun s16(at: Int): Int = need(at, U16).let { buffer.getShort(at).toInt() }

        private fun u32(at: Int): Long = need(at, U32).let { buffer.getInt(at).toLong() and U32_MASK }
    }

    companion object {
        /** Parses [bytes]: the table directory, then `head`, `hhea`, `cmap` and `name`. */
        fun parse(bytes: ByteArray): TrueTypeTables = Reader(bytes).read()

        private fun ensure(
            condition: Boolean,
            message: String,
        ) {
            if (!condition) throw FontIntegrityException(message)
        }

        private const val U16 = 2
        private const val U32 = 4
        private const val U16_MASK = 0xFFFF
        private const val U32_MASK = 0xFFFF_FFFFL
        private const val SFNT_TRUETYPE = 0x0001_0000L
        private const val OFFSET_TABLE_SIZE = 12
        private const val TABLE_RECORD_SIZE = 16
        private const val HEAD_MAGIC_OFFSET = 12
        private const val HEAD_MAGIC = 0x5F0F_3CF5L
        private const val HEAD_UNITS_PER_EM_OFFSET = 18
        private const val MIN_UNITS_PER_EM = 16
        private const val MAX_UNITS_PER_EM = 16_384
        private const val HHEA_ASCENDER_OFFSET = 4
        private const val HHEA_DESCENDER_OFFSET = 6
        private const val HHEA_LINE_GAP_OFFSET = 8
        private const val CMAP_ENCODING_RECORD_SIZE = 8
        private const val CMAP_FORMAT_4 = 4
        private const val CMAP_FORMAT_12 = 12
        private const val CMAP4_SEG_COUNT_X2_OFFSET = 6
        private const val CMAP4_END_CODES_OFFSET = 14
        private const val CMAP12_NUM_GROUPS_OFFSET = 12
        private const val CMAP12_GROUPS_OFFSET = 16
        private const val CMAP12_GROUP_SIZE = 12
        private const val MAX_CMAP_GROUPS = 0x10_0000L
        private const val MAX_CODE_POINT = 0x10_FFFFL

        /** 0xFFFF terminates every format 4 table and is not a character. */
        private const val LAST_BMP_CHARACTER = 0xFFFE
        private const val PLATFORM_UNICODE = 0
        private const val PLATFORM_WINDOWS = 3

        /** Windows encodings 1 (Unicode BMP) and 10 (Unicode full repertoire). */
        private val WINDOWS_UNICODE = setOf(1, 10)
        private const val NAME_RECORDS_OFFSET = 6
        private const val NAME_RECORD_SIZE = 12
        private const val NAME_ID_OFFSET = 6
        private const val NAME_LENGTH_OFFSET = 8
        private const val NAME_STRING_OFFSET = 10
        private const val NAME_ID_VERSION = 5
    }
}

/**
 * A font's `hhea` vertical metrics in font units (spec §5.3). [descender] is negative below the baseline,
 * as the table stores it.
 */
data class HheaMetrics(
    val unitsPerEm: Int,
    val ascender: Int,
    val descender: Int,
    val lineGap: Int,
) {
    /** The ascender at [sizePt], in points (an em is [sizePt] points). */
    fun ascentPt(sizePt: Double): Double = ascender * sizePt / unitsPerEm

    /** The descender at [sizePt] as a positive distance below the baseline, in points. */
    fun descentPt(sizePt: Double): Double = -descender * sizePt / unitsPerEm

    fun lineGapPt(sizePt: Double): Double = lineGap * sizePt / unitsPerEm
}

/**
 * A print font that is missing, does not match its pin in `fonts.json`, or does not parse. This is an
 * infrastructure misconfiguration (the fonts are build inputs), so it is thrown, and the registry refuses
 * to start (spec §9; contrast the business refusals of spec §3.2, which are values).
 */
class FontIntegrityException(
    message: String,
    cause: Throwable? = null,
) : IllegalStateException(message, cause)
