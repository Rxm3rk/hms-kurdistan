package hms.platform.docs.application

import hms.platform.docs.api.DeclareNoBandPrinted
import hms.platform.docs.api.FirstBandResult
import hms.platform.docs.api.OutputMode
import hms.platform.docs.api.PrintCommand
import hms.platform.docs.api.PrintOutcomeResult
import hms.platform.docs.api.PrintResult
import hms.platform.docs.api.Refusal
import hms.platform.docs.api.RefusalReason
import hms.platform.docs.api.ReportPrintOutcome
import hms.platform.docs.api.ResetFirstBandKey
import hms.platform.docs.api.VerifyFirstBand
import hms.platform.docs.domain.audit.PrintOutcome
import hms.platform.docs.domain.job.PrintJobEvent
import hms.platform.docs.domain.job.PrintJobState
import hms.platform.docs.domain.layout.TextShaper
import hms.platform.docs.domain.template.LegibilityPolicy
import hms.platform.docs.domain.verification.FirstBandAdmission
import hms.platform.docs.domain.verification.FirstBandVerification
import hms.platform.docs.domain.verification.IssuedBands
import hms.platform.docs.infrastructure.fonts.FontRegistry
import hms.platform.docs.infrastructure.raster.LayoutRasteriser
import java.security.MessageDigest
import java.time.Clock
import java.util.HexFormat

/**
 * Everything the print service uses (docs/specs/modules/platform-docs.md §8, §12). The policy, MRN check, audit, event
 * and renderer ports have no production adapter yet (WP-0.4, WP-1.2, WP-0.3, the cell): [ProductionPrintWiring]
 * wires refusing ones, so every production print is refused (spec §8.4, KA-077, KA-083). [clock] and [jobIds] are
 * injected, so fixtures and goldens are deterministic.
 */
data class PrintServicePorts(
    val templates: TemplateRepository,
    val policy: PrintPolicyPort,
    val mrnCheck: MrnCheckPort,
    val audit: PrintAuditPort,
    val events: PrintEventPort,
    val renderer: DocumentRendererPort,
    val shaper: TextShaper,
    val rasteriser: LayoutRasteriser,
    val fonts: FontRegistry,
    val clock: Clock,
    val jobIds: JobIdSource,
    val legibility: LegibilityPolicy = LegibilityPolicy(),
)

/** The in-memory state of one print service: jobs, issued bands and first-band keys (persistence waits for the cell, KA-077). */
internal class PrintState {
    val jobs: MutableMap<String, JobRecord> = LinkedHashMap()
    val issuedBands: IssuedBands = IssuedBands()
    val firstBands: FirstBandVerification = FirstBandVerification()
}

/** The result of [PrintService.declareNoBandPrinted] and [PrintService.resetFirstBandKey] (spec §6.3). */
sealed interface FirstBandKeyResult {
    /** The key is released: the next wristband on it is a first band again. */
    data object Released : FirstBandKeyResult

    /** Nothing changed; [detail] says why (never patient data). */
    data class Rejected(
        val detail: String,
    ) : FirstBandKeyResult

    /** The audit record could not be written; nothing changed and the command may be repeated (spec §8.3). */
    data object AuditUnavailable : FirstBandKeyResult
}

/**
 * The print service (docs/specs/modules/platform-docs.md §2, §8, §12; `docs/specs/state-machines/print-job.yaml`;
 * HAZ-0045 to HAZ-0049). [print] runs the checks and the writer of [PrintPipeline]; every outcome (refused, rendered,
 * failed, and later dispatched, completed, failed, outcome unknown, late outcome and the first-band commands) is
 * audited, and **the audit record of a rendered print is written before the output is returned: if it cannot be
 * written, the print is refused** (`print.refused.auditUnavailable`; that refusal is published as an event and counted
 * in [metrics], it cannot itself be audited). Events carry identifiers and the template version, never a patient
 * reference, a name, label text or a payload (SI-20). A job is never retried by itself.
 *
 * After a ZPL reprint (which starts with `~JA`, cancelling every format queued in the printer) the printer's other
 * jobs still rendered or dispatched become outcome-unknown, each audited (spec §7.1, §8.6).
 *
 * One lock serialises the service: the job store, the issued bands and the first-band keys change together.
 */
class PrintService(
    private val ports: PrintServicePorts,
) {
    /** PHI-free counters of audit and event failures (spec §8.3). */
    val metrics: PrintServiceMetrics = PrintServiceMetrics()

    private val state = PrintState()
    private val recorder = PrintRecorder(ports.audit, ports.events, ports.clock, metrics)
    private val pipeline = PrintPipeline(ports, state)
    private val outcomes = OutcomeReports(state, recorder)
    private val firstBandCommands = FirstBandCommands(state, recorder)

    /** Prints [command]: the output, or the refusal (spec §12 `PrintCommand` → `PrintResult`). */
    @Synchronized
    fun print(command: PrintCommand): PrintResult {
        val draft = JobDraft(ports.jobIds.next(), command, ports.clock.instant())
        recorder.publish(PrintJobEvent.PrintJobRequested(recorder.header(draft.facts())))
        val stop = pipeline.run(draft)
        return if (stop != null) refuse(draft, stop) else complete(draft)
    }

    /** `ReportPrintOutcome` (spec §8.1, §12): the HAL's answer for a rendered job. */
    @Synchronized
    fun reportOutcome(report: ReportPrintOutcome): PrintOutcomeResult = outcomes.report(report)

    /** `VerifyFirstBand` (spec §6.3). */
    @Synchronized
    fun verifyFirstBand(command: VerifyFirstBand): FirstBandResult = firstBandCommands.verify(command)

    /** `DeclareNoBandPrinted` (spec §6.3): no band came out of a first job whose outcome was unknown. */
    @Synchronized
    fun declareNoBandPrinted(command: DeclareNoBandPrinted): FirstBandKeyResult = firstBandCommands.declareNoBandPrinted(command)

    /** `ResetFirstBandKey` (spec §6.3): the mismatched band was removed; the key's next band is a first band again. */
    @Synchronized
    fun resetFirstBandKey(command: ResetFirstBandKey): FirstBandKeyResult = firstBandCommands.reset(command)

    /** The state of job [jobId], or null for an unknown job. */
    @Synchronized
    fun jobState(jobId: String): PrintJobState? = state.jobs[jobId]?.state

    private fun refuse(
        draft: JobDraft,
        stop: Stop,
    ): PrintResult {
        val facts = draft.facts()
        val ended = if (stop.renderError) PrintJobState.FAILED else PrintJobState.REFUSED
        state.jobs[draft.jobId] = JobRecord(facts, ended)
        // A refusal whose audit write fails is still refused; the failure is counted in the metrics (spec §8.3).
        recorder.audit(draft.command.context, facts, ended.auditOutcome(), stop.refusal.reason)
        val header = recorder.header(facts)
        recorder.publish(
            if (stop.renderError) {
                PrintJobEvent.PrintJobFailed(header, "render error")
            } else {
                PrintJobEvent.PrintJobRefused(header, stop.refusal.reason)
            },
        )
        return PrintResult.Refused(draft.jobId, stop.refusal)
    }

    private fun complete(draft: JobDraft): PrintResult {
        val output = checkNotNull(draft.output)
        val facts = draft.facts()
        val sha256 = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(output.bytes))
        if (!recorder.audit(draft.command.context, facts, PrintOutcome.RENDERED, outputSha256 = sha256)) {
            state.jobs[draft.jobId] = JobRecord(facts, PrintJobState.REFUSED)
            recorder.publish(PrintJobEvent.PrintJobRefused(recorder.header(facts), RefusalReason.AUDIT_UNAVAILABLE))
            val refusal = Refusal(RefusalReason.AUDIT_UNAVAILABLE, "audit", "the audit record could not be written")
            return PrintResult.Refused(draft.jobId, refusal)
        }
        state.jobs[draft.jobId] = JobRecord(facts, PrintJobState.RENDERED, draft.bandSubject, draft.firstBand)
        val scanRequired =
            draft.firstBand?.let { state.firstBands.admit(it.key, draft.jobId, it.expectedPayload) } ==
                FirstBandAdmission.Admitted(scanVerificationRequired = true)
        draft.bandSubject?.let { state.issuedBands.recordIssued(it, draft.jobId) }
        if (draft.reprint && output.mode in ZPL_MODES) {
            outcomes.cancelledByReprint(draft.command.context, facts.printerId, draft.jobId)
        }
        val template = draft.template()
        return PrintResult.Rendered(
            jobId = draft.jobId,
            mediaType = output.mediaType,
            bytes = output.bytes,
            sha256 = sha256,
            templateId = template.id,
            templateVersion = template.version,
            templateHash = template.contentHash,
            scanVerificationRequired = scanRequired,
        )
    }

    private companion object {
        val ZPL_MODES: Set<OutputMode> = setOf(OutputMode.ZPL_TEXT, OutputMode.ZPL_RASTER)
    }
}
