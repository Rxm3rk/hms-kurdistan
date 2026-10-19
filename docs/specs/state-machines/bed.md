# Bed (`bed.yaml`)

The bed-board lifecycle: available → reserved/assigned → occupied → dirty → cleaning → available, with the side states blocked and closed (BUILD-PROMPT §8.4 "Bed", §9.12 "Bed board", §21 WP-2.1; R11 §10.6). Owner `adt`; approvers nurse panel and bed manager (§8.4). The approval request is **DN-056**; its items are listed in §5, and items 1 and 2 are also put to the CSO because they decide access to emergency care. The approval block reads `status: requested` with no approver until a human sign-off record exists (§3.5). Predicates live in `hms.adt.domain.bed` (`BedGuards`, spec §3.1). Hazards: HAZ-0001, HAZ-0003, HAZ-0012, HAZ-0015.

What this file does not prove: the machine runs at the specification layer only (generated model, real predicates, generated facts). No bed aggregate, database exclusion constraint, command handler or channel adapter exists yet, so no hazard-log control moves beyond `planned` because of it (KA-062). §9.12's acceptance "two patients can never occupy one bed (database constraint and property test)" needs both halves; this package gives neither the database constraint nor a domain-layer property.

## 1. States

| State | Meaning | Source |
|---|---|---|
| `available` (initial) | Clean, unoccupied, free to reserve | §8.4; R11 §10.6 "available (clean)" |
| `reserved` | Reserved or assigned to one named encounter that can still take a bed (§8.4 and R11 draw "reserved/assigned" as one state) | §8.4; R11 §10.6 |
| `occupied` | An encounter's location history holds an open period on the bed, including a patient on leave (the bed is held) | §8.4; R11 §5, §10.6; §9.12 |
| `dirty` | The patient left; a cleaning job (standard or terminal) is open | §8.4; R11 §10.6 "dirty (patient left)" |
| `cleaning` | Cleaning in progress | §8.4; R11 §10.6 |
| `blocked` | Out of use with a reason: isolation, contamination, maintenance or staffing | §8.4; R11 §10.6 |
| `closed` | Out of use (for example a closed ward) | §8.4; R11 §10.6 |

The lifecycle is recurrent: `terminal` is empty and `available` is reachable from every state (format rule 6). A bed is created by the location tree (§8.2, `platform-tenancy`), not by an ADT command, so the machine has no creation command.

## 2. Transitions

Indexes are the 0-based positions in the YAML. Every transition carries `emitBedStatusChanged` (ADT^A20, §8.4 "Every change emits ADT^A20"). 16 transitions: 5 drawn, 11 proposed, carrying 15 new edges.

| # | From | Command | Guard | Other effects | To | Source | Status |
|---|---|---|---|---|---|---|---|
| 0 | available | Reserve | onSiteCellConnected, reservationEncounterOpen, bedRestrictionsAdmitPatient, noActivePressureAlarm | raiseBedRestrictionWarning, startReservationTimer | reserved | §8.4 "(not offline)"; R11 §10.6; §9.12 | drawn |
| 1 | available | ReserveWithOverride | onSiteCellConnected, reservationEncounterOpen, privilegedAndAudited, overrideReasonChosen | recordRestrictionOverride, startReservationTimer | reserved | — | **proposed** (flag) |
| 2 | reserved | Occupy | onSiteCellConnected, occupantMatchesReservation, noOverlappingOccupancy | — | occupied | §8.4 "(exclusion constraint)"; R11 §10.6; §8.2 | drawn |
| 3 | occupied | Vacate | noOpenOccupancy | ensureCleaningJob | dirty | §8.4; R11 §10.6; §9.12 | drawn |
| 4 | dirty | StartCleaning | — | — | cleaning | §8.4; R11 §10.6 | drawn |
| 5 | cleaning | FinishCleaning | requiredCleanRecorded | completeCleaningJob | available | §8.4; R11 §10.6; §9.12 | drawn |
| 6 | reserved | CancelReservation | reasonEntered | returnBedRequestToQueue | available | §9.12 cancellations with a reason | **proposed** |
| 7 | reserved | ReleaseReservation | reservedEncounterEnded | closeBedRequest | available | encounter end of stay | **proposed** |
| 8 | available, dirty, cleaning | Block | blockReasonValid | holdCleaningJob | blocked | §8.4; A.20 | **proposed** |
| 9 | blocked | Unblock | cleaningNeededOnReturn | ensureCleaningJob | dirty | §8.4; A.20 | **proposed** |
| 10 | blocked | Unblock | noCleaningNeededOnReturn | — | available | §8.4; A.20 | **proposed** |
| 11 | available, dirty, cleaning, blocked | Close | — | holdCleaningJob | closed | §8.4; A.20 | **proposed** |
| 12 | closed | Reopen | cleaningNeededOnReturn | ensureCleaningJob | dirty | §8.4; A.20 | **proposed** |
| 13 | closed | Reopen | noCleaningNeededOnReturn | — | available | §8.4; A.20 | **proposed** |
| 14 | dirty, cleaning | Reoccupy | privilegedAndAudited, onSiteCellConnected, returningOccupantWasLastOccupant, noOverlappingOccupancy | holdCleaningJob | occupied | encounter "Cancel discharge", CancelTransfer | **proposed** |
| 15 | available, dirty, cleaning | RecordBackEnteredOccupancy | privilegedAndAudited, onSiteCellConnected, backEnteredOccupantMatches, noOverlappingOccupancy | holdCleaningJob | occupied | §9.12 downtime re-entry; §16.3 L4; SI-10 | **proposed** |

R11 draws no entry or exit path for `blocked` and `closed`, no way back from `reserved` and no override. §8.4 and Appendix A.20 ("Undrawn transitions") require such paths to be proposed and put to the approving panel. `ReserveWithOverride` shares the drawn edge `available→reserved`, so it carries `proposed: true`.

## 3. Projection to HL7 v2 table 0116 and FHIR `Location.operationalStatus` (R11 §10.6)

The projection is not a set of states: it is how `emitBedStatusChanged` and the FHIR facade show a state. Table 0116 is coarser than the internal machine, so the internal state plus the block reason is authoritative (R11 §10.6). R4 `Location.operationalStatus` has a preferred binding to v2-0116; `Location.status` (active, suspended, inactive) is general availability, not bed state (R11 §2).

| Internal state (and reason) | Table 0116 code |
|---|---|
| available | U (Unoccupied) |
| reserved | U, plus the pending-admit or pending-transfer event (0116 has no "reserved" code) |
| occupied | O (Occupied) |
| dirty, cleaning | H (Housekeeping) |
| blocked, reason isolation | I (Isolated) |
| blocked, reason contamination | K (Contaminated) |
| blocked, reason maintenance or staffing | C (Closed) |
| closed | C (Closed) |

The codes and their meanings are copied from R11 §10.6 and its verification log (I and K added in v2.2), not written from memory.

## 4. Occupancy and the encounter machine

The encounter's location history is **the single source of truth** for bed occupancy, census, patient-days and bed-day charges (R11 §5 key rule; §8.2; §9.12). This machine keeps the bed-board lifecycle and **reads occupancy from the encounters' location histories**; it keeps no occupancy table that could drift.

- `noOverlappingOccupancy` (Occupy, Reoccupy, RecordBackEnteredOccupancy) is the exclusion constraint: one occupant per bed at any instant, over half-open periods `[start, end)`, entered-in-error periods ignored. The encounter checks the same constraint on its side.
- `noOpenOccupancy` (Vacate) lets the bed become dirty only when no open period remains. A bed held for a patient on leave keeps its open period, so it stays occupied.

The encounter's effects drive this machine, in the same transaction (encounter.md §4):

| Encounter command | Bed command it sends |
|---|---|
| AdmitToBed, TransferBed | Occupy, and Vacate for the old bed |
| Discharge, CancelAdmission, RevertAdmission | Vacate |
| End of the reserved encounter (Discharge, Cancel, CancelAdmission, MarkEnteredInError) | ReleaseReservation, with no user reason |
| Cancelled discharge or cancelled transfer | Reoccupy (back to the released bed while dirty or cleaning), or Occupy (a newly reserved bed) |
| Downtime back-entry | RecordBackEnteredOccupancy |

Two encounter changes send no bed command: a swap, and the hand-over of a wrong-patient correction. In both the bed stays occupied and only the periods change.

For an allocating command, a refused bed command refuses the encounter command. For a releasing or ending command it never does: it opens an owned bed-manager reconciliation task. The machines stay separate. That they agree after every step is a cross-machine property for the ADT domain layer, which does not exist yet.

## 5. DN-056: the readings and policy choices in this specification

The approval request for this machine is DN-056 (nurse panel, bed manager; items 1 and 2 also to the CSO). Each default is the safest reading that neither lets harm through nor blocks an emergency admission at 3 a.m.; none is clinical policy invented here. Matching rules, capability kinds, cohort declarations and cleaning types are governed content [HUMAN].

1. **What Reserve's restrictions do** (§9.12 "gender and isolation constraints"). Default:
   - A known gender mismatch under a configured rule fails Reserve.
   - So do an isolation requirement the bed cannot meet, an isolation requirement of unknown kind, and an unknown capability when one is required.
   - An unknown patient sex does not fail. That covers sex not recorded, sex recorded as unknown, a patient on an unidentified-patient alias (SAC-06), a sex the rule does not cover, and a restricted bed with no rule. Reserve proceeds with a warning and an owned bed-manager task.
   - An active IPC cohort declaration for the isolation kind meets the requirement (outbreak cohorting).

   Alternatives: every unknown fails, with the override as the only path; or every unknown warns, including isolation.
2. **ReserveWithOverride** (#1). An audited override needs the on-site cell, a coded reason (clinical-emergency, ipc-approved-cohort, restriction-data-wrong-or-unknown) and owned bed-manager and IPC review tasks. It never overrides SI-15 or the exclusion constraint. Question: which role holds the override privilege around the clock (default: the nurse in charge of the receiving unit and the bed manager on call)? Alternative: no override, which makes item 1's failures dead ends for an emergency.
3. **Pressure alarms.** Default: only an active alarm blocks Reserve (§9.12), and the override can lift it. An unknown or stale signal is a warning plus an owned facilities and IPC task. Alternative: an unknown signal blocks; this would make every monitored isolation room unreservable while the building system is down.
4. **Return to service.** Default: a bed returning from blocked or closed goes through dirty → cleaning when it entered out of use dirty or cleaning, when any block reason was isolation, contamination or maintenance, or when its history is unknown. A bed that was clean and blocked only for staffing returns straight to available (#10, #13). Alternative: always through cleaning (the first proposal; it produced false EVS records for clean beds).
5. **An occupied bed is not blocked or closed.** When an occupant needs isolation, the patient carries the isolation flag (§8.2; banner, SI-16) and neighbouring beds are blocked; the bed board never shows a bed with a patient as free or blocked. Alternative: propose `occupied → blocked` (isolation only), with exit only after the occupancy ends.
6. **A reserved bed is not blocked or closed directly**: the reservation is cancelled first (#6), so the request returns to its owned queue explicitly. Alternative: `reserved → blocked` with the request returned as an effect.
7. **No automatic reservation expiry.** A reservation ends only by Occupy, CancelReservation with a reason, or ReleaseReservation when its encounter ends. `startReservationTimer` gives every reservation an owned review task, due at the expected arrival or the §9.12 escalation time plus a configured grace [HUMAN]. Alternative: a timed `ExpireReservation`, which could take a bed from a patient on the way.
8. **Return after a cancelled discharge or a cancelled transfer** (#14) from dirty or cleaning, with the cleaning job held. Only for the same encounter, only while nobody has used the bed since; privileged, audited, not offline. Alternative: the bed is cleaned, made available and reserved again first.
9. **SI-15 covers Reserve, ReserveWithOverride, Occupy and Reoccupy**, not only Reserve (§8.4 "reserved/assigned (not offline)"), consistent with DN-051 item 1. Back-entered occupancy is issued online after recovery. Alternative: Reserve only.
10. **SI-12 covers elective admissions too.** No deposit or bed-category tariff can gate a reservation, because no RCM state may block an ADT command (CTRL-0012-3). A deposit for an elective admission is collected in parallel by RCM (§9.21). No alternative is offered: SI-12 is vendor-locked.
11. **Closing needs no reason** (§8.4 requires one only for blocked). Question: should Close require one?
12. **Terminal cleaning.** Default: `ensureCleaningJob` sets the job type to terminal when the last occupant had an active isolation flag, or when the bed was blocked for isolation or contamination since its last clean. `FinishCleaning` requires a recorded clean of that type; an unknown type counts as terminal. This blocks only the dirty bed, never an admission to another bed. Question: may an emergency override an unfinished terminal clean? The default is no. Alternative: an unguarded FinishCleaning (the first proposal), which would let a bed vacated by an isolation patient return to use after an ordinary clean. New hazard proposed in the report: HAZ-0041.
13. **System release of a reservation** (#7, `ReleaseReservation`). It is guarded by "the reserved encounter has ended" and needs no user reason. Reserve requires the named encounter to be in a state that can take a bed (`reservationEncounterOpen`). Without it, the release the encounter's discharge sends would be refused by `CancelReservation`'s user-reason guard, and the bed would stay reserved for nobody.
14. **Back-entered occupancy** (#15) from available, dirty or cleaning, without forward-allocation checks, because the decision was taken on paper. A bed now reserved for someone else, blocked or closed is a conflict, kept for reconciliation on the encounter's side.
15. **The proposed transitions** of §2 (11 transitions, 15 new edges).

## 6. Open questions

- **Q-B1** Does a newly commissioned bed start in `available` (default, `initial`) or in `closed`, to be cleaned before first use?
- **Q-B2** Which isolation and contamination kinds require a terminal clean, and what is on its checklist? This is infection-control content [HUMAN]; the machine encodes only that a required type must be recorded (item 12).

## 7. What is left to later work packages

These are WP-2.1 (§9.12, §21):
- the bed request and assignment workflow with its timers;
- EVS cleaning job types, checklists and SLAs;
- the bed board read model;
- gender and isolation rule configuration and cohort declarations;
- building-signal ingestion for pressure alarms;
- the database exclusion constraint.

Bed creation and its attributes (gender restriction, isolation capability, level of care, cost centre) belong to the location tree (`platform-tenancy`, §8.2).

## 8. Verification status

Validated against `state-machine.schema.json`. `sh tools/hms statemachines check --machine bed` passes rules 1 to 10 and 13 and fails only rules 11 and 12, which need the generated model and the domain package (phase 2). A throwaway script re-checked rules 2 to 10. All on the Windows host; not evidence of record.
