package hms.platform.docs.infrastructure.html

import hms.platform.docs.api.DocumentBlock
import hms.platform.docs.api.LabelLanguage
import hms.platform.docs.api.LabelledText
import hms.platform.docs.api.PrintAllergies
import hms.platform.docs.api.PrintAllergy
import hms.platform.docs.api.PrintBanner
import hms.platform.docs.api.RefusalReason
import hms.platform.docs.domain.layout.Layout
import hms.platform.docs.domain.template.Align
import hms.platform.docs.domain.template.TemplateKind
import hms.platform.docs.golden.ByteFixtures
import hms.platform.docs.golden.Provenance
import hms.platform.docs.infrastructure.writers.WriterSamples
import hms.platform.docs.infrastructure.writers.WriterSamples.line
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import io.kotest.matchers.types.shouldBeInstanceOf

/** Document HTML with CSS paged media (docs/specs/modules/platform-docs.md §7.4), and the banner's field texts. */
class DocumentHtmlWriterTest :
    FunSpec({
        val writer = DocumentHtmlWriter()
        val banner =
            PrintBanner(
                allergies =
                    PrintAllergies.Listed(
                        listOf(
                            PrintAllergy("Penicillin", "Anaphylaxis", "Severe"),
                            PrintAllergy("Latex", null, null),
                            PrintAllergy("Co-trimoxazole", "Rash", null),
                        ),
                    ),
                codeStatus = LabelledText("Full resuscitation"),
                isolation = null,
                weight = "71.5 kg (measured 2026-10-18)",
                photoOnRecord = false,
            )

        fun bannerLayout(): Layout {
            val f = BannerText.fields(banner, BannerCaptions.ENGLISH).associate { it.key to it.text }
            return Layout(
                templateId = "SYN-DOCUMENT-A4",
                templateVersion = 1,
                templateHash = WriterSamples.TEMPLATE_HASH,
                kind = TemplateKind.DOCUMENT,
                language = LabelLanguage.EN,
                synthetic = true,
                frameWidthMm = 180.0,
                frameHeightMm = 32.0,
                rotation = 0,
                lines =
                    listOf(
                        line(WriterSamples.SORANI_NAME, WriterSamples.ARABIC_BOLD, 12.0, true, Align.START, 0.0, 180.0, 0.0, 6.0, 8.9),
                        line(WriterSamples.LATIN_NAME, WriterSamples.LATIN_BOLD, 11.0, false, Align.START, 0.0, 180.0, 9.0, 13.0, 5.2),
                        line("MRN", WriterSamples.LATIN_REGULAR, 8.0, false, Align.START, 0.0, 15.0, 15.0, 18.0, 3.8),
                        line(WriterSamples.MRN, WriterSamples.LATIN_REGULAR, 9.0, false, Align.START, 16.0, 40.0, 15.0, 18.3, 4.3),
                        line(f.getValue("allergies"), WriterSamples.LATIN_REGULAR, 9.0, false, Align.START, 0.0, 180.0, 20.5, 23.8, 4.3),
                        line(f.getValue("codeStatus"), WriterSamples.LATIN_REGULAR, 8.0, false, Align.START, 0.0, 45.0, 26.0, 29.0, 3.8),
                        line(f.getValue("isolation"), WriterSamples.LATIN_REGULAR, 8.0, false, Align.START, 45.0, 45.0, 26.0, 29.0, 3.8),
                        line(f.getValue("weight"), WriterSamples.LATIN_REGULAR, 8.0, false, Align.START, 90.0, 45.0, 26.0, 29.0, 3.8),
                        line(f.getValue("photo"), WriterSamples.LATIN_REGULAR, 8.0, false, Align.START, 135.0, 45.0, 26.0, 29.0, 3.8),
                    ),
                barcodes = emptyList(),
                rules =
                    listOf(
                        hms.platform.docs.domain.layout
                            .PlacedRule(0.0, 31.5, 180.0, 0.3),
                    ),
            )
        }

        fun input(reprint: Boolean = false) =
            DocumentHtmlInput(
                meta =
                    HtmlMetadata(
                        templateId = "SYN-DOCUMENT-A4",
                        templateVersion = 1,
                        templateHash = WriterSamples.TEMPLATE_HASH,
                        synthetic = true,
                        language = LabelLanguage.EN,
                        title = "Discharge summary",
                        createdAt = WriterSamples.CREATED_AT,
                    ),
                page = DocumentPage.A4,
                banner = bannerLayout(),
                bannerHeightMm = 32.0,
                title = LabelledText("Discharge summary"),
                blocks =
                    listOf(
                        DocumentBlock(LabelledText("Diagnosis"), listOf(LabelledText("Synthetic text. NOT FOR CLINICAL USE."))),
                        DocumentBlock(LabelledText("پوختە"), listOf(LabelledText("دەقی دەستکرد <نموونە> & تاقیکردنەوە"))),
                        DocumentBlock(null, listOf(LabelledText("Follow-up in 2 weeks."))),
                    ),
                watermark = "Printed by SYN-USER-07 Dr Synthetic 2026-10-19 09:00 MRN SYN-000123-7 job SYN-J0002",
                reprint = reprint,
                reprintText = BannerCaptions.ENGLISH.reprint,
            )

        fun html(input: DocumentHtmlInput) = writer.write(input).shouldBeInstanceOf<HtmlOutput.Written>().html

        test("paged media: banner in @top-center as a running element, margin-top = measured banner height, watermark in @bottom-center") {
            val text = html(input())
            text shouldContain "  margin: 32mm 15mm 15mm 15mm;\n"
            text shouldContain "  @top-center { content: element(banner); width: 100%; vertical-align: top; }\n"
            text shouldContain "  @bottom-center { content: element(watermark); width: 100%; vertical-align: middle; }\n"
            text shouldContain ".banner { position: running(banner); width: 180mm; height: 32mm; }\n"
            text shouldContain ".watermark { position: running(watermark);"
            text shouldContain "<div class=\"watermark\" dir=\"ltr\">Printed by SYN-USER-07"
            HtmlLint.check(text) shouldBe HtmlLintResult.Clean
            text shouldBe html(input())
        }

        test("banner lines are absolutely positioned, pre, with the layout's line height") {
            val text = html(input())
            text shouldContain
                "<div class=\"line\" style=\"left: 0mm; top: 20.5mm; width: 180mm; font-family: 'noto-sans-regular'; font-size: 9pt; " +
                "line-height: 12.189pt; direction: ltr; text-align: start;\">Allergies: Penicillin (Anaphylaxis, Severe); Latex; " +
                "Co-trimoxazole (Rash)</div>\n"
            text shouldContain ">Isolation unavailable</div>\n"
            text shouldContain ">No photo</div>\n"
        }

        test("body: escaped text, direction from the first strong character, the matching script's font first") {
            val text = html(input())
            text shouldContain "<h1 dir=\"ltr\" style=\"font-family: 'noto-sans-bold', 'noto-sans-arabic-bold';\">Discharge summary</h1>\n"
            text shouldContain "<h2 dir=\"rtl\" style=\"font-family: 'noto-sans-arabic-bold', 'noto-sans-bold';\">پوختە</h2>\n"
            text shouldContain ">دەقی دەستکرد &lt;نموونە&gt; &amp; تاقیکردنەوە</p>\n"
        }

        test("reprint: a diagonal REPRINT in solid #d0d0d0 beneath the content, no transparency; none on a first print") {
            val text = html(input(reprint = true))
            text shouldContain "<div class=\"reprint\" aria-hidden=\"true\">REPRINT</div>\n"
            text shouldContain "z-index: -1;"
            text shouldContain "color: #d0d0d0; transform: rotate(-45deg);"
            text shouldNotContain "opacity"
            text shouldNotContain "rgba"
            html(input()) shouldNotContain "<div class=\"reprint\""
            HtmlLint.check(text) shouldBe HtmlLintResult.Clean
        }

        test("refusals: banner taller than half the page, a line below the measured height, a banner wider than the content area") {
            writer
                .write(input().copy(bannerHeightMm = 150.0))
                .shouldBeInstanceOf<HtmlOutput.Refused>()
                .refusal.reason shouldBe
                RefusalReason.BANNER_TOO_TALL
            // Exactly half the page is allowed; just over it is refused (print.refused.bannerTooTall).
            writer.write(input().copy(bannerHeightMm = 148.5)).shouldBeInstanceOf<HtmlOutput.Written>()
            writer
                .write(input().copy(bannerHeightMm = 148.6))
                .shouldBeInstanceOf<HtmlOutput.Refused>()
                .refusal.reason shouldBe
                RefusalReason.BANNER_TOO_TALL
            writer
                .write(input().copy(bannerHeightMm = 28.0))
                .shouldBeInstanceOf<HtmlOutput.Refused>()
                .refusal.reason shouldBe
                RefusalReason.IDENTITY_DOES_NOT_FIT
            writer
                .write(input().copy(banner = bannerLayout().copy(frameWidthMm = 190.0)))
                .shouldBeInstanceOf<HtmlOutput.Refused>()
                .refusal.reason shouldBe RefusalReason.TEMPLATE_INVALID
            writer
                .write(input().copy(title = LabelledText("a\u0000")))
                .shouldBeInstanceOf<HtmlOutput.Refused>()
                .refusal.reason shouldBe
                RefusalReason.UNRENDERABLE_TEXT
        }

        test("BannerText: allergy states never print missing data as NKA; unavailable fields say so") {
            val c = BannerCaptions.ENGLISH

            fun allergies(a: PrintAllergies) = BannerText.fields(banner.copy(allergies = a), c).first().text
            allergies(PrintAllergies.Unavailable) shouldBe "Allergy status unavailable"
            allergies(PrintAllergies.Listed(emptyList())) shouldBe "Allergy status unavailable"
            allergies(PrintAllergies.NotAssessed) shouldBe "Allergies: Not assessed"
            allergies(PrintAllergies.NoKnownAllergies) shouldBe "Allergies: No known allergies (NKA)"
            BannerText
                .fields(
                    PrintBanner(PrintAllergies.Unavailable, null, null, null, photoOnRecord = true),
                    c,
                ).map { it.text } shouldContainExactly
                listOf(
                    "Allergy status unavailable",
                    "Code status unavailable",
                    "Isolation unavailable",
                    "Weight unavailable",
                    "Photo on record (not printed)",
                )
        }

        val fixtures = ByteFixtures()
        val provenance = Provenance("SYN-DOCUMENT-A4", 1, WriterSamples.TEMPLATE_HASH)
        test("ByteFixture:html-document-a4") {
            fixtures.assertMatches("html-document-a4.html", html(input()).toByteArray(), provenance)
        }
        test("ByteFixture:html-document-a4-reprint") {
            fixtures.assertMatches("html-document-a4-reprint.html", html(input(reprint = true)).toByteArray(), provenance)
        }
    })
