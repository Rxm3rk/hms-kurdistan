package hms.platform.docs.infrastructure.text

import hms.platform.docs.domain.layout.Direction
import hms.platform.docs.domain.layout.Shaped
import hms.platform.docs.infrastructure.fonts.FontRegistry
import hms.platform.docs.infrastructure.fonts.PrintFont
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldBeSortedWith
import io.kotest.matchers.doubles.plusOrMinus
import io.kotest.matchers.doubles.shouldBeLessThan
import io.kotest.matchers.ints.shouldBeLessThan
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import java.awt.Font

/**
 * The shaping port's adapter (docs/specs/modules/platform-docs.md §5.1, §3.2 R7, §4.1; BUILD-PROMPT §18.9
 * "Bidi", "Digits"). Sample text is synthetic (§19.4): a synthetic Sorani name and `SYN-` identifiers.
 */
class Java2dTextShaperTest :
    FunSpec({
        val registry = FontRegistry.fromClasspath()
        val shaper = Java2dTextShaper(registry)
        val arabic = PrintFont.ARABIC_REGULAR.spec
        val latin = PrintFont.LATIN_REGULAR.spec

        // A synthetic Sorani name (ئاراس کەریم) and a synthetic MRN.
        val soraniName = "ئاراس کەریم"
        val mrn = "SYN-0012345"

        /** The character indices of the glyphs of text[range], in visual order (left to right). */
        fun visualIndices(
            shaped: Shaped,
            range: IntRange,
        ): List<Int> =
            shaped.glyphs
                .filter { it.charIndex in range }
                .sortedBy { it.xPt }
                .map { it.charIndex }

        test("bidi: a Sorani name and a Latin MRN in one right-to-left line keep the MRN in left-to-right order") {
            val text = "$soraniName $mrn"
            val shaped = shaper.shape(text, listOf(arabic, latin), 10.0, Direction.AUTO)
            shaped.rightToLeft shouldBe true
            shaped.missingGlyph shouldBe false
            val mrnRange = text.indexOf(mrn) until text.length
            val mrnOrder = visualIndices(shaped, mrnRange)
            mrnOrder shouldBe mrnOrder.sorted()
            mrnOrder.distinct() shouldBe mrnRange.toList()
            // In a right-to-left paragraph the MRN, which follows the name, is drawn to its left.
            val mrnRight = shaped.glyphs.filter { it.charIndex in mrnRange }.maxOf { it.xPt }
            val nameLeft = shaped.glyphs.filter { it.charIndex < soraniName.length }.minOf { it.xPt }
            mrnRight shouldBeLessThan nameLeft
            // The Sorani letters come from the arabic font, the Latin letters of the MRN from the latin font.
            shaped.glyphs
                .filter { it.charIndex < soraniName.length }
                .map { it.font }
                .toSet() shouldBe setOf(arabic)
            shaped.glyphs
                .filter { it.charIndex in mrnRange }
                .map { it.font }
                .toSet() shouldBe setOf(latin)
        }

        test("bidi: the Sorani name itself is drawn right to left") {
            val shaped = shaper.shape(soraniName, listOf(arabic), 10.0, Direction.AUTO)
            shaped.rightToLeft shouldBe true
            // Logical order runs from the right edge to the left: the first character's glyphs are rightmost.
            val firstX = shaped.glyphs.filter { it.charIndex == 0 }.minOf { it.xPt }
            val lastX = shaped.glyphs.filter { it.charIndex == soraniName.length - 1 }.maxOf { it.xPt }
            lastX shouldBeLessThan firstX
        }

        test("bidi: a digit-only identifier keeps its order under every paragraph direction") {
            val digits = "0012345678"
            for (direction in Direction.entries) {
                val shaped = shaper.shape(digits, listOf(latin), 10.0, direction)
                shaped.missingGlyph shouldBe false
                visualIndices(shaped, digits.indices) shouldBe digits.indices.toList()
                shaped.glyphs.map { it.xPt } shouldBeSortedWith naturalOrder()
            }
            shaper.shape(digits, listOf(latin), 10.0, Direction.LTR).rightToLeft shouldBe false
            shaper.shape(digits, listOf(latin), 10.0, Direction.AUTO).rightToLeft shouldBe false
        }

        test("bidi: Western digits in the arabic font keep their order inside a right-to-left line") {
            val text = "بە 1234"
            val shaped = shaper.shape(text, listOf(arabic), 10.0, Direction.RTL)
            shaped.missingGlyph shouldBe false
            visualIndices(shaped, 3..6) shouldBe listOf(3, 4, 5, 6)
        }

        test("R7: Arabic text in the latin font reports a missing glyph") {
            shaper.shape(soraniName, listOf(latin), 10.0, Direction.AUTO).missingGlyph shouldBe true
            shaper.shape(mrn, listOf(arabic), 10.0, Direction.LTR).missingGlyph shouldBe true
            shaper.shape(mrn, listOf(latin), 10.0, Direction.LTR).missingGlyph shouldBe false
        }

        test("R7: a character no font of the chain covers reports a missing glyph") {
            // U+2248 ≈ is in neither print font (the approximate marker is "~", DN-068).
            shaper.shape("≈ 1990", listOf(latin, arabic), 10.0, Direction.LTR).missingGlyph shouldBe true
            shaper.shape("~ 1990", listOf(latin), 10.0, Direction.LTR).missingGlyph shouldBe false
        }

        test("chain: a character takes the first font that covers it") {
            val shaped = shaper.shape(soraniName, listOf(latin, arabic), 10.0, Direction.AUTO)
            shaped.missingGlyph shouldBe false
            // The space is Common and stays with the arabic run around it.
            shaped.glyphs.map { it.font }.toSet() shouldBe setOf(arabic)
        }

        test("chain: Common characters and marks stay with the surrounding font when it covers them") {
            // With the latin font first, a first-cover rule would set the digits and the mark in Noto Sans;
            // they follow the Arabic letter before them instead, so the line is one arabic segment.
            val text = "بَ 12"
            val shaped = shaper.shape(text, listOf(latin, arabic), 10.0, Direction.AUTO)
            shaped.missingGlyph shouldBe false
            shaped.glyphs.map { it.font }.toSet() shouldBe setOf(arabic)
            // Digits that open a line take the font of the first character of a specific script after them.
            shaper
                .shape("12 ب", listOf(latin, arabic), 10.0, Direction.AUTO)
                .glyphs
                .map { it.font }
                .toSet() shouldBe setOf(arabic)
            shaper
                .shape("12 SYN", listOf(arabic, latin), 10.0, Direction.AUTO)
                .glyphs
                .map { it.font }
                .toSet() shouldBe setOf(latin)
        }

        test("metrics: ascent, descent and line gap are the hhea values at the size, the largest of the fonts used") {
            val a = shaper.shape(soraniName, listOf(arabic), 10.0, Direction.AUTO)
            a.ascentPt shouldBe (13.74 plusOrMinus 1e-9)
            a.descentPt shouldBe (7.38 plusOrMinus 1e-9)
            a.lineGapPt shouldBe 0.0
            val l = shaper.shape(mrn, listOf(latin), 10.0, Direction.LTR)
            l.ascentPt shouldBe (10.69 plusOrMinus 1e-9)
            l.descentPt shouldBe (2.93 plusOrMinus 1e-9)
            // The chain is only measured by the fonts actually used: Latin text with the arabic font second.
            shaper.shape(mrn, listOf(latin, arabic), 10.0, Direction.LTR).ascentPt shouldBe (10.69 plusOrMinus 1e-9)
            val mixed = shaper.shape("$soraniName $mrn", listOf(arabic, latin), 10.0, Direction.AUTO)
            mixed.ascentPt shouldBe (13.74 plusOrMinus 1e-9)
            mixed.lineHeightPt shouldBe (21.12 plusOrMinus 1e-9)
        }

        test("kern and liga are on and change the advance") {
            val text = "AVfi"
            val shaped = shaper.shape(text, listOf(latin), 20.0, Direction.LTR)
            // The plain font at the same size, without the kerning and ligature attributes.
            val plain = registry.font(PrintFont.LATIN_REGULAR).awtFont.deriveFont(20f)
            val plainGv = plain.layoutGlyphVector(Java2dTextShaper.FRC, text.toCharArray(), 0, text.length, Font.LAYOUT_LEFT_TO_RIGHT)
            val plainAdvance = plainGv.getGlyphPosition(plainGv.numGlyphs).x
            shaped.advancePt shouldBeLessThan plainAdvance
            // "fi" becomes one ligature glyph.
            shaped.glyphs.size shouldBeLessThan plainGv.numGlyphs
            // Kerning alone: "AV" is narrower than its two glyphs set apart.
            val av = shaper.shape("AV", listOf(latin), 20.0, Direction.LTR).advancePt
            val separate =
                shaper.shape("A", listOf(latin), 20.0, Direction.LTR).advancePt +
                    shaper.shape("V", listOf(latin), 20.0, Direction.LTR).advancePt
            av shouldBeLessThan separate
        }

        test("determinism: the same input gives identical glyphs, also from a new shaper") {
            val text = "$soraniName $mrn"
            val first = shaper.shape(text, listOf(arabic, latin), 9.5, Direction.AUTO)
            shaper.shape(text, listOf(arabic, latin), 9.5, Direction.AUTO) shouldBe first
            Java2dTextShaper(registry).shape(text, listOf(arabic, latin), 9.5, Direction.AUTO) shouldBe first
        }

        test("ZWNJ is shaped as an invisible glyph, never the missing glyph, and breaks the join") {
            val joined = shaper.shape("بب", listOf(arabic), 10.0, Direction.RTL)
            val broken = shaper.shape("ب‌ب", listOf(arabic), 10.0, Direction.RTL)
            broken.missingGlyph shouldBe false
            broken.glyphs.filter { it.charIndex == 1 }.map { it.glyphId } shouldBe listOf(Java2dTextShaper.INVISIBLE_GLYPH)
            broken.glyphs.filter { it.charIndex == 0 }.map { it.glyphId } shouldNotBe
                joined.glyphs.filter { it.charIndex == 0 }.map { it.glyphId }
        }

        test("an empty line has no glyphs and the first font's metrics") {
            val shaped = shaper.shape("", listOf(arabic, latin), 10.0, Direction.AUTO)
            shaped.glyphs.size shouldBe 0
            shaped.advancePt shouldBe 0.0
            shaped.missingGlyph shouldBe false
            shaped.ascentPt shouldBe (13.74 plusOrMinus 1e-9)
        }

        test("advance is the sum of the runs: positions lie within it") {
            val shaped = shaper.shape("$soraniName $mrn", listOf(arabic, latin), 10.0, Direction.AUTO)
            shaped.glyphs.forEach { (it.xPt <= shaped.advancePt) shouldBe true }
            (shaped.advancePt > 0.0) shouldBe true
        }
    })
