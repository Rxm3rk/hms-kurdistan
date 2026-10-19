package hms.platform.docs.domain.rules

import hms.platform.docs.api.NameForm
import hms.platform.docs.api.Script
import hms.platform.docs.domain.template.Binding
import hms.platform.docs.domain.template.TemplateKind

/**
 * Print content after the SI-01 content rules (docs/specs/modules/platform-docs.md §3.2): every text exactly
 * as it will print, keyed by the template binding that places it. Only [ContentRules] builds it, so a value
 * here has passed R1 to R8 and R10; the layout engine (spec §5) and the barcode payload (spec §6.1, R9) read
 * the same object, so the barcode can never disagree with the printed text.
 *
 * @property kind the template kind the content belongs to; a template of another kind is refused
 * @property texts the text of each single-text binding
 * @property rows the rows of each list binding (`receipt.lines`, `receipt.totals`, `document.banner`)
 * @property omitted bindings that deliberately print nothing for this content: the Latin name of a patient
 *   whose own form is Latin (it prints once, DN-068), an unrecorded sex, an empty issuer or test list. A
 *   binding in neither [texts], [rows] nor [omitted] has no value and the layout refuses the print
 * @property approximateDob true when the date of birth prints with the approximate marker `~`; the template's
 *   `approximate` caption prints only then (spec §3.2 R5, §3.3)
 * @property documentBody the redacted body of a document, for the HTML writer (spec §7.4); empty otherwise
 * @property otherNameForms documents only: every recorded name form other than the own and the Latin form, in
 *   [NameForm] order (the map's iteration order); the banner prints each below the own and the Latin form in its
 *   form's script (spec §4.1). Labels print no third form, so this is empty for every other kind
 */
data class ResolvedContent(
    val kind: TemplateKind,
    val texts: Map<Binding, ResolvedText>,
    val rows: Map<Binding, List<ResolvedRow>> = emptyMap(),
    val omitted: Set<Binding> = emptySet(),
    val approximateDob: Boolean = false,
    val documentBody: List<ResolvedBlock> = emptyList(),
    val otherNameForms: Map<NameForm, String> = emptyMap(),
) {
    /** The single-segment text of [binding], or null. */
    fun text(binding: Binding): String? = texts[binding]?.segments?.singleOrNull()?.text
}

/** One paragraph of print text with the script it is known to be in (name forms), or null when unknown. */
data class TextSegment(
    val text: String,
    val script: Script?,
)

/**
 * The text of one binding: usually one segment; several for a list that prints one paragraph per item (the
 * receipt's issuer lines). Segments stack top to bottom, each fitted on its own (flow kinds only).
 */
data class ResolvedText(
    val segments: List<TextSegment>,
) {
    constructor(text: String, script: Script? = null) : this(listOf(TextSegment(text, script)))
}

/** One cell of a row: content text, or a caption of the template in the label language. */
sealed interface Cell {
    data class Literal(
        val text: String,
    ) : Cell

    data class CaptionRef(
        val key: String,
    ) : Cell
}

/** A row of a list binding: a description (start-aligned) and an amount or value (end-aligned). */
data class ResolvedRow(
    val description: Cell,
    val amount: Cell,
)

/** A block of a document body after redaction (spec §3.2 R10). */
data class ResolvedBlock(
    val heading: String?,
    val paragraphs: List<String>,
)
