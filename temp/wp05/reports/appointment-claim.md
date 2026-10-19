# WP-0.5 phase 2 report: appointment + credit-claim

Windows host, not evidence of record. AI-written. Resume of a cut-off agent: at start only the four generated files
existed in the two packages; everything below was written in this session.

## Files (created; nothing outside the two projects' packages and ArchitectureTests, except the spec edits below)
- backend/modules/scheduling/src/main/kotlin/hms/scheduling/domain/appointment/AppointmentFacts.kt
- backend/modules/scheduling/src/main/kotlin/hms/scheduling/domain/appointment/AppointmentGuards.kt
- backend/modules/scheduling/src/test/kotlin/hms/scheduling/domain/appointment/AppointmentGuardsTest.kt
- backend/modules/scheduling/src/testFixtures/kotlin/hms/scheduling/domain/appointment/AppointmentArbs.kt
- backend/modules/scheduling/src/propertyTest/kotlin/hms/scheduling/domain/appointment/AppointmentPropertyTest.kt
- backend/modules/scheduling/src/test/kotlin/hms/scheduling/ArchitectureTest.kt (template copy, package hms.scheduling)
- backend/satellites/rcm/src/main/kotlin/hms/rcm/domain/creditclaim/CreditClaimFacts.kt
- backend/satellites/rcm/src/main/kotlin/hms/rcm/domain/creditclaim/CreditClaimGuards.kt
- backend/satellites/rcm/src/test/kotlin/hms/rcm/domain/creditclaim/CreditClaimGuardsTest.kt
- backend/satellites/rcm/src/testFixtures/kotlin/hms/rcm/domain/creditclaim/CreditClaimArbs.kt
- backend/satellites/rcm/src/propertyTest/kotlin/hms/rcm/domain/creditclaim/CreditClaimPropertyTest.kt
- backend/satellites/rcm/src/test/kotlin/hms/rcm/ArchitectureTest.kt (template copy, package hms.rcm)
- Regenerated (by the generator, not by hand): AppointmentMachine.kt, AppointmentGeneratedPropertyTest.kt,
  CreditClaimMachine.kt, CreditClaimGeneratedPropertyTest.kt.

## Spec changes (minimal, descriptions only; regenerated; need re-review)
- appointment.yaml `patientInHospital`: + "When the appointment's slot start or end is unknown, every open ED or inpatient
  encounter counts, so an unknown slot time never allows a no-show" (stricter reading; SI-03 referral truth, DN-057 item 9).
- appointment.yaml `topRankedForSlot`: + "A priority code outside the governed list has no rank: this entry is then never
  top ranked, and a competitor without a rank ranks before it, so an entry of unknown priority is never passed over silently".
- credit-claim.yaml `queryResponseComplete`: "the open query has at least one item, and every item ...".
- credit-claim.yaml `approvalTermsRecorded`: "the approved services (at least one) with their approved units (each a positive integer)".
- credit-claim.yaml `deductionReasonsRecorded`: "at least one deduction is recorded for this settlement, and every deduction ...".
- The .md files were not changed (they do not restate these details).

## What the properties check
Appointment (AppointmentPropertyTest, each with independent oracles over the raw facts and requireFired):
- SI-01-two-identifiers-on-every-patient-affecting-command: every entry into arrived (CheckIn, CheckInWalkIn) had the
  stated name matched by empi, the record's MRN with a valid check digit from card/wristband/patient or a one-candidate
  empi search, and the stated DOB (or empi's approximate-age match); no unconfirmed check-in ever fires.
- SI-01-location-never-an-identifier: no arrival rests on a screen-confirmed value or a room/bed/token/appointment number.
- SI-12-no-rcm-state-blocks-a-clinical-command: structural: no field, enum constant or field type reachable from
  AppointmentFacts is a financial word (whole-word check, self-tested; BigDecimal absent); a reviewed, compiler-total
  effect-to-module map names no clinical module; and no fired effect over the sequences targets one.
- SI-03-owner-and-sla-on-every-work-item: every entry into proposed opens the booking task; into booked/arrived the
  outcome-due task; into pending holds the slot with a respond-by; a hold without respond-by always lapses; every
  ending and every booked-to-proposed return reports to the referral.
- SI-03 no-show: MarkNoShow fires only after slot end + grace, never for a patient adt reports in an open ED/inpatient encounter.
- SI-03 late flag: a Cancel with reason, party and ended need always fires, late or not; the flag is set exactly inside
  the window; CancelForRebooking is never flagged late.
- SI-20 (structural only): the three patient-message effects state the SI-20/SI-21 content rule. The content itself
  is not testable at this layer (NOT-BUILT, the messaging domain does not exist).
Credit claim (CreditClaimPropertyTest):
- SI-12-no-rcm-state-blocks-a-clinical-command: compiler-total effect map (rcm, platform-tasks, hub only), no clinical
  module, over sequences too; desk-task and SLA effects state "never ... clinician" (structural).
- SI-12-pre-authorisation-never-blocks-discharge-or-emergency-care: RequestDischargeAuth carries clinicalDischargeRecorded
  and fires only when adt's raw encounter status is discharged-not-closed or finished.
- SI-03 SLA pairing, exhaustively over every transition and every source state, and over sequences: the clock a state
  implies (running in request states and query-response, paused in query, none elsewhere) plus the transition's
  start/pause/resume/stop effects gives the target state's clock; start only with no clock, pause only running,
  resume only paused. Every entry into query pauses and assigns the desk task; every payer decision stops the clock
  and opens the next-step task; every entry into reconciliation opens its task.
- DN-058 item 5: a settlement in full is in the reference currency and not below it (oracle re-derives the reference);
  a partial settlement in another currency carries the exchange-difference reason.
- DN-058 item 8: Withdraw has no candidate from any submitted state; a withdrawal during a query never happens on a claim query.

## Runs (Windows host, not evidence of record)
(see "Gradle runs" below; updated as runs finish)
