package hms.medications.domain.medicationadministration

import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * What the medication-administration aggregate knows when it decides a command for one scheduled dose: the only input
 * of [MedicationAdministrationGuards] (docs/specs/state-machines/medication-administration.yaml; WP-0.5 spec
 * docs/specs/modules/state-machines-and-invariants.md §3.1 "Facts, not aggregates").
 *
 * Knowledge time (DN-053 item 9). For a command issued online, the order, patient, formulary and privilege facts are the
 * server's state when it receives the command; for a command issued offline, they are the state the device or edge
 * agent held when the user issued it, from the command's offline envelope. The aggregate that assembles these facts does
 * not exist yet; until it does, the property tests draw them from `MedicationAdministrationArbs`.
 *
 * SI-12 (BUILD-PROMPT §2.1; CTRL-0012-3): the facts carry no payment, deposit, bill, pre-authorisation, counter or other
 * financial value, so no money rule can refuse or delay a dose. Time arrives as data; nothing here reads a clock.
 *
 * @property dose The dose instance itself.
 * @property order The dose's order (order.yaml states and verification status).
 * @property patient The dose's patient's identifiers as the record holds them.
 * @property actor The principal issuing the command.
 * @property context The command's receipt, envelope and audit availability.
 * @property scans The scans of the command's scan session and the dose's scan log.
 * @property entries What the user entered or chose in the command.
 * @property doubleCheck The independent double check recorded for this dose, if any (SI-13).
 * @property supplies The supply records the predicates bind a scanned or named supply to (SI-12 clauses d and e).
 * @property configuration Governed configuration and other modules' reference data (content [HUMAN]).
 */
data class MedicationAdministrationFacts(
    val dose: DoseFacts,
    val order: OrderFacts,
    val patient: PatientRecord,
    val actor: Actor,
    val context: CommandContext,
    val scans: CommandScans,
    val entries: CommandEntries,
    val doubleCheck: DoubleCheck?,
    val supplies: SupplyRecords,
    val configuration: GovernedConfiguration,
)

/**
 * The scheduled dose (§8.4 "per scheduled dose"; R11 §10.3).
 *
 * @property doseId The dose instance's identifier.
 * @property patientId The dose's patient.
 * @property unitId The patient's unit, whose ward stock list `patientSuppliedCleared` reads.
 * @property dueTime When the dose falls due.
 * @property lateDoseWindow The late-dose window fixed at creation from governed configuration or the vendor default the
 *   CSO sets; never zero by omission (DN-053 item 14).
 * @property flaggedLate Whether `LateDoseWindowElapsed` has already flagged this dose.
 * @property otherDoses The other doses of this order and of the orders in its `replaces` chain, read under the order's
 *   schedule serialisation (DN-053 item 4); null when that read could not be made.
 */
data class DoseFacts(
    val doseId: String,
    val patientId: String,
    val unitId: String,
    val dueTime: Instant,
    val lateDoseWindow: Duration,
    val flaggedLate: Boolean,
    val otherDoses: List<OtherDose>?,
)

/**
 * Another dose of the same order or of an order in its `replaces` chain (R11 §7), as `firstDoseOfOrder` reads it.
 *
 * @property doseId That dose's identifier.
 * @property orderId That dose's order.
 * @property state That dose's state in this machine.
 * @property administeredBeforeError For a dose in `entered-in-error`: whether it had been in-progress, completed or
 *   stopped before it was marked in error.
 */
data class OtherDose(
    val doseId: String,
    val orderId: String,
    val state: MedicationAdministrationState,
    val administeredBeforeError: Boolean,
)

/**
 * The dose's order: the orders module's answer, at the knowledge time above (order.yaml).
 *
 * @property orderId The order's identifier.
 * @property kind Medication or another kind; null when unknown.
 * @property patientId The order's patient; null when unknown.
 * @property state The order.yaml state; null when unknown.
 * @property verificationStatus The pharmacist verification status (order.yaml: pending, returned, verified); null when
 *   unknown or absent.
 * @property verifiedAt The pharmacist verification time; null when the order was never verified or the time is unknown.
 * @property replacesChain The orders this order replaces, directly or through earlier replacements (R11 §7 replaces).
 * @property orderableId The order's orderable; null when unknown.
 * @property carriesRate Whether the order carries a rate, which makes it an infusion order (MED-INF-01).
 * @property orderedDose The ordered dose; null when unknown.
 * @property orderedContent The ordered content of an infusion (amount and volume, or concentration); null when none.
 * @property verifiedProductLine The product line the pharmacist verified; null before verification.
 * @property orderableHighAlert The formulary high-alert flag of the orderable; null when unknown (SI-13: counts as set).
 */
data class OrderFacts(
    val orderId: String,
    val kind: OrderKind?,
    val patientId: String?,
    val state: OrderState?,
    val verificationStatus: VerificationStatus?,
    val verifiedAt: Instant?,
    val replacesChain: Set<String>,
    val orderableId: String?,
    val carriesRate: Boolean,
    val orderedDose: OrderedDose?,
    val orderedContent: InfusionContent?,
    val verifiedProductLine: VerifiedProductLine?,
    val orderableHighAlert: Boolean?,
)

/**
 * The verified product line of an order (§9.10 dispensing; DN-053 item 2).
 *
 * @property productIds The brand-master products the pharmacist verified for the order.
 * @property content The verified labelled content for an infusion (amount and volume, or concentration); null when none.
 */
data class VerifiedProductLine(
    val productIds: Set<String>,
    val content: InfusionContent?,
)

/**
 * The patient's identifiers as the record holds them (SI-01 clauses a and d; SAC-01, SAC-02).
 *
 * @property nameForms Every recorded name form (script and Latin transliteration).
 * @property dateOfBirth The recorded date of birth; null when none is recorded.
 * @property approximateDob Whether the record carries the approximate-DOB flag.
 */
data class PatientRecord(
    val nameForms: List<String>,
    val dateOfBirth: LocalDate?,
    val approximateDob: Boolean,
)

/**
 * The principal issuing the command: Trust Plane answers (§9.26), for an offline command as authenticated on the device.
 *
 * @property userId The principal's identifier.
 * @property principal The kind of principal; null when unknown.
 * @property authenticated Whether the principal is authenticated.
 * @property privileges The privileges the principal holds.
 * @property clinicalRoleAtFacility Whether the principal holds any clinical role at the facility.
 */
data class Actor(
    val userId: String,
    val principal: PrincipalKind?,
    val authenticated: Boolean,
    val privileges: Set<String>,
    val clinicalRoleAtFacility: Boolean,
)

/**
 * How and when the command reached the server.
 *
 * @property receivedAt The server's receipt time: the clock reading the predicates use (time arrives as data).
 * @property envelope The command's envelope from the issuing device or edge agent; null when absent.
 * @property auditWritable Whether the command's audit record can be written with it (an audit outage refuses it).
 */
data class CommandContext(
    val receivedAt: Instant,
    val envelope: IssueEnvelope?,
    val auditWritable: Boolean,
)

/**
 * The command's envelope (ADR-012; CTRL-0015-3; SI-10, SI-15).
 *
 * @property issuedAt The scan session's time on the issuing device: the dose's clinical time on the live paths; null when
 *   unknown.
 * @property mode The connectivity mode in which the user issued the command; null when unknown.
 * @property outageStart The start of the outage in which the command was issued, as the device or edge agent recorded it;
 *   null when unknown or when the command was issued online.
 * @property arrivedThroughSync Whether the command arrived through mobile or edge-agent sync.
 * @property deviceSignatureVerified Whether the envelope's device signature was verified (an authentic envelope).
 */
data class IssueEnvelope(
    val issuedAt: Instant?,
    val mode: ConnectivityMode?,
    val outageStart: Instant?,
    val arrivedThroughSync: Boolean,
    val deviceSignatureVerified: Boolean,
)

/**
 * The scans of the command's own scan session, the supply it names, and the dose's scan log (DN-053 item 3).
 *
 * @property wristband The command's wristband scan; null when none was read.
 * @property product The command's product scan; null when none was read.
 * @property namedSupply The supply the command names when no product scan identified one (the product-scan override).
 * @property log Every scan the command handler journaled for this dose, including those of refused commands and this one.
 */
data class CommandScans(
    val wristband: WristbandScan?,
    val product: ProductScan?,
    val namedSupply: NamedSupply?,
    val log: ScanLog,
)

/**
 * The dose's scan log.
 *
 * @property wristbandScans Every wristband (or other label) scan journaled for the dose.
 * @property productScans Every product scan journaled for the dose, with whether a pharmacist has since cleared it.
 */
data class ScanLog(
    val wristbandScans: List<WristbandScan>,
    val productScans: List<LoggedProductScan>,
)

/**
 * What the user entered or chose in the command. Each "chosen" mark is the channel adapter's: chosen by the user, never
 * prefilled, defaulted or carried over; a channel with no human chooser supplies none (SI-02 clause b; CTRL-0002-4).
 *
 * @property enteredAmount The amount given, as entered (SI-05 clause b).
 * @property overrideReason The override reason.
 * @property notDoneReason The not-done reason.
 * @property errorReason The entered-in-error reason.
 * @property manualIdentification The keyed two-identifier check (DN-053 item 5).
 * @property backEntry The back-entry record (SI-10 clauses b and c).
 * @property userEnteredClinicalTime A clinical time the user typed; the live paths take none (SI-10).
 */
data class CommandEntries(
    val enteredAmount: EnteredAmount?,
    val overrideReason: ChosenReason?,
    val notDoneReason: ChosenReason?,
    val errorReason: ChosenReason?,
    val manualIdentification: ManualIdentification?,
    val backEntry: BackEntry?,
    val userEnteredClinicalTime: Instant?,
)

/**
 * The independent double check recorded for a dose (SI-13; CTRL-0013-3, CTRL-0013-4; DN-053 item 12).
 *
 * @property doseId The dose the check names.
 * @property checkerUserId The second user.
 * @property checkerAuthenticated Whether the checker authenticated in their own right (badge and PIN).
 * @property checkerPrivileged Whether the checker holds the double-check privilege (a Trust Plane answer).
 * @property attested Whether the checker attested that patient, product and dose agree with the order.
 * @property productId The product the check names (the scanned product), if any.
 * @property lot The lot the check names, if any.
 * @property namedSupply The supply the check names on the product-scan override, if any.
 * @property recordedAt When the check was recorded.
 */
data class DoubleCheck(
    val doseId: String,
    val checkerUserId: String,
    val checkerAuthenticated: Boolean,
    val checkerPrivileged: Boolean,
    val attested: Boolean,
    val productId: String?,
    val lot: String?,
    val namedSupply: NamedSupply?,
    val recordedAt: Instant,
)

/**
 * The supply records a scanned or named supply is bound to (SI-12 clauses d and e; CTRL-0012-7, CTRL-0012-8).
 *
 * @property dispenseRecords Pharmacy dispense records.
 * @property patientSuppliedItems Patient-supplied items and their lifecycle stage (§9.10).
 * @property unitStockedProducts The products governed configuration lists as stocked on the patient's unit; null when the
 *   list is absent.
 */
data class SupplyRecords(
    val dispenseRecords: List<DispenseRecord>,
    val patientSuppliedItems: List<PatientSuppliedItem>,
    val unitStockedProducts: Set<String>?,
)

/**
 * Governed configuration and reference data (content [HUMAN]; the samples are synthetic, NOT FOR CLINICAL USE).
 *
 * @property administrationPrivilege The privilege required to administer the order's route and drug class; null when the
 *   requirement is unknown (fails, DN-053 item 13).
 * @property commandPrivilege The privilege required for this command where it needs one (entered in error, back-entry);
 *   null when unknown.
 * @property emergencyOverrideList The orderables on the emergency and first-dose override list (SAC-24); null when absent.
 * @property scanOverrideReasons The product-scan override reason codes; null when the list is absent.
 * @property verificationOverrideReasons The pre-verification override reason codes; null when absent.
 * @property identityOverrideReasons The wristband-failure override reason codes; null when absent.
 * @property errorReasons The entered-in-error reason codes (§6.5); null when absent.
 * @property doubleCheckWindow How long before the command a double check still counts; null when neither the tenant nor
 *   the vendor default sets one.
 * @property clockSkewAllowance The governed clock-skew allowance; null when missing (then zero).
 * @property facilityZone The facility's time zone, which turns the clinical time into the clinical date (lot expiry).
 * @property formulary The brand master and formulary entry of each product, by product identifier.
 */
data class GovernedConfiguration(
    val administrationPrivilege: String?,
    val commandPrivilege: String?,
    val emergencyOverrideList: Set<String>?,
    val scanOverrideReasons: Set<String>?,
    val verificationOverrideReasons: Set<String>?,
    val identityOverrideReasons: Set<String>?,
    val errorReasons: Set<String>?,
    val doubleCheckWindow: Duration?,
    val clockSkewAllowance: Duration?,
    val facilityZone: ZoneId,
    val formulary: Map<String, ProductEntry>,
)
