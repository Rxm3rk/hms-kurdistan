package hms.medications.domain.medicationadministration

import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.CHECKED_AT
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.CHECKER
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.CLINICAL_DATE
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.COMMAND_PRIVILEGE
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.CONTENT
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.CURRENT_IDENTITY
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.DISPENSE
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.DOUBLE_CHECK_WINDOW
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.DUE
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.ISSUED_AT
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.ITEM
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.LATE_DOSE_WINDOW
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.MATCHING_PRODUCT
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.MATCHING_WRISTBAND
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.MERGED_WRISTBAND
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.NURSE
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.ORDER
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.ORDERABLE
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.ORDERED_DOSE
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.OTHER_DISPENSE
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.OTHER_DOSE
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.OTHER_MRN
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.OTHER_PATIENT
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.OTHER_PATIENT_WRISTBAND
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.OTHER_PRODUCT
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.OUTAGE_START
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.OVERRIDE_ANY
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
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.UNRELATED_ORDER
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.VERIFIED_AT
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.WARD_PRODUCT
import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.chosen
import hms.medications.domain.medicationadministration.PatientSuppliedStage.RELABELLED
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import java.math.BigDecimal
import java.time.Duration
import java.time.Instant

private typealias Facts = MedicationAdministrationFacts

private val guards = MedicationAdministrationGuards
private val give = MedicationAdministrationSamples.give()

private fun Facts.withOrder(change: OrderFacts.() -> OrderFacts): Facts = copy(order = order.change())

private fun Facts.withScans(change: CommandScans.() -> CommandScans): Facts = copy(scans = scans.change())

private fun Facts.withLog(change: ScanLog.() -> ScanLog): Facts = copy(scans = scans.copy(log = scans.log.change()))

private fun Facts.withEntries(change: CommandEntries.() -> CommandEntries): Facts = copy(entries = entries.change())

private fun Facts.withConfig(change: GovernedConfiguration.() -> GovernedConfiguration): Facts =
    copy(configuration = configuration.change())

private fun Facts.withSupplies(change: SupplyRecords.() -> SupplyRecords): Facts = copy(supplies = supplies.change())

private fun Facts.withActor(change: Actor.() -> Actor): Facts = copy(actor = actor.change())

private fun Facts.withContext(change: CommandContext.() -> CommandContext): Facts = copy(context = context.change())

private fun Facts.withEnvelope(change: IssueEnvelope.() -> IssueEnvelope): Facts = withContext { copy(envelope = envelope?.change()) }

private fun Facts.withCheck(change: DoubleCheck.() -> DoubleCheck): Facts = copy(doubleCheck = doubleCheck?.change())

private fun Facts.highAlert(): Facts = withOrder { copy(orderableHighAlert = true) }

private fun Facts.pending(): Facts =
    withOrder {
        copy(
            state = OrderState.PENDING_VERIFICATION,
            verificationStatus = VerificationStatus.PENDING,
            verifiedAt = null,
            verifiedProductLine = null,
        )
    }

private fun Facts.withProduct(scan: ProductScan?): Facts = withScans { copy(product = scan) }

private fun Facts.withBand(scan: WristbandScan?): Facts = withScans { copy(wristband = scan) }

private fun Facts.overrideSupply(supply: NamedSupply?): Facts = withScans { copy(product = null, namedSupply = supply) }

private fun Facts.withManual(change: ManualIdentification.() -> ManualIdentification): Facts =
    withEntries { copy(manualIdentification = manualIdentification?.change()) }

private fun Facts.withOtherDoses(doses: List<OtherDose>?): Facts = copy(dose = dose.copy(otherDoses = doses))

private fun mg(value: String): DoseQuantity = DoseQuantity(BigDecimal(value), UNIT_MG)

private val unreadableBand = WristbandScan(LabelKind.PATIENT_WRISTBAND, null, null)
private val offlineSynced =
    IssueEnvelope(ISSUED_AT, ConnectivityMode.EDGE_AGENT, OUTAGE_START, arrivedThroughSync = true, deviceSignatureVerified = true)

/**
 * Unit tests of every medication-administration guard predicate (WP-0.5 spec §2.1 rule 12; docs/specs/state-machines/
 * medication-administration.yaml). For every predicate: a case where it holds and one where it does not, the boundaries of
 * every time window, every fail-closed unknown, and the exact-complement and disjoint pairs. Synthetic facts only.
 */
class MedicationAdministrationGuardsTest :
    FunSpec({
        // ---- The order

        test("activeVerifiedOrder holds for an active, verified medication order of the dose's patient") {
            guards.activeVerifiedOrder(give) shouldBe true
        }

        test("activeVerifiedOrder fails for any other state or status, an unknown one, another patient or a non-medication order") {
            listOf(
                give.pending(),
                give.withOrder { copy(verificationStatus = VerificationStatus.PENDING) },
                give.withOrder { copy(verificationStatus = VerificationStatus.RETURNED) },
                give.withOrder { copy(verificationStatus = null) },
                give.withOrder { copy(state = OrderState.ON_HOLD) },
                give.withOrder { copy(state = null) },
                give.withOrder { copy(patientId = OTHER_PATIENT) },
                give.withOrder { copy(patientId = null) },
                give.withOrder { copy(kind = OrderKind.OTHER) },
                give.withOrder { copy(kind = null) },
            ).forEach { guards.activeVerifiedOrder(it) shouldBe false }
        }

        test("orderAwaitingVerification holds for a pending-verification medication order whose status is pending") {
            guards.orderAwaitingVerification(give.pending()) shouldBe true
        }

        test("orderAwaitingVerification fails for a returned order (any reason), a verified or held one, or an unknown status") {
            val pending = give.pending()
            listOf(
                pending.withOrder { copy(verificationStatus = VerificationStatus.RETURNED) },
                pending.withOrder { copy(verificationStatus = null) },
                pending.withOrder { copy(state = OrderState.ON_HOLD) },
                pending.withOrder { copy(state = OrderState.ACTIVE) },
                pending.withOrder { copy(patientId = OTHER_PATIENT) },
                pending.withOrder { copy(kind = OrderKind.OTHER) },
                give,
            ).forEach { guards.orderAwaitingVerification(it) shouldBe false }
        }

        test("activeVerifiedOrder and orderAwaitingVerification never both hold, for every state and status") {
            (OrderState.entries + null).forEach { state ->
                (VerificationStatus.entries + null).forEach { status ->
                    val facts = give.withOrder { copy(state = state, verificationStatus = status) }
                    (guards.activeVerifiedOrder(facts) && guards.orderAwaitingVerification(facts)) shouldBe false
                }
            }
        }

        test("emergencyOverrideListed holds for an orderable on the governed list") {
            guards.emergencyOverrideListed(give) shouldBe true
        }

        test("emergencyOverrideListed fails when the orderable is not listed, the list is absent or the orderable unknown") {
            listOf(
                give.withConfig { copy(emergencyOverrideList = setOf("SYN-ORDERABLE-0404")) },
                give.withConfig { copy(emergencyOverrideList = null) },
                give.withOrder { copy(orderableId = null) },
            ).forEach { guards.emergencyOverrideListed(it) shouldBe false }
        }

        test("firstDoseOfOrder holds when no other dose of the order or its replaces chain was given") {
            guards.firstDoseOfOrder(give) shouldBe true
            val thisDoseListed = OtherDose(MedicationAdministrationSamples.DOSE, ORDER, MedicationAdministrationState.COMPLETED, false)
            val unrelated = OtherDose("SYN-DOSE-0098", UNRELATED_ORDER, MedicationAdministrationState.IN_PROGRESS, false)
            val eieNeverGiven = OtherDose("SYN-DOSE-0097", ORDER, MedicationAdministrationState.ENTERED_IN_ERROR, false)
            guards.firstDoseOfOrder(give.withOtherDoses(listOf(thisDoseListed, unrelated, eieNeverGiven))) shouldBe true
        }

        test("firstDoseOfOrder fails after a dose of the order or its replaces chain was given, stopped or corrected after giving") {
            listOf(
                OtherDose(OTHER_DOSE, ORDER, MedicationAdministrationState.COMPLETED, false),
                OtherDose(OTHER_DOSE, ORDER, MedicationAdministrationState.IN_PROGRESS, false),
                OtherDose(OTHER_DOSE, ORDER, MedicationAdministrationState.STOPPED, false),
                OtherDose(OTHER_DOSE, REPLACED_ORDER, MedicationAdministrationState.COMPLETED, false),
                OtherDose(OTHER_DOSE, ORDER, MedicationAdministrationState.ENTERED_IN_ERROR, administeredBeforeError = true),
            ).forEach { given ->
                guards.firstDoseOfOrder(give.withOtherDoses(give.dose.otherDoses.orEmpty() + given)) shouldBe false
            }
        }

        test("firstDoseOfOrder fails closed when the serialised read of the other doses could not be made") {
            guards.firstDoseOfOrder(give.withOtherDoses(null)) shouldBe false
        }

        test("orderAdministrable holds for pending-verification and active, and fails for every other or unknown state") {
            (OrderState.entries + null).forEach { state ->
                guards.orderAdministrable(give.withOrder { copy(state = state) }) shouldBe
                    (state == OrderState.PENDING_VERIFICATION || state == OrderState.ACTIVE)
            }
        }

        test("orderOnHold holds for on-hold only, and fails for every other or unknown state") {
            (OrderState.entries + null).forEach { state ->
                guards.orderOnHold(give.withOrder { copy(state = state) }) shouldBe (state == OrderState.ON_HOLD)
            }
        }

        test("orderEnded holds for completed, revoked and entered-in-error, and fails for every other or unknown state") {
            val ended = setOf(OrderState.COMPLETED, OrderState.REVOKED, OrderState.ENTERED_IN_ERROR)
            (OrderState.entries + null).forEach { state ->
                guards.orderEnded(give.withOrder { copy(state = state) }) shouldBe (state in ended)
            }
        }

        test("orderAdministrable, orderOnHold and orderEnded never hold together for one order state") {
            (OrderState.entries + null).forEach { state ->
                val facts = give.withOrder { copy(state = state) }
                listOf(guards.orderAdministrable(facts), guards.orderOnHold(facts), guards.orderEnded(facts)).count { it } shouldBe
                    (if (state == null || state == OrderState.DRAFT) 0 else 1)
            }
        }

        test("infusionOrder holds for an order that carries a rate and notInfusionOrder is its exact complement") {
            val infusion = MedicationAdministrationSamples.infusion()
            guards.infusionOrder(infusion) shouldBe true
            guards.notInfusionOrder(infusion) shouldBe false
            guards.infusionOrder(give) shouldBe false
            guards.notInfusionOrder(give) shouldBe true
        }

        test("fixedDoseOrder holds for one value with a unit") {
            guards.fixedDoseOrder(give) shouldBe true
        }

        test("fixedDoseOrder fails for a range dose, an unknown dose or a dose without a unit") {
            listOf(
                give.withOrder { copy(orderedDose = OrderedDose.Range(mg("2"), mg("4"))) },
                give.withOrder { copy(orderedDose = null) },
                give.withOrder { copy(orderedDose = OrderedDose.Fixed(ORDERED_DOSE.copy(unit = " "))) },
            ).forEach { guards.fixedDoseOrder(it) shouldBe false }
        }

        // ---- The people and the time

        test("administeringUserPrivileged holds for an authenticated human with the administration privilege") {
            guards.administeringUserPrivileged(give) shouldBe true
        }

        test("administeringUserPrivileged fails without the privilege, for an unknown requirement, a non-human or unauthenticated user") {
            val nonHuman = PrincipalKind.entries.filter { it != PrincipalKind.HUMAN }
            val others = nonHuman.map { kind -> give.withActor { copy(principal = kind) } }
            (
                others +
                    listOf(
                        give.withActor { copy(privileges = setOf(COMMAND_PRIVILEGE)) },
                        give.withConfig { copy(administrationPrivilege = null) },
                        give.withActor { copy(principal = null) },
                        give.withActor { copy(authenticated = false) },
                    )
            ).forEach { guards.administeringUserPrivileged(it) shouldBe false }
        }

        test("authenticatedClinicalUser holds for an authenticated clinical human even when privilege configuration is missing") {
            guards.authenticatedClinicalUser(give) shouldBe true
            val unconfigured = give.withConfig { copy(administrationPrivilege = null) }.withActor { copy(privileges = emptySet()) }
            guards.authenticatedClinicalUser(unconfigured) shouldBe true
        }

        test("authenticatedClinicalUser fails for a non-human, unauthenticated or non-clinical principal") {
            listOf(
                give.withActor { copy(principal = PrincipalKind.AI_AGENT) },
                give.withActor { copy(principal = null) },
                give.withActor { copy(authenticated = false) },
                give.withActor { copy(clinicalRoleAtFacility = false) },
            ).forEach { guards.authenticatedClinicalUser(it) shouldBe false }
        }

        test("clinicalTimeContemporaneous holds for an issue time up to the receipt time plus the skew allowance") {
            guards.clinicalTimeContemporaneous(give) shouldBe true
            guards.clinicalTimeContemporaneous(give.withEnvelope { copy(issuedAt = RECEIVED_AT.plus(SKEW_ALLOWANCE)) }) shouldBe true
        }

        test("clinicalTimeContemporaneous fails one second past the allowance, for a user-entered time or an unknown issue time") {
            listOf(
                give.withEnvelope { copy(issuedAt = RECEIVED_AT.plus(SKEW_ALLOWANCE).plusSeconds(1)) },
                give.withEntries { copy(userEnteredClinicalTime = ISSUED_AT) },
                give.withEnvelope { copy(issuedAt = null) },
                give.withContext { copy(envelope = null) },
                give.withConfig { copy(clockSkewAllowance = SKEW_ALLOWANCE.negated()) },
            ).forEach { guards.clinicalTimeContemporaneous(it) shouldBe false }
        }

        test("clinicalTimeContemporaneous reads a missing skew allowance as zero") {
            val noAllowance = give.withConfig { copy(clockSkewAllowance = null) }
            guards.clinicalTimeContemporaneous(noAllowance.withEnvelope { copy(issuedAt = RECEIVED_AT) }) shouldBe true
            guards.clinicalTimeContemporaneous(noAllowance.withEnvelope { copy(issuedAt = RECEIVED_AT.plusSeconds(1)) }) shouldBe false
        }

        // ---- SI-01

        test("wristbandScanMatches holds for this patient's current MRN read from a wristband, with a complete record") {
            guards.wristbandScanMatches(give) shouldBe true
            guards.wristbandScanMatches(give.copy(patient = give.patient.copy(dateOfBirth = null, approximateDob = true))) shouldBe true
        }

        test("wristbandScanMatches fails for a location label even when it carries the patient's MRN (SI-01 clause b)") {
            (LabelKind.entries.filter { it != LabelKind.PATIENT_WRISTBAND } + null).forEach { kind ->
                guards.wristbandScanMatches(give.withBand(MATCHING_WRISTBAND.copy(labelKind = kind))) shouldBe false
            }
        }

        test("wristbandScanMatches fails for no scan, an unreadable, merged, other-patient or unconfirmed MRN, or an incomplete record") {
            listOf(
                give.withBand(null),
                give.withBand(unreadableBand),
                give.withBand(MERGED_WRISTBAND),
                give.withBand(OTHER_PATIENT_WRISTBAND),
                give.withBand(MATCHING_WRISTBAND.copy(identity = CURRENT_IDENTITY.copy(checkDigitValid = false))),
                give.withBand(MATCHING_WRISTBAND.copy(identity = null)),
                give.withBand(MATCHING_WRISTBAND.copy(decodedMrn = " ")),
                give.copy(patient = give.patient.copy(nameForms = listOf(" "))),
                give.copy(patient = give.patient.copy(dateOfBirth = null, approximateDob = false)),
            ).forEach { guards.wristbandScanMatches(it) shouldBe false }
        }

        test("wristbandScanUnusable holds for no scan, an unreadable band or a merged MRN of this patient") {
            listOf(give.withBand(null), give.withBand(unreadableBand), give.withBand(MERGED_WRISTBAND)).forEach {
                guards.wristbandScanUnusable(it) shouldBe true
            }
            val ownScansOnly = give.withBand(null).withLog { copy(wristbandScans = listOf(MATCHING_WRISTBAND, unreadableBand)) }
            guards.wristbandScanUnusable(ownScansOnly) shouldBe true
        }

        test("wristbandScanUnusable fails for a matching scan, another patient's band, a location label or a bad check digit") {
            listOf(
                give,
                give.withBand(OTHER_PATIENT_WRISTBAND),
                give.withBand(MATCHING_WRISTBAND.copy(labelKind = LabelKind.BED)),
                give.withBand(MATCHING_WRISTBAND.copy(identity = CURRENT_IDENTITY.copy(checkDigitValid = false))),
                give.withBand(MATCHING_WRISTBAND.copy(identity = null)),
            ).forEach { guards.wristbandScanUnusable(it) shouldBe false }
        }

        test("wristbandScanUnusable fails when the dose's scan log holds another patient's or an unconfirmed MRN (hard stop)") {
            listOf(
                OTHER_PATIENT_WRISTBAND,
                WristbandScan(LabelKind.PATIENT_WRISTBAND, OTHER_MRN, null),
                MATCHING_WRISTBAND.copy(labelKind = LabelKind.BED, decodedMrn = OTHER_MRN, identity = OTHER_PATIENT_WRISTBAND.identity),
            ).forEach { wrong ->
                guards.wristbandScanUnusable(give.withBand(null).withLog { copy(wristbandScans = listOf(wrong)) }) shouldBe false
            }
        }

        test("wristbandScanMatches and wristbandScanUnusable never both hold") {
            val bedLabel = MATCHING_WRISTBAND.copy(labelKind = LabelKind.BED)
            listOf(null, unreadableBand, MERGED_WRISTBAND, OTHER_PATIENT_WRISTBAND, MATCHING_WRISTBAND, bedLabel)
                .forEach { band ->
                    val facts = give.withBand(band)
                    (guards.wristbandScanMatches(facts) && guards.wristbandScanUnusable(facts)) shouldBe false
                }
        }

        test("manualTwoIdentifiersConfirmed holds for the keyed current MRN and date of birth with the banner shown") {
            guards.manualTwoIdentifiersConfirmed(give) shouldBe true
            val approximate = give.copy(patient = give.patient.copy(approximateDob = true))
            val confirmedFlag = approximate.withManual { copy(keyedDateOfBirth = null, approximateDobConfirmed = true) }
            guards.manualTwoIdentifiersConfirmed(confirmedFlag) shouldBe true
        }

        test("manualTwoIdentifiersConfirmed fails for a wrong or missing identifier, an unconfirmed MRN or no banner") {
            listOf(
                give.withEntries { copy(manualIdentification = null) },
                give.withManual { copy(keyedDateOfBirth = MedicationAdministrationSamples.DATE_OF_BIRTH.plusDays(1)) },
                give.withManual { copy(keyedDateOfBirth = null) },
                give.withManual { copy(keyedDateOfBirth = null, approximateDobConfirmed = true) },
                give.withManual { copy(keyedMrn = OTHER_MRN, keyedMrnIdentity = OTHER_PATIENT_WRISTBAND.identity) },
                give.withManual { copy(keyedMrnIdentity = MERGED_WRISTBAND.identity) },
                give.withManual { copy(keyedMrnIdentity = CURRENT_IDENTITY.copy(checkDigitValid = false)) },
                give.withManual { copy(keyedMrnIdentity = null) },
                give.withManual { copy(keyedMrn = "") },
                give.withManual { copy(bannerShown = false) },
            ).forEach { guards.manualTwoIdentifiersConfirmed(it) shouldBe false }
        }

        // ---- The product

        test("productIdentityMatches holds for the verified product line, a dispense record, or the brand-master mapping when pending") {
            guards.productIdentityMatches(give) shouldBe true
            val onDispenseOnly = give.withOrder { copy(verifiedProductLine = verifiedProductLine?.copy(productIds = emptySet())) }
            guards.productIdentityMatches(onDispenseOnly) shouldBe true
            guards.productIdentityMatches(give.pending().withProduct(MATCHING_PRODUCT.copy(productId = WARD_PRODUCT))) shouldBe true
        }

        test("productIdentityMatches fails for another product, an unmapped one, a returned or unknown status, or no identified scan") {
            listOf(
                give.withProduct(MATCHING_PRODUCT.copy(productId = OTHER_PRODUCT)),
                give.withProduct(MATCHING_PRODUCT.copy(productId = WARD_PRODUCT)),
                give.pending().withProduct(MATCHING_PRODUCT.copy(productId = OTHER_PRODUCT)),
                give.pending().withProduct(MATCHING_PRODUCT.copy(productId = UNLISTED_PRODUCT)),
                give.pending().withOrder { copy(orderableId = null) },
                give.withOrder { copy(verificationStatus = VerificationStatus.RETURNED) },
                give.withOrder { copy(verificationStatus = null) },
                give.withProduct(null),
                give.withProduct(ProductScan.Unreadable),
                give.withProduct(ProductScan.NotMapped("SYN-GTIN")),
            ).forEach { guards.productIdentityMatches(it) shouldBe false }
        }

        test("productIdentityMatches holds for a lot expiring on the clinical date or an unknown expiry, and fails a day earlier") {
            guards.productIdentityMatches(give.withProduct(MATCHING_PRODUCT.copy(expiry = CLINICAL_DATE))) shouldBe true
            guards.productIdentityMatches(give.withProduct(MATCHING_PRODUCT.copy(lot = null, expiry = null))) shouldBe true
            guards.productIdentityMatches(give.withProduct(MATCHING_PRODUCT.copy(expiry = CLINICAL_DATE.minusDays(1)))) shouldBe false
        }

        test("productIdentityMatches reads the clinical date in the facility zone and fails a known expiry with no clinical time") {
            // 22:30 UTC on 5 January is 01:30 on 6 January in Erbil: a lot expiring on 5 January has expired.
            val lateEvening = give.withEnvelope { copy(issuedAt = Instant.parse("2026-01-05T22:30:00Z")) }
            guards.productIdentityMatches(lateEvening.withProduct(MATCHING_PRODUCT.copy(expiry = CLINICAL_DATE))) shouldBe false
            guards.productIdentityMatches(give.withEnvelope { copy(issuedAt = null) }) shouldBe false
            val noClinicalTime = give.withEnvelope { copy(issuedAt = null) }
            guards.productIdentityMatches(noClinicalTime.withProduct(MATCHING_PRODUCT.copy(expiry = null))) shouldBe true
        }

        test("productNotIdentified holds when the command's scan identified no product and the scan log holds no mismatch") {
            listOf(null, ProductScan.Unreadable, ProductScan.NotMapped("SYN-GTIN")).forEach { scan ->
                guards.productNotIdentified(give.withProduct(scan)) shouldBe true
            }
            val cleared = LoggedProductScan(MATCHING_PRODUCT.copy(productId = OTHER_PRODUCT), clearedByPharmacist = true)
            val harmless = listOf(LoggedProductScan(ProductScan.Unreadable, false), LoggedProductScan(MATCHING_PRODUCT, false), cleared)
            guards.productNotIdentified(give.withProduct(null).withLog { copy(productScans = harmless) }) shouldBe true
        }

        test("productNotIdentified fails when the command identified a product or the log holds an uncleared mismatch") {
            val wrong = LoggedProductScan(MATCHING_PRODUCT.copy(productId = OTHER_PRODUCT), clearedByPharmacist = false)
            val expired = LoggedProductScan(MATCHING_PRODUCT.copy(expiry = CLINICAL_DATE.minusDays(1)), clearedByPharmacist = false)
            listOf(
                give,
                give.withProduct(MATCHING_PRODUCT.copy(productId = OTHER_PRODUCT)),
                give.withProduct(null).withLog { copy(productScans = listOf(wrong)) },
                give.withProduct(ProductScan.Unreadable).withLog { copy(productScans = listOf(expired)) },
            ).forEach { guards.productNotIdentified(it) shouldBe false }
        }

        test("productIdentityMatches and productNotIdentified never both hold") {
            val wrongProduct = MATCHING_PRODUCT.copy(productId = OTHER_PRODUCT)
            listOf(null, ProductScan.Unreadable, ProductScan.NotMapped("SYN-GTIN"), MATCHING_PRODUCT, wrongProduct)
                .forEach { scan ->
                    val facts = give.withProduct(scan)
                    (guards.productIdentityMatches(facts) && guards.productNotIdentified(facts)) shouldBe false
                }
        }

        test("administeredAmountMatchesOrder holds for the ordered dose entered into an empty field, numerically equal in the same unit") {
            guards.administeredAmountMatchesOrder(give) shouldBe true
            guards.administeredAmountMatchesOrder(give.withEntries { copy(enteredAmount = EnteredAmount(mg("5.00"), true)) }) shouldBe true
        }

        test("administeredAmountMatchesOrder fails for another value, another unit (no conversion), a prefilled field or a range order") {
            listOf(
                give.withEntries { copy(enteredAmount = EnteredAmount(mg("6"), true)) },
                give.withEntries { copy(enteredAmount = EnteredAmount(DoseQuantity(BigDecimal("0.005"), "g"), true)) },
                give.withEntries { copy(enteredAmount = EnteredAmount(DoseQuantity(BigDecimal("5"), "MG"), true)) },
                give.withEntries { copy(enteredAmount = EnteredAmount(ORDERED_DOSE, enteredIntoEmptyField = false)) },
                give.withEntries { copy(enteredAmount = null) },
                give.withOrder { copy(orderedDose = OrderedDose.Range(mg("5"), mg("5"))) },
                give.withOrder { copy(orderedDose = null) },
            ).forEach { guards.administeredAmountMatchesOrder(it) shouldBe false }
        }

        test("infusionContentMatchesOrder holds for the verified line's content, the ordered content when pending, or a named supply") {
            guards.infusionContentMatchesOrder(give) shouldBe true
            guards.infusionContentMatchesOrder(give.pending()) shouldBe true
            guards.infusionContentMatchesOrder(give.overrideSupply(NamedSupply.Dispense(DISPENSE))) shouldBe true
            guards.infusionContentMatchesOrder(give.overrideSupply(NamedSupply.WardStock(WARD_PRODUCT))) shouldBe true
        }

        test("infusionContentMatchesOrder fails for another amount, volume or form of content, an unknown content or status") {
            val otherAmount = InfusionContent.AmountInVolume(mg("60"), DoseQuantity(BigDecimal("100"), "mL"))
            val otherVolume = InfusionContent.AmountInVolume(mg("50"), DoseQuantity(BigDecimal("250"), "mL"))
            val concentration = InfusionContent.Concentration(DoseQuantity(BigDecimal("0.5"), "mg/mL"))
            listOf(
                give.withOrder { copy(verifiedProductLine = verifiedProductLine?.copy(content = otherAmount)) },
                give.withOrder { copy(verifiedProductLine = verifiedProductLine?.copy(content = otherVolume)) },
                give.withOrder { copy(verifiedProductLine = verifiedProductLine?.copy(content = concentration)) },
                give.withOrder { copy(verifiedProductLine = verifiedProductLine?.copy(content = null)) },
                give.pending().withOrder { copy(orderedContent = null) },
                give.withOrder { copy(verificationStatus = VerificationStatus.RETURNED) },
                give.withConfig { copy(formulary = formulary.mapValues { (_, entry) -> entry.copy(labelledContent = null) }) },
                give.overrideSupply(NamedSupply.PatientSupplied(ITEM)),
                give.overrideSupply(null),
            ).forEach { guards.infusionContentMatchesOrder(it) shouldBe false }
        }

        test("patientSuppliedCleared holds for a dispense record of this patient and order, unit ward stock, or an administrable relabel") {
            listOf(
                give,
                give.withSupplies { copy(dispenseRecords = emptyList()) }.withProduct(MATCHING_PRODUCT.copy(productId = WARD_PRODUCT)),
                give.withProduct(MATCHING_PRODUCT.copy(label = ProductLabel.Dispense(DISPENSE))),
                give.withProduct(MATCHING_PRODUCT.copy(label = ProductLabel.PatientSuppliedRelabel(ITEM, PATIENT))),
                give.overrideSupply(NamedSupply.Dispense(DISPENSE)),
                give.overrideSupply(NamedSupply.WardStock(WARD_PRODUCT)),
            ).forEach { guards.patientSuppliedCleared(it) shouldBe true }
        }

        test("patientSuppliedCleared fails for a bare GTIN the unit does not stock, another patient's supply or a non-administrable item") {
            listOf(
                give.withSupplies { copy(dispenseRecords = emptyList()) },
                give.withProduct(MATCHING_PRODUCT.copy(productId = OTHER_PRODUCT)),
                give.withSupplies { copy(dispenseRecords = emptyList(), unitStockedProducts = null) }
                    .withProduct(MATCHING_PRODUCT.copy(productId = WARD_PRODUCT)),
                give.withProduct(MATCHING_PRODUCT.copy(label = ProductLabel.Dispense(OTHER_DISPENSE))),
                give.withProduct(MATCHING_PRODUCT.copy(label = ProductLabel.Dispense("SYN-DISP-0404"))),
                give.withProduct(MATCHING_PRODUCT.copy(label = ProductLabel.PatientSuppliedRelabel(ITEM, OTHER_PATIENT))),
                give
                    .withSupplies { copy(patientSuppliedItems = patientSuppliedItems.map { it.copy(stage = RELABELLED) }) }
                    .withProduct(MATCHING_PRODUCT.copy(label = ProductLabel.PatientSuppliedRelabel(ITEM, PATIENT))),
                give
                    .withSupplies { copy(patientSuppliedItems = patientSuppliedItems.map { it.copy(patientId = OTHER_PATIENT) }) }
                    .withProduct(MATCHING_PRODUCT.copy(label = ProductLabel.PatientSuppliedRelabel(ITEM, PATIENT))),
            ).forEach { guards.patientSuppliedCleared(it) shouldBe false }
        }

        test("patientSuppliedCleared never accepts a patient-supplied item, or nothing, as the supply named on the product-scan override") {
            listOf(
                give.overrideSupply(NamedSupply.PatientSupplied(ITEM)),
                give.overrideSupply(null),
                give.overrideSupply(NamedSupply.Dispense(OTHER_DISPENSE)),
                give.overrideSupply(NamedSupply.WardStock(OTHER_PRODUCT)),
                give.overrideSupply(NamedSupply.WardStock(WARD_PRODUCT)).withSupplies { copy(unitStockedProducts = null) },
            ).forEach { guards.patientSuppliedCleared(it) shouldBe false }
        }

        test("highAlertCheckSatisfied holds for a dose that is not high-alert, or a high-alert dose with a valid double check") {
            guards.highAlertCheckSatisfied(give.copy(doubleCheck = null)) shouldBe true
            guards.highAlertCheckSatisfied(give.highAlert()) shouldBe true
            val named = NamedSupply.Dispense(DISPENSE)
            val onOverride = give.highAlert().overrideSupply(named).withCheck { copy(productId = null, lot = null, namedSupply = named) }
            guards.highAlertCheckSatisfied(onOverride) shouldBe true
        }

        test("highAlertCheckSatisfied counts an unknown or set flag of the orderable or the identified product as high-alert") {
            listOf(
                give.withOrder { copy(orderableHighAlert = null) },
                give.highAlert(),
                give.withConfig { copy(formulary = formulary + (PRODUCT to ProductEntry(ORDERABLE, CONTENT, highAlert = true))) },
                give.withConfig { copy(formulary = formulary + (PRODUCT to ProductEntry(ORDERABLE, CONTENT, highAlert = null))) },
                give.withProduct(MATCHING_PRODUCT.copy(productId = UNLISTED_PRODUCT)),
            ).forEach { guards.highAlertCheckSatisfied(it.copy(doubleCheck = null)) shouldBe false }
        }

        test("highAlertCheckSatisfied fails for a check by the administering user, or an unauthenticated, unprivileged or silent checker") {
            listOf(
                give.highAlert().withCheck { copy(checkerUserId = NURSE) },
                give.highAlert().withCheck { copy(checkerAuthenticated = false) },
                give.highAlert().withCheck { copy(checkerPrivileged = false) },
                give.highAlert().withCheck { copy(attested = false) },
                give.highAlert().withCheck { copy(doseId = OTHER_DOSE) },
                give.highAlert().copy(doubleCheck = null),
            ).forEach { guards.highAlertCheckSatisfied(it) shouldBe false }
        }

        test("highAlertCheckSatisfied fails for a check of another product or lot, or of a supply other than the one named") {
            listOf(
                give.highAlert().withCheck { copy(lot = "SYN-LOT-0002") },
                give.highAlert().withCheck { copy(productId = WARD_PRODUCT) },
                give
                    .highAlert()
                    .overrideSupply(NamedSupply.Dispense(DISPENSE))
                    .withCheck { copy(namedSupply = NamedSupply.WardStock(WARD_PRODUCT)) },
                give.highAlert().overrideSupply(null).withCheck { copy(namedSupply = null) },
            ).forEach { guards.highAlertCheckSatisfied(it) shouldBe false }
        }

        test("highAlertCheckSatisfied needs the check after the scan and within the window before the command (boundaries)") {
            val highAlert = give.highAlert()
            guards.highAlertCheckSatisfied(highAlert.withCheck { copy(recordedAt = SCANNED_AT) }) shouldBe false
            guards.highAlertCheckSatisfied(highAlert.withCheck { copy(recordedAt = SCANNED_AT.plusSeconds(1)) }) shouldBe true
            guards.highAlertCheckSatisfied(highAlert.withCheck { copy(recordedAt = ISSUED_AT) }) shouldBe true
            guards.highAlertCheckSatisfied(highAlert.withCheck { copy(recordedAt = ISSUED_AT.plusSeconds(1)) }) shouldBe false
            val earlyScan = highAlert.withProduct(MATCHING_PRODUCT.copy(scannedAt = ISSUED_AT.minus(Duration.ofHours(1))))
            guards.highAlertCheckSatisfied(earlyScan.withCheck { copy(recordedAt = ISSUED_AT.minus(DOUBLE_CHECK_WINDOW)) }) shouldBe true
            val windowStart = ISSUED_AT.minus(DOUBLE_CHECK_WINDOW)
            guards.highAlertCheckSatisfied(earlyScan.withCheck { copy(recordedAt = windowStart.minusSeconds(1)) }) shouldBe false
        }

        test("highAlertCheckSatisfied fails closed without a double-check window or a command time") {
            guards.highAlertCheckSatisfied(give.highAlert().withConfig { copy(doubleCheckWindow = null) }) shouldBe false
            guards.highAlertCheckSatisfied(give.highAlert().withEnvelope { copy(issuedAt = null) }) shouldBe false
            guards.highAlertCheckSatisfied(give.highAlert().withConfig { copy(doubleCheckWindow = Duration.ofMinutes(-1)) }) shouldBe false
            val valid = give.highAlert().withCheck { copy(checkerUserId = CHECKER, recordedAt = CHECKED_AT) }
            guards.highAlertCheckSatisfied(valid) shouldBe true
        }

        test("offlineAllowed holds online, with only the internet or WAN lost, or offline for an order verified before the outage") {
            listOf(
                give,
                give.withEnvelope { copy(mode = ConnectivityMode.INTERNET_OR_WAN_LOST) },
                give.withContext { copy(envelope = offlineSynced) },
                give.withContext { copy(envelope = offlineSynced.copy(mode = ConnectivityMode.MOBILE_OFFLINE)) },
                give.withContext { copy(envelope = offlineSynced.copy(mode = ConnectivityMode.ON_SITE_CELL_LOST)) },
            ).forEach { guards.offlineAllowed(it) shouldBe true }
        }

        test("offlineAllowed fails offline for an order verified at or after the outage start, or any unknown") {
            listOf(
                give.withContext { copy(envelope = offlineSynced.copy(outageStart = VERIFIED_AT)) },
                give.withContext { copy(envelope = offlineSynced.copy(outageStart = VERIFIED_AT.minusSeconds(1))) },
                give.withContext { copy(envelope = offlineSynced.copy(outageStart = null)) },
                give.pending().withContext { copy(envelope = offlineSynced) },
                give.withContext { copy(envelope = offlineSynced.copy(mode = null)) },
                give.withContext { copy(envelope = null) },
            ).forEach { guards.offlineAllowed(it) shouldBe false }
        }

        // ---- Overrides

        test("overrideReasonEntered holds for a reason the administering user chose") {
            guards.overrideReasonEntered(give) shouldBe true
        }

        test("overrideReasonEntered fails for a prefilled reason, one entered by another user, a blank one or none") {
            listOf(
                give.withEntries { copy(overrideReason = ChosenReason(OVERRIDE_ANY, chosenByUser = false, enteredBy = NURSE)) },
                give.withEntries { copy(overrideReason = ChosenReason(OVERRIDE_ANY, chosenByUser = true, enteredBy = CHECKER)) },
                give.withEntries { copy(overrideReason = chosen(" ")) },
                give.withEntries { copy(overrideReason = null) },
            ).forEach { guards.overrideReasonEntered(it) shouldBe false }
        }

        test("reasonOnScanOverrideList holds only for a code on the product-scan list") {
            guards.reasonOnScanOverrideList(give.withEntries { copy(overrideReason = chosen(OVERRIDE_SCAN)) }) shouldBe true
            listOf(OVERRIDE_VERIFICATION, OVERRIDE_IDENTITY, OVERRIDE_UNLISTED).forEach { code ->
                guards.reasonOnScanOverrideList(give.withEntries { copy(overrideReason = chosen(code)) }) shouldBe false
            }
            guards.reasonOnScanOverrideList(give.withConfig { copy(scanOverrideReasons = null) }) shouldBe false
            guards.reasonOnScanOverrideList(give.withEntries { copy(overrideReason = null) }) shouldBe false
        }

        test("reasonOnVerificationOverrideList holds only for a code on the pre-verification list") {
            guards.reasonOnVerificationOverrideList(give.withEntries { copy(overrideReason = chosen(OVERRIDE_VERIFICATION)) }) shouldBe true
            listOf(OVERRIDE_SCAN, OVERRIDE_IDENTITY, OVERRIDE_UNLISTED).forEach { code ->
                guards.reasonOnVerificationOverrideList(give.withEntries { copy(overrideReason = chosen(code)) }) shouldBe false
            }
            guards.reasonOnVerificationOverrideList(give.withConfig { copy(verificationOverrideReasons = null) }) shouldBe false
        }

        test("reasonOnIdentityOverrideList holds only for a code on the wristband-failure list") {
            guards.reasonOnIdentityOverrideList(give.withEntries { copy(overrideReason = chosen(OVERRIDE_IDENTITY)) }) shouldBe true
            listOf(OVERRIDE_SCAN, OVERRIDE_VERIFICATION, OVERRIDE_UNLISTED).forEach { code ->
                guards.reasonOnIdentityOverrideList(give.withEntries { copy(overrideReason = chosen(code)) }) shouldBe false
            }
            guards.reasonOnIdentityOverrideList(give.withConfig { copy(identityOverrideReasons = null) }) shouldBe false
        }

        // ---- Not done, late doses, records after the fact, correction

        test("notDoneReasonValid holds for each of the five §8.4 reasons chosen by the acting user") {
            listOf("held", "refused", "missed", "npo", "off-unit").forEach { code ->
                guards.notDoneReasonValid(give.withEntries { copy(notDoneReason = chosen(code)) }) shouldBe true
            }
        }

        test("notDoneReasonValid fails for another code, a prefilled reason, another user's or none") {
            listOf(
                give.withEntries { copy(notDoneReason = chosen("HELD")) },
                give.withEntries { copy(notDoneReason = chosen("SYN-NOT-A-REASON")) },
                give.withEntries { copy(notDoneReason = ChosenReason("held", chosenByUser = false, enteredBy = NURSE)) },
                give.withEntries { copy(notDoneReason = ChosenReason("held", chosenByUser = true, enteredBy = CHECKER)) },
                give.withEntries { copy(notDoneReason = null) },
            ).forEach { guards.notDoneReasonValid(it) shouldBe false }
        }

        test("lateDoseWindowElapsed holds one second after the due time plus the window, for a dose not yet flagged") {
            val due = RECEIVED_AT.minus(LATE_DOSE_WINDOW).minusSeconds(1)
            guards.lateDoseWindowElapsed(give.copy(dose = give.dose.copy(dueTime = due))) shouldBe true
        }

        test("lateDoseWindowElapsed fails at exactly the window's end, before it, or for a dose already flagged") {
            listOf(
                give.copy(dose = give.dose.copy(dueTime = RECEIVED_AT.minus(LATE_DOSE_WINDOW))),
                give.copy(dose = give.dose.copy(dueTime = DUE)),
                give.copy(dose = give.dose.copy(dueTime = DUE.minus(Duration.ofHours(2)), flaggedLate = true)),
            ).forEach { guards.lateDoseWindowElapsed(it) shouldBe false }
        }

        test("issuedOfflineAndSynced holds for an offline-issued command synced with a verified device signature") {
            ConnectivityMode.entries.filter { it.offline }.forEach { mode ->
                guards.issuedOfflineAndSynced(give.withContext { copy(envelope = offlineSynced.copy(mode = mode)) }) shouldBe true
            }
        }

        test("issuedOfflineAndSynced fails online, unsynced, unsigned, for an unknown mode or a missing envelope") {
            listOf(
                give.withContext { copy(envelope = offlineSynced.copy(mode = ConnectivityMode.ONLINE)) },
                give.withContext { copy(envelope = offlineSynced.copy(mode = ConnectivityMode.INTERNET_OR_WAN_LOST)) },
                give.withContext { copy(envelope = offlineSynced.copy(arrivedThroughSync = false)) },
                give.withContext { copy(envelope = offlineSynced.copy(deviceSignatureVerified = false)) },
                give.withContext { copy(envelope = offlineSynced.copy(mode = null)) },
                give.withContext { copy(envelope = null) },
            ).forEach { guards.issuedOfflineAndSynced(it) shouldBe false }
        }

        test("backEntryDocumented holds for a labelled back-entry with the paper's time, performer and a chosen reason") {
            guards.backEntryDocumented(give) shouldBe true
            val atReceipt = give.withEntries { copy(backEntry = backEntry?.copy(paperClinicalTime = RECEIVED_AT)) }
            guards.backEntryDocumented(atReceipt) shouldBe true
        }

        test("backEntryDocumented fails for a clinical time after receipt, or a missing time, record, performer, reason or label") {
            listOf(
                give.withEntries { copy(backEntry = backEntry?.copy(paperClinicalTime = RECEIVED_AT.plusSeconds(1))) },
                give.withEntries { copy(backEntry = backEntry?.copy(paperClinicalTime = null)) },
                give.withEntries { copy(backEntry = backEntry?.copy(paperRecordRef = " ")) },
                give.withEntries { copy(backEntry = backEntry?.copy(paperPerformer = "")) },
                give.withEntries { copy(backEntry = backEntry?.copy(reason = null)) },
                give.withEntries { copy(backEntry = backEntry?.copy(reason = backEntry?.reason?.copy(chosenByUser = false))) },
                give.withEntries { copy(backEntry = backEntry?.copy(reason = backEntry?.reason?.copy(enteredBy = CHECKER))) },
                give.withEntries { copy(backEntry = backEntry?.copy(labelledBackEntry = false)) },
                give.withEntries { copy(backEntry = null) },
            ).forEach { guards.backEntryDocumented(it) shouldBe false }
        }

        test("privilegedAndAudited holds for an authenticated user with the command's privilege and a writable audit") {
            guards.privilegedAndAudited(give) shouldBe true
        }

        test("privilegedAndAudited fails during an audit outage, without the privilege, for an unknown requirement or unauthenticated") {
            listOf(
                give.withContext { copy(auditWritable = false) },
                give.withActor { copy(privileges = privileges - COMMAND_PRIVILEGE) },
                give.withConfig { copy(commandPrivilege = null) },
                give.withActor { copy(authenticated = false) },
            ).forEach { guards.privilegedAndAudited(it) shouldBe false }
        }

        test("errorReasonEntered holds for a listed reason the user chose") {
            guards.errorReasonEntered(give) shouldBe true
        }

        test("errorReasonEntered fails for a prefilled, unlisted or another user's reason, an absent list or no reason") {
            listOf(
                give.withEntries { copy(errorReason = errorReason?.copy(chosenByUser = false)) },
                give.withEntries { copy(errorReason = errorReason?.copy(enteredBy = CHECKER)) },
                give.withEntries { copy(errorReason = chosen("SYN-EIE-UNLISTED")) },
                give.withConfig { copy(errorReasons = null) },
                give.withEntries { copy(errorReason = null) },
            ).forEach { guards.errorReasonEntered(it) shouldBe false }
        }

        // ---- The sample itself

        test("the sample give holds every guard of the normal give path") {
            val spec = MedicationAdministrationMachine.spec
            val giveGuard = spec.transitions.first { it.on == MedicationAdministrationCommand.Give }.guard
            giveGuard.forEach { MedicationAdministrationMachine.holds(it, guards, give) shouldBe true }
        }
    })
