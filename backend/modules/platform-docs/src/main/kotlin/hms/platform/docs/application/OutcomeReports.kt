package hms.platform.docs.application

import hms.platform.docs.api.CommandContext
import hms.platform.docs.api.HalPrintOutcome
import hms.platform.docs.api.PrintOutcomeResult
import hms.platform.docs.api.ReportPrintOutcome
import hms.platform.docs.domain.audit.PrintOutcome
import hms.platform.docs.domain.job.PrintJobEvent
import hms.platform.docs.domain.job.PrintJobLifecycle
import hms.platform.docs.domain.job.PrintJobState
import hms.platform.docs.domain.job.TransitionResult
import hms.platform.docs.domain.verification.FirstBandChange

/**
 * The HAL's outcomes for rendered jobs and the reprint cancellation (docs/specs/modules/platform-docs.md §6.3, §8.1,
 * §8.3, §8.6; `docs/specs/state-machines/print-job.yaml`). Every accepted outcome is audited before the state changes:
 * an audit failure leaves the state unchanged and the report may be repeated (`AuditUnavailable`). A report for an
 * outcome-unknown job is audited as a late outcome and changes nothing (a job that printed after all is still on
 * record). A first band that failed (nothing printed) releases its key and withdraws its issued band; one whose outcome
 * is unknown keeps the key pending until it is verified or declared not printed.
 */
internal class OutcomeReports(
    private val state: PrintState,
    private val recorder: PrintRecorder,
) {
    fun report(report: ReportPrintOutcome): PrintOutcomeResult {
        val job = state.jobs[report.jobId]
        return if (job == null) {
            PrintOutcomeResult.Rejected(report.jobId, "unknown job")
        } else {
            when (val transition = PrintJobLifecycle.onHalOutcome(job.state, report.outcome)) {
                is TransitionResult.Accepted -> accept(report, job, transition.to)
                is TransitionResult.LateOutcome -> late(report, job)
                is TransitionResult.Rejected -> PrintOutcomeResult.Rejected(report.jobId, transition.detail)
            }
        }
    }

    /**
     * A reprint's `~JA` cancels every format queued on [printerId]: its other jobs still rendered or dispatched become
     * outcome-unknown, each audited and evented (spec §7.1, §8.6). The reprint's output is already audited, so a failed
     * write here is counted in the metrics and the state still changes: the printer will discard those formats.
     */
    fun cancelledByReprint(
        context: CommandContext,
        printerId: String,
        reprintJobId: String,
    ) {
        state.jobs.values
            .filter { it.facts.printerId == printerId && it.facts.jobId != reprintJobId }
            .forEach { job ->
                if (PrintJobLifecycle.cancelledByReprint(job.state) is TransitionResult.Accepted) {
                    recorder.audit(context, job.facts, PrintOutcome.OUTCOME_UNKNOWN)
                    job.state = PrintJobState.OUTCOME_UNKNOWN
                    recorder.publish(PrintJobEvent.PrintJobOutcomeUnknown(recorder.header(job.facts), "cancelled by a reprint (~JA)"))
                    ended(job, PrintJobState.OUTCOME_UNKNOWN)
                }
            }
    }

    private fun accept(
        report: ReportPrintOutcome,
        job: JobRecord,
        to: PrintJobState,
    ): PrintOutcomeResult {
        val audited = recorder.audit(report.context, job.facts, to.auditOutcome())
        if (audited) {
            job.state = to
            event(job, to, report.outcome)?.let { recorder.publish(it) }
            ended(job, to)
        }
        return if (audited) PrintOutcomeResult.Updated(report.jobId, to.name) else PrintOutcomeResult.AuditUnavailable(report.jobId)
    }

    private fun late(
        report: ReportPrintOutcome,
        job: JobRecord,
    ): PrintOutcomeResult =
        if (recorder.audit(report.context, job.facts, PrintOutcome.LATE_OUTCOME)) {
            PrintOutcomeResult.Updated(report.jobId, job.state.name)
        } else {
            PrintOutcomeResult.AuditUnavailable(report.jobId)
        }

    /** The event of an outcome (spec §8.2): none for dispatched; the HAL's error kind only, never its free text. */
    private fun event(
        job: JobRecord,
        to: PrintJobState,
        outcome: HalPrintOutcome,
    ): PrintJobEvent? {
        val header = recorder.header(job.facts)
        val kind = (outcome as? HalPrintOutcome.Error)?.kind.orEmpty()
        return when (to) {
            PrintJobState.COMPLETED -> PrintJobEvent.PrintJobCompleted(header)
            PrintJobState.FAILED -> PrintJobEvent.PrintJobFailed(header, kind)
            PrintJobState.OUTCOME_UNKNOWN -> PrintJobEvent.PrintJobOutcomeUnknown(header, kind)
            else -> null
        }
    }

    /** What an ended job means for its first-band key and its issued band (spec §6.3, §8.6). */
    private fun ended(
        job: JobRecord,
        to: PrintJobState,
    ) {
        val pending = job.firstBandStatus == FirstBandStatus.PENDING
        if (to == PrintJobState.FAILED) {
            job.bandSubject?.let { state.issuedBands.withdraw(it, job.facts.jobId) }
            if (pending && state.firstBands.jobEnded(job.facts.jobId, to) == FirstBandChange.Released) {
                job.firstBandStatus = FirstBandStatus.RELEASED
            }
        } else if (to == PrintJobState.OUTCOME_UNKNOWN && pending) {
            state.firstBands.jobEnded(job.facts.jobId, to)
            job.firstBandStatus = FirstBandStatus.PENDING_OUTCOME_UNKNOWN
        }
    }
}
