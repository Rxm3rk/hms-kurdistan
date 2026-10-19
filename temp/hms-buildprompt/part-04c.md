
### 9.20 Revenue cycle core: accounts, ledger, charge router, tariffs and packages

**Release:** R1 (outpatient accounts, charges, tariffs, packages); R2a (inpatient accounts, running bills, discharge billing, OT billing). **Features:** `RCM-ACC-01` (XL) patient account and ledger; `RCM-CHG-01` (L) charge router; `RCM-TAR-01` (L) tariff engine; `OPS-FLW-01` (M, R2a) non-blocking discharge clearance. **Module:** `rcm` (Tier 0, a downstream conformist of clinical events). **Read:** R05 §1, §7, §8, §9; R11 §10.8, §11; K §12; BP §12.

**Principles (non-negotiable):** one patient account across clinical and financial domains; charges come from clinical events through the charge router and clinicians never type charges; an append-only double-entry ledger with reversal links and no in-place updates; everything effective-dated (prices, contracts, code sets, tax rates, edits); clinical truth kept separate from billing representation (bills, packages and claims are derived and can be regenerated); explicit liability transfer between payer and patient buckets; SI-12 at the boundary. Build the charge router early, "even for cash-only MVPs" (R11 §17 #6).

**Data model** (internal aggregates; FHIR only as an edge projection on R6-core payer resources): guarantor and guarantor account; encounter billing account (open, discharged-not-final-billed, billed, closed); coverage with priority order; pre-approval; estimate; charge item (charge code, service date, quantity, unit price from the price list, **performing and ordering practitioner, both mandatory**, local code, cost centre, source-event link, lot/UDI; statuses planned, billable, not-billable, aborted, billed, entered-in-error; override reason); price list; package; payer contract; coding abstract; claim and settlement; liability buckets with balances; financial transactions (charge, payment, adjustment by type, refund, transfer; GL mapping; reversal links; immutable, with functional-currency and original-currency amounts); deposits; patient payments; invoices and statements; denial work items; summarised GL journals; `Money`, exchange-rate table, cashier drawer and shift, and the doctor-fee ledger (K §8).

**Charge router:**
- Rules generate charge items from clinical events, with full traceability: order-driven (on result or verification), documentation-driven (MAR, nursing flowsheets, the OT record with implants, supplies and times), time-based (anaesthesia, OT minutes, observation hours, ventilator days), bed-days from location history, point-of-use GS1 scans, dietary extras. Manual entry is the exception and needs an override reason.
- `ChargeCreated` / `ChargeCredited` events map to HL7 DFT^P03/P11.
- Charge master (CDM): code, description, local code, price per price list, cost centre, GL revenue account, unit of measure, effective dates, statistical-unit flag. The item master carries a chargeable flag and a CDM link.
- **Daily reconciliation** of expected against captured charges by department; late charges (>3 days after service) flagged; an **unbilled-consumption** report (target ≤0.5% of consumption value at 90 days).

**Tariffs and contracts:**
- Price lists × room category × patient category × payer, with inheritance (a base list plus overrides) and effective dating. Types: general, corporate tiers, insurer-specific, international patient, staff, VIP. **IQD lists by default; USD lists behind a tenant setting that stays off until Q-K19 is answered.**
- A payer → plan → contract → terms registry. Contract methods: per diem, % of charges, fee schedule, packages, capitation, carve-outs, stop-loss/outlier, lesser-of logic, implants at invoice plus a percentage.
- One contract engine produces estimates and the **re-pricing replay**: before any tariff, package or payer rule goes live, re-price the last 3–6 months of encounters under the old and new rules; the revenue delta must be explained line by line, with zero unpriced services (K §12.1; R15 §8.2).
- Decision tables for price derivation, package logic, discount approvals, authorisation requirements and claim edits are versioned, simulated and effective-dated (non-device DMN, ADR-017).

**Packages:** fixed price with inclusions, exclusions, length-of-stay limits, room-category multipliers, implant pass-through, overrun rules, a free revisit window and doctor package-share rules; package coverage and leakage reports. The sources name overrun and revisit-window behaviour but do not define it: build both as configurable rules and log the semantics in `OPEN-QUESTIONS.md`.

**Running bill and inpatient billing (R2a):** a day-wise running bill shown against the estimate; room-class tariff multipliers; bed-day charges from location history; per-line payer / patient / non-payable split; discharge billing that never blocks the clinical discharge (financial clearance is separate, SI-12).

**Acceptance (minimum):**
1. Every charge links to a source clinical event and carries ordering and performing practitioners; a property test proves no charge exists without a source or an override reason.
2. The ledger is append-only: corrections are reversals (schema test plus property test).
3. Re-pricing replay on 3 months of synthetic encounters produces an explained delta and zero unpriced services.
4. No RCM state can block an ADT, order, discharge or MAR command (cross-boundary property test, SI-12).

### 9.21 Cashiering, deposits, refunds and dual currency

**Release:** R1; R2a (inpatient deposits and top-ups). **Features:** `KRI-RCM-01` (M) dual-currency cashiering; `RCM-CSH-01`; `KRI-PAY-01` (M) card-terminal and wallet adapters; `DFD-PAY-01` (payment links; wallet links in R1.1); `RCM-TAX-01` (re-scoped to Kurdistan receipt and tax rules). **Module:** `rcm` with the shell HAL for terminals. **Read:** K §8, §12.1; R05 §2.5; R16 §7.

**Build:**
- **Deposits:** set by package or bed category; held in the tendered currency; top-up alerts when the running bill crosses a threshold; transfers between encounters or family members under approval; refund of the unused balance at discharge, reconciled against the final bill; payment links for deposits and top-ups. **No deposit rule can block an ED registration, an emergency order, a discharge order or a time-critical dose** (SI-12; deposits before elective admission remain hospital policy [L]).
- **Estimates:** written, with validity, patient share and separate surgeon and anaesthetist fee lines; variance against actuals tracked.
- **Cashier shifts:** open with a float → transactions by tender (cash, card, wallet, cheque, credit) → close with a **denomination count per currency** → variance approval → handover to the main cash office. Target drawer variance: 0 per currency per shift.
- **Dual currency:** IQD price lists by default; payment in either currency at the posted rate from the effective-dated exchange-rate table (source and timestamp); change given in either currency; cash rounding per tenant (for example to IQD 250 [L]); each payment records tendered currency, amount, rate and change given; the ledger runs in the functional currency with original amounts kept and FX differences posted to the GL export; reconciliation "to the dinar".
- **Discounts, charity and waivers:** approval thresholds by role, amount and percentage; charity or Zakat funds; staff and VIP price lists; reason, approver and policy on every adjustment; audit reports; bad debt and charity tracked separately.
- **Refunds:** to the original instrument where possible; cash refunds need approval thresholds; refund currency is configurable (record the policy question).
- **Receipts:** trilingual; tax lines from a configurable tax engine. Zero rate is a development default only; the live treatment is configured from the tax-counsel opinion required before R1 (Q-K6).
- **Payments:** semi-integrated card terminals through the shell HAL or the cell: the HMS sends amount, reference and type and receives approved/declined, auth code, masked PAN, token and scheme. **No card number ever touches the HMS.** Wallet and QR payment links (R1.1) confirmed by webhook plus status polling, with a static-QR fallback reconciled manually. **Three-way reconciliation** of HMS receipts, terminal batch reports and acquirer or wallet settlement files, with unmatched items in a work queue. During downtime terminals run standalone and references are back-entered into the reconciliation queue; care is never blocked by payment capture.
- **Credit patients and guarantors:** a guarantor (person or organisation) with credit status; payment plans; statements by SMS or print.

**Acceptance (minimum):** a shift cannot close until every currency's count is entered and any variance is approved; a cash-drawer and dual-currency reconciliation drill passes (an RG3 item); the exchange rate used on every payment is the one effective at that instant; no PAN appears anywhere in the database, logs or traces (scanner test).

### 9.22 Doctor fees and payouts

**Release:** R1. **Feature:** `KRI-RCM-02` (M). **Module:** `rcm`, exported through `finance-export`. **Read:** K §8, §12.1.

**Build:** surgeon, anaesthetist and consultant fees as separate charge lines carrying the performing practitioner; package-share rules; payout rules per practitioner and service (percentage, fixed or package share), with the basis (billed or collected, net of payer deductions) configurable per rule because the sources leave it open; a payable sub-ledger per practitioner; settlement cycles and statements; settlement at the cashier where the hospital pays that way; export to accounts payable. **Payables, never payroll. No referral-commission feature of any kind.**

**Acceptance:** each payout statement reconciles to the charge lines that produced it; reversing a charge reverses its fee accrual; there is no data field, rule type or report that pays a referrer.

### 9.23 Corporate, NGO and insurer credit; pre-approvals; claims

**Release:** R1 (manual document packs); R1.1 (document-pack automation); P2 (scheme adapters; AI document-pack assembly). **Features:** `RCM-INS-01` (L; corporate, NGO and insurer credit; document-pack claims); `RCM-DEN-01` (M) denial and rejection queues; `RCM-SCH-01` (corporate credit in the MVP; its government-scheme part in P2); P2 `AI-RCM-01` claim scrubbing. **Module:** `rcm` with a `WorkflowPort` workflow for pre-approval and claims. **Read:** R05 §1.2, §1.8; R11 §10.8; R13 §3.7–§3.8; K §9.1, §12.1.

**Build:**
- **Contracts:** price list per contract; eligibility letters (captured, since there is no eligibility rail); credit limits; co-pay; per-line payer / patient / non-payable splits; deduction-reason codes.
- **Pre-approval** as a first-class entity linked to orders, scheduled procedures, coverage, units, validity dates and payer reference, checked again at claim build. SLA timers pause while a payer query is open; escalation goes to the corporate/insurer desk, never to clinicians; a pre-approval never blocks discharge or emergency care.
- **Credit-claim states:** Intimation → PreApprovalRequested (documents, ICD-10 diagnosis, proposed procedure, estimate, room category) → Query ⇄ QueryResponse (repeatable, clock paused) → PreApprovalApproved (amount, room-rent cap, co-pay, sub-limits) → EnhancementRequested → EnhancementApproved (repeatable) → DischargeAuthRequested (final bill, discharge summary, investigations, pharmacy returns) → FinalApproved (payer-payable, deductions, patient-payable) → ClaimDocsSubmitted → Settled / PartiallySettled / Denied → Reconciliation / Appeal. The generic claim machine (draft → scrubbed → submitted → acknowledged → adjudicated → appealed or resubmitted → closed) sits underneath.
- **Document packs:** PDF plus a structured summary, sent by email or portal; FHIR Claim only where an insurer can accept it. Pack completeness at first submission is tracked (target ≥95%).
- **Statements and receivables:** monthly statements per corporate account; ageing; patient-related corporate receivables in the HMS sub-ledger; corporate DSO tracked (target ≤60 days).
- **Denials:** root-cause queues by category (eligibility, authorisation, coding, medical necessity, timely filing, duplicate, bundling, clinical validation) with SLA timers and appeal templates; root causes feed registration, pre-approval rules and documentation.
- **Scheme abstraction (P2):** one "scheme" object (package master, eligibility check, pre-auth workflow, document checklist, claim format, rate master) plugged in as configuration, ready for national health insurance (Law No. 22 of 2020 [L]); the federal adapter belongs to the Iraq pack.

**Acceptance:** the credit-claim state machine is specified (§8.4), property-tested and approved [HUMAN, by M9 in the business plan]; a pre-approval query pauses and resumes its SLA clock correctly across weekends and holidays; a claim cannot be built for a line outside its pre-approval without a flagged exception.

### 9.24 Clinical coding

**Release:** R2.1 (a manual coding sheet until then). **Features:** `RCM-COD-01` (M; re-scoped to WHO ICD-10; no IHACPA or CPT licences); P2 `RCM-AI-01` AI coding suggestions; P3 `RCM-CST-01` patient-level costing. **Read:** R05 §1.5; K §8, §12.1.

**Build:** a coding workbench on WHO ICD-10 (commercial use needs WHO permission [HUMAN]) with ICD-11 dual coding ready if the KRG adopts it; diagnoses sequenced; code-set versions effective-dated by date of service; never a single "the diagnosis" column; audit sampling and an edit check before final. Procedure classification for insurer claims is unresolved (no CPT): use the local procedure codes of the order catalogue until a decision is logged. AI coding suggestions are P2 from a partner.

### 9.25 Supply chain, stores and procurement

**Release:** R1 (pharmacy and lab stores, consumption-to-charge, controlled-drug registers); R2a (ward stock, OT implants and consumables); R2.1 (procurement-lite breadth, AP/AR); P2 (lite GL, fixed assets, CMMS, CSSD-lite). **Features:** `ERP-INV-01` (L, R1) item master, stores, FEFO, indents, ward stock, consumption-to-charge; `ERP-FIN-01` (M, R1; breadth R2.1) AP/AR and GL export; `ERP-PRC-01` (M, R2.1) procurement-lite; `SPC-OT-03` (R2a) OT implants and consumables to charge and stock. P2: `ERP-IMP-01` implant/UDI capture and recall trace (its consignment bill-only purchase order is pulled into R2.1 with procurement-lite, per K §12.2), `ERP-FIN-02` lite GL and fixed assets, `ERP-FIN-03` enterprise ERP connectors, `ERP-HTM-01` CMMS, `ERP-SVC-01` support services including CSSD-lite, `ERP-HR-02` payroll integration. **Modules:** `supply`, `finance-export`. **Read:** R05 §3; R11 §12; K §12.2.

**Build:**
- **Item master:** code, GTIN, UDI-DI, unit-of-measure conversions (box → each), category, chargeable flag and CDM link, implant flag, lot and serial tracking, storage conditions. Pharmacy items link to the regional brand master.
- **Stock:** store, bin, lot, serial, expiry, quantity, consignment flag; requisitions and transfers with approval; FEFO picking; near-expiry alerts; quarantine of expired or excursion-affected stock (fridge temperature excursions from building signals quarantine vaccine lots and blood units); ward par levels; pharmacy stores with separate ledgers and permissions.
- **Point-of-use capture:** one GS1 scan in the OT documents usage, decrements stock, triggers replenishment and creates the charge.
- **Implants and recall:** UDI-DI plus UDI-PI (lot, serial, expiry) linked to patient, procedure and charge, with recall status. The recall workflow (search by GTIN and lot → locate stock → quarantine → identify affected patients → notify clinicians) is P2 (`ERP-IMP-01`); UDI capture on the intra-op record (SAC-40, `SPC-OT-03`) is MVP, so the data for recall exists from day one.
- **Consignment:** a bill-only purchase order raised on use.
- **Procurement-lite:** requisition → approval with budget check → purchase order → goods receipt → vendor invoice → three-way match within tolerances → payment.
- **Finance export:** accounts payable and patient receivables; **daily summarised GL journals** (revenue by cost centre and payer class, contractual adjustments, cash, bad debt, charity, FX differences) by CSV or API with drill-back, never line-level; a cost-centre hierarchy.
- **Costing data captured from day one:** resource IDs, start and stop timestamps and consumed lots on clinical events (costing itself is P3).
- **Payroll, HCM and time and attendance are always integrated, never built.**

**Acceptance:** an OT implant scan creates the implant record, the stock movement and the charge in one transaction; FEFO picking is enforced; the daily GL journal reconciles to the ledger to the dinar; from P2 (`ERP-IMP-01`), a recall finds every patient who received an affected lot.

### 9.26 Workforce, credentialing and privileges

**Release:** R1 (needed for ordering, charging and fees); P2 rostering. **Features:** `ERP-HR-01` (M, R1) staff master with credentialing and privileging records; `TRU-IAM-02` privilege-gated clinical actions; P2 `ERP-ROS-01` rostering and `ERP-HR-02` payroll/HR integration; P3 `NUR-STF-01` acuity-based staffing. **Module:** `workforce`. **Read:** R05 §3.5; K §8, §12.2.

**Build:** the staff master with typed practitioner identifiers [L] (syndicate number, KRG or federal practice licence, board certificates), each with period and assigner; primary-source verification records; expiry alerts and an automatic block from scheduling and ordering when a licence expires; delineated privileges per procedure and per hospital; **privilege checks gate order entry and OT booking**; competencies; the visiting-consultant flag; role and unit assignment feeding care-team assignment (ADR-024). Basic rostering (self-scheduling, float pool, on-call, skill mix) in P2; acuity-based staffing in P3.

**Acceptance:** an order or OT booking by a practitioner without the needed privilege is refused with a clear reason; an expired licence blocks new orders immediately and raises a task to medical administration.

### 9.31 MIS, dashboards and reporting

**Release:** R1 (MIS basics, owner dashboard); R1.1 (MIS breadth); P2 command-centre data. **Features:** `OPS-MIS-01` (M), `AI-DAT-01` (M) reporting replica and report builder, `AI-DAT-02a` (M) central CDC bronze landing; P2 `OPS-CMD-01`, `AI-DAT-02b`. **Module:** `analytics` on the reporting replica. **Read:** R05 §5; K §6.1, §11.1.

**Build:**
- **One indicator catalogue** drives dashboards, accreditation measures and statutory returns: each indicator has a definition, numerator and denominator, data source, period, disaggregations and target.
- **The owner's daily dashboard:** revenue and collections by currency; unbilled consumption (leakage); deposits outstanding; corporate receivables; occupancy; safety KPIs.
- MIS basics: daily revenue and collections, payer mix (self-pay, corporate, NGO, insurer), occupancy and ALOS, receivables ageing, statutory returns; departmental P&L and productivity in R1.1.
- A report builder on the replica, with row-level security by facility, department and role; exports audited and watermarked.

**Acceptance:** every dashboard figure reconciles to the ledger or the clinical record for the same period; dashboards render from the replica without touching the transactional database.
