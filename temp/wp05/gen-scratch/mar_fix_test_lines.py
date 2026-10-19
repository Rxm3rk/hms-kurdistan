import sys

p = sys.argv[1]
s = open(p, encoding="utf-8").read()
R = [
    ("import hms.medications.domain.medicationadministration.MedicationAdministrationSamples.MRN\n", ""),
    (
        "private fun Facts.withConfig(change: GovernedConfiguration.() -> GovernedConfiguration): Facts = copy(configuration = configuration.change())",
        "private fun Facts.withConfig(change: GovernedConfiguration.() -> GovernedConfiguration): Facts =\n    copy(configuration = configuration.change())",
    ),
    (
        "    withOrder { copy(state = OrderState.PENDING_VERIFICATION, verificationStatus = VerificationStatus.PENDING, verifiedAt = null, verifiedProductLine = null) }",
        "    withOrder {\n        copy(state = OrderState.PENDING_VERIFICATION, verificationStatus = VerificationStatus.PENDING, verifiedAt = null, verifiedProductLine = null)\n    }",
    ),
    (
        "            guards.firstDoseOfOrder(give.copy(dose = give.dose.copy(otherDoses = listOf(thisDoseListed, unrelated, eieNeverGiven)))) shouldBe true",
        "            guards.firstDoseOfOrder(give.withOtherDoses(listOf(thisDoseListed, unrelated, eieNeverGiven))) shouldBe true",
    ),
    (
        "                guards.firstDoseOfOrder(give.copy(dose = give.dose.copy(otherDoses = give.dose.otherDoses.orEmpty() + given))) shouldBe false",
        "                guards.firstDoseOfOrder(give.withOtherDoses(give.dose.otherDoses.orEmpty() + given)) shouldBe false",
    ),
    (
        "            guards.firstDoseOfOrder(give.copy(dose = give.dose.copy(otherDoses = null))) shouldBe false",
        "            guards.firstDoseOfOrder(give.withOtherDoses(null)) shouldBe false",
    ),
    (
        'test("administeringUserPrivileged fails without the privilege, for an unknown requirement, a non-human or unauthenticated principal")',
        'test("administeringUserPrivileged fails without the privilege, for an unknown requirement, a non-human or unauthenticated user")',
    ),
    (
        "            val others = PrincipalKind.entries.filter { it != PrincipalKind.HUMAN }.map { kind -> give.withActor { copy(principal = kind) } }",
        "            val nonHuman = PrincipalKind.entries.filter { it != PrincipalKind.HUMAN }\n            val others = nonHuman.map { kind -> give.withActor { copy(principal = kind) } }",
    ),
    (
        "            guards.authenticatedClinicalUser(give.withConfig { copy(administrationPrivilege = null) }.withActor { copy(privileges = emptySet()) }) shouldBe\n                true",
        "            val unconfigured = give.withConfig { copy(administrationPrivilege = null) }.withActor { copy(privileges = emptySet()) }\n            guards.authenticatedClinicalUser(unconfigured) shouldBe true",
    ),
    (
        "            guards.wristbandScanUnusable(give.withBand(null).withLog { copy(wristbandScans = listOf(MATCHING_WRISTBAND, unreadableBand)) }) shouldBe\n                true",
        "            val ownScansOnly = give.withBand(null).withLog { copy(wristbandScans = listOf(MATCHING_WRISTBAND, unreadableBand)) }\n            guards.wristbandScanUnusable(ownScansOnly) shouldBe true",
    ),
    (
        "            listOf(null, unreadableBand, MERGED_WRISTBAND, OTHER_PATIENT_WRISTBAND, MATCHING_WRISTBAND, MATCHING_WRISTBAND.copy(labelKind = null))\n",
        "            val bedLabel = MATCHING_WRISTBAND.copy(labelKind = LabelKind.BED)\n            listOf(null, unreadableBand, MERGED_WRISTBAND, OTHER_PATIENT_WRISTBAND, MATCHING_WRISTBAND, bedLabel)\n",
    ),
    (
        "            guards.manualTwoIdentifiersConfirmed(approximate.withManual { copy(keyedDateOfBirth = null, approximateDobConfirmed = true) }) shouldBe\n                true",
        "            val confirmedFlag = approximate.withManual { copy(keyedDateOfBirth = null, approximateDobConfirmed = true) }\n            guards.manualTwoIdentifiersConfirmed(confirmedFlag) shouldBe true",
    ),
    (
        "            guards.productIdentityMatches(give.withEnvelope { copy(issuedAt = null) }.withProduct(MATCHING_PRODUCT.copy(expiry = null))) shouldBe true",
        "            val noClinicalTime = give.withEnvelope { copy(issuedAt = null) }\n            guards.productIdentityMatches(noClinicalTime.withProduct(MATCHING_PRODUCT.copy(expiry = null))) shouldBe true",
    ),
    (
        '            listOf(null, ProductScan.Unreadable, ProductScan.NotMapped("SYN-GTIN"), MATCHING_PRODUCT, MATCHING_PRODUCT.copy(productId = OTHER_PRODUCT))\n',
        '            val wrongProduct = MATCHING_PRODUCT.copy(productId = OTHER_PRODUCT)\n            listOf(null, ProductScan.Unreadable, ProductScan.NotMapped("SYN-GTIN"), MATCHING_PRODUCT, wrongProduct)\n',
    ),
    (
        "                    .withSupplies { copy(patientSuppliedItems = patientSuppliedItems.map { it.copy(stage = PatientSuppliedStage.RELABELLED) }) }",
        "                    .withSupplies { copy(patientSuppliedItems = patientSuppliedItems.map { it.copy(stage = RELABELLED) }) }",
    ),
    (
        "            guards.highAlertCheckSatisfied(give.highAlert().overrideSupply(named).withCheck { copy(productId = null, lot = null, namedSupply = named) }) shouldBe\n                true",
        "            val onOverride = give.highAlert().overrideSupply(named).withCheck { copy(productId = null, lot = null, namedSupply = named) }\n            guards.highAlertCheckSatisfied(onOverride) shouldBe true",
    ),
    (
        'test("highAlertCheckSatisfied fails for a check by the administering user or an unauthenticated, unprivileged or unattesting checker")',
        'test("highAlertCheckSatisfied fails for a check by the administering user, or an unauthenticated, unprivileged or silent checker")',
    ),
    (
        "                give.highAlert().overrideSupply(NamedSupply.Dispense(DISPENSE)).withCheck { copy(namedSupply = NamedSupply.WardStock(WARD_PRODUCT)) },",
        "                give\n                    .highAlert()\n                    .overrideSupply(NamedSupply.Dispense(DISPENSE))\n                    .withCheck { copy(namedSupply = NamedSupply.WardStock(WARD_PRODUCT)) },",
    ),
    (
        "            guards.highAlertCheckSatisfied(earlyScan.withCheck { copy(recordedAt = ISSUED_AT.minus(DOUBLE_CHECK_WINDOW).minusSeconds(1)) }) shouldBe false",
        "            val windowStart = ISSUED_AT.minus(DOUBLE_CHECK_WINDOW)\n            guards.highAlertCheckSatisfied(earlyScan.withCheck { copy(recordedAt = windowStart.minusSeconds(1)) }) shouldBe false",
    ),
    (
        "            guards.highAlertCheckSatisfied(give.highAlert().withCheck { copy(checkerUserId = CHECKER, recordedAt = CHECKED_AT) }) shouldBe true",
        "            val valid = give.highAlert().withCheck { copy(checkerUserId = CHECKER, recordedAt = CHECKED_AT) }\n            guards.highAlertCheckSatisfied(valid) shouldBe true",
    ),
    (
        "            guards.backEntryDocumented(give.withEntries { copy(backEntry = backEntry?.copy(paperClinicalTime = RECEIVED_AT)) }) shouldBe true",
        "            val atReceipt = give.withEntries { copy(backEntry = backEntry?.copy(paperClinicalTime = RECEIVED_AT)) }\n            guards.backEntryDocumented(atReceipt) shouldBe true",
    ),
    (
        "private fun mg(value: String): DoseQuantity",
        "private fun Facts.withOtherDoses(doses: List<OtherDose>?): Facts = copy(dose = dose.copy(otherDoses = doses))\n\nprivate fun mg(value: String): DoseQuantity",
    ),
    (
        "import io.kotest.core.spec.style.FunSpec\n",
        "import hms.medications.domain.medicationadministration.PatientSuppliedStage.RELABELLED\nimport io.kotest.core.spec.style.FunSpec\n",
    ),
]
for a, b in R:
    if a not in s:
        print("MISSING:", a[:110])
        continue
    s = s.replace(a, b)
open(p, "w", encoding="utf-8", newline="\n").write(s)
