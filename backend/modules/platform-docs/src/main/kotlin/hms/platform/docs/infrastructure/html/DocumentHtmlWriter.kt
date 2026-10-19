package hms.platform.docs.infrastructure.html

import hms.platform.docs.api.DocumentBlock
import hms.platform.docs.api.LabelledText
import hms.platform.docs.api.Refusal
import hms.platform.docs.api.RefusalReason
import hms.platform.docs.domain.layout.Layout
import hms.platform.docs.infrastructure.fonts.PrintFont

/**
 * HTML with CSS paged media for A4 and A5 documents (docs/specs/modules/platform-docs.md §7.4); the
 * renderer satellite paginates it into PDF/A-2b (§7.5).
 *
 * ```text
 * @page { size; margin: <banner height> <side> <bottom> <side>;
 *         @top-center { content: element(banner) }  @bottom-center { content: element(watermark) } }
 * <body>
 *   <div class="reprint">REPRINT</div>      reprints only: fixed, diagonal, solid #d0d0d0, beneath the content
 *   <div class="banner">…</div>             position: running(banner): the print banner on every page
 *   <div class="watermark">…</div>          position: running(watermark): the watermark line on every page
 *   <h1>title</h1> <section><h2>heading</h2><p>paragraph</p>…</section>…
 * ```
 *
 * - **The banner** arrives laid out (a banner [Layout] at the page's content width, from the fit rule, so
 *   long allergy lists and three long name forms wrap instead of being clipped) together with its measured
 *   height, which becomes `@page { margin-top }`. Each banner line is its own absolutely positioned block
 *   with `white-space: pre` and the layout's line height, so the renderer cannot re-break it. A banner
 *   taller than half the page (`print.refused.bannerTooTall`), a line below the measured height
 *   (`print.refused.identityDoesNotFit`), or a banner wider than the content area
 *   (`print.refused.templateInvalid`) is refused, never clipped.
 * - **The reprint mark** is solid light grey (#d0d0d0) without transparency (PDF/A-2 stays simple), fixed so
 *   it repeats on every page, and painted beneath the body (`z-index: -1`).
 * - **Body text** is the content's `text` (redaction is applied upstream, spec §8.4). Each title, heading
 *   and paragraph gets the direction of its first strong character (spec §4.1 `auto`), written as an
 *   explicit `dir`, and the font chain that puts the matching script's font first.
 * - Deterministic bytes, `hms-font:` fonts only, no URL or script (see [HtmlWriter]).
 */
class DocumentHtmlWriter {
    /** Writes [input]. */
    fun write(input: DocumentHtmlInput): HtmlOutput {
        val geometry = checkGeometry(input)
        val head = HtmlText.head(input.meta.copy(barcodes = input.banner.barcodes.map { HtmlBarcode(it.symbology, it.payload) }))
        val banner = LayoutHtml.elements(input.banner)
        val watermark = HtmlText.escape(input.watermark)
        val reprintMark = HtmlText.escape(input.reprintText)
        val content = body(input)
        return when {
            geometry != null -> {
                HtmlOutput.Refused(geometry)
            }

            head == null -> {
                HtmlOutput.Refused(HtmlText.unwritable("metadata"))
            }

            banner is LayoutHtml.ElementsOrRefusal.Refused -> {
                HtmlOutput.Refused(banner.refusal)
            }

            watermark == null -> {
                HtmlOutput.Refused(HtmlText.unwritable("watermark"))
            }

            reprintMark == null -> {
                HtmlOutput.Refused(HtmlText.unwritable("reprint"))
            }

            content == null -> {
                HtmlOutput.Refused(HtmlText.unwritable("document.body"))
            }

            else -> {
                val parts = Parts(head, (banner as LayoutHtml.ElementsOrRefusal.Elements).html, watermark, reprintMark, content)
                HtmlOutput.Written(html(input, parts))
            }
        }
    }

    /** The escaped and generated pieces of one document. */
    private data class Parts(
        val head: String,
        val bannerElements: String,
        val watermark: String,
        val reprintMark: String,
        val content: String,
    )

    private fun html(
        input: DocumentHtmlInput,
        parts: Parts,
    ): String {
        val page = input.page
        return buildString {
            append("<!DOCTYPE html>\n")
            append("<html lang=\"${input.meta.language.tag}\" dir=\"${if (input.meta.language.rightToLeft) "rtl" else "ltr"}\">\n")
            append("<head>\n")
            append("<meta charset=\"utf-8\">\n")
            append(parts.head)
            append("<style>\n")
            append(pageStyle(input))
            append(HtmlText.fontFaces())
            append("html, body { margin: 0; padding: 0; }\n")
            append("body { font-size: ${HtmlText.decimal(BODY_SIZE_PT)}pt; }\n")
            append("h1, h2 { font-weight: normal; margin: 0 0 3mm 0; }\n")
            append("h1 { font-size: ${HtmlText.decimal(TITLE_SIZE_PT)}pt; }\n")
            append("h2 { font-size: ${HtmlText.decimal(HEADING_SIZE_PT)}pt; }\n")
            append("p { margin: 0 0 2mm 0; }\n")
            append(".banner { position: running(banner); width: ${HtmlText.mm(page.contentWidthMm)}mm; ")
            append("height: ${HtmlText.mm(input.bannerHeightMm)}mm; }\n")
            append(".banner-frame { position: relative; width: 100%; height: 100%; }\n")
            append(LayoutHtml.STYLE)
            append(".watermark { position: running(watermark); font-family: ${chain(rightToLeft = false, bold = false)}; ")
            append("font-size: ${HtmlText.decimal(WATERMARK_SIZE_PT)}pt; white-space: pre; unicode-bidi: isolate; }\n")
            append(".reprint { position: fixed; top: 40%; left: 0; width: 100%; text-align: center; z-index: -1; ")
            append("font-family: ${chain(rightToLeft = false, bold = true)}; font-size: ${HtmlText.decimal(REPRINT_SIZE_PT)}pt; ")
            append("color: #d0d0d0; transform: rotate(-45deg); }\n")
            append("</style>\n")
            append("</head>\n")
            append("<body>\n")
            if (input.reprint) append("<div class=\"reprint\" aria-hidden=\"true\">${parts.reprintMark}</div>\n")
            append("<div class=\"banner\">\n<div class=\"banner-frame\">\n")
            append(parts.bannerElements)
            append("</div>\n</div>\n")
            append("<div class=\"watermark\" dir=\"${dir(input.watermark)}\">${parts.watermark}</div>\n")
            append(parts.content)
            append("</body>\n")
            append("</html>\n")
        }
    }

    private fun checkGeometry(input: DocumentHtmlInput): Refusal? {
        val page = input.page
        val bannerBottom = input.banner.lines.maxOfOrNull { it.topMm + it.lineHeightMm } ?: 0.0
        return when {
            page.contentWidthMm <= 0.0 || page.bottomMarginMm <= 0.0 -> {
                Refusal(RefusalReason.TEMPLATE_INVALID, "document.page", "no content area")
            }

            input.bannerHeightMm <= 0.0 || input.banner.lines.isEmpty() -> {
                Refusal(RefusalReason.TEMPLATE_INVALID, "document.banner", "empty banner")
            }

            input.bannerHeightMm > page.heightMm / 2 -> {
                Refusal(RefusalReason.BANNER_TOO_TALL, "document.banner", "banner taller than half the page")
            }

            bannerBottom > input.bannerHeightMm + TOLERANCE_MM -> {
                Refusal(RefusalReason.IDENTITY_DOES_NOT_FIT, "document.banner", "banner line below the measured banner height")
            }

            input.banner.frameWidthMm > page.contentWidthMm + TOLERANCE_MM -> {
                Refusal(RefusalReason.TEMPLATE_INVALID, "document.banner", "banner wider than the content area")
            }

            else -> {
                null
            }
        }
    }

    private fun pageStyle(input: DocumentHtmlInput): String {
        val page = input.page
        return "@page {\n" +
            "  size: ${HtmlText.mm(page.widthMm)}mm ${HtmlText.mm(page.heightMm)}mm;\n" +
            "  margin: ${HtmlText.mm(input.bannerHeightMm)}mm ${HtmlText.mm(page.sideMarginMm)}mm " +
            "${HtmlText.mm(page.bottomMarginMm)}mm ${HtmlText.mm(page.sideMarginMm)}mm;\n" +
            "  @top-center { content: element(banner); width: 100%; vertical-align: top; }\n" +
            "  @bottom-center { content: element(watermark); width: 100%; vertical-align: middle; }\n" +
            "}\n"
    }

    /** The title and blocks, or null when any text cannot be written. */
    private fun body(input: DocumentHtmlInput): String? {
        val title = textElement("h1", input.title, bold = true)
        val blocks = input.blocks.map(::block)
        return if (title == null || blocks.any { it == null }) null else title + blocks.joinToString(separator = "")
    }

    /** One block as a `<section>`, or null when any of its text cannot be written. */
    private fun block(block: DocumentBlock): String? {
        val elements =
            listOfNotNull(block.heading).map { textElement("h2", it, bold = true) } +
                block.paragraphs.map { textElement("p", it, bold = false) }
        return if (elements.any { it == null }) {
            null
        } else {
            elements.joinToString(separator = "", prefix = "<section>\n", postfix = "</section>\n")
        }
    }

    private fun textElement(
        tag: String,
        text: LabelledText,
        bold: Boolean,
    ): String? {
        val direction = dir(text.text)
        return HtmlText.escape(text.text)?.let { escaped ->
            "<$tag dir=\"$direction\" style=\"font-family: ${chain(direction == "rtl", bold)};\">$escaped</$tag>\n"
        }
    }

    /** The font chain: the Arabic-script font first for right-to-left text, the Latin font first otherwise. */
    private fun chain(
        rightToLeft: Boolean,
        bold: Boolean,
    ): String {
        val arabic = if (bold) PrintFont.ARABIC_BOLD else PrintFont.ARABIC_REGULAR
        val latin = if (bold) PrintFont.LATIN_BOLD else PrintFont.LATIN_REGULAR
        val ordered = if (rightToLeft) listOf(arabic, latin) else listOf(latin, arabic)
        return ordered.joinToString(", ") { "'${it.hmsFontName}'" }
    }

    /** The direction of [text]'s first strong character (the Unicode bidi algorithm's rules P2 and P3); `ltr` when none. */
    private fun dir(text: String): String {
        val strong =
            text
                .codePoints()
                .map { Character.getDirectionality(it).toInt() }
                .filter { it in STRONG }
                .findFirst()
        return if (strong.isPresent && strong.asInt != Character.DIRECTIONALITY_LEFT_TO_RIGHT.toInt()) "rtl" else "ltr"
    }

    private companion object {
        /** The strong bidi classes L, R and AL. */
        val STRONG: Set<Int> =
            setOf(
                Character.DIRECTIONALITY_LEFT_TO_RIGHT.toInt(),
                Character.DIRECTIONALITY_RIGHT_TO_LEFT.toInt(),
                Character.DIRECTIONALITY_RIGHT_TO_LEFT_ARABIC.toInt(),
            )

        const val TOLERANCE_MM = 0.001
        const val BODY_SIZE_PT = 11.0
        const val TITLE_SIZE_PT = 16.0
        const val HEADING_SIZE_PT = 13.0
        const val WATERMARK_SIZE_PT = 8.0
        const val REPRINT_SIZE_PT = 96.0
    }
}

/** An A4 or A5 page: its size and the side and bottom margins; the top margin is the banner's height. */
data class DocumentPage(
    val widthMm: Double,
    val heightMm: Double,
    val sideMarginMm: Double,
    val bottomMarginMm: Double,
) {
    val contentWidthMm: Double get() = widthMm - 2 * sideMarginMm

    companion object {
        val A4: DocumentPage = DocumentPage(widthMm = 210.0, heightMm = 297.0, sideMarginMm = 15.0, bottomMarginMm = 15.0)
        val A5: DocumentPage = DocumentPage(widthMm = 148.0, heightMm = 210.0, sideMarginMm = 12.0, bottomMarginMm = 12.0)
    }
}

/**
 * Everything [DocumentHtmlWriter] writes.
 *
 * @property banner the print banner laid out at [DocumentPage.contentWidthMm] (identity lines and the
 *   [BannerText] fields), its frame origin at the top-left of the page's content width
 * @property bannerHeightMm the banner's measured height: the page's top margin
 * @property watermark the full watermark line (spec §8.5), printed at the foot of every page
 * @property reprintText the diagonal mark's text in the print's language ([BannerCaptions.reprint])
 */
data class DocumentHtmlInput(
    val meta: HtmlMetadata,
    val page: DocumentPage,
    val banner: Layout,
    val bannerHeightMm: Double,
    val title: LabelledText,
    val blocks: List<DocumentBlock>,
    val watermark: String,
    val reprint: Boolean,
    val reprintText: String,
)
