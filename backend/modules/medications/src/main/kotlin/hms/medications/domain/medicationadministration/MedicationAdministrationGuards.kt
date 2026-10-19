package hms.medications.domain.medicationadministration

import java.time.Duration
import java.time.Instant
import java.time.LocalDate

/**
 * The only implementation of the medication-administration guard predicates (docs/specs/state-machines/
 * medication-administration.yaml `predicates`; WP-0.5 spec docs/specs/modules/state-machines-and-invariants.md §2.1
 * rule 12, §3.1). Each function implements its YAML description, cited by name; the readings beyond an SI's text are the
 * numbered items of DN-053.
 *
 * Every function is pure and total: it reads only [MedicationAdministrationFacts], never a clock, and returns false on
 * an unknown value wherever the description makes it fail. No function does dose arithmetic (§2.1 SI-05): quantities are
 * compared exactly, in the same UCUM unit, without conversion or rounding; the only arithmetic is on times (the late-dose,
 * skew and double-check windows). No function reads a financial fact (SI-12; the facts carry none).
 *
 * The alternatives of one command are disjoint for every fact value: `notInfusionOrder` is the literal negation of
 * `infusionOrder`; `productIdentityMatches` needs the command's product scan to have identified a product and
 * `productNotIdentified` needs it not to have; `wristbandScanUnusable` needs `wristbandScanMatches` not to hold; and the
 * order predicates read one order state and one verification status.
 */
@Suppress("TooManyFunctions") // One override per predicate of the generated interface (33), plus their shared readings.
object MedicationAdministrationGuards : MedicationAdministrationPredicates {
    /** The not-done reason codes of §8.4 "Not done (held, refused, missed, NPO, off unit)". */
    val NOT_DONE_REASON_CODES: Set<String> = setOf("held", "refused", "missed", "npo", "off-unit")

    private val ADMINISTERED_STATES =
        setOf(
            MedicationAdministrationState.IN_PROGRESS,
            MedicationAdministrationState.COMPLETED,
            MedicationAdministrationState.STOPPED,
        )
    private val ADMINISTRABLE_ORDER_STATES = setOf(OrderState.PENDING_VERIFICATION, OrderState.ACTIVE)
    private val ENDED_ORDER_STATES = setOf(OrderState.COMPLETED, OrderState.REVOKED, OrderState.ENTERED_IN_ERROR)

    // ---- The order

    /** activeVerifiedOrder: a medication order for the dose's patient, state active, verification status verified. */
    override fun activeVerifiedOrder(facts: MedicationAdministrationFacts): Boolean =
        medicationOrderForDosePatient(facts) &&
            facts.order.state == OrderState.ACTIVE &&
            facts.order.verificationStatus == VerificationStatus.VERIFIED

    /** orderAwaitingVerification: a medication order for the dose's patient, pending-verification with status pending (never returned). */
    override fun orderAwaitingVerification(facts: MedicationAdministrationFacts): Boolean =
        medicationOrderForDosePatient(facts) &&
            facts.order.state == OrderState.PENDING_VERIFICATION &&
            facts.order.verificationStatus == VerificationStatus.PENDING

    /** emergencyOverrideListed: the orderable is on the governed list; false when the orderable is unknown or the list absent. */
    override fun emergencyOverrideListed(facts: MedicationAdministrationFacts): Boolean {
        val orderable = facts.order.orderableId
        val list = facts.configuration.emergencyOverrideList
        return orderable != null && list != null && orderable in list
    }

    /**
     * firstDoseOfOrder: no other dose of this order or of its `replaces` chain was given (in-progress, completed or
     * stopped, or entered in error after having been one of those). False when the serialised read of the other doses
     * could not be made (an unknown fails: this predicate opens an override).
     */
    override fun firstDoseOfOrder(facts: MedicationAdministrationFacts): Boolean {
        val chain = facts.order.replacesChain + facts.order.orderId
        return facts.dose.otherDoses?.none { other ->
            other.doseId != facts.dose.doseId && other.orderId in chain && wasGiven(other)
        } ?: false
    }

    /** orderAdministrable: the order is in state pending-verification or active. */
    override fun orderAdministrable(facts: MedicationAdministrationFacts): Boolean = facts.order.state in ADMINISTRABLE_ORDER_STATES

    /** orderOnHold: the order is in state on-hold. */
    override fun orderOnHold(facts: MedicationAdministrationFacts): Boolean = facts.order.state == OrderState.ON_HOLD

    /** orderEnded: the order is completed, revoked (discontinued or replaced) or entered in error. */
    override fun orderEnded(facts: MedicationAdministrationFacts): Boolean = facts.order.state in ENDED_ORDER_STATES

    /** infusionOrder: the order carries a rate (MED-INF-01). */
    override fun infusionOrder(facts: MedicationAdministrationFacts): Boolean = facts.order.carriesRate

    /** notInfusionOrder: the exact complement of [infusionOrder]. */
    override fun notInfusionOrder(facts: MedicationAdministrationFacts): Boolean = !infusionOrder(facts)

    /** fixedDoseOrder: the ordered dose is one value with a unit, not a range; an unknown dose fails (DN-053 item 6). */
    override fun fixedDoseOrder(facts: MedicationAdministrationFacts): Boolean = fixedOrderedDose(facts) != null

    // ---- The people and the time

    /**
     * administeringUserPrivileged: an authenticated human holding the administration privilege for the order's route and
     * drug class; an unknown privilege requirement fails (DN-053 item 13).
     */
    override fun administeringUserPrivileged(facts: MedicationAdministrationFacts): Boolean {
        val required = facts.configuration.administrationPrivilege
        return authenticatedHuman(facts.actor) && required != null && required in facts.actor.privileges
    }

    /**
     * authenticatedClinicalUser: an authenticated human with any clinical role at the facility. It reads no privilege
     * configuration, so nothing configurable blocks completing or stopping an infusion.
     */
    override fun authenticatedClinicalUser(facts: MedicationAdministrationFacts): Boolean =
        authenticatedHuman(facts.actor) && facts.actor.clinicalRoleAtFacility

    /**
     * clinicalTimeContemporaneous: the clinical time is the envelope's issue time (no user-entered time), and the issue
     * time is not later than the receipt time plus the clock-skew allowance (missing: zero; negative: fails).
     */
    override fun clinicalTimeContemporaneous(facts: MedicationAdministrationFacts): Boolean {
        val issuedAt = facts.context.envelope?.issuedAt
        val allowance = facts.configuration.clockSkewAllowance ?: Duration.ZERO
        return facts.entries.userEnteredClinicalTime == null &&
            issuedAt != null &&
            !allowance.isNegative &&
            !issuedAt.isAfter(facts.context.receivedAt.plus(allowance))
    }

    // ---- SI-01: two identifiers, never a room or bed

    /**
     * wristbandScanMatches: the command's scan was read from a patient wristband, decoded an MRN, the identity service
     * confirms its check digit and that it is the dose's patient's current MRN, and the record holds a name form and a
     * date of birth or the approximate-DOB flag.
     */
    override fun wristbandScanMatches(facts: MedicationAdministrationFacts): Boolean {
        val scan = facts.scans.wristband
        return scan != null &&
            scan.labelKind == LabelKind.PATIENT_WRISTBAND &&
            !scan.decodedMrn.isNullOrBlank() &&
            isCurrentMrnOfDosePatient(scan.identity, facts) &&
            recordHoldsTwoIdentifiers(facts.patient)
    }

    /**
     * wristbandScanUnusable: [wristbandScanMatches] does not hold, and the command's wristband scan is absent, unreadable,
     * or decoded a merged or retired MRN of this same patient; false when any scan in the dose's scan log (this command's
     * included) decoded an MRN that the identity service does not confirm as this patient's, because a wrong-patient
     * scan is a hard stop. An MRN the identity service gives no answer for counts as another patient's (stricter reading).
     */
    override fun wristbandScanUnusable(facts: MedicationAdministrationFacts): Boolean =
        !wristbandScanMatches(facts) && commandWristbandUnusable(facts) && noWrongPatientScan(facts)

    /**
     * manualTwoIdentifiersConfirmed: the keyed MRN is confirmed as the dose's patient's current MRN with a valid check
     * digit, the keyed date of birth equals the record's (or the user confirmed the record's approximate-DOB flag), and
     * the channel showed the banner.
     */
    override fun manualTwoIdentifiersConfirmed(facts: MedicationAdministrationFacts): Boolean {
        val manual = facts.entries.manualIdentification
        return manual != null &&
            manual.keyedMrn.isNotBlank() &&
            isCurrentMrnOfDosePatient(manual.keyedMrnIdentity, facts) &&
            dateOfBirthConfirmed(manual, facts.patient) &&
            manual.bannerShown
    }

    // ---- The product (identity), then the quantity

    /**
     * productIdentityMatches: the command's product scan identified this order's product (verified order: its verified
     * product line or a dispense record for this patient and order; order awaiting verification: a product the brand
     * master maps to its orderable), and its lot is not known to expire before the clinical date. An unknown expiry
     * does not fail (DN-053 item 2).
     */
    override fun productIdentityMatches(facts: MedicationAdministrationFacts): Boolean =
        (facts.scans.product as? ProductScan.Identified)?.let { identifiedProductMatches(it, facts) } ?: false

    /**
     * productNotIdentified: the command's product scan identified no product (none, unreadable, not mapped), and no
     * product scan on the dose's scan log identified a product failing the identity match unless a pharmacist has since
     * cleared it (DN-053 item 3).
     */
    override fun productNotIdentified(facts: MedicationAdministrationFacts): Boolean =
        facts.scans.product !is ProductScan.Identified && noUnclearedProductMismatch(facts)

    /**
     * administeredAmountMatchesOrder: the user entered the amount into an empty field and it equals the fixed ordered dose
     * exactly in the same UCUM unit; a unit mismatch is a mismatch; nothing is converted or multiplied (DN-053 item 6).
     */
    override fun administeredAmountMatchesOrder(facts: MedicationAdministrationFacts): Boolean {
        val entered = facts.entries.enteredAmount
        val ordered = fixedOrderedDose(facts)
        return entered != null && ordered != null && entered.enteredIntoEmptyField && sameQuantity(entered.quantity, ordered)
    }

    /**
     * infusionContentMatchesOrder: the labelled content of the identified product, or of the supply the command names,
     * equals exactly the verified product line's content (verified order) or the ordered content (order awaiting
     * verification). The rate is not compared.
     */
    override fun infusionContentMatchesOrder(facts: MedicationAdministrationFacts): Boolean {
        val labelled = labelledContentOfSupply(facts)
        val target =
            when (facts.order.verificationStatus) {
                VerificationStatus.VERIFIED -> facts.order.verifiedProductLine?.content
                VerificationStatus.PENDING -> facts.order.orderedContent
                VerificationStatus.RETURNED, null -> null
            }
        return labelled != null && target != null && sameContent(labelled, target)
    }

    /**
     * patientSuppliedCleared: the supply is bound to this patient and order: a dispense record for them (named by the
     * scanned label, or listing the scanned product), ward stock of a product of the orderable that the unit stocks, or a
     * patient-supplied item only through its own scanned relabel naming this patient, administrable. On the product-scan
     * override the command names a dispense record or ward stock, never a patient-supplied item (DN-053 item 11).
     */
    override fun patientSuppliedCleared(facts: MedicationAdministrationFacts): Boolean =
        when (val scan = facts.scans.product) {
            is ProductScan.Identified -> scannedSupplyCleared(scan, facts)
            ProductScan.Unreadable, is ProductScan.NotMapped, null -> namedSupplyCleared(facts.scans.namedSupply, facts)
        }

    /**
     * highAlertCheckSatisfied: the dose is not high-alert, or an independent double check is recorded for it. The dose is
     * high-alert when the orderable's or the identified product's flag is set or unknown (DN-053 item 12).
     */
    override fun highAlertCheckSatisfied(facts: MedicationAdministrationFacts): Boolean = !isHighAlert(facts) || doubleCheckValid(facts)

    /**
     * offlineAllowed: the mode at issue is online; or it is offline and the order's verification time is strictly before
     * the start of that outage. An unknown mode, verification time or outage start fails (SI-15; DN-053 item 10).
     */
    override fun offlineAllowed(facts: MedicationAdministrationFacts): Boolean {
        val envelope = facts.context.envelope
        val mode = envelope?.mode
        val verifiedAt = facts.order.verifiedAt
        val outageStart = envelope?.outageStart
        return when {
            mode == null -> false
            !mode.offline -> true
            else -> verifiedAt != null && outageStart != null && verifiedAt.isBefore(outageStart)
        }
    }

    // ---- Overrides (SI-02 clause b)

    /** overrideReasonEntered: an override reason the administering user entered and the channel marked as chosen. */
    override fun overrideReasonEntered(facts: MedicationAdministrationFacts): Boolean =
        facts.entries.overrideReason?.let { chosenByActor(it, facts) } ?: false

    /** reasonOnScanOverrideList: the override reason's code is on the product-scan override list. */
    override fun reasonOnScanOverrideList(facts: MedicationAdministrationFacts): Boolean =
        onList(facts.entries.overrideReason, facts.configuration.scanOverrideReasons)

    /** reasonOnVerificationOverrideList: the override reason's code is on the pre-verification override list. */
    override fun reasonOnVerificationOverrideList(facts: MedicationAdministrationFacts): Boolean =
        onList(facts.entries.overrideReason, facts.configuration.verificationOverrideReasons)

    /** reasonOnIdentityOverrideList: the override reason's code is on the wristband-failure override list. */
    override fun reasonOnIdentityOverrideList(facts: MedicationAdministrationFacts): Boolean =
        onList(facts.entries.overrideReason, facts.configuration.identityOverrideReasons)

    // ---- Not done, late doses, records after the fact, correction

    /** notDoneReasonValid: a not-done reason the acting user chose, whose code is one of [NOT_DONE_REASON_CODES]. */
    override fun notDoneReasonValid(facts: MedicationAdministrationFacts): Boolean =
        facts.entries.notDoneReason?.let { chosenByActor(it, facts) && it.code in NOT_DONE_REASON_CODES } ?: false

    /** lateDoseWindowElapsed: the clock reading is later than the due time plus the window, and the dose is not flagged yet. */
    override fun lateDoseWindowElapsed(facts: MedicationAdministrationFacts): Boolean =
        !facts.dose.flaggedLate && facts.context.receivedAt.isAfter(facts.dose.dueTime.plus(facts.dose.lateDoseWindow))

    /** issuedOfflineAndSynced: arrived through sync with a verified device-signed envelope whose mode at issue is offline. */
    override fun issuedOfflineAndSynced(facts: MedicationAdministrationFacts): Boolean =
        facts.context.envelope?.let { it.arrivedThroughSync && it.deviceSignatureVerified && it.mode?.offline == true } ?: false

    /**
     * backEntryDocumented: the entry references the paper record, carries the paper's clinical time (not later than the
     * receipt time) and performer, a back-entry reason the user chose, and the back-entry label (SI-10 clauses b and c).
     */
    override fun backEntryDocumented(facts: MedicationAdministrationFacts): Boolean {
        val entry = facts.entries.backEntry
        val clinicalTime = entry?.paperClinicalTime
        return entry != null &&
            entry.paperRecordRef.isNotBlank() &&
            entry.paperPerformer.isNotBlank() &&
            clinicalTime != null &&
            !clinicalTime.isAfter(facts.context.receivedAt) &&
            entry.reason?.let { chosenByActor(it, facts) } == true &&
            entry.labelledBackEntry
    }

    /**
     * privilegedAndAudited: the authenticated user holds the privilege governed configuration requires for this command
     * (unknown requirement fails), and the audit record can be written (an audit outage refuses the command).
     */
    override fun privilegedAndAudited(facts: MedicationAdministrationFacts): Boolean {
        val required = facts.configuration.commandPrivilege
        return facts.actor.authenticated && required != null && required in facts.actor.privileges && facts.context.auditWritable
    }

    /** errorReasonEntered: the user chose an entered-in-error reason from the governed list, never defaulted. */
    override fun errorReasonEntered(facts: MedicationAdministrationFacts): Boolean =
        facts.entries.errorReason?.let { chosenByActor(it, facts) } == true &&
            onList(facts.entries.errorReason, facts.configuration.errorReasons)

    // ---- Shared readings (private: each predicate above is the only caller-visible answer)

    private fun medicationOrderForDosePatient(facts: MedicationAdministrationFacts): Boolean =
        facts.order.kind == OrderKind.MEDICATION && facts.order.patientId == facts.dose.patientId

    private fun wasGiven(other: OtherDose): Boolean =
        other.state in ADMINISTERED_STATES ||
            (other.state == MedicationAdministrationState.ENTERED_IN_ERROR && other.administeredBeforeError)

    private fun fixedOrderedDose(facts: MedicationAdministrationFacts): DoseQuantity? =
        (facts.order.orderedDose as? OrderedDose.Fixed)?.quantity?.takeIf { it.unit.isNotBlank() }

    private fun authenticatedHuman(actor: Actor): Boolean = actor.principal == PrincipalKind.HUMAN && actor.authenticated

    private fun isCurrentMrnOfDosePatient(
        identity: MrnIdentity?,
        facts: MedicationAdministrationFacts,
    ): Boolean = identity != null && identity.checkDigitValid && identity.patientId == facts.dose.patientId && identity.currentForPatient

    private fun recordHoldsTwoIdentifiers(patient: PatientRecord): Boolean =
        patient.nameForms.any { it.isNotBlank() } && (patient.dateOfBirth != null || patient.approximateDob)

    private fun commandWristbandUnusable(facts: MedicationAdministrationFacts): Boolean {
        val scan = facts.scans.wristband
        return scan == null ||
            (scan.labelKind == LabelKind.PATIENT_WRISTBAND && (scan.decodedMrn == null || isMergedOrRetiredMrnOfDosePatient(scan, facts)))
    }

    private fun isMergedOrRetiredMrnOfDosePatient(
        scan: WristbandScan,
        facts: MedicationAdministrationFacts,
    ): Boolean {
        val identity = scan.identity
        return identity != null && identity.checkDigitValid && identity.patientId == facts.dose.patientId && !identity.currentForPatient
    }

    private fun noWrongPatientScan(facts: MedicationAdministrationFacts): Boolean =
        (facts.scans.log.wristbandScans + listOfNotNull(facts.scans.wristband)).none { scan ->
            scan.decodedMrn != null && !belongsToDosePatient(scan.identity, facts)
        }

    private fun belongsToDosePatient(
        identity: MrnIdentity?,
        facts: MedicationAdministrationFacts,
    ): Boolean = identity != null && identity.checkDigitValid && identity.patientId == facts.dose.patientId

    private fun dateOfBirthConfirmed(
        manual: ManualIdentification,
        patient: PatientRecord,
    ): Boolean =
        (manual.keyedDateOfBirth != null && manual.keyedDateOfBirth == patient.dateOfBirth) ||
            (patient.approximateDob && manual.approximateDobConfirmed)

    private fun identifiedProductMatches(
        scan: ProductScan.Identified,
        facts: MedicationAdministrationFacts,
    ): Boolean = isOrderProduct(scan.productId, facts) && !knownExpiredOnClinicalDate(scan, facts)

    private fun isOrderProduct(
        productId: String,
        facts: MedicationAdministrationFacts,
    ): Boolean =
        when (facts.order.verificationStatus) {
            VerificationStatus.VERIFIED ->
                facts.order.verifiedProductLine?.productIds.orEmpty().contains(productId) ||
                    dispenseRecordsForDose(facts).any { productId in it.productIds }
            VerificationStatus.PENDING -> isProductOfOrderable(productId, facts)
            VerificationStatus.RETURNED, null -> false
        }

    private fun isProductOfOrderable(
        productId: String,
        facts: MedicationAdministrationFacts,
    ): Boolean {
        val orderable = facts.order.orderableId
        return orderable != null && facts.configuration.formulary[productId]?.orderableId == orderable
    }

    // A known expiry before the clinical date fails; a known expiry with no known clinical date fails too (unknown fails).
    private fun knownExpiredOnClinicalDate(
        scan: ProductScan.Identified,
        facts: MedicationAdministrationFacts,
    ): Boolean {
        val expiry = scan.expiry ?: return false
        val clinicalDate = clinicalDate(facts)
        return clinicalDate == null || expiry.isBefore(clinicalDate)
    }

    private fun clinicalDate(facts: MedicationAdministrationFacts): LocalDate? =
        facts.context.envelope
            ?.issuedAt
            ?.atZone(facts.configuration.facilityZone)
            ?.toLocalDate()

    private fun noUnclearedProductMismatch(facts: MedicationAdministrationFacts): Boolean =
        facts.scans.log.productScans.none { logged ->
            val scan = logged.scan
            !logged.clearedByPharmacist && scan is ProductScan.Identified && !identifiedProductMatches(scan, facts)
        }

    private fun dispenseRecordsForDose(facts: MedicationAdministrationFacts): List<DispenseRecord> =
        facts.supplies.dispenseRecords.filter { it.patientId == facts.dose.patientId && it.orderId == facts.order.orderId }

    private fun dispenseRecordForDose(
        dispenseRecordId: String,
        facts: MedicationAdministrationFacts,
    ): DispenseRecord? = dispenseRecordsForDose(facts).firstOrNull { it.dispenseRecordId == dispenseRecordId }

    private fun wardStockOfOrderable(
        productId: String,
        facts: MedicationAdministrationFacts,
    ): Boolean = isProductOfOrderable(productId, facts) && facts.supplies.unitStockedProducts?.contains(productId) == true

    private fun scannedSupplyCleared(
        scan: ProductScan.Identified,
        facts: MedicationAdministrationFacts,
    ): Boolean =
        when (val label = scan.label) {
            ProductLabel.Manufacturer ->
                dispenseRecordsForDose(facts).any { scan.productId in it.productIds } || wardStockOfOrderable(scan.productId, facts)
            is ProductLabel.Dispense ->
                dispenseRecordForDose(label.dispenseRecordId, facts)?.let { scan.productId in it.productIds } ?: false
            is ProductLabel.PatientSuppliedRelabel -> relabelCleared(label, scan, facts)
        }

    private fun relabelCleared(
        label: ProductLabel.PatientSuppliedRelabel,
        scan: ProductScan.Identified,
        facts: MedicationAdministrationFacts,
    ): Boolean =
        label.namedPatientId == facts.dose.patientId &&
            facts.supplies.patientSuppliedItems.any { item ->
                item.itemId == label.itemId &&
                    item.patientId == facts.dose.patientId &&
                    item.productId == scan.productId &&
                    item.stage == PatientSuppliedStage.ADMINISTRABLE
            }

    private fun namedSupplyCleared(
        supply: NamedSupply?,
        facts: MedicationAdministrationFacts,
    ): Boolean =
        when (supply) {
            is NamedSupply.Dispense -> dispenseRecordForDose(supply.dispenseRecordId, facts) != null
            is NamedSupply.WardStock -> wardStockOfOrderable(supply.productId, facts)
            is NamedSupply.PatientSupplied, null -> false
        }

    private fun labelledContentOfSupply(facts: MedicationAdministrationFacts): InfusionContent? =
        when (val scan = facts.scans.product) {
            is ProductScan.Identified -> facts.configuration.formulary[scan.productId]?.labelledContent
            ProductScan.Unreadable, is ProductScan.NotMapped, null ->
                when (val supply = facts.scans.namedSupply) {
                    is NamedSupply.Dispense -> dispenseRecordForDose(supply.dispenseRecordId, facts)?.labelledContent
                    is NamedSupply.WardStock -> facts.configuration.formulary[supply.productId]?.labelledContent
                    is NamedSupply.PatientSupplied, null -> null
                }
        }

    private fun isHighAlert(facts: MedicationAdministrationFacts): Boolean {
        val scan = facts.scans.product as? ProductScan.Identified
        val productFlagSetOrUnknown = scan != null && facts.configuration.formulary[scan.productId]?.highAlert != false
        return facts.order.orderableHighAlert != false || productFlagSetOrUnknown
    }

    private fun doubleCheckValid(facts: MedicationAdministrationFacts): Boolean {
        val check = facts.doubleCheck
        val commandTime = facts.context.envelope?.issuedAt
        val window = facts.configuration.doubleCheckWindow
        return check != null &&
            commandTime != null &&
            window != null &&
            check.doseId == facts.dose.doseId &&
            checkerIndependent(check, facts) &&
            checkNamesThisSupply(check, facts) &&
            recordedWithinWindow(check.recordedAt, commandTime, window)
    }

    private fun checkerIndependent(
        check: DoubleCheck,
        facts: MedicationAdministrationFacts,
    ): Boolean = check.checkerUserId != facts.actor.userId && check.checkerAuthenticated && check.checkerPrivileged && check.attested

    private fun checkNamesThisSupply(
        check: DoubleCheck,
        facts: MedicationAdministrationFacts,
    ): Boolean =
        when (val scan = facts.scans.product) {
            is ProductScan.Identified ->
                check.productId == scan.productId && check.lot == scan.lot && check.recordedAt.isAfter(scan.scannedAt)
            ProductScan.Unreadable, is ProductScan.NotMapped, null ->
                facts.scans.namedSupply != null && check.namedSupply == facts.scans.namedSupply
        }

    private fun recordedWithinWindow(
        recordedAt: Instant,
        commandTime: Instant,
        window: Duration,
    ): Boolean = !window.isNegative && !recordedAt.isAfter(commandTime) && Duration.between(recordedAt, commandTime) <= window

    private fun chosenByActor(
        reason: ChosenReason,
        facts: MedicationAdministrationFacts,
    ): Boolean = reason.code.isNotBlank() && reason.chosenByUser && reason.enteredBy == facts.actor.userId

    private fun onList(
        reason: ChosenReason?,
        list: Set<String>?,
    ): Boolean = reason != null && list != null && reason.code in list

    private fun sameQuantity(
        left: DoseQuantity,
        right: DoseQuantity,
    ): Boolean = left.unit.isNotBlank() && left.unit == right.unit && left.value.compareTo(right.value) == 0

    private fun sameContent(
        left: InfusionContent,
        right: InfusionContent,
    ): Boolean =
        when (left) {
            is InfusionContent.AmountInVolume ->
                right is InfusionContent.AmountInVolume &&
                    sameQuantity(left.amount, right.amount) &&
                    sameQuantity(left.volume, right.volume)
            is InfusionContent.Concentration ->
                right is InfusionContent.Concentration && sameQuantity(left.concentration, right.concentration)
        }
}
