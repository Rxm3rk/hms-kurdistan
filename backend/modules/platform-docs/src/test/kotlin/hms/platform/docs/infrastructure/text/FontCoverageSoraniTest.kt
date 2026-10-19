package hms.platform.docs.infrastructure.text

import hms.platform.docs.domain.layout.Direction
import hms.platform.docs.domain.layout.ShapedGlyph
import hms.platform.docs.infrastructure.fonts.FontRegistry
import hms.platform.docs.infrastructure.fonts.PrintFont
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.collections.shouldNotContain
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe

/**
 * `UnitTest:font-coverage-sorani` (docs/specs/modules/platform-docs.md §9 points 1 to 3; BUILD-PROMPT §4.1
 * "Fonts", §11.1, §18.9 "Script"; HAZ-0045). Point 4 (the list against `sorani-letters.json`) follows the
 * WP-0.7 merge. Each Sorani letter is shaped alone, at the start, in the middle and at the end of a word
 * with BEH as its partner, in both weights of the `arabic` font.
 */
class FontCoverageSoraniTest :
    FunSpec({
        val registry = FontRegistry.fromClasspath()
        val shaper = Java2dTextShaper(registry)
        val arabicFonts = listOf(PrintFont.ARABIC_REGULAR, PrintFont.ARABIC_BOLD)
        val latinFonts = listOf(PrintFont.LATIN_REGULAR, PrintFont.LATIN_BOLD)
        val size = 12.0
        val partner = SoraniLetters.PARTNER

        // Point 1: the Arabic-script repertoire. Arabic letters U+0621-U+063A and U+0641-U+064A include
        // ى (U+0649), ة (U+0629) and the hamza forms ء آ أ ؤ إ ئ (U+0621-U+0626).
        val arabicRepertoire: List<Int> =
            SoraniLetters.ALL.map { it.codePoint } +
                listOf(0x06BE, 0x064A, 0x06CC, 0x0643, 0x06A9, 0x0647, 0x06D5) +
                (0x0621..0x063A) + (0x0641..0x064A) +
                listOf(0x0649, 0x0629, 0x0621, 0x0622, 0x0623, 0x0624, 0x0625, 0x0626) +
                listOf(0x200C, 0x200D, 0x060C)

        // Point 1: the Latin repertoire: Basic Latin printable (letters, Western digits, separators), the
        // letters of transliterated Kurdish names ç ê î û ş Ç Ê Î Û Ş, and the en dash of the synthetic notice
        // ("SYNTHETIC – NOT FOR CLINICAL USE", §19.4).
        val latinRepertoire: List<Int> =
            (0x0020..0x007E).toList() + "çêîûşÇÊÎÛŞ".map { it.code } + listOf(0x2013)

        fun hex(cps: List<Int>) = cps.map { "U+%04X".format(it) }

        arabicFonts.forEach { pf ->
            test("UnitTest:font-coverage-sorani: ${pf.fileName} cmap covers the Sorani and Arabic repertoire") {
                hex(arabicRepertoire.filterNot(registry.font(pf)::covers)).shouldBeEmpty()
            }
        }
        latinFonts.forEach { pf ->
            test("UnitTest:font-coverage-sorani: ${pf.fileName} cmap covers Basic Latin, Kurdish Latin letters and digits") {
                hex(latinRepertoire.filterNot(registry.font(pf)::covers)).shouldBeEmpty()
            }
        }

        /** The four positions of [letter]; returns the text and the index of the letter in it. */
        fun forms(letter: Char): Map<String, Pair<String, Int>> =
            linkedMapOf(
                "isolated" to ("$letter" to 0),
                "initial" to ("$letter$partner" to 0),
                "medial" to ("$partner$letter$partner" to 1),
                "final" to ("$partner$letter" to 1),
            )

        fun cluster(
            pf: PrintFont,
            text: String,
            index: Int,
        ): List<ShapedGlyph> {
            val shaped = shaper.shape(text, listOf(pf.spec), size, Direction.RTL)
            withClue("$text in ${pf.fileName}") { shaped.missingGlyph shouldBe false }
            return shaped.glyphs.filter { it.charIndex == index }
        }

        arabicFonts.forEach { pf ->
            val classes = GlyphClasses.read(registry.font(pf).bytes())

            test("UnitTest:font-coverage-sorani: ${pf.fileName} shapes every Sorani letter in all four positions with no missing glyph") {
                SoraniLetters.ALL.forEach { letter ->
                    forms(letter.char).forEach { (form, textAndIndex) ->
                        val glyphs = cluster(pf, textAndIndex.first, textAndIndex.second)
                        withClue("${letter.name} $form") {
                            glyphs.isEmpty() shouldBe false
                            glyphs.map { it.glyphId } shouldNotContain 0
                        }
                    }
                }
            }

            test("UnitTest:font-coverage-sorani: ${pf.fileName} dual-joining letters give four different glyph sequences") {
                SoraniLetters.DUAL_JOINING.forEach { letter ->
                    val sequences = forms(letter.char).mapValues { (_, t) -> cluster(pf, t.first, t.second).map { it.glyphId } }
                    withClue("${letter.name}: $sequences") { sequences.values.toSet() shouldHaveSize 4 }
                }
            }

            test("UnitTest:font-coverage-sorani: ${pf.fileName} right-joining letters differ isolated and final") {
                SoraniLetters.RIGHT_JOINING.forEach { letter ->
                    val f = forms(letter.char)
                    val isolated = f.getValue("isolated").let { cluster(pf, it.first, it.second).map { g -> g.glyphId } }
                    val final = f.getValue("final").let { cluster(pf, it.first, it.second).map { g -> g.glyphId } }
                    withClue(letter.name) { isolated shouldNotBe final }
                }
            }

            test("UnitTest:font-coverage-sorani: ${pf.fileName} every mark glyph is positioned off its base") {
                var clustersWithMarks = 0
                SoraniLetters.ALL.forEach { letter ->
                    forms(letter.char).forEach { (form, t) ->
                        val glyphs = cluster(pf, t.first, t.second)
                        val marks = glyphs.filter { classes.isMark(it.glyphId) }
                        if (glyphs.size > 1) {
                            withClue("${letter.name} $form: a decomposed cluster has one base and its marks") {
                                glyphs.count { classes.isBase(it.glyphId) } shouldBe 1
                                marks.size shouldBe glyphs.size - 1
                            }
                            val base = glyphs.single { classes.isBase(it.glyphId) }
                            marks.forEach { mark ->
                                withClue("${letter.name} $form: mark ${mark.glyphId} on base ${base.glyphId}") {
                                    (mark.xPt != base.xPt || mark.yPt != base.yPt) shouldBe true
                                }
                            }
                            clustersWithMarks++
                        }
                    }
                }
                // The font decomposes most Sorani letters (spec §9 point 3); the check must have run on them.
                (clustersWithMarks > 0) shouldBe true
            }

            test("UnitTest:font-coverage-sorani: ${pf.fileName} ڕ/ر, ڵ/ل and ێ/ی never shape alike") {
                SoraniLetters.LOOKALIKES.forEach { (sorani, arabic) ->
                    val joining = SoraniLetters.ALL.single { it.char == sorani }.dualJoining
                    val positions = if (joining) listOf("isolated", "initial", "medial", "final") else listOf("isolated", "final")
                    positions.forEach { form ->
                        val s = forms(sorani).getValue(form)
                        val a = forms(arabic).getValue(form)
                        val soraniGlyphs = cluster(pf, s.first, s.second).map { it.glyphId }
                        val arabicGlyphs = cluster(pf, a.first, a.second).map { it.glyphId }
                        withClue("$sorani vs $arabic $form") { soraniGlyphs shouldNotBe arabicGlyphs }
                    }
                }
            }
        }
    })
