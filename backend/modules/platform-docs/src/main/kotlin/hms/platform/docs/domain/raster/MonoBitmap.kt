package hms.platform.docs.domain.raster

/**
 * A 1-bit image as thermal printers print it (docs/specs/modules/platform-docs.md §7.2, §7.3): [width]
 * by [height] dots, rows packed most significant bit first, each row padded to whole bytes; a set bit is
 * a black dot. This is exactly the layout of ZPL `^GF` (ASCII hex) and ESC/POS `GS v 0` data.
 */
class MonoBitmap(
    val width: Int,
    val height: Int,
) {
    init {
        require(width > 0 && height > 0) { "bitmap size must be positive, got ${width}x$height" }
    }

    val bytesPerRow: Int = (width + BITS_PER_BYTE - 1) / BITS_PER_BYTE
    private val data = ByteArray(bytesPerRow * height)

    fun get(
        x: Int,
        y: Int,
    ): Boolean {
        checkBounds(x, y)
        return (data[index(x, y)].toInt() and mask(x)) != 0
    }

    fun set(
        x: Int,
        y: Int,
        black: Boolean,
    ) {
        checkBounds(x, y)
        val i = index(x, y)
        data[i] = if (black) (data[i].toInt() or mask(x)).toByte() else (data[i].toInt() and mask(x).inv()).toByte()
    }

    /** A copy of the packed rows. */
    fun packedRows(): ByteArray = data.copyOf()

    /** The number of black dots (for tests and difference reports). */
    fun blackCount(): Int = data.sumOf { Integer.bitCount(it.toInt() and BYTE_MASK) }

    private fun index(
        x: Int,
        y: Int,
    ) = y * bytesPerRow + x / BITS_PER_BYTE

    private fun mask(x: Int) = HIGH_BIT ushr (x % BITS_PER_BYTE)

    private fun checkBounds(
        x: Int,
        y: Int,
    ) = require(x in 0 until width && y in 0 until height) { "($x, $y) outside ${width}x$height" }

    override fun equals(other: Any?): Boolean =
        other is MonoBitmap && other.width == width && other.height == height && other.data.contentEquals(data)

    override fun hashCode(): Int = 31 * (31 * width + height) + data.contentHashCode()

    companion object {
        private const val BITS_PER_BYTE = 8
        private const val HIGH_BIT = 0x80
        private const val BYTE_MASK = 0xFF

        /** Builds a bitmap from packed rows in the layout above. */
        fun fromPackedRows(
            width: Int,
            height: Int,
            rows: ByteArray,
        ): MonoBitmap {
            val bitmap = MonoBitmap(width, height)
            require(rows.size == bitmap.bytesPerRow * height) {
                "expected ${bitmap.bytesPerRow * height} bytes for ${width}x$height, got ${rows.size}"
            }
            rows.copyInto(bitmap.data)
            return bitmap
        }
    }
}
