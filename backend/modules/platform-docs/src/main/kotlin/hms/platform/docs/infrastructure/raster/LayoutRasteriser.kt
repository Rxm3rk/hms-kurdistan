package hms.platform.docs.infrastructure.raster

import hms.platform.docs.domain.layout.Layout
import hms.platform.docs.domain.raster.MonoBitmap

/**
 * Rasterises a layout's text lines and rules (never its barcodes) into a 1-bit image at a printer's dots
 * per millimetre (docs/specs/modules/platform-docs.md §7.2, §7.3): shaped glyph outlines filled without
 * anti-aliasing (a pixel is black when its centre is inside an outline), turned onto the media for a
 * 90° frame.
 */
fun interface LayoutRasteriser {
    fun rasterise(
        layout: Layout,
        dotsPerMm: Double,
    ): PlacedRaster
}

/**
 * A raster and where its top-left corner sits in the printer frame (dots across the print head, dots
 * along the feed), after rotation.
 */
data class PlacedRaster(
    val bitmap: MonoBitmap,
    val xDots: Int,
    val yDots: Int,
)
