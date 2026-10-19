package hms.platform.docs.application

import hms.platform.docs.api.DocumentBlock
import hms.platform.docs.api.LabelLanguage
import hms.platform.docs.api.LabelledText
import hms.platform.docs.api.OutputMode
import hms.platform.docs.api.PrinterProfile
import hms.platform.docs.api.Refusal
import hms.platform.docs.api.RefusalReason
import hms.platform.docs.domain.layout.Layout
import hms.platform.docs.domain.rules.ResolvedContent
import hms.platform.docs.domain.template.Binding
import hms.platform.docs.domain.template.MmBox
import hms.platform.docs.domain.template.Provenance
import hms.platform.docs.domain.template.Template
import hms.platform.docs.domain.template.TemplateKind
import hms.platform.docs.infrastructure.escpos.EscPosOutput
import hms.platform.docs.infrastructure.escpos.EscPosWriter
import hms.platform.docs.infrastructure.fonts.FontRegistry
import hms.platform.docs.infrastructure.fonts.PrintFont
import hms.platform.docs.infrastructure.html.DocumentHtmlInput
import hms.platform.docs.infrastructure.html.DocumentHtmlWriter
import hms.platform.docs.infrastructure.html.DocumentPage
import hms.platform.docs.infrastructure.html.HtmlLint
import hms.platform.docs.infrastructure.html.HtmlLintResult
import hms.platform.docs.infrastructure.html.HtmlMetadata
import hms.platform.docs.infrastructure.html.HtmlOutput
import hms.platform.docs.infrastructure.html.HtmlWriter
import hms.platform.docs.infrastructure.raster.LayoutRasteriser
import hms.platform.docs.infrastructure.text.FontAssignment
import hms.platform.docs.infrastructure.zpl.ZplOutput
import hms.platform.docs.infrastructure.zpl.ZplRasterWriter
import hms.platform.docs.infrastructure.zpl.ZplTextWriter

/** Why a print stops: the refusal, and whether it is a render error after every check passed (state `failed`). */
internal data class Stop(
    val refusal: Refusal,
    val renderError: Boolean = false,
)

/** What a writer step produced. */
internal sealed interface OutputResult {
    class Written(
        val bytes: ByteArray,
        val mediaType: String,
        /** The output mode actually written (a ZPL text profile may get raster output, spec §7.1). */
        val mode: OutputMode,
    ) : OutputResult

    data class Stopped(
        val stop: Stop,
    ) : OutputResult
}

/** The media types of the outputs, for the HAL's print calls (spec §12). */
object PrintMediaTypes {
    const val ZPL: String = "application/vnd.zebra.zpl"
    const val ESCPOS: String = "application/vnd.escpos"
    const val PDF: String = "application/pdf"
}

private fun stopped(
    reason: RefusalReason,
    subject: String,
    detail: String,
): OutputResult = OutputResult.Stopped(Stop(Refusal(reason, subject, detail)))

/**
 * ZPL output (docs/specs/modules/platform-docs.md §7.1, §7.2). Text mode (`^PA`, the printer shapes) only for a
 * profile that asks for it, whose S7-K run passed text mode for its model and firmware (`textModeVerifiedByS7k`),
 * whose provisioning record shows all four pinned print fonts resident with their pinned SHA-256s, and whose layout
 * has every line in a single font; everything else is rasterised by the module (`^GF`), a tightening (DN-074,
 * `UnitTest:identity-text-rasterised-unless-s7k-verified`).
 */
internal class ZplPrint(
    private val fonts: FontRegistry,
    private val rasteriser: LayoutRasteriser,
) {
    /** The mode [layout] is written in for [printer]. */
    fun mode(
        printer: PrinterProfile,
        layout: Layout,
    ): OutputMode {
        val textMode =
            printer.mode == OutputMode.ZPL_TEXT && printer.textModeVerifiedByS7k && provisioned(printer) && singleFont(layout) != null
        return if (textMode) OutputMode.ZPL_TEXT else OutputMode.ZPL_RASTER
    }

    fun write(
        layout: Layout,
        mode: OutputMode,
        dotsPerMm: Double,
        reprint: Boolean,
    ): OutputResult {
        val output =
            if (mode == OutputMode.ZPL_TEXT) {
                ZplTextWriter().write(singleFont(layout) ?: layout, dotsPerMm, reprint)
            } else {
                ZplRasterWriter().write(layout, rasteriser.rasterise(layout, dotsPerMm), dotsPerMm, reprint)
            }
        return when (output) {
            is ZplOutput.Written -> OutputResult.Written(output.bytes, PrintMediaTypes.ZPL, mode)
            is ZplOutput.Refused -> OutputResult.Stopped(Stop(output.refusal))
        }
    }

    /**
     * [layout] with every line's font chain narrowed to the one font its characters actually use, by the shaper's own
     * assignment ([FontAssignment]): a `mixed` line whose characters all come from one font shapes exactly as that
     * font alone. Null when some line needs two fonts (a field takes one `^A@` font, spec §7.1).
     */
    fun singleFont(layout: Layout): Layout? {
        val lines =
            layout.lines.map { line ->
                val chain = line.fonts.map { fonts.font(it) }
                val used =
                    FontAssignment
                        .of(line.text, chain)
                        .segments(0, line.text.length)
                        .map { it.fontIndex }
                        .distinct()
                used.singleOrNull()?.let { line.copy(fonts = listOf(line.fonts[it])) }
            }
        return if (lines.any { it == null }) null else layout.copy(lines = lines.filterNotNull())
    }

    /** The printer's provisioning record holds every pinned print font under its resident name with its pinned hash. */
    private fun provisioned(printer: PrinterProfile): Boolean =
        PrintFont.entries.all { printer.residentFontSha256[it.zplName] == fonts.font(it).sha256 }
}

/**
 * ESC/POS output (docs/specs/modules/platform-docs.md §7.3): the layout is moved onto the printable area (an ESC/POS
 * image starts at the printable area's left edge, 72 mm = 576 dots on 80 mm paper at 8 dots/mm), rasterised by the
 * module and written as `GS v 0` bands; a raster wider than the printer's `escposWidthDots` is refused, never cropped.
 */
internal class EscPosPrint(
    private val rasteriser: LayoutRasteriser,
) {
    fun write(
        layout: Layout,
        template: Template,
        printer: PrinterProfile,
        dotsPerMm: Double,
    ): OutputResult {
        val width = printer.escposWidthDots
        return if (width == null) {
            stopped(RefusalReason.PRINTER_UNSUPPORTED, "printer.escposWidthDots", "ESC/POS printable width unknown")
        } else {
            val onPrintable = LayoutFrames.onPrintable(layout, template.media.printable)
            when (val output = EscPosWriter().write(onPrintable, rasteriser.rasterise(onPrintable, dotsPerMm), dotsPerMm, width)) {
                is EscPosOutput.Written -> OutputResult.Written(output.bytes, PrintMediaTypes.ESCPOS, OutputMode.ESCPOS_RASTER)
                is EscPosOutput.Refused -> OutputResult.Stopped(Stop(output.refusal))
            }
        }
    }
}

/** What a PDF print needs besides the layout. */
internal data class PdfJob(
    val template: Template,
    val layout: Layout,
    val content: ResolvedContent,
    val language: LabelLanguage,
    /** The full DP-8 watermark line (documents print it at the foot of every page, spec §8.5). */
    val watermark: String,
    val reprint: Boolean,
    /** The fixed creation time (ISO 8601 with offset, to the second), the print time in the tenant's zone. */
    val createdAt: String,
)

/**
 * PDF output through the renderer satellite (docs/specs/modules/platform-docs.md §7.4, §7.5): HTML from the layout
 * (labels, wristbands, receipts) or CSS paged media with the banner laid out (documents), checked by [HtmlLint]
 * (no URL, script or external resource, HAZ-0047), then rendered to PDF/A-2b by [DocumentRendererPort]. A renderer
 * failure refuses the print (`print.refused.rendererUnavailable`, or `print.refused.easternDigits` for the satellite's
 * R8 finding); production wiring has no renderer (KA-083). The PDF's title is the template id, never patient text.
 */
internal class PdfPrint(
    private val renderer: DocumentRendererPort,
) {
    fun write(job: PdfJob): OutputResult {
        val html =
            if (job.template.kind == TemplateKind.DOCUMENT) {
                DocumentHtmlWriter().write(documentInput(job))
            } else {
                HtmlWriter().write(job.layout, job.createdAt)
            }
        return when {
            html is HtmlOutput.Refused -> {
                OutputResult.Stopped(Stop(html.refusal))
            }

            HtmlLint.check((html as HtmlOutput.Written).html) is HtmlLintResult.Violations -> {
                stopped(RefusalReason.TEMPLATE_INVALID, "html", "the HTML failed HtmlLint")
            }

            else -> {
                render(html.html, job)
            }
        }
    }

    private fun render(
        html: String,
        job: PdfJob,
    ): OutputResult {
        val template = job.template
        val request =
            RenderRequest(
                html = html,
                title = template.id,
                templateId = template.id,
                templateVersion = template.version,
                templateHash = template.contentHash,
                provenance = template.provenance.yamlName,
                language = job.language.tag,
                createdAt = job.createdAt,
            )
        val outcome =
            try {
                renderer.render(request)
            } catch (ignored: RuntimeException) {
                // Any failure of the renderer adapter refuses the print (spec §7.5, fail closed).
                RenderOutcome.Failed("renderer adapter error")
            }
        return when (outcome) {
            is RenderOutcome.Rendered -> OutputResult.Written(outcome.pdf, PrintMediaTypes.PDF, OutputMode.PDF)
            is RenderOutcome.Failed -> stopped(outcome.reason, "renderer", outcome.detail)
        }
    }

    /** A document's page from its template's media, and the banner moved onto the page's content area (spec §7.4). */
    private fun documentInput(job: PdfJob): DocumentHtmlInput {
        val media = job.template.media
        val printable = media.printable
        val page = DocumentPage(media.widthMm, media.lengthMm, printable.xMm, media.lengthMm - (printable.yMm + printable.hMm))
        val banner = LayoutFrames.banner(job.layout, printable)
        val meta =
            HtmlMetadata(
                templateId = job.template.id,
                templateVersion = job.template.version,
                templateHash = job.template.contentHash,
                synthetic = job.template.provenance == Provenance.SYNTHETIC,
                language = job.language,
                title = job.template.id,
                createdAt = job.createdAt,
            )
        return DocumentHtmlInput(
            meta = meta,
            page = page,
            banner = banner,
            bannerHeightMm = banner.frameHeightMm,
            title = LabelledText(job.content.text(Binding.DOCUMENT_TITLE).orEmpty()),
            blocks =
                job.content.documentBody.map { block ->
                    DocumentBlock(block.heading?.let(::LabelledText), block.paragraphs.map(::LabelledText))
                },
            watermark = job.watermark,
            reprint = job.reprint,
            reprintText = REPRINT_MARK,
        )
    }

    private companion object {
        /** The diagonal mark of a document reprint: language-independent, like the watermark's marks (spec §7.4, §8.5). */
        const val REPRINT_MARK = "REPRINT"
    }
}

/** Moves a layout's frame (spec §7.3, §7.4). */
internal object LayoutFrames {
    /** [layout] with its frame cut to the printable area's width: every x moves left by the printable area's x. */
    fun onPrintable(
        layout: Layout,
        printable: MmBox,
    ): Layout = shifted(layout, printable.xMm).copy(frameWidthMm = printable.wMm)

    /**
     * A document's banner on the page's content area: x relative to the content area's left edge, y from the page's top
     * (the banner box is the page's top margin), the frame as tall as the lowest line or rule, so the measured height is
     * exactly what the banner takes and nothing below it is clipped.
     */
    fun banner(
        layout: Layout,
        printable: MmBox,
    ): Layout {
        val moved = shifted(layout, printable.xMm)
        val bottoms =
            moved.lines.map { it.topMm + it.lineHeightMm } +
                moved.rules.map { it.yMm + it.hMm } +
                moved.barcodes.map { it.yMm + it.maxSizeMm }
        val bottom = bottoms.maxOrNull() ?: 0.0
        return moved.copy(frameWidthMm = printable.wMm, frameHeightMm = bottom)
    }

    private fun shifted(
        layout: Layout,
        dxMm: Double,
    ): Layout =
        layout.copy(
            lines = layout.lines.map { it.copy(boxXMm = it.boxXMm - dxMm) },
            barcodes = layout.barcodes.map { it.copy(xMm = it.xMm - dxMm) },
            rules = layout.rules.map { it.copy(xMm = it.xMm - dxMm) },
        )
}
