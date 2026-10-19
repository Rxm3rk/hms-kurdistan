package hms.platform.docs.domain.layout

import hms.platform.docs.domain.template.TemplateKind
import hms.platform.docs.domain.testing.Samples
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import java.time.Instant
import java.time.ZoneId
import java.util.Locale

class WatermarkTextTest :
    FunSpec({
        val baghdad = ZoneId.of("Asia/Baghdad")

        test("the minimal mark: short job id and print time in the tenant zone") {
            WatermarkText.minimal(Samples.watermark(), baghdad) shouldBe "abcd5678 2026-10-19 14:05"
        }

        test("the minimal mark on a reprint ends in R") {
            WatermarkText.minimal(Samples.watermark(reprintOf = "SYN-JOB-0"), baghdad) shouldBe "abcd5678 2026-10-19 14:05 R"
        }

        test("the full line: user, staff id, time, MRN, job id; REPRINT of the original on a reprint") {
            WatermarkText.full(Samples.watermark(), baghdad) shouldBe
                "Dr Hana Aziz (SYN-ST-001) · 2026-10-19 14:05 · MRN SYN-0000123 · Job ${Samples.JOB_ID}"
            WatermarkText.full(Samples.watermark(reprintOf = "SYN-JOB-0"), baghdad) shouldBe
                "Dr Hana Aziz (SYN-ST-001) · 2026-10-19 14:05 · MRN SYN-0000123 · Job ${Samples.JOB_ID} · REPRINT of SYN-JOB-0"
        }

        test("the zone decides the printed time; the instant is injected, never read from a clock") {
            val late = Samples.watermark().copy(printedAt = Instant.parse("2026-12-31T22:30:00Z"))
            WatermarkText.minimal(late, baghdad) shouldBe "abcd5678 2027-01-01 01:30"
            WatermarkText.minimal(late, ZoneId.of("UTC")) shouldBe "abcd5678 2026-12-31 22:30"
        }

        test("Western digits whatever the default locale") {
            val previous = Locale.getDefault()
            try {
                Locale.setDefault(Locale.forLanguageTag("ckb-IQ-u-nu-arabext"))
                WatermarkText.minimal(Samples.watermark(), baghdad) shouldBe "abcd5678 2026-10-19 14:05"
                Locale.setDefault(Locale.forLanguageTag("ar-IQ-u-nu-arab"))
                WatermarkText.full(Samples.watermark(), baghdad) shouldBe
                    "Dr Hana Aziz (SYN-ST-001) · 2026-10-19 14:05 · MRN SYN-0000123 · Job ${Samples.JOB_ID}"
            } finally {
                Locale.setDefault(previous)
            }
        }

        test("placement by kind: minimal on labels, full on receipts and documents, none on tokens") {
            val w = Samples.watermark()
            WatermarkText.forKind(TemplateKind.WRISTBAND, w, baghdad) shouldBe WatermarkText.minimal(w, baghdad)
            WatermarkText.forKind(TemplateKind.SPECIMEN_LABEL, w, baghdad) shouldBe WatermarkText.minimal(w, baghdad)
            WatermarkText.forKind(TemplateKind.RECEIPT, w, baghdad) shouldBe WatermarkText.full(w, baghdad)
            WatermarkText.forKind(TemplateKind.DOCUMENT, w, baghdad) shouldBe WatermarkText.full(w, baghdad)
            WatermarkText.forKind(TemplateKind.TOKEN, w, baghdad).shouldBeNull()
        }

        test("the short id is the end of the id without hyphens, so ids of one millisecond differ") {
            WatermarkText.shortId("0192f3a4-7b1c-7def-8abc-1234abcd5678") shouldBe "abcd5678"
            WatermarkText.shortId("0192f3a4-7b1c-7def-8abc-9999abcd0000") shouldBe "abcd0000"
            WatermarkText.shortId("A-1") shouldBe "A1"
        }

        test("a watermark without an MRN leaves the MRN out") {
            WatermarkText.full(Samples.watermark().copy(patientMrn = null), baghdad) shouldBe
                "Dr Hana Aziz (SYN-ST-001) · 2026-10-19 14:05 · Job ${Samples.JOB_ID}"
        }
    })
