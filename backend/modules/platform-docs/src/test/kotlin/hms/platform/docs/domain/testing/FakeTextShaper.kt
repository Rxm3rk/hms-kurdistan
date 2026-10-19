package hms.platform.docs.domain.testing

import hms.platform.docs.domain.layout.Direction
import hms.platform.docs.domain.layout.FontSpec
import hms.platform.docs.domain.layout.Shaped
import hms.platform.docs.domain.layout.ShapedGlyph
import hms.platform.docs.domain.layout.TextShaper
import hms.platform.docs.domain.template.FontRole

/** `hhea`-like metrics of a fake font, in em. */
data class FakeMetrics(
    val ascentEm: Double,
    val descentEm: Double,
    val lineGapEm: Double = 0.0,
)

/**
 * A deterministic [TextShaper] for domain tests (no java.awt): every code point advances [advanceEm] × size; metrics
 * per role (defaults close to Noto Sans and Noto Sans Arabic, whose extent is about 2.11 em, spec §5.3); a code point
 * in [missing] is a missing glyph; with [realisticCoverage] the Arabic font has no Latin letters and the Latin font
 * no Arabic letters (spec §9), as the real fonts.
 */
class FakeTextShaper(
    private val advanceEm: Double = 0.5,
    private val metrics: Map<FontRole, FakeMetrics> =
        mapOf(FontRole.ARABIC to FakeMetrics(1.4, 0.71), FontRole.LATIN to FakeMetrics(1.069, 0.293)),
    private val missing: Set<Int> = emptySet(),
    private val realisticCoverage: Boolean = true,
) : TextShaper {
    /** Every call, for assertions on what was shaped. */
    val calls = mutableListOf<Call>()

    data class Call(
        val text: String,
        val fonts: List<FontSpec>,
        val sizePt: Double,
        val direction: Direction,
    )

    override fun shape(
        text: String,
        fonts: List<FontSpec>,
        sizePt: Double,
        direction: Direction,
    ): Shaped {
        calls += Call(text, fonts, sizePt, direction)
        val codePoints = text.codePoints().toArray()
        val glyphs =
            codePoints.mapIndexed { i, cp ->
                val font = fonts.firstOrNull { covers(it.role, cp) }
                ShapedGlyph(if (font == null || cp in missing) 0 else cp, i * advanceEm * sizePt, 0.0, i, font ?: fonts.first())
            }
        val used = fonts.map { metrics.getValue(it.role) }
        return Shaped(
            advancePt = codePoints.size * advanceEm * sizePt,
            ascentPt = used.maxOf { it.ascentEm } * sizePt,
            descentPt = used.maxOf { it.descentEm } * sizePt,
            lineGapPt = used.maxOf { it.lineGapEm } * sizePt,
            rightToLeft =
                when (direction) {
                    Direction.LTR -> false
                    Direction.RTL -> true
                    Direction.AUTO -> firstStrongIsRightToLeft(codePoints)
                },
            missingGlyph = glyphs.any { it.glyphId == 0 },
            glyphs = glyphs,
        )
    }

    private fun covers(
        role: FontRole,
        codePoint: Int,
    ): Boolean {
        if (!realisticCoverage) return true
        val script = Character.UnicodeScript.of(codePoint)
        val shared = script == Character.UnicodeScript.COMMON || script == Character.UnicodeScript.INHERITED
        return shared ||
            when (role) {
                FontRole.ARABIC -> script == Character.UnicodeScript.ARABIC
                FontRole.LATIN -> script == Character.UnicodeScript.LATIN
            }
    }

    private fun firstStrongIsRightToLeft(codePoints: IntArray): Boolean =
        codePoints
            .asSequence()
            .map { Character.getDirectionality(it) }
            .firstOrNull {
                it == Character.DIRECTIONALITY_LEFT_TO_RIGHT ||
                    it == Character.DIRECTIONALITY_RIGHT_TO_LEFT ||
                    it == Character.DIRECTIONALITY_RIGHT_TO_LEFT_ARABIC
            }?.let { it != Character.DIRECTIONALITY_LEFT_TO_RIGHT } ?: false
}

/** The string of one code point (the test sources never hold invisible or bidi characters literally). */
fun cp(codePoint: Int): String = String(Character.toChars(codePoint))

/** A code point as four or more upper-case hexadecimal digits, for test names. */
fun hex(codePoint: Int): String = codePoint.toString(16).uppercase().padStart(4, '0')
