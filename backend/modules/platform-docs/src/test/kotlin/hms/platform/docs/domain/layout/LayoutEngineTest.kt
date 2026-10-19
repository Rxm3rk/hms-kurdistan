package hms.platform.docs.domain.layout

import hms.platform.docs.api.BirthDate
import hms.platform.docs.api.DatePrecision
import hms.platform.docs.api.LabelLanguage
import hms.platform.docs.api.NameForm
import hms.platform.docs.api.PrintContent
import hms.platform.docs.api.RefusalReason
import hms.platform.docs.api.TokenContent
import hms.platform.docs.domain.audit.Watermark
import hms.platform.docs.domain.rules.ContentCheck
import hms.platform.docs.domain.rules.ContentRules
import hms.platform.docs.domain.rules.ResolvedContent
import hms.platform.docs.domain.template.Align
import hms.platform.docs.domain.template.Binding
import hms.platform.docs.domain.template.Element
import hms.platform.docs.domain.template.FontRole
import hms.platform.docs.domain.template.FontWeight
import hms.platform.docs.domain.template.SizeRange
import hms.platform.docs.domain.template.Symbology
import hms.platform.docs.domain.template.Template
import hms.platform.docs.domain.testing.FakeTextShaper
import hms.platform.docs.domain.testing.Samples
import hms.platform.docs.domain.testing.cp
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldBeSortedWith
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldNotContain
import io.kotest.matchers.doubles.plusOrMinus
import io.kotest.matchers.doubles.shouldBeGreaterThanOrEqual
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.types.shouldBeInstanceOf

private fun resolved(
    content: PrintContent,
    redact: Set<String> = emptySet(),
): ResolvedContent = ContentRules.check(content, redact, Samples.ZONE).shouldBeInstanceOf<ContentCheck.Valid>().content

@Suppress("LongParameterList")
private fun layout(
    template: Template,
    content: PrintContent,
    language: LabelLanguage = LabelLanguage.EN,
    watermark: Watermark? = Samples.watermark(),
    dotsPerMm: Double = 8.0,
    shaper: TextShaper = FakeTextShaper(),
): LayoutOutcome = LayoutEngine(shaper).layout(LayoutRequest(template, resolved(content), language, watermark, dotsPerMm))

@Suppress("LongParameterList")
private fun laid(
    template: Template,
    content: PrintContent,
    language: LabelLanguage = LabelLanguage.EN,
    watermark: Watermark? = Samples.watermark(),
    dotsPerMm: Double = 8.0,
    shaper: TextShaper = FakeTextShaper(),
): Layout = layout(template, content, language, watermark, dotsPerMm, shaper).shouldBeInstanceOf<LayoutOutcome.Laid>().layout

private fun refusedLayout(
    template: Template,
    content: PrintContent,
    watermark: Watermark? = Samples.watermark(),
    dotsPerMm: Double = 8.0,
    shaper: TextShaper = FakeTextShaper(),
) = layout(template, content, LabelLanguage.EN, watermark, dotsPerMm, shaper).shouldBeInstanceOf<LayoutOutcome.Refused>().refusal

/** The lines placed in [element]'s box (fixed kinds: boxes are absolute). */
private fun Layout.inBox(element: Element): List<PlacedLine> =
    lines.filter { it.boxXMm == element.box.xMm && it.topMm >= element.box.yMm - 1e-9 && it.topMm < element.box.yMm + element.box.hMm }

private fun Layout.texts(): List<String> = lines.map { it.text }

private val band = Samples.wristbandTemplate

class LayoutEngineTest :
    FunSpec({
        context("a wristband (fixed kind)") {
            val layout = laid(band, Samples.wristband())

            test("carries the template identity and the reading frame") {
                layout.templateId shouldBe "SYN-WRISTBAND-ADULT"
                layout.templateHash shouldBe "a".repeat(64)
                layout.frameWidthMm shouldBe 279.4
                layout.frameHeightMm shouldBe 25.4
                layout.rotation shouldBe 90
                layout.synthetic shouldBe true
            }

            test("the own name: whole, Arabic font, right to left, in its box, metrics from the font") {
                val own = layout.inBox(band.elements[0]).single()
                own.text shouldBe Samples.SORANI_NAME
                own.fonts shouldBe listOf(FontSpec(FontRole.ARABIC, FontWeight.REGULAR))
                own.rightToLeft shouldBe true
                own.topMm shouldBe 2.0
                own.sizePt shouldBe (Dots.quantisePt(12.0, 8.0) plusOrMinus 1e-12)
                own.lineHeightMm shouldBe (Dots.ptToMm(2.11 * own.sizePt) plusOrMinus 1e-9)
                own.baselineMm shouldBe (2.0 + Dots.ptToMm(1.4 * own.sizePt) plusOrMinus 1e-9)
                own.measuredWidthMm shouldBe (Dots.ptToMm(Samples.SORANI_NAME.length * 0.5 * own.sizePt) plusOrMinus 1e-9)
            }

            test("the Latin name, MRN, date of birth and encounter, in Latin, left to right") {
                listOf(1 to Samples.LATIN_NAME, 3 to Samples.MRN, 5 to "1985-07-14", 11 to Samples.ENCOUNTER).forEach { (index, text) ->
                    val line = layout.inBox(band.elements[index]).single()
                    line.text shouldBe text
                    line.fonts shouldBe listOf(FontSpec(FontRole.LATIN, FontWeight.REGULAR))
                    line.rightToLeft shouldBe false
                }
            }

            test("captions in the label language; the approximate caption only for an approximate date") {
                layout.texts() shouldContain "MRN"
                layout.texts() shouldContain "DOB"
                layout.texts() shouldContain "Enc."
                layout.texts() shouldNotContain "Approx."
            }

            test("the minimal watermark mark and the synthetic notice") {
                layout.inBox(band.elements[7]).joinToString(" ") { it.text } shouldBe "abcd5678 2026-10-19 14:05"
                layout.inBox(band.elements[9]).joinToString(" ") { it.text } shouldBe LayoutEngine.NOTICE
            }

            test("the DataMatrix carries the payload built from the same content, with the job id as band serial") {
                val barcode = layout.barcodes.single()
                barcode.symbology shouldBe Symbology.DATAMATRIX
                barcode.payload shouldBe "HMS1|M:SYN-0000123|E:SYN-E-000042|B:${Samples.JOB_ID}"
                barcode.xMm shouldBe 190.0
                barcode.yMm shouldBe 3.0
                barcode.moduleMm shouldBe 0.5
                barcode.maxSizeMm shouldBe 13.0
            }
        }

        test("Sorani and Arabic labels: captions in the label language, Arabic font, right to left; the names do not change") {
            listOf(LabelLanguage.CKB to "ژمارەی تۆمار", LabelLanguage.AR to "رقم السجل").forEach { (language, mrnCaption) ->
                val layout = laid(band, Samples.wristband(), language)
                val caption = layout.inBox(band.elements[2]).single()
                caption.text shouldBe mrnCaption
                caption.rightToLeft shouldBe true
                caption.fonts shouldBe listOf(FontSpec(FontRole.ARABIC, FontWeight.REGULAR))
                layout.inBox(band.elements[0]).single().text shouldBe Samples.SORANI_NAME
                layout.inBox(band.elements[3]).single().let {
                    it.text shouldBe Samples.MRN
                    it.rightToLeft shouldBe false
                }
            }
        }

        test("a digit-only MRN under ckb stays left to right") {
            val watermark = Samples.watermark().copy(patientMrn = "0000123")
            val line =
                laid(band, Samples.wristband(Samples.identity(mrn = "0000123")), LabelLanguage.CKB, watermark)
                    .inBox(band.elements[3])
                    .single()
            line.text shouldBe "0000123"
            line.rightToLeft shouldBe false
        }

        test("an approximate date of birth prints ~ and the approximate caption in the label language") {
            val identity = Samples.identity(birthDate = BirthDate("1985-07", DatePrecision.MONTH, approximate = true))
            val layout = laid(band, Samples.wristband(identity), LabelLanguage.CKB)
            layout.inBox(band.elements[5]).single().text shouldBe "~1985-07"
            layout.inBox(band.elements[6]).single().text shouldBe "نزیکەیی"
        }

        context("the approximate caption is identity-like (R5: subject to R6 and the legibility minimum)") {
            val approximateDob = Samples.identity(birthDate = BirthDate("1985", DatePrecision.YEAR, approximate = true))

            test("it never prints below the legibility minimum: Arabic 8 pt at 8 dots/mm, whatever the template says") {
                val line = laid(band, Samples.wristband(approximateDob), LabelLanguage.AR).inBox(band.elements[6]).single()
                line.text shouldBe "تقريبي"
                line.sizePt shouldBe (Dots.quantisePt(8.0, 8.0) plusOrMinus 1e-12)
            }

            test("when it does not fit it is refused as identity text, never cut") {
                val approximate = band.elements[6] as Element.Caption
                val longCaption = band.captions.getValue("approximate") + (LabelLanguage.EN to "Approximate")
                val narrowBox = approximate.copy(box = Samples.box(157.0, 16.6, 10.0, 6.8))
                val narrow =
                    band.copy(
                        captions = band.captions + ("approximate" to longCaption),
                        elements = band.elements.toMutableList().also { it[6] = narrowBox },
                    )
                val refusal = refusedLayout(narrow, Samples.wristband(approximateDob))
                refusal.reason shouldBe RefusalReason.IDENTITY_DOES_NOT_FIT
                refusal.subject shouldBe "caption.approximate"
                // With an exact date the caption does not print, so nothing is refused.
                laid(narrow, Samples.wristband()).texts() shouldNotContain "Approximate"
            }
        }

        test("a Latin-own patient: the own element prints the Latin name, the Latin element prints nothing") {
            val layout = laid(band, Samples.wristband(Samples.latinOwn))
            layout.inBox(band.elements[0]).single().let {
                it.text shouldBe Samples.LATIN_NAME
                it.fonts shouldBe listOf(FontSpec(FontRole.LATIN, FontWeight.REGULAR))
                it.rightToLeft shouldBe false
            }
            layout.inBox(band.elements[1]).shouldBeEmpty()
        }

        test("Arabic newborn, alias and twins print whole; twins differ only in the marker") {
            laid(band, Samples.wristband(Samples.newborn)).texts() shouldContain "طفل شيلان أحمد"
            laid(band, Samples.wristband(Samples.alias)).texts() shouldContain "Trauma Zulu-17"
            val a = laid(band, Samples.wristband(Samples.twin("أ" to "A"))).texts()
            val b = laid(band, Samples.wristband(Samples.twin("ب" to "B"))).texts()
            a shouldContain "کۆرپەی شیلان ئەحمەد أ"
            b shouldContain "Baby of Shilan Ahmad B"
            (a - b.toSet()).toSet() shouldBe setOf("کۆرپەی شیلان ئەحمەد أ", "Baby of Shilan Ahmad A")
        }

        context("R6: identity text never truncated") {
            // At 8 dots/mm the smallest Arabic size is 8 pt → 23 dots = 8.150 pt; 95 mm holds 66 characters of 0.5 em.
            fun name(length: Int) = "ب".repeat(30) + " " + "ب".repeat(length - 31)

            fun identity(length: Int) =
                Samples.identity(names = mapOf(NameForm.AR to name(length), NameForm.LATIN to Samples.LATIN_NAME), ownForm = NameForm.AR)

            test("a name at the edge of fitting prints whole at the minimum size") {
                val line = laid(band, Samples.wristband(identity(66))).inBox(band.elements[0]).single()
                line.text shouldBe name(66)
                line.sizePt shouldBe (Dots.quantisePt(8.0, 8.0) plusOrMinus 1e-12)
            }

            test("one character more is refused, never cut") {
                val refusal = refusedLayout(band, Samples.wristband(identity(67)))
                refusal.reason shouldBe RefusalReason.IDENTITY_DOES_NOT_FIT
                refusal.subject shouldBe "identity.name.own"
                refusal.detail.orEmpty() shouldContain "minimum size"
            }

            test("a long Latin name, MRN or encounter is refused the same way") {
                val long =
                    Samples.identity(
                        names = mapOf(NameForm.CKB to Samples.SORANI_NAME, NameForm.LATIN to "Shilan ".repeat(14).trim()),
                    )
                refusedLayout(band, Samples.wristband(long)).subject shouldBe "identity.name.latin"
                val longMrn = "SYN-" + "0".repeat(40)
                refusedLayout(band, Samples.wristband(Samples.identity(mrn = longMrn)), Samples.watermark().copy(patientMrn = longMrn))
                    .subject shouldBe "identity.mrn"
            }

            test("the legibility minimum depends on the resolution: 7 pt Arabic is allowed only at 12 dots/mm or more") {
                val own = band.elements[0] as Element.Text
                val highResolution =
                    band.copy(
                        media = band.media.copy(minDotsPerMm = 12.0),
                        elements = band.elements.toMutableList().also { it[0] = own.copy(size = SizeRange(12.0, 7.0)) },
                    )
                // 70 characters: too wide at 8 pt, fits at 7 pt (7.087 pt at 12 dots/mm holds 75).
                laid(highResolution, Samples.wristband(identity(70)), dotsPerMm = 12.0).texts() shouldContain name(70)
                refusedLayout(highResolution, Samples.wristband(identity(70)), dotsPerMm = 8.0).reason shouldBe
                    RefusalReason.PRINTER_UNSUPPORTED
                refusedLayout(band, Samples.wristband(identity(70)), dotsPerMm = 12.0).reason shouldBe RefusalReason.IDENTITY_DOES_NOT_FIT
            }
        }

        context("refusals before layout") {
            test("a missing glyph is unrenderable text") {
                val shaper = FakeTextShaper(missing = setOf('ئ'.code))
                refusedLayout(band, Samples.wristband(), shaper = shaper).let {
                    it.reason shouldBe RefusalReason.UNRENDERABLE_TEXT
                    it.subject shouldBe "identity.name.own"
                }
            }

            test("a template with a lint finding is refused") {
                refusedLayout(band.copy(elements = band.elements.filterNot { it is Element.Barcode }), Samples.wristband()).reason shouldBe
                    RefusalReason.TEMPLATE_INVALID
            }

            test("content of another kind is refused") {
                refusedLayout(Samples.specimenTemplate, Samples.wristband()).reason shouldBe RefusalReason.TEMPLATE_INVALID
            }

            test("a non-positive resolution is refused") {
                refusedLayout(band, Samples.wristband(), dotsPerMm = 0.0).reason shouldBe RefusalReason.PRINTER_UNSUPPORTED
                refusedLayout(band, Samples.wristband(), dotsPerMm = Double.NaN).reason shouldBe RefusalReason.PRINTER_UNSUPPORTED
            }

            test("a patient print without a watermark is refused") {
                refusedLayout(band, Samples.wristband(), watermark = null).subject shouldBe "watermark"
            }

            test("the watermark's text follows R7 and R8") {
                refusedLayout(band, Samples.wristband(), watermark = Samples.watermark().copy(userDisplayName = "Hana" + cp(0x202E))).let {
                    it.reason shouldBe RefusalReason.UNRENDERABLE_TEXT
                    it.subject shouldBe "watermark"
                }
                refusedLayout(
                    band,
                    Samples.wristband(),
                    watermark = Samples.watermark().copy(staffId = "SYN-" + cp(0x0661)),
                ).reason shouldBe
                    RefusalReason.EASTERN_DIGITS
            }

            test("a blank watermark field or an invalid zone is refused") {
                refusedLayout(band, Samples.wristband(), watermark = Samples.watermark().copy(staffId = " ")).subject shouldBe "watermark"
                refusedLayout(band, Samples.wristband(), watermark = Samples.watermark().copy(zoneId = "Nowhere/City")).subject shouldBe
                    "watermark"
            }

            test("a watermark naming another MRN than the printed one is refused (spec §8.5)") {
                refusedLayout(band, Samples.wristband(), watermark = Samples.watermark().copy(patientMrn = "SYN-0000999")).let {
                    it.reason shouldBe RefusalReason.TEMPLATE_INVALID
                    it.subject shouldBe "watermark"
                }
                refusedLayout(band, Samples.wristband(), watermark = Samples.watermark().copy(patientMrn = null)).subject shouldBe
                    "watermark"
            }

            test("a band serial outside the identifier alphabet is refused (R4 on the payload)") {
                refusedLayout(band, Samples.wristband(), watermark = Samples.watermark().copy(jobId = "job 1")).let {
                    it.reason shouldBe RefusalReason.IDENTIFIER_INVALID
                    it.subject shouldBe "barcode.wristband.serial"
                }
            }
        }

        test("a reprint adds R to the minimal mark") {
            laid(
                band,
                Samples.wristband(),
                watermark = Samples.watermark(reprintOf = "SYN-JOB-0"),
            ).inBox(band.elements[7]).joinToString(" ") {
                it.text
            } shouldBe "abcd5678 2026-10-19 14:05 R"
        }

        context("a specimen label") {
            val tube = Samples.specimenTemplate
            test("the default DataMatrix carries the specimen ID and the MRN; the ID prints beside it") {
                val layout = laid(tube, Samples.specimen())
                layout.barcodes.single().payload shouldBe "HMS1|S:SYN-S-0000077|M:SYN-0000123"
                layout.inBox(tube.elements[8]).single().text shouldBe Samples.SPECIMEN
            }

            test("the Code 128 option carries the specimen ID alone") {
                val barcode = tube.elements[7] as Element.Barcode
                val code128 =
                    tube.copy(
                        elements =
                            tube.elements.toMutableList().also {
                                it[7] =
                                    barcode.copy(symbology = Symbology.CODE128, moduleMm = 0.25, box = Samples.box(37.0, 2.0, 10.0, 12.0))
                            },
                    )
                laid(code128, Samples.specimen()).barcodes.single().let {
                    it.symbology shouldBe Symbology.CODE128
                    it.payload shouldBe Samples.SPECIMEN
                }
            }

            test("the own name wraps onto its two lines, word by word") {
                val lines = laid(tube, Samples.specimen()).inBox(tube.elements[0])
                lines.map { it.text } shouldBe listOf("شیلان ئەحمەد محەمەد", "کەریم")
                lines[1].baselineMm - lines[0].baselineMm shouldBe (lines[0].lineHeightMm plusOrMinus 1e-9)
            }
        }

        context("a receipt (flow kind)") {
            val receipt = Samples.receiptTemplate
            test("elements stack top to bottom in template order and the frame grows to the content") {
                val layout = laid(receipt, Samples.receipt())
                layout.lines.map { it.topMm } shouldBeSortedWith compareBy<Double> { it }
                layout.lines.first().text shouldBe "SYNTHETIC – NOT FOR CLINICAL USE"
                layout.frameWidthMm shouldBe 80.0
                layout.frameHeightMm shouldBeGreaterThanOrEqual 60.0
                layout.frameHeightMm shouldBe ((layout.lines.last().topMm + layout.lines.last().lineHeightMm) plusOrMinus 3.0)
            }

            test("rows: description start-aligned at the start column, amount end-aligned at the end column") {
                val layout = laid(receipt, Samples.receipt())
                val description = layout.lines.single { it.text == "Consultation" }
                val amount = layout.lines.first { it.text == "25,000 IQD" }
                description.align shouldBe Align.START
                description.boxXMm shouldBe 4.0
                amount.align shouldBe Align.END
                amount.boxXMm shouldBe 56.0
                amount.topMm shouldBe description.topMm
            }

            test("in a right-to-left label language the columns follow its reading order") {
                val layout = laid(receipt, Samples.receipt(), LabelLanguage.CKB)
                layout.lines.single { it.text == "Consultation" }.boxXMm shouldBe 26.0
                layout.lines.first { it.text == "25,000 IQD" }.boxXMm shouldBe 4.0
            }

            test("the full watermark line, the issuer lines as paragraphs, mixed fonts for non-identity text") {
                val layout = laid(receipt, Samples.receipt())
                layout.texts().joinToString(" ") shouldContain "Dr Hana Aziz (SYN-ST-001) · 2026-10-19 14:05 · MRN SYN-0000123 · Job"
                layout.lines.single { it.text == "نەخۆشخانەی SYN" }.fonts shouldBe
                    listOf(FontSpec(FontRole.LATIN, FontWeight.REGULAR), FontSpec(FontRole.ARABIC, FontWeight.REGULAR))
                layout.lines
                    .first { it.text == "Total" }
                    .fonts
                    .first()
                    .weight shouldBe FontWeight.BOLD
            }

            test("an identity field that does not fit is refused; a long receipt number too") {
                val content = Samples.receipt() as PrintContent.Receipt
                val long = content.copy(content = content.content.copy(receiptNumber = "SYN-" + "9".repeat(60)))
                refusedLayout(receipt, long).let {
                    it.reason shouldBe RefusalReason.IDENTITY_DOES_NOT_FIT
                    it.subject shouldBe "receipt.number"
                }
            }

            test("wrap-grow text grows instead of being cut") {
                val content = Samples.receipt() as PrintContent.Receipt
                val cashier = "Cashier " + "Zana ".repeat(40).trim()
                val layout = laid(receipt, content.copy(content = content.content.copy(cashier = cashier)))
                layout.lines.filter { it.text.startsWith("Cashier") || it.text.startsWith("Zana") }.joinToString(" ") { it.text } shouldBe
                    cashier
            }
        }

        context("a token") {
            test("lays out without a watermark and prints no patient data") {
                val layout = laid(Samples.tokenTemplate, Samples.token, watermark = null)
                layout.texts() shouldContain "A-017"
                layout.texts() shouldContain "2026-10-19 14:05"
                layout.texts().none { it.contains("SYN-ST-001") } shouldBe true
            }

            test("non-identity text that does not fit with overflow refuse is a template that does not suit the content") {
                val token = PrintContent.Token(TokenContent("A-" + "0".repeat(40), "Pharmacy", Samples.PRINTED_AT))
                refusedLayout(Samples.tokenTemplate, token, watermark = null).let {
                    it.reason shouldBe RefusalReason.TEMPLATE_INVALID
                    it.subject shouldBe "token.number"
                }
            }
        }

        context("a document: the banner block only (spec §7.4)") {
            val layout = laid(Samples.documentTemplate, Samples.document(), dotsPerMm = 24.0)
            test("identity, captions and banner rows are laid out; title, body and watermark are not") {
                val texts = layout.texts()
                texts shouldContain Samples.SORANI_NAME
                texts shouldContain "Allergies"
                texts shouldContain "Penicillin (rash, moderate); Latex"
                texts shouldContain "Unavailable"
                texts shouldContain "No photo"
                texts shouldNotContain "Discharge summary"
                texts shouldNotContain "Synthetic note."
                texts.none { it.contains("SYN-ST-001") } shouldBe true
            }

            test("the banner height is the laid-out block") {
                layout.frameWidthMm shouldBe 210.0
                layout.lines.maxOf { it.topMm } shouldBeGreaterThanOrEqual 15.0
            }

            test("every other recorded name form prints below the own and the Latin form, in its own script (spec §4.1)") {
                val arabicForm = "شيلان أحمد محمد كريم"
                val identity =
                    Samples.identity(
                        names = mapOf(NameForm.CKB to Samples.SORANI_NAME, NameForm.AR to arabicForm, NameForm.LATIN to Samples.LATIN_NAME),
                    )
                val names = laid(Samples.documentTemplate, Samples.document(identity), dotsPerMm = 24.0).lines
                val own = names.single { it.text == Samples.SORANI_NAME }
                val latin = names.single { it.text == Samples.LATIN_NAME }
                val other = names.single { it.text == arabicForm }
                other.fonts shouldBe listOf(FontSpec(FontRole.ARABIC, FontWeight.REGULAR))
                other.rightToLeft shouldBe true
                (own.topMm < latin.topMm && latin.topMm < other.topMm) shouldBe true
                // Labels print no third form.
                laid(band, Samples.wristband(identity)).texts() shouldNotContain arabicForm
            }

            test("a Latin-own patient's other forms print below the single Latin name") {
                val arabicForm = "شيلان أحمد"
                val identity =
                    Samples.identity(
                        names = mapOf(NameForm.LATIN to Samples.LATIN_NAME, NameForm.AR to arabicForm),
                        ownForm = NameForm.LATIN,
                    )
                val lines = laid(Samples.documentTemplate, Samples.document(identity), dotsPerMm = 24.0).lines
                lines.count { it.text == Samples.LATIN_NAME } shouldBe 1
                (lines.single { it.text == Samples.LATIN_NAME }.topMm < lines.single { it.text == arabicForm }.topMm) shouldBe true
            }

            test("another name form that does not fit is refused as identity text, never cut") {
                val long = (1..40).joinToString(" ") { "شيلان" }
                val identity =
                    Samples.identity(
                        names = mapOf(NameForm.CKB to Samples.SORANI_NAME, NameForm.AR to long, NameForm.LATIN to Samples.LATIN_NAME),
                    )
                refusedLayout(Samples.documentTemplate, Samples.document(identity), dotsPerMm = 24.0).let {
                    it.reason shouldBe RefusalReason.IDENTITY_DOES_NOT_FIT
                    it.subject shouldBe "identity.name.ar"
                }
            }

            test("banner captions follow the label language") {
                laid(Samples.documentTemplate, Samples.document(), LabelLanguage.AR, dotsPerMm = 24.0).texts() shouldContain "الحساسية"
            }
        }
    })
