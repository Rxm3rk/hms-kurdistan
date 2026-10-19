package hms.platform.docs.domain.job

import hms.platform.docs.api.OutputMode
import hms.platform.docs.api.RefusalReason
import hms.platform.docs.api.ReprintReason
import java.time.Instant

/**
 * The print-job lifecycle and its events (docs/specs/modules/platform-docs.md §8.1, §8.2; §12.8 canonical
 * events `PrintJobCompleted` and `PrintJobFailed` with template version).
 *
 * requested → refused | failed | rendered; rendered → dispatched | completed | failed | outcome-unknown;
 * dispatched → completed | failed | outcome-unknown (docs/specs/state-machines/print-job.yaml).
 * A job is never retried by itself; a reprint is a new job with `reprintOf` and a reason.
 */
enum class PrintJobState(
    val terminal: Boolean,
) {
    REQUESTED(terminal = false),
    RENDERED(terminal = false),
    DISPATCHED(terminal = false),
    COMPLETED(terminal = true),
    FAILED(terminal = true),

    /** A HAL timeout or device error on a print call: the job may have printed. Never retried automatically. */
    OUTCOME_UNKNOWN(terminal = true),
    REFUSED(terminal = true),
}

/** What every event carries: identifiers and the template version, never names, label text or payloads. */
data class PrintJobHeader(
    val jobId: String,
    val tenantId: String,
    val facilityId: String,
    val templateId: String,
    val templateVersion: Int?,
    val templateHash: String?,
    val mode: OutputMode,
    val printerId: String,
    val copies: Int,
    val reprintOf: String?,
    val reprintReason: ReprintReason?,
    val correlationId: String,
    val occurredAt: Instant,
)

/** The print-job events (spec §8.2); payloads hold no PHI beyond internal references (SI-20). */
sealed interface PrintJobEvent {
    val header: PrintJobHeader

    data class PrintJobRequested(
        override val header: PrintJobHeader,
    ) : PrintJobEvent

    data class PrintJobRefused(
        override val header: PrintJobHeader,
        val reason: RefusalReason,
    ) : PrintJobEvent

    data class PrintJobCompleted(
        override val header: PrintJobHeader,
    ) : PrintJobEvent

    data class PrintJobFailed(
        override val header: PrintJobHeader,
        val detail: String,
    ) : PrintJobEvent

    /** A HAL timeout or device error on a print call: the job may have printed; never retried automatically. */
    data class PrintJobOutcomeUnknown(
        override val header: PrintJobHeader,
        val detail: String,
    ) : PrintJobEvent
}
