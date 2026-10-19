package hms.orders.domain.order

import java.math.BigDecimal
import java.time.Duration
import java.time.Instant

// The facts the order machine's guard predicates read (docs/specs/state-machines/order.yaml; WP-0.5 spec
// docs/specs/modules/state-machines-and-invariants.md §3.1 "Facts, not aggregates"). Each value is what the order
// aggregate will know when it decides one command: the order and its orderable's governed flags, the issuer and their
// privileges, the server-side patient context, the CDS evaluation, the verbal-order record, the pharmacist's double
// check, the connectivity mode, the reason chosen and the server's clock reading. The aggregate that assembles them does
// not exist yet; until it does, the facts come from the generators in src/testFixtures (OrderArbs).
//
// Pure values: java.time and plain Kotlin only, no framework type, no system clock (time arrives as serverTime). A null
// means "not known" unless its KDoc says otherwise. SI-12: no field holds a bill, deposit, payment, pre-authorisation,
// coverage, counter or any other financial fact (order.yaml header; CTRL-0012-3, CTRL-0012-4).

/**
 * Everything the order machine's predicates read for one command (order.yaml; WP-0.5 spec §3.1).
 *
 * @property commandId The id of the command being decided (replacingOrderSignedTogether compares it).
 * @property serverTime The server's clock reading when it decides the command: its receipt time of the command. Every
 *   time comparison (licence expiry, SI-16 window, timers, stop date) uses it; client clocks never count.
 * @property issuer The principal who issues this command.
 * @property order The order this command acts on.
 * @property patient The patient facts the order's predicates read.
 * @property verbal The verbal or telephone order record; null when the order is not a verbal or telephone order.
 * @property identity The server-side patient context of the issuing session (SI-16).
 * @property issuedInMode The connectivity mode in which the user issued the command (from its offline envelope); null
 *   when unknown (SI-15).
 * @property cds The CDS evaluation for this command (the CDS registry's answer, SI-14).
 * @property calculations The control set A independent dose calculations recorded on the order, every one ever recorded
 *   (§10.3 A.1). The predicates select those recorded since the last submission.
 * @property coSign The co-sign requirement and any co-signature recorded before activation.
 * @property antimicrobialApprover The approver recorded for a restricted antimicrobial; null when none is recorded.
 * @property reason The reason the issuer gave with this command (hold, discontinue, return, response, entered in
 *   error, or the system reason "replaced"); null when none was given.
 * @property replacingOrder The replacing order a replacement Discontinue names; null when the command names none.
 * @property fulfilment The fulfilling module's report on the order's fulfilment.
 * @property configuration The governed configuration the predicates read.
 * @property auditWritable The audit record of a correction can be written with the command (false during an audit
 *   outage: the command is then refused, never run unaudited).
 */
data class OrderFacts(
    val commandId: String,
    val serverTime: Instant,
    val issuer: Actor,
    val order: OrderRecord,
    val patient: PatientFacts,
    val verbal: VerbalOrder?,
    val identity: IdentityContext,
    val issuedInMode: ConnectivityMode?,
    val cds: CdsEvaluation,
    val calculations: List<IndependentDose>,
    val coSign: CoSign,
    val antimicrobialApprover: Actor?,
    val reason: GivenReason?,
    val replacingOrder: ReplacingOrder?,
    val fulfilment: FulfilmentReport,
    val configuration: OrderConfiguration,
    val auditWritable: Boolean,
)

/** The kind of principal behind a command (§9.4; SI-07; DN-052 items 12 and 14). */
enum class PrincipalKind {
    /** A human user. */
    HUMAN,

    /** A system principal (for example ADT recording a death or discharge), authenticated as itself. */
    SYSTEM,

    /** An interface principal (an integration channel), authenticated as itself. */
    INTERFACE,

    /** A service principal: never signs, verifies, holds or discontinues an order (DN-052 item 12). */
    SERVICE,

    /** An AI agent: never signs, verifies, holds or discontinues an order (SI-07). */
    AI_AGENT,

    /** A migration loader: never signs an order. */
    MIGRATION_LOADER,
}

/** A staff role the baselines and the stewardship policy name (DN-052 items 14 and 16). */
enum class StaffRole {
    /** A prescriber (a practitioner who may order). */
    PRESCRIBER,

    /** A pharmacist. */
    PHARMACIST,

    /** A nurse. */
    NURSE,

    /** The antimicrobial-approval role of the stewardship policy (§10.3 C). */
    ANTIMICROBIAL_APPROVER,
}

/** What a registered system or interface principal is registered in governed configuration to do (DN-052 item 14). */
enum class SystemRegistration {
    /** Hold orders for a system reason. */
    HOLD_ORDERS,

    /** Discontinue orders for a system reason (for example the patient's death recorded by ADT). */
    DISCONTINUE_ORDERS,
}

/** The kind of a professional licence (§9.26). */
enum class LicenceKind {
    /** A practitioner (prescriber) licence. */
    PRACTITIONER,

    /** A pharmacist licence. */
    PHARMACIST,

    /** A nursing licence. */
    NURSE,
}

/**
 * A professional licence of record (§9.26).
 *
 * @property kind The licence's kind.
 * @property expiresAt Its expiry; null when unknown (an unknown expiry fails every check that needs a valid licence).
 */
data class Licence(
    val kind: LicenceKind,
    val expiresAt: Instant?,
)

/**
 * A principal: the command's issuer, a verbal order's source or receiver, a co-signer or an approver (Trust Plane
 * answers, WP-0.4; §9.26).
 *
 * @property userId The user's (or principal's) id; null when unknown.
 * @property kind The kind of principal; null when unknown (an unknown kind fails every predicate that reads it).
 * @property authenticatedForThisCommand For a human, authenticated for this signature or co-signature (§9.4
 *   authentication, intent and manifestation); for a system or interface principal, authenticated as itself.
 * @property licences The principal's licences of record.
 * @property privileges The privilege codes the principal holds at this hospital (§9.26; governed codes).
 * @property roles The principal's staff roles at this hospital.
 * @property onPatientCareTeam The principal is on the patient's care team (ADR-024).
 * @property registrations What a system or interface principal is registered to do (empty for every other principal).
 * @property registeredSystemReasons The system reason codes a system or interface principal is registered to give.
 */
data class Actor(
    val userId: String?,
    val kind: PrincipalKind?,
    val authenticatedForThisCommand: Boolean,
    val licences: List<Licence>,
    val privileges: Set<String>,
    val roles: Set<StaffRole>,
    val onPatientCareTeam: Boolean,
    val registrations: Set<SystemRegistration>,
    val registeredSystemReasons: Set<String>,
)

/** The order kinds of §9.5 (R11 §7.1). Set when the draft is created; it never changes. */
enum class OrderKind {
    /** A medication order (MedicationRequest): its orderable is a formulary medicine. */
    MEDICATION,

    /** A laboratory order. */
    LABORATORY,

    /** An imaging order. */
    IMAGING,

    /** A procedure order. */
    PROCEDURE,

    /** A nursing order. */
    NURSING,

    /** A diet order. */
    DIET,

    /** An activity order. */
    ACTIVITY,

    /** A consult. */
    CONSULT,

    /** A referral. */
    REFERRAL,

    /** A blood-product order. */
    BLOOD_PRODUCT,

    /** An isolation order. */
    ISOLATION,

    /** An ADT order. */
    ADT,

    /** A therapy order. */
    THERAPY,

    /** A respiratory order. */
    RESPIRATORY,

    /** A code-status order. */
    CODE_STATUS,
}

/** An order's priority (R11 §7 common order attributes). */
enum class OrderPriority {
    /** Routine. */
    ROUTINE,

    /** As soon as possible. */
    ASAP,

    /** Immediately. */
    STAT,
}

/**
 * A medication order's verification status (order.yaml header, the interface with medication-administration.yaml).
 * Absent for every other order kind, and for a medication order before its Sign.
 */
enum class VerificationStatus {
    /** Signed and waiting for the pharmacist (set by Sign and by Resubmit). */
    PENDING,

    /** Returned to the prescriber for any reason (Verify with a mismatch, or ReturnToPrescriber). */
    RETURNED,

    /** Verified by a pharmacist (set by Verify). */
    VERIFIED,
}

/** How an order's dose is expressed (§9.5; SI-05). */
enum class DoseBasis {
    /** The order carries no dose (most non-medication orders). */
    NOT_DOSED,

    /** An absolute dose. */
    ABSOLUTE,

    /** A dose per body weight. */
    PER_BODY_WEIGHT,

    /** A dose per body-surface area. */
    PER_BODY_SURFACE_AREA,
}

/**
 * A dose amount as entered: a single value, or a range with both bounds, in one UCUM unit. Only ever compared exactly,
 * never converted or calculated (§2.1 dose arithmetic clause b; SI-05).
 *
 * @property lower The single value, or the range's lower bound.
 * @property upper The range's upper bound; null for a single value.
 * @property unit The UCUM unit as entered (compared as an exact, case-sensitive string).
 */
data class DoseAmount(
    val lower: BigDecimal,
    val upper: BigDecimal?,
    val unit: String,
)

/**
 * A formulary medicine's governed flags (content [HUMAN]). Each null flag is unknown and counts as set wherever a
 * predicate reads it (DN-052 item 13). A medication order whose orderable has no formulary entry is read with every flag
 * unknown; the flags are not read for any other order kind.
 *
 * @property antineoplastic Flagged antineoplastic.
 * @property antimicrobial In the antimicrobial class.
 * @property restricted Restricted (stewardship control set C).
 * @property highAlert High-alert.
 * @property onEmergencyOverrideList On the governed emergency override list (null: unknown, which never relaxes a check).
 */
data class FormularyFlags(
    val antineoplastic: Boolean?,
    val antimicrobial: Boolean?,
    val restricted: Boolean?,
    val highAlert: Boolean?,
    val onEmergencyOverrideList: Boolean?,
)

/**
 * The order the command acts on, as the order aggregate holds it.
 *
 * @property orderId The order's id.
 * @property kind The order kind (never changes).
 * @property priority The order's priority; null when unknown (never read as STAT or ASAP).
 * @property createdAt When the draft was created.
 * @property createdBy The user who created the draft (for a cutover pre-build, the pharmacist who pre-built it); null
 *   when unknown.
 * @property prebuild The draft is a cutover pre-build "pending prescriber signature" (§21 row 3.13).
 * @property signerId The user who signed the order; null before Sign (or when unknown).
 * @property verificationStatus The medication order's verification status; null when absent.
 * @property returnedBy The user who last returned the order to the prescriber; null when never returned (or unknown).
 * @property lastSubmittedAt When the order was last submitted for verification (its Sign or latest Resubmit); null when
 *   unknown or never submitted.
 * @property formulary The orderable's formulary flags (medication orders); null when the orderable has no entry.
 * @property doseBasis How the dose is expressed.
 * @property orderedDose The absolute dose amount the prescriber entered; null when none was entered.
 * @property infusion The order is an infusion order.
 * @property prn The order is a PRN (as-needed) order.
 * @property indication The recorded indication; null or blank when none.
 * @property stopDate The order's stop date; null when none.
 * @property reviewDate The order's review date; null when none.
 * @property replaces The order this draft replaces (a DraftReplacement); null when it replaces none.
 * @property draftReview The draft review timer (SI-03 clause b).
 * @property holdReview The hold review timer (SI-03 clause b); null when the order is not held.
 */
data class OrderRecord(
    val orderId: String,
    val kind: OrderKind,
    val priority: OrderPriority?,
    val createdAt: Instant,
    val createdBy: String?,
    val prebuild: Boolean,
    val signerId: String?,
    val verificationStatus: VerificationStatus?,
    val returnedBy: String?,
    val lastSubmittedAt: Instant?,
    val formulary: FormularyFlags?,
    val doseBasis: DoseBasis,
    val orderedDose: DoseAmount?,
    val infusion: Boolean,
    val prn: Boolean,
    val indication: String?,
    val stopDate: Instant?,
    val reviewDate: Instant?,
    val replaces: ReplacedOrder?,
    val draftReview: DraftReviewTimer,
    val holdReview: HoldReviewTimer?,
)

/**
 * The order a replacement draft replaces (R11 §7.2 replaces; DN-052 item 10).
 *
 * @property state The replaced order's current state.
 * @property alreadyReplacedBySignedOrder Another signed order already replaces it.
 * @property discontinuePrivilege The governed discontinue privilege for the replaced order's kind (null: missing).
 */
data class ReplacedOrder(
    val state: OrderState,
    val alreadyReplacedBySignedOrder: Boolean,
    val discontinuePrivilege: StopPrivilege?,
)

/**
 * The replacing order a replacement Discontinue names (§9.5 one atomic order-sign transaction).
 *
 * @property replacesOrderId The order id its `replaces` link names; null when it carries none.
 * @property signedByCommandId The id of the command that signs it; null when it is not being signed.
 */
data class ReplacingOrder(
    val replacesOrderId: String?,
    val signedByCommandId: String?,
)

/**
 * The draft review timer (SI-03 clause b; DN-052 item 17).
 *
 * @property previousReviewDueAt The due time of the previous review; null when no review has fallen due yet (the
 *   first review is then due at the creation time plus the interval).
 * @property ownerTaskOpen An owner task for this review is open.
 */
data class DraftReviewTimer(
    val previousReviewDueAt: Instant?,
    val ownerTaskOpen: Boolean,
)

/**
 * The hold review timer (SI-03 clause b; DN-052 item 17).
 *
 * @property heldAt When the order was held.
 * @property issuerReviewAt The review time the issuer set on the hold; null when none.
 * @property previousReviewDueAt The due time of the previous review of this hold; null when none has fallen due.
 * @property reviewTaskOpen A review task for this hold is open.
 */
data class HoldReviewTimer(
    val heldAt: Instant,
    val issuerReviewAt: Instant?,
    val previousReviewDueAt: Instant?,
    val reviewTaskOpen: Boolean,
)

/** Where a dosing weight came from (R11 §15 item 3). */
enum class WeightSource {
    /** Measured. */
    MEASURED,

    /** Stated by the patient or family. */
    STATED,

    /** Estimated (for example in paediatric resuscitation). */
    ESTIMATED,
}

/**
 * The one dosing weight of record that SI-05 requires. Only its date and source are read: the weight is shown, never
 * used in a calculation.
 *
 * @property recordedAt When it was recorded; null when undated.
 * @property source Its source; null when unknown.
 */
data class DosingWeight(
    val recordedAt: Instant?,
    val source: WeightSource?,
)

/**
 * The patient facts the order's predicates read.
 *
 * @property dosingWeight The dosing weight of record; null when none.
 * @property neonatal The patient meets the governed neonatal definition (content [HUMAN]); null when unknown (counts as
 *   neonatal for control set A).
 */
data class PatientFacts(
    val dosingWeight: DosingWeight?,
    val neonatal: Boolean?,
)

/**
 * A verbal or telephone order (§9.5; R11 §7 on-behalf-of with read-back and co-sign due-by).
 *
 * @property source The practitioner who gave the order (the ordering practitioner).
 * @property receiver The user who received and entered it.
 * @property situationAllowed The governed verbal-order policy allows a verbal order in this situation (content [HUMAN]).
 * @property receivedAt When it was received; null when unknown.
 * @property readBack The recorded read-back; null when none.
 * @property coSignDueAt The co-sign due time; null when none is set.
 */
data class VerbalOrder(
    val source: Actor,
    val receiver: Actor,
    val situationAllowed: Boolean,
    val receivedAt: Instant?,
    val readBack: ReadBack?,
    val coSignDueAt: Instant?,
)

/**
 * A verbal order's recorded read-back (§9.5 "read-back captured with source and receiver").
 *
 * @property sourceId The source practitioner it records; null when missing.
 * @property receiverId The receiving user it records; null when missing.
 * @property at The time it records; null when missing.
 */
data class ReadBack(
    val sourceId: String?,
    val receiverId: String?,
    val at: Instant?,
)

/** An answer in the re-verification step (patient-context.yaml; DN-027). */
enum class ReverificationOutcome {
    /** The user confirmed the patient. */
    CONFIRMED,

    /** The user answered "Not this patient": the identity stays disputed. */
    NOT_THIS_PATIENT,
}

/**
 * A re-verification answer recorded by the server-side patient context.
 *
 * @property userId The user who answered; null when unknown.
 * @property outcome The answer.
 * @property recordedAt When the server recorded it; null when unknown (never counts as after a change).
 * @property forThisCommand It was recorded for this very command (the inline step of its dialog).
 */
data class ReverificationAnswer(
    val userId: String?,
    val outcome: ReverificationOutcome,
    val recordedAt: Instant?,
    val forThisCommand: Boolean,
)

/**
 * The server-side patient context of the issuing session (SI-16; DN-026, DN-027, DN-028; not built: KA-025).
 *
 * @property lastChangeAt The session's last patient-context change (any change of patient id, including from or to
 *   none) on the server's clock; null when unknown (always, until the server-side context exists).
 * @property tenantWindow The tenant's re-verification window; null when not set. Never read as less than 60 000 ms.
 * @property answers The re-verification answers of the session, in the order the server recorded them.
 */
data class IdentityContext(
    val lastChangeAt: Instant?,
    val tenantWindow: Duration?,
    val answers: List<ReverificationAnswer>,
)

/** The connectivity mode in which a command was issued (ADR-012; SI-15). */
enum class ConnectivityMode {
    /** The on-site cell is reachable. */
    ONLINE,

    /** The internet is lost; the on-site cell is reachable (still online, SI-15 last sentence). */
    INTERNET_LOST,

    /** The WAN is lost; the on-site cell is reachable (still online). */
    WAN_LOST,

    /** The on-site cell is lost (offline). */
    ON_SITE_CELL_LOST,

    /** Edge-agent mode (offline). */
    EDGE_AGENT,

    /** Mobile offline mode (offline). */
    MOBILE_OFFLINE,
}

/** What happened to one governed local hard-stop rule whose trigger matches the order (CTRL-0014-3). */
enum class LocalRuleOutcome {
    /** It ran and did not fire. */
    NOT_FIRED,

    /** It ran and fired: never overridable. */
    FIRED,

    /** It could not run (a runtime error). */
    COULD_NOT_RUN,
}

/**
 * The drug-KB dose rule's answer for this command (§10.3 A.2; §2.1 clause c; CTRL-0005-7, CTRL-0005-10).
 *
 * @property referenceUnit The unit of the ratio, flag or maximum the KB answered with; null when it gave none.
 * @property withinTimeBudget The answer arrived within its time budget.
 * @property tierAHardStopFired The rule fired its Tier A hard stop (the governed ≥10× threshold was met; the CDS
 *   runtime's comparison, never this domain's).
 */
data class KbAnswer(
    val referenceUnit: String?,
    val withinTimeBudget: Boolean,
    val tierAHardStopFired: Boolean,
)

/**
 * The drug-KB dose check for this command.
 *
 * @property covered A KB dose rule covers this order.
 * @property answer The KB's answer; null when it gave none (an outage or an error).
 */
data class KbDoseCheck(
    val covered: Boolean,
    val answer: KbAnswer?,
)

/** How an interruptive (Tier B) alert was answered (SI-14; §6.5). */
enum class AlertResolution {
    /** Not answered. */
    UNRESOLVED,

    /** Resolved by changing the order (the evaluation ran again). */
    RESOLVED_BY_CHANGE,

    /** Overridden (needs an override reason the user chose). */
    OVERRIDDEN,
}

/**
 * An interruptive (Tier B) alert the CDS evaluation for this command raised.
 *
 * @property resolution How it was answered.
 * @property overrideReason The override reason, for an overridden alert; null when none.
 */
data class TierBAlert(
    val resolution: AlertResolution,
    val overrideReason: GivenReason?,
)

/**
 * A CDS check recorded as unavailable on the order (recordCdsGaps).
 *
 * @property answeredWithoutFiring The check has since answered without firing in the evaluation for this command.
 * @property manualCheck The documented manual check recorded for it; null when none.
 */
data class CdsGap(
    val answeredWithoutFiring: Boolean,
    val manualCheck: ManualCheck?,
)

/**
 * A pharmacist's documented manual check of a CDS gap (the control set A pattern, §10.3 A.1).
 *
 * @property recordedBy The pharmacist who recorded it; null when unknown.
 * @property attested The pharmacist attested it.
 */
data class ManualCheck(
    val recordedBy: String?,
    val attested: Boolean,
)

/**
 * The CDS evaluation for this command (the CDS registry's answer; §9.6; SI-14; DN-052 item 8).
 *
 * @property localRules The outcome of every governed local hard-stop rule whose trigger matches this order; null when
 *   the local runtime returned no evaluation at all (read as rules that could not run).
 * @property kbDoseCheck The drug-KB dose check.
 * @property tierBAlerts The interruptive alerts raised.
 * @property gaps The CDS checks recorded as unavailable on the order.
 */
data class CdsEvaluation(
    val localRules: List<LocalRuleOutcome>?,
    val kbDoseCheck: KbDoseCheck,
    val tierBAlerts: List<TierBAlert>,
    val gaps: List<CdsGap>,
)

/**
 * A pharmacist's independently calculated dose (control set A, §10.3 A.1).
 *
 * @property recordedBy The pharmacist who recorded it; null when unknown.
 * @property recordedAt When it was recorded.
 * @property dose The dose as entered.
 * @property attestedMatches The pharmacist attested that it matches the order.
 */
data class IndependentDose(
    val recordedBy: String?,
    val recordedAt: Instant,
    val dose: DoseAmount,
    val attestedMatches: Boolean,
)

/**
 * A co-signature recorded before activation (R11 §10.2 "signed (and co-signed if required)").
 *
 * @property cosigner The co-signing practitioner.
 */
data class CoSignature(
    val cosigner: Actor,
)

/**
 * The co-sign requirement for this signer and orderable.
 *
 * @property requiredBeforeActivation A governed co-sign rule (content [HUMAN]) requires a co-signature before the order
 *   takes effect (DN-052 item 18).
 * @property coSignature The co-signature recorded; null when none.
 */
data class CoSign(
    val requiredBeforeActivation: Boolean,
    val coSignature: CoSignature?,
)

/**
 * A reason given with a command (§6.5: never defaulted).
 *
 * @property code The reason code; null when none.
 * @property freeText The free text given with it; null when none.
 * @property chosenByUser The channel adapter's mark that the user chose it (false for a default or a channel that
 *   cannot supply the mark).
 */
data class GivenReason(
    val code: String?,
    val freeText: String?,
    val chosenByUser: Boolean,
)

/** A dose's administration progress as the MAR reports it (medication-administration.yaml). */
enum class DoseProgress {
    /** Scheduled. */
    SCHEDULED,

    /** In progress (for example a running infusion). */
    IN_PROGRESS,

    /** In a terminal administration state. */
    TERMINAL,
}

/**
 * The MAR's report on a medication order's fulfilment.
 *
 * @property onceOnlyOrFixedCount The order is once-only or has a fixed number of doses.
 * @property lastScheduledDoseDueAt The due time of its last scheduled dose; null when unknown.
 * @property doses The progress of every dose of the order.
 */
data class MedicationFulfilment(
    val onceOnlyOrFixedCount: Boolean,
    val lastScheduledDoseDueAt: Instant?,
    val doses: List<DoseProgress>,
)

/** A result's state as the results module reports it (result.yaml). */
enum class ResultState {
    /** Registered, no value yet. */
    REGISTERED,

    /** Preliminary. */
    PRELIMINARY,

    /** Final. */
    FINAL,

    /** Amended. */
    AMENDED,

    /** Corrected. */
    CORRECTED,

    /** Cancelled. */
    CANCELLED,

    /** Entered in error. */
    ENTERED_IN_ERROR,
}

/**
 * The fulfilling module's report on the order's fulfilment (R11 §7.3 fulfilment as tasks). Each null part is an unknown
 * answer, which fails.
 *
 * @property medication The MAR's report, for a medication order.
 * @property diagnosticResults The result state of every requested item (null for an item with no result yet), for a
 *   laboratory or imaging order.
 * @property otherTasksDone The fulfilment tasks are done, for any other order.
 */
data class FulfilmentReport(
    val medication: MedicationFulfilment?,
    val diagnosticResults: List<ResultState?>?,
    val otherTasksDone: Boolean?,
)

/**
 * A governed stop privilege (DN-052 item 14).
 *
 * @property code The privilege code the configuration names.
 * @property grantedToAnyone The configuration names at least one holder. False reads as "names nobody", which brings in
 *   the vendor-locked baseline.
 */
data class StopPrivilege(
    val code: String,
    val grantedToAnyone: Boolean,
)

/**
 * The privilege a command requires on an order kind (§9.26; TRU-IAM-02).
 *
 * @property privilege The privilege code.
 * @property licence The licence the privilege needs; null when it needs no licensed role.
 */
data class CommandRequirement(
    val privilege: String,
    val licence: LicenceKind?,
)

/**
 * The governed configuration the predicates read (content [HUMAN]; samples are synthetic, NOT FOR CLINICAL USE). A
 * null privilege code or requirement is unknown and fails the predicate that needs it, except the stop privileges,
 * whose absence brings in the vendor-locked baseline (DN-052 item 14).
 *
 * @property orderingPrivilege The privilege the orderable requires of its ordering practitioner.
 * @property commandRequirement What this command requires on this order kind (actorPrivileged).
 * @property holdPrivilege The hold privilege for this order kind; null when the configuration is missing.
 * @property discontinuePrivilege The discontinue privilege for this order kind; null when the configuration is missing.
 * @property verificationPrivilege The pharmacist verification privilege (§9.10 MED-PHV-01).
 * @property enteredInErrorPrivilege The privilege to mark an order entered in error.
 * @property verbalReceiptPrivilege The privilege to receive verbal orders.
 * @property coSignLimit The governed limit from a verbal order's receipt to its co-sign due time.
 * @property offlineModesWithFullCds The offline modes the offline matrix lists with full CDS (ADR-012; today none).
 * @property holdReasons The governed hold reason codes.
 * @property discontinueReasons The governed discontinue reason codes.
 * @property returnReasons The governed pharmacist intervention (return) reason codes.
 * @property responseReasons The governed prescriber response reason codes.
 * @property errorReasons The governed entered-in-error reason codes.
 * @property draftReviewInterval The tenant's draft review interval; null when missing.
 * @property prebuildReviewInterval The tenant's (shorter) review interval for cutover pre-builds; null when missing.
 * @property holdReviewInterval The tenant's hold review interval; null when missing.
 * @property vendorDefaultReviewInterval The vendor default review interval, used for any missing or non-positive
 *   interval; never zero.
 */
data class OrderConfiguration(
    val orderingPrivilege: String?,
    val commandRequirement: CommandRequirement?,
    val holdPrivilege: StopPrivilege?,
    val discontinuePrivilege: StopPrivilege?,
    val verificationPrivilege: String?,
    val enteredInErrorPrivilege: String?,
    val verbalReceiptPrivilege: String?,
    val coSignLimit: Duration?,
    val offlineModesWithFullCds: Set<ConnectivityMode>,
    val holdReasons: Set<String>,
    val discontinueReasons: Set<String>,
    val returnReasons: Set<String>,
    val responseReasons: Set<String>,
    val errorReasons: Set<String>,
    val draftReviewInterval: Duration?,
    val prebuildReviewInterval: Duration?,
    val holdReviewInterval: Duration?,
    val vendorDefaultReviewInterval: Duration,
) {
    init {
        require(vendorDefaultReviewInterval > Duration.ZERO) { "the vendor default review interval is never zero (DN-052 item 17)" }
    }
}
