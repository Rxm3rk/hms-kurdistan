package hms.platform.docs.infrastructure.escpos

import hms.platform.docs.api.Refusal
import hms.platform.docs.api.RefusalReason
import hms.platform.docs.domain.layout.Layout
import hms.platform.docs.domain.layout.PlacedBarcode
import hms.platform.docs.domain.raster.MonoBitmap
import hms.platform.docs.infrastructure.barcode.BarcodeEncoder
import hms.platform.docs.infrastructure.barcode.BarcodeEncoding
import hms.platform.docs.infrastructure.barcode.BarcodeRaster
import hms.platform.docs.infrastructure.barcode.SymbolPlacement
import hms.platform.docs.infrastructure.raster.PlacedRaster
import java.io.ByteArrayOutputStream
import java.math.BigDecimal
import java.math.RoundingMode

/**
 * ESC/POS raster output for receipt and token printers (docs/specs/modules/platform-docs.md §7.3). Every
 * glyph is rasterised by the module (ESC/POS code pages cannot shape Sorani), and any barcode is drawn by
 * the module from ZXing's matrix (spec §6.2), never by the printer.
 *
 * Bytes:
 * ```text
 * 1B 40                                      ESC @: initialise
 * 1D 76 30 00 xL xH yL yH d1 … dk            GS v 0, normal density, one per band of at most 256 rows
 * 1D 56 42 00                                GS V 66 0: feed to the cutter and cut partially
 * ```
 *
 * - The image is the full printable width, the profile's `escposWidthDots` (576 dots for 80 mm paper at 8
 *   dots/mm, 512 at 180 dpi, 384 for 58 mm); x = ceil(width / 8) bytes per row. The page is as long as the
 *   layout's frame (a receipt's laid-out length) or the raster's bottom edge, whichever is longer. The
 *   raster is placed at its own position (x dots from the left, y blank rows above
 *   it) and white elsewhere, so a narrower raster is padded on the right. A raster or barcode that does not
 *   fit the width is refused, never cropped or scaled.
 * - Barcodes: the layout's barcodes at their reading-frame position (receipts and tokens have a 0° frame,
 *   so it is also the printer frame), each module a whole number of dots (half up); a Code 128 bar is
 *   [PlacedBarcode.maxSizeMm] high. A barcode that does not lie wholly on the page is refused, and so is a
 *   90° frame: no ESC/POS template turns its frame.
 * - Rows are packed most significant bit first, a set bit black ([MonoBitmap]'s layout); trailing bits of
 *   the last byte of a row are white.
 * - No `ESC d` (feed n lines): the cut command feeds to the cutter itself.
 */
class EscPosWriter {
    /**
     * Writes [raster] (from the `LayoutRasteriser` for [layout] at [dotsPerMm]) plus [layout]'s barcodes,
     * for a printer of [escPosWidthDots] printable dots.
     */
    fun write(
        layout: Layout,
        raster: PlacedRaster,
        dotsPerMm: Double,
        escPosWidthDots: Int,
    ): EscPosOutput {
        val problem = checkInput(layout, raster, dotsPerMm, escPosWidthDots)
        if (problem != null) return EscPosOutput.Refused(problem)
        val page = page(layout, raster, dotsPerMm, escPosWidthDots)
        val barcodeProblem = layout.barcodes.firstNotNullOfOrNull { drawBarcode(page, it, dotsPerMm) }
        return if (barcodeProblem != null) EscPosOutput.Refused(barcodeProblem) else EscPosOutput.Written(encode(page))
    }

    private fun checkInput(
        layout: Layout,
        raster: PlacedRaster,
        dotsPerMm: Double,
        escPosWidthDots: Int,
    ): Refusal? {
        val fits =
            escPosWidthDots > 0 &&
                raster.xDots >= 0 &&
                raster.yDots >= 0 &&
                raster.xDots + raster.bitmap.width <= escPosWidthDots
        return when {
            layout.rotation != 0 -> {
                Refusal(RefusalReason.TEMPLATE_INVALID, "media.rotation", "ESC/POS takes a 0° frame only")
            }

            !dotsPerMm.isFinite() || dotsPerMm <= 0.0 -> {
                Refusal(RefusalReason.PRINTER_UNSUPPORTED, "printer.dotsPerMm", "no dots per millimetre")
            }

            !fits -> {
                Refusal(RefusalReason.PRINTER_UNSUPPORTED, "raster", "raster wider than the printer's $escPosWidthDots dots")
            }

            else -> {
                null
            }
        }
    }

    /**
     * The white page at the printer's full width, as long as the layout's frame or the raster's bottom edge,
     * whichever is longer, with the raster copied in at its position.
     */
    private fun page(
        layout: Layout,
        raster: PlacedRaster,
        dotsPerMm: Double,
        escPosWidthDots: Int,
    ): MonoBitmap {
        val bitmap = raster.bitmap
        val page = MonoBitmap(escPosWidthDots, maxOf(raster.yDots + bitmap.height, dots(layout.frameHeightMm, dotsPerMm)))
        for (y in 0 until bitmap.height) {
            for (x in 0 until bitmap.width) {
                if (bitmap.get(x, y)) page.set(raster.xDots + x, raster.yDots + y, true)
            }
        }
        return page
    }

    /** Draws one barcode into [page]; returns a refusal when it cannot be drawn whole. */
    private fun drawBarcode(
        page: MonoBitmap,
        barcode: PlacedBarcode,
        dotsPerMm: Double,
    ): Refusal? =
        when (val encoded = BarcodeEncoder.encode(barcode.payload, barcode.symbology)) {
            is BarcodeEncoding.Refused -> {
                encoded.refusal
            }

            is BarcodeEncoding.Encoded -> {
                val placement =
                    SymbolPlacement(
                        left = dots(barcode.xMm, dotsPerMm),
                        top = dots(barcode.yMm, dotsPerMm),
                        moduleDots = dots(barcode.moduleMm, dotsPerMm),
                        barHeightDots = dots(barcode.maxSizeMm, dotsPerMm),
                    )
                if (BarcodeRaster.draw(page, encoded.matrix, placement)) {
                    null
                } else {
                    Refusal(RefusalReason.TEMPLATE_INVALID, "barcode", "barcode does not lie wholly on the page")
                }
            }
        }

    private fun encode(page: MonoBitmap): ByteArray {
        val out = ByteArrayOutputStream()
        out.write(INITIALISE)
        val rowBytes = page.bytesPerRow
        val packed = page.packedRows()
        for (bandStart in 0 until page.height step MAX_BAND_ROWS) {
            val rows = minOf(MAX_BAND_ROWS, page.height - bandStart)
            out.write(RASTER_IMAGE)
            out.write(rowBytes and BYTE_MASK)
            out.write(rowBytes ushr BYTE_BITS)
            out.write(rows and BYTE_MASK)
            out.write(rows ushr BYTE_BITS)
            out.write(packed, bandStart * rowBytes, rows * rowBytes)
        }
        out.write(PARTIAL_CUT)
        return out.toByteArray()
    }

    private fun dots(
        mm: Double,
        dotsPerMm: Double,
    ): Int =
        BigDecimal
            .valueOf(mm)
            .multiply(BigDecimal.valueOf(dotsPerMm))
            .setScale(0, RoundingMode.HALF_UP)
            .intValueExact()

    companion object {
        /** The most rows in one `GS v 0` image (spec §7.3). */
        const val MAX_BAND_ROWS: Int = 256

        private const val BYTE_MASK = 0xFF
        private const val BYTE_BITS = 8

        /** `ESC @`. */
        private val INITIALISE = byteArrayOf(0x1B, 0x40)

        /** `GS v 0` with m = 0 (normal); xL xH yL yH and the data follow. */
        private val RASTER_IMAGE = byteArrayOf(0x1D, 0x76, 0x30, 0x00)

        /** `GS V 66 0`: feed to the cutting position and cut partially. */
        private val PARTIAL_CUT = byteArrayOf(0x1D, 0x56, 0x42, 0x00)
    }
}

/** The output of [EscPosWriter]: bytes for `hal.print.raw` (`language: esc-pos`), or a refusal. */
sealed interface EscPosOutput {
    class Written(
        val bytes: ByteArray,
    ) : EscPosOutput {
        override fun equals(other: Any?): Boolean = other is Written && other.bytes.contentEquals(bytes)

        override fun hashCode(): Int = bytes.contentHashCode()

        override fun toString(): String = "Written(${bytes.size} bytes)"
    }

    data class Refused(
        val refusal: Refusal,
    ) : EscPosOutput
}
