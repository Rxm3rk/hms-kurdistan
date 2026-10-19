// Synthetic sample values (times, serials, indices) are the point of this file; naming each one adds nothing.
@file:Suppress("MagicNumber")

package hms.lis.domain.specimen

import java.math.BigDecimal
import java.time.Duration
import java.time.Instant

/**
 * Synthetic specimen facts for the unit tests and the facts generator (NOT FOR CLINICAL USE). Every identifier is a
 * `SYN-` value. The catalogue values (containers, volumes, stability, HIL limits, retention) are placeholders chosen only
 * to exercise the guards: real values are governed configuration [HUMAN] (§3.4 item 3, §3.5).
 *
 * [baseline] is a consistent fact set in which every main-path predicate holds on the wristband path: an active order,
 * a matching wristband scan, complete labels, an accession from the cell, a collection in the bedside session, transport
 * and receipt scans, every test acceptable and finished with a final result, no retention period and no legal hold.
 * The ending predicates (cancel, reject, loss, entered in error, back-entry, caveat, kit, reprint, override) do not hold.
 */
object SpecimenSamples {
    /** The decision time of every sample. */
    val NOW: Instant = Instant.parse("2026-03-02T10:00:00Z")

    const val SITE: String = "SYN-S1"
    const val DEVICE: String = "SYN-DEV-01"
    const val OTHER_DEVICE: String = "SYN-DEV-02"
    const val USER: String = "SYN-USER-01"
    const val PATIENT_MRN: String = "SYN-MRN-0001"
    const val OTHER_MRN: String = "SYN-MRN-0002"
    const val CONTAINER: String = "SYN-TUBE-A"
    const val OTHER_CONTAINER: String = "SYN-TUBE-B"
    const val ERROR_REASON: String = "SYN-EIE-WRONG-PATIENT"
    const val UNIT: String = "mL"

    /** The specimen's accession number (issued by the cell in [baseline]). */
    val ACCESSION: AccessionNumber = AccessionNumber(SITE, 100_001L)

    /** The device's downtime block, and a number inside it. */
    val DEVICE_BLOCK: AccessionBlock = AccessionBlock(SITE, 900_000L, 900_099L, DEVICE)
    val DOWNTIME_ACCESSION: AccessionNumber = AccessionNumber(SITE, 900_010L)

    /** A kit's block, and a number inside it. */
    val KIT_BLOCK: AccessionBlock = AccessionBlock(SITE, 800_000L, 800_009L, "SYN-KIT-01")
    val KIT_ACCESSION: AccessionNumber = AccessionNumber(SITE, 800_003L)

    /** Times of the bedside session: identification, collection, label scan; then receipt and the acceptability check. */
    val IDENTIFIED_AT: Instant = NOW.minus(Duration.ofMinutes(50))
    val COLLECTED_AT: Instant = NOW.minus(Duration.ofMinutes(45))
    val LABELLED_AT: Instant = NOW.minus(Duration.ofMinutes(44))
    val RECEIVED_AT: Instant = NOW.minus(Duration.ofMinutes(20))
    val CHECKED_AT: Instant = NOW.minus(Duration.ofMinutes(15))

    /** A downtime episode two days back, and the paper collection time inside it. */
    val EPISODE: DowntimeEpisode = DowntimeEpisode(NOW.minus(Duration.ofHours(50)), NOW.minus(Duration.ofHours(44)))
    val PAPER_TIME: Instant = NOW.minus(Duration.ofHours(48))

    /** Synthetic catalogue limits under which [baseline]'s acceptability record passes. */
    val STABILITY: Duration = Duration.ofHours(4)
    val MIN_VOLUME: Volume = Volume(BigDecimal("2.0"), UNIT)
    val VOLUME: Volume = Volume(BigDecimal("3.0"), UNIT)
    const val MAX_INDEX: Int = 2
    const val HIGH_INDEX: Int = 4
    const val RETENTION_DAYS: Long = 7

    val patient: PatientRecord =
        PatientRecord(
            mrn = PATIENT_MRN,
            nameInScript = "SYN-ئاکۆ ڕەشید",
            nameLatin = "SYN-Ako Rashid",
            dateOfBirth = "1980-03-12",
            dateOfBirthApproximate = false,
            mrnIdentity = MrnIdentityAnswer(checkDigitValid = true, status = MrnStatus.CURRENT),
        )

    val wristbandScan: WristbandScan =
        WristbandScan(
            at = IDENTIFIED_AT,
            deviceId = DEVICE,
            entry = EntryMethod.SCANNED,
            source = IdentifierSource.PATIENT_WRISTBAND,
            decodedMrn = PATIENT_MRN,
            confirmation = RecordConfirmation(nameShown = true, dateOfBirthOrApproximateFlagShown = true, confirmedByUser = true),
        )

    val twoIdentifierCheck: TwoIdentifierCheck =
        TwoIdentifierCheck(
            at = IDENTIFIED_AT,
            deviceId = DEVICE,
            method = TwoIdentifierMethod.PATIENT_STATED,
            recordShownOnDevice = true,
            statedNameConfirmed = true,
            statedDateOfBirthConfirmed = true,
            documentReadThroughHal = false,
            documentMatchesPatient = null,
        )

    val labelScan: LabelScan = LabelScan(LABELLED_AT, DEVICE, EntryMethod.SCANNED, ACCESSION)

    val labelContent: LabelContent =
        LabelContent(
            accession = ACCESSION,
            nameInScript = patient.nameInScript,
            nameLatin = patient.nameLatin,
            mrn = PATIENT_MRN,
            dateOfBirth = patient.dateOfBirth,
            approximateDobFlag = false,
            roomOrBedInIdentifierSlot = false,
        )

    val limits: TestLimits =
        TestLimits(
            allowedContainers = setOf(CONTAINER),
            minimumVolume = MIN_VOLUME,
            stabilityLimit = STABILITY,
            maxHaemolysisIndex = MAX_INDEX,
            maxIcterusIndex = MAX_INDEX,
            maxLipaemiaIndex = MAX_INDEX,
            maxClottingGrade = 0,
            waivableCriteria = null,
        )

    val acceptabilityRecord: AcceptabilityRecord =
        AcceptabilityRecord(
            at = CHECKED_AT,
            container = CONTAINER,
            volume = VOLUME,
            haemolysisIndex = 0,
            icterusIndex = 0,
            lipaemiaIndex = 0,
            clottingGrade = 0,
        )

    /** A served test with a final result, no retention period and not a pre-transfusion sample. */
    fun test(code: String): ServedTest =
        ServedTest(
            testCode = code,
            preTransfusionSample = false,
            retention = RetentionRule.NoneSet,
            limits = limits,
            rejectedAtCheck = false,
            resultStates = listOf(ResultState.FINAL),
        )

    /** The active order of [baseline], with two tests. */
    val activeOrder: ServedOrder =
        ServedOrder(
            orderId = "SYN-ORD-0001",
            state = OrderState.ACTIVE,
            resultDerivedFromThisSpecimen = false,
            tests = listOf(test("SYN-TEST-A"), test("SYN-TEST-B")),
        )

    val baseline: SpecimenFacts =
        SpecimenFacts(
            now = NOW,
            commandDeviceId = DEVICE,
            commandMode = CommandMode.CONNECTED_TO_CELL,
            siteAccessionPrefix = SITE,
            patient = patient,
            accession = ACCESSION,
            accessionIssuedByCellService = true,
            usedAccessionNumbers = setOf(AccessionNumber(SITE, 900_001L), AccessionNumber(SITE, 800_001L)),
            downtimeBlocks = listOf(DEVICE_BLOCK, AccessionBlock(SITE, 700_000L, 700_099L, OTHER_DEVICE)),
            servedOrders = listOf(activeOrder),
            specimenType = SpecimenTypeFlags(irreplaceable = false, patientCollected = false),
            session = BedsideSession(listOf(wristbandScan), twoIdentifierCheck = null, labelScans = listOf(labelScan)),
            overrideReason = null,
            labelContent = labelContent,
            kit = null,
            reprint = null,
            authenticatedUserId = USER,
            collector = CollectorRecord(USER, CollectorEntry.SESSION_USER, DEVICE),
            collectionTime = CollectionTime(COLLECTED_AT, confirmedByCollector = true, statedByPatient = false),
            privileges = emptySet(),
            auditWritable = true,
            downtimeEpisodes = listOf(EPISODE),
            paperCollection = null,
            backEntryLabel = null,
            dispatchScan = TransportScan(NOW.minus(Duration.ofMinutes(40)), USER, DEVICE, "SYN-WARD-3", EntryMethod.SCANNED, ACCESSION),
            receiptScan = LabelScan(RECEIVED_AT, "SYN-LAB-DEV", EntryMethod.SCANNED, ACCESSION),
            acceptabilityCheck = acceptabilityRecord,
            caveatReason = null,
            storageScan = StorageScan("SYN-RACK-1", "A1", EntryMethod.SCANNED, USER, NOW.minus(Duration.ofDays(1))),
            storedAt = NOW.minus(Duration.ofDays(1)),
            retentionEngineHold = false,
            forensicMlcHold = false,
            rejectionReason = null,
            lossDeclaration = null,
            errorReason = null,
            governedErrorReasons = setOf(ERROR_REASON),
        )

    /** [facts] on the reported identity-override path: no band decoded, a stated two-identifier check, a chosen reason. */
    fun onOverridePath(
        facts: SpecimenFacts,
        reason: IdentityOverrideReason = IdentityOverrideReason.NO_WRISTBAND,
    ): SpecimenFacts =
        facts.copy(
            session = BedsideSession(emptyList(), twoIdentifierCheck, listOf(labelScan)),
            overrideReason = Choice(reason, chosenByUser = true),
        )

    /** [facts] with a paper downtime collection ready for back-entry: privilege, audit, paper entry and label scan. */
    fun withBackEntry(facts: SpecimenFacts): SpecimenFacts =
        facts.copy(
            privileges = facts.privileges + SpecimenPrivilege.DOWNTIME_BACK_ENTRY_LAB_COLLECTION,
            paperCollection = PaperCollection("SYN-NURSE-07", PAPER_TIME, PAPER_TIME, labelledAsBackEntry = true),
            backEntryLabel = BackEntryLabel(LabelScan(NOW, DEVICE, EntryMethod.SCANNED, facts.accession), identifiersConfirmed = true),
        )

    /** [facts] with alias-kit labels from the kit's block, bound to the specimen patient. */
    fun withKit(facts: SpecimenFacts): SpecimenFacts =
        facts.copy(kit = KitLabels(KIT_BLOCK, listOf(LabelScan(LABELLED_AT, DEVICE, EntryMethod.SCANNED, KIT_ACCESSION)), true))

    /** [facts] with a reprint that has a chosen reason and carries the existing accession number. */
    fun withReprint(facts: SpecimenFacts): SpecimenFacts =
        facts.copy(reprint = ReprintRecord(Choice("SYN-PRINTER-JAM", chosenByUser = true), USER, DEVICE, NOW, facts.accession))

    /** [facts] with the entered-in-error privilege and a governed reason the user chose. */
    fun withEnteredInError(facts: SpecimenFacts): SpecimenFacts =
        facts.copy(
            privileges = facts.privileges + SpecimenPrivilege.SPECIMEN_ENTERED_IN_ERROR,
            errorReason = Choice(ERROR_REASON, chosenByUser = true),
        )

    /** [facts] whose every order is revoked. */
    fun withOrdersRevoked(facts: SpecimenFacts): SpecimenFacts =
        facts.copy(servedOrders = facts.servedOrders.map { it.copy(state = OrderState.REVOKED) })

    /** [facts] with every test's acceptability limits replaced by [limits]. */
    fun withLimits(
        facts: SpecimenFacts,
        limits: (ServedTest) -> TestLimits,
    ): SpecimenFacts = mapTests(facts) { it.copy(limits = limits(it)) }

    /** [facts] with every served test transformed by [change]. */
    fun mapTests(
        facts: SpecimenFacts,
        change: (ServedTest) -> ServedTest,
    ): SpecimenFacts = facts.copy(servedOrders = facts.servedOrders.map { order -> order.copy(tests = order.tests.map(change)) })
}
