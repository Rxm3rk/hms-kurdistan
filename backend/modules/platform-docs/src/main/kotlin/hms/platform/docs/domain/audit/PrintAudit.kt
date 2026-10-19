package hms.platform.docs.domain.audit

import hms.platform.docs.api.OutputMode
import hms.platform.docs.api.RefusalReason
import hms.platform.docs.api.ReprintReason
import java.time.Instant

/**
 * The print audit record and the watermark (docs/specs/modules/platform-docs.md §8.3, §8.5; §6.3, §13.1
 * AU-1 and DP-8). The record belongs in the cell's BALP audit store (WP-0.4); it may hold the patient
 * reference and the output's SHA-256, which never go to the HAL's local audit log, logs, telemetry or
 * events (SI-20, CTRL-0020-7).
 */
enum class PrintOutcome {
    REFUSED,
    RENDERED,
    DISPATCHED,
    COMPLETED,
    FAILED,
    OUTCOME_UNKNOWN,

    /** A HAL outcome reported after the job became outcome-unknown; the state does not change (spec §8.1). */
    LATE_OUTCOME,
    FIRST_BAND_VERIFIED,
    FIRST_BAND_MISMATCH,

    /** The user stated that no band came out of a first job with an unknown outcome (spec §6.3). */
    FIRST_BAND_NONE_PRINTED,

    /** A user recorded removal of a mismatched band and reset the verification key (spec §6.3). */
    FIRST_BAND_KEY_RESET,
}

/** One audit record per print outcome; the event type is always `print`. */
data class PrintAuditRecord(
    val eventType: String = EVENT_TYPE,
    val jobId: String,
    val tenantId: String,
    val facilityId: String,
    val actorId: String,
    val onBehalfOf: String?,
    val deviceId: String,
    val purposeOfUse: String,
    /** Internal patient reference, or null for prints about no patient (queue tokens). */
    val patientRef: String?,
    val templateId: String,
    val templateVersion: Int?,
    val templateHash: String?,
    val mode: OutputMode,
    val printerId: String,
    val printerSerial: String,
    val copies: Int,
    val reprintOf: String?,
    val reprintReason: ReprintReason?,
    val outcome: PrintOutcome,
    val refusalReason: RefusalReason?,
    /** SHA-256 of the rendered output, hex; null when nothing was rendered. */
    val outputSha256: String?,
    val recordedAt: Instant,
    val correlationId: String,
) {
    companion object {
        const val EVENT_TYPE: String = "print"
    }
}

/**
 * The DP-8 watermark: who printed, when, for which patient (spec §8.5). Part of the layout, so it is in the
 * golden images and fixtures. [printedAt] is formatted for display in the tenant's zone (default
 * Asia/Baghdad) with Western digits.
 */
data class Watermark(
    val userDisplayName: String,
    val staffId: String,
    val printedAt: Instant,
    val zoneId: String,
    val patientMrn: String?,
    val jobId: String,
    val reprintOf: String?,
)
