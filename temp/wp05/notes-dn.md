# specimen (agent aa21154c9454eb5aa) readings for DN (approvers lab-cso)
1 reject from received, in-process (A.20) + in-transit for unlabelled/mislabelled only (default a)
2 rejection reasons: 5 of §8.4 + clotted, mislabelled (§9.8) (default 7)
3 SI-01 wristband scan always required at print/collection, no manual fallback (default)
4 labels print on demand at bedside after wristband scan (default; no batch)
5 SAC-09 bedside proof: label scan follows wristband scan, same session, same device
6 stored not terminal; stored→disposed; rejected terminal
7 SI-03 cancel path when every served order ended (from any state before resulted) + disposition task; lost terminal + recollection task
8 print/collect need active order (not on hold)
9 SI-15 offline accession from device pre-allocated downtime block only
10 acceptability check required; haemolysis/clotting fails it; stability from clinical collection time
11 resulted = every test final/amended/corrected
12 retention unknown = retain; dispose from storage after retention period only
13 entered-in-error from every state, reason required; recollection on every rejection and loss
14 SI-10 collection time clinical, confirmed, not later than system time
OQs: cancel from received/in-process acceptable? lost wanted? aliquots/add-ons; collection inside lab (collected→received); events for cancelled/lost/EIE (§8.5); early disposal/legal hold (MLC)

# medication-administration (agent a9678d5fb5753bbbc) approvers pharmacist-panel, nurse-panel, cso
1 one override replaces exactly one check (two overrides: product-scan override keeps activeVerifiedOrder; verification override keeps product scan); B.3 guard as written is option B
2 product-scan override only when no product identified (no scan/unreadable/not mapped); identified mismatch (product, strength, unit, expired lot) = hard stop; option B soft stop per governed policy
3 verification override: active pending verification, never returned, on governed emergency/first-dose list [HUMAN], first dose of order only, never offline, creates 4h pharmacist review task
4 SI-01 wristband scan required on every path incl. overrides (no manual two-identifier check); options B (B.3 manual check), C third override
5 SI-13 independent = second user != administering, badge+PIN, privileged, recorded for this dose; unknown high-alert flag = high-alert; every path
6 SI-15 online, or order verified strictly before outage start; unknown times fail; internet loss not offline
7 SI-05 within tolerance = exact equality same UCUM unit; multi-unit dose does not match (pharmacy supplies unit dose); option B count entered by pharmacist needs SI-05 ruling
8 SI-12 scan-override path must name the supply (facility stock or administrable patient-supplied)
9 late doses: proposed timer self-loop flags + owned task, never blocks; missing window = zero
10 Give needs notInfusionOrder, StartInfusion needs infusionOrder
11 not-done reason one of five codes, user-chosen
OQs: paper back-entry after cell loss has no path (SI-10); PRN dose creation/min interval; scheduled doses when order held/discontinued; events for infusion start/stop/EIE; who raises return-for-review after unit mismatch; offline discontinued-meanwhile flag in sync handler (CTRL-0015-9)
Hazard log: CTRL-0002-3 text change proposed (override commands GiveWithOverride and StartInfusionWithOverride, one alternative per replaced check); twoIdentifiersConfirmed dropped

# result (agent a07056bb126ac6fdb) approvers lab-cso, physician-panel; 39 transitions
1 terminal = final, amended, corrected, cancelled, EIE; later changes need privilegedAndAudited; alt: only cancelled/EIE terminal
2 technologist validation on every release incl. preliminary, by a human user, never system/integration/AI account; alt: final only
3 autoverification present, proposed, inactive; gated by Register (cleared/not-required, opinion unexpired, version+jurisdiction) + tenant flag (flag alone never suffices); rule verdict, QC, no critical value; registered→final only; alt: omit until R1.1
4 critical value (or NOT_EVALUATED) hands to critical-result service; filing never waits; alt: unevaluated refuses release
5 every correction notifies: amended, corrected, revised preliminary; final after preliminary notifies preliminary acknowledgers; any earlier version incl. critical-result recipients
6 QC lockout (§9.8) on every release incl. corrections (new measurements need passed QC at measurement and current QC not failed/overdue); qcAllowsRelease added beyond task list
7 SI-06 pattern applied to results without listing SI-06
8 discharged patient = encounter discharged-not-closed/finished/cancelled/EIE or unknown (fails closed); finished outpatient counts
9 cancel from registered w/ reason; from preliminary w/ reason + privilegedAndAudited; never from final
10 reasons coded, user-chosen, never defaulted
OQs: event names cancelled/EIE/amended (§8.5); critical-result machine in WP-1.7; cancellation notice for discharged patient; unacknowledged final results at discharge (SI-17 names pending only); SI-07 listing; cross-machine specimen reject→result cancel, order reaction; patient release front door
HAZ proposal: changed/withdrawn result does not reach clinicians who acted on earlier version (H3, H6; SAC-30) -> HAZ-0040

# order (agent a4cadcdd2bd554917) approvers pharmacist-panel, nurse-panel, cso; 18 transitions, 33 predicates, 19 effects
ORD-1 SI-16 server reading: inclusive 60 s on server clock, tenant may lengthen; unknown/negative = within window; reverify by signer; dispute persists; command without known change time needs reverification (API/interface/AI); alt: Sign UI-only
ORD-2 "signing" = Sign, Verify, Hold, Resume, Discontinue, Mark error (REVIEW: could re-verification delay a stop/hold? tightening beyond §2.1 "at signing")
ORD-3 SI-15 offline: Sign and Verify refused for all kinds; mode of issue counts
ORD-4 SI-12 no financial fact on any order transition
ORD-5 override only on MAR; returned order allows no override
ORD-6 control set A: unknown flag = applies; exact compare incl. range bounds; pharmacist-entered dose compared; mismatch keeps pending+returned
ORD-7 verifier != orderer, signer, verbal receiver, pre-builder (staffing impact)
ORD-8 hard-stop rule that cannot run (KB down) refuses Sign/Verify for orders it covers (REVIEW: emergency ordering during KB outage?)
ORD-9 Mark error privilegedAndAudited + reason everywhere; Discard actorPrivileged; Hold needs reason
ORD-10 replacement revokes old on sign of the new (atomic), only if old still open
ORD-11 unverified order may be held, resumes to pending-verification; verification before hold stands
ORD-12 SI-07 from now: no AI/service principal signs or verifies
ORD-13 unknown antineoplastic/restricted/high-alert/neonatal flag = set
OQs ORD-Q1..Q12 (in order.md): MedicationVerified publisher/events; MAR schedule at sign vs verified; R1 OP prescriptions verification; signed-and-held/phase-of-care; verbal co-sign as journal fact; verbal hold/stop; drafts/indefinite holds no owner/timer (SI-03b); system discontinuation (death/discharge); CDS on resume; BSA needs dated height; blind pharmacist dose entry; transcribed orders (control set B) not this machine
Hazard log: add `orders` to modules of HAZ-0016 and HAZ-0014
MAR alignment: "returned to the prescriber" wording in medication-administration orderAwaitingVerification

# encounter (agent a14a74012e1fd214d) approvers nurse-panel, him, cso; 16 transitions
E-1 SI-15: AdmitToBed, TransferBed, SwapBeds, CancelDischarge refused offline
E-2 mode at issue counts; unknown mode fails
E-3 admit/transfer require bed reserved for this encounter and free from effective time
E-4 SI-17 pending = not-final + final-unacknowledged; cancelled admission/EIE also route
E-5 coding and charging done = HIM coding complete + charge capture complete in journal; payment/RCM state never read (CTRL-0012-3)
E-6 discharge time check only (clinical time after open bed period/leave start), never money
E-7 SI-10 back-dating in journal/command handler, not machine predicates (CTRL-0010-4)
E-8 triage complete = scale, level, complaint, required vitals, time, triager; config governed content; missing config fails closed
E-9 approve six proposed encounter edges (leave→discharged-not-closed; arrived/triaged→discharged-not-closed; discharged-not-closed→in-progress; arrived/triaged→EIE)
OQ: Q-E1 create in arrived?; Q-E2 in-progress without bed (clinic/ED cubicle)?; Q-E3 LWBS/AMA projection; Q-E4 event names (§8.5); Q-E5 re-triage not a transition; Q-E6 EIE after discharge/leave via HIM workflow

# bed approvers nurse-panel, bed-manager; 11 transitions, no terminal
B-1 every unblock/reopen via dirty→cleaning; alt staffing block straight to available
B-2 occupied bed cannot be blocked (isolation flag on patient)
B-3 reserved bed: cancel reservation first
B-4 no automatic reservation expiry
B-5 dirty→occupied only same patient after cancelled discharge, unused since, audited, not offline
B-6 reserve checks gender, isolation, pressure alarm (§9.12), fail closed on unknown (REVIEW: emergency admission blocked?) OQ emergency override of gender restriction; unknown pressure signal block vs warn
B-7 SI-15 covers occupy and return too
B-8 SI-12 covers elective admissions: no deposit/tariff gates reservation
B-9 closing needs no reason? (OQ)
OQ: Q-B1 new bed starts available or closed; Q-B2 terminal cleaning after isolation needs IPC policy [HUMAN]

# appointment (agent a6d8ee11da2215e2d) approver opd-panel; 26 transitions, 19 proposed
A1 waitlist as state; A2 reschedule/modify same-appointment transitions (SIU S13/S14); A3 CSO: check-in is patient-affecting under SI-01 (MRN+check digit + DOB/approx flag) default yes; A4 no prepayment guard in machine (pay-first in token journey, never ED); A5 late-cancel flag time window only, no charge; A6 no-show user-entered after grace; A7 check-in only on appointment date; A8 waitlist ranking priority, time, id; no repeat offer of declined slot; A9 left after check-in before seen = cancelled with reason
OQ-A1 booking offline rule?; A2 token-journey/slot/referral machines later; A3 who sets waitlist priority; A4 reschedule reason/late flag; A5 event PatientCheckedIn; A6 FHIR projection arrived vs checked-in; A7 desk bypass of ranking

# credit-claim approvers rcm-lead, kurdistan-pack-pm; 41 transitions, 34 proposed edges
C1 pre-approval denied state with re-request/withdrawal; C2 one shared query pair with stage facts, queries at every stage; C3 (CSO+RCM lead) SI-12: no effect on any clinical module or clinician queue; C4 claim-build check at discharge auth and submission (service, dates, units); C5 full settlement same currency and >= payer-payable; other currency = short; C6 add closed and withdrawn; no appeal from settled; C7 enhancement denial returns to last approval; two denial transitions on drawn edges need explicit approval (format limit -> per-transition proposed flag)
OQ-C1 generic claim.yaml later; C2 contracts w/o pre-approval (credit letter as pre-approval); C3 OP credit episodes no discharge; C4 document packs under SI-20; C5 appeal levels; C6 reinstating withdrawn

## MAR round-1 final DN-053 items (agent report): 1 schedule at Sign; 2 identity separate from quantity, unknown expiry shown; 3 scan-override covers whole dose (scan log); 4 first dose across replaces chain, serialised; options repeat emergency doses; 5 wristband scan normal + single-check wristband-failure override; 6 exact entered amount, range doses refused (options: min..max clause d ruling; pharmacist unit count; refuse at Sign); 7 verification override conditions; 8 one override one check; never waives SI-01/12/13/15; 9 knowledge time server@receipt online / device@issue offline; 10 SI-15 verified before that outage; 11 supply bound to patient+order; 12 SI-13 bound to scanned product+lot, window, different user; 13 performer privileged; Complete/Stop only authenticated clinical user; 14 late-dose flag w/ vendor default window; 15 OrderEnded closes doses; held lapse order-on-hold; 16 after-the-fact records (RecordOfflineAdministration, BackEnterAdministration)
OQs: PRN creation/min interval; back-entry infusion + overrun timer; EIE event; device clock trust offline; values for skew/double-check/late windows [HUMAN]; migration loader historical administrations
KA: allergy/interaction re-check at administration not in MAR (R11 §9 item 5)
HAZ-log text: CTRL-0002-3 override commands list; CTRL-0002-5 kinds; new PropertyTest SI-02-identified-mismatch-blocks-product-scan-override
Wristband: merged MRN of same patient = wristbandScanUnusable → override applies; encounter on band not required to match (old band → re-banding)

## specimen round-1 final DN-054 items 1-16 (in specimen.md): reject states; reasons 7; identification band-everyone + reportable identity override (no band/unreadable only; not transfusion samples); shared wristband reading; label printing on demand + kits; bedside proof; terminal states; cancel/lost; active order online or last synced; offline block + back-entry; per-test acceptability + caveat; resulted = testing ended; retention + legal hold (unknown = held); EIE flags derived results; collection time bounded by session; follow-up work always
Added SI-11/HAZ-0011 (notTransfusionSample)
OQ: cancel from received/in-process; lost state; aliquots/add-ons/reruns; draw station collected→received; events cancelled/lost/EIE; early disposal; back-entry receipt/processing on paper; who raises re-banding task (identity service on refusal; override effect when override fires)
KA: offline collection vs order discontinued meanwhile → command handler resync task (CTRL-0015-9 pattern)

## result round-1 final DN-055 items 1-14 (in result.md): terminal; validation every release by human; autoverification proposed/inactive w/ full Register check (scope, purpose, rule-set version) and own proposed flag; critical values explicit policy verdict incl no-critical-limits; every correction scope incl. downstream copies; QC lockout; SI-06 pattern; discharged patient = IP/ED/day-case (OP inbox + SLA escalation); cancellation; reasons; specimen state on every release; validation queue critical first; EIE review/refile task; external-referrer owner = facility OP results queue seam task
OQ: event names cancelled/EIE/amended (ResultAmended?); critical-result machine WP-1.7; cancellation notice to discharged queue; SI-07 listing
HAZ-0040 restated (H3,H6; results, lis; SAC-30; controls listed; PropertyTest:result-every-correction-notifies-orderer-and-acknowledgers, PropertyTest:result-no-filing-from-unusable-specimen)

## order round-1 final: DN-052 items 1-19 in order.md (SI-16 server; commands refused w/o reverify = therapy-starting + Mark error, stops flagged; SI-15 all kinds offline, stops allowed offline; SI-12; override only MAR, schedule at Sign vs §9.10; control set A; verifier independence; CDS cannot answer (§9.6 vs §2.1 c); guards beyond table; replacement revokes at sign (STAT verification); holds keep status; SI-07 now; unknown flags set; who may stop + fallback; Resubmit; restricted antimicrobial deferred for STAT/ASAP; draft/hold review intervals [HUMAN]; co-sign STAT; reading of active)
OQ ORD-Q1..Q10 in order.md
KA: order<->MAR interface in prose only until cross-machine property
HAZ: add orders to modules of HAZ-0014, HAZ-0016

## appointment round-1 final DN-057 items 1-11 (in appointment.md); credit-claim DN-058 items 1-11 (in credit-claim.md). OQ-A1..A11, OQ-C1, C5-C8.
HAZ: add scheduling to modules of HAZ-0001, HAZ-0012; two HAZ-0012 causes (mid-stay liability transfer prompting AMA discharge; coverage shown at ordering deterring time-critical order)
KA/format: creation commands carry no effects (ownership obligations of RequestAppointment, RecordIntimation, DraftReview etc. are handler obligations) -> mention in DN-059

## encounter round-1 final DN-051 items 1-22, bed DN-056 items 1-15 (in md files)
OQ Q-E1..Q-E6, Q-B1, Q-B2
HAZ-0041 proposed: HAI through reuse of bed not terminally cleaned (adt-squad + IPC); seeded H for CSO (choose H6? no—none fits well; H5? propose none / note)
