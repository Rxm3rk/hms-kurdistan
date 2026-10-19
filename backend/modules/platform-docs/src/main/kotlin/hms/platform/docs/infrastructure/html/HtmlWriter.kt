package hms.platform.docs.infrastructure.html

import hms.platform.docs.api.Refusal
import hms.platform.docs.api.RefusalReason
import hms.platform.docs.domain.layout.Layout
import hms.platform.docs.domain.layout.PlacedBarcode
import hms.platform.docs.domain.layout.PlacedLine
import hms.platform.docs.domain.layout.PlacedRule
import hms.platform.docs.domain.template.Align
import hms.platform.docs.domain.template.Symbology
import hms.platform.docs.infrastructure.barcode.BarcodeEncoder
import hms.platform.docs.infrastructure.barcode.BarcodeEncoding
import hms.platform.docs.infrastructure.barcode.ModuleMatrix
import hms.platform.docs.infrastructure.fonts.PrintFont

/**
 * HTML for labels, wristbands, receipts and tokens (docs/specs/modules/platform-docs.md §7.4): the input
 * of the renderer satellite's PDF and of the `ByteFixture:html-*` fixtures. One page of the reading
 * frame's size (a receipt's laid-out length); every placed line an absolutely positioned element with its
 * font chain, size, line height, direction, `white-space: pre` and `unicode-bidi: isolate`; barcodes as
 * inline SVG from ZXing's matrix; rules as black boxes.
 *
 * - **Deterministic bytes:** fixed element and attribute order, LF line endings, numbers in one decimal
 *   form ([HtmlText.decimal]), no timestamps except the injected creation time.
 * - **Physical geometry on purpose:** this is print output with absolute geometry from the layout, so
 *   `left`, `top` and `width` are physical millimetres in the reading frame; the frontend's CSS lint
 *   (logical properties) does not apply to backend print output. Alignment inside a line's box is logical
 *   (`text-align: start | end | center` with the line's `direction`), as in the layout.
 * - **Lines are already broken** by the fit rule (spec §5.3); `white-space: pre` stops the renderer from
 *   breaking or collapsing them, and `line-height` is the layout's line height, so the CSS line box is
 *   the layout's line box.
 * - **Fonts** only by the `hms-font:` scheme, each print font its own family (so no weight is
 *   synthesised), the line's font chain in order. No URL, script or external style sheet (`HtmlLint`).
 * - Barcode SVGs carry no `xmlns` attribute: the HTML parser puts `<svg>` in the SVG namespace itself,
 *   and the namespace URI would be an `http:` string.
 */
class HtmlWriter {
    /** Writes [layout] with [createdAt] (ISO 8601 with offset, from the request) as its creation time. */
    fun write(
        layout: Layout,
        createdAt: String,
    ): HtmlOutput {
        val meta =
            HtmlMetadata(
                templateId = layout.templateId,
                templateVersion = layout.templateVersion,
                templateHash = layout.templateHash,
                synthetic = layout.synthetic,
                language = layout.language,
                title = layout.templateId,
                createdAt = createdAt,
            )
        val head = HtmlText.head(meta)
        val elements = LayoutHtml.elements(layout)
        return when {
            head == null -> HtmlOutput.Refused(HtmlText.unwritable("metadata"))
            elements is LayoutHtml.ElementsOrRefusal.Refused -> HtmlOutput.Refused(elements.refusal)
            else -> HtmlOutput.Written(page(layout, head, (elements as LayoutHtml.ElementsOrRefusal.Elements).html))
        }
    }

    private fun page(
        layout: Layout,
        head: String,
        body: String,
    ): String {
        val width = HtmlText.mm(layout.frameWidthMm)
        val height = HtmlText.mm(layout.frameHeightMm)
        return buildString {
                append("<!DOCTYPE html>\n")
                append("<html lang=\"${layout.language.tag}\">\n")
                append("<head>\n")
                append("<meta charset=\"utf-8\">\n")
                append(head)
                append("<style>\n")
                append("@page { size: ${width}mm ${height}mm; margin: 0; }\n")
                append(HtmlText.fontFaces())
                append("html, body { margin: 0; padding: 0; }\n")
                append(".page { position: relative; width: ${width}mm; height: ${height}mm; }\n")
                append(LayoutHtml.STYLE)
                append("</style>\n")
                append("</head>\n")
                append("<body>\n")
                append("<div class=\"page\">\n")
                append(body)
                append("</div>\n")
                append("</body>\n")
            append("</html>\n")
        }
    }
}

/**
 * The elements of a layout as positioned HTML: shared by [HtmlWriter] and, for the print banner, by
 * [DocumentHtmlWriter]. The container must be `position: relative` at the layout frame's origin.
 */
internal object LayoutHtml {
    /** The style rules the elements rely on. */
    const val STYLE: String =
        ".line { position: absolute; margin: 0; padding: 0; white-space: pre; unicode-bidi: isolate; }\n" +
            ".rule { position: absolute; background: #000000; }\n" +
            ".barcode { position: absolute; }\n"

    /** Every line, barcode and rule of [layout], in that order, one element per line of HTML. */
    fun elements(layout: Layout): ElementsOrRefusal {
        val elements =
            layout.lines.mapIndexed { index, line ->
                line(line)?.let { ElementOrRefusal.Element(it) } ?: ElementOrRefusal.Refused(HtmlText.unwritable("line $index"))
            } +
                layout.barcodes.map { barcode(it) } +
                layout.rules.map { ElementOrRefusal.Element(rule(it)) }
        val refusal = elements.firstNotNullOfOrNull { (it as? ElementOrRefusal.Refused)?.refusal }
        return if (refusal != null) {
            ElementsOrRefusal.Refused(refusal)
        } else {
            ElementsOrRefusal.Elements(elements.joinToString(separator = "") { (it as ElementOrRefusal.Element).html })
        }
    }

    /** One placed line, or null when its text cannot be written or it has no font. */
    fun line(line: PlacedLine): String? {
        val text = HtmlText.escape(line.text)
        if (text == null || line.fonts.isEmpty()) return null
        val families = line.fonts.joinToString(separator = ", ") { "'${PrintFont.of(it).hmsFontName}'" }
        val direction = if (line.rightToLeft) "rtl" else "ltr"
        val align =
            when (line.align) {
                Align.START -> "start"
                Align.END -> "end"
                Align.CENTER -> "center"
            }
        return "<div class=\"line\" style=\"left: ${HtmlText.mm(line.boxXMm)}mm; top: ${HtmlText.mm(line.topMm)}mm; " +
            "width: ${HtmlText.mm(line.boxWidthMm)}mm; font-family: $families; font-size: ${HtmlText.decimal(line.sizePt)}pt; " +
            "line-height: ${HtmlText.pt(line.lineHeightMm)}pt; direction: $direction; text-align: $align;\">$text</div>\n"
    }

    /** A filled rectangle. */
    fun rule(rule: PlacedRule): String =
        "<div class=\"rule\" style=\"left: ${HtmlText.mm(rule.xMm)}mm; top: ${HtmlText.mm(rule.yMm)}mm; " +
            "width: ${HtmlText.mm(rule.wMm)}mm; height: ${HtmlText.mm(rule.hMm)}mm;\"></div>\n"

    /**
     * One barcode as an inline SVG at its millimetre position: the view box is the module grid, each dark
     * run of a row one `<rect>`. A DataMatrix module is [PlacedBarcode.moduleMm] square; a Code 128 bar is
     * one module wide and [PlacedBarcode.maxSizeMm] high. A DataMatrix larger than its box is refused.
     */
    fun barcode(barcode: PlacedBarcode): ElementOrRefusal =
        when (val encoded = BarcodeEncoder.encode(barcode.payload, barcode.symbology)) {
            is BarcodeEncoding.Refused -> ElementOrRefusal.Refused(encoded.refusal)
            is BarcodeEncoding.Encoded -> svg(barcode, encoded.matrix)
        }

    private fun svg(
        barcode: PlacedBarcode,
        matrix: ModuleMatrix,
    ): ElementOrRefusal {
        val widthMm = matrix.columns * barcode.moduleMm
        val code128 = barcode.symbology == Symbology.CODE128
        val heightMm = if (code128) barcode.maxSizeMm else matrix.rows * barcode.moduleMm
        return if (!code128 && widthMm > barcode.maxSizeMm) {
            ElementOrRefusal.Refused(
                Refusal(RefusalReason.TEMPLATE_INVALID, subject = "barcode", detail = "DataMatrix larger than its box"),
            )
        } else {
            ElementOrRefusal.Element(
                "<svg class=\"barcode\" style=\"left: ${HtmlText.mm(barcode.xMm)}mm; top: ${HtmlText.mm(barcode.yMm)}mm; " +
                    "width: ${HtmlText.mm(widthMm)}mm; height: ${HtmlText.mm(heightMm)}mm;\" " +
                    "viewBox=\"0 0 ${matrix.columns} ${matrix.rows}\" preserveAspectRatio=\"none\" shape-rendering=\"crispEdges\">" +
                    "<g fill=\"#000000\">${rects(matrix)}</g></svg>\n",
            )
        }
    }

    private fun rects(matrix: ModuleMatrix): String =
        buildString {
            for (row in 0 until matrix.rows) {
                for ((column, length) in matrix.darkRuns(row)) {
                    append("<rect x=\"$column\" y=\"$row\" width=\"$length\" height=\"1\"/>")
                }
            }
        }

    /** One element (a line, a barcode or a rule) as HTML, or why it cannot be written. */
    sealed interface ElementOrRefusal {
        data class Element(
            val html: String,
        ) : ElementOrRefusal

        data class Refused(
            val refusal: Refusal,
        ) : ElementOrRefusal
    }

    sealed interface ElementsOrRefusal {
        data class Elements(
            val html: String,
        ) : ElementsOrRefusal

        data class Refused(
            val refusal: Refusal,
        ) : ElementsOrRefusal
    }
}

/** The output of an HTML writer: UTF-8 HTML for the renderer satellite, or a refusal. */
sealed interface HtmlOutput {
    data class Written(
        val html: String,
    ) : HtmlOutput {
        /** The canonical bytes: UTF-8, no byte-order mark. */
        fun bytes(): ByteArray = html.toByteArray(Charsets.UTF_8)
    }

    data class Refused(
        val refusal: Refusal,
    ) : HtmlOutput
}
