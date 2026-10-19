package hms.platform.docs.infrastructure.zpl

import hms.platform.docs.api.Refusal
import hms.platform.docs.api.RefusalReason
import hms.platform.docs.domain.layout.PlacedBarcode
import hms.platform.docs.domain.layout.PlacedRule
import hms.platform.docs.domain.template.Symbology
import hms.platform.docs.infrastructure.barcode.BarcodeEncoder
import hms.platform.docs.infrastructure.barcode.BarcodeEncoding
import hms.platform.docs.infrastructure.barcode.ModuleMatrix

/**
 * The ZPL fields both ZPL modes write the same way (docs/specs/modules/platform-docs.md §6.2, §7.1,
 * §7.2): native barcodes and rules. In both modes the printer draws the symbol; this module chooses its
 * size with its own encoder, so `^BX` gets the columns and rows the encoder chose.
 */
internal object ZplFields {
    /** DataMatrix symbol quality: ECC 200. */
    private const val ECC_200 = 200

    /** The `^BX` escape character; it must never occur in a payload (spec §6.1 alphabet has none). */
    private const val DATAMATRIX_ESCAPE = '_'

    /** The `^BC` invocation character (mode N reads `>x` as a code-set or function invocation). */
    private const val CODE128_INVOCATION = '>'

    /**
     * One native barcode field. DataMatrix:
     * `^FO<x>,<y>^BX<o>,<module dots>,200,<cols>,<rows>,,_^FH\^FD<payload>^FS` (parameters o, h, s, c, r,
     * f, g: the format ID f is left empty, it does not apply to ECC 200, and g, the escape character, is
     * `_`). Code 128: `^FO<x>,<y>^BY<module dots>^BC<o>,<bar height>,N,N,N,N^FH\^FD<payload>^FS` (no
     * interpretation line, no check digit beyond the symbol's own, mode N with no invocation code, so the
     * printer encodes in subset B, the code set [BarcodeEncoder] forces): the human-readable ID is a
     * separate text element of the template (spec §4.3 rule 4). The field data, `^FH`-decoded, is the
     * payload exactly (spec §6.2).
     *
     * The symbol's top-left corner in the reading frame is the barcode's (x, y); its size is a whole number
     * of modules of whole dots. A symbol larger than [PlacedBarcode.maxSizeMm] (for Code 128, the bar
     * height is that size) or with a module below one dot is refused, never shrunk.
     */
    fun barcode(
        barcode: PlacedBarcode,
        frame: ZplFrame,
    ): FieldOrRefusal {
        val forbidden = if (barcode.symbology == Symbology.DATAMATRIX) DATAMATRIX_ESCAPE else CODE128_INVOCATION
        val encoded = BarcodeEncoder.encode(barcode.payload, barcode.symbology)
        val data = (ZplText.fieldData(barcode.payload) as? ZplFieldData.Escaped)?.value
        return when {
            forbidden in barcode.payload -> {
                refusal(RefusalReason.IDENTIFIER_INVALID, "payload holds the ZPL control character '$forbidden'")
            }

            encoded is BarcodeEncoding.Refused -> {
                FieldOrRefusal.Refused(encoded.refusal)
            }

            // Unreachable after the encoder's printable-ASCII check; kept so a change there cannot open a gap.
            data == null -> {
                refusal(RefusalReason.IDENTIFIER_INVALID, "payload is not ZPL field data")
            }

            else -> {
                sized(barcode, (encoded as BarcodeEncoding.Encoded).matrix, data, frame)
            }
        }
    }

    /** The field for an encoded symbol of [matrix] with escaped field [data], or a refusal for its size. */
    private fun sized(
        barcode: PlacedBarcode,
        matrix: ModuleMatrix,
        data: String,
        frame: ZplFrame,
    ): FieldOrRefusal {
        val moduleDots = frame.dots(barcode.moduleMm)
        val limitDots = frame.dots(barcode.maxSizeMm)
        val u0 = frame.dots(barcode.xMm)
        val v0 = frame.dots(barcode.yMm)
        val o = frame.orientation
        val dataMatrix = barcode.symbology == Symbology.DATAMATRIX
        return when {
            moduleDots < 1 -> {
                refusal(RefusalReason.TEMPLATE_INVALID, "module below one dot")
            }

            dataMatrix && matrix.columns * moduleDots > limitDots -> {
                refusal(RefusalReason.TEMPLATE_INVALID, "DataMatrix ${matrix.columns}x${matrix.rows} larger than its box")
            }

            dataMatrix -> {
                val side = matrix.columns * moduleDots
                val at = frame.rectDots(u0, v0, side, side)
                FieldOrRefusal.Field(
                    "^FO${at.x},${at.y}^BX$o,$moduleDots,$ECC_200,${matrix.columns},${matrix.rows},,$DATAMATRIX_ESCAPE^FH\\^FD$data^FS",
                )
            }

            else -> {
                val at = frame.rectDots(u0, v0, matrix.columns * moduleDots, limitDots)
                FieldOrRefusal.Field("^FO${at.x},${at.y}^BY$moduleDots^BC$o,$limitDots,N,N,N,N^FH\\^FD$data^FS")
            }
        }
    }

    /** A filled rectangle: `^FO<x>,<y>^GB<w>,<h>,<t>^FS` with the border thickness t = min(w, h), so it is solid. */
    fun rule(
        rule: PlacedRule,
        frame: ZplFrame,
    ): String {
        val r = frame.rect(rule.xMm, rule.yMm, rule.wMm, rule.hMm)
        return "^FO${r.x},${r.y}^GB${r.w},${r.h},${minOf(r.w, r.h)}^FS"
    }

    /** The first refusal among [fields], in layout order, or null when every field could be written. */
    fun firstRefusal(fields: List<FieldOrRefusal>): Refusal? = fields.firstNotNullOfOrNull { (it as? FieldOrRefusal.Refused)?.refusal }

    /** The commands of [fields] in order; call only after [firstRefusal] returned null. */
    fun commands(fields: List<FieldOrRefusal>): List<String> = fields.map { (it as FieldOrRefusal.Field).command }

    private fun refusal(
        reason: RefusalReason,
        detail: String,
    ) = FieldOrRefusal.Refused(Refusal(reason, subject = "barcode", detail = detail))
}

/** One ZPL field, or why it cannot be written. */
internal sealed interface FieldOrRefusal {
    data class Field(
        val command: String,
    ) : FieldOrRefusal

    data class Refused(
        val refusal: Refusal,
    ) : FieldOrRefusal
}
