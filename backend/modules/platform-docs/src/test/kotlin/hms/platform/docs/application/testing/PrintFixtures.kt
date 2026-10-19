package hms.platform.docs.application.testing

import hms.platform.docs.api.BirthDate
import hms.platform.docs.api.CommandContext
import hms.platform.docs.api.DatePrecision
import hms.platform.docs.api.DocumentBlock
import hms.platform.docs.api.DocumentContent
import hms.platform.docs.api.LabelLanguage
import hms.platform.docs.api.LabelledText
import hms.platform.docs.api.NameForm
import hms.platform.docs.api.OutputMode
import hms.platform.docs.api.PatientIdentity
import hms.platform.docs.api.PrintAllergies
import hms.platform.docs.api.PrintAllergy
import hms.platform.docs.api.PrintBanner
import hms.platform.docs.api.PrintCommand
import hms.platform.docs.api.PrintContent
import hms.platform.docs.api.PrinterProfile
import hms.platform.docs.api.ReceiptContent
import hms.platform.docs.api.ReceiptLine
import hms.platform.docs.api.ReprintReason
import hms.platform.docs.api.SpecimenLabelContent
import hms.platform.docs.api.TokenContent
import hms.platform.docs.api.WristbandContent
import hms.platform.docs.application.DocumentRendererPort
import hms.platform.docs.application.MrnCheckPort
import hms.platform.docs.application.PrintPolicyPort
import hms.platform.docs.application.PrintService
import hms.platform.docs.application.PrintServicePorts
import hms.platform.docs.infrastructure.fonts.FontRegistry
import hms.platform.docs.infrastructure.fonts.PrintFont
import hms.platform.docs.infrastructure.raster.Java2dLayoutRasteriser
import hms.platform.docs.infrastructure.raster.LayoutRasteriser
import hms.platform.docs.infrastructure.template.YamlTemplateLoader
import hms.platform.docs.infrastructure.template.YamlTemplateRepository
import hms.platform.docs.infrastructure.text.Java2dTextShaper
import java.nio.file.Path

/**
 * Synthetic print fixtures for the service tests and the sample matrix (§19.4: `SYN-` identifiers, invented Sorani,
 * Arabic and Latin names, NOT FOR CLINICAL USE): the real templates of `content/print-templates`, the real shaper and
 * rasteriser, printer profiles and contents.
 */
object PrintFixtures {
    val fonts: FontRegistry by lazy { FontRegistry.fromClasspath() }
    val shaper: Java2dTextShaper by lazy { Java2dTextShaper(fonts) }

    /** The template directory Gradle passes (`hms.docs.templatesDir`). */
    val templatesDir: Path by lazy {
        Path.of(System.getProperty("hms.docs.templatesDir") ?: error("system property hms.docs.templatesDir is not set"))
    }

    val templates: YamlTemplateRepository by lazy { YamlTemplateRepository(YamlTemplateLoader().loadDirectory(templatesDir)) }

    /** The test-and-sample print service: synthetic policy and MRN check, in-memory audit and events, fixed clock and ids. */
    class Harness(
        val audit: InMemoryAudit = InMemoryAudit(),
        val events: InMemoryEvents = InMemoryEvents(),
        val renderer: DocumentRendererPort = CapturingRenderer(),
        policy: PrintPolicyPort = SyntheticPolicy(),
        mrnCheck: MrnCheckPort = SyntheticMrnCheck(setOf(DIGIT_MRN)),
        rasteriser: LayoutRasteriser = Java2dLayoutRasteriser(shaper),
    ) {
        val service: PrintService =
            PrintService(
                PrintServicePorts(
                    templates = templates,
                    policy = policy,
                    mrnCheck = mrnCheck,
                    audit = audit,
                    events = events,
                    renderer = renderer,
                    shaper = shaper,
                    rasteriser = rasteriser,
                    fonts = fonts,
                    clock = FixedClock.clock(),
                    jobIds = SequentialJobIds(),
                ),
            )
    }

    /** The id the n-th job of a [Harness] gets. */
    fun job(n: Int): String = "0192f3a4-7b1c-7def-8abc-%012d".format(n)

    const val ADULT: String = "SYN-WRISTBAND-ADULT"
    const val NEWBORN: String = "SYN-WRISTBAND-NEWBORN"
    const val SPECIMEN_LABEL: String = "SYN-SPECIMEN-LABEL"
    const val SPECIMEN_CODE128: String = "SYN-SPECIMEN-LABEL-CODE128"
    const val RECEIPT: String = "SYN-RECEIPT-80"
    const val TOKEN: String = "SYN-TOKEN-80"
    const val DOCUMENT: String = "SYN-DOCUMENT-A4"

    /** A wristband printer for the adult band at [dotsPerMm]: text mode (S7-K passed, fonts resident) or raster. */
    fun bandPrinter(
        dotsPerMm: Double = 8.0,
        text: Boolean = false,
    ): PrinterProfile = if (text) zplText(dotsPerMm, BAND_WIDTH_MM, ADULT_LENGTH_MM) else zplRaster(dotsPerMm, BAND_WIDTH_MM, ADULT_LENGTH_MM)

    /** A label printer loaded with 50.8 × 38.1 mm specimen labels. */
    fun labelPrinter(
        dotsPerMm: Double = 8.0,
        text: Boolean = false,
    ): PrinterProfile = if (text) zplText(dotsPerMm, LABEL_WIDTH_MM, LABEL_LENGTH_MM) else zplRaster(dotsPerMm, LABEL_WIDTH_MM, LABEL_LENGTH_MM)

    const val BAND_WIDTH_MM: Double = 25.4
    const val ADULT_LENGTH_MM: Double = 279.4
    const val NEWBORN_LENGTH_MM: Double = 177.8
    const val LABEL_WIDTH_MM: Double = 50.8
    const val LABEL_LENGTH_MM: Double = 38.1

    // ---- printers ---------------------------------------------------------------------------------------------------

    /** The four pinned print fonts as provisioned on a printer (resident name → SHA-256), spec §7.1. */
    val residentFonts: Map<String, String> by lazy { PrintFont.entries.associate { it.zplName to fonts.font(it).sha256 } }

    /** A Zebra label printer at [dotsPerMm] with media loaded for [widthMm] × [lengthMm] and a 4-inch head. */
    fun zpl(
        mode: OutputMode,
        dotsPerMm: Double,
        widthMm: Double,
        lengthMm: Double,
        verified: Boolean = false,
        resident: Map<String, String> = emptyMap(),
    ): PrinterProfile =
        PrinterProfile(
            printerId = "SYN-PRN-ZPL-${dotsPerMm.toInt()}-${widthMm.toInt()}",
            mode = mode,
            dotsPerMm = dotsPerMm,
            printheadWidthDots = (FOUR_INCH_MM * dotsPerMm).toInt(),
            model = "SYN-ZD621",
            serial = "SYN-SN-${dotsPerMm.toInt()}",
            firmware = "V93.21.39Z",
            mediaWidthMm = widthMm,
            mediaLengthMm = lengthMm,
            residentFontSha256 = resident,
            textModeVerifiedByS7k = verified,
        )

    /** A ZPL text-mode printer that S7-K passed, with the print fonts provisioned (spec §7.1). */
    fun zplText(
        dotsPerMm: Double,
        widthMm: Double,
        lengthMm: Double,
    ): PrinterProfile = zpl(OutputMode.ZPL_TEXT, dotsPerMm, widthMm, lengthMm, verified = true, resident = residentFonts)

    fun zplRaster(
        dotsPerMm: Double,
        widthMm: Double,
        lengthMm: Double,
    ): PrinterProfile = zpl(OutputMode.ZPL_RASTER, dotsPerMm, widthMm, lengthMm)

    /**
     * An 80 mm ESC/POS receipt printer: 72 mm printable (576 dots at 8 dots/mm). Its head width is given as the paper
     * width (640 dots at 8) because MediaRule compares the template's media width with it (reported as a spec issue).
     */
    fun escPos(dotsPerMm: Double): PrinterProfile =
        PrinterProfile(
            printerId = "SYN-PRN-POS-${dotsPerMm.toInt()}",
            mode = OutputMode.ESCPOS_RASTER,
            dotsPerMm = dotsPerMm,
            printheadWidthDots = (PAPER_MM * dotsPerMm).toInt(),
            escposWidthDots = (PRINTABLE_MM * dotsPerMm).toInt(),
            model = "SYN-TM-T88",
            serial = "SYN-SN-POS-${dotsPerMm.toInt()}",
            firmware = "SYN-1.0",
            mediaWidthMm = PAPER_MM,
        )

    /** A PDF document printer (no loaded media: PDF is exempt from the media check, spec §7.6). */
    fun pdf(dotsPerMm: Double = 8.0): PrinterProfile =
        PrinterProfile(
            printerId = "SYN-PRN-PDF",
            mode = OutputMode.PDF,
            dotsPerMm = dotsPerMm,
            model = "SYN-LASER",
            serial = "SYN-SN-PDF",
            firmware = "SYN-1.0",
        )

    // ---- identities -------------------------------------------------------------------------------------------------

    const val MRN: String = "SYN-0000123"

    /** The sample generator's one synthetic digit-only MRN (spec §10), accepted by its MRN check explicitly. */
    const val DIGIT_MRN: String = "900000123457"
    const val ENCOUNTER: String = "SYN-E-000042"
    const val SPECIMEN: String = "SYN-S-0000077"
    private val DOB = BirthDate("1985-07-14", DatePrecision.DAY, approximate = false)

    fun identity(
        names: Map<NameForm, String>,
        ownForm: NameForm,
        mrn: String = MRN,
        birthDate: BirthDate = DOB,
        newborn: Boolean = false,
        alias: Boolean = false,
    ): PatientIdentity = PatientIdentity("SYN-P-0001", names, ownForm, latinConfirmed = true, mrn, birthDate, null, newborn, alias)

    val sorani: PatientIdentity =
        identity(mapOf(NameForm.CKB to "شیلان ئەحمەد محەمەد", NameForm.LATIN to "Shilan Ahmad Muhammad"), NameForm.CKB)
    val arabic: PatientIdentity =
        identity(mapOf(NameForm.AR to "كريم محمد أحمد", NameForm.LATIN to "Karim Muhammad Ahmad"), NameForm.AR)
    val latin: PatientIdentity = identity(mapOf(NameForm.LATIN to "Rebwar Aram Mahmud"), NameForm.LATIN)
    val longFourPart: PatientIdentity =
        identity(
            mapOf(
                NameForm.CKB to "عەبدولڕەحمان عەبدولکەریم عەبدولڕەحیم عەبدولقادر",
                NameForm.LATIN to "Abdulrahman Abdulkarim Abdulrahim Abdulqadir",
            ),
            NameForm.CKB,
        )
    val newborn: PatientIdentity =
        identity(
            mapOf(
                NameForm.CKB to "کۆرپەی سەرگوڵ عەبدولڕەحمان عەبدولکەریم عەبدولڕەحیم کوڕ",
                NameForm.LATIN to "Baby of Sergul Abdulrahman Abdulkarim Abdulrahim boy",
            ),
            NameForm.CKB,
            birthDate = BirthDate("2026-10-18", DatePrecision.DAY, approximate = false),
            newborn = true,
        )

    /** Twins whose names differ only in the final marker. */
    fun twin(marker: String): PatientIdentity =
        identity(
            mapOf(NameForm.CKB to "کۆرپەی شیلان ئەحمەد دووانەی $marker", NameForm.LATIN to "Baby of Shilan Ahmad twin ${TWIN_LATIN[marker]}"),
            NameForm.CKB,
            birthDate = BirthDate("2026-10-18", DatePrecision.DAY, approximate = false),
            newborn = true,
        )

    val alias: PatientIdentity =
        identity(
            mapOf(NameForm.LATIN to "Trauma Zulu-17"),
            NameForm.LATIN,
            birthDate = BirthDate("1980", DatePrecision.YEAR, approximate = true),
            alias = true,
        )
    val approximateDob: PatientIdentity = sorani.copy(birthDate = BirthDate("1985-07", DatePrecision.MONTH, approximate = true))
    val digitMrn: PatientIdentity = sorani.copy(mrn = DIGIT_MRN)

    /** All three name forms, long, for the document banner (spec §10). */
    val threeForms: PatientIdentity =
        identity(
            mapOf(
                NameForm.CKB to "عەبدولڕەحمان عەبدولکەریم عەبدولڕەحیم عەبدولقادر",
                NameForm.AR to "عبد الرحمن عبد الكريم عبد الرحيم عبد القادر",
                NameForm.LATIN to "Abdulrahman Abdulkarim Abdulrahim Abdulqadir",
            ),
            NameForm.CKB,
        )

    private val TWIN_LATIN = mapOf("ئ" to "A", "ب" to "B")

    // ---- contents ---------------------------------------------------------------------------------------------------

    fun wristband(identity: PatientIdentity = sorani): PrintContent = PrintContent.Wristband(WristbandContent(identity, ENCOUNTER))

    fun specimen(identity: PatientIdentity = sorani): PrintContent =
        PrintContent.SpecimenLabel(
            SpecimenLabelContent(identity, SPECIMEN, LabelledText("Blood EDTA"), FixedClock.INSTANT, listOf(LabelledText("CBC"))),
        )

    fun receipt(identity: PatientIdentity = sorani): PrintContent =
        PrintContent.Receipt(
            ReceiptContent(
                identity = identity,
                receiptNumber = "SYN-R-000901",
                issuerLines = listOf("SYN Hospital Erbil", "نەخۆشخانەی SYN"),
                lines =
                    listOf(
                        ReceiptLine(LabelledText("Consultation"), "25,000 IQD"),
                        ReceiptLine(LabelledText("CBC"), "10,000 IQD"),
                    ),
                totals = listOf(ReceiptLine(LabelledText("Total"), "35,000 IQD")),
                cashier = "SYN Cashier 3",
                issuedAt = FixedClock.INSTANT,
            ),
        )

    val token: PrintContent = PrintContent.Token(TokenContent("A-017", "Pharmacy window 2", FixedClock.INSTANT))

    /** A long allergy list, as in the spec's sample A4 document (§10). */
    val longAllergies: PrintAllergies =
        PrintAllergies.Listed(
            listOf(
                PrintAllergy("Penicillin", "anaphylaxis", "severe"),
                PrintAllergy("Amoxicillin", "urticaria", "moderate"),
                PrintAllergy("Sulfamethoxazole", "rash", "moderate"),
                PrintAllergy("Latex", "contact dermatitis", "mild"),
                PrintAllergy("Ibuprofen", "bronchospasm", "severe"),
                PrintAllergy("Iodinated contrast", "flushing", null),
                PrintAllergy("Peanut", "angioedema", "severe"),
            ),
        )

    fun banner(allergies: PrintAllergies = longAllergies): PrintBanner =
        PrintBanner(
            allergies = allergies,
            codeStatus = LabelledText("Full code"),
            isolation = null,
            weight = "72 kg (measured, 2026-10-18)",
            photoOnRecord = false,
        )

    fun document(
        identity: PatientIdentity = threeForms,
        banner: PrintBanner = banner(),
    ): PrintContent =
        PrintContent.Document(
            DocumentContent(
                identity = identity,
                banner = banner,
                title = LabelledText("Discharge summary"),
                blocks =
                    listOf(
                        DocumentBlock(LabelledText("Diagnosis"), listOf(LabelledText("Synthetic text. NOT FOR CLINICAL USE."))),
                        DocumentBlock(LabelledText("پوختە"), listOf(LabelledText("دەقی نموونەیی. بۆ بەکارهێنانی پزیشکی نییە."))),
                    ),
            ),
        )

    // ---- commands ---------------------------------------------------------------------------------------------------

    fun context(): CommandContext =
        CommandContext(
            tenantId = "SYN-TENANT-1",
            facilityId = "SYN-FAC-ERBIL",
            actorId = "SYN-USER-0001",
            actorDisplayName = "Dr Hana Aziz",
            actorStaffId = "SYN-ST-001",
            onBehalfOf = null,
            deviceId = "SYN-WS-ED-01",
            purposeOfUse = "TREAT",
            idempotencyKey = "SYN-IDEM-1",
            correlationId = "SYN-CORR-1",
            zoneId = FixedClock.ZONE.id,
        )

    @Suppress("LongParameterList")
    fun command(
        templateId: String,
        content: PrintContent,
        printer: PrinterProfile,
        language: LabelLanguage = LabelLanguage.EN,
        copies: Int = 1,
        reprintOf: String? = null,
        reprintReason: ReprintReason? = null,
    ): PrintCommand = PrintCommand(context(), templateId, content, language, printer, copies, reprintOf, reprintReason)

    private const val FOUR_INCH_MM = 104.0
    private const val PAPER_MM = 80.0
    private const val PRINTABLE_MM = 72.0
}
