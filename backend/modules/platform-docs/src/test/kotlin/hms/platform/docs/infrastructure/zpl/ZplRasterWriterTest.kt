package hms.platform.docs.infrastructure.zpl

import hms.platform.docs.api.RefusalReason
import hms.platform.docs.domain.layout.Layout
import hms.platform.docs.domain.raster.MonoBitmap
import hms.platform.docs.golden.ZplGraphicDecoder
import hms.platform.docs.infrastructure.raster.PlacedRaster
import hms.platform.docs.infrastructure.writers.FakeRasteriser
import hms.platform.docs.infrastructure.writers.WriterSamples
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.ints.shouldBeLessThanOrEqual
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldEndWith
import io.kotest.matchers.string.shouldNotContain
import io.kotest.matchers.string.shouldStartWith
import io.kotest.matchers.types.shouldBeInstanceOf
import kotlin.random.Random

/** ZPL raster mode (docs/specs/modules/platform-docs.md §7.2): the image decoded from our own `^GF` output equals the input raster. */
class ZplRasterWriterTest :
    FunSpec({
        val writer = ZplRasterWriter()
        val rasteriser = FakeRasteriser()

        fun write(
            layout: Layout,
            raster: PlacedRaster,
            dotsPerMm: Double = 8.0,
            reprint: Boolean = false,
        ): ByteArray = writer.write(layout, raster, dotsPerMm, reprint).shouldBeInstanceOf<ZplOutput.Written>().bytes

        /** The raster placed on a blank label of the given size: what the printer should print. */
        fun onLabel(
            raster: PlacedRaster,
            width: Int,
            length: Int,
        ): MonoBitmap {
            val label = MonoBitmap(width, length)
            for (y in 0 until raster.bitmap.height) {
                for (x in 0 until raster.bitmap.width) if (raster.bitmap.get(x, y)) label.set(raster.xDots + x, raster.yDots + y, true)
            }
            return label
        }

        test("wristband (90°): the decoded image equals the rasteriser's image on the media") {
            val layout = WriterSamples.wristband()
            val raster = rasteriser.rasterise(layout, 8.0)
            val decoded = ZplGraphicDecoder.decode(write(layout, raster))
            decoded.image shouldBe onLabel(raster, 200, 640)
            decoded.bands.size shouldBe 1
        }

        test("specimen label (0°) at 12 dots/mm: decoded image equals the input") {
            val layout = WriterSamples.specimenCode128()
            val raster = rasteriser.rasterise(layout, 12.0)
            ZplGraphicDecoder.decode(write(layout, raster, 12.0)).image shouldBe onLabel(raster, 600, 300)
        }

        test("a raster placed at an offset is written at that offset; all-white rows at top and bottom are cropped") {
            val layout = WriterSamples.specimenCode128()
            val bitmap = MonoBitmap(100, 50)
            for (x in 3 until 97) {
                bitmap.set(x, 10, true)
                bitmap.set(x, 39, true)
            }
            val raster = PlacedRaster(bitmap, 8, 16)
            val decoded = ZplGraphicDecoder.decode(write(layout, raster))
            decoded.image shouldBe onLabel(raster, 400, 200)
            decoded.bands.single().x shouldBe 8
            decoded.bands.single().y shouldBe 26
            decoded.bands.single().rows shouldBe 30
            decoded.bands.single().rowBytes shouldBe 13
        }

        test("a raster larger than 99,999 bytes is split into bands of whole rows, each at most 99,999 bytes") {
            // 104 mm × 250 mm at 8 dots/mm: 832 × 2000 dots, 104 bytes a row, 208,000 bytes.
            val layout = WriterSamples.specimenCode128().copy(frameWidthMm = 104.0, frameHeightMm = 250.0, barcodes = emptyList())
            val bitmap = MonoBitmap(832, 2000)
            val random = Random(20261019)
            for (y in 0 until 2000) for (x in 0 until 832) if (random.nextInt(5) == 0) bitmap.set(x, y, true)
            val raster = PlacedRaster(bitmap, 0, 0)
            val bytes = write(layout, raster)
            val decoded = ZplGraphicDecoder.decode(bytes)
            decoded.image shouldBe bitmap
            decoded.bands.map { it.rows } shouldBe listOf(961, 961, 78)
            decoded.bands.map { it.y } shouldBe listOf(0, 961, 1922)
            decoded.bands.forEach { it.bytes shouldBeLessThanOrEqual ZplRasterWriter.MAX_FIELD_BYTES }
            String(bytes, Charsets.UTF_8).lines().count { "^GFA" in it } shouldBe 3
        }

        test("an all-white raster writes no ^GF field; the barcodes stay") {
            val layout = WriterSamples.wristband()
            val text = String(write(layout, PlacedRaster(MonoBitmap(200, 640), 0, 0)), Charsets.UTF_8)
            ZplGraphicDecoder.decode(text.toByteArray()).bands.shouldBeEmpty()
            text.lines().count { "^BXR" in it } shouldBe 1
        }

        test("raster mode header: ^CI28, no ^PA; native ^BX equal to text mode's; ^PQ1 and ^XZ; ~JA only on a reprint, first") {
            val layout = WriterSamples.wristband()
            val raster = rasteriser.rasterise(layout, 8.0)
            val text = String(write(layout, raster), Charsets.UTF_8)
            text shouldStartWith "^XA\n^CI28\n^PW200\n^LL640\n^LH0,0\n^FO"
            text shouldNotContain "^PA"
            text shouldNotContain "~"
            text shouldNotContain "^GB"
            text shouldEndWith "^PQ1\n^XZ\n"
            val textMode = String(ZplTextWriter().write(layout, 8.0, false).shouldBeInstanceOf<ZplOutput.Written>().bytes, Charsets.UTF_8)
            text.lines() shouldContain textMode.lines().single { "^BX" in it }
            String(write(layout, raster, reprint = true), Charsets.UTF_8) shouldBe "~JA\n$text"
        }

        test("the Code 128 specimen option keeps a native ^BC field") {
            val layout = WriterSamples.specimenCode128()
            val text = String(write(layout, rasteriser.rasterise(layout, 8.0)), Charsets.UTF_8)
            text.lines() shouldContain "^FO24,96^BY2^BCN,56,N,N,N,N^FH\\^FDSYN-S-000077^FS"
        }

        test("a raster that does not lie wholly on the media is refused") {
            val layout = WriterSamples.specimenCode128()
            listOf(
                PlacedRaster(MonoBitmap(401, 10), 0, 0),
                PlacedRaster(MonoBitmap(10, 10), 395, 0),
                PlacedRaster(MonoBitmap(10, 10), 0, 191),
                PlacedRaster(MonoBitmap(10, 10), -1, 0),
            ).forEach { raster ->
                writer
                    .write(layout, raster, 8.0, false)
                    .shouldBeInstanceOf<ZplOutput.Refused>()
                    .refusal.reason shouldBe
                    RefusalReason.TEMPLATE_INVALID
            }
        }
    })
