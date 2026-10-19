package hms.platform.docs.application

import hms.platform.docs.api.DeclareNoBandPrinted
import hms.platform.docs.api.FirstBandResult
import hms.platform.docs.api.HalPrintOutcome
import hms.platform.docs.api.PrintResult
import hms.platform.docs.api.RefusalReason
import hms.platform.docs.api.ReportPrintOutcome
import hms.platform.docs.api.ReprintReason
import hms.platform.docs.api.ResetFirstBandKey
import hms.platform.docs.api.VerifyFirstBand
import hms.platform.docs.application.testing.PrintFixtures
import hms.platform.docs.application.testing.PrintFixtures.ADULT
import hms.platform.docs.application.testing.PrintFixtures.Harness
import hms.platform.docs.application.testing.PrintFixtures.bandPrinter
import hms.platform.docs.application.testing.PrintFixtures.command
import hms.platform.docs.application.testing.PrintFixtures.job
import hms.platform.docs.domain.audit.PrintOutcome
import hms.platform.docs.domain.job.PrintJobEvent
import hms.platform.docs.domain.job.PrintJobState
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldEndWith
import io.kotest.matchers.string.shouldStartWith
import io.kotest.matchers.types.shouldBeInstanceOf

/**
 * Wristband issue through the print service (docs/specs/modules/platform-docs.md §6.1, §6.3, §8.6; DN-071, DN-072;
 * HAZ-0046, HAZ-0049): the band serial, first-band verification, reprints and the `~JA` cancellation. Synthetic data only.
 */
class PrintServiceFirstBandTest :
    FunSpec({
        fun rendered(result: PrintResult) = result.shouldBeInstanceOf<PrintResult.Rendered>()

        fun refusal(result: PrintResult) = result.shouldBeInstanceOf<PrintResult.Refused>().refusal

        val ctx = PrintFixtures.context()
        val other = PrintFixtures.arabic.copy(patientRef = "SYN-P-0002")

        fun band(
            identity: hms.platform.docs.api.PatientIdentity = PrintFixtures.sorani,
            reprintOf: String? = null,
            reason: ReprintReason? = null,
        ) = command(ADULT, PrintFixtures.wristband(identity), bandPrinter(text = true), reprintOf = reprintOf, reprintReason = reason)

        fun verify(
            h: Harness,
            result: PrintResult.Rendered,
            payload: String = payload(result),
            confirmed: Boolean = true,
        ) = h.service.verifyFirstBand(VerifyFirstBand(ctx, result.jobId, payload, confirmed))

        test("UnitTest:wristband-payload-carries-band-serial: HMS1|M:|E:|B:<job id>, and that payload verifies the band") {
            val h = Harness()
            val first = rendered(h.service.print(band()))
            payload(first) shouldBe "HMS1|M:${PrintFixtures.MRN}|E:${PrintFixtures.ENCOUNTER}|B:${job(1)}"
            first.scanVerificationRequired shouldBe true
            verify(h, first) shouldBe FirstBandResult.Verified
            val reprint = rendered(h.service.print(band(reprintOf = first.jobId, reason = ReprintReason.LOST)))
            payload(reprint) shouldEndWith "|B:${job(2)}"
            reprint.scanVerificationRequired shouldBe false
        }

        test("UnitTest:first-band-blocks-until-verified (service): a second band on the key waits; verified, it prints") {
            val h = Harness()
            val first = rendered(h.service.print(band()))
            refusal(h.service.print(band(other))).reason shouldBe RefusalReason.FIRST_BAND_PENDING
            verify(h, first) shouldBe FirstBandResult.Verified
            rendered(h.service.print(band(other))).scanVerificationRequired shouldBe false
            // A raster printer is another output mode: another verification key, so a first band again.
            val third = PrintFixtures.wristband(other.copy(patientRef = "SYN-P-0003"))
            rendered(h.service.print(command(ADULT, third, bandPrinter()))).scanVerificationRequired shouldBe true
        }

        test("a scan that differs, or a match without the visual confirmation, blocks the key until a reset with a reason") {
            val h = Harness()
            val first = rendered(h.service.print(band()))
            verify(h, first, payload = payload(first).lowercase()) shouldBe FirstBandResult.Mismatch("scanned payload differs")
            refusal(h.service.print(band(other))).reason shouldBe RefusalReason.FIRST_BAND_PENDING
            h.service.resetFirstBandKey(ResetFirstBandKey(ctx, first.jobId, mismatchedBandRemoved = false, reason = "removed")) shouldBe
                FirstBandKeyResult.Rejected("the mismatched band must be removed from the patient first")
            h.service.resetFirstBandKey(ResetFirstBandKey(ctx, first.jobId, mismatchedBandRemoved = true, reason = " ")) shouldBe
                FirstBandKeyResult.Rejected("a reset needs a reason")
            h.service.resetFirstBandKey(ResetFirstBandKey(ctx, first.jobId, true, "band removed, printer and template checked")) shouldBe
                FirstBandKeyResult.Released
            rendered(h.service.print(band(other))).scanVerificationRequired shouldBe true

            val h2 = Harness()
            val unconfirmed = rendered(h2.service.print(band()))
            verify(h2, unconfirmed, confirmed = false) shouldBe FirstBandResult.Mismatch("visual match not confirmed")
        }

        test("a first band that failed releases the key; one whose outcome is unknown waits until declared not printed") {
            val h = Harness()
            val failed = rendered(h.service.print(band()))
            h.service.reportOutcome(ReportPrintOutcome(ctx, failed.jobId, HalPrintOutcome.Error("paper-out", "no media", false)))
            // Nothing printed: the next band is a first band again, and no band counts as issued (no reprint reason needed).
            val unknown = rendered(h.service.print(band()))
            unknown.scanVerificationRequired shouldBe true
            h.service.reportOutcome(ReportPrintOutcome(ctx, unknown.jobId, HalPrintOutcome.Error("timeout", "no answer", true)))
            refusal(h.service.print(band(other))).reason shouldBe RefusalReason.FIRST_BAND_PENDING
            h.service.declareNoBandPrinted(DeclareNoBandPrinted(ctx, failed.jobId)).shouldBeInstanceOf<FirstBandKeyResult.Rejected>()
            h.service.declareNoBandPrinted(DeclareNoBandPrinted(ctx, unknown.jobId)) shouldBe FirstBandKeyResult.Released
            rendered(h.service.print(band(other))).scanVerificationRequired shouldBe true
        }

        test("every first-band outcome is audited before the key changes; an audit failure changes nothing") {
            val h = Harness()
            val first = rendered(h.service.print(band()))
            h.audit.failing = true
            verify(h, first) shouldBe FirstBandResult.AuditUnavailable
            h.audit.failing = false
            verify(h, first) shouldBe FirstBandResult.Verified
            val h2 = Harness()
            val mismatch = rendered(h2.service.print(band()))
            verify(h2, mismatch, payload = "HMS1|M:X") shouldBe FirstBandResult.Mismatch("scanned payload differs")
            h2.service.resetFirstBandKey(ResetFirstBandKey(ctx, mismatch.jobId, true, "band removed"))
            val unknown = rendered(h2.service.print(band()))
            h2.service.reportOutcome(ReportPrintOutcome(ctx, unknown.jobId, HalPrintOutcome.Error("timeout", "no answer", true)))
            h2.service.declareNoBandPrinted(DeclareNoBandPrinted(ctx, unknown.jobId))
            h.audit.records.map { it.outcome } shouldBe listOf(PrintOutcome.RENDERED, PrintOutcome.FIRST_BAND_VERIFIED)
            h2.audit.records.map { it.outcome } shouldBe
                listOf(
                    PrintOutcome.RENDERED,
                    PrintOutcome.FIRST_BAND_MISMATCH,
                    PrintOutcome.FIRST_BAND_KEY_RESET,
                    PrintOutcome.RENDERED,
                    PrintOutcome.OUTCOME_UNKNOWN,
                    PrintOutcome.FIRST_BAND_NONE_PRINTED,
                )
        }

        test("UnitTest:second-band-is-a-reprint (service): a second band for the patient and encounter needs a reason") {
            val h = Harness()
            val first = rendered(h.service.print(band()))
            verify(h, first)
            refusal(h.service.print(band())).reason shouldBe RefusalReason.REPRINT_REASON_REQUIRED
            val second = rendered(h.service.print(band(reason = ReprintReason.ILLEGIBLE)))
            String(second.bytes, Charsets.UTF_8) shouldStartWith "~JA\n^XA\n"
            h.audit.records.last().reprintOf shouldBe first.jobId
            h.audit.records.last().reprintReason shouldBe ReprintReason.ILLEGIBLE
        }

        test("a ZPL reprint's ~JA makes the printer's other open jobs outcome-unknown, each audited and evented") {
            val h = Harness()
            val first = rendered(h.service.print(band()))
            verify(h, first)
            val second = rendered(h.service.print(band(other)))
            h.service.reportOutcome(ReportPrintOutcome(ctx, second.jobId, HalPrintOutcome.Sent))
            val done = rendered(h.service.print(band(other.copy(patientRef = "SYN-P-0004"))))
            h.service.reportOutcome(ReportPrintOutcome(ctx, done.jobId, HalPrintOutcome.Completed))
            val reprint = rendered(h.service.print(band(reprintOf = first.jobId, reason = ReprintReason.PRINTER_FAULT)))
            String(reprint.bytes, Charsets.UTF_8) shouldStartWith "~JA\n"
            h.service.jobState(first.jobId) shouldBe PrintJobState.OUTCOME_UNKNOWN
            h.service.jobState(second.jobId) shouldBe PrintJobState.OUTCOME_UNKNOWN
            h.service.jobState(done.jobId) shouldBe PrintJobState.COMPLETED
            h.service.jobState(reprint.jobId) shouldBe PrintJobState.RENDERED
            val cancelled = h.audit.records.filter { it.outcome == PrintOutcome.OUTCOME_UNKNOWN }.map { it.jobId }
            cancelled.toSet() shouldBe setOf(first.jobId, second.jobId)
            h.events.events
                .filterIsInstance<PrintJobEvent.PrintJobOutcomeUnknown>()
                .map { it.header.jobId }
                .toSet() shouldBe setOf(first.jobId, second.jobId)
            // A late HAL report for a cancelled job is a late outcome; the state stays.
            h.service.reportOutcome(ReportPrintOutcome(ctx, second.jobId, HalPrintOutcome.Completed))
            h.service.jobState(second.jobId) shouldBe PrintJobState.OUTCOME_UNKNOWN
            h.audit.records.last().outcome shouldBe PrintOutcome.LATE_OUTCOME
        }

        test("UnitTest:wristband-single-copy and UnitTest:reprint-requires-reason (service)") {
            val h = Harness()
            refusal(h.service.print(band().copy(copies = 2))).reason shouldBe RefusalReason.COPIES_NOT_ALLOWED
            refusal(h.service.print(band(reprintOf = job(7)))).reason shouldBe RefusalReason.REPRINT_REASON_REQUIRED
        }
    })
