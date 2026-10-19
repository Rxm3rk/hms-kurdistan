package hms.platform.docs.application

import hms.platform.docs.api.BirthDate
import hms.platform.docs.api.DocumentBlock
import hms.platform.docs.api.DocumentContent
import hms.platform.docs.api.LabelLanguage
import hms.platform.docs.api.LabelledText
import hms.platform.docs.api.NameForm
import hms.platform.docs.api.PatientIdentity
import hms.platform.docs.api.PrintAllergies
import hms.platform.docs.api.PrintBanner
import hms.platform.docs.api.PrintContent
import hms.platform.docs.api.ReceiptContent
import hms.platform.docs.api.ReceiptLine
import hms.platform.docs.api.Refusal
import hms.platform.docs.api.SpecimenLabelContent
import hms.platform.docs.api.WristbandContent
import hms.platform.docs.domain.audit.Watermark
import hms.platform.docs.domain.layout.LayoutEngine
import hms.platform.docs.domain.layout.LayoutOutcome
import hms.platform.docs.domain.layout.LayoutRequest
import hms.platform.docs.domain.layout.TextShaper
import hms.platform.docs.domain.rules.ContentCheck
import hms.platform.docs.domain.rules.ContentRules
import hms.platform.docs.domain.template.LegibilityPolicy
import hms.platform.docs.domain.template.Template
import hms.platform.docs.domain.template.TemplateKind
import java.time.Instant
import java.time.ZoneId

/** One identity of the worst-case corpus: every recorded name form, the own form and the registration flags. */
data class CorpusIdentity(
    val label: String,
    val names: Map<NameForm, String>,
    val ownForm: NameForm,
    val newborn: Boolean = false,
    val alias: Boolean = false,
)

/**
 * The governed worst-case identity corpus (docs/specs/modules/platform-docs.md §4.3; DN-069, OQ-244): the identities
 * and the longest identifier forms every patient template must fit. Loaded from
 * `content/print-templates/worst-case-identity-corpus.yaml` (`provenance: synthetic` until the hospital's
 * registration field limits replace it).
 */
data class WorstCaseCorpus(
    val identities: List<CorpusIdentity>,
    val mrns: List<String>,
    val encounterIds: List<String>,
    val birthDates: List<BirthDate>,
)

/** One combination of the corpus that a template cannot print, with the refusal the print would get. */
data class FitFinding(
    val templateId: String,
    val identity: String,
    val language: LabelLanguage,
    val dotsPerMm: Double,
    val refusal: Refusal,
)

/**
 * The worst-case fit check (docs/specs/modules/platform-docs.md §4.3, `TemplateFitCheck:worst-case-identity-corpus`;
 * R6, DN-069, OQ-244; HAZ-0045). In the application layer because it shapes text: every patient template must lay
 * out every corpus identity, with every longest MRN, encounter and date of birth, in every label language, at every
 * printer resolution it may print at, with the real shaper, through the same content rules and layout engine a print
 * uses (so "fits" means exactly what a print means by it: every identity element at or above its effective minimum
 * size, never truncated). A template that cannot fit the corpus is refused before any patient meets it.
 *
 * The non-identity fields of the sample contents are short synthetic values; the watermark is the longest form (a
 * reprint), with the corpus MRN. Tokens carry no patient and are not checked.
 */
class TemplateFitCheck(
    shaper: TextShaper,
    private val legibility: LegibilityPolicy = LegibilityPolicy(),
) {
    private val engine = LayoutEngine(shaper)

    /** Every combination of [corpus] that [template] cannot print; empty when the template fits the corpus. */
    fun check(
        template: Template,
        corpus: WorstCaseCorpus,
        resolutions: List<Double> = RESOLUTIONS,
    ): List<FitFinding> {
        if (!template.kind.patientPrint) return emptyList()
        val usable = resolutions.filter { it >= template.media.minDotsPerMm }
        return identities(corpus).flatMap { (label, identity) ->
            LabelLanguage.entries.flatMap { language ->
                usable.mapNotNull { dots -> finding(template, Case(label, identity, language, dots), corpus) }
            }
        }
    }

    /** One identity in one label language at one resolution. */
    private data class Case(
        val label: String,
        val identity: PatientIdentity,
        val language: LabelLanguage,
        val dotsPerMm: Double,
    )

    private fun finding(
        template: Template,
        case: Case,
        corpus: WorstCaseCorpus,
    ): FitFinding? {
        val refusal =
            corpus.encounterIds.firstNotNullOfOrNull { encounter ->
                when (val checked = ContentRules.check(content(template.kind, case.identity, encounter), emptySet(), ZONE)) {
                    is ContentCheck.Refused -> {
                        checked.refusal
                    }

                    is ContentCheck.Valid -> {
                        val watermark = watermark(case.identity)
                        val request = LayoutRequest(template, checked.content, case.language, watermark, case.dotsPerMm, legibility)
                        (engine.layout(request) as? LayoutOutcome.Refused)?.refusal
                    }
                }
            }
        return refusal?.let { FitFinding(template.id, case.label, case.language, case.dotsPerMm, it) }
    }

    /** Every identity with every MRN and date of birth of the corpus, labelled for the findings. */
    private fun identities(corpus: WorstCaseCorpus): List<Pair<String, PatientIdentity>> =
        corpus.identities.flatMap { identity ->
            corpus.mrns.flatMap { mrn ->
                corpus.birthDates.map { birthDate ->
                    val label = "${identity.label} / $mrn / ${birthDate.value}"
                    label to
                        PatientIdentity(
                            patientRef = "SYN-P-CORPUS",
                            names = identity.names,
                            ownForm = identity.ownForm,
                            latinConfirmed = true,
                            mrn = mrn,
                            birthDate = birthDate,
                            newborn = identity.newborn,
                            alias = identity.alias,
                        )
                }
            }
        }

    private fun content(
        kind: TemplateKind,
        identity: PatientIdentity,
        encounter: String,
    ): PrintContent =
        when (kind) {
            TemplateKind.WRISTBAND -> {
                PrintContent.Wristband(WristbandContent(identity, encounter))
            }

            TemplateKind.SPECIMEN_LABEL -> {
                PrintContent.SpecimenLabel(SpecimenLabelContent(identity, SPECIMEN_ID, LabelledText("Blood EDTA"), AT, emptyList()))
            }

            TemplateKind.RECEIPT -> {
                val line = ReceiptLine(LabelledText("Consultation"), "25,000 IQD")
                PrintContent.Receipt(
                    ReceiptContent(identity, RECEIPT_NUMBER, listOf("SYN Hospital"), listOf(line), listOf(line), "SYN Cashier", AT),
                )
            }

            TemplateKind.DOCUMENT -> {
                val banner = PrintBanner(PrintAllergies.NoKnownAllergies, null, null, null, photoOnRecord = false)
                val block = DocumentBlock(null, listOf(LabelledText("Synthetic text.")))
                PrintContent.Document(DocumentContent(identity, banner, LabelledText("Synthetic document"), listOf(block)))
            }

            TemplateKind.TOKEN -> {
                error("tokens carry no patient and are not checked")
            }
        }

    private fun watermark(identity: PatientIdentity): Watermark =
        Watermark("SYN Fit Check", "SYN-ST-0000001", AT, ZONE.id, identity.mrn, JOB_ID, reprintOf = JOB_ID)

    companion object {
        /** The printer resolutions of spec §5.4: 8, 12 and 24 dots per millimetre. */
        val RESOLUTIONS: List<Double> = listOf(8.0, 12.0, 24.0)

        private val ZONE: ZoneId = ZoneId.of("Asia/Baghdad")
        private val AT: Instant = Instant.parse("2026-10-19T11:05:00Z")
        private const val JOB_ID = "0192f3a4-7b1c-7def-8abc-1234abcd5678"
        private const val SPECIMEN_ID = "SYN-S-0000077"
        private const val RECEIPT_NUMBER = "SYN-R-0000901"
    }
}
