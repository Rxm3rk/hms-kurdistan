package hms.platform.docs.infrastructure.zpl

import hms.platform.docs.api.Refusal
import hms.platform.docs.api.RefusalReason
import hms.platform.docs.domain.layout.Layout
import hms.platform.docs.infrastructure.raster.PlacedRaster

/**
 * ZPL raster mode (docs/specs/modules/platform-docs.md §7.2), for any ZPL printer: the module's own 1-bit
 * raster of the text, captions, rules and notice (from the `LayoutRasteriser`, already turned onto the
 * media for a 90° frame) as `^GF` graphic fields; the barcodes stay native fields, as in text mode.
 *
 * Output, in the canonical byte form of [ZplCommands]:
 * ```text
 * ~JA                     reprints only (spec §8.6; before ^XA, see ZplTextWriter)
 * ^XA
 * ^CI28
 * ^PW<width dots>
 * ^LL<length dots>
 * ^LH0,0
 * ^FO<x>,<y>^GFA,<bytes>,<bytes>,<row bytes>,<HEX>^FS      one per band of whole rows
 * <native barcode fields (ZplFields.barcode)>
 * ^PQ1
 * ^XZ
 * ```
 *
 * - **Cropping and bands.** All-white rows at the top and bottom of the raster are dropped first (the
 *   columns are kept, so every band has the raster's row bytes). The rest is cut into bands of whole rows,
 *   each at most [MAX_FIELD_BYTES] bytes (the documented `^GF` limit); a row is never split. Each band is
 *   placed at the raster's x and at its own first row. A raster with no black dot writes no `^GF` field.
 * - **Data.** Uncompressed ASCII hexadecimal (`A`), upper case, rows packed most significant bit first,
 *   a set bit black: exactly [hms.platform.docs.domain.raster.MonoBitmap]'s layout.
 * - **No `^PA`**: the printer shapes nothing here. **`^CI28` is sent** although no text field is written:
 *   `^CI` persists in the printer between formats, and a code page left by an earlier job could remap
 *   payload characters of the native barcodes; `^CI28` makes the payload bytes mean what they say.
 * - **Rules** are part of the raster (the rasteriser draws them), so no `^GB` is written here.
 * - A raster that does not lie wholly on the media (`^PW` × `^LL`) is refused: nothing prints off the label.
 */
class ZplRasterWriter {
    /**
     * Writes [raster] (from the `LayoutRasteriser` for [layout] at [dotsPerMm]) and [layout]'s barcodes.
     * [reprint] adds `~JA`.
     */
    fun write(
        layout: Layout,
        raster: PlacedRaster,
        dotsPerMm: Double,
        reprint: Boolean,
    ): ZplOutput =
        when (val f = ZplFrame.of(layout, dotsPerMm)) {
            is FrameOrRefusal.Refused -> ZplOutput.Refused(f.refusal)
            is FrameOrRefusal.Frame -> write(layout, raster, f.frame, reprint)
        }

    private fun write(
        layout: Layout,
        raster: PlacedRaster,
        frame: ZplFrame,
        reprint: Boolean,
    ): ZplOutput {
        val graphics = graphicFields(raster, frame)
        val barcodes = layout.barcodes.map { ZplFields.barcode(it, frame) }
        val refusal = (graphics as? GraphicsOrRefusal.Refused)?.refusal ?: ZplFields.firstRefusal(barcodes)
        return if (refusal != null) {
            ZplOutput.Refused(refusal)
        } else {
            val commands =
                buildList {
                    if (reprint) add(ZplTextWriter.CANCEL_ALL)
                    add("^XA")
                    add(ZplTextWriter.UTF8)
                    addAll(frame.mediaCommands())
                    addAll((graphics as GraphicsOrRefusal.Fields).commands)
                    addAll(ZplFields.commands(barcodes))
                    add(ZplTextWriter.ONE_COPY)
                    add("^XZ")
                }
            ZplOutput.Written(ZplCommands.join(commands))
        }
    }

    private fun graphicFields(
        raster: PlacedRaster,
        frame: ZplFrame,
    ): GraphicsOrRefusal {
        val bitmap = raster.bitmap
        val onMedia =
            raster.xDots >= 0 &&
                raster.yDots >= 0 &&
                raster.xDots + bitmap.width <= frame.widthDots &&
                raster.yDots + bitmap.height <= frame.lengthDots
        val rowBytes = bitmap.bytesPerRow
        return when {
            !onMedia -> {
                GraphicsOrRefusal.Refused(
                    Refusal(RefusalReason.TEMPLATE_INVALID, subject = "raster", detail = "raster extends beyond the media"),
                )
            }

            rowBytes > MAX_FIELD_BYTES -> {
                GraphicsOrRefusal.Refused(
                    Refusal(RefusalReason.PRINTER_UNSUPPORTED, subject = "raster", detail = "one row exceeds the ^GF field limit"),
                )
            }

            else -> {
                GraphicsOrRefusal.Fields(bands(raster))
            }
        }
    }

    private fun bands(raster: PlacedRaster): List<String> {
        val packed = raster.bitmap.packedRows()
        val rowBytes = raster.bitmap.bytesPerRow
        val blank = { row: Int -> (0 until rowBytes).all { packed[row * rowBytes + it].toInt() == 0 } }
        val rows = 0 until raster.bitmap.height
        val first = rows.firstOrNull { !blank(it) } ?: return emptyList()
        val last = rows.last { !blank(it) }
        val rowsPerBand = MAX_FIELD_BYTES / rowBytes
        return (first..last step rowsPerBand).map { bandStart ->
            val bandRows = minOf(rowsPerBand, last + 1 - bandStart)
            val bytes = bandRows * rowBytes
            val hex = StringBuilder(bytes * 2)
            for (i in bandStart * rowBytes until (bandStart + bandRows) * rowBytes) {
                val b = packed[i].toInt() and BYTE_MASK
                hex.append(HEX_DIGITS[b ushr NIBBLE]).append(HEX_DIGITS[b and LOW_NIBBLE])
            }
            "^FO${raster.xDots},${raster.yDots + bandStart}^GFA,$bytes,$bytes,$rowBytes,$hex^FS"
        }
    }

    private sealed interface GraphicsOrRefusal {
        data class Fields(
            val commands: List<String>,
        ) : GraphicsOrRefusal

        data class Refused(
            val refusal: Refusal,
        ) : GraphicsOrRefusal
    }

    companion object {
        /** The largest `^GF` field, in bytes of image data (the ZPL manual's limit for the byte counts). */
        const val MAX_FIELD_BYTES: Int = 99_999

        private const val HEX_DIGITS = "0123456789ABCDEF"
        private const val BYTE_MASK = 0xFF
        private const val NIBBLE = 4
        private const val LOW_NIBBLE = 0x0F
    }
}
