# Appointment (`appointment.yaml`)

The lifecycle of one appointment, owned by `scheduling` (§5.2: "Resources, slots, appointments, OPD tokens and queues, referrals intake"). Sources: BUILD-PROMPT §8.4 ("Appointment (approval: OPD panel): proposed → pending → booked → checked-in/arrived → fulfilled; cancelled (by whom, why, late-cancel flag); no-show; waitlist (constraints, priority, auto-offer); reschedule and modify as their own events"), §9.2 (Scheduling), §9.30, §8.5, and R11 §4, §10.7 and §14. The predicates are implemented once in `backend/modules/scheduling`, package `hms.scheduling.domain.appointment` (WP-0.5 spec §3.1). The approval request is DN-057, which lists every reading below as an item. Hazards: HAZ-0001 (SI-01), HAZ-0003 (SI-03), HAZ-0012 (SI-12), HAZ-0020 (SI-20) and HAZ-0021 (SI-21).

## States

| State | Meaning | Source |
|---|---|---|
| `proposed` (initial) | A request for a visit. No participant has accepted, and the time may not be set. Created by `RequestAppointment`, from a referral, a check-out follow-up (§9.3) or the desk. Always has an owned booking task | R11 §4, §10.7 |
| `pending` | A slot is held until a respond-by time. The hold awaits either a required participant's acceptance or the patient's answer to a waitlist offer | R11 §4, §10.7 |
| `booked` | Every required participant accepted the slot. Has an owned outcome-due task | R11 §10.7 |
| `arrived` | The patient checked in. §8.4 writes "checked-in/arrived" as one state; R11 §4 lists both R4 codes. The machine keeps one state; the FHIR projection is OQ-A6. Has an owned outcome-due task | §8.4; R11 §10.7 |
| `waitlist` | The request waits for a slot, with constraints and a priority | §8.4; R11 §4 |
| `fulfilled` (terminal) | The visit took place | R11 §10.7 |
| `cancelled` (terminal) | Cancelled with who, why and the late-cancel flag. Also covers a patient who left before being seen, and a visit whose encounter ended without a consultation | §8.4; §9.2 |
| `no-show` (terminal) | The patient did not come; the reason is coded | §8.4; §9.2 |
| `entered-in-error` (terminal) | Recorded in error | R11 §4 (R4 status list) |

## Transitions

- **Booking.** `Book` on a request goes to `booked` when every required participant has accepted the slot. Otherwise it goes to `pending`, with the slot held until a respond-by time taken from configuration. `RecordAcceptance` books once the last required participant accepts. Accepting a waitlist offer is a separate transition, flagged `proposed: true`, because it shares the drawn `pending → booked` edge. A decline, or a lapse (`ExpireHold`), sends a waitlist offer back to `waitlist`. Any other hold goes back to `proposed`, with an owned booking task, so no slot is held without a limit. `slotAvailable` accepts any slot that **ends** after now, so a same-day booking into a running session works. It also allows capped overbooking (§9.2).
- **Walk-ins.** `CheckInWalkIn` takes a request created in the same domain command straight to `arrived`, into a running session that accepts walk-ins. It uses the same SI-01 guard as a booked check-in and applies no capacity limit (DN-057 item 5). This is the encounter machine's pattern for unscheduled arrivals (encounter.md Q-E1).
- **Waitlist.** `AddToWaitlist` needs complete constraints: service type, acceptable providers, acceptable locations, and the earliest and latest dates. An empty set means "any". It also needs a priority chosen by the user. Only date ranges are modelled, not time-of-day windows (DN-057 item 8). When a slot is released, `offerFreedSlotToWaitlist` runs the auto-offer (§9.2): the top-ranked matching entry receives `OfferSlot`. Ranking is by priority rank, then the earliest waitlisting, then the entry id.
  - The offer goes through a channel the patient opted into (§9.30). With no such channel, it goes to the desk as an owned task to telephone the patient, with the same respond-by time.
  - A declined slot, or a lapse after confirmed delivery, is never offered to the same entry again. A lapse without confirmed delivery does not count against the entry.
  - `ExpireWaitlistEntry` returns an entry whose dates have passed to `proposed`, with an owned task to contact the patient.
- **Modify and reschedule** (§8.4 "as their own events"). Both are transitions of the same appointment, so the appointment keeps its identity, its referral link and its history.
  - `Modify` changes anything except the slot, start, end, scheduled resource or location. It keeps the state and emits `AppointmentModified` (SIU^S14).
  - `Reschedule` needs a different slot. It releases the old slot to the waitlist and emits `AppointmentRescheduled` (SIU^S13). It stays `booked` when every required participant has accepted the new slot; otherwise it goes to `pending`, where a decline or a lapse returns the request with an owned booking task.
  - Cancel-and-rebook was not chosen. §8.4 and §8.5 name both events with their own HL7 triggers. Cancel-and-rebook would also count a reschedule as a (possibly late) cancellation and break the referral link.
- **Cancel** (§8.4 "by whom, why, late-cancel flag"). The reason is chosen by the user from the governed list and is never defaulted. The requesting party and who entered it are recorded; a patient may cancel through a front-door link (§9.30), which counts as a verified patient session. `Cancel` ends the need. A hospital or practitioner cancellation for capacity (clinic cancelled, practitioner ill) cannot use `Cancel`. It uses `CancelForRebooking`: the booking is cancelled, the patient is told, and the request returns to `proposed` with an owned rebooking task (DN-057 item 6). The late-cancel flag is set inside the tenant's window before the start, and also after the start. A window of zero means never late. The flag attaches no charge and never gates a later booking (DN-057 item 7).
- **Check-in** (`booked → arrived`). Allowed from the early check-in window before the slot until the end of its session, including evening clinics that pass midnight. It confirms two identifiers from what the patient states or presents, never a value read from the screen (SI-01 clause d; CTRL-0001-3; the reading of specimen.yaml):
  1. The name the patient states matches the record, by empi's cross-script matching answer.
  2. The MRN with a valid check digit comes from a card or wristband scan, or is stated by the patient. A patient without a card can be found instead by an empi search on the stated name and date of birth, if it returns exactly one candidate.
  3. The date of birth the patient states matches the record. When the record carries the approximate-DOB flag, the stated approximate age or birth year must match by empi's answer.

  A patient who cannot be identified goes to the registration desk (DN-057 items 3 and 4). A patient who arrives on the wrong day, or who cannot be checked in, and is unwell is sent to ED: a refused check-in never stops emergency care. Check-in issues the OPD token (§9.2) and emits `PatientCheckedIn`. adt arrives the outpatient encounter from that event and publishes `PatientArrived` (A04/A10) itself; scheduling never calls adt synchronously (§5.2).
- **No-show**: only after the no-show grace period has run from the **end** of the slot. The reason is chosen by the user (§9.2 "reason-coded ... no-shows"). Never for a patient whom adt reports in an open ED or inpatient encounter at the slot time: for that patient, `RecordPatientInHospital` returns the request for rebooking and the referral learns "patient in hospital", never "did not attend" (DN-057 item 9). There is no automatic no-show sweep. The owned outcome-due task makes the desk decide.
- **Fulfil** happens when the consultation is recorded (record's answer), or when adt reports the linked encounter in `discharged-not-closed` or `finished` with a disposition other than left-without-being-seen. An OPD visit ends through the encounter's proposed edge `arrived/triaged → discharged-not-closed` (encounter.md #10, Q-E2). If the nurse panel adds a bedless in-progress state, this predicate must list it.
  - If the encounter is cancelled, entered in error or left without being seen, with no consultation, `RecordVisitEnded` cancels the appointment and opens a follow-up contact task.
  - The desk records a patient who left with `RecordLeftBeforeSeen`.
- **Audited corrections**: `UndoCheckIn` (`arrived → booked`), `ReverseNoShow` (`no-show → booked`, leaving a terminal state) and `MarkEnteredInError` from every state. Each needs `privilegedAndAudited` and a correction reason. A same-day `ReverseNoShow` needs only the front-desk reversal privilege, so a late patient is not sent home. The event carries the actor and the reason. adt marks a wrongly checked-in encounter entered in error through its own guarded command (encounter proposed #15). It raises an HIM task when clinical content already exists (OQ-A8).

## SI-03: nothing is left open without an owner

- **`proposed`**: every transition into it carries `openBookingTask`. `RequestAppointment` is a creation command and the format gives it no effects, so its handler opens the same task. Phase 2 cannot test this obligation until the handler exists (OQ-A9).
- **`booked` and `arrived`**: every transition into them carries `openOutcomeDueTask`. The task falls due at the slot end plus the grace period (booked), or at the session end (arrived).
- **`pending`**: every hold has a respond-by time and expires.
- **`waitlist`**: every entry expires back to `proposed` with an owned task.
- **Referrals**: every ending, every return for rebooking and every reversal posts the outcome to the referral's owned task (§9.2 referral tracking; CTRL-0003-4).

## Other safety invariants

- **SI-12.** No predicate reads a payment, deposit, bill, balance, estimate, pre-approval or coverage fact, and the facts carry none. Phase 2 checks this structurally: the facts class has no such field. Pay-first for elective OPD visits belongs to the OPD token journey (§9.2), which is a later machine that carries SI-12 itself: an emergency or urgent patient bypasses pay-first checkpoints (OQ-A2). An emergency patient never needs an appointment; ED registration is an adt command.
- **SI-01.** Check-in and walk-in check-in, above. Proposed for the hazard log: add `scheduling` to the `modules` of HAZ-0001 and HAZ-0012.
- **SI-20 and SI-21.** Offers, reminders and change notices go only through a channel the patient opted into (§9.30), with the desk's telephone task as the fallback. They carry only the facility, the date, the time and a neutral location code. They never carry the service type, specialty, practitioner, department, reason or clinic name. For a service that carries an SI-21 sensitivity label, they carry no location code either (DN-057 item 11).
- **SI-15.** §2.1 lists "no bed or OT allocation" offline, not appointment slots, so this machine does not read the offline mode. Offline commands are revalidated by the server (SI-15).

## Events

`AppointmentBooked`, `AppointmentRescheduled`, `AppointmentModified`, `AppointmentCancelled` and `AppointmentNoShow` are §8.5 names (SIU^S12 to S15 and S26). A return for rebooking emits `AppointmentCancelled`, marked "returns for rebooking", and a later booking of the same request emits `AppointmentBooked` (OQ-A10). `PatientCheckedIn` is this build's reading of §8.5 "PatientArrived / CheckedIn" (OQ-A5). It projects only to SIU^S14; adt publishes `PatientArrived`. Corrections emit `AppointmentModified` with the corrected status.

## Proposed transitions

R11 §10.7 draws proposed → pending → booked → checked-in/arrived → fulfilled. It lists cancelled, noshow and waitlist with no edges, and R11 §4 lists entered-in-error. Every other edge is in `proposed`. The waitlist acceptance carries its own `proposed: true` on the drawn `pending → booked` edge. Four transitions are drawn: Book into pending, RecordAcceptance (not a waitlist offer), CheckIn and Fulfil.

## Not in this machine

- **The OPD token journey** (§9.2: registration → vitals → consultation → lab → pharmacy → billing; R11 §4 queue token). It is a later specification. It holds the pay-first checkpoints and their SI-12 obligation.
- **The slot** (R11 §4) and **slot and session generation** with the Friday–Saturday weekend and Kurdistan holidays (§9.2, §11.7).
- **The referral lifecycle** (§8.4 "Other lifecycles").
- Linked and recurring bookings, OT blocks (§9.2), and reminder wording.

## DN-057: the approval request and its items

The OPD panel approves the machine (§8.4). Items marked CSO are SI readings for the CSO as well. The file uses each default.

| Item | Question | Options | Default |
|---|---|---|---|
| 1 | Waitlist: a state or an entity | (a) a state of the appointment; (b) a separate waitlist aggregate | (a) |
| 2 | Reschedule and modify | (a) transitions of the same appointment; (b) cancel-and-rebook | (a) |
| 3 (CSO) | Check-in identification under SI-01 | (a) stated name (empi match), MRN with check digit, and stated DOB or stated approximate age; never confirming a screen value; (b) check-in is not patient-affecting | (a) |
| 4 (CSO) | Patient without a card | (a) empi search on stated name and DOB, exactly one candidate; (b) the MRN stated by the patient only; (c) the registration desk re-issues the card first | (a), with (b) when the patient knows the MRN, and (c) when (a) finds several candidates or none |
| 5 | Walk-ins | (a) `CheckInWalkIn` into a running session, with the same SI-01 guard and no capacity guard; (b) the token journey issues walk-in tokens without an appointment | (a) |
| 6 | Hospital or practitioner cancellation for capacity | (a) back to `proposed` with an owned rebooking task and the patient told; (b) `cancelled` plus a rebooking task | (a) |
| 7 | Late-cancel flag | a time window only; window 0 is never late; after the start is late; no charge; never gates a booking; the same rule for hospital cancellations? | as stated; a CancelForRebooking is never flagged late |
| 8 | Waitlist ranking and constraints | priority rank, then waitlisting time, then id; no repeat offer of a declined or delivered-and-lapsed slot; date ranges only | as stated |
| 9 | No-show | the grace period from the slot end; never for a patient in ED or admitted; a same-day reversal by the desk privilege; no automatic sweep, but an owned outcome task | as stated |
| 10 | Check-in window | from an early window before the slot to the session end; or the calendar day | the session window |
| 11 (CSO) | Patient message content (SI-20, SI-21) | facility, date, time and a neutral location code; no location for SI-21-labelled services; consented channels, otherwise a desk telephone task | as stated |

Open questions:
- **OQ-A1.** Does booking from an edge agent or offline mobile need a rule? SI-15 does not list slots.
- **OQ-A2.** The token-journey, slot and referral machines are later specifications. The token journey carries SI-12: an emergency or urgent patient bypasses pay-first.
- **OQ-A3.** Who may set a waitlist priority.
- **OQ-A4.** Should a reschedule need a reason and carry a late flag?
- **OQ-A5.** The event name `PatientCheckedIn`.
- **OQ-A6.** The FHIR R4 projection of `arrived`: as `arrived` or as `checked-in`.
- **OQ-A7.** May the desk book a waitlisted patient directly, bypassing the ranking?
- **OQ-A8.** Correcting a wrong-patient check-in whose encounter already holds clinical content (HIM workflow).
- **OQ-A9.** Creation commands have no effects in the format, so the booking task of `RequestAppointment` is a handler obligation that cannot be tested at the specification layer.
- **OQ-A10.** The event a return for rebooking emits (S15 then S12 on the same id, or S14).
- **OQ-A11.** May a patient check in while the appointment is still `pending`?

## Approval

`approval.required: [opd-panel]` (§8.4). `status: requested`, `approved_by: []`, `record: null` until a human sign-off record exists (§3.5).
