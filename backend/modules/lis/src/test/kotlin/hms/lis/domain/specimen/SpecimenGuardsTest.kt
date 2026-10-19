package hms.lis.domain.specimen

import hms.lis.domain.specimen.SpecimenSamples.ACCESSION
import hms.lis.domain.specimen.SpecimenSamples.DOWNTIME_ACCESSION
import hms.lis.domain.specimen.SpecimenSamples.IDENTIFIED_AT
import hms.lis.domain.specimen.SpecimenSamples.NOW
import hms.lis.domain.specimen.SpecimenSamples.baseline
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import java.math.BigDecimal
import java.time.Duration

// Unit tests of every specimen guard predicate (docs/specs/state-machines/specimen.yaml; WP-0.5 spec §2.1 rule 12):
// for each predicate a case where it holds and cases where it does not, the boundary of every time window, every
// fail-closed unknown, and the complement pairs as complements. Synthetic data only (SpecimenSamples; NOT FOR CLINICAL USE).

private val G = SpecimenGuards

private fun SpecimenFacts.withSession(change: (BedsideSession) -> BedsideSession): SpecimenFacts =
    copy(session = session?.let(change))

private fun SpecimenFacts.withBand(change: (WristbandScan) -> WristbandScan): SpecimenFacts =
    withSession { it.copy(wristbandScans = it.wristbandScans.map(change)) }

private fun SpecimenFacts.withOrders(vararg orders: ServedOrder): SpecimenFacts = copy(servedOrders = orders.toList())

private fun SpecimenFacts.withIdentity(answer: MrnIdentityAnswer): SpecimenFacts = copy(patient = patient.copy(mrnIdentity = answer))

private fun SpecimenFacts.offline(): SpecimenFacts =
    copy(commandMode = CommandMode.CELL_LOST, accession = DOWNTIME_ACCESSION, accessionIssuedByCellService = false)

private fun SpecimenFacts.withFirstTest(change: (ServedTest) -> ServedTest): SpecimenFacts {
    var first = true
    return SpecimenSamples.mapTests(this) { test ->
        if (first) {
            first = false
            change(test)
        } else {
            test
        }
    }
}

private val order = SpecimenSamples.activeOrder

class SpecimenGuardsTest :
    FunSpec({
        // --- servedOrderActive / servedOrdersEnded ---------------------------------------------------------------

        test("servedOrderActive holds when one served order is active") {
            G.servedOrderActive(baseline.withOrders(order.copy(state = OrderState.REVOKED), order)) shouldBe true
        }

        test("servedOrderActive fails for pending-verification, on-hold, completed, revoked, entered-in-error and unknown orders") {
            listOf(
                OrderState.PENDING_VERIFICATION,
                OrderState.ON_HOLD,
                OrderState.COMPLETED,
                OrderState.REVOKED,
                OrderState.ENTERED_IN_ERROR,
                OrderState.DRAFT,
                null,
            ).forEach { state -> G.servedOrderActive(baseline.withOrders(order.copy(state = state))) shouldBe false }
            G.servedOrderActive(baseline.withOrders()) shouldBe false
        }

        test("servedOrdersEnded holds when every order is revoked, entered in error, or completed with no result from this specimen") {
            G.servedOrdersEnded(
                baseline.withOrders(
                    order.copy(state = OrderState.REVOKED),
                    order.copy(state = OrderState.ENTERED_IN_ERROR),
                    order.copy(state = OrderState.COMPLETED, resultDerivedFromThisSpecimen = false),
                ),
            ) shouldBe true
        }

        test("servedOrdersEnded fails for an empty order list, an open order, or a completed order whose result came from this specimen") {
            G.servedOrdersEnded(baseline.withOrders()) shouldBe false
            G.servedOrdersEnded(baseline.withOrders(order.copy(state = OrderState.REVOKED), order)) shouldBe false
            G.servedOrdersEnded(baseline.withOrders(order.copy(state = OrderState.COMPLETED, resultDerivedFromThisSpecimen = true))) shouldBe
                false
            G.servedOrdersEnded(baseline.withOrders(order.copy(state = OrderState.COMPLETED, resultDerivedFromThisSpecimen = null))) shouldBe
                false
            G.servedOrdersEnded(baseline.withOrders(order.copy(state = null))) shouldBe false
        }

        // --- wristbandScanMatches ----------------------------------------------------------------------------------

        test("wristbandScanMatches holds for a scanned patient wristband of the specimen patient, valid and current, confirmed") {
            G.wristbandScanMatches(baseline) shouldBe true
        }

        test("wristbandScanMatches fails for a typed scan, a non-wristband source and an unknown source (SI-01 clause b)") {
            G.wristbandScanMatches(baseline.withBand { it.copy(entry = EntryMethod.TYPED) }) shouldBe false
            IdentifierSource.entries.filter { it != IdentifierSource.PATIENT_WRISTBAND }.forEach { source ->
                G.wristbandScanMatches(baseline.withBand { it.copy(source = source) }) shouldBe false
            }
            G.wristbandScanMatches(baseline.withBand { it.copy(source = null) }) shouldBe false
        }

        test("wristbandScanMatches fails for another patient's band and for a band that did not decode") {
            G.wristbandScanMatches(baseline.withBand { it.copy(decodedMrn = SpecimenSamples.OTHER_MRN) }) shouldBe false
            G.wristbandScanMatches(baseline.withBand { it.copy(decodedMrn = null) }) shouldBe false
        }

        test("wristbandScanMatches fails for a merged, retired or unknown MRN and an invalid or unknown check digit (SI-08)") {
            listOf(MrnStatus.MERGED, MrnStatus.RETIRED, null).forEach { status ->
                G.wristbandScanMatches(baseline.withIdentity(MrnIdentityAnswer(true, status))) shouldBe false
            }
            listOf(false, null).forEach { valid ->
                G.wristbandScanMatches(baseline.withIdentity(MrnIdentityAnswer(valid, MrnStatus.CURRENT))) shouldBe false
            }
        }

        test("wristbandScanMatches fails when the identifiers were not shown or not confirmed (SI-01 clauses a and d)") {
            val shown = RecordConfirmation(nameShown = true, dateOfBirthOrApproximateFlagShown = true, confirmedByUser = true)
            G.wristbandScanMatches(baseline.withBand { it.copy(confirmation = null) }) shouldBe false
            G.wristbandScanMatches(baseline.withBand { it.copy(confirmation = shown.copy(nameShown = false)) }) shouldBe false
            G.wristbandScanMatches(
                baseline.withBand { it.copy(confirmation = shown.copy(dateOfBirthOrApproximateFlagShown = false)) },
            ) shouldBe false
            G.wristbandScanMatches(baseline.withBand { it.copy(confirmation = shown.copy(confirmedByUser = false)) }) shouldBe false
        }

        test("wristbandScanMatches reads the last read of the session and fails without a session or a read") {
            val band = SpecimenSamples.wristbandScan
            G.wristbandScanMatches(baseline.withSession { it.copy(wristbandScans = listOf(band, band.copy(decodedMrn = null))) }) shouldBe
                false
            G.wristbandScanMatches(baseline.withSession { it.copy(wristbandScans = emptyList()) }) shouldBe false
            G.wristbandScanMatches(baseline.copy(session = null)) shouldBe false
        }

        // --- noUsableWristband, twoIdentifiersActivelyConfirmed, identityOverrideReasonChosen ----------------------

        val override = SpecimenSamples.onOverridePath(baseline)

        test("noUsableWristband holds when no band was recorded and none decoded, or a band was read but did not decode") {
            G.noUsableWristband(override) shouldBe true
            val unreadable = SpecimenSamples.wristbandScan.copy(decodedMrn = null)
            G.noUsableWristband(
                SpecimenSamples
                    .onOverridePath(baseline, IdentityOverrideReason.WRISTBAND_UNREADABLE)
                    .withSession { it.copy(wristbandScans = listOf(unreadable)) },
            ) shouldBe true
        }

        test("noUsableWristband fails when a band in the session decoded, to this patient or to another (hard stop)") {
            G.noUsableWristband(override.withSession { it.copy(wristbandScans = listOf(SpecimenSamples.wristbandScan)) }) shouldBe false
            G.noUsableWristband(
                override.withSession { it.copy(wristbandScans = listOf(SpecimenSamples.wristbandScan.copy(decodedMrn = SpecimenSamples.OTHER_MRN))) },
            ) shouldBe false
        }

        test("noUsableWristband fails without the user's record or without a session") {
            G.noUsableWristband(override.copy(overrideReason = null)) shouldBe false
            G.noUsableWristband(override.copy(session = null)) shouldBe false
        }

        test("twoIdentifiersActivelyConfirmed holds for stated name and date of birth confirmed against the record shown") {
            G.twoIdentifiersActivelyConfirmed(override) shouldBe true
        }

        test("twoIdentifiersActivelyConfirmed holds for an identity document read through the HAL and matched to the patient") {
            val document =
                SpecimenSamples.twoIdentifierCheck.copy(
                    method = TwoIdentifierMethod.IDENTITY_DOCUMENT,
                    statedNameConfirmed = false,
                    statedDateOfBirthConfirmed = false,
                    documentReadThroughHal = true,
                    documentMatchesPatient = true,
                )
            G.twoIdentifiersActivelyConfirmed(override.withSession { it.copy(twoIdentifierCheck = document) }) shouldBe true
            G.twoIdentifiersActivelyConfirmed(
                override.withSession { it.copy(twoIdentifierCheck = document.copy(documentMatchesPatient = null)) },
            ) shouldBe false
            G.twoIdentifiersActivelyConfirmed(
                override.withSession { it.copy(twoIdentifierCheck = document.copy(documentReadThroughHal = false)) },
            ) shouldBe false
        }

        test("twoIdentifiersActivelyConfirmed fails for a room, bed or location, a missing confirmation, or no check") {
            val check = SpecimenSamples.twoIdentifierCheck
            G.twoIdentifiersActivelyConfirmed(
                override.withSession { it.copy(twoIdentifierCheck = check.copy(method = TwoIdentifierMethod.ROOM_BED_OR_LOCATION)) },
            ) shouldBe false
            G.twoIdentifiersActivelyConfirmed(
                override.withSession { it.copy(twoIdentifierCheck = check.copy(statedDateOfBirthConfirmed = false)) },
            ) shouldBe false
            G.twoIdentifiersActivelyConfirmed(override.withSession { it.copy(twoIdentifierCheck = check.copy(statedNameConfirmed = false)) }) shouldBe
                false
            G.twoIdentifiersActivelyConfirmed(override.withSession { it.copy(twoIdentifierCheck = check.copy(recordShownOnDevice = false)) }) shouldBe
                false
            G.twoIdentifiersActivelyConfirmed(override.withSession { it.copy(twoIdentifierCheck = null) }) shouldBe false
        }

        test("twoIdentifiersActivelyConfirmed fails for a merged MRN or an unknown check digit") {
            G.twoIdentifiersActivelyConfirmed(override.withIdentity(MrnIdentityAnswer(true, MrnStatus.MERGED))) shouldBe false
            G.twoIdentifiersActivelyConfirmed(override.withIdentity(MrnIdentityAnswer(null, MrnStatus.CURRENT))) shouldBe false
        }

        test("identityOverrideReasonChosen holds for either reason chosen by the user and fails when defaulted or absent") {
            IdentityOverrideReason.entries.forEach { reason ->
                G.identityOverrideReasonChosen(baseline.copy(overrideReason = Choice(reason, chosenByUser = true))) shouldBe true
                G.identityOverrideReasonChosen(baseline.copy(overrideReason = Choice(reason, chosenByUser = false))) shouldBe false
            }
            G.identityOverrideReasonChosen(baseline) shouldBe false
        }

        // --- notTransfusionSample ----------------------------------------------------------------------------------

        test("notTransfusionSample holds when the catalogue marks no served test as a pre-transfusion sample") {
            G.notTransfusionSample(baseline) shouldBe true
        }

        test("notTransfusionSample fails for a pre-transfusion test, an unknown flag, or a specimen that serves no test (SI-11)") {
            G.notTransfusionSample(baseline.withFirstTest { it.copy(preTransfusionSample = true) }) shouldBe false
            G.notTransfusionSample(baseline.withFirstTest { it.copy(preTransfusionSample = null) }) shouldBe false
            G.notTransfusionSample(baseline.withOrders(order.copy(tests = emptyList()))) shouldBe false
            G.notTransfusionSample(baseline.withOrders()) shouldBe false
        }

        // --- labelIdentifiersComplete ------------------------------------------------------------------------------

        test("labelIdentifiersComplete holds for both name forms, the MRN with a valid check digit and the date of birth") {
            G.labelIdentifiersComplete(baseline) shouldBe true
        }

        test("labelIdentifiersComplete holds with the approximate-DOB flag for an approximate record, and only then") {
            val approximate = baseline.copy(patient = baseline.patient.copy(dateOfBirth = "1980", dateOfBirthApproximate = true))
            val flagOnly = SpecimenSamples.labelContent.copy(dateOfBirth = null, approximateDobFlag = true)
            G.labelIdentifiersComplete(approximate.copy(labelContent = flagOnly)) shouldBe true
            G.labelIdentifiersComplete(baseline.copy(labelContent = flagOnly)) shouldBe false
        }

        test("labelIdentifiersComplete fails for a missing or different identifier, a room or bed in a slot, or another accession") {
            val label = SpecimenSamples.labelContent
            listOf(
                label.copy(nameInScript = null),
                label.copy(nameLatin = ""),
                label.copy(nameLatin = "SYN-Other Name"),
                label.copy(mrn = SpecimenSamples.OTHER_MRN),
                label.copy(dateOfBirth = "1980-03"),
                label.copy(dateOfBirth = null),
                label.copy(roomOrBedInIdentifierSlot = true),
                label.copy(accession = DOWNTIME_ACCESSION),
                label.copy(accession = null),
            ).forEach { content -> G.labelIdentifiersComplete(baseline.copy(labelContent = content)) shouldBe false }
            G.labelIdentifiersComplete(baseline.copy(labelContent = null)) shouldBe false
            G.labelIdentifiersComplete(baseline.withIdentity(MrnIdentityAnswer(null, MrnStatus.CURRENT))) shouldBe false
        }

        // --- accessionFromPermittedSource --------------------------------------------------------------------------

        test("accessionFromPermittedSource holds online for a cell-issued number, including when only the internet is lost") {
            G.accessionFromPermittedSource(baseline) shouldBe true
            G.accessionFromPermittedSource(baseline.copy(commandMode = CommandMode.INTERNET_LOST_CELL_REACHABLE)) shouldBe true
        }

        test("accessionFromPermittedSource holds offline for an unused number in this device's site-prefixed block, both ends included") {
            G.accessionFromPermittedSource(baseline.offline()) shouldBe true
            listOf(CommandMode.EDGE_AGENT_OFFLINE, CommandMode.MOBILE_OFFLINE).forEach { mode ->
                G.accessionFromPermittedSource(baseline.offline().copy(commandMode = mode)) shouldBe true
            }
            val block = SpecimenSamples.DEVICE_BLOCK
            G.accessionFromPermittedSource(baseline.offline().copy(accession = AccessionNumber(block.sitePrefix, block.firstSerial))) shouldBe
                true
            G.accessionFromPermittedSource(baseline.offline().copy(accession = AccessionNumber(block.sitePrefix, block.lastSerial))) shouldBe
                true
            G.accessionFromPermittedSource(baseline.offline().copy(accession = AccessionNumber(block.sitePrefix, block.lastSerial + 1))) shouldBe
                false
        }

        test("accessionFromPermittedSource fails online for a number the cell did not issue, and for an unknown mode") {
            G.accessionFromPermittedSource(baseline.copy(accessionIssuedByCellService = false)) shouldBe false
            G.accessionFromPermittedSource(baseline.copy(commandMode = null)) shouldBe false
            G.accessionFromPermittedSource(baseline.copy(accession = null)) shouldBe false
        }

        test("accessionFromPermittedSource fails offline for a cell number, a used number, another device's block or another site") {
            G.accessionFromPermittedSource(baseline.copy(commandMode = CommandMode.CELL_LOST)) shouldBe false
            G.accessionFromPermittedSource(baseline.offline().copy(accession = AccessionNumber(SpecimenSamples.SITE, 900_001L))) shouldBe false
            G.accessionFromPermittedSource(baseline.offline().copy(accession = AccessionNumber(SpecimenSamples.SITE, 700_010L))) shouldBe false
            G.accessionFromPermittedSource(baseline.offline().copy(siteAccessionPrefix = "SYN-S9")) shouldBe false
            G.accessionFromPermittedSource(baseline.offline().copy(commandDeviceId = SpecimenSamples.OTHER_DEVICE)) shouldBe false
        }

        // --- kitAccessionFromAllocatedBlock ------------------------------------------------------------------------

        val kitted = SpecimenSamples.withKit(baseline)

        test("kitAccessionFromAllocatedBlock holds for scanned, unused kit labels from the kit's block bound to this patient") {
            G.kitAccessionFromAllocatedBlock(kitted) shouldBe true
        }

        test("kitAccessionFromAllocatedBlock fails for no kit, no labels, a typed or used or outside label, another site, another identity") {
            val kit = kitted.kit ?: error("kit expected")
            val scan = kit.labelScans.first()
            G.kitAccessionFromAllocatedBlock(baseline) shouldBe false
            listOf(
                kit.copy(labelScans = emptyList()),
                kit.copy(labelScans = listOf(scan.copy(entry = EntryMethod.TYPED))),
                kit.copy(labelScans = listOf(scan.copy(accession = AccessionNumber(SpecimenSamples.SITE, 800_001L)))),
                kit.copy(labelScans = listOf(scan, scan.copy(accession = DOWNTIME_ACCESSION))),
                kit.copy(labelScans = listOf(scan.copy(accession = null))),
                kit.copy(block = kit.block.copy(sitePrefix = "SYN-S9")),
                kit.copy(kitIdentityIsSpecimenPatient = false),
                kit.copy(kitIdentityIsSpecimenPatient = null),
            ).forEach { changed -> G.kitAccessionFromAllocatedBlock(kitted.copy(kit = changed)) shouldBe false }
        }

        // --- reprintReasonChosen -----------------------------------------------------------------------------------

        val reprinted = SpecimenSamples.withReprint(baseline)

        test("reprintReasonChosen holds for a chosen reason recorded with user, device and time on the existing accession number") {
            G.reprintReasonChosen(reprinted) shouldBe true
        }

        test("reprintReasonChosen fails for a defaulted or blank reason, a missing record field, or another accession number") {
            val reprint = reprinted.reprint ?: error("reprint expected")
            listOf(
                reprint.copy(reason = Choice("SYN-PRINTER-JAM", chosenByUser = false)),
                reprint.copy(reason = Choice(" ", chosenByUser = true)),
                reprint.copy(reason = null),
                reprint.copy(userId = null),
                reprint.copy(deviceId = ""),
                reprint.copy(at = null),
                reprint.copy(labelAccession = DOWNTIME_ACCESSION),
                reprint.copy(labelAccession = null),
            ).forEach { changed -> G.reprintReasonChosen(reprinted.copy(reprint = changed)) shouldBe false }
            G.reprintReasonChosen(baseline) shouldBe false
        }

        // --- collectorIdentified -----------------------------------------------------------------------------------

        test("collectorIdentified holds for the authenticated session user with the collecting device recorded") {
            G.collectorIdentified(baseline) shouldBe true
        }

        test("collectorIdentified fails for a typed name, another user, no authenticated user, no device, or no collector") {
            val collector = baseline.collector ?: error("collector expected")
            G.collectorIdentified(baseline.copy(collector = collector.copy(entry = CollectorEntry.TYPED_NAME))) shouldBe false
            G.collectorIdentified(baseline.copy(collector = collector.copy(userId = "SYN-USER-99"))) shouldBe false
            G.collectorIdentified(baseline.copy(authenticatedUserId = null)) shouldBe false
            G.collectorIdentified(baseline.copy(collector = collector.copy(userId = null), authenticatedUserId = null)) shouldBe false
            G.collectorIdentified(baseline.copy(collector = collector.copy(deviceId = null))) shouldBe false
            G.collectorIdentified(baseline.copy(collector = null)) shouldBe false
        }

        // --- collectionTimeRecorded --------------------------------------------------------------------------------

        val time = baseline.collectionTime ?: error("collection time expected")

        test("collectionTimeRecorded holds inside the bedside session, at both ends of the window") {
            G.collectionTimeRecorded(baseline) shouldBe true
            G.collectionTimeRecorded(baseline.copy(collectionTime = time.copy(clinical = IDENTIFIED_AT))) shouldBe true
            G.collectionTimeRecorded(baseline.copy(collectionTime = time.copy(clinical = NOW))) shouldBe true
        }

        test("collectionTimeRecorded fails just before the session start, just after the recording time, or unconfirmed") {
            G.collectionTimeRecorded(baseline.copy(collectionTime = time.copy(clinical = IDENTIFIED_AT.minusMillis(1)))) shouldBe false
            G.collectionTimeRecorded(baseline.copy(collectionTime = time.copy(clinical = NOW.plusMillis(1)))) shouldBe false
            G.collectionTimeRecorded(baseline.copy(collectionTime = time.copy(confirmedByCollector = false))) shouldBe false
            G.collectionTimeRecorded(baseline.copy(collectionTime = null)) shouldBe false
        }

        test("collectionTimeRecorded starts the session at the two-identifier check on the override path, and needs an identification") {
            G.collectionTimeRecorded(override) shouldBe true
            G.collectionTimeRecorded(override.copy(collectionTime = time.copy(clinical = IDENTIFIED_AT.minusMillis(1)))) shouldBe false
            G.collectionTimeRecorded(baseline.copy(session = null)) shouldBe false
            G.collectionTimeRecorded(baseline.withBand { it.copy(decodedMrn = SpecimenSamples.OTHER_MRN) }) shouldBe false
        }

        test("collectionTimeRecorded accepts the patient's stated time up to the session start for a patient-collected type") {
            val patientCollected = baseline.copy(specimenType = baseline.specimenType.copy(patientCollected = true))
            val stated = time.copy(clinical = IDENTIFIED_AT.minus(Duration.ofHours(2)), statedByPatient = true)
            G.collectionTimeRecorded(patientCollected.copy(collectionTime = stated)) shouldBe true
            G.collectionTimeRecorded(patientCollected.copy(collectionTime = stated.copy(clinical = IDENTIFIED_AT))) shouldBe true
            G.collectionTimeRecorded(patientCollected.copy(collectionTime = stated.copy(clinical = IDENTIFIED_AT.plusMillis(1)))) shouldBe false
            G.collectionTimeRecorded(patientCollected.copy(collectionTime = stated.copy(statedByPatient = false))) shouldBe false
        }

        test("collectionTimeRecorded treats an unknown patient-collected flag as not patient-collected (stricter)") {
            val unknown = baseline.copy(specimenType = baseline.specimenType.copy(patientCollected = null))
            val stated = time.copy(clinical = IDENTIFIED_AT.minus(Duration.ofHours(2)), statedByPatient = true)
            G.collectionTimeRecorded(unknown.copy(collectionTime = stated)) shouldBe false
            G.collectionTimeRecorded(unknown) shouldBe true
        }

        // --- labelledAtBedside -------------------------------------------------------------------------------------

        val label = SpecimenSamples.labelScan

        test("labelledAtBedside holds for a scanned label of this specimen after the identification on the same device") {
            G.labelledAtBedside(baseline) shouldBe true
            G.labelledAtBedside(override) shouldBe true
            G.labelledAtBedside(baseline.withSession { it.copy(labelScans = listOf(label.copy(at = IDENTIFIED_AT.plusMillis(1)))) }) shouldBe true
        }

        test("labelledAtBedside fails at or before the identification instant, on another device, typed, or for another accession") {
            listOf(
                label.copy(at = IDENTIFIED_AT),
                label.copy(at = IDENTIFIED_AT.minusMillis(1)),
                label.copy(deviceId = SpecimenSamples.OTHER_DEVICE),
                label.copy(entry = EntryMethod.TYPED),
                label.copy(accession = DOWNTIME_ACCESSION),
                label.copy(accession = null),
            ).forEach { scan -> G.labelledAtBedside(baseline.withSession { it.copy(labelScans = listOf(scan)) }) shouldBe false }
            G.labelledAtBedside(baseline.withSession { it.copy(labelScans = emptyList()) }) shouldBe false
            G.labelledAtBedside(baseline.copy(accession = null)) shouldBe false
        }

        test("labelledAtBedside fails when the session's band identified another patient, or nobody was identified") {
            G.labelledAtBedside(baseline.withBand { it.copy(decodedMrn = SpecimenSamples.OTHER_MRN) }) shouldBe false
            G.labelledAtBedside(baseline.withSession { it.copy(wristbandScans = emptyList()) }) shouldBe false
            G.labelledAtBedside(baseline.copy(session = null)) shouldBe false
        }

        // --- downtimeBackEntryAllowed, paperCollectionRecorded, downtimeLabelConfirmed --------------------------------

        val backEntry = SpecimenSamples.withBackEntry(baseline)
        val paper = backEntry.paperCollection ?: error("paper collection expected")
        val episode = SpecimenSamples.EPISODE
        val episodeEnd = episode.end ?: error("episode end expected")

        test("downtimeBackEntryAllowed holds with the privilege, an episode covering the time, and a writable audit") {
            G.downtimeBackEntryAllowed(backEntry) shouldBe true
            G.downtimeBackEntryAllowed(backEntry.copy(paperCollection = paper.copy(clinicalTime = episode.start))) shouldBe true
            G.downtimeBackEntryAllowed(backEntry.copy(paperCollection = paper.copy(clinicalTime = episodeEnd))) shouldBe true
            G.downtimeBackEntryAllowed(backEntry.copy(downtimeEpisodes = listOf(DowntimeEpisode(episode.start, null)))) shouldBe true
        }

        test("downtimeBackEntryAllowed fails without the privilege, outside every episode, or with an audit outage or unknown audit") {
            G.downtimeBackEntryAllowed(backEntry.copy(privileges = emptySet())) shouldBe false
            G.downtimeBackEntryAllowed(backEntry.copy(paperCollection = paper.copy(clinicalTime = episode.start.minusMillis(1)))) shouldBe false
            G.downtimeBackEntryAllowed(backEntry.copy(paperCollection = paper.copy(clinicalTime = episodeEnd.plusMillis(1)))) shouldBe false
            G.downtimeBackEntryAllowed(backEntry.copy(downtimeEpisodes = emptyList())) shouldBe false
            G.downtimeBackEntryAllowed(backEntry.copy(auditWritable = false)) shouldBe false
            G.downtimeBackEntryAllowed(backEntry.copy(auditWritable = null)) shouldBe false
            G.downtimeBackEntryAllowed(backEntry.copy(paperCollection = null)) shouldBe false
        }

        test("paperCollectionRecorded holds for the paper collector and time kept as clinical time inside the episode, labelled") {
            G.paperCollectionRecorded(backEntry) shouldBe true
        }

        test("paperCollectionRecorded fails for a changed clinical time, no collector, no label, a time outside the episode or in the future") {
            listOf(
                paper.copy(clinicalTime = NOW),
                paper.copy(clinicalTime = null),
                paper.copy(paperTime = null),
                paper.copy(collectorIdentity = " "),
                paper.copy(labelledAsBackEntry = false),
                paper.copy(paperTime = episodeEnd.plusMillis(1), clinicalTime = episodeEnd.plusMillis(1)),
            ).forEach { changed -> G.paperCollectionRecorded(backEntry.copy(paperCollection = changed)) shouldBe false }
            val future = NOW.plusMillis(1)
            G.paperCollectionRecorded(
                backEntry.copy(
                    paperCollection = paper.copy(paperTime = future, clinicalTime = future),
                    downtimeEpisodes = listOf(DowntimeEpisode(episode.start, null)),
                ),
            ) shouldBe false
            G.paperCollectionRecorded(backEntry.copy(paperCollection = null)) shouldBe false
        }

        test("downtimeLabelConfirmed holds for a scanned label with the existing accession and confirmed identifiers") {
            G.downtimeLabelConfirmed(backEntry) shouldBe true
        }

        test("downtimeLabelConfirmed holds for a specimen without accession when the label lies unused in a site downtime block") {
            val label = (backEntry.backEntryLabel ?: error("label expected")).let { it.copy(scan = it.scan.copy(accession = DOWNTIME_ACCESSION)) }
            G.downtimeLabelConfirmed(backEntry.copy(accession = null, backEntryLabel = label)) shouldBe true
            val used = label.copy(scan = label.scan.copy(accession = AccessionNumber(SpecimenSamples.SITE, 900_001L)))
            G.downtimeLabelConfirmed(backEntry.copy(accession = null, backEntryLabel = used)) shouldBe false
            val outside = label.copy(scan = label.scan.copy(accession = AccessionNumber(SpecimenSamples.SITE, 1L)))
            G.downtimeLabelConfirmed(backEntry.copy(accession = null, backEntryLabel = outside)) shouldBe false
        }

        test("downtimeLabelConfirmed fails for a typed label, another accession, unconfirmed identifiers, or no label") {
            val label = backEntry.backEntryLabel ?: error("label expected")
            G.downtimeLabelConfirmed(backEntry.copy(backEntryLabel = label.copy(scan = label.scan.copy(entry = EntryMethod.TYPED)))) shouldBe false
            G.downtimeLabelConfirmed(backEntry.copy(backEntryLabel = label.copy(scan = label.scan.copy(accession = DOWNTIME_ACCESSION)))) shouldBe
                false
            G.downtimeLabelConfirmed(backEntry.copy(backEntryLabel = label.copy(scan = label.scan.copy(accession = null)))) shouldBe false
            G.downtimeLabelConfirmed(backEntry.copy(backEntryLabel = label.copy(identifiersConfirmed = false))) shouldBe false
            G.downtimeLabelConfirmed(backEntry.copy(backEntryLabel = null)) shouldBe false
        }

        // --- dispatchScanRecorded, receiptScanMatchesOrder --------------------------------------------------------

        test("dispatchScanRecorded holds for a scanned dispatch event of this specimen with user, device, location and time") {
            G.dispatchScanRecorded(baseline) shouldBe true
        }

        test("dispatchScanRecorded fails for a typed scan, a missing field, or another accession number") {
            val scan = baseline.dispatchScan ?: error("dispatch scan expected")
            listOf(
                scan.copy(entry = EntryMethod.TYPED),
                scan.copy(at = null),
                scan.copy(userId = null),
                scan.copy(deviceId = ""),
                scan.copy(location = null),
                scan.copy(accession = DOWNTIME_ACCESSION),
                scan.copy(accession = null),
            ).forEach { changed -> G.dispatchScanRecorded(baseline.copy(dispatchScan = changed)) shouldBe false }
            G.dispatchScanRecorded(baseline.copy(dispatchScan = null)) shouldBe false
        }

        test("receiptScanMatchesOrder holds for a scanned label of this specimen serving an order") {
            G.receiptScanMatchesOrder(baseline) shouldBe true
        }

        test("receiptScanMatchesOrder fails for a typed or foreign label, no scan, or a specimen serving no order") {
            val scan = baseline.receiptScan ?: error("receipt scan expected")
            G.receiptScanMatchesOrder(baseline.copy(receiptScan = scan.copy(entry = EntryMethod.TYPED))) shouldBe false
            G.receiptScanMatchesOrder(baseline.copy(receiptScan = scan.copy(accession = DOWNTIME_ACCESSION))) shouldBe false
            G.receiptScanMatchesOrder(baseline.copy(receiptScan = null)) shouldBe false
            G.receiptScanMatchesOrder(baseline.withOrders()) shouldBe false
        }

        // --- acceptableForEveryTest / notAcceptableForEveryTest / acceptableForSomeTest ---------------------------------

        val record = SpecimenSamples.acceptabilityRecord
        val someFail =
            baseline
                .withFirstTest { it.copy(limits = it.limits.copy(maxHaemolysisIndex = 0)) }
                .copy(acceptabilityCheck = record.copy(haemolysisIndex = 1))

        test("acceptableForEveryTest holds when every eligible test passes; notAcceptableForEveryTest is its complement") {
            G.acceptableForEveryTest(baseline) shouldBe true
            G.notAcceptableForEveryTest(baseline) shouldBe false
            G.acceptableForSomeTest(baseline) shouldBe true
        }

        test("acceptableForEveryTest fails and notAcceptableForEveryTest holds when one test fails; acceptableForSomeTest still holds") {
            G.acceptableForEveryTest(someFail) shouldBe false
            G.notAcceptableForEveryTest(someFail) shouldBe true
            G.acceptableForSomeTest(someFail) shouldBe true
        }

        test("acceptableForEveryTest and acceptableForSomeTest ignore tests of revoked orders but need one eligible test") {
            val revoked = order.copy(orderId = "SYN-ORD-0009", state = OrderState.REVOKED, tests = listOf(SpecimenSamples.test("SYN-TEST-R")))
            val failingRevoked = baseline.withOrders(order, revoked.copy(tests = revoked.tests.map { it.copy(limits = it.limits.copy(allowedContainers = emptySet())) }))
            G.acceptableForEveryTest(failingRevoked) shouldBe true
            val onlyRevoked = baseline.withOrders(revoked)
            G.acceptableForEveryTest(onlyRevoked) shouldBe false
            G.notAcceptableForEveryTest(onlyRevoked) shouldBe true
            G.acceptableForSomeTest(onlyRevoked) shouldBe false
        }

        test("acceptableForEveryTest needs a check recorded at or after receipt; notAcceptableForEveryTest and acceptableForSomeTest follow") {
            val receipt = baseline.receiptScan ?: error("receipt expected")
            G.acceptableForEveryTest(baseline.copy(acceptabilityCheck = record.copy(at = receipt.at))) shouldBe true
            val before = baseline.copy(acceptabilityCheck = record.copy(at = receipt.at.minusMillis(1)))
            G.acceptableForEveryTest(before) shouldBe false
            G.notAcceptableForEveryTest(before) shouldBe true
            G.acceptableForSomeTest(before) shouldBe false
            G.acceptableForEveryTest(baseline.copy(acceptabilityCheck = null)) shouldBe false
            G.acceptableForSomeTest(baseline.copy(receiptScan = null)) shouldBe false
        }

        test("acceptableForEveryTest fails on each criterion: container, volume, HIL, clotting, label, each unknown value") {
            listOf(
                baseline.copy(acceptabilityCheck = record.copy(container = SpecimenSamples.OTHER_CONTAINER)),
                baseline.copy(acceptabilityCheck = record.copy(container = null)),
                SpecimenSamples.withLimits(baseline) { it.limits.copy(allowedContainers = null) },
                baseline.copy(acceptabilityCheck = record.copy(volume = Volume(BigDecimal("1.99"), SpecimenSamples.UNIT))),
                baseline.copy(acceptabilityCheck = record.copy(volume = Volume(BigDecimal("3000"), "uL"))),
                baseline.copy(acceptabilityCheck = record.copy(volume = null)),
                SpecimenSamples.withLimits(baseline) { it.limits.copy(minimumVolume = null) },
                baseline.copy(acceptabilityCheck = record.copy(haemolysisIndex = SpecimenSamples.MAX_INDEX + 1)),
                baseline.copy(acceptabilityCheck = record.copy(icterusIndex = SpecimenSamples.MAX_INDEX + 1)),
                baseline.copy(acceptabilityCheck = record.copy(lipaemiaIndex = SpecimenSamples.MAX_INDEX + 1)),
                baseline.copy(acceptabilityCheck = record.copy(clottingGrade = 1)),
                baseline.copy(acceptabilityCheck = record.copy(haemolysisIndex = null)),
                SpecimenSamples.withLimits(baseline) { it.limits.copy(maxLipaemiaIndex = null) },
                baseline.copy(receiptScan = baseline.receiptScan?.copy(entry = EntryMethod.TYPED)),
            ).forEach { facts ->
                G.acceptableForEveryTest(facts) shouldBe false
                G.notAcceptableForEveryTest(facts) shouldBe true
            }
        }

        test("acceptableForEveryTest accepts the minimum volume and the HIL limit exactly (boundaries)") {
            G.acceptableForEveryTest(baseline.copy(acceptabilityCheck = record.copy(volume = SpecimenSamples.MIN_VOLUME))) shouldBe true
            G.acceptableForEveryTest(baseline.copy(acceptabilityCheck = record.copy(haemolysisIndex = SpecimenSamples.MAX_INDEX))) shouldBe true
            G.acceptableForEveryTest(baseline.copy(acceptabilityCheck = record.copy(volume = Volume(BigDecimal("2"), SpecimenSamples.UNIT)))) shouldBe
                true
        }

        test("acceptableForEveryTest measures stability from the clinical collection time: at the limit holds, beyond fails, unknown fails") {
            val atLimit = baseline.copy(collectionTime = time.copy(clinical = NOW.minus(SpecimenSamples.STABILITY)))
            G.acceptableForEveryTest(atLimit) shouldBe true
            G.acceptableForEveryTest(atLimit.copy(collectionTime = time.copy(clinical = NOW.minus(SpecimenSamples.STABILITY).minusMillis(1)))) shouldBe
                false
            G.acceptableForEveryTest(baseline.copy(collectionTime = null)) shouldBe false
            G.acceptableForEveryTest(baseline.copy(collectionTime = time.copy(clinical = NOW.plusMillis(1)))) shouldBe false
            G.acceptableForEveryTest(SpecimenSamples.withLimits(baseline) { it.limits.copy(stabilityLimit = null) }) shouldBe false
        }

        test("acceptableForSomeTest fails when every eligible test fails") {
            G.acceptableForSomeTest(baseline.copy(acceptabilityCheck = record.copy(container = SpecimenSamples.OTHER_CONTAINER))) shouldBe false
        }

        // --- caveatAuthorised, caveatAllowedForSpecimen, caveatReasonChosen -------------------------------------------

        test("caveatAuthorised holds with the accept-with-caveat privilege and a writable audit") {
            G.caveatAuthorised(baseline.copy(privileges = setOf(SpecimenPrivilege.ACCEPT_WITH_CAVEAT))) shouldBe true
        }

        test("caveatAuthorised fails without the privilege, or with an audit outage or unknown audit") {
            G.caveatAuthorised(baseline) shouldBe false
            G.caveatAuthorised(baseline.copy(privileges = setOf(SpecimenPrivilege.SPECIMEN_ENTERED_IN_ERROR))) shouldBe false
            G.caveatAuthorised(baseline.copy(privileges = setOf(SpecimenPrivilege.ACCEPT_WITH_CAVEAT), auditWritable = false)) shouldBe false
            G.caveatAuthorised(baseline.copy(privileges = setOf(SpecimenPrivilege.ACCEPT_WITH_CAVEAT), auditWritable = null)) shouldBe false
        }

        test("caveatAllowedForSpecimen holds for an irreplaceable type, or when every failed criterion is waivable for its test") {
            G.caveatAllowedForSpecimen(someFail.copy(specimenType = someFail.specimenType.copy(irreplaceable = true))) shouldBe true
            val waivable = SpecimenSamples.withLimits(someFail) { it.limits.copy(waivableCriteria = setOf(AcceptabilityCriterion.HAEMOLYSIS)) }
            G.caveatAllowedForSpecimen(waivable) shouldBe true
        }

        test("caveatAllowedForSpecimen fails for a non-waivable criterion, an unknown irreplaceable flag, or unknown waivable criteria") {
            G.caveatAllowedForSpecimen(someFail) shouldBe false
            G.caveatAllowedForSpecimen(someFail.copy(specimenType = someFail.specimenType.copy(irreplaceable = null))) shouldBe false
            val otherWaived = SpecimenSamples.withLimits(someFail) { it.limits.copy(waivableCriteria = setOf(AcceptabilityCriterion.ICTERUS)) }
            G.caveatAllowedForSpecimen(otherWaived) shouldBe false
        }

        test("caveatAllowedForSpecimen never waives the label criterion, even for an irreplaceable type or a waivable label") {
            val unlabelled = someFail.copy(receiptScan = someFail.receiptScan?.copy(accession = DOWNTIME_ACCESSION))
            G.caveatAllowedForSpecimen(unlabelled.copy(specimenType = unlabelled.specimenType.copy(irreplaceable = true))) shouldBe false
            val waivedLabel = SpecimenSamples.withLimits(unlabelled) { it.limits.copy(waivableCriteria = AcceptabilityCriterion.entries.toSet()) }
            G.caveatAllowedForSpecimen(waivedLabel) shouldBe false
        }

        test("caveatAllowedForSpecimen needs a recorded acceptability check after receipt and an eligible test") {
            val irreplaceable = someFail.copy(specimenType = someFail.specimenType.copy(irreplaceable = true))
            G.caveatAllowedForSpecimen(irreplaceable.copy(acceptabilityCheck = null)) shouldBe false
            G.caveatAllowedForSpecimen(SpecimenSamples.withOrdersRevoked(irreplaceable)) shouldBe false
        }

        test("caveatReasonChosen holds for a reason chosen by the user and fails when defaulted, blank or absent") {
            G.caveatReasonChosen(baseline.copy(caveatReason = Choice("SYN-IRREPLACEABLE-CSF", true))) shouldBe true
            G.caveatReasonChosen(baseline.copy(caveatReason = Choice("SYN-IRREPLACEABLE-CSF", false))) shouldBe false
            G.caveatReasonChosen(baseline.copy(caveatReason = Choice("", true))) shouldBe false
            G.caveatReasonChosen(baseline) shouldBe false
        }

        // --- allTestsFinished / noTestNeedsRecollection / testNeedsRecollection ------------------------------------------

        test("allTestsFinished holds for final, amended, corrected, cancelled and entered-in-error results") {
            listOf(ResultState.FINAL, ResultState.AMENDED, ResultState.CORRECTED, ResultState.CANCELLED, ResultState.ENTERED_IN_ERROR)
                .forEach { state -> G.allTestsFinished(baseline.withFirstTest { it.copy(resultStates = listOf(state)) }) shouldBe true }
        }

        test("allTestsFinished holds for a test rejected at the check and for a test of a revoked order") {
            G.allTestsFinished(baseline.withFirstTest { it.copy(resultStates = emptyList(), rejectedAtCheck = true) }) shouldBe true
            val revoked = order.copy(orderId = "SYN-ORD-0009", state = OrderState.REVOKED, tests = listOf(SpecimenSamples.test("SYN-TEST-R").copy(resultStates = emptyList())))
            G.allTestsFinished(baseline.withOrders(order, revoked)) shouldBe true
        }

        test("allTestsFinished fails for a preliminary, registered or missing result, and for a specimen that serves no test") {
            listOf(listOf(ResultState.PRELIMINARY), listOf(ResultState.REGISTERED), emptyList()).forEach { states ->
                G.allTestsFinished(baseline.withFirstTest { it.copy(resultStates = states) }) shouldBe false
            }
            G.allTestsFinished(baseline.withOrders(order.copy(tests = emptyList()))) shouldBe false
            G.allTestsFinished(baseline.withOrders()) shouldBe false
        }

        test("testNeedsRecollection holds and noTestNeedsRecollection fails for a cancelled result of an open order (complements)") {
            listOf(ResultState.CANCELLED, ResultState.ENTERED_IN_ERROR).forEach { state ->
                val facts = baseline.withFirstTest { it.copy(resultStates = listOf(state)) }
                G.testNeedsRecollection(facts) shouldBe true
                G.noTestNeedsRecollection(facts) shouldBe false
            }
            val unknownOrder = baseline.withOrders(order.copy(state = null)).withFirstTest { it.copy(resultStates = listOf(ResultState.CANCELLED)) }
            G.testNeedsRecollection(unknownOrder) shouldBe true
        }

        test("noTestNeedsRecollection holds and testNeedsRecollection fails when the order is closed or a released result exists") {
            listOf(
                baseline,
                baseline.withFirstTest { it.copy(resultStates = listOf(ResultState.CANCELLED, ResultState.CORRECTED)) },
                baseline
                    .withOrders(order.copy(state = OrderState.COMPLETED))
                    .withFirstTest { it.copy(resultStates = listOf(ResultState.CANCELLED)) },
                baseline
                    .withOrders(order.copy(state = OrderState.REVOKED))
                    .withFirstTest { it.copy(resultStates = listOf(ResultState.ENTERED_IN_ERROR)) },
            ).forEach { facts ->
                G.noTestNeedsRecollection(facts) shouldBe true
                G.testNeedsRecollection(facts) shouldBe false
            }
        }

        // --- storageLocationScanned, retentionNotRequired, retentionElapsed, noLegalHold ---------------------------------

        test("storageLocationScanned holds for a scanned rack and position with user and time") {
            G.storageLocationScanned(baseline) shouldBe true
        }

        test("storageLocationScanned fails for a typed location or a missing rack, position, user or time") {
            val scan = baseline.storageScan ?: error("storage scan expected")
            listOf(
                scan.copy(entry = EntryMethod.TYPED),
                scan.copy(rack = null),
                scan.copy(position = ""),
                scan.copy(userId = null),
                scan.copy(at = null),
            ).forEach { changed -> G.storageLocationScanned(baseline.copy(storageScan = changed)) shouldBe false }
            G.storageLocationScanned(baseline.copy(storageScan = null)) shouldBe false
        }

        val week = RetentionRule.Period(Duration.ofDays(SpecimenSamples.RETENTION_DAYS))

        test("retentionNotRequired holds when the catalogue sets no retention period for any served test") {
            G.retentionNotRequired(baseline) shouldBe true
        }

        test("retentionNotRequired fails for a set period, an unknown rule, or a specimen that serves no test") {
            G.retentionNotRequired(baseline.withFirstTest { it.copy(retention = week) }) shouldBe false
            G.retentionNotRequired(baseline.withFirstTest { it.copy(retention = RetentionRule.Period(Duration.ZERO)) }) shouldBe false
            G.retentionNotRequired(baseline.withFirstTest { it.copy(retention = null) }) shouldBe false
            G.retentionNotRequired(baseline.withOrders()) shouldBe false
        }

        test("retentionElapsed holds at and after the storage time plus the longest period, and fails just before") {
            val longest = SpecimenSamples.mapTests(baseline) { it.copy(retention = week) }.withFirstTest { it.copy(retention = RetentionRule.Period(Duration.ofDays(1))) }
            G.retentionElapsed(longest.copy(storedAt = NOW.minus(week.duration))) shouldBe true
            G.retentionElapsed(longest.copy(storedAt = NOW.minus(week.duration).minusMillis(1))) shouldBe true
            G.retentionElapsed(longest.copy(storedAt = NOW.minus(week.duration).plusMillis(1))) shouldBe false
            G.retentionElapsed(baseline) shouldBe true
        }

        test("retentionElapsed fails for an unknown period, no storage time, or a specimen that serves no test") {
            G.retentionElapsed(baseline.withFirstTest { it.copy(retention = null) }) shouldBe false
            G.retentionElapsed(baseline.copy(storedAt = null)) shouldBe false
            G.retentionElapsed(baseline.withOrders()) shouldBe false
        }

        test("noLegalHold holds when neither the retention engine nor a forensic/MLC label holds the specimen") {
            G.noLegalHold(baseline) shouldBe true
        }

        test("noLegalHold fails for any hold and for an unknown hold status (counts as held)") {
            G.noLegalHold(baseline.copy(retentionEngineHold = true)) shouldBe false
            G.noLegalHold(baseline.copy(retentionEngineHold = null)) shouldBe false
            G.noLegalHold(baseline.copy(forensicMlcHold = true)) shouldBe false
            G.noLegalHold(baseline.copy(forensicMlcHold = null)) shouldBe false
        }

        // --- rejectionReasonChosen, labelDefectReasonChosen --------------------------------------------------------

        test("rejectionReasonChosen holds for each of the seven coded reasons chosen by the user") {
            RejectionReason.entries.forEach { reason ->
                G.rejectionReasonChosen(baseline.copy(rejectionReason = Choice(reason, chosenByUser = true))) shouldBe true
            }
        }

        test("rejectionReasonChosen fails for a defaulted reason or none") {
            G.rejectionReasonChosen(baseline.copy(rejectionReason = Choice(RejectionReason.HAEMOLYSED, chosenByUser = false))) shouldBe false
            G.rejectionReasonChosen(baseline) shouldBe false
        }

        test("labelDefectReasonChosen holds only for unlabelled or mislabelled chosen by the user") {
            RejectionReason.entries.forEach { reason ->
                val expected = reason == RejectionReason.UNLABELLED || reason == RejectionReason.MISLABELLED
                G.labelDefectReasonChosen(baseline.copy(rejectionReason = Choice(reason, chosenByUser = true))) shouldBe expected
            }
            G.labelDefectReasonChosen(baseline.copy(rejectionReason = Choice(RejectionReason.UNLABELLED, chosenByUser = false))) shouldBe false
            G.labelDefectReasonChosen(baseline) shouldBe false
        }

        // --- lossDeclared ------------------------------------------------------------------------------------------

        val declaration = LossDeclaration(SpecimenSamples.USER, NOW, lastScanEventShown = true, raisedAutomatically = false)

        test("lossDeclared holds for a user's deliberate declaration after seeing the last scan event") {
            G.lossDeclared(baseline.copy(lossDeclaration = declaration)) shouldBe true
        }

        test("lossDeclared fails when raised automatically, without a user or time, or without the last scan event shown") {
            listOf(
                declaration.copy(raisedAutomatically = true),
                declaration.copy(declaredByUserId = null),
                declaration.copy(at = null),
                declaration.copy(lastScanEventShown = false),
            ).forEach { changed -> G.lossDeclared(baseline.copy(lossDeclaration = changed)) shouldBe false }
            G.lossDeclared(baseline) shouldBe false
        }

        // --- privilegedAndAudited, errorReasonEntered --------------------------------------------------------------

        val inError = SpecimenSamples.withEnteredInError(baseline)

        test("privilegedAndAudited holds with the specimen entered-in-error privilege and a writable audit") {
            G.privilegedAndAudited(inError) shouldBe true
        }

        test("privilegedAndAudited fails without that privilege, with another privilege only, or with an audit outage or unknown audit") {
            G.privilegedAndAudited(baseline) shouldBe false
            G.privilegedAndAudited(baseline.copy(privileges = setOf(SpecimenPrivilege.ACCEPT_WITH_CAVEAT))) shouldBe false
            G.privilegedAndAudited(inError.copy(auditWritable = false)) shouldBe false
            G.privilegedAndAudited(inError.copy(auditWritable = null)) shouldBe false
        }

        test("errorReasonEntered holds for a governed reason chosen by the user") {
            G.errorReasonEntered(inError) shouldBe true
        }

        test("errorReasonEntered fails for a defaulted reason, a reason outside the governed list, an unknown list, or none") {
            G.errorReasonEntered(inError.copy(errorReason = Choice(SpecimenSamples.ERROR_REASON, chosenByUser = false))) shouldBe false
            G.errorReasonEntered(inError.copy(errorReason = Choice("SYN-NOT-GOVERNED", chosenByUser = true))) shouldBe false
            G.errorReasonEntered(inError.copy(governedErrorReasons = null)) shouldBe false
            G.errorReasonEntered(baseline) shouldBe false
        }

        // --- the baseline itself -------------------------------------------------------------------------------------

        test("the baseline sample keeps ACCESSION as its accession number") {
            baseline.accession shouldBe ACCESSION
        }
    })
