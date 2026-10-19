
---

## 14. UX, design system and localisation

**Principle:** slow is unsafe, and noisy is unsafe. Only 38% of implementations "hit the mark", and 75% of clinicians dissatisfied at go-live are still dissatisfied two years later (R10 §2). Kurdistan users will compare us with the Middle East's best KLAS results, not with paper (K §6). Experience targets are release blockers. Read: K §6; BP §6; R10 §2–§3; R03 §15.

### 14.1 Role-based workspaces (each has an owned home queue)

| Workspace | Home queue | Signature tools |
|---|---|---|
| OPD consultant (often visiting) | Token-driven patient queue | One-screen visit; favourites and order chips; brand↔generic e-prescribing with regional brands; median documentation ≤90 s for a follow-up [E] |
| Inpatient physician, including visiting consultants on evening rounds | Results, co-signs, orders to sign, consults, discharges due | Tablet-first rounds; order sets; verbal orders with read-back and co-sign timers; I-PASS; "changes since last note" |
| Nurse | Shift brain-sheet: due, overdue, PRN-eligible, changed, escalations | Mobile BCMA; charting by exception; validated vitals; NEWS2 tasks; UI language per nurse |
| Pharmacist (inpatient and outpatient retail) | Verification queue ranked by STAT and high-alert; OP sales | Extended double-check workflow; screening tiers; narcotics registers; STAT ≤15 min timer; unit-dose label printing |
| Lab and radiology (including outpatient front desks) | Accession worklists, QC, critical calls | Analyser status; read-back logger to internal and external doctors; RIS protocoling |
| Cashier | Deposits, top-ups, running bills, discount approvals, refunds | Dual-currency drawer; exchange-rate display; per-currency shift close; doctor-fee settlement |
| Corporate / insurer desk | Pre-approvals, credit limits, statements, ageing | Document packs; per-line payer/patient split; deduction reasons |
| Owner / managing director | Daily dashboard | Revenue and collections by currency; unbilled consumption (leakage); deposits outstanding; corporate receivables; occupancy; safety KPIs |
| HIM / quality / CSO | Deficiencies; merge steward queue; incidents; JCI KPIs | Hazard log; safety dashboard; evidence packs |
| Registration / front desk | Arrivals, tokens, ID capture | Document scan (card barcode, MRZ, OCR); duplicate warnings; wristband and label printing |
| Stores | Indents, receipts, expiries | FEFO picking; GRN; consumption review |

### 14.2 Design system rules

One design system on React Aria primitives; keyboard-first with a command palette; typo-tolerant brand↔generic search across regional brands; density modes; no stacked modals; identical sign and co-sign patterns everywhere. **Defaults never select a dose, route or patient.** Clinical numerals are always Western digits. The banner (SI-16) is a design-system component, not a per-screen implementation (K §6.2).

### 14.3 Alert-fatigue strategy (CDS tiers)

| Tier | Behaviour | Budget |
|---|---|---|
| A | Hard stop, from the governed list only | ≤20 rules |
| B | Interruptive, reason required (never defaulted) | ≤8 per 100 medication orders at go-live; ≤5 by month 12 |
| C | Inline, passive | — |
| D | Routed to the pharmacist queue | — |

The vendor-validated baseline is interruptive from day 0 (a first site has no order history to replay). New or locally modified rules run silent for 2–4 weeks first. Rules with >90% override are reviewed, never auto-retired; Tier A/B are exempt from retirement on override rate. The CPOE error-category harness (§18.5) runs on customer content after every KB or content release (K §6.3).

### 14.4 Performance and usability targets (release blockers)

| Metric | Target |
|---|---|
| Login / tap-to-switch | ≤5 s / ≤2 s p95 |
| Warm screen / cold chart open p95 on the on-site cell | ≤1.0 s / ≤1.5 s |
| BFF p95 / p99 | 300 / 800 ms |
| Patient search p95; order sign with CDS p95; BCMA scan-to-confirm p95 | 200 ms; 1.5 s (≤500 ms per CDS service, failing open with a banner except hard stops); 500 ms |
| Pooled-tier core flows on a poor network | Usable at 1 Mbps / 300 ms RTT |
| Task time vs previous release | A >10% regression on a critical task blocks release |
| SUS physicians / nurses (each site's T-120 baseline) | ≥68 / ≥72 at 12 months; ≥72 / ≥75 at 24 months; and at least baseline +10 [HUMAN measurement] |
| Nurse documentation minutes per shift | −20% at 12 months [HUMAN measurement] |
| Accessibility | WCAG 2.2 AA on every workspace, with a low-bandwidth mode for patient-facing pages (BP §6.7; R09 §7.8) |

### 14.5 Documentation burden

Notes are synthesis, not accumulation: composed from structured data, with span-level provenance and copy-forward visibly marked. Clinical text is English; patient-facing text is in the patient's language. A Kurdistan documentation profile free of US billing norms. A team inbox with pools (K §6.4).

### 14.6 Nursing first

Design around the shift: brain-sheet, worklists, I-PASS/SBAR generated from the chart, charting by exception. Flowsheet field governance is a product feature (Mercy saved 32 minutes per nurse per day). Device vitals are validated, not transcribed. Nurses choose Sorani, Arabic or English for the UI; drug names, doses and units stay in Latin script and Western digits in every language, so a nurse never translates a dose. Screens and training are sized for staff new to computers (K §6.5).

### 14.7 Localisation engineering (with §11.1)

- CSS logical properties; `dir` from the locale; bidi isolation tests for mixed strings (a Sorani name + an English drug + a dose + a unit); RTL screenshot diffs on every release.
- Pseudo-localisation in CI (expanded strings, RTL mirroring) to catch truncation and hard-coded text.
- Culture: chaperone documentation and guardian or co-signer consent in R2b; same-gender clinician preference in scheduling and Ramadan mode in P2.

---

## 15. Mobile

**One React Native app with two modes** (K §6.6; R09 §8):
- **Nurse mode:** BCMA (wristband, GS1 DataMatrix and in-house unit-dose labels), bedside specimen labelling, vitals capture with device association, wound photos, worklist, PRN reassessment, escalation tasks.
- **Physician mode:** result acknowledgement, critical-result read-back, patient-context secure chat, tablet rounds, co-signature of verbal orders.

**Offline and security rules:**
- The offline store is encrypted (SQLCipher) and holds only what the unit needs.
- Offline administration is allowed only against orders verified before the outage (SI-15). On reconnect every offline command is revalidated by the server; there is no last-writer-wins merge.
- **An administration that happened is a fact.** If the order was discontinued or changed during the outage, the dose is recorded as given (with its real clinical time) and flagged to the prescriber and pharmacist as an owned task. It is never silently dropped and never overwritten (R08 §6.3).
- Facts are append-only, so they never conflict. State transitions sync as commands. Offline registrations take identifiers only from the pre-allocated, site-prefixed downtime blocks (SI-15, SAC-06) and go to a reconciliation queue. Nothing generates an MRN or encounter number outside a block. CRDT-style merging is allowed only for draft note text and UI preferences.
- No new prescribing offline; no controlled-drug stock movement offline.
- Notifications carry no PHI. Photos go straight to the server-side file store and are not kept in the device gallery.
- Shared ward devices are MDM-managed. Physician mode on a personal phone requires an MDM work profile.
- Spike S9-K proves the offline-BCMA conflict model against the real on-site cell before R2b (ADR-012).

---

## 16. On-site cell, fleet, DR and downtime engineering

Read: K §7.8–§7.11; R08 §6; R16 §12, §14; R07 §6.

### 16.1 The on-site cell product (PLT-SITE-01, PLT-OPS-02, PLT-PWR-01)

- **Installer:** one command installs a cell from signed artefacts onto three nodes from the Supported Hardware List (k3s or RKE2, CloudNativePG with three instances and quorum synchronous replication, Strimzi Kafka or NATS, Temporal, Keycloak, OpenFGA, the HMS, Tier 2 sidecars, the Hub, print/queue/device bridges, the reporting replica, terminology and drug-KB snapshots, the OpenTelemetry collector). It verifies signatures, hardware, UPS signalling, time source and network before it starts.
- **Burn-in suite:** failover tests, a power-cut test, a WAN-cut test and the 300-bed day at customer sizing, producing an RG1/RG2 evidence report.
- **Fleet console** (central): inventory of cells, versions (N/N-1 drift), health, backups, replication lag, licences, certificates, hardware alarms, ring assignment.
- **Updates:** pulled over an outbound channel in staged rings; signed offline media with pinned keys and anti-rollback for cells that cannot reach us; database migrations always roll back to N-1; a site may defer one train.
- **Licensing and certificates** tolerate ≥90 days without call-home, with no lockout.
- **Power (ADR-026):** UPS and generator status as building signals; graceful, ordered shutdown below 10 minutes of UPS; crash-safe storage; clients autosave.
- **Time (ADR-026):** GPS or stratum-1 NTP per cell; skew >1 s alarms; a node >5 s out is blocked from clinical writes.
- **Break-glass (ADR-027):** co-signed, single-use, sealed credentials for field engineers when the internet is down; operations plane only; session recorded for customer review.
- **Physical security:** encrypted disks with TPM-sealed keys escrowed at the DR site; no local admin accounts; tamper alerts; remote wipe for a stolen node.

### 16.2 Backup, replication and recovery

- Quorum synchronous replication inside the cell (three PostgreSQL instances; a commit waits for one of the two standbys and never degrades to asynchronous): RPO 0 when any one node fails, RTO ≤5 min engineering (≤15 min contract). Losing two nodes stops writes rather than risking data.
- Asynchronous encrypted replication to the DR site's warm standby: RPO ≤15 min while replication is up; lag >15 min alarms the hospital. During an internet cut the standby falls behind, so the real recovery point equals the length of the cut.
- Immutable backups on site (object-lock NAS in a separate fire compartment) and at the DR site, with ≥90 days of restore points. During a cut longer than 24 h, a daily encrypted removable backup is taken off site (tooling and runbook).
- Quarterly restore tests per hospital; single-tenant point-in-time restore of a 5-year, 150-bed tenant on on-site hardware in ≤4 h (C7).
- Site loss: promote the warm standby at the DR site (RTO ≤4 h contract); clinicians connect over the internet or mobile data.
- Ransomware or logical corruption: clean-room rebuild; tenant restore ≤24 h engineering, T0 ≤72 h contract; the continuity instance (independent identity) and per-unit cellular clean kits keep clinical access; safe degraded operation for 4–6 weeks.

### 16.3 Downtime layers (K §7.9)

| Layer | Failure | Required behaviour |
|---|---|---|
| L0 | Node loss in the cell | Automatic failover; no clinical interruption beyond seconds |
| L1 | Internet or WAN loss (including government shutdowns) | **Hospitals: no clinical effect.** External channels (messaging, wallets, replication, KRG returns) queue for ≥7 days; certificates and licences keep working; SMS only through the per-site GSM gateway; critical messages by voice. **Outpatient sites:** read-only continuity on the edge agent, downtime ID blocks, printed packets and the outpatient lab downtime protocol (middleware holds and validates results; paper reports carry downtime accession numbers; critical results phoned with read-back logged on the edge agent and back-entered within 4 h) |
| L1b | Mains power loss | UPS and generator; no data loss; clinical work continues at UPS-backed points |
| L2 | Site loss | DR standby promotion |
| L3 | Ransomware or corruption | Immutable restore, continuity instance, clean kits |
| L4 | Prolonged outage | Paper packets every 1–4 h; downtime forms; back-entry with valid time = paper time, labelled |

**Never offline** (SI-15): new prescribing without full CDS; bed or OT-slot allocation; identifiers outside pre-allocated blocks; controlled-drug stock movement; identity merges. At an on-site hospital these apply only if the cell itself is lost.

### 16.4 SLOs (K §7.10)

| Metric | Engineering SLO | Contract SLA |
|---|---|---|
| T0 write paths (ADT, CPOE, eMAR/BCMA, results filing) at the cell | 99.99% | 99.95% per month |
| Read and continuity paths | 99.99% | 99.99% |
| In-cell RPO / RTO | 0 / ≤5 min | 0 / ≤15 min |
| Site-loss RPO / RTO | ≤5 min / ≤60 min | ≤15 min / ≤4 h |
| Cyber recovery | Tenant restore ≤24 h | T0 ≤72 h |
| Planned downtime | 0 (major database upgrade ≤30 min a year) | 0 |
| HL7 end to end | p95 ≤5 s; zero silent drops; alarm at >5 min unacknowledged | Reported |
| Orphaned work | 0; alarm ≤5 min | >2 h with patient impact is a Level-3 rollback trigger |
| Critical patches | ≤7 days central; ≤14 days on site | Same |

### 16.5 Drills the software must support

Monthly game days on the reference cell; quarterly restore tests; Code-Dark drills twice a year per unit; planned WAN-loss drills before announced shutdowns; an annual cyber-recovery exercise including the hospital-estate-down scenario. Build drill modes, scripts and reports so each drill produces evidence with measured recovery times.

---

## 17. Data platform, analytics and AI

Read: K §11; R09 §5–§6, §9.

### 17.1 Data platform

| Phase | Components |
|---|---|
| MVP | **On site:** read models (≤2 s) and the reporting replica (≤60 s), carrying MIS, JCI measures, KRG returns, safety telemetry and the **owner's dashboard** (revenue and collections by currency, unbilled consumption, deposits outstanding, corporate receivables, occupancy). A report builder on the replica. **Centrally:** encrypted CDC bronze landing per tenant for migration staging, CDS replay and analytics |
| P2 | Silver layer; OMOP and SQL-on-FHIR outputs; command-centre data |
| P3 | Opt-in benchmarking with hospitals as co-owners. **We never sell identifiable data** |

### 17.2 AI (P2 and later; nothing in the MVP)

- **Platform (P2, starting only after company gate G3: hospital A's 90-day stabilisation and independent assessment, exit ≈M40; AI work from ≈M42, K-23):** the AI gateway (counsel-approved region pinning, zero retention, PHI minimisation, version pinning, kill switch, on-site small-model option), the grounding service, the control plane (registry, model cards, evaluation harness, monitoring, provenance) and the human-in-the-loop UX kit. No model touches the database (constitution rule 10). Control-plane requirements G1–G16 (R09 §5.4) are MUST at AI GA (§17.3).
- **First products (P2):** source-cited English discharge-summary drafts with an omission checklist (diagnoses, discharge medications, follow-up, pending results) completed before sign-off; structuring of short English dictation; insurer document-pack assembly; Kurdish and Arabic patient instructions **suggested from the approved template library** (never free machine translation; new text approved by a bilingual clinician).
- **Later:** Arabic and English ambient documentation (P3, partners only); Sorani and Badini only after two partners pass S8-K; predictive deterioration and sepsis only from cleared partners, run silent first.
- **Rules:** output stays `draft-ai` until signed (SI-07); per-sentence citations; unsourced diagnoses or treatments are blocked; evaluation sets in English, Arabic and Sorani gate every model or prompt release; every AI surface has one-click issue reporting into the Safety Event pipeline; every AI feature degrades cleanly to "unavailable" with the manual path intact, including during internet shutdowns. Cross-border inference needs a counsel opinion, hospital approval and a Safety Board processor entry (SI-20).

### 17.3 AI control plane requirements (G1–G16, MUST at AI GA; R09 §5.4; K §11.3)

| # | Requirement |
|---|---|
| G1 | Registry of every model, prompt and agent: version pinning, owner, intended use, risk tier, approval status, deployment scope (sites, units, roles) |
| G2 | Model cards and source attributes shown in the workflow (an "i" button on every AI output), editable for local models |
| G3 | Immutable, exportable provenance: model and version, prompt-template version, sources, raw output, human edits, signer and time |
| G4 | No AI output enters the record, reaches a patient, or executes an order or claim without an accountable human (SI-07) |
| G5 | Structured accept/edit/reject and override reasons, feeding monitoring |
| G6 | Retrospective and silent evaluation: calibration, PPV and sensitivity at thresholds, alert burden, subgroups |
| G7 | Monitoring of drift, performance, usage, edit distance, overrides and subgroup gaps, with alert thresholds; cost per encounter |
| G8 | AI safety events into the incident pipeline, with a blinded option |
| G9 | Per-feature, per-site disable and instant rollback (kill switch, SI-19) |
| G10 | Patient-facing AI identifies itself; patient text comes only from approved templates |
| G11 | Recording consent for any ambient feature (P3), with opt-out honoured |
| G12 | PHI minimisation; counsel-approved region pinning; no vendor retention or training; segmentation and labels enforced by the grounding service (SI-20, SI-21) |
| G13 | Agents: least-privilege tool scopes, approval for writes, prompt-injection defences, action logs |
| G14 | A classification record per AI feature in the Boundary Register |
| G15 | Regression evaluation (English, Arabic, Sorani sets) before any model or prompt update; release notes |
| G16 | Declared protected-attribute inputs and stratified equity reports |

Components to build: registry, model-card store, evaluation harness, runtime monitoring, HITL UX kit, feedback capture, safety-event reporting, provenance store, policy engine, kill switch, equity toolkit, grounding service, model gateway (multi-vendor, never hard-wired to one), and an agent framework with tool scopes. ISO/IEC 42001 alignment by AI GA (K §9.3).
