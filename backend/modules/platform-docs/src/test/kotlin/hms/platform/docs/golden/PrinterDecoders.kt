package hms.platform.docs.golden

import hms.platform.docs.domain.raster.MonoBitmap

// Test decoders for our own printer output (docs/specs/modules/platform-docs.md §10: "decoders are
// independent of writers"). They parse the output bytes from the command definitions and share no code
// with the writers; the golden images are compared with what they decode.

/** A decoding failure: the bytes are not what the writers must produce. */
private fun malformed(message: String): Nothing = throw AssertionError(message)

/** One `^GF` field as found in ZPL: its `^FO` position and its geometry. */
data class GraphicBand(
    val x: Int,
    val y: Int,
    val bytes: Int,
    val rowBytes: Int,
) {
    val rows: Int get() = bytes / rowBytes
}

/** The label image decoded from ZPL: a `^PW` × `^LL` canvas with every `^GF` field drawn at its position. */
class DecodedZpl(
    val image: MonoBitmap,
    val bands: List<GraphicBand>,
)

/**
 * Rebuilds the label image from ZPL bytes: reads `^PW` and `^LL`, then every
 * `^FO<x>,<y>^GFA,<b>,<t>,<r>,<hex>^FS` field (ASCII hex, uncompressed), checks that b = t, that b is a
 * whole number of rows of r bytes and that the hex holds exactly b bytes, and ORs each band into the
 * canvas (a set bit is black, most significant bit first). Anything malformed is an [AssertionError].
 */
object ZplGraphicDecoder {
    private val WIDTH = Regex("""\^PW(\d+)""")
    private val LENGTH = Regex("""\^LL(\d+)""")
    private val FIELD = Regex("""\^FO(\d+),(\d+)\^GFA,(\d+),(\d+),(\d+),([^\^]*)\^FS""")
    private val ANY_GF = Regex("""\^GF""")

    fun decode(zpl: ByteArray): DecodedZpl {
        val text = String(zpl, Charsets.UTF_8)
        val width = number(WIDTH, text, "^PW")
        val length = number(LENGTH, text, "^LL")
        val canvas = MonoBitmap(width, length)
        val fields = FIELD.findAll(text).toList()
        if (fields.size != ANY_GF.findAll(text).count()) malformed("a ^GF field is not of the form ^FO..^GFA,b,b,r,hex^FS")
        val bands = fields.map { band(it, canvas) }
        return DecodedZpl(canvas, bands)
    }

    private fun number(
        pattern: Regex,
        text: String,
        command: String,
    ): Int =
        pattern
            .find(text)
            ?.groupValues
            ?.get(1)
            ?.toInt() ?: malformed("no $command")

    /** Checks one `^GF` field and draws it into [canvas]. */
    private fun band(
        match: MatchResult,
        canvas: MonoBitmap,
    ): GraphicBand {
        val numbers =
            match.groupValues
                .drop(1)
                .take(FIELD_NUMBERS)
                .map { it.toInt() }
        val band = GraphicBand(x = numbers[0], y = numbers[1], bytes = numbers[2], rowBytes = numbers[ROW_BYTES])
        val total = numbers[TOTAL_BYTES]
        val hex = match.groupValues[HEX_GROUP]
        when {
            band.bytes != total -> malformed("^GF byte counts differ: ${band.bytes} and $total")
            band.rowBytes <= 0 || band.bytes % band.rowBytes != 0 -> malformed("^GF ${band.bytes} bytes, not whole rows of ${band.rowBytes}")
            hex.length != 2 * band.bytes -> malformed("^GF declares ${band.bytes} bytes but holds ${hex.length / 2}")
            hex.any { it !in "0123456789ABCDEF" } -> malformed("^GF data is not upper-case hexadecimal")
            else -> Unit
        }
        for (i in 0 until band.bytes) {
            val value = hex.substring(2 * i, 2 * i + 2).toInt(HEX)
            drawByte(canvas, value, band.x + (i % band.rowBytes) * BITS, band.y + i / band.rowBytes)
        }
        return band
    }

    private fun drawByte(
        canvas: MonoBitmap,
        value: Int,
        x: Int,
        y: Int,
    ) {
        for (bit in 0 until BITS) {
            if (value and (HIGH_BIT shr bit) != 0) {
                val px = x + bit
                if (px >= canvas.width || y >= canvas.height) {
                    malformed("black dot ($px, $y) outside the ${canvas.width}x${canvas.height} label")
                }
                canvas.set(px, y, true)
            }
        }
    }

    private const val FIELD_NUMBERS = 5
    private const val TOTAL_BYTES = 3
    private const val ROW_BYTES = 4
    private const val HEX_GROUP = 6
    private const val HEX = 16
    private const val BITS = 8
    private const val HIGH_BIT = 0x80
}

/** The page decoded from ESC/POS bytes, and the row count of each `GS v 0` band. */
class DecodedEscPos(
    val image: MonoBitmap,
    val bandRows: List<Int>,
    val rowBytes: Int,
)

/**
 * Parses ESC/POS bytes that must be exactly `ESC @` (1B 40), one or more `GS v 0` raster images
 * (1D 76 30 m xL xH yL yH data, m = 0) of equal width, and `GS V 66 0` (1D 56 42 00) at the end; the bands
 * are stacked top to bottom. Any other byte is an [AssertionError].
 */
object EscPosDecoder {
    fun decode(bytes: ByteArray): DecodedEscPos {
        val u = bytes.map { it.toInt() and BYTE }
        expect(u, 0, ESC, 0x40)
        var at = 2
        val rows = mutableListOf<IntArray>()
        val bandRows = mutableListOf<Int>()
        var rowBytes = -1
        while (at + 4 <= u.size && u[at] == GS && u[at + 1] == 0x76) {
            val (x, y) = header(u, at)
            if (rowBytes >= 0 && x != rowBytes) malformed("band width $x differs from $rowBytes")
            rowBytes = x
            val start = at + HEADER
            if (start + x * y > u.size) malformed("truncated GS v 0 data at byte $start")
            for (r in 0 until y) rows += IntArray(x) { u[start + r * x + it] }
            bandRows += y
            at = start + x * y
        }
        expect(u, at, GS, 0x56, 0x42, 0x00)
        if (at + 4 != u.size) malformed("bytes after the cut command")
        if (rows.isEmpty()) malformed("no GS v 0 image")
        return DecodedEscPos(image(rows, rowBytes), bandRows, rowBytes)
    }

    /** The `GS v 0` header at [at]: (x bytes per row, y rows). */
    private fun header(
        u: List<Int>,
        at: Int,
    ): Pair<Int, Int> {
        expect(u, at, GS, 0x76, 0x30, 0x00)
        if (at + HEADER > u.size) malformed("truncated GS v 0 header at byte $at")
        return (u[at + 4] + (u[at + 5] shl BITS)) to (u[at + 6] + (u[at + 7] shl BITS))
    }

    private fun expect(
        u: List<Int>,
        at: Int,
        vararg values: Int,
    ) {
        if (at + values.size > u.size || values.indices.any { u[at + it] != values[it] }) {
            malformed("expected ${values.joinToString(" ") { "%02X".format(it) }} at byte $at")
        }
    }

    private fun image(
        rows: List<IntArray>,
        rowBytes: Int,
    ): MonoBitmap {
        val image = MonoBitmap(rowBytes * BITS, rows.size)
        rows.forEachIndexed { y, row ->
            for (i in row.indices) {
                for (bit in 0 until BITS) if (row[i] and (HIGH_BIT shr bit) != 0) image.set(i * BITS + bit, y, true)
            }
        }
        return image
    }

    private const val BYTE = 0xFF
    private const val ESC = 0x1B
    private const val GS = 0x1D
    private const val HEADER = 8
    private const val BITS = 8
    private const val HIGH_BIT = 0x80
}
