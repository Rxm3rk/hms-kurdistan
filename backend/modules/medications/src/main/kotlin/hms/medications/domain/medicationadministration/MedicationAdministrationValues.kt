package hms.medications.domain.medicationadministration

import java.math.BigDecimal
import java.time.Instant
import java.time.LocalDate

// Small value types of MedicationAdministrationFacts (docs/specs/state-machines/medication-administration.yaml). Pure
// values: no framework types and no clock. They move onto the WP-0.3 kernel types (Quantity, identifiers) when
// wp/0.3-platform-kernel is merged (KA-061).

/** The kind of an order, as far as this machine needs it. */
enum class OrderKind {
    /** A medication order. */
    MEDICATION,

    /** Any other order kind. */
    OTHER,
}

/** The states of order.yaml, as the orders module reports them for the dose's order. */
enum class OrderState {
    /** order.yaml `draft`. */
    DRAFT,

    /** order.yaml `pending-verification`. */
    PENDING_VERIFICATION,

    /** order.yaml `active`. */
    ACTIVE,

    /** order.yaml `on-hold`. */
    ON_HOLD,

    /** order.yaml `completed`. */
    COMPLETED,

    /** order.yaml `revoked` (discontinued or replaced). */
    REVOKED,

    /** order.yaml `entered-in-error`. */
    ENTERED_IN_ERROR,
}

/** The pharmacist verification status of a medication order (order.yaml: pending, returned, verified). */
enum class VerificationStatus {
    /** Awaiting verification, not returned. */
    PENDING,

    /** Returned to the prescriber for any reason. */
    RETURNED,

    /** Verified by a pharmacist. */
    VERIFIED,
}

/** The kind of principal issuing a command (§2.1 preamble: every channel, AI agents included). */
enum class PrincipalKind {
    /** A human user. */
    HUMAN,

    /** The system itself (a scheduler, a sync handler acting on its own). */
    SYSTEM,

    /** An interface (HL7, FHIR, device). */
    INTERFACE,

    /** The migration loader. */
    MIGRATION_LOADER,

    /** A plugin. */
    PLUGIN,

    /** An AI agent. */
    AI_AGENT,
}

/**
 * The connectivity mode in which a command was issued (ADR-012; SI-15). Losing the internet or the WAN alone leaves an
 * on-site cell online (SI-15 last sentence); only a lost on-site cell, edge-agent mode or mobile offline mode is offline.
 *
 * @property offline Whether the mode counts as offline for SI-15.
 */
enum class ConnectivityMode(
    val offline: Boolean,
) {
    /** Fully online. */
    ONLINE(false),

    /** The internet or the WAN is lost; the on-site cell is up. Online for SI-15. */
    INTERNET_OR_WAN_LOST(false),

    /** The on-site cell is lost. */
    ON_SITE_CELL_LOST(true),

    /** Edge-agent mode. */
    EDGE_AGENT(true),

    /** Mobile offline mode (offline BCMA, §9.10). */
    MOBILE_OFFLINE(true),
}

/** Where an identity scan was read from. Only a patient wristband identifies a patient (SI-01 clause b; CTRL-0001-4). */
enum class LabelKind {
    /** A patient wristband. */
    PATIENT_WRISTBAND,

    /** A bed label. */
    BED,

    /** A room label. */
    ROOM,

    /** A chart label. */
    CHART,

    /** Any other location label. */
    OTHER_LOCATION,
}

/**
 * The identity service's answer about one MRN (CTRL-0001-7; SI-08). Another module owns this answer (WP-0.5 spec §3.1).
 *
 * @property checkDigitValid Whether the MRN's check digit is valid.
 * @property patientId The patient the MRN belongs to, current or through a merge or retirement; null when none.
 * @property currentForPatient Whether the MRN is that patient's current MRN (false when merged or retired).
 */
data class MrnIdentity(
    val checkDigitValid: Boolean,
    val patientId: String?,
    val currentForPatient: Boolean,
)

/**
 * One identity scan.
 *
 * @property labelKind Where it was read from; null when unknown.
 * @property decodedMrn The MRN its barcode decoded; null when the barcode was unreadable or carried no MRN.
 * @property identity The identity service's answer about [decodedMrn]; null when there is none.
 */
data class WristbandScan(
    val labelKind: LabelKind?,
    val decodedMrn: String?,
    val identity: MrnIdentity?,
)

/** One product scan (§9.10 BCMA; DN-053 items 2 and 3). */
sealed interface ProductScan {
    /** The barcode could not be read. */
    data object Unreadable : ProductScan

    /**
     * The barcode was read but the brand master maps it to no product.
     *
     * @property code The code read.
     */
    data class NotMapped(
        val code: String,
    ) : ProductScan

    /**
     * The brand master identified a product (GTIN or in-house label).
     *
     * @property productId The identified product.
     * @property label What kind of label was scanned.
     * @property lot The lot, when the barcode or the stock record gives one.
     * @property expiry The lot's expiry date, when known.
     * @property scannedAt When it was scanned.
     */
    data class Identified(
        val productId: String,
        val label: ProductLabel,
        val lot: String?,
        val expiry: LocalDate?,
        val scannedAt: Instant,
    ) : ProductScan
}

/** The kind of label a product scan read (SI-12 clauses d and e). */
sealed interface ProductLabel {
    /** A manufacturer barcode (GTIN): it names a product, not a supply. */
    data object Manufacturer : ProductLabel

    /**
     * A pharmacy or in-house label naming a dispense record.
     *
     * @property dispenseRecordId The dispense record it names.
     */
    data class Dispense(
        val dispenseRecordId: String,
    ) : ProductLabel

    /**
     * The pharmacy relabel of a patient-supplied item (§9.10).
     *
     * @property itemId The patient-supplied item it names.
     * @property namedPatientId The patient it names.
     */
    data class PatientSuppliedRelabel(
        val itemId: String,
        val namedPatientId: String,
    ) : ProductLabel
}

/**
 * A product scan on the dose's scan log.
 *
 * @property scan The scan.
 * @property clearedByPharmacist Whether a pharmacist has since cleared it.
 */
data class LoggedProductScan(
    val scan: ProductScan,
    val clearedByPharmacist: Boolean,
)

/** The supply a command names when no product scan identified one (DN-053 item 11). */
sealed interface NamedSupply {
    /**
     * A dispense record.
     *
     * @property dispenseRecordId The record.
     */
    data class Dispense(
        val dispenseRecordId: String,
    ) : NamedSupply

    /**
     * Ward stock of a product.
     *
     * @property productId The product.
     */
    data class WardStock(
        val productId: String,
    ) : NamedSupply

    /**
     * A patient-supplied item (never accepted without the scan of its relabel).
     *
     * @property itemId The item.
     */
    data class PatientSupplied(
        val itemId: String,
    ) : NamedSupply
}

/**
 * A quantity with a UCUM unit, compared only exactly and only in the same unit (§2.1 SI-05 clause b; no conversion).
 *
 * @property value The number.
 * @property unit The UCUM unit, as written (case-sensitive).
 */
data class DoseQuantity(
    val value: BigDecimal,
    val unit: String,
)

/** The ordered dose: one value, or a range (DN-053 item 6). */
sealed interface OrderedDose {
    /**
     * One value with a unit.
     *
     * @property quantity The dose.
     */
    data class Fixed(
        val quantity: DoseQuantity,
    ) : OrderedDose

    /**
     * A range dose.
     *
     * @property minimum The lower bound.
     * @property maximum The upper bound.
     */
    data class Range(
        val minimum: DoseQuantity,
        val maximum: DoseQuantity,
    ) : OrderedDose
}

/** The labelled or ordered content of an infusion (MED-INF-01): amount and volume, or a concentration. */
sealed interface InfusionContent {
    /**
     * An amount in a volume.
     *
     * @property amount The amount of drug.
     * @property volume The volume.
     */
    data class AmountInVolume(
        val amount: DoseQuantity,
        val volume: DoseQuantity,
    ) : InfusionContent

    /**
     * A concentration.
     *
     * @property concentration The concentration, with its UCUM unit.
     */
    data class Concentration(
        val concentration: DoseQuantity,
    ) : InfusionContent
}

/**
 * The amount the user entered as given.
 *
 * @property quantity The amount.
 * @property enteredIntoEmptyField The channel adapter's mark that the field was empty, never prefilled with the ordered dose.
 */
data class EnteredAmount(
    val quantity: DoseQuantity,
    val enteredIntoEmptyField: Boolean,
)

/**
 * A reason the user chose.
 *
 * @property code The reason code.
 * @property chosenByUser The channel adapter's mark: chosen by the user, never prefilled, defaulted or carried over.
 * @property enteredBy The user who entered it.
 */
data class ChosenReason(
    val code: String,
    val chosenByUser: Boolean,
    val enteredBy: String,
)

/**
 * The keyed two-identifier check (B.3 twoIdentifiersConfirmed; DN-053 item 5; SAC-01, SAC-02).
 *
 * @property keyedMrn The MRN the user keyed.
 * @property keyedMrnIdentity The identity service's answer about [keyedMrn]; null when there is none.
 * @property keyedDateOfBirth The date of birth the user keyed; null when none.
 * @property approximateDobConfirmed Whether the user confirmed the approximate-DOB flag the record carries.
 * @property bannerShown The channel's mark that it showed the banner with the photo, every name form, the MRN and the
 *   date of birth at its recorded precision.
 */
data class ManualIdentification(
    val keyedMrn: String,
    val keyedMrnIdentity: MrnIdentity?,
    val keyedDateOfBirth: LocalDate?,
    val approximateDobConfirmed: Boolean,
    val bannerShown: Boolean,
)

/**
 * A back-entry of a dose given off the system (SI-10 clauses b and c; CTRL-0010-4, CTRL-0010-5; §16.3).
 *
 * @property paperRecordRef The downtime or paper record it references.
 * @property paperClinicalTime The clinical time on the paper; null when none.
 * @property paperPerformer The performer named on the paper.
 * @property reason The back-entry reason.
 * @property labelledBackEntry Whether the entry is labelled back-entry.
 */
data class BackEntry(
    val paperRecordRef: String,
    val paperClinicalTime: Instant?,
    val paperPerformer: String,
    val reason: ChosenReason?,
    val labelledBackEntry: Boolean,
)

/**
 * A pharmacy dispense record (§9.10 dispensing).
 *
 * @property dispenseRecordId The record.
 * @property patientId The patient it was dispensed for.
 * @property orderId The order it was dispensed for.
 * @property productIds The products it lists.
 * @property labelledContent The labelled content of a dispensed infusion; null when none.
 */
data class DispenseRecord(
    val dispenseRecordId: String,
    val patientId: String,
    val orderId: String,
    val productIds: Set<String>,
    val labelledContent: InfusionContent?,
)

/** The lifecycle of a patient-supplied medicine (§9.10; SI-12 clause e). */
enum class PatientSuppliedStage {
    /** Received from the patient or family. */
    RECEIVED,

    /** Identified. */
    IDENTIFIED,

    /** Expiry checked. */
    EXPIRY_CHECKED,

    /** Relabelled by pharmacy. */
    RELABELLED,

    /** Received, identified, expiry-checked, relabelled and flagged: administrable. */
    ADMINISTRABLE,

    /** Rejected; never administrable. */
    REJECTED,
}

/**
 * A patient-supplied item.
 *
 * @property itemId The item.
 * @property patientId The patient it belongs to.
 * @property productId The brand-master product it was identified as.
 * @property stage Its lifecycle stage.
 */
data class PatientSuppliedItem(
    val itemId: String,
    val patientId: String,
    val productId: String,
    val stage: PatientSuppliedStage,
)

/**
 * A product's brand-master and formulary entry (governed configuration).
 *
 * @property orderableId The orderable the governed brand-master mapping lists the product for (same drug, form and
 *   route); null when unmapped.
 * @property labelledContent The product's labelled content; null when none is recorded.
 * @property highAlert The product's formulary high-alert flag; null when unknown.
 */
data class ProductEntry(
    val orderableId: String?,
    val labelledContent: InfusionContent?,
    val highAlert: Boolean?,
)
