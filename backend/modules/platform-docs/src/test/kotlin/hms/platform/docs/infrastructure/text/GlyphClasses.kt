package hms.platform.docs.infrastructure.text

import java.nio.ByteBuffer

/**
 * The OpenType `GDEF` glyph class definition of a font (1 base, 2 ligature, 3 mark, 4 component), read
 * from the TrueType bytes for the font-coverage test: it tells which glyph of a shaped cluster is the
 * mark, so the test can check that every mark is positioned off its base (spec §9 point 3). Test code
 * only; layouts per the OpenType specification (GDEF header, ClassDef formats 1 and 2).
 */
class GlyphClasses private constructor(
    private val classes: Map<Int, Int>,
) {
    fun of(glyphId: Int): Int = classes[glyphId] ?: 0

    fun isMark(glyphId: Int): Boolean = of(glyphId) == MARK

    fun isBase(glyphId: Int): Boolean = of(glyphId) == BASE

    companion object {
        const val BASE = 1
        const val MARK = 3

        fun read(font: ByteArray): GlyphClasses {
            val b = ByteBuffer.wrap(font)
            val tables = b.getShort(4).toInt() and 0xFFFF
            val gdef =
                (0 until tables)
                    .map { 12 + it * 16 }
                    .first { String(ByteArray(4) { i -> b.get(it + i) }, Charsets.US_ASCII) == "GDEF" }
                    .let { b.getInt(it + 8) }
            val classDef = gdef + (b.getShort(gdef + 4).toInt() and 0xFFFF)
            val map = HashMap<Int, Int>()
            when (b.getShort(classDef).toInt()) {
                1 -> {
                    val start = b.getShort(classDef + 2).toInt() and 0xFFFF
                    val count = b.getShort(classDef + 4).toInt() and 0xFFFF
                    repeat(count) { map[start + it] = b.getShort(classDef + 6 + 2 * it).toInt() and 0xFFFF }
                }

                2 -> {
                    val ranges = b.getShort(classDef + 2).toInt() and 0xFFFF
                    repeat(ranges) { r ->
                        val at = classDef + 4 + 6 * r
                        val start = b.getShort(at).toInt() and 0xFFFF
                        val end = b.getShort(at + 2).toInt() and 0xFFFF
                        val cls = b.getShort(at + 4).toInt() and 0xFFFF
                        for (g in start..end) map[g] = cls
                    }
                }

                else -> {
                    error("unknown ClassDef format")
                }
            }
            return GlyphClasses(map)
        }
    }
}
