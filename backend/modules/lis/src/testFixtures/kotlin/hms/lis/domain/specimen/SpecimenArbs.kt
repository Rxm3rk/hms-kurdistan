package hms.lis.domain.specimen

import io.kotest.property.Arb
import io.kotest.property.arbitrary.arbitrary
import java.time.Duration
import kotlin.random.Random

/** One change to a draw's facts. */
private typealias Change = (SpecimenFacts) -> SpecimenFacts

/**
 * The facts generator of the specimen machine (WP-0.5 spec §2.3, §3.3; synthetic `SYN-` data, NOT FOR CLINICAL USE).
 *
 * Each draw starts from [SpecimenSamples.baseline] and sets every aspect of the facts in turn. Most draws (the "good"
 * profile) make every main-path aspect hold, so that a sequence can travel the whole path from `ordered` to `stored`
 * within its 32 steps and every transition fires in 1,000 sequences (property P7). The other draws set each aspect
 * independently, often to a refusal or an edge value: a band of another patient, a typed scan, an MRN merged away, a
 * label scanned at the very instant of identification, a stability limit reached exactly, a volume in another unit, an
 * unknown catalogue flag. The ending aspects (orders ended, rejection, loss, entered in error, back-entry, caveat) are
 * drawn with small probabilities in both profiles, so that every predicate both holds and fails in a run. The
 * probabilities were tuned with a simulation of the machine (reported in the WP-0.5 specimen report).
 */
object SpecimenArbs {
    /** Specimen facts for the sequence properties and the SI scaffold. */
    val facts: Arb<SpecimenFacts> = arbitrary { rs -> draw(rs.random) }

    /** One draw of the facts from [random] (also used directly by tests that need a seeded draw). */
    fun draw(random: Random): SpecimenFacts {
        val d = Draw(random, random.nextDouble() < GOOD_PROFILE)
        var f = d.accession(SpecimenSamples.baseline)
        f = d.orders(f)
        f = d.identification(f)
        f = d.labels(f)
        f = d.collection(f)
        f = d.transfusion(f)
        f = d.kitAndReprint(f)
        f = d.backEntry(f)
        f = d.transport(f)
        f = d.acceptability(f)
        f = d.results(f)
        f = d.storage(f)
        f = d.endings(f)
        return d.audit(f)
    }

    private const val GOOD_PROFILE = 0.92
    private const val ASPECT_OK = 0.8
    private const val ORDERS_ENDED = 0.03
    private const val WRISTBAND_GOOD = 0.65
    private const val WRISTBAND_MIXED = 0.45
    private const val OVERRIDE_MIXED = 0.3
    private const val NOT_TRANSFUSION = 0.75
    private const val KIT_GOOD = 0.5
    private const val KIT_MIXED = 0.2
    private const val REPRINT = 0.3
    private const val BACK_ENTRY = 0.4
    private const val ALL_ACCEPTABLE_GOOD = 0.7
    private const val SOME_ACCEPTABLE_GOOD = 0.25
    private const val ALL_ACCEPTABLE_MIXED = 0.35
    private const val SOME_ACCEPTABLE_MIXED = 0.25
    private const val NONE_ACCEPTABLE_MIXED = 0.15
    private const val CAVEAT_PRIVILEGE = 0.6
    private const val CAVEAT_ALLOWED = 0.5
    private const val CAVEAT_REASON = 0.8
    private const val RECOLLECTION_GOOD = 0.35
    private const val RECOLLECTION_MIXED = 0.25
    private const val FINISHED_MIXED = 0.6
    private const val RETENTION_NONE = 0.2
    private const val RETENTION_ELAPSED = 0.1
    private const val RETENTION_UNKNOWN = 0.2
    private const val NO_LEGAL_HOLD = 0.85
    private const val REJECTION = 0.09
    private const val REJECTION_DEFAULTED = 0.1
    private const val LOSS = 0.1
    private const val ERROR_PRIVILEGE = 0.1
    private const val ERROR_REASON = 0.1
    private const val AUDIT_WRITABLE_MIXED = 0.85
    private const val SOME_INDEX = 3
    private const val NONE_INDEX = 5
    private const val ELAPSED_DAYS = 8L
    private const val STALE_HOURS = 5L

    /** The aspects of one draw; [good] is the profile in which every main-path aspect holds. */
    @Suppress("TooManyFunctions") // One function per aspect of the facts, plus the drawing helpers.
    private class Draw(
        private val random: Random,
        private val good: Boolean,
    ) {
        private fun chance(p: Double): Boolean = random.nextDouble() < p

        private fun ok(p: Double = ASPECT_OK): Boolean = good || chance(p)

        private fun <T> pick(options: List<T>): T = options[random.nextInt(options.size)]

        /** A random breaker of [facts], used when an aspect is not ok. */
        private fun breakWith(
            facts: SpecimenFacts,
            breakers: List<Change>,
        ): SpecimenFacts = pick(breakers)(facts)

        fun accession(f: SpecimenFacts): SpecimenFacts {
            val online = chance(HALF)
            val ready =
                if (online) {
                    f.copy(commandMode = pick(listOf<CommandMode>(CommandMode.CONNECTED_TO_CELL, CommandMode.INTERNET_LOST_CELL_REACHABLE)))
                } else {
                    f.copy(
                        commandMode = pick(listOf<CommandMode>(CommandMode.CELL_LOST, CommandMode.EDGE_AGENT_OFFLINE, CommandMode.MOBILE_OFFLINE)),
                        accession = SpecimenSamples.DOWNTIME_ACCESSION,
                        accessionIssuedByCellService = false,
                    )
                }
            if (ok()) return ready
            return breakWith(
                ready,
                listOf<Change>(
                    { it.copy(commandMode = null) },
                    { it.copy(commandMode = CommandMode.CONNECTED_TO_CELL, accessionIssuedByCellService = false) },
                    { it.copy(commandMode = CommandMode.CELL_LOST, accessionIssuedByCellService = false, accession = otherDeviceNumber) },
                    { it.copy(commandMode = CommandMode.CELL_LOST, accessionIssuedByCellService = false, accession = usedNumber) },
                    { it.copy(commandMode = CommandMode.CELL_LOST, accessionIssuedByCellService = false, siteAccessionPrefix = "SYN-S9") },
                    { it.copy(accession = null) },
                ),
            )
        }

        fun orders(f: SpecimenFacts): SpecimenFacts {
            val order = SpecimenSamples.activeOrder
            val completedElsewhere = order.copy(state = OrderState.COMPLETED, resultDerivedFromThisSpecimen = false)
            val orders =
                when {
                    chance(ORDERS_ENDED) -> {
                        pick(
                            listOf<List<ServedOrder>>(
                                listOf(order.copy(state = OrderState.REVOKED)),
                                listOf(order.copy(state = OrderState.ENTERED_IN_ERROR)),
                                listOf(completedElsewhere),
                                listOf(order.copy(state = OrderState.REVOKED), completedElsewhere.copy(orderId = "SYN-ORD-0002")),
                            ),
                        )
                    }

                    ok() -> {
                        listOf(order)
                    }

                    else -> {
                        pick(
                            listOf<List<ServedOrder>>(
                                listOf(order.copy(state = OrderState.PENDING_VERIFICATION)),
                                listOf(order.copy(state = OrderState.ON_HOLD)),
                                listOf(order.copy(state = OrderState.DRAFT)),
                                listOf(order.copy(state = null)),
                                listOf(order.copy(state = OrderState.COMPLETED, resultDerivedFromThisSpecimen = true)),
                                listOf(order.copy(state = OrderState.COMPLETED, resultDerivedFromThisSpecimen = null)),
                                emptyList(),
                            ),
                        )
                    }
                }
            return f.copy(servedOrders = orders)
        }

        fun identification(f: SpecimenFacts): SpecimenFacts {
            val roll = random.nextDouble()
            val wristband = if (good) roll < WRISTBAND_GOOD else roll < WRISTBAND_MIXED
            val overrideFlow = !wristband && (good || roll < WRISTBAND_MIXED + OVERRIDE_MIXED)
            val label = SpecimenSamples.labelScan.copy(accession = f.accession)
            return when {
                wristband -> {
                    wristbandPath(f, label)
                }

                overrideFlow -> {
                    overridePath(f, label)
                }

                else -> {
                    breakWith(
                        f,
                        listOf<Change>(
                            { it.copy(session = null) },
                            { it.copy(session = BedsideSession(emptyList(), null, listOf(label))) },
                            { it.copy(session = BedsideSession(listOf(otherPatientBand), null, listOf(label))) },
                            {
                                it.copy(
                                    session = BedsideSession(listOf(otherPatientBand), SpecimenSamples.twoIdentifierCheck, listOf(label)),
                                    overrideReason = Choice(IdentityOverrideReason.WRISTBAND_UNREADABLE, chosenByUser = true),
                                )
                            },
                        ),
                    )
                }
            }
        }

        private fun wristbandPath(
            f: SpecimenFacts,
            label: LabelScan,
        ): SpecimenFacts {
            val scan = SpecimenSamples.wristbandScan
            val ready = f.copy(session = BedsideSession(listOf(scan), null, listOf(label)), overrideReason = null)
            if (ok()) return ready
            val identity = f.patient.mrnIdentity
            return breakWith(
                ready,
                listOf<Change>(
                    { it.withBand(scan.copy(entry = EntryMethod.TYPED)) },
                    { it.withBand(scan.copy(source = pick(IdentifierSource.entries.drop(1)))) },
                    { it.withBand(scan.copy(source = null)) },
                    { it.withBand(scan.copy(confirmation = null)) },
                    { it.withBand(scan.copy(confirmation = scan.confirmation?.copy(confirmedByUser = false))) },
                    { it.withBand(scan.copy(confirmation = scan.confirmation?.copy(nameShown = false))) },
                    { it.withMrnIdentity(identity.copy(status = pick(listOf<MrnStatus?>(MrnStatus.MERGED, MrnStatus.RETIRED, null)))) },
                    { it.withMrnIdentity(identity.copy(checkDigitValid = pick(listOf<Boolean?>(false, null)))) },
                    { it.copy(session = it.session?.copy(wristbandScans = listOf(scan, scan.copy(decodedMrn = null)))) },
                    { it.copy(session = it.session?.copy(wristbandScans = listOf(scan, scan))) },
                ),
            )
        }

        private fun overridePath(
            f: SpecimenFacts,
            label: LabelScan,
        ): SpecimenFacts {
            val reason = pick(IdentityOverrideReason.entries)
            val unreadable = SpecimenSamples.wristbandScan.copy(decodedMrn = null)
            val bands = if (reason == IdentityOverrideReason.WRISTBAND_UNREADABLE && chance(HALF)) listOf(unreadable) else emptyList()
            val check =
                if (chance(HALF)) {
                    SpecimenSamples.twoIdentifierCheck
                } else {
                    SpecimenSamples.twoIdentifierCheck.copy(
                        method = TwoIdentifierMethod.IDENTITY_DOCUMENT,
                        statedNameConfirmed = false,
                        statedDateOfBirthConfirmed = false,
                        documentReadThroughHal = true,
                        documentMatchesPatient = true,
                    )
                }
            val ready = f.copy(session = BedsideSession(bands, check, listOf(label)), overrideReason = Choice(reason, chosenByUser = true))
            if (ok()) return ready
            return breakWith(
                ready,
                listOf<Change>(
                    { it.withCheck(check.copy(method = TwoIdentifierMethod.ROOM_BED_OR_LOCATION)) },
                    { it.withCheck(check.copy(statedDateOfBirthConfirmed = false, documentMatchesPatient = null)) },
                    { it.withCheck(check.copy(recordShownOnDevice = false, documentReadThroughHal = false)) },
                    { it.copy(overrideReason = Choice(reason, chosenByUser = false)) },
                    { it.copy(session = it.session?.copy(wristbandScans = listOf(SpecimenSamples.wristbandScan))) },
                    { it.withMrnIdentity(it.patient.mrnIdentity.copy(status = MrnStatus.MERGED)) },
                    { it.copy(session = it.session?.copy(twoIdentifierCheck = null)) },
                ),
            )
        }

        fun labels(f: SpecimenFacts): SpecimenFacts {
            val content = SpecimenSamples.labelContent.copy(accession = f.accession)
            val withContent = f.copy(labelContent = content)
            val bedside =
                if (ok()) {
                    withContent
                } else {
                    val scan = withContent.session?.labelScans?.firstOrNull() ?: SpecimenSamples.labelScan
                    breakWith(
                        withContent,
                        listOf<Change>(
                            { it.withLabelScan(scan.copy(entry = EntryMethod.TYPED)) },
                            { it.withLabelScan(scan.copy(deviceId = SpecimenSamples.OTHER_DEVICE)) },
                            { it.withLabelScan(scan.copy(at = SpecimenSamples.IDENTIFIED_AT)) },
                            { it.withLabelScan(scan.copy(at = SpecimenSamples.IDENTIFIED_AT.minusSeconds(1))) },
                            { it.withLabelScan(scan.copy(accession = otherDeviceNumber)) },
                            { it.copy(session = it.session?.copy(labelScans = emptyList())) },
                        ),
                    )
                }
            if (ok()) return bedside
            val patient = f.patient
            return breakWith(
                bedside,
                listOf<Change>(
                    { it.copy(labelContent = content.copy(nameLatin = null)) },
                    { it.copy(labelContent = content.copy(nameInScript = "")) },
                    { it.copy(labelContent = content.copy(mrn = SpecimenSamples.OTHER_MRN)) },
                    { it.copy(labelContent = content.copy(dateOfBirth = "1980-03")) },
                    { it.copy(labelContent = content.copy(dateOfBirth = null, approximateDobFlag = true)) },
                    {
                        it.copy(
                            patient = patient.copy(dateOfBirth = "1980", dateOfBirthApproximate = true),
                            labelContent = content.copy(dateOfBirth = null, approximateDobFlag = true),
                        )
                    },
                    { it.copy(labelContent = content.copy(roomOrBedInIdentifierSlot = true)) },
                    { it.copy(labelContent = content.copy(accession = otherDeviceNumber)) },
                    { it.copy(labelContent = null) },
                ),
            )
        }

        fun collection(f: SpecimenFacts): SpecimenFacts = collector(collectionTime(f))

        private fun collectionTime(f: SpecimenFacts): SpecimenFacts {
            val time = f.collectionTime
            return if (ok() || time == null) {
                f
            } else {
                breakWith(
                    f,
                    listOf<Change>(
                        { it.copy(collectionTime = time.copy(confirmedByCollector = false)) },
                        { it.copy(collectionTime = time.copy(clinical = SpecimenSamples.IDENTIFIED_AT.minusSeconds(1))) },
                        { it.copy(collectionTime = time.copy(clinical = SpecimenSamples.IDENTIFIED_AT)) },
                        { it.copy(collectionTime = time.copy(clinical = it.now.plusSeconds(1))) },
                        { it.copy(collectionTime = time.copy(clinical = it.now)) },
                        { it.copy(collectionTime = null) },
                        {
                            it.copy(
                                specimenType = it.specimenType.copy(patientCollected = true),
                                collectionTime =
                                    time.copy(
                                        clinical = SpecimenSamples.IDENTIFIED_AT.minusSeconds(SECONDS),
                                        statedByPatient = true,
                                    ),
                            )
                        },
                        {
                            it.copy(
                                specimenType = it.specimenType.copy(patientCollected = true),
                                collectionTime = time.copy(clinical = SpecimenSamples.IDENTIFIED_AT.minusSeconds(SECONDS)),
                            )
                        },
                        { it.copy(specimenType = it.specimenType.copy(patientCollected = null)) },
                    ),
                )
            }
        }

        private fun collector(f: SpecimenFacts): SpecimenFacts {
            val collector = f.collector
            if (ok() || collector == null) return f
            return breakWith(
                f,
                listOf<Change>(
                    { it.copy(collector = collector.copy(entry = CollectorEntry.TYPED_NAME)) },
                    { it.copy(collector = collector.copy(userId = "SYN-USER-99")) },
                    { it.copy(collector = collector.copy(deviceId = null)) },
                    { it.copy(authenticatedUserId = null) },
                    { it.copy(collector = null) },
                ),
            )
        }

        fun transfusion(f: SpecimenFacts): SpecimenFacts {
            if (good || chance(NOT_TRANSFUSION)) return f
            val flag = pick(listOf<Boolean?>(true, null))
            var first = true
            return SpecimenSamples.mapTests(f) { test ->
                if (first) {
                    first = false
                    test.copy(preTransfusionSample = flag)
                } else {
                    test
                }
            }
        }

        fun kitAndReprint(f: SpecimenFacts): SpecimenFacts = reprint(kit(f))

        private fun kit(f: SpecimenFacts): SpecimenFacts {
            var out = f
            if (chance(if (good) KIT_GOOD else KIT_MIXED)) {
                out = SpecimenSamples.withKit(out)
                val kit = out.kit
                if (!good && kit != null && !chance(ASPECT_OK)) {
                    val scan = kit.labelScans.first()
                    out =
                        breakWith(
                            out,
                            listOf<Change>(
                                { it.copy(kit = kit.copy(kitIdentityIsSpecimenPatient = pick(listOf<Boolean?>(false, null)))) },
                                { it.copy(kit = kit.copy(labelScans = listOf(scan.copy(entry = EntryMethod.TYPED)))) },
                                { it.copy(kit = kit.copy(labelScans = listOf(scan.copy(accession = SpecimenSamples.DOWNTIME_ACCESSION)))) },
                                { it.copy(kit = kit.copy(labelScans = listOf(scan.copy(accession = usedKitNumber)))) },
                                { it.copy(kit = kit.copy(block = kit.block.copy(sitePrefix = "SYN-S9"))) },
                                { it.copy(kit = kit.copy(labelScans = emptyList())) },
                            ),
                        )
                }
            }
            return out
        }

        private fun reprint(f: SpecimenFacts): SpecimenFacts {
            var out = f
            if (chance(REPRINT)) {
                out = SpecimenSamples.withReprint(out)
                val reprint = out.reprint
                if (!good && reprint != null && !chance(ASPECT_OK)) {
                    out =
                        breakWith(
                            out,
                            listOf<Change>(
                                { it.copy(reprint = reprint.copy(reason = Choice("SYN-PRINTER-JAM", chosenByUser = false))) },
                                { it.copy(reprint = reprint.copy(reason = Choice(" ", chosenByUser = true))) },
                                { it.copy(reprint = reprint.copy(labelAccession = otherDeviceNumber)) },
                                { it.copy(reprint = reprint.copy(userId = null)) },
                            ),
                        )
                }
            }
            return out
        }

        fun backEntry(f: SpecimenFacts): SpecimenFacts {
            val out = if (chance(BACK_ENTRY)) SpecimenSamples.withBackEntry(f) else f
            val paper = out.paperCollection
            val label = out.backEntryLabel
            if (ok() || paper == null || label == null) return out
            val outside = SpecimenSamples.EPISODE.start.minusSeconds(1)
            return breakWith(
                out,
                listOf<Change>(
                    { it.copy(paperCollection = paper.copy(paperTime = outside, clinicalTime = outside)) },
                    { it.copy(paperCollection = paper.copy(clinicalTime = it.now)) },
                    { it.copy(paperCollection = paper.copy(labelledAsBackEntry = false)) },
                    { it.copy(paperCollection = paper.copy(collectorIdentity = "")) },
                    {
                        val edge = SpecimenSamples.EPISODE.end ?: SpecimenSamples.PAPER_TIME
                        it.copy(paperCollection = paper.copy(paperTime = edge, clinicalTime = edge))
                    },
                    { it.copy(backEntryLabel = label.copy(scan = label.scan.copy(entry = EntryMethod.TYPED))) },
                    { it.copy(backEntryLabel = label.copy(identifiersConfirmed = false)) },
                    { it.copy(backEntryLabel = label.copy(scan = label.scan.copy(accession = usedNumber))) },
                    { it.copy(privileges = it.privileges - SpecimenPrivilege.DOWNTIME_BACK_ENTRY_LAB_COLLECTION) },
                    { it.copy(downtimeEpisodes = emptyList()) },
                ),
            )
        }

        fun transport(f: SpecimenFacts): SpecimenFacts {
            val dispatch = SpecimenSamples.baseline.dispatchScan?.copy(accession = f.accession)
            val receipt = SpecimenSamples.baseline.receiptScan?.copy(accession = f.accession)
            var out = f.copy(dispatchScan = dispatch, receiptScan = receipt)
            if (!ok() && dispatch != null) {
                out =
                    breakWith(
                        out,
                        listOf<Change>(
                            { it.copy(dispatchScan = dispatch.copy(entry = EntryMethod.TYPED)) },
                            { it.copy(dispatchScan = dispatch.copy(location = null)) },
                            { it.copy(dispatchScan = dispatch.copy(accession = otherDeviceNumber)) },
                            { it.copy(dispatchScan = null) },
                        ),
                    )
            }
            if (!ok() && receipt != null) {
                out =
                    breakWith(
                        out,
                        listOf<Change>(
                            { it.copy(receiptScan = receipt.copy(entry = EntryMethod.TYPED)) },
                            { it.copy(receiptScan = receipt.copy(accession = otherDeviceNumber)) },
                            { it.copy(receiptScan = null) },
                        ),
                    )
            }
            return out
        }

        fun acceptability(f: SpecimenFacts): SpecimenFacts {
            val roll = random.nextDouble()
            val all = if (good) ALL_ACCEPTABLE_GOOD else ALL_ACCEPTABLE_MIXED
            val some = all + if (good) SOME_ACCEPTABLE_GOOD else SOME_ACCEPTABLE_MIXED
            val record = SpecimenSamples.acceptabilityRecord
            var out =
                when {
                    roll < all -> f
                    roll < some -> someAcceptable(f)
                    good || roll < some + NONE_ACCEPTABLE_MIXED -> f.copy(acceptabilityCheck = record.copy(haemolysisIndex = NONE_INDEX))
                    else -> brokenAcceptability(f)
                }
            if (chance(CAVEAT_ALLOWED)) {
                out =
                    if (chance(HALF)) {
                        out.copy(specimenType = out.specimenType.copy(irreplaceable = true))
                    } else {
                        SpecimenSamples.withLimits(out) { it.limits.copy(waivableCriteria = setOf(AcceptabilityCriterion.HAEMOLYSIS)) }
                    }
            }
            if (chance(CAVEAT_PRIVILEGE)) out = out.copy(privileges = out.privileges + SpecimenPrivilege.ACCEPT_WITH_CAVEAT)
            val reason = if (chance(CAVEAT_REASON)) Choice("SYN-IRREPLACEABLE-CSF", true) else pick(listOf<Choice<String>?>(null, Choice("SYN-X", false)))
            return out.copy(caveatReason = reason)
        }

        /** The first test accepts haemolysis up to [SpecimenSamples.MAX_INDEX], the second up to HIGH_INDEX; the record is between. */
        private fun someAcceptable(f: SpecimenFacts): SpecimenFacts {
            var first = true
            val limited =
                SpecimenSamples.withLimits(f) { test ->
                    val max = if (first) SpecimenSamples.MAX_INDEX else SpecimenSamples.HIGH_INDEX
                    first = false
                    test.limits.copy(maxHaemolysisIndex = max)
                }
            return limited.copy(acceptabilityCheck = SpecimenSamples.acceptabilityRecord.copy(haemolysisIndex = SOME_INDEX))
        }

        private fun brokenAcceptability(f: SpecimenFacts): SpecimenFacts {
            val record = SpecimenSamples.acceptabilityRecord
            val stale = f.now.minus(Duration.ofHours(STALE_HOURS))
            val edge = f.now.minus(SpecimenSamples.STABILITY)
            return breakWith(
                f,
                listOf<Change>(
                    { it.copy(acceptabilityCheck = null) },
                    { it.copy(acceptabilityCheck = record.copy(at = SpecimenSamples.RECEIVED_AT.minusSeconds(1))) },
                    { it.copy(acceptabilityCheck = record.copy(at = SpecimenSamples.RECEIVED_AT)) },
                    { it.copy(acceptabilityCheck = record.copy(container = SpecimenSamples.OTHER_CONTAINER)) },
                    { it.copy(acceptabilityCheck = record.copy(container = null)) },
                    { it.copy(acceptabilityCheck = record.copy(volume = record.volume?.copy(unit = "uL"))) },
                    { it.copy(acceptabilityCheck = record.copy(volume = SpecimenSamples.MIN_VOLUME)) },
                    { it.copy(acceptabilityCheck = record.copy(clottingGrade = null)) },
                    { it.copy(collectionTime = it.collectionTime?.copy(clinical = stale)) },
                    { it.copy(collectionTime = it.collectionTime?.copy(clinical = edge)) },
                    { SpecimenSamples.withLimits(it) { test -> test.limits.copy(stabilityLimit = null) } },
                ),
            )
        }

        fun results(f: SpecimenFacts): SpecimenFacts {
            val roll = random.nextDouble()
            val recollection = roll < if (good) RECOLLECTION_GOOD else RECOLLECTION_MIXED
            val finished = good || roll < FINISHED_MIXED
            return when {
                recollection -> {
                    firstTest(f) { it.copy(resultStates = listOf(pick(listOf<ResultState>(ResultState.CANCELLED, ResultState.ENTERED_IN_ERROR)))) }
                }

                finished -> {
                    pick(
                        listOf<Change>(
                            { x -> x },
                            { x -> firstTest(x) { it.copy(resultStates = listOf(ResultState.AMENDED)) } },
                            { x -> firstTest(x) { it.copy(resultStates = listOf(ResultState.CANCELLED, ResultState.CORRECTED)) } },
                            { x -> firstTest(x) { it.copy(resultStates = emptyList(), rejectedAtCheck = true) } },
                        ),
                    )(f)
                }

                else -> {
                    firstTest(f) {
                        it.copy(resultStates = pick(listOf<List<ResultState>>(listOf(ResultState.PRELIMINARY), listOf(ResultState.REGISTERED), emptyList())))
                    }
                }
            }
        }

        fun storage(f: SpecimenFacts): SpecimenFacts {
            var out = f
            val scan = f.storageScan
            if (!ok() && scan != null) {
                out =
                    breakWith(
                        out,
                        listOf<Change>(
                            { it.copy(storageScan = scan.copy(entry = EntryMethod.TYPED)) },
                            { it.copy(storageScan = scan.copy(position = null)) },
                            { it.copy(storageScan = null) },
                        ),
                    )
            }
            val period = RetentionRule.Period(Duration.ofDays(SpecimenSamples.RETENTION_DAYS))
            val roll = random.nextDouble()
            out =
                when {
                    roll < RETENTION_NONE -> {
                        out
                    }

                    roll < RETENTION_NONE + RETENTION_ELAPSED -> {
                        val days = if (chance(HALF)) ELAPSED_DAYS else SpecimenSamples.RETENTION_DAYS
                        SpecimenSamples.mapTests(out) { it.copy(retention = period) }.copy(storedAt = out.now.minus(Duration.ofDays(days)))
                    }

                    roll < RETENTION_NONE + RETENTION_ELAPSED + RETENTION_UNKNOWN -> {
                        pick(
                            listOf<Change>(
                                { x -> firstTest(x) { it.copy(retention = null) } },
                                { x -> x.copy(storedAt = null) },
                                { x -> x.copy(servedOrders = x.servedOrders.map { it.copy(tests = emptyList()) }) },
                            ),
                        )(out)
                    }

                    else -> {
                        SpecimenSamples.mapTests(out) { it.copy(retention = period) }
                    }
                }
            if (ok(NO_LEGAL_HOLD)) return out
            return pick(
                listOf<Change>(
                    { x -> x.copy(retentionEngineHold = true) },
                    { x -> x.copy(retentionEngineHold = null) },
                    { x -> x.copy(forensicMlcHold = true) },
                    { x -> x.copy(forensicMlcHold = null) },
                ),
            )(out)
        }

        fun endings(f: SpecimenFacts): SpecimenFacts {
            var out = f
            out =
                when {
                    chance(REJECTION) -> out.copy(rejectionReason = Choice(pick(RejectionReason.entries), chosenByUser = true))
                    chance(REJECTION_DEFAULTED) -> out.copy(rejectionReason = Choice(pick(RejectionReason.entries), chosenByUser = false))
                    else -> out
                }
            val declaration = LossDeclaration(SpecimenSamples.USER, out.now, lastScanEventShown = true, raisedAutomatically = false)
            out =
                when {
                    chance(LOSS) -> {
                        out.copy(lossDeclaration = declaration)
                    }

                    chance(LOSS) -> {
                        out.copy(
                            lossDeclaration =
                                pick(
                                    listOf<LossDeclaration>(
                                        declaration.copy(raisedAutomatically = true),
                                        declaration.copy(lastScanEventShown = false),
                                        declaration.copy(declaredByUserId = null),
                                    ),
                                ),
                        )
                    }

                    else -> {
                        out
                    }
                }
            if (chance(ERROR_PRIVILEGE)) out = out.copy(privileges = out.privileges + SpecimenPrivilege.SPECIMEN_ENTERED_IN_ERROR)
            out =
                when {
                    chance(ERROR_REASON) -> {
                        out.copy(errorReason = Choice(SpecimenSamples.ERROR_REASON, chosenByUser = true))
                    }

                    chance(ERROR_REASON) -> {
                        pick(
                            listOf<SpecimenFacts>(
                                out.copy(errorReason = Choice(SpecimenSamples.ERROR_REASON, chosenByUser = false)),
                                out.copy(errorReason = Choice("SYN-NOT-GOVERNED", chosenByUser = true)),
                                out.copy(
                                    errorReason = Choice(SpecimenSamples.ERROR_REASON, chosenByUser = true),
                                    governedErrorReasons = null,
                                ),
                            ),
                        )
                    }

                    else -> {
                        out
                    }
                }
            return out
        }

        fun audit(f: SpecimenFacts): SpecimenFacts =
            if (good || chance(AUDIT_WRITABLE_MIXED)) f else f.copy(auditWritable = pick(listOf<Boolean?>(false, null)))

        private fun firstTest(
            f: SpecimenFacts,
            change: (ServedTest) -> ServedTest,
        ): SpecimenFacts {
            var first = true
            return SpecimenSamples.mapTests(f) { test ->
                if (first) {
                    first = false
                    change(test)
                } else {
                    test
                }
            }
        }
    }

    private const val HALF = 0.5
    private const val SECONDS = 600L
    private val otherDeviceNumber = AccessionNumber(SpecimenSamples.SITE, serial = 700_010L)
    private val usedNumber = AccessionNumber(SpecimenSamples.SITE, serial = 900_001L)
    private val usedKitNumber = AccessionNumber(SpecimenSamples.SITE, serial = 800_001L)
    private val otherPatientBand = SpecimenSamples.wristbandScan.copy(decodedMrn = SpecimenSamples.OTHER_MRN)

    private fun SpecimenFacts.withBand(scan: WristbandScan): SpecimenFacts = copy(session = session?.copy(wristbandScans = listOf(scan)))

    private fun SpecimenFacts.withCheck(check: TwoIdentifierCheck): SpecimenFacts =
        copy(session = session?.copy(twoIdentifierCheck = check))

    private fun SpecimenFacts.withLabelScan(scan: LabelScan): SpecimenFacts = copy(session = session?.copy(labelScans = listOf(scan)))

    private fun SpecimenFacts.withMrnIdentity(answer: MrnIdentityAnswer): SpecimenFacts = copy(patient = patient.copy(mrnIdentity = answer))
}
