package hms.platform.docs.application

import hms.platform.docs.api.HalPrintOutcome
import hms.platform.docs.api.MrnCheck
import hms.platform.docs.api.OutputMode
import hms.platform.docs.api.PrintContent
import hms.platform.docs.api.PrintOutcomeResult
import hms.platform.docs.api.PrintResult
import hms.platform.docs.api.RefusalReason
import hms.platform.docs.api.ReportPrintOutcome
import hms.platform.docs.application.testing.CapturingRenderer
import hms.platform.docs.application.testing.FixedClock
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
import hms.platform.docs.application.testing.SyntheticMrnCheck
import hms.platform.docs.domain.audit.PrintAuditRecord
import hms.platform.docs.domain.audit.PrintOutcome
import hms.platform.docs.domain.job.PrintJobEvent
import hms.platform.docs.domain.job.PrintJobState
import hms.platform.docs.infrastructure.raster.LayoutRasteriser
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.longs.shouldBeGreaterThan
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import java.security.MessageDigest
import java.util.HexFormat

/**
 * The print service's refusals and audit (docs/specs/modules/platform-docs.md §3.2 R4a, §8.1 to §8.4; HAZ-0045,
 * HAZ-0048). Synthetic data only (§19.4).
 */
class PrintServiceTest :
    FunSpec({
        fun refusal(result: PrintResult) = result.shouldBeInstanceOf<PrintResult.Refused>().refusal

        fun outcomes(records: List<PrintAuditRecord>) = records.map { it.outcome }

        val band = command(ADULT, PrintFixtures.wristband(), bandPrinter())

        context("UnitTest:print-refused-without-policy") {
            test("no policy decision point: every print is refused, audited and evented, with no output") {
                val h = Harness(policy = ProductionPrintWiring.policy)
                refusal(h.service.print(band)).reason shouldBe RefusalReason.POLICY_UNAVAILABLE
                refusal(h.service.print(command(TOKEN, PrintFixtures.token, PrintFixtures.escPos(8.0)))).reason shouldBe
                    RefusalReason.POLICY_UNAVAILABLE
                h.audit.records
                    .map { it.refusalReason }
                    .toSet() shouldBe setOf(RefusalReason.POLICY_UNAVAILABLE)
                outcomes(h.audit.records) shouldBe listOf(PrintOutcome.REFUSED, PrintOutcome.REFUSED)
                h.events.events
                    .filterIsInstance<PrintJobEvent.PrintJobRefused>()
                    .size shouldBe 2
                h.service.jobState(job(1)) shouldBe PrintJobState.REFUSED
            }

            test("a denied decision refuses with policyDenied; a policy adapter that throws is no decision") {
                val denied = Harness(policy = { PolicyDecision.Denied("purpose of use") })
                refusal(denied.service.print(band)).reason shouldBe RefusalReason.POLICY_DENIED
                val throwing = Harness(policy = { error("policy point down") })
                refusal(throwing.service.print(band)).reason shouldBe RefusalReason.POLICY_UNAVAILABLE
            }

            test("the test policy allows synthetic patients only") {
                val h = Harness()
                val real = PrintFixtures.sorani.copy(patientRef = "P-0001")
                refusal(h.service.print(command(ADULT, PrintFixtures.wristband(real), bandPrinter()))).reason shouldBe
                    RefusalReason.POLICY_DENIED
            }
        }

        context("UnitTest:print-refused-without-mrn-check") {
            test("no identity service: every patient print is refused with mrnCheckFailed") {
                val h = Harness(mrnCheck = ProductionPrintWiring.mrnCheck)
                refusal(h.service.print(band)).let {
                    it.reason shouldBe RefusalReason.MRN_CHECK_FAILED
                    it.subject shouldBe "identity.mrn"
                }
                refusal(h.service.print(command(RECEIPT, PrintFixtures.receipt(), PrintFixtures.escPos(8.0)))).reason shouldBe
                    RefusalReason.MRN_CHECK_FAILED
            }

            test("an MRN the identity service does not confirm, or an adapter that throws, is refused") {
                val h = Harness(mrnCheck = SyntheticMrnCheck())
                val other = PrintFixtures.sorani.copy(mrn = "MRN-0000123")
                refusal(h.service.print(command(ADULT, PrintFixtures.wristband(other), bandPrinter()))).reason shouldBe
                    RefusalReason.MRN_CHECK_FAILED
                val throwing = Harness(mrnCheck = { error("identity service down") })
                refusal(throwing.service.print(band)).reason shouldBe RefusalReason.MRN_CHECK_FAILED
            }

            test("a token has no patient and needs no MRN check") {
                val h = Harness(mrnCheck = ProductionPrintWiring.mrnCheck)
                h.service.print(command(TOKEN, PrintFixtures.token, PrintFixtures.escPos(8.0))).shouldBeInstanceOf<PrintResult.Rendered>()
            }
        }

        context("UnitTest:print-refused-when-audit-fails") {
            test("the audit record of a rendered print cannot be written: refused, no output, evented and counted") {
                val h = Harness()
                h.audit.failing = true
                refusal(h.service.print(band)).reason shouldBe RefusalReason.AUDIT_UNAVAILABLE
                h.service.jobState(job(1)) shouldBe PrintJobState.REFUSED
                h.events.events
                    .last()
                    .shouldBeInstanceOf<PrintJobEvent.PrintJobRefused>()
                    .reason shouldBe RefusalReason.AUDIT_UNAVAILABLE
                h.service.metrics.auditFailures
                    .get() shouldBeGreaterThan 0L
                // Nothing was admitted: the next band is a first band again and no band counts as issued.
                h.audit.failing = false
                val next = h.service.print(band).shouldBeInstanceOf<PrintResult.Rendered>()
                next.scanVerificationRequired shouldBe true
            }

            test("an outcome report whose audit record cannot be written leaves the state unchanged and may be repeated") {
                val h = Harness()
                val printed = h.service.print(band).shouldBeInstanceOf<PrintResult.Rendered>()
                h.audit.failing = true
                val report = ReportPrintOutcome(PrintFixtures.context(), printed.jobId, HalPrintOutcome.Completed)
                h.service.reportOutcome(report) shouldBe PrintOutcomeResult.AuditUnavailable(printed.jobId)
                h.service.jobState(printed.jobId) shouldBe PrintJobState.RENDERED
                h.audit.failing = false
                h.service.reportOutcome(report) shouldBe PrintOutcomeResult.Updated(printed.jobId, "COMPLETED")
            }
        }

        context("UnitTest:every-print-outcome-audited") {
            test("refused, rendered, dispatched, completed, failed, outcome unknown and late outcome each have one record") {
                val h = Harness()
                val ctx = PrintFixtures.context()
                refusal(h.service.print(band.copy(copies = 2))).reason shouldBe RefusalReason.COPIES_NOT_ALLOWED
                val label = command(SPECIMEN_LABEL, PrintFixtures.specimen(), labelPrinter())
                val a = h.service.print(label).shouldBeInstanceOf<PrintResult.Rendered>()
                h.service.reportOutcome(ReportPrintOutcome(ctx, a.jobId, HalPrintOutcome.Sent))
                h.service.reportOutcome(ReportPrintOutcome(ctx, a.jobId, HalPrintOutcome.Completed))
                val b = h.service.print(label).shouldBeInstanceOf<PrintResult.Rendered>()
                h.service.reportOutcome(ReportPrintOutcome(ctx, b.jobId, HalPrintOutcome.Error("paper-out", "no media", false)))
                val c = h.service.print(label).shouldBeInstanceOf<PrintResult.Rendered>()
                h.service.reportOutcome(ReportPrintOutcome(ctx, c.jobId, HalPrintOutcome.Error("timeout", "no answer", true)))
                h.service.reportOutcome(ReportPrintOutcome(ctx, c.jobId, HalPrintOutcome.Completed)) shouldBe
                    PrintOutcomeResult.Updated(c.jobId, "OUTCOME_UNKNOWN")
                outcomes(h.audit.records) shouldBe
                    listOf(
                        PrintOutcome.REFUSED,
                        PrintOutcome.RENDERED,
                        PrintOutcome.DISPATCHED,
                        PrintOutcome.COMPLETED,
                        PrintOutcome.RENDERED,
                        PrintOutcome.FAILED,
                        PrintOutcome.RENDERED,
                        PrintOutcome.OUTCOME_UNKNOWN,
                        PrintOutcome.LATE_OUTCOME,
                    )
                h.service.jobState(c.jobId) shouldBe PrintJobState.OUTCOME_UNKNOWN
                h.audit.records.forEach { record ->
                    record.eventType shouldBe "print"
                    record.patientRef shouldBe "SYN-P-0001"
                    record.recordedAt shouldBe FixedClock.INSTANT
                }
                val rendered = h.audit.records.filter { it.outcome == PrintOutcome.RENDERED }
                rendered.first().outputSha256 shouldBe HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(a.bytes))
                rendered.first().templateHash shouldBe a.templateHash
                h.audit.records
                    .first()
                    .templateVersion shouldBe 1
            }

            test("a render error after every check passed is a failed job, audited and evented") {
                val h = Harness(rasteriser = LayoutRasteriser { _, _ -> error("synthetic rasteriser fault") })
                refusal(h.service.print(band)).reason shouldBe RefusalReason.RENDERER_UNAVAILABLE
                h.service.jobState(job(1)) shouldBe PrintJobState.FAILED
                outcomes(h.audit.records) shouldBe listOf(PrintOutcome.FAILED)
                h.events.events
                    .last()
                    .shouldBeInstanceOf<PrintJobEvent.PrintJobFailed>()
            }

            test("an outcome a state does not accept is rejected and not audited; an unknown job is rejected") {
                val h = Harness()
                refusal(h.service.print(band.copy(copies = 0)))
                h.service
                    .reportOutcome(ReportPrintOutcome(PrintFixtures.context(), job(1), HalPrintOutcome.Completed))
                    .shouldBeInstanceOf<PrintOutcomeResult.Rejected>()
                h.service
                    .reportOutcome(ReportPrintOutcome(PrintFixtures.context(), "no-such-job", HalPrintOutcome.Sent))
                    .shouldBeInstanceOf<PrintOutcomeResult.Rejected>()
                outcomes(h.audit.records) shouldBe listOf(PrintOutcome.REFUSED)
            }
        }

        context("ProductionPrintWiring") {
            test("no policy, no MRN check and no renderer adapters: every print of every kind is refused") {
                val service = ProductionPrintWiring.printService(PrintFixtures.templatesDir, FixedClock.clock())
                listOf(
                    command(ADULT, PrintFixtures.wristband(), bandPrinter()),
                    command(SPECIMEN_LABEL, PrintFixtures.specimen(), labelPrinter()),
                    command(RECEIPT, PrintFixtures.receipt(), PrintFixtures.escPos(8.0)),
                    command(TOKEN, PrintFixtures.token, PrintFixtures.escPos(8.0)),
                    command(DOCUMENT, PrintFixtures.document(), PrintFixtures.pdf()),
                ).forEach { cmd -> refusal(service.print(cmd)).reason shouldBe RefusalReason.POLICY_UNAVAILABLE }
                // No audit store and no outbox in production: each refusal is counted, never silently dropped.
                service.metrics.auditFailures.get() shouldBe 5L
                service.metrics.eventFailures.get() shouldBe 10L
            }

            test("each production adapter refuses explicitly") {
                ProductionPrintWiring.policy.decide(band) shouldBe PolicyDecision.Unavailable
                ProductionPrintWiring.mrnCheck.check("SYN-0000123") shouldBe MrnCheck.UNAVAILABLE
                val request =
                    RenderRequest("<html></html>", "t", "SYN-X", 1, "0".repeat(64), "synthetic", "en", "2026-10-19T14:05:00+03:00")
                ProductionPrintWiring.renderer
                    .render(request)
                    .shouldBeInstanceOf<RenderOutcome.Failed>()
                    .reason shouldBe
                    RefusalReason.RENDERER_UNAVAILABLE
                shouldThrow<IllegalStateException> { ProductionPrintWiring.audit.record(PrintFixtures.anyAuditRecord()) }
                shouldThrow<IllegalStateException> { ProductionPrintWiring.events.publish(PrintFixtures.anyEvent()) }
            }
        }

        context("template, kind and printer") {
            test("an unknown template, a template of another kind and a printer without the kind's output are refused") {
                val h = Harness()
                refusal(h.service.print(command("SYN-NO-SUCH", PrintFixtures.wristband(), bandPrinter()))).reason shouldBe
                    RefusalReason.TEMPLATE_INVALID
                refusal(h.service.print(command(SPECIMEN_LABEL, PrintFixtures.wristband(), labelPrinter()))).reason shouldBe
                    RefusalReason.TEMPLATE_INVALID
                refusal(h.service.print(command(RECEIPT, PrintFixtures.receipt(), labelPrinter()))).reason shouldBe
                    RefusalReason.PRINTER_UNSUPPORTED
                refusal(h.service.print(command(DOCUMENT, PrintFixtures.document(), PrintFixtures.escPos(8.0)))).reason shouldBe
                    RefusalReason.PRINTER_UNSUPPORTED
            }

            test("a renderer refusal maps to its reason: eastern digits, or renderer unavailable") {
                val renderer = CapturingRenderer(RenderOutcome.Failed("renderer refused", RefusalReason.EASTERN_DIGITS))
                val h = Harness(renderer = renderer)
                refusal(h.service.print(command(DOCUMENT, PrintFixtures.document(), PrintFixtures.pdf()))).reason shouldBe
                    RefusalReason.EASTERN_DIGITS
                renderer.failure = RenderOutcome.Failed("renderer down")
                refusal(h.service.print(command(DOCUMENT, PrintFixtures.document(), PrintFixtures.pdf()))).reason shouldBe
                    RefusalReason.RENDERER_UNAVAILABLE
                val throwing = Harness(renderer = { error("satellite crashed") })
                refusal(throwing.service.print(command(DOCUMENT, PrintFixtures.document(), PrintFixtures.pdf()))).reason shouldBe
                    RefusalReason.RENDERER_UNAVAILABLE
            }

            test("a Code 128 symbol wider than its box is refused, never shrunk") {
                val h = Harness()
                val label = PrintFixtures.specimen() as PrintContent.SpecimenLabel
                val wide = label.copy(content = label.content.copy(specimenId = "SYN-S-0000000000077"))
                refusal(h.service.print(command(PrintFixtures.SPECIMEN_CODE128, wide, labelPrinter()))).let {
                    it.reason shouldBe RefusalReason.TEMPLATE_INVALID
                    it.subject shouldBe "barcode.specimen"
                }
                h.service
                    .print(command(PrintFixtures.SPECIMEN_CODE128, PrintFixtures.specimen(), labelPrinter()))
                    .shouldBeInstanceOf<PrintResult.Rendered>()
                    .let { String(it.bytes, Charsets.UTF_8) }
                    .contains("^BC") shouldBe true
            }

            test("outputs carry the template id, version and hash and the media type of their mode") {
                val h = Harness()
                val zpl = h.service.print(band).shouldBeInstanceOf<PrintResult.Rendered>()
                zpl.mediaType shouldBe PrintMediaTypes.ZPL
                zpl.templateId shouldBe ADULT
                zpl.templateHash shouldBe PrintFixtures.templates.find(ADULT)?.contentHash
                h.service
                    .print(command(RECEIPT, PrintFixtures.receipt(), PrintFixtures.escPos(8.0)))
                    .shouldBeInstanceOf<PrintResult.Rendered>()
                    .mediaType shouldBe PrintMediaTypes.ESCPOS
                h.service
                    .print(command(DOCUMENT, PrintFixtures.document(), PrintFixtures.pdf()))
                    .shouldBeInstanceOf<PrintResult.Rendered>()
                    .mediaType shouldBe PrintMediaTypes.PDF
                h.audit.records.map { it.mode } shouldBe listOf(OutputMode.ZPL_RASTER, OutputMode.ESCPOS_RASTER, OutputMode.PDF)
                h.events.events
                    .filterIsInstance<PrintJobEvent.PrintJobRefused>()
                    .shouldBeEmpty()
            }
        }
    })
