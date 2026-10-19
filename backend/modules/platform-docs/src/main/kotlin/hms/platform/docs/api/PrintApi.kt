package hms.platform.docs.api

/*
 * The module API other modules use to print (docs/specs/modules/platform-docs.md §12). Business outcomes
 * are values, never exceptions (§6.2).
 */

/** The label language: captions and caption layout direction only, never the name forms (spec §3.3). */
enum class LabelLanguage(
    val tag: String,
    val rightToLeft: Boolean,
) {
    EN("en", rightToLeft = false),
    CKB("ckb", rightToLeft = true),
    AR("ar", rightToLeft = true),
}

/** The output a printer profile takes (spec §2, §7). */
enum class OutputMode {
    /** ZPL with `^PA` shaping and `^CI28` UTF-8; the printer shapes (Zebra V60.14.x/V50.14.x or later). */
    ZPL_TEXT,

    /** ZPL with the text rasterised by us into `^GF` bands; barcodes stay native `^BX` or `^BC`. */
    ZPL_RASTER,

    /** ESC/POS raster (`GS v 0`) for 80 mm receipt and token printers. */
    ESCPOS_RASTER,

    /** PDF/A-2b from the renderer satellite, for document printers and archives. */
    PDF,
}

/**
 * A printer as the print service sees it; the HAL's `hal.capabilities` and the printer registry will supply
 * it (KA-084). The identity fields key the first-band scan verification (spec §6).
 */
data class PrinterProfile(
    val printerId: String,
    val mode: OutputMode,
    /** Dots per millimetre: 8 (203 dpi), 12 (300 dpi), 24 (600 dpi), 7.087 (180 dpi) (spec §5.4); ignored for PDF. */
    val dotsPerMm: Double,
    /** The print head's width in dots; a template wider than this is refused (spec §7.6). Null when unknown. */
    val printheadWidthDots: Int? = null,
    /** ESC/POS printable width in dots (576 for 80 mm at 8 dots/mm); null for other modes. */
    val escposWidthDots: Int? = null,
    val model: String,
    val serial: String,
    val firmware: String,
    /** The loaded media in millimetres (width across the print head, length along the feed), or null if unknown. */
    val mediaWidthMm: Double? = null,
    val mediaLengthMm: Double? = null,
    /**
     * Font files resident on the printer for ZPL text mode with the SHA-256 of each as downloaded, for
     * example `E:NSARAB.TTF` → hash (spec §7.1). Text mode needs these to equal the pinned print fonts.
     */
    val residentFontSha256: Map<String, String> = emptyMap(),
    /**
     * True only when spike S7-K passed ZPL text mode for this model and firmware [HUMAN: printers]. Until
     * then identity text is rasterised (spec §7.1, a tightening).
     */
    val textModeVerifiedByS7k: Boolean = false,
)

/** Why a reprint is asked for (spec §8.6). */
enum class ReprintReason { LOST, DAMAGED, ILLEGIBLE, DETAILS_CHANGED, PRINTER_FAULT }

/**
 * The command context every command carries (§6.2). The tenant, facility, actor and purpose of use come
 * from the Trust Plane once it exists (WP-0.4); until then they are supplied by the caller.
 */
data class CommandContext(
    val tenantId: String,
    val facilityId: String,
    val actorId: String,
    val actorDisplayName: String,
    /** The staff identifier printed in the DP-8 watermark (spec §8.5). */
    val actorStaffId: String,
    val onBehalfOf: String?,
    val deviceId: String,
    val purposeOfUse: String,
    val idempotencyKey: String,
    val correlationId: String,
    /** The tenant's time zone for printed times (§4.1 default Asia/Baghdad). */
    val zoneId: String = "Asia/Baghdad",
)

/** A request to print one template with one content (spec §12). */
data class PrintCommand(
    val context: CommandContext,
    val templateId: String,
    val content: PrintContent,
    val language: LabelLanguage,
    val printer: PrinterProfile,
    val copies: Int,
    val reprintOf: String? = null,
    val reprintReason: ReprintReason? = null,
)

/** The result of a print command. */
sealed interface PrintResult {
    val jobId: String

    /** The output, ready for the HAL (`hal.print.label`, `hal.print.raw` or `hal.print.document`). */
    data class Rendered(
        override val jobId: String,
        val mediaType: String,
        val bytes: ByteArray,
        val sha256: String,
        val templateId: String,
        val templateVersion: Int,
        val templateHash: String,
        /** True when the first band after a template or printer change must be scan-verified (spec §6). */
        val scanVerificationRequired: Boolean,
    ) : PrintResult {
        override fun equals(other: Any?): Boolean =
            other is Rendered &&
                other.jobId == jobId &&
                other.mediaType == mediaType &&
                other.bytes.contentEquals(bytes) &&
                other.sha256 == sha256 &&
                other.templateId == templateId &&
                other.templateVersion == templateVersion &&
                other.templateHash == templateHash &&
                other.scanVerificationRequired == scanVerificationRequired

        override fun hashCode(): Int = 31 * jobId.hashCode() + bytes.contentHashCode()
    }

    /** No output; the refusal names the reason and the message key (spec §3.2). */
    data class Refused(
        override val jobId: String,
        val refusal: Refusal,
    ) : PrintResult
}

/** What the HAL reported for a print call (`docs/specs/hal/README.md` on `wp/0.7-design-system`). */
sealed interface HalPrintOutcome {
    /** `ok` with `status: sent`: the job reached the printer. */
    data object Sent : HalPrintOutcome

    /** `ok` with `status: completed`. */
    data object Completed : HalPrintOutcome

    /** An error; [outcomeUnknown] is the HAL's flag (true after a timeout or device error on a print call). */
    data class Error(
        val kind: String,
        val reason: String,
        val outcomeUnknown: Boolean,
    ) : HalPrintOutcome
}

/** Reports the HAL's outcome for a rendered job (spec §8.1, §12). */
data class ReportPrintOutcome(
    val context: CommandContext,
    val jobId: String,
    val outcome: HalPrintOutcome,
)

/** Verifies the first wristband printed on a new verification key (spec §6.3). */
data class VerifyFirstBand(
    val context: CommandContext,
    val jobId: String,
    /** The payload exactly as the scanner read it. */
    val scannedPayload: String,
    /** The user confirmed on screen that the printed name forms, MRN and date of birth match. */
    val visualMatchConfirmed: Boolean,
)

/** The result of [VerifyFirstBand]. */
sealed interface FirstBandResult {
    data object Verified : FirstBandResult

    /** The band is unusable and the key is blocked until a verified band exists. */
    data class Mismatch(
        val detail: String,
    ) : FirstBandResult

    /** No first-band verification is pending for this job. */
    data object NotPending : FirstBandResult
}

/** The result of [ReportPrintOutcome] (spec §8.1). */
sealed interface PrintOutcomeResult {
    /** The job moved to [state] (the name of a `PrintJobState`). */
    data class Updated(
        val jobId: String,
        val state: String,
    ) : PrintOutcomeResult

    /** The report does not apply: unknown job, a terminal state, or an outcome the state does not accept. */
    data class Rejected(
        val jobId: String,
        val detail: String,
    ) : PrintOutcomeResult

    /** The audit record of the outcome could not be written; the state is unchanged and the report may be repeated. */
    data class AuditUnavailable(
        val jobId: String,
    ) : PrintOutcomeResult
}

/** States that no band came out of a first wristband job whose outcome was unknown (spec §6.3). */
data class DeclareNoBandPrinted(
    val context: CommandContext,
    val jobId: String,
)

/** Resets a verification key blocked by a mismatch, after the mismatched band was removed (spec §6.3). */
data class ResetFirstBandKey(
    val context: CommandContext,
    val jobId: String,
    val mismatchedBandRemoved: Boolean,
    val reason: String,
)
