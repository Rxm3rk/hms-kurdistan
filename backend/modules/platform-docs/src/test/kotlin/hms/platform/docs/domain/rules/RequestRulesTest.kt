package hms.platform.docs.domain.rules

import hms.platform.docs.api.OutputMode
import hms.platform.docs.api.PrinterProfile
import hms.platform.docs.api.RefusalReason
import hms.platform.docs.api.ReprintReason
import hms.platform.docs.domain.template.TemplateKind
import hms.platform.docs.domain.testing.Samples
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import java.time.Instant
import java.time.ZoneId

private fun printer(
    mode: OutputMode = OutputMode.ZPL_RASTER,
    dotsPerMm: Double = 8.0,
    width: Double? = 25.4,
    length: Double? = 279.4,
    head: Int? = 832,
) = PrinterProfile("SYN-PRN-1", mode, dotsPerMm, head, null, "ZD621", "SYN-SER-1", "V93.21.26Z", width, length)

class RequestRulesTest :
    FunSpec({
        context("UnitTest:wristband-single-copy") {
            test("a wristband prints exactly one copy") {
                CopiesRule.check(TemplateKind.WRISTBAND, 1).shouldBeNull()
                listOf(0, 2, 3, 10, -1).forEach { copies ->
                    CopiesRule.check(TemplateKind.WRISTBAND, copies).shouldNotBeNull().reason shouldBe RefusalReason.COPIES_NOT_ALLOWED
                }
            }

            test("other kinds allow 1 to 10 copies (the HAL's limit)") {
                listOf(TemplateKind.SPECIMEN_LABEL, TemplateKind.RECEIPT, TemplateKind.TOKEN, TemplateKind.DOCUMENT).forEach { kind ->
                    CopiesRule.check(kind, 1).shouldBeNull()
                    CopiesRule.check(kind, 10).shouldBeNull()
                    CopiesRule.check(kind, 0).shouldNotBeNull().reason shouldBe RefusalReason.COPIES_NOT_ALLOWED
                    CopiesRule.check(kind, 11).shouldNotBeNull().reason shouldBe RefusalReason.COPIES_NOT_ALLOWED
                }
            }
        }

        context("UnitTest:reprint-requires-reason") {
            test("a reprint without a reason is refused") {
                ReprintRule.check("SYN-JOB-1", null).shouldNotBeNull().reason shouldBe RefusalReason.REPRINT_REASON_REQUIRED
            }

            test("a reprint naming a blank original is refused") {
                ReprintRule.check(" ", ReprintReason.LOST).shouldNotBeNull().reason shouldBe RefusalReason.REPRINT_REASON_REQUIRED
            }

            test("a reprint with any reason, and a first print, pass") {
                ReprintReason.entries.forEach { ReprintRule.check("SYN-JOB-1", it).shouldBeNull() }
                ReprintRule.check(null, null).shouldBeNull()
            }
        }

        context("media check (spec §7.6; the domain part of UnitTest:print-refuses-media-mismatch)") {
            val band = Samples.wristbandTemplate.media
            val receipt = Samples.receiptTemplate.media

            test("matching media passes; within 1.0 mm inclusive passes") {
                MediaRule.check(TemplateKind.WRISTBAND, band, printer()).shouldBeNull()
                MediaRule.check(TemplateKind.WRISTBAND, band, printer(width = 26.4, length = 278.4)).shouldBeNull()
            }

            test("more than 1.0 mm off in width or length is a mismatch") {
                MediaRule.check(TemplateKind.WRISTBAND, band, printer(width = 26.5)).shouldNotBeNull().reason shouldBe
                    RefusalReason.MEDIA_MISMATCH
                MediaRule.check(TemplateKind.WRISTBAND, band, printer(length = 280.5)).shouldNotBeNull().reason shouldBe
                    RefusalReason.MEDIA_MISMATCH
            }

            test("unknown media or print head fails closed") {
                MediaRule.check(TemplateKind.WRISTBAND, band, printer(width = null)).shouldNotBeNull().detail shouldBe
                    "loaded media width unknown"
                MediaRule.check(TemplateKind.WRISTBAND, band, printer(length = null)).shouldNotBeNull().detail shouldBe
                    "loaded media length unknown"
                MediaRule.check(TemplateKind.WRISTBAND, band, printer(head = null)).shouldNotBeNull().detail shouldBe
                    "print head width unknown"
            }

            test("a template wider than the print head is a mismatch (25.4 mm at 8 dots/mm is 203 dots)") {
                MediaRule.check(TemplateKind.WRISTBAND, band, printer(head = 203)).shouldBeNull()
                MediaRule.check(TemplateKind.WRISTBAND, band, printer(head = 202)).shouldNotBeNull().detail shouldBe
                    "template wider than the print head"
            }

            test("flow kinds check the width only") {
                MediaRule.check(TemplateKind.RECEIPT, receipt, printer(width = 80.0, length = null, head = 640)).shouldBeNull()
                MediaRule.check(TemplateKind.RECEIPT, receipt, printer(width = 58.0, length = null, head = 640)).shouldNotBeNull()
            }

            test("PDF has no loaded media") {
                MediaRule
                    .check(TemplateKind.DOCUMENT, Samples.documentTemplate.media, printer(OutputMode.PDF, width = null, head = null))
                    .shouldBeNull()
            }
        }

        context("print time") {
            test("formats in the tenant zone with Western digits, whatever the default locale") {
                PrintTime.format(Instant.parse("2026-10-19T21:30:00Z"), ZoneId.of("Asia/Baghdad")) shouldBe "2026-10-20 00:30"
                PrintTime.format(Instant.parse("2026-10-19T21:30:00Z"), ZoneId.of("UTC")) shouldBe "2026-10-19 21:30"
                val previous = java.util.Locale.getDefault()
                try {
                    java.util.Locale.setDefault(java.util.Locale.forLanguageTag("ar-IQ-u-nu-arab"))
                    PrintTime.format(Instant.parse("2026-01-02T03:04:00Z"), ZoneId.of("UTC")) shouldBe "2026-01-02 03:04"
                } finally {
                    java.util.Locale.setDefault(previous)
                }
            }

            test("an invalid zone is null, not an exception") {
                PrintTime.zoneOrNull("Mars/Olympus").shouldBeNull()
                PrintTime.zoneOrNull("Asia/Baghdad") shouldBe ZoneId.of("Asia/Baghdad")
            }
        }
    })
