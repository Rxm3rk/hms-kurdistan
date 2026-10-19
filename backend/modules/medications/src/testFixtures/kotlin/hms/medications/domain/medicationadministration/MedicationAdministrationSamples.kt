package hms.medications.domain.medicationadministration

import java.math.BigDecimal
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * Synthetic sample facts for the medication-administration machine: the base the unit tests and
 * [MedicationAdministrationArbs] vary (docs/specs/state-machines/medication-administration.yaml). Every identifier is
 * `SYN-`; every dose, content, window, list and privilege is synthetic, NOT FOR CLINICAL USE (BUILD-PROMPT §3.4 item 3,
 * §3.5). Governed values (lists, windows, privileges) are content [HUMAN]; these stand in for them.
 *
 * [give] is a dose for which every predicate of the normal give holds, and so do the override reason, the not-done
 * reason, the back-entry, the correction and the keyed identifiers; [infusion] is the same dose of an infusion order.
 */
object MedicationAdministrationSamples {
    const val PATIENT: String = "SYN-PAT-0001"
    const val OTHER_PATIENT: String = "SYN-PAT-0002"
    const val DOSE: String = "SYN-DOSE-0001"
    const val OTHER_DOSE: String = "SYN-DOSE-0002"
    const val ORDER: String = "SYN-ORD-0001"
    const val REPLACED_ORDER: String = "SYN-ORD-0000"
    const val UNRELATED_ORDER: String = "SYN-ORD-0099"
    const val ORDERABLE: String = "SYN-ORDERABLE-0001"
    const val OTHER_ORDERABLE: String = "SYN-ORDERABLE-0009"
    const val PRODUCT: String = "SYN-PROD-0001"
    const val WARD_PRODUCT: String = "SYN-PROD-0002"
    const val OTHER_PRODUCT: String = "SYN-PROD-0009"
    const val UNLISTED_PRODUCT: String = "SYN-PROD-0404"
    const val LOT: String = "SYN-LOT-0001"
    const val MRN: String = "SYN-MRN-0001"
    const val FORMER_MRN: String = "SYN-MRN-0000"
    const val OTHER_MRN: String = "SYN-MRN-0002"
    const val NURSE: String = "SYN-USER-NURSE-1"
    const val CHECKER: String = "SYN-USER-NURSE-2"
    const val PAPER_PERFORMER: String = "SYN-USER-NURSE-3"
    const val DISPENSE: String = "SYN-DISP-0001"
    const val OTHER_DISPENSE: String = "SYN-DISP-0002"
    const val ITEM: String = "SYN-PSI-0001"
    const val UNIT: String = "SYN-UNIT-01"
    const val ADMINISTER_PRIVILEGE: String = "SYN-PRIV-ADMINISTER"
    const val COMMAND_PRIVILEGE: String = "SYN-PRIV-CORRECT-OR-BACK-ENTER"
    const val OVERRIDE_ANY: String = "SYN-OVR-ON-EVERY-LIST"
    const val OVERRIDE_SCAN: String = "SYN-OVR-SCAN-ONLY"
    const val OVERRIDE_VERIFICATION: String = "SYN-OVR-VERIFICATION-ONLY"
    const val OVERRIDE_IDENTITY: String = "SYN-OVR-IDENTITY-ONLY"
    const val OVERRIDE_UNLISTED: String = "SYN-OVR-UNLISTED"
    const val ERROR_REASON: String = "SYN-EIE-WRONG-PATIENT-CHART"
    const val BACK_ENTRY_REASON: String = "SYN-BACK-DOWNTIME"
    const val PAPER_RECORD: String = "SYN-PAPER-0001"
    const val UNIT_MG: String = "mg"
    const val UNIT_ML: String = "mL"

    /** The facility zone of the samples (Erbil time). */
    val ZONE: ZoneId = ZoneId.of("Asia/Baghdad")

    /** The dose's due time. */
    val DUE: Instant = Instant.parse("2026-01-05T08:00:00Z")

    /** The product scan's time. */
    val SCANNED_AT: Instant = Instant.parse("2026-01-05T08:02:00Z")

    /** The double check's time: after the scan, before the command. */
    val CHECKED_AT: Instant = Instant.parse("2026-01-05T08:03:00Z")

    /** The command's issue time on the device (the clinical time on the live paths). */
    val ISSUED_AT: Instant = Instant.parse("2026-01-05T08:04:00Z")

    /** The server's receipt time (the clock reading). */
    val RECEIVED_AT: Instant = Instant.parse("2026-01-05T08:05:00Z")

    /** The pharmacist verification time. */
    val VERIFIED_AT: Instant = Instant.parse("2026-01-04T08:00:00Z")

    /** The start of an outage after the verification. */
    val OUTAGE_START: Instant = Instant.parse("2026-01-05T07:00:00Z")

    /** The paper clinical time of a back-entry. */
    val PAPER_TIME: Instant = Instant.parse("2026-01-05T07:30:00Z")

    /** The clinical date of [ISSUED_AT] in [ZONE]. */
    val CLINICAL_DATE: LocalDate = LocalDate.parse("2026-01-05")

    /** The patient's recorded date of birth (synthetic). */
    val DATE_OF_BIRTH: LocalDate = LocalDate.parse("1980-02-03")

    /** The late-dose window fixed at creation (synthetic). */
    val LATE_DOSE_WINDOW: Duration = Duration.parse("PT30M")

    /** The double-check window (synthetic stand-in for the governed value). */
    val DOUBLE_CHECK_WINDOW: Duration = Duration.parse("PT10M")

    /** The clock-skew allowance (synthetic stand-in for the governed value). */
    val SKEW_ALLOWANCE: Duration = Duration.parse("PT1M")

    /** The ordered dose (synthetic, NOT FOR CLINICAL USE). */
    val ORDERED_DOSE: DoseQuantity = DoseQuantity(BigDecimal("5"), UNIT_MG)

    /** The labelled and ordered content of the infusion (synthetic, NOT FOR CLINICAL USE). */
    val CONTENT: InfusionContent =
        InfusionContent.AmountInVolume(DoseQuantity(BigDecimal("50"), UNIT_MG), DoseQuantity(BigDecimal("100"), UNIT_ML))

    /** The identity service's answer for the patient's current MRN. */
    val CURRENT_IDENTITY: MrnIdentity = MrnIdentity(checkDigitValid = true, patientId = PATIENT, currentForPatient = true)

    /** The command's matching wristband scan. */
    val MATCHING_WRISTBAND: WristbandScan = WristbandScan(LabelKind.PATIENT_WRISTBAND, MRN, CURRENT_IDENTITY)

    /** A wristband scan of another patient's band. */
    val OTHER_PATIENT_WRISTBAND: WristbandScan =
        WristbandScan(LabelKind.PATIENT_WRISTBAND, OTHER_MRN, MrnIdentity(checkDigitValid = true, patientId = OTHER_PATIENT, currentForPatient = true))

    /** A wristband scan of this patient's merged (retired) MRN. */
    val MERGED_WRISTBAND: WristbandScan =
        WristbandScan(LabelKind.PATIENT_WRISTBAND, FORMER_MRN, MrnIdentity(checkDigitValid = true, patientId = PATIENT, currentForPatient = false))

    /** The command's matching product scan (a manufacturer barcode of the verified product, known expiry). */
    val MATCHING_PRODUCT: ProductScan.Identified =
        ProductScan.Identified(PRODUCT, ProductLabel.Manufacturer, LOT, LocalDate.parse("2027-01-31"), SCANNED_AT)

    /** The facts of a normal, non-infusion give for which every give predicate holds. */
    fun give(): MedicationAdministrationFacts =
        MedicationAdministrationFacts(
            dose = DoseFacts(DOSE, PATIENT, UNIT, DUE, LATE_DOSE_WINDOW, flaggedLate = false, otherDoses = otherDosesNotGiven()),
            order = order(),
            patient = PatientRecord(listOf("SYN-ناو", "SYN Name"), DATE_OF_BIRTH, approximateDob = false),
            actor = Actor(NURSE, PrincipalKind.HUMAN, true, setOf(ADMINISTER_PRIVILEGE, COMMAND_PRIVILEGE), clinicalRoleAtFacility = true),
            context = CommandContext(RECEIVED_AT, onlineEnvelope(), auditWritable = true),
            scans = CommandScans(MATCHING_WRISTBAND, MATCHING_PRODUCT, namedSupply = null, log = ScanLog(emptyList(), emptyList())),
            entries = entries(),
            doubleCheck = DoubleCheck(DOSE, CHECKER, true, true, true, PRODUCT, LOT, namedSupply = null, recordedAt = CHECKED_AT),
            supplies = supplies(),
            configuration = configuration(),
        )

    /** The facts of [give] for an infusion order (it carries a rate). */
    fun infusion(): MedicationAdministrationFacts = give().let { it.copy(order = it.order.copy(carriesRate = true)) }

    /** A reason chosen by [NURSE]. */
    fun chosen(code: String): ChosenReason = ChosenReason(code, chosenByUser = true, enteredBy = NURSE)

    /** The other doses of the order, none of which was given. */
    fun otherDosesNotGiven(): List<OtherDose> =
        listOf(
            OtherDose(OTHER_DOSE, ORDER, MedicationAdministrationState.SCHEDULED, administeredBeforeError = false),
            OtherDose("SYN-DOSE-0003", ORDER, MedicationAdministrationState.NOT_DONE, administeredBeforeError = false),
            OtherDose("SYN-DOSE-0004", REPLACED_ORDER, MedicationAdministrationState.ENTERED_IN_ERROR, administeredBeforeError = false),
            OtherDose("SYN-DOSE-0099", UNRELATED_ORDER, MedicationAdministrationState.COMPLETED, administeredBeforeError = false),
        )

    /** The online envelope of a command issued at [ISSUED_AT]. */
    fun onlineEnvelope(): IssueEnvelope =
        IssueEnvelope(ISSUED_AT, ConnectivityMode.ONLINE, outageStart = null, arrivedThroughSync = false, deviceSignatureVerified = false)

    private fun order(): OrderFacts =
        OrderFacts(
            orderId = ORDER,
            kind = OrderKind.MEDICATION,
            patientId = PATIENT,
            state = OrderState.ACTIVE,
            verificationStatus = VerificationStatus.VERIFIED,
            verifiedAt = VERIFIED_AT,
            replacesChain = setOf(REPLACED_ORDER),
            orderableId = ORDERABLE,
            carriesRate = false,
            orderedDose = OrderedDose.Fixed(ORDERED_DOSE),
            orderedContent = CONTENT,
            verifiedProductLine = VerifiedProductLine(setOf(PRODUCT), CONTENT),
            orderableHighAlert = false,
        )

    private fun entries(): CommandEntries =
        CommandEntries(
            enteredAmount = EnteredAmount(ORDERED_DOSE, enteredIntoEmptyField = true),
            overrideReason = chosen(OVERRIDE_ANY),
            notDoneReason = chosen("held"),
            errorReason = chosen(ERROR_REASON),
            manualIdentification = ManualIdentification(MRN, CURRENT_IDENTITY, DATE_OF_BIRTH, approximateDobConfirmed = false, bannerShown = true),
            backEntry = BackEntry(PAPER_RECORD, PAPER_TIME, PAPER_PERFORMER, chosen(BACK_ENTRY_REASON), labelledBackEntry = true),
            userEnteredClinicalTime = null,
        )

    private fun supplies(): SupplyRecords =
        SupplyRecords(
            dispenseRecords =
                listOf(
                    DispenseRecord(DISPENSE, PATIENT, ORDER, setOf(PRODUCT), CONTENT),
                    DispenseRecord(OTHER_DISPENSE, OTHER_PATIENT, "SYN-ORD-0002", setOf(PRODUCT, WARD_PRODUCT), CONTENT),
                ),
            patientSuppliedItems = listOf(PatientSuppliedItem(ITEM, PATIENT, PRODUCT, PatientSuppliedStage.ADMINISTRABLE)),
            unitStockedProducts = setOf(WARD_PRODUCT, OTHER_PRODUCT),
        )

    private fun configuration(): GovernedConfiguration =
        GovernedConfiguration(
            administrationPrivilege = ADMINISTER_PRIVILEGE,
            commandPrivilege = COMMAND_PRIVILEGE,
            emergencyOverrideList = setOf(ORDERABLE),
            scanOverrideReasons = setOf(OVERRIDE_ANY, OVERRIDE_SCAN),
            verificationOverrideReasons = setOf(OVERRIDE_ANY, OVERRIDE_VERIFICATION),
            identityOverrideReasons = setOf(OVERRIDE_ANY, OVERRIDE_IDENTITY),
            errorReasons = setOf(ERROR_REASON),
            doubleCheckWindow = DOUBLE_CHECK_WINDOW,
            clockSkewAllowance = SKEW_ALLOWANCE,
            facilityZone = ZONE,
            formulary =
                mapOf(
                    PRODUCT to ProductEntry(ORDERABLE, CONTENT, highAlert = false),
                    WARD_PRODUCT to ProductEntry(ORDERABLE, CONTENT, highAlert = false),
                    OTHER_PRODUCT to ProductEntry(OTHER_ORDERABLE, CONTENT, highAlert = false),
                ),
        )
}
