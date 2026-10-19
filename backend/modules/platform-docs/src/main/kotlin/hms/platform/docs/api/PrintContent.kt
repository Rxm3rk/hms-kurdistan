package hms.platform.docs.api

import java.time.Instant

/*
 * The content of a print (docs/specs/modules/platform-docs.md §3.1). Text values arrive as display text
 * from their owning module and are placed unchanged: this module never parses, normalises or computes with
 * them (spec §2). Times arrive as instants and are formatted by this module (formatting is not arithmetic).
 *
 * There is deliberately no room, bed, ward or location field anywhere in this model: a location can never
 * fill an identifier slot (SI-01 clause b, CTRL-0001-4).
 */

/** The script a name form is written in. */
enum class Script { ARAB, LATN }

/**
 * The written forms a name can have (the design system's name forms, `docs/specs/modules/design-system.md`
 * §2.1 on `wp/0.7-design-system`, plus Badini in Arabic script for patient templates, §11.1).
 */
enum class NameForm(
    val locale: String,
    val script: Script,
) {
    CKB("ckb", Script.ARAB),
    AR("ar", Script.ARAB),
    KU_ARAB("ku-Arab", Script.ARAB),
    LATIN("en", Script.LATN),
}

/** The precision at which a date of birth was recorded (§9.1; CTRL-0001-7). */
enum class DatePrecision { DAY, MONTH, YEAR }

/**
 * A date of birth as recorded: [value] holds as many ISO 8601 parts as [precision] allows
 * (`YYYY-MM-DD`, `YYYY-MM` or `YYYY`), in Western digits. A placeholder day or month of an estimate is
 * never stored here, so it can never be printed (spec §3.2 R5).
 */
data class BirthDate(
    val value: String,
    val precision: DatePrecision,
    val approximate: Boolean,
)

/**
 * The patient as a print identifies them (SI-01): the name in the patient's own form, its Latin
 * transliteration, and the MRN plus the date of birth (or the approximate-DOB flag).
 */
data class PatientIdentity(
    /** Internal reference for audit only; never printed and never in an event payload. */
    val patientRef: String,
    /** Every recorded form of the name, whole (four-part names, aliases and newborn names included). */
    val names: Map<NameForm, String>,
    /** The form in the patient's own script (spec §3.1); for a patient whose own script is Latin, [NameForm.LATIN]. */
    val ownForm: NameForm?,
    /** True when the registrar confirmed the Latin transliteration (CTRL-0001-6). */
    val latinConfirmed: Boolean,
    /** The MRN exactly as the identity service issued it, check digit included (WP-1.2 owns the check). */
    val mrn: String?,
    val birthDate: BirthDate?,
    /** Display text from governed content, or null. */
    val sex: String? = null,
    /** Set by registration for a newborn; newborn names are never truncated (§12.8). */
    val newborn: Boolean = false,
    /** Set by registration for an unknown or alias patient (for example "Trauma Zulu-17", §9.1). */
    val alias: Boolean = false,
)

/**
 * Text that may carry SI-21 sensitivity labels (HIV, mental health, reproductive and sexual health,
 * gender-based violence, forensic/MLC, VIP). When the policy decision asks for it, [redactedText] (a coded
 * label from governed content) is printed instead of [text]; with no redacted form the print is refused.
 */
data class LabelledText(
    val text: String,
    val sensitivityLabels: Set<String> = emptySet(),
    val redactedText: String? = null,
)

/** Content of a wristband (§12.8): identity and encounter; alert slots stay reserved (OQ-238). */
data class WristbandContent(
    val identity: PatientIdentity,
    val encounterId: String?,
)

/** Content of a specimen label. */
data class SpecimenLabelContent(
    val identity: PatientIdentity,
    val specimenId: String?,
    val specimenType: LabelledText,
    val collectedAt: Instant,
    val tests: List<LabelledText>,
)

/** One line of a receipt; amounts are display strings from the owning module (§9.21 owns the arithmetic). */
data class ReceiptLine(
    val description: LabelledText,
    val amount: String,
)

/** Content of a cash receipt (80 mm ESC/POS, or PDF). */
data class ReceiptContent(
    val identity: PatientIdentity,
    val receiptNumber: String,
    val issuerLines: List<String>,
    val lines: List<ReceiptLine>,
    val totals: List<ReceiptLine>,
    val cashier: String,
    val issuedAt: Instant,
)

/** A queue token: no patient data (a token identifies a place in a queue, not a patient). */
data class TokenContent(
    val tokenNumber: String,
    val servicePoint: String,
    val issuedAt: Instant,
)

/** One allergy as recorded (substance, and reaction and severity where recorded), display text. */
data class PrintAllergy(
    val substance: String,
    val reaction: String?,
    val severity: String?,
)

/** The allergy field of the print banner: exactly one status; missing data is never shown as NKA. */
sealed interface PrintAllergies {
    data object NoKnownAllergies : PrintAllergies

    data object NotAssessed : PrintAllergies

    data class Listed(
        val items: List<PrintAllergy>,
    ) : PrintAllergies

    /** Missing, invalid or contradictory data: printed as "Allergy status unavailable", never as NKA. */
    data object Unavailable : PrintAllergies
}

/**
 * The print banner of a clinical document (SI-16 on prints; the fields of the screen banner of
 * `docs/specs/modules/design-system.md` §2.1 on `wp/0.7-design-system`). Each field is display text from
 * its owning module, or null when unavailable; a null field prints its "unavailable" text, never a default.
 */
data class PrintBanner(
    val allergies: PrintAllergies,
    val codeStatus: LabelledText?,
    val isolation: LabelledText?,
    /** The dated dosing weight as display text with unit, source and date (SI-05), or null. */
    val weight: String?,
    /**
     * Whether the registration photo exists. No photo is printed yet (OQ-239): the banner shows "Photo on
     * record (not printed)" or "No photo", never a statement that is false.
     */
    val photoOnRecord: Boolean,
)

/** A block of a document body. */
data class DocumentBlock(
    val heading: LabelledText?,
    val paragraphs: List<LabelledText>,
)

/** Content of an A4 or A5 document. */
data class DocumentContent(
    val identity: PatientIdentity,
    val banner: PrintBanner,
    val title: LabelledText,
    val blocks: List<DocumentBlock>,
)

/** Everything a print can carry, one case per template kind. */
sealed interface PrintContent {
    data class Wristband(
        val content: WristbandContent,
    ) : PrintContent

    data class SpecimenLabel(
        val content: SpecimenLabelContent,
    ) : PrintContent

    data class Receipt(
        val content: ReceiptContent,
    ) : PrintContent

    data class Token(
        val content: TokenContent,
    ) : PrintContent

    data class Document(
        val content: DocumentContent,
    ) : PrintContent
}
