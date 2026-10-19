package hms.platform.docs.infrastructure.text

import hms.platform.docs.domain.layout.Direction
import hms.platform.docs.domain.layout.FontSpec
import hms.platform.docs.domain.layout.Shaped
import hms.platform.docs.domain.layout.ShapedGlyph
import hms.platform.docs.domain.layout.TextShaper
import hms.platform.docs.infrastructure.fonts.FontRegistry
import hms.platform.docs.infrastructure.fonts.LoadedFont
import java.awt.Font
import java.awt.RenderingHints
import java.awt.font.FontRenderContext
import java.awt.font.GlyphVector
import java.awt.font.TextAttribute
import java.awt.geom.AffineTransform
import java.text.Bidi

/**
 * The text shaper: HarfBuzz through the JDK's text layout (docs/specs/modules/platform-docs.md §5.1;
 * BUILD-PROMPT §4.1 "Document rendering", "Label and token printing", §11.1, §18.9 "Bidi", "Script").
 *
 * - **Runs.** `java.text.Bidi` splits the line into directional runs with the requested paragraph
 *   direction: [Direction.AUTO] takes it from the first strong character (UAX #9 rules P2 and P3; no strong
 *   character gives left to right), [Direction.LTR] and [Direction.RTL] force it. Runs are put in visual
 *   order with `Bidi.reorderVisually` (rules L1 and L2).
 * - **Font chain.** Each character uses the first font of the chain whose character map has it. A
 *   character of Unicode script Common or Inherited (spaces, digits, punctuation, combining marks) stays
 *   with the font of the character before it (or, at the start, the first following character of a
 *   specific script) when that font covers it, so a mark is never split from its base. Within a run,
 *   consecutive characters of one font form a segment; an RTL run's segments are drawn right to left.
 * - **Shaping.** Each segment is shaped with `Font.layoutGlyphVector` (never `createGlyphVector`, which
 *   does not shape), with `Font.LAYOUT_RIGHT_TO_LEFT` for right-to-left runs and the whole line as context,
 *   using the exact pinned TrueType file ([FontRegistry]) derived at the size with `kern` and `liga` on
 *   (`TextAttribute.KERNING_ON`, `TextAttribute.LIGATURES_ON`, as Pango and the printers use them).
 * - **One context.** Every measurement and every rasterised outline uses [FRC]: identity transform,
 *   anti-aliasing hint on, fractional metrics on. With the identity transform one user-space unit is one
 *   point (Java2D's convention of 72 units per inch), so a font derived at size N has an em of N units and
 *   every position this shaper returns is in points.
 * - **Metrics.** Ascent, descent and line gap are the `hhea` values read from the file ([LoadedFont.hhea])
 *   scaled to the size, the largest of the fonts actually used (spec §5.3), never Java's `LineMetrics`.
 * - **Missing glyphs.** [Shaped.missingGlyph] is true when no font of the chain has a character in its
 *   character map, or when shaping yields the font's missing glyph (`Font.getMissingGlyphCode`), so R7
 *   refuses the print (spec §3.2).
 * - **Invisible glyphs.** Java2D maps default-ignorable characters (ZWNJ, ZWJ, ZWSP) to the glyph code
 *   [INVISIBLE_GLYPH] (0xFFFF), which has no outline and no advance. It is kept in [Shaped.glyphs] with
 *   its character index so every character stays accounted for; it is never the missing glyph.
 */
class Java2dTextShaper(
    private val fonts: FontRegistry,
) : TextShaper {
    override fun shape(
        text: String,
        fonts: List<FontSpec>,
        sizePt: Double,
        direction: Direction,
    ): Shaped {
        val line = layout(text, fonts, sizePt, direction)
        val glyphs =
            line.segments.flatMap { segment ->
                val gv = segment.glyphs
                (0 until gv.numGlyphs).map { i ->
                    val position = gv.getGlyphPosition(i)
                    ShapedGlyph(
                        glyphId = gv.getGlyphCode(i),
                        xPt = segment.xPt + position.x,
                        yPt = -position.y,
                        charIndex = segment.start + gv.getGlyphCharIndex(i),
                        font = segment.font.printFont.spec,
                    )
                }
            }
        return Shaped(
            advancePt = line.advancePt,
            ascentPt = line.ascentPt,
            descentPt = line.descentPt,
            lineGapPt = line.lineGapPt,
            rightToLeft = line.rightToLeft,
            missingGlyph = line.missingGlyph,
            glyphs = glyphs,
        )
    }

    /**
     * Shapes [text] into positioned glyph vectors: the one implementation behind [shape] and the
     * rasteriser, so what is measured is exactly what is drawn (spec §5.1, §7.2).
     */
    internal fun layout(
        text: String,
        chain: List<FontSpec>,
        sizePt: Double,
        direction: Direction,
    ): ShapedLine {
        require(chain.isNotEmpty()) { "the font chain is empty" }
        require(sizePt.isFinite() && sizePt > 0.0) { "size must be a positive number of points, got $sizePt" }
        val loaded = chain.map(fonts::font)
        if (text.isEmpty()) {
            val first = loaded.first()
            return ShapedLine(
                segments = emptyList(),
                advancePt = 0.0,
                ascentPt = first.hhea.ascentPt(sizePt),
                descentPt = first.hhea.descentPt(sizePt),
                lineGapPt = first.hhea.lineGapPt(sizePt),
                rightToLeft = direction == Direction.RTL,
                missingGlyph = false,
            )
        }
        val assignment = FontAssignment.of(text, loaded)
        val bidi = Bidi(text, bidiFlag(direction))
        val chars = text.toCharArray()
        val derived = loaded.map { derive(it.awtFont, sizePt) }

        val segments = mutableListOf<ShapedSegment>()
        var x = 0.0
        for ((start, limit, rtl) in visualRuns(bidi)) {
            val pieces = assignment.segments(start, limit).let { if (rtl) it.asReversed() else it }
            for ((segStart, segLimit, fontIndex) in pieces) {
                val flag = if (rtl) Font.LAYOUT_RIGHT_TO_LEFT else Font.LAYOUT_LEFT_TO_RIGHT
                val gv = derived[fontIndex].layoutGlyphVector(FRC, chars, segStart, segLimit, flag)
                segments += ShapedSegment(loaded[fontIndex], derived[fontIndex], segStart, x, gv)
                x += gv.getGlyphPosition(gv.numGlyphs).x
            }
        }
        val used = segments.map { it.font }.distinct()
        val missing =
            assignment.uncovered ||
                segments.any { s -> (0 until s.glyphs.numGlyphs).any { s.glyphs.getGlyphCode(it) == s.awtFont.missingGlyphCode } }
        return ShapedLine(
            segments = segments,
            advancePt = x,
            ascentPt = used.maxOf { it.hhea.ascentPt(sizePt) },
            descentPt = used.maxOf { it.hhea.descentPt(sizePt) },
            lineGapPt = used.maxOf { it.hhea.lineGapPt(sizePt) },
            rightToLeft = !bidi.baseIsLeftToRight(),
            missingGlyph = missing,
        )
    }

    private data class Run(
        val start: Int,
        val limit: Int,
        val rightToLeft: Boolean,
    )

    private fun visualRuns(bidi: Bidi): List<Run> {
        val count = bidi.runCount
        val levels = ByteArray(count) { bidi.getRunLevel(it).toByte() }
        val runs: Array<Any> = Array(count) { Run(bidi.getRunStart(it), bidi.getRunLimit(it), bidi.getRunLevel(it) % 2 == 1) }
        Bidi.reorderVisually(levels, 0, runs, 0, count)
        return runs.map { it as Run }
    }

    companion object {
        /**
         * The one pinned rendering context for measuring and rasterising (spec §5.1): identity transform,
         * anti-aliasing hint on, fractional metrics on.
         */
        val FRC: FontRenderContext =
            FontRenderContext(AffineTransform(), RenderingHints.VALUE_TEXT_ANTIALIAS_ON, RenderingHints.VALUE_FRACTIONALMETRICS_ON)

        /** The glyph code Java2D gives default-ignorable characters such as ZWNJ, ZWJ and ZWSP. */
        const val INVISIBLE_GLYPH: Int = 0xFFFF

        /** [font] at [sizePt] points with kerning and standard ligatures on. */
        internal fun derive(
            font: Font,
            sizePt: Double,
        ): Font =
            font.deriveFont(
                mapOf(
                    TextAttribute.SIZE to sizePt.toFloat(),
                    TextAttribute.KERNING to TextAttribute.KERNING_ON,
                    TextAttribute.LIGATURES to TextAttribute.LIGATURES_ON,
                ),
            )

        private fun bidiFlag(direction: Direction): Int =
            when (direction) {
                Direction.AUTO -> Bidi.DIRECTION_DEFAULT_LEFT_TO_RIGHT
                Direction.LTR -> Bidi.DIRECTION_LEFT_TO_RIGHT
                Direction.RTL -> Bidi.DIRECTION_RIGHT_TO_LEFT
            }
    }
}

/** A shaped line: its segments in visual order, each a glyph vector placed at [ShapedSegment.xPt]. */
internal data class ShapedLine(
    val segments: List<ShapedSegment>,
    val advancePt: Double,
    val ascentPt: Double,
    val descentPt: Double,
    val lineGapPt: Double,
    val rightToLeft: Boolean,
    val missingGlyph: Boolean,
)

/**
 * One shaped segment: characters of the line from [start] in one font and one direction, shaped by
 * [awtFont] (the pinned [font] at the size), with its glyph vector (positions relative to the segment's
 * origin, glyph character indices relative to [start]) and its origin [xPt] from the line's left edge.
 */
internal class ShapedSegment(
    val font: LoadedFont,
    val awtFont: Font,
    val start: Int,
    val xPt: Double,
    val glyphs: GlyphVector,
)

/**
 * Which font of the chain each character of a line uses (see [Java2dTextShaper]): an index per UTF-16
 * unit (both units of a surrogate pair share it), and whether some character has no font at all.
 */
internal class FontAssignment private constructor(
    private val fontOf: IntArray,
    val uncovered: Boolean,
) {
    data class Piece(
        val start: Int,
        val limit: Int,
        val fontIndex: Int,
    )

    /** Characters [start] to [limit] cut into pieces of one font, in logical order. */
    fun segments(
        start: Int,
        limit: Int,
    ): List<Piece> {
        val pieces = mutableListOf<Piece>()
        var pieceStart = start
        for (i in start + 1..limit) {
            if (i == limit || fontOf[i] != fontOf[pieceStart]) {
                pieces += Piece(pieceStart, i, fontOf[pieceStart])
                pieceStart = i
            }
        }
        return pieces
    }

    companion object {
        private const val NONE = -1

        fun of(
            text: String,
            chain: List<LoadedFont>,
        ): FontAssignment {
            val codePoints = text.codePoints().toArray()
            val neutral = codePoints.map { isNeutral(it) }
            val own = codePoints.map { cp -> chain.indexOfFirst { it.covers(cp) } }
            val chosen = IntArray(codePoints.size) { NONE }
            // Characters of a specific script take the first font that covers them.
            codePoints.indices.filter { !neutral[it] }.forEach { chosen[it] = own[it] }
            // Common and Inherited characters stay with the surrounding font when it covers them.
            for (i in codePoints.indices.filter { neutral[it] }) {
                val surrounding =
                    if (i > 0) {
                        chosen[i - 1]
                    } else {
                        (i + 1 until codePoints.size).firstOrNull { !neutral[it] }?.let { chosen[it] } ?: NONE
                    }
                chosen[i] = if (surrounding != NONE && chain[surrounding].covers(codePoints[i])) surrounding else own[i]
            }
            val uncovered = chosen.any { it == NONE }
            // An uncovered character is shaped with the first font, where it yields the missing glyph.
            val perUnit = IntArray(text.length)
            var unit = 0
            codePoints.forEachIndexed { i, cp ->
                val font = if (chosen[i] == NONE) 0 else chosen[i]
                repeat(Character.charCount(cp)) { perUnit[unit++] = font }
            }
            return FontAssignment(perUnit, uncovered)
        }

        private fun isNeutral(codePoint: Int): Boolean =
            when (Character.UnicodeScript.of(codePoint)) {
                Character.UnicodeScript.COMMON, Character.UnicodeScript.INHERITED -> true
                else -> false
            }
    }
}
