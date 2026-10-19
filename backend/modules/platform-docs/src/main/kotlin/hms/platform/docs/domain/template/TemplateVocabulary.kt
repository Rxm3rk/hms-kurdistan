package hms.platform.docs.domain.template

/**
 * The closed vocabulary templates use beyond [Binding]: the caption keys the engine knows and the bindings
 * each kind has (docs/specs/modules/platform-docs.md §3.3, §4.1, §4.3 rule 2).
 */
object CaptionKeys {
    const val MRN: String = "mrn"
    const val DOB: String = "dob"

    /** Printed only when the date of birth carries the approximate marker `~` (spec §3.2 R5). */
    const val APPROXIMATE: String = "approximate"
    const val ENCOUNTER: String = "encounter"
    const val SPECIMEN: String = "specimen"

    // The print banner of documents (spec §3.1; SI-16 on prints; DN-068 item 4). Captions, never literals.
    const val BANNER_ALLERGIES: String = "banner.allergies"
    const val BANNER_NKA: String = "banner.nka"
    const val BANNER_ALLERGIES_NOT_ASSESSED: String = "banner.allergiesNotAssessed"
    const val BANNER_ALLERGIES_UNAVAILABLE: String = "banner.allergiesUnavailable"
    const val BANNER_CODE_STATUS: String = "banner.codeStatus"
    const val BANNER_ISOLATION: String = "banner.isolation"
    const val BANNER_WEIGHT: String = "banner.weight"
    const val BANNER_UNAVAILABLE: String = "banner.unavailable"
    const val BANNER_PHOTO: String = "banner.photo"
    const val BANNER_PHOTO_ON_RECORD: String = "banner.photoOnRecord"
    const val BANNER_NO_PHOTO: String = "banner.noPhoto"

    /** Every caption a `document.banner` element may print; a template with that element needs all of them. */
    val BANNER: Set<String> =
        setOf(
            BANNER_ALLERGIES,
            BANNER_NKA,
            BANNER_ALLERGIES_NOT_ASSESSED,
            BANNER_ALLERGIES_UNAVAILABLE,
            BANNER_CODE_STATUS,
            BANNER_ISOLATION,
            BANNER_WEIGHT,
            BANNER_UNAVAILABLE,
            BANNER_PHOTO,
            BANNER_PHOTO_ON_RECORD,
            BANNER_NO_PHOTO,
        )
}

/** Which bindings each kind has (spec §4.3 rule 2) and which element type may carry each binding. */
object KindBindings {
    private val patientIdentity: Set<Binding> =
        setOf(
            Binding.IDENTITY_NAME_OWN,
            Binding.IDENTITY_NAME_LATIN,
            Binding.IDENTITY_MRN,
            Binding.IDENTITY_BIRTH_DATE,
            Binding.IDENTITY_SEX,
        )

    private val allowed: Map<TemplateKind, Set<Binding>> =
        mapOf(
            TemplateKind.WRISTBAND to
                patientIdentity +
                setOf(Binding.ENCOUNTER_ID, Binding.WATERMARK, Binding.NOTICE_SYNTHETIC, Binding.BARCODE_WRISTBAND),
            TemplateKind.SPECIMEN_LABEL to
                patientIdentity +
                setOf(
                    Binding.SPECIMEN_ID,
                    Binding.SPECIMEN_TYPE,
                    Binding.SPECIMEN_COLLECTED_AT,
                    Binding.SPECIMEN_TESTS,
                    Binding.WATERMARK,
                    Binding.NOTICE_SYNTHETIC,
                    Binding.BARCODE_SPECIMEN,
                ),
            TemplateKind.RECEIPT to
                patientIdentity +
                setOf(
                    Binding.RECEIPT_NUMBER,
                    Binding.RECEIPT_ISSUER,
                    Binding.RECEIPT_LINES,
                    Binding.RECEIPT_TOTALS,
                    Binding.RECEIPT_CASHIER,
                    Binding.RECEIPT_ISSUED_AT,
                    Binding.WATERMARK,
                    Binding.NOTICE_SYNTHETIC,
                ),
            // A token carries no patient data and therefore no watermark (spec §8.5).
            TemplateKind.TOKEN to
                setOf(Binding.TOKEN_NUMBER, Binding.TOKEN_SERVICE_POINT, Binding.TOKEN_ISSUED_AT, Binding.NOTICE_SYNTHETIC),
            TemplateKind.DOCUMENT to
                patientIdentity +
                setOf(
                    Binding.DOCUMENT_TITLE,
                    Binding.DOCUMENT_BODY,
                    Binding.DOCUMENT_BANNER,
                    Binding.WATERMARK,
                    Binding.NOTICE_SYNTHETIC,
                ),
        )

    /** Bindings that hold a list and print as rows ([Element.Rows]). */
    val ROW_BINDINGS: Set<Binding> = setOf(Binding.RECEIPT_LINES, Binding.RECEIPT_TOTALS, Binding.DOCUMENT_BANNER)

    /** Bindings that print as a barcode ([Element.Barcode]). */
    val BARCODE_BINDINGS: Set<Binding> = setOf(Binding.BARCODE_WRISTBAND, Binding.BARCODE_SPECIMEN)

    /**
     * Identifiers: Latin script, Western digits, forced left-to-right (spec §4.1, R4, R8). The date of birth
     * is not an R4 identifier but prints the same way.
     */
    val IDENTIFIER_TEXT: Set<Binding> =
        setOf(
            Binding.IDENTITY_MRN,
            Binding.IDENTITY_BIRTH_DATE,
            Binding.ENCOUNTER_ID,
            Binding.SPECIMEN_ID,
            Binding.RECEIPT_NUMBER,
        )

    /** The bindings a template of [kind] may use. */
    fun allowed(kind: TemplateKind): Set<Binding> = allowed[kind].orEmpty()

    /** True when the element's type may carry its binding (a barcode binding only on a barcode, and so on). */
    fun fitsElement(element: Element.Bound): Boolean =
        when (element) {
            is Element.Text -> element.bind !in ROW_BINDINGS && element.bind !in BARCODE_BINDINGS
            is Element.Rows -> element.bind in ROW_BINDINGS
            is Element.Barcode -> element.bind in BARCODE_BINDINGS
        }
}
