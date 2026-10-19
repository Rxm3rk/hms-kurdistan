package hms.platform.docs.golden

import hms.platform.docs.domain.raster.MonoBitmap
import java.awt.image.BufferedImage
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.nio.file.Files
import java.nio.file.Path
import javax.imageio.ImageIO

/**
 * Golden images for the JVM print paths (docs/specs/modules/platform-docs.md §10): a 1-bit image decoded
 * from our own `^GF` or `GS v 0` output is compared pixel for pixel with an approved PNG at
 * `src/test/resources/golden/<identity>/<name>.png`, listed with its SHA-256 in that directory's
 * `manifest.json` (see [ApprovedSets]).
 *
 * The identity is the renderer identity (agent B's `JvmRenderIdentity`: JDK vendor and version, font hashes,
 * rasteriser version). A run whose identity has no approved set fails closed ("no approved golden images
 * for <identity>"). On any failure the harness writes, under `<candidatesDir>/golden/<identity>/`, the
 * candidate PNG, a difference PNG (black: in both; red: only in the candidate; blue: only in the approved
 * image) and the candidate manifest, and never touches the approved files.
 */
class GoldenImages(
    private val approved: (String) -> ByteArray? = ApprovedSets.classpath,
    private val candidatesDir: () -> Path = ApprovedSets::candidatesDirFromSystemProperty,
) {
    /** Asserts that [actual] equals the approved image [name] of [identity]; throws [AssertionError] otherwise. */
    fun assertMatches(
        identity: String,
        name: String,
        actual: MonoBitmap,
        provenance: Provenance,
    ) {
        ApprovedSets.requireSafeSegment("identity", identity)
        ApprovedSets.requireSafeSegment("name", name)
        val dir = "golden/$identity"
        val manifest = approved("$dir/manifest.json")
        val png = approved("$dir/$name.png")
        val entry = manifest?.let { ApprovedSets.approvedEntry(it, "$name.png") }
        val problem =
            when {
                manifest == null -> "no approved golden images for $identity"

                entry == null || png == null -> "no approved golden image $name for $identity"

                entry
                    .path(
                        "sha256",
                    ).asString() != ApprovedSets.sha256(png) -> "approved $name for $identity does not match its manifest SHA-256"

                else -> compare(PngBitmaps.read(png), actual)
            }
        if (problem != null) {
            val written = writeCandidate(identity, name, actual, png?.let { runCatching { PngBitmaps.read(it) }.getOrNull() }, provenance)
            throw AssertionError("$problem; candidate written to $written")
        }
    }

    private fun compare(
        expected: MonoBitmap,
        actual: MonoBitmap,
    ): String? {
        if (expected.width != actual.width || expected.height != actual.height) {
            return "size ${actual.width}x${actual.height} differs from the approved ${expected.width}x${expected.height}"
        }
        var differing = 0
        for (y in 0 until actual.height) {
            for (x in 0 until actual.width) if (expected.get(x, y) != actual.get(x, y)) differing++
        }
        return if (differing == 0) null else "$differing pixels differ from the approved image"
    }

    private fun writeCandidate(
        identity: String,
        name: String,
        actual: MonoBitmap,
        expected: MonoBitmap?,
        provenance: Provenance,
    ): Path {
        val dir = candidatesDir().resolve("golden").resolve(identity)
        Files.createDirectories(dir)
        val png = PngBitmaps.write(actual)
        val file = dir.resolve("$name.png")
        Files.write(file, png)
        if (expected != null) Files.write(dir.resolve("$name.diff.png"), PngBitmaps.difference(expected, actual))
        ApprovedSets.recordCandidate(dir, identity, "$name.png", ApprovedSets.sha256(png), provenance)
        return file
    }
}

/** 1-bit images as PNG: black and white only, so an approved file is exactly a [MonoBitmap]. */
object PngBitmaps {
    private const val BLACK = 0xFF000000.toInt()
    private const val WHITE = 0xFFFFFFFF.toInt()
    private const val RED = 0xFFFF0000.toInt()
    private const val BLUE = 0xFF0000FF.toInt()

    fun write(bitmap: MonoBitmap): ByteArray {
        val image = BufferedImage(bitmap.width, bitmap.height, BufferedImage.TYPE_BYTE_BINARY)
        for (y in 0 until bitmap.height) {
            for (x in 0 until bitmap.width) image.setRGB(x, y, if (bitmap.get(x, y)) BLACK else WHITE)
        }
        return png(image)
    }

    /** Reads a PNG whose every pixel is pure black or pure white; anything else is an error (no threshold). */
    fun read(png: ByteArray): MonoBitmap {
        val image = ImageIO.read(ByteArrayInputStream(png)) ?: throw AssertionError("not a PNG image")
        val bitmap = MonoBitmap(image.width, image.height)
        for (y in 0 until image.height) {
            for (x in 0 until image.width) {
                when (image.getRGB(x, y)) {
                    BLACK -> bitmap.set(x, y, true)
                    WHITE -> Unit
                    else -> throw AssertionError("pixel ($x, $y) is neither black nor white")
                }
            }
        }
        return bitmap
    }

    fun difference(
        expected: MonoBitmap,
        actual: MonoBitmap,
    ): ByteArray {
        val width = maxOf(expected.width, actual.width)
        val height = maxOf(expected.height, actual.height)
        val image = BufferedImage(width, height, BufferedImage.TYPE_INT_RGB)
        for (y in 0 until height) {
            for (x in 0 until width) {
                val e = x < expected.width && y < expected.height && expected.get(x, y)
                val a = x < actual.width && y < actual.height && actual.get(x, y)
                image.setRGB(
                    x,
                    y,
                    when {
                        e && a -> BLACK
                        a -> RED
                        e -> BLUE
                        else -> WHITE
                    },
                )
            }
        }
        return png(image)
    }

    private fun png(image: BufferedImage): ByteArray {
        val out = ByteArrayOutputStream()
        check(ImageIO.write(image, "png", out)) { "no PNG writer" }
        return out.toByteArray()
    }
}
