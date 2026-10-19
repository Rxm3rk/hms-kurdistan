package hms.platform.docs.domain.template

import hms.platform.docs.api.LabelLanguage
import hms.platform.docs.domain.rules.TextChecks
import kotlin.math.abs
import kotlin.math.max

/**
 * One reason a template is refused (docs/specs/modules/platform-docs.md §4.3).
 *
 * @property rule the rule number of spec §4.3 (1 to 10)
 * @property elementIndex the index of the element in [Template.elements], or null for the template as a whole
 * @property message what is wrong, in terms of bindings, keys and geometry (templates hold no patient data)
 */
data class LintFinding(
    val rule: Int,
    val elementIndex: Int?,
    val message: String,
)

/**
 * The legibility minimum of identity text, configuration [P] (spec §5.4, OQ-243, DN-069): Arabic-script text
 * 8 pt below 12 dots/mm and 7 pt at 12 dots/mm or more; Latin text 6 pt. S7-K tests these with the
 * dot-differentiated letters ب ت ث ن ی پ and the CSO confirms them.
 */
data class LegibilityPolicy(
    val arabicMinPt: Double = DEFAULT_ARABIC_MIN_PT,
    val arabicMinPtHighResolution: Double = DEFAULT_ARABIC_MIN_PT_HIGH_RESOLUTION,
    val latinMinPt: Double = DEFAULT_LATIN_MIN_PT,
    /** From this resolution up, [arabicMinPtHighResolution] applies (12 dots/mm = 300 dpi). */
    val highResolutionDotsPerMm: Double = DEFAULT_HIGH_RESOLUTION_DOTS_PER_MM,
) {
    companion object {
        const val DEFAULT_ARABIC_MIN_PT: Double = 8.0
        const val DEFAULT_ARABIC_MIN_PT_HIGH_RESOLUTION: Double = 7.0
        const val DEFAULT_LATIN_MIN_PT: Double = 6.0
        const val DEFAULT_HIGH_RESOLUTION_DOTS_PER_MM: Double = 12.0
    }

    /** The smallest size identity text in [role] may print at [dotsPerMm]. */
    fun minimumPt(
        role: FontRole,
        dotsPerMm: Double,
    ): Double =
        when (role) {
            FontRole.ARABIC -> if (dotsPerMm >= highResolutionDotsPerMm) arabicMinPtHighResolution else arabicMinPt
            FontRole.LATIN -> latinMinPt
        }
}

/**
 * The template linter (spec §4.3; CTRL-0001-5's proposed linter, a recorded tightening). It runs when a template
 * loads, again before every layout, and in the fast tier over every file in `content/print-templates/`. An empty
 * list means the template is valid; otherwise the template is refused (`print.refused.templateInvalid`).
 *
 * Rule 7's "a caption and a value in one element" cannot be expressed in the model (a [Element.Caption] holds a
 * key, a [Element.Text] a binding); the linter checks the font and direction choices that would mix scripts or
 * reorder an identifier instead. Rule 2's "a field outside the closed set" is the loader's (an unknown binding
 * name has no [Binding]); the linter checks that each binding belongs to the kind and suits its element type.
 */
object TemplateLint {
    /** The smallest barcode module (spec §4.3 rule 6). */
    const val MIN_MODULE_MM: Double = 0.25

    /** DataMatrix quiet zone, in modules, on every side (rule 6). */
    const val DATAMATRIX_QUIET_MODULES: Int = 1

    /** Code 128 quiet zone, in modules, left and right (rule 6). */
    const val CODE128_QUIET_MODULES: Int = 10

    /**
     * How far the human-readable specimen ID may be from its barcode, in millimetres, to count as "next to it"
     * (rule 4). The spec gives no number; 3 mm is this build's [P] value (reported as a spec issue).
     */
    const val SPECIMEN_ID_MAX_GAP_MM: Double = 3.0

    /**
     * How far the `approximate` caption may be from a date-of-birth element on a fixed layout to count as "beside
     * the date" (rule 1). The spec gives no number; 3 mm is this build's [P] value, the same as rule 4's. On a flow
     * layout the caption must be the element right before or right after a date-of-birth element.
     */
    const val APPROXIMATE_MAX_GAP_MM: Double = 3.0

    /** Every finding of rules 1 to 10, in rule order. */
    fun lint(
        template: Template,
        legibility: LegibilityPolicy = LegibilityPolicy(),
    ): List<LintFinding> =
        PresenceRules.rule1(template) +
            PresenceRules.rule2(template) +
            TextRules.rule3(template) +
            PresenceRules.rule4(template) +
            PresenceRules.rule5(template) +
            GeometryRules.rule6(template) +
            TextRules.rule7(template) +
            TextRules.rule8(template) +
            PresenceRules.rule9(template) +
            TextRules.rule10(template, legibility)

    /** The symbol box grown by its quiet zone (rule 6); the layout and writers keep it clear. */
    fun quietZone(barcode: Element.Barcode): MmBox = GeometryRules.quietZone(barcode)
}

private val Template.indexed: List<IndexedValue<Element>> get() = elements.withIndex().toList()

private fun Template.texts(): List<IndexedValue<Element.Text>> =
    indexed.mapNotNull { (i, e) -> (e as? Element.Text)?.let { IndexedValue(i, it) } }

private fun Template.barcodes(): List<IndexedValue<Element.Barcode>> =
    indexed.mapNotNull { (i, e) -> (e as? Element.Barcode)?.let { IndexedValue(i, it) } }

private fun Template.binds(binding: Binding): Boolean = elements.any { it is Element.Bound && it.bind == binding }

/** Rules 1, 2, 4, 5 and 9: what a template of each kind must and must not contain. */
private object PresenceRules {
    private val identitySlots =
        listOf(Binding.IDENTITY_NAME_OWN, Binding.IDENTITY_NAME_LATIN, Binding.IDENTITY_MRN, Binding.IDENTITY_BIRTH_DATE)

    /**
     * Rule 1 (CTRL-0001-5), plus the `approximate` caption R5 needs whenever the date of birth is approximate, beside
     * the date: within [TemplateLint.APPROXIMATE_MAX_GAP_MM] of a date-of-birth element on a fixed layout, the element
     * right before or after one on a flow layout (where element order is reading order, spec §4.3).
     */
    fun rule1(template: Template): List<LintFinding> {
        if (!template.kind.patientPrint) return emptyList()
        val missingSlots =
            identitySlots
                .filter { slot -> template.texts().none { it.value.bind == slot } }
                .map { LintFinding(rule = 1, null, "a ${template.kind.yamlName} template has no text element bound to ${it.yamlName}") }
        val approximate = template.indexed.filter { (_, e) -> e is Element.Caption && e.key == CaptionKeys.APPROXIMATE }
        val dates = template.texts().filter { it.value.bind == Binding.IDENTITY_BIRTH_DATE }
        val none =
            if (approximate.isEmpty()) {
                listOf(LintFinding(rule = 1, null, "no '${CaptionKeys.APPROXIMATE}' caption for an approximate date of birth (R5)"))
            } else {
                emptyList()
            }
        val notBeside =
            approximate
                .filter { caption -> dates.none { date -> beside(template, caption, date) } }
                .map { LintFinding(rule = 1, it.index, "the '${CaptionKeys.APPROXIMATE}' caption is not beside the date of birth") }
        return missingSlots + none + notBeside
    }

    private fun beside(
        template: Template,
        caption: IndexedValue<Element>,
        date: IndexedValue<Element.Text>,
    ): Boolean =
        if (template.kind.flow) {
            abs(caption.index - date.index) == 1
        } else {
            Boxes.gap(caption.value.box, date.value.box) <= TemplateLint.APPROXIMATE_MAX_GAP_MM + Boxes.EPSILON
        }

    /** Rule 2: every binding belongs to the kind and suits its element type (so nothing binds a room or bed, R2). */
    fun rule2(template: Template): List<LintFinding> =
        template.indexed.flatMap { (i, element) ->
            if (element !is Element.Bound) {
                emptyList()
            } else {
                listOfNotNull(
                    if (element.bind in KindBindings.allowed(template.kind)) {
                        null
                    } else {
                        LintFinding(rule = 2, i, "binds ${element.bind.yamlName}, which a ${template.kind.yamlName} does not have")
                    },
                    if (KindBindings.fitsElement(element)) {
                        null
                    } else {
                        LintFinding(rule = 2, i, "a ${element::class.simpleName} element cannot carry ${element.bind.yamlName}")
                    },
                )
            }
        }

    /** Rule 4 (§12.8): the wristband's DataMatrix; the specimen label's barcode with its human-readable ID beside it. */
    fun rule4(template: Template): List<LintFinding> =
        when (template.kind) {
            TemplateKind.WRISTBAND -> wristbandBarcode(template)
            TemplateKind.SPECIMEN_LABEL -> specimenBarcode(template)
            else -> emptyList()
        }

    private fun wristbandBarcode(template: Template): List<LintFinding> {
        val bound = template.barcodes().filter { it.value.bind == Binding.BARCODE_WRISTBAND }
        val wrongSymbology =
            bound
                .filter { it.value.symbology != Symbology.DATAMATRIX }
                .map { LintFinding(rule = 4, it.index, "the wristband barcode must be a DataMatrix") }
        val none =
            if (bound.none { it.value.symbology == Symbology.DATAMATRIX }) {
                listOf(LintFinding(rule = 4, null, "a wristband has no DataMatrix bound to ${Binding.BARCODE_WRISTBAND.yamlName}"))
            } else {
                emptyList()
            }
        return none + wrongSymbology
    }

    private fun specimenBarcode(template: Template): List<LintFinding> {
        val bound = template.barcodes().filter { it.value.bind == Binding.BARCODE_SPECIMEN }
        val ids = template.texts().filter { it.value.bind == Binding.SPECIMEN_ID }
        val none =
            if (bound.isEmpty()) {
                listOf(LintFinding(rule = 4, null, "a specimen label has no barcode bound to ${Binding.BARCODE_SPECIMEN.yamlName}"))
            } else {
                emptyList()
            }
        val notBeside =
            bound
                .filter { barcode -> ids.none { Boxes.gap(it.value.box, barcode.value.box) <= TemplateLint.SPECIMEN_ID_MAX_GAP_MM } }
                .map {
                    LintFinding(
                        rule = 4,
                        it.index,
                        "no ${Binding.SPECIMEN_ID.yamlName} text within ${TemplateLint.SPECIMEN_ID_MAX_GAP_MM} mm of the barcode",
                    )
                }
        return none + notBeside
    }

    /** Rule 5 (SI-16 for documents, CTRL-0016-5; DP-8, DN-070): the banner on documents, a watermark on every patient print. */
    fun rule5(template: Template): List<LintFinding> {
        val banner =
            if (template.kind == TemplateKind.DOCUMENT && !template.binds(Binding.DOCUMENT_BANNER)) {
                LintFinding(rule = 5, null, "a document has no ${Binding.DOCUMENT_BANNER.yamlName} element")
            } else {
                null
            }
        val watermark =
            if (template.kind.patientPrint && !template.binds(Binding.WATERMARK)) {
                LintFinding(rule = 5, null, "a ${template.kind.yamlName} template has no ${Binding.WATERMARK.yamlName} element")
            } else {
                null
            }
        return listOfNotNull(banner, watermark)
    }

    /** Rule 9 (§19.4): a synthetic template prints "SYNTHETIC – NOT FOR CLINICAL USE" visibly. */
    fun rule9(template: Template): List<LintFinding> =
        if (template.provenance == Provenance.SYNTHETIC && template.texts().none { it.value.bind == Binding.NOTICE_SYNTHETIC }) {
            listOf(LintFinding(rule = 9, null, "a synthetic template has no ${Binding.NOTICE_SYNTHETIC.yamlName} element"))
        } else {
            emptyList()
        }
}

/** Rules 3, 7, 8 and 10: how text may be sized, which fonts and directions it uses, and its captions. */
private object TextRules {
    /** Rule 3: identity text can never be clipped; non-identity text on a fixed layout refuses rather than overflows. */
    fun rule3(template: Template): List<LintFinding> =
        template.indexed.flatMap { (i, element) ->
            val size =
                when (element) {
                    is Element.Text -> element.size
                    is Element.Caption -> element.size
                    is Element.Rows -> element.size
                    else -> null
                }
            val sizeFinding =
                size?.takeUnless { it.minPt > 0.0 && it.maxPt >= it.minPt && it.maxPt.isFinite() }?.let {
                    LintFinding(rule = 3, i, "size_pt needs 0 < min <= max")
                }
            listOfNotNull(sizeFinding) + ((element as? Element.Text)?.let { textClipping(template, i, it) }.orEmpty())
        }

    private fun textClipping(
        template: Template,
        index: Int,
        text: Element.Text,
    ): List<LintFinding> =
        listOfNotNull(
            if (text.maxLines < 1) LintFinding(rule = 3, index, "max_lines below 1") else null,
            when {
                text.overflow == Overflow.REFUSE -> null
                text.bind.identity -> LintFinding(rule = 3, index, "identity text ${text.bind.yamlName} must have overflow refuse")
                !template.kind.flow -> LintFinding(rule = 3, index, "text on a fixed layout must have overflow refuse")
                else -> null
            },
        )

    /** Rule 7: one script per element; identifiers Latin and left-to-right; identity text and captions in one font. */
    fun rule7(template: Template): List<LintFinding> =
        template.indexed.flatMap { (i, element) ->
            when (element) {
                is Element.Text -> {
                    textFont(i, element)
                }

                is Element.Caption -> {
                    if (element.font == FontChoice.MIXED) {
                        listOf(LintFinding(rule = 7, i, "a caption uses one font, never mixed"))
                    } else {
                        emptyList()
                    }
                }

                else -> {
                    emptyList()
                }
            }
        }

    private fun textFont(
        index: Int,
        text: Element.Text,
    ): List<LintFinding> {
        val bind = text.bind
        return listOfNotNull(
            if (bind.identity && text.font == FontChoice.MIXED) {
                LintFinding(rule = 7, index, "identity text ${bind.yamlName} uses one font, never mixed")
            } else {
                null
            },
            if (bind == Binding.IDENTITY_NAME_OWN && text.font != FontChoice.BY_SCRIPT) {
                LintFinding(rule = 7, index, "${bind.yamlName} must use font by-script (the own form may be Arabic or Latin script)")
            } else {
                null
            },
            if (bind == Binding.IDENTITY_NAME_LATIN && text.font != FontChoice.LATIN && text.font != FontChoice.BY_SCRIPT) {
                LintFinding(rule = 7, index, "${bind.yamlName} must use font latin or by-script")
            } else {
                null
            },
            if (bind in KindBindings.IDENTIFIER_TEXT && (text.font != FontChoice.LATIN || text.direction != TextDirection.LTR)) {
                LintFinding(rule = 7, index, "${bind.yamlName} must use font latin and direction ltr (never reordered)")
            } else {
                null
            },
        )
    }

    /** Rule 8: every caption has renderable text in en, ckb and ar (the banner captions too, when the banner is bound). */
    fun rule8(template: Template): List<LintFinding> {
        val used =
            template.indexed.mapNotNull { (i, e) -> (e as? Element.Caption)?.let { it.key to i } } +
                template.indexed
                    .filter { (_, e) -> e is Element.Rows && e.bind == Binding.DOCUMENT_BANNER }
                    .flatMap { (i, _) -> CaptionKeys.BANNER.map { it to i } }
        return used.flatMap { (key, index) ->
            LabelLanguage.entries.mapNotNull { language -> captionFinding(template, key, language, index) }
        }
    }

    private fun captionFinding(
        template: Template,
        key: String,
        language: LabelLanguage,
        index: Int,
    ): LintFinding? {
        val text = template.captions[key]?.get(language)
        val problem =
            when {
                text.isNullOrBlank() -> "has no text"
                else -> (TextChecks.unrenderable(text) ?: TextChecks.easternDigit(text))?.let { "is not printable ($it)" }
            }
        return problem?.let { LintFinding(rule = 8, index, "caption '$key' in ${language.tag} $it") }
    }

    /**
     * Rule 10 (§5.4): the minimum size of identity text and of the `approximate` caption (subject to the legibility
     * minimum like identity text, R5) is at least the legibility minimum at the template's lowest resolution, for
     * every font role the element can resolve to.
     */
    fun rule10(
        template: Template,
        legibility: LegibilityPolicy,
    ): List<LintFinding> {
        val identity =
            template.texts().filter { it.value.bind.identity }.map { (i, text) ->
                Legible(i, text.bind.yamlName, text.size.minPt, roles(template, text))
            }
        val approximate =
            template.indexed.mapNotNull { (i, e) ->
                (e as? Element.Caption)?.takeIf { it.key == CaptionKeys.APPROXIMATE }?.let {
                    Legible(i, "caption '${CaptionKeys.APPROXIMATE}'", it.size.minPt, roles(it.font, null))
                }
            }
        return (identity + approximate).mapNotNull { element ->
            val required = element.roles.maxOf { legibility.minimumPt(it, template.media.minDotsPerMm) }
            if (element.minPt < required) {
                LintFinding(
                    rule = 10,
                    element.index,
                    "${element.name} minimum ${element.minPt} pt is below the legibility minimum $required pt " +
                        "at ${template.media.minDotsPerMm} dots/mm",
                )
            } else {
                null
            }
        }
    }

    /** An element rule 10 applies to: its index, name, minimum size and the font roles it may resolve to. */
    private data class Legible(
        val index: Int,
        val name: String,
        val minPt: Double,
        val roles: Set<FontRole>,
    )

    /**
     * The font roles a text element may resolve to. A document's `identity.name.latin` element also prints every
     * other recorded name form below the Latin one (spec §4.1), each in its own script, so it may resolve to either.
     */
    private fun roles(
        template: Template,
        text: Element.Text,
    ): Set<FontRole> =
        if (template.kind == TemplateKind.DOCUMENT && text.bind == Binding.IDENTITY_NAME_LATIN) {
            setOf(FontRole.ARABIC, FontRole.LATIN)
        } else {
            roles(text.font, text.bind)
        }

    private fun roles(
        font: FontChoice,
        bind: Binding?,
    ): Set<FontRole> =
        when (font) {
            FontChoice.ARABIC -> {
                setOf(FontRole.ARABIC)
            }

            FontChoice.LATIN -> {
                setOf(FontRole.LATIN)
            }

            FontChoice.BY_SCRIPT -> {
                if (bind == Binding.IDENTITY_NAME_LATIN) setOf(FontRole.LATIN) else setOf(FontRole.ARABIC, FontRole.LATIN)
            }

            FontChoice.BY_LABEL_LANGUAGE, FontChoice.MIXED -> {
                setOf(FontRole.ARABIC, FontRole.LATIN)
            }
        }
}

/** Rule 6: everything on the printable area, no overlaps, barcode modules and quiet zones. */
private object GeometryRules {
    private val rotations = setOf(0, Media.ROTATED)

    fun rule6(template: Template): List<LintFinding> =
        media(template) +
            template.indexed.flatMap { (i, element) -> placement(template, i, element) } +
            overlaps(template) +
            template.barcodes().flatMap { barcode(template, it.index, it.value) }

    private fun media(template: Template): List<LintFinding> {
        val media = template.media
        val frame = MmBox(0.0, 0.0, media.frameWidthMm, media.frameHeightMm)
        return listOfNotNull(
            if (media.rotation in rotations) null else LintFinding(rule = 6, null, "rotation must be 0 or 90"),
            if (Boxes.positive(frame)) null else LintFinding(rule = 6, null, "media width and length must be positive"),
            if (Boxes.positive(media.printable) && Boxes.inside(media.printable, frame)) {
                null
            } else {
                LintFinding(rule = 6, null, "the printable area must lie on the media")
            },
            if (media.minDotsPerMm > 0.0) null else LintFinding(rule = 6, null, "the lowest resolution must be positive"),
        )
    }

    private fun placement(
        template: Template,
        index: Int,
        element: Element,
    ): List<LintFinding> {
        val box = element.box
        val printable = template.media.printable
        val onArea =
            if (template.kind.flow) {
                // Flow kinds: box.y is the gap before the element; only the horizontal extent is absolute.
                box.yMm >= 0.0 && box.xMm >= printable.xMm - Boxes.EPSILON &&
                    box.xMm + box.wMm <= printable.xMm + printable.wMm + Boxes.EPSILON
            } else {
                Boxes.inside(box, printable)
            }
        return listOfNotNull(
            if (Boxes.positive(box)) null else LintFinding(rule = 6, index, "the box must have a positive width and height"),
            if (onArea) null else LintFinding(rule = 6, index, "the element lies outside the printable area"),
            (element as? Element.Rows)?.let { rows ->
                if (rows.descriptionWidthMm > 0.0 && rows.amountWidthMm > 0.0 &&
                    rows.descriptionWidthMm + rows.amountWidthMm <= box.wMm + Boxes.EPSILON
                ) {
                    null
                } else {
                    LintFinding(rule = 6, index, "the row columns must be positive and fit side by side in the box")
                }
            },
        )
    }

    /** Fixed kinds: no two boxes intersect (touching edges do not). Flow kinds stack and never overlap. */
    private fun overlaps(template: Template): List<LintFinding> {
        if (template.kind.flow) return emptyList()
        val all = template.indexed
        return all.flatMap { (i, a) ->
            all.filter { (j, b) -> j > i && Boxes.intersect(a.box, b.box) }.map { (j, _) ->
                LintFinding(rule = 6, i, "the box intersects the box of element $j")
            }
        }
    }

    private fun barcode(
        template: Template,
        index: Int,
        barcode: Element.Barcode,
    ): List<LintFinding> {
        val quiet = quietZone(barcode)
        val media = template.media
        val frame = MmBox(0.0, 0.0, media.frameWidthMm, media.frameHeightMm)
        val intruders =
            if (template.kind.flow) {
                emptyList()
            } else {
                template.indexed.filter { (j, other) -> j != index && Boxes.intersect(quiet, other.box) }
            }
        return listOfNotNull(
            if (barcode.moduleMm >= TemplateLint.MIN_MODULE_MM) {
                null
            } else {
                LintFinding(rule = 6, index, "the barcode module is below ${TemplateLint.MIN_MODULE_MM} mm")
            },
            if (Boxes.inside(quiet, frame)) null else LintFinding(rule = 6, index, "the barcode's quiet zone runs off the media"),
        ) + intruders.map { (j, _) -> LintFinding(rule = 6, index, "element $j enters the barcode's quiet zone") }
    }

    /** The symbol box grown by its quiet zone: one module on every side (DataMatrix), ten left and right (Code 128). */
    fun quietZone(barcode: Element.Barcode): MmBox {
        val box = barcode.box
        val (horizontal, vertical) =
            when (barcode.symbology) {
                Symbology.DATAMATRIX -> {
                    (TemplateLint.DATAMATRIX_QUIET_MODULES * barcode.moduleMm).let { it to it }
                }

                Symbology.CODE128 -> {
                    TemplateLint.CODE128_QUIET_MODULES * barcode.moduleMm to 0.0
                }
            }
        return MmBox(box.xMm - horizontal, box.yMm - vertical, box.wMm + 2 * horizontal, box.hMm + 2 * vertical)
    }
}

/** Rectangle arithmetic in millimetres; a tolerance absorbs binary rounding of decimal millimetres. */
internal object Boxes {
    const val EPSILON: Double = 1e-9

    fun positive(box: MmBox): Boolean = box.wMm > 0.0 && box.hMm > 0.0 && box.wMm.isFinite() && box.hMm.isFinite()

    fun inside(
        inner: MmBox,
        outer: MmBox,
    ): Boolean =
        inner.xMm >= outer.xMm - EPSILON &&
            inner.yMm >= outer.yMm - EPSILON &&
            inner.xMm + inner.wMm <= outer.xMm + outer.wMm + EPSILON &&
            inner.yMm + inner.hMm <= outer.yMm + outer.hMm + EPSILON

    /** True when the interiors overlap; boxes that only touch do not intersect. */
    fun intersect(
        a: MmBox,
        b: MmBox,
    ): Boolean =
        a.xMm < b.xMm + b.wMm - EPSILON &&
            b.xMm < a.xMm + a.wMm - EPSILON &&
            a.yMm < b.yMm + b.hMm - EPSILON &&
            b.yMm < a.yMm + a.hMm - EPSILON

    /** The larger of the horizontal and vertical gaps between two boxes (0 when they touch or overlap). */
    fun gap(
        a: MmBox,
        b: MmBox,
    ): Double {
        val horizontal = max(0.0, max(a.xMm - (b.xMm + b.wMm), b.xMm - (a.xMm + a.wMm)))
        val vertical = max(0.0, max(a.yMm - (b.yMm + b.hMm), b.yMm - (a.yMm + a.hMm)))
        return max(horizontal, vertical)
    }
}
