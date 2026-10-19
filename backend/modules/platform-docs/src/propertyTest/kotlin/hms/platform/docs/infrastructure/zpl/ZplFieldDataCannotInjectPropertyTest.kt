package hms.platform.docs.infrastructure.zpl

import hms.kernel.testing.PropertyTestBudget
import hms.platform.docs.api.LabelLanguage
import hms.platform.docs.api.RefusalReason
import hms.platform.docs.domain.layout.FontSpec
import hms.platform.docs.domain.layout.Layout
import hms.platform.docs.domain.layout.PlacedBarcode
import hms.platform.docs.domain.layout.PlacedLine
import hms.platform.docs.domain.layout.PlacedRule
import hms.platform.docs.domain.template.Align
import hms.platform.docs.domain.template.FontRole
import hms.platform.docs.domain.template.FontWeight
import hms.platform.docs.domain.template.Symbology
import hms.platform.docs.domain.template.TemplateKind
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.property.Arb
import io.kotest.property.arbitrary.asString
import io.kotest.property.arbitrary.choice
import io.kotest.property.arbitrary.codepoints
import io.kotest.property.arbitrary.element
import io.kotest.property.arbitrary.list
import io.kotest.property.arbitrary.map
import io.kotest.property.checkAll
import java.io.ByteArrayOutputStream

/**
 * `PropertyTest:zpl-field-data-cannot-inject` (docs/specs/modules/platform-docs.md §7.1, HAZ-0046): for
 * random text, with `^`, `~`, `\` and arbitrary Unicode (unpaired surrogates and controls included), the
 * ZPL text writer either refuses (only for text that holds a backslash, a control character, a line or
 * paragraph separator or an unpaired surrogate) or writes field data with no unescaped `^` or `~` between
 * `^FD` and `^FS`, as many `^FS` as fields, no `~` anywhere on a first print, and field data that
 * decodes back to exactly the line's text.
 */
class ZplFieldDataCannotInjectPropertyTest :
    FunSpec({
        val pieces =
            Arb.choice(
                Arb.element(listOf("^", "~", "\\", "^FS", "^XZ", "~JA", "\\5E", "_", "|", " ", "a", "ی", "ڕ", "ە", "‌", "\n", "\uD800")),
                Arb.codepoints().map { it.asString() },
            )
        val texts = Arb.list(pieces, 0..PIECES).map { it.joinToString("") }
        val lineSets = Arb.list(texts, 1..LINES)

        test("PropertyTest:zpl-field-data-cannot-inject") {
            checkAll(PropertyTestBudget.sequences(), lineSets) { lineTexts ->
                val layout = layoutOf(lineTexts)
                when (val out = ZplTextWriter().write(layout, DOTS_PER_MM, reprint = false)) {
                    is ZplOutput.Refused -> {
                        out.refusal.reason shouldBe RefusalReason.UNRENDERABLE_TEXT
                        lineTexts.any { mustRefuse(it) } shouldBe true
                    }

                    is ZplOutput.Written -> {
                        lineTexts.none { mustRefuse(it) } shouldBe true
                        val zpl = String(out.bytes, Charsets.UTF_8)
                        (zpl.indexOf('~') < 0) shouldBe true
                        countOf(zpl, "^FS") shouldBe lineTexts.size + 2
                        countOf(zpl, "^FD") shouldBe lineTexts.size + 1
                        val fieldData = fieldDataOf(zpl)
                        fieldData.forEach { data -> (data.indexOf('^') < 0 && data.indexOf('~') < 0) shouldBe true }
                        fieldData.take(lineTexts.size).map(::decodeFh) shouldBe lineTexts
                        decodeFh(fieldData.last()) shouldBe PAYLOAD
                    }
                }
            }
        }
    }) {
    private companion object {
        const val PIECES = 12
        const val LINES = 4
        const val DOTS_PER_MM = 8.0
        const val HEX = 16
        const val ESCAPE_LENGTH = 3
        const val LINE_PITCH_MM = 4.0
        const val BASELINE_MM = 3.0
        const val HASH_LENGTH = 64
        const val PAYLOAD = "HMS1|M:SYN-000123-7|E:SYN-E-000045|B:SYN-J0001"
        const val LINE_SEPARATOR = 0x2028
        const val PARAGRAPH_SEPARATOR = 0x2029
        val FONT = FontSpec(FontRole.LATIN, FontWeight.REGULAR)

        fun layoutOf(texts: List<String>): Layout =
            Layout(
                templateId = "SYN-PROPERTY",
                templateVersion = 1,
                templateHash = "0".repeat(HASH_LENGTH),
                kind = TemplateKind.WRISTBAND,
                language = LabelLanguage.EN,
                synthetic = true,
                frameWidthMm = 80.0,
                frameHeightMm = 25.0,
                rotation = 90,
                lines =
                    texts.mapIndexed { i, text ->
                        PlacedLine(
                            text = text,
                            fonts = listOf(FONT),
                            sizePt = 8.0,
                            rightToLeft = false,
                            align = Align.START,
                            boxXMm = 2.0,
                            boxWidthMm = 50.0,
                            topMm = LINE_PITCH_MM * i,
                            baselineMm = LINE_PITCH_MM * i + BASELINE_MM,
                            lineHeightMm = 3.8,
                            measuredWidthMm = 20.0,
                        )
                    },
                barcodes =
                    listOf(
                        PlacedBarcode(
                            symbology = Symbology.DATAMATRIX,
                            payload = PAYLOAD,
                            xMm = 58.0,
                            yMm = 1.5,
                            moduleMm = 0.5,
                            maxSizeMm = 18.0,
                        ),
                    ),
                rules = listOf(PlacedRule(xMm = 2.0, yMm = 20.0, wMm = 50.0, hMm = 0.3)),
            )

        /** The text holds something the writer must refuse rather than write. */
        fun mustRefuse(text: String): Boolean =
            text.indices.any { i ->
                val c = text[i]
                val pairedHigh = c.isHighSurrogate() && i + 1 < text.length && text[i + 1].isLowSurrogate()
                val pairedLow = c.isLowSurrogate() && i > 0 && text[i - 1].isHighSurrogate()
                c == '\\' ||
                    Character.getType(c) == Character.CONTROL.toInt() ||
                    c.code == LINE_SEPARATOR ||
                    c.code == PARAGRAPH_SEPARATOR ||
                    (c.isSurrogate() && !pairedHigh && !pairedLow)
            }

        fun countOf(
            text: String,
            token: String,
        ): Int = text.windowed(token.length).count { it == token }

        /** Everything between each `^FD` and the next `^FS`. */
        fun fieldDataOf(zpl: String): List<String> {
            val out = mutableListOf<String>()
            var at = zpl.indexOf("^FD")
            while (at >= 0) {
                val end = zpl.indexOf("^FS", at)
                out += zpl.substring(at + "^FD".length, end)
                at = zpl.indexOf("^FD", end)
            }
            return out
        }

        /** `^FH\` decoding: `\hh` is the byte 0xhh; the bytes are UTF-8. */
        fun decodeFh(data: String): String {
            val bytes = ByteArrayOutputStream()
            var i = 0
            while (i < data.length) {
                if (data[i] == '\\') {
                    bytes.write(data.substring(i + 1, i + ESCAPE_LENGTH).toInt(HEX))
                    i += ESCAPE_LENGTH
                } else {
                    val cp = data.codePointAt(i)
                    bytes.write(String(Character.toChars(cp)).toByteArray(Charsets.UTF_8))
                    i += Character.charCount(cp)
                }
            }
            return String(bytes.toByteArray(), Charsets.UTF_8)
        }
    }
}
