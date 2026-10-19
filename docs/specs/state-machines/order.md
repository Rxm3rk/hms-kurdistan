# Order (`order.yaml`)

This file explains the lifecycle of one order, from the unsigned draft to completed, revoked or entered-in-error (BUILD-PROMPT §8.4 "Order"; §9.5 Orders and CPOE; §9.7 "one order lifecycle"; §9.10 pharmacist verification; R11 §7 and §10.2).

- **Owner:** `orders` (§5.2: "order lifecycle, verbal-order read-back and co-sign").
- **Where the predicates live:** each is implemented once in `backend/modules/orders`, package `hms.orders.domain.order` (WP-0.5 spec §3.1).
- **Approvers:** the pharmacist panel, the nurse panel and the CSO (§8.4). The approval request is **DN-052**. Every reading below is an item of DN-052.
- **Hazards:** HAZ-0002, HAZ-0003, HAZ-0005, HAZ-0007, HAZ-0012, HAZ-0014, HAZ-0015 and HAZ-0016.

This file is the specification only, and it proves nothing about a running system. The order aggregate, its command handler and the channel adapters do not exist yet. Every property run against this machine therefore runs at the specification layer only (WP-0.5 spec §4; KA-062).

## States

| State | Meaning | FHIR projection (R11 §7.2) |
|---|---|---|
| `draft` | One of three kinds, none of them acted on: saved unsigned; a cutover pre-build "pending prescriber signature"; or a replacement being written | `draft` |
| `pending-verification` | A signed medication order waiting for the pharmacist. §8.4 calls it "active (medication: pending-verification)". Its verification status is `pending` or `returned` | `active`, verification pending or returned |
| `active` | Signed and in effect. For a medication order, this means signed **and** pharmacist-verified (status `verified`) | `active` |
| `on-hold` | Held, for example NPO or theatre. The verification status is kept unchanged | `on-hold` |
| `completed` | Fulfilled, or the result is final (terminal) | `completed` |
| `revoked` | A discarded draft, or a discontinued order, including one replaced by a modification (terminal) | `revoked` |
| `entered-in-error` | Never valid. It is kept, never deleted (H6) (terminal) | `entered-in-error` |

**Why pending-verification is its own state.** §8.4 writes "active (medication: pending-verification)". R11 §10.2 says "Medication orders add a *pending verification → verified* sub-state". A separate state makes this rule visible to the generator and to the property tests: a medication order reaches `active` only through `Verify`, or through `Resume` of an order verified before its hold.

Sign is split by the exact complements `medicationOrder` and `notMedicationOrder`. A medication order goes to `pending-verification`; every other order kind goes straight to `active`.

**One reading of "active" (DN-052 item 19).** Only Verify → `active` is counted as drawn from `pending-verification`. Its Hold, Discontinue and Mark error edges are proposed, like everything else §8.4 does not literally draw from that state.

## Interface with `medication-administration.yaml` (agreed with its author)

- The order states are exactly `draft`, `pending-verification`, `active`, `on-hold`, `completed`, `revoked` and `entered-in-error`.
- A medication order carries a **verification status**: `pending`, `returned` or `verified`. A non-medication order has none.
  - Sign sets it to `pending`.
  - Verify sets it to `verified`.
  - Both returns (a control set A mismatch on Verify, or ReturnToPrescriber) set it to `returned`.
  - Resubmit sets it back to `pending`.
  - Nothing else changes it; Hold and Resume keep it.
- `returned` means returned to the prescriber for any reason. A returned order allows no MAR override.
- The MAR's `activeVerifiedOrder` reads "state `active`, medication order". Its `orderAwaitingVerification` reads "state `pending-verification`, status `pending`".
- The MAR schedule is created at Sign (`createMarSchedule`, §9.5). So doses exist while the order is pending, and the MAR's verification override (the emergency and first-dose path) can be reached.
  - §9.10's "schedules generated from verified orders" says otherwise. That conflict is DN-052 item 5.
- When the order ends (revoked, replaced, completed or entered in error), `closeOpenFulfilment` sends the MAR `OrderEnded` for each scheduled and in-progress dose. The MAR closes scheduled doses as not-done `order-ended` and raises a stop task for a running infusion.
- While the order is held, its doses are not flagged late. A dose whose window passes during the hold closes as not-done `order-on-hold` (`suspendFulfilment`).
- `fulfilmentComplete` for a medication order needs the stop date passed **and** every dose terminal, none scheduled or in-progress. For a once-only or fixed-count order, the stop date is the due time of its last dose.

## Creation (`created_by`)

§8.4 "(start) | Save unsigned; cutover pre-build 'pending prescriber signature' | — | draft".

- **`SaveUnsigned`:** a clinician saves an order without signing it.
- **`PrebuildPendingSignature`:** at cutover, a pharmacist builds an active inpatient's orders from the paper chart and names the prescriber who must sign each one (§21 row 3.13).
  - Every Sign guard applies to a pre-build.
  - The pharmacist who pre-built it may not verify it (`verifierIndependentOfOrderer`).
- **`DraftReplacement`:** this is this build's reading of "A modification is a new request that replaces the old one". It creates a new draft with a `replaces` link to the order being modified (R11 §7.2).

## Two kinds of command

| Kind | Commands | SI-16 re-verification | Privilege |
|---|---|---|---|
| Start or allow therapy | Sign, Verify, Resume, Resubmit | Refused without it | Full privilege and licence checks |
| Correction | Mark error (and Discard of a draft) | Mark error is refused without it | `privilegedAndAudited` (Discard: `actorPrivileged`) |
| Stop or restrict therapy | Hold, Discontinue, the Verify mismatch, ReturnToPrescriber | **Never refused for it:** the command takes effect, is journaled "identity not re-verified", and raises an owned confirm task (`flagIfIdentityNotReverified`) | `mayHoldOrder`, `mayDiscontinueOrder`, `verifierIsPharmacist` |

The rule behind the split is that **no order can become unstoppable** (DN-052 items 2 and 14).

- A stop is never refused for any of these reasons:
  - a missing re-verification;
  - a missing privilege configuration (a vendor-locked baseline applies: care-team prescribers, plus pharmacists for holds);
  - an expired licence (§9.26 blocks *new* orders, not stops);
  - a missing reason list ("other" with free text is always offered).
- Registered system and interface principals may hold and discontinue under their own audited identity, for example for a death or discharge recorded by ADT. An AI agent never may (SI-07).
- Discontinue is open from every non-terminal signed state, whatever happens to Mark error.

## Transitions

Every transition is journaled with actor, clinical time, recorded time and reason (§9.5; SI-10).

### Sign (§8.4 "draft | Sign | … | active (medication: pending-verification)"; R11 §10.2 "signed (and co-signed if required)")

| §8.4 / source | Predicate |
|---|---|
| Human signer (§9.4; SI-07) | `signerAuthenticatedHuman` |
| Privileges (§9.26) | `ordererPrivileged` |
| Identity re-verified if the context changed <60 s ago (SI-16) | `identityReverificationSatisfied` |
| SI-15: offline, no new prescribing without full CDS | `notOfflineWithoutFullCds` |
| CDS checks (§9.6; SI-14; §2.1 clause c) | `localHardStopsSatisfied`, `kbHardStopNotFired`, `interruptiveAlertsAnswered` |
| Co-sign rules | `coSignRuleSatisfied` |
| Verbal orders: defined situations, read-back, co-sign due time | `verbalOrderPermitted`, `verbalOrderDocumented` |
| Verbal orders refused for antineoplastics | `notVerbalAntineoplastic` |
| Restricted antimicrobials need an indication and an approver (control set C) | `restrictedAntimicrobialApproved` |
| Control set C: a stop or review date on every antimicrobial | `antimicrobialStopOrReviewDateSet` |
| §9.5: an indication for antimicrobials, PRNs and imaging | `indicationRecordedWhereRequired` |
| §9.5 and SI-05: no weight-based medicine without a dated weight (measured, stated or estimated) | `datedWeightRecordedIfWeightBased` |
| A modification replaces an order that can still be discontinued | `replacedOrderDiscontinuable` |

**CDS that cannot answer (DN-052 item 8).** These rules apply at Sign, and again at Verify.

- **A drug-KB dose check that gives no usable answer never refuses.** This covers an outage, an error, no ratio, flag or maximum, the wrong unit, or a time-budget overrun. The order proceeds, "dose check unavailable" is recorded and shown, and the order is routed to the pharmacist (`recordCdsGaps`; §2.1 clause c; CTRL-0005-7, CTRL-0005-10).
- **A KB ≥10× result that did answer is a Tier A hard stop.** It cannot be overridden.
- **Local governed hard stops** (for example a fatal route) run in the CDS runtime without the KB, and they are evaluated to completion: a latency overrun alone never refuses.
  - A local rule that fires refuses the order.
  - A local rule that cannot run fails closed (§9.6). The exception is an emergency-listed orderable or a STAT order: then the gap is recorded and reviewed instead.
- **A non-hard-stop service that does not answer** fails open with the §9.6 banner.
- **At Verify,** `cdsGapsReviewed` needs every recorded gap either answered, or covered by the pharmacist's documented manual check.

**The SI-16 check on the server (DN-052 item 1).** `patient-context.yaml` (at `fcadc88`) is the client's check. `identityReverificationSatisfied` is the server's, with the same readings:

- **DN-026:** the 60 s window is inclusive. An unknown change time or a negative elapsed time counts as within the window. The window is vendor-locked: a tenant may lengthen it, never shorten it.
- **DN-027:** the user who signs must be the user who confirmed. A "Not this patient" answer keeps the identity disputed.
- **DN-028:** any change of patient id counts as a context change.

Both times come from the server's clock, so skew between client and server clocks cannot shorten the window. The server-side context is not built yet (KA-025). Until it is, every start-therapy command needs a re-verification for that command, while stops are only flagged. The re-verification is one inline step of the sign dialog, not a second screen.

**Effects of Sign:** the atomic order-sign transaction of §9.5:

- `revokeReplacedOrder`: it cannot fail once the guard holds, so it is never a hidden guard;
- `recordCdsOverrides` and `recordCdsGaps`;
- `createVerificationTask` and `createMarSchedule` (medication orders only); a replacement of a verified order is ranked STAT;
- `createCoSignTask`, for verbal orders;
- `createAntimicrobialTimeOutTask` and `createAntimicrobialApprovalTask`;
- `emitChargeEvent`, `trackOpenOrder` and `publishOrderSigned`.

### Discard and the draft timer

- **`Discard`** (§8.4 "draft | Discard | — | revoked") needs `actorPrivileged`, this build's addition (DN-052 item 9).
- **`DraftReviewDue`** (proposed) is a scheduler self-loop. It gives every unsigned draft an owner task with an SLA (SI-03 clause b): for a cutover pre-build, the named prescriber; otherwise the author.

### Verify, the pharmacist (§8.4 "active: pending-verification | Pharmacist verifies | Control set A where it applies; emergency/first-dose override path with review ≤4 h | active: verified")

- **`Verify` → `active`.** The guard has these parts:
  - `notReturned`;
  - the pharmacist and their independence (`verifierIsPharmacist`, `verifierIndependentOfOrderer`);
  - re-verification (`identityReverificationSatisfied`);
  - SI-15 (`notOfflineWithoutFullCds`);
  - the CDS checks again (R11 §9 item 5), `cdsGapsReviewed` and `controlSetASatisfied`.
- **What control set A requires (§10.3 A.1).** It applies, until the Dose Engine exists, to every weight- or BSA-based dose, every high-alert infusion and every neonatal order. For those orders:
  - the pharmacist records an independently calculated dose and attests that it matches;
  - it is compared exactly with the dose amount the prescriber entered, in the same UCUM unit (§2.1 clause b);
  - the system never derives a dose from a per-kg or per-m² basis;
  - an order with no entered dose cannot be verified, and the pharmacist returns it.
- **`Verify` with `controlSetAMismatch` → `pending-verification`, returned (proposed).**
  - Any recorded mismatch returns the order, whether or not control set A applies.
  - The latest calculation since the last submission counts; earlier ones stay on record.
  - The order does not go back to `draft`, because a signed order changes only by replacement.
- **`ReturnToPrescriber` (proposed):** any other pharmacist intervention that needs the prescriber (§9.10), with a chosen reason.
- **`Resubmit` (proposed; DN-052 item 15):** the prescriber confirms a returned order as written, with a chosen reason. The status goes back to `pending`, and the pharmacist must record a fresh calculation.
  - The pharmacist cannot clear their own return.
  - If the order needs a change, that is a replacement (`DraftReplacement`), not a Resubmit.
  - A returned order can therefore be verified only after the prescriber has answered. A hold and resume cannot reset `returned`.

**The emergency and first-dose override is not a transition here (DN-052 item 5).** It is the MAR's `GiveWithOverride` and `StartInfusionWithOverride`, taken while this order stays in `pending-verification` with status `pending`. The MAR's 4 h pharmacist review of such a dose ends here:

- with `Verify` (retrospective);
- with `ReturnToPrescriber`, if the review finds a problem;
- or with `Discontinue`.

For a once-only order whose single dose was given under the override, a retrospective Verify is followed by `Complete`, because its only dose is terminal. The order never becomes verified because of an override.

### Hold, the hold timer and resume (§8.4 "active | Hold / resume | — | on-hold ↔ active"; R11 §10.2)

- **`Hold`** goes from `active` (drawn) and from `pending-verification` (proposed). It needs `mayHoldOrder` and `holdReasonEntered`, and it is never refused for re-verification.
- **`HoldReviewDue`** (proposed) is a scheduler self-loop. It gives the ordering practitioner a review task with an SLA, against the held-and-forgotten order (SI-03 clause b).
- **`Resume`** needs `actorPrivileged` and re-verification, because it restarts therapy. It has two alternatives, split by the exact complements `verifiedOrNotMedication` and `medicationAwaitingVerification`:
  - a verified or non-medication order goes back to `active`;
  - an order that was pending or returned goes back to `pending-verification`, with its status kept.

### Complete (§8.4 "active | Fulfilled / result final | — | completed"; R11 §10.2)

Complete is allowed only from `active`. `fulfilmentComplete` is the fulfilling module's answer:

- **Medication order:** the stop date has passed (for a once-only or fixed-count order, the due time of its last dose) **and** every dose is terminal, none scheduled or in-progress.
- **Diagnostic order:** every item is final, amended or corrected (`result.yaml`). A cancelled or entered-in-error result does not complete the order; it is re-run or discontinued.
- **Any other order:** its fulfilment tasks are done.

### Discontinue and modification (§8.4 "active | Discontinue | Reason required | revoked"; R11 §10.2 "discontinued (reason)")

- **A user's or a system's discontinue** goes from `active` (drawn), and from `pending-verification` and `on-hold` (proposed). It needs `mayDiscontinueOrder` and `discontinueReasonEntered`, and it is never refused for re-verification. A verbal stop of an antineoplastic is allowed (§9.5 "except hold or stop").
- **A replacement** goes from `pending-verification`, `active` or `on-hold`. The transition is marked `proposed: true`, because it adds an alternative on the drawn edge.
  - Signing the replacing draft issues, in the same atomic transaction, `Discontinue` with the reason "replaced" on the old order.
  - The old order publishes one `OrderModified` (`linkReplacingOrder`), not `OrderDiscontinued`.
  - The new medication order needs its own verification.

**The gap in continuing therapy (DN-052 item 10).** When a verified medication order is replaced, the old order ends at the new one's signing, and the new one waits for verification. Two hazards pull against each other:

- **Revoke later** (when the new order is verified): the old dose may still be given after the prescriber has changed their intent, for example an anticoagulant reduced because of bleeding.
- **Revoke at signing:** a continuing time-critical dose may be delayed until verification.

The default revokes at signing (the prescriber's latest intent wins at once, and there is never duplicate therapy). It handles the gap two ways:

- the replacement's verification task is ranked STAT (§9.10's ≤15-minute timer);
- doses due before verification can be given only through the MAR's verification override (emergency list; whether a replacement counts as a first dose is DN-053's question).

### Mark error (§8.4 "active | Mark error | — | entered-in-error"; R11 §10.2)

- The edge from `active` is drawn. The edges from `pending-verification`, `on-hold`, `completed` and `revoked` are proposed.
- Every Mark error needs `privilegedAndAudited`, a chosen reason (`errorReasonEntered`) and re-verification (DN-052 item 9).
- Every exit from a terminal state carries `privilegedAndAudited` (WP-0.5 spec §1.2).

## SI-03 at the specification layer

"Every order reaches completed, revoked or entered-in-error (SI-03)." In this file:

- `draft`: Discard reaches `revoked`.
- `pending-verification`: Verify reaches `active`; Discontinue and Mark error are proposed.
- `active`: Complete, Discontinue and Mark error.
- `on-hold`: Discontinue and Mark error (proposed), or Resume and then Discontinue.
- Terminal states reach `entered-in-error` only as an audited correction.

This is rule 6 of the WP-0.5 spec §2.1 and CTRL-0003-3. A path is not an arrival, so owners and timers carry the rest of SI-03 clause b:

- `trackOpenOrder`;
- the verification and return tasks;
- the co-sign, antimicrobial time-out and approval tasks;
- `DraftReviewDue`, `HoldReviewDue` and the identity-confirmation task.

## SI-12 and SI-05

- **SI-12:** no guard reads a bill, deposit, payment, pre-authorisation, coverage or counter, and the facts carry none (DN-052 item 4; CTRL-0012-3, CTRL-0012-4). The restricted-antimicrobial approval never delays a STAT or ASAP order (DN-052 item 16).
- **SI-05:** no predicate does dose arithmetic. The only quantity comparison is control set A's exact comparison; the co-sign due time and the review timers are time comparisons.

## Proposed transitions (for the approving panel)

| Edge or transition | What | Why |
|---|---|---|
| `draft→draft` | DraftReviewDue | SI-03 clause b owner and timer for unsigned drafts and cutover pre-builds |
| `pending-verification→pending-verification` | Verify with a mismatch; ReturnToPrescriber; Resubmit | §10.3 A.1 "A mismatch returns the order to the prescriber"; §9.10 interventions; the prescriber's answer |
| `pending-verification→on-hold` | Hold before verification | §8.4 draws hold from "active" |
| `pending-verification→revoked`, `pending-verification→entered-in-error` | Discontinue, Mark error | Liveness from the sub-state; item 19's reading |
| `on-hold→on-hold` | HoldReviewDue | SI-03 clause b against held-and-forgotten orders |
| `on-hold→pending-verification` | Resume of an order held before verification | Resume never skips verification |
| `on-hold→revoked`, `on-hold→entered-in-error` | Discontinue, Mark error of a held order | Stopping without resuming first |
| `completed→entered-in-error`, `revoked→entered-in-error` | Audited correction | Entered-in-error replaces delete (H6) |
| Replacement Discontinue (`proposed: true`) | Revocation by a signed modification | This build's reading of "replaces" (item 10) |

## DN-052: items for the approvers (the defaults are the safer readings)

1. **SI-16 on the server.**
   - **Default:** the DN-026, DN-027 and DN-028 readings, applied on the server's clock. A command with no known context-change time (an API or interface command, or any command before the server-side context exists) needs a re-verification for that very command.
   - **Option:** accept a client-side re-verification without a server check.
2. **Which commands are refused without re-verification.**
   - **Default:** Sign, Verify (the verifying alternative), Resume, Resubmit and Mark error are refused. Stops and returns are never refused; they are journaled and flagged with an owned confirm task.
   - **Options:** (a) Sign and Verify only (middle); (b) Sign only (the literal §8.4 row); (c) every command including stops. Option (c) was rejected because it can delay or block stopping a drug.
3. **SI-15 offline.**
   - **Default:** Sign and Verify are refused in every offline mode, for every order kind. This goes beyond "prescribing": it also covers code status, isolation, nursing, diet and laboratory orders, which fall back to the paper downtime procedures. What counts is the mode in which the command was issued, so an order signed offline stays a draft on revalidation. Stops are allowed offline.
   - **Options:** medication orders only; or only orders that a CDS check covers.
4. **SI-12.**
   - **Default:** no financial fact on any order transition, for any order.
   - **Option:** a pay-first guard on non-emergency outpatient orders. That option would sit in the fulfilling workflow, never in this machine, and never apply to emergency care or time-critical doses.
5. **The split with the MAR, and the schedule at Sign.**
   - **Default:** the override is the MAR's only; a returned order allows none; the schedule is created at Sign (§9.5 "order + … + MAR schedule").
   - **The conflict:** §9.10 says "schedules generated from verified orders", which would make the emergency and first-dose path unreachable.
6. **Control set A.**
   - **Default:**
     - an unknown flag counts as applying;
     - the comparison is exact, covers every bound of a range, and uses the prescriber-entered dose (never a derived one);
     - an order without an entered dose cannot be verified;
     - any recorded mismatch returns the order, whether or not the set applies;
     - the latest calculation since the last submission counts, and a fresh one is needed after a Resubmit.
   - **Option:** return to draft instead of a returned status.
7. **Verifier independence.**
   - **Default:** the verifier is not the orderer, the signer, the receiver of a verbal order or the pharmacist who pre-built the draft.
   - **Option:** relax it at a site with one pharmacist on shift. The cost is that their own pre-builds are then checked by nobody else.
8. **CDS that cannot answer: §9.6 against §2.1 clause c.** §9.6 says "services fail open with a banner, except hard stops, which fail closed". §2.1 clause c says that when the KB returns no ratio, flag or maximum, "the screen shows 'dose check unavailable' and the order goes to pharmacist review".
   - **Default:**
     - a KB-dependent dose check that cannot answer never refuses, and is recorded and routed to the pharmacist;
     - a latency overrun alone never refuses;
     - only local governed hard stops refuse when they fire; one that cannot run fails closed, except for emergency-listed orderables and STAT orders, where the gap is recorded and reviewed.
   - **Options:** (a) the literal §9.6 reading: refuse whenever any hard-stop rule cannot run, which during a KB outage blocks all medication ordering and verification; (b) the default; (c) never refuse for a rule that cannot run.
9. **Guards beyond the table.**
   - **Default:** Mark error needs `privilegedAndAudited` and a chosen reason. Discard needs `actorPrivileged`. Hold and Discontinue need a chosen reason, with "other" and free text always offered.
10. **When a modification revokes the old order.**
    - **Default:** at the replacement's signing, atomically, and only if the old order can still be discontinued by this signer. The replacement's verification is ranked STAT. The hazards are stated above.
    - **Options:** (a) revoke at the replacement's verification, for medication orders; (b) the default plus a MAR override for doses of a replaced verified order of a time-critical class, which DN-053 would also have to take up.
11. **Holds.**
    - **Default:** an unverified order may be held, and resumes to `pending-verification`. A hold keeps the verification status. A verification recorded before a hold stands after resume.
    - **Option:** a resume after a long hold needs re-verification.
12. **SI-07 before P2.**
    - **Default:** no AI agent or service principal ever signs, verifies, holds or discontinues an order, from now on. Registered system and interface principals may hold and discontinue (item 14).
13. **Unknown formulary flags fail closed.**
    - **Default:** an unknown antineoplastic, antimicrobial-class, restriction, high-alert or neonatal flag counts as set.
14. **Who may stop an order.**
    - **Default:**
      - the governed configuration decides who may hold or discontinue;
      - when it is missing, a vendor-locked baseline applies: care-team prescribers (hold and discontinue) and pharmacists (hold);
      - the issuer's licence expiry is never checked for a stop;
      - registered system and interface principals may stop under their own audited identity.
    - **Options:** a narrower baseline; or no system principals (every stop by a human).
15. **Returned orders.**
    - **Default:** Verify needs the prescriber's Resubmit, or the order is replaced or discontinued. The pharmacist cannot clear their own return.
    - **Option:** the pharmacist may clear a return after a documented discussion.
16. **Restricted antimicrobials (control set C).**
    - **Default:** an indication is always required. The approver is required at order entry, except for STAT or ASAP orders, which are signed with an owned approval task due within the governed window [HUMAN].
    - **Options:** (i) the literal reading: approver at entry always; (ii) the default; (iii) the default, plus later doses blocked until approved, which needs the MAR (DN-053).
17. **Draft and hold review timers.** The intervals are governed content [HUMAN], with a vendor default that is never zero. A pre-build gets the shorter interval.
18. **Co-sign before activation.** A co-sign rule that requires a co-signature before an order takes effect can delay STAT orders.
    - **Default:** no exemption is encoded. The governed rule [HUMAN] must say whether it exempts STAT orders, with the co-signature then due afterwards.
19. **The reading of "active".**
    - **Default:** only Verify → `active` is drawn from `pending-verification`; its other edges are proposed.
    - **Option:** count `pending-verification` as `active` for every §8.4 row.

## Open questions

- **ORD-Q1** §8.5 and R11 §14 name Pharmacy as the emitter of `MedicationVerified`. Here Verify is on the order, so the orders module publishes it (default). §8.5 names no event for hold, resume, completion, discard or entered-in-error.
- **ORD-Q2** Do R1 outpatient e-prescriptions pass through `pending-verification`, verified by the dispensing pharmacist? Default: every medication order does.
- **ORD-Q3** §9.5's signed-and-held and phase-of-care orders (released on transfer) are not modelled. They need a later version of this machine.
- **ORD-Q4** A verbal order's co-signature after activation is a journal fact and an HIM deficiency task, not a transition. The server's SI-16 check at co-sign belongs to that command handler.
- **ORD-Q5** How a verbal hold or stop is documented (read-back, co-sign) is not encoded.
- **ORD-Q6** Should a resume after a long hold run the CDS again (item 11)?
- **ORD-Q7** Does a BSA-based dose also need a dated height?
- **ORD-Q8** Must the pharmacist enter the independent dose before the ordered dose is shown (blind entry), so that "independently calculated" holds?
- **ORD-Q9** Transcribed orders at Core sites (control set B) are dispensing records, not orders of this machine (§9.10). Confirm.
- **ORD-Q10** Does a replacement order inherit the first-dose history of the order it replaces, for the MAR's verification override? This belongs to DN-053; it decides how wide the gap of item 10 is.

## Not in this machine

These are handled elsewhere:

- order sets and their linked requests (each request is its own instance);
- timing types;
- the CDS registry and its rules (`cds`);
- dispensing (`medications`);
- the specimen and result lifecycles (`specimen.yaml`, `result.yaml`);
- the critical-result service;
- task ownership and `TaskOrphaned` (`platform-tasks`).
