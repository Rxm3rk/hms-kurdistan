# WP-0.5 phase 2 report: encounter + bed (`:modules:adt`)

Agent: encounter+bed slice agent (resumed after the 08:03 cut-off and a network error). Windows host; nothing here is evidence of record.
STATUS: code and spec edits complete; `statemachines check` passes for both machines; Gradle verification: see "Runs" (updated as runs finish).

## Files created (all under `backend/modules/adt/`)
Shared adt domain helpers, package `hms.adt.domain.common` (new; used by both machines so each shared rule is implemented once):
- `src/main/kotlin/hms/adt/domain/common/Answers.kt` — `Answer` (YES/NO/UNKNOWN for other modules' answers), `EntrySource`, `Chosen<T>` (so "never defaulted" is a check on the facts), `isUserReason()`.
- `.../common/OfflineMatrix.kt` — `ConnectivityMode`, `CommandChannel`, `OfflineMatrix.allowsBedAllocation` (the one implementation of `onSiteCellConnected` for both machines; in-cell channels are on-site-cell by construction; unknown mode fails; WAN never read).
- `.../common/LocationHistory.kt` — `LocationPeriod`, `LeaveEntry`, `Occupancy` (half-open overlap, conflicts ignoring entered-in-error) — the exclusion constraint implemented once.
- `.../common/BedRestrictions.kt` — sex/isolation/pressure/bed-attribute value types, `GenderRule`, `OverrideRequest`, `BedRestrictions` (gender, isolation, pressure, failing set, override check) shared by bed `bedRestrictionsAdmitPatient`/`noActivePressureAlarm`/`overrideReasonChosen` and encounter `swappedBedsAdmitBothPatients`/`overrideReasonChosen`.
- `.../common/FinanceFacts.kt` — deliberately unread payment facts (SI-12 property).

Encounter (`hms.adt.domain.encounter`):
- `src/main/kotlin/.../encounter/EncounterFacts.kt`, `EncounterGuards.kt` (object `EncounterGuards : EncounterPredicates`, 30 predicates)
- `src/test/kotlin/.../encounter/EncounterGuardsTest.kt`
- `src/testFixtures/kotlin/.../encounter/EncounterSamples.kt` (deterministic synthetic world, used by unit tests and Arbs), `EncounterArbs.kt`
- `src/propertyTest/kotlin/.../encounter/EncounterPropertyTest.kt`

Bed (`hms.adt.domain.bed`):
- `src/main/kotlin/.../bed/BedFacts.kt`, `BedGuards.kt` (object `BedGuards : BedPredicates`, 17 predicates)
- `src/test/kotlin/.../bed/BedGuardsTest.kt`
- `src/testFixtures/kotlin/.../bed/BedSamples.kt`, `BedArbs.kt`
- `src/propertyTest/kotlin/.../bed/BedPropertyTest.kt`

Module: `src/test/kotlin/hms/adt/ArchitectureTest.kt` (copy of the current platform template, package `hms.adt`).
Regenerated (by the generator, not by hand): `EncounterMachine.kt`, `EncounterGeneratedPropertyTest.kt`, `BedMachine.kt`, `BedGeneratedPropertyTest.kt`.

## Spec changes (minimal description edits; regenerated with `sh tools/hms statemachines generate --machine <m>`; need re-review)
No guard, transition, state or effect changed; `version` stays 1 (no sign-off record exists).
encounter.yaml:
1. `patientIdentityConfirmed`: a command that presents a room, bed or location as a patient identifier fails, even beside two valid identifiers (stricter reading of "never accepted").
2. `overrideReasonChosen`: "names each restriction being overridden" made precise: at least one restriction and every restriction the swap fails under `swappedBedsAdmitBothPatients`; with no swap to evaluate, fails.
3. `effectiveTimeAfterLocationStart`: "for a back-entry" = a command that carries paper periods.
4. `previousBedAvailable`: stricter: no other encounter's period starts at or after the transfer **or overlaps the time from it onward** (a drifted period that started earlier and is still open also fails).
5. `correctedTimesConsistent`: the end of an open entry cannot be named; a boundary shared by two consecutive bed periods (a transfer instant) moves for both, so no gap opens (otherwise moving one side of a transfer always creates a gap or overlap and the predicate could never hold); every entry (not only the first bed period) starts no earlier than the arrival; bed periods and leave entries each keep their order with no overlap. (Old text "without gaps" would also have blocked every correction after a cancelled discharge case (b), which legitimately leaves a gap.)
6. `backEntryPeriodsWellFormed`: "consecutive" = each starts exactly where the previous one ends; "within a downtime spell" = all within one spell.
7. `backEntryPeriodsFree`/`Conflict`: an unknown state of the last period's bed, or periods without a bed or start, count as a conflict (goes to the owned reconciliation task, never applied).
8. `privilegedAndAudited`: death-reversal privilege needed when the cancelled discharge's disposition is died **or not known not to be died** (stricter for unknown).
bed.yaml:
9. `bedRestrictionsAdmitPatient`: an unknown bed capability when isolation is required fails **whatever the area's cohort declarations** (the two sentences conflicted; stricter reading; ReserveWithOverride applies).
10. `overrideReasonChosen`: names at least one restriction and every restriction that would refuse the plain Reserve.
11. `requiredCleanRecorded`: "of exactly the type its job requires" (a terminal clean does not satisfy a standard job; literal reading).
12. `returningOccupantWasLastOccupant`: entered-in-error periods ignored; a tie for "ended most recently" fails.

## Decisions taken (with defaults; proposed DN items for the CSO / panels)
- D1 (DN-051 item 10 detail): SI-01 identity is modelled as the identifiers presented plus the identity service's two answers (MRN check digit, DOB/approx-DOB match); a presented location fails. Alternative: ignore extra presented location identifiers when two valid ones exist.
- D2 (DN-056 item 1): unknown capability + cohort declaration fails (spec change 9). Alternative: a cohort declaration for the kind admits regardless of recorded capability.
- D3 (DN-056 item 12): terminal clean does not satisfy a standard job (spec change 11). Alternative: terminal ⊇ standard. Low safety impact either way (blocks only the dirty bed).
- D4 (DN-051 item 18): paper periods must be contiguous (spec change 6). Alternative: ordered with gaps allowed. Over-strict blocks a back-entry outright (not to reconciliation) — put to HIM/nurse panel.
- D5: `privilegedAndAudited` reads the Trust Plane's per-command answer; the per-command privilege (supervisor rights for back-entry/time correction) is governed configuration and not checkable at this layer; only the death-reversal clause is encoded.
- D6: shared package `hms.adt.domain.common` created for the shared rules (the spec requires `onSiteCellConnected` "implemented once in the adt domain").

## Open points / proposed OQ, KA, hazard text
- OQ (cross-machine, bed/encounter): `backEntryPeriodsFree` accepts a last-period bed **reserved for this encounter**, but bed `RecordBackEnteredOccupancy` has no transition from `reserved`, so the atomic bed command would be refused and the back-entry refused. Options: (a) bed accepts RecordBackEnteredOccupancy from reserved for the same encounter (proposed edge reserved→occupied, with the reservation consumed); (b) encounter treats any reservation as a conflict (reconciliation). Default today: spec as written (refusal); propose (a).
- OQ: `ReceiveBedHandOver` (#26) and wrong-patient `CancelAdmission` (#23) carry no `onSiteCellConnected`. Reading: not allocation (the bed and the patient in it do not change), so allowed offline. Put to the CSO with DN-051 item 1.
- OQ: encounter.yaml header says every end-of-stay transition carries routing "and notifyOrdersOfEncounterEnd"; wrong-patient #23 and #25 carry `routeToIdentityCorrectionQueue` (which covers pending orders and scheduled doses) and no `notifyOrdersOfEncounterEnd`. The SI-17 property accepts identity correction as the alternative. Suggest rewording the header (no transition change).
- Property test names: the two emergency-access properties and the terminal-clean property serve no hazard entry yet. Proposed hazard text (integrator to assign IDs in HAZ-0040..0044, HAZ-0041 already proposed for bed reuse): "An emergency admission cannot be recorded because bed-board data (restrictions, pressure signal, sex) is missing or stale, so the location history and bed board are wrong and a bed can be double-allocated" — controls: Reserve fails only on known mismatches/active alarm; unknown sex/stale signal warn with owned tasks; audited ReserveWithOverride (bed.yaml DN-056 items 1-3). Test names currently start "Emergency access (bed; DN-056 items 1-3)" and "Bed reuse after isolation (bed; DN-056 item 12; proposed hazard)"; rename to the assigned HAZ IDs.
- KA (existing KA-061/062 apply): java.time and plain String identifiers stand in for kernel types; specification layer only.

## Runs (Windows host, not evidence of record)
- `sh tools/hms statemachines generate --machine encounter` / `--machine bed`: PASS (35 transitions, 30 predicates / 16 transitions, 17 predicates).
- `sh tools/hms statemachines check --machine encounter --json`: PASS, errors [] (all 13 rules). `--machine bed --json`: PASS, errors [].
- Gradle: pending (see below).
