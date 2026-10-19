package hms.platform.docs.infrastructure.html

import com.google.zxing.BinaryBitmap
import com.google.zxing.DecodeHintType
import com.google.zxing.RGBLuminanceSource
import com.google.zxing.common.HybridBinarizer
import com.google.zxing.datamatrix.DataMatrixReader
import hms.platform.docs.api.RefusalReason
import hms.platform.docs.domain.layout.Layout
import hms.platform.docs.golden.ByteFixtures
import hms.platform.docs.infrastructure.barcode.BarcodeEncoder
import hms.platform.docs.infrastructure.barcode.BarcodeEncoding
import hms.platform.docs.infrastructure.writers.WriterSamples
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import io.kotest.matchers.string.shouldStartWith
import io.kotest.matchers.types.shouldBeInstanceOf

/** HTML for labels and receipts (docs/specs/modules/platform-docs.md §7.4; `ByteFixture:html-*`). */
class HtmlWriterTest :
    FunSpec({
        val writer = HtmlWriter()

        fun html(layout: Layout): String = writer.write(layout, WriterSamples.CREATED_AT).shouldBeInstanceOf<HtmlOutput.Written>().html

        test("deterministic: the same layout gives the same bytes; LF only; UTF-8 charset first in head") {
            val a = html(WriterSamples.wristband())
            a shouldBe html(WriterSamples.wristband())
            a shouldNotContain "\r"
            a shouldStartWith "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<title>SYN-WRISTBAND-ADULT</title>\n"
        }

        test("metadata: creation time from the request, template id, version and hash, provenance and the synthetic notice") {
            val text = html(WriterSamples.wristband())
            text shouldContain "<meta name=\"dcterms.created\" content=\"2026-10-19T09:00:00+03:00\">\n"
            text shouldContain "<meta name=\"dcterms.modified\" content=\"2026-10-19T09:00:00+03:00\">\n"
            text shouldContain "<meta name=\"hms.template.id\" content=\"SYN-WRISTBAND-ADULT\">\n"
            text shouldContain "<meta name=\"hms.template.version\" content=\"1\">\n"
            text shouldContain "<meta name=\"hms.template.hash\" content=\"${WriterSamples.TEMPLATE_HASH}\">\n"
            text shouldContain "<meta name=\"hms.provenance\" content=\"synthetic\">\n"
            text shouldContain "<meta name=\"hms.notice\" content=\"SYNTHETIC – NOT FOR CLINICAL USE\">\n"
            val approved = html(WriterSamples.wristband().copy(synthetic = false))
            approved shouldContain "<meta name=\"hms.provenance\" content=\"approved\">\n"
            approved shouldNotContain "hms.notice"
        }

        test("page of the reading frame's size; fonts by hms-font: only") {
            val text = html(WriterSamples.wristband())
            text shouldContain "@page { size: 80mm 25mm; margin: 0; }\n"
            text shouldContain "@font-face { font-family: \"noto-sans-arabic-bold\"; src: url(hms-font:noto-sans-arabic-bold); }\n"
            text shouldContain "@font-face { font-family: \"noto-sans-regular\"; src: url(hms-font:noto-sans-regular); }\n"
            HtmlLint.check(text) shouldBe HtmlLintResult.Clean
        }

        test("each line an absolutely positioned div with its geometry, font, size, line height, direction and alignment") {
            val text = html(WriterSamples.wristband())
            text shouldContain
                "<div class=\"line\" style=\"left: 2mm; top: 1.5mm; width: 50mm; font-family: 'noto-sans-arabic-bold'; font-size: 10pt; " +
                "line-height: 21.118pt; direction: rtl; text-align: start;\">ئارام ڕێبوار</div>\n"
            text shouldContain "direction: ltr; text-align: end;\">SYN-J0001 2026-10-19 09:00</div>\n"
            text shouldContain "text-align: center;\">SYNTHETIC – NOT FOR CLINICAL USE</div>\n"
            text shouldContain ".line { position: absolute; margin: 0; padding: 0; white-space: pre; unicode-bidi: isolate; }\n"
            text shouldContain "<div class=\"rule\" style=\"left: 2mm; top: 14mm; width: 50mm; height: 0.3mm;\"></div>\n"
        }

        test("a font chain becomes a font-family list in chain order") {
            val layout =
                WriterSamples.wristband().let { w ->
                    w.copy(lines = listOf(w.lines[0].copy(fonts = listOf(WriterSamples.ARABIC_REGULAR, WriterSamples.LATIN_REGULAR))))
                }
            html(layout) shouldContain "font-family: 'noto-sans-arabic-regular', 'noto-sans-regular';"
        }

        test("text is HTML-escaped: & < > \" '") {
            val layout = WriterSamples.wristband().let { w -> w.copy(lines = listOf(w.lines[1].copy(text = "<b>&\"'x</b>"))) }
            html(layout) shouldContain ">&lt;b&gt;&amp;&quot;&#39;x&lt;/b&gt;</div>\n"
        }

        test("text HTML cannot carry is refused, never dropped") {
            listOf("a\u0000b", "a\u0007", "a b", "a\uD800").forEach { bad ->
                val layout = WriterSamples.wristband().let { w -> w.copy(lines = listOf(w.lines[1].copy(text = bad))) }
                writer
                    .write(layout, WriterSamples.CREATED_AT)
                    .shouldBeInstanceOf<HtmlOutput.Refused>()
                    .refusal.reason shouldBe
                    RefusalReason.UNRENDERABLE_TEXT
            }
            writer.write(WriterSamples.wristband(), "2026\n").shouldBeInstanceOf<HtmlOutput.Refused>()
        }

        test("UnitTest:barcode-round-trip (HTML): the SVG's rectangles rebuild the encoder's matrix, which decodes to the payload") {
            val text = html(WriterSamples.wristband())
            val svg = text.lines().single { it.startsWith("<svg") }
            svg shouldNotContain "xmlns"
            val viewBox = Regex("""viewBox="0 0 (\d+) (\d+)"""").find(svg)!!.groupValues
            val columns = viewBox[1].toInt()
            val rows = viewBox[2].toInt()
            val dark = Array(rows) { BooleanArray(columns) }
            Regex("""<rect x="(\d+)" y="(\d+)" width="(\d+)" height="1"/>""").findAll(svg).forEach { m ->
                val (x, y, w) = m.groupValues.drop(1).map { it.toInt() }
                for (c in x until x + w) dark[y][c] = true
            }
            val matrix = BarcodeEncoder.dataMatrix(WriterSamples.WRISTBAND_PAYLOAD).shouldBeInstanceOf<BarcodeEncoding.Encoded>().matrix
            columns shouldBe matrix.columns
            for (r in 0 until rows) for (c in 0 until columns) dark[r][c] shouldBe matrix.isDark(c, r)
            svg shouldContain "width: ${HtmlText.mm(columns * 0.5)}mm; height: ${HtmlText.mm(rows * 0.5)}mm;"
            val scale = 4
            val quiet = 2
            val side = (columns + 2 * quiet) * scale
            val pixels =
                IntArray(side * side) { i ->
                    val c =
                        (i % side) / scale - quiet
                    val r =
                        (i / side) / scale - quiet
                    if (r in 0 until rows && c in 0 until columns && dark[r][c]) 0xFF000000.toInt() else -1
                }
            val bitmap = BinaryBitmap(HybridBinarizer(RGBLuminanceSource(side, side, pixels)))
            DataMatrixReader().decode(bitmap, mapOf(DecodeHintType.PURE_BARCODE to true)).text shouldBe WriterSamples.WRISTBAND_PAYLOAD
        }

        test("Code 128 SVG: one module per unit, bars the barcode's height") {
            val svg = html(WriterSamples.specimenCode128()).lines().single { it.startsWith("<svg") }
            val matrix = BarcodeEncoder.code128(WriterSamples.SPECIMEN_ID).shouldBeInstanceOf<BarcodeEncoding.Encoded>().matrix
            svg shouldContain "viewBox=\"0 0 ${matrix.columns} 1\""
            svg shouldContain "left: 3mm; top: 12mm; width: ${HtmlText.mm(matrix.columns * 0.25)}mm; height: 7mm;"
        }

        test("a DataMatrix larger than its box is refused") {
            val layout = WriterSamples.wristband().let { w -> w.copy(barcodes = listOf(w.barcodes.single().copy(maxSizeMm = 5.0))) }
            writer
                .write(layout, WriterSamples.CREATED_AT)
                .shouldBeInstanceOf<HtmlOutput.Refused>()
                .refusal.reason shouldBe
                RefusalReason.TEMPLATE_INVALID
        }

        val fixtures = ByteFixtures()
        test("ByteFixture:html-wristband") {
            fixtures.assertMatches(
                "html-wristband.html",
                html(WriterSamples.wristband()).toByteArray(),
                WriterSamples.provenance(WriterSamples.wristband()),
            )
        }
        test("ByteFixture:html-specimen-code128") {
            val layout = WriterSamples.specimenCode128()
            fixtures.assertMatches("html-specimen-code128.html", html(layout).toByteArray(), WriterSamples.provenance(layout))
        }
        test("ByteFixture:html-receipt") {
            val layout = WriterSamples.receipt()
            fixtures.assertMatches("html-receipt.html", html(layout).toByteArray(), WriterSamples.provenance(layout))
        }
    })
