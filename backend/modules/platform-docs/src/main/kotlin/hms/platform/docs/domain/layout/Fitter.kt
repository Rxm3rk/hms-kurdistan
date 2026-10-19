package hms.platform.docs.domain.layout

import hms.platform.docs.domain.rules.TextChecks
import java.math.BigDecimal
import java.math.RoundingMode

/**
 * Conversions to whole printer dots (docs/specs/modules/platform-docs.md §5.3, §5.4): exact decimal
 * arithmetic, rounding half up once, never accumulated.
 */
object Dots {
    private const val MM_PER_INCH_TIMES_TEN: Int = 254
    private const val PT_PER_INCH_TIMES_TEN: Int = 720
    private const val DIVISION_SCALE: Int = 12
    private const val PT_PER_INCH: Double = 72.0
    private const val MM_PER_INCH: Double = 25.4

    /** Millimetres to dots: round_half_up(mm × dots/mm). */
    fun fromMm(
        mm: Double,
        dotsPerMm: Double,
    ): Long =
        BigDecimal
            .valueOf(mm)
            .multiply(BigDecimal.valueOf(dotsPerMm))
            .setScale(0, RoundingMode.HALF_UP)
            .toLong()

    /** A type size to dots: round_half_up(size_pt / 72 × 25.4 × dots/mm). */
    fun fromPt(
        sizePt: Double,
        dotsPerMm: Double,
    ): Long =
        BigDecimal
            .valueOf(sizePt)
            .multiply(BigDecimal(MM_PER_INCH_TIMES_TEN))
            .multiply(BigDecimal.valueOf(dotsPerMm))
            .divide(BigDecimal(PT_PER_INCH_TIMES_TEN), DIVISION_SCALE, RoundingMode.HALF_UP)
            .setScale(0, RoundingMode.HALF_UP)
            .toLong()

    /** A type size quantised to whole dots and converted back to points (spec §5.3). */
    fun quantisePt(
        sizePt: Double,
        dotsPerMm: Double,
    ): Double = fromPt(sizePt, dotsPerMm) * PT_PER_INCH / (MM_PER_INCH * dotsPerMm)

    fun ptToMm(pt: Double): Double = pt * MM_PER_INCH / PT_PER_INCH

    fun mmToPt(mm: Double): Double = mm * PT_PER_INCH / MM_PER_INCH
}

/**
 * What the fit rule fits: one paragraph of text into one box.
 *
 * @property fonts the font chain (identity text: exactly one font, spec §4.1)
 * @property direction the element's paragraph direction: AUTO (the first strong character decides, for the
 *   whole paragraph), LTR (identifiers, dates) or RTL (captions in `ckb` and `ar`)
 * @property minPt the effective minimum: the larger of `size_pt.min` and, for identity text, the legibility
 *   minimum (spec §5.3, §5.4)
 * @property growWhenNoFit `wrap-grow` (non-identity text in flow kinds): when no size fits, the block takes as
 *   many lines as it needs at the smallest size and the frame grows; text is still never cut
 */
data class FitRequest(
    val text: String,
    val fonts: List<FontSpec>,
    val direction: Direction,
    val maxPt: Double,
    val minPt: Double,
    val maxLines: Int,
    val boxWidthMm: Double,
    val boxHeightMm: Double,
    val dotsPerMm: Double,
    val growWhenNoFit: Boolean = false,
)

/** One line as the fit rule broke it, with its shaped advance. */
data class FittedLine(
    val text: String,
    val advancePt: Double,
)

/** The outcome of fitting: the size and lines, or why the text cannot be placed. Never a partial text. */
sealed interface FitOutcome {
    /**
     * Every character of the input is in [lines], in order; only the break characters (U+0020, U+200B) at
     * the chosen breaks are left out.
     */
    data class Fitted(
        val sizePt: Double,
        val lines: List<FittedLine>,
        val rightToLeft: Boolean,
        val ascentPt: Double,
        val descentPt: Double,
        val lineHeightPt: Double,
        /** True when `wrap-grow` let the block exceed the box (flow kinds, non-identity text only). */
        val grown: Boolean,
    ) : FitOutcome {
        /** The first line's ascent, (n − 1) line heights and the last line's descent (spec §5.3). */
        val blockHeightPt: Double get() = ascentPt + (lines.size - 1) * lineHeightPt + descentPt
    }

    /** A character has no glyph in the font chain (R7): refused whatever the size. */
    data object MissingGlyph : FitOutcome

    /** No size fits. For identity text this is R6's refusal; the detail never contains the text. */
    data class DoesNotFit(
        val detail: String,
    ) : FitOutcome
}

/**
 * The fit rule (spec §5.2, §5.3; R6; HAZ-0045). For each size from `size_pt.max` down to the effective minimum in
 * 0.5 pt steps (the minimum itself is tried last when the steps miss it), quantised to whole printer dots
 * (`dots = round_half_up(size / 72 × 25.4 × dots/mm)`, back to points; a quantised size below the effective
 * minimum is skipped, so text never prints below it): break the text greedily into lines no wider than 95% of the
 * box, breaking only at U+0020 and ZWSP (never inside a word, no hyphen); the size fits when there are at most
 * `max_lines` lines and the block height (first ascent + (n − 1) line heights + last descent, all from the
 * shaper's `hhea` metrics) is at most the box height. The first size that fits wins.
 *
 * Measurement is by shaping each candidate line as a whole, never by summing words, so kerning and joining are
 * included. The paragraph direction is resolved once on the whole text and then forced on every line, so a line
 * that starts with a Latin word inside an Arabic name keeps the paragraph's direction. A tolerance of 1e-9 pt
 * absorbs binary rounding in the comparisons.
 */
class Fitter(
    private val shaper: TextShaper,
) {
    fun fit(request: FitRequest): FitOutcome {
        val sizes = candidateSizes(request)
        val probe = sizes.firstOrNull()?.let { shaper.shape(request.text, request.fonts, it, request.direction) }
        return when {
            probe == null -> FitOutcome.DoesNotFit("no printable size between the minimum and the maximum, or an empty box")
            probe.missingGlyph -> FitOutcome.MissingGlyph
            else -> fitSizes(request, sizes, probe.rightToLeft)
        }
    }

    private fun fitSizes(
        request: FitRequest,
        sizes: List<Double>,
        rightToLeft: Boolean,
    ): FitOutcome {
        val breaker = LineBreaker(shaper, request, Tokens.of(request.text), if (rightToLeft) Direction.RTL else Direction.LTR)
        val heightLimit = Dots.mmToPt(request.boxHeightMm) + TOLERANCE_PT
        val attempts = sizes.asSequence().map { size -> breaker.attempt(size, request.maxLines) }
        val decisive =
            attempts.firstOrNull { it is Attempt.Missing || (it is Attempt.Lines && it.blockHeightPt <= heightLimit) }
        return when (decisive) {
            is Attempt.Lines -> decisive.fitted(rightToLeft, grown = false)
            is Attempt.Missing -> FitOutcome.MissingGlyph
            else -> noSizeFits(request, breaker, sizes.last(), rightToLeft)
        }
    }

    private fun noSizeFits(
        request: FitRequest,
        breaker: LineBreaker,
        smallest: Double,
        rightToLeft: Boolean,
    ): FitOutcome {
        val atSmallest = breaker.attempt(smallest, if (request.growWhenNoFit) Int.MAX_VALUE else request.maxLines)
        return when {
            atSmallest is Attempt.Missing -> FitOutcome.MissingGlyph
            atSmallest is Attempt.Lines && request.growWhenNoFit -> atSmallest.fitted(rightToLeft, grown = true)
            atSmallest is Attempt.TooWide -> FitOutcome.DoesNotFit("a word is wider than 95% of the box at the minimum size")
            atSmallest is Attempt.TooManyLines -> FitOutcome.DoesNotFit("more lines than max_lines at the minimum size")
            else -> FitOutcome.DoesNotFit("the lines are taller than the box at the minimum size")
        }
    }

    companion object {
        /** The size step of the fit rule (spec §5.3). */
        const val STEP_PT: Double = 0.5

        /** The share of the box width lines may use; the rest absorbs shaping differences (spec §5.3). */
        const val WIDTH_SHARE: Double = 0.95

        internal const val TOLERANCE_PT: Double = 1e-9

        /**
         * The sizes the fit rule tries, largest first: `max`, `max − 0.5`, … down to `min` (and `min` itself when
         * the steps miss it), each quantised to whole dots, below-minimum and duplicate sizes removed.
         */
        fun candidateSizes(
            maxPt: Double,
            minPt: Double,
            dotsPerMm: Double,
        ): List<Double> {
            val valid =
                maxPt.isFinite() && minPt.isFinite() && dotsPerMm.isFinite() && minPt > 0.0 && maxPt >= minPt && dotsPerMm > 0.0
            if (!valid) return emptyList()
            val steps = ((maxPt - minPt) / STEP_PT + TOLERANCE_PT).toInt()
            val lastStep = maxPt - steps * STEP_PT
            val nominal = (0..steps).map { maxPt - it * STEP_PT } + if (lastStep > minPt + TOLERANCE_PT) listOf(minPt) else emptyList()
            return nominal
                .map { Dots.quantisePt(it, dotsPerMm) }
                .filter { it > 0.0 && it >= minPt - TOLERANCE_PT }
                .distinct()
        }

        private fun candidateSizes(request: FitRequest): List<Double> {
            val boxUsable = request.boxWidthMm > 0.0 && request.boxHeightMm > 0.0
            val linesUsable = request.maxLines >= 1 && request.fonts.isNotEmpty()
            return if (boxUsable && linesUsable) candidateSizes(request.maxPt, request.minPt, request.dotsPerMm) else emptyList()
        }
    }
}

/** One size's attempt at breaking the text. */
private sealed interface Attempt {
    data class Lines(
        val sizePt: Double,
        val lines: List<Pair<String, Shaped>>,
    ) : Attempt {
        private val ascentPt: Double get() = lines.first().second.ascentPt
        private val descentPt: Double get() = lines.last().second.descentPt
        private val lineHeightPt: Double get() = lines.maxOf { it.second.lineHeightPt }
        val blockHeightPt: Double get() = ascentPt + (lines.size - 1) * lineHeightPt + descentPt

        fun fitted(
            rightToLeft: Boolean,
            grown: Boolean,
        ): FitOutcome.Fitted =
            FitOutcome.Fitted(
                sizePt = sizePt,
                lines = lines.map { (text, shaped) -> FittedLine(text, shaped.advancePt) },
                rightToLeft = rightToLeft,
                ascentPt = ascentPt,
                descentPt = descentPt,
                lineHeightPt = lineHeightPt,
                grown = grown,
            )
    }

    data object TooWide : Attempt

    data object TooManyLines : Attempt

    data object Missing : Attempt
}

/**
 * The text cut at its break opportunities: [words] are maximal runs without U+0020 or ZWSP, [gaps] the runs
 * between them; a leading or trailing run stays with the first or last line (a break needs a word on each side).
 */
private class Tokens(
    val text: String,
    val leading: String,
    val words: List<String>,
    val gaps: List<String>,
    val trailing: String,
) {
    /** The line from word [from] to word [to], inner gaps kept, the gaps at the breaks left out. */
    fun line(
        from: Int,
        to: Int,
    ): String =
        if (words.isEmpty()) {
            text
        } else {
            buildString {
                if (from == 0) append(leading)
                for (k in from..to) {
                    append(words[k])
                    if (k < to) append(gaps[k])
                }
                if (to == words.lastIndex) append(trailing)
            }
        }

    /** The number of break units: words, or one when the text has no word at all. */
    val units: Int get() = if (words.isEmpty()) 1 else words.size

    companion object {
        private val breakCharacters: Set<Char> = setOf(' ', TextChecks.ZWSP.toChar())

        fun of(text: String): Tokens {
            val runs = mutableListOf<StringBuilder>()
            var inGap: Boolean? = null
            for (c in text) {
                val gap = c in breakCharacters
                if (gap != inGap) runs += StringBuilder()
                runs.last().append(c)
                inGap = gap
            }
            val startsWithGap = text.isNotEmpty() && text.first() in breakCharacters
            val words = runs.filterIndexed { i, _ -> (i % 2 == 0) != startsWithGap }.map { it.toString() }
            val gapRuns = runs.filterIndexed { i, _ -> (i % 2 == 0) == startsWithGap }.map { it.toString() }
            val leading = if (startsWithGap) gapRuns.first() else ""
            val inner = if (startsWithGap) gapRuns.drop(1) else gapRuns
            val trailing = if (inner.size >= words.size && words.isNotEmpty()) inner.last() else ""
            return Tokens(text, leading, words, inner.take((words.size - 1).coerceAtLeast(0)), trailing)
        }
    }
}

/** Greedy line breaking at one size: each line takes as many words as fit in 95% of the box. */
private class LineBreaker(
    private val shaper: TextShaper,
    private val request: FitRequest,
    private val tokens: Tokens,
    private val lineDirection: Direction,
) {
    private val widthLimit = Fitter.WIDTH_SHARE * Dots.mmToPt(request.boxWidthMm) + Fitter.TOLERANCE_PT

    fun attempt(
        sizePt: Double,
        maxLines: Int,
    ): Attempt {
        val lines = mutableListOf<Pair<String, Shaped>>()
        var from = 0
        var failure: Attempt? = null
        while (failure == null && from < tokens.units) {
            when (val step = nextLine(from, sizePt)) {
                is Step.Line -> {
                    lines += step.text to step.shaped
                    from = step.next
                    if (lines.size > maxLines) failure = Attempt.TooManyLines
                }

                Step.Missing -> {
                    failure = Attempt.Missing
                }

                Step.TooWide -> {
                    failure = Attempt.TooWide
                }
            }
        }
        return failure ?: Attempt.Lines(sizePt, lines)
    }

    private fun nextLine(
        from: Int,
        sizePt: Double,
    ): Step {
        val first = measure(tokens.line(from, from), sizePt)
        return when {
            first.missingGlyph -> Step.Missing
            first.advancePt > widthLimit -> Step.TooWide
            else -> extend(from, from, first, sizePt)
        }
    }

    private tailrec fun extend(
        from: Int,
        to: Int,
        best: Shaped,
        sizePt: Double,
    ): Step {
        if (to + 1 >= tokens.units) return Step.Line(tokens.line(from, to), best, to + 1)
        val next = measure(tokens.line(from, to + 1), sizePt)
        return when {
            next.missingGlyph -> Step.Missing
            next.advancePt > widthLimit -> Step.Line(tokens.line(from, to), best, to + 1)
            else -> extend(from, to + 1, next, sizePt)
        }
    }

    private fun measure(
        text: String,
        sizePt: Double,
    ): Shaped = shaper.shape(text, request.fonts, sizePt, lineDirection)

    private sealed interface Step {
        data class Line(
            val text: String,
            val shaped: Shaped,
            val next: Int,
        ) : Step

        data object Missing : Step

        data object TooWide : Step
    }
}
