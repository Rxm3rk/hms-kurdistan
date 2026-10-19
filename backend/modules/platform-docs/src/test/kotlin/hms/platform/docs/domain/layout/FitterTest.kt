package hms.platform.docs.domain.layout

import hms.platform.docs.domain.template.FontRole
import hms.platform.docs.domain.template.FontWeight
import hms.platform.docs.domain.testing.FakeMetrics
import hms.platform.docs.domain.testing.FakeTextShaper
import hms.platform.docs.domain.testing.cp
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.doubles.plusOrMinus
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf

private val latin = listOf(FontSpec(FontRole.LATIN, FontWeight.REGULAR))
private val arabic = listOf(FontSpec(FontRole.ARABIC, FontWeight.REGULAR))

/** 1 em advance per character, ascent 0.8 em, descent 0.2 em, no gap: simple arithmetic for boundary cases. */
private val square =
    FakeTextShaper(
        advanceEm = 1.0,
        metrics = mapOf(FontRole.LATIN to FakeMetrics(0.8, 0.2), FontRole.ARABIC to FakeMetrics(0.8, 0.2)),
    )

private fun mm(pt: Double) = Dots.ptToMm(pt)

/** A request at 24 dots/mm, where 10 pt quantises to 10.0157 pt; [fitAt10] boxes are sized from that. */
@Suppress("LongParameterList")
private fun request(
    text: String,
    widthMm: Double,
    heightMm: Double,
    maxLines: Int = 1,
    max: Double = 10.0,
    min: Double = 10.0,
    fonts: List<FontSpec> = latin,
    direction: Direction = Direction.AUTO,
    grow: Boolean = false,
    dotsPerMm: Double = 24.0,
) = FitRequest(text, fonts, direction, max, min, maxLines, widthMm, heightMm, dotsPerMm, grow)

private fun Fitter.fitted(request: FitRequest) = fit(request).shouldBeInstanceOf<FitOutcome.Fitted>()

private val q10 = Dots.quantisePt(10.0, 24.0)

class FitterTest :
    FunSpec({
        context("quantisation (spec §5.3, §5.4)") {
            test("size to dots rounds half up once") {
                Dots.fromPt(12.0, 8.0) shouldBe 34 // 33.87 dots
                Dots.fromPt(8.0, 8.0) shouldBe 23 // 22.58
                Dots.fromPt(7.5, 8.0) shouldBe 21 // 21.17
                Dots.fromPt(7.0, 12.0) shouldBe 30 // 29.63
                Dots.fromPt(6.0, 8.0) shouldBe 17 // 16.93
                Dots.fromPt(9.0, 8.0) shouldBe 25 // 25.4
                Dots.fromPt(72.0 * 2.5 / 25.4, 8.0) shouldBe 20 // exactly 20 dots
            }

            test("an exact half dot rounds up") {
                // 0.5 dot at 1 dot/mm is 0.5 mm = 72 × 0.5 / 25.4 pt.
                Dots.fromMm(0.5, 1.0) shouldBe 1
                Dots.fromMm(2.5, 1.0) shouldBe 3
                Dots.fromMm(25.4, 8.0) shouldBe 203
                Dots.fromMm(25.4, 7.087) shouldBe 180
            }

            test("quantised sizes come back to points") {
                Dots.quantisePt(12.0, 8.0) shouldBe (34 * 72.0 / (25.4 * 8.0) plusOrMinus 1e-12)
            }

            test("candidate sizes: max down to min in 0.5 pt steps, quantised, never below the minimum") {
                val sizes = Fitter.candidateSizes(9.0, 7.5, 8.0)
                // 9 → 25 dots (8.858), 8.5 → 24 (8.504), 8 → 23 (8.150), 7.5 → 21 dots = 7.441 < 7.5: skipped.
                sizes.size shouldBe 3
                sizes[0] shouldBe (Dots.quantisePt(9.0, 8.0) plusOrMinus 1e-12)
                sizes.last() shouldBe (Dots.quantisePt(8.0, 8.0) plusOrMinus 1e-12)
                sizes.all { it >= 7.5 } shouldBe true
            }

            test("the minimum itself is tried when the steps miss it") {
                // 7.9 pt at 24 dots/mm is 66.89 dots → 67 → 7.913 pt (7.8 would round down below its own minimum).
                Fitter.candidateSizes(9.0, 7.9, 24.0).last() shouldBe (Dots.quantisePt(7.9, 24.0) plusOrMinus 1e-12)
            }

            test("no sizes for an inverted range, a non-positive size or resolution") {
                Fitter.candidateSizes(7.0, 8.0, 8.0).shouldBeEmpty()
                Fitter.candidateSizes(7.0, 0.0, 8.0).shouldBeEmpty()
                Fitter.candidateSizes(7.0, 6.0, 0.0).shouldBeEmpty()
                Fitter.candidateSizes(Double.NaN, 6.0, 8.0).shouldBeEmpty()
            }
        }

        context("UnitTest:fit-never-truncates") {
            val fitter = Fitter(square)
            val width10 = mm(q10) / Fitter.WIDTH_SHARE // the box width where exactly one 10 pt character fills 95%

            test("a line exactly 95% of the box fits; one character more does not and wraps") {
                val fitted = fitter.fitted(request("ab cd", width10 * 5, mm(q10), maxLines = 1))
                fitted.lines.map { it.text } shouldContainExactly listOf("ab cd")
                val wrapped = fitter.fitted(request("ab cde", width10 * 5, mm(q10 * 2), maxLines = 2))
                wrapped.lines.map { it.text } shouldContainExactly listOf("ab", "cde")
            }

            test("a block exactly the box height fits; a hair less does not") {
                // Two lines: 0.8 + 1.0 + 0.2 = 2.0 em.
                fitter.fitted(request("ab cd", width10 * 2, mm(q10 * 2), maxLines = 2)).lines.size shouldBe 2
                fitter.fit(request("ab cd", width10 * 2, mm(q10 * 2) - 1e-6, maxLines = 2)).shouldBeInstanceOf<FitOutcome.DoesNotFit>()
            }

            test("a word wider than the box at the minimum size is refused, never split") {
                fitter.fit(request("abcdef", width10 * 5, 100.0, maxLines = 5)) shouldBe
                    FitOutcome.DoesNotFit("a word is wider than 95% of the box at the minimum size")
            }

            test("more lines than max_lines is refused, never the first lines only") {
                fitter.fit(request("ab cd ef", width10 * 2, 100.0, maxLines = 2)) shouldBe
                    FitOutcome.DoesNotFit("more lines than max_lines at the minimum size")
            }

            test("lines break only at U+0020 and ZWSP, which are left out at the break") {
                val zwsp = cp(0x200B)
                val fitted = fitter.fitted(request("ab${zwsp}cd ef", width10 * 2, 100.0, maxLines = 3))
                fitted.lines.map { it.text } shouldContainExactly listOf("ab", "cd", "ef")
            }

            test("ZWNJ, hyphens and NBSP are not break points") {
                val zwnj = cp(0x200C)
                fitter.fit(request("ab${zwnj}cd", width10 * 3, 100.0, maxLines = 3)).shouldBeInstanceOf<FitOutcome.DoesNotFit>()
                fitter.fit(request("ab-cd", width10 * 3, 100.0, maxLines = 3)).shouldBeInstanceOf<FitOutcome.DoesNotFit>()
                fitter.fit(request("ab" + cp(0x00A0) + "cd", width10 * 3, 100.0, maxLines = 3)).shouldBeInstanceOf<FitOutcome.DoesNotFit>()
            }

            test("a run of spaces at a break is left out whole; inner runs stay") {
                fitter.fitted(request("ab   cd", width10 * 2, 100.0, maxLines = 2)).lines.map { it.text } shouldContainExactly
                    listOf("ab", "cd")
                fitter.fitted(request("a  b", width10 * 4, 100.0)).lines.map { it.text } shouldContainExactly listOf("a  b")
            }

            test("leading and trailing spaces stay with the first and last line") {
                fitter.fitted(request(" ab cd ", width10 * 3, 100.0, maxLines = 2)).lines.map { it.text } shouldContainExactly
                    listOf(" ab", "cd ")
            }

            test("the largest size that fits wins, shrinking in 0.5 pt steps") {
                val fitted =
                    fitter.fitted(
                        request("abcd", mm(4 * Dots.quantisePt(9.0, 24.0)) / Fitter.WIDTH_SHARE, 100.0, max = 12.0, min = 6.0),
                    )
                fitted.sizePt shouldBe (Dots.quantisePt(9.0, 24.0) plusOrMinus 1e-12)
            }

            test("the effective minimum is never crossed: no fit is a refusal") {
                fitter.fit(request("abcd", mm(4 * 5.0), 100.0, max = 12.0, min = 6.0)).shouldBeInstanceOf<FitOutcome.DoesNotFit>()
            }

            test("block height uses the font's metrics, not a fixed factor") {
                val tall = FakeTextShaper(advanceEm = 1.0, metrics = mapOf(FontRole.ARABIC to FakeMetrics(1.4, 0.71)))
                val fitted = Fitter(tall).fitted(request("ب", 100.0, 100.0, fonts = arabic, maxLines = 1))
                fitted.blockHeightPt shouldBe (2.11 * q10 plusOrMinus 1e-9)
                fitted.lineHeightPt shouldBe (2.11 * q10 plusOrMinus 1e-9)
                // 1.2 em would have fitted in 1.2 × size; the real extent does not.
                Fitter(tall).fit(request("ب", 100.0, mm(1.2 * q10), fonts = arabic)).shouldBeInstanceOf<FitOutcome.DoesNotFit>()
            }

            test("an empty box never fits") {
                fitter.fit(request("ab", 0.0, 10.0)).shouldBeInstanceOf<FitOutcome.DoesNotFit>()
                fitter.fit(request("ab", 10.0, 0.0)).shouldBeInstanceOf<FitOutcome.DoesNotFit>()
                fitter.fit(request("ab", 10.0, 10.0, maxLines = 0)).shouldBeInstanceOf<FitOutcome.DoesNotFit>()
            }

            test("wrap-grow takes as many lines as needed at the smallest size and says it grew") {
                val fitted = fitter.fitted(request("ab cd ef gh", width10 * 2, mm(q10), maxLines = 1, grow = true))
                fitted.grown shouldBe true
                fitted.lines.map { it.text } shouldContainExactly listOf("ab", "cd", "ef", "gh")
            }

            test("wrap-grow still refuses a word wider than the box") {
                fitter.fit(request("abcdef", width10 * 2, mm(q10), grow = true)).shouldBeInstanceOf<FitOutcome.DoesNotFit>()
            }
        }

        context("R7: missing glyphs") {
            test("a missing glyph is refused whatever the size") {
                val shaper = FakeTextShaper(missing = setOf('x'.code))
                Fitter(shaper).fit(request("abx", 100.0, 100.0)) shouldBe FitOutcome.MissingGlyph
            }

            test("a Latin letter in an Arabic-only font is a missing glyph") {
                Fitter(FakeTextShaper()).fit(request("شیلان A", 100.0, 100.0, fonts = arabic)) shouldBe FitOutcome.MissingGlyph
            }

            test("a missing glyph wins over not fitting") {
                Fitter(FakeTextShaper(missing = setOf('x'.code))).fit(request("abcdefghx", 1.0, 1.0)) shouldBe FitOutcome.MissingGlyph
            }

            test("a font chain covers mixed text") {
                Fitter(
                    FakeTextShaper(),
                ).fit(request("شیلان A", 100.0, 100.0, fonts = arabic + latin)).shouldBeInstanceOf<FitOutcome.Fitted>()
            }
        }

        context("direction") {
            test("the paragraph direction is resolved once and forced on every line") {
                val shaper = FakeTextShaper(advanceEm = 1.0)
                val fitted =
                    Fitter(shaper).fitted(
                        request(
                            "شیلان Ahmad",
                            mm(6 * q10) / Fitter.WIDTH_SHARE,
                            100.0,
                            maxLines = 2,
                            fonts =
                                arabic + latin,
                        ),
                    )
                fitted.rightToLeft shouldBe true
                fitted.lines.map { it.text } shouldContainExactly listOf("شیلان", "Ahmad")
                shaper.calls.drop(1).all { it.direction == Direction.RTL } shouldBe true
            }

            test("forced LTR stays LTR") {
                val shaper = FakeTextShaper()
                Fitter(shaper).fitted(request("12345", 100.0, 100.0, direction = Direction.LTR)).rightToLeft shouldBe false
                shaper.calls.all { it.direction == Direction.LTR } shouldBe true
            }
        }
    })
