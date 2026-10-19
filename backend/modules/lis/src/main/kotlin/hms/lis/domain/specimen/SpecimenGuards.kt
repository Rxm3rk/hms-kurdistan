package hms.lis.domain.specimen

import java.time.Duration
import java.time.Instant

/**
 * The single implementation of the specimen machine's guard predicates (docs/specs/state-machines/specimen.yaml; WP-0.5
 * spec §2.1 rule 12, §3.1). Each predicate is a pure, total function of [SpecimenFacts] that implements its YAML
 * description; an unknown answer (a null fact) fails closed wherever the description says so. The exact-complement
 * pairs (`acceptableForEveryTest` / `notAcceptableForEveryTest`, `noTestNeedsRecollection` / `testNeedsRecollection`)
 * are literal negations of one private function, so the two can never hold together. There is no dose or volume
 * arithmetic: volumes are compared exactly and only in the same unit (§2.1 SI-05); the only arithmetic is on time.
 */
@Suppress("TooManyFunctions") // One function per predicate of the generated interface (37), plus their private helpers.
object SpecimenGuards : SpecimenPredicates {
    // --- Orders (DN-054 items 8, 9) -----------------------------------------------------------------------------

    override fun servedOrderActive(facts: SpecimenFacts): Boolean = facts.servedOrders.any { it.state == OrderState.ACTIVE }

    override fun servedOrdersEnded(facts: SpecimenFacts): Boolean =
        facts.servedOrders.isNotEmpty() && facts.servedOrders.all { orderEndedForThisSpecimen(it) }

    // --- Identification (SI-01; DN-054 items 3, 4) ---------------------------------------------------------------

    override fun wristbandScanMatches(facts: SpecimenFacts): Boolean {
        val scan = facts.session?.wristbandScans?.lastOrNull() ?: return false
        val confirmation = scan.confirmation
        return scan.entry == EntryMethod.SCANNED &&
            scan.source == IdentifierSource.PATIENT_WRISTBAND &&
            scan.decodedMrn != null &&
            scan.decodedMrn == facts.patient.mrn &&
            mrnValidAndCurrent(facts.patient) &&
            confirmation != null &&
            confirmation.nameShown &&
            confirmation.dateOfBirthOrApproximateFlagShown &&
            confirmation.confirmedByUser
    }

    override fun noUsableWristband(facts: SpecimenFacts): Boolean {
        val session = facts.session ?: return false
        return facts.overrideReason != null && session.wristbandScans.none { it.decodedMrn != null }
    }

    override fun twoIdentifiersActivelyConfirmed(facts: SpecimenFacts): Boolean {
        val check = facts.session?.twoIdentifierCheck ?: return false
        val confirmed =
            when (check.method) {
                TwoIdentifierMethod.PATIENT_STATED ->
                    check.recordShownOnDevice && check.statedNameConfirmed && check.statedDateOfBirthConfirmed
                TwoIdentifierMethod.IDENTITY_DOCUMENT -> check.documentReadThroughHal && check.documentMatchesPatient == true
                TwoIdentifierMethod.ROOM_BED_OR_LOCATION -> false
            }
        return confirmed && mrnValidAndCurrent(facts.patient)
    }

    override fun identityOverrideReasonChosen(facts: SpecimenFacts): Boolean = facts.overrideReason?.chosenByUser == true

    override fun notTransfusionSample(facts: SpecimenFacts): Boolean {
        val tests = servedTests(facts)
        return tests.isNotEmpty() && tests.all { (_, test) -> test.preTransfusionSample == false }
    }

    // --- Labels and accession numbers (SI-01, SI-15; DN-054 items 5, 10) -----------------------------------------

    override fun labelIdentifiersComplete(facts: SpecimenFacts): Boolean {
        val label = facts.labelContent ?: return false
        val patient = facts.patient
        return label.accession != null &&
            label.accession == facts.accession &&
            nameOnLabelIsPatients(label, patient) &&
            label.mrn == patient.mrn &&
            patient.mrnIdentity.checkDigitValid == true &&
            dateOfBirthOnLabelIsPatients(label, patient) &&
            !label.roomOrBedInIdentifierSlot
    }

    override fun accessionFromPermittedSource(facts: SpecimenFacts): Boolean {
        val accession = facts.accession
        val mode = facts.commandMode
        return when {
            accession == null || mode == null -> false
            mode.offline -> unusedInBlock(facts, accession) { block -> block.assignedTo == facts.commandDeviceId }
            else -> facts.accessionIssuedByCellService
        }
    }

    override fun kitAccessionFromAllocatedBlock(facts: SpecimenFacts): Boolean {
        val kit = facts.kit ?: return false
        return kit.block.sitePrefix == facts.siteAccessionPrefix &&
            kit.labelScans.isNotEmpty() &&
            kit.labelScans.all { scan -> kitLabelUsable(facts, kit.block, scan) } &&
            kit.kitIdentityIsSpecimenPatient == true
    }

    override fun reprintReasonChosen(facts: SpecimenFacts): Boolean {
        val reprint = facts.reprint ?: return false
        return chosenText(reprint.reason) &&
            !reprint.userId.isNullOrBlank() &&
            !reprint.deviceId.isNullOrBlank() &&
            reprint.at != null &&
            reprint.labelAccession != null &&
            reprint.labelAccession == facts.accession
    }

    // --- Collection (§8.4; SI-10; SAC-09; DN-054 items 6, 15) ----------------------------------------------------

    override fun collectorIdentified(facts: SpecimenFacts): Boolean {
        val collector = facts.collector ?: return false
        return collector.entry == CollectorEntry.SESSION_USER &&
            !collector.userId.isNullOrBlank() &&
            collector.userId == facts.authenticatedUserId &&
            !collector.deviceId.isNullOrBlank()
    }

    override fun collectionTimeRecorded(facts: SpecimenFacts): Boolean {
        val time = facts.collectionTime
        val sessionStart = identification(facts)?.at
        return when {
            time == null || sessionStart == null -> false
            !time.confirmedByCollector || time.clinical.isAfter(facts.now) -> false
            facts.specimenType.patientCollected == true -> time.statedByPatient && !time.clinical.isAfter(sessionStart)
            else -> !time.clinical.isBefore(sessionStart)
        }
    }

    override fun labelledAtBedside(facts: SpecimenFacts): Boolean {
        val identified = identification(facts)
        val accession = facts.accession
        if (identified == null || accession == null) return false
        return facts.session?.labelScans.orEmpty().any { scan ->
            scan.entry == EntryMethod.SCANNED &&
                scan.deviceId == identified.deviceId &&
                scan.at.isAfter(identified.at) &&
                scan.accession == accession
        }
    }

    // --- Downtime back-entry (SI-10 clauses b, c; SI-15 clause c; DN-054 item 10) --------------------------------

    override fun downtimeBackEntryAllowed(facts: SpecimenFacts): Boolean {
        val clinical = facts.paperCollection?.clinicalTime ?: return false
        return SpecimenPrivilege.DOWNTIME_BACK_ENTRY_LAB_COLLECTION in facts.privileges &&
            facts.downtimeEpisodes.any { it.covers(clinical) } &&
            facts.auditWritable == true
    }

    override fun paperCollectionRecorded(facts: SpecimenFacts): Boolean {
        val paper = facts.paperCollection
        val paperTime = paper?.paperTime
        if (paper == null || paperTime == null) return false
        return !paper.collectorIdentity.isNullOrBlank() &&
            paper.clinicalTime == paperTime &&
            facts.downtimeEpisodes.any { it.covers(paperTime) } &&
            !paperTime.isAfter(facts.now) &&
            paper.labelledAsBackEntry
    }

    override fun downtimeLabelConfirmed(facts: SpecimenFacts): Boolean {
        val label = facts.backEntryLabel
        val scanned = label?.scan?.accession
        if (label == null || scanned == null) return false
        val existing = facts.accession
        val accessionMatches =
            if (existing != null) {
                scanned == existing
            } else {
                unusedInBlock(facts, scanned) { true }
            }
        return label.scan.entry == EntryMethod.SCANNED && accessionMatches && label.identifiersConfirmed
    }

    // --- Transport and receipt (§9.8) -----------------------------------------------------------------------------

    override fun dispatchScanRecorded(facts: SpecimenFacts): Boolean {
        val scan = facts.dispatchScan ?: return false
        return scan.entry == EntryMethod.SCANNED &&
            scan.at != null &&
            !scan.userId.isNullOrBlank() &&
            !scan.deviceId.isNullOrBlank() &&
            !scan.location.isNullOrBlank() &&
            scan.accession != null &&
            scan.accession == facts.accession
    }

    override fun receiptScanMatchesOrder(facts: SpecimenFacts): Boolean = receiptLabelMatched(facts) && facts.servedOrders.isNotEmpty()

    // --- Acceptability (§9.8; SI-10; DN-054 item 11) -------------------------------------------------------------

    override fun acceptableForEveryTest(facts: SpecimenFacts): Boolean = acceptableForEvery(facts)

    override fun notAcceptableForEveryTest(facts: SpecimenFacts): Boolean = !acceptableForEvery(facts)

    override fun acceptableForSomeTest(facts: SpecimenFacts): Boolean =
        checkRecordedAtOrAfterReceipt(facts) && eligibleTests(facts).any { failedCriteria(facts, it).isEmpty() }

    override fun caveatAuthorised(facts: SpecimenFacts): Boolean =
        SpecimenPrivilege.ACCEPT_WITH_CAVEAT in facts.privileges && facts.auditWritable == true

    override fun caveatAllowedForSpecimen(facts: SpecimenFacts): Boolean {
        val eligible = eligibleTests(facts)
        if (!checkRecordedAtOrAfterReceipt(facts) || eligible.isEmpty()) return false
        val failedPerTest = eligible.associateWith { failedCriteria(facts, it) }
        val labelNeverWaived = failedPerTest.values.none { AcceptabilityCriterion.LABEL in it }
        val waivable =
            facts.specimenType.irreplaceable == true ||
                failedPerTest.all { (test, failed) -> test.limits.waivableCriteria.orEmpty().containsAll(failed) }
        return labelNeverWaived && waivable
    }

    override fun caveatReasonChosen(facts: SpecimenFacts): Boolean = chosenText(facts.caveatReason)

    // --- End of testing (DN-054 item 12) --------------------------------------------------------------------------

    override fun allTestsFinished(facts: SpecimenFacts): Boolean {
        val tests = servedTests(facts)
        return tests.isNotEmpty() && tests.all { (order, test) -> testFinished(order, test) }
    }

    override fun noTestNeedsRecollection(facts: SpecimenFacts): Boolean = !someTestNeedsRecollection(facts)

    override fun testNeedsRecollection(facts: SpecimenFacts): Boolean = someTestNeedsRecollection(facts)

    // --- Storage, retention, disposal (§9.27; §13 DP-9; DN-054 items 7, 13) --------------------------------------

    override fun storageLocationScanned(facts: SpecimenFacts): Boolean {
        val scan = facts.storageScan ?: return false
        return scan.entry == EntryMethod.SCANNED &&
            !scan.rack.isNullOrBlank() &&
            !scan.position.isNullOrBlank() &&
            !scan.userId.isNullOrBlank() &&
            scan.at != null
    }

    override fun retentionNotRequired(facts: SpecimenFacts): Boolean {
        val tests = servedTests(facts)
        return tests.isNotEmpty() && tests.all { (_, test) -> test.retention == RetentionRule.NoneSet }
    }

    override fun retentionElapsed(facts: SpecimenFacts): Boolean {
        val storedAt = facts.storedAt
        val longest = longestRetention(facts)
        return storedAt != null && longest != null && !facts.now.isBefore(storedAt.plus(longest))
    }

    override fun noLegalHold(facts: SpecimenFacts): Boolean = facts.retentionEngineHold == false && facts.forensicMlcHold == false

    // --- Rejection, loss, entered in error (DN-054 items 1, 2, 8, 14) --------------------------------------------

    override fun rejectionReasonChosen(facts: SpecimenFacts): Boolean = facts.rejectionReason?.chosenByUser == true

    override fun labelDefectReasonChosen(facts: SpecimenFacts): Boolean {
        val reason = facts.rejectionReason ?: return false
        return reason.chosenByUser && reason.value.labelDefect
    }

    override fun lossDeclared(facts: SpecimenFacts): Boolean {
        val declaration = facts.lossDeclaration ?: return false
        return !declaration.declaredByUserId.isNullOrBlank() &&
            declaration.at != null &&
            declaration.lastScanEventShown &&
            !declaration.raisedAutomatically
    }

    override fun privilegedAndAudited(facts: SpecimenFacts): Boolean =
        SpecimenPrivilege.SPECIMEN_ENTERED_IN_ERROR in facts.privileges && facts.auditWritable == true

    override fun errorReasonEntered(facts: SpecimenFacts): Boolean {
        val reason = facts.errorReason
        val governed = facts.governedErrorReasons
        return reason != null && governed != null && reason.chosenByUser && reason.value in governed
    }

    // --- Private helpers -----------------------------------------------------------------------------------------

    /** Order states in which an order no longer counts (revoked or entered in error; order.yaml). */
    private val withdrawnOrderStates: Set<OrderState> = setOf(OrderState.REVOKED, OrderState.ENTERED_IN_ERROR)

    /** Order states that close an order (order.yaml terminal states). */
    private val closedOrderStates: Set<OrderState> = withdrawnOrderStates + OrderState.COMPLETED

    /** Result states with a released value from this specimen (result.yaml). */
    private val releasedResultStates: Set<ResultState> = setOf(ResultState.FINAL, ResultState.AMENDED, ResultState.CORRECTED)

    /** Result states that withdrew a result without a value (result.yaml). */
    private val withdrawnResultStates: Set<ResultState> = setOf(ResultState.CANCELLED, ResultState.ENTERED_IN_ERROR)

    /** Where the session identified the patient, and when. */
    private data class Identified(
        val at: Instant,
        val deviceId: String,
    )

    /** The order is revoked or entered in error, or completed with no result from this specimen (unknown: not ended). */
    private fun orderEndedForThisSpecimen(order: ServedOrder): Boolean =
        order.state in withdrawnOrderStates ||
            (order.state == OrderState.COMPLETED && order.resultDerivedFromThisSpecimen == false)

    /** The identity service confirms the MRN's check digit and that it is current, neither merged nor retired (SI-08). */
    private fun mrnValidAndCurrent(patient: PatientRecord): Boolean =
        patient.mrnIdentity.checkDigitValid == true && patient.mrnIdentity.status == MrnStatus.CURRENT

    /**
     * The identification that opened this bedside session: its first wristband read that decoded an MRN, which must be
     * the specimen patient's (a session opened by another patient's band never identifies this one); or, when no band
     * decoded, the active two-identifier check. Null when the session identified no one.
     */
    private fun identification(facts: SpecimenFacts): Identified? {
        val session = facts.session ?: return null
        val firstDecoded = session.wristbandScans.firstOrNull { it.decodedMrn != null }
        val check = session.twoIdentifierCheck
        return when {
            firstDecoded != null ->
                firstDecoded.takeIf { it.decodedMrn == facts.patient.mrn }?.let { Identified(it.at, it.deviceId) }
            check != null -> Identified(check.at, check.deviceId)
            else -> null
        }
    }

    /** Both name forms are on the label and are the patient's (SI-01 clause a). */
    private fun nameOnLabelIsPatients(
        label: LabelContent,
        patient: PatientRecord,
    ): Boolean =
        !label.nameInScript.isNullOrBlank() &&
            label.nameInScript == patient.nameInScript &&
            !label.nameLatin.isNullOrBlank() &&
            label.nameLatin == patient.nameLatin

    /** The label carries the recorded date of birth at its precision, or the approximate-DOB flag of an approximate record. */
    private fun dateOfBirthOnLabelIsPatients(
        label: LabelContent,
        patient: PatientRecord,
    ): Boolean {
        val exact = !label.dateOfBirth.isNullOrBlank() && label.dateOfBirth == patient.dateOfBirth
        val approximate = patient.dateOfBirthApproximate && label.approximateDobFlag
        return exact || approximate
    }

    /** [number] lies in a site-prefixed downtime block that [assigned] accepts and is bound to no other specimen. */
    private fun unusedInBlock(
        facts: SpecimenFacts,
        number: AccessionNumber,
        assigned: (AccessionBlock) -> Boolean,
    ): Boolean =
        number !in facts.usedAccessionNumbers &&
            facts.downtimeBlocks.any { block ->
                block.sitePrefix == facts.siteAccessionPrefix && assigned(block) && block.contains(number)
            }

    /** A kit label was scanned (never typed) and lies, unused, in the kit's block. */
    private fun kitLabelUsable(
        facts: SpecimenFacts,
        block: AccessionBlock,
        scan: LabelScan,
    ): Boolean {
        val number = scan.accession ?: return false
        return scan.entry == EntryMethod.SCANNED && block.contains(number) && number !in facts.usedAccessionNumbers
    }

    /** A value chosen by the user (the channel adapter's mark), not blank. */
    private fun chosenText(choice: Choice<String>?): Boolean = choice != null && choice.chosenByUser && choice.value.isNotBlank()

    /** The label was scanned (never typed) at receipt and carries this specimen's accession number. */
    private fun receiptLabelMatched(facts: SpecimenFacts): Boolean {
        val scan = facts.receiptScan ?: return false
        return scan.entry == EntryMethod.SCANNED && scan.accession != null && scan.accession == facts.accession
    }

    /** Every test the specimen serves, with its order. */
    private fun servedTests(facts: SpecimenFacts): List<Pair<ServedOrder, ServedTest>> =
        facts.servedOrders.flatMap { order -> order.tests.map { order to it } }

    /** The eligible tests: those whose order is not revoked or entered in error (an unknown order state stays eligible). */
    private fun eligibleTests(facts: SpecimenFacts): List<ServedTest> =
        servedTests(facts).filter { (order, _) -> order.state !in withdrawnOrderStates }.map { it.second }

    /** An acceptability check was recorded at or after the receipt scan. */
    private fun checkRecordedAtOrAfterReceipt(facts: SpecimenFacts): Boolean {
        val check = facts.acceptabilityCheck
        val receipt = facts.receiptScan
        return check != null && receipt != null && !check.at.isBefore(receipt.at)
    }

    /** acceptableForEveryTest; notAcceptableForEveryTest is its literal negation. */
    private fun acceptableForEvery(facts: SpecimenFacts): Boolean {
        val eligible = eligibleTests(facts)
        return checkRecordedAtOrAfterReceipt(facts) && eligible.isNotEmpty() && eligible.all { failedCriteria(facts, it).isEmpty() }
    }

    /** The criteria [test] fails on this specimen; an unknown recorded or catalogue value fails its criterion. */
    private fun failedCriteria(
        facts: SpecimenFacts,
        test: ServedTest,
    ): Set<AcceptabilityCriterion> {
        val record = facts.acceptabilityCheck ?: return AcceptabilityCriterion.entries.toSet()
        val limits = test.limits
        return buildSet {
            if (!containerAllowed(record.container, limits.allowedContainers)) add(AcceptabilityCriterion.CONTAINER)
            if (!volumeAtLeast(record.volume, limits.minimumVolume)) add(AcceptabilityCriterion.VOLUME)
            if (!withinStability(facts, limits.stabilityLimit)) add(AcceptabilityCriterion.STABILITY)
            if (!within(record.haemolysisIndex, limits.maxHaemolysisIndex)) add(AcceptabilityCriterion.HAEMOLYSIS)
            if (!within(record.icterusIndex, limits.maxIcterusIndex)) add(AcceptabilityCriterion.ICTERUS)
            if (!within(record.lipaemiaIndex, limits.maxLipaemiaIndex)) add(AcceptabilityCriterion.LIPAEMIA)
            if (!within(record.clottingGrade, limits.maxClottingGrade)) add(AcceptabilityCriterion.CLOTTING)
            if (!receiptLabelMatched(facts)) add(AcceptabilityCriterion.LABEL)
        }
    }

    private fun containerAllowed(
        container: String?,
        allowed: Set<String>?,
    ): Boolean = container != null && allowed != null && container in allowed

    /** Exact comparison in the same unit; a different unit is not converted and fails (SI-05). */
    private fun volumeAtLeast(
        volume: Volume?,
        minimum: Volume?,
    ): Boolean = volume != null && minimum != null && volume.unit == minimum.unit && volume.amount >= minimum.amount

    /** The time from the clinical collection time to now is within the limit, both ends included (SI-10). */
    private fun withinStability(
        facts: SpecimenFacts,
        limit: Duration?,
    ): Boolean {
        val clinical = facts.collectionTime?.clinical
        return clinical != null && limit != null && !clinical.isAfter(facts.now) && Duration.between(clinical, facts.now) <= limit
    }

    private fun within(
        recorded: Int?,
        maximum: Int?,
    ): Boolean = recorded != null && maximum != null && recorded <= maximum

    /** A test has finished on this specimen (DN-054 item 12); a preliminary result does not count. */
    private fun testFinished(
        order: ServedOrder,
        test: ServedTest,
    ): Boolean =
        test.resultStates.any { it in releasedResultStates || it in withdrawnResultStates } ||
            test.rejectedAtCheck ||
            order.state in withdrawnOrderStates

    /** noTestNeedsRecollection is its literal negation; an unknown order state counts as open. */
    private fun someTestNeedsRecollection(facts: SpecimenFacts): Boolean =
        servedTests(facts).any { (order, test) ->
            order.state !in closedOrderStates &&
                test.resultStates.any { it in withdrawnResultStates } &&
                test.resultStates.none { it in releasedResultStates }
        }

    /** The longest catalogue retention period of the tests served; null when unknown or when the specimen serves no test. */
    private fun longestRetention(facts: SpecimenFacts): Duration? {
        val rules = servedTests(facts).map { it.second.retention }
        if (rules.isEmpty() || rules.any { it == null }) return null
        return rules.filterIsInstance<RetentionRule.Period>().maxOfOrNull { it.duration } ?: Duration.ZERO
    }
}
