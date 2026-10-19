# Result (`result.yaml`)

The lifecycle of one result. It covers how the laboratory registers a result, queues its measurements for validation, releases it to clinicians as preliminary or final, amends or corrects it, cancels it or marks it entered in error, and what each step obliges the domain to do.

Sources:
- BUILD-PROMPT §8.4: "Result (approval: lab CSO + physician panel): registered → preliminary → final → amended or corrected; cancelled; entered-in-error. Every correction notifies the orderer and everyone who acknowledged the earlier version. Final requires technologist validation until autoverification is active."
- R11 §10.5, and R11 §8 (the FHIR Observation statuses; "`corrected` is a child of `amended`").
- §2.1: SI-03, SI-04, SI-17 and SI-18, plus SI-06 and SI-21 as noted below.
- §5.2, §9.7, §9.8, §9.18, §10.2, §14.3, A.20 ("LIS rules"), §18.4 SAC-29 to SAC-31, §21 rows 1.7 and 3.11, and R15 §11 #10 ("over-alerting must fail builds as surely as missed alerts do").

Format: `docs/specs/modules/state-machines-and-invariants.md`.

- **Owner:** `results`. §5.2 lists it as "Result filing, acknowledgement, critical-result service, amended-result notices, pending-at-discharge routing". The predicates live once in `backend/modules/results`, package `hms.results.domain.result`.
- **Approval:** the lab CSO and the physician panel (§8.4). The request is DN-055 in `DECISIONS-NEEDED.md`. Its items are the readings listed at the end of this file. `approved_by` stays empty and `record` stays null until a human sign-off record exists (§3.5).
- **Hazards:** HAZ-0003 (H5, SI-03), HAZ-0004 (H3, SI-04), HAZ-0017 (H3, SI-17) and HAZ-0018 (SI-18). This machine is proved at the specification layer only (KA-062). No control in those entries moves beyond `planned` because of it.
- **Defaults:** each reading is the safest one that neither lets harm through nor over-alerts. Over-alerting buries true alerts (§14.3; R15 §11 #10), so it counts as a failure just as a missed alert does.

## States

| State | Meaning (R11 §8) | Terminal |
|---|---|---|
| `registered` | The result exists, but no value is released yet. It may already hold measurements waiting for validation. Created by `RegisterResult` when the laboratory accepts the order (§9.7 "one lifecycle") | no |
| `preliminary` | A validated version that is not yet complete has been released to clinicians | no |
| `final` | The complete, validated version has been released | yes |
| `amended` | A final result was modified afterwards, as a new validated version | yes |
| `corrected` | A final result was modified afterwards to correct an error; a kind of amended (R11 §8) | yes |
| `cancelled` | The test will not be completed | yes |
| `entered-in-error` | The result should never have existed in this record | yes |

"Release" in this machine means release to clinicians in the record. Release to the patient is a front-door step (see "Not in this machine").

**Ownership before release (SI-03 clause b).** A `registered` result with no value yet is owned through the order's "not yet resulted" view (CTRL-0003-3). Each measurement that arrives (`RecordMeasurement`, proposed self-loops on `registered` and `preliminary`) becomes owned work in the verification queue (`queueForValidation`). That work has an SLA, and critical or not-evaluated values go first, with the critical-result timeliness target and escalation to the laboratory supervisor (DN-055 item 12). A critical value therefore never waits for validation without a timer.

A measurement that arrives for a result that is already final (a rerun or an add-on) is work for the LIS exception-review queue (§9.8). Any change it brings goes through `Amend` or `Correct`. No self-loop exists on terminal states, because rule 7 would force `privilegedAndAudited` onto an instrument message.

## Why final, amended and corrected are terminal

The laboratory's lifecycle for the released content ends at final. A final result can still be amended, corrected or marked entered in error, sometimes long afterwards. Because those states are terminal, every such change leaves a terminal state, so the check requires `privilegedAndAudited` on it (spec §1.2, rule 7). An amendment is therefore a privileged act with an audit record, as §9.8's "amended-report audit" and "corrected-report trail" expect.

**Against SI-03 and H3.** A terminal state here never means "seen" or "acted on".
- SI-03 clause b ("every result has an owner and an SLA") is met by the inbox work that `routeToResponsibleClinician` creates on every release. That work stays open until it is acknowledged, and it escalates when its SLA is breached.
- The order's own terminal state belongs to the order machine ("Fulfilled / result final → completed").
- A later correction reaches people through `notifyOrdererAndAcknowledgers`; it does not reopen the order.

The other reading, with only `cancelled` and `entered-in-error` terminal, would make an amendment an ordinary step that needs no privilege. That is weaker, so it is not the default (DN-055 item 1).

## Releasing a result

Every release to clinicians (`ReleasePreliminary`, `RevisePreliminary`, `ReleaseFinal`, `Autoverify`, `Amend`, `Correct`) needs three things.

- **`technologistValidated`.** A person holding the validation privilege for the test validated exactly the version being filed, and that person issues the command. Autoverify is the exception and is described below. A system, integration or AI-agent account never validates. §8.4 says only that *final* needs technologist validation, but §9.7 says "anything that releases a result without human review" is Tier 2. The default therefore requires validation for preliminary releases too (DN-055 item 2). This does not delay an urgent preliminary: the technologist who would phone a critical value checks it anyway.
- **`specimenUsable`.** Every specimen behind a new or changed value must be, by the LIS's answer, in none of the states `rejected`, `lost`, `cancelled` or `entered-in-error`. A specimen with no reference or an unknown state fails closed. A value from a reference laboratory must also carry that laboratory's own specimen reference. This stops a value from a specimen later found haemolysed or mislabelled (wrong blood in tube) from reaching clinicians, by technologist release or by autoverification (§9.8 acceptance 1; H1, H3; DN-055 item 11).
- **`qcAllowsRelease`.** This is the QC lockout (§9.8 "no release while QC has failed or is overdue"; acceptance 2).
  - A new in-house measurement needs passed, in-date QC for its run when it was measured, and passed, in-date analyser QC now.
  - A changed value with no new measurement (a transcription or unit correction) needs passed QC for its original run.
  - A value from a reference laboratory needs that laboratory's identification on it.
  - Unknown QC fails closed.
  - Values carried over unchanged are not checked again. A QC failure found later on their run is the LIS look-back, which is an owned task.
  - Pulling a dangerous value never waits on QC. Entered-in-error has no QC guard, and an amendment that only withdraws a value has nothing to check (DN-055 item 6).

Every release routes the version to the responsible clinician's inbox as owned work with an SLA (`routeToResponsibleClinician`; SI-03 clause b; §9.18). For an order from an external referring doctor with no encounter, the owner is the facility's outpatient results queue. That queue delivers the result to the referrer as an owned seam task until the referrer's receipt is logged (SI-03 clause d; §9.7 acceptance 5; DN-055 item 14).

Final may follow preliminary, which is drawn. It may also come straight from registered, which is proposed: most results have no preliminary stage, but R11 draws final only after preliminary. A final that follows a preliminary supersedes it. Everyone who acknowledged the preliminary or received its critical-result communication is told (`notifyAcknowledgersOfFinal`), and the preliminary's open critical-result communications are updated (`updateCriticalResultCommunications`).

## Autoverification

"Final requires technologist validation until autoverification is active" (§8.4). Autoverification is the Tier 2 function `reg-lis-rules` (§9.8, release R1.1; A.20 "releasing or interpreting results = Tier 2"). By SI-18 it activates for a tenant only where the Boundary Register says "cleared" or "not required". That status must be backed by a stored written local opinion that records scope, intended purpose, version and jurisdiction, and that has not expired. No configuration toggle can override it (§10.2).

**Decision taken: the path exists, on registered → final only, and it is inactive.** Its guard `autoverificationActive` requires all of the following. The Register owns these facts.
- The tenant's flag is on. The flag alone never suffices.
- The `reg-lis-rules` entry has status cleared or not-required, for the running version and the tenant's jurisdiction.
- The opinion is stored and has not expired.
- The result's test (laboratory section, analyte, specimen type, method and analyser) lies within the opinion's scope.
- The opinion's intended purpose is release of results by autoverification.
- The rule-set version in the verdict is the one validated under that entry, so a change of instrument, method or rules that has not been revalidated stops autoverification.

No Register entry exists today, so the predicate is false for every tenant, and technologist validation is the only way to final.

Further guards:
- `autoverificationRulesPassed`: the §9.8 rule stack's release verdict for exactly this version.
- `specimenUsable` and `qcAllowsRelease`.
- `noCriticalValueFlagged`, because the stack sends critical values to manual review.

The release records the rule-set version, the Register entry and the opinion (`recordAutoverificationBasis`; §9.8 acceptance 4). Autoverification never releases a preliminary, an amendment or a correction.

**A separate approval.** `ReleaseFinal` and `Autoverify` share the edge registered → final. Each Autoverify transition therefore carries its own `proposed: true` flag and a description that points to DN-055 item 3. Approving the edge for manual final releases does not approve autoverification.

**Why present rather than absent.** With the path in the machine, the property tests can show now that no step reaches final by autoverification unless the Register allows it (SI-18 at the specification layer). The approvers also see the whole release design at once. The other option is to leave the path out; adding it in R1.1 would then raise the machine's version and need a new approval (DN-055 item 3).

## Corrections

"Every correction notifies the orderer and everyone who acknowledged the earlier version" (§8.4; R11 §10.5; §9.8 acceptance 3; SAC-30). The corrections are:
- `Amend`: final, amended or corrected → amended;
- `Correct`: final, amended or corrected → corrected;
- `RevisePreliminary`: a new preliminary version (proposed).

Each correction:
- leaves a terminal state with `privilegedAndAudited`, except `RevisePreliminary`, whose source state is not terminal;
- needs `technologistValidated`, `specimenUsable`, `qcAllowsRelease` and `correctionReasonEntered` (a coded reason the user chose, never defaulted);
- carries `supersedeEarlierVersion`. The new version supersedes the old one, and the earlier version is never overwritten or deleted. Every downstream copy (interfaces, released reports, summaries and letters sent to referrers, CDS that used the old value) gets the new version, flagged. A report already released to the patient is withdrawn and re-released through the front door with a notice;
- carries `updateCriticalResultCommunications`. An open critical-result communication about the earlier version is linked to the new version if the same critical value stands. Otherwise it is closed as superseded, and its escalation stops, so the chain no longer pages people about a wrong value;
- carries `notifyOrdererAndAcknowledgers`. The orderer and every user who acknowledged *any* earlier version are notified with the reason and both contents. This includes every recipient of a critical-result communication, preliminary versions included. The result is visibly flagged as changed (§9.18).

Amended and corrected both notify. §9.18 says "amended results notify and are visibly flagged", and R11 §8 makes corrected a kind of amended. The validating user chooses between the two, and the governed reason list may separate them. A revised preliminary counts as a correction because clinicians may have acted on the version it replaces, or acknowledged it (DN-055 item 5).

## Critical values (SI-04)

The critical-result service has its own lifecycle (§8.4 "Critical result: flagged → named recipient → read-back → acknowledged, otherwise escalated"; §9.7). It is not one of WP-0.5's eight machines and is later work: it belongs to `results` (§5.2), feature `DX-CRT-01`, WP-1.7.

This machine hands values over to it. Every filing whose version holds a critical value carries `handToCriticalResultService`. Every supersession, cancellation of a preliminary and entered-in-error carries `updateCriticalResultCommunications`. Filing never waits for the communication to finish, because a held result is a late result (H3).

**When a value counts as critical (DN-055 item 4).** The governed policy gives every orderable test an explicit verdict per value: critical, not critical, or `no-critical-limits` for a test the policy records as having none (most lipids, HbA1c and serology, as governed content decides [HUMAN]). `no-critical-limits` counts as evaluated and not critical. A value counts as critical in three cases:
- its verdict is critical;
- it is not evaluated, because its test is missing from the policy table or because context the test's policy needs (age, location) is missing. This fails closed. A missing test is a catalogue error that WP-1.7's catalogue validation rejects, so it is never the routine path;
- the validating technologist marked it critical.

This machine holds no threshold. The narrow fail-closed rule keeps routine results out of the critical-result service, which would otherwise flood it and bury the true critical values.

## Discharge (SI-17)

"Results pending at discharge, and results for discharged patients, go to owned queues."

**Results filed for discharged patients.** Every release splits on `patientDischarged` / `patientNotDischarged`. The second is defined as the literal negation of the first, so the pair stays an exact complement if encounter classes or states are added later. When the patient is discharged, the filed version also lands in the owned queue for discharged patients and raises a task (`routeToDischargedPatientQueue`; §9.18 acceptance; CTRL-0017-4). If the patient has been readmitted since, the current encounter's responsible clinician is also told.

What "discharged" means (DN-055 item 8):
- **Discharged:** the order's encounter is an inpatient, emergency or day-case encounter that is in none of the active states (planned, arrived, triaged, in-progress, on-leave).
- **Unknown fails closed into the queue:** an unknown class, an unknown state, or a missing or unresolved encounter link all count as discharged.
- **Outpatient visits:** a finished outpatient visit does not count. Nearly every outpatient result arrives after the visit has closed, and sending them all to the discharged-patient queue would flood it. Those results stay in the ordering clinician's owned inbox, which has an SLA, surrogate cover and escalation on breach.
- **Orders with no encounter:** "no encounter" is a fact the order records positively when it is placed (an external referrer's outpatient-tier order). It is never inferred from a missing link.

**Pending at discharge: the agreed interface with the encounter machine.**
- The encounter's discharge effect, `routePendingResultsToOwnedQueues`, routes the following through the results routing service: every result of the encounter's orders that is not yet final, every final result not yet acknowledged, and every order with no result yet. It does this at discharge, at a cancelled admission and at a registration in error (encounter.md E-4).
- In this machine, `RecordPatientDischarged` (proposed self-loops on `registered` and `preliminary`) covers the results that are not yet final. It places them in the pending-at-discharge queue (`routeToPendingAtDischargeQueue`; CTRL-0017-3) without changing their state. It is idempotent per result and discharge.
- Final, amended and corrected results not yet acknowledged are re-routed by the results routing service as inbox work. That changes no result state, so it has no transition here. A self-loop on a terminal state would have to carry `privilegedAndAudited` (rule 7), which makes no sense for routing.
- Orders with no result yet are the order's "not yet resulted" view (CTRL-0003-3).

## Cancelled and entered in error

- **Cancelled** is reachable from two states, and both cancellations notify the orderer:
  - from `registered`, with a reason;
  - from `preliminary`, with a reason and `privilegedAndAudited`, because it withdraws a version clinicians may have acted on. This cancellation also notifies everyone who acknowledged the preliminary or received its critical-result communication, and it closes that communication as withdrawn.

  A final result is never cancelled: withdrawing it is entered-in-error, and changing it is an amendment or correction (DN-055 item 9).
- **Entered in error** is reachable from every other state, terminal ones included (`"*"`). It always needs `privilegedAndAudited` and a reason.
  - Nothing is deleted. Every version is marked and stays readable, and downstream copies receive the status (`markEveryVersionEnteredInError`).
  - Open critical-result communications are closed as withdrawn, and the orderer and acknowledgers are notified.
  - An owned task (`resultErrorReviewTaskRaised`) asks the laboratory and the ordering clinician to find where the value belongs. They either refile it to the right patient through review (never silently moved, §8.4 "Identity") or order a recollection (DN-055 item 13).

**SI-06 and H6.** SI-06 is about signed notes, so this machine does not list it as an invariant it enforces. As this build's proposal, it applies the same pattern to results anyway: corrections are new versions, nothing is overwritten, and entered-in-error replaces delete (DN-055 item 7).

## Not in this machine

- **Acknowledgement** of a result by a clinician is inbox work. It publishes `ResultAcknowledged` (§8.5) and does not change the result's state. The facts give the list of acknowledgers to the notification effects.
- **Release to patients** (§9.8 "Patient release", §9.30): an OTP link, no clinical content in the message, and every release audited. SI-21's rule that labelled results and pregnancy tests are never released by message is enforced there (CTRL-0021-7), not here. This machine only obliges a re-release after a correction (`supersedeEarlierVersion`).
- **The critical-result lifecycle**, the task engine's SLA timers and `TaskOrphaned` (SI-03 clause c), and the orphan alarms on the queues.
- **The specimen and order machines.** This machine reads the specimen's state as a fact (`specimenUsable`). A rejected specimen leads to a recollection task in the specimen machine, and the order completes on "result final" in the order machine.

## Proposed transitions

§8.4 and R11 §10.5 draw registered → preliminary → final → amended or corrected, and they name cancelled and entered-in-error without saying from where. Everything else is proposed, for the lab CSO and the physician panel (A.20):

| Edge | Command | Why |
|---|---|---|
| registered → registered | `RecordMeasurement`, `RecordPatientDischarged` | A measurement queued for validation; a pending result routed at discharge |
| preliminary → preliminary | `RecordMeasurement`, `RevisePreliminary`, `RecordPatientDischarged` | The same two, plus a new preliminary version (interim reports) |
| registered → final | `ReleaseFinal` | Most results have no preliminary stage |
| registered → final | `Autoverify` (own `proposed: true` flag) | The only autoverification edge; a separate approval (DN-055 item 3) |
| amended → amended, corrected → amended | `Amend` | A further amendment |
| amended → corrected, corrected → corrected | `Correct` | A further correction |
| registered → cancelled | `Cancel` | The test will not be done |
| preliminary → cancelled | `Cancel` | A started test cannot be completed |
| * → entered-in-error | `MarkEnteredInError` | From every state |

The alternatives from `final` and from `[amended, corrected]` are kept as separate transitions. The generator marks a transition proposed when any of its edges is proposed, so merging them would turn the drawn final → amended and final → corrected paths into proposed ones.

## Open questions

- **Events.** §8.5 names only ResultPreliminary, ResultFinal and ResultCorrected. An amended result publishes ResultCorrected with its status. Should there be a ResultAmended, and which events do cancelled and entered-in-error publish (an HL7 v2 ORU carrying the status, with names still to choose)?
- **The critical-result machine:** specify it in WP-1.7 the same way, with its approvers.
- **A cancellation for a discharged patient:** should the notice also go to the discharged-patient queue?
- **SI-07:** should it be listed as an invariant here? (AI never files results, and validation already requires a human.)

## DN-055 items (readings for the lab CSO and the physician panel)

Each item goes beyond the text of §8.4 or of an SI. The file uses the default named below.

1. **Terminal states.** Default: final, amended and corrected are terminal, and every exit is privileged and audited. Alternative: only cancelled and entered-in-error are terminal.
2. **Technologist validation.** Default: required for every release to clinicians, preliminary included, by the user issuing the command, never by a system, integration or AI account. Alternative: final only, as §8.4's text says.
3. **Autoverification.**
   - Default: present, proposed and inactive. It is guarded by the Register entry (status, stored opinion, expiry, version, jurisdiction, scope, intended purpose, and the validated rule-set version) and by the rule-stack verdict. It runs on registered → final only, and never for critical values, preliminaries, amendments or corrections. Its transitions carry their own proposed flag, so approving manual registered → final does not approve them.
   - Alternative: absent until R1.1, added then with a version bump.
4. **Critical values.**
   - Default: the governed policy gives every orderable test a verdict, `no-critical-limits` included, and that verdict counts as not critical. Only a test missing from the policy, or missing context, fails closed as critical, and catalogue validation rejects a missing test. Every filing with a critical value hands it to the critical-result service.
   - Alternatives: (a) "no policy for the test" counts as critical; this floods the service and is not offered as safe. (b) A not-evaluated value refuses the release; this holds results back.
5. **Scope of "every correction".**
   - Default: amended and corrected both notify. A revised preliminary is a correction. A final after a preliminary tells the preliminary's acknowledgers and critical-result recipients. "The earlier version" means every earlier version, with the critical-result recipients included. Open critical-result communications are linked or closed. Every downstream copy gets the new version, and a report released to the patient is withdrawn and re-released.
   - Alternative: notify only on amended and corrected, and only the acknowledgers of the version immediately replaced.
6. **QC lockout.**
   - Default: applies on every release, corrections included. A new measurement needs passed QC at measurement time and current QC that has not failed and is not overdue. A changed value without a new measurement needs passed QC for its original run. Unchanged values are not checked again; a retrospective QC failure is the LIS look-back task. A reference laboratory's value needs its performing-laboratory identification. Withdrawing a value never depends on QC.
   - Alternatives: current analyser QC on every release, corrections included; or QC at measurement time only.
7. **SI-06 pattern for results.** Default: versions, no overwrite, and entered-in-error instead of delete, without listing SI-06 as an invariant this machine enforces. Alternatives: list SI-06 (extending its text to results), or leave versioning to the journal.
8. **"Discharged patient" (SI-17).**
   - Default: inpatient, emergency and day-case encounters that are no longer active, or whose class, state or link is unknown. Outpatient results stay in the ordering clinician's owned inbox and escalate on SLA breach. "No encounter" is a recorded fact. A readmitted patient's current team is also told.
   - Alternatives: (a) every ended encounter, finished outpatient visits included; this floods the queue and is not offered as safe. (b) Inpatient and emergency only, with day-case in the outpatient path.
9. **Cancellation.** Default: from registered with a reason, and from preliminary with a reason and privilege; never from final. Alternative: from registered only, so that a preliminary that cannot be completed is entered in error.
10. **Reasons.** Default: correction, cancellation and entered-in-error reasons are coded, chosen by the user and never defaulted; text alone does not count. This extends SI-02's never-defaulted rule. Alternative: free text accepted.
11. **Specimen state on release.** Default: every release, correction and autoverification needs every specimen behind a new or changed value to be outside the rejected, lost, cancelled and entered-in-error states, by the LIS's answer; unknown fails closed. Alternative: check the specimen on the first release only, and leave later corrections to the laboratory's judgement.
12. **Values waiting for validation.**
    - Default: each measurement is owned, prioritised work in the verification queue. Critical and not-evaluated values go first, with the critical-result timeliness target as their SLA and escalation to the laboratory supervisor. The SLA values are governed content.
    - Alternative: one SLA for every value, with no critical priority.
13. **Entered in error.** Default: raises an owned task for the laboratory and the ordering clinician to refile the value to the right patient through review, or to order a recollection. Alternative: notification only.
14. **Owner for an external referrer's order with no encounter.** Default: the facility's outpatient results queue, which delivers to the referrer as an owned seam task until receipt is logged. Alternative: the referrer as the direct owner, with no local queue.
