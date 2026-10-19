package hms.platform.docs.api

/**
 * Why a print is refused (docs/specs/modules/platform-docs.md §3.2, §8, §13). A refusal is a value, never
 * an exception (§6.2); it produces a `PrintJobRefused` event and an audit record, and the screen shows
 * the message key and the manual path. A print is never produced without the refused field.
 */
enum class RefusalReason(
    val messageKey: String,
) {
    /** R1: a patient print without the name or the second identifier. */
    IDENTIFIER_MISSING("print.refused.identifierMissing"),

    /** R3: the name in the patient's own script or its Latin transliteration is missing (CTRL-0001-6). */
    IDENTITY_INCOMPLETE("print.refused.identityIncomplete"),

    /** R4, R5: an identifier that is not printable as issued (MRN characters, date-of-birth form). */
    IDENTIFIER_INVALID("print.refused.identifierInvalid"),

    /** R6: identity text that does not fit at the minimum size and the maximum lines; never truncated. */
    IDENTITY_DOES_NOT_FIT("print.refused.identityDoesNotFit"),

    /** R7: a character with no glyph, a control character or a missing glyph after shaping. */
    UNRENDERABLE_TEXT("print.refused.unrenderableText"),

    /** The template failed the template linter (`TemplateLint`) or does not suit the content. */
    TEMPLATE_INVALID("print.refused.templateInvalid"),

    /** No policy decision point is available (WP-0.4): every production print is refused (spec §8.4). */
    POLICY_UNAVAILABLE("print.refused.policyUnavailable"),

    /** The policy decision point denied the print (purpose of use, care relationship, sensitivity labels). */
    POLICY_DENIED("print.refused.policyDenied"),

    /** A reprint without a reason (spec §8.6, DN-071). */
    REPRINT_REASON_REQUIRED("print.refused.reprintReasonRequired"),

    /** The printer profile cannot carry this output (for example ZPL text mode without resident fonts). */
    PRINTER_UNSUPPORTED("print.refused.printerUnsupported"),

    /** R8: Arabic-Indic or Extended Arabic-Indic digits in printed text (spec §3.2, §11.1). */
    EASTERN_DIGITS("print.refused.easternDigits"),

    /** The audit record could not be written; no output is returned (spec §8.3). */
    AUDIT_UNAVAILABLE("print.refused.auditUnavailable"),

    /** More copies than the kind allows (a wristband is one copy at a time, spec §8.6). */
    COPIES_NOT_ALLOWED("print.refused.copiesNotAllowed"),

    /** The document banner is taller than half the page (spec §7.4). */
    BANNER_TOO_TALL("print.refused.bannerTooTall"),

    /** The identity service could not confirm the MRN's check digit, or it is wrong (SI-01, CTRL-0001-7). */
    MRN_CHECK_FAILED("print.refused.mrnCheckFailed"),

    /** The loaded media does not match the template's media, or is unknown (spec §7.6, HAZ-0045). */
    MEDIA_MISMATCH("print.refused.mediaMismatch"),

    /** A wristband on a key whose first band still waits for scan verification (spec §6.3). */
    FIRST_BAND_PENDING("print.refused.firstBandPending"),

    /** The document renderer satellite is unavailable or failed; no PDF is produced. */
    RENDERER_UNAVAILABLE("print.refused.rendererUnavailable"),
}

/** A refusal with the element or field it concerns, for the audit record and the screen. */
data class Refusal(
    val reason: RefusalReason,
    /** The field or element concerned (a binding name such as `identity.name.latin`), or null. */
    val subject: String? = null,
    /** A short technical detail for the audit record; never identity text or label content. */
    val detail: String? = null,
)
