package hms.medications.domain.medicationadministration

import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.CHECKER
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.CHECKED_AT
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.CLINICAL_DATE
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.COMMAND_PRIVILEGE
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.CONTENT
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.CURRENT_IDENTITY
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.DISPENSE
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.DOUBLE_CHECK_WINDOW
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.FORMER_MRN
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.ISSUED_AT
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.ITEM
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.LOT
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.MATCHING_PRODUCT
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.MERGED_WRISTBAND
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.MRN
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.NURSE
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.ORDER
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.ORDERED_DOSE
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.OTHER_DISPENSE
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.OTHER_DOSE
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.OTHER_MRN
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.OTHER_PATIENT
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.OTHER_PATIENT_WRISTBAND
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.OTHER_PRODUCT
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.OUTAGE_START
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.OVERRIDE_IDENTITY
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.OVERRIDE_SCAN
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.OVERRIDE_UNLISTED
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.OVERRIDE_VERIFICATION
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.PATIENT
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.PRODUCT
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.RECEIVED_AT
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.REPLACED_ORDER
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.SCANNED_AT
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.SKEW_ALLOWANCE
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.UNIT_MG
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.UNLISTED_PRODUCT
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.VERIFIED_AT
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.WARD_PRODUCT
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.ADMINISTER_PRIVILEGE
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.ORDERABLE
import hms.medications.domain.medicationadministration.MedicationAdministrationState.COMPLETED
import hms.medications.domain.medicationadministration.OrderState.PENDING_VERIFICATION
import hms.medications.domain.medicationadministration.PatientSuppliedStage.RELABELLED
import hms.medications.domain.medicationadministration.VerificationStatus.PENDING
import io.kotest.property.Arb
import io.kotest.property.arbitrary.arbitrary
import java.math.BigDecimal
import java.time.Duration
import kotlin.random.Random

private typealias Facts = MedicationAdministrationFacts

/**
 * The facts generator of the medication-administration machine (WP-0.5 spec docs/specs/modules/
 * state-machines-and-invariants.md §3.3): synthetic `SYN-` facts only, NOT FOR CLINICAL USE.
 *
 * Each draw starts from [MedicationAdministrationSamples.give] or [MedicationAdministrationSamples.infusion] and applies:
 * 1. a scenario: the normal path, a failed product scan, an order awaiting verification, a failed wristband, an order on
 *    hold, or an ended order, so that every alternative of every command holds often enough for property P7 (every
 *    transition fires in 1,000 sequences);
 * 2. independent aspects for the connectivity mode, the high-alert flag and its double check, the late-dose window, the
 *    not-done and entered-in-error reasons, the back-entry, the command privilege and the clinical role;
 * 3. perturbations: none (half the draws), one, or many, each picking a variant of one aspect. Most variants make a
 *    predicate fail (refusals, the fail-closed unknowns); some are edge values that must still hold (an expiry on the
 *    clinical date, the double-check window's end, the skew allowance's end, a cleared mismatch, an approximate DOB).
 */
@Suppress("MagicNumber", "TooManyFunctions") // The weights are the generator's tuning table (P7); one function per aspect.
object MedicationAdministrationArbs {
    /** Facts biased so that every transition fires at least once in 1,000 sequences, with many refusals and edge values. */
    val facts: Arb<MedicationAdministrationFacts> = arbitrary { source -> draw(source.random) }

    /** One draw of [facts] from [random]. */
    fun draw(random: Random): MedicationAdministrationFacts {
        val base = if (random.nextInt(100) < 60) MedicationAdministrationSamples.infusion() else MedicationAdministrationSamples.give()
        var facts = scenario(random, base)
        facts = mode(random, facts)
        facts = highAlert(random, facts)
        facts = exitAspects(random, facts)
        when (weighted(random, 50, 32, 18)) {
            0 -> Unit
            1 -> facts = perturbations[random.nextInt(perturbations.size)](random, facts)
            else -> perturbations.forEach { perturb -> if (random.nextInt(100) < 25) facts = perturb(random, facts) }
        }
        return facts
    }

    /** Index of the weight drawn from [weights], each in proportion to its value. */
    private fun weighted(
        random: Random,
        vararg weights: Int,
    ): Int {
        var roll = random.nextInt(weights.sum())
        weights.forEachIndexed { index, weight ->
            if (roll < weight) return index
            roll -= weight
        }
        return weights.lastIndex
    }

    private fun <T> oneOf(
        random: Random,
        vararg choices: T,
    ): T = choices[random.nextInt(choices.size)]

    // ---- 1. Scenarios

    private fun scenario(
        random: Random,
        facts: Facts,
    ): Facts =
        when (weighted(random, 36, 16, 16, 16, 6, 10)) {
            0 -> facts
            1 -> productScanFailed(random, facts)
            2 ->
                facts.withOrder {
                    it.copy(state = PENDING_VERIFICATION, verificationStatus = PENDING, verifiedAt = null, verifiedProductLine = null)
                }
            3 -> facts.withBand(oneOf(random, null, UNREADABLE_BAND, MERGED_WRISTBAND))
            4 -> facts.withOrder { it.copy(state = OrderState.ON_HOLD) }
            else -> facts.withOrder { it.copy(state = oneOf(random, *ENDED_STATES)) }
        }

    private fun productScanFailed(
        random: Random,
        facts: Facts,
    ): Facts {
        val supply: NamedSupply = oneOf(random, NamedSupply.Dispense(DISPENSE), NamedSupply.WardStock(WARD_PRODUCT))
        val scan: ProductScan? = oneOf(random, null, ProductScan.Unreadable, ProductScan.NotMapped("SYN-GTIN-UNMAPPED"))
        return facts
            .withScans { it.copy(product = scan, namedSupply = supply) }
            .copy(doubleCheck = facts.doubleCheck?.copy(productId = null, lot = null, namedSupply = supply))
    }

    // ---- 2. Independent aspects

    private fun mode(
        random: Random,
        facts: Facts,
    ): Facts {
        val offlineMode = oneOf(random, ConnectivityMode.ON_SITE_CELL_LOST, ConnectivityMode.EDGE_AGENT, ConnectivityMode.MOBILE_OFFLINE)
        val synced = IssueEnvelope(ISSUED_AT, offlineMode, OUTAGE_START, arrivedThroughSync = true, deviceSignatureVerified = true)
        val envelope: IssueEnvelope? =
            when (weighted(random, 64, 6, 5, 13, 2, 2, 2, 2, 2, 1, 1)) {
                0 -> MedicationAdministrationSamples.onlineEnvelope()
                1 -> MedicationAdministrationSamples.onlineEnvelope().copy(arrivedThroughSync = true, deviceSignatureVerified = true)
                2 -> MedicationAdministrationSamples.onlineEnvelope().copy(mode = ConnectivityMode.INTERNET_OR_WAN_LOST)
                3 -> synced
                4 -> synced.copy(outageStart = VERIFIED_AT)
                5 -> synced.copy(outageStart = VERIFIED_AT.minus(Duration.ofHours(1)))
                6 -> synced.copy(arrivedThroughSync = false)
                7 -> synced.copy(deviceSignatureVerified = false)
                8 -> synced.copy(outageStart = null)
                9 -> synced.copy(mode = null)
                else -> null
            }
        return facts.withContext { it.copy(envelope = envelope) }
    }

    // The double check names what the scenario's scans name, so it holds when nothing perturbs it.
    private fun highAlert(
        random: Random,
        facts: Facts,
    ): Facts =
        when (weighted(random, 58, 28, 7, 7)) {
            0 -> facts
            1 -> facts.withOrder { it.copy(orderableHighAlert = true) }
            2 -> facts.withOrder { it.copy(orderableHighAlert = null) }
            else -> facts.withConfiguration { it.copy(formulary = it.formulary + (PRODUCT to UNKNOWN_FLAG_PRODUCT)) }
        }

    private fun exitAspects(
        random: Random,
        facts: Facts,
    ): Facts {
        var result = facts
        result = result.withEntries { it.copy(notDoneReason = notDoneReason(random)) }
        result = commandPrivilege(random, result)
        result = result.withEntries { it.copy(errorReason = errorReason(random)) }
        result = backEntry(random, result)
        result = lateDose(random, result)
        if (random.nextInt(100) < 40) result = result.copy(actor = result.actor.copy(clinicalRoleAtFacility = false))
        return result
    }

    private fun notDoneReason(random: Random): ChosenReason? =
        when (weighted(random, 30, 15, 15, 10, 15, 5, 10)) {
            0 -> MedicationAdministrationSamples.chosen(oneOf(random, *MedicationAdministrationGuards.NOT_DONE_REASON_CODES.toTypedArray()))
            1 -> ChosenReason("refused", chosenByUser = false, enteredBy = NURSE)
            2 -> MedicationAdministrationSamples.chosen("SYN-NOT-A-REASON")
            3 -> ChosenReason("missed", chosenByUser = true, enteredBy = CHECKER)
            4 -> null
            5 -> MedicationAdministrationSamples.chosen(" ")
            else -> MedicationAdministrationSamples.chosen("HELD")
        }

    private fun commandPrivilege(
        random: Random,
        facts: Facts,
    ): Facts =
        when (weighted(random, 55, 15, 15, 15)) {
            0 -> facts
            1 -> facts.withContext { it.copy(auditWritable = false) }
            2 -> facts.copy(actor = facts.actor.copy(privileges = facts.actor.privileges - COMMAND_PRIVILEGE))
            else -> facts.withConfiguration { it.copy(commandPrivilege = null) }
        }

    private fun errorReason(random: Random): ChosenReason? =
        when (weighted(random, 65, 10, 10, 15)) {
            0 -> MedicationAdministrationSamples.chosen(MedicationAdministrationSamples.ERROR_REASON)
            1 -> ChosenReason(MedicationAdministrationSamples.ERROR_REASON, chosenByUser = false, enteredBy = NURSE)
            2 -> MedicationAdministrationSamples.chosen("SYN-EIE-UNLISTED")
            else -> null
        }

    private fun backEntry(
        random: Random,
        facts: Facts,
    ): Facts {
        val entry = facts.entries.backEntry ?: return facts
        val varied: BackEntry? =
            when (weighted(random, 40, 15, 8, 8, 5, 8, 8, 4, 4)) {
                0 -> entry
                1 -> null
                2 -> entry.copy(paperClinicalTime = null)
                3 -> entry.copy(paperClinicalTime = RECEIVED_AT.plusSeconds(1))
                4 -> entry.copy(paperClinicalTime = RECEIVED_AT)
                5 -> entry.copy(reason = entry.reason?.copy(chosenByUser = false))
                6 -> entry.copy(labelledBackEntry = false)
                7 -> entry.copy(paperRecordRef = "")
                else -> entry.copy(paperPerformer = " ")
            }
        return facts.withEntries { it.copy(backEntry = varied) }
    }

    private fun lateDose(
        random: Random,
        facts: Facts,
    ): Facts {
        val window = facts.dose.lateDoseWindow
        return when (weighted(random, 40, 45, 5, 10)) {
            0 -> facts
            1 -> facts.copy(dose = facts.dose.copy(dueTime = RECEIVED_AT.minus(window).minusSeconds(1)))
            2 -> facts.copy(dose = facts.dose.copy(dueTime = RECEIVED_AT.minus(window)))
            else -> facts.copy(dose = facts.dose.copy(dueTime = RECEIVED_AT.minus(window).minusSeconds(60), flaggedLate = true))
        }
    }

    // ---- 3. Perturbations: each picks one variant of one aspect

    private val perturbations: List<(Random, Facts) -> Facts> =
        listOf(
            ::perturbOrder,
            ::perturbFirstDose,
            ::perturbEmergencyList,
            ::perturbDoseForm,
            ::perturbWristband,
            ::perturbManualIdentifiers,
            ::perturbProduct,
            ::perturbSupply,
            ::perturbAmount,
            ::perturbContent,
            ::perturbDoubleCheck,
            ::perturbActor,
            ::perturbTime,
            ::perturbOverrideReason,
        )

    private fun perturbOrder(
        random: Random,
        facts: Facts,
    ): Facts =
        facts.withOrder { order ->
            when (random.nextInt(9)) {
                0 ->
                    order.copy(state = OrderState.PENDING_VERIFICATION, verificationStatus = VerificationStatus.RETURNED, verifiedAt = null)
                1 -> order.copy(state = OrderState.DRAFT, verificationStatus = null, verifiedAt = null)
                2 -> order.copy(state = null)
                3 -> order.copy(patientId = OTHER_PATIENT)
                4 -> order.copy(kind = OrderKind.OTHER)
                5 -> order.copy(verificationStatus = null)
                6 -> order.copy(state = OrderState.ACTIVE, verificationStatus = VerificationStatus.PENDING)
                7 -> order.copy(kind = null)
                else -> order.copy(patientId = null)
            }
        }

    private fun perturbFirstDose(
        random: Random,
        facts: Facts,
    ): Facts {
        val given =
            when (random.nextInt(6)) {
                0 -> OtherDose(OTHER_DOSE, ORDER, MedicationAdministrationState.COMPLETED, administeredBeforeError = false)
                1 -> OtherDose(OTHER_DOSE, REPLACED_ORDER, MedicationAdministrationState.IN_PROGRESS, administeredBeforeError = false)
                2 -> OtherDose(OTHER_DOSE, ORDER, MedicationAdministrationState.STOPPED, administeredBeforeError = false)
                3 -> OtherDose(OTHER_DOSE, REPLACED_ORDER, MedicationAdministrationState.ENTERED_IN_ERROR, administeredBeforeError = true)
                4 -> null
                else -> OtherDose(MedicationAdministrationSamples.DOSE, ORDER, COMPLETED, administeredBeforeError = false)
            }
        val doses = if (given == null) null else MedicationAdministrationSamples.otherDosesNotGiven() + given
        return facts.copy(dose = facts.dose.copy(otherDoses = doses))
    }

    private fun perturbEmergencyList(
        random: Random,
        facts: Facts,
    ): Facts =
        when (random.nextInt(3)) {
            0 -> facts.withConfiguration { it.copy(emergencyOverrideList = setOf("SYN-ORDERABLE-0404")) }
            1 -> facts.withConfiguration { it.copy(emergencyOverrideList = null) }
            else -> facts.withOrder { it.copy(orderableId = null) }
        }

    private fun perturbDoseForm(
        random: Random,
        facts: Facts,
    ): Facts =
        facts.withOrder { order ->
            when (random.nextInt(4)) {
                0 -> order.copy(orderedDose = OrderedDose.Range(milligrams("2"), milligrams("8")))
                1 -> order.copy(orderedDose = null)
                2 -> order.copy(orderedDose = OrderedDose.Fixed(ORDERED_DOSE.copy(unit = "")))
                else -> order.copy(orderedDose = OrderedDose.Fixed(ORDERED_DOSE.copy(value = BigDecimal("5.00"))))
            }
        }

    private fun perturbWristband(
        random: Random,
        facts: Facts,
    ): Facts =
        when (random.nextInt(12)) {
            0 -> facts.withScans { it.copy(wristband = OTHER_PATIENT_WRISTBAND) }
            1 -> facts.withScans { it.copy(wristband = WristbandScan(LabelKind.BED, MRN, CURRENT_IDENTITY)) }
            2 -> facts.withBand(WristbandScan(oneOf(random, LabelKind.ROOM, LabelKind.CHART, null), MRN, CURRENT_IDENTITY))
            3 -> facts.withBand(WristbandScan(LabelKind.PATIENT_WRISTBAND, MRN, BAD_CHECK_DIGIT))
            4 -> facts.withScans { it.copy(wristband = WristbandScan(LabelKind.PATIENT_WRISTBAND, MRN, null)) }
            5 -> facts.copy(patient = facts.patient.copy(nameForms = listOf(" ")))
            6 -> facts.copy(patient = facts.patient.copy(dateOfBirth = null))
            7 -> facts.copy(patient = facts.patient.copy(dateOfBirth = null, approximateDob = true))
            8 -> facts.withLog { it.copy(wristbandScans = it.wristbandScans + OTHER_PATIENT_WRISTBAND) }
            9 -> facts.withLog { it.copy(wristbandScans = it.wristbandScans + WristbandScan(LabelKind.PATIENT_WRISTBAND, OTHER_MRN, null)) }
            10 -> facts.withLog { it.copy(wristbandScans = it.wristbandScans + MedicationAdministrationSamples.MATCHING_WRISTBAND) }
            else -> facts.withBand(WristbandScan(LabelKind.PATIENT_WRISTBAND, FORMER_MRN, CURRENT_IDENTITY.copy(patientId = OTHER_PATIENT)))
        }

    private fun perturbManualIdentifiers(
        random: Random,
        facts: Facts,
    ): Facts {
        val manual = facts.entries.manualIdentification ?: return facts
        val wrongDob = MedicationAdministrationSamples.DATE_OF_BIRTH.plusDays(1)
        return when (random.nextInt(9)) {
            0 -> facts.withEntries { it.copy(manualIdentification = null) }
            1 -> facts.withEntries { it.copy(manualIdentification = manual.copy(keyedDateOfBirth = wrongDob)) }
            2 -> facts.withManual(manual.copy(keyedMrn = OTHER_MRN, keyedMrnIdentity = OTHER_PATIENT_WRISTBAND.identity))
            3 -> facts.withManual(manual.copy(keyedMrn = FORMER_MRN, keyedMrnIdentity = MERGED_WRISTBAND.identity))
            4 -> facts.withManual(manual.copy(keyedMrnIdentity = BAD_CHECK_DIGIT))
            5 -> facts.withEntries { it.copy(manualIdentification = manual.copy(bannerShown = false)) }
            6 -> facts.withEntries { it.copy(manualIdentification = manual.copy(keyedMrn = "")) }
            7 ->
                facts
                    .copy(patient = facts.patient.copy(approximateDob = true))
                    .withEntries { it.copy(manualIdentification = manual.copy(keyedDateOfBirth = null, approximateDobConfirmed = true)) }
            else -> facts.withEntries { it.copy(manualIdentification = manual.copy(keyedDateOfBirth = null)) }
        }
    }

    private fun perturbProduct(
        random: Random,
        facts: Facts,
    ): Facts {
        val mismatch = LoggedProductScan(MATCHING_PRODUCT.copy(productId = OTHER_PRODUCT), clearedByPharmacist = false)
        return when (random.nextInt(12)) {
            0 -> facts.withScans { it.copy(product = MATCHING_PRODUCT.copy(productId = OTHER_PRODUCT)) }
            1 -> facts.withScans { it.copy(product = MATCHING_PRODUCT.copy(productId = UNLISTED_PRODUCT)) }
            2 -> facts.withScans { it.copy(product = MATCHING_PRODUCT.copy(expiry = CLINICAL_DATE.minusDays(1))) }
            3 -> facts.withScans { it.copy(product = MATCHING_PRODUCT.copy(expiry = CLINICAL_DATE)) }
            4 -> facts.withScans { it.copy(product = MATCHING_PRODUCT.copy(lot = null, expiry = null)) }
            5 -> facts.withScans { it.copy(product = MATCHING_PRODUCT.copy(label = ProductLabel.Dispense(DISPENSE))) }
            6 -> facts.withScans { it.copy(product = MATCHING_PRODUCT.copy(label = ProductLabel.PatientSuppliedRelabel(ITEM, PATIENT))) }
            7 -> facts.withLog { it.copy(productScans = it.productScans + mismatch) }
            8 -> facts.withLog { it.copy(productScans = it.productScans + mismatch.copy(clearedByPharmacist = true)) }
            9 -> facts.logProduct(LoggedProductScan(ProductScan.Unreadable, clearedByPharmacist = false))
            10 -> facts.withScans { it.copy(product = MATCHING_PRODUCT.copy(productId = WARD_PRODUCT)) }
            else -> facts.logProduct(mismatch.copy(scan = MATCHING_PRODUCT.copy(expiry = CLINICAL_DATE.minusDays(1))))
        }
    }

    private fun perturbSupply(
        random: Random,
        facts: Facts,
    ): Facts =
        when (random.nextInt(9)) {
            0 -> facts.withSupplies { it.copy(dispenseRecords = it.dispenseRecords.filter { record -> record.patientId != PATIENT }) }
            1 -> facts.withSupplies { it.copy(unitStockedProducts = null) }
            2 -> facts.withScans { it.copy(namedSupply = NamedSupply.PatientSupplied(ITEM)) }
            3 -> facts.withScans { it.copy(namedSupply = NamedSupply.WardStock(OTHER_PRODUCT)) }
            4 -> facts.withScans { it.copy(namedSupply = NamedSupply.Dispense(OTHER_DISPENSE)) }
            5 -> facts.withScans { it.copy(namedSupply = null) }
            6 -> facts.withScans { it.copy(product = MATCHING_PRODUCT.copy(label = ProductLabel.Dispense("SYN-DISP-0404"))) }
            7 ->
                facts.withSupplies { supplies ->
                    supplies.copy(patientSuppliedItems = supplies.patientSuppliedItems.map { it.copy(stage = RELABELLED) })
                }.withScans { it.copy(product = MATCHING_PRODUCT.copy(label = ProductLabel.PatientSuppliedRelabel(ITEM, PATIENT))) }
            else -> facts.withProduct(MATCHING_PRODUCT.copy(label = ProductLabel.PatientSuppliedRelabel(ITEM, OTHER_PATIENT)))
        }

    private fun perturbAmount(
        random: Random,
        facts: Facts,
    ): Facts {
        val entered: EnteredAmount? =
            when (random.nextInt(5)) {
                0 -> EnteredAmount(ORDERED_DOSE.copy(value = BigDecimal("6")), enteredIntoEmptyField = true)
                1 -> EnteredAmount(ORDERED_DOSE.copy(value = BigDecimal("0.005"), unit = "g"), enteredIntoEmptyField = true)
                2 -> EnteredAmount(ORDERED_DOSE, enteredIntoEmptyField = false)
                3 -> null
                else -> EnteredAmount(ORDERED_DOSE.copy(value = BigDecimal("5.0")), enteredIntoEmptyField = true)
            }
        return facts.withEntries { it.copy(enteredAmount = entered) }
    }

    private fun perturbContent(
        random: Random,
        facts: Facts,
    ): Facts {
        val other = InfusionContent.AmountInVolume(DoseQuantity(BigDecimal("60"), UNIT_MG), DoseQuantity(BigDecimal("100"), "mL"))
        val concentration = InfusionContent.Concentration(DoseQuantity(BigDecimal("0.5"), "mg/mL"))
        return when (random.nextInt(4)) {
            0 -> facts.withTargetContent(other)
            1 -> facts.withTargetContent(concentration)
            2 -> facts.withTargetContent(null)
            else ->
                facts.withConfiguration { it.copy(formulary = it.formulary.mapValues { (_, entry) -> entry.copy(labelledContent = null) }) }
        }
    }

    private fun perturbDoubleCheck(
        random: Random,
        facts: Facts,
    ): Facts {
        val highAlert = facts.withOrder { it.copy(orderableHighAlert = true) }
        val check = highAlert.doubleCheck ?: return highAlert
        val varied: DoubleCheck? =
            when (random.nextInt(12)) {
                0 -> check.copy(checkerUserId = NURSE)
                1 -> check.copy(recordedAt = ISSUED_AT.minus(DOUBLE_CHECK_WINDOW).minusSeconds(1))
                2 -> check.copy(recordedAt = ISSUED_AT.minus(DOUBLE_CHECK_WINDOW).plusSeconds(1))
                3 -> check.copy(recordedAt = SCANNED_AT)
                4 -> check.copy(lot = "SYN-LOT-0002")
                5 -> null
                6 -> check.copy(checkerAuthenticated = false)
                7 -> check.copy(checkerPrivileged = false)
                8 -> check.copy(attested = false)
                9 -> check.copy(doseId = OTHER_DOSE)
                10 -> check.copy(recordedAt = ISSUED_AT.plusSeconds(1))
                else -> check.copy(checkerUserId = CHECKER, recordedAt = CHECKED_AT)
            }
        val result = highAlert.copy(doubleCheck = varied)
        return if (random.nextInt(10) == 0) result.withConfiguration { it.copy(doubleCheckWindow = null) } else result
    }

    private fun perturbActor(
        random: Random,
        facts: Facts,
    ): Facts =
        when (random.nextInt(5)) {
            0 -> facts.copy(actor = facts.actor.copy(privileges = facts.actor.privileges - ADMINISTER_PRIVILEGE))
            1 -> facts.withConfiguration { it.copy(administrationPrivilege = null) }
            2 ->
                facts.copy(
                    actor =
                        facts.actor.copy(
                            principal =
                                oneOf(
                                    random,
                                    PrincipalKind.SYSTEM,
                                    PrincipalKind.INTERFACE,
                                    PrincipalKind.MIGRATION_LOADER,
                                    PrincipalKind.PLUGIN,
                                    PrincipalKind.AI_AGENT,
                                ),
                        ),
                )
            3 -> facts.copy(actor = facts.actor.copy(principal = null))
            else -> facts.copy(actor = facts.actor.copy(authenticated = false))
        }

    private fun perturbTime(
        random: Random,
        facts: Facts,
    ): Facts =
        when (random.nextInt(7)) {
            0 -> facts.withEnvelope { it.copy(issuedAt = RECEIVED_AT.plus(SKEW_ALLOWANCE)) }
            1 -> facts.withEnvelope { it.copy(issuedAt = RECEIVED_AT.plus(SKEW_ALLOWANCE).plusSeconds(1)) }
            2 -> facts.withEntries { it.copy(userEnteredClinicalTime = ISSUED_AT) }
            3 -> facts.withEnvelope { it.copy(issuedAt = null) }
            4 -> facts.withoutSkewAllowance().withEnvelope { it.copy(issuedAt = RECEIVED_AT) }
            5 -> facts.withoutSkewAllowance().withEnvelope { it.copy(issuedAt = RECEIVED_AT.plusSeconds(1)) }
            else -> facts.withConfiguration { it.copy(clockSkewAllowance = SKEW_ALLOWANCE.negated()) }
        }

    private fun perturbOverrideReason(
        random: Random,
        facts: Facts,
    ): Facts {
        val reason: ChosenReason? =
            when (random.nextInt(8)) {
                0 -> MedicationAdministrationSamples.chosen(OVERRIDE_SCAN)
                1 -> MedicationAdministrationSamples.chosen(OVERRIDE_VERIFICATION)
                2 -> MedicationAdministrationSamples.chosen(OVERRIDE_IDENTITY)
                3 -> MedicationAdministrationSamples.chosen(OVERRIDE_UNLISTED)
                4 -> ChosenReason(MedicationAdministrationSamples.OVERRIDE_ANY, chosenByUser = false, enteredBy = NURSE)
                5 -> ChosenReason(MedicationAdministrationSamples.OVERRIDE_ANY, chosenByUser = true, enteredBy = CHECKER)
                6 -> null
                else -> MedicationAdministrationSamples.chosen("")
            }
        return facts.withEntries { it.copy(overrideReason = reason) }
    }

    // ---- copy helpers

    private val ENDED_STATES = arrayOf(OrderState.COMPLETED, OrderState.REVOKED, OrderState.ENTERED_IN_ERROR)
    private val UNKNOWN_FLAG_PRODUCT = ProductEntry(ORDERABLE, CONTENT, highAlert = null)
    private val UNREADABLE_BAND = WristbandScan(LabelKind.PATIENT_WRISTBAND, null, null)
    private val BAD_CHECK_DIGIT = CURRENT_IDENTITY.copy(checkDigitValid = false)

    private fun milligrams(value: String): DoseQuantity = DoseQuantity(BigDecimal(value), UNIT_MG)

    private fun Facts.withBand(scan: WristbandScan?): Facts = withScans { it.copy(wristband = scan) }

    private fun Facts.withProduct(scan: ProductScan?): Facts = withScans { it.copy(product = scan) }

    private fun Facts.withManual(manual: ManualIdentification?): Facts = withEntries { it.copy(manualIdentification = manual) }

    private fun Facts.logProduct(logged: LoggedProductScan): Facts = withLog { it.copy(productScans = it.productScans + logged) }

    private fun Facts.withoutSkewAllowance(): Facts = withConfiguration { it.copy(clockSkewAllowance = null) }

    private fun Facts.withTargetContent(content: InfusionContent?): Facts =
        withOrder { it.copy(orderedContent = content, verifiedProductLine = it.verifiedProductLine?.copy(content = content)) }

    private fun Facts.withOrder(change: (OrderFacts) -> OrderFacts): Facts = copy(order = change(order))

    private fun Facts.withScans(change: (CommandScans) -> CommandScans): Facts = copy(scans = change(scans))

    private fun Facts.withLog(change: (ScanLog) -> ScanLog): Facts = copy(scans = scans.copy(log = change(scans.log)))

    private fun Facts.withEntries(change: (CommandEntries) -> CommandEntries): Facts = copy(entries = change(entries))

    private fun Facts.withSupplies(change: (SupplyRecords) -> SupplyRecords): Facts = copy(supplies = change(supplies))

    private fun Facts.withContext(change: (CommandContext) -> CommandContext): Facts = copy(context = change(context))

    private fun Facts.withEnvelope(change: (IssueEnvelope) -> IssueEnvelope): Facts =
        copy(context = context.copy(envelope = context.envelope?.let(change)))

    private fun Facts.withConfiguration(change: (GovernedConfiguration) -> GovernedConfiguration): Facts =
        copy(configuration = change(configuration))
}
