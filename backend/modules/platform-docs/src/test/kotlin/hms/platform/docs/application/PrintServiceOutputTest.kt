package hms.platform.docs.application

import hms.platform.docs.api.HalPrintOutcome
import hms.platform.docs.api.NameForm
import hms.platform.docs.api.OutputMode
import hms.platform.docs.api.PrintAllergies
import hms.platform.docs.api.PrintAllergy
import hms.platform.docs.api.PrintResult
import hms.platform.docs.api.RefusalReason
import hms.platform.docs.api.ReportPrintOutcome
import hms.platform.docs.api.ReprintReason
import hms.platform.docs.api.VerifyFirstBand
import hms.platform.docs.application.testing.CapturingRenderer
import hms.platform.docs.application.testing.PrintFixtures
import hms.platform.docs.application.testing.PrintFixtures.ADULT
import hms.platform.docs.application.testing.PrintFixtures.DOCUMENT
import hms.platform.docs.application.testing.PrintFixtures.Harness
import hms.platform.docs.application.testing.PrintFixtures.RECEIPT
import hms.platform.docs.application.testing.PrintFixtures.SPECIMEN_LABEL
import hms.platform.docs.application.testing.PrintFixtures.TOKEN
import hms.platform.docs.application.testing.PrintFixtures.bandPrinter
import hms.platform.docs.application.testing.PrintFixtures.command
import hms.platform.docs.application.testing.PrintFixtures.job
import hms.platform.docs.application.testing.PrintFixtures.labelPrinter
import hms.platform.docs.domain.layout.WatermarkText
import hms.platform.docs.domain.template.Binding
import hms.platform.docs.domain.template.Element
import hms.platform.docs.infrastructure.html.BannerCaptions
import hms.platform.docs.infrastructure.html.BannerText
import hms.platform.docs.infrastructure.template.YamlTemplateLoader
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldNotBeEmpty
import io.kotest.matchers.doubles.shouldBeGreaterThanOrEqual
import io.kotest.matchers.doubles.shouldBeLessThanOrEqual
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import io.kotest.matchers.types.shouldBeInstanceOf
import java.nio.file.Files

/**
 * What the print service writes (docs/specs/modules/platform-docs.md §3.1, §6.1, §7, §8.2, §8.5; HAZ-0045 to
 * HAZ-0048): the output mode, the media check, the watermark, the banner and the events. Synthetic data only (§19.4).
 */
class PrintServiceOutputTest :
    FunSpec({
        fun rendered(result: PrintResult) = result.shouldBeInstanceOf<PrintResult.Rendered>()

        fun zpl(result: PrintResult) = String(rendered(result).bytes, Charsets.UTF_8)

        fun refusal(result: PrintResult) = result.shouldBeInstanceOf<PrintResult.Refused>().refusal

        /** The text of every placed line of an HTML print, in order (line divs only; a break drops one space). */
        fun lines(html: String): List<String> =
            Regex("<div class=\"line\"[^>]*>([^<]*)</div>").findAll(html).map { it.groupValues[1] }.toList()

        fun html(renderer: CapturingRenderer) = renderer.requests.last().html

        context("UnitTest:identity-text-rasterised-unless-s7k-verified") {
            val band = PrintFixtures.wristband()

            test("a text-mode profile that S7-K did not pass gets raster output: the module draws every glyph") {
                val h = Harness()
                val unverified = PrintFixtures.zpl(OutputMode.ZPL_TEXT, 8.0, 25.4, 279.4, false, PrintFixtures.residentFonts)
                val output = zpl(h.service.print(command(ADULT, band, unverified)))
                output shouldContain "^GFA,"
                output shouldNotContain "^A@"
                output shouldNotContain "^PA"
                h.audit.records.last().mode shouldBe OutputMode.ZPL_RASTER
            }

            test("verified but the pinned fonts not resident, or one with another hash: raster") {
                val h = Harness()
                val noFonts = PrintFixtures.zpl(OutputMode.ZPL_TEXT, 8.0, 25.4, 279.4, verified = true)
                zpl(h.service.print(command(ADULT, band, noFonts))) shouldNotContain "^A@"
                val wrong = PrintFixtures.residentFonts + ("E:NSARAB.TTF" to "0".repeat(64))
                val h2 = Harness()
                val wrongHash = PrintFixtures.zpl(OutputMode.ZPL_TEXT, 8.0, 25.4, 279.4, true, wrong)
                zpl(h2.service.print(command(ADULT, band, wrongHash))) shouldNotContain "^A@"
            }

            test("verified, fonts provisioned, every line in one font: text mode with ^PA and resident fonts") {
                val h = Harness()
                val output = zpl(h.service.print(command(ADULT, band, bandPrinter(text = true))))
                output shouldContain "^PA1,1,1,1"
                output shouldContain "^A@R,"
                output shouldContain "E:NSARABB.TTF"
                output shouldNotContain "^GF"
                h.audit.records.last().mode shouldBe OutputMode.ZPL_TEXT
            }

            test("a raster profile is raster even when S7-K passed its model") {
                val h = Harness()
                val raster = PrintFixtures.zpl(OutputMode.ZPL_RASTER, 8.0, 25.4, 279.4, true, PrintFixtures.residentFonts)
                zpl(h.service.print(command(ADULT, band, raster))) shouldContain "^GFA,"
            }
        }

        context("UnitTest:print-refuses-media-mismatch") {
            val band = PrintFixtures.wristband()

            test("loaded media of another width or length, unknown media or an unknown or too narrow head is refused") {
                listOf(
                    bandPrinter().copy(mediaWidthMm = 50.8),
                    bandPrinter().copy(mediaLengthMm = 200.0),
                    bandPrinter().copy(mediaWidthMm = null),
                    bandPrinter().copy(mediaLengthMm = null),
                    bandPrinter().copy(printheadWidthDots = null),
                    bandPrinter().copy(printheadWidthDots = 100),
                ).forEach { printer ->
                    val h = Harness()
                    refusal(h.service.print(command(ADULT, band, printer))).reason shouldBe RefusalReason.MEDIA_MISMATCH
                    h.audit.records.single().refusalReason shouldBe RefusalReason.MEDIA_MISMATCH
                }
            }

            test("within 1.0 mm prints; a receipt's length grows and is not compared; a PDF has no media") {
                rendered(Harness().service.print(command(ADULT, band, bandPrinter().copy(mediaWidthMm = 26.3))))
                rendered(Harness().service.print(command(RECEIPT, PrintFixtures.receipt(), PrintFixtures.escPos(8.0))))
                rendered(Harness().service.print(command(DOCUMENT, PrintFixtures.document(), PrintFixtures.pdf())))
            }
        }

        context("UnitTest:watermark-on-every-patient-print") {
            val shortId = WatermarkText.shortId(job(1))
            val full = "Dr Hana Aziz (SYN-ST-001) · 2026-10-19 14:05 · MRN ${PrintFixtures.MRN} · Job ${job(1)}"

            test("wristbands and specimen labels carry the minimal mark; receipts and documents the full line") {
                listOf(
                    command(ADULT, PrintFixtures.wristband(), PrintFixtures.pdf()) to "$shortId 2026-10-19 14:05",
                    command(SPECIMEN_LABEL, PrintFixtures.specimen(), PrintFixtures.pdf()) to "$shortId 2026-10-19 14:05",
                    command(RECEIPT, PrintFixtures.receipt(), PrintFixtures.pdf()) to full,
                ).forEach { (cmd, mark) ->
                    val renderer = CapturingRenderer()
                    rendered(Harness(renderer = renderer).service.print(cmd))
                    lines(html(renderer)).joinToString(" ") shouldContain mark
                }
                val renderer = CapturingRenderer()
                rendered(Harness(renderer = renderer).service.print(command(DOCUMENT, PrintFixtures.document(), PrintFixtures.pdf())))
                html(renderer) shouldContain "<div class=\"watermark\" dir=\"ltr\">$full</div>"
            }

            test("the ZPL output carries the mark; a reprint adds R, a receipt or document reprint names the original job") {
                val h = Harness()
                val printer = bandPrinter(text = true)
                val first = rendered(h.service.print(command(ADULT, PrintFixtures.wristband(), printer)))
                zpl(first) shouldContain "^FD$shortId 2026-10-19 14:05^FS"
                h.service.verifyFirstBand(VerifyFirstBand(PrintFixtures.context(), first.jobId, payload(first), true))
                val again = command(ADULT, PrintFixtures.wristband(), printer, reprintOf = first.jobId, reprintReason = ReprintReason.DAMAGED)
                zpl(h.service.print(again)) shouldContain "^FD${WatermarkText.shortId(job(2))} 2026-10-19 14:05 R^FS"
                val renderer = CapturingRenderer()
                val reprint =
                    command(DOCUMENT, PrintFixtures.document(), PrintFixtures.pdf(), reprintOf = job(9), reprintReason = ReprintReason.LOST)
                rendered(Harness(renderer = renderer).service.print(reprint))
                html(renderer) shouldContain "REPRINT of ${job(9)}"
                html(renderer) shouldContain "<div class=\"reprint\" aria-hidden=\"true\">REPRINT</div>"
            }

            test("tokens carry no patient and no watermark: the token template has none and its kind allows none") {
                val token = PrintFixtures.templates.find(TOKEN)
                token?.elements?.none { it is Element.Bound && it.bind == Binding.WATERMARK } shouldBe true
                rendered(Harness().service.print(command(TOKEN, PrintFixtures.token, PrintFixtures.escPos(8.0))))
            }
        }

        context("UnitTest:print-events-carry-no-phi") {
            test("no event of any outcome holds a patient reference, a name, an identifier printed on the label or a payload") {
                val h = Harness(renderer = CapturingRenderer())
                val ctx = PrintFixtures.context()
                val a = rendered(h.service.print(command(ADULT, PrintFixtures.wristband(), bandPrinter())))
                h.service.reportOutcome(ReportPrintOutcome(ctx, a.jobId, HalPrintOutcome.Error("timeout", "no answer", true)))
                h.service.print(command(ADULT, PrintFixtures.wristband(PrintFixtures.arabic), bandPrinter()))
                val s = rendered(h.service.print(command(SPECIMEN_LABEL, PrintFixtures.specimen(), labelPrinter())))
                h.service.reportOutcome(ReportPrintOutcome(ctx, s.jobId, HalPrintOutcome.Completed))
                h.service.print(command(RECEIPT, PrintFixtures.receipt(), PrintFixtures.escPos(8.0)))
                h.service.print(command(DOCUMENT, PrintFixtures.document(), PrintFixtures.pdf()))
                h.service.print(command(RECEIPT, PrintFixtures.receipt(), PrintFixtures.escPos(8.0), copies = 11))
                val forbidden =
                    listOf("SYN-P-0001", PrintFixtures.MRN, PrintFixtures.ENCOUNTER, PrintFixtures.SPECIMEN, "SYN-R-000901", "HMS1|") +
                        listOf(PrintFixtures.sorani, PrintFixtures.arabic, PrintFixtures.threeForms).flatMap { it.names.values }
                h.events.events.shouldNotBeEmpty()
                h.events.events.forEach { event ->
                    val text = event.toString()
                    forbidden.forEach { value -> text shouldNotContain value }
                }
                NameForm.entries.size shouldBe 4
            }
        }

        context("UnitTest:print-banner-allergy-states") {
            fun bannerHtml(allergies: PrintAllergies): String {
                val renderer = CapturingRenderer()
                val content = PrintFixtures.document(banner = PrintFixtures.banner(allergies))
                rendered(Harness(renderer = renderer).service.print(command(DOCUMENT, content, PrintFixtures.pdf())))
                return lines(html(renderer)).joinToString(" ")
            }

            test("each allergy state prints exactly its own text; missing data never prints as NKA") {
                bannerHtml(PrintAllergies.NoKnownAllergies) shouldContain "No known allergies (NKA)"
                bannerHtml(PrintAllergies.NotAssessed).let {
                    it shouldContain "Not assessed"
                    it shouldNotContain "NKA"
                }
                listOf(
                    PrintAllergies.Unavailable,
                    PrintAllergies.Listed(emptyList()),
                    PrintAllergies.Listed(listOf(PrintAllergy("Penicillin", "rash", null), PrintAllergy(" ", null, null))),
                ).forEach { state ->
                    val text = bannerHtml(state)
                    text shouldContain "Allergy status unavailable"
                    text shouldNotContain "NKA"
                    text shouldNotContain "Penicillin"
                }
                bannerHtml(PrintAllergies.Listed(listOf(PrintAllergy("Penicillin", "anaphylaxis", "severe")))) shouldContain
                    "Penicillin (anaphylaxis, severe)"
            }

            test("the HTML banner text agrees: an entry without a substance is unavailable there too (the stricter rule)") {
                val blank = PrintAllergies.Listed(listOf(PrintAllergy("Latex", null, null), PrintAllergy("", "rash", null)))
                BannerText.fields(PrintFixtures.banner(blank), BannerCaptions.ENGLISH).first().text shouldBe "Allergy status unavailable"
            }
        }

        context("UnitTest:print-banner-never-clipped") {
            test("a long allergy list and three long name forms grow the page's top margin; every banner line lies inside it") {
                val renderer = CapturingRenderer()
                rendered(Harness(renderer = renderer).service.print(command(DOCUMENT, PrintFixtures.document(), PrintFixtures.pdf())))
                val page = html(renderer)
                val margin =
                    Regex("margin: ([0-9.]+)mm 15mm 15mm 15mm;").find(page)?.groupValues?.get(1)?.toDouble() ?: error("no @page margin")
                val banner = page.substringAfter("<div class=\"banner-frame\">").substringBefore("</div>\n</div>")
                val bottoms =
                    Regex("top: ([0-9.]+)mm;[^\"]*line-height: ([0-9.]+)pt;").findAll(banner).map {
                        it.groupValues[1].toDouble() + it.groupValues[2].toDouble() * 25.4 / 72
                    }.toList()
                bottoms.shouldNotBeEmpty()
                bottoms.forEach { it shouldBeLessThanOrEqual margin + 0.01 }
                margin shouldBeGreaterThanOrEqual 40.0
                val text = lines(page).joinToString(" ")
                (PrintFixtures.longAllergies as PrintAllergies.Listed).items.forEach { text shouldContain it.substance }
                PrintFixtures.threeForms.names.values.forEach { text shouldContain it }
            }

            test("a banner taller than half the page is refused, never clipped") {
                val many = PrintAllergies.Listed((1..80).map { PrintAllergy("Synthetic allergen $it", "reaction $it", "moderate") })
                val renderer = CapturingRenderer()
                val h = Harness(renderer = renderer)
                val content = PrintFixtures.document(banner = PrintFixtures.banner(many))
                refusal(h.service.print(command(DOCUMENT, content, PrintFixtures.pdf()))).reason shouldBe RefusalReason.BANNER_TOO_TALL
                renderer.requests.size shouldBe 0
            }
        }

        context("the request the satellite gets") {
            test("contract fields: template id, version, hash and provenance, the language and the creation time in the tenant's zone") {
                val renderer = CapturingRenderer()
                rendered(Harness(renderer = renderer).service.print(command(DOCUMENT, PrintFixtures.document(), PrintFixtures.pdf())))
                val request = renderer.requests.single()
                request.templateId shouldBe DOCUMENT
                request.title shouldBe DOCUMENT
                request.templateVersion shouldBe 1
                val file = PrintFixtures.templatesDir.resolve("$DOCUMENT.yaml")
                request.templateHash shouldBe YamlTemplateLoader.contentHash(Files.readAllBytes(file))
                request.provenance shouldBe "synthetic"
                request.language shouldBe "en"
                request.createdAt shouldBe "2026-10-19T14:05:00+03:00"
                request.html shouldContain "<meta name=\"hms.barcode.payloads\" content=\"\">"
            }
        }
    })

/** The band's DataMatrix payload as the ZPL output's `^BX` field carries it (spec §6.1). */
internal fun payload(result: PrintResult.Rendered): String =
    Regex("\\^BX[^\\^]*\\^FH\\\\\\^FD([^\\^]*)\\^FS").find(String(result.bytes, Charsets.UTF_8))?.groupValues?.get(1)
        ?: error("no ^BX field")
