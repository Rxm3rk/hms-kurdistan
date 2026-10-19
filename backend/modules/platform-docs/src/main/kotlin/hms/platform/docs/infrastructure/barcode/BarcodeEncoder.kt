package hms.platform.docs.infrastructure.barcode

import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.datamatrix.DataMatrixWriter
import com.google.zxing.datamatrix.encoder.SymbolShapeHint
import com.google.zxing.oned.Code128Writer
import hms.platform.docs.api.Refusal
import hms.platform.docs.api.RefusalReason
import hms.platform.docs.domain.template.Symbology

/**
 * The barcode encoder adapter over ZXing core (Apache-2.0) (docs/specs/modules/platform-docs.md §6.1,
 * §6.2). It returns the module matrix of a symbol: the PDF, HTML and ESC/POS outputs draw it, and the
 * ZPL writers take the DataMatrix columns and rows from it for `^BX` (the printer draws the symbol, with
 * the size this encoder chose).
 *
 * - DataMatrix ECC 200, square symbols only (`SymbolShapeHint.FORCE_SQUARE`), no quiet zone in the matrix.
 * - Code 128: one row of modules, start code to stop pattern, no quiet zone (the template linter keeps
 *   ten modules clear, spec §4.3 rule 6), always in code set B (`EncodeHintType.FORCE_CODE_SET`). The ZPL
 *   writers send `^BC` in mode N with no invocation code, which a Zebra prints in subset B; forcing B here
 *   keeps the symbol the module draws (PDF, HTML, ESC/POS) the same width as the one the printer draws,
 *   instead of ZXing's shorter code-set-C runs for digits (spec §2: every output agrees on geometry). The
 *   printer's subset is an S7-K item.
 *
 * The payload alphabet is validated upstream (spec §3.2 R4, §6.1: identifiers in `A-Z a-z 0-9 -` joined
 * by `|` and `:`). This adapter still refuses anything outside printable ASCII (U+0020 to U+007E) and an
 * empty payload, so no control character, FNC character or non-ASCII byte can reach a symbol. A refusal
 * names the position and the code-point category, never the payload (it holds the MRN, SI-20).
 */
object BarcodeEncoder {
    private const val FIRST_PRINTABLE = 0x20
    private const val LAST_PRINTABLE = 0x7E
    private const val CODE_SET_B = "B"

    /** Encodes [payload] in [symbology]. */
    fun encode(
        payload: String,
        symbology: Symbology,
    ): BarcodeEncoding =
        when (symbology) {
            Symbology.DATAMATRIX -> dataMatrix(payload)
            Symbology.CODE128 -> code128(payload)
        }

    /** A square DataMatrix ECC 200 symbol for [payload]. */
    fun dataMatrix(payload: String): BarcodeEncoding =
        checkPayload(payload) ?: zxing("DataMatrix") {
            val hints = mapOf(EncodeHintType.DATA_MATRIX_SHAPE to SymbolShapeHint.FORCE_SQUARE)
            // Width and height 0: ZXing returns the symbol at one pixel per module, without a margin.
            val matrix = DataMatrixWriter().encode(payload, BarcodeFormat.DATA_MATRIX, 0, 0, hints)
            val columns = matrix.width
            val rows = matrix.height
            val dark = BooleanArray(columns * rows) { i -> matrix.get(i % columns, i / columns) }
            ModuleMatrix(Symbology.DATAMATRIX, columns, rows, dark)
        }

    /** A Code 128 module pattern for [payload] in code set B: one row, dark modules true. */
    fun code128(payload: String): BarcodeEncoding =
        checkPayload(payload) ?: zxing("Code 128") {
            val pattern = Code128Writer().encode(payload, mapOf(EncodeHintType.FORCE_CODE_SET to CODE_SET_B))
            ModuleMatrix(Symbology.CODE128, pattern.size, 1, pattern.copyOf())
        }

    /** Runs a ZXing encoder; ZXing reports a payload it cannot encode with [IllegalArgumentException]. */
    private inline fun zxing(
        name: String,
        encode: () -> ModuleMatrix,
    ): BarcodeEncoding =
        try {
            BarcodeEncoding.Encoded(encode())
        } catch (e: IllegalArgumentException) {
            refused("$name encoder rejected the payload (${e.javaClass.simpleName})")
        }

    private fun checkPayload(payload: String): BarcodeEncoding.Refused? {
        val bad = payload.indexOfFirst { it.code !in FIRST_PRINTABLE..LAST_PRINTABLE }
        return when {
            payload.isEmpty() -> refused("empty barcode payload")
            bad >= 0 -> refused("barcode payload character at index $bad is not printable ASCII")
            else -> null
        }
    }

    private fun refused(detail: String) =
        BarcodeEncoding.Refused(Refusal(RefusalReason.IDENTIFIER_INVALID, subject = "barcode", detail = detail))
}

/** The result of encoding a barcode: a module matrix, or a refusal (a value, never an exception). */
sealed interface BarcodeEncoding {
    data class Encoded(
        val matrix: ModuleMatrix,
    ) : BarcodeEncoding

    data class Refused(
        val refusal: Refusal,
    ) : BarcodeEncoding
}

/**
 * The modules of a symbol, [columns] across and [rows] down (Code 128 has one row), quiet zone
 * excluded. For DataMatrix the columns and rows count the finder and timing patterns, as `^BX` wants them.
 */
class ModuleMatrix(
    val symbology: Symbology,
    val columns: Int,
    val rows: Int,
    private val dark: BooleanArray,
) {
    init {
        require(columns > 0 && rows > 0 && dark.size == columns * rows) { "module matrix ${columns}x$rows has ${dark.size} cells" }
    }

    /** True when the module at ([column], [row]) is dark (a bar or a black cell). */
    fun isDark(
        column: Int,
        row: Int,
    ): Boolean {
        require(column in 0 until columns && row in 0 until rows) { "($column, $row) outside ${columns}x$rows" }
        return dark[row * columns + column]
    }

    /** The dark runs of [row] as (first column, length) pairs, left to right. */
    fun darkRuns(row: Int): List<Pair<Int, Int>> {
        val runs = mutableListOf<Pair<Int, Int>>()
        var column = 0
        while (column < columns) {
            if (isDark(column, row)) {
                val start = column
                while (column < columns && isDark(column, row)) column++
                runs += start to column - start
            } else {
                column++
            }
        }
        return runs
    }

    override fun equals(other: Any?): Boolean =
        other is ModuleMatrix &&
            other.symbology == symbology &&
            other.columns == columns &&
            other.rows == rows &&
            other.dark.contentEquals(dark)

    override fun hashCode(): Int = 31 * (31 * columns + rows) + dark.contentHashCode()
}
