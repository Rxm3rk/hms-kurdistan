package hms.platform.docs.domain.layout

/**
 * Shapes and measures one line of text (docs/specs/modules/platform-docs.md §5.1). The domain's fit rule
 * and the font-coverage test use this port; the infrastructure implements it with HarfBuzz through the
 * JDK's text layout (`Font.layoutGlyphVector` per bidirectional run, `kern` and `liga` on, one pinned
 * `FontRenderContext`), with the exact TrueType file each [FontSpec] resolves to.
 */
fun interface TextShaper {
    /**
     * Shapes [text] at [sizePt]. [fonts] is a chain: each character uses the first font whose character map
     * has it (identity text always passes exactly one font, spec §4.1, §9); within each bidirectional run,
     * consecutive characters of the same font are shaped together.
     */
    fun shape(
        text: String,
        fonts: List<FontSpec>,
        sizePt: Double,
        direction: Direction,
    ): Shaped
}

/** The paragraph direction of a line (spec §4.1): from the first strong character, or forced. */
enum class Direction { AUTO, LTR, RTL }

/**
 * One glyph after shaping, in visual order from the line's left edge.
 *
 * @property glyphId the font's glyph id (0 is the missing glyph)
 * @property xPt and [yPt] the glyph origin relative to the line's left edge and baseline (y up), in points
 * @property charIndex the index in the text of the first character of the glyph's cluster
 * @property font the font of the chain the glyph comes from
 */
data class ShapedGlyph(
    val glyphId: Int,
    val xPt: Double,
    val yPt: Double,
    val charIndex: Int,
    val font: FontSpec,
)

/**
 * The result of shaping one line.
 *
 * @property advancePt the total advance width in points
 * @property ascentPt, [descentPt] and [lineGapPt] the `hhea` ascender, descender (positive) and line gap at the
 *   size, in points, the largest of the fonts in the chain (spec §5.3: never a fixed factor)
 * @property rightToLeft the resolved paragraph direction
 * @property missingGlyph true when any glyph is the font's missing glyph or a character is outside the
 *   font's character map; the print is then refused (spec §3.2 R7)
 * @property glyphs every glyph in visual order
 */
data class Shaped(
    val advancePt: Double,
    val ascentPt: Double,
    val descentPt: Double,
    val lineGapPt: Double,
    val rightToLeft: Boolean,
    val missingGlyph: Boolean,
    val glyphs: List<ShapedGlyph>,
) {
    /** The line height of the font at this size: ascender + descender + line gap. */
    val lineHeightPt: Double get() = ascentPt + descentPt + lineGapPt
}
