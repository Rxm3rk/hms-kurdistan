package hms.platform.docs.infrastructure.zpl

import hms.platform.docs.api.RefusalReason
import hms.platform.docs.domain.layout.PlacedBarcode
import hms.platform.docs.domain.template.Align
import hms.platform.docs.domain.template.Symbology
import hms.platform.docs.golden.ByteFixtures
import hms.platform.docs.infrastructure.barcode.BarcodeEncoder
import hms.platform.docs.infrastructure.barcode.BarcodeEncoding
import hms.platform.docs.infrastructure.writers.WriterSamples
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldEndWith
import io.kotest.matchers.string.shouldNotContain
import io.kotest.matchers.string.shouldStartWith
import io.kotest.matchers.types.shouldBeInstanceOf

/** ZPL text mode, byte level (docs/specs/modules/platform-docs.md §7.1; `ByteFixture:zpl-text-*`, `ByteFixture:zpl-reprint-*`). */
class ZplTextWriterTest :
    FunSpec({
        val writer = ZplTextWriter()

        fun zpl(
            layout: hms.platform.docs.domain.layout.Layout,
            dotsPerMm: Double = 8.0,
            reprint: Boolean = false,
        ): String = String(writer.write(layout, dotsPerMm, reprint).shouldBeInstanceOf<ZplOutput.Written>().bytes, Charsets.UTF_8)

        fun refusal(
            layout: hms.platform.docs.domain.layout.Layout,
            dotsPerMm: Double = 8.0,
        ) = writer.write(layout, dotsPerMm, reprint = false).shouldBeInstanceOf<ZplOutput.Refused>().refusal

        fun dataMatrixColumns(payload: String) =
            BarcodeEncoder
                .dataMatrix(payload)
                .shouldBeInstanceOf<BarcodeEncoding.Encoded>()
                .matrix.columns

        test("canonical form: header, one field per line, ^PQ1 and ^XZ, LF line ends, no ~JA on a first print") {
            val text = zpl(WriterSamples.wristband())
            text shouldStartWith "^XA\n^CI28\n^PW200\n^LL640\n^LH0,0\n^PA1,1,1,1\n^FT"
            text shouldEndWith "^PQ1\n^XZ\n"
            text shouldNotContain "~"
            text shouldNotContain "\r"
            text.lines().count { it == "^PQ1" } shouldBe 1
        }

        test("rotation 90: ^FT and ^FO transformed to x = ^PW - dots(v), y = dots(u), orientation R") {
            val lines = zpl(WriterSamples.wristband()).lines()
            lines shouldContain "^FT152,16^A@R,28,28,E:NSARABB.TTF^FB400,1,0,R,0^FH\\^FDئارام ڕێبوار^FS"
            lines shouldContain "^FT100,16^A@R,25,25,E:NSLATNB.TTF^FB400,1,0,L,0^FH\\^FDAram Rebwar^FS"
            lines shouldContain "^FO86,16^GB2,400,2^FS"
            val side = dataMatrixColumns(WriterSamples.WRISTBAND_PAYLOAD) * 4
            lines shouldContain
                "^FO${200 - (12 + side)},464^BXR,4,200,${side / 4},${side / 4},,_^FH\\^FD${WriterSamples.WRISTBAND_PAYLOAD}^FS"
        }

        test("rotation 0: coordinates are dots(u), dots(v), orientation N; Code 128 as ^BY/^BC with no interpretation line") {
            val lines = zpl(WriterSamples.specimenCode128()).lines()
            lines[2] shouldBe "^PW400"
            lines[3] shouldBe "^LL200"
            lines shouldContain "^FT16,40^A@N,25,25,E:NSARABB.TTF^FB368,1,0,R,0^FH\\^FDئارام ڕێبوار^FS"
            lines shouldContain "^FT256,76^A@N,20,20,E:NSLATN.TTF^FB128,1,0,R,0^FH\\^FDSYN-000123-7^FS"
            lines shouldContain "^FO24,96^BY2^BCN,56,N,N,N,N^FH\\^FDSYN-S-000077^FS"
        }

        test("12 dots/mm: media and sizes scale, rounded half up once per coordinate") {
            val lines = zpl(WriterSamples.wristband(), dotsPerMm = 12.0).lines()
            lines[2] shouldBe "^PW300"
            lines[3] shouldBe "^LL960"
            lines shouldContain "^FT228,24^A@R,42,42,E:NSARABB.TTF^FB600,1,0,R,0^FH\\^FDئارام ڕێبوار^FS"
        }

        test("justification: start is R for right-to-left and L for left-to-right, end the opposite, centre C") {
            val base = WriterSamples.wristband().lines.first()
            ZplTextWriter.justification(base.copy(rightToLeft = true, align = Align.START)) shouldBe 'R'
            ZplTextWriter.justification(base.copy(rightToLeft = false, align = Align.START)) shouldBe 'L'
            ZplTextWriter.justification(base.copy(rightToLeft = true, align = Align.END)) shouldBe 'L'
            ZplTextWriter.justification(base.copy(rightToLeft = false, align = Align.END)) shouldBe 'R'
            ZplTextWriter.justification(base.copy(rightToLeft = true, align = Align.CENTER)) shouldBe 'C'
            ZplTextWriter.justification(base.copy(rightToLeft = false, align = Align.CENTER)) shouldBe 'C'
        }

        test("a reprint starts with ~JA before ^XA, and only a reprint does") {
            val text = zpl(WriterSamples.wristband(), reprint = true)
            text shouldStartWith "~JA\n^XA\n^CI28\n"
            text.count { it == '~' } shouldBe 1
            text shouldBe "~JA\n" + zpl(WriterSamples.wristband())
        }

        test("field data is escaped: ^ and ~ in a line become \\5E and \\7E") {
            val layout = WriterSamples.wristband().let { it.copy(lines = listOf(it.lines[1].copy(text = "A^B~C"))) }
            zpl(layout).lines() shouldContain "^FT100,16^A@R,25,25,E:NSLATNB.TTF^FB400,1,0,L,0^FH\\^FDA\\5EB\\7EC^FS"
        }

        test("refusals: backslash, control character, more than one font, rotation, resolution") {
            val w = WriterSamples.wristband()
            val first = w.lines[1]
            refusal(w.copy(lines = listOf(first.copy(text = "A\\&B")))).reason shouldBe RefusalReason.UNRENDERABLE_TEXT
            refusal(w.copy(lines = listOf(first.copy(text = "A\u0007B")))).reason shouldBe RefusalReason.UNRENDERABLE_TEXT
            refusal(w.copy(lines = listOf(first.copy(fonts = listOf(WriterSamples.LATIN_BOLD, WriterSamples.ARABIC_BOLD))))).reason shouldBe
                RefusalReason.PRINTER_UNSUPPORTED
            refusal(w.copy(lines = listOf(first.copy(fonts = emptyList())))).reason shouldBe RefusalReason.PRINTER_UNSUPPORTED
            refusal(w.copy(rotation = 180)).reason shouldBe RefusalReason.TEMPLATE_INVALID
            refusal(w, dotsPerMm = 0.0).reason shouldBe RefusalReason.PRINTER_UNSUPPORTED
            refusal(w, dotsPerMm = Double.NaN).reason shouldBe RefusalReason.PRINTER_UNSUPPORTED
        }

        test("barcode refusals: ^BX escape character, ^BC invocation character, non-ASCII, symbol larger than its box") {
            val w = WriterSamples.wristband()

            fun with(barcode: PlacedBarcode) = w.copy(barcodes = listOf(barcode))
            val dm = w.barcodes.single()
            refusal(with(dm.copy(payload = "HMS1|M:SYN_1"))).reason shouldBe RefusalReason.IDENTIFIER_INVALID
            refusal(with(dm.copy(payload = "HMS1|M:SYN-١"))).reason shouldBe RefusalReason.IDENTIFIER_INVALID
            refusal(with(dm.copy(maxSizeMm = 4.0))).reason shouldBe RefusalReason.TEMPLATE_INVALID
            refusal(with(dm.copy(moduleMm = 0.05))).reason shouldBe RefusalReason.TEMPLATE_INVALID
            refusal(with(PlacedBarcode(Symbology.CODE128, "SYN>9", 3.0, 12.0, 0.25, 7.0))).reason shouldBe RefusalReason.IDENTIFIER_INVALID
        }

        test("the ^BX field data, ^FH-decoded, equals the payload exactly") {
            val field = zpl(WriterSamples.wristband()).lines().single { "^BX" in it }
            ZplFieldDecoding.decode(field.substringAfter("^FD").substringBefore("^FS")) shouldBe WriterSamples.WRISTBAND_PAYLOAD
        }

        val fixtures = ByteFixtures()
        mapOf(
            "zpl-text-wristband-203.zpl" to { zpl(WriterSamples.wristband(), 8.0) },
            "zpl-text-wristband-300.zpl" to { zpl(WriterSamples.wristband(), 12.0) },
            "zpl-text-specimen-code128-203.zpl" to { zpl(WriterSamples.specimenCode128(), 8.0) },
            "zpl-reprint-wristband-203.zpl" to { zpl(WriterSamples.wristband(), 8.0, reprint = true) },
        ).forEach { (name, output) ->
            test("ByteFixture:${name.removeSuffix(".zpl")}") {
                val layout = if ("specimen" in name) WriterSamples.specimenCode128() else WriterSamples.wristband()
                fixtures.assertMatches(name, output().toByteArray(Charsets.UTF_8), WriterSamples.provenance(layout))
            }
        }
    })

/** Decodes `^FH\` field data for the tests: `\hh` is the byte 0xhh; the result is read as UTF-8. */
object ZplFieldDecoding {
    fun decode(data: String): String {
        val bytes = java.io.ByteArrayOutputStream()
        var i = 0
        while (i < data.length) {
            val escape = data[i] == '\\'
            val next = data.indexOf('\\', i)
            val end = if (escape) i + 3 else if (next < 0) data.length else next
            val piece = data.substring(i, end)
            bytes.write(if (escape) byteArrayOf(piece.drop(1).toInt(16).toByte()) else piece.toByteArray(Charsets.UTF_8))
            i = end
        }
        return String(bytes.toByteArray(), Charsets.UTF_8)
    }
}
