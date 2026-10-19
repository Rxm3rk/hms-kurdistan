package hms.platform.docs.infrastructure.raster

import hms.platform.docs.domain.raster.MonoBitmap
import java.awt.Shape
import java.awt.geom.AffineTransform
import java.awt.geom.FlatteningPathIterator
import java.awt.geom.PathIterator
import java.math.BigDecimal
import java.math.RoundingMode
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/**
 * Millimetres to printer dots (docs/specs/modules/platform-docs.md §5.4): the decimal value of the
 * millimetres times the profile's dots per millimetre, rounded half up once. Callers round every
 * coordinate from its own millimetre value, never by adding rounded parts.
 */
internal object Dots {
    fun of(
        mm: Double,
        dotsPerMm: Double,
    ): Int =
        BigDecimal
            .valueOf(mm)
            .multiply(BigDecimal.valueOf(dotsPerMm))
            .setScale(0, RoundingMode.HALF_UP)
            .intValueExact()
}

/**
 * A 1-bit drawing surface in reading-frame dots (x right, y down), [width] by [height]. Everything drawn
 * outside it is clipped.
 */
internal class FrameBuffer(
    val width: Int,
    val height: Int,
) {
    private val black = BooleanArray(width * height)

    fun isBlack(
        x: Int,
        y: Int,
    ): Boolean = black[y * width + x]

    /** Blackens pixels [x0, x1) × [y0, y1), clipped to the frame. */
    fun fillRect(
        x0: Int,
        y0: Int,
        x1: Int,
        y1: Int,
    ) {
        for (y in max(0, y0) until min(height, y1)) fillSpan(y, x0, x1)
    }

    /** Blackens pixels [x0, x1) of row [y], clipped to the frame. */
    fun fillSpan(
        y: Int,
        x0: Int,
        x1: Int,
    ) {
        if (y !in 0 until height) return
        for (x in max(0, x0) until min(width, x1)) black[y * width + x] = true
    }

    /**
     * The frame as a printer bitmap. For rotation 0 the bitmap is the frame. For rotation 90 the frame is
     * turned a quarter turn clockwise onto the media (ZPL's `R`): bitmap x runs across the print head,
     * bitmap y along the feed, the bitmap is [height] wide and [width] long, and frame pixel (fx, fy) lands
     * at (height − 1 − fy, fx). So the frame's x axis (the reading direction) runs down the feed and the
     * frame's top edge lies along the media's right edge (the pixel form of the ZPL writer's
     * x = `^PW` − dots(v), y = dots(u)).
     */
    fun toBitmap(rotation: Int): MonoBitmap {
        require(rotation == 0 || rotation == QUARTER_TURN) { "unsupported rotation $rotation" }
        return if (rotation == 0) {
            MonoBitmap(width, height).also { out -> forEachBlack { x, y -> out.set(x, y, true) } }
        } else {
            MonoBitmap(height, width).also { out -> forEachBlack { x, y -> out.set(height - 1 - y, x, true) } }
        }
    }

    private inline fun forEachBlack(action: (Int, Int) -> Unit) {
        for (y in 0 until height) {
            for (x in 0 until width) if (black[y * width + x]) action(x, y)
        }
    }

    companion object {
        const val QUARTER_TURN: Int = 90
    }
}

/**
 * Fills a shape without anti-aliasing (spec §7.2): a pixel is black exactly when its centre
 * (x + 0.5, y + 0.5) is inside the shape under the shape's winding rule (non-zero for TrueType outlines).
 * The path is flattened by Java2D's `FlatteningPathIterator` to within [FLATNESS] dots, then scan-converted
 * row by row at pixel centres; an edge counts for a row when its lower end is at or above the centre line
 * and its upper end is below it (half-open), so a pixel centre on a shared edge is filled exactly once.
 * This is our own fill, so the pixel rule is the spec's by construction and does not depend on the
 * renderer inside the JDK (Marlin); the rasteriser tests compare it with Java2D's own non-anti-aliased fill.
 */
internal object ScanlineFill {
    /** The largest distance, in dots, between a curve and its flattened polyline. */
    const val FLATNESS: Double = 0.01

    private const val CENTRE = 0.5
    private const val SUBDIVISION_LIMIT = 16

    private class Edge(
        val x0: Double,
        val y0: Double,
        val x1: Double,
        val y1: Double,
    ) {
        val top: Double = min(y0, y1)
        val bottom: Double = max(y0, y1)
        val winding: Int = if (y1 > y0) 1 else -1

        fun xAt(y: Double): Double = x0 + (y - y0) * (x1 - x0) / (y1 - y0)
    }

    fun fill(
        shape: Shape,
        transform: AffineTransform,
        target: FrameBuffer,
    ) {
        val iterator = FlatteningPathIterator(shape.getPathIterator(transform), FLATNESS, SUBDIVISION_LIMIT)
        val nonZero = iterator.windingRule == PathIterator.WIND_NON_ZERO
        val edges = edgesOf(iterator)
        if (edges.isEmpty()) return
        val firstRow = max(0, floor(edges.minOf { it.top } - CENTRE).toInt())
        val lastRow = min(target.height - 1, ceil(edges.maxOf { it.bottom } - CENTRE).toInt())
        for (row in firstRow..lastRow) {
            val centre = row + CENTRE
            val crossings =
                edges
                    .filter { centre >= it.top && centre < it.bottom }
                    .map { it.xAt(centre) to it.winding }
                    .sortedBy { it.first }
            var winding = 0
            var spanStart = 0.0
            for ((x, w) in crossings) {
                val wasInside = if (nonZero) winding != 0 else winding % 2 != 0
                winding += w
                val inside = if (nonZero) winding != 0 else winding % 2 != 0
                if (!wasInside && inside) spanStart = x
                if (wasInside && !inside) target.fillSpan(row, firstPixel(spanStart), firstPixel(x))
            }
        }
    }

    /** The first pixel whose centre is at or right of [x]. */
    private fun firstPixel(x: Double): Int = ceil(x - CENTRE).toInt()

    private fun edgesOf(iterator: PathIterator): List<Edge> {
        val edges = mutableListOf<Edge>()
        val coords = DoubleArray(COORDS)
        var startX = 0.0
        var startY = 0.0
        var lastX = 0.0
        var lastY = 0.0

        fun addEdge(
            x: Double,
            y: Double,
        ) {
            if (y != lastY) edges += Edge(lastX, lastY, x, y)
            lastX = x
            lastY = y
        }
        while (!iterator.isDone) {
            when (iterator.currentSegment(coords)) {
                PathIterator.SEG_MOVETO -> {
                    addEdge(startX, startY) // an open subpath is closed for filling
                    startX = coords[0]
                    startY = coords[1]
                    lastX = startX
                    lastY = startY
                }

                PathIterator.SEG_LINETO -> {
                    addEdge(coords[0], coords[1])
                }

                PathIterator.SEG_CLOSE -> {
                    addEdge(startX, startY)
                }

                else -> {
                    error("a flattened path holds only moves, lines and closes")
                }
            }
            iterator.next()
        }
        addEdge(startX, startY)
        return edges
    }

    private const val COORDS = 6
}
