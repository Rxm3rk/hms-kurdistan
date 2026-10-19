package hms.platform.docs.infrastructure.escpos

import com.google.zxing.BinaryBitmap
import com.google.zxing.RGBLuminanceSource
import com.google.zxing.common.HybridBinarizer
import com.google.zxing.oned.Code128Reader
import hms.platform.docs.api.RefusalReason
import hms.platform.docs.domain.layout.Layout
import hms.platform.docs.domain.layout.PlacedBarcode
import hms.platform.docs.domain.raster.MonoBitmap
import hms.platform.docs.domain.template.Symbology
import hms.platform.docs.golden.EscPosDecoder
import hms.platform.docs.infrastructure.raster.PlacedRaster
import hms.platform.docs.infrastructure.writers.FakeRasteriser
import hms.platform.docs.infrastructure.writers.WriterSamples
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf

/** ESC/POS raster (docs/specs/modules/platform-docs.md §7.3): decode round trip, bands of at most 256 rows, width rules. */
class EscPosWriterTest :
    FunSpec({
        val writer = EscPosWriter()

        fun write(
            layout: Layout,
            raster: PlacedRaster,
            width: Int = 576,
        ): ByteArray = writer.write(layout, raster, 8.0, width).shouldBeInstanceOf<EscPosOutput.Written>().bytes

        fun placed(
            raster: PlacedRaster,
            width: Int,
            height: Int,
        ): MonoBitmap {
            val page = MonoBitmap(width, height)
            for (y in 0 until raster.bitmap.height) {
                for (x in 0 until raster.bitmap.width) if (raster.bitmap.get(x, y)) page.set(raster.xDots + x, raster.yDots + y, true)
            }
            return page
        }

        test("receipt: the image decoded from GS v 0 equals the raster; bands of 256 rows and the rest") {
            val layout = WriterSamples.receipt()
            val raster = FakeRasteriser().rasterise(layout, 8.0)
            val decoded = EscPosDecoder.decode(write(layout, raster))
            decoded.image shouldBe raster.bitmap
            decoded.rowBytes shouldBe 72
            decoded.bandRows shouldBe listOf(256, 64)
        }

        test("bytes: ESC @ first, GS V 66 0 last, nothing else between the bands (no ESC d)") {
            val layout = WriterSamples.receipt()
            val bytes = write(layout, FakeRasteriser().rasterise(layout, 8.0))
            bytes.take(2) shouldBe listOf<Byte>(0x1B, 0x40)
            bytes.takeLast(4) shouldBe listOf<Byte>(0x1D, 0x56, 0x42, 0x00)
            bytes.take(10).drop(2) shouldBe listOf<Byte>(0x1D, 0x76, 0x30, 0x00, 72, 0, 0, 1)
        }

        test("a long raster is cut into bands of at most 256 rows") {
            val bitmap = MonoBitmap(576, 1000)
            for (y in 0 until 1000) bitmap.set(y % 576, y, true)
            val raster = PlacedRaster(bitmap, 0, 0)
            val decoded = EscPosDecoder.decode(write(WriterSamples.receipt(), raster))
            decoded.bandRows shouldBe listOf(256, 256, 256, 232)
            decoded.image shouldBe bitmap
        }

        test("a narrower raster is placed at its position and padded to the printer width; y offset rows are blank") {
            val bitmap = MonoBitmap(300, 40)
            for (x in 0 until 300) bitmap.set(x, x % 40, true)
            val raster = PlacedRaster(bitmap, 16, 10)
            val layout = WriterSamples.receipt().copy(frameHeightMm = 5.0)
            val decoded = EscPosDecoder.decode(write(layout, raster))
            decoded.image shouldBe placed(raster, 576, 50)
        }

        test("the page is as long as the layout's frame when the raster is shorter: blank rows to the frame's end") {
            val bitmap = MonoBitmap(576, 30)
            bitmap.set(0, 29, true)
            val raster = PlacedRaster(bitmap, 0, 0)
            val decoded = EscPosDecoder.decode(write(WriterSamples.receipt(), raster))
            decoded.image shouldBe placed(raster, 576, 320)
            decoded.bandRows shouldBe listOf(256, 64)
        }

        test("58 mm printer (384 dots)") {
            val bitmap = MonoBitmap(384, 20)
            bitmap.set(383, 19, true)
            val layout = WriterSamples.receipt().copy(frameHeightMm = 2.5)
            EscPosDecoder.decode(write(layout, PlacedRaster(bitmap, 0, 0), 384)).image shouldBe bitmap
        }

        test("a raster wider than the printer, or a 90° frame, is refused, never cropped") {
            writer
                .write(WriterSamples.receipt(), PlacedRaster(MonoBitmap(577, 10), 0, 0), 8.0, 576)
                .shouldBeInstanceOf<EscPosOutput.Refused>()
                .refusal.reason shouldBe RefusalReason.PRINTER_UNSUPPORTED
            writer
                .write(WriterSamples.receipt(), PlacedRaster(MonoBitmap(570, 10), 7, 0), 8.0, 576)
                .shouldBeInstanceOf<EscPosOutput.Refused>()
                .refusal.reason shouldBe RefusalReason.PRINTER_UNSUPPORTED
            writer
                .write(WriterSamples.receipt().copy(rotation = 90), PlacedRaster(MonoBitmap(10, 10), 0, 0), 8.0, 576)
                .shouldBeInstanceOf<EscPosOutput.Refused>()
                .refusal.reason shouldBe RefusalReason.TEMPLATE_INVALID
        }

        test("UnitTest:barcode-round-trip (ESC/POS): a Code 128 drawn by the module decodes to its payload") {
            val layout =
                WriterSamples.receipt().copy(
                    barcodes = listOf(PlacedBarcode(Symbology.CODE128, "SYN-R-000901", 6.0, 20.0, 0.25, 10.0)),
                )
            val decoded = EscPosDecoder.decode(write(layout, FakeRasteriser().rasterise(layout, 8.0))).image
            // The barcode region with its quiet zone, as an 8-bit image for ZXing.
            val top = 158
            val height = 84
            val pixels =
                IntArray(
                    decoded.width * height,
                ) { i -> if (decoded.get(i % decoded.width, top + i / decoded.width)) 0xFF000000.toInt() else -1 }
            val bitmap = BinaryBitmap(HybridBinarizer(RGBLuminanceSource(decoded.width, height, pixels)))
            Code128Reader().decode(bitmap).text shouldBe "SYN-R-000901"
        }

        test("a barcode that does not fit the page is refused") {
            val layout =
                WriterSamples.receipt().copy(
                    barcodes = listOf(PlacedBarcode(Symbology.CODE128, "SYN-R-000901", 40.0, 20.0, 0.25, 10.0)),
                )
            writer
                .write(layout, FakeRasteriser().rasterise(layout, 8.0), 8.0, 576)
                .shouldBeInstanceOf<EscPosOutput.Refused>()
                .refusal.reason shouldBe RefusalReason.TEMPLATE_INVALID
        }
    })
