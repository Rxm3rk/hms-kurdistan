package hms.platform.docs.domain.layout

import hms.platform.docs.api.LabelLanguage
import hms.platform.docs.api.Refusal
import hms.platform.docs.api.RefusalReason
import hms.platform.docs.api.Script
import hms.platform.docs.domain.audit.Watermark
import hms.platform.docs.domain.barcode.BarcodePayload
import hms.platform.docs.domain.barcode.PayloadOutcome
import hms.platform.docs.domain.rules.Cell
import hms.platform.docs.domain.rules.PrintTime
import hms.platform.docs.domain.rules.ResolvedContent
import hms.platform.docs.domain.rules.ResolvedRow
import hms.platform.docs.domain.rules.TextChecks
import hms.platform.docs.domain.rules.TextSegment
import hms.platform.docs.domain.rules.otherFormSubject
import hms.platform.docs.domain.template.Align
import hms.platform.docs.domain.template.Binding
import hms.platform.docs.domain.template.CaptionKeys
import hms.platform.docs.domain.template.Element
import hms.platform.docs.domain.template.FontChoice
import hms.platform.docs.domain.template.FontRole
import hms.platform.docs.domain.template.FontWeight
import hms.platform.docs.domain.template.LegibilityPolicy
import hms.platform.docs.domain.template.Overflow
import hms.platform.docs.domain.template.Provenance
import hms.platform.docs.domain.template.Symbology
import hms.platform.docs.domain.template.Template
import hms.platform.docs.domain.template.TemplateKind
import hms.platform.docs.domain.template.TemplateLint
import hms.platform.docs.domain.template.TextDirection
import kotlin.math.max
import kotlin.math.min

/**
 * What the layout engine lays out.
 *
 * @property content the output of [hms.platform.docs.domain.rules.ContentRules]: every value has passed R1–R8, R10
 * @property watermark required for every patient kind (spec §8.5, DN-070); ignored for tokens
 * @property dotsPerMm the target printer's resolution: sizes are quantised to its whole dots (spec §5.3)
 */
data class LayoutRequest(
    val template: Template,
    val content: ResolvedContent,
    val language: LabelLanguage,
    val watermark: Watermark?,
    val dotsPerMm: Double,
    val legibility: LegibilityPolicy = LegibilityPolicy(),
)

/** The layout, or the refusal that stopped it. Never a partial layout. */
sealed interface LayoutOutcome {
    data class Laid(
        val layout: Layout,
    ) : LayoutOutcome

    data class Refused(
        val refusal: Refusal,
    ) : LayoutOutcome
}

/**
 * Turns a template and resolved content into the one [Layout] every writer draws (docs/specs/modules/platform-docs.md
 * §2, §5; BUILD-PROMPT §12.8; SI-01, R6, R7, R9; DP-8).
 *
 * Before laying anything out it refuses: a resolution that is not positive or is below the template's lowest
 * resolution (`media.minDotsPerMm`, `printerUnsupported`); content of
 * another kind than the template (`templateInvalid`); a template with any [TemplateLint] finding (`templateInvalid`,
 * the loader's check repeated, fail closed); a patient print without a watermark, or whose watermark has a blank
 * field, an invalid zone, an MRN other than the printed one, or an unprintable character.
 *
 * - **Fixed kinds** (wristband, specimen label): each element in its absolute box.
 * - **Flow kinds** (receipt, token): elements stack top to bottom in template order from the printable area's top;
 *   `box.y` is the gap before an element; the frame grows to the content (never below the media's minimum length,
 *   keeping the bottom margin).
 * - **Documents:** only the banner block is laid out, as a flow at the page width (every element except
 *   `document.title`, `document.body` and `watermark`); the HTML writer uses its height for the page's top margin
 *   and places the title, body and watermark line itself (spec §7.4).
 *
 * Text: content text by its binding; `watermark` is [WatermarkText.forKind]; `notice.synthetic` is [NOTICE]. Fonts:
 * `arabic`/`latin` as named; `by-script` from the name form's script (other text: its first letter's script, Latin
 * when it has none); `by-label-language` and captions follow the label language; `mixed` is the chain of both, the
 * label language's first. Identity text uses one font and shrinks no lower than the legibility minimum at the
 * target resolution; if it does not fit it is refused (`identityDoesNotFit`). Other text that does not fit is
 * refused as a template that does not suit the content (`templateInvalid`), unless it may `wrap-grow` in a flow
 * kind. A missing glyph is `unrenderableText`. Captions use the label language's text and direction; the
 * `approximate` caption prints only for an approximate date of birth and, like identity text, never below the
 * legibility minimum and never truncated (`identityDoesNotFit`, spec §3.2 R5). A document's `identity.name.latin`
 * element is followed by every other recorded name form, each fitted as identity text in its script's font (§4.1).
 * `rows` print one row per item: description start-aligned, amount end-aligned, columns in the label language's
 * reading order. Barcodes carry the payload
 * built from the resolved content (R9); the wristband's band serial is the job id.
 */
class LayoutEngine(
    shaper: TextShaper,
) {
    private val fitter = Fitter(shaper)

    fun layout(request: LayoutRequest): LayoutOutcome {
        val refusal = preconditions(request)
        if (refusal != null) return LayoutOutcome.Refused(refusal)
        return when (val watermark = WatermarkCheck.text(request)) {
            is WatermarkCheck.Result.Refused -> LayoutOutcome.Refused(watermark.refusal)
            is WatermarkCheck.Result.Ok -> Session(request, fitter, watermark.text).run()
        }
    }

    private fun preconditions(request: LayoutRequest): Refusal? {
        val template = request.template
        val findings = TemplateLint.lint(template, request.legibility)
        return when {
            !(request.dotsPerMm.isFinite() && request.dotsPerMm > 0.0) -> {
                Refusal(RefusalReason.PRINTER_UNSUPPORTED, "dotsPerMm", "resolution must be positive")
            }

            request.dotsPerMm < template.media.minDotsPerMm -> {
                Refusal(RefusalReason.PRINTER_UNSUPPORTED, "dotsPerMm", "below the template's lowest resolution")
            }

            request.content.kind != template.kind -> {
                Refusal(RefusalReason.TEMPLATE_INVALID, template.id, "content is for ${request.content.kind.yamlName}")
            }

            findings.isNotEmpty() -> {
                findings.first().let {
                    Refusal(
                        RefusalReason.TEMPLATE_INVALID,
                        template.id,
                        "lint rule ${it.rule}, element ${it.elementIndex}",
                    )
                }
            }

            else -> {
                null
            }
        }
    }

    companion object {
        /** The synthetic-content notice (§19.4; spec §4.3 rule 9). */
        const val NOTICE: String = "SYNTHETIC – NOT FOR CLINICAL USE"
    }
}

/** The watermark's text and its checks (spec §8.5): R7 and R8 apply to it like any printed text. */
private object WatermarkCheck {
    sealed interface Result {
        data class Ok(
            val text: String?,
        ) : Result

        data class Refused(
            val refusal: Refusal,
        ) : Result
    }

    fun text(request: LayoutRequest): Result {
        val kind = request.template.kind
        val watermark = request.watermark
        val zone = watermark?.let { PrintTime.zoneOrNull(it.zoneId) }
        return when {
            !kind.patientPrint -> {
                Result.Ok(null)
            }

            watermark == null -> {
                refused(RefusalReason.TEMPLATE_INVALID, "no watermark for a patient print")
            }

            watermark.staffId.isBlank() || watermark.jobId.isBlank() || watermark.userDisplayName.isBlank() -> {
                refused(RefusalReason.TEMPLATE_INVALID, "a watermark field is blank")
            }

            zone == null -> {
                refused(RefusalReason.TEMPLATE_INVALID, "invalid time zone")
            }

            watermark.patientMrn != request.content.text(Binding.IDENTITY_MRN) -> {
                refused(RefusalReason.TEMPLATE_INVALID, "the watermark's MRN is not the printed MRN")
            }

            else -> {
                checked(WatermarkText.full(watermark, zone), WatermarkText.forKind(kind, watermark, zone))
            }
        }
    }

    private fun checked(
        full: String,
        printed: String?,
    ): Result {
        val unrenderable = TextChecks.unrenderable(full)
        val eastern = TextChecks.easternDigit(full)
        return when {
            unrenderable != null -> refused(RefusalReason.UNRENDERABLE_TEXT, unrenderable)
            eastern != null -> refused(RefusalReason.EASTERN_DIGITS, eastern)
            else -> Result.Ok(printed)
        }
    }

    private fun refused(
        reason: RefusalReason,
        detail: String,
    ): Result = Result.Refused(Refusal(reason, Binding.WATERMARK.yamlName, detail))
}

/** What placing one element did. */
private sealed interface Placement {
    /** Placed; [heightMm] is what it takes in a flow. */
    data class Placed(
        val heightMm: Double,
    ) : Placement

    /** The element prints nothing for this content (and takes no space). */
    data object Skipped : Placement

    data class Refused(
        val refusal: Refusal,
    ) : Placement
}

/** One layout run: elements are placed in template order; the first refusal ends it. */
private class Session(
    private val request: LayoutRequest,
    fitter: Fitter,
    private val watermarkText: String?,
) {
    private val template = request.template
    private val flow = template.kind.flow
    private val sink = LineSink(request)
    private val text = TextPlacer(sink, fitter)
    private val rowPlacer = RowPlacer(sink, fitter)
    private val barcodes = mutableListOf<PlacedBarcode>()
    private val rules = mutableListOf<PlacedRule>()
    private var cursorMm = template.media.printable.yMm

    fun run(): LayoutOutcome {
        val refusal = elements().firstNotNullOfOrNull { element -> (place(element) as? Placement.Refused)?.refusal }
        return refusal?.let { LayoutOutcome.Refused(it) } ?: LayoutOutcome.Laid(layout())
    }

    /** Documents lay out the banner block only (spec §7.4). */
    private fun elements(): List<Element> =
        if (template.kind == TemplateKind.DOCUMENT) {
            template.elements.filterNot { it is Element.Bound && it.bind in documentBodyBindings }
        } else {
            template.elements
        }

    private fun place(element: Element): Placement {
        val top = if (flow) cursorMm + element.box.yMm else element.box.yMm
        val placement =
            when (element) {
                is Element.Text -> {
                    if (template.kind == TemplateKind.DOCUMENT && element.bind == Binding.IDENTITY_NAME_LATIN) {
                        names(element, top)
                    } else {
                        text.text(element, top, segments(element))
                    }
                }

                is Element.Caption -> {
                    text.caption(element, top)
                }

                is Element.Rows -> {
                    rows(element, top)
                }

                is Element.Barcode -> {
                    barcode(element, top)
                }

                is Element.Rule -> {
                    rules += PlacedRule(element.box.xMm, top, element.box.wMm, element.box.hMm)
                    Placement.Placed(element.box.hMm)
                }
            }
        if (flow && placement is Placement.Placed) cursorMm = top + placement.heightMm
        return placement
    }

    /** The text of a text element: null when it has no value, empty when it deliberately prints nothing. */
    private fun segments(element: Element.Text): List<TextSegment>? =
        when (element.bind) {
            Binding.WATERMARK -> {
                watermarkText?.let { listOf(TextSegment(it, null)) }
            }

            Binding.NOTICE_SYNTHETIC -> {
                listOf(TextSegment(LayoutEngine.NOTICE, Script.LATN))
            }

            else -> {
                request.content.texts[element.bind]?.segments
                    ?: if (element.bind in request.content.omitted) emptyList() else null
            }
        }

    /**
     * A document's Latin-name element, then every other recorded name form below it (spec §4.1), each in its own
     * script's font (`by-script`) and fitted as identity text: never truncated, refused when it does not fit, with the
     * form as the refusal's subject (for example `identity.name.ar`).
     */
    private fun names(
        element: Element.Text,
        top: Double,
    ): Placement {
        var height = 0.0
        val byScript = element.copy(font = FontChoice.BY_SCRIPT)
        val blocks =
            listOf(Triple(element, segments(element), element.bind.yamlName)) +
                request.content.otherNameForms.map { (form, name) ->
                    Triple(byScript, listOf(TextSegment(name, form.script)), otherFormSubject(form))
                }
        val refusal =
            blocks.firstNotNullOfOrNull { (block, segments, subject) ->
                when (val placement = text.text(block, top + height, segments, subject)) {
                    is Placement.Placed -> {
                        height += placement.heightMm
                        null
                    }

                    is Placement.Refused -> {
                        placement
                    }

                    Placement.Skipped -> {
                        null
                    }
                }
            }
        return refusal ?: Placement.Placed(height)
    }

    private fun rows(
        element: Element.Rows,
        top: Double,
    ): Placement {
        val rows = request.content.rows[element.bind]
        return when {
            rows == null && element.bind in request.content.omitted -> Placement.Skipped
            rows == null -> missing(element.bind)
            rows.isEmpty() -> Placement.Skipped
            else -> rowPlacer.rows(element, top, rows)
        }
    }

    private fun barcode(
        element: Element.Barcode,
        top: Double,
    ): Placement {
        val content = request.content
        val payload =
            when {
                element.bind == Binding.BARCODE_WRISTBAND -> {
                    BarcodePayload.wristband(
                        content.text(Binding.IDENTITY_MRN),
                        content.text(Binding.ENCOUNTER_ID),
                        request.watermark?.jobId,
                    )
                }

                element.symbology == Symbology.CODE128 -> {
                    BarcodePayload.specimenCode128(content.text(Binding.SPECIMEN_ID))
                }

                else -> {
                    BarcodePayload.specimenDataMatrix(content.text(Binding.SPECIMEN_ID), content.text(Binding.IDENTITY_MRN))
                }
            }
        return when (payload) {
            is PayloadOutcome.Refused -> {
                Placement.Refused(payload.refusal)
            }

            is PayloadOutcome.Built -> {
                val box = element.box
                val maxSize = if (element.symbology == Symbology.DATAMATRIX) min(box.wMm, box.hMm) else box.wMm
                barcodes += PlacedBarcode(element.symbology, payload.payload, box.xMm, top, element.moduleMm, maxSize)
                Placement.Placed(box.hMm)
            }
        }
    }

    private fun layout(): Layout {
        val media = template.media
        val bottomMargin = max(0.0, media.frameHeightMm - (media.printable.yMm + media.printable.hMm))
        return Layout(
            templateId = template.id,
            templateVersion = template.version,
            templateHash = template.contentHash,
            kind = template.kind,
            language = request.language,
            synthetic = template.provenance == Provenance.SYNTHETIC,
            frameWidthMm = media.frameWidthMm,
            frameHeightMm = if (flow) max(media.frameHeightMm, cursorMm + bottomMargin) else media.frameHeightMm,
            rotation = media.rotation,
            lines = sink.placed.toList(),
            barcodes = barcodes.toList(),
            rules = rules.toList(),
        )
    }

    companion object {
        val documentBodyBindings = setOf(Binding.DOCUMENT_TITLE, Binding.DOCUMENT_BODY, Binding.WATERMARK)
    }
}

private fun missing(binding: Binding): Placement =
    Placement.Refused(Refusal(RefusalReason.TEMPLATE_INVALID, binding.yamlName, "no value for this binding"))

/** Collects placed lines; turns fit outcomes into placements and refusals (shared by the placers below). */
private class LineSink(
    val request: LayoutRequest,
) {
    val placed = mutableListOf<PlacedLine>()
    val language: LabelLanguage = request.language
    val flow: Boolean = request.template.kind.flow

    fun captionDirection(): Direction = if (language.rightToLeft) Direction.RTL else Direction.LTR

    /** Captions are template content: R7 and R8 apply to them like any printed text. */
    fun captionCheck(
        text: String,
        subject: String,
    ): Placement.Refused? {
        val unrenderable = TextChecks.unrenderable(text)
        val eastern = TextChecks.easternDigit(text)
        return when {
            unrenderable != null -> Placement.Refused(Refusal(RefusalReason.UNRENDERABLE_TEXT, subject, unrenderable))
            eastern != null -> Placement.Refused(Refusal(RefusalReason.EASTERN_DIGITS, subject, eastern))
            else -> null
        }
    }

    /** Places a fitted block in [column] from [top]; a missing glyph or no fit becomes the refusal. */
    fun outcome(
        fit: FitOutcome,
        subject: String,
        notFitting: RefusalReason,
        placement: Column,
    ): Placement =
        when (fit) {
            is FitOutcome.Fitted -> {
                Placement.Placed(lines(fit, placement))
            }

            FitOutcome.MissingGlyph -> {
                Placement.Refused(Refusal(RefusalReason.UNRENDERABLE_TEXT, subject, "a character has no glyph in the font"))
            }

            is FitOutcome.DoesNotFit -> {
                Placement.Refused(Refusal(notFitting, subject, fit.detail))
            }
        }

    /** Adds the fitted lines; returns the block height in millimetres. */
    private fun lines(
        fitted: FitOutcome.Fitted,
        column: Column,
    ): Double {
        val ascentMm = Dots.ptToMm(fitted.ascentPt)
        val lineHeightMm = Dots.ptToMm(fitted.lineHeightPt)
        fitted.lines.forEachIndexed { i, line ->
            val baseline = column.topMm + ascentMm + i * lineHeightMm
            placed +=
                PlacedLine(
                    text = line.text,
                    fonts = column.fonts,
                    sizePt = fitted.sizePt,
                    rightToLeft = fitted.rightToLeft,
                    align = column.align,
                    boxXMm = column.xMm,
                    boxWidthMm = column.widthMm,
                    topMm = baseline - ascentMm,
                    baselineMm = baseline,
                    lineHeightMm = lineHeightMm,
                    measuredWidthMm = Dots.ptToMm(line.advancePt),
                )
        }
        return Dots.ptToMm(fitted.blockHeightPt)
    }
}

/** Where a block of lines goes: its column, alignment, fonts and top. */
private data class Column(
    val xMm: Double,
    val widthMm: Double,
    val align: Align,
    val fonts: List<FontSpec>,
    val topMm: Double,
)

/** Fits and places text elements and captions. */
private class TextPlacer(
    private val sink: LineSink,
    private val fitter: Fitter,
) {
    private val request = sink.request

    fun text(
        element: Element.Text,
        top: Double,
        segments: List<TextSegment>?,
        subject: String = element.bind.yamlName,
    ): Placement =
        when {
            segments == null -> {
                missing(element.bind)
            }

            segments.isEmpty() -> {
                Placement.Skipped
            }

            segments.size > 1 && !sink.flow -> {
                Placement.Refused(Refusal(RefusalReason.TEMPLATE_INVALID, subject, "a list on a fixed layout"))
            }

            else -> {
                stack(element, top, segments, subject)
            }
        }

    /** Several paragraphs (a list binding in a flow kind) stack top to bottom, each fitted on its own. */
    private fun stack(
        element: Element.Text,
        top: Double,
        segments: List<TextSegment>,
        subject: String,
    ): Placement {
        var height = 0.0
        val refusal =
            segments.firstNotNullOfOrNull { segment ->
                when (val placement = textSegment(element, top + height, segment, subject)) {
                    is Placement.Placed -> {
                        height += placement.heightMm
                        null
                    }

                    is Placement.Refused -> {
                        placement
                    }

                    Placement.Skipped -> {
                        null
                    }
                }
            }
        return refusal ?: Placement.Placed(height)
    }

    private fun textSegment(
        element: Element.Text,
        top: Double,
        segment: TextSegment,
        subject: String,
    ): Placement {
        val fonts = Fonts.resolve(element.font, element.weight, segment.script, segment.text, sink.language)
        val identity = element.bind.identity
        val legibilityMin = if (identity) fonts.maxOf { request.legibility.minimumPt(it.role, request.dotsPerMm) } else 0.0
        val fit =
            fitter.fit(
                FitRequest(
                    text = segment.text,
                    fonts = fonts,
                    direction = if (element.direction == TextDirection.LTR) Direction.LTR else Direction.AUTO,
                    maxPt = element.size.maxPt,
                    minPt = max(element.size.minPt, legibilityMin),
                    maxLines = element.maxLines,
                    boxWidthMm = element.box.wMm,
                    boxHeightMm = element.box.hMm,
                    dotsPerMm = request.dotsPerMm,
                    growWhenNoFit = sink.flow && !identity && element.overflow == Overflow.WRAP_GROW,
                ),
            )
        val notFitting = if (identity) RefusalReason.IDENTITY_DOES_NOT_FIT else RefusalReason.TEMPLATE_INVALID
        return sink.outcome(fit, subject, notFitting, Column(element.box.xMm, element.box.wMm, element.align, fonts, top))
    }

    fun caption(
        element: Element.Caption,
        top: Double,
    ): Placement {
        val subject = "caption.${element.key}"
        val text = request.template.captions[element.key]?.get(sink.language)
        return when {
            element.key == CaptionKeys.APPROXIMATE && !request.content.approximateDob -> {
                Placement.Skipped
            }

            text.isNullOrBlank() -> {
                Placement.Refused(Refusal(RefusalReason.TEMPLATE_INVALID, subject, "no caption text"))
            }

            else -> {
                sink.captionCheck(text, subject) ?: run {
                    val fonts = Fonts.resolve(element.font, element.weight, null, text, sink.language)
                    // R5: the approximate caption is subject to R6 and the legibility minimum like identity text.
                    val identityLike = element.key == CaptionKeys.APPROXIMATE
                    val legibilityMin =
                        if (identityLike) fonts.maxOf { request.legibility.minimumPt(it.role, request.dotsPerMm) } else 0.0
                    val box = element.box
                    val fit =
                        fitter.fit(
                            FitRequest(
                                text,
                                fonts,
                                sink.captionDirection(),
                                element.size.maxPt,
                                max(element.size.minPt, legibilityMin),
                                1,
                                box.wMm,
                                box.hMm,
                                request.dotsPerMm,
                            ),
                        )
                    val notFitting = if (identityLike) RefusalReason.IDENTITY_DOES_NOT_FIT else RefusalReason.TEMPLATE_INVALID
                    sink.outcome(fit, subject, notFitting, Column(box.xMm, box.wMm, element.align, fonts, top))
                }
            }
        }
    }
}

/** Fits and places rows: one per item, description and amount side by side. */
private class RowPlacer(
    private val sink: LineSink,
    private val fitter: Fitter,
) {
    private val request = sink.request

    fun rows(
        element: Element.Rows,
        top: Double,
        rows: List<ResolvedRow>,
    ): Placement {
        var rowTop = top
        val refusal =
            rows.withIndex().firstNotNullOfOrNull { (i, row) ->
                if (i > 0) rowTop += element.box.yMm
                when (val placement = row(element, rowTop, row)) {
                    is Placement.Placed -> {
                        rowTop += placement.heightMm
                        null
                    }

                    is Placement.Refused -> {
                        placement
                    }

                    Placement.Skipped -> {
                        null
                    }
                }
            }
        return refusal ?: Placement.Placed(rowTop - top)
    }

    /** One row: the two cells side by side, columns in the label language's reading order. */
    private fun row(
        element: Element.Rows,
        top: Double,
        row: ResolvedRow,
    ): Placement {
        val box = element.box
        val rightToLeft = sink.language.rightToLeft
        val descriptionX = if (rightToLeft) box.xMm + box.wMm - element.descriptionWidthMm else box.xMm
        val amountX = if (rightToLeft) box.xMm else box.xMm + box.wMm - element.amountWidthMm
        val description = cell(element, row.description, Triple(descriptionX, element.descriptionWidthMm, Align.START), top)
        val amount =
            if (description is Placement.Refused) {
                description
            } else {
                cell(element, row.amount, Triple(amountX, element.amountWidthMm, Align.END), top)
            }
        return when {
            description is Placement.Refused -> description
            amount is Placement.Refused -> amount
            else -> Placement.Placed(max(height(description), height(amount)))
        }
    }

    private fun cell(
        element: Element.Rows,
        cell: Cell,
        column: Triple<Double, Double, Align>,
        top: Double,
    ): Placement {
        val subject = element.bind.yamlName
        val captionKey = (cell as? Cell.CaptionRef)?.key
        val text =
            if (cell is Cell.Literal) {
                cell.text
            } else {
                request.template.captions[captionKey]
                    ?.get(sink.language)
                    .orEmpty()
            }
        val fonts =
            Fonts.resolve(if (captionKey == null) element.font else FontChoice.BY_LABEL_LANGUAGE, element.weight, null, text, sink.language)
        val check =
            if (captionKey != null && text.isBlank()) {
                Placement.Refused(Refusal(RefusalReason.TEMPLATE_INVALID, "caption.$captionKey", "no caption text"))
            } else {
                sink.captionCheck(text, subject)
            }
        return check ?: run {
            val fit =
                fitter.fit(
                    FitRequest(
                        text = text,
                        fonts = fonts,
                        direction = if (captionKey == null) Direction.AUTO else sink.captionDirection(),
                        maxPt = element.size.maxPt,
                        minPt = element.size.minPt,
                        maxLines = Int.MAX_VALUE,
                        boxWidthMm = column.second,
                        boxHeightMm = element.box.hMm,
                        dotsPerMm = request.dotsPerMm,
                        growWhenNoFit = sink.flow,
                    ),
                )
            sink.outcome(fit, subject, RefusalReason.TEMPLATE_INVALID, Column(column.first, column.second, column.third, fonts, top))
        }
    }

    private fun height(placement: Placement): Double = (placement as? Placement.Placed)?.heightMm ?: 0.0
}

/** Font choice to font chain (spec §4.1, §9). */
internal object Fonts {
    fun resolve(
        choice: FontChoice,
        weight: FontWeight,
        script: Script?,
        text: String,
        language: LabelLanguage,
    ): List<FontSpec> {
        val labelRole = if (language.rightToLeft) FontRole.ARABIC else FontRole.LATIN
        val roles =
            when (choice) {
                FontChoice.ARABIC -> listOf(FontRole.ARABIC)
                FontChoice.LATIN -> listOf(FontRole.LATIN)
                FontChoice.BY_SCRIPT -> listOf(if ((script ?: scriptOf(text)) == Script.ARAB) FontRole.ARABIC else FontRole.LATIN)
                FontChoice.BY_LABEL_LANGUAGE -> listOf(labelRole)
                FontChoice.MIXED -> listOf(labelRole, if (labelRole == FontRole.ARABIC) FontRole.LATIN else FontRole.ARABIC)
            }
        return roles.map { FontSpec(it, weight) }
    }

    /** The script of the first Arabic or Latin letter; Latin when the text has neither (digits, punctuation). */
    fun scriptOf(text: String): Script =
        text
            .codePoints()
            .toArray()
            .asSequence()
            .firstNotNullOfOrNull { codePoint ->
                when (Character.UnicodeScript.of(codePoint)) {
                    Character.UnicodeScript.ARABIC -> Script.ARAB
                    Character.UnicodeScript.LATIN -> Script.LATN
                    else -> null
                }
            } ?: Script.LATN
}
