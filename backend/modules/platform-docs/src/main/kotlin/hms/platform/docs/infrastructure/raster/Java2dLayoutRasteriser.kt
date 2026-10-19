package hms.platform.docs.infrastructure.raster

import hms.platform.docs.domain.layout.Direction
import hms.platform.docs.domain.layout.Layout
import hms.platform.docs.domain.layout.PlacedLine
import hms.platform.docs.domain.layout.PlacedRule
import hms.platform.docs.domain.template.Align
import hms.platform.docs.infrastructure.text.Java2dTextShaper
import java.awt.geom.AffineTransform

/**
 * The 1-bit rasteriser for ZPL raster mode and ESC/POS (docs/specs/modules/platform-docs.md §7.2, §7.3;
 * BUILD-PROMPT §4.1 "Label and token printing").
 *
 * - **Region.** The whole reading frame (`frameWidthMm` × `frameHeightMm`), not only the printable area or
 *   the ink's bounding box: the image size then depends only on the template and the resolution, never on
 *   the text, which keeps goldens and band splitting deterministic. The raster's top-left is the media's
 *   home, so [PlacedRaster.xDots] and [PlacedRaster.yDots] are 0. Ink outside the frame is clipped; the
 *   layout keeps every element inside the printable area (the template linter, spec §4.3 rule 6).
 * - **Text.** Each [PlacedLine] is shaped again with the same [Java2dTextShaper] (same pinned files,
 *   context, `kern`/`liga`, bidi and font chain) that measured it, so the drawn glyphs are the measured
 *   ones. Each segment's glyph outlines come from its own font. The line is aligned in its box by the
 *   shaped advance: `start` is the right edge for a right-to-left line and the left edge otherwise, `end`
 *   the opposite, `center` the middle. The line's origin (left edge, baseline) is converted to dots once
 *   per coordinate, rounding half up ([Dots]); glyphs are placed at their exact fractional offsets from
 *   that origin, so no rounding accumulates along the line. 1 pt = 25.4 / 72 mm.
 * - **Fill.** Outlines are filled without anti-aliasing by [ScanlineFill]: a pixel is black when its
 *   centre is inside an outline.
 * - **Rules** are filled as rectangles whose four edges are each rounded from their own millimetre value,
 *   at least one dot thick (as the ZPL writer's frame does). **Barcodes are not drawn**: ZPL draws them
 *   natively (spec §6.2) and the ESC/POS writer draws ZXing's matrix itself.
 * - **Rotation 90** turns the frame a quarter turn clockwise onto the media ([FrameBuffer.toBitmap]):
 *   printer x across the head, printer y along the feed; the frame's x axis runs along the feed.
 *
 * A rotation other than 0 or 90, a non-positive resolution, or a line that shapes with a missing glyph is a
 * programming error (the template loader, the writers and rule R7 refuse them first) and throws: the
 * rasteriser never draws a box glyph in place of a character (spec §3.2 R7, HAZ-0045).
 */
class Java2dLayoutRasteriser(
    private val shaper: Java2dTextShaper,
) : LayoutRasteriser {
    override fun rasterise(
        layout: Layout,
        dotsPerMm: Double,
    ): PlacedRaster {
        require(dotsPerMm.isFinite() && dotsPerMm > 0.0) { "dots per millimetre must be positive, got $dotsPerMm" }
        require(layout.rotation == 0 || layout.rotation == FrameBuffer.QUARTER_TURN) { "unsupported rotation ${layout.rotation}" }
        val frame = FrameBuffer(Dots.of(layout.frameWidthMm, dotsPerMm), Dots.of(layout.frameHeightMm, dotsPerMm))
        layout.rules.forEach { fillRule(frame, it, dotsPerMm) }
        layout.lines.forEach { drawLine(frame, it, dotsPerMm) }
        return PlacedRaster(frame.toBitmap(layout.rotation), xDots = 0, yDots = 0)
    }

    private fun fillRule(
        frame: FrameBuffer,
        rule: PlacedRule,
        dotsPerMm: Double,
    ) {
        val x0 = Dots.of(rule.xMm, dotsPerMm)
        val y0 = Dots.of(rule.yMm, dotsPerMm)
        val x1 = maxOf(x0 + 1, Dots.of(rule.xMm + rule.wMm, dotsPerMm))
        val y1 = maxOf(y0 + 1, Dots.of(rule.yMm + rule.hMm, dotsPerMm))
        frame.fillRect(x0, y0, x1, y1)
    }

    private fun drawLine(
        frame: FrameBuffer,
        line: PlacedLine,
        dotsPerMm: Double,
    ) {
        val direction = if (line.rightToLeft) Direction.RTL else Direction.LTR
        val shaped = shaper.layout(line.text, line.fonts, line.sizePt, direction)
        // R7 refuses such text before layout (spec §3.2); a box glyph must never reach a print.
        check(!shaped.missingGlyph) { "a placed line has a missing glyph; R7 must refuse it before layout" }
        val leftMm = leftEdgeMm(line, shaped.advancePt * MM_PER_PT)
        val originX = Dots.of(leftMm, dotsPerMm).toDouble()
        val originY = Dots.of(line.baselineMm, dotsPerMm).toDouble()
        val dotsPerPt = dotsPerMm * MM_PER_PT
        for (segment in shaped.segments) {
            val transform = AffineTransform(dotsPerPt, 0.0, 0.0, dotsPerPt, originX + segment.xPt * dotsPerPt, originY)
            ScanlineFill.fill(segment.glyphs.outline, transform, frame)
        }
    }

    companion object {
        /**
         * The rasteriser's version, part of the JVM renderer identity that keys the golden images (spec §10).
         * Change it whenever a change here can move a single dot.
         */
        const val RASTERISER_VERSION: String = "hms-docs-raster-1"

        private const val HALF = 0.5

        /** Millimetres per point (1 pt = 1/72 inch). */
        const val MM_PER_PT: Double = 25.4 / 72.0

        /** The left edge of [line] in its box for a shaped width of [widthMm] (alignment follows the line's direction). */
        internal fun leftEdgeMm(
            line: PlacedLine,
            widthMm: Double,
        ): Double {
            val atLeft = line.boxXMm
            val atRight = line.boxXMm + line.boxWidthMm - widthMm
            return when (line.align) {
                Align.START -> if (line.rightToLeft) atRight else atLeft
                Align.END -> if (line.rightToLeft) atLeft else atRight
                Align.CENTER -> line.boxXMm + (line.boxWidthMm - widthMm) * HALF
            }
        }
    }
}
