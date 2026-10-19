# Encounter (`encounter.yaml`)

The encounter lifecycle: arrival, triage, admission to a bed, transfers and bed swaps, leave of absence, discharge with a disposition, administrative close, downtime back-entry, corrections and the audited reversals (BUILD-PROMPT §8.4 "Encounter", §9.12, §9.14, §9.18, §21 WP-2.1; R11 §5, §10.1). Owner `adt`; approvers nurse panel, HIM and CSO (§8.4). The approval request is **DN-051**; its items are listed in §6. The approval block reads `status: requested` with no approver until a human sign-off record exists (§3.5). Predicates live in `hms.adt.domain.encounter` (`EncounterGuards`, spec §3.1); the executable model is generated from the YAML (spec §2.3). Hazards: HAZ-0001, HAZ-0003, HAZ-0010, HAZ-0012, HAZ-0015, HAZ-0017.

What this file does not prove: the machine runs at the specification layer only (generated model, real predicates, generated facts). No ADT aggregate, command handler, journal or channel adapter exists yet, so no hazard-log control moves beyond `planned` because of it (spec introduction, "What this package does and does not prove"; KA-062).

## 1. States

R11 §10.1 asks for the richer R4-style internal states plus a "discharged-not-closed" sub-state, so that the R4 and the R5/R6 status sets can both be projected without loss. §8.4 draws exactly these states. The projection belongs to the FHIR facade, not to the machine:

| Internal state | Meaning | R4 `status` | R5/R6 `status` + `subjectStatus` (R11 §10.1 convention) |
|---|---|---|---|
| `planned` (initial) | Pre-admitted or scheduled | planned | planned |
| `arrived` | The patient is here, not yet triaged or in a bed | arrived | in-progress (or planned, local convention) + arrived |
| `triaged` | A complete triage record exists | triaged | in-progress (or planned) + triaged |
| `in-progress` | Admitted to a bed; an open bed period exists | in-progress | in-progress + receiving-care |
| `on-leave` | Leave of absence; the bed is held | onleave | on-hold + on-leave |
| `discharged-not-closed` | Clinically discharged (any disposition, death included); coding and charging still open | finished | discharged |
| `finished` (terminal) | Administratively closed | finished | completed |
| `cancelled` (terminal) | Pre-admission cancelled before arrival | cancelled | cancelled |
| `entered-in-error` (terminal) | Admission cancelled or registration in error | entered-in-error | entered-in-error |

R5 does not define how arrived and triaged map onto `status`; the mapping above is R11's convention, not an HL7 rule (R11 §10.1). How a departure before admission (#12) projects (R5 `discontinued` for a left-without-being-seen, or `discharged`) is open question Q-E3 (§7).

**Which states a visit passes through** (for the appointment machine's `linkedEncounterStarted` and the result machine's `patientDischarged`):

- An **outpatient or ED visit that never takes a bed**: `planned` → `arrived` (→ `triaged` where triage applies) → `discharged-not-closed` (proposed #12, with its disposition) → `finished`. It never reaches `in-progress`. The visit has started once the encounter is in `arrived` or `triaged`; it has ended once it is in `discharged-not-closed` or `finished`. `cancelled` and `entered-in-error` are never a visit that took place. A cancelled departure (#18, #19) returns to `arrived` or `triaged`.
- An **admission**: `arrived`/`triaged` → `in-progress` (↔ `on-leave`) → `discharged-not-closed` → `finished`; a reverted admission (#20, #21) returns to `arrived` or `triaged`.

`created_by: [PreAdmit, Schedule]` (§8.4 "(start) Pre-admit / schedule"). Neither creation command has a guard: no deposit or payment rule can block ED registration (SI-12). Creation works offline and takes its encounter number only from a pre-allocated downtime block (SI-15 clause c, CTRL-0015-6, enforced by the identifier service, not here).

## 2. Transitions

Indexes are the 0-based positions in the YAML (the generated `Transition.index`). "Drawn" means drawn in §8.4 and R11 §10.1. A proposed transition either has its edge in the YAML's `proposed` list or carries `proposed: true` because it shares a drawn edge (format §1.1). 35 transitions: 12 drawn, 23 proposed, carrying 16 new edges.

| # | From | Command | Guard (besides `patientIdentityConfirmed`) | To | Source | Status |
|---|---|---|---|---|---|---|
| 0 | planned | Arrive | — | arrived | §8.4 "Arrive"; R11 §10.1 | drawn |
| 1 | planned | Cancel | reasonEntered | cancelled | §8.4 "Cancel"; R11 §10.1; §9.12 | drawn |
| 2 | arrived | Triage | triageRecordComplete | triaged | §8.4 "Triage"; R11 §5, §10.1 | drawn |
| 3 | arrived, triaged | AdmitToBed | onSiteCellConnected, targetBedAssignedToEncounter, targetBedFreeForNewPeriod | in-progress | §8.4 "Admit to bed" (SI-15, SI-12); R11 §10.1 | drawn |
| 4 | in-progress | TransferBed | onSiteCellConnected, effectiveTimeAfterLocationStart, targetBedAssignedToEncounter, targetBedFreeForNewPeriod | in-progress | §8.4 "Transfer / swap bed" | drawn |
| 5 | in-progress | SwapBeds | onSiteCellConnected, swapPartnerIdentityConfirmed, effectiveTimeAfterLocationStart, bedSwapPairValid, swappedBedsAdmitBothPatients | in-progress | §8.4 "Transfer / swap bed"; §8.5 A17 | drawn |
| 6 | in-progress | SwapBedsWithOverride | as #5 but privilegedAndAudited, overrideReasonChosen instead of swappedBedsAdmitBothPatients | in-progress | — | **proposed** (flag) |
| 7 | in-progress | CancelTransfer | privilegedAndAudited, reasonEntered, onSiteCellConnected, previousBedAvailable | in-progress | §9.12; HL7 A12 | **proposed** (flag) |
| 8 | in-progress | StartLeave | effectiveTimeAfterLocationStart | on-leave | §8.4 "Leave → return"; R11 §10.1 | drawn |
| 9 | on-leave | ReturnFromLeave | effectiveTimeAfterLocationStart | in-progress | §8.4 "Leave → return"; R11 §10.1 | drawn |
| 10 | in-progress | Discharge | dispositionChosen, effectiveTimeAfterLocationStart | discharged-not-closed | §8.4 "Discharge" (SI-12, SI-17); R11 §10.1 | drawn |
| 11 | on-leave | Discharge | as #10 | discharged-not-closed | — | **proposed** |
| 12 | arrived, triaged | Discharge | dispositionChosen | discharged-not-closed | §9.14 disposition | **proposed** |
| 13 | discharged-not-closed | AdministrativeClose | codingAndChargingComplete (no identity predicate) | finished | §8.4 "Administrative close"; R11 §10.1 | drawn |
| 14 | finished | CancelDischarge | privilegedAndAudited, reasonEntered, onSiteCellConnected, returnBedAvailable, dischargedFromBed | in-progress | §8.4 "Cancel discharge" (audited); R11 §10.1 | drawn |
| 15 | finished | CancelDischarge | as #14 with dischargedFromLeave | on-leave | — | **proposed** |
| 16 | discharged-not-closed | CancelDischarge | as #14 | in-progress | arguably R11 §10.1 | **proposed** |
| 17 | discharged-not-closed | CancelDischarge | as #15 | on-leave | — | **proposed** |
| 18 | discharged-not-closed | CancelDischarge | privilegedAndAudited, reasonEntered, dischargedBeforeAdmission, noTriageRecorded | arrived | — | **proposed** |
| 19 | discharged-not-closed | CancelDischarge | as #18 with triageRecorded | triaged | — | **proposed** |
| 20 | in-progress | RevertAdmission | privilegedAndAudited, reasonEntered, noTriageRecorded | arrived | R11 §5 cancel-admit | **proposed** |
| 21 | in-progress | RevertAdmission | as #20 with triageRecorded | triaged | R11 §5 | **proposed** |
| 22 | in-progress | CancelAdmission | privilegedAndAudited, errorReasonChosen, notWrongPatientError | entered-in-error | §8.4 "Cancel admission" (audited); R11 §10.1 | drawn |
| 23 | in-progress | CancelAdmission | privilegedAndAudited, errorReasonChosen, wrongPatientError, replacementEncounterReady | entered-in-error | R11 §15 item 7 | **proposed** (flag) |
| 24 | arrived, triaged | MarkEnteredInError | privilegedAndAudited, errorReasonChosen, notWrongPatientError | entered-in-error | §8.1 P3 | **proposed** |
| 25 | arrived, triaged | MarkEnteredInError | privilegedAndAudited, errorReasonChosen, wrongPatientError | entered-in-error | R11 §15 item 7 | **proposed** |
| 26 | arrived, triaged | ReceiveBedHandOver | handOverPeriodValid | in-progress | — | **proposed** (flag) |
| 27 | arrived, triaged | BackEnterLocationPeriods | onSiteCellConnected, privilegedAndAudited, backEntryPeriodsWellFormed, backEntryPeriodsFree | in-progress | §9.12; §16.3 L4; SAC-47 | **proposed** (flag) |
| 28 | arrived | BackEnterLocationPeriods | as #27 with backEntryPeriodsConflict | arrived | CTRL-0010-6 | **proposed** |
| 29 | triaged | BackEnterLocationPeriods | as #28 | triaged | CTRL-0010-6 | **proposed** |
| 30 | in-progress | BackEnterLocationPeriods | as #27 plus effectiveTimeAfterLocationStart | in-progress | §9.12; SI-10 | **proposed** (flag) |
| 31 | in-progress | BackEnterLocationPeriods | as #30 with backEntryPeriodsConflict | in-progress | CTRL-0010-6 | **proposed** (flag) |
| 32 | in-progress | CorrectLocationTime | privilegedAndAudited, reasonEntered, correctedTimesConsistent | in-progress | SI-10; CTRL-0010-4 | **proposed** (flag) |
| 33 | on-leave | CorrectLocationTime | as #32 | on-leave | SI-10 | **proposed** |
| 34 | discharged-not-closed | CorrectLocationTime | as #32 | discharged-not-closed | SI-10 | **proposed** |

Every transition except #13 carries `patientIdentityConfirmed` (SI-01; DN-051 item 10). The effects of each transition are in the YAML; §4 explains them. Alternatives on the same state and command split on exact-complement pairs (`triageRecorded`/`noTriageRecorded`, `wrongPatientError`/`notWrongPatientError`, `backEntryPeriodsFree`/`backEntryPeriodsConflict`) or on the mutually exclusive origins of a cancelled discharge (`dischargedFromBed`, `dischargedFromLeave`, `dischargedBeforeAdmission`).

Why each proposed transition is there:

- **#6 SwapBedsWithOverride**: the swap meets the same bed restrictions as a transfer (#5); the override is the audited path for an emergency or wrong restriction data, as the bed's `ReserveWithOverride`.
- **#7 CancelTransfer**: a transfer recorded to the wrong bed otherwise leaves a false period in the single source of truth for census, charges, isolation tracking and outbreak line lists (§9.12).
- **#11 discharge from leave**: otherwise a return that did not happen would have to be recorded (a false clinical time, SI-10).
- **#12 departure before admission**: most ED and outpatient encounters end without a bed (§9.14 dispositions); without this they could end only through a false admission, and their pending results could not be routed (SI-17).
- **#15 to #19 cancelled discharges**: §8.4 draws "Cancel discharge" only from `finished` to `in-progress`; a mistaken discharge is usually noticed before the administrative close (#16, #17), a discharge from leave returns to leave (#15, #17) so a patient still away never appears in bed, and a departure recorded by mistake returns to `arrived` or `triaged` (#18, #19). R11 §10.1's `finished` includes the discharged-not-closed sub-state, so R11 arguably draws #16; it stays proposed because §8.4 does not.
- **#20, #21 RevertAdmission**: a reversed decision to admit (HL7 A11 cancel-admit) voids only the bed periods; the real ED attendance, its triage, timestamps, orders and results stay valid (§8.1 P3, §9.14).
- **#23, #25, #26 wrong-patient corrections**: the record goes to identity correction, never to ordinary follow-up, and the real patient keeps the bed without a vacate (R11 §15 item 7; HAZ-0001).
- **#24 registration in error** before admission (§8.1 P3: entered-in-error replaces delete).
- **#27 to #31 downtime back-entry**: bed events that happened on paper are entered after recovery at their paper times, with the exclusion constraint checked over each paper interval only and conflicts kept for reconciliation (§9.12 "downtime re-entry keeping clinical time"; §16.3 L4; SAC-47; SI-10).
- **#32 to #34 CorrectLocationTime**: privileged, audited back-dating of a boundary with both times kept, so a wrong earlier time never forces a false later one (SI-10; CTRL-0010-4).

## 3. Predicates and the facts they read

The precise text of each predicate is in the YAML; it is the text the unit tests implement. Each is a pure function of facts the ADT aggregate will hold when it decides the command (spec §3.1). No guard holds a financial fact. The facts value deliberately also carries payment facts that no predicate reads (balance, deposit, pre-approval), so a property test can show that changing them never changes any guard (SI-12; phase 2). In outline:

- **Identity:** `patientIdentityConfirmed`, `swapPartnerIdentityConfirmed`, `replacementEncounterReady` (two identifiers as the identity service answers them, never a location; met from the record, no scan needed).
- **Connectivity:** `onSiteCellConnected`, shared with the bed machine: the offline matrix allows bed allocation only in the on-site-cell mode; mode at issue; in-cell server channels are on-site-cell by construction; WAN never read; unknown fails.
- **Beds:** `targetBedAssignedToEncounter`, `targetBedFreeForNewPeriod`, `bedSwapPairValid`, `swappedBedsAdmitBothPatients`, `returnBedAvailable`, `previousBedAvailable`; the exclusion constraint over half-open periods, entered-in-error ignored.
- **Time and history:** `effectiveTimeAfterLocationStart`, `correctedTimesConsistent`, `backEntryPeriodsWellFormed`, `backEntryPeriodsFree`/`backEntryPeriodsConflict`, `handOverPeriodValid`.
- **Clinical choices:** `triageRecordComplete` (a value or "not obtained" with a reason per required vital; an empty list is valid; only an absent scale configuration fails), `dispositionChosen` (a vendor baseline list always exists), `triageRecorded`/`noTriageRecorded`, the three discharge origins.
- **Corrections:** `errorReasonChosen`, `wrongPatientError`/`notWrongPatientError`, `overrideReasonChosen`, `reasonEntered`, `privilegedAndAudited`.
- **Administrative:** `codingAndChargingComplete` (HIM coding queue and journal charge capture; never payment or RCM state).

## 4. Effects, the location history and the bed machine

The encounter's location history is **the single source of truth** for bed occupancy, census, patient-days, bed-day charges, isolation tracking and outbreak line lists (R11 §5 key rule; §8.2; §9.12). It is a list of bed periods (bed, half-open `[start, end)` in clinical time, with the recorded time kept beside each change, a downtime label where it was back-entered) and leave entries.

| Effect | Location-history change | Bed machine command it sends |
|---|---|---|
| appendLocationPeriod | Closes the open bed period (if any), opens one on the target bed at the same instant | Occupy (target); Vacate (old bed) |
| swapLocationPeriods | Closes both partners' periods, opens the swapped ones at one instant | none: both beds stay occupied |
| revertLastTransfer | The last transfer's period entered-in-error, the previous one reopened | Reoccupy (previous); Vacate (cancelled target) |
| recordLeaveStart / recordLeaveReturn | Opens / closes a leave entry; the bed period stays open (held) | none |
| closeLocationPeriod | Closes the bed period and any leave entry at the discharge time | Vacate (occupied → dirty, cleaning job) |
| restoreLocationAfterCancelledDischarge | Reopens the closed period (case a) or opens a new one (case b); reopens a leave entry after a discharge from leave | Reoccupy (case a) or Occupy (case b) |
| voidBedPeriods (revert) / voidLocationHistory (cancel) | Marks periods entered-in-error, never deletes; census and charges recompute | Vacate |
| handOverLocationHistory / receiveHandedOverPeriods | Periods move to the real patient's encounter at their original times | none: the bed stays occupied |
| applyBackEnteredPeriods | Appends paper periods at paper times, labelled | RecordBackEnteredOccupancy (last bed); Vacate (bed left) |
| correctLocationBoundary | Changes one boundary's clinical time; the as-was view keeps both | none |
| releaseBedReservation | none | ReleaseReservation (system release, no user reason) |

**Atomicity.** An encounter transition and the bed commands its effects send commit in one transaction. For a command that allocates a bed (admit, transfer, swap, cancelled transfer, cancelled discharge, back-entry), a refused bed command refuses the encounter command. For a command that releases a bed or ends the stay (every Discharge, Cancel, CancelAdmission, RevertAdmission, MarkEnteredInError), a refused bed command never refuses the encounter command: it opens an owned bed-manager reconciliation task. A drift of the bed board can therefore never block a discharge (DN-051 item 21).

**End of stay.** Every transition that ends the stay routes work so nothing is lost:

- `routePendingResultsToOwnedQueues` (SI-17, SI-03), through the results routing service and idempotently. It covers every result not yet final (the result machine's `RecordPatientDischarged`), every final result not yet acknowledged (inbox work, outside the result machine, whose `final` is terminal), and every order with no result yet. Each item gets an owner and an SLA, or the discharging service's pool queue and `TaskOrphaned`.
- `notifyOrdersOfEncounterEnd`: an owned decision task for every active order; scheduled doses stop falling due for the ward; nothing is discontinued silently (order open question ORD-Q8).
- `actOnDisposition`: death stops doses, cancels future appointments as an owned task, starts death registration and suppresses messaging; left-without-being-seen and against-medical-advice raise a recall task; transfer-out raises the transfer summary task.
- `dissociateDevices` (SAC-53; §9.19). The same effect runs on transfer, swap, leave and every correction.

A wrong patient's record instead goes to `routeToIdentityCorrectionQueue` (HIM and the laboratory).

Other effects:

- `flagOtherOpenBedPeriod` warns and opens an HIM task when the same patient holds a bed in another encounter (DN-051 item 17).
- `raiseBedRestrictionWarning` and `recordRestrictionOverride` mirror the bed machine's for swaps.
- `reclaimRoutedResults` and `reverseDispositionActions` undo, as owned tasks, what a cancelled discharge had routed and triggered.

The bed machine (`bed.yaml`) keeps the bed-board lifecycle and reads occupancy from these periods; it keeps no occupancy table of its own. The two machines stay separate, and each checks the exclusion constraint on its own side. That both sides agree after every step, and that no bed has two open periods at any instant, is a cross-machine property for the domain layer, which does not exist yet (§8).

## 5. How the guards and effects read the safety invariants

- **SI-12 (HAZ-0012).** No predicate reads money; none may be added (YAML header). ED registration is a creation command with no guard. AdmitToBed and every Discharge have no financial predicate; the disposition can always be chosen. Discharge clearance runs in parallel (§9.12). AdministrativeClose comes after the clinical discharge, reads coding and charge capture only and closes the record administratively. The time guard on Discharge refuses an impossible time, never a debt, and a wrong earlier time can be corrected (#32 to #34).
- **SI-15 (HAZ-0015).** Bed allocation is refused when the command was issued offline: AdmitToBed, TransferBed, both swaps, CancelTransfer and every CancelDischarge that restores a bed carry `onSiteCellConnected`. Internet loss alone is not offline. A patient moved during a downtime is recorded on paper and back-entered after recovery with BackEnterLocationPeriods, at the paper times, issued online (SI-10; §16.3 L4).
- **SI-01 (HAZ-0001).** Every command except AdministrativeClose carries two-identifier confirmation, and the swap partner is identified as a patient, never as a bed.
- **SI-17 and SI-03 (HAZ-0017, HAZ-0003).** Every end of stay routes results, unresulted orders and active orders to owners as effects that cannot block the discharge, Cancel of a pre-admission included. Every state has a path to a terminal state (format rule 6).
- **SI-10 (HAZ-0010).** Location boundaries are written at the effective (clinical) time with the recorded time beside it. `effectiveTimeAfterLocationStart` keeps the history in order. Back-entry and time correction are explicit, privileged, audited and labelled. Ordinary late entry is the journal's (DN-051 item 8).

## 6. DN-051: the readings and policy choices in this specification

The approval request for this machine is DN-051 (nurse panel, HIM, CSO). Each item has a default (the stricter reading that neither lets harm through nor blocks an emergency admission, transfer or discharge) and its alternatives.

1. **SI-15 covers every forward bed placement.** §8.4 puts SI-15 on "Admit to bed" only. Default: transfer, swaps, cancelled transfer and cancelled discharges that restore a bed are also refused offline. Alternative: AdmitToBed only.
2. **What "offline" means.** Default: the client's mode at issue, read through the offline matrix. In-cell server channels are on-site-cell by construction. An unknown mode fails. Alternative: judge the mode at processing; this lets every synced offline allocation through and is not offered as safe.
3. **Bed checks on the encounter side.** Default: admit and transfer require a bed reserved for this encounter and free from the effective time on, in addition to the bed machine's checks. Alternative: leave both to the bed machine.
4. **What is routed at the end of a stay (SI-17).** Default: results not yet final, final results not yet acknowledged, and orders with no result yet, through the results routing service and idempotently. This applies on every ending transition, a cancelled pre-admission included. Alternative: results not yet final, at discharge only.
5. **Active orders and scheduled doses at the end of a stay.** Default: an owned decision task per active order; doses stop falling due for the ward; nothing is discontinued silently. Alternative: system discontinuation (order open question ORD-Q8).
6. **What "coding and charging done" means.** Default: HIM coding complete and journal charge capture complete, never RCM state (CTRL-0012-3 to the letter). Alternative: RCM confirms the charges posted.
7. **The time guard on Discharge.** Default: a discharge is refused only for a time not later than the open period's start, and CorrectLocationTime repairs a wrong earlier time. Alternative: no guard, with the time silently clamped; not safe.
8. **SI-10 back-dating and back-entry.** CTRL-0010-4 reads: "Back-dating needs a privilege and emits an audit event with reason, actor and both times (predicate privilegedAndAudited); ADT events are back-dated only with supervisor rights." Default: ordinary late entry within a configured tolerance [HUMAN] is checked by the journal and command handler. BackEnterLocationPeriods and CorrectLocationTime carry `privilegedAndAudited` with supervisor rights (§9.12 literal). Clinical care is never blocked meanwhile: it continues on paper, and an unapplied back-entry is owned work. Alternative: during a declared downtime recovery, ward charge nurses hold the back-entry privilege, with supervisor review afterwards.
9. **What makes a triage record complete.** Default: scale, a level on the scale, complaint, time, the triaging user, and for each required vital either a value or "not obtained" with a chosen reason. An empty required list is valid; only an absent scale configuration fails. Alternatives: a required set per triage level; or any vitals. The scale, lists and reasons are [HUMAN] content.
10. **SI-01: are ADT commands patient-affecting?** Default: yes. Every command except AdministrativeClose carries `patientIdentityConfirmed`: two identifiers as the identity service answers them, confirmable from the record, never a location. A swap also identifies its partner as a patient. Alternative: the command handler enforces SI-01 outside the machine, with no predicate here.
11. **Swaps meet the bed restrictions** (gender, isolation, active pressure alarm), with an audited override (#6). Alternative: the swap bypasses restrictions as an explicit nurse-panel decision.
12. **Corrections of the location history.** CancelTransfer (#7) and CorrectLocationTime (#32 to #34). Alternative: open questions only, with corrections made by HIM outside the machine.
13. **RevertAdmission** (#20, #21) for a reversed decision to admit, keeping the visit. CancelAdmission → entered-in-error stays for duplicates and registrations in error. Alternative: no revert; a new encounter is registered.
14. **Wrong-patient corrections.** The reason is coded (wrong-patient, duplicate-encounter, registered-in-error). For wrong-patient, the record goes to the HIM and laboratory identity-correction queue, and the bed periods pass atomically to the real patient's encounter with no vacate (#23, #26). Alternative: void, vacate, and re-admit the real patient through cleaning and a new reservation (an occupied bed would then show as free).
15. **Device dissociation** on transfer, swap, leave, every discharge and every correction (SAC-53). Alternative: on discharge and transfer only (SAC-53 literal).
16. **Disposition and death.** Every discharge needs a user-chosen disposition, with a vendor baseline list that always exists. Death is a discharge with disposition `died`. Default for its reversal: a separate death-reversal privilege. Question for the CSO: is that enough, or should a second person confirm?
17. **One patient in two beds.** Default: the admission proceeds with a warning and an owned HIM reconciliation task. Alternative: a guard refusing the second bed, which could block an emergency admission behind a stale encounter.
18. **Downtime back-entry** (#27 to #31). The last paper period is open-ended. Exclusion is checked over each paper interval only, with no forward-allocation checks. A conflict goes to an owned reconciliation task. Alternative: back-entry through the forward commands, which can make bounded historic periods impossible to enter.
19. **Cancelled discharges.** Proposed from `discharged-not-closed` and back to leave or to `arrived`/`triaged`; the released bed is accepted while dirty or cleaning; routed results are reclaimed. Question for the nurse panel: which role holds the cancel-discharge, cancel-admission and entered-in-error privileges around the clock?
20. **Doses due during leave** are recorded as not-done (off-unit) or covered by a recorded leave supply, never silently suspended. This is cross-referenced to the medication-administration machine. Alternative: suspension with no record per dose.
21. **Atomicity with the bed machine.** Allocation refused if the bed refuses; ending commands never refused by bed drift, which raises a task instead. Alternative: every bed refusal refuses the encounter command, which would let bed-board drift block a discharge.
22. **The proposed transitions** of §2 (23 transitions, 16 new edges), for the nurse panel and HIM.

## 7. Open questions and what is left to later work packages

- **Q-E1 Unscheduled arrival.** ED quick registration and walk-ins are created in `planned` and arrive in the same domain command (default). Should the format allow a creation command that starts in `arrived`? Which module emits A04/A10 when the appointment machine's check-in opens the encounter (PatientCheckedIn and PatientArrived must not both send it)?
- **Q-E2 Encounters without a bed.** This machine follows R11 §10.1's inpatient example: `in-progress` means admitted to a bed. Ambulatory care happens in `arrived`/`triaged` and ends through #12 (§1). Does the nurse panel want a bedless `in-progress` path? If so, the appointment machine's `linkedEncounterStarted` must list it.
- **Q-E3 Projection of departures before admission** (left without being seen, against medical advice): R5/R6 `discontinued` or `discharged`?
- **Q-E4 Event names.** §8.5 gives HL7 triggers but no event names for leave and return (A21/A22), pre-admit (A05), pending admit (A14), bed swap (A17), cancel transfer (A12), cancelled pre-admission (A38), registration in error, back-entry and time correction (A08?). Those transitions publish no event until names are agreed.
- **Q-E5 Re-triage** (§9.14 re-triage timers) appends a triage record and is not a transition. Agree?
- **Q-E6 Corrections after the administrative close** (entered-in-error, time correction from `finished`) are not proposed; HIM corrections after close use their own workflow. Agree? Is a cancelled swap needed?
- **Later work:** level-of-care, service and attending changes, inpatient/observation class changes, pending admission and expected discharge dates, the decision to admit, midnight census reconciliation and the transfer handoff (§9.12) are attributes and commands of the ADT aggregate (WP-2.1), not transitions here. The routed queues belong to the results module (§9.18), device association to `devices` (§9.19, R2.1), death registration to WP-2.5.

## 8. Verification status

Validated against `state-machine.schema.json`. `sh tools/hms statemachines check --machine encounter` passes rules 1 to 10 and 13 and fails only rules 11 and 12, which need the generated model and the domain package (phase 2). A throwaway script re-checked rules 2 to 10. All on the Windows host; not evidence of record. The cross-machine property (the encounter's location history and the bed machine agree, one occupant per bed at any instant) needs the ADT domain layer and is NOT-BUILT.
