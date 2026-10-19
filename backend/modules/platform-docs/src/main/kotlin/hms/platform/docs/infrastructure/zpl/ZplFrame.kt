package hms.platform.docs.infrastructure.zpl

import hms.platform.docs.api.Refusal
import hms.platform.docs.api.RefusalReason
import hms.platform.docs.domain.layout.Layout
import java.math.BigDecimal
import java.math.MathContext
import java.math.RoundingMode

/**
 * The printer frame of a ZPL label and the transform from the layout's reading frame to it
 * (docs/specs/modules/platform-docs.md §4.1, §5.4, §7.1, §7.2).
 *
 * **Frames.** The reading frame is the label as read: millimetres, origin top-left, u to the right, v down
 * (`Layout`). The printer frame is the media in dots: x across the print head (0 to `^PW`), y along the
 * feed (0 to `^LL`), origin at the label home (`^LH0,0`).
 *
 * **Rotation 0** (`<o>` = `N`): x = dots(u), y = dots(v); `^PW` = dots(frame width), `^LL` = dots(frame height).
 *
 * **Rotation 90** (`<o>` = `R`, ZPL's "rotated 90 degrees clockwise"): the reading frame is turned a
 * quarter turn clockwise onto the media, so its top edge lies along the media's right edge and text read
 * along the media length runs down the feed. `^PW` = dots(frame height) (the media width), `^LL` =
 * dots(frame width) (the media length), and a reading-frame point (u, v) lands at
 * x = `^PW` − dots(v), y = dots(u). A reading-frame rectangle [u0, u1] × [v0, v1] becomes
 * [`^PW` − dots(v1), `^PW` − dots(v0)] × [dots(u0), dots(u1)]. The raster for a 90° frame (§7.2) must be
 * turned the same way, so the rasteriser and this transform agree on the media.
 *
 * **Rounding.** Millimetres convert to dots with the profile's dots per millimetre, rounding half up once
 * per coordinate from the decimal value of the millimetres (never accumulated, spec §5.4). A rectangle's
 * edges are rounded separately and its size is the difference, at least one dot.
 */
internal class ZplFrame private constructor(
    val dotsPerMm: Double,
    val rotation: Int,
    /** `^PW`: the media width across the print head, in dots. */
    val widthDots: Int,
    /** `^LL`: the media length along the feed, in dots. */
    val lengthDots: Int,
) {
    /** The ZPL field orientation for this frame: `N` (0°) or `R` (90° clockwise). */
    val orientation: Char get() = if (rotation == ROTATED) 'R' else 'N'

    /** Millimetres to dots, half up. */
    fun dots(mm: Double): Int = toDots(mm, dotsPerMm)

    /** A text size in points to whole dots (1 pt = 25.4 / 72 mm), half up. */
    fun sizeDots(pt: Double): Int =
        BigDecimal
            .valueOf(pt)
            .multiply(BigDecimal.valueOf(dotsPerMm))
            .multiply(MM_PER_INCH)
            .divide(POINTS_PER_INCH, MathContext.DECIMAL64)
            .setScale(0, RoundingMode.HALF_UP)
            .intValueExact()

    /** A reading-frame point in millimetres to printer dots. */
    fun point(
        uMm: Double,
        vMm: Double,
    ): DotPoint = if (rotation == ROTATED) DotPoint(widthDots - dots(vMm), dots(uMm)) else DotPoint(dots(uMm), dots(vMm))

    /** A reading-frame rectangle in millimetres to a printer rectangle (edges rounded separately). */
    fun rect(
        uMm: Double,
        vMm: Double,
        wMm: Double,
        hMm: Double,
    ): DotRect {
        val u0 = dots(uMm)
        val v0 = dots(vMm)
        val across = maxOf(1, dots(uMm + wMm) - u0)
        val down = maxOf(1, dots(vMm + hMm) - v0)
        return rectDots(u0, v0, across, down)
    }

    /**
     * A reading-frame rectangle already in dots (top-left [u0], [v0]; [across] along u, [down] along v) to a
     * printer rectangle. Barcodes use it: their size is a whole number of modules of whole dots.
     */
    fun rectDots(
        u0: Int,
        v0: Int,
        across: Int,
        down: Int,
    ): DotRect = if (rotation == ROTATED) DotRect(widthDots - (v0 + down), u0, down, across) else DotRect(u0, v0, across, down)

    /** The `^PW`, `^LL` and `^LH0,0` commands. */
    fun mediaCommands(): List<String> = listOf("^PW$widthDots", "^LL$lengthDots", "^LH0,0")

    companion object {
        const val ROTATED: Int = 90

        /** The highest resolution a ZPL profile states (spec §5.4: 8, 12 and 24 dots per millimetre). */
        const val MAX_DOTS_PER_MM: Double = 24.0

        private val MM_PER_INCH = BigDecimal("25.4")
        private val POINTS_PER_INCH = BigDecimal(72)

        /**
         * The frame of [layout] at [dotsPerMm] (the profile's value, used as given), or a refusal for a
         * rotation this writer does not support or a resolution that is not a finite value in (0, 24].
         */
        fun of(
            layout: Layout,
            dotsPerMm: Double,
        ): FrameOrRefusal {
            if (!dotsPerMm.isFinite() || dotsPerMm <= 0.0 || dotsPerMm > MAX_DOTS_PER_MM) {
                return FrameOrRefusal.Refused(
                    Refusal(RefusalReason.PRINTER_UNSUPPORTED, subject = "printer.dotsPerMm", detail = "unsupported $dotsPerMm dots/mm"),
                )
            }
            val frame =
                when (layout.rotation) {
                    0 -> {
                        ZplFrame(dotsPerMm, 0, toDots(layout.frameWidthMm, dotsPerMm), toDots(layout.frameHeightMm, dotsPerMm))
                    }

                    ROTATED -> {
                        ZplFrame(dotsPerMm, ROTATED, toDots(layout.frameHeightMm, dotsPerMm), toDots(layout.frameWidthMm, dotsPerMm))
                    }

                    else -> {
                        null
                    }
                }
            return frame?.let { FrameOrRefusal.Frame(it) }
                ?: FrameOrRefusal.Refused(
                    Refusal(RefusalReason.TEMPLATE_INVALID, subject = "media.rotation", detail = "unsupported rotation ${layout.rotation}"),
                )
        }

        /** Millimetres to dots at [dotsPerMm], half up, from the decimal value of [mm]. */
        fun toDots(
            mm: Double,
            dotsPerMm: Double,
        ): Int =
            BigDecimal
                .valueOf(mm)
                .multiply(BigDecimal.valueOf(dotsPerMm))
                .setScale(0, RoundingMode.HALF_UP)
                .intValueExact()
    }
}

/** A point in printer dots. */
internal data class DotPoint(
    val x: Int,
    val y: Int,
)

/** A rectangle in printer dots: top-left ([x], [y]), [w] across the head, [h] along the feed. */
internal data class DotRect(
    val x: Int,
    val y: Int,
    val w: Int,
    val h: Int,
)

/** [ZplFrame.of]'s result. */
internal sealed interface FrameOrRefusal {
    data class Frame(
        val frame: ZplFrame,
    ) : FrameOrRefusal

    data class Refused(
        val refusal: Refusal,
    ) : FrameOrRefusal
}

/** The output of a ZPL writer: the bytes for `hal.print.label` (`format: zpl`), or a refusal. */
sealed interface ZplOutput {
    /** UTF-8 ZPL in the canonical byte form of [ZplCommands]. */
    class Written(
        val bytes: ByteArray,
    ) : ZplOutput {
        override fun equals(other: Any?): Boolean = other is Written && other.bytes.contentEquals(bytes)

        override fun hashCode(): Int = bytes.contentHashCode()

        override fun toString(): String = "Written(${bytes.size} bytes)"
    }

    data class Refused(
        val refusal: Refusal,
    ) : ZplOutput
}

/**
 * The canonical byte form of every ZPL output of this module, which the byte fixtures
 * (`ByteFixture:zpl-text-*`, `ByteFixture:zpl-reprint-*`) depend on: UTF-8 without a byte-order mark;
 * one command, or one field from `^FO`/`^FT` to its `^FS`, per line; each line ended by a single LF
 * (0x0A), the last one included; no CR, no indentation, no trailing spaces. ZPL ignores CR and LF
 * between commands; field data never holds either (escaping refuses control characters), so the line
 * breaks are never content. This is also the form of the S7-K kit's patterns (`tools/s7k/patterns/`).
 */
internal object ZplCommands {
    fun join(commands: List<String>): ByteArray = commands.joinToString(separator = "\n", postfix = "\n").toByteArray(Charsets.UTF_8)
}
