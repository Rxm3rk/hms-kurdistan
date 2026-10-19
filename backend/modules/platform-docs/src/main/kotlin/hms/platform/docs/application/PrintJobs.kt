package hms.platform.docs.application

import hms.platform.docs.api.CommandContext
import hms.platform.docs.api.OutputMode
import hms.platform.docs.api.RefusalReason
import hms.platform.docs.api.ReprintReason
import hms.platform.docs.domain.audit.PrintAuditRecord
import hms.platform.docs.domain.audit.PrintOutcome
import hms.platform.docs.domain.job.PrintJobEvent
import hms.platform.docs.domain.job.PrintJobHeader
import hms.platform.docs.domain.job.PrintJobState
import hms.platform.docs.domain.template.TemplateKind
import hms.platform.docs.domain.verification.BandSubject
import hms.platform.docs.domain.verification.VerificationKey
import java.time.Clock
import java.util.concurrent.atomic.AtomicLong

/**
 * What the print service knows about a job (docs/specs/modules/platform-docs.md §8.1 to §8.3): the identifiers every
 * audit record and event carries. [patientRef] goes into audit records only, never into an event (SI-20).
 */
internal data class JobFacts(
    val jobId: String,
    val tenantId: String,
    val facilityId: String,
    val correlationId: String,
    val templateId: String,
    val templateVersion: Int?,
    val templateHash: String?,
    val kind: TemplateKind,
    val mode: OutputMode,
    val printerId: String,
    val printerSerial: String,
    val copies: Int,
    val reprintOf: String?,
    val reprintReason: ReprintReason?,
    val patientRef: String?,
)

/** A wristband job admitted as the first band on its verification key (spec §6.3). */
internal data class FirstBandFacts(
    val key: VerificationKey,
    val expectedPayload: String,
)

/** Where a first-band job stands on its key (kept beside the domain's [hms.platform.docs.domain.verification.FirstBandVerification]). */
internal enum class FirstBandStatus {
    /** Admitted as the first band; waits for its scan. */
    PENDING,

    /** Its outcome is unknown: it may have printed; the user verifies it or declares that no band came out. */
    PENDING_OUTCOME_UNKNOWN,
    VERIFIED,

    /** The scan did not match: the key is blocked until the band is removed and the key reset. */
    BLOCKED,

    /** Refused, failed, declared not printed or reset: the key's next band is a first band again. */
    RELEASED,
}

/** One job in the in-memory job store (persistence waits for the cell, KA-077). */
internal class JobRecord(
    val facts: JobFacts,
    var state: PrintJobState,
    /** The issued-band subject of a wristband job, so a job with nothing printed can withdraw its band. */
    val bandSubject: BandSubject? = null,
    /** Set when this job is its key's first band (spec §6.3). */
    val firstBand: FirstBandFacts? = null,
) {
    var firstBandStatus: FirstBandStatus? = firstBand?.let { FirstBandStatus.PENDING }
}

/** PHI-free counters of what could not be recorded (spec §8.3: a refusal for audit failure is counted, not audited). */
class PrintServiceMetrics {
    /** Audit writes that failed (each such print was refused, or its outcome report left the state unchanged). */
    val auditFailures: AtomicLong = AtomicLong()

    /** Events the event port did not take (publication through the outbox waits for WP-0.3, KA-078). */
    val eventFailures: AtomicLong = AtomicLong()
}

/**
 * Writes audit records and publishes events for the print service (spec §8.2, §8.3). A port that throws is a failed
 * write: [audit] returns false and the caller decides (a print is refused, an outcome report changes nothing); an event
 * that cannot be published is counted and never blocks a print. Nothing here logs: a record holds the patient
 * reference and the output's SHA-256, which never go to logs (SI-20, CTRL-0020-7).
 */
internal class PrintRecorder(
    private val auditPort: PrintAuditPort,
    private val eventPort: PrintEventPort,
    private val clock: Clock,
    val metrics: PrintServiceMetrics,
) {
    /** Writes one `print` audit record for [facts] by the actor of [context]; false when the write failed. */
    fun audit(
        context: CommandContext,
        facts: JobFacts,
        outcome: PrintOutcome,
        refusal: RefusalReason? = null,
        outputSha256: String? = null,
    ): Boolean {
        val record =
            PrintAuditRecord(
                jobId = facts.jobId,
                tenantId = facts.tenantId,
                facilityId = facts.facilityId,
                actorId = context.actorId,
                onBehalfOf = context.onBehalfOf,
                deviceId = context.deviceId,
                purposeOfUse = context.purposeOfUse,
                patientRef = facts.patientRef,
                templateId = facts.templateId,
                templateVersion = facts.templateVersion,
                templateHash = facts.templateHash,
                mode = facts.mode,
                printerId = facts.printerId,
                printerSerial = facts.printerSerial,
                copies = facts.copies,
                reprintOf = facts.reprintOf,
                reprintReason = facts.reprintReason,
                outcome = outcome,
                refusalReason = refusal,
                outputSha256 = outputSha256,
                recordedAt = clock.instant(),
                correlationId = context.correlationId,
            )
        return try {
            auditPort.record(record)
            true
        } catch (ignored: RuntimeException) {
            // Any failure of the audit adapter is a failed write (fail closed, spec §8.3). Its message may quote the
            // record, so it is not kept.
            metrics.auditFailures.incrementAndGet()
            false
        }
    }

    /** Publishes [event]; a failure is counted and never stops the print. */
    fun publish(event: PrintJobEvent) {
        try {
            eventPort.publish(event)
        } catch (ignored: RuntimeException) {
            // Any failure of the event adapter is counted (spec §8.2; the outbox is WP-0.3).
            metrics.eventFailures.incrementAndGet()
        }
    }

    /** The event header of [facts]: identifiers and the template version, never a patient reference (SI-20). */
    fun header(facts: JobFacts): PrintJobHeader =
        PrintJobHeader(
            jobId = facts.jobId,
            tenantId = facts.tenantId,
            facilityId = facts.facilityId,
            templateId = facts.templateId,
            templateVersion = facts.templateVersion,
            templateHash = facts.templateHash,
            mode = facts.mode,
            printerId = facts.printerId,
            copies = facts.copies,
            reprintOf = facts.reprintOf,
            reprintReason = facts.reprintReason,
            correlationId = facts.correlationId,
            occurredAt = clock.instant(),
        )
}

/** The audit outcome of a job state (spec §8.3). */
internal fun PrintJobState.auditOutcome(): PrintOutcome =
    when (this) {
        PrintJobState.REQUESTED, PrintJobState.REFUSED -> PrintOutcome.REFUSED
        PrintJobState.RENDERED -> PrintOutcome.RENDERED
        PrintJobState.DISPATCHED -> PrintOutcome.DISPATCHED
        PrintJobState.COMPLETED -> PrintOutcome.COMPLETED
        PrintJobState.FAILED -> PrintOutcome.FAILED
        PrintJobState.OUTCOME_UNKNOWN -> PrintOutcome.OUTCOME_UNKNOWN
    }
