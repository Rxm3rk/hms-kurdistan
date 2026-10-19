package hms.platform.docs.infrastructure.zpl

import hms.platform.docs.api.Refusal
import hms.platform.docs.api.RefusalReason
import hms.platform.docs.domain.layout.Layout
import hms.platform.docs.domain.layout.PlacedLine
import hms.platform.docs.domain.template.Align
import hms.platform.docs.infrastructure.fonts.PrintFont

/**
 * ZPL text mode (docs/specs/modules/platform-docs.md §7.1): the printer shapes and reorders the text with
 * `^PA` and the resident print fonts. The print service sends identity text this way only to a printer
 * whose profile says S7-K passed text mode for its model and firmware and whose resident font hashes equal
 * the pinned fonts (DN-074, a tightening); every other printer gets [ZplRasterWriter]. Text mode is always
 * generated for the fixtures and the S7-K kit.
 *
 * Output, in the canonical byte form of [ZplCommands]:
 * ```text
 * ~JA                     reprints only: cancel formats still queued in the printer (spec §8.6)
 * ^XA
 * ^CI28                   UTF-8 field data
 * ^PW<width dots>
 * ^LL<length dots>
 * ^LH0,0
 * ^PA1,1,1,1              default glyph, bidirectional layout, character shaping, OpenType
 * ^FT<x>,<y>^A@<o>,<h>,<w>,<font>^FB<width>,1,0,<L|R|C>,0^FH\^FD<text>^FS     one per placed line
 * <native barcode fields (ZplFields.barcode)>
 * <rules: ^FO<x>,<y>^GB<w>,<h>,<t>^FS>
 * ^PQ1                    one copy; copies go through the HAL (spec §8.6)
 * ^XZ
 * ```
 *
 * - `~JA` precedes `^XA`, outside the format (spec §7.1): a tilde command acts the moment the printer
 *   receives it, so inside the format it could cancel the reprint itself. S7-K verifies the effect
 *   (the kit's `~JA` reprint pattern).
 * - A line whose font chain has more than one font cannot be written: a resident font is named per field.
 *   The writer refuses (`print.refused.printerUnsupported`) and the print service uses raster mode
 *   (spec §7.1: a layout with any line in more than one font goes to the raster mode).
 * - `^FT` is the baseline origin of the line: the box's left edge in the reading frame (the start of the
 *   `^FB` block in the text's own orientation) and the line's baseline, through [ZplFrame]'s transform.
 *   How Zebra anchors `^FT` for an `R` field and maps the `^A@` height to the em are S7-K calibration items.
 * - `<h>` and `<w>` are the size in whole dots (points to dots, half up); the font is the resident file of
 *   the line's [PrintFont] (`E:NSARAB.TTF`, `E:NSARABB.TTF`, `E:NSLATN.TTF`, `E:NSLATNB.TTF`).
 * - `^FB` justification follows the alignment and the line's direction: start is `R` for right-to-left
 *   text and `L` for left-to-right, end the opposite, centre `C`. `^FB` is one line wide: the line is
 *   already broken by the fit rule (spec §5.3).
 * - A `\` in text is refused, not escaped: `^FB` reads `\&` and `\(*)` after the `^FH` decoding, so a
 *   backslash could still break or alter a line (spec §3.2 R7, §7.1).
 */
class ZplTextWriter {
    /**
     * Writes [layout] at [dotsPerMm]. [reprint] adds `~JA` (spec §8.6).
     */
    fun write(
        layout: Layout,
        dotsPerMm: Double,
        reprint: Boolean,
    ): ZplOutput =
        when (val f = ZplFrame.of(layout, dotsPerMm)) {
            is FrameOrRefusal.Refused -> ZplOutput.Refused(f.refusal)
            is FrameOrRefusal.Frame -> write(layout, f.frame, reprint)
        }

    private fun write(
        layout: Layout,
        frame: ZplFrame,
        reprint: Boolean,
    ): ZplOutput {
        val fields =
            layout.lines.mapIndexed { index, line -> lineField(line, index, frame) } +
                layout.barcodes.map { ZplFields.barcode(it, frame) } +
                layout.rules.map { FieldOrRefusal.Field(ZplFields.rule(it, frame)) }
        return ZplFields.firstRefusal(fields)?.let { ZplOutput.Refused(it) }
            ?: ZplOutput.Written(
                ZplCommands.join(
                    buildList {
                        if (reprint) add(CANCEL_ALL)
                        add("^XA")
                        add(UTF8)
                        addAll(frame.mediaCommands())
                        add(SHAPING)
                        addAll(ZplFields.commands(fields))
                        add(ONE_COPY)
                        add("^XZ")
                    },
                ),
            )
    }

    private fun lineField(
        line: PlacedLine,
        index: Int,
        frame: ZplFrame,
    ): FieldOrRefusal {
        val subject = "line $index"
        val font = line.fonts.singleOrNull()
        val escaped = ZplText.fieldData(line.text)
        return when {
            font == null -> {
                FieldOrRefusal.Refused(
                    Refusal(
                        RefusalReason.PRINTER_UNSUPPORTED,
                        subject = subject,
                        detail = "text mode needs one font per line, got ${line.fonts.size}",
                    ),
                )
            }

            ZplText.ESCAPE in line.text -> {
                FieldOrRefusal.Refused(
                    Refusal(RefusalReason.UNRENDERABLE_TEXT, subject = subject, detail = "backslash in a ZPL field block"),
                )
            }

            escaped is ZplFieldData.Rejected -> {
                FieldOrRefusal.Refused(
                    Refusal(RefusalReason.UNRENDERABLE_TEXT, subject = subject, detail = "${escaped.category} at index ${escaped.index}"),
                )
            }

            else -> {
                val data = (escaped as ZplFieldData.Escaped).value
                val origin = frame.point(line.boxXMm, line.baselineMm)
                val size = frame.sizeDots(line.sizePt)
                val width = frame.dots(line.boxWidthMm)
                val zplFont = PrintFont.of(font).zplName
                val o = frame.orientation
                FieldOrRefusal.Field(
                    "^FT${origin.x},${origin.y}^A@$o,$size,$size,$zplFont^FB$width,1,0,${justification(line)},0^FH\\^FD$data^FS",
                )
            }
        }
    }

    companion object {
        /** Cancel all: formats still queued in the printer are discarded before a reprint (spec §8.6). */
        const val CANCEL_ALL: String = "~JA"
        const val UTF8: String = "^CI28"
        const val SHAPING: String = "^PA1,1,1,1"
        const val ONE_COPY: String = "^PQ1"

        /** `^FB` justification from the line's alignment and paragraph direction. */
        fun justification(line: PlacedLine): Char =
            when (line.align) {
                Align.CENTER -> 'C'
                Align.START -> if (line.rightToLeft) 'R' else 'L'
                Align.END -> if (line.rightToLeft) 'L' else 'R'
            }
    }
}
