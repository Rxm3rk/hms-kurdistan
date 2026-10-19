# Specimen (`specimen.yaml`)

One laboratory specimen (one accession number), from the active order that needs it to its disposal (BUILD-PROMPT §8.4 "Specimen", R11 §10.4). Its rules come from §9.1 (wristbands, alias pools, identity documents), §9.7 (one order lifecycle; identity and barcode; "Scan, don't type"; designed downtime per ancillary), §9.8 (pre-analytic steps and acceptance 1), §12 (the wristband DataMatrix) and SAC-06 and SAC-09. It serves SI-01, SI-03, SI-10, SI-11 and SI-15, and the hazards HAZ-0001, HAZ-0003, HAZ-0010, HAZ-0011 and HAZ-0015.

The owner is the `lis` module. The predicates live in `hms.lis.domain.specimen` (`SpecimenGuards`); each is a pure function of `SpecimenFacts`. The approval block asks for the lab CSO alone, as §8.4 says. It stays `requested`, with `approved_by` empty, until a human sign-off record exists (§3.5). The approval request is **DN-054**, and every reading below is an item of it.

A specimen can serve several orders (§9.8 collection lists "consolidate tubes"). A channel that cannot supply a "chosen by the user" mark (API, interface, migration loader) supplies none, so every guard that needs a chosen reason refuses it.

## States

- **Main path** (§8.4, R11 §10.4): `ordered` → `label-printed` → `collected` → `in-transit` → `received` → `in-process` → `resulted` → `stored` or `disposed`.
- **Terminal states:** `disposed`, `rejected`, `cancelled`, `lost` and `entered-in-error`. `rejected` is terminal because what follows it is a new specimen: the recollection task leads to `CreateForRecollection`, never back into this specimen.
- **`stored` is not terminal.** A stored specimen still has its disposal ahead, due at the end of its retention period, unless a legal hold applies.
- **`resulted`** means that testing on this specimen has ended (item 12).
- **Two creation commands:** `CreateFromOrder` and `CreateForRecollection` (item 16).

## Transitions and guards

### Identifying the patient

- **Print labels** (`ordered` → `label-printed`):
  - an order the specimen serves is active (not pending verification, not on hold);
  - the wristband scan matches (below), because labels print on demand at the bedside (§9.8);
  - the label carries both SI-01 identifiers: the name in the patient's script plus Latin, and the MRN with a valid check digit plus the date of birth or the approximate-DOB flag; never room or bed (CTRL-0001-5);
  - the accession number comes from a permitted source: online, from the cell's service; offline, from the device's pre-allocated, site-prefixed downtime block, unused (SI-15 clause c). The mode is the one in which the command was issued, and losing the internet alone is not offline (SI-15 clause h).
- **The wristband check** (`wristbandScanMatches`) uses the same reading as medication administration (DN-053), with the same wording:
  - the scan must come from a patient wristband;
  - the barcode (DataMatrix with MRN and encounter, §12) decodes the MRN;
  - the identity service confirms the check digit and that the MRN is current (not merged or retired, SI-08);
  - the record's name and date of birth are shown on the device, and the user confirms them.

  A merged or retired MRN is refused. A refused command has no effect (spec §1.2), so the identity service, not this machine, raises the re-banding task.
- **Identity override** (`PrintLabelsWithIdentityOverride`, `CollectWithIdentityOverride`; proposed, item 3). It applies only when the user records that there is no band or that the band cannot be read, and no band scanned in the session. A band that scans to anyone, the wrong patient included, stays a hard stop. The override requires:
  - an active two-identifier check: the patient states their name and date of birth and the user confirms them against the record, or an identity document is read through the HAL (§9.1);
  - an MRN that is valid and current;
  - a reason the user chose;
  - a tube-label scan in the same session, at collection;
  - no pre-transfusion sample (SI-11).

  The override is a reportable event (§9.7). For no-band, an owned banding task goes to the unit or the draw station. A patient who cannot state their identity (a neonate, or an unconscious or confused patient) is re-banded, not overridden.
- **Alias and downtime kits** (`AssignKitLabels`; proposed, item 5). A kit's band and labels come from one pre-allocated block (§9.1 alias pools, SAC-06, CTRL-0001-8). At the bedside, after the band scan, the kit's labels are bound to the specimen.
- **Reprint** (proposed, item 5). The accession number and identity stay the same, with a reason the user chose. It needs no new identification, because Collect checks the patient and the label again in the same bedside session.
- **Collect** (`label-printed` → `collected`). §8.4 requires "collector, time, scanned wristband":
  - the collector is the authenticated session user; the device is recorded;
  - the collection time is clinical time (SI-10), confirmed by the collector, not later than the recording time and not earlier than the start of the bedside session. A patient-collected specimen type records the time the patient stated, marked as such;
  - the wristband scan matches;
  - for SAC-09, the tube label is scanned after the identification step, in the same session on the same device, with this specimen's accession number. A session ends when another patient is identified.

  Effects: `SpecimenCollected`, and a transport watch.
- **Downtime back-entry** (`BackEnterDowntimeCollection`; proposed, item 10). A specimen collected on paper during a full downtime (§16.3 L4) is back-entered from `ordered` or `label-printed` into `in-transit`. It needs the back-entry privilege with an audit, and a downtime episode that covers the collection time. The paper collector and the paper clinical time are entered, labelled as back-entry (SI-10 clause c). The label is scanned, its accession checked against the downtime block, and its identifiers confirmed. It enters `in-transit`, so the next real scan is the receipt: no scan that never happened is recorded. A collection that happened is a fact, so it is not refused when the order has ended since; Cancel applies then.

### Transport, receipt, processing

- **Dispatch** needs a transport scan and renews the transport watch.
- **Transport watch** (`transportOverdueWatch`). An owned work item for laboratory reception and the collecting unit. It falls due at the catalogue transport limit for the specimen's priority (governed [HUMAN]; shorter for STAT) and closes on receipt, rejection, loss, cancel or entered in error. When it falls due, someone must find the tube or declare it lost.
- **Receive** needs a label scan that matches an order (§9.8 acceptance 1) and emits `SpecimenReceived`.
- **Start processing** (item 11). Acceptability is checked **per test**. Each eligible test (whose order is not revoked or entered in error) must pass its own criteria: container, minimum volume, stability counted from the **clinical** collection time, and haemolysis, icterus, lipaemia and clotting within that test's governed limits [HUMAN]. An unknown value fails that test.
  - When every test passes, processing starts.
  - When some pass, processing starts, and only the failed tests are rejected, with `SpecimenRejected` and a recollection task (proposed).
  - When none pass, the specimen is rejected.
- **Accept with caveat** (proposed, item 11). An irreplaceable specimen, or a criterion the catalogue marks as waivable, can be processed after a recorded acceptability check, when a privileged user, audited, chooses a reason. The caveat appears on every derived result. A label or identity criterion is never waived.
- **Mark resulted** (item 12). Testing has ended: every test has a final, amended or corrected result, or a cancelled or entered-in-error result, or was rejected at the acceptability check, or its order ended. If a test's result was cancelled or entered in error while its order is still open, the alternative with `recollectionTaskRaised` applies. That closes the liveness gap in which a specimen stayed in `in-process` for ever. A specimen that serves no test has not finished; for catalogue flags (pre-transfusion sample, retention) it counts as unknown, which fails closed.
- **Store** needs a scanned storage location and schedules disposal at the end of retention.
- **Dispose** from `resulted` is allowed only when no retention is required; from `stored`, only when the retention period has elapsed. Neither is allowed under a legal hold (§9.27, §13 DP-9, the SI-21 forensic/MLC label; an unknown hold counts as held).

### Rejection, cancel, loss, error

- **Reject** (proposed, item 1):
  - from `received` and `in-process`, any coded reason;
  - from `in-transit`, only `unlabelled` or `mislabelled`, because such a tube cannot pass the receipt scan.

  The reason list has seven codes, all chosen and never defaulted (item 2). Every rejection emits `SpecimenRejected` and raises a recollection task. The task's owner is the ordering clinician's care team, or for an external referring doctor the laboratory's outpatient desk as an owned seam task (SI-03 clause d).
- **Cancel** (proposed, item 8). Allowed only when every served order is revoked or entered in error, or completed with no result from this specimen. A specimen whose orders completed through its own results is therefore never cancelled in place of `MarkResulted`, which would skip retention.
  - Before collection, the specimen is withdrawn from the collection lists and its labels are voided.
  - After collection, a disposition task follows, subject to any legal hold.
- **Report lost** (proposed, item 8). From `collected` to `in-process`, a loss raises a recollection task. From `stored`, it raises a laboratory quality incident and no recollection, because the results exist.
- **Mark entered in error** (proposed, item 14). Allowed from every state with `privilegedAndAudited`: the specimen entered-in-error privilege for this laboratory, and an audit record that can be written (an audit outage refuses the command). It also needs a reason from the governed list. It raises a review task. It also flags every derived result at once as "under review: specimen entered in error", so the result machine stops filing new values from this specimen. It is the only exit from a terminal state.

## What the result machine reads (`specimenUsable`)

The result machine adds a guard, `specimenUsable`: the LIS says that the specimen behind every new value is not `rejected`, `lost`, `cancelled` or `entered-in-error`, and an unknown answer fails closed. These four states give that answer directly.

The LIS's answer should be stricter in two places:

- a specimen in `ordered`, `label-printed`, `collected` or `in-transit` has not been received, so a value cannot have been measured on it, and it counts as not usable;
- a test rejected for this specimen at the acceptability check (`unacceptableTestsRejected`) counts as not usable for that test, even though the specimen is `in-process`.

A specimen accepted with a caveat is usable, and the caveat travels with the result.

## Offline (SI-15) and clinical time (SI-10)

- **Offline.** Printing allocates the accession number, so the offline predicate sits there. Kits and back-entry use pre-allocated blocks. Collection, dispatch and receipt allocate nothing.
- **Revalidation.** The server revalidates every offline command (SI-15 clause f); the command handler does this, not this machine. A collection made offline against an order discontinued meanwhile should be flagged to the orderer as an owned task on resync, like CTRL-0015-9 for doses. That is the command handler's job and is listed below as a known anomaly.
- **Clinical time.** The collection time is clinical time, bounded by the bedside session. An earlier time is back-dating: privileged and audited (SI-10 clause b, CTRL-0010-4), or the downtime back-entry path (SI-10 clause c, CTRL-0010-5). Stability runs from the clinical time.

## Events

`SpecimenCollected`, `SpecimenReceived` and `SpecimenRejected` (§8.5) are each published by an effect (`emit…`). §8.5 names no event for `cancelled`, `lost` or `entered-in-error`. This is an open question; no event name is made up here.

## Not in this machine

- **WBIT detection** (SAC-09: delta checks against earlier results, a second-sample rule) is a later LIS feature (WP-1.7, `DX-LAB-01`/`DX-LAB-03`). The session rule prevents some mislabelling but does not detect a wrong blood in tube.
- **Aliquots, add-on tests and reruns** (§9.8): an open question.
- **Result states, QC lockout and technologist validation** belong to the result machine (§8.4 Result; §9.8 acceptance 2 and 4).
- **The tasks themselves** (recollection, banding, re-banding, transport watch, disposition, disposal, review): their owners, SLAs and `TaskOrphaned` belong to the task engine (SI-03). This machine only places the obligation.
- **The domain layer.** No specimen aggregate, command handler or channel adapter exists yet, so the model is tested at the specification layer only (KA-062).

## DN-054: readings for the lab CSO

Each item gives its options and the default in use. Each default is the stricter reading that does not block urgent care.

1. **Which states can reject.** (a) `received` and `in-process` (§8.4), plus `in-transit` for unlabelled or mislabelled only; (b) `received` and `in-process` only, with unlabelled tubes ending as lost or entered in error. **Default (a).**
2. **Rejection reasons.** (a) the five of §8.4 plus clotting and mislabelled from §9.8, chosen and never defaulted; (b) the five of §8.4 only; (c) a governed, extendable list. **Default (a).**
3. **Identification at printing and collection (SI-01).** (a) every patient presenting for collection is banded at registration or at the draw station (§9.1, SAC-04), with the scan on every normal path; (b) the proposed reportable identity override for no band or an unreadable band (an active two-identifier check, a chosen reason, the label scan still required, never on a mismatch, never for a pre-transfusion sample); (c) no override at all. **Default: (a) as the process, with (b) as the reportable exception.** Patients who cannot state their identity are re-banded.
4. **The shared wristband reading** (with medication administration, DN-053). The scan decodes the MRN; the identity service confirms its check digit and merge status; the name and date of birth are shown and confirmed; a merged or retired MRN is refused, and the identity service raises a re-banding task. Options: (a) as stated; (b) also compare the encounter on the band. **Default (a)**, because an outpatient specimen can belong to another encounter.
5. **Label printing.** (a) on demand at the bedside after identification, plus alias and downtime kits issued with the band from one block, plus reprint without new identification (Collect checks again); (b) also allow batch printing from collection lists, with the check at collection; (c) reprint requires a new identification. **Default (a).**
6. **Proof of bedside labelling (SAC-09).** (a) the label scan follows the identification step in the same session on the same device; (b) (a) plus an explicit attestation by the collector; (c) attestation only. **Default (a).**
7. **Terminal states.** (a) `stored` is not terminal, `stored → disposed` exists, and disposal is a scheduled work item; (b) `stored` and `disposed` are both terminal. **Default (a).**
8. **Ending without a result (SI-03).** (a) Cancel only when every order is revoked or entered in error, or completed with no result from this specimen, from every state before `resulted`, with a disposition task once a tube exists; `lost` as its own terminal state, including from `stored`; (b) Cancel before collection only; (c) fold `lost` into `cancelled`. **Default (a).**
9. **Order state needed to print and collect.** (a) `active` only (not pending verification, not on hold), read as recorded online or as last synced offline, with a resync flag when the order ended meanwhile; (b) any order that has not ended. **Default (a).**
10. **Offline and downtime.** (a) accession numbers: online from the cell, offline from the device's block; paper downtime back-entry into `in-transit` with privilege, the downtime episode, the original clinical time and a label check; (b) no back-entry path (paper collections are re-collected). **Default (a).**
11. **Acceptability.** (a) per test, with haemolysis, icterus, lipaemia and clotting graded against governed per-test limits [HUMAN], partial rejection with recollection for the failed tests, and accept-with-caveat for irreplaceable specimens or waivable criteria (never for label or identity); (b) all or nothing for the specimen; (c) per test without a caveat path. **Default (a).**
12. **What "resulted" means.** (a) testing has ended: final, amended or corrected results, or results cancelled or entered in error (with a recollection while the order is open), tests rejected at the check, or orders revoked; (b) final results only, with the order discontinued otherwise. **Default (a).**
13. **Retention and legal hold.** (a) direct disposal only when no retention is required, disposal from storage only after the retention period, and never under a legal hold (forensic/MLC included; unknown counts as held); (b) also allow an early disposal with privilege and audit. **Default (a).**
14. **Entered in error.** (a) from every state, with the specimen entered-in-error privilege, a writable audit and a governed reason, a review task, and derived results flagged at once; (b) without the immediate flag. **Default (a).**
15. **Collection time (SI-10).** (a) clinical time, confirmed, inside the bedside session and not later than the recording time; the patient's stated time for patient-collected types; earlier times only by back-dating or back-entry; (b) only "not later than the recording time". **Default (a).**
16. **Follow-up work (SI-03).** (a) a recollection task on every rejection, loss and unusable result, even when the order has ended, owned by the ordering team or the outpatient desk for external referrers, leading to `CreateForRecollection`; a transport watch from collection to receipt; (b) no task when the order has ended. **Default (a).**

## Open questions

- Is cancelling from `received` and `in-process` acceptable, or should the laboratory still run the test and store the specimen?
- Is `lost` wanted as its own state?
- Aliquots, add-on tests and reruns on received, in-process or stored specimens: do they re-enter `in-process`, or become child specimens?
- Collection inside the laboratory (a draw station within the lab): should `collected → received` exist without a dispatch scan? The default requires the dispatch scan.
- Events for `cancelled`, `lost` and `entered-in-error`, which §8.5 does not name.
- Early disposal (for example a freezer failure) against the retention rule.
- The back-entry path for a specimen already at the laboratory during the downtime (received or processed on paper).
