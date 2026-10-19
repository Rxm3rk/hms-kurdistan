package hms.platform.docs.domain.layout

import hms.kernel.testing.PropertyTestBudget
import hms.platform.docs.domain.template.FontRole
import hms.platform.docs.domain.template.FontWeight
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.property.Arb
import io.kotest.property.arbitrary.bind
import io.kotest.property.arbitrary.boolean
import io.kotest.property.arbitrary.double
import io.kotest.property.arbitrary.element
import io.kotest.property.arbitrary.int
import io.kotest.property.arbitrary.list
import io.kotest.property.checkAll

/** Deterministic shaper: the advance of each character depends on the character (so lines are not uniform). */
private class VaryingShaper(
    private val missing: Set<Char>,
) : TextShaper {
    override fun shape(
        text: String,
        fonts: List<FontSpec>,
        sizePt: Double,
        direction: Direction,
    ): Shaped {
        val glyphs = text.mapIndexed { i, c -> ShapedGlyph(if (c in missing) 0 else c.code, 0.0, 0.0, i, fonts.first()) }
        return Shaped(
            advancePt = text.sumOf { advanceEm(it) } * sizePt,
            ascentPt = ASCENT_EM * sizePt,
            descentPt = DESCENT_EM * sizePt,
            lineGapPt = GAP_EM * sizePt,
            rightToLeft =
                direction == Direction.RTL || (direction == Direction.AUTO && (text.firstOrNull { it.isLetter() }?.code ?: 0) in ARABIC),
            missingGlyph = glyphs.any { it.glyphId == 0 },
            glyphs = glyphs,
        )
    }

    private fun advanceEm(c: Char): Double = WIDTHS[c.code % WIDTHS.size]

    companion object {
        const val ASCENT_EM = 1.4
        const val DESCENT_EM = 0.71
        const val GAP_EM = 0.1
        val WIDTHS = listOf(0.25, 0.5, 0.6, 0.33, 0.9, 0.45)
        val ARABIC = 0x0600..0x06FF
    }
}

private val ZWSP = Char(0x200B)
private val breakChars = setOf(' ', ZWSP)
private val alphabet = listOf('a', 'b', 'Z', '7', '-', 'ش', 'ی', 'ڵ', 'ە', ' ', ' ', ZWSP, Char(0x200C), 'x')

private data class Case(
    val text: String,
    val widthMm: Double,
    val heightMm: Double,
    val maxPt: Double,
    val minPt: Double,
    val maxLines: Int,
    val dotsPerMm: Double,
    val grow: Boolean,
    val missingX: Boolean,
)

private val cases: Arb<Case> =
    Arb.bind(
        Arb.list(Arb.element(alphabet), 0..60),
        Arb.double(1.0, 120.0),
        Arb.double(1.0, 40.0),
        Arb.double(4.0, 20.0),
        Arb.double(0.0, 1.0),
        Arb.int(1..4),
        Arb.element(listOf(7.087, 8.0, 12.0, 24.0)),
        Arb.boolean(),
        Arb.boolean(),
    ) { chars, w, h, max, minShare, lines, dpm, grow, missingX ->
        Case(chars.joinToString(""), w, h, max, 3.0 + (max - 3.0) * minShare, lines, dpm, grow, missingX)
    }

/**
 * True when [text] is exactly the lines joined by non-empty runs of break characters: every character in order, only
 * break characters (U+0020, ZWSP) at the breaks left out, no line starting or ending inside a word cut.
 */
private fun reassembles(
    text: String,
    lines: List<String>,
): Boolean {
    var i = 0
    var ok = lines.isNotEmpty()
    lines.forEachIndexed { k, line ->
        ok = ok && text.startsWith(line, i)
        i += line.length
        if (k < lines.lastIndex) {
            val start = i
            while (i < text.length && text[i] in breakChars) i++
            // A break needs a gap, and a line never ends or starts with the gap at a break.
            ok = ok && i > start && line.isNotEmpty() && line.last() !in breakChars
        }
    }
    return ok && i == text.length
}

class FitNeverTruncatesPropertyTest :
    FunSpec({
        test("PropertyTest:fit-never-truncates: every character placed in order and every line fits, or a refusal") {
            checkAll(PropertyTestBudget.sequences(), cases) { case ->
                val shaper = VaryingShaper(if (case.missingX) setOf('x') else emptySet())
                val fonts = listOf(FontSpec(FontRole.ARABIC, FontWeight.REGULAR), FontSpec(FontRole.LATIN, FontWeight.REGULAR))
                val request =
                    FitRequest(
                        text = case.text,
                        fonts = fonts,
                        direction = Direction.AUTO,
                        maxPt = case.maxPt,
                        minPt = case.minPt,
                        maxLines = case.maxLines,
                        boxWidthMm = case.widthMm,
                        boxHeightMm = case.heightMm,
                        dotsPerMm = case.dotsPerMm,
                        growWhenNoFit = case.grow,
                    )
                when (val outcome = Fitter(shaper).fit(request)) {
                    is FitOutcome.Fitted -> {
                        reassembles(case.text, outcome.lines.map { it.text }) shouldBe true
                        (case.missingX && 'x' in case.text) shouldBe false
                        val limit = Fitter.WIDTH_SHARE * Dots.mmToPt(case.widthMm) + 1e-9
                        outcome.lines.forEach { line ->
                            val shaped = shaper.shape(line.text, fonts, outcome.sizePt, Direction.AUTO)
                            (shaped.advancePt <= limit) shouldBe true
                            line.advancePt shouldBe shaped.advancePt
                        }
                        (outcome.sizePt >= case.minPt - 1e-9) shouldBe true
                        Dots.quantisePt(outcome.sizePt, case.dotsPerMm) shouldBe outcome.sizePt
                        if (!outcome.grown) {
                            (outcome.lines.size <= case.maxLines) shouldBe true
                            (outcome.blockHeightPt <= Dots.mmToPt(case.heightMm) + 1e-9) shouldBe true
                        } else {
                            case.grow shouldBe true
                        }
                    }

                    FitOutcome.MissingGlyph -> {
                        (case.missingX && 'x' in case.text) shouldBe true
                    }

                    is FitOutcome.DoesNotFit -> {
                        Unit
                    }
                }
            }
        }

        test("PropertyTest:fit-never-truncates: a text that fits on one line at the maximum size is never refused") {
            checkAll(PropertyTestBudget.sequences(), Arb.list(Arb.element(alphabet.filter { it != 'x' }), 1..30)) { chars ->
                val text = chars.joinToString("")
                val shaper = VaryingShaper(emptySet())
                val fonts = listOf(FontSpec(FontRole.LATIN, FontWeight.REGULAR))
                val size = Dots.quantisePt(10.0, 8.0)
                val width = shaper.shape(text, fonts, size, Direction.AUTO).advancePt
                val request =
                    FitRequest(
                        text = text,
                        fonts = fonts,
                        direction = Direction.AUTO,
                        maxPt = size,
                        minPt = size,
                        maxLines = 1,
                        boxWidthMm = Dots.ptToMm(width / Fitter.WIDTH_SHARE) + 1e-6,
                        boxHeightMm = Dots.ptToMm((VaryingShaper.ASCENT_EM + VaryingShaper.DESCENT_EM) * size) + 1e-6,
                        dotsPerMm = 8.0,
                    )
                val fitted = Fitter(shaper).fit(request)
                (fitted is FitOutcome.Fitted && fitted.lines.single().text == text) shouldBe true
            }
        }
    })
