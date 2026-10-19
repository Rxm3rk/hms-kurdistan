package hms.platform.docs.application.testing

import hms.platform.docs.api.MrnCheck
import hms.platform.docs.api.PrintCommand
import hms.platform.docs.api.PrintContent
import hms.platform.docs.application.DocumentRendererPort
import hms.platform.docs.application.JobIdSource
import hms.platform.docs.application.MrnCheckPort
import hms.platform.docs.application.Obligation
import hms.platform.docs.application.PolicyDecision
import hms.platform.docs.application.PrintAuditPort
import hms.platform.docs.application.PrintEventPort
import hms.platform.docs.application.PrintPolicyPort
import hms.platform.docs.application.RenderOutcome
import hms.platform.docs.application.RenderRequest
import hms.platform.docs.domain.audit.PrintAuditRecord
import hms.platform.docs.domain.job.PrintJobEvent
import java.security.MessageDigest
import java.time.Clock
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset
import java.util.HexFormat

/*
 * TEST-ONLY adapters of the print service's ports (docs/specs/modules/platform-docs.md §3.2 R4a, §8.3, §8.4): they
 * exist so tests and the sample generator can print synthetic (SYN-) patients. Production wiring never uses them
 * (ProductionPrintWiring refuses every print). NOT FOR CLINICAL USE.
 */

/** A test-only policy that allows prints about synthetic (`SYN-`) patients only, and tokens (spec §8.4). */
class SyntheticPolicy(
    private val redactLabels: Set<String> = emptySet(),
) : PrintPolicyPort {
    override fun decide(command: PrintCommand): PolicyDecision {
        val patientRef =
            when (val content = command.content) {
                is PrintContent.Wristband -> content.content.identity.patientRef
                is PrintContent.SpecimenLabel -> content.content.identity.patientRef
                is PrintContent.Receipt -> content.content.identity.patientRef
                is PrintContent.Document -> content.content.identity.patientRef
                is PrintContent.Token -> null
            }
        val synthetic = patientRef == null || patientRef.startsWith("SYN-")
        return if (synthetic) {
            PolicyDecision.Allowed(
                setOfNotNull(redactLabels.takeIf { it.isNotEmpty() }?.let { Obligation.RedactLabels(it) }),
            )
        } else {
            PolicyDecision.Denied("the test policy allows synthetic patients only")
        }
    }
}

/**
 * A test-only MRN check that accepts synthetic (`SYN-`) MRNs only (KA-081); WP-1.2 owns the real check digit. The
 * sample generator also lists [alsoAccept]: its one synthetic digit-only MRN (spec §10 "a digit-only MRN").
 */
class SyntheticMrnCheck(
    private val alsoAccept: Set<String> = emptySet(),
) : MrnCheckPort {
    override fun check(mrn: String): MrnCheck = if (mrn.startsWith("SYN-") || mrn in alsoAccept) MrnCheck.VALID else MrnCheck.INVALID
}

/** An in-memory audit store; [failing] makes every write throw (spec §8.3). */
class InMemoryAudit : PrintAuditPort {
    val records: MutableList<PrintAuditRecord> = mutableListOf()
    var failing: Boolean = false

    override fun record(record: PrintAuditRecord) {
        check(!failing) { "the test audit store is failing" }
        records += record
    }
}

/** An in-memory event sink. */
class InMemoryEvents : PrintEventPort {
    val events: MutableList<PrintJobEvent> = mutableListOf()

    override fun publish(event: PrintJobEvent) {
        events += event
    }
}

/** Job ids `0192f3a4-7b1c-7def-8abc-00000000000N` (UUID-shaped, R4's alphabet, so they can be band serials). */
class SequentialJobIds(
    private var next: Int = 1,
) : JobIdSource {
    override fun next(): String = "0192f3a4-7b1c-7def-8abc-%012d".format(next++)
}

/** A fixed clock: 2026-10-19 14:05 in Asia/Baghdad. */
object FixedClock {
    val INSTANT: Instant = Instant.parse("2026-10-19T11:05:00Z")
    val ZONE: ZoneId = ZoneId.of("Asia/Baghdad")

    fun clock(): Clock = Clock.fixed(INSTANT, ZoneOffset.UTC)
}

/**
 * A test-only renderer that keeps every request and answers with a fixed synthetic "PDF" (or [failure]): for service
 * tests that check what is sent to the satellite without running it.
 */
class CapturingRenderer(
    var failure: RenderOutcome.Failed? = null,
) : DocumentRendererPort {
    val requests: MutableList<RenderRequest> = mutableListOf()

    override fun render(request: RenderRequest): RenderOutcome {
        requests += request
        val pdf = "%PDF-1.7 synthetic test output ${requests.size}".toByteArray()
        return failure ?: RenderOutcome.Rendered(pdf, HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(pdf)), 1, "test")
    }
}
