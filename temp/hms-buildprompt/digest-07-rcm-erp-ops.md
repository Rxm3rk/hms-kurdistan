# Digest 07: Revenue cycle, ERP and operations (Kurdistan)

**Sources read:** R05 §0–§9 and its verification log; K §12, plus the K sections that §12 depends on (§1–§2, §4, §5.1–5.2, §5.4, §6.1, §7.3, §8, §9, §11, §13.3, §13.5, §14.2, §16.1, §17–§19, App. A–B); BP §12, §5.1, §7.4, §8. Also the passages that K §12.1 cites as sources: R11 §10.8, §11, §12, §14, §17; R13 §3.7–3.8; R15 §8.2; R16 §7.
**Tags:** [L] = Kurdistan local assumption (K App. B); [E] = estimate; [K] = R05 analyst prior, not re-verified; [I] = K inference.
**Removed everywhere (Kurdistan deltas):** NHCX, PM-JAY, CGHS, NPHIES, ZATCA, GST/TDS, IRDAI clocks, DRG/HRG groupers and CMI, CPT/HCPCS/revenue codes/modifiers, X12 (270/271, 278, 837, 835), US price transparency (MRF/GFE), 501(r), and the DE/FR/UK/AU regimes.

---

## 1. Finance principles

- **One patient account** across clinical and financial domains. Registration, orders, documentation, charges, coding, claims and payments share identifiers and real-time state, with no batch re-keying (R05 §8.1 #1; K §12; BP §12).
- **Effective-dated rules** for tariffs, contracts, code sets, edits and taxes, configured as data in a versioned country pack on one codebase. No forks (R05 §0 #15, §9.2 #1; K §1 K-26). Groupers are dropped for Kurdistan (K §12.1).
- **Charges come from clinical events through the charge router.** Every charge is traceable to its source event. Clinicians never type charges; manual entry is for exceptions, and charges carry an override-reason field (R05 §1.4, §8.1 #2; R11 §11; K §12). Build the router early, "even for cash-only MVPs" (K §12; R11 §17 #6).
- **Append-only double-entry ledger.** Amounts are never updated in place: post reversals. Every amount traces to a source event and a user (R05 §7 rule 1; BP §8; K §12).
- **Clinical truth is kept separate from billing representation.** Bills, packages and claims are derived and can be regenerated (R05 §7 rule 3).
- **Coverage priority and liability transfer** (payer → patient) are explicit and auditable (R05 §7 rule 4).
- **Self-pay features are first-class, not customisations:** deposits, interim bills, packages, corporate credit, discount approvals, multiple price lists, multi-currency and tax (R05 §0 #11).
- **The HMS owns** the patient sub-ledger, the charge master, clinical supply consumption and pharmacy stores, and posts summarised journals to accounting (R05 §0 #12).
- **Capture costing data at source from day 1:** a resource ID, start/stop timestamps and consumed lots on every clinical event (R05 §0 #13, §3.2; K §12.2).
- **Work queues everywhere,** with SLA timers (R05 §8.1 #6). Denial root causes feed back into registration edits, pre-approval rules and documentation (R05 §8.1 #3; BP §12.1).
- **Architecture placement:** the kernel sends clinical events to RCM and stock movements to inventory, and both post to the GL (BP §7.4). RCM is a downstream conformist behind the Hub (K §7.3). Billing/ERP is safety Tier 0 (K §5.4).
- **SI-12 (vendor-locked; tenants may tighten it, never loosen it; K §5.1).** Bill clearance, deposits and pre-authorisation never block discharge or emergency care. It is enforced at the RCM ↔ ADT boundary, hazard H4 (BP §5.1). Kurdistan extension (K §5.1; K App. A KDV-15):
  - Deposits before elective admission remain hospital policy [L-29], but no deposit rule may block an ED registration, an emergency order or a discharge order.
  - No payment, deposit or counter rule may delay a verified time-critical inpatient dose: STAT and first doses, antimicrobials, insulin, anticoagulants, anticonvulsants. The dose is charged to the running bill.
  - Patient-supplied medicines are received and relabelled by pharmacy and are never scanned unverified.
  - Clinical discharge is separate from financial clearance (R05 §8.3 #10, §2.5 #10).
- **Pre-approval clocks escalate to the payer desk, not to clinicians** (BP §12, "to the TPA desk"). In K, the corporate/insurer desk owns pre-approvals (K §6.1).
- **Revenue closed loop:** clinical event → charge → bill or package → credit claim → settlement. Live KPIs: charge lag, unbilled consumption, cash-drawer variance by currency, deposit coverage ≥100% (K §5.2).
- **What the owner buys [I]:** no leakage between ward, pharmacy and cashier; cash control across two currencies; faster, cleaner corporate and insurer collections (K §12).
- **Generic pattern:** design the model for multi-payer coverage, pre-approval, separate hospital and doctor charges and denials, so simpler markets are a subset (R05 §0 #1).

## 2. Canonical finance data model (R05 §7, with Kurdistan rules applied)

**Persistence rule.** Every entity is an internal aggregate with its own lifecycle. FHIR names are naming guidance and edge projection only; nothing is persisted as FHIR JSON (R05 §7 preamble; RL #2; K §8).
**External financial API.** Limited to the payer resources that stay in R6 core: Account, Claim, ClaimResponse, Coverage, CoverageEligibilityRequest/Response, ExplanationOfBenefit, PaymentNotice and PaymentReconciliation (R05 §9.2 #2; R11 §11).

| Entity | Key attributes (R05 §7 unless noted) | Kurdistan rule |
|---|---|---|
| Patient | MRN(s), national IDs | Iraqi Unified National Card, older civil ID, residency card, passport, UNHCR/IDP papers, MRN with check digit [L] (K §8) |
| Guarantor | Person or organisation; relationship; address; credit status; statement preferences | Credit patients have a guarantor with credit status (K §12.1) |
| Guarantor account | Patient-responsibility balance across encounters; payment plans; statements; collections status | Generic pattern: payments allocated by a configurable rule (oldest first, by service date, or patient-designated) (R05 §1.10) |
| Encounter | Type (IP/OP/ED/day case); dates; location; attending; disposition | Location history is the single source for census, patient-days and bed charges (BP §8) |
| Billing account (case) | Account class; financial class; admit/discharge; status open/DNFB/billed/closed; maps to ≥1 claim | DRG and foreign case IDs removed (K §12.1) |
| Coverage | Payer; plan; member ID; subscriber; relationship; effective dates; **priority order**; network; co-pay rules | A corporate, NGO or insurer contract plus an eligibility letter (K §12.1) |
| Eligibility check | Request/response; benefits; timestamp | No rail: the eligibility letter is captured (K §9.1, §12.1) |
| Authorization (pre-approval) | Services; units; validity; status; payer reference; attachments | See §5 |
| Estimate | Line items; providers; contract basis; patient share; validity | Separate surgeon and anaesthetist fee lines; variance tracked (K §12.1) |
| Charge item | Charge code; service date; quantity; unit price from price list; performing/ordering provider; local code; cost centre; source-event link; lot/UDI. Status: planned/billable/not-billable/aborted/billed/entered-in-error; override reason (R11 §11) | **Performing and ordering practitioner are mandatory on every charge.** This resolves R05 §7 (provider on the charge) vs R11 §11 (department only), and payouts need it (K §8) |
| Price list (tariff) | Code; price by tariff; effective dating; room-category multipliers; package membership | IQD by default; USD lists only where L-33 allows (K §12.1) |
| Package | Inclusions/exclusions; LOS limit; implant pass-through; overrun rules | Adds a free revisit window and doctor package-share rules (K §12.1) |
| Payer contract | Methods (per diem, % of charges, fee schedule, packages, capitation); carve-outs; outliers; effective dating | Price list per contract; credit limit; co-pay (K §12.1) |
| Coding abstract | Diagnoses (sequenced); procedures; coder; code-system version | WHO ICD-10; no grouper fields (K §12.1) |
| Claim | Type; lines; coverage sequence; attachments; status lifecycle; external IDs | Document-pack claim (K §9.1) |
| Claim response / settlement | Paid, allowed and patient share; adjustment reason codes | Deduction-reason codes (K §12.1) |
| Liability bucket | Primary/secondary/tertiary/self-pay buckets per account; balance per bucket | Per-line payer / patient / non-payable split (K §12.1; BP §8) |
| Financial transaction | Charge; payment; adjustment (contractual, administrative, bad debt, charity, discount, small balance); refund; transfer; GL mapping; reversal links; immutable | Functional-currency amount plus the original-currency amount (K §8) |
| Adjustment / write-off | Reason; approver; policy (R11 §11) | Required on every adjustment (K §12.1) |
| Deposit / advance | Amount; currency; applied/unapplied; refundable flag | Held in the tendered currency (K §12.1) |
| Patient payment | Method; receipt number; cashier session (R11 §11) | Records tendered currency, amount, rate and change given, which may be in the other currency (K §8) |
| Invoice / statement | Lines; tax lines; currency | No e-invoice IDs; tax and receipt rules per Q-K6; trilingual receipts (K §4.2, §12.1) |
| Denial / work item | Root cause; owner; SLA; appeal status; recovered amount | — |
| GL journal (summary) | Entity; period; account; cost centre; payer class; amount | Daily, by CSV or API, with drill-back; never line-level (K §9.1) |
| **Money** (K addition) | Decimal plus ISO 4217 code (IQD, USD); cash rounding per tenant, e.g. to IQD 250 [L] | (K §8) |
| **Exchange-rate table** (K addition) | Effective-dated; source; timestamp | (K §8, §12.1) |
| **Cashier drawer and shift** (K addition) | Per currency; float; denomination count; variance | (K §12.1; R16 §7.4) |
| **Doctor-fee ledger** (K addition) | Payable sub-ledger per practitioner; rules (%, fixed or package share); settlement cycles; statements; exported to AP; never payroll | (K §8, §12.2) |

**Rules:**
1. The ledger is append-only.
2. Everything is effective-dated (prices, contracts, code sets, tax rates, edits), so claims can be re-graded as of the date of service (R05 §7). "Code sets and price lists are versioned by date of service as data" (K §12.1).
3. Clinical truth is kept separate from billing representation.
4. Liability transfer is explicit.
5. The ledger runs in the tenant's functional currency, keeps original amounts, and posts FX differences to the GL export (K §8).

**Gaps K fills:** R11 has no money type; R05 lacks per-currency drawers, other-currency change and rounding (K §8). The credit-claim state machine is approved by M9 (K §8; BP §8).

## 3. The Kurdistan billing pack (buildable requirements)

**Model:** "pay-first, package-first" (K §12.1). In R05's archetypes this is F (self-pay dominant: deposits, packages, approved discounts, corporate credit, multi-currency, tax), with credit from corporates, NGOs and insurers. Archetype D (a government scheme with packages and pre-auth) applies only when national insurance arrives (R05 §2.1; K §12.1). R1: patient accounting with deposits, packages, discounts, refunds and cashier shifts in IQD and USD; doctor-fee ledger; corporate and insurer credit. R2a: inpatient billing with running bills and discharge billing; OT billing (K §4.2).

### 3.1 Deposits
- Set by package or bed category (K §12.1; R05 §2.5 #1).
- A top-up alert fires when the running bill crosses a threshold of the deposit (K §12.1).
- Unused deposit is refunded. Deposit refunds at discharge are reconciled against the final bill (R05 §2.5 #1; R16 §7.4).
- Deposits can be transferred between encounters and family members, with controls (R05 §2.5 #1).
- Held in the tendered currency. USD deposits only where L-33 allows (K §12.1).
- Payment links for deposits and top-ups go out over WhatsApp/SMS (R16 §7.3 #4). Wallet links arrive in R1.1 (K §4.2).
- Bound by SI-12 (§1).

### 3.2 Running bill
- A day-wise view for the patient and relatives, compared with the estimate (R05 §2.5 #2; K §12.1).
- Room-class tariff multipliers apply; the room category recalculates other charges (K §12.1; R05 §2.5 #4).
- Bed-day charges come from location history (BP §8).
- Every line carries a payer / patient / non-payable split (K §12.1).

### 3.3 Packages
- Fixed price, with inclusions, exclusions, length-of-stay limits, room-category multipliers, implant pass-through, overrun rules and a free revisit window (K §12.1; R05 §2.5 #3).
- Doctor-fee package-share rules (K §12.1).
- Package coverage and leakage are reported in the pre-go-live replay (R15 §8.2).
- The sources do not define how overrun and the revisit window behave (see §10).

### 3.4 Estimates
- A written estimate with validity, patient share and separate surgeon and anaesthetist fee lines. Variance from actuals is tracked (K §12.1).
- Engine inputs (R05 §1.3, generic pattern): a package/bundle template; contract terms per payer and plan; coverage benefits (in place of the US 271 accumulators); historical amounts per bundle.
- Generic pattern: a multi-provider estimate document (R05 §1.3).
- Produced by the same contract engine as the replay (K §12.1).

### 3.5 Refunds
- Refund to the original instrument where possible. Cash refunds need approval thresholds (R16 §7.4).
- Posted as ledger type "refund", with reversal links (R05 §7). Refunds sit in the cashier's queue (K §6.1).

### 3.6 Cashier shifts and drawers
- **Lifecycle:** open with a float → transactions by tender type (cash, card, wallet, cheque, credit) → close with a denomination count → variance approval → handover to the main cash office (R16 §7.4).
- **Per-currency drawers:** per-currency denomination counts and shift close; exchange-rate display at the till; doctor-fee settlement at the till (K §6.1, §12.1).
- **Target:** drawer variance 0 per currency per shift (K §12.1).
- **Gates:** dual-currency reconciliation drill at RG3 (K §13.3). Ledger integrity, including dual-currency drawers, is never descoped from the wedge (K §14.2).

### 3.7 Dual currency (KRI-RCM-01, M; builds on RCM-CSH-01) (K §4.1)
- **Price lists:** IQD by default. USD lists, deposits and contracts only where Central Bank rules allow (L-33; due M4 via S17-K). If unanswered, Q-K19 defaults to IQD lists with USD accepted at the posted rate (K §12.1, §19.2).
- **Payment:** in either currency at the posted rate; change given in either currency (K §12.1).
- **Rates:** an effective-dated exchange-rate table with source and timestamp (K §8, §12.1).
- **Payment record:** tendered currency, amount, rate and change given (K §8).
- **Cash rounding:** per tenant, e.g. to IQD 250 [L] (K §8).
- **Ledger:** functional currency, original amounts kept, FX differences posted to the GL (K §12.1).
- **Reconciliation "to the dinar"** (K §2). At cutover, opening deposits and packages in each currency are reconciled to the dinar; risk 18 triggers if Mock 3 is <100% reconciled (K §13.5; K §18).

### 3.8 Discounts, charity and waivers
- Approval thresholds by role, amount and % (K §12.1; R05 §2.5 #6).
- Charity or Zakat funds; staff and VIP price lists (K §12.1).
- Every adjustment carries a reason, approver and policy; audit reports (K §12.1; R11 §11).
- Bad debt and charity are tracked separately (R05 §1.9; K §12.1).

### 3.9 Doctor fees and the payout ledger (KRI-RCM-02, M) (K §4.1)
- **Charging:** surgeon, anaesthetist and consultant fees are separate charge lines carrying the performing practitioner, with package-share rules (K §12.1).
- **Paying out:**
  - a payable sub-ledger per practitioner, with rules (%, fixed or package share), settlement cycles and statements;
  - payables, never payroll;
  - a native sub-ledger exported to AP, in the MVP (K §8, §12.1, §12.2).
- **Practitioner data:** a visiting-consultant flag and privileges per hospital (K §8).
- **No referral-commission feature,** including in the referrer portal (K §1, §4.3, §12.1). R05 only names the need (§8.3 #8); K fills the design (K §12.1).

### 3.10 Corporate, NGO and insurer credit (RCM-INS-01; corporate credit is in the MVP under RCM-SCH-01) (K §4.1)
- **Contracts:** a price list per contract; eligibility letters; credit limits; co-pay (K §12.1; R05 §2.5 #5).
- **Pre-approval:** SLA timers, with the clock paused while a query is open (K §12.1); see §5.
- **Billing:** per-line payer/patient/non-payable splits; deduction-reason codes; monthly statements; ageing per account (K §12.1).
- **Receivables:** patient-related corporate receivables live in the HMS sub-ledger, aged per corporate account (K §12.2).
- **Claims:** sent as a **document pack** (PDF plus structured summary) by email or portal; a FHIR Claim when the insurer can take it. Manual in R1, automated in R1.1 (K §4.2, §9.1). AI document-pack assembly arrives in P2 (K §11.2).
- **Denials** (R05 §1.8; K §12.1):
  - root-cause queues;
  - categories: front-end/eligibility, authorisation, coding, medical necessity, timely filing, duplicate, bundling, clinical validation;
  - work queues with SLA timers and appeal templates.
- **Desk workspace:** pre-approvals, credit limits, statements, ageing, document packs, the per-line split and deduction reasons (K §6.1).
- **Generic patterns:** multi-payer authorisation codes; tracking of slow-paying receivables (R05 §2.2).

### 3.11 The scheme abstraction (P2)
- **One "scheme" object:** package master, eligibility check, pre-auth workflow, document checklist, claim format and rate master. Each scheme is plugged in as configuration, never as a code fork (R13 §3.7; BP §12.1).
- **Kurdistan status:** kept ready for national insurance (Law No. 22 of 2020 [L]). The government-scheme part of RCM-SCH-01 is P2, activated when the scheme reaches the Region; no Kurdistan adapter until then (K §4.1, §12.1; Q-K13).
- **Federal adapter:** in the Iraq federal pack (code-complete M48, live M52, ≤40 PM) (K §4.2).
- **What a scheme needs:** package catalogue, pre-auth with clinical-evidence upload, portals, claim tracking, delayed-payment AR (R05 §2.1).

### 3.12 Coding
- **Code systems:** WHO ICD-10 (base version) for insurers and statistics; commercial use needs WHO permission. ICD-11 dual coding if the KRG adopts it (free). No DRG grouper (K §8, §12.1).
- **Timing:** R2.1, with a manual coding sheet until then; no IHACPA or CPT licences (K §4.1, §4.2).
- **Model rules:** never store "the" diagnosis code in a single column; code sets are versioned and effective-dated (R05 §0 #10, §9.2 #4).
- **Workbench (generic pattern):** suggestions with evidence spans and confidence; autonomy thresholds per encounter type; audit sampling; edit check before final. Legal responsibility for codes stays with the billing provider (R05 §1.5). AI coding and claim scrubbing are P2, from a partner (K §4.3).

### 3.13 Tax and receipts
- Configurable tax engine. The tax treatment of hospital services is confirmed by counsel before R1 (Q-K6, due M4). RCM-TAX-01 is re-scoped to Kurdistan receipt and tax rules (K §4.1, §12.1, §19.2).
- Generic pattern: tax by item and patient category, carried as tax lines on the invoice (R05 §2.5 #8, §7).
- Trilingual receipts (K §4.2).

### 3.14 Payments and three-way reconciliation
- **Instruments:** cash first; semi-integrated card terminals; wallet and QR payment links. Example wallets are FIB, FastPay, ZainCash and Qi Card [L]. Partners are chosen by M12; the Q-K10 default is card terminals plus one wallet (K §9.1, §12.1, §19.2).
- **Card data:** no card number touches the HMS. The HMS sends amount, reference and type, and receives approved/declined, auth code, masked PAN, token and scheme (K §9.2; R16 §7.1).
- **Integration modes** (R16 §7.3): local semi-integrated (works on the LAN when the WAN is down); acquirer-cloud push; dynamic QR confirmed by webhook plus status poll; static QR fallback with manual reconciliation.
- **Three-way reconciliation:** HMS receipts ↔ terminal batch/settlement reports ↔ acquirer or wallet settlement and bank credit files (fees, chargebacks). Unmatched items go to a work queue (K §12.1; R16 §7.4).
- **Downtime:** terminals run in standalone mode and the reference is back-entered. All downtime payments go to a reconciliation queue. Care is never blocked on payment capture (R16 §7.5).
- **Gates:** terminals connect through the on-site cell or site edge agent (K §9.2) and are tested, with wallet links, at RG4 (K §13.3).

### 3.15 Outpatient pharmacy till (MED-OPP-01, re-scoped; R1)
- Retail sale, in both currencies, with Iraqi narcotics registers (MED-CS-01) (K §4.1, §4.3, §12.1).
- Price checks against KRG price lists, if they exist (L-32) (K §12.1).
- Pharmacy stores are separate from general stores (R05 §3.3).

### 3.16 Patient-supplied medicines [L-34] (R2a)
- **Receipt:** medicines and consumables bought at the counter or outside are received by pharmacy, identified, expiry-checked, relabelled to the patient and flagged "patient-supplied" (K §12.1).
- **Administration:** unverified outside medicines cannot be scanned for administration (K §5.1, §12.1).
- **Payment:** no counter or deposit rule may delay a verified time-critical dose; the dose goes on the running bill (K §12.1).
- **Gates:** live at RG3 (K §13.3); time-critical doses delayed by payment = 0 (K §17); risk trigger: any unverified outside medicine given (K §18 risk 16).

### 3.17 Credit patients and guarantors
- A guarantor (person or organisation) with credit status; payment plans; bad debt and charity tracked separately (K §12.1; R05 §1.9).
- Generic patterns (R05 §1.9): digital-first statements (SMS/email, wallet payment); collections-agency placement through file interfaces.

### 3.18 Cutover
- Opening balances: deposits and packages in each currency, reconciled to the dinar; corporate receivables.
- Pre-cutover receivables run off on the old system for 6–12 months (K §13.5).

## 4. Charge router, contract engine and re-pricing replay

**Charge router and charge capture:**
- **Mechanism:** a rules engine generates charge items from clinical events, with full traceability back to the source event (R11 §11).
- **Capture patterns** (R05 §1.4):
  - *order-driven:* charge on result or verification;
  - *documentation-driven:* from the MAR, nursing flowsheets or the OR record (implants, supplies, time);
  - *time-based:* anaesthesia, OR minutes, observation hours, ventilator days;
  - *point-of-use scan:* GS1 barcodes;
  - *manual:* the exception.
- **Charge sources:** order, procedure, administration, bed-day, supply (R11 §11); OT implants and consumables to charge and stock (K §4.3, §12.2); dietary extras (R05 §4.8).
- **Event:** `ChargeCreated/Credited`, mapped to HL7 DFT^P03/P11 (R11 §14).
- **CDM fields (US fields removed):** charge code, description, local code, price per price schedule, department/cost centre, GL revenue account, UoM, effective dates, statistical-unit flag (R05 §1.4, §7). The item master carries a chargeable flag and a CDM link (R11 §12). Charge-master and package templates ship in the Kurdistan foundation content (K §8).
- **Reconciliation:** expected vs captured charges, daily by department, with dashboards. A late charge is one posted more than 3 days after service (R05 §1.4, §8.1 #2).
- **Leakage target:** unbilled consumption ≤0.5% of consumption value at 90 days (K §12.1).

**Contract and tariff engine:**
- **One contract engine.** R05 gives it three uses: estimates, expected reimbursement/underpayment variance, and US transparency files (out) (R05 §1.8, §8.1 #5). K lists estimates plus the replay (K §12.1); BP also lists expected-reimbursement variance (BP §12.1).
- **Contract methods** (R05 §1.8, §7; DRG removed): per diem, % of charges, fee schedule, packages, capitation, carve-outs, stop-loss/outlier, lesser-of logic, implants at invoice + %.
- **Tariff engine:** price lists × room category × patient category × payer, with inheritance (a base list plus overrides), effective dating and packages (R05 §8.2).
- **Price-list types:** general, corporate A/B/C, insurer-specific, international patient, staff, VIP (R05 §2.5 #4).
- **Payer/contract registry:** payer → plans → contracts → terms, with network status and authorisation rules (R05 §8.2).
- **Rules engine:** decision tables plus an expression language for eligibility routing, price derivation, package logic, discount approvals, authorisation requirements and claim edits. Explicit versioning and simulation (R05 §8.2, §9.2 #3).

**Re-pricing replay (a go-live gate for any tariff, package or payer rule):**
- Re-price the last **3–6 months of encounters** under the old and the new rules before the change goes live (K §12.1; BP §12.1; R15 §8.2).
- Outputs: a package coverage and leakage report, and a claim-scrub replay (generic pattern; the NPHIES/NHCX replay is removed) (R15 §8.2).
- Acceptance [E]: the revenue delta is explained line by line, and there are zero unpriced services (R15 §8.2).

## 5. Generic claim state machine and the pre-approval entity

**Generic claim** (R11 §10.8): `draft` → `scrubbed/edits passed` → `submitted` → `acknowledged` → `adjudicated` (paid / partially paid / denied) → `appealed`/`resubmitted` → `closed`.
**Pre-approval** runs in parallel (R11 §10.8): `requested` → `approved` / `partially approved` / `denied` / `pended`.

**Credit-claim flow.** K §12.1 describes its credit design as "BP's TPA state machine generalised" (BP §12.1; R13 §3.8). States are shown with "pre-auth" renamed to K's "pre-approval":

| State | Payload / rule |
|---|---|
| Intimation | — |
| PreApprovalRequested | Documents, ICD-10 diagnosis, proposed procedure, estimate, room category |
| Query ⇄ QueryResponse (repeatable) | SLA clock pauses while the query is open |
| PreApprovalApproved | Amount, room-rent cap, co-pay, sub-limits |
| EnhancementRequested → EnhancementApproved (repeatable) | — |
| DischargeAuthRequested | Final bill, discharge summary, investigations, pharmacy returns |
| FinalApproved | Payer-payable, deductions, patient-payable |
| ClaimDocsSubmitted | Document pack |
| Settled / PartiallySettled / Denied | Deduction reasons, or denial reasons |
| Reconciliation / Appeal | — |

Removed as India-specific: the IRDAI 1 h and 3 h clocks, UTR/TDS, "CRC-approved" denials, and NHCX claims (R13 §3.8).

**Pre-approval entity:**
- **First-class.** Linked to orders, scheduled procedures, coverage, units/visits, validity dates and payer reference numbers. Claim lines are checked against it at claim build (R05 §1.2; K §12.1).
- **Attributes:** services, units, validity, status, payer reference, attachments (R05 §7).
- **Timers:** SLA timers, with the clock paused on a query (K §12.1). Escalation goes to the desk, not to clinicians (BP §12).
- **SI-12:** it never blocks discharge or emergency care.
- **Hospital-side KPIs (generic, BP §12.1):** pack completeness at first submission (≥95%, K §12.1) and time-to-submit. Insurer decision times are tracked as evidence, because they are insurer obligations.
- **Channels (generic, BP §12.1; R05 §9.2 #6):** multiple routes, offline queueing, idempotent submissions and full message archives.
- **Eligibility (generic pattern, R05 §1.2):** re-verify at scheduling and again before service.

## 6. ERP (R05 §3; K §12.2)

| Function | Stance | When |
|---|---|---|
| Item master, FEFO, indents, ward stock, **consumption-to-charge**, OT implants to charge and stock, pharmacy stores, controlled-drug registers | Native | MVP |
| Procurement-lite (PR → PO → GRN → 3-way match); consignment with a bill-only PO on use; AP/AR; **daily summarised GL journals with drill-back** to the hospital's accounting software | Native / export | MVP (procurement breadth and AP/AR in R2.1, K §4.2) |
| Staff master, credentialing and privileging (privileges gate order entry and OT booking), with typed practitioner IDs | Native | MVP |
| Doctor-fee payables | Native sub-ledger, exported to AP | MVP |
| Lite GL (multi-entity, multi-currency), fixed assets, CMMS, basic rostering, CSSD-lite | Native | P2 |
| **Payroll/HCM and time and attendance** | **Always integrate** | P2 |
| Patient-level costing | Native | P3 |

Native GL is explicitly excluded from the MVP (K §4.3). Native clinical-operational ERP is decision K-25: "the supply-to-charge join is our edge" (K §1).

**Item master and stock** (R11 §12; R05 §3.3):
- **Item:** code, GTIN, UDI-DI, UoM conversions (box → each), category, chargeable flag plus CDM link, implant flag, lot/serial tracking, storage conditions.
- **Stock:** store, bin, lot, serial, expiry, quantity, consignment flag.
- **Requisition/transfer:** from-store and to-store, items, approval.
- **Regional brand master** (K §8): brand → clinical drug → generic/ATC → package GTINs → lot. Several GTINs map to one orderable; new products are scan-tested; unmapped formulary ≤5% at T-90. In-house unit-dose labels (MED-KRI-01) (K §4.1).

**Inventory structures and FEFO** (R05 §3.3):
- Central stores; ward stock with par levels; two-bin Kanban; low-unit-of-measure distribution. Automated dispensing cabinets are P2, integrated (K §4.3).
- FEFO picking, near-expiry alerts, quarantine of expired stock.
- Fridge temperature excursions quarantine blood units and vaccine lots (K §9.2).

**Point-of-use capture** (R05 §3.3): a barcode/RFID scan in the OR, cath lab or IR documents usage, decrements stock, triggers replenishment and creates the charge, all in one event.

**Implants, recall and consignment** (R05 §3.3; R11 §12; K §12.2):
- **Implant record:** links UDI-DI plus UDI-PI (lot, serial, expiry) to the patient, the procedure and the charge, and carries a recall status.
- **Recall:** search by GTIN and lot → locate stock (stores, wards, consignment) → quarantine → identify affected patients → notify clinicians. Recall classes I/II/III.
- **Consignment** (implants, ortho sets): a bill-only PO is raised on use.
- **Loaner trays:** managed through sterile processing.

**Pharmacy vs general stores:** they share item-master patterns but keep separate stores, ledgers and permissions. Pharmacy adds controlled-substance registers, batch/lot tracking and cold chain (R05 §3.3).

**Procure-to-pay:** requisition → approval (budget check) → PO → GRN → vendor invoice → 3-way match (PO vs GRN vs invoice, within tolerances) → payment (R05 §3.3).

**AP/AR split** (R05 §3.1; K §12.2):
- Patient AR, including patient-related corporate receivables, lives in the HMS sub-ledger.
- Non-patient AR (grants, rentals) lives in the hospital's ERP or accounting system.

**GL journals:**
- Posted daily and summarised: revenue by cost centre and payer, contractual adjustments, cash, bad debt, charity (R05 §3.1).
- FX differences are included (K §8).
- Delivered by CSV or API with drill-back, never at line level (R05 §8.3 #11; K §9.1).

**Cost centres:** revenue-producing departments, nursing units and overheads. This hierarchy is the backbone of departmental P&L (R05 §3.1).

**Integration** (R05 §3.8; BP §12.2):
- **Source of truth:** decided per master-data object (item, vendor, cost centre, employee/provider, chart of accounts).
- **Flows:** HMS → ERP: summarised journals, supply consumption, requisitions. ERP → HMS: PO status, item prices, employee status, cost-centre changes.
- **Standards:** REST/SOAP; flat-file GL batch; HL7 v2 MFN/MFE; FHIR Practitioner, Organization, Location, Device.

**Staff master, credentialing and privileges** (R05 §3.5; K §8):
- Primary-source verification; expiry alerts; automatic block from scheduling when a licence expires.
- Delineated privileges per procedure; FPPE/OPPE; reappointment at most every 2–3 years [K].
- The privilege check blocks OT booking and order entry.
- Competencies drive scheduling eligibility.
- **Kurdistan identifiers [L-30]:** syndicate number (doctors, pharmacists, nurses); KRG or federal Ministry of Health practice licence; Kurdistan, Iraqi, Arab or foreign board certificates; privileges per hospital.

**P2 items:**
- **Lite GL:** multi-entity, multi-currency and multi-book, with a chart of accounts aligned to statutory reporting (R05 §3.1).
- **Fixed assets:** capitalisation thresholds, componentisation, depreciation by local rules, transfers and disposals; shares an asset ID with the CMMS (R05 §3.1).
- **CMMS** (R05 §3.4): asset register (serial/UDI, model, location, risk class, warranty, service contracts, firmware versions); PM per manufacturer or a risk-based programme, 100% on time for high-risk equipment; calibration and IEC 62353 safety tests; corrective work orders, downtime, MTBF, parts.
- **Basic rostering** (R05 §3.6): self-scheduling, shift bidding, float pool, agency/locum, on-call, skill mix, census-driven adjustment. Acuity-based staffing is P3 (K §4.3).
- **CSSD-lite** (K §12.2): tray tracking, sterilisation cycles, load records, recall by load, patient–tray linkage (R05 §4.8).

**Always integrated:** payroll/HCM and time and attendance (K §1 K-25; K §12.2). Labour distribution to cost centres feeds productivity reporting (R05 §3.7).

**P3 costing:** TDABC is capacity cost rate × time per resource. It needs the resource IDs, timestamps and lots captured from day 1 (R05 §3.2; K §12.2).

## 7. Operations, patient flow and MIS

**Kurdistan scope** (K §4.2, §4.3):

| Phase | Items |
|---|---|
| MVP | ADT including leave; bed state machine; bed board (R2a); scheduling with the Friday–Saturday weekend and Kurdistan holidays; OPD token journey (R1); referral tracking; OT booking and lists; diet orders with religious preferences; ward census (R2a) |
| R1.1 | Queue display boards |
| P2 | Transfer centre; kiosks; RTLS ingestion; OR analytics; command-centre data (K §11.1) |
| P3 | Predictive discharge |
| Never built | RTLS engine (K §1, §9.2) |

**Bed management** (R05 §4.1; BP §8):
- **State machine:** occupied → pending discharge → vacated/dirty → cleaning in progress → clean/inspected → ready/assigned → occupied.
- **Blocked beds:** isolation, maintenance, staffing.
- **Attributes:** gender, isolation, telemetry, bariatric.
- **Assignment rules:** specialty, gender, isolation, acuity.
- **Escalation timers:** admit decision → bed assigned → bed ready → patient in bed.
- **Integrity:** one authority per bed, with DB exclusion constraints against double occupancy.

**EVS** (R05 §4.1): the discharge event creates a cleaning job, dispatched by mobile; the clean type is inferred from isolation flags; turnaround is measured from dirty to clean.

**OPD queue** (R05 §4.6; RL #4):
- Tokens via kiosk/SMS and virtual queues.
- Journey: registration → vitals → consult → lab → pharmacy → billing, with cash/billing checkpoints between steps.
- Load balancing, display boards, no-show prediction with overbooking. No-show outreach is AI-0 in P2 (K §11.2).
- Hardware: ESC/POS token printers and RTL HTML signage (K §9.2).

**OR scheduling** (R05 §4.5): block allocation, release rules (72 h or 7 days), open time. Metrics: block utilisation, first-case on-time starts, turnover, case-duration accuracy, day-of-surgery cancellations.

**Command centre** (R05 §0 #14, §4.2): data substrate first (real-time events; bed/EVS/transport state machines), with escalation owners and daily huddles; the UI is a thin layer.

**Support services** (R05 §4.8):
- **Dietary:** diet orders covering texture, allergies, NPO and cultural/religious needs; patient charges for extras.
- **Death:** KRG death notification forms, with ICD-10 cause of death in WHO format (K §9.1).
- **Sterile processing:** delivered as CSSD-lite in P2.

**MIS:**
- **Owner / managing director daily dashboard** (K §6.1, §11.1): revenue and collections by currency; **unbilled consumption** (leakage); deposits outstanding; corporate receivables; occupancy; safety KPIs. Runs on the on-site reporting replica (≤60 s; read models ≤2 s). Unbilled consumption, drawer variance and deposit coverage are the owner-to-owner sales evidence (K §16.1).
- **Emerging-market MVP MIS** (R05 §9.3 #7): daily revenue and collections, payer mix, occupancy/ALOS, receivables ageing, statutory returns. K ships MIS basics in R1 and MIS breadth in R1.1 (K §4.2).
- **Executive dashboard tiles** (R05 §5): volumes, revenue vs budget, cash collections, AR days, DNFB, denial rate, labour productivity, supply cost per case, occupancy/ALOS, quality and safety, patient experience. CMI is removed.
- **Departmental P&L:** revenue by cost centre, less direct labour, supplies from consumption and depreciation, less allocated overhead (R05 §5).
- **Payer mix:** by payer class (self-pay, corporate, NGO, insurer) (R05 §5; K §2).
- **Productivity:** HPPD, adjusted patient days, FTE per adjusted occupied bed, worked hours per unit of service (R05 §5).
- **Statutory returns:** KRG returns from the indicator catalogue (outpatient R1, inpatient R2a); notifiable diseases (R1); DHIS2 data-value sets via the Web API (R1.1), if the KRG uses DHIS2 (K §9.1; R05 §5).
- **Indicator catalogue:** each indicator has a definition, numerator/denominator, data source, period, disaggregations and target. The same definitions drive dashboards and statutory returns (R05 §5).

## 8. KPIs

| KPI | Definition | Target / benchmark | Ref |
|---|---|---|---|
| **Deposit coverage** | Deposits held ÷ running bill, open inpatient accounts | ≥100% | R05 §6.1; K §12.1 |
| **Charge lag** (PB-4) | Average days from service to charge posting; late charge = posted >3 days after service | ≤2 days (R05: <2–3 days, estimate) | K §12.1; R05 §6.1 |
| **Unbilled consumption** | Unbilled share of consumption value | ≤0.5% at 90 days | K §12.1 |
| **Cash-drawer variance** | Per currency, per shift | 0 | K §12.1 |
| **Corporate DSO** | — | ≤60 days | K §12.1 |
| **Pre-approval packs complete at first submission** | — | ≥95% | K §12.1 |
| **Clean claims** (CL-1) | Claims passing edits with no manual touch ÷ claims accepted | ≥85% (HFMA/PwC >85%; vendors claim 95–98%) | K §12.1; R05 §6.1 |
| Time-critical doses delayed by payment or counter rules | — | 0 | K §17 |
| Net days in A/R (FM-1) | Net patient A/R ÷ average daily net patient revenue | <40–50 days (estimate) | R05 §6.1 |
| DNFB days (PB-1) | Gross discharged-not-final-billed ÷ average daily gross revenue | ≤4 days | R05 §6.1 |
| FBNS days (PB-2) | Final-billed-not-submitted ÷ average daily gross revenue | <1–2 days (estimate) | R05 §6.1 |
| Initial denial rate (AR-5) | Claims denied ÷ claims remitted | US 11.6% (2025), reference only | R05 §6.1 |
| Final denial write-off (AR-6 variant) | Net denial write-offs ÷ net patient service revenue | US median 2.7%, reference only | R05 §6.1 |
| Aged A/R >90 days (AR-1) | Billed A/R >90 days ÷ total billed A/R | <15–20% (estimate) | R05 §6.1 |
| Cost to collect (FM-6) | Revenue-cycle cost ÷ patient cash collected | 2–4% (estimate) | R05 §6.1 |
| Cash collection (FM-2) | Patient cash ÷ average monthly net revenue | ≥100% (estimate) | R05 §6.1 |
| Net collection rate | Payments ÷ (charges − contractual adjustments) | 95–99% (estimate) | R05 §6.1 |
| Point-of-service collections (PA-7) | POS payments ÷ total self-pay cash | Market-dependent | R05 §6.1 |
| Verification rate (PA-2/3) | Verified encounters ÷ scheduled or registered | >95–98% (estimate) | R05 §6.1 |
| Scheme payment turnaround (P2) | Days from claim submission to payment | Tracked by scheme | R05 §6.1 |
| Payer decision time | Request → decision | Tracked as evidence (insurer obligation) | BP §12.1 |
| ALOS | Inpatient days ÷ discharges (excluding day cases) | Country-dependent | R05 §6.2 |
| Bed occupancy | Occupied ÷ available bed-days | ~85%; crises at ≥90% (Bagust) | R05 §6.2 |
| Bed turnover / turnover interval | Discharges ÷ average beds; (available − occupied bed-days) ÷ discharges | Context-specific | R05 §6.2 |
| Discharge before noon | % of departures before 12:00 | 25–40% (estimate) | R05 §6.2 |
| EVS bed turnaround | Dirty → clean/ready | <60 min (estimate) | R05 §6.2 |
| ED door-to-provider; LWBS; boarding | Median arrival → provider; left without being seen ÷ arrivals; admit decision → ED departure | <30 min; <2%; ≤4 h [K] | R05 §6.2 |
| OR first-case on-time; turnover; block utilisation; day-of-surgery cancellation | As named | ≥80–90%; 25–40 min; 75–85%; <2–5% (all estimates) | R05 §6.2 |
| 30-day readmission | Unplanned readmissions ÷ index discharges | Trend | R05 §6.2 |
| HPPD; FTE per adjusted occupied bed | Nursing hours ÷ patient days; FTEs ÷ (adjusted patient days ÷ days) | Med-surg 7–9, ICU 16–24; 4–7 (US) (estimates) | R05 §6.2 |
| PM completion, high-risk equipment (P2) | On-time PMs ÷ scheduled | 100% | R05 §6.2 |
| Transfer acceptance (P2) | Accepted ÷ requested; time to accept | Track declines by reason | R05 §6.2 |

Dropped for Kurdistan: CMI (needs DRG), the 835 auto-posting rate, US prior-auth timeframes, and BP's NPHIES/TPA-deduction targets.

## 9. R05 §9 implications: every item, with its Kurdistan disposition

**§9.1 Build natively vs integrate.** This split is the canonical native-vs-integrate position: "a clinical-operational ERP natively joined to clinical events, not a full ERP" (R05 §9.1; RL #3).

| # | Capability | R05 decision | Kurdistan disposition |
|---|---|---|---|
| 1 | Patient access (scheduling, registration/ADT, coverage, eligibility, authorisation) | Build native | MVP (K §4.3) |
| 2 | Patient financial ledger (accounts, charges, transactions, liability buckets, deposits, statements) | Build native | MVP, dual currency (K §8, §12.1) |
| 3 | CDM/tariff engine, packages, contract engine | Build native | MVP; contract engine does estimates and replay (K §12.1) |
| 4 | Coding workbench and CDI worklists | Native UI/workflow; AI coding engines via API | ICD-10 coding in R2.1; AI coding is P2 (P); CDI not scoped in K (K §4.2, §4.3) |
| 5 | DRG/case-mix groupers | Integrate via Grouper SPI | Out: no grouper (K §12.1) |
| 6 | Claim formats and national platforms | Native adapters; clearinghouses integrated | No national rail: document packs, FHIR Claim where accepted; federal scheme adapter in the Iraq pack (K §9.1, §4.2) |
| 7 | Denial and underpayment analytics | Build native | Denial root-cause queues in MVP (K §12.1) |
| 8 | Price transparency MRF/GFE | Native (US) | Out |
| 9 | GL, AP, fixed assets, HCM, payroll | Integrate (mature); lightweight finance for emerging markets | AP/AR and journal export in MVP; lite GL and fixed assets in P2; payroll/HCM always integrated (K §12.2) |
| 10 | Inventory, pharmacy stores, point-of-use, implants/UDI, consignment, recall | Build native | MVP (K §12.2) |
| 11 | Procurement (PR → PO → GRN → 3-way match) | Native "lite" (emerging) | MVP (K §12.2) |
| 12 | Biomedical CMMS | Native module | P2 (K §12.2) |
| 13 | Credentialing/privileging | Native enforcement; integrate credentialing systems | Native, MVP (K §12.2) |
| 14 | Rostering | Native basic plus acuity (emerging) | Basic rostering P2; acuity P3 (K §12.2, §4.3) |
| 15 | Bed management, EVS, transport, transfer centre, OR scheduling, OPD queues | Build native | Bed, OPD and OT in MVP; transfer centre in P2 (K §4.3) |
| 16 | Command centre | Native data layer plus tile UI; open APIs for predictive vendors | Command-centre data in P2 (K §11.1) |
| 17 | RTLS | Integrate (consume events) | Ingestion P2; engine never built (K §1, §4.3) |
| 18 | Cost accounting | Phase 2 native; capture from day 1 | P3 native; capture from day 1 (K §12.2) |
| 19 | Analytics/MIS | Native dashboards; lakehouse export; DHIS2/ADX | On-site replica and MIS in MVP; DHIS2 in R1.1; central CDC bronze landing (K §9.1, §11.1) |

**§9.2 Multi-country rules:**
1. Effective-dated, versioned country packs on one codebase. → One owned Kurdistan pack with a product manager (K §1 K-26; K §9.1).
2. FHIR financial API on R6-core resources plus national IGs. → No Kurdistan IG; FHIR Claim only where an insurer accepts it (K §9.1).
3. Rules and tariff engines with simulation. → The 3–6-month replay (K §12.1).
4. Classification abstraction with dual coding. → ICD-10 now, ICD-11 when adopted (K §12.1).
5. Multi-entity, multi-currency, multi-tax ledger from day 1. → The patient ledger is dual-currency in the MVP (K §8); the lite GL is P2 (K §12.2).
6. Resilience: multiple routes, offline queueing, idempotent submissions, message archives. → Generic. The Hub provides store-and-forward and replay (K §9).

**§9.3 MVP scope, emerging markets** (≈12 months of build; implementation adds 12–18 months; R05 §9.3 note):
1. Registration with national ID; sponsor selection. → Iraqi identity; self-pay, corporate, NGO or insurer; scheme in P2.
2. Tariffs, deposits, interim bills, discount approvals, refunds, cashier shift close, multi-mode payment. → MVP (§3).
3. Pre-auth and claims with attachments; national adapters. → Document packs; no national adapter.
4. Pharmacy and general stores; basic purchasing; vendor payables. → MVP.
5. Lightweight GL with automatic journals, tax/e-invoicing, accounting export. → Journal export in MVP; lite GL in P2; tax per Q-K6; e-invoicing out.
6. OPD queue; bed board with EVS status; non-blocking discharge clearance. → MVP plus SI-12.
7. MIS (revenue, payer mix, occupancy, receivables ageing, HMIS returns). → MIS basics and KRG returns (R1); DHIS2 (R1.1).

**§9.3 Mature markets** (coding/CDI, groupers, full claim lifecycle, underpayments, single billing office, US rails, enterprise ERP, UDI, CMMS, command centre, OR blocks, predictive discharge, costing). → Mostly out. Kept: ICD-10 coding, denial queues, contract engine, point-of-use and consignment (MVP), CMMS and command-centre data (P2), predictive discharge and costing (P3). Generic pattern kept: hospital and doctor fees on one account and one statement (R05 §1.10; K §12.1).

**§9.4 Sequencing.** Phase 0 still applies: canonical financial model, append-only ledger, effective-dating framework, rules/tariff engine, FHIR financial API, country-pack mechanism. Phases 1–3 (KSA + India, then grouper/ERP connectors/UDI/command centre, then US and Germany) are superseded by K's roadmap: Kurdistan, then federal Iraq from G4, with other markets decided at G5 (K §1 K-29). Kurdistan dates: wedge M22, Core HIS M27, hospital A M37 (K §1).

**R05 §8.3 pitfalls (anti-requirements):** separate hospital and doctor billing systems; CDM sprawl; hard-coded tariffs or country logic; no effective dating; mutable financial records; single-channel dependency; prior authorisation by fax and phone; ignoring the doctor side; over-promising autonomous AI coding; discharge-blocking bill clearance; line-level GL posting; a command centre built as a screen project (R05 §8.3 #1–#12).

## 10. Conflicts and ambiguities

1. **Lite GL timing:** emerging-market MVP in R05 §9.3 #5; P2 in K §12.2 and K §4.3, where the MVP only exports summarised journals.
2. **Corporate receivables:** R05 §3.1 places corporate contracts in ERP AR, while R05 §2.5 #5 needs corporate ageing in billing. K §12.2 resolves it: patient-related corporate AR stays in the HMS.
3. **Provider on charges:** R05 §7 (provider) vs R11 §11 (department only). Resolved by K §8: performing and ordering practitioner.
4. **Bill clearance:** R05 §2.5 #10 makes discharge gating "configurable", but SI-12 is vendor-locked (K §5.1; BP §5.1). Clearance can never gate discharge.
5. **Contract engine uses:** BP §12.1 includes expected-reimbursement variance; K §12.1 lists only estimates and replay.
6. **Inheritance of BP §12.1 bullets:** "applies to every pack" items (multi-route idempotent channels with archives; CI-tested code-set switches) are not restated in K §12.1, which K App. A marks "Changed". Unclear whether they are inherited.
7. **BP §12.2 vs K §12.2:** enterprise ERP connectors (BP P2) are absent from K; consignment moves from BP P2 to K MVP; rostering acuity (R05 §9.1, BP P2) becomes P3 (K §4.3).
8. **Package semantics:** overrun rules and the free revisit window are named but not defined (R05 §2.5 #3; K §12.1).
9. **Refund currency:** not specified; deposits are held in the tendered currency (K §12.1).
10. **Doctor-fee basis:** billed vs collected revenue is not specified in K §8. BP §12.1 (India) used collected revenue net of payer deductions.
11. **Procedure classification:** K names no procedure code system for insurer claims (CPT is out), but R05 §7's coding abstract includes procedures.
12. **EVS dispatch:** in R05 §9.3 #6's MVP; K names only the bed state machine and bed board (K §4.3).
13. **Clean-claim target:** ≥85% in K §12.1 vs ">85%, rising toward 95%" in BP §12.1.
14. **Open local questions that change the build:** USD pricing and deposits (L-33/Q-K19, M4); tax and receipt rules (Q-K6, M4); whether KRG drug price lists exist (L-32, M6); national insurance timing (Q-K13).
