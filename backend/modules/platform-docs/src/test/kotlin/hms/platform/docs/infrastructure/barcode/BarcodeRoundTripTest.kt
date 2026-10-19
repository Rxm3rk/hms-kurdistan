package hms.platform.docs.infrastructure.barcode

import com.google.zxing.BinaryBitmap
import com.google.zxing.DecodeHintType
import com.google.zxing.RGBLuminanceSource
import com.google.zxing.common.HybridBinarizer
import com.google.zxing.datamatrix.DataMatrixReader
import com.google.zxing.oned.Code128Reader
import hms.platform.docs.api.RefusalReason
import hms.platform.docs.domain.raster.MonoBitmap
import hms.platform.docs.domain.template.Symbology
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import java.awt.image.BufferedImage

/**
 * `UnitTest:barcode-round-trip` (docs/specs/modules/platform-docs.md §6.2, HAZ-0046): the encoder's matrix,
 * rendered to an image in this test only, decodes with ZXing's readers to exactly the payload.
 */
class BarcodeRoundTripTest :
    FunSpec({
        val payloads =
            listOf(
                "HMS1|M:SYN-000123-7|E:SYN-E-000045|B:SYN-J0001",
                "HMS1|S:SYN-S-000077|M:SYN-000123-7",
                "HMS1|M:0012345|E:9|B:0193f0c2-7a1e-7cc3-8000-000000000001",
                "SYN-S-000077",
            )

        /**
         * Renders a matrix to a BufferedImage: [scale] pixels per module, [quiet] modules of white around it,
         * Code 128 bars [barHeight] pixels high.
         */
        fun render(
            matrix: ModuleMatrix,
            scale: Int,
            quiet: Int,
            barHeight: Int = scale,
        ): BufferedImage {
            val rowPx = if (matrix.rows == 1) barHeight else scale
            val image =
                BufferedImage((matrix.columns + 2 * quiet) * scale, matrix.rows * rowPx + 2 * quiet * scale, BufferedImage.TYPE_INT_RGB)
            for (y in 0 until image.height) {
                for (x in 0 until image.width) {
                    val c = x / scale - quiet
                    val r = (y - quiet * scale) / rowPx
                    val inside = y >= quiet * scale && c in 0 until matrix.columns && r in 0 until matrix.rows
                    image.setRGB(x, y, if (inside && matrix.isDark(c, r)) 0x000000 else 0xFFFFFF)
                }
            }
            return image
        }

        fun binary(image: BufferedImage): BinaryBitmap {
            val pixels = image.getRGB(0, 0, image.width, image.height, null, 0, image.width)
            return BinaryBitmap(HybridBinarizer(RGBLuminanceSource(image.width, image.height, pixels)))
        }

        test("UnitTest:barcode-round-trip: DataMatrix ECC 200, square, decodes to the payload") {
            payloads.forEach { payload ->
                val matrix = BarcodeEncoder.dataMatrix(payload).shouldBeInstanceOf<BarcodeEncoding.Encoded>().matrix
                matrix.columns shouldBe matrix.rows
                matrix.symbology shouldBe Symbology.DATAMATRIX
                DataMatrixReader().decode(binary(render(matrix, 6, 2)), mapOf(DecodeHintType.PURE_BARCODE to true)).text shouldBe payload
            }
        }

        test("UnitTest:barcode-round-trip: Code 128 decodes to the payload") {
            payloads.forEach { payload ->
                val matrix = BarcodeEncoder.code128(payload).shouldBeInstanceOf<BarcodeEncoding.Encoded>().matrix
                matrix.rows shouldBe 1
                Code128Reader().decode(binary(render(matrix, 3, 10, barHeight = 60))).text shouldBe payload
            }
        }

        test("UnitTest:barcode-round-trip: the matrix drawn into a 1-bit image by BarcodeRaster decodes") {
            val payload = payloads.first()
            val matrix = BarcodeEncoder.dataMatrix(payload).shouldBeInstanceOf<BarcodeEncoding.Encoded>().matrix
            val bitmap = MonoBitmap(matrix.columns * 4 + 40, matrix.rows * 4 + 40)
            BarcodeRaster.draw(bitmap, matrix, SymbolPlacement(20, 20, 4, 4)) shouldBe true
            bitmap.blackCount() shouldBe (0 until matrix.rows).sumOf { r -> (0 until matrix.columns).count { matrix.isDark(it, r) } } * 16
            val pixels =
                IntArray(
                    bitmap.width * bitmap.height,
                ) { i -> if (bitmap.get(i % bitmap.width, i / bitmap.width)) 0xFF000000.toInt() else -1 }
            val image = BinaryBitmap(HybridBinarizer(RGBLuminanceSource(bitmap.width, bitmap.height, pixels)))
            DataMatrixReader().decode(image, mapOf(DecodeHintType.PURE_BARCODE to true)).text shouldBe payload
        }

        test("BarcodeRaster never crops: a symbol one dot past any edge, or a zero module, draws nothing and says so") {
            val matrix = BarcodeEncoder.dataMatrix(payloads.first()).shouldBeInstanceOf<BarcodeEncoding.Encoded>().matrix
            val side = matrix.columns * 4
            val bitmap = MonoBitmap(side + 40, side + 40)
            listOf(
                SymbolPlacement(41, 0, 4, 4),
                SymbolPlacement(0, 41, 4, 4),
                SymbolPlacement(-1, 0, 4, 4),
                SymbolPlacement(0, -1, 4, 4),
                SymbolPlacement(0, 0, 0, 4),
            ).forEach { placement -> BarcodeRaster.draw(bitmap, matrix, placement) shouldBe false }
            bitmap.blackCount() shouldBe 0
            BarcodeRaster.draw(bitmap, matrix, SymbolPlacement(40, 40, 4, 4)) shouldBe true
        }

        test("Code 128 is encoded in code set B (the subset a Zebra's ^BC mode N prints), so every output has one width") {
            // Start B, 12 data characters, check character: 11 modules each; the stop pattern is 13.
            val matrix = BarcodeEncoder.code128("SYN-S-000077").shouldBeInstanceOf<BarcodeEncoding.Encoded>().matrix
            matrix.columns shouldBe 14 * 11 + 13
            // Start B is 11010010000 (value 104); start C would be 11010011100.
            (0 until 11).map { if (matrix.isDark(it, 0)) '1' else '0' }.joinToString("") shouldBe "11010010000"
        }

        test("the encoder refuses an empty payload, non-printable ASCII and non-ASCII, without echoing the payload") {
            listOf("", "HMS1|M:SYN\u0000", "HMS1|M:SYN\n", "HMS1|M:SYN-١٢", "HMS1|M:ئ", "\u007F").forEach { payload ->
                Symbology.entries.forEach { symbology ->
                    val refusal = BarcodeEncoder.encode(payload, symbology).shouldBeInstanceOf<BarcodeEncoding.Refused>().refusal
                    refusal.reason shouldBe RefusalReason.IDENTIFIER_INVALID
                    if (payload.length > 4) (payload in refusal.detail.orEmpty()) shouldBe false
                }
            }
        }

        test("a payload too long for any square DataMatrix is a refusal, not an exception") {
            BarcodeEncoder.dataMatrix("A".repeat(5000)).shouldBeInstanceOf<BarcodeEncoding.Refused>()
        }

        test("dark runs cover exactly the dark modules") {
            val matrix = BarcodeEncoder.code128("SYN-1").shouldBeInstanceOf<BarcodeEncoding.Encoded>().matrix
            val fromRuns = BooleanArray(matrix.columns)
            matrix.darkRuns(0).forEach { (start, length) -> for (c in start until start + length) fromRuns[c] = true }
            (0 until matrix.columns).all { fromRuns[it] == matrix.isDark(it, 0) } shouldBe true
        }
    })
