package hms.platform.docs.domain.rules

import hms.platform.docs.api.BirthDate
import hms.platform.docs.api.DatePrecision
import hms.platform.docs.api.DocumentBlock
import hms.platform.docs.api.LabelledText
import hms.platform.docs.api.NameForm
import hms.platform.docs.api.PrintAllergies
import hms.platform.docs.api.PrintAllergy
import hms.platform.docs.api.PrintBanner
import hms.platform.docs.api.PrintContent
import hms.platform.docs.api.ReceiptLine
import hms.platform.docs.api.RefusalReason
import hms.platform.docs.api.Script
import hms.platform.docs.api.TokenContent
import hms.platform.docs.api.WristbandContent
import hms.platform.docs.domain.template.Binding
import hms.platform.docs.domain.template.CaptionKeys
import hms.platform.docs.domain.template.TemplateKind
import hms.platform.docs.domain.testing.Samples
import hms.platform.docs.domain.testing.cp
import hms.platform.docs.domain.testing.hex
import io.kotest.core.spec.style.FunSpec
import io.kotest.datatest.withTests
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldNotContain
import io.kotest.matchers.types.shouldBeInstanceOf

private fun check(
    content: PrintContent,
    redact: Set<String> = emptySet(),
): ContentCheck = ContentRules.check(content, redact, Samples.ZONE)

private fun valid(
    content: PrintContent,
    redact: Set<String> = emptySet(),
): ResolvedContent = check(content, redact).shouldBeInstanceOf<ContentCheck.Valid>().content

private fun refused(
    content: PrintContent,
    redact: Set<String> = emptySet(),
) = check(content, redact).shouldBeInstanceOf<ContentCheck.Refused>().refusal

private fun dob(
    value: String,
    precision: DatePrecision,
    approximate: Boolean = false,
) = BirthDate(value, precision, approximate)

class ContentRulesTest :
    FunSpec({
        context("R1 and R3 (SI-01 a, c, d)") {
            test("UnitTest:print-fails-closed-without-transliteration: a missing Latin form refuses") {
                val refusal = refused(Samples.wristband(Samples.identity(names = mapOf(NameForm.CKB to Samples.SORANI_NAME))))
                refusal.reason shouldBe RefusalReason.IDENTITY_INCOMPLETE
                refusal.subject shouldBe "identity.name.latin"
            }

            test("UnitTest:print-fails-closed-without-transliteration: a blank Latin form refuses") {
                val names = mapOf(NameForm.CKB to Samples.SORANI_NAME, NameForm.LATIN to "   ")
                refused(Samples.wristband(Samples.identity(names = names))).reason shouldBe RefusalReason.IDENTITY_INCOMPLETE
            }

            test("UnitTest:print-fails-closed-without-transliteration: an unconfirmed Latin form refuses (CTRL-0001-6)") {
                val refusal = refused(Samples.wristband(Samples.identity(latinConfirmed = false)))
                refusal.reason shouldBe RefusalReason.IDENTITY_INCOMPLETE
                refusal.subject shouldBe "identity.name.latin"
                refusal.detail shouldBe "Latin form not confirmed by the registrar"
            }

            test("UnitTest:print-fails-closed-without-transliteration: an unconfirmed Latin-own form refuses too (stricter reading)") {
                refused(
                    Samples.wristband(
                        Samples.identity(names = mapOf(NameForm.LATIN to "Ann Lee"), ownForm = NameForm.LATIN, latinConfirmed = false),
                    ),
                ).reason shouldBe RefusalReason.IDENTITY_INCOMPLETE
            }

            test("UnitTest:print-fails-closed-without-transliteration: every kind with a patient refuses") {
                val identity = Samples.identity(latinConfirmed = false)
                listOf(Samples.wristband(identity), Samples.specimen(identity), Samples.receipt(identity), Samples.document(identity))
                    .forEach { refused(it).reason shouldBe RefusalReason.IDENTITY_INCOMPLETE }
            }

            test("no own form recorded refuses") {
                refused(Samples.wristband(Samples.identity(ownForm = null))).let {
                    it.reason shouldBe RefusalReason.IDENTITY_INCOMPLETE
                    it.subject shouldBe "identity.name.own"
                }
            }

            test("the own form named but absent refuses") {
                refused(Samples.wristband(Samples.identity(ownForm = NameForm.AR))).subject shouldBe "identity.name.own"
            }

            test("no name at all is R1: identifier missing") {
                refused(Samples.wristband(Samples.identity(names = emptyMap()))).reason shouldBe RefusalReason.IDENTIFIER_MISSING
            }

            test("no MRN is R1") {
                refused(Samples.wristband(Samples.identity(mrn = null))).let {
                    it.reason shouldBe RefusalReason.IDENTIFIER_MISSING
                    it.subject shouldBe "identity.mrn"
                }
            }

            test("no date of birth at all is R1 (DN-073)") {
                refused(Samples.wristband(Samples.identity(birthDate = null))).let {
                    it.reason shouldBe RefusalReason.IDENTIFIER_MISSING
                    it.subject shouldBe "identity.birthDate"
                }
            }

            test("a wristband without an encounter is refused") {
                refused(PrintContent.Wristband(WristbandContent(Samples.sorani, null))).subject shouldBe "encounter.id"
            }

            test("both forms print, each with its script") {
                val content = valid(Samples.wristband())
                content.texts
                    .getValue(Binding.IDENTITY_NAME_OWN)
                    .segments
                    .single() shouldBe TextSegment(Samples.SORANI_NAME, Script.ARAB)
                content.texts
                    .getValue(Binding.IDENTITY_NAME_LATIN)
                    .segments
                    .single() shouldBe TextSegment(Samples.LATIN_NAME, Script.LATN)
                content.text(Binding.IDENTITY_MRN) shouldBe Samples.MRN
                content.text(Binding.ENCOUNTER_ID) shouldBe Samples.ENCOUNTER
            }

            test("a Latin-own patient prints the name once (DN-068)") {
                val content = valid(Samples.wristband(Samples.latinOwn))
                content.texts
                    .getValue(Binding.IDENTITY_NAME_OWN)
                    .segments
                    .single() shouldBe TextSegment(Samples.LATIN_NAME, Script.LATN)
                content.texts.containsKey(Binding.IDENTITY_NAME_LATIN) shouldBe false
                content.omitted shouldContain Binding.IDENTITY_NAME_LATIN
            }

            test("alias, newborn and twin names follow the same rules and print whole") {
                valid(Samples.wristband(Samples.alias)).text(Binding.IDENTITY_NAME_OWN) shouldBe "Trauma Zulu-17"
                valid(Samples.wristband(Samples.newborn)).text(Binding.IDENTITY_NAME_OWN) shouldBe "طفل شيلان أحمد"
                valid(Samples.wristband(Samples.twin("أ" to "A"))).text(Binding.IDENTITY_NAME_LATIN) shouldBe "Baby of Shilan Ahmad A"
                valid(Samples.wristband(Samples.twin("ب" to "B"))).text(Binding.IDENTITY_NAME_OWN) shouldBe "کۆرپەی شیلان ئەحمەد ب"
                refused(Samples.wristband(Samples.alias.copy(latinConfirmed = false))).reason shouldBe RefusalReason.IDENTITY_INCOMPLETE
            }

            test("documents carry every other recorded form for the banner; labels carry none (spec §4.1)") {
                val names =
                    mapOf(
                        NameForm.LATIN to Samples.LATIN_NAME,
                        NameForm.KU_ARAB to "شیلان ئەحمەد",
                        NameForm.CKB to Samples.SORANI_NAME,
                        NameForm.AR to "شيلان أحمد",
                    )
                valid(Samples.document(Samples.identity(names = names))).otherNameForms.toList() shouldBe
                    listOf(NameForm.AR to "شيلان أحمد", NameForm.KU_ARAB to "شیلان ئەحمەد")
                valid(Samples.wristband(Samples.identity(names = names))).otherNameForms shouldBe emptyMap()
                val blank = names + (NameForm.AR to " ")
                valid(Samples.document(Samples.identity(names = blank))).otherNameForms.keys shouldBe setOf(NameForm.KU_ARAB)
            }

            test("another form on a document follows R7 and R8, and the refusal names the form") {
                val names = mapOf(NameForm.CKB to Samples.SORANI_NAME, NameForm.LATIN to Samples.LATIN_NAME)
                refused(Samples.document(Samples.identity(names = names + (NameForm.AR to "شيلان" + cp(0x202B))))).let {
                    it.reason shouldBe RefusalReason.UNRENDERABLE_TEXT
                    it.subject shouldBe "identity.name.ar"
                }
                refused(Samples.document(Samples.identity(names = names + (NameForm.KU_ARAB to "شیلان " + cp(0x06F1))))).let {
                    it.reason shouldBe RefusalReason.EASTERN_DIGITS
                    it.subject shouldBe "identity.name.ku-Arab"
                }
            }

            test("text is printed as stored: no normalisation of ي/ی, ك/ک, ه/ە") {
                val name = "كريم يوسف ه"
                valid(
                    Samples.wristband(
                        Samples.identity(names = mapOf(NameForm.AR to name, NameForm.LATIN to "Karim Yusuf"), ownForm = NameForm.AR),
                    ),
                ).text(Binding.IDENTITY_NAME_OWN) shouldBe name
            }
        }

        context("UnitTest:print-dob-precision-and-approximate-flag (R5)") {
            withTests(
                nameFn = { "${it.first} ${it.second} approximate=${it.third} prints ${it.fourth}" },
                Quad("1985-07-14", DatePrecision.DAY, false, "1985-07-14"),
                Quad("1985-07-14", DatePrecision.DAY, true, "~1985-07-14"),
                Quad("1985-07", DatePrecision.MONTH, false, "~1985-07"),
                Quad("1985-07", DatePrecision.MONTH, true, "~1985-07"),
                Quad("1985", DatePrecision.YEAR, false, "~1985"),
                Quad("1985", DatePrecision.YEAR, true, "~1985"),
                Quad("2024-02-29", DatePrecision.DAY, false, "2024-02-29"),
            ) { case ->
                val content = valid(Samples.wristband(Samples.identity(birthDate = dob(case.first, case.second, case.third))))
                content.text(Binding.IDENTITY_BIRTH_DATE) shouldBe case.fourth
                content.approximateDob shouldBe (case.third || case.second != DatePrecision.DAY)
            }

            withTests(
                nameFn = { "refuses '${it.first}' at ${it.second}" },
                "1985-07" to DatePrecision.DAY,
                "1985-07-14" to DatePrecision.MONTH,
                "1985-07-14" to DatePrecision.YEAR,
                "1985" to DatePrecision.MONTH,
                "85-07-14" to DatePrecision.DAY,
                "1985-7-14" to DatePrecision.DAY,
                "1985-13-01" to DatePrecision.DAY,
                "1985-00-10" to DatePrecision.DAY,
                "1985-02-30" to DatePrecision.DAY,
                "2023-02-29" to DatePrecision.DAY,
                "1985-04-31" to DatePrecision.DAY,
                "1985-00" to DatePrecision.MONTH,
                "1985-13" to DatePrecision.MONTH,
                "198X" to DatePrecision.YEAR,
                "" to DatePrecision.YEAR,
                " 1985" to DatePrecision.YEAR,
                "1985/07/14" to DatePrecision.DAY,
            ) { (value, precision) ->
                val refusal = refused(Samples.wristband(Samples.identity(birthDate = dob(value, precision))))
                refusal.reason shouldBe RefusalReason.IDENTIFIER_INVALID
                refusal.subject shouldBe "identity.birthDate"
            }

            test("a placeholder day is never printed: a month-precision value prints no day") {
                valid(
                    Samples.wristband(Samples.identity(birthDate = dob("1985-07", DatePrecision.MONTH))),
                ).text(Binding.IDENTITY_BIRTH_DATE) shouldBe
                    "~1985-07"
            }

            test("full-width digits are refused") {
                refused(Samples.wristband(Samples.identity(birthDate = dob("１９８５", DatePrecision.YEAR)))).reason shouldBe
                    RefusalReason.IDENTIFIER_INVALID
            }
        }

        context("UnitTest:print-refuses-unrenderable-text (R7)") {
            val forbidden =
                listOf(
                    0x0000 to "Cc",
                    0x0009 to "Cc",
                    0x000A to "Cc",
                    0x000D to "Cc",
                    0x001B to "Cc",
                    0x007F to "Cc",
                    0x0085 to "Cc",
                    0x00AD to "Cf",
                    0x061C to "Cf",
                    0x200E to "Cf",
                    0x200F to "Cf",
                    0x202A to "Cf",
                    0x202B to "Cf",
                    0x202C to "Cf",
                    0x202D to "Cf",
                    0x202E to "Cf",
                    0x2066 to "Cf",
                    0x2067 to "Cf",
                    0x2068 to "Cf",
                    0x2069 to "Cf",
                    0x2060 to "Cf",
                    0xFEFF to "Cf",
                    0xE000 to "Co",
                    0x2028 to "Zl",
                    0x2029 to "Zp",
                )
            withTests(nameFn = { "U+${hex(it.first)} (${it.second}) in the own name is refused" }, forbidden) { (codePoint, category) ->
                val names = mapOf(NameForm.CKB to "شیلان${cp(codePoint)} ئەحمەد", NameForm.LATIN to Samples.LATIN_NAME)
                val refusal = refused(Samples.wristband(Samples.identity(names = names)))
                refusal.reason shouldBe RefusalReason.UNRENDERABLE_TEXT
                refusal.subject shouldBe "identity.name.own"
                refusal.detail shouldBe "category=$category"
                refusal.detail.orEmpty() shouldNotContain "شیلان"
            }

            withTests(nameFn = { "U+${hex(it)} in the Latin name is refused" }, listOf(0x202E, 0x2066, 0x200E, 0x0007)) { codePoint ->
                val names = mapOf(NameForm.CKB to Samples.SORANI_NAME, NameForm.LATIN to "Shilan${cp(codePoint)} Ahmad")
                refused(Samples.wristband(Samples.identity(names = names))).let {
                    it.reason shouldBe RefusalReason.UNRENDERABLE_TEXT
                    it.subject shouldBe "identity.name.latin"
                }
            }

            test("an unpaired surrogate is refused") {
                val names = mapOf(NameForm.CKB to Samples.SORANI_NAME, NameForm.LATIN to "Shilan " + Char(0xD800) + " Ahmad")
                refused(Samples.wristband(Samples.identity(names = names))).detail shouldBe "category=Cs (unpaired surrogate)"
            }

            test("a reverse solidus is refused in any text") {
                val names = mapOf(NameForm.CKB to Samples.SORANI_NAME, NameForm.LATIN to "Shilan\\& Ahmad")
                refused(Samples.wristband(Samples.identity(names = names))).detail shouldBe "category=Po (reverse solidus)"
                refused(Samples.receipt(lines = listOf(ReceiptLine(LabelledText("Drug \\ fee"), "1 IQD")))).subject shouldBe "receipt.lines"
            }

            test("text not in NFC is refused, never normalised") {
                val decomposed = "Sh" + "i" + cp(0x0301) + "lan"
                val names = mapOf(NameForm.CKB to Samples.SORANI_NAME, NameForm.LATIN to decomposed)
                refused(Samples.wristband(Samples.identity(names = names))).detail shouldBe "not in Unicode NFC"
            }

            test("ZWNJ, ZWJ and ZWSP are allowed") {
                val name = "شیلان" + cp(0x200C) + "ئەحمەد" + cp(0x200D) + " محەمەد" + cp(0x200B) + "کەریم"
                valid(Samples.wristband(Samples.identity(names = mapOf(NameForm.CKB to name, NameForm.LATIN to Samples.LATIN_NAME))))
                    .text(Binding.IDENTITY_NAME_OWN) shouldBe name
            }

            test("a bidi control in the MRN is R7, before the alphabet rule") {
                refused(Samples.wristband(Samples.identity(mrn = "SYN-" + cp(0x202E) + "0001"))).let {
                    it.reason shouldBe RefusalReason.UNRENDERABLE_TEXT
                    it.subject shouldBe "identity.mrn"
                }
            }

            test("every printed text is checked: sex, specimen type, tests, receipt fields, token, document") {
                val bad = "x" + cp(0x202E)
                refused(Samples.wristband(Samples.identity(sex = bad))).subject shouldBe "identity.sex"
                refused(Samples.specimen(type = LabelledText(bad))).subject shouldBe "specimen.type"
                refused(Samples.specimen(tests = listOf(LabelledText(bad)))).subject shouldBe "specimen.tests"
                refused(Samples.receipt(lines = listOf(ReceiptLine(LabelledText("Fee"), bad)))).subject shouldBe "receipt.lines"
                refused(PrintContent.Token(TokenContent(bad, "Pharmacy", Samples.PRINTED_AT))).subject shouldBe "token.number"
                refused(Samples.document(blocks = listOf(DocumentBlock(LabelledText(bad), emptyList())))).subject shouldBe "document.body"
            }

            test("a redacted form is checked as it will print") {
                val tests = listOf(LabelledText("HIV Ag/Ab", setOf("hiv"), "Test" + cp(0x2067) + " R-17"))
                refused(Samples.specimen(tests = tests), setOf("hiv")).reason shouldBe RefusalReason.UNRENDERABLE_TEXT
            }
        }

        context("UnitTest:print-refuses-eastern-digits (R8)") {
            withTests(nameFn = { "U+${hex(it)} in the MRN" }, listOf(0x0660, 0x0665, 0x0669, 0x06F0, 0x06F4, 0x06F9)) { digit ->
                val refusal = refused(Samples.wristband(Samples.identity(mrn = "SYN-000" + cp(digit))))
                refusal.reason shouldBe RefusalReason.EASTERN_DIGITS
                refusal.subject shouldBe "identity.mrn"
            }

            test("UnitTest:print-refuses-eastern-digits-in-identifiers: encounter, specimen, receipt number and DOB") {
                val eastern = cp(0x0663)
                refused(PrintContent.Wristband(WristbandContent(Samples.sorani, "SYN-E-$eastern"))).subject shouldBe "encounter.id"
                refused(Samples.wristband(Samples.identity(birthDate = dob("19${cp(0x06F8)}5", DatePrecision.YEAR)))).let {
                    it.reason shouldBe RefusalReason.EASTERN_DIGITS
                    it.subject shouldBe "identity.birthDate"
                }
                val specimen = Samples.specimen() as PrintContent.SpecimenLabel
                refused(specimen.copy(content = specimen.content.copy(specimenId = "SYN-S-$eastern"))).subject shouldBe "specimen.id"
                val receipt = Samples.receipt() as PrintContent.Receipt
                refused(receipt.copy(content = receipt.content.copy(receiptNumber = "SYN-R-$eastern"))).reason shouldBe
                    RefusalReason.EASTERN_DIGITS
            }

            test("never converted: names and other printed text with Eastern digits are refused too (round-2 review)") {
                val names = mapOf(NameForm.CKB to "کۆرپەی شیلان ${cp(0x0661)}", NameForm.LATIN to "Baby of Shilan 1")
                refused(Samples.wristband(Samples.identity(names = names))).reason shouldBe RefusalReason.EASTERN_DIGITS
                refused(Samples.receipt(lines = listOf(ReceiptLine(LabelledText("Fee"), "${cp(0x0662)}5,000")))).reason shouldBe
                    RefusalReason.EASTERN_DIGITS
            }
        }

        context("R4: identifier alphabet") {
            withTests(
                nameFn = { "MRN '${it.first}' refused (${it.second})" },
                "SYN 0001" to "category=Zs outside [A-Za-z0-9-]",
                "SYN|0001" to "category=Sm outside [A-Za-z0-9-]",
                "SYN^0001" to "category=Sk outside [A-Za-z0-9-]",
                "SYN~0001" to "category=Sm outside [A-Za-z0-9-]",
                "SYN_0001" to "category=Pc outside [A-Za-z0-9-]",
                "SYN:0001" to "category=Po outside [A-Za-z0-9-]",
                "SYNÉ0001" to "category=Lu outside [A-Za-z0-9-]",
                "" to "empty",
            ) { (mrn, detail) ->
                val refusal = refused(Samples.wristband(Samples.identity(mrn = mrn)))
                refusal.reason shouldBe RefusalReason.IDENTIFIER_INVALID
                refusal.subject shouldBe "identity.mrn"
                refusal.detail shouldBe detail
            }

            test("the encounter, specimen and receipt numbers follow the same alphabet") {
                refused(PrintContent.Wristband(WristbandContent(Samples.sorani, "SYN E 42"))).subject shouldBe "encounter.id"
                val specimen = Samples.specimen() as PrintContent.SpecimenLabel
                refused(specimen.copy(content = specimen.content.copy(specimenId = "SYN|S"))).subject shouldBe "specimen.id"
                refused(specimen.copy(content = specimen.content.copy(specimenId = null))).reason shouldBe RefusalReason.IDENTIFIER_MISSING
                val receipt = Samples.receipt() as PrintContent.Receipt
                refused(receipt.copy(content = receipt.content.copy(receiptNumber = " "))).subject shouldBe "receipt.number"
            }

            test("the MRN prints exactly as issued") {
                valid(Samples.wristband(Samples.identity(mrn = "syn-00x1"))).text(Binding.IDENTITY_MRN) shouldBe "syn-00x1"
            }
        }

        context("UnitTest:labelled-text-redacted-on-print (R10, SI-21)") {
            test("a test labelled with a label the policy names prints its redacted form") {
                valid(Samples.specimen(), setOf("hiv")).text(Binding.SPECIMEN_TESTS) shouldBe "CBC, Test R-17"
            }

            test("without the obligation the text prints") {
                valid(Samples.specimen()).text(Binding.SPECIMEN_TESTS) shouldBe "CBC, HIV Ag/Ab"
            }

            test("a label the policy does not name does not redact") {
                valid(Samples.specimen(), setOf("mental-health")).text(Binding.SPECIMEN_TESTS) shouldBe "CBC, HIV Ag/Ab"
            }

            test("no redacted form: refused, policy denied") {
                val refusal = refused(Samples.specimen(tests = listOf(LabelledText("HIV Ag/Ab", setOf("hiv")))), setOf("hiv"))
                refusal.reason shouldBe RefusalReason.POLICY_DENIED
                refusal.subject shouldBe "specimen.tests"
                refusal.detail.orEmpty() shouldNotContain "HIV"
            }

            test("a blank redacted form counts as none") {
                refused(Samples.specimen(tests = listOf(LabelledText("HIV", setOf("hiv"), " "))), setOf("hiv")).reason shouldBe
                    RefusalReason.POLICY_DENIED
            }

            test("specimen type, receipt lines and totals redact") {
                valid(Samples.specimen(type = LabelledText("Forensic swab", setOf("forensic"), "Swab")), setOf("forensic"))
                    .text(Binding.SPECIMEN_TYPE) shouldBe "Swab"
                val rows =
                    valid(
                        Samples.receipt(lines = listOf(ReceiptLine(LabelledText("HIV clinic", setOf("hiv"), "Clinic R-2"), "5,000 IQD"))),
                        setOf("hiv"),
                    ).rows
                        .getValue(Binding.RECEIPT_LINES)
                rows.single() shouldBe ResolvedRow(Cell.Literal("Clinic R-2"), Cell.Literal("5,000 IQD"))
                refused(
                    Samples.receipt(lines = listOf(ReceiptLine(LabelledText("HIV clinic", setOf("hiv")), "1"))),
                    setOf("hiv"),
                ).subject shouldBe
                    "receipt.lines"
            }

            test("document title, headings, paragraphs and banner code status and isolation redact") {
                val blocks =
                    listOf(
                        DocumentBlock(
                            LabelledText("Psychiatry", setOf("mental-health"), "Clinic M"),
                            listOf(LabelledText("Seen for depression", setOf("mental-health"), "Redacted R-4"), LabelledText("Plain")),
                        ),
                    )
                val banner =
                    PrintBanner(
                        PrintAllergies.NoKnownAllergies,
                        LabelledText("DNR (VIP)", setOf("vip"), "See record"),
                        LabelledText("Contact", setOf("vip"), "Precautions"),
                        null,
                        true,
                    )
                val content = valid(Samples.document(blocks = blocks, banner = banner), setOf("mental-health", "vip"))
                content.documentBody shouldBe listOf(ResolvedBlock("Clinic M", listOf("Redacted R-4", "Plain")))
                val rows = content.rows.getValue(Binding.DOCUMENT_BANNER)
                rows[1].amount shouldBe Cell.Literal("See record")
                rows[2].amount shouldBe Cell.Literal("Precautions")
                refused(
                    Samples.document(blocks = listOf(DocumentBlock(LabelledText("x", setOf("hiv")), emptyList()))),
                    setOf("hiv"),
                ).subject shouldBe
                    "document.body"
                refused(Samples.document(banner = banner.copy(isolation = LabelledText("x", setOf("vip")))), setOf("vip")).subject shouldBe
                    "document.banner"
            }
        }

        context("per kind") {
            test("a specimen label resolves its fields and the collection time in the tenant zone") {
                val content = valid(Samples.specimen())
                content.kind shouldBe TemplateKind.SPECIMEN_LABEL
                content.text(Binding.SPECIMEN_ID) shouldBe Samples.SPECIMEN
                content.text(Binding.SPECIMEN_TYPE) shouldBe "Blood EDTA"
                content.text(Binding.SPECIMEN_COLLECTED_AT) shouldBe "2026-10-19 14:05"
            }

            test("an empty test list and a blank sex print nothing") {
                val content = valid(Samples.specimen(Samples.identity(sex = " "), tests = emptyList()))
                content.omitted shouldContain Binding.SPECIMEN_TESTS
                content.omitted shouldContain Binding.IDENTITY_SEX
            }

            test("a receipt resolves issuer lines as segments, rows, cashier and time") {
                val content = valid(Samples.receipt())
                content.texts
                    .getValue(Binding.RECEIPT_ISSUER)
                    .segments
                    .map { it.text } shouldBe
                    listOf("SYN Hospital Erbil", "نەخۆشخانەی SYN")
                content.rows.getValue(Binding.RECEIPT_TOTALS).single() shouldBe
                    ResolvedRow(Cell.Literal("Total"), Cell.Literal("25,000 IQD"))
                content.text(Binding.RECEIPT_ISSUED_AT) shouldBe "2026-10-19 14:05"
                content.text(Binding.RECEIPT_NUMBER) shouldBe "SYN-R-000901"
            }

            test("a token has no identity and needs none") {
                val content = valid(Samples.token)
                content.kind shouldBe TemplateKind.TOKEN
                content.text(Binding.TOKEN_NUMBER) shouldBe "A-017"
                content.texts.keys.none { it.identity } shouldBe true
            }

            test("UnitTest:print-banner-allergy-states (domain part): allergies listed, unavailable fields as captions, never a default") {
                val rows = valid(Samples.document()).rows.getValue(Binding.DOCUMENT_BANNER)
                rows.map { it.description } shouldBe
                    listOf(
                        CaptionKeys.BANNER_ALLERGIES,
                        CaptionKeys.BANNER_CODE_STATUS,
                        CaptionKeys.BANNER_ISOLATION,
                        CaptionKeys.BANNER_WEIGHT,
                        CaptionKeys.BANNER_PHOTO,
                    ).map { Cell.CaptionRef(it) }
                rows[0].amount shouldBe Cell.Literal("Penicillin (rash, moderate); Latex")
                rows[1].amount shouldBe Cell.Literal("Full code")
                rows[2].amount shouldBe Cell.CaptionRef(CaptionKeys.BANNER_UNAVAILABLE)
                rows[4].amount shouldBe Cell.CaptionRef(CaptionKeys.BANNER_NO_PHOTO)
            }

            withTests(
                nameFn = { "allergies ${it.first} print ${it.second}" },
                PrintAllergies.NoKnownAllergies to CaptionKeys.BANNER_NKA,
                PrintAllergies.NotAssessed to CaptionKeys.BANNER_ALLERGIES_NOT_ASSESSED,
                PrintAllergies.Unavailable to CaptionKeys.BANNER_ALLERGIES_UNAVAILABLE,
                PrintAllergies.Listed(emptyList()) to CaptionKeys.BANNER_ALLERGIES_UNAVAILABLE,
                PrintAllergies.Listed(listOf(PrintAllergy(" ", "rash", null))) to CaptionKeys.BANNER_ALLERGIES_UNAVAILABLE,
            ) { (allergies, key) ->
                val banner = PrintBanner(allergies, null, null, null, true)
                val rows = valid(Samples.document(banner = banner)).rows.getValue(Binding.DOCUMENT_BANNER)
                rows[0].amount shouldBe Cell.CaptionRef(key)
                rows[4].amount shouldBe Cell.CaptionRef(CaptionKeys.BANNER_PHOTO_ON_RECORD)
            }
        }
    })

private data class Quad<A, B, C, D>(
    val first: A,
    val second: B,
    val third: C,
    val fourth: D,
)
