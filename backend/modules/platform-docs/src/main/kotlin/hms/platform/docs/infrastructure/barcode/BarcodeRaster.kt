package hms.platform.docs.infrastructure.barcode

import hms.platform.docs.domain.raster.MonoBitmap

/**
 * Draws a ZXing module matrix into a 1-bit image (docs/specs/modules/platform-docs.md §6.2: in the
 * ESC/POS output the module draws the symbol itself). Each module is a whole number of dots; nothing is
 * scaled or anti-aliased, so the image holds exactly the encoder's modules.
 */
object BarcodeRaster {
    /**
     * Draws [matrix] at [placement]. Returns false, drawing nothing, when the symbol would not lie wholly
     * inside [bitmap] or a module would be smaller than one dot: a barcode is never cropped.
     */
    fun draw(
        bitmap: MonoBitmap,
        matrix: ModuleMatrix,
        placement: SymbolPlacement,
    ): Boolean {
        val rowDots = if (matrix.rows == 1) placement.barHeightDots else placement.moduleDots
        val moduleDots = placement.moduleDots
        val inside =
            moduleDots > 0 &&
                rowDots > 0 &&
                placement.left >= 0 &&
                placement.top >= 0 &&
                placement.left + matrix.columns * moduleDots <= bitmap.width &&
                placement.top + matrix.rows * rowDots <= bitmap.height
        if (inside) {
            for (row in 0 until matrix.rows) {
                val top = placement.top + row * rowDots
                for ((column, length) in matrix.darkRuns(row)) {
                    fill(bitmap, placement.left + column * moduleDots, top, length * moduleDots, rowDots)
                }
            }
        }
        return inside
    }

    private fun fill(
        bitmap: MonoBitmap,
        x0: Int,
        y0: Int,
        w: Int,
        h: Int,
    ) {
        for (y in y0 until y0 + h) {
            for (x in x0 until x0 + w) bitmap.set(x, y, true)
        }
    }
}

/**
 * Where and how large a symbol is drawn, in dots: its top-left corner ([left], [top]) without the quiet
 * zone, the module size [moduleDots] (a DataMatrix cell is a square of it; a Code 128 module is that wide)
 * and, for Code 128 (one row), the bar height [barHeightDots].
 */
data class SymbolPlacement(
    val left: Int,
    val top: Int,
    val moduleDots: Int,
    val barHeightDots: Int,
)
