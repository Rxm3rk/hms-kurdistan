package hms.platform.docs.domain.rules

import hms.platform.docs.api.BirthDate
import hms.platform.docs.api.DatePrecision
import hms.platform.docs.api.DocumentBlock
import hms.platform.docs.api.DocumentContent
import hms.platform.docs.api.LabelledText
import hms.platform.docs.api.NameForm
import hms.platform.docs.api.OutputMode
import hms.platform.docs.api.PatientIdentity
import hms.platform.docs.api.PrintAllergies
import hms.platform.docs.api.PrintAllergy
import hms.platform.docs.api.PrintBanner
import hms.platform.docs.api.PrintContent
import hms.platform.docs.api.PrinterProfile
import hms.platform.docs.api.ReceiptContent
import hms.platform.docs.api.ReceiptLine
import hms.platform.docs.api.Refusal
import hms.platform.docs.api.RefusalReason
import hms.platform.docs.api.ReprintReason
import hms.platform.docs.api.Script
import hms.platform.docs.api.SpecimenLabelContent
import hms.platform.docs.api.TokenContent
import hms.platform.docs.api.WristbandContent
import hms.platform.docs.domain.layout.Dots
import hms.platform.docs.domain.template.Binding
import hms.platform.docs.domain.template.CaptionKeys
import hms.platform.docs.domain.template.Media
import hms.platform.docs.domain.template.TemplateKind
import java.time.YearMonth
import java.time.ZoneId
import kotlin.math.abs

/** The outcome of the content rules: the content as it will print, or the first rule it breaks. */
sealed interface ContentCheck {
    data class Valid(
        val content: ResolvedContent,
    ) : ContentCheck

    data class Refused(
        val refusal: Refusal,
    ) : ContentCheck
}

/**
 * The SI-01 content rules R1 to R8 and R10 (docs/specs/modules/platform-docs.md §3.2; BUILD-PROMPT §2.1 SI-01
 * and SI-21, §12.8). They run before layout; a failure is a refusal, never a partial print. R6 (never
 * truncated) and the glyph half of R7 need the shaper and run in the layout ([hms.platform.docs.domain.layout.Fitter]);
 * R2 is the template linter's ([hms.platform.docs.domain.template.TemplateLint]); R9 holds because the barcode
 * payload is built from the [ResolvedContent] this returns.
 *
 * The rules run in a fixed order and the first failure is returned: R1 (identifiers present), R3 (both
 * scripts, confirmed), R10 (redaction obligations), R7 (renderable characters, on every text as it will print,
 * redacted forms included), R8 (no Arabic-Indic digits in any printed text: the spec's identifiers, widened by
 * the round-2 review because no configured non-clinical patient text exists yet), R4 (identifier alphabet),
 * R5 (date-of-birth form). The label language does not enter: it chooses captions only and never
 * changes a name form (spec §3.3). A token carries no patient and so no identity rule applies to it.
 *
 * A refusal's `subject` is the binding name of the field; its `detail` names a code-point category or the
 * rule's condition, never the text (spec §3.2).
 */
object ContentRules {
    /**
     * The approximate-DOB marker, language-independent (spec §3.3), prefixed to the date with no space so
     * that no line can break between them. It is `~` (U+007E) because the pinned print fonts have no `≈`.
     */
    const val APPROXIMATE_MARKER: String = "~"

    /**
     * Checks [content] against the rules.
     *
     * @param redactLabels the sensitivity labels whose redacted form the policy decision requires (spec §8.4)
     * @param zone the tenant's zone, for printed times (`YYYY-MM-DD HH:mm`, Western digits)
     */
    fun check(
        content: PrintContent,
        redactLabels: Set<String>,
        zone: ZoneId,
    ): ContentCheck {
        val drafted =
            when (content) {
                is PrintContent.Wristband -> KindDrafts.wristband(content.content)
                is PrintContent.SpecimenLabel -> KindDrafts.specimen(content.content, redactLabels, zone)
                is PrintContent.Receipt -> KindDrafts.receipt(content.content, redactLabels, zone)
                is PrintContent.Token -> Checked.Ok(KindDrafts.token(content.content, zone))
                is PrintContent.Document -> KindDrafts.document(content.content, redactLabels)
            }
        return when (drafted) {
            is Checked.Fail -> ContentCheck.Refused(drafted.refusal)
            is Checked.Ok -> verify(drafted.value)
        }
    }

    /** The date of birth as it prints (R5): the recorded parts, with `~` when approximate or coarser than a day. */
    fun printedBirthDate(birthDate: BirthDate): String =
        if (isApproximate(birthDate)) "$APPROXIMATE_MARKER${birthDate.value}" else birthDate.value

    /** True when the approximate marker and caption print (R5). */
    fun isApproximate(birthDate: BirthDate): Boolean = birthDate.approximate || birthDate.precision != DatePrecision.DAY

    private fun verify(draft: Draft): ContentCheck {
        val refusal =
            CharacterRules.r7(draft) ?: CharacterRules.r8(draft) ?: CharacterRules.r4(draft)
                ?: draft.birthDate?.let(CharacterRules::r5)
        return if (refusal != null) ContentCheck.Refused(refusal) else ContentCheck.Valid(draft.resolve())
    }
}

/** The content of each kind, drafted: identity first (R1, R3), then the kind's fields with R10 applied. */
private object KindDrafts {
    /** Separator of a specimen label's tests. */
    private const val LIST_SEPARATOR: String = ", "

    fun wristband(content: WristbandContent): Checked<Draft> {
        val encounter = content.encounterId
        return IdentityRules.patient(TemplateKind.WRISTBAND, content.identity).then { draft ->
            if (encounter == null) {
                IdentityRules.missing(Binding.ENCOUNTER_ID)
            } else {
                Checked.Ok(draft.apply { identifier(Binding.ENCOUNTER_ID, encounter) })
            }
        }
    }

    fun specimen(
        content: SpecimenLabelContent,
        redactLabels: Set<String>,
        zone: ZoneId,
    ): Checked<Draft> {
        val specimenId = content.specimenId
        return IdentityRules.patient(TemplateKind.SPECIMEN_LABEL, content.identity).then { draft ->
            if (specimenId == null) {
                IdentityRules.missing(Binding.SPECIMEN_ID)
            } else {
                Redaction
                    .all(content.tests, redactLabels, Binding.SPECIMEN_TESTS)
                    .then { tests ->
                        Redaction.one(content.specimenType, redactLabels, Binding.SPECIMEN_TYPE).map { type -> type to tests }
                    }.map { (type, tests) ->
                        draft.apply {
                            identifier(Binding.SPECIMEN_ID, specimenId)
                            optionalText(Binding.SPECIMEN_TYPE, type)
                            text(Binding.SPECIMEN_COLLECTED_AT, PrintTime.format(content.collectedAt, zone))
                            optionalText(Binding.SPECIMEN_TESTS, tests.joinToString(LIST_SEPARATOR).ifBlank { null })
                        }
                    }
            }
        }
    }

    fun receipt(
        content: ReceiptContent,
        redactLabels: Set<String>,
        zone: ZoneId,
    ): Checked<Draft> =
        IdentityRules.patient(TemplateKind.RECEIPT, content.identity).then { draft ->
            receiptRows(content.lines, redactLabels, Binding.RECEIPT_LINES).then { lines ->
                receiptRows(content.totals, redactLabels, Binding.RECEIPT_TOTALS).map { totals ->
                    draft.apply {
                        identifier(Binding.RECEIPT_NUMBER, content.receiptNumber)
                        segments(Binding.RECEIPT_ISSUER, content.issuerLines.filter { it.isNotBlank() })
                        rows(Binding.RECEIPT_LINES, lines)
                        rows(Binding.RECEIPT_TOTALS, totals)
                        optionalText(Binding.RECEIPT_CASHIER, content.cashier)
                        text(Binding.RECEIPT_ISSUED_AT, PrintTime.format(content.issuedAt, zone))
                    }
                }
            }
        }

    private fun receiptRows(
        lines: List<ReceiptLine>,
        redactLabels: Set<String>,
        binding: Binding,
    ): Checked<List<ResolvedRow>> =
        Redaction.all(lines.map { it.description }, redactLabels, binding).map { descriptions ->
            descriptions.zip(lines) { description, line -> ResolvedRow(Cell.Literal(description), Cell.Literal(line.amount)) }
        }

    fun token(
        content: TokenContent,
        zone: ZoneId,
    ): Draft =
        Draft(TemplateKind.TOKEN).apply {
            text(Binding.TOKEN_NUMBER, content.tokenNumber)
            text(Binding.TOKEN_SERVICE_POINT, content.servicePoint)
            text(Binding.TOKEN_ISSUED_AT, PrintTime.format(content.issuedAt, zone))
        }

    fun document(
        content: DocumentContent,
        redactLabels: Set<String>,
    ): Checked<Draft> =
        IdentityRules.patient(TemplateKind.DOCUMENT, content.identity).then { draft ->
            Redaction.one(content.title, redactLabels, Binding.DOCUMENT_TITLE).then { title ->
                Banner.rows(content.banner, redactLabels).then { banner ->
                    Redaction.blocks(content.blocks, redactLabels).map { blocks ->
                        draft.apply {
                            optionalText(Binding.DOCUMENT_TITLE, title)
                            rows(Binding.DOCUMENT_BANNER, banner)
                            body(blocks)
                            otherNameForms(content.identity)
                        }
                    }
                }
            }
        }
}

/** R1 and R3 on the patient identity. */
private object IdentityRules {
    fun patient(
        kind: TemplateKind,
        identity: PatientIdentity,
    ): Checked<Draft> = checkedIdentity(identity).map { checked -> Draft(kind).apply { identity(checked) } }

    private fun checkedIdentity(identity: PatientIdentity): Checked<CheckedIdentity> =
        noName(identity)?.let { Checked.Fail(it) }
            ?: present(identity.mrn, Binding.IDENTITY_MRN).then { mrn ->
                present(identity.birthDate, Binding.IDENTITY_BIRTH_DATE).then { birthDate ->
                    ownName(identity).then { (ownForm, ownName) ->
                        latinName(identity).map { latin ->
                            CheckedIdentity(ownForm, ownName, latin, mrn, birthDate, identity.sex)
                        }
                    }
                }
            }

    /** R1: a patient print carries the name; with no name form at all it is refused. */
    private fun noName(identity: PatientIdentity): Refusal? =
        if (identity.names.values.all { it.isBlank() }) {
            Refusal(RefusalReason.IDENTIFIER_MISSING, Binding.IDENTITY_NAME_OWN.yamlName, "no name form recorded")
        } else {
            null
        }

    /** R1: the MRN and the date of birth are recorded (DN-073: a patient with no date-of-birth value is refused). */
    private fun <T : Any> present(
        value: T?,
        binding: Binding,
    ): Checked<T> = if (value == null) missing(binding) else Checked.Ok(value)

    fun missing(binding: Binding): Checked<Nothing> =
        Checked.Fail(Refusal(RefusalReason.IDENTIFIER_MISSING, binding.yamlName, "not recorded"))

    /** R3: the name in the patient's own form is present. */
    private fun ownName(identity: PatientIdentity): Checked<Pair<NameForm, String>> {
        val ownForm = identity.ownForm
        val name = ownForm?.let { identity.names[it] }
        return when {
            ownForm == null -> incomplete(Binding.IDENTITY_NAME_OWN, "own form not recorded")
            name.isNullOrBlank() -> incomplete(Binding.IDENTITY_NAME_OWN, "name in the own form missing")
            else -> Checked.Ok(ownForm to name)
        }
    }

    /**
     * R3: the Latin form is present and registrar-confirmed (CTRL-0001-6, a recorded tightening). The
     * confirmation is required for a patient whose own form is Latin too (the stricter reading).
     */
    private fun latinName(identity: PatientIdentity): Checked<String> {
        val latin = identity.names[NameForm.LATIN]
        return when {
            latin.isNullOrBlank() -> incomplete(Binding.IDENTITY_NAME_LATIN, "Latin form missing")
            !identity.latinConfirmed -> incomplete(Binding.IDENTITY_NAME_LATIN, "Latin form not confirmed by the registrar")
            else -> Checked.Ok(latin)
        }
    }

    private fun incomplete(
        binding: Binding,
        detail: String,
    ): Checked<Nothing> = Checked.Fail(Refusal(RefusalReason.IDENTITY_INCOMPLETE, binding.yamlName, detail))
}

/** The character and form rules R7, R8, R4 and R5, on the draft. */
private object CharacterRules {
    private const val MAX_MONTH: Int = 12
    private val dayPattern = Regex("^([0-9]{4})-([0-9]{2})-([0-9]{2})$")
    private val monthPattern = Regex("^([0-9]{4})-([0-9]{2})$")
    private val yearPattern = Regex("^[0-9]{4}$")

    fun r7(draft: Draft): Refusal? =
        draft.printed.firstNotNullOfOrNull { (subject, text) ->
            TextChecks.unrenderable(text)?.let { Refusal(RefusalReason.UNRENDERABLE_TEXT, subject, it) }
        }

    /** R8: refused, never converted (spec §11.1); on every printed text since the round-2 review. */
    fun r8(draft: Draft): Refusal? =
        draft.printed.firstNotNullOfOrNull { (subject, text) ->
            TextChecks.easternDigit(text)?.let { Refusal(RefusalReason.EASTERN_DIGITS, subject, it) }
        }

    fun r4(draft: Draft): Refusal? =
        draft.identifiers.firstNotNullOfOrNull { (binding, value) ->
            TextChecks.outsideIdentifierAlphabet(value)?.let { Refusal(RefusalReason.IDENTIFIER_INVALID, binding.yamlName, it) }
        }

    /** R5: `YYYY-MM-DD`, `YYYY-MM` or `YYYY` as the precision says, digits 0-9 only, a real calendar date. */
    fun r5(birthDate: BirthDate): Refusal? {
        val valid =
            when (birthDate.precision) {
                DatePrecision.DAY -> validDay(birthDate.value)
                DatePrecision.MONTH -> validMonth(birthDate.value)
                DatePrecision.YEAR -> yearPattern.matches(birthDate.value)
            }
        return if (valid) {
            null
        } else {
            Refusal(
                RefusalReason.IDENTIFIER_INVALID,
                Binding.IDENTITY_BIRTH_DATE.yamlName,
                "not a valid date of birth at precision ${birthDate.precision}",
            )
        }
    }

    private fun validDay(value: String): Boolean =
        dayPattern.matchEntire(value)?.destructured?.let { (year, month, day) ->
            month.toInt() in 1..MAX_MONTH && YearMonth.of(year.toInt(), month.toInt()).isValidDay(day.toInt())
        } ?: false

    private fun validMonth(value: String): Boolean =
        monthPattern.matchEntire(value)?.destructured?.let { (_, month) -> month.toInt() in 1..MAX_MONTH } ?: false
}

/** The copies rule (spec §8.6, DN-071). */
object CopiesRule {
    /** The HAL's limit on copies of one print. */
    const val MAX_COPIES: Int = 10

    /** A wristband prints exactly one copy (`^PQ1`; copies go through the HAL); other kinds 1 to [MAX_COPIES]. */
    fun check(
        kind: TemplateKind,
        copies: Int,
    ): Refusal? {
        val allowed = if (kind == TemplateKind.WRISTBAND) 1..1 else 1..MAX_COPIES
        return if (copies in allowed) {
            null
        } else {
            Refusal(RefusalReason.COPIES_NOT_ALLOWED, "copies", "${kind.yamlName} allows ${allowed.first} to ${allowed.last}")
        }
    }
}

/** The reprint rule (spec §8.6, DN-071): every reprint names the original job and gives a reason. */
object ReprintRule {
    fun check(
        reprintOf: String?,
        reason: ReprintReason?,
    ): Refusal? =
        when {
            reprintOf == null -> null
            reprintOf.isBlank() -> Refusal(RefusalReason.REPRINT_REASON_REQUIRED, "reprintOf", "original job id is blank")
            reason == null -> Refusal(RefusalReason.REPRINT_REASON_REQUIRED, "reprintReason", "a reprint needs a reason")
            else -> null
        }
}

/**
 * The media check (spec §7.6, HAZ-0045; round-2 review): the printer's loaded media must be the template's,
 * so nothing prints off the label. Fails closed: unknown media or an unknown print-head width is a mismatch.
 * Not applied to PDF, which has no loaded media.
 */
object MediaRule {
    /** How far the loaded media may differ from the template's, in millimetres (inclusive). */
    const val TOLERANCE_MM: Double = 1.0

    /**
     * Width across the print head is checked for every kind; length along the feed only for fixed kinds
     * (a receipt or token grows with its content). The template's width in dots, rounded half up once at
     * the printer's resolution (spec §5.4), must not exceed the print head.
     */
    fun check(
        kind: TemplateKind,
        media: Media,
        printer: PrinterProfile,
    ): Refusal? {
        val head = printer.printheadWidthDots
        val detail =
            when {
                printer.mode == OutputMode.PDF -> {
                    null
                }

                else -> {
                    differs("width", printer.mediaWidthMm, media.widthMm)
                        ?: (if (kind.flow) null else differs("length", printer.mediaLengthMm, media.lengthMm))
                        ?: when {
                            head == null -> "print head width unknown"
                            head < Dots.fromMm(media.widthMm, printer.dotsPerMm) -> "template wider than the print head"
                            else -> null
                        }
                }
            }
        return detail?.let { Refusal(RefusalReason.MEDIA_MISMATCH, "media", it) }
    }

    private fun differs(
        dimension: String,
        loaded: Double?,
        expected: Double,
    ): String? =
        when {
            loaded == null -> "loaded media $dimension unknown"
            !(abs(loaded - expected) <= TOLERANCE_MM) -> "loaded media $dimension differs from the template by more than $TOLERANCE_MM mm"
            else -> null
        }
}

/** A step that either carries a value or the refusal that ended the checks. */
internal sealed interface Checked<out T> {
    data class Ok<out T>(
        val value: T,
    ) : Checked<T>

    data class Fail(
        val refusal: Refusal,
    ) : Checked<Nothing>
}

internal inline fun <T, R> Checked<T>.then(next: (T) -> Checked<R>): Checked<R> =
    when (this) {
        is Checked.Ok -> next(value)
        is Checked.Fail -> this
    }

internal inline fun <T, R> Checked<T>.map(transform: (T) -> R): Checked<R> = then { Checked.Ok(transform(it)) }

/** The identity after R1 and R3: every field present. */
private data class CheckedIdentity(
    val ownForm: NameForm,
    val ownName: String,
    val latinName: String,
    val mrn: String,
    val birthDate: BirthDate,
    val sex: String?,
)

/** R10: sensitivity-labelled text prints its redacted form when the policy names one of its labels (spec §8.4). */
private object Redaction {
    fun one(
        text: LabelledText,
        redactLabels: Set<String>,
        binding: Binding,
    ): Checked<String> = all(listOf(text), redactLabels, binding).map { it.single() }

    fun all(
        texts: List<LabelledText>,
        redactLabels: Set<String>,
        binding: Binding,
    ): Checked<List<String>> =
        if (texts.any { needsRedaction(it, redactLabels) && it.redactedText.isNullOrBlank() }) {
            Checked.Fail(Refusal(RefusalReason.POLICY_DENIED, binding.yamlName, "labelled text has no redacted form"))
        } else {
            Checked.Ok(texts.map { if (needsRedaction(it, redactLabels)) it.redactedText.orEmpty() else it.text })
        }

    /** Headings and paragraphs alike (every [LabelledText] of the body). */
    fun blocks(
        blocks: List<DocumentBlock>,
        redactLabels: Set<String>,
    ): Checked<List<ResolvedBlock>> =
        all(blocks.flatMap { listOfNotNull(it.heading) + it.paragraphs }, redactLabels, Binding.DOCUMENT_BODY).map { texts ->
            val remaining = texts.iterator()
            blocks.map { block ->
                val heading = block.heading?.let { remaining.next() }
                ResolvedBlock(heading, block.paragraphs.map { remaining.next() })
            }
        }

    private fun needsRedaction(
        text: LabelledText,
        redactLabels: Set<String>,
    ): Boolean = text.sensitivityLabels.any { it in redactLabels }
}

/**
 * The print banner of a document as rows of caption and value (spec §3.1, SI-16; DN-068 item 4). Missing
 * data prints its "unavailable" caption and never a default: an allergy list that is empty or has an entry
 * without a substance prints "Allergy status unavailable", never NKA.
 */
private object Banner {
    /** Code status and isolation are labelled text and follow R10 like any other. */
    fun rows(
        banner: PrintBanner,
        redactLabels: Set<String>,
    ): Checked<List<ResolvedRow>> =
        optional(banner.codeStatus, redactLabels).then { codeStatus ->
            optional(banner.isolation, redactLabels).map { isolation ->
                listOf(
                    ResolvedRow(Cell.CaptionRef(CaptionKeys.BANNER_ALLERGIES), allergies(banner.allergies)),
                    ResolvedRow(Cell.CaptionRef(CaptionKeys.BANNER_CODE_STATUS), valueOrUnavailable(codeStatus)),
                    ResolvedRow(Cell.CaptionRef(CaptionKeys.BANNER_ISOLATION), valueOrUnavailable(isolation)),
                    ResolvedRow(Cell.CaptionRef(CaptionKeys.BANNER_WEIGHT), valueOrUnavailable(banner.weight)),
                    ResolvedRow(
                        Cell.CaptionRef(CaptionKeys.BANNER_PHOTO),
                        Cell.CaptionRef(if (banner.photoOnRecord) CaptionKeys.BANNER_PHOTO_ON_RECORD else CaptionKeys.BANNER_NO_PHOTO),
                    ),
                )
            }
        }

    private fun optional(
        text: LabelledText?,
        redactLabels: Set<String>,
    ): Checked<String?> = if (text == null) Checked.Ok(null) else Redaction.one(text, redactLabels, Binding.DOCUMENT_BANNER)

    private fun allergies(allergies: PrintAllergies): Cell =
        when (allergies) {
            PrintAllergies.NoKnownAllergies -> {
                Cell.CaptionRef(CaptionKeys.BANNER_NKA)
            }

            PrintAllergies.NotAssessed -> {
                Cell.CaptionRef(CaptionKeys.BANNER_ALLERGIES_NOT_ASSESSED)
            }

            PrintAllergies.Unavailable -> {
                Cell.CaptionRef(CaptionKeys.BANNER_ALLERGIES_UNAVAILABLE)
            }

            is PrintAllergies.Listed -> {
                if (allergies.items.isEmpty() || allergies.items.any { it.substance.isBlank() }) {
                    Cell.CaptionRef(CaptionKeys.BANNER_ALLERGIES_UNAVAILABLE)
                } else {
                    Cell.Literal(allergies.items.joinToString(ALLERGY_SEPARATOR, transform = ::allergy))
                }
            }
        }

    private fun allergy(item: PrintAllergy): String {
        val details = listOfNotNull(item.reaction, item.severity).filter { it.isNotBlank() }
        return if (details.isEmpty()) item.substance else details.joinToString(", ", "${item.substance} (", ")")
    }

    private fun valueOrUnavailable(value: String?): Cell =
        if (value.isNullOrBlank()) Cell.CaptionRef(CaptionKeys.BANNER_UNAVAILABLE) else Cell.Literal(value)

    private const val ALLERGY_SEPARATOR: String = "; "
}

/** The refusal subject of a name form other than the own and the Latin form, for example `identity.name.ar`. */
internal fun otherFormSubject(form: NameForm): String = "identity.name.${form.locale}"

/** The content as it is being resolved; every text added here is queued for R7, identifiers also for R8 and R4. */
private class Draft(
    val kind: TemplateKind,
) {
    val printed = ArrayList<Pair<String, String>>()
    val identifiers = ArrayList<Pair<Binding, String>>()
    var birthDate: BirthDate? = null
        private set
    private val texts = LinkedHashMap<Binding, ResolvedText>()
    private val rows = LinkedHashMap<Binding, List<ResolvedRow>>()
    private val omitted = LinkedHashSet<Binding>()
    private var body: List<ResolvedBlock> = emptyList()
    private var otherForms: Map<NameForm, String> = emptyMap()

    fun identity(checked: CheckedIdentity) {
        if (checked.ownForm == NameForm.LATIN) {
            // The patient's own form is Latin: the name prints once (DN-068).
            text(Binding.IDENTITY_NAME_OWN, checked.latinName, Script.LATN)
            omitted += Binding.IDENTITY_NAME_LATIN
        } else {
            text(Binding.IDENTITY_NAME_OWN, checked.ownName, checked.ownForm.script)
            text(Binding.IDENTITY_NAME_LATIN, checked.latinName, Script.LATN)
        }
        identifier(Binding.IDENTITY_MRN, checked.mrn)
        birthDate = checked.birthDate
        printed += Binding.IDENTITY_BIRTH_DATE.yamlName to checked.birthDate.value
        optionalText(Binding.IDENTITY_SEX, checked.sex)
    }

    fun text(
        binding: Binding,
        text: String,
        script: Script? = null,
    ) {
        texts[binding] = ResolvedText(text, script)
        printed += binding.yamlName to text
    }

    fun optionalText(
        binding: Binding,
        text: String?,
    ) {
        if (text.isNullOrBlank()) omitted += binding else text(binding, text)
    }

    fun identifier(
        binding: Binding,
        value: String,
    ) {
        text(binding, value)
        identifiers += binding to value
    }

    fun segments(
        binding: Binding,
        lines: List<String>,
    ) {
        if (lines.isEmpty()) {
            omitted += binding
        } else {
            texts[binding] = ResolvedText(lines.map { TextSegment(it, null) })
            lines.forEach { printed += binding.yamlName to it }
        }
    }

    fun rows(
        binding: Binding,
        values: List<ResolvedRow>,
    ) {
        rows[binding] = values
        values.flatMap { listOf(it.description, it.amount) }.filterIsInstance<Cell.Literal>().forEach {
            printed += binding.yamlName to it.text
        }
    }

    /**
     * Documents: every other recorded, non-blank name form, printed below the own and the Latin form (spec §4.1). Each
     * is queued for R7 and R8 like the two main forms, with the subject `identity.name.<form>` (for example
     * `identity.name.ar`), so a refusal names the form.
     */
    fun otherNameForms(identity: PatientIdentity) {
        val main = setOfNotNull(identity.ownForm, NameForm.LATIN)
        otherForms =
            NameForm.entries
                .filter { it !in main }
                .mapNotNull { form -> identity.names[form]?.takeIf { it.isNotBlank() }?.let { form to it } }
                .toMap()
        otherForms.forEach { (form, name) -> printed += otherFormSubject(form) to name }
    }

    fun body(blocks: List<ResolvedBlock>) {
        body = blocks
        blocks.forEach { block ->
            block.heading?.let { printed += Binding.DOCUMENT_BODY.yamlName to it }
            block.paragraphs.forEach { printed += Binding.DOCUMENT_BODY.yamlName to it }
        }
    }

    /** Called only after every rule passed. */
    fun resolve(): ResolvedContent {
        val dob = birthDate
        val allTexts =
            if (dob == null) texts else texts + (Binding.IDENTITY_BIRTH_DATE to ResolvedText(ContentRules.printedBirthDate(dob)))
        return ResolvedContent(
            kind = kind,
            texts = allTexts,
            rows = rows.toMap(),
            omitted = omitted.toSet(),
            approximateDob = dob != null && ContentRules.isApproximate(dob),
            documentBody = body,
            otherNameForms = otherForms,
        )
    }
}
