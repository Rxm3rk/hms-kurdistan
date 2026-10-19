# Digest 03: Verification, clinical safety engineering, migration and go-live

**Sources:** R15 (all); R03 §19, §21; BP §5.1–§5.5 (+ baselines from §6.7–§6.8, §7.5, §7.10–§7.12, §13.3–§13.5); K §5, §13.3–§13.5 (+ K-01…K-30, §4, §6–§8, §9.2–§9.3, §10, §13.1–§13.2, §13.6, §15.4, App. A–B); RL #6, #11.

**Legend:** **KRI** = Kurdistan delta (K wins) · **DROPPED** = removed by the deltas · **generic pattern** = kept as a pattern only · [E] source estimate · [L] K local assumption · ⚠ ambiguity or conflict.

---

## 1. QMS obligations that touch the codebase

### 1.1 System and tiers
- **One management system:** quality and security, whole company, from M0, built to ISO 13485 practice plus ISO 27001. No "13485 island": the shared rules engine, terminology, EMPI, audit, UI shell and printing would otherwise become SOUP re-qualified each release (R15 §2.1; K-04).
- **KRI certification:** ISO 27001 by ≈M24; ISO 13485 certification deferred to G5 or a local rule, records export-ready; CE not a precondition (K §5.4, §9.3; K-05).
- **Standards kept:** IEC 62304:2006+A1:2015 mapped onto Ed. 2 Levels I/II (forecast 26 Oct 2028); ISO 14971; IEC 62366-1; IEC 82304-1; IEC 81001-5-1; annual external safety-management audit (R15 §2.2, §6.3; K §5.4).

| Tier | Scope | Rigour (R15 §2.1; BP §5.4) |
|---|---|---|
| 0 | Billing, ERP, HR, BI | Standard SDLC; 27001 controls |
| 1 | ADT/EMPI, CPOE, eMAR/BCMA, results routing, documentation, downtime, billing that affects care | DCB0129-style hazard log; safety case per release; CSO sign-off; 62304 Class B-equivalent process; IEC 82304-1 |
| 2 | NEWS2/PEWS/MEOWS, Dose Engine, screening presenter, T2 transfusion verification, LIS interpretive rules; later sepsis and pumps (K-06) | Full design controls; 14971 and 62366-1 files; 62304 Class B or C; post-market surveillance. **KRI:** no submissions; activation by K-05 |

### 1.2 IEC 62304 class per module (R15 §2.3)
Class C = a failure could still contribute to death or serious injury after the external controls act.

| Module | Tier | Class (Ed. 2) | External controls | KRI |
|---|---|---|---|---|
| ADT, EMPI merge/unmerge | 1 | B (II) | HIM steward queue; reversible merges | R1 |
| CPOE and order lifecycle | 1 | B (II) | Pharmacist verification; result-closure tracking | R2b |
| eMAR/BCMA | 1 | B (II) | Wristband + product barcode; nurse judgement | R2b |
| DDI/allergy/dose-range | 2 EU / 1 US | B (II) | Pharmacist verification; KB vendor's controls | Presenter Tier 2; KB verbatim |
| Weight/BSA dose calculators | 2 | **C** | Double check often absent at 03:00; 10× errors lethal | Dose Engine P2 (≈M50) |
| NEWS2/PEWS + escalation | 2 | B (II) | Nurse observation; manual escalation | R2b, non-ICU, if the Register allows |
| Sepsis rules | 2 | B; C if it places autonomous orders | Clinician review | P2 (K-07) |
| Bedside transfusion verification | 2 | **C** | Two-person check is the only other barrier | R2b (T2) |
| Compatibility/release engine | 2 (IVD) | **C** | Serology QC | Never built |
| Pump autoprogramming | 1 or 2 | C-rigour | Pump DERS; confirmation at the pump | P2 |
| Alarm forwarding | — | Not built | — | Never |
| AI scribe/summaries | 1 (2 if it suggests diagnoses) | B (II) | Mandatory sign-off | P2 |
| ED triage AI | 2 | C (II) | Defer and partner | P3, partner |

Tier 0 (billing, ERP, HR, BI): n/a (A-like).

⚠ K §5.4 says "Class C for Tier 2". R15 §2.3 puts NEWS2, DDI and sepsis at Class B; BP §5.4 says "B or C".

### 1.3 Device boundary in code (BP §5.5; K §5.5)
- **Decomposition.** The 62304 decomposition separates the Tier 1 Safety Kernel (orders, medications, MAR, results, tasks) from Tier 2. A class-propagation analysis keeps the kernel at Class B.
- **Tier 2 module:** process-isolated sidecar on the same node; pure-function, schema-versioned API; on timeout returns "unavailable, manual check required", never "pass"; own SBOM, SOUP list and release train.
- **Regulated display:** Tier 2-owned, versioned UI components with a render-integrity check (output hash vs drawn value); CPOE and MAR host them but never compute or reformat regulated values; escalation tasks only via a narrow, versioned task API inside Tier 2 verification.
- **No rules engine in the boundary.** Native, guideline-verbatim calculators with 100% boundary-value tests. CQL only for measures, KPIs and non-device CDS.
- **CI static analysis** fails the build on dose arithmetic outside the Dose Engine (SI-05). BCMA delegates its dose maths to the engine (R15 §4.2e).
- **Minimum-class intended purpose.** NEWS2 "calculates and displays the score and components from nurse-validated discrete observations on non-ICU wards … and creates escalation tasks according to the hospital's configured policy". Never "detects" or "predicts" (R15 §5.1).
- **AI documentation SKU (P2).** Classifiers block diagnosis and treatment suggestions (R15 §4.2j; K §5.7).
- ⚠ BP's notified-body feedback on segregation (by M6) is not restated in K §5.5.

### 1.4 Boundary Register and fallbacks
- **The Register** holds function × market × intended purpose × class × status (cleared / not required / pending); Tier 2 activates only on "cleared" or "not required"; toggles cannot override it (R15 §11 #2; SI-18).
- **KRI activation needs all four (K-05):** (1) a written local opinion (KRG Ministry of Health + counsel) or a registration; (2) our safety case; (3) hospital clinical-governance sign-off; (4) independent-assessor concurrence for the first activation of each function and each major version at any customer (every activation at customers #1–3).
- **Opinion records:** scope stored (function, intended purpose, version, jurisdiction); expiry after 24 months or on any change; federal sites need a federal MoH opinion; liability cover names each unregistered function; opinions due by M9 (S16-K).
- **Every Tier 2 function has a pre-built, tested fallback** at first go-live (K §5.6):

| Function | Fallback |
|---|---|
| NEWS2/PEWS/MEOWS | Electronic charting; nurse-calculated score; nurse-assigned escalation; **frequency set by the nurse, never by a score** |
| Dose Engine (P2) | 1. A system-enforced independent pharmacist double check on every weight/BSA dose (any age), high-alert infusion and neonatal order.<br>2. KB ≥10× the maximum = Tier A hard stop; KB output verbatim; no local arithmetic.<br>3. Seeded adult and paediatric 10× and unit errors in every integrated test cycle.<br>4. An alarm if no pharmacist is in the queue for >30 min; review within 4 h of any pre-verification dose.<br>5. Core sites apply item 1 at transcription.<br>6. 24×7 pharmacist cover [L] (RG1).<br>**Activation:** C2 with ≥4 weeks of pharmacist-only shadow; the NICU double check is kept for 3 months |
| Screening presenter | KB results verbatim; needs the vendor's written regulatory position |
| T2 transfusion | Scripted two-person check: identifiers side by side; both e-signatures; no automated pass/fail; the witness confirms the unit number on the original label |
| LIS autoverification (R1.1) | Manual validation; delta and critical rules as flags |
| Sweep items (VTE, Braden/Morse, critical-result escalation, viewer) | Clinician-chosen prompts; viewer non-diagnostic |
| Sepsis (P2) | Pathway clocks and a non-scoring checklist |
| Pumps (P2) | Manual programming with a BCMA scan |
| AI documentation (P2) | Manual documentation |

### 1.5 Files engineering must produce (R15 §2.4)

- **ISO 14971 risk file, per product family:** plan and acceptability policy (5×5 severity × likelihood, as DCB0129); top-down hazard analysis (wrong patient; wrong drug/dose/route/time; missed or late result; delayed escalation; data loss or corruption; unavailability; wrong blood; alarm not delivered; AI hallucination accepted); FMEA per module; trace matrix; residual-risk evaluation; benefit-risk statement; post-production inputs (complaints, telemetry, incidents); AI annex (data shift, automation bias, hallucination, post-update degradation; ISO/IEC 23894, AAMI/BSI 34971).
- **Seeded hazards** (BP §5.1; K §5.1): H1 wrong patient · H2 wrong drug/dose/route/time · H3 missed or late result · H4 delayed escalation · H5 orphaned work · H6 data loss · H7 unavailability · H8 wrong blood · H9 alarm not delivered · H10 AI error accepted · H11 cutover double dose · H12 overlay · H13 privacy egress · H14 labelled-record disclosure · H15 seam failure. **KRI H14 labels:** HIV, mental health, reproductive/sexual health, GBV, forensic/MLC, VIP; PCPNDT and MTP DROPPED.
- **IEC 62366-1 usability file:** use specification (KRI: Kurdish-, Arabic- and English-first groups); safety-related UI characteristics; known use problems (VA "unknown queue", Helseplattformen letters, BCMA workarounds; K §13.6: Apotti menu → pick-lists are critical tasks, Sundhedsplatformen untranslated content); hazard-related scenarios; formative evaluations; summative protocol and report.
- **IEC 81001-5-1 security file:** STRIDE/LINDDUN threat models; SBOM + VEX; vulnerability handling and public disclosure policy; security verification evidence; patch timelines (KRI: exploited flaws ≤7 days central, ≤14 days on site; pen test by M14, then annual; K §9.3, §10). FDA §524B/EU CRA = generic pattern.

---

## 2. Hazard-log tooling and safety-case operations

### 2.1 Operating model (R15 §6.1, §6.3; K §5.3)
- **One hazard log** feeds DCB0129 (Tier 1), the 14971 files (Tier 2) and a DCB0160-style deployment case per hospital.
- **Required:** risk management system and plan; named, trained CSO (registered clinician); hazard log; safety case report per release or deployment.
- **KRI roles:** Chief CSO and Head of QA by M3; pharmacist CSO M9; nursing CSO M24; lab informaticist covers lab/transfusion; squad safety champions; 90-day safety officer per go-live; trained customer CSO named in the contract.
- **Safety Board:** weekly, release veto; any engineer may pull the andon; a system-attributable sentinel event freezes new go-lives until its CAPA closes; joint attribution panel (our Chief CSO, customer CSO, external reviewer).

### 2.2 Hazard Log service (R15 §6.2; BP §5.3 TRU-REG-02)
- **A product service with an API**, not a spreadsheet.
- **Fields:** ID; title; clinical context; causes; effect; harm; initial severity × likelihood; risk rating; controls (typed design / test / training / labelling / deployment, each linked to a requirement or story); verification evidence (test IDs, runs); residual risk; status; owner; CSO approval; markets; modules.
- **Workflow:** mandatory "clinical safety impact" field (none / possible / yes) on every story and bug; possible/yes → CSO triage within 2 working days [E]; safety bugs share the severity scale. **KRI:** >10% late triages in a month pauses C1/C2 promotion (K §5.3).
- **CI/CD gates:** no promotion while any story linked to an open hazard control lacks passing verification; no Tier 2 promotion without a signed regulatory impact assessment.
- **Per release:** a CSO-signed Clinical Safety Case Report and hazard-log delta, with a customer extract (KRI: per hospital).
- **Deployment-hazard templates:** order-set and CDS configuration; interface mapping; printer and label set-up; device association; downtime readiness.
- **Coverage:** content bundles carry hazard links (R15 §8.1). Each R03 §19 and R11 §15 item gets a hazard ID and an acceptance test (§14).
- **Timing:** the service and the evidence-pack generator ship before the first pilot customer (R15 §11 #8).

### 2.3 Safety events and post-market surveillance (R15 §6.4–§6.6; K §5.3)
- **One Safety Event pipeline:** safety tickets; telemetry anomalies (e.g., orphaned orders >0); AI events; security incidents with clinical impact; regulatory reports.
- **Contract terms:** FSN-format notices within 24 h; public known-anomalies list; kill switch per rule and flag (SI-19); shared hazard log; safety case per release; annual Safety Performance Report.
- **KRI vigilance:** no software route known [L]; voluntary PMS with an annual PSUR-style report per Tier 2 module; notify the KRG MoH if a channel exists (Q-K4). EU/FDA/SFDA/CDSCO/EDE timelines DROPPED.
- **PMS inputs:** override rate and PPV per rule; retract-and-reorder; orphaned work; BCMA and autoprogramming compliance; NEWS2 escalation response; AI edit distance and rejection rate; complaint trends; SOUP/partner recalls; benefit-risk review. First report 12 months after activation (BP §5.3).
- **AI events (P2):** one-click "Report AI issue"; auto-capture of model, version, prompt template, sources, output diff; de-identified export (PSO format = generic pattern); monthly review by model owner and CSO.

### 2.4 Release Evidence Pack (R15 §8.3)
One per release and market (KRI: per hospital):
1. release notes and known anomalies;
2. the hazard-log delta and safety case report;
3. a trace extract and test summary (Leapfrog, scenarios);
4. performance and DR results;
5. the SBOM/VEX with vulnerability status, and a pen-test summary;
6. a usability summary for UI changes;
7. the regulatory impact assessment;
8. flag defaults per tenant.

---

## 3. Traceability (R15 §7.1)
- **Chain:** user need → requirement → hazard(s) → risk control(s) → verification test(s) → validation evidence → release.
- **Links** sit in the hazard-log service and the requirements tool. Tests carry requirement and hazard IDs; CI publishes results with them.
- **The matrix is generated,** never hand-maintained. The same graph yields technical documentation (FDA and MDR formats are a generic pattern; KRI: export-ready).
- **Each SI** has a hazard entry, state-machine property tests and a nightly scenario suite. SIs are vendor-locked: tenants may only tighten them (BP §5.1; K §5.1).
- **Clinical time stamps** are first-class events, never inferred from notes (R03 §21.3 #8).

---

## 4. Test portfolio (R15 §7.2, with KRI)

| Layer | Scope / tool | Gate | Evidence |
|---|---|---|---|
| Unit + property | **State machines:** orders, MAR doses, encounters, specimens, beds, claims.<br>**Invariants:** "no administration without active verified order or documented override", "every order reaches a terminal state", "merge is reversible".<br>**Generators:** random, out-of-order and duplicate events. R11 §15 is the property list | Every commit | Invariant coverage |
| Module + contract | Modulith-style module tests; consumer-driven REST and event contracts; an HL7 v2 profile per interface (structure, cardinality, vocabulary) with NIST-style tooling | Every merge | Conformance report per interface |
| FHIR | HL7 validator against pinned IGs; Inferno where relevant. **KRI:** US Core, `ndhm.in`, `nphies-fs` and UK Core DROPPED; validate R4, IPS `$summary` and the KRG return bundle | Every merge | Report per artefact |
| Scenarios | §5 | Nightly; pre-release | Pass matrix → hazards |
| National sandboxes | DROPPED. **KRI:** KRG return formats tested at RG4 | — | — |
| Performance | **KRI:** the 300-bed day on the reference cell from M9; the 1,000-bed day on the pooled tier from M12 | Weekly; any p95 regression blocks | Load report vs SLOs |
| Resilience | Chaos, DR, downtime and BCA drills (§7) | Monthly; quarterly DR | Measured RTO/RPO |
| Security | SAST/DAST/SCA; SBOM diff; annual pen test; pre-release pen test for Tier 2 changes (WASA/CERT-In DROPPED) | Per release; annual | Pen-test summary |
| Usability | Formative every sprint with a clinician panel (BP §6.8); summative per §8 | Before a feature's first release; after any significant UI change | IEC 62366 report in NISTIR 7742 format |
| L10n / RTL / accessibility | §9 | Per release | Pseudo-locale and RTL diffs; WCAG 2.2 AA audit |
| Migration / UAT | Mocks (§12) / UAT kit (§11.4) | Per customer / each go-live and upgrade | Reconciliation pack / signed UAT + DCB0160-style case |
| **KRI:** topology + egress | The same signed artefacts on the 3-node k3s/RKE2 reference cell and the central substrate (K §7.1 r5); no usable PHI leaves the cell (SI-20) | CI from M9; every release | Conformance and egress reports |
| **KRI:** integrated cycles | Three on complete scope (two for Core): Leapfrog/ISMP on customer content, analyzer parallel run, a dress rehearsal per device class (K §13.2) | Per project | Cycle reports |

---

## 5. Clinical scenario suites (R15 §7.3)
These are nightly release gates. Over-alerting fails the build like a missed alert (R15 §11 #10).

1. **Leapfrog CPOE harness:** all 8 categories incl. Excessive Alerts, after every KB or CDS update. **Pass:** ≥60% of serious-error scenarios caught **and** zero interruptive alerts on the "should not alert" set [E]. **KRI:** our test set without a local scheme, run on customer content (K-10); budgets Tier A ≤20 rules, Tier B ≤8 interruptive per 100 medication orders at go-live and ≤5 by month 12 (K §6.3). Minimal interruptive set: Level 1 DDIs, true severe allergies, high-alert dose limits, fatal routes (R03 §21.3 #1).
2. **ISMP:** weekly methotrexate; minibag vincristine; opioid tolerance; metric-only weights; 10× decimal errors; look-alike/sound-alike drugs; concentration standardisation; insulin and heparin protocols. **KRI:** seeded 10× and unit errors in every integrated cycle.
3. **Closed-loop medication:** prescribe → verify → dispense (ADC profile) → BCMA → pump order. Failures: wrong patient; wrong drug; expired; dose out of range; discontinued in transit; offline administration on a stale order; PRN double dose at shift change; cutover "last given" carry-over. **KRI:** ADC and pump steps P2; suites also cover the SI-12 extensions (no payment rule delays a time-critical dose; unverified patient-supplied medicine cannot be scanned).
4. **Transfusion:** consent → bedside-labelled sample (WBIT detection) → request → issue → two-person bedside check → vitals timers → reaction → haemovigilance, with a mismatch injected at each step. **KRI relabel at receipt:** blind two-person double entry from the original label and issue note; original never covered; mismatch quarantines the unit; relabel errors = 0.
5. **Results closure.** Critical value → named recipient → escalation; a discharged patient's result; an amended result. **KRI:** external referrers.
6. **Identity.** Newborn naming; trauma alias; merge/unmerge with downstream notification; similar-name alerts. **KRI:** cross-script cases.
7. **Downtime.** Read-only BCA; pre-allocated IDs; back-entry with original times. **KRI:** cell loss, WAN cut, power cut.
8. **Deterioration.** NEWS2 boundaries 0 / 1–4 / single 3 / 5–6 / ≥7; SpO₂ Scale 2; escalation timers. **KRI:** PEWS and MEOWS, only where the Register allows.

---

## 6. Performance and the ADR-001 spike

### 6.1 The "1,000-bed day" (R15 §7.4; BP §7.5, §7.12) [E]

| Dimension | Per day |
|---|---|
| Census and arrivals | ≈1,000 inpatients; 3,000 OPD visits; 300 ED arrivals |
| Throughput | ≈20,000 orders; 25,000 administrations; 15,000 results |
| Profile | Vitals every 4 h; a 07:00–09:00 peak at 3× average concurrency |
| Interfaces | ≈300,000 HL7/FHIR messages; 2 years of history preloaded |

- **Gate:** p95 budgets (R08 §12.6), regression blocks release; re-run at each customer's sizing before go-live; load at 3× the largest customer.
- ⚠ **Start date.** R15 and BP say CI from month 6. K §7.11 runs the 300-bed day in CI from M9 and the 1,000-bed day on the pooled tier from M12. K governs.

### 6.2 The Kurdistan 300-bed day (K §7.4, §7.8, §7.10–§7.11)
- **Reference cell:** three nodes (e.g., 3 × 32 cores, 128 GB, NVMe) with every component running: core; PostgreSQL with synchronous standby; Kafka KRaft (three co-located brokers); Temporal; Keycloak; Integration Hub; print, queue and device bridge; reporting replica; terminology and drug-KB snapshots.
- **C9 pass:** "p95 targets met at ≤60% CPU and memory headroom on the reference hardware". ⚠ Ambiguous (≤60% utilisation or 60% headroom?). ⚠ No daily volumes are given.
- **Sizing:** 300 beds, 800 sessions (an MVH-100 needs 80–150). RG2 re-runs the test at customer sizing on the installed cell.
- **Cell SLOs (K §7.10, which replaces BP's NFR table):** BFF p95/p99 300/800 ms; warm screen 1.0 s and cold chart 1.5 s p95; patient search 200 ms; order sign with CDS 1.5 s; BCMA 500 ms; HL7 end to end p95 ≤5 s, zero silent drops, alarm at >5 min unacknowledged; orphaned work 0, alarm within 5 min.
- **Reopen triggers:** patient search p95 >200 ms reopens ADR-028; a C9 failure brings NATS JetStream and lighter workflow persistence before ADR-001 reopens (ADR-009/010).

### 6.3 ADR-001 spike (K §7.4)
- **Shape:** M0–M2, 8 weeks, two teams of three (≈12 PM; BP had 16).
- **Workloads:** the 1,000-bed day for C1–C3; the 300-bed day for C9. C6 and C7 run at M4–M6.

| # | Criterion | Weight K (BP) | Pass |
|---|---|---|---|
| C1 | Atomic order-sign: order + CDS override + verification task + MAR schedule + charge | 15 (15) | p95 ≤300 ms at 3× peak |
| C2 | Invariants under 10⁶ randomised command sequences, incl. offline-BCMA conflict replays | 25 (25) | **Zero violations (hard gate)** |
| C3 | Bitemporal "what did the clinician see at 09:12", 30-day chart | 10 (10) | p95 ≤1.5 s |
| C4 | FHIR R4 read/search over the projection | 5 (10) | p95 ≤300 ms; lag p99 ≤5 s |
| C5 | R4→R6 cost from unchanged storage | 10 (15) | ≤15 engineer-days; no storage migration |
| C6 | IPS `$summary` + KRG return bundle from the same facts | 5 (10) | 100% validator conformance |
| C7 | PITR of a 5-year, 150-bed tenant on on-site hardware | 10 (5) | ≤4 h |
| C8 | Add a clinical fact type end to end | 15 (10) | ≤3 days |
| C9 | 300-bed day on a three-node cell, all components | 5 (new) | §6.2 |

- **Decision rule:** A by default; B only if it passes C2 and beats A by ≥15 weighted points; repository abstraction stays; freeze at M3; if C2 fails for both, redesign the order/MAR boundary.
- **S9-K (M4–M6):** re-runs C2 and C9 on the real cell with power and WAN cuts injected; tests the offline-BCMA conflict model; compares Kafka with NATS.

---

## 7. Chaos, DR and downtime drills

| Cadence | R15 §7.5 | KRI (K §7.9, §13.3) |
|---|---|---|
| Monthly | Game days: kill a DB primary; partition Kafka; slow the terminology service; expire certificates | Game days on the reference cell; generator transfer test |
| Quarterly | Regional DR failover with measured RTO/RPO; immutable-backup restore | Restore test per hospital; two consecutive failed DR restores reopen K-17 |
| Twice a year | Customer downtime drill (BCA and paper) | Code-Dark drill per unit |
| Announced shutdown | — | Planned WAN-loss drill [L] |
| Annual | — | Cyber-recovery exercise with one customer, including the estate-down scenario |
| Pre-go-live | — | **RG1:** burn-in, failover and power-cut tests; generator auto-transfer; Wi-Fi survey.<br>**RG3:** WAN-cut and mains-cut drills; cash-drawer and dual-currency drill |

**Pass criteria by layer** (K §7.9–§7.10; ADR-026):

| Layer | Failure | Must hold |
|---|---|---|
| L0 | Node loss | RPO 0; RTO ≤5 min engineering / ≤15 min contract |
| L1 | WAN cut | **Hospitals:**<br>• no clinical effect;<br>• SMS/WhatsApp, wallets, replication and KRG returns queue for ≥7 days;<br>• certificates and licences last ≥90 days without call-home;<br>• SMS through the site GSM/SMPP gateway; critical messages by voice;<br>• field engineers use co-signed local break-glass.<br>**Outpatient sites:** continuity ≤2 min engineering / ≤15 min contract.<br>**Lab downtime protocol:** middleware holds results; downtime accession numbers on paper reports; critical results phoned, read-back logged, back-entered ≤4 h |
| L1b | Mains cut | • No data loss.<br>• UPS ≥60 min with generator auto-start; a UPS per node.<br>• Graceful shutdown below 10 min of UPS; clients autosave.<br>• Node skew >1 s alarms; >5 s blocks clinical writes |
| L2 | Site loss | • Promote the Kurdistan DR standby.<br>• RPO ≤5 min engineering / ≤15 min contract, while replicating.<br>• RTO ≤60 min engineering / ≤4 h contract.<br>• Lag >15 min alarms.<br>• Cut >24 h: daily encrypted removable backup off site |
| L3 | Ransomware | • Immutable backups on site and at DR (≥90 days of restore points); clean-room rebuild.<br>• Continuity instance with independent identity; a clean kit per unit.<br>• Restore ≤24 h engineering; T0 ≤72 h contract; 4–6 weeks of safe degraded operation |
| L4 | Prolonged | Paper packets every 1–4 h; back-entry valid time = paper time, labelled |

- **Never offline** (cell lost; SI-15): new prescribing without full CDS; bed or OT allocation; identifiers outside pre-allocated blocks; controlled-drug movement; identity merges.
- ⚠ BP §7.10's 30-minute WAN unit rule (switch to paper MAR) is superseded for hospitals: internet loss is not offline (K ADR-012).

---

## 8. Summative usability (R15 §7.6; K-12; K §6.8; BP §6.8)
- **Method:** IEC 62366-1 with NISTIR 7804; **15–20 participants per distinct group** (ONC asks for 10).
- **KRI groups:** **Kurdish-first, Arabic-first and English-first are separate groups**, 15–20 each, tested before every Tier 2 function and Tier 1 critical task; NEWS2 activation needs all three nurse groups (K §5.6). Generic pattern: a different UI direction makes a distinct group (R15 §7.6). India/GCC groups DROPPED.
- **Critical tasks:** patient search and selection; weight-based and high-alert ordering; BCMA with override; transfusion check; NEWS2 escalation; critical-result acknowledgement; discharge med rec; pick-lists (K §13.6).
- **Release blockers:** task time >10% worse; any new critical use error. Output: an IEC 62366 report in NISTIR 7742 format.
- **Rules under test:** nurse UI in Sorani, Arabic or English, with drug names, doses and units always in Latin script and Western digits (K §6.5); defaults never pick a dose, route or patient (K §6.2).
- **KPIs [E] (K §6.8):** SUS physicians/nurses ≥68/≥72 at 12 months, ≥72/≥75 at 24 months, and ≥ baseline +10; login ≤5 s, tap-to-switch ≤2 s (p95); screen ≤1.0 s, cold chart ≤1.5 s (p95 on the cell; release blocker); nurse documentation −20% at 12 months; training 6–11 h (≤14 h for nurses new to computers), ≥95% completion, ≥85% proficiency. SUS/NEES are contract KPIs, never financing gates.

---

## 9. RTL, localisation and accessibility (R15 §7.7; K §6.7; BP §6.7)
Applies to Sorani, Badini (Arabic script), Arabic and English.

| Test | Requirement |
|---|---|
| Pseudo-locale | Text-expansion builds |
| RTL | Layout, icons, charts, tables; CSS logical properties; screenshot diffs every release |
| Bidi | A Sorani/Arabic name + English drug + numerals + units in one string; isolation |
| Digits | Clinical numerals always Western, on every screen; Eastern Arabic-Indic only for non-clinical patient-facing numbers |
| Script | Sorani letters (پ چ ژ گ ڤ ڕ ڵ ۆ ێ ە): fonts, shaping, collation, search normalisation; Arabic vs Kurdish ي/ی, ك/ک, ه/ە |
| Printing | Zebra V60.14/V50.14+ with `^PA` shaping, `^CI28` UTF-8 and a glyph font; otherwise raster `^GF` with golden-image tests. S7-K (M3–M4) on target printers → Supported Hardware List. RG3 rehearsal prints Kurdish and Arabic. Indic tests DROPPED |
| Names and search | Four-part names + Latin transliteration; cross-script, transliteration and collation search; prints in the patient's script + Latin (SI-01); trilingual banner (SI-16); newborn band truncation |
| Calendar | Gregorian, Hijri optional (PLT-UX-03; supersedes R15's dual Hijri); Friday–Saturday weekend; Newroz, Eids; calendar-aware SLA timers |
| Translation gate | Clinician-reviewed; **zero untranslated clinical-path strings** in all three languages; content-team translation memory; Badini templates reviewed in Duhok; Latin Kurmanji need checked in S7-K [L] |
| Accessibility | WCAG 2.2 AA each release; VPAT; Redundant Entry; Accessible Authentication (badge or passkey) |

---

## 10. Synthetic data (R15 §7.8; K §8)
- **Generator and uses:** Synthea with locale packs, for EMPI tuning, wrong-patient UX tests, UAT kits and model-ward patients (K §13.1). No production PHI outside production (K §10).
- **KRI names:** given, father, grandfather and family/tribal names; mother's full name as an identifying attribute; Kurdish (Arabic script), Arabic and Latin forms; transliteration variants (Muhammad/Mohammed/Mihemed); variant noise (ي/ی, ك/ک, ه/ە, alef forms, taa marbuta); display name per locale. R15's Arabic ism/nasab/nisba and "Al-" patterns = generic pattern.
- **KRI identifiers:** Iraqi Unified National Card; old civil ID and nationality certificate; Kurdistan residency card; passport (ICAO 9303 MRZ); UNHCR and IDP documents; MRN with check digit [L]. Captured from the document (barcode, MRZ, OCR), never typed; verification recorded separately; a mobile number is contact data and a matching feature, not an identifier. ⚠ No format or check-digit rules for Iraqi documents in the sources. DROPPED: ABHA, Aadhaar, Saudi ID/Iqama, Emirates ID, QID, Indian names.
- **Dirt:** DOB precision flag (exact / year / estimated); placeholder DOBs (1 Jan or 1 Jul; R15 "01-01-YYYY") get low weight; family-shared phones; several identifiers per person; mixed-script duplicates.
- **Gold set:** 2,000 cross-script pairs from DP#1 data (S14-K, M8), with ≥99.9% auto-merge precision.

---

## 11. Content, replay, continuous delivery and UAT kits (R15 §8)

### 11.1 Content (R15 §8.1; BP §5.4)
- **Scope:** order sets, CDS rules, NEWS2 policies, KB tiering, lab ranges, tariffs, packages and payer rules.
- **Bundles:** each is a versioned, signed bundle with owner, evidence link, review date, approval workflow, effective dating and hazard links.
- **Tier 2 content** inherits the module's design controls.
- **KB releases** are regression-replayed like code.

### 11.2 Replay before activation (R15 §8.2)

| Content | Simulation | Acceptance [E] |
|---|---|---|
| CDS rule | Silent for 2–4 weeks, then replay of 90 days of orders: firing rate per 100 orders, PPV, overlap | No increase in interruptive alerts per 100 orders without CDS committee sign-off; PPV floor per tier |
| Order set | Diff against the prior version; dose/DDI replay; Leapfrog | Zero new hard-stop conflicts; Leapfrog pass |
| NEWS2 policy | 90 days of observations replayed: escalations per ward per shift | Within agreed nursing capacity |
| Tariff / package / payer rule | Re-price the last 3–6 months of encounters under old and new rules; package coverage and leakage report; claim-scrub replay (NPHIES/NHCX DROPPED; generic pattern) | Delta explained line by line; zero unpriced services |
| Lab range / autoverification | Historical results replayed: autoverification rate, flag changes | Medical director sign-off |

**KRI (BP §5.4; K §6.3; SI-14):**
- A first inpatient site has no electronic history, so the vendor-validated Tier A/B baseline is interruptive from day 0, validated on Leapfrog/ISMP and on multi-site or synthetic replay.
- New or local rules run silent first.
- Rules with >90% override are reviewed, never auto-retired. Tier A/B are never retired on override rate alone.

### 11.3 Continuous delivery under validation (R15 §8.3; K §5.4)

| Class | Example | Path | Evidence |
|---|---|---|---|
| C0 | Report layout | Continuous behind flags | Automated tests |
| C1 | eMAR UI, order routing | Flag default off; CSO review; regression and scenario suites; tenant activation windows | Hazard-log delta; scenario report |
| C2 | Dose Engine, NEWS2, T2 | Batched quarterly; full V&V; regulatory impact assessment (intended-purpose or significant change?); AI only within an authorised PCCP (generic pattern) | Full evidence pack |

- **KRI delivery (ADR-021):** weekly CD centrally; monthly on-site train N, C2 quarterly; outbound rings: reference cell ≥7 days → non-flagship site ≥14 days → all (DP#1 never first); one train deferrable for a go-live, MCI or shutdown; migrations roll back to N-1; signed offline media (pinned keys, anti-rollback); drift ≤N-1 (>45 days beyond reopens); ≥90 days without call-home, no lockout.
- **Also KRI:** impact assessments check K-05 opinion scope (any change expires an opinion); Dose Engine activation is C2 with ≥4 weeks of pharmacist-only shadow; BP's NABH step DROPPED.

### 11.4 UAT and deployment kits (R15 §8.4)
- **Kit contents:** UAT scripts per module mapped to hazards; synthetic patients for the locale; expected results and sign-off forms; pre-filled DCB0160-style deployment hazard log for the customer's CSO; interface pack (HL7 profiles, sample messages); downtime-drill script; upgrade regression subset for quarterly activations.
- **KRI hazard analyses (K §13.1):** W2-K (transcription seam, Core transcription controls) signed by DP#1's CSO before RG1; W1-K/W3-K seam analysis before G1, with an H15 entry and a test per control.

---

## 12. Migration (R15 §9; K §13.5)

### 12.1 The Kurdistan position (K §13.5, §13.1, §4.2)
Most sites run on paper plus a local billing or pharmacy program [L]. Migration covers six jobs:
1. **Master data:** foundation content plus the hospital's price lists, formulary, staff and services.
2. **Patient index:** from the billing patient list and registers, with EMPI pre-match (duplicates <1%, zero overlays).
3. **Opening balances:** deposits and packages per currency reconciled **to the dinar**; corporate receivables; a wall-to-wall pharmacy count with witnessed controlled-drug counts.
4. **Active inpatients:** handled as in §12.4.
5. **Paper charts:** recent charts to PDF/A with document references, plus a chart-prep sprint 2–4 weeks before go-live.
6. **Receivables:** run off on the old system for 6–12 months.

- **Local systems:** schema docs "rarely available"; in-house systems "easiest technically, hardest semantically"; DB/CSV connectors plus the mapping studio; G1 item: a DP#1 test extract or a signed master-data plan (S13-K); old billing records to the Legacy Data Viewer (PDF dump only for small clinics).
- **Internal cutovers:** polyclinic patients pre-linked, so hospital A's M37 cutover is a link operation; polyclinic medication history and Core transcribed orders are reconciliation input only (SI-09).

**Discovery checklist** (R15 §9.1, generic pattern): data-return rights and fees; schema docs and extraction support; read-only licence cost; HL7 v2 archives; document stores; payer artefacts. ABDM/NPHIES items and care-context re-linking (R15 §9.7) are DROPPED.

### 12.2 Patterns (R15 §9.2)

| Pattern | Moves | How |
|---|---|---|
| Discrete | Demographics and identifiers; allergies; active problems; home and active meds (reconciliation input, never active orders); immunisations; 2–5 years of LOINC-mapped labs; recent vitals; future appointments; referrals; coverage; deposits and balances | Domain APIs, never direct DB writes; `migrated` provenance; bitemporal recorded vs effective time |
| Document | Discharge summaries, operative notes, imaging and pathology reports, clinic notes, scans | PDF/A + FHIR DocumentReference (type, date, author, encounter) |
| Archive | Closed encounters, historical orders and MARs, audit trails, billing history | Read-only Legacy Data Viewer in patient context |
| Clinician abstraction | Problem lists and key history for scheduled patients | Chart-prep sprint 2–4 weeks before go-live |

### 12.3 EMPI targets (R15 §9.3; K §8)

| Metric | Target |
|---|---|
| Residual duplicates | <1% |
| Known overlays loaded | **0** (false merges are worse than duplicates) |
| Gold set | R15: 1,000–2,000 adjudicated pairs per source, stratified by score. K: 2,000 cross-script pairs |
| Precision at the auto-merge threshold | ≥99.9% |
| Review queue | HIM adjudicates 100% of high-score pairs before Mock 3; medium-score pairs go to the live steward queue with an SLA |
| Linkage | Every legacy MRN kept as an alternate identifier; merge history kept and reversible |

- **Matching (K §8):** Fellegi–Sunter with a document-number shortcut; Kurdish/Arabic normalisation; transliteration dictionaries; more weight on the father's, grandfather's and mother's names and on DOB precision ([I], tuned in S14-K).
- **Baselines:** duplicates run 8–12% (RAND 8%; 15–16% in large systems). There is no regional benchmark.

### 12.4 Cutover playbook (R15 §9.4)

| Item | Method | Hazard | Control |
|---|---|---|---|
| Inpatients | Conversion admissions with original admit time, bed, attending, isolation, code status, dated weight | Lost context; wrong bed | Charge-nurse checklist per patient, T+0 to T+4 h |
| Active orders | Pharmacists pre-build 24–48 h ahead as "pending prescriber signature"; prescribers sign at go-live; no auto-activation of legacy orders | Omitted or duplicated meds | 100% pharmacist + prescriber review; per-patient reconciliation |
| MAR | Hard cut at a low-activity hour; last doses stay in legacy; PRN/last-given times and infusion rates carried over visibly | PRN opioid or insulin double dose; rate errors (H11) | Nurse double check; "last given" banner for 24 h |
| ED | Drain to minimum census; quick-register; legacy read-only | Lost in-transit results | In-flight list reconciled every 30 min for 6 h [E] |
| Pending results | Accession mapping; LIS/RIS route to the new system from T0 | Orphaned results | Orphan queue at zero |
| Pharmacy stock | Wall-to-wall GS1 batch/expiry count; witnessed controlled-drug counts; ADC reconciliation (P2); POs and consignment separate | Stock-outs; controlled-drug discrepancies | Chief pharmacist signs the variance report; register sign-off |
| Deposits | Opening ledger entry per patient with receipt references; GL control total | Lost money | **KRI:** to the dinar, per currency (IQD/USD); deposit statement on request |
| Packages | Migrate the header (entitlement, consumed components, remaining coverage), or close in legacy if discharge is imminent | Leakage or double billing | Sign-off per package (PM-JAY/TPA DROPPED) |
| Pre-auths (generic pattern) | Migrate approval numbers, validity, amounts, pending requests; re-check | Denials | Reconciled list; payer liaison |
| Open IP bills | Interim legacy bill + new account with carried deposits; charges migrated only for packages | Fragmented bills | Payer rules agreed in advance |
| Receivables run-out | Pre-cutover discharges stay in legacy for 6–12 months | Lost cash | Dashboard; legacy-access contract |
| Future appointments | 6–12 months forward with slot mapping; re-notify on change | Missed visits | Clinic-level counts |
| ZATCA e-invoicing | DROPPED | — | — |

- **Dangerous items** (three in Kurdistan; R15's ABDM item DROPPED): active meds and PRN last-given times; deposits and packages; pharmacy opening balances incl. controlled drugs. Each is scripted, owned, reconciled, signed off and rehearsed in Mock 3 and the dress rehearsal (R15 §11 #14).

### 12.5 Mocks and reconciliation (R15 §9.5; K §13.5)

| Event | Timing | Exit [E] |
|---|---|---|
| Mock 1 | T-120 d | Full extract; ≥95% load; mapping gaps listed |
| Mock 2 | T-75 d | ≥99.5% load; **every reject has a reason code**; clinicians review 30–50 charts |
| Mock 3 | T-45 d | Production-like, timed in the window; 100% reconciled; HIM and finance sign-off |
| Dress rehearsal | T-14 d | Full runbook (deltas, interfaces, printing, financial cutover) within plan |
| Go-live | T0 | Delta loaded; dashboards green |

**Metrics:** accounting identity at 100% (source = loaded + rejected with reason + intentionally excluded); control totals and hashes on deposits, receivables, package balances, active allergies per patient and active meds per inpatient; zero defects in critical fields (identifiers, allergies, active meds, blood group, code status, weight), <0.5% elsewhere; 100% review of active inpatient allergies and meds; load fits the window with 25% headroom.

### 12.6 Legacy archive (R15 §9.6; K §10.1)
- **Default:** the Legacy Data Viewer — lakehouse and document store, patient-context launch, audit, retention policies. It doubles as migration staging.
- **KRI retention:** never auto-delete, with a 25-year floor; destruction needs a schedule, approval and a legal-hold check.
- **Alternatives:** keep legacy read-only only for the receivables run-out; a PDF/A dump only for small clinics; third-party archives suit large Millennium exits, which Kurdistan does not have.

### 12.7 Migration Workbench (R15 §9.8; K §4.3)
1. **Connectors:** JDBC (Oracle, SQL Server, PostgreSQL, MySQL), CSV/SFTP, HL7 v2 archive replay, FHIR Bulk, CDA/C-CDA, DICOM metadata indexer. ABDM importer DROPPED.
2. **Staging:** in the lakehouse, profiling null rates, code distributions and date anomalies.
3. **Mapping studio:** ConceptMaps to WHO ICD-10, LOINC, UCUM, ATC and the regional brand master. SNOMED only if licensed, otherwise the Global Patient Set + local codes. KRI packs: paper and local billing.
4. **EMPI pre-match:** gold-set tooling and a steward queue.
5. **Loaders:** domain APIs, idempotent and re-runnable, `migrated` provenance, bitemporal. SIs apply here too.
6. **Reconciliation:** dashboards, the accounting identity, a clinician sample-review app.
7. **Opening balances:** deposits, packages, pre-auths, run-out (KRI: dual currency).
8. **Pharmacy count app:** GS1 scanning with witnessed controlled-drug counts.
9. **Active-order assistant:** pharmacist pre-build, prescriber signs.
10. **Cutover orchestrator:** a Temporal runbook with go/no-go checkpoints.
11. **Legacy Data Viewer.**
12. **ABDM care-context mapper:** DROPPED.

---

## 13. Go-live safety (R15 §10; K §13.1–§13.3)

### 13.1 Readiness gates (R15 G1–G4 = RG1–RG4, BP §13.3)

| Gate | Timing | Must be true (K §13.3) |
|---|---|---|
| RG1 | T-90 | **Build:**<br>• code frozen; Clinical Safety sites feature-complete since T-150;<br>• foundation content ≥90% (R15/BP ≥80%);<br>• Register status confirmed per Tier 2 function and fallback;<br>• extended dosing fallback and 24×7 pharmacist cover [L] (Core: double check at transcription);<br>• stewardship lead named; Core transcription controls configured.<br>**Infrastructure:**<br>• server-room UPS ≥60 min; generator auto-transfer tested; UPS at critical points;<br>• cell burn-in, failover and power-cut tests passed;<br>• Wi-Fi survey passed; remediation plan signed (K §13.2).<br>**Site:** blood-unit relabelling agreed with the blood bank; calendars configured; seam controls live |
| RG2 | T-45 | Mock 3 passed; scenario suites green; 300-bed day at customer sizing on the installed cell within SLOs (R15/BP: the 1,000-bed day); deployment hazard log signed by the customer's CSO |
| RG3 | T-14 | **Rehearsals:** dress rehearsal; device-class rehearsal including Kurdish and Arabic printing.<br>**Training:** ≥95% complete; proficiency ≥85%; ≥80% "ready" per unit.<br>**Drills:** downtime drill with WAN and mains cuts; cash-drawer and dual-currency drill.<br>**Safety:**<br>• zero open Sev-1; no unmitigated high risk; orphans at zero;<br>• fallback validated for NICU/PICU and paediatrics, signed by the Chief CSO;<br>• statutory registers live (MLC, narcotics, births and deaths, notifiable diseases);<br>• pharmacist-cover alarm tested; patient-supplied medicine workflow live.<br>**Operations:** command centre staffed; independent assessor concurs (customers #1–3) |
| RG4 | T-1 | • Final delta on time; safety dashboard live.<br>• Continuity instance and clean kits ready; DR standby replicating.<br>• Insurance bound; card terminals and wallet links tested; KRG return formats tested.<br>• Assessor concurs (customers #1–3).<br>The R15/BP payer and HIE checks are DROPPED |

- **Gates, not dates.** Financing never references a go-live date (BP §13.3; K-28).
- **Seam KPIs (K §13.1):** referrals unacknowledged >24 h = 0; overlays = 0; monthly seam hazard review.
- **Core transcription controls (K §4.2):** pharmacist-only transcription with the signed paper-order image attached; KB screening and double check at transcription; orderer mandatory; second check for high-alert and paediatric orders; no MAR, schedule or active-medicines view (screen labelled "dispensing record, not an order or MAR"); 50 orders audited monthly.

### 13.2 Rollback and slow-down (R15 §10.2; K §13.3)
- **Why limited:** after ≈48–72 h live, rollback means re-entering every new fact. VGR halted after 3 days.
- **Levels:** (1) flag off, any time; (2) a unit to downtime procedures; (3) full fallback to paper or legacy only within ≤72 h, legacy kept warm, back-entry team ready.
- **Level-3 triggers:** orphans >2 h with patient impact; BCMA down >4 h across units; order-sign p95 >5× SLO for >4 h; a system-attributable sentinel event; with seams, unmatched results >0 for 1 h; cell down >4 h without DR promotion.
- ⚠ R15 §10.2 and BP §13.3 also list payer connectivity blocking admissions >24 h; K omits it.
- **Scale-out:**
  - an independent operational assessment of hospital A at G3 exit (M40), before Clinical Safety goes live elsewhere, and again at G4;
  - a sentinel event freezes new go-lives until its CAPA closes.

### 13.3 Big bang vs pilot
- **Ruling: "Pilot the product, big-bang the hospital"** (R15 §10.3; RL #11; K §13.1). It overrides R03's original single-unit pilot (R03 §21.2 is now reconciled).
- **Before go-live:** model ward (1–2 weeks of scripted shifts on the production build, real staff, synthetic patients); day-in-the-life rehearsals; parallel billing replay.
- **At go-live:** one cutover for all inpatient clinical and revenue modules.
- **Allowed phasing:** back office; outpatients first where medication records do not interleave; self-contained units (day-care, dialysis, specialty hospital); regional waves.
- **Never:** live single-unit inpatient pilots of orders, MAR or BCMA; unit-by-unit BCMA.
- **KRI: two big bangs per hospital are normal.** Core (R1 + R2a) keeps orders and MAR fully on paper, so it is not a partial loop; Clinical Safety (R2b) follows site-wide with full gates; hospital A does both in one big bang at M37 (K-24). NICU/PICU go live with the site, never later (K-21; SI-05).
- **Operations (K §13.2):** 24×7 command centre for 2–4 weeks; safety dashboard from hour 0; daily safety huddle; 90-day safety officer; OPD templates cut 25–50% in week 1 and 10–25% in weeks 2–4; elective lists trimmed in week 1.

---

## 14. Patient-safety acceptance criteria (R03 §19)

**Rules:**
- Each item needs a traceability ID and a hazard link (R03 §19; BP §5.1).
- Where an SI applies, it is enforced server-side and tested on every channel: UI, API, mobile, interfaces, migration loaders, plugins and AI agents (BP §5.1; K §5.1).
- R03 §19 has no PCPNDT item; PCPNDT sits in BP SI-21 and is DROPPED (K-03).

**Codes:** ID identification · OC orders and CDS · MA medication administration · RC results · DA deterioration · PR procedures · BL blood, specimens, milk · BH behavioural health · RR records.

**Identification**
- **SAC-01** (R03 §19 ID-1; SI-01; H1): Every label, wristband, MAR entry, print and verification step shows ≥2 identifiers; room or bed never counts. KRI: name in the patient's script + Latin; MRN + DOB or the approximate-DOB flag.
- **SAC-02** (ID-2; SI-16): A photo is captured and shown on the banner, MAR and order entry.
- **SAC-03** (ID-3): The MRN has a check digit; invalid MRNs are rejected at entry and scan (K §8).
- **SAC-04** (ID-4): Barcoded wristbands and labels carry ≥2 identifiers; wristbands print at registration (R03 §21.3 #4). KRI: Kurdish/Arabic shaping or raster, golden-image tested.
- **SAC-05** (ID-5): Registration and search warn on similar names, and adjacent similar names look distinct across scripts. Retract-and-reorder is monitored (R03 §21.3 #7).
- **SAC-06** (ID-6): Unknown, trauma, MCI and downtime patients get unique temporary IDs (alias pools or pre-allocated blocks) that merge into permanent IDs.
- **SAC-07** (ID-7): Newborns get distinct names ("Baby of [mother]"); fields and bands pass truncation tests in all three scripts.
- **SAC-08** (ID-8; SI-08; H12): Merge/unmerge are reversible links propagated downstream (A40/`Patient.link`). A dashboard shows the duplicate rate against ≤1% (an industry goal, not AHIMA's) and an 8–12% baseline. Overlays are safety incidents.
- **SAC-09** (ID-9): Specimens are labelled at the bedside in the patient's presence (mobile labels, K §6.6), with WBIT detection (BP §5.2).

**Orders and CDS**
- **SAC-10** (OC-1): Orders are structured by default; free-text orders are monitored, and free text alerts when a structured equivalent exists.
- **SAC-11** (OC-2; SI-05, SI-16): Ordering shows dated, sourced weight (stated vs measured), height, coded allergies (reaction, severity) and pregnancy status; "NKA" ≠ "not assessed". No weight-based medicine is signed without a weight. Metric only; no unit-less dose fields (R03 §21.3 #5).
- **SAC-12** (OC-3; SI-05): Dose-range checks (single, daily, cumulative; weight/BSA/renal/age/paediatric) run before submission and show their working. KRI: in full from Dose Engine activation (P2); the §1.4 fallback applies until then.
- **SAC-13** (OC-4): Paediatric doses use defined decimal rounding and corrected age.
- **SAC-14** (OC-5; SI-14): The Leapfrog 8-category harness passes; hard stops come only from the governed absolute-contraindication list (for example intrathecal vincristine, MAOI + triptan).
- **SAC-15** (OC-6): The excessive-alert suppression list is versioned content, exercised by the Excessive Alerts category.
- **SAC-16** (OC-7): Firing, override and acceptance rates and override reasons are recorded per rule; in-workflow feedback is possible.
- **SAC-17** (OC-8; SI-07): AI/predictive tools show source attributes and have local validation, drift monitoring and governance. KRI: P2; cleared partners only, silent first (K §5.7).
- **SAC-18** (OC-9): Verbal orders capture read-back and track co-signature; antineoplastic verbal orders are rejected except hold/stop.
- **SAC-19** (OC-10; SI-03; H5): Tests, referrals and transitions are tracked to completion; unowned work raises `TaskOrphaned` within 5 min.

**Medication administration**
- **SAC-20** (MA-1): BCMA is live in all inpatient, ICU, L&D, pre-op and PACU units, with patient and medication scans ≥95% per unit. KRI: R2b, site-wide only.
- **SAC-21** (MA-2; SI-02): Override reasons are never defaulted; scan-failure analytics and user/unit dashboards exist; every override is reportable.
- **SAC-22** (MA-3; SI-13): A high-alert dose cannot be documented without a recorded independent double check.
- **SAC-23** (MA-4): Pump autoprogramming and auto-documentation, with the rate monitored. **KRI: DEFERRED to P2.** One vendor; orders, never commands; only after BCMA reaches ≥95%; ≥80% target in year one [E]. Fallback: manual programming + BCMA scan (K-09; R15 §5.3).
- **SAC-24** (MA-5): No first dose without pharmacist verification, apart from defined emergency overrides. KRI: review within 4 h of any unverified dose; alarm if the queue is unstaffed >30 min. ADC override review comes with the ADC (P2).
- **SAC-25** (MA-6): The formulary holds standard concentrations, premixed anticoagulants, and reversal and perioperative protocols.
- **SAC-26** (MA-7; SI-09): Med rec at admission, transfer and discharge requires a decision per item, cannot complete with undecided items, and produces a written discharge list.
- **SAC-27** (MA-8): Opioid high-risk monitoring and pain reassessment tasks. **PDMP access is DROPPED** (a US programme; R03 verification log, NPG.06.01.01 EP6).
- **SAC-28** (MA-9): Stewardship DOT reporting. KRI control set until CLN-AMS-01 (P2):
  - restricted antimicrobials need an indication and an approver;
  - a 48–72 h time-out task;
  - a stop or review date on every antimicrobial order;
  - a monthly DDD/DOT report from dispensing;
  - a lead named at RG1 (K §5.2).

  NHSN AU is DROPPED.

**Results and communication**
- **SAC-29** (RC-1; SI-04; H3): Critical-result definitions and timeliness targets are configured; calls are logged with read-back; a named recipient (picker, never free text) has a timed escalation chain. KRI: external referrers included.
- **SAC-30** (RC-2; SI-03, SI-17): Every result has a responsible clinician; amended results notify and flag; results pending at discharge, or for discharged patients, go to owned queues.
- **SAC-31** (RC-3): Surrogate inbox coverage; unacknowledged results monitored (abnormal >7 days, BP §5.2); patient notification timeliness measured. KRI: labelled results and pregnancy tests are never released by message (K §9.2).
- **SAC-32** (RC-4): A structured I-PASS handoff with audit and a per-shift coverage KPI.
- **SAC-33** (RC-5): Secure messaging is reliable for high-risk information (patient-context chat; no PHI in notifications; K §6.6).

**Deterioration and alarms**
- **SAC-34** (DA-1): NEWS2/PEWS/MEOWS are auto-calculated with visible components, escalation tasks and response-time tracking, and pass the §5 #8 boundary tests. KRI: only where the Register allows; otherwise nurse-calculated.
- **SAC-35** (DA-2): Observation frequency is driven by the score. ⚠ KRI conflict: until activation, the nurse sets frequency, never a score (K §5.6).
- **SAC-36** (DA-3): Role-based authority to change or disable alarms. ⚠ Scope conflict: the HMS is never in the primary alarm path, and alarm forwarding is never built (R15 §4.2i; K §9.2).
- **SAC-37** (DA-4): A code sheet documents resuscitations and feeds resuscitation review (R2b).

**Procedures**
- **SAC-38** (PR-1): Pre-procedure checklist, site marking, a role-based time-out and all three WHO Surgical Safety Checklist phases are captured.
- **SAC-39** (PR-2): Perioperative syringe labels print.
- **SAC-40** (PR-3): Implant UDI capture. K §4.3 places implants on the intra-op record but does not mention UDI.

**Blood, specimens, milk**
- **SAC-41** (BL-1; SI-11; H8): A bedside barcode match of wristband ↔ unit ↔ order ↔ sample plus a two-person e-witness is required; a mismatch is a hard stop. ABO and special-requirements checks; a reaction workflow. KRI: relabel control; no compatibility engine; scripted fallback until T2 activation.
- **SAC-42** (BL-2): Human-milk barcode matching in NICU. **KRI: DEFERRED to P2.**

**Behavioural health and restraint**
- **SAC-43** (BH-1): Validated suicide screening (age ≥12 in behavioural health) with documented risk and plan. A generic pattern from the Joint Commission NPGs, kept in K §4.3.
- **SAC-44** (BH-2): Restraint and seclusion orders with age-based expiry, no PRN, a 1-h face-to-face task, monitoring and documentation, and death reporting (K §4.3 timers).
  - Generic pattern: the US 42 CFR 482.13 limits (4/2/1 h; 24 h cap; death reported next business day) become configurable rule packs with source and review date (R03 §21.3 #10).
  - The sources give no Kurdistan rule.

**Records and resilience**
- **SAC-45** (RR-1; SI-06): Signed notes are immutable; amendments are versions, addenda are links, entered-in-error replaces delete; the signed rendering is hashed; full audit.
- **SAC-46** (RR-2): Copy-forward text is attributed and highlighted.
- **SAC-47** (RR-3; SI-10, SI-15): Read-only BCA snapshots (MAR, active orders, allergies, census); downtime registration; labelled back-entry that keeps clinical time distinct from system time. Staff are drilled (Code-Dark twice a year per unit; RG3). KRI: continuity instance, clean kits, cell-loss scope.
- **SAC-48** (RR-4): Data and configuration backups are restore-tested (KRI: quarterly per hospital; immutable; ≥90 days of restore points).
- **SAC-49** (RR-5): Updates are tested in an integrated context with clinically authentic scenarios (suites, upgrade subset); impactful changes are notified (release notes, known anomalies, flag defaults).

**BP §5.1 additions (not in R03 §19)**
- **SAC-50:** ISMP display rules (no trailing zeros, no naked decimals) and tall-man lettering.
- **SAC-51:** The banner distinguishes "NKA" from "not assessed".
- **SAC-52:** RIS MRI-safety screening with incident capture.
- **SAC-53:** Device auto-dissociation on discharge or transfer (R04 §11 #8, #11).
