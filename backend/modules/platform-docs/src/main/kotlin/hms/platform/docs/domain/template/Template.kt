package hms.platform.docs.domain.template

import hms.platform.docs.api.LabelLanguage

/*
 * The print template model (docs/specs/modules/platform-docs.md §4). Templates are content (§6.6, §19.4):
 * YAML files under content/print-templates/, loaded by the infrastructure loader and checked by
 * [TemplateLint] before use. Geometry is in millimetres on the label's reading frame.
 */

/** What a template prints; decides the outputs and the rules that apply (spec §2, §4.1). */
enum class TemplateKind(
    val yamlName: String,
    /** True for prints about a patient: SI-01's identifier slots apply (spec §3.2, §4.3 rule 1). */
    val patientPrint: Boolean,
    /** True when blocks stack top to bottom and the length grows with the content (spec §4.1). */
    val flow: Boolean,
) {
    WRISTBAND("wristband", patientPrint = true, flow = false),
    SPECIMEN_LABEL("specimen-label", patientPrint = true, flow = false),
    RECEIPT("receipt", patientPrint = true, flow = true),
    TOKEN("token", patientPrint = false, flow = true),
    DOCUMENT("document", patientPrint = true, flow = true),
}

/** §19.4: every content item carries its provenance; synthetic content never reaches TRAIN or PROD. */
enum class Provenance(
    val yamlName: String,
) {
    SYNTHETIC("synthetic"),
    APPROVED("approved"),
}

/** Fonts are named by role and resolved by the font registry (spec §9). */
enum class FontRole(
    val yamlName: String,
) {
    /** Noto Sans Arabic: Arabic-script text (Sorani, Arabic, Badini in Arabic script). */
    ARABIC("arabic"),

    /** Noto Sans: Latin text, MRNs, dates and numbers in Western digits. */
    LATIN("latin"),
}

enum class FontWeight(
    val yamlName: String,
) {
    REGULAR("regular"),
    BOLD("bold"),
}

/** Alignment relative to the line's own direction (start is right for a right-to-left line). */
enum class Align(
    val yamlName: String,
) {
    START("start"),
    END("end"),
    CENTER("center"),
}

/** What happens when text does not fit; identity text may only `REFUSE` (spec §4.3 rule 3, §5.3). */
enum class Overflow(
    val yamlName: String,
) {
    REFUSE("refuse"),

    /** Flow layouts only, non-identity text only: the block grows. Never truncation. */
    WRAP_GROW("wrap-grow"),
}

/** The barcode symbologies the writers support (spec §6). */
enum class Symbology(
    val yamlName: String,
) {
    DATAMATRIX("datamatrix"),
    CODE128("code128"),
}

/** A box in millimetres on the reading frame. */
data class MmBox(
    val xMm: Double,
    val yMm: Double,
    val wMm: Double,
    val hMm: Double,
)

/**
 * The printer's media and the reading frame on it (spec §4.1). [widthMm] runs across the print head,
 * [lengthMm] along the feed (for flow kinds, the minimum length). For `rotation` 0 the reading frame is
 * width × length; for 90 it is length × width (a wristband read along its length). [printable] is in the
 * reading frame.
 */
data class Media(
    val widthMm: Double,
    val lengthMm: Double,
    val rotation: Int,
    val printable: MmBox,
    /** The lowest printer resolution this template may print at (lint rule 10, spec §4.3, §5.4). */
    val minDotsPerMm: Double = DEFAULT_MIN_DOTS_PER_MM,
) {
    val frameWidthMm: Double get() = if (rotation == ROTATED) lengthMm else widthMm
    val frameHeightMm: Double get() = if (rotation == ROTATED) widthMm else lengthMm

    companion object {
        const val ROTATED: Int = 90
        const val DEFAULT_MIN_DOTS_PER_MM: Double = 8.0
    }
}

/** How an element chooses its font (spec §4.1, §9). */
enum class FontChoice(
    val yamlName: String,
) {
    ARABIC("arabic"),
    LATIN("latin"),

    /** From the bound name form's script: Arabic-script forms use ARABIC, Latin uses LATIN. */
    BY_SCRIPT("by-script"),

    /** Captions: ARABIC for the `ckb` and `ar` label languages, LATIN for `en`. */
    BY_LABEL_LANGUAGE("by-label-language"),

    /**
     * Non-identity text only (test names, receipt lines, document text): a chain of both fonts, the label
     * language's first, so "Amoxicillin 500 mg" in a Sorani line prints (spec §4.1, §4.3 rule 7).
     */
    MIXED("mixed"),
}

/** The paragraph direction an element asks for (spec §4.1): `auto`, or forced `ltr` for identifiers and dates. */
enum class TextDirection(
    val yamlName: String,
) {
    AUTO("auto"),
    LTR("ltr"),
}

/** The size range a text may take, in points; the fit rule tries max down to min (spec §5.3). */
data class SizeRange(
    val maxPt: Double,
    val minPt: Double,
)

/**
 * Every field a template may bind. A template has no other source of text: no literals, no expressions
 * (spec §4.1). There is no location binding (SI-01 clause b).
 */
enum class Binding(
    val yamlName: String,
    /** Identity text: never truncated, overflow must be REFUSE (spec §3.2 R6). */
    val identity: Boolean,
) {
    IDENTITY_NAME_OWN("identity.name.own", identity = true),
    IDENTITY_NAME_LATIN("identity.name.latin", identity = true),
    IDENTITY_MRN("identity.mrn", identity = true),
    IDENTITY_BIRTH_DATE("identity.birthDate", identity = true),
    IDENTITY_SEX("identity.sex", identity = false),
    ENCOUNTER_ID("encounter.id", identity = true),
    SPECIMEN_ID("specimen.id", identity = true),
    SPECIMEN_TYPE("specimen.type", identity = false),
    SPECIMEN_COLLECTED_AT("specimen.collectedAt", identity = false),
    SPECIMEN_TESTS("specimen.tests", identity = false),
    RECEIPT_NUMBER("receipt.number", identity = true),
    RECEIPT_ISSUER("receipt.issuer", identity = false),
    RECEIPT_LINES("receipt.lines", identity = false),
    RECEIPT_TOTALS("receipt.totals", identity = false),
    RECEIPT_CASHIER("receipt.cashier", identity = false),
    RECEIPT_ISSUED_AT("receipt.issuedAt", identity = false),
    TOKEN_NUMBER("token.number", identity = false),
    TOKEN_SERVICE_POINT("token.servicePoint", identity = false),
    TOKEN_ISSUED_AT("token.issuedAt", identity = false),
    DOCUMENT_TITLE("document.title", identity = false),
    DOCUMENT_BODY("document.body", identity = false),
    DOCUMENT_BANNER("document.banner", identity = false),
    WATERMARK("watermark", identity = false),

    /** "SYNTHETIC - NOT FOR CLINICAL USE", required on every synthetic template (§19.4; spec §4.3). */
    NOTICE_SYNTHETIC("notice.synthetic", identity = false),
    BARCODE_WRISTBAND("barcode.wristband", identity = false),
    BARCODE_SPECIMEN("barcode.specimen", identity = false),
    ;

    companion object {
        fun fromYaml(name: String): Binding? = entries.firstOrNull { it.yamlName == name }
    }
}

/** One element of a template. */
sealed interface Element {
    val box: MmBox

    /** An element that prints a field of the content. */
    sealed interface Bound : Element {
        val bind: Binding
    }

    /**
     * A text field. In fixed layouts [box] is absolute; in flow layouts `box.yMm` is the gap before the
     * element and `box.hMm` the most height one element may take before the fit rule shrinks it.
     */
    data class Text(
        override val bind: Binding,
        override val box: MmBox,
        val font: FontChoice,
        val weight: FontWeight,
        val size: SizeRange,
        val maxLines: Int,
        val align: Align,
        val overflow: Overflow,
        val direction: TextDirection,
    ) : Bound

    /** A caption from [Template.captions] in the label language (spec §3.3); a separate element from its value. */
    data class Caption(
        val key: String,
        override val box: MmBox,
        val font: FontChoice,
        val weight: FontWeight,
        val size: SizeRange,
        val align: Align,
    ) : Element

    /**
     * Flow layouts only: one row per item of a list binding (receipt lines or totals), a description
     * column and an amount column, each with its own box (x and width; y is the gap before the row).
     */
    data class Rows(
        override val bind: Binding,
        override val box: MmBox,
        val font: FontChoice,
        val weight: FontWeight,
        val size: SizeRange,
        val descriptionWidthMm: Double,
        val amountWidthMm: Double,
    ) : Bound

    /**
     * A barcode (spec §6): DataMatrix ECC 200 for wristbands; DataMatrix or Code 128 for specimen labels
     * (the LIS decides, OQ-240). [moduleMm] is the module (cell) or narrow-bar width.
     */
    data class Barcode(
        override val bind: Binding,
        override val box: MmBox,
        val symbology: Symbology,
        val moduleMm: Double,
    ) : Bound

    /** A filled rectangle (a rule or a frame edge); prints no content. */
    data class Rule(
        override val box: MmBox,
    ) : Element
}

/** A print template (spec §4.1). */
data class Template(
    val id: String,
    val version: Int,
    /** SHA-256 (hex) of the canonical template source; with id and version it keys first-band verification. */
    val contentHash: String,
    val provenance: Provenance,
    val kind: TemplateKind,
    val media: Media,
    /** Caption key → text per label language (catalogue text; spec §3.3, §13). */
    val captions: Map<String, Map<LabelLanguage, String>>,
    val elements: List<Element>,
)
