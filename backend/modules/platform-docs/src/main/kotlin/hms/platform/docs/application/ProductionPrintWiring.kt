package hms.platform.docs.application

import hms.platform.docs.api.MrnCheck
import hms.platform.docs.api.RefusalReason
import hms.platform.docs.infrastructure.fonts.FontRegistry
import hms.platform.docs.infrastructure.raster.Java2dLayoutRasteriser
import hms.platform.docs.infrastructure.template.YamlTemplateRepository
import hms.platform.docs.infrastructure.text.Java2dTextShaper
import java.nio.file.Path
import java.time.Clock
import java.util.UUID

/**
 * The print service as production wires it before the platform exists (docs/specs/modules/platform-docs.md §3.2 R4a,
 * §7.5, §8.3, §8.4; KA-077, KA-078, KA-083). There is no policy decision point (WP-0.4), no identity service to confirm
 * MRN check digits (WP-1.2), no BALP audit store (WP-0.4), no journal outbox (WP-0.3) and no renderer satellite (the
 * cell), so every adapter here refuses explicitly, never silently: **every production print is refused**
 * (`print.refused.policyUnavailable` first; a patient print would also meet `print.refused.mrnCheckFailed`, a document
 * `print.refused.rendererUnavailable`, and any output `print.refused.auditUnavailable`). Tests and the sample generator
 * use their own test-only adapters instead.
 */
object ProductionPrintWiring {
    /** No policy decision point until WP-0.4: every decision is `Unavailable` (fail closed, spec §8.4). */
    val policy: PrintPolicyPort = PrintPolicyPort { PolicyDecision.Unavailable }

    /** No identity service until WP-1.2: no MRN check digit can be confirmed (fail closed, R4a). */
    val mrnCheck: MrnCheckPort = MrnCheckPort { MrnCheck.UNAVAILABLE }

    /** No renderer satellite until the cell exists: every document print is refused (spec §7.5, KA-083). */
    val renderer: DocumentRendererPort =
        DocumentRendererPort {
            RenderOutcome.Failed("no renderer satellite in production until the cell exists (KA-083)", RefusalReason.RENDERER_UNAVAILABLE)
        }

    /** No BALP audit store until WP-0.4: every write fails, so no output can be returned (spec §8.3). */
    val audit: PrintAuditPort = PrintAuditPort { throw IllegalStateException("no audit store until WP-0.4 (KA-078)") }

    /** No journal outbox until WP-0.3: every publication fails and is counted (spec §8.2, KA-078). */
    val events: PrintEventPort = PrintEventPort { throw IllegalStateException("no event outbox until WP-0.3 (KA-078)") }

    /** The production print service over the templates in [templatesDir] (`content/print-templates`). */
    fun printService(
        templatesDir: Path,
        clock: Clock = Clock.systemUTC(),
    ): PrintService {
        val fonts = FontRegistry.fromClasspath()
        val shaper = Java2dTextShaper(fonts)
        return PrintService(
            PrintServicePorts(
                templates = YamlTemplateRepository.fromDirectory(templatesDir),
                policy = policy,
                mrnCheck = mrnCheck,
                audit = audit,
                events = events,
                renderer = renderer,
                shaper = shaper,
                rasteriser = Java2dLayoutRasteriser(shaper),
                fonts = fonts,
                clock = clock,
                // UUIDv7 once the platform library exists (WP-0.3); a random UUID until then.
                jobIds = JobIdSource { UUID.randomUUID().toString() },
            ),
        )
    }
}
