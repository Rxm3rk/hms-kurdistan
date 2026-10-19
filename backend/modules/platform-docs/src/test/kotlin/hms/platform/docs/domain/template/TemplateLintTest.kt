package hms.platform.docs.domain.template

import hms.platform.docs.api.LabelLanguage
import hms.platform.docs.domain.testing.Samples
import hms.platform.docs.domain.testing.Samples.box
import hms.platform.docs.domain.testing.Samples.caption
import hms.platform.docs.domain.testing.Samples.text
import hms.platform.docs.domain.testing.cp
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldNotBeEmpty
import io.kotest.matchers.shouldBe

private fun Template.without(binding: Binding): Template = copy(elements = elements.filterNot { it is Element.Bound && it.bind == binding })

private fun Template.withoutCaption(key: String): Template = copy(elements = elements.filterNot { it is Element.Caption && it.key == key })

private fun Template.replace(
    index: Int,
    element: Element,
): Template = copy(elements = elements.toMutableList().also { it[index] = element })

private fun Template.plus(element: Element): Template = copy(elements = elements + element)

private fun Template.rules(): List<Int> = TemplateLint.lint(this).map { it.rule }

private fun Template.findings(rule: Int): List<LintFinding> = TemplateLint.lint(this).filter { it.rule == rule }

private val band = Samples.wristbandTemplate
private val tube = Samples.specimenTemplate

class TemplateLintTest :
    FunSpec({
        test("every sample template is lint-clean") {
            Samples.allTemplates.forEach { TemplateLint.lint(it).shouldBeEmpty() }
        }

        context("TemplateLint:identifier-slots-on-clinical-templates (rule 1, CTRL-0001-5)") {
            val slots = listOf(Binding.IDENTITY_NAME_OWN, Binding.IDENTITY_NAME_LATIN, Binding.IDENTITY_MRN, Binding.IDENTITY_BIRTH_DATE)
            test("every patient kind needs the name in both forms, the MRN and the date of birth") {
                Samples.allTemplates.filter { it.kind.patientPrint }.forEach { template ->
                    slots.forEach { slot ->
                        val findings = template.without(slot).findings(1)
                        findings.map { it.message } shouldContain
                            "a ${template.kind.yamlName} template has no text element bound to ${slot.yamlName}"
                    }
                }
            }

            test("a patient template needs the 'approximate' caption (R5)") {
                band.withoutCaption(CaptionKeys.APPROXIMATE).findings(1).shouldNotBeEmpty()
            }

            test("the 'approximate' caption must be beside the date on a fixed layout (within 3 mm)") {
                val approximate = band.elements[6] as Element.Caption
                // The date of birth ends at x 156.5: a caption starting at 159.5 is exactly 3 mm away, 159.6 is not.
                band.replace(6, approximate.copy(box = box(159.5, 16.6, 15.5, 6.8))).findings(1).shouldBeEmpty()
                band
                    .replace(6, approximate.copy(box = box(159.6, 16.6, 15.4, 6.8)))
                    .findings(1)
                    .single() shouldBe LintFinding(1, 6, "the 'approximate' caption is not beside the date of birth")
            }

            test("the 'approximate' caption must be next to the date in a flow layout's reading order") {
                val receipt = Samples.receiptTemplate
                // Elements 7 and 8 are the date of birth and its approximate caption; 9 is the receipt number.
                val swapped = receipt.copy(elements = receipt.elements.toMutableList().also { it.add(9, it.removeAt(8)) })
                swapped.findings(1).single().elementIndex shouldBe 9
                val before = receipt.copy(elements = receipt.elements.toMutableList().also { it.add(7, it.removeAt(8)) })
                before.findings(1).shouldBeEmpty()
            }

            test("a token needs no identifier slots") {
                Samples.tokenTemplate.findings(1).shouldBeEmpty()
            }
        }

        context("rule 2: closed bindings per kind") {
            test("a binding the kind does not have is refused") {
                band
                    .plus(text(Binding.SPECIMEN_ID, box(212.0, 18.2, 12.0, 5.0), FontChoice.LATIN, 8.0, 6.0, direction = TextDirection.LTR))
                    .findings(2)
                    .single()
                    .elementIndex shouldBe band.elements.size
            }

            test("a token may not carry a watermark or a patient field") {
                Samples.tokenTemplate
                    .plus(text(Binding.WATERMARK, box(4.0, 1.0, 72.0, 5.0), FontChoice.LATIN, 7.0, 6.0))
                    .findings(2)
                    .shouldNotBeEmpty()
                Samples.tokenTemplate
                    .plus(text(Binding.IDENTITY_SEX, box(4.0, 1.0, 72.0, 5.0), FontChoice.LATIN, 7.0, 6.0))
                    .findings(2)
                    .shouldNotBeEmpty()
            }

            test("a binding on the wrong element type is refused") {
                band
                    .replace(
                        9,
                        text(Binding.BARCODE_WRISTBAND, box(204.0, 2.0, 21.0, 14.0), FontChoice.LATIN, 6.0, 5.0),
                    ).rules() shouldContain
                    2
                val rows =
                    Element.Rows(
                        Binding.TOKEN_NUMBER,
                        box(204.0, 2.0, 21.0, 14.0),
                        FontChoice.MIXED,
                        FontWeight.REGULAR,
                        SizeRange(6.0, 5.0),
                        10.0,
                        10.0,
                    )
                band.replace(9, rows).findings(2).size shouldBe 2
            }
        }

        context("rule 3: identity text is never clipped") {
            val own = band.elements[0] as Element.Text
            test("identity text must refuse overflow") {
                band
                    .replace(0, own.copy(overflow = Overflow.WRAP_GROW))
                    .findings(3)
                    .single()
                    .elementIndex shouldBe 0
            }

            test("max_lines below 1") {
                band.replace(0, own.copy(maxLines = 0)).findings(3).shouldNotBeEmpty()
            }

            test("a size range needs 0 < min <= max") {
                band.replace(0, own.copy(size = SizeRange(8.0, 9.0))).findings(3).shouldNotBeEmpty()
                band.replace(0, own.copy(size = SizeRange(8.0, 0.0))).findings(3).shouldNotBeEmpty()
                band.replace(2, caption(CaptionKeys.MRN, box(75.0, 16.6, 14.0, 5.0), 6.0, 6.5)).findings(3).shouldNotBeEmpty()
            }

            test("non-identity text on a fixed layout must refuse overflow; in a flow kind it may wrap-grow") {
                val notice = band.elements[9] as Element.Text
                band.replace(9, notice.copy(overflow = Overflow.WRAP_GROW)).findings(3).shouldNotBeEmpty()
                Samples.receiptTemplate.findings(3).shouldBeEmpty()
            }
        }

        context("rule 4: barcodes (§12.8)") {
            test("a wristband without its DataMatrix is refused") {
                band.without(Binding.BARCODE_WRISTBAND).findings(4).shouldNotBeEmpty()
            }

            test("a wristband barcode in Code 128 is refused") {
                val barcode = band.elements[8] as Element.Barcode
                band
                    .replace(
                        8,
                        barcode.copy(symbology = Symbology.CODE128, moduleMm = 0.25),
                    ).findings(4)
                    .map { it.elementIndex } shouldContain
                    8
            }

            test("a specimen label without a barcode, or without the specimen ID next to it, is refused") {
                tube.without(Binding.BARCODE_SPECIMEN).findings(4).shouldNotBeEmpty()
                tube
                    .without(Binding.SPECIMEN_ID)
                    .findings(4)
                    .single()
                    .elementIndex shouldBe 7
            }

            test("the specimen ID more than 3 mm from the barcode is not next to it") {
                val id = tube.elements[8] as Element.Text
                // The barcode ends at y = 14; 17.0 is exactly 3 mm away (allowed), 17.1 is not.
                val moved = tube.replace(9, (tube.elements[9] as Element.Text).copy(box = box(33.0, 22.6, 16.5, 9.0)))
                moved.replace(8, id.copy(box = box(33.0, 17.0, 16.5, 4.5))).findings(4).shouldBeEmpty()
                moved.replace(8, id.copy(box = box(33.0, 17.1, 16.5, 4.5))).findings(4).shouldNotBeEmpty()
            }

            test("a Code 128 specimen barcode is a valid template option") {
                val barcode = tube.elements[7] as Element.Barcode
                tube
                    .replace(
                        7,
                        barcode.copy(symbology = Symbology.CODE128, moduleMm = 0.25, box = box(37.0, 2.0, 10.0, 12.0)),
                    ).rules()
                    .shouldBeEmpty()
            }
        }

        context("TemplateLint:banner-on-every-clinical-print (rule 5, SI-16, DP-8; UnitTest:watermark-on-every-patient-print, lint part)") {
            test("a document without the banner is refused") {
                Samples.documentTemplate
                    .without(Binding.DOCUMENT_BANNER)
                    .findings(5)
                    .single()
                    .message shouldBe
                    "a document has no document.banner element"
            }

            test("a document without the watermark is refused") {
                Samples.documentTemplate
                    .without(Binding.WATERMARK)
                    .findings(5)
                    .shouldNotBeEmpty()
            }

            test("every patient kind needs a watermark") {
                Samples.allTemplates.filter { it.kind.patientPrint }.forEach {
                    it
                        .without(
                            Binding.WATERMARK,
                        ).findings(5)
                        .shouldNotBeEmpty()
                }
            }
        }

        context("rule 6: geometry") {
            val notice = band.elements[9] as Element.Text
            test("an element off the printable area is refused") {
                band.replace(9, notice.copy(box = box(204.0, 2.0, 21.1, 14.0))).findings(6).shouldNotBeEmpty()
                band.replace(9, notice.copy(box = box(204.0, 1.9, 21.0, 14.0))).findings(6).shouldNotBeEmpty()
            }

            test("intersecting boxes are refused; touching boxes are not") {
                val latin = band.elements[1] as Element.Text
                band
                    .replace(1, latin.copy(box = box(75.0, 11.5, 100.0, 4.6)))
                    .findings(6)
                    .single()
                    .message shouldBe
                    "the box intersects the box of element 1"
                band.replace(1, latin.copy(box = box(75.0, 11.6, 100.0, 5.0))).findings(6).shouldBeEmpty()
            }

            test("a module below 0.25 mm is refused") {
                val barcode = band.elements[8] as Element.Barcode
                band.replace(8, barcode.copy(moduleMm = 0.24)).findings(6).shouldNotBeEmpty()
            }

            test("nothing may enter the quiet zone (one module for DataMatrix)") {
                band.replace(9, notice.copy(box = box(203.4, 2.0, 21.0, 14.0))).findings(6).map { it.message } shouldContain
                    "element 9 enters the barcode's quiet zone"
                band.replace(9, notice.copy(box = box(203.5, 2.0, 21.0, 14.0))).findings(6).shouldBeEmpty()
            }

            test("ten modules left and right for Code 128") {
                val barcode = tube.elements[7] as Element.Barcode
                // 0.25 mm modules: the quiet zone runs from x 30.5, into the own name's box (which ends at x 31).
                tube
                    .replace(7, barcode.copy(symbology = Symbology.CODE128, moduleMm = 0.25, box = box(33.0, 2.0, 12.0, 12.0)))
                    .findings(6)
                    .shouldNotBeEmpty()
            }

            test("rotation, printable area and row columns") {
                band.copy(media = band.media.copy(rotation = 45)).findings(6).shouldNotBeEmpty()
                band.copy(media = band.media.copy(printable = box(75.0, 2.0, 210.0, 21.4))).findings(6).shouldNotBeEmpty()
                val receipt = Samples.receiptTemplate
                val rows = receipt.elements[10] as Element.Rows
                receipt.replace(10, rows.copy(descriptionWidthMm = 55.0)).findings(6).shouldNotBeEmpty()
                receipt.replace(10, rows.copy(amountWidthMm = 0.0)).findings(6).shouldNotBeEmpty()
            }

            test("flow kinds: horizontal extent only, a negative gap is refused") {
                val receipt = Samples.receiptTemplate
                val cashier = receipt.elements[12] as Element.Text
                receipt.replace(12, cashier.copy(box = box(3.0, 1.0, 72.0, 5.0))).findings(6).shouldNotBeEmpty()
                receipt.replace(12, cashier.copy(box = box(4.0, -1.0, 72.0, 5.0))).findings(6).shouldNotBeEmpty()
                receipt.replace(12, cashier.copy(box = box(4.0, 100.0, 72.0, 5.0))).findings(6).shouldBeEmpty()
            }
        }

        context("rule 7: one script per element, identifiers never reordered") {
            val own = band.elements[0] as Element.Text
            val mrn = band.elements[3] as Element.Text
            test("the own name must choose its font by script") {
                band.replace(0, own.copy(font = FontChoice.ARABIC)).findings(7).shouldNotBeEmpty()
            }

            test("identity text never uses the mixed chain") {
                band.replace(0, own.copy(font = FontChoice.MIXED)).findings(7).map { it.message } shouldContain
                    "identity text identity.name.own uses one font, never mixed"
            }

            test("identifiers must be Latin and left-to-right") {
                band.replace(3, mrn.copy(direction = TextDirection.AUTO)).findings(7).shouldNotBeEmpty()
                band.replace(3, mrn.copy(font = FontChoice.BY_SCRIPT)).findings(7).shouldNotBeEmpty()
                band.replace(3, mrn.copy(font = FontChoice.MIXED)).findings(7).size shouldBe 2
            }

            test("the Latin name may use latin or by-script, nothing else") {
                val latin = band.elements[1] as Element.Text
                band.replace(1, latin.copy(font = FontChoice.BY_SCRIPT)).findings(7).shouldBeEmpty()
                band.replace(1, latin.copy(font = FontChoice.ARABIC)).findings(7).shouldNotBeEmpty()
            }

            test("captions use one font; non-identity text may be mixed") {
                band.replace(2, (band.elements[2] as Element.Caption).copy(font = FontChoice.MIXED)).findings(7).shouldNotBeEmpty()
                Samples.receiptTemplate.findings(7).shouldBeEmpty()
            }
        }

        context("rule 8: captions in en, ckb and ar") {
            test("a caption without text in one language is refused") {
                LabelLanguage.entries.forEach { language ->
                    val captions = band.captions + (CaptionKeys.MRN to band.captions.getValue(CaptionKeys.MRN) - language)
                    band
                        .copy(captions = captions)
                        .findings(8)
                        .single()
                        .message shouldBe "caption 'mrn' in ${language.tag} has no text"
                }
            }

            test("a caption with an unprintable character is refused") {
                val captions =
                    band.captions +
                        (CaptionKeys.DOB to band.captions.getValue(CaptionKeys.DOB) + (LabelLanguage.AR to "الميلاد" + cp(0x200F)))
                band.copy(captions = captions).findings(8).shouldNotBeEmpty()
                val eastern =
                    band.captions +
                        (CaptionKeys.DOB to band.captions.getValue(CaptionKeys.DOB) + (LabelLanguage.AR to "الميلاد" + cp(0x0661)))
                band.copy(captions = eastern).findings(8).shouldNotBeEmpty()
            }

            test("a document banner needs every banner caption") {
                val captions = Samples.documentTemplate.captions - CaptionKeys.BANNER_NO_PHOTO
                Samples.documentTemplate
                    .copy(captions = captions)
                    .findings(8)
                    .size shouldBe 3
            }
        }

        context("rule 9: the synthetic notice (§19.4)") {
            test("a synthetic template without the notice is refused") {
                band.without(Binding.NOTICE_SYNTHETIC).findings(9).shouldNotBeEmpty()
            }

            test("an approved template need not carry it") {
                band
                    .without(Binding.NOTICE_SYNTHETIC)
                    .copy(provenance = Provenance.APPROVED)
                    .findings(9)
                    .shouldBeEmpty()
            }
        }

        context("rule 10: legibility minimum (§5.4)") {
            val own = band.elements[0] as Element.Text
            test("Arabic-capable identity text below 8 pt at 8 dots/mm is refused") {
                band
                    .replace(0, own.copy(size = SizeRange(12.0, 7.5)))
                    .findings(10)
                    .single()
                    .elementIndex shouldBe 0
            }

            test("7 pt is enough when the template only prints at 12 dots/mm or more") {
                val highResolution = band.copy(media = band.media.copy(minDotsPerMm = 12.0))
                highResolution.replace(0, own.copy(size = SizeRange(12.0, 7.0))).findings(10).shouldBeEmpty()
                highResolution.replace(0, own.copy(size = SizeRange(12.0, 6.5))).findings(10).shouldNotBeEmpty()
            }

            test("Latin identity text at 6 pt passes; below it is refused") {
                val mrn = band.elements[3] as Element.Text
                band.findings(10).shouldBeEmpty()
                band.replace(3, mrn.copy(size = SizeRange(9.0, 5.5))).findings(10).shouldNotBeEmpty()
            }

            test("the policy is a parameter") {
                TemplateLint.lint(band, LegibilityPolicy(latinMinPt = 6.5)).filter { it.rule == 10 }.shouldNotBeEmpty()
            }

            test("the 'approximate' caption is held to the legibility minimum like identity text (R5)") {
                val approximate = band.elements[6] as Element.Caption
                band
                    .replace(6, approximate.copy(size = SizeRange(8.0, 7.5)))
                    .findings(10)
                    .single()
                    .elementIndex shouldBe 6
                val highResolution = band.copy(media = band.media.copy(minDotsPerMm = 12.0))
                highResolution.replace(6, approximate.copy(size = SizeRange(8.0, 7.0))).findings(10).shouldBeEmpty()
                // Other captions are not identity text.
                band.findings(10).shouldBeEmpty()
                (band.elements[2] as Element.Caption).size.minPt shouldBe 6.0
            }

            test("a document's Latin-name element also prints the other name forms, so it needs the Arabic minimum") {
                val document = Samples.documentTemplate
                val latin = document.elements[2] as Element.Text
                document
                    .replace(2, latin.copy(size = SizeRange(11.0, 7.5)))
                    .findings(10)
                    .single()
                    .elementIndex shouldBe 2
                // On a label the Latin-name element prints Latin only: 6 pt is enough.
                val bandLatin = band.elements[1] as Element.Text
                band.replace(1, bandLatin.copy(size = SizeRange(9.0, 6.0))).findings(10).shouldBeEmpty()
            }

            test("non-identity text has no legibility minimum") {
                val notice = band.elements[9] as Element.Text
                band.replace(9, notice.copy(size = SizeRange(6.0, 4.0))).findings(10).shouldBeEmpty()
            }
        }

        test("findings carry rule, element index and a message without patient data") {
            val finding = band.replace(0, (band.elements[0] as Element.Text).copy(maxLines = 0)).findings(3).single()
            finding shouldBe LintFinding(3, 0, "max_lines below 1")
        }
    })
