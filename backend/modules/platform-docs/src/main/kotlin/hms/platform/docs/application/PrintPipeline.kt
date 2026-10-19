package hms.platform.docs.application

import hms.platform.docs.api.MrnCheck
import hms.platform.docs.api.OutputMode
import hms.platform.docs.api.PrintCommand
import hms.platform.docs.api.PrintContent
import hms.platform.docs.api.Refusal
import hms.platform.docs.api.RefusalReason
import hms.platform.docs.api.ReprintReason
import hms.platform.docs.domain.audit.Watermark
import hms.platform.docs.domain.layout.Dots
import hms.platform.docs.domain.layout.Layout
import hms.platform.docs.domain.layout.LayoutEngine
import hms.platform.docs.domain.layout.LayoutOutcome
import hms.platform.docs.domain.layout.LayoutRequest
import hms.platform.docs.domain.layout.WatermarkText
import hms.platform.docs.domain.rules.ContentCheck
import hms.platform.docs.domain.rules.ContentRules
import hms.platform.docs.domain.rules.CopiesRule
import hms.platform.docs.domain.rules.MediaRule
import hms.platform.docs.domain.rules.PrintTime
import hms.platform.docs.domain.rules.ReprintRule
import hms.platform.docs.domain.rules.ResolvedContent
import hms.platform.docs.domain.template.Binding
import hms.platform.docs.domain.template.Element
import hms.platform.docs.domain.template.Symbology
import hms.platform.docs.domain.template.Template
import hms.platform.docs.domain.template.TemplateKind
import hms.platform.docs.domain.template.TemplateLint
import hms.platform.docs.domain.verification.BandAdmission
import hms.platform.docs.domain.verification.BandSubject
import hms.platform.docs.domain.verification.FirstBandState
import hms.platform.docs.domain.verification.VerificationKey
import hms.platform.docs.infrastructure.barcode.BarcodeEncoder
import hms.platform.docs.infrastructure.barcode.BarcodeEncoding
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.abs
import kotlin.math.max

/**
 * One print request as the pipeline works through it: the command, then what each step established. Every field a
 * later step reads is set by an earlier step that passed (a step that finds it unset is a programming error).
 */
internal class JobDraft(
    val jobId: String,
    val command: PrintCommand,
    val now: Instant,
) {
    val kind: TemplateKind = command.content.kind()
    var redactLabels: Set<String> = emptySet()
    var reprintOf: String? = command.reprintOf
    var reprintReason: ReprintReason? = command.reprintReason
    var bandSubject: BandSubject? = null
    var template: Template? = null
    var zone: ZoneId? = null
    var content: ResolvedContent? = null
    var layout: Layout? = null
    var dotsPerMm: Double = command.printer.dotsPerMm
    var mode: OutputMode = command.printer.mode
    var firstBand: FirstBandFacts? = null
    var output: OutputResult.Written? = null

    val reprint: Boolean get() = reprintOf != null

    fun template(): Template = checkNotNull(template) { "the template step has not run" }

    fun facts(): JobFacts {
        val printer = command.printer
        val template = template
        return JobFacts(
            jobId = jobId,
            tenantId = command.context.tenantId,
            facilityId = command.context.facilityId,
            correlationId = command.context.correlationId,
            templateId = template?.id ?: command.templateId,
            templateVersion = template?.version,
            templateHash = template?.contentHash,
            kind = kind,
            mode = mode,
            printerId = printer.printerId,
            printerSerial = printer.serial,
            copies = command.copies,
            reprintOf = reprintOf,
            reprintReason = reprintReason,
            patientRef = command.content.patientRef(),
        )
    }
}

/**
 * The checks and the writer of one print (docs/specs/modules/platform-docs.md §2, §3.2, §6.3, §7, §8;
 * `docs/specs/state-machines/print-job.yaml`), in order; the first that fails stops the print with its refusal and
 * nothing is written:
 *
 * 1. policy (§8.4): no decision point → `policyUnavailable`, denied → `policyDenied`; an allowed decision's redaction
 *    obligations go to the content rules (R10);
 * 2. the MRN check digit through [MrnCheckPort] (R4a, fail closed: an unavailable identity service refuses);
 * 3. copies and reprint (§8.6): a wristband is one copy; a reprint names the original and a reason;
 * 4. issued bands (wristbands): a second band for an issued patient and encounter is a reprint of it and needs a reason;
 * 5. the template: it exists, suits the content's kind and passes [TemplateLint]; the printer takes the kind's output;
 * 6. the media check (§7.6, fail closed);
 * 7. the content rules R1–R8, R10 (§3.2) and the layout with the fit rule at the printer's dots (§5; R6, R7, R9),
 *    with the DP-8 watermark (§8.5) and a Code 128 symbol no wider than its box (§4.3 rule 6);
 * 8. the output mode: ZPL text only on an S7-K-verified, provisioned printer with single-font lines (§7.1);
 * 9. first band (wristbands, §6.3): a key whose first band waits for verification, or is blocked, refuses
 *    (`firstBandPending`); an unknown key makes this band the first band;
 * 10. the writer by mode: ZPL text or raster, ESC/POS raster, or PDF through the renderer satellite. A writer that
 *     throws after every check passed is a render error (state `failed`).
 */
internal class PrintPipeline(
    ports: PrintServicePorts,
    state: PrintState,
) {
    private val checks = PrintChecks(ports, state)
    private val rendering = PrintRendering(ports, state)

    private val steps: List<(JobDraft) -> Stop?> =
        listOf(
            checks::policy,
            checks::mrn,
            checks::copiesAndReprint,
            checks::bands,
            checks::template,
            checks::media,
            checks::content,
            rendering::layout,
            rendering::modeAndFirstBand,
            rendering::write,
        )

    /** Runs every step; null when the draft holds the output, otherwise the stop. */
    fun run(draft: JobDraft): Stop? = steps.firstNotNullOfOrNull { step -> step(draft) }

    companion object {
        /** The outputs each kind has (spec §2). */
        val MODES: Map<TemplateKind, Set<OutputMode>> =
            mapOf(
                TemplateKind.WRISTBAND to setOf(OutputMode.ZPL_TEXT, OutputMode.ZPL_RASTER, OutputMode.PDF),
                TemplateKind.SPECIMEN_LABEL to setOf(OutputMode.ZPL_TEXT, OutputMode.ZPL_RASTER, OutputMode.PDF),
                TemplateKind.RECEIPT to setOf(OutputMode.ESCPOS_RASTER, OutputMode.PDF),
                TemplateKind.TOKEN to setOf(OutputMode.ESCPOS_RASTER),
                TemplateKind.DOCUMENT to setOf(OutputMode.PDF),
            )

        /** The PDF's creation time: the print time in the tenant's zone, to the second (the renderer contract's form). */
        val CREATED_AT: DateTimeFormatter = DateTimeFormatter.ofPattern("uuuu-MM-dd'T'HH:mm:ssXXX", Locale.ROOT)

        const val EPSILON_MM: Double = 1e-6
    }
}

/** Steps 1 to 7 of [PrintPipeline]: the checks before layout. */
internal class PrintChecks(
    private val ports: PrintServicePorts,
    private val state: PrintState,
) {
    fun policy(draft: JobDraft): Stop? {
        val decision =
            try {
                ports.policy.decide(draft.command)
            } catch (ignored: RuntimeException) {
                PolicyDecision.Unavailable
            }
        return when (decision) {
            PolicyDecision.Unavailable -> {
                stop(RefusalReason.POLICY_UNAVAILABLE, "policy", "no policy decision point (WP-0.4)")
            }

            is PolicyDecision.Denied -> {
                stop(RefusalReason.POLICY_DENIED, "policy", "denied by the policy decision point")
            }

            is PolicyDecision.Allowed -> {
                draft.redactLabels = decision.obligations.filterIsInstance<Obligation.RedactLabels>().flatMap { it.labels }.toSet()
                null
            }
        }
    }

    /** R4a: only a patient print with a recorded MRN is checked; a missing MRN is R1's refusal (content rules). */
    fun mrn(draft: JobDraft): Stop? {
        val mrn = draft.command.content.identity()?.mrn ?: return null
        val check =
            try {
                ports.mrnCheck.check(mrn)
            } catch (ignored: RuntimeException) {
                MrnCheck.UNAVAILABLE
            }
        return when (check) {
            MrnCheck.VALID -> null
            MrnCheck.INVALID -> stop(RefusalReason.MRN_CHECK_FAILED, Binding.IDENTITY_MRN.yamlName, "check digit not confirmed")
            MrnCheck.UNAVAILABLE -> stop(RefusalReason.MRN_CHECK_FAILED, Binding.IDENTITY_MRN.yamlName, "identity service unavailable")
        }
    }

    fun copiesAndReprint(draft: JobDraft): Stop? =
        (CopiesRule.check(draft.kind, draft.command.copies) ?: ReprintRule.check(draft.reprintOf, draft.reprintReason))
            ?.let { Stop(it) }

    /** Wristbands: the issued-band rule (spec §8.6). A missing encounter is R1's refusal (content rules). */
    fun bands(draft: JobDraft): Stop? {
        val wristband = (draft.command.content as? PrintContent.Wristband)?.content
        val encounter = wristband?.encounterId
        return if (wristband == null || encounter == null) null else admit(draft, BandSubject(wristband.identity.patientRef, encounter))
    }

    private fun admit(
        draft: JobDraft,
        subject: BandSubject,
    ): Stop? {
        draft.bandSubject = subject
        return when (val admission = state.issuedBands.admit(subject, draft.reprintOf, draft.reprintReason)) {
            BandAdmission.FirstBand -> {
                null
            }

            is BandAdmission.Reprint -> {
                draft.reprintOf = admission.reprintOf
                draft.reprintReason = admission.reason
                null
            }

            is BandAdmission.Refused -> {
                Stop(admission.refusal)
            }
        }
    }

    fun template(draft: JobDraft): Stop? {
        val template =
            try {
                ports.templates.find(draft.command.templateId)
            } catch (ignored: RuntimeException) {
                null
            }
        val findings = template?.let { TemplateLint.lint(it, ports.legibility) }.orEmpty()
        val subject = draft.command.templateId
        return when {
            template == null -> {
                stop(RefusalReason.TEMPLATE_INVALID, subject, "no such template")
            }

            template.kind != draft.kind -> {
                stop(RefusalReason.TEMPLATE_INVALID, subject, "the template is for ${template.kind.yamlName}")
            }

            findings.isNotEmpty() -> {
                stop(RefusalReason.TEMPLATE_INVALID, subject, "lint rule ${findings.first().rule}")
            }

            draft.command.printer.mode !in PrintPipeline.MODES.getValue(draft.kind) -> {
                val mode = draft.command.printer.mode
                stop(RefusalReason.PRINTER_UNSUPPORTED, "printer.mode", "${draft.kind.yamlName} has no $mode output")
            }

            else -> {
                draft.template = template
                null
            }
        }
    }

    fun media(draft: JobDraft): Stop? = MediaRule.check(draft.kind, draft.template().media, draft.command.printer)?.let { Stop(it) }

    fun content(draft: JobDraft): Stop? {
        val zone = PrintTime.zoneOrNull(draft.command.context.zoneId)
        draft.zone = zone
        return if (zone == null) {
            stop(RefusalReason.TEMPLATE_INVALID, "context.zoneId", "not a time zone")
        } else {
            when (val checked = ContentRules.check(draft.command.content, draft.redactLabels, zone)) {
                is ContentCheck.Refused -> {
                    Stop(checked.refusal)
                }

                is ContentCheck.Valid -> {
                    draft.content = checked.content
                    null
                }
            }
        }
    }
}

/** Steps 7 to 10 of [PrintPipeline]: layout, output mode, first band and the writer. */
internal class PrintRendering(
    private val ports: PrintServicePorts,
    private val state: PrintState,
) {
    private val engine = LayoutEngine(ports.shaper)
    private val zpl = ZplPrint(ports.fonts, ports.rasteriser)
    private val escPos = EscPosPrint(ports.rasteriser)
    private val pdf = PdfPrint(ports.renderer)

    fun layout(draft: JobDraft): Stop? {
        val template = draft.template()
        val printer = draft.command.printer
        // A PDF has no printer dots: it is laid out at the template's lowest resolution or the profile's, if higher.
        draft.dotsPerMm = if (printer.mode == OutputMode.PDF) max(template.media.minDotsPerMm, printer.dotsPerMm) else printer.dotsPerMm
        val request =
            LayoutRequest(
                template = template,
                content = checkNotNull(draft.content),
                language = draft.command.language,
                watermark = watermark(draft),
                dotsPerMm = draft.dotsPerMm,
                legibility = ports.legibility,
            )
        return when (val laid = engine.layout(request)) {
            is LayoutOutcome.Refused -> {
                Stop(laid.refusal)
            }

            is LayoutOutcome.Laid -> {
                draft.layout = laid.layout
                code128Width(template, laid.layout, draft.dotsPerMm)
            }
        }
    }

    /** The DP-8 watermark (spec §8.5): the printing user, the injected time, the printed MRN, the job, the reprint. */
    private fun watermark(draft: JobDraft): Watermark {
        val context = draft.command.context
        return Watermark(
            userDisplayName = context.actorDisplayName,
            staffId = context.actorStaffId,
            printedAt = draft.now,
            zoneId = context.zoneId,
            patientMrn = draft.content?.text(Binding.IDENTITY_MRN),
            jobId = draft.jobId,
            reprintOf = draft.reprintOf,
        )
    }

    /** A Code 128 symbol of whole-dot modules no wider than its template box (spec §4.3 rule 6, §6.2); never shrunk. */
    private fun code128Width(
        template: Template,
        layout: Layout,
        dotsPerMm: Double,
    ): Stop? =
        layout.barcodes.filter { it.symbology == Symbology.CODE128 }.firstNotNullOfOrNull { barcode ->
            val box =
                template.elements
                    .filterIsInstance<Element.Barcode>()
                    .firstOrNull { it.symbology == Symbology.CODE128 && abs(it.box.xMm - barcode.xMm) < PrintPipeline.EPSILON_MM }
                    ?.box
            val encoded = BarcodeEncoder.encode(barcode.payload, barcode.symbology) as? BarcodeEncoding.Encoded
            val widthDots = encoded?.let { it.matrix.columns * Dots.fromMm(barcode.moduleMm, dotsPerMm) }
            if (box == null || widthDots == null || widthDots > Dots.fromMm(box.wMm, dotsPerMm)) {
                stop(RefusalReason.TEMPLATE_INVALID, Binding.BARCODE_SPECIMEN.yamlName, "the Code 128 symbol is wider than its box")
            } else {
                null
            }
        }

    /** The output mode (spec §7.1), then the first-band rule on the key of that mode (spec §6.3). */
    fun modeAndFirstBand(draft: JobDraft): Stop? {
        val printer = draft.command.printer
        val layout = checkNotNull(draft.layout)
        if (draft.kind == TemplateKind.WRISTBAND || draft.kind == TemplateKind.SPECIMEN_LABEL) {
            draft.mode = if (printer.mode == OutputMode.PDF) OutputMode.PDF else zpl.mode(printer, layout)
        }
        return if (draft.kind == TemplateKind.WRISTBAND) firstBand(draft, layout) else null
    }

    private fun firstBand(
        draft: JobDraft,
        layout: Layout,
    ): Stop? {
        val template = draft.template()
        val key = VerificationKey.of(template.id, template.version, template.contentHash, draft.command.printer.copy(mode = draft.mode))
        val payload = layout.barcodes.firstOrNull { it.symbology == Symbology.DATAMATRIX }?.payload
        return when (state.firstBands.stateOf(key)) {
            FirstBandState.PENDING -> {
                stop(RefusalReason.FIRST_BAND_PENDING, "firstBand", "the first band on this printer and template waits for its scan")
            }

            FirstBandState.BLOCKED -> {
                stop(RefusalReason.FIRST_BAND_PENDING, "firstBand", "the first band did not match; remove it and reset before printing")
            }

            FirstBandState.REQUIRED -> {
                if (payload == null) {
                    stop(RefusalReason.TEMPLATE_INVALID, Binding.BARCODE_WRISTBAND.yamlName, "no band payload to verify")
                } else {
                    draft.firstBand = FirstBandFacts(key, payload)
                    null
                }
            }

            FirstBandState.VERIFIED -> {
                null
            }
        }
    }

    fun write(draft: JobDraft): Stop? {
        val result =
            try {
                output(draft)
            } catch (ignored: RuntimeException) {
                OutputResult.Stopped(Stop(Refusal(RefusalReason.RENDERER_UNAVAILABLE, "writer", "render error"), renderError = true))
            }
        return when (result) {
            is OutputResult.Stopped -> {
                result.stop
            }

            is OutputResult.Written -> {
                draft.output = result
                draft.mode = result.mode
                null
            }
        }
    }

    private fun output(draft: JobDraft): OutputResult {
        val layout = checkNotNull(draft.layout)
        val template = draft.template()
        val zone = checkNotNull(draft.zone)
        return when (draft.mode) {
            OutputMode.ZPL_TEXT, OutputMode.ZPL_RASTER -> {
                zpl.write(layout, draft.mode, draft.dotsPerMm, draft.reprint)
            }

            OutputMode.ESCPOS_RASTER -> {
                escPos.write(layout, template, draft.command.printer, draft.dotsPerMm)
            }

            OutputMode.PDF -> {
                val createdAt = PrintPipeline.CREATED_AT.format(draft.now.atZone(zone))
                val watermark = WatermarkText.full(watermark(draft), zone)
                val content = checkNotNull(draft.content)
                pdf.write(PdfJob(template, layout, content, draft.command.language, watermark, draft.reprint, createdAt))
            }
        }
    }
}

/** A stop with a refusal for [reason]. */
internal fun stop(
    reason: RefusalReason,
    subject: String,
    detail: String,
): Stop = Stop(Refusal(reason, subject, detail))

/** The template kind a content is for. */
internal fun PrintContent.kind(): TemplateKind =
    when (this) {
        is PrintContent.Wristband -> TemplateKind.WRISTBAND
        is PrintContent.SpecimenLabel -> TemplateKind.SPECIMEN_LABEL
        is PrintContent.Receipt -> TemplateKind.RECEIPT
        is PrintContent.Token -> TemplateKind.TOKEN
        is PrintContent.Document -> TemplateKind.DOCUMENT
    }

/** The patient a content is about, or null for a token. */
internal fun PrintContent.identity() =
    when (this) {
        is PrintContent.Wristband -> content.identity
        is PrintContent.SpecimenLabel -> content.identity
        is PrintContent.Receipt -> content.identity
        is PrintContent.Token -> null
        is PrintContent.Document -> content.identity
    }

internal fun PrintContent.patientRef(): String? = identity()?.patientRef
