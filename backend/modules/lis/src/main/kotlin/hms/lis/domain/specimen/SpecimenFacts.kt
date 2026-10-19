package hms.lis.domain.specimen

import java.math.BigDecimal
import java.time.Duration
import java.time.Instant

// The facts the specimen machine's predicates read (docs/specs/state-machines/specimen.yaml; WP-0.5 spec
// docs/specs/modules/state-machines-and-invariants.md §3.1 "Facts, not aggregates"). Pure values: java.time only, no
// framework types, no system clock (time arrives as data). A fact owned by another module (the orders and results
// modules' states, the identity service's MRN answers, the Trust Plane's privileges and audit availability, the test
// catalogue, the channel adapter's "chosen" mark) is that module's answer, and a null value means the answer is
// unknown: every predicate that reads it fails closed. No money fact is read anywhere (SI-12).

/**
 * The facts one specimen command is decided on (specimen.yaml; DN-054). The aggregate that assembles them does not
 * exist yet (KA-062): the property tests draw them from `SpecimenArbs.facts`.
 *
 * @property now The time the command is decided, as data: the recording (system) time of the command, and "now" for the
 *   stability limit and the retention period (SI-10 keeps it apart from the clinical collection time).
 * @property commandDeviceId The device the command was issued on.
 * @property commandMode The connectivity mode in which the command was issued, from its offline envelope (SI-15); null
 *   when unknown.
 * @property siteAccessionPrefix This site's accession prefix: downtime and kit blocks must carry it (SI-15 clause c).
 * @property patient The specimen patient's record, with the identity service's answer for its MRN.
 * @property accession The specimen's accession number; null when it has none.
 * @property accessionIssuedByCellService True when the cell's accession service issued [accession] (its issuance record).
 * @property usedAccessionNumbers Accession numbers already bound to another specimen, as the accession register (online)
 *   or the device's block ledger (offline) records them.
 * @property downtimeBlocks The site's pre-allocated downtime accession blocks, each with the device or kit it is assigned to.
 * @property servedOrders Every order the specimen serves, with the tests it requests on this specimen.
 * @property specimenType The test catalogue's flags for the specimen type (governed configuration [HUMAN]).
 * @property session The bedside session the command was issued in; null when it was issued outside one.
 * @property overrideReason The user's record that the patient wears no wristband or that it cannot be read.
 * @property labelContent The content of the labels printed, reprinted or bound by this command.
 * @property kit The alias or downtime kit whose labels this command binds (DN-054 item 5).
 * @property reprint The reprint record of a ReprintLabels command.
 * @property authenticatedUserId The authenticated user of the command's session (the Trust Plane's answer).
 * @property collector The collector recorded with a collection.
 * @property collectionTime The specimen's clinical collection time (SI-10): entered by a collection command, or as recorded.
 * @property privileges The privileges the user holds for this laboratory (the Trust Plane's answer; §9.26). Empty when unknown.
 * @property auditWritable Whether the audit record can be written with the command; null when unknown.
 * @property downtimeEpisodes The platform-site records of cell or device outages (§16.3).
 * @property paperCollection The back-entry of a paper downtime collection (SI-10 clause c).
 * @property backEntryLabel The tube-label scan made at back-entry.
 * @property dispatchScan The transport scan made at dispatch (§9.8).
 * @property receiptScan The label scan made at laboratory receipt (§9.8 acceptance 1); also the receipt time.
 * @property acceptabilityCheck The acceptability check recorded for the specimen (§9.8).
 * @property caveatReason The reason for accepting with a caveat.
 * @property storageScan The storage-location scan (§9.8).
 * @property storedAt The recorded storage time.
 * @property retentionEngineHold The retention and legal-hold engine's answer: a hold applies (§9.27; §13 DP-9).
 * @property forensicMlcHold Whether the SI-21 forensic/MLC label places a hold on the case.
 * @property rejectionReason The coded rejection reason (DN-054 item 2).
 * @property lossDeclaration The declaration that the specimen is lost.
 * @property errorReason The entered-in-error reason.
 * @property governedErrorReasons The governed list of entered-in-error reasons (content [HUMAN]); null when unknown.
 */
data class SpecimenFacts(
    val now: Instant,
    val commandDeviceId: String,
    val commandMode: CommandMode?,
    val siteAccessionPrefix: String,
    val patient: PatientRecord,
    val accession: AccessionNumber?,
    val accessionIssuedByCellService: Boolean,
    val usedAccessionNumbers: Set<AccessionNumber>,
    val downtimeBlocks: List<AccessionBlock>,
    val servedOrders: List<ServedOrder>,
    val specimenType: SpecimenTypeFlags,
    val session: BedsideSession?,
    val overrideReason: Choice<IdentityOverrideReason>?,
    val labelContent: LabelContent?,
    val kit: KitLabels?,
    val reprint: ReprintRecord?,
    val authenticatedUserId: String?,
    val collector: CollectorRecord?,
    val collectionTime: CollectionTime?,
    val privileges: Set<SpecimenPrivilege>,
    val auditWritable: Boolean?,
    val downtimeEpisodes: List<DowntimeEpisode>,
    val paperCollection: PaperCollection?,
    val backEntryLabel: BackEntryLabel?,
    val dispatchScan: TransportScan?,
    val receiptScan: LabelScan?,
    val acceptabilityCheck: AcceptabilityRecord?,
    val caveatReason: Choice<String>?,
    val storageScan: StorageScan?,
    val storedAt: Instant?,
    val retentionEngineHold: Boolean?,
    val forensicMlcHold: Boolean?,
    val rejectionReason: Choice<RejectionReason>?,
    val lossDeclaration: LossDeclaration?,
    val errorReason: Choice<String>?,
    val governedErrorReasons: Set<String>?,
)

/**
 * A value the user supplied through a channel, with the channel adapter's "chosen" mark (specimen.yaml header). A channel
 * that cannot supply the mark (API, interface, migration loader) supplies `chosenByUser = false`, so a guard that needs a
 * chosen value refuses it; a defaulted value is never chosen.
 */
data class Choice<T>(
    val value: T,
    val chosenByUser: Boolean,
)

/** How a value reached the command: read by a scanner, or typed (§9.7 "Scan, don't type"). */
enum class EntryMethod { SCANNED, TYPED }

/** Where a scanned identifier came from (SI-01 clause b; CTRL-0001-4): only a patient wristband identifies a patient. */
enum class IdentifierSource { PATIENT_WRISTBAND, BED_LABEL, ROOM_LABEL, LOCATION_LABEL, CHART_LABEL }

/** The identity service's status of an MRN (SI-08): current, merged into another record, or retired. */
enum class MrnStatus { CURRENT, MERGED, RETIRED }

/**
 * The connectivity mode in which a command was issued (SI-15). Losing the internet while the on-site cell is reachable
 * is not offline (SI-15 clause h).
 *
 * @property offline True for the modes that count as offline in `accessionFromPermittedSource`.
 */
enum class CommandMode(
    val offline: Boolean,
) {
    CONNECTED_TO_CELL(false),
    INTERNET_LOST_CELL_REACHABLE(false),
    CELL_LOST(true),
    EDGE_AGENT_OFFLINE(true),
    MOBILE_OFFLINE(true),
}

/** The two identity-override reasons (DN-054 item 3). */
enum class IdentityOverrideReason { NO_WRISTBAND, WRISTBAND_UNREADABLE }

/** The coded rejection reasons (§8.4 plus clotting and mislabelled from §9.8; DN-054 item 2). */
enum class RejectionReason(
    val labelDefect: Boolean,
) {
    UNLABELLED(true),
    MISLABELLED(true),
    HAEMOLYSED(false),
    CLOTTED(false),
    INSUFFICIENT(false),
    WRONG_CONTAINER(false),
    EXPIRED_STABILITY(false),
}

/** The privileges the specimen guards read (governed configuration, §9.26; Trust Plane answers). */
enum class SpecimenPrivilege { DOWNTIME_BACK_ENTRY_LAB_COLLECTION, ACCEPT_WITH_CAVEAT, SPECIMEN_ENTERED_IN_ERROR }

/** The order machine's states (docs/specs/state-machines/order.yaml), as the orders module answers them. */
enum class OrderState { DRAFT, PENDING_VERIFICATION, ACTIVE, ON_HOLD, COMPLETED, REVOKED, ENTERED_IN_ERROR }

/** The result machine's states (docs/specs/state-machines/result.yaml), as the results module answers them. */
enum class ResultState { REGISTERED, PRELIMINARY, FINAL, AMENDED, CORRECTED, CANCELLED, ENTERED_IN_ERROR }

/**
 * The acceptability criteria of one test (§9.8; DN-054 item 11). [LABEL] is the label and identity criterion ("the label
 * matched at receipt"), which is never waived.
 */
enum class AcceptabilityCriterion { CONTAINER, VOLUME, STABILITY, HAEMOLYSIS, ICTERUS, LIPAEMIA, CLOTTING, LABEL }

/** A site-prefixed accession number: the site prefix and a serial within it. */
data class AccessionNumber(
    val sitePrefix: String,
    val serial: Long,
)

/**
 * A pre-allocated, site-prefixed accession block (SI-15 clause c; CTRL-0015-6; §9.1 alias pools).
 *
 * @property assignedTo The device, downtime pack or kit the block was issued to.
 */
data class AccessionBlock(
    val sitePrefix: String,
    val firstSerial: Long,
    val lastSerial: Long,
    val assignedTo: String,
) {
    /** True when [number] carries this block's prefix and its serial lies in the block, both ends included. */
    fun contains(number: AccessionNumber): Boolean = number.sitePrefix == sitePrefix && number.serial in firstSerial..lastSerial
}

/** The identity service's answer for an MRN: is its check digit valid (CTRL-0001-7), and is it current (SI-08). Null is unknown. */
data class MrnIdentityAnswer(
    val checkDigitValid: Boolean?,
    val status: MrnStatus?,
)

/**
 * The specimen patient's record (SI-01 clause a).
 *
 * @property dateOfBirth The date of birth as recorded, at its recorded precision (ISO 8601 year, year-month or date).
 * @property dateOfBirthApproximate The record's approximate-DOB flag.
 * @property mrnIdentity The identity service's answer for [mrn].
 */
data class PatientRecord(
    val mrn: String,
    val nameInScript: String?,
    val nameLatin: String?,
    val dateOfBirth: String?,
    val dateOfBirthApproximate: Boolean,
    val mrnIdentity: MrnIdentityAnswer,
)

/** What the device showed from the record after a wristband scan, and whether the user confirmed it (SI-01 clauses a, d). */
data class RecordConfirmation(
    val nameShown: Boolean,
    val dateOfBirthOrApproximateFlagShown: Boolean,
    val confirmedByUser: Boolean,
)

/**
 * One wristband read in a bedside session.
 *
 * @property decodedMrn The MRN the barcode (DataMatrix with MRN and encounter, §12) decoded; null when it did not decode.
 * @property source Where the scanned code came from; null when unknown.
 * @property confirmation What was shown and confirmed; null when nothing was.
 */
data class WristbandScan(
    val at: Instant,
    val deviceId: String,
    val entry: EntryMethod,
    val source: IdentifierSource?,
    val decodedMrn: String?,
    val confirmation: RecordConfirmation?,
)

/** How an active two-identifier check was made (DN-054 item 3). A room, bed or location never counts. */
enum class TwoIdentifierMethod { PATIENT_STATED, IDENTITY_DOCUMENT, ROOM_BED_OR_LOCATION }

/**
 * An active two-identifier check recorded in a bedside session (DN-054 item 3).
 *
 * @property recordShownOnDevice The record's name and date of birth were shown on the device.
 * @property statedNameConfirmed The patient stated their name and the user confirmed it against the record.
 * @property statedDateOfBirthConfirmed The patient stated their date of birth and the user confirmed it against the record.
 * @property documentReadThroughHal An identity document was read through the shell HAL (§9.1).
 * @property documentMatchesPatient The identity service's answer: the document belongs to the specimen's patient.
 */
data class TwoIdentifierCheck(
    val at: Instant,
    val deviceId: String,
    val method: TwoIdentifierMethod,
    val recordShownOnDevice: Boolean,
    val statedNameConfirmed: Boolean,
    val statedDateOfBirthConfirmed: Boolean,
    val documentReadThroughHal: Boolean,
    val documentMatchesPatient: Boolean?,
)

/** A tube-label scan: when, on which device, scanned or typed, and the accession number read (null when unread). */
data class LabelScan(
    val at: Instant,
    val deviceId: String,
    val entry: EntryMethod,
    val accession: AccessionNumber?,
)

/**
 * The bedside session the command was issued in, as the device's session layer delimits it: a session ends when another
 * wristband is scanned, another patient is identified, or the session is closed (specimen.yaml `labelledAtBedside`).
 *
 * @property wristbandScans Every wristband read in the session, oldest first, decoded or not. The last one is the scan read
 *   for this command; the first decoded one is the identification that opened the session.
 * @property twoIdentifierCheck The active two-identifier check recorded in the session, if any.
 * @property labelScans Every tube-label scan in the session, oldest first.
 */
data class BedsideSession(
    val wristbandScans: List<WristbandScan>,
    val twoIdentifierCheck: TwoIdentifierCheck?,
    val labelScans: List<LabelScan>,
)

/**
 * The content of a specimen label (SI-01 clauses a to d; CTRL-0001-5, CTRL-0001-8).
 *
 * @property dateOfBirth The date of birth printed, at the precision printed; null when none.
 * @property approximateDobFlag The label carries the approximate-DOB flag.
 * @property roomOrBedInIdentifierSlot An identifier slot of the label holds a room or a bed.
 */
data class LabelContent(
    val accession: AccessionNumber?,
    val nameInScript: String?,
    val nameLatin: String?,
    val mrn: String?,
    val dateOfBirth: String?,
    val approximateDobFlag: Boolean,
    val roomOrBedInIdentifierSlot: Boolean,
)

/**
 * The labels of an alias or downtime kit (band and labels issued together; §9.1 alias pools; SAC-06).
 *
 * @property block The pre-allocated block issued with the kit.
 * @property labelScans The kit labels scanned for this specimen.
 * @property kitIdentityIsSpecimenPatient The identity service's answer: the kit's alias identity is the specimen patient's.
 */
data class KitLabels(
    val block: AccessionBlock,
    val labelScans: List<LabelScan>,
    val kitIdentityIsSpecimenPatient: Boolean?,
)

/** A reprint: the reason, who, where, when, and the accession number on the reprinted labels. */
data class ReprintRecord(
    val reason: Choice<String>?,
    val userId: String?,
    val deviceId: String?,
    val at: Instant?,
    val labelAccession: AccessionNumber?,
)

/** How the collector reached the record: the session's authenticated user, or a typed name. */
enum class CollectorEntry { SESSION_USER, TYPED_NAME }

/** The collector and the collecting device recorded with a collection. */
data class CollectorRecord(
    val userId: String?,
    val entry: CollectorEntry,
    val deviceId: String?,
)

/**
 * The clinical collection time (SI-10 clause a), apart from the system time of the command ([SpecimenFacts.now]).
 *
 * @property statedByPatient Recorded as the time the patient stated (patient-collected specimen types).
 */
data class CollectionTime(
    val clinical: Instant,
    val confirmedByCollector: Boolean,
    val statedByPatient: Boolean,
)

/**
 * The test catalogue's flags for the specimen type (governed configuration [HUMAN]); null is unknown.
 *
 * @property irreplaceable The type is irreplaceable (DN-054 item 11).
 * @property patientCollected The patient collects specimens of this type (urine, stool).
 */
data class SpecimenTypeFlags(
    val irreplaceable: Boolean?,
    val patientCollected: Boolean?,
)

/** A recorded cell or device outage (§16.3); [end] is null while it lasts. */
data class DowntimeEpisode(
    val start: Instant,
    val end: Instant?,
) {
    /** True when [time] lies inside the episode, both ends included. */
    fun covers(time: Instant): Boolean = !time.isBefore(start) && (end == null || !time.isAfter(end))
}

/**
 * The back-entry of a collection made on paper during a downtime (SI-10 clauses b, c; CTRL-0010-5).
 *
 * @property collectorIdentity The collector as entered from the paper record.
 * @property paperTime The collection time written on the paper record.
 * @property clinicalTime The clinical time the entry records.
 * @property labelledAsBackEntry The entry is labelled as back-entry.
 */
data class PaperCollection(
    val collectorIdentity: String?,
    val paperTime: Instant?,
    val clinicalTime: Instant?,
    val labelledAsBackEntry: Boolean,
)

/** The tube-label scan at back-entry, and whether the label's two identifiers were shown and confirmed (SI-01). */
data class BackEntryLabel(
    val scan: LabelScan,
    val identifiersConfirmed: Boolean,
)

/** A transport scan event (§9.8 "transport tracking by scan events"). */
data class TransportScan(
    val at: Instant?,
    val userId: String?,
    val deviceId: String?,
    val location: String?,
    val entry: EntryMethod,
    val accession: AccessionNumber?,
)

/** A volume with its unit. Volumes are compared only exactly and in the same unit (SI-05: no conversion). */
data class Volume(
    val amount: BigDecimal,
    val unit: String,
)

/**
 * An acceptability check recorded for the specimen (§9.8): the observed values; null is not recorded (unknown).
 *
 * @property haemolysisIndex The graded haemolysis index; likewise icterus, lipaemia and clotting.
 */
data class AcceptabilityRecord(
    val at: Instant,
    val container: String?,
    val volume: Volume?,
    val haemolysisIndex: Int?,
    val icterusIndex: Int?,
    val lipaemiaIndex: Int?,
    val clottingGrade: Int?,
)

/**
 * One test's catalogue limits (governed configuration [HUMAN]); null is unknown and fails that criterion.
 *
 * @property maxHaemolysisIndex The highest haemolysis index the test accepts; likewise icterus, lipaemia and clotting.
 * @property waivableCriteria The criteria the catalogue marks as waivable for the test (null: none).
 */
data class TestLimits(
    val allowedContainers: Set<String>?,
    val minimumVolume: Volume?,
    val stabilityLimit: Duration?,
    val maxHaemolysisIndex: Int?,
    val maxIcterusIndex: Int?,
    val maxLipaemiaIndex: Int?,
    val maxClottingGrade: Int?,
    val waivableCriteria: Set<AcceptabilityCriterion>?,
)

/** The test catalogue's retention rule for a test (governed configuration [HUMAN]); a null rule is unknown. */
sealed interface RetentionRule {
    /** The catalogue sets no retention period. */
    data object NoneSet : RetentionRule

    /** The catalogue sets [duration] as the retention period. */
    data class Period(
        val duration: Duration,
    ) : RetentionRule
}

/**
 * One test an order requests on this specimen.
 *
 * @property preTransfusionSample The catalogue marks the test as a pre-transfusion sample (SI-11); null is unknown.
 * @property retention The catalogue's retention rule; null is unknown.
 * @property limits The catalogue's acceptability limits.
 * @property rejectedAtCheck The test was rejected for this specimen at the acceptability check.
 * @property resultStates The states of the results derived from this specimen for the test (the results module's answer).
 */
data class ServedTest(
    val testCode: String,
    val preTransfusionSample: Boolean?,
    val retention: RetentionRule?,
    val limits: TestLimits,
    val rejectedAtCheck: Boolean,
    val resultStates: List<ResultState>,
)

/**
 * An order the specimen serves.
 *
 * @property state The order machine's state (the orders module's answer: as recorded when the command is received online,
 *   or as last synced to the device offline; DN-054 item 9); null is unknown.
 * @property resultDerivedFromThisSpecimen The results module's answer: a result of this order was derived from this specimen.
 */
data class ServedOrder(
    val orderId: String,
    val state: OrderState?,
    val resultDerivedFromThisSpecimen: Boolean?,
    val tests: List<ServedTest>,
)

/** A storage-location scan: rack and position, scanned or typed, with user and time (§9.8). */
data class StorageScan(
    val rack: String?,
    val position: String?,
    val entry: EntryMethod,
    val userId: String?,
    val at: Instant?,
)

/**
 * A declaration that the specimen is lost.
 *
 * @property declaredByUserId The declaring user; null when no user declared it.
 * @property lastScanEventShown The specimen's last scan event was shown to the user before the declaration.
 * @property raisedAutomatically The declaration was raised by the system, not by a user's deliberate action.
 */
data class LossDeclaration(
    val declaredByUserId: String?,
    val at: Instant?,
    val lastScanEventShown: Boolean,
    val raisedAutomatically: Boolean,
)
