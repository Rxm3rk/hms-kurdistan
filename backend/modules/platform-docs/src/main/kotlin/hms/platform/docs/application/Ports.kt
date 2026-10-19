package hms.platform.docs.application

import hms.platform.docs.api.PrintCommand
import hms.platform.docs.domain.audit.PrintAuditRecord
import hms.platform.docs.domain.job.PrintJobEvent
import hms.platform.docs.domain.template.Template

/**
 * The ports of the print service (docs/specs/modules/platform-docs.md §8, §11). Adapters live in
 * `infrastructure`; until the Trust Plane (WP-0.4) and the cell (WP-0.2, WP-0.3) exist, the only adapters
 * are in-memory ones for tests, and production wiring refuses every print (spec §8.4, KA-077).
 */

/** The policy enforcement point for prints (AZ-1, SI-21). */
fun interface PrintPolicyPort {
    fun decide(command: PrintCommand): PolicyDecision
}

sealed interface PolicyDecision {
    /** Allowed, with the obligations the print must honour (SI-21, AZ-3, CTRL-0021-8). */
    data class Allowed(
        val obligations: Set<Obligation> = emptySet(),
    ) : PolicyDecision

    data class Denied(
        val detail: String,
    ) : PolicyDecision

    /** No policy decision point is reachable: the print is refused (fail closed). */
    data object Unavailable : PolicyDecision
}

/** What the policy decision point requires of an allowed print. */
sealed interface Obligation {
    /** Print the redacted form of every [hms.platform.docs.api.LabelledText] that carries one of [labels]. */
    data class RedactLabels(
        val labels: Set<String>,
    ) : Obligation
}

/** Every print outcome is audited as its own event type (§6.3, AU-1; spec §8.3). */
fun interface PrintAuditPort {
    fun record(record: PrintAuditRecord)
}

/** Publishes print-job events; the journal outbox adapter waits for WP-0.3 (KA-078). */
fun interface PrintEventPort {
    fun publish(event: PrintJobEvent)
}

/** Finds a template by id; the loader has already run the template linter. */
fun interface TemplateRepository {
    fun find(templateId: String): Template?
}

/** The document renderer satellite: HTML to PDF/A-2b (spec §7.5). */
fun interface DocumentRendererPort {
    fun render(request: RenderRequest): RenderOutcome
}

data class RenderRequest(
    val html: String,
    val title: String,
    val templateId: String,
    val templateVersion: Int,
    val templateHash: String,
    val provenance: String,
    val language: String,
    /** The fixed creation time written into the PDF (ISO 8601 with offset), for determinism. */
    val createdAt: String,
)

sealed interface RenderOutcome {
    data class Rendered(
        val pdf: ByteArray,
        val sha256: String,
        val pageCount: Int,
        val rendererIdentity: String,
    ) : RenderOutcome {
        override fun equals(other: Any?): Boolean =
            other is Rendered &&
                other.pdf.contentEquals(pdf) &&
                other.sha256 == sha256 &&
                other.pageCount == pageCount &&
                other.rendererIdentity == rendererIdentity

        override fun hashCode(): Int = pdf.contentHashCode()
    }

    data class Failed(
        val detail: String,
    ) : RenderOutcome
}

/** Issues job identifiers (UUIDv7 once the platform library exists, WP-0.3). */
fun interface JobIdSource {
    fun next(): String
}

/**
 * Checks an MRN's check digit with the identity service (SI-01 "MRN (with check digit)", CTRL-0001-7). The
 * identity service is WP-1.2; until then production wiring has no adapter and every patient print is refused
 * (fail closed). Tests use a synthetic adapter that accepts `SYN-` MRNs only.
 */
fun interface MrnCheckPort {
    fun check(mrn: String): MrnCheck
}

enum class MrnCheck { VALID, INVALID, UNAVAILABLE }
