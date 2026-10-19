package hms.platform.docs.domain.testing

import hms.platform.docs.api.BirthDate
import hms.platform.docs.api.DatePrecision
import hms.platform.docs.api.DocumentBlock
import hms.platform.docs.api.DocumentContent
import hms.platform.docs.api.LabelLanguage
import hms.platform.docs.api.LabelledText
import hms.platform.docs.api.NameForm
import hms.platform.docs.api.PatientIdentity
import hms.platform.docs.api.PrintAllergies
import hms.platform.docs.api.PrintAllergy
import hms.platform.docs.api.PrintBanner
import hms.platform.docs.api.PrintContent
import hms.platform.docs.api.ReceiptContent
import hms.platform.docs.api.ReceiptLine
import hms.platform.docs.api.SpecimenLabelContent
import hms.platform.docs.api.TokenContent
import hms.platform.docs.api.WristbandContent
import hms.platform.docs.domain.audit.Watermark
import hms.platform.docs.domain.template.Align
import hms.platform.docs.domain.template.Binding
import hms.platform.docs.domain.template.CaptionKeys
import hms.platform.docs.domain.template.Element
import hms.platform.docs.domain.template.FontChoice
import hms.platform.docs.domain.template.FontWeight
import hms.platform.docs.domain.template.Media
import hms.platform.docs.domain.template.MmBox
import hms.platform.docs.domain.template.Overflow
import hms.platform.docs.domain.template.Provenance
import hms.platform.docs.domain.template.SizeRange
import hms.platform.docs.domain.template.Symbology
import hms.platform.docs.domain.template.Template
import hms.platform.docs.domain.template.TemplateKind
import hms.platform.docs.domain.template.TextDirection
import java.time.Instant
import java.time.ZoneId

/**
 * Synthetic test data (§19.4: `SYN-` identifiers, NOT FOR CLINICAL USE). The Sorani, Arabic and Latin names are
 * invented. Templates are lint-clean fixtures sized for [FakeTextShaper]'s metrics.
 */
object Samples {
    val ZONE: ZoneId = ZoneId.of("Asia/Baghdad")
    val PRINTED_AT: Instant = Instant.parse("2026-10-19T11:05:00Z")
    const val JOB_ID: String = "0192f3a4-7b1c-7def-8abc-1234abcd5678"

    const val SORANI_NAME: String = "شیلان ئەحمەد محەمەد کەریم"
    const val LATIN_NAME: String = "Shilan Ahmad Muhammad Karim"
    const val MRN: String = "SYN-0000123"
    const val ENCOUNTER: String = "SYN-E-000042"
    const val SPECIMEN: String = "SYN-S-0000077"

    @Suppress("LongParameterList")
    fun identity(
        names: Map<NameForm, String> = mapOf(NameForm.CKB to SORANI_NAME, NameForm.LATIN to LATIN_NAME),
        ownForm: NameForm? = NameForm.CKB,
        latinConfirmed: Boolean = true,
        mrn: String? = MRN,
        birthDate: BirthDate? = BirthDate("1985-07-14", DatePrecision.DAY, approximate = false),
        sex: String? = null,
        newborn: Boolean = false,
        alias: Boolean = false,
    ): PatientIdentity = PatientIdentity("SYN-P-0001", names, ownForm, latinConfirmed, mrn, birthDate, sex, newborn, alias)

    val sorani: PatientIdentity = identity()

    val arabic: PatientIdentity =
        identity(names = mapOf(NameForm.AR to "كريم محمد أحمد", NameForm.LATIN to "Karim Muhammad Ahmad"), ownForm = NameForm.AR)

    /** "Baby of Shilan Ahmad" in Arabic, with an approximate date of birth. */
    val newborn: PatientIdentity =
        identity(
            names = mapOf(NameForm.AR to "طفل شيلان أحمد", NameForm.LATIN to "Baby of Shilan Ahmad"),
            ownForm = NameForm.AR,
            newborn = true,
        )

    fun twin(marker: Pair<String, String>): PatientIdentity =
        identity(
            names = mapOf(NameForm.CKB to "کۆرپەی شیلان ئەحمەد ${marker.first}", NameForm.LATIN to "Baby of Shilan Ahmad ${marker.second}"),
            newborn = true,
        )

    val alias: PatientIdentity =
        identity(
            names = mapOf(NameForm.LATIN to "Trauma Zulu-17"),
            ownForm = NameForm.LATIN,
            birthDate = BirthDate("1980", DatePrecision.YEAR, approximate = true),
            alias = true,
        )

    val latinOwn: PatientIdentity = identity(names = mapOf(NameForm.LATIN to LATIN_NAME), ownForm = NameForm.LATIN)

    fun wristband(identity: PatientIdentity = sorani): PrintContent = PrintContent.Wristband(WristbandContent(identity, ENCOUNTER))

    fun specimen(
        identity: PatientIdentity = sorani,
        tests: List<LabelledText> = listOf(LabelledText("CBC"), LabelledText("HIV Ag/Ab", setOf("hiv"), "Test R-17")),
        type: LabelledText = LabelledText("Blood EDTA"),
    ): PrintContent = PrintContent.SpecimenLabel(SpecimenLabelContent(identity, SPECIMEN, type, PRINTED_AT, tests))

    fun receipt(
        identity: PatientIdentity = sorani,
        lines: List<ReceiptLine> = listOf(ReceiptLine(LabelledText("Consultation"), "25,000 IQD")),
    ): PrintContent =
        PrintContent.Receipt(
            ReceiptContent(
                identity = identity,
                receiptNumber = "SYN-R-000901",
                issuerLines = listOf("SYN Hospital Erbil", "نەخۆشخانەی SYN"),
                lines = lines,
                totals = listOf(ReceiptLine(LabelledText("Total"), "25,000 IQD")),
                cashier = "SYN Cashier 3",
                issuedAt = PRINTED_AT,
            ),
        )

    val token: PrintContent = PrintContent.Token(TokenContent("A-017", "Pharmacy window 2", PRINTED_AT))

    fun document(
        identity: PatientIdentity = sorani,
        banner: PrintBanner =
            PrintBanner(
                allergies =
                    PrintAllergies.Listed(
                        listOf(PrintAllergy("Penicillin", "rash", "moderate"), PrintAllergy("Latex", null, null)),
                    ),
                codeStatus = LabelledText("Full code"),
                isolation = null,
                weight = "72 kg (measured, 2026-10-18)",
                photoOnRecord = false,
            ),
        blocks: List<DocumentBlock> = listOf(DocumentBlock(LabelledText("History"), listOf(LabelledText("Synthetic note.")))),
    ): PrintContent = PrintContent.Document(DocumentContent(identity, banner, LabelledText("Discharge summary"), blocks))

    fun watermark(reprintOf: String? = null): Watermark =
        Watermark("Dr Hana Aziz", "SYN-ST-001", PRINTED_AT, "Asia/Baghdad", MRN, JOB_ID, reprintOf)

    // ---- templates ---------------------------------------------------------------------------------------------

    val captions: Map<String, Map<LabelLanguage, String>> =
        mapOf(
            CaptionKeys.MRN to tri("MRN", "ژمارەی تۆمار", "رقم السجل"),
            CaptionKeys.DOB to tri("DOB", "لەدایکبوون", "الميلاد"),
            CaptionKeys.APPROXIMATE to tri("Approx.", "نزیکەیی", "تقريبي"),
            CaptionKeys.ENCOUNTER to tri("Enc.", "سەردان", "الزيارة"),
            CaptionKeys.SPECIMEN to tri("Specimen", "نموونە", "العينة"),
            CaptionKeys.BANNER_ALLERGIES to tri("Allergies", "هەستیاری", "الحساسية"),
            CaptionKeys.BANNER_NKA to tri("NKA", "هیچ هەستیارییەکی زانراو نییە", "لا حساسية معروفة"),
            CaptionKeys.BANNER_ALLERGIES_NOT_ASSESSED to tri("Not assessed", "هەڵنەسەنگێنراوە", "لم تقيم"),
            CaptionKeys.BANNER_ALLERGIES_UNAVAILABLE to
                tri("Allergy status unavailable", "دۆخی هەستیاری بەردەست نییە", "حالة الحساسية غير متاحة"),
            CaptionKeys.BANNER_CODE_STATUS to tri("Code status", "دۆخی کۆد", "حالة الإنعاش"),
            CaptionKeys.BANNER_ISOLATION to tri("Isolation", "دابڕان", "العزل"),
            CaptionKeys.BANNER_WEIGHT to tri("Weight", "کێش", "الوزن"),
            CaptionKeys.BANNER_UNAVAILABLE to tri("Unavailable", "بەردەست نییە", "غير متاح"),
            CaptionKeys.BANNER_PHOTO to tri("Photo", "وێنە", "الصورة"),
            CaptionKeys.BANNER_PHOTO_ON_RECORD to tri("On record (not printed)", "تۆمارکراوە", "مسجلة"),
            CaptionKeys.BANNER_NO_PHOTO to tri("No photo", "وێنە نییە", "لا صورة"),
        )

    private fun tri(
        en: String,
        ckb: String,
        ar: String,
    ) = mapOf(LabelLanguage.EN to en, LabelLanguage.CKB to ckb, LabelLanguage.AR to ar)

    fun box(
        x: Double,
        y: Double,
        w: Double,
        h: Double,
    ) = MmBox(x, y, w, h)

    @Suppress("LongParameterList")
    fun text(
        bind: Binding,
        box: MmBox,
        font: FontChoice,
        max: Double,
        min: Double,
        maxLines: Int = 1,
        direction: TextDirection = TextDirection.AUTO,
        overflow: Overflow = Overflow.REFUSE,
        align: Align = Align.START,
        weight: FontWeight = FontWeight.REGULAR,
    ) = Element.Text(bind, box, font, weight, SizeRange(max, min), maxLines, align, overflow, direction)

    fun caption(
        key: String,
        box: MmBox,
        max: Double = 6.5,
        min: Double = 6.0,
    ) = Element.Caption(key, box, FontChoice.BY_LABEL_LANGUAGE, FontWeight.REGULAR, SizeRange(max, min), Align.START)

    private fun ltr(
        bind: Binding,
        box: MmBox,
        max: Double,
        min: Double,
    ) = text(bind, box, FontChoice.LATIN, max, min, direction = TextDirection.LTR)

    /** A 25.4 mm × 279.4 mm wristband read along its length (rotation 90). */
    val wristbandTemplate: Template =
        Template(
            id = "SYN-WRISTBAND-ADULT",
            version = 1,
            contentHash = "a".repeat(64),
            provenance = Provenance.SYNTHETIC,
            kind = TemplateKind.WRISTBAND,
            media = Media(25.4, 279.4, 90, box(75.0, 2.0, 150.0, 21.4)),
            captions = captions,
            elements =
                listOf(
                    text(Binding.IDENTITY_NAME_OWN, box(75.0, 2.0, 100.0, 9.6), FontChoice.BY_SCRIPT, 12.0, 8.0, maxLines = 2),
                    text(Binding.IDENTITY_NAME_LATIN, box(75.0, 11.8, 100.0, 4.6), FontChoice.LATIN, 9.0, 6.0),
                    caption(CaptionKeys.MRN, box(75.0, 16.6, 14.0, 5.0)),
                    ltr(Binding.IDENTITY_MRN, box(89.5, 16.6, 30.0, 5.0), 9.0, 6.0),
                    caption(CaptionKeys.DOB, box(120.0, 16.6, 12.0, 5.0)),
                    ltr(Binding.IDENTITY_BIRTH_DATE, box(132.5, 16.6, 24.0, 5.0), 9.0, 6.0),
                    caption(CaptionKeys.APPROXIMATE, box(157.0, 16.6, 18.0, 6.8), 8.0, 8.0),
                    text(Binding.WATERMARK, box(176.0, 2.0, 13.0, 14.0), FontChoice.LATIN, 6.0, 5.0, maxLines = 4),
                    Element.Barcode(Binding.BARCODE_WRISTBAND, box(190.0, 3.0, 13.0, 13.0), Symbology.DATAMATRIX, 0.5),
                    text(Binding.NOTICE_SYNTHETIC, box(204.0, 2.0, 21.0, 14.0), FontChoice.LATIN, 6.0, 5.0, maxLines = 4),
                    caption(CaptionKeys.ENCOUNTER, box(176.0, 18.2, 12.0, 5.0)),
                    ltr(Binding.ENCOUNTER_ID, box(188.5, 18.2, 24.0, 5.0), 9.0, 6.0),
                ),
        )

    /** A 50.8 mm × 38.1 mm tube label with the default specimen DataMatrix. */
    val specimenTemplate: Template =
        Template(
            id = "SYN-SPECIMEN-TUBE",
            version = 1,
            contentHash = "b".repeat(64),
            provenance = Provenance.SYNTHETIC,
            kind = TemplateKind.SPECIMEN_LABEL,
            media = Media(50.8, 38.1, 0, box(1.0, 1.0, 48.8, 36.1)),
            captions = captions,
            elements =
                listOf(
                    text(Binding.IDENTITY_NAME_OWN, box(1.0, 1.0, 30.0, 12.5), FontChoice.BY_SCRIPT, 10.0, 8.0, maxLines = 2),
                    text(Binding.IDENTITY_NAME_LATIN, box(1.0, 14.0, 30.0, 6.0), FontChoice.LATIN, 8.0, 6.0, maxLines = 2),
                    caption(CaptionKeys.MRN, box(1.0, 20.5, 14.0, 5.0)),
                    ltr(Binding.IDENTITY_MRN, box(15.5, 20.5, 17.0, 5.0), 8.0, 6.0),
                    caption(CaptionKeys.DOB, box(1.0, 26.0, 12.0, 5.0)),
                    ltr(Binding.IDENTITY_BIRTH_DATE, box(13.5, 26.0, 18.0, 5.0), 8.0, 6.0),
                    caption(CaptionKeys.APPROXIMATE, box(1.0, 31.0, 14.0, 6.1), 8.0, 8.0),
                    Element.Barcode(Binding.BARCODE_SPECIMEN, box(36.0, 2.0, 12.0, 12.0), Symbology.DATAMATRIX, 0.5),
                    ltr(Binding.SPECIMEN_ID, box(33.0, 15.5, 16.5, 4.5), 8.0, 6.0),
                    text(Binding.WATERMARK, box(33.0, 21.0, 16.5, 9.0), FontChoice.LATIN, 6.0, 5.0, maxLines = 3),
                    text(Binding.NOTICE_SYNTHETIC, box(16.0, 31.5, 33.0, 5.5), FontChoice.LATIN, 6.0, 5.0, maxLines = 2),
                ),
        )

    /** An 80 mm receipt (flow: box.y is the gap before each element). */
    val receiptTemplate: Template =
        Template(
            id = "SYN-RECEIPT-80",
            version = 1,
            contentHash = "c".repeat(64),
            provenance = Provenance.SYNTHETIC,
            kind = TemplateKind.RECEIPT,
            media = Media(80.0, 60.0, 0, box(4.0, 2.0, 72.0, 56.0)),
            captions = captions,
            elements =
                listOf(
                    text(Binding.NOTICE_SYNTHETIC, box(4.0, 0.0, 72.0, 10.0), FontChoice.LATIN, 8.0, 6.0, maxLines = 2),
                    text(Binding.RECEIPT_ISSUER, box(4.0, 1.0, 72.0, 10.0), FontChoice.MIXED, 9.0, 7.0, 2, overflow = Overflow.WRAP_GROW),
                    text(Binding.IDENTITY_NAME_OWN, box(4.0, 2.0, 72.0, 13.0), FontChoice.BY_SCRIPT, 12.0, 8.0, maxLines = 2),
                    text(Binding.IDENTITY_NAME_LATIN, box(4.0, 1.0, 72.0, 5.0), FontChoice.LATIN, 9.0, 6.0),
                    caption(CaptionKeys.MRN, box(4.0, 1.0, 30.0, 5.0)),
                    ltr(Binding.IDENTITY_MRN, box(4.0, 0.5, 40.0, 5.0), 9.0, 7.0),
                    caption(CaptionKeys.DOB, box(4.0, 1.0, 30.0, 5.0)),
                    ltr(Binding.IDENTITY_BIRTH_DATE, box(4.0, 0.5, 30.0, 5.0), 9.0, 7.0),
                    caption(CaptionKeys.APPROXIMATE, box(4.0, 0.5, 30.0, 7.0), 8.0, 8.0),
                    ltr(Binding.RECEIPT_NUMBER, box(4.0, 1.0, 50.0, 5.0), 9.0, 7.0),
                    Element.Rows(
                        Binding.RECEIPT_LINES,
                        box(4.0, 1.0, 72.0, 5.0),
                        FontChoice.MIXED,
                        FontWeight.REGULAR,
                        SizeRange(9.0, 7.0),
                        50.0,
                        20.0,
                    ),
                    Element.Rows(
                        Binding.RECEIPT_TOTALS,
                        box(4.0, 2.0, 72.0, 5.0),
                        FontChoice.MIXED,
                        FontWeight.BOLD,
                        SizeRange(9.0, 7.0),
                        50.0,
                        20.0,
                    ),
                    text(Binding.RECEIPT_CASHIER, box(4.0, 1.0, 72.0, 5.0), FontChoice.MIXED, 8.0, 7.0, overflow = Overflow.WRAP_GROW),
                    ltr(Binding.RECEIPT_ISSUED_AT, box(4.0, 0.5, 40.0, 5.0), 8.0, 7.0),
                    text(Binding.WATERMARK, box(4.0, 2.0, 72.0, 5.0), FontChoice.MIXED, 7.0, 6.0, 2, overflow = Overflow.WRAP_GROW),
                ),
        )

    /** An 80 mm queue token: no patient data, no watermark. */
    val tokenTemplate: Template =
        Template(
            id = "SYN-TOKEN-80",
            version = 1,
            contentHash = "d".repeat(64),
            provenance = Provenance.SYNTHETIC,
            kind = TemplateKind.TOKEN,
            media = Media(80.0, 40.0, 0, box(4.0, 2.0, 72.0, 36.0)),
            captions = captions,
            elements =
                listOf(
                    text(Binding.NOTICE_SYNTHETIC, box(4.0, 0.0, 72.0, 10.0), FontChoice.LATIN, 8.0, 6.0, maxLines = 2),
                    text(Binding.TOKEN_NUMBER, box(4.0, 2.0, 72.0, 20.0), FontChoice.LATIN, 36.0, 24.0, align = Align.CENTER),
                    text(
                        Binding.TOKEN_SERVICE_POINT,
                        box(4.0, 1.0, 72.0, 8.0),
                        FontChoice.MIXED,
                        12.0,
                        8.0,
                        2,
                        overflow = Overflow.WRAP_GROW,
                    ),
                    ltr(Binding.TOKEN_ISSUED_AT, box(4.0, 1.0, 40.0, 5.0), 8.0, 7.0),
                ),
        )

    /** An A4 document: the banner block is laid out, the body is the HTML writer's. */
    val documentTemplate: Template =
        Template(
            id = "SYN-DOCUMENT-A4",
            version = 1,
            contentHash = "e".repeat(64),
            provenance = Provenance.SYNTHETIC,
            kind = TemplateKind.DOCUMENT,
            media = Media(210.0, 297.0, 0, box(15.0, 15.0, 180.0, 267.0)),
            captions = captions,
            elements =
                listOf(
                    text(Binding.NOTICE_SYNTHETIC, box(15.0, 0.0, 180.0, 6.0), FontChoice.LATIN, 9.0, 7.0),
                    text(Binding.IDENTITY_NAME_OWN, box(15.0, 2.0, 180.0, 12.0), FontChoice.BY_SCRIPT, 14.0, 10.0, maxLines = 2),
                    text(Binding.IDENTITY_NAME_LATIN, box(15.0, 1.0, 180.0, 7.0), FontChoice.LATIN, 11.0, 8.0),
                    caption(CaptionKeys.MRN, box(15.0, 1.0, 40.0, 5.0)),
                    ltr(Binding.IDENTITY_MRN, box(15.0, 0.5, 60.0, 5.0), 10.0, 8.0),
                    caption(CaptionKeys.DOB, box(15.0, 1.0, 40.0, 5.0)),
                    ltr(Binding.IDENTITY_BIRTH_DATE, box(15.0, 0.5, 60.0, 5.0), 10.0, 8.0),
                    caption(CaptionKeys.APPROXIMATE, box(15.0, 0.5, 40.0, 7.0), 8.0, 8.0),
                    Element.Rows(
                        Binding.DOCUMENT_BANNER,
                        box(15.0, 1.0, 180.0, 6.0),
                        FontChoice.MIXED,
                        FontWeight.REGULAR,
                        SizeRange(10.0, 8.0),
                        50.0,
                        125.0,
                    ),
                    text(
                        Binding.DOCUMENT_TITLE,
                        box(15.0, 4.0, 180.0, 10.0),
                        FontChoice.MIXED,
                        14.0,
                        10.0,
                        2,
                        overflow = Overflow.WRAP_GROW,
                    ),
                    text(
                        Binding.DOCUMENT_BODY,
                        box(15.0, 2.0, 180.0, 200.0),
                        FontChoice.MIXED,
                        10.0,
                        9.0,
                        100,
                        overflow = Overflow.WRAP_GROW,
                    ),
                    text(Binding.WATERMARK, box(15.0, 2.0, 180.0, 6.0), FontChoice.MIXED, 8.0, 7.0, 2, overflow = Overflow.WRAP_GROW),
                ),
        )

    val allTemplates: List<Template> = listOf(wristbandTemplate, specimenTemplate, receiptTemplate, tokenTemplate, documentTemplate)
}
