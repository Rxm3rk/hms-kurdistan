package hms.platform.docs.domain.layout

import hms.platform.docs.domain.audit.Watermark
import hms.platform.docs.domain.rules.PrintTime
import hms.platform.docs.domain.template.TemplateKind
import java.time.ZoneId

/**
 * The text of the DP-8 watermark (docs/specs/modules/platform-docs.md §8.5; DN-070, the stricter default). The
 * time is the injected print time in the tenant's zone, `YYYY-MM-DD HH:mm`, Western digits; nothing here reads
 * the clock, so fixtures and goldens are deterministic.
 *
 * - wristbands and specimen labels: the minimal mark `<job short id> <YYYY-MM-DD HH:mm>`, plus ` R` on a reprint;
 * - receipts and documents: the full line `<user> (<staff id>) · <time> · MRN <mrn> · Job <job id>`, plus
 *   ` · REPRINT of <original job id>` on a reprint (documents print it in the page footer, spec §7.4);
 * - tokens: none (no patient).
 *
 * "MRN", "Job", "REPRINT of" and "R" are language-independent marks like the `~` of an approximate date: the
 * watermark is the same in every label language.
 */
object WatermarkText {
    /** Characters of the job id the minimal mark shows (the end of the id: a UUIDv7's start is its timestamp). */
    const val SHORT_ID_LENGTH: Int = 8

    /** Appended to the minimal mark on a reprint. */
    const val REPRINT_MARK: String = "R"

    private const val SEPARATOR: String = " · "

    /** The watermark a print of [kind] carries, or null for a token. */
    fun forKind(
        kind: TemplateKind,
        watermark: Watermark,
        zone: ZoneId,
    ): String? =
        when (kind) {
            TemplateKind.WRISTBAND, TemplateKind.SPECIMEN_LABEL -> minimal(watermark, zone)
            TemplateKind.RECEIPT, TemplateKind.DOCUMENT -> full(watermark, zone)
            TemplateKind.TOKEN -> null
        }

    /** The minimal mark of wristbands and specimen labels. */
    fun minimal(
        watermark: Watermark,
        zone: ZoneId,
    ): String {
        val mark = "${shortId(watermark.jobId)} ${PrintTime.format(watermark.printedAt, zone)}"
        return if (watermark.reprintOf != null) "$mark $REPRINT_MARK" else mark
    }

    /** The full watermark line of receipts and documents. */
    fun full(
        watermark: Watermark,
        zone: ZoneId,
    ): String =
        listOfNotNull(
            "${watermark.userDisplayName} (${watermark.staffId})",
            PrintTime.format(watermark.printedAt, zone),
            watermark.patientMrn?.let { "MRN $it" },
            "Job ${watermark.jobId}",
            watermark.reprintOf?.let { "REPRINT of $it" },
        ).joinToString(SEPARATOR)

    /** The job's short id: the last [SHORT_ID_LENGTH] characters of the id with its hyphens removed. */
    fun shortId(jobId: String): String = jobId.replace("-", "").takeLast(SHORT_ID_LENGTH)
}
