import sys

p = sys.argv[1]
s = open(p, encoding="utf-8").read()
R = [
    (
        """            2 -> facts.withOrder { it.copy(state = OrderState.PENDING_VERIFICATION, verificationStatus = VerificationStatus.PENDING) }
                .withOrder { it.copy(verifiedAt = null, verifiedProductLine = null) }
            3 ->
                facts.withScans { it.copy(wristband = oneOf(random, null, WristbandScan(LabelKind.PATIENT_WRISTBAND, null, null), MERGED_WRISTBAND)) }
            4 -> facts.withOrder { it.copy(state = OrderState.ON_HOLD) }
            else ->
                facts.withOrder { it.copy(state = oneOf(random, OrderState.COMPLETED, OrderState.REVOKED, OrderState.ENTERED_IN_ERROR)) }""",
        """            2 -> facts.withOrder { it.copy(state = PENDING_VERIFICATION, verificationStatus = PENDING, verifiedAt = null, verifiedProductLine = null) }
            3 -> facts.withBand(oneOf(random, null, UNREADABLE_BAND, MERGED_WRISTBAND))
            4 -> facts.withOrder { it.copy(state = OrderState.ON_HOLD) }
            else -> facts.withOrder { it.copy(state = oneOf(random, OrderState.COMPLETED, OrderState.REVOKED, OrderState.ENTERED_IN_ERROR)) }""",
    ),
    (
        """            else ->
                facts.withConfiguration { it.copy(formulary = it.formulary + (PRODUCT to it.formulary.getValue(PRODUCT).copy(highAlert = null))) }""",
        """            else -> facts.withConfiguration { it.copy(formulary = it.formulary + (PRODUCT to ProductEntry(ORDERABLE, CONTENT, highAlert = null))) }""",
    ),
    (
        """                else ->
                    OtherDose(MedicationAdministrationSamples.DOSE, ORDER, MedicationAdministrationState.COMPLETED, administeredBeforeError = false)""",
        """                else -> OtherDose(MedicationAdministrationSamples.DOSE, ORDER, COMPLETED, administeredBeforeError = false)""",
    ),
    (
        """                0 ->
                    order.copy(orderedDose = OrderedDose.Range(DoseQuantity(BigDecimal("2"), UNIT_MG), DoseQuantity(BigDecimal("8"), UNIT_MG)))""",
        """                0 -> order.copy(orderedDose = OrderedDose.Range(milligrams("2"), milligrams("8")))""",
    ),
    (
        """            2 ->
                facts.withScans { it.copy(wristband = WristbandScan(oneOf(random, LabelKind.ROOM, LabelKind.CHART, null), MRN, CURRENT_IDENTITY)) }""",
        """            2 -> facts.withBand(WristbandScan(oneOf(random, LabelKind.ROOM, LabelKind.CHART, null), MRN, CURRENT_IDENTITY))""",
    ),
    (
        """            3 ->
                facts.withScans { it.copy(wristband = WristbandScan(LabelKind.PATIENT_WRISTBAND, MRN, CURRENT_IDENTITY.copy(checkDigitValid = false))) }""",
        """            3 -> facts.withBand(WristbandScan(LabelKind.PATIENT_WRISTBAND, MRN, BAD_CHECK_DIGIT))""",
    ),
    (
        """            else ->
                facts.withScans { it.copy(wristband = WristbandScan(LabelKind.PATIENT_WRISTBAND, FORMER_MRN, CURRENT_IDENTITY.copy(patientId = OTHER_PATIENT))) }""",
        """            else -> facts.withBand(WristbandScan(LabelKind.PATIENT_WRISTBAND, FORMER_MRN, CURRENT_IDENTITY.copy(patientId = OTHER_PATIENT)))""",
    ),
    (
        """            2 ->
                facts.withEntries { it.copy(manualIdentification = manual.copy(keyedMrn = OTHER_MRN, keyedMrnIdentity = OTHER_PATIENT_WRISTBAND.identity)) }""",
        """            2 -> facts.withManual(manual.copy(keyedMrn = OTHER_MRN, keyedMrnIdentity = OTHER_PATIENT_WRISTBAND.identity))""",
    ),
    (
        """            3 ->
                facts.withEntries { it.copy(manualIdentification = manual.copy(keyedMrn = FORMER_MRN, keyedMrnIdentity = MERGED_WRISTBAND.identity)) }""",
        """            3 -> facts.withManual(manual.copy(keyedMrn = FORMER_MRN, keyedMrnIdentity = MERGED_WRISTBAND.identity))""",
    ),
    (
        """            4 ->
                facts.withEntries { it.copy(manualIdentification = manual.copy(keyedMrnIdentity = CURRENT_IDENTITY.copy(checkDigitValid = false))) }""",
        """            4 -> facts.withManual(manual.copy(keyedMrnIdentity = BAD_CHECK_DIGIT))""",
    ),
    (
        """            9 ->
                facts.withLog { it.copy(productScans = it.productScans + LoggedProductScan(ProductScan.Unreadable, clearedByPharmacist = false)) }""",
        """            9 -> facts.logProduct(LoggedProductScan(ProductScan.Unreadable, clearedByPharmacist = false))""",
    ),
    (
        """            else ->
                facts.withLog { it.copy(productScans = it.productScans + mismatch.copy(scan = MATCHING_PRODUCT.copy(expiry = CLINICAL_DATE.minusDays(1)))) }""",
        """            else -> facts.logProduct(mismatch.copy(scan = MATCHING_PRODUCT.copy(expiry = CLINICAL_DATE.minusDays(1))))""",
    ),
    (
        """                    supplies.copy(patientSuppliedItems = supplies.patientSuppliedItems.map { it.copy(stage = PatientSuppliedStage.RELABELLED) })""",
        """                    supplies.copy(patientSuppliedItems = supplies.patientSuppliedItems.map { it.copy(stage = RELABELLED) })""",
    ),
    (
        """            else ->
                facts.withScans { it.copy(product = MATCHING_PRODUCT.copy(label = ProductLabel.PatientSuppliedRelabel(ITEM, OTHER_PATIENT))) }""",
        """            else -> facts.withProduct(MATCHING_PRODUCT.copy(label = ProductLabel.PatientSuppliedRelabel(ITEM, OTHER_PATIENT)))""",
    ),
    (
        """            1 ->
                facts.withOrder { it.copy(orderedContent = concentration, verifiedProductLine = it.verifiedProductLine?.copy(content = concentration)) }""",
        """            1 -> facts.withTargetContent(concentration)""",
    ),
    (
        """            0 -> facts.withOrder { it.copy(orderedContent = other, verifiedProductLine = it.verifiedProductLine?.copy(content = other)) }""",
        """            0 -> facts.withTargetContent(other)""",
    ),
    (
        """            2 -> facts.withOrder { it.copy(orderedContent = null, verifiedProductLine = it.verifiedProductLine?.copy(content = null)) }""",
        """            2 -> facts.withTargetContent(null)""",
    ),
    (
        """            0 ->
                facts.copy(actor = facts.actor.copy(privileges = facts.actor.privileges - MedicationAdministrationSamples.ADMINISTER_PRIVILEGE))""",
        """            0 -> facts.copy(actor = facts.actor.copy(privileges = facts.actor.privileges - ADMINISTER_PRIVILEGE))""",
    ),
    (
        """            5 ->
                facts.withConfiguration { it.copy(clockSkewAllowance = null) }.withEnvelope { it.copy(issuedAt = RECEIVED_AT.plusSeconds(1)) }""",
        """            5 -> facts.withoutSkewAllowance().withEnvelope { it.copy(issuedAt = RECEIVED_AT.plusSeconds(1)) }""",
    ),
    (
        """            4 -> facts.withConfiguration { it.copy(clockSkewAllowance = null) }.withEnvelope { it.copy(issuedAt = RECEIVED_AT) }""",
        """            4 -> facts.withoutSkewAllowance().withEnvelope { it.copy(issuedAt = RECEIVED_AT) }""",
    ),
    (
        """    // ---- copy helpers
""",
        """    // ---- copy helpers

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
""",
    ),
]
for a, b in R:
    if a not in s:
        print("MISSING:", a[:100])
        continue
    s = s.replace(a, b)
extra = [
    "MedicationAdministrationSamples.ADMINISTER_PRIVILEGE",
    "MedicationAdministrationSamples.ORDERABLE",
    "MedicationAdministrationState.COMPLETED",
    "OrderState.PENDING_VERIFICATION",
    "PatientSuppliedStage.RELABELLED",
    "VerificationStatus.PENDING",
]
imports = "".join(f"import hms.medications.domain.medicationadministration.{e}\n" for e in extra)
s = s.replace("import io.kotest.property.Arb\n", imports + "import io.kotest.property.Arb\n")
open(p, "w", encoding="utf-8", newline="\n").write(s)
