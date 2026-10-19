# Credit claim and pre-approval (`credit-claim.yaml`)

The Kurdistan credit claim of one credited episode, with its pre-approval, owned by `rcm` (§5.2: "credit contracts, pre-approvals, claims"; a satellite, ADR-003). Sources: BUILD-PROMPT §8.4 ("Credit claim and pre-approval (approval: RCM lead + Kurdistan pack PM): §9.23"), §9.23, R11 §10.8, R13 §3.8 (the TPA cashless machine that §9.23 generalises; K §12.1) and R05 §1.2 and §1.8. The predicates are implemented once in `backend/satellites/rcm`, package `hms.rcm.domain.creditclaim`. The approval request is DN-058, which lists every reading below as an item. Hazards: HAZ-0012 (SI-12), HAZ-0003 (SI-03), HAZ-0020 (SI-20).

## SI-12: this machine never gates care

§2.1 SI-12 says pre-authorisation never blocks discharge or emergency care. §9.23 says "a pre-approval never blocks discharge or emergency care", and §5.2 adds "no RCM state can block an ADT, order or MAR command". This machine has **no transition and no effect that gates, delays, refuses or changes a clinical command or aggregate**:

- **Where effects land.** Every effect targets one of three places: rcm itself (ledger, splits, KPIs, outbox events), platform-tasks (SLA timers and the corporate/insurer desk's owned queues) or hub (document packs to the payer). None targets adt, orders, medications, results, record, ed or any other clinical module. None puts a task in a clinician's queue (§9.23 "escalation goes to the corporate/insurer desk, never to clinicians").
- **Discharge comes first.** `RequestDischargeAuth` is guarded by `clinicalDischargeRecorded`: adt reports the encounter in `discharged-not-closed` or `finished`, and death, transfer out and discharge against medical advice all count. The discharge-authorisation request therefore follows the clinical discharge and can never become a step the discharge waits for (DN-058 item 3). No clinical or ward screen may show a claim state as a discharge prerequisite. A test idea for CTRL-0012-4: discharge succeeds in every state of this machine.
- **No pressure during the stay.** Moving liability (`refreshPayerPatientSplit`, `releasePayerLiability`) never raises a patient-facing demand or a clinician-facing check during the stay. Two hazard causes are proposed for HAZ-0012: a mid-stay liability transfer that prompts a discharge against advice, and coverage shown at ordering that deters a time-critical order.
- **Phase-2 check.** A reviewed map from each effect to its target module; the test fails if the map is not total or names a clinical module. The boundary itself (no synchronous call from kernel, adt or orders into rcm) is checked by ArchUnit (CTRL-0012-3) and by the cross-boundary SI-12 property (§9.20 acceptance 4).

## States

`intimation` (initial; created by `RecordIntimation`) → `pre-approval-requested` → `query` ⇄ `query-response` → `pre-approval-approved` → `enhancement-requested` → `enhancement-approved` (repeatable) → `discharge-auth-requested` → `final-approved` → `claim-docs-submitted` → `settled` / `partially-settled` / `denied` → `reconciliation` / `appeal`. These are §9.23's names in kebab-case. This build adds three states:

- **`pre-approval-denied`** (R11 §10.8: "denied"). The desk can request the pre-approval again, or withdraw.
- **`closed`** (terminal). A reconciled claim closes when every line has a final disposition and the payer balance is zero.
- **`withdrawn`** (terminal). The credit route ends before a claim is submitted. The payer's lines move to the next coverage or to the patient as an explicit liability transfer (§9.20). A submitted claim is never withdrawn (DN-058 item 8).

R11 §10.8's other pre-authorisation outcomes map onto existing states: **partially approved** is an approval with a lower amount, and **pended** is a payer query.

## Guards and effects

- **Requests** need the contents §9.23 names.
  - Pre-approval: the documents, the ICD-10 diagnosis (terminology's answer), the proposed procedure, the estimate and the room category.
  - Discharge authorisation: the final bill, the discharge summary, every investigation result of the episode (referenced, or recorded as none) and the pharmacy returns.
  - Coverage must be valid on the episode's start date (§9.23 "no eligibility rail").
  - Whether a pack was complete at first submission is recorded for the ≥95% KPI, and is never a gate.
- **Claim build** (§9.23 acceptance). `everyLineWithinPreApprovalOrFlagged` guards both `RequestDischargeAuth` and `SubmitClaimDocs`. A line must be within the approved services, the validity dates and the approved units (integer counts, never money). A line outside needs a flagged exception: a governed reason chosen by a desk user, who is named.
- **Queries** (§9.23 "Query ⇄ QueryResponse (repeatable, clock paused)"). One pair of states serves every stage, so §9.23's loop is read as stage-generic (DN-058 item 2). The stage is **one** fact, the current query's stage: the open query's stage when one is open, otherwise the stage of the most recently answered query. The four `queryOn…` predicates partition that one value, so each payer decision from `query` or `query-response` has exactly one applicable alternative.
  - A payer may also decide (approve, deny, settle) while its query is open.
  - Each query creates an owned desk task (SI-03).
- **SLA clocks** form an effect pair, and the calendar maths is not in the machine.
  - Every transition into a request state (`pre-approval-requested`, `enhancement-requested`, `discharge-auth-requested`, `claim-docs-submitted`, `appeal`) starts the payer-turnaround clock.
  - Every transition into `query` pauses it.
  - Every transition out of `query` resumes it (an answer) or stops it (a decision or a withdrawal), never both. Every decision stops it.
  - The platform-tasks timer service applies the Friday–Saturday weekend and tenant holidays (§11.7). The §9.23 acceptance test "pauses and resumes its SLA clock correctly across weekends and holidays" runs there.
- **SI-03: the desk owns the claim throughout.**
  - From intimation: `RecordIntimation`'s handler opens an owned desk work item. The format has no creation effects, so phase 2 cannot test this at the specification layer (OQ-C7).
  - After every decision, `openNextStepTask` opens an owned desk task with an SLA for the next step. After an approval, that is requesting the discharge authorisation once adt reports the discharge. After the final approval, it is submitting before the payer's filing limit. After a settlement or a denial, it is reconciliation or an appeal.
  - Reconciliation is an owned task.
- **Money.**
  - Amounts are facts with their currency. Predicates compare only exactly, in one currency, with no conversion; splits, deductions, totals and balances are rcm's ledger answers.
  - `settledInFull` compares the settlement with a reference amount. That is the final-approved payer-payable amount; with no final approval (after a denied discharge authorisation that was appealed), the amount appealed; otherwise the discharge-authorisation amount requested.
  - `settledShort` is its literal negation and needs deduction reasons. A settlement in another currency needs the governed reason "settled in another currency", so the exchange difference goes to reconciliation, not to an appeal.
- **Enhancement denied**: the last approval stays in force.
- **Appeal** is drawn from settled, partially settled and denied (§9.23). From `settled` it appeals the deductions taken at final approval. From `reconciliation`, it appeals an underpayment found there (proposed).
- **Reopening** a closed claim (a late remittance or a payer recoupment) leaves a terminal state, so it needs `privilegedAndAudited` and a correction reason.
- **Document packs (SI-20).** A pack never leaves the cell as a cleartext attachment. The payer receives either a single-use, authenticated link served from the cell (the §9.30 report-release pattern: OTP, at most 72 h, audited), or a pack encrypted under a hospital-held key whose key travels out of band. The message body carries only the payer reference and the link (DN-058 item 9).

## Proposed transitions

Every edge that neither §9.23 nor R11 §10.8 (pre-authorisation requested → approved) draws is in `proposed`. Two denials share an edge with a drawn approval, so each carries its own `proposed: true`:
- an enhancement denial after an earlier enhancement (`enhancement-requested → enhancement-approved`);
- an enhancement denial after or during a query (`query-response → pre-approval-approved`).

The generator marks a transition as proposed when any of its edges is listed. Drawn and proposed edges are therefore kept in separate transitions, and the drawn set stays exact: 15 of the 40 transitions are drawn. Merging the remaining pairs that the correctness review named would mark a drawn edge as proposed, so it was not done.

## Not in this machine

- **The generic claim machine** that "sits underneath" (§9.23; R11 §10.8: draft → scrubbed → submitted → acknowledged → adjudicated → appealed or resubmitted → closed). It is a later `claim.yaml` (OQ-C1). A resubmission is a new generic claim under the same credit claim.
- **Outpatient and day-case credit episodes**, which have no discharge (DN-058 item 10).
- Contracts, price lists, credit limits, co-pay, statements, ageing and DSO; the denial root-cause queues themselves (RCM-DEN-01); the scheme abstraction (P2).
- SLA durations and calendar maths (platform-tasks); document-pack rendering (platform-docs) and transport (hub).

## Events

`ClaimSubmitted` fires on `SubmitClaimDocs`. `ClaimAdjudicated` fires on every settlement, partial settlement and denial of a **submitted** claim, including appeal outcomes. A denied discharge authorisation emits no event, because no claim was submitted. §8.5 names no pre-approval event (OQ-C8).

## DN-058: the approval request and its items

The RCM lead and the Kurdistan pack PM approve the machine (§8.4). Items marked CSO are SI readings for the CSO as well. The file uses each default.

| Item | Question | Options | Default |
|---|---|---|---|
| 1 | Pre-approval denial | (a) a `pre-approval-denied` state with re-request and withdrawal; partial approval as an approval; pended as a query; (b) a denial ends the claim | (a) |
| 2 | Query states | (a) one shared pair, with one current-stage fact, §9.23's loop read as stage-generic, and queries at every stage; (b) a pair per stage | (a) |
| 3 (CSO) | When discharge authorisation may be requested | (a) only after adt records the clinical discharge (`clinicalDischargeRecorded`); (b) before or after, never conditioning the discharge | (a), the stricter reading |
| 4 | The claim-build check | (a) at both discharge authorisation and claim submission: service, validity dates, units; an exception holds a reason and a named desk user; (b) at claim submission only | (a) |
| 5 | Settlement in full | the same currency and not less than the reference amount (final payer-payable, else amount appealed, else amount requested); another currency counts as short with an FX reason | as stated |
| 6 | End of the lifecycle | add `closed` and `withdrawn`; settled, partially settled and denied lead to reconciliation or appeal | as stated |
| 7 | Enhancement denial | return to the last approval in force; approve the two denials flagged `proposed: true` | as stated |
| 8 | Withdrawal | (a) before submission only, including during a query not on the claim; (b) a submitted claim may be withdrawn too | (a) |
| 9 (CSO, privacy lead) | Document-pack transport (SI-20) | (a) a single-use authenticated link served from the cell; (b) a pack encrypted with the key sent out of band; (c) a cleartext attachment | (a) or (b), never (c) |
| 10 | Outpatient and day-case credit | (a) not in this machine until a route is approved (no sham discharge, SI-10); (b) an outpatient route to `final-approved` from an OPD bill without a discharge summary | (a); decide before R1 corporate credit (§21 row 1.9) |
| 11 | Contracts without pre-approval (a corporate credit letter) | (a) record the letter as the pre-approval; (b) a direct route from intimation to discharge authorisation | (a) |

Open questions:
- **OQ-C1.** The generic claim machine as a later `claim.yaml`.
- **OQ-C5.** Appeal levels and limits per payer.
- **OQ-C6.** Reinstating a withdrawn claim.
- **OQ-C7.** Creation commands have no effects, so intimation ownership is a handler obligation.
- **OQ-C8.** Events for pre-approval and discharge-authorisation steps (§8.5 names none).

The old OQ-C2 to OQ-C4 are now items 11, 10 and 9.

## Approval

`approval.required: [rcm-lead, kurdistan-pack-pm]` (§8.4). `status: requested`, `approved_by: []`, `record: null` until a human sign-off record exists (§3.5). §9.23 acceptance asks for approval "by M9 in the business plan" [HUMAN].
