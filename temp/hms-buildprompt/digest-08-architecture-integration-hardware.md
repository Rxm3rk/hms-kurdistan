# Digest 08: Architecture, integration and hardware engineering specifics

**Read:** R08 §3.11, §4–§10, §12–§14; R06 §2, §3.1–§3.4, §3.6, §5–§8; R16 §2, §4, §6–§10, §12, §14, §16–§17; K §7, §9, App. A; BP §7, §9.
**Notation:**
- K ADR-nnn = K §7.2; BP ADR-nnn = BP §7.2.
- K keeps BP's text for ADR-003, 004, 005, 013, 014, 016, 017, 019, 020, 022, 023 and 024 (K §7.2).
- **K:** = Kurdistan decision. **Research:** = differing research/BP position.
- A source tag on a heading covers every bullet under it unless the bullet has its own.

---

## 1. Reference architecture and bounded contexts

### 1.1 Constitution: rule → CI check
1. One system of record per tenant → journal rebuild test (BP §7.1).
2. Immutable bitemporal facts; corrections are new versions → linter bans UPDATE/DELETE on fact tables (BP §7.1).
3. Strong consistency in the core → Modulith/Packwerk checks; no cross-module transactions outside the kernel (BP §7.1).
4. FHIR, v2 and external formats are generated projections → round-trip and IG-validator tests (BP §7.1; K §7.1).
5. **K:** same signed artefacts in every topology; no cloud-only service on the clinical path → conformance suite on the three-node k3s/RKE2 reference cell and central substrate from M9 (K §7.1).
6. Nothing fails silently (owner, timer, alarm) → chaos tests assert alarms ≤5 min (BP §7.1).
7. Invariants, policy, audit below the API → property tests through every adapter (UI, API, mobile, interface, loader) (BP §7.1).
8. Configuration over code; no forks → branch-per-tenant detector; signed-bundle checks (BP §7.1).
9. **K:** usable PHI stays in the cell and its Kurdistan DR standby; off-site = ciphertext under hospital-held keys → egress tests (K §7.1).
10. AI proposes, humans dispose; agents never touch the DB → DB-credential scanner; `draft-ai` tests (BP §7.1).
- Also: compliance evidence (hazards, audit, SBOM) is a build output (R08 §12.1).

### 1.2 Layers (R08 §12.2; K §7.6)
- **Experience:** web SPA, workstation shell, mobile, portal/kiosk, SMART apps. **K:** React + React Aria, Tauri 2, React Native.
- **Access:** screen-shaped BFFs, FHIR R4 API, SSE/WebSocket gateway, Keycloak + OpenFGA with break-glass (K §7.6; Keycloak runs in each cell, K §7.8).
- **Core:** modular monolith in Kotlin; C#/.NET is the near-tie, decided by M3 (K ADR-002).
- **Satellites:** RCM, ERP, CDS, terminology, Hub, Temporal, docs/print (PDF, ZPL), AI gateway (K: P2, ADR-018), notifications.
- **Data:** PostgreSQL per tenant, backbone + Debezium, Valkey, object store, Iceberg lakehouse. **K:** PostgreSQL FTS + trigram replaces OpenSearch, which stays only for central log and analytics search (K ADR-028).
- **Platform:** CloudNativePG, Argo CD (K: pull mode), OpenTofu, OTel (K: exported to central), KMS; k3s/RKE2 on site.
- **Flow:** core → PostgreSQL → CDC outbox → backbone → satellites, lakehouse, realtime gateway.

### 1.3 Storage shapes per tenant DB (R08 §3.11; BP §7.6)
- **A relational:** enterprise, beds, encounters/ADT, appointments, service requests, medication orders/dispenses/administrations, charges, inventory.
  - FK and exclusion constraints; optimistic concurrency (version/ETag); state machines per R11 §10.
- **B facts:** typed FHIR-shaped JSONB (Observation, Condition, AllergyIntolerance, QuestionnaireResponse, Composition/DocumentReference).
  - Generated columns for indexed keys; concepts mapped to LOINC/SNOMED.
  - Never updated in place; status preliminary → final → amended/corrected/entered-in-error.
  - Each fact has `valid_period`, `recorded_at`, author, attester, source and supersedes-id. Source values: user/device/interface/AI draft (R08); BP lists `ai-draft`, `device`, `migrated`.
- **C journal:** one append-only row per state change (tenant, facility, aggregate, patient, event type, valid and recorded time, actor, on-behalf-of, device, reason, payload, previous version).
  - Written in the same transaction as A/B.
  - It is both the outbox and the write-audit trail.
  - Reads are audited separately in an append-only BALP store.
- **D read models:** boards, worklists, patient summary, census. Rebuildable from C; pushed over SSE.
- **Other stores:** object storage (documents, media, print outputs, waveforms); Valkey as cache/sessions only.
- **Identifiers and time:** UUIDv7 ids (merge-friendly across cells; PG 18 `uuidv7()`); instants in UTC + original offset; partial dates as local dates (year-only DOB); `tenant_id` + `facility_id` on every row (R08 §3.11). Downtime MRN/encounter/accession blocks carry a site prefix (K §7.5).
- **Medication ES:** ES-lite by default (BP §7.6).
  - Full ES for MedicationOrder/Administration only if BCMA p95 ≤500 ms, order-sign ≤1.5 s, tooling ≤8 engineer-weeks and no critical-path cost.
  - Revert if tooling >8 engineer-weeks, BCMA p95 >500 ms, upcasting >20% of the medication squad, or any C1 miss.

### 1.4 Bounded-context map
BP §7.4 is the map of record; K §7.3 keeps it unchanged. Aggregates come from R08 §4.2; arrows from BP §7.4 and R08 §12.4.

| Group | Contexts (aggregates; consistency) | Allowed flows |
|---|---|---|
| Trust Plane | Identity/access (user, role, credential, care-team membership); policy, consent, sensitivity labels; audit (BALP, hash-chained); keys, residency | Trust ⇢ kernel; every PHI access ⇢ audit |
| Patient access and flow | EMPI/identity (patient, identifier, link/merge); scheduling + OPD queue (slot, appointment, resource; strong per resource); ADT, beds, location history | EMPI → ADT, scheduling; scheduling → ADT; ADT → kernel, record, RCM; Hub ↔ ADT |
| Safety Kernel (one transaction boundary) | Orders/CPOE; meds, pharmacy, eMAR, BCMA; results + critical-result service; tasks + owned queues (all strong) | Orders → meds, LIS, RIS, screening, RCM; orders ↔ CDS (order-select/sign); meds → Dose Engine, transfusion check, inventory, record; results → tasks, record; kernel → RCM, analytics (CDC) |
| Regulated Tier 2 (process-isolated sidecars, own release train) | Dose Engine; NEWS2/PEWS/MEOWS; screening presenter; transfusion verification; LIS interpretive rules | Activated by the Boundary Register; flowsheets → EWS → tasks |
| Clinical record | Notes, flowsheets, ED/periop/ICU/maternity (strong per patient) | Record → CDS, front door |
| Diagnostics | LIS core; RIS core (**K:** RIS in the wedge, K App. A.2) | LIS, RIS → results; LIS → interpretive rules |
| Knowledge | CDS + alert registry; content + packs (versioned templates); terminology + licences (read-mostly); Boundary Register | CDS → orders; content → CDS, orders, record; terminology → kernel, RCM |
| Revenue and ERP | Accounts, charge router, claims; stores; workforce; GL export or lite GL (eventual). **K:** dual-currency cash, doctor-fee ledger (K §7.3) | RCM, inventory, workforce → GL |
| Edges | Hub (channel, message, ack; at-least-once + idempotent); AI gateway; replica/lakehouse; front door | Hub ↔ ADT, orders, results, RCM; AI → notes (`draft-ai` only) |

- Orders, Medications and MAR share one transactional boundary: same deployable and DB, separate modules (R08 §12.4; BP ADR-003).
- RCM is a downstream conformist behind an anti-corruption layer. The Hub is the anti-corruption layer for every external format (R08 §12.4; K §7.3).
- Terminology and enterprise config are open-host services. Documents/printing and notifications are generic supporting contexts (R08 §12.4).

---

## 2. Modular monolith, events, workflow and rules

### 2.1 Decomposition and boundaries
- **Why a monolith:** order-sign atomically persists the order, CDS overrides, verification task, MAR schedule and charge events. A dose cannot be "un-administered" by saga compensation, and one artefact suits 2–3-node installs (R08 §4.1; K §7).
- **Core:** one DB per tenant, one schema per module. **Satellites:** RCM/ERP, Hub, CDS, terminology, docs/print, notifications, AI gateway, analytics, portal BFF, Temporal workers (R08 §4.1). Containerised modules satisfy tender "microservices" wording (BP ADR-003).
- A module never reads another module's tables; it calls the API or consumes events (R08 §4.1).
- **CI enforcement:** Spring Modulith verification, Packwerk-style rules, owners, no cross-schema SQL (R08 §13); `@ApplicationModuleTests` (R08 §10). Reopen ADR-003 if boundary violations rise for 2 sprints (BP ADR-003).

### 2.2 Events (R08 §4.3; BP §7.6)
- **Outbox:** the journal is the outbox. Publish iff commit, no 2PC. The relay can duplicate, so consumers are idempotent.
- **Routing:** Debezium routes by `aggregatetype` and keys by `aggregateid`. Clinical streams are keyed by patient.
- **Domain events:** CloudEvents 1.0; Apicurio schemas; backward-compatible changes only; 12-month deprecation; at-least-once.
- **Integration messages:** Hub-generated, with per-patient ordering, MSH-10 idempotency, per-message ack and replay.
- **v2/FHIR triggers:** events map 1:1, e.g. `PatientMerged/Unmerged`, `EncounterMoved`, `OrderVerified`, `MedicationAdministered/Overridden`, `SpecimenRejected`, `ResultAmended/Acknowledged`, `CriticalResultEscalated`, `ChargeGenerated`, `StaffAssignmentChanged`, `IdentityVerified`, `PaymentReconciled`. The catalogue is a published product surface.
- `TaskOrphaned` is a first-class alarm (K §7.5).
- **Failures:** undeliverable messages go to owned, visible queues that page at 5 min, never to a hidden DLT. Contract tests run per consumer.
- **K backbone:** one backbone everywhere: Kafka 4.x KRaft (Strimzi), three small brokers co-located on the three nodes. NATS JetStream everywhere if C9 fails (K ADR-009, §7.6). Research: single-node Kafka at the edge (R08 §6.2).

### 2.3 Workflow (R08 §4.4; BP/K ADR-010)
- **Temporal (MIT):** deterministic workflows, retried activities, months-long timers, signals/queries, worker versioning.
- **Use it for:** discharge (med-rec sign-off, summary, follow-ups, transport, final billing), referrals, prior auth, claims/remittance, interface replay, bulk export, migration, cutover.
- **Never use it for:** order/MAR state or sub-second decisions.
- **K:** Temporal runs on site behind the workflow port, on Postgres persistence; lighter persistence if C9 fails (K ADR-010, §7.4).
- The port and a fork-readiness plan cover Temporal's single corporate steward (BP §7.7). Camunda 8.6+ is rejected on licence.
- Clinicians get a constrained pathway/task-template designer compiling to our task engine, not raw BPMN.

### 2.4 Rules and CDS
- **K/BP:** CQL only from P2, for measures, KPIs and non-device third-party CDS. No CQL or DMN inside the device boundary; Tier 2 calculators are native and deterministic. Spike S11 (≈M20) sizes CQL latency/SOUP (BP ADR-017). Research: CQL for clinical rules (R08 §4.5).
- DMN tables for operational rules (billing edits, scheduling), versioned as configuration, on an Apache-2.0 engine (KIE/Drools DMN candidate) (R08 §4.5; BP ADR-017).
- **CDS Hooks 2.0.1** (R08 §4.5):
  - Hooks: `patient-view`, `order-select`, `order-sign`, `order-dispatch`, `encounter-start`, `encounter-discharge`, `appointment-book`, `medication-refill`, `allergyintolerance-create`, `problem-list-item-create`. Deprecated: `medication-prescribe`, `order-review`.
  - Cards (info/warning/critical) carry suggestions, override reasons, prefetch and a feedback endpoint; ~500 ms per service.
  - Our CDS uses the same hook points as third parties. Override/feedback analytics drive alert-fatigue governance.
- **Drug knowledge:** a licensed KB behind an adapter, the likeliest device component (R08 §4.5). **K:** its snapshot runs on site (K §7.8).

### 2.5 FHIR façade and ADR-001
- **Façade rules** (R08 §4.6):
  - FHIR-first API over a domain-first core; FHIR JSON storage where the resource fits.
  - HAPI structures + official validator; CapabilityStatement per tenant/pack; track R6.
  - Medplum is never a second source of truth (K: a comparator only, K ADR-001).
- **Options:** A = own FHIR-shaped model on PG (default); B = FHIR-native (Medplum/HAPI JPA); A′ = A + HAPI JPA projection store (K §7.4).
- **Spike criteria**, K weight (BP weight) → pass (K §7.4):
  - C1 atomic order-sign, 15 (15) → p95 ≤300 ms at 3× peak.
  - C2 invariants under 10⁶ random command sequences incl. offline-BCMA replays, 25 (25) → zero violations (hard gate).
  - C3 bitemporal "what did the clinician see at 09:12", 10 (10) → p95 ≤1.5 s.
  - C4 FHIR read/search, 5 (10) → p95 ≤300 ms, lag p99 ≤5 s.
  - C5 R4→R6 from unchanged storage, 10 (15) → ≤15 engineer-days; no storage migration.
  - C6 IPS `$summary` + KRG return bundle from the same facts, 5 (10) → 100% validator pass.
  - C7 PITR of a 5-year, 150-bed tenant on on-site hardware, 10 (5) → ≤4 h.
  - C8 new fact type end to end, 15 (10) → ≤3 days.
  - C9 300-bed day on a three-node cell (e.g. 3 × 32 cores, 128 GB, NVMe), 5 (new) → p95 met at ≤60% CPU/memory headroom.
- **Decision rule:** B wins only if it passes C2 and beats A by ≥15 points. The repository abstraction stays; freeze at M3; if C2 fails for both, redesign the order/MAR boundary (K §7.4).
- **S9-K** (M4–M6) re-runs C2 and C9 on the real cell with power- and WAN-cut injection (K §7.4).

---

## 3. Multi-tenancy and enterprise hierarchy

### 3.1 Hierarchy and patient index (R08 §5)
- **Separate axes, not one tree:**
  - organisational: tenant → legal entity → facility → department (Organization.partOf);
  - physical: campus → building → floor → ward → room → bed (Location.partOf);
  - also HealthcareService, the financial axis (ERP) and CareTeam.
- **Scoping:** parents see nested organisations, siblings are isolated, and shared resources are read-only to children.
- **Patient index:** one EMPI and record per tenant; facility MRNs are identifiers on the golden record.
  - Locale-tuned matching (scripts, transliteration); journaled, reversible merges.
  - PIXm/PDQm across tenants.
  - Sensitive data segregated by policy (ReBAC/ABAC + consent), not by separate DBs.

### 3.2 Isolation and Kurdistan tenancy
- **Research ladder** (R08 §5): pooled + RLS (small clinics only); schema per tenant (rejected); DB per tenant in a shared cell (default); dedicated cell; customer-operated.
- **RLS hazards:** default-deny without a policy; owners and `BYPASSRLS` roles bypass RLS unless `FORCE ROW LEVEL SECURITY` is set; FK/unique checks bypass RLS (covert channel); sub-select policies can race (R08 §5). No BYPASSRLS roles (BP ADR-006).
- **K ADR-006:** tenant = contracting enterprise.
  - A single hospital gets its own on-site cell.
  - A group is one tenant on its main hospital's cell. Other hospitals join over dual metro links with a site edge agent only if:
    - 60 days of measured availability show ≥99.95%;
    - the window covers an exam-shutdown period, unless the links are private non-internet circuits;
    - the test is repeated yearly.
  - A hospital that fails gets its own cell and tenant, with identities cross-referenced (P2) until the multi-site cell (P3).
  - Outpatient-tier facilities use the central pooled tier (DB per tenant, FORCE RLS).
  - Research: pooled tier for <150-bed hospitals (BP ADR-006; K App. A.2 KDV-8).
- **K ADR-008 keys:** per-tenant envelope keys with crypto-shredding.
  - On site: a small HSM or TPM-sealed KMS, escrowed at DR under dual control.
  - Off-site copies are under hospital-held keys. No HYOK.

### 3.3 Configuration and packs
- **Chain:** vendor foundation → **Kurdistan pack** → tenant → legal entity → facility → department → unit → user (K §7.7).
  - The most specific setting wins unless a parent marks it `locked`.
  - Safety invariants and Tier 2 activation are vendor-locked.
- **Settings registry:** typed and schema-validated. Every change goes into a versioned, approved change set (openEHR Contribution model); the resolver cache is event-invalidated; tooling covers diff, impact analysis and config tests (R08 §5).
- A multi-entity, multi-currency ledger runs from day one (K §7.7).
- **Pack contents:** terminology bindings, IGs/CapabilityStatements, identifier validators, name/address formats, calendars, languages, claims adapters, tax, statutory reports, retention/consent rules, drug-KB connectors, default content (R08 §5).
- **K pack:** identifier URIs, endpoints, consent rules, residency policy (K §9).

---

## 4. Deployment, cells, offline and HA/DR

### 4.1 Topologies (K §7.8)
- **On-site hospital cell (MVP):**
  - three nodes (or two + witness) on separate UPS feeds;
  - full tenant: core, PostgreSQL with sync standby, backbone, Temporal, Keycloak, Hub, print/queue/device bridge, reporting replica, terminology and drug-KB snapshots;
  - object-lock NAS in a separate fire compartment or building;
  - outbound-only management; co-signed break-glass.
- **Kurdistan central and DR site (central M12; standbys M18):**
  - colocation in Erbil or Sulaymaniyah, with a second site in the other city;
  - PHI-free control plane, pooled tier, encrypted async warm standby per hospital (RPO ≤15 min contract), terminology, analytics, CI reference cell.
- **Site edge agent (MVP, outpatient tier):** a hardened appliance outside the facility's Windows domain (continuity replica, queue, print spool, device bridge).
- **Continuity instance (MVP):** read-only shadow per hospital at DR, with identity independent of the hospital IdP (BP §7.9: break-glass identities, FIDO keys held offline).
- **Later phases:** regional cloud (P2: ciphertext backups, PHI-free services, AI only per counsel); multi-site edge cell (P3).
- **Research:** R08 offers six models (R08 §6.1). BP defaulted to sovereign cloud cells with the edge cell at P3 (BP ADR-025); K reverses this (KDV-1, KDV-2).
- **Platform:**
  - k3s/RKE2 on site, managed or self-run centrally, portability CI from M9 (K ADR-007);
  - CloudNativePG: streaming replication, automated failover, synchronous replicas, PITR backup (R08 §6.1).

### 4.2 On-site cell specifics
- **Hardware [E]** (K §7.8):
  - three servers (16–32 cores, 128–256 GB, NVMe), 2 × 10 GbE switches, object-lock NAS, two double-conversion UPS (≥60 min);
  - ≈US$35–70K for 50–250 beds, refreshed at year 5; paid or leased by the hospital;
  - sized for 300 beds/800 sessions (MVH-100 needs 80–150).
- **Writes and identifiers:** single writer for its tenant (K ADR-025); site-issued UUIDv7s and site-prefixed MRNs/accessions (R08 §6.2).
- **Multi-site enterprise operations:** EMPI merges and cross-site transfers run centrally, propagate as commands, and are accepted by the home site (R08 §6.2).
- **Local CDS:** runs on the drug-KB snapshot and records its version on every check (R08 §6.2).
- **Replication:** async, encrypted, outbound to the DR standby; lag >15 min alarms (K §7.9).
- **Research:** outbox → Kafka mirror to central, plus single-node Kafka and OpenSearch on the edge cell (R08 §6.2).
- **Power (K ADR-026):** UPS per node (≥60 min) + generator auto-start; synchronous commit on battery-backed or power-loss-protected drives; graceful shutdown below 10 min of UPS; mains/generator/UPS monitored; clients autosave and re-authenticate fast.
- **Time (K ADR-026):** a GPS or stratum-1 NTP source per cell. Skew >1 s alarms; a node >5 s out is blocked from clinical writes.
- **Fleet (K ADR-027):**
  - outbound-only management;
  - offline break-glass co-signed by the hospital IT lead or CSO, with single-use sealed credentials, operations plane only, and a recorded session reviewed within 5 working days;
  - spares and remote hands per governorate; Supported Hardware List only; reopen if a cell waits >4 h for hardware.
- **Delivery (K ADR-021):**
  - weekly CD centrally; monthly on-site train N; C2 changes quarterly;
  - rings: reference cell ≥7 days → non-flagship ≥14 days → all (DP#1 never first); one deferral allowed (go-live, mass casualty, shutdown);
  - migrations always roll back to N-1; signed offline media (pinned keys, anti-rollback);
  - max drift N-1 (reopen at >45 days); ≥90 days without call-home, with no lockout.
  - Research: quarterly activation, N-2 on-prem (R08 §10).
- **Licensing:** on-site installs count as GPL distribution, so the unmodified-container rule is checked every release. No AGPL observability on site (K §7.6).

### 4.3 Offline clients and conflicts
- **K ADR-012:** offline = losing the cell (rare) or, for pooled-tier sites, the central site. Mobile offline BCMA is unchanged. Internet loss alone is not offline for a hospital.
- **Tooling:** PowerSync (Postgres → client SQLite, writes applied by our API); Android FHIR SDK; RN SQLite sync (R08 §6.3, §12.5).
- **Conflict policy** (R08 §6.3):
  1. Facts are append-only, so they never conflict.
  2. State transitions sync as commands, re-validated server-side. An offline dose against an order discontinued meanwhile is accepted as fact and flagged to the clinician and pharmacist.
  3. Offline identities get temporary IDs and go to a reconciliation queue.
  4. CRDTs only for draft note text and UI preferences.
- **Activity matrix:** cell during WAN loss vs disconnected mobile (R08 §6.3).
  - Both: vitals, notes, assessments; charge capture.
  - Mobile limited:
    - chart view (scoped cache, staleness banner);
    - BCMA only on orders verified before disconnect, with snapshot time shown;
    - registration with a temporary ID.
  - Cell only: new med orders (local CDS + snapshot), bed assignment (one authority per bed), site-local OR/MRI scheduling, controlled drugs via the local cabinet.
  - Degraded: enterprise bed board read-only; result release deferred; AI only with a local model.
  - Never: identity merges.
- **Never offline:** prescribing without full CDS, bed/OT-slot allocation, identifiers outside pre-allocated blocks, controlled-drug stock, identity merges. At a hospital these apply only if the cell is lost (K §7.9).
- The matrix lives in the hazard log (BP ADR-012).

### 4.4 HA/DR (K §7.9)

- **L0 node loss:** synchronous standby; RPO 0, RTO ≤5 min (contract ≤15 min).
- **L1 internet/WAN loss:**
  - Hospitals: no clinical effect. Channels queue ≥7 days; certificates last ≥90 days; SMS goes via GSM/SMPP; critical messages by voice.
  - Outpatient sites: read-only continuity (≤2 min stale; contract ≤15 min), downtime ID blocks and printed packets.
  - Outpatient lab: middleware holds results; downtime accessions; critical results phoned, read back and back-entered ≤4 h; pre-staging on announced shutdowns; a small cell offered to daily-exposed sites.
- **L1b mains loss:** UPS ≥60 min plus generator, including UPS at pharmacy, ED, ICU, lab and nursing; monthly transfer test; no data loss.
- **L2 site loss:** promote the DR standby (RPO ≤15 min, RTO ≤4 h contract). Lag >15 min alarms; cuts >24 h add a daily encrypted removable backup.
- **L3 ransomware:** immutable backups (≥90 days), clean-room rebuild, continuity instance, cellular clean kit per unit; the cell is a hardened appliance outside the hospital domain. Tenant restore ≤24 h; T0 ≤72 h; 4–6 weeks degraded.
- **L4 prolonged outage:** paper packets every 1–4 h; back-entry with valid time = paper time and recorded time = now (R08 §6.4).
- Single writer per tenant; active-active only for stateless tiers. Continuity copies: encrypted per-unit extracts with local printing, plus a read-only viewer (R08 §6.4).
- **Drills:** monthly game days, quarterly restores, Code-Dark twice yearly per unit, WAN-loss drills on announced shutdowns, annual cyber exercise including estate-down.

---

## 5. Performance and scale

### 5.1 Budget and techniques (R08 §7)
- **Latency budget:** RTT ≤100 ms + BFF p95 ≤300 ms + render ≤300 ms = p95 ≤1 s warm.
- **Data access:** one round trip per screen from precomputed projections; time-partitioned observations, journal and audit with tenant-leading index keys; PgBouncer; read replicas.
- **Caching:** reference data cached in process, event-invalidated; patient data cached briefly and encrypted.
- **K search:** PostgreSQL FTS + trigram, patient search ≤200 ms; reopen if p95 >200 ms on the reference cell (K ADR-028). Research: OpenSearch with ICU, phonetic and transliteration analyzers.
- **Freshness:** SSE boards ≤2 s; reports on a streaming replica; lakehouse ≤15 min. Never shard one patient's record.
- **Load test:** Synthea at 3× the largest customer, with ADT bursts at 07:00/19:00, morning lab floods, med passes at 09:00/21:00.
- **Volumes:** 1,000 beds ≈4,000–8,000 peak users; 500-bed flowsheets ≈120K rows/day; 50 ICU beds ≈576K/day; waveforms outside OLTP; imaging in PACS/VNA (ImagingStudy refs + DICOMweb links).

### 5.2 NFR and SLO table (K §7.10)

| Metric | Engineering | Contract |
|---|---|---|
| T0 writes (ADT, CPOE, eMAR/BCMA, results) at the cell | 99.99% | 99.95%/month, excl. hospital power/network beyond obligations |
| Read and continuity paths | 99.99% | 99.99% |
| In-cell RPO/RTO | 0 / ≤5 min | 0 / ≤15 min |
| Site loss | ≤5 / ≤60 min | ≤15 min / ≤4 h |
| Cyber-recovery | Tenant ≤24 h | T0 ≤72 h |
| Planned downtime | 0 (major DB upgrade ≤30 min/yr) | 0 |
| BFF p95/p99; warm screen / cold chart | 300/800 ms; 1.0/1.5 s | Reported |
| Patient search; order-sign + CDS; BCMA (p95) | 200 ms; 1.5 s; 500 ms | Reported |
| Pooled-tier flows | Usable at 1 Mbps / 300 ms RTT | — |
| HL7 end-to-end | p95 ≤5 s; zero silent drops; alarm >5 min | Reported |
| Orphaned work | 0; alarm ≤5 min | >2 h with patient impact → Level-3 rollback |
| Critical patches | ≤7 days central; ≤14 days on site | Same |

- **Credits:** 5% below 99.95%, 10% below 99.9%, 25% below 99.5%. Termination after three breaches in six months; 5% cap. Hospital UPS, generator, network, server room and the outpatient tier's second WAN carrier are verified at RG1 (K §7.10).
- **Not restated by K** (R08 §12.6; BP §7.11): CDS ≤500 ms per service (fail open except hard stops); reporting replica ≤60 s; FHIR projection lag ≤5 s; event lag ≤2 s; TLS 1.2+; 100% PHI audit; 1-year access report ≤5 s.

### 5.3 Scale and cost (K §7.11)
- **CI load tests:** 300-bed day on reference hardware from M9; 1,000-bed day on the pooled tier from M12. Any p95 regression blocks release.
- **Central capacity [E]:** pooled tier up to 300 outpatient facilities; DR standbys for up to 40 hospitals per central cluster.
- **COGS:** ≤US$4 per bed-month [E]. The drug-KB licence (≈US$50–150K/yr minimum + US$5–20/bed/yr) is the biggest early cost.
- **Research targets:** 3K tx/s sustained, 10K burst per tenant; 2K HL7 msg/s per cell (R08 §12.6).

---

## 6. Frontend and extensibility

### 6.1 Frontend (R08 §8)
- **Platforms:**
  - React/TS web is the single primary UI.
  - The shell adds silent/raw printing, scanners, badge/smart-card SSO, device bridges, kiosk lock-down and SMART/FHIRcast. Browser-only mode serves BYOD.
  - React Native (Expo) with native scanner and secure-storage modules shares TS domain logic.
- **Composition:** monorepo SPA; module-federated slots for trusted plugins; untrusted apps as sandboxed SMART apps synced via FHIRcast.
- **Design system:** two densities; keyboard-first (palette, shortcuts, tab order, macros); banner with two identifiers, photo, allergies, isolation; interruptive alerts only for high severity; colour never the sole carrier; contrast ≥4.5:1; no trailing zeros, always a leading zero; WCAG 2.2 AA (24×24 px targets, Redundant Entry, Accessible Authentication).
- **i18n:** ICU MessageFormat + CLDR; RTL via CSS logical properties with bidi isolation; unambiguous doses; UTC storage with locale calendars (runtime `Intl` checks, Temporal polyfill); multiple name representations; UCUM. **K:** printers shape Kurdish and Arabic (K §9.2).
- **Device rules:** see §10. R08 adds GS1 DataMatrix parsing (GTIN, lot, expiry, serial) for implant UDI, and FIDO2/passkeys.

### 6.2 Extension and configuration (R08 §9; BP ADR-020)
1. **Configuration:** Questionnaire/SDC forms, order sets, rules, worklists, print templates; typed, validated, versioned, tested.
2. **Low-code:** form builder, FHIRPath/CQL expressions, pathway templates; sandboxed, no DB access.
3. **Server plugins:** out-of-process WASM/isolate plugins take events and return effects the core validates; quotas; signed packages.
4. **External apps:** SMART 2.2, CDS Hooks, FHIRcast, Bulk, Subscriptions; app review and scopes.
- **Promotion:** signed, diffable bundles move BUILD → TEST → TRAIN → PROD (+ PLAY), gated by tests (valid orderables, CQL compiles, forms render, labels fit).
- **No forks:** semver foundation with three-way-merged tenant overlays; no customer branches; declared extension points; OpenFeature-style flags; published deprecation windows.

---

## 7. Safety-critical engineering practices (R08 §10)
- **Regulatory segmentation:**
  - Potential-SaMD components (dose calculators, interaction and dose-range checks, early-warning scores, AI suggestions) get separate versioning, an IEC 62304 lifecycle, an ISO 14971 risk file, a SOUP list and release notes. Everything else releases continuously.
  - **K:** keeps Tier 2 sidecars (BP ADR-016). No local regulator: ISO 13485 discipline from M0, certificate deferred (KDV-3).
- **Safety case:** risk management plan, hazard log, safety case report, named CSO (DCB0129/0160 style); every backlog item linked to hazards; safety case generated per release.
- **Testing:** property tests for order, MAR and encounter state machines; Modulith module tests; Testcontainers against real Postgres and the backbone; contract tests for every REST/event consumer and v2 profile; HL7 FHIR validator; Playwright clinical scenarios; Synthea + locale-specific names and identifiers; performance, chaos and DR drills; IEC 62366-1 summative usability for device-class modules.
- **Change delivery:** clinical changes default off and activate per tenant in windows; a kill switch per CDS rule; expand/contract migrations, online index builds, background backfills, compatible events, blue/green stateless tiers, major PG upgrades via logical replication; shell versions decoupled from server versions.
- **Observability:** OTel from browser to interfaces; clinical SLOs (chart-open, order-sign, BCMA p95; ADT latency; results-to-inbox; interface queue age; continuity freshness); PHI-free tokenised telemetry; error budgets; severity tied to patient-safety impact. **K:** telemetry exported centrally (K §7.6).
- **Security:** STRIDE + LINDDUN; zero trust; TLS; AES-256 at rest; break-glass with retrospective review; BALP audit of every PHI read/write, with patient access reports and snooping detection; immutable backups, SBOMs, signed images; EU CRA reporting from 11 Sep 2026, obligations from 11 Dec 2027. **K:** ISO 27001 at M24; penetration test by M14, then annual (K §9.3).
- **Migration:** extract → stage in the lakehouse → ConceptMaps → EMPI dedup before load → reconcile (counts, checksums, clinician samples); ≥3 mock conversions; read-only legacy viewer; Temporal pipelines.

---

## 8. Integration Hub

### 8.1 Ownership and channel operations
- **Ownership:** the native Hub owns every interface and runs in each cell; central adapters run centrally (K §9, §9.2; BP ADR-014).
- **Per channel:** an owner, ack state, an owned DLQ alarmed at 5 min, and a replay console. Zero silent drops (K §9).
- **Go-live:** war-room dashboards and contract tests guard against a repeat of the VA "unknown queue" (149 harm events) (R08 §13).
- **Stack:** HAPI v2/FHIR, a DICOM toolkit, Camel-style routing (R06 §7.2).
- **Optional engines:** OIE (MPL-2.0) or a customer engine for site transforms only, under a patch-lag policy: CVE monitoring, plus a patched build or compensating controls (BP ADR-014; R06 §7.2). On 16 Oct 2026 OIE 4.6.0 was still the latest release; the Sep 2026 CVE fixes were merged but unreleased (R06 §7.2).
- **No hard dependencies:** not on Mirth (commercial since 4.6) nor on any cloud FHIR service (R06 §6, §7.2).

### 8.2 HL7 v2 engine (R06 §3.1)
- **Versions:** accept 2.3–2.8 as dialects; tolerate Z-segments; one conformance profile per interface.
- **ACKs:** original (MSA-1 AA/AE/AR) and enhanced (CA/CE/CR via MSH-15/16).
- **Transport:** MLLP `<VT> … <FS><CR>`, over TLS across zones.
- **Guarantees:** per-patient ordering (A08 never overtakes A01); MSH-10 idempotency; store-and-forward with replay; alerted dead letters; message-level audit retention.
- **Mappings:** v2-to-FHIR IG 1.0.0 only, never private (BP §9).

### 8.3 Message baseline
- **K MVP:** ADT, OML/ORM, ORU, SIU, DFT, MDM, RDE/RDS/RAS, MFN, VXU, REF/RRI; PDF/A + FHIR documents from one source; ATNA/BALP (K §9).

| Domain | Messages (R06 §3.1) |
|---|---|
| ADT | A01–A08, A11–A13, A21–A27, A28/A31, A40 (+A47), A60 |
| Orders | ORM^O01, OML^O21/O33/O35, OMG^O19, OMI^O23; ORL/ORG/ORI |
| Results | ORU^R01, ORU^R30–R32, OUL^R22 |
| Scheduling | SIU^S12–S26; SRM/SRR |
| Charges | DFT^P03/P11, BAR^P01/P05/P06 |
| Documents | MDM^T01–T11 |
| Pharmacy | RDE^O11, RDS^O13, RAS^O17, RGV^O15 |
| Other | VXU^V04; MFN^M01–M16; QBP/RSP (PDQ, PIX) |

### 8.4 FHIR façade
- **Projection:** a projection service keeps a materialised R4 store for read/search, `$export`, `$summary`, `$docref` and Subscriptions (R06 §7.1).
- **Writes:** only Appointment, QuestionnaireResponse, DocumentReference, device/patient Observation, Consent and Task are accepted. They become domain commands and never write into the projection (R06 §7.1; BP ADR-005).
- **Coded elements:** keep local code, standard codes, display, original text and code-system version. Provenance records the interface, device or AI source (R06 §7.1).
- **Versions:** run several side by side, R4 now and R6 when IGs need it. Skip R4B as a server target; use backports rather than R5 (R06 §7.1, §3.2.1, §8).
- **K scope:** R4, IPA 1.1, SMART 2.2 with PKCE, Bulk `$export`, Subscriptions, and IPS 2.0.1 `$summary` from day one (K §9).
- **R6 changes** (~2027): dosage reorganised (MedicationRequest/Dispense/Statement, Dosage, Timing); Observation `organizer`; 33 resources leave core, incl. ChargeItem, Invoice, Contract, InsurancePlan, SupplyRequest/Delivery (R06 §3.2.1).
- **Finance API:** no ChargeItem/Invoice as the canonical model. The external finance API uses only R6-core resources: Account, Claim, ClaimResponse, Coverage, CoverageEligibilityRequest/Response, ExplanationOfBenefit, PaymentNotice, PaymentReconciliation (R06 §3.2.1).
- **Validation:** pin IG versions (they bind tighter than FMM) and validate in CI (R06 §7.4).
- **REST:** conditional create/update for idempotent interfaces; history; batch/transaction; chaining, `_include`/`_revinclude`, `_has`; `$everything`, `$validate`, `$match`, `$docref`, `$summary` (R06 §3.2.2).
- **Subscriptions and Bulk:** topic Subscriptions via R5 Backport 1.1.0; Bulk `$export` (system, Patient, Group) as async NDJSON under Backend Services, Bulk 3.0.0 (R06 §3.2.2).

### 8.5 SMART, CDS Hooks, FHIRcast, IPA, IPS
- **SMART 2.2.0:**
  - `.well-known/smart-configuration`; EHR and standalone launch;
  - v2 scopes (`user/Encounter.rs`); `private_key_jwt` preferred;
  - Backend Services, token introspection, App State, User-Access Brands;
  - PKCE mandatory (S256 only, never `plain`);
  - mTLS for gateways (R06 §3.2.3, §7.5).
- **CDS Hooks 2.0.1:** `patient-view` and `order-sign` mature; `order-select` documented; `encounter-start`, `encounter-discharge` and `appointment-book` at "submitted" level (R06 §3.2.3). Third-party Hooks P2 (BP §9).
- **FHIRcast 3.0.0:** hub-based context sync (Patient-open, ImagingStudy, DiagnosticReport) (R06 §3.2.3).
- **IPA 1.1.0:** the default patient-access API (Patient, AllergyIntolerance, Condition, MedicationRequest/Statement, Immunization, Observation, DocumentReference, `$docref`) (R06 §3.2.4).
- **IPS:** 2.0.1 (ISO 27269:2025). **K:** day one (K §9). Research: BP §9 put it at P2.

### 8.6 DICOM, lab and devices
- **DICOM:** MWL (C-FIND) provider, MPPS receiver, Storage Commitment awareness, DICOMweb client (QIDO-RS, WADO-RS, STOW-RS), IHE IID viewer launch; OMI/ORU with the RIS (R06 §3.4, §8; K §9).
- **IHE RAD:** plan SWF.b, IOCM, PIR, XDS-I.b, WIA, AIR, IMR (R06 §3.4).
- **K imaging tier:** dcm4chee or an unmodified Orthanc container; OHIF viewer (K §7.6).
- **K analysers:** through middleware, with ASTM/CLSI LIS01-02 for legacy and IHE LAW as the target; POCT through a data manager (K §9). Research: CLSI LIS1-A/LIS2-A2, IHE LAW v2.5.1, POCT1-A (R06 §3.4).
- **Lab coding:** LOINC orders/results; UCUM units; SNOMED specimens. Import manufacturer LIVD files, pinned to what manufacturers publish, since the IG is still a ballot (R06 §3.4, §8).
- **Devices:** gateways send ORU^R01 coded in 11073-10101; IHE DEV (DEC, ACM, PIV, IDCO). A device service exposes Observation/Device/DeviceMetric; SDC comes later (R06 §3.4).

### 8.7 Identity, documents, audit, consent (R06 §3.3, §3.6, §7.5)
- **EMPI matching:**
  - Fellegi–Sunter: m/u per field via EM; summed weights against upper/lower thresholds with a clerical-review band; blocking; Jaro–Winkler;
  - a deterministic shortcut only for reliable IDs;
  - expose PIXm, PDQm and `$match` with grades; emit v2 A40/A47 and FHIR link events.
- **Profiles:** PIX/PDQ, PMIR, mCSD; XDS.b, XCA/XCPD, XDR/XDM, MHD. **K:** no national exchange to connect to [L] (K §9).
- **Audit:** ATNA (TLS syslog + node authentication), BALP AuditEvent, and Provenance for author, device and AI agent, as a separable, testable logging module.
- **Consent:** FHIR Consent, BPPC, PCF, purpose-of-use, security labels.

### 8.8 Kurdistan pack (K §9.1; replaces national rails)

- **R1:**
  - KRG MoH returns (outpatient; inpatient at R2a);
  - notifiable diseases from LIS results and diagnoses (WHONET/GLASS P2);
  - insurer/corporate/NGO document packs (PDF + structured summary; FHIR Claim where accepted);
  - semi-integrated card terminals; wallet/QR payment links at R1.1 (examples: FIB, FastPay, ZainCash, Qi Card; partners chosen by M12);
  - WhatsApp, Viber, SMS and per-site GSM/SMPP;
  - identity documents (national card barcode/OCR, residency card, passport MRZ; no online check);
  - reference labs (v2/FHIR, PDF fallback);
  - daily summarised GL journals with drill-back.
- **R1.1:** DHIS2 data-value sets (if used); claims automation.
- **R2a:** births, deaths (ICD-10 WHO certificate) and a locked MLC register. **R2b:** blood banks (paper issue, relabelled). **M48:** Iraq federal pack.
- Every item except reference labs and the Iraq pack is an [L] local assumption. OpenHIE-style point of service; R06's national phases are out (R06 §8).

### 8.9 Other pins (R06 §2) and Phase 0 (R06 §8)
- **Pins:** HL7 v2 2.9.1 latest (field: 2.3–2.5.1); FHIR R4 4.0.1; SDC 4.0.0; CQL 1.5.x (2.0.0 current); OIDC Core 1.0. US/UK/EU-only standards are out (K §9).
- **Phase 0:** coded-data discipline (local + standard codes, versions, UCUM, provenance, AI labels); terminology and licence-entitlement services; EMPI; v2; imaging; lab; FHIR façade with a CDS Hooks client; ATNA/BALP; safety case.
- **No-regret:** R6 addable without model change; IPS everywhere; Subscriptions for notifications; PDF/A + structured document from one source; AI content labelled via Provenance.

---

## 9. Terminology and licensing
- **K ADR-015:**
  - codes: WHO ICD-10 (with WHO commercial-use permission), LOINC, UCUM, ATC (WHOCC file licence), the regional drug master, local codes;
  - SNOMED CT via Snowstorm only if a licence is taken (Q-K9); until then the Global Patient Set where useful;
  - on-site cells get terminology and drug-KB snapshots, so Snowstorm's Elasticsearch never runs on site;
  - Iraq is probably not a SNOMED member (fees by income band) (KDV-14).
  - Research: Snowstorm + HAPI (BP ADR-015).
- **Licences (R06 §5):**
  - **SNOMED CT:** free in 54 members. Non-members need an MLDS licence (World Bank fee band, annual Statement of Usage, web/mobile surcharges, possible exemptions). The vendor becomes an Affiliate and sublicenses customers.
  - **Global Patient Set:** CC BY-ND 4.0, with IDs, FSNs, English terms and active flags only. No hierarchy, so no subsumption and not enough for full CDS.
  - **LOINC, UCUM:** free with attribution; LOINC content is unmodifiable.
  - **ICD-11:** free (CC BY-ND 3.0 IGO; WHO API or offline container).
  - **ICD-10 (WHO):** commercial use needs permission.
  - **ATC/DDD:** files and redistribution need WHOCC permission or purchase.
  - **UMLS:** never a runtime dependency.
- **Service (R06 §7.3, §3.2.5):**
  - FHIR `$lookup`, `$validate-code`, `$expand`, `$translate`, `$subsumes`; implicit SNOMED (`?fhir_vs=ecl/...`) and LOINC value sets;
  - HAPI for LOINC, ICD, local codes and ConceptMaps; the WHO ICD-API container for ICD-11; OCL for OpenHIE.
- **Server trade-offs:** Ontoserver (commercial, fullest ECL), Snowstorm (SNOMED-centric, ops burden), HAPI JPA (weaker ECL), OCL (no full reasoner) (R06 §5).
- **Content and mapping:**
  - packs carry editions, value sets, ConceptMaps (local lab → LOINC; charge → procedure code) and licence entitlements;
  - local-first mapping, with LIVD import and AI-suggested maps that need human sign-off;
  - mapping coverage is a go-live metric (R06 §7.3).
- **Dual coding:** ICD-10 for billing, ICD-11 for statistics where required, derived from SNOMED maps where available (R06 §7.3).

---

## 10. Hardware and peripheral integration (R16)

### 10.1 Planes, events, safety stance (R16 §2)

| Plane | Runs on | Integrates | Transport |
|---|---|---|---|
| A Shell HAL | Each PC, kiosk, thin client | Printers, scanners, badge/ID readers, biometrics, signature pads, card terminals, cameras | USB/HID, serial, PC/SC, TWAIN/WIA, SDKs, raw TCP 9100 |
| B Site edge agent | Edge cell or appliance | Nurse call, RTLS, PBX/CTI, PA, BMS, IoT, pneumatic tube, displays, site print | MLLP, WCTP, SIP, BACnet/IP, Modbus TCP, MQTT, webhooks, IPP |
| C Cloud adapters | Hub | Messaging, payment gateways, ID services, cloud contact centres | HTTPS/webhooks, FHIR, OAuth2/mTLS |

- **Plane rule:** an integration lives in the lowest plane that meets its downtime need. Wristband printing is never cloud-only (R16 §2.1; BP ADR-011).
- **K ADR-011:** plane B merges into the on-site cell for hospitals; outpatient sites keep a hardened appliance. Plane C runs as central adapters (K §9.2).
- **Canonical events:** `StaffAssignmentChanged` (ADT A08 PV1-7/ROL or CareTeam/PractitionerRole; consumed by nurse call, comms, RTLS, ACM); `LocationObserved`/`PresenceDetected`/`BoundaryCrossed` (MEMLS PCD-16 ORU^R45); `AlertRaised`/`Disseminated`/`Acknowledged` (ACM PCD-04..07); `DeviceStatusChanged`/`EnvironmentExcursion`; `TokenIssued`/`Called`/`Served`/`Recalled`; `IdentityVerified`; `PaymentCaptured`/`Refunded`/`Failed`; `PrintJobCompleted`/`Failed`.
- **Safety stance** (also K §9.2):
  - integrate cleared alarm platforms; never build alarm routing;
  - nurse call (UL 1069 / DIN VDE 0834) is fed ADT and assignments, its events are consumed, and it is never a dependency for call delivery;
  - RTLS infant protection keeps the vendor's alarm path;
  - fridge and med-gas monitoring is consumed, never replaced;
  - wristband templates are under change control with scan-verification;
  - the HMS is never in the primary alarm path.

### 10.2 Telephony and messaging (R16 §4)
- **CTI (P2):** screen pop (`callpop?ani=…`), softphone, events logged as `Communication`; SIP; WCTP.
- **IVR:** Appointment/Task via the scheduling API; every action audited; PHI release needs DOB + MRN plus OTP. **K:** P2, same rule (K §9.2).
- **Code-event orchestrator (P2):** logs activations and responders; sits beside the life-safety path, never in it.
- **Pricing:** messaging at cost plus a capped margin (K §9.2); WhatsApp bills per delivered template (R16 §4.3).
- **K release rule (MVP):**
  - WhatsApp, Viber, SMS;
  - report release needs OTP to the registered mobile **plus** a knowledge check at link open;
  - links single-use, valid ≤72 h; no clinical content in bodies;
  - SI-21-labelled results and pregnancy tests never released by message;
  - every release BALP-logged.
  - During shutdowns: SMS via the per-site GSM/SMPP gateway; critical messages by voice (K §9.1, §9.2).

### 10.3 Queues, kiosks, signage (R16 §6)
- **Queue engine:** native, since queues are workflow state tied to encounters, orders and billing.
  - Displays are browser signage players (HTML over WebSocket from the agent).
  - Tokens print on ESC/POS.
  - QMS adapter (Qmatic/Wavetec) at P2.
- **Acceptance list (Rajasthan QMS/01–12):**
  - auto-token at check-in; display "if installed";
  - masked token numbers; call-next updates display and app;
  - no-show recall queue; end-of-day expiry; one token across queues;
  - generation/call/consumption timestamps; TAT dashboards;
  - blood-bank and pharmacy displays.
- **K MVP:** queue state in the cell or agent; ESC/POS tokens; RTL HTML signage (K §9.2).
- **Kiosks (P2):** check-in, ID capture, payment, token and printing on an industrial PC (2D imager, 80 mm printer, PC/SC reader, terminal, UPS); assigned-access lockdown.
- **Signage:** schedule-driven HTML; emergency override; RTL; static QR maps at MVP.

### 10.4 Payments (R16 §7)
- **No PAN, ever** (K §9.1, §9.2).
  - The HMS sends `amount, reference, type` and receives `approved/declined, auth code, masked PAN, token, scheme`.
  - Card data never touches HMS memory, logs or networks.
  - P2PE, MPoC SoftPOS and hosted pages are also allowed.
- **Patterns:** (1) local semi-integrated via the HAL, LAN-capable during WAN loss (terminal-dependent); (2) acquirer-cloud push (API → terminal by ID → webhook), the multi-site default; (3) dynamic QR with webhook + status poll (static QR needs manual reconciliation); (4) payment links over messaging; (5) kiosk via 1–3.
- **K partners:** wallet/QR links (examples: FIB, FastPay, ZainCash, Qi Card; partners chosen by M12). India/GCC partners are out (K §9.1).
- **Cashier shift:** float → transactions by tender → denomination count → variance approval → handover. **K:** dual-currency cash (K §7.3).
- **Three-way reconciliation:** HMS receipts ↔ terminal batches ↔ acquirer settlement and bank files (MDR, chargebacks); unmatched items go to a work queue.
- **Refunds:** to the original instrument; cash refunds need approval thresholds; deposits reconcile against the final bill.
- **Downtime:** standalone terminal with the reference back-entered; static QR; reconciliation queue; payment never blocks care. **K:** no payment rule may delay a verified time-critical inpatient dose (KDV-15).

### 10.5 Identity documents (R16 §8)
- **K:** national card (barcode/OCR), residency card and passport MRZ; no online verification; "verify later" (K §9.1). Research ID rails (Emirates ID, Yakeen, Nafath, Aadhaar, ABHA) are out.
- **Design rules:**
  1. Store `IdentityVerified {method, assurance level, source, timestamp, operator, evidence hash, result}` as Provenance, separate from the identity record; identifiers encrypted or tokenised.
  2. Never persist raw biometrics.
  3. Lookups fail open: registration proceeds with a flagged identity, and a reconciliation queue completes verification.
  4. Name pairs fill distinct name-use fields.
- **Passports:** ICAO 9303 via a full-page MRZ scanner with optional RFID. With no reader, manual entry is flagged "unverified" (R16 §14.2).

### 10.6 Printing (R16 §9.1–§9.2; K §9.2)
- **Why native:** web printing lacks silent printing, tray selection, raw passthrough and enumeration.
- **Rendering:** server-side per printer DPI and firmware. Zebra `^PA` (bidi, shaping, OpenType) needs firmware V60.14/V50.14+, UTF-8 `^CI28` and a downloaded font with the glyphs. If the printer cannot shape, rasterise to `^GF`. Golden-image regression tests cover both paths. **K:** Kurdish and Arabic shaping.
- **Wristband content:** ≥2 identifiers + barcode (preferably DataMatrix with MRN + encounter; GS1 option); newborn names never truncated; optional alert band.
- **Verification:** scan-verify the first band after a template or printer change; log `PrintJobCompleted` with the template version.
- **Other printers:** A4/A5 with tray selection and follow-me printing; 80 mm ESC/POS for tokens and receipts; PHI classification on every job.

### 10.7 Scanners, signatures, badges (R16 §9.3–§9.6)
- **Scanners:**
  - keyboard wedge loses control characters, so use HID-POS or USB-CDC to keep the GS1 FNC1/GS separator for GTIN/lot/expiry (K §9.2);
  - the shell emits `BarcodeScanned{symbology, raw, parsedGS1}`;
  - BCMA mobiles are healthcare-grade Android with MDM and badge unlock.
- **Document scan:** TWAIN/WIA bridge into `DocumentReference`, with barcode cover sheets and OCR indexing.
- **Signatures:** image plus stroke data where lawful, bound to the document hash. **K:** on-glass MVP, pads P2.
- **Badge tap:**
  - PC/SC/HID reader (HID Prox/iCLASS/SEOS, MIFARE DESFire) → shell → Keycloak step-up bound to the workstation certificate → session swap in <2 s [E]. **K:** MVP at ≤2 s.
  - Co-signature, controlled drugs and break-the-glass need tap + PIN.
  - Imprivata where present (P2).

### 10.8 BMS and IoT (R16 §10)
- **Cold chain:**
  - an `EnvironmentExcursion` at location X auto-quarantines the blood units or vaccine lots there, opens a QA disposition task, and records the excursion in each unit's chain of custody;
  - basis: CDC guidance (data loggers, a backup device, calibration certificates, no out-of-range use unless confirmed safe);
  - **K:** MVP (K §9.2). Research: P2 (R16 §16).
- **BMS/med gas:** BACnet/IP, Modbus TCP, KNX, OPC UA, MQTT, for context only:
  - isolation pressure loss → bed-assignment block;
  - OR temperature/humidity → board alert;
  - med-gas area alarm → unit banner + incident record;
  - never the annunciator.
  - **K:** mains/generator/UPS signals MVP (K §9.2; ADR-026).
- **Pneumatic tube:** R16 P3; **K:** never. Bedside terminals send urgent requests only via nurse call (no K tag).

### 10.9 Downtime behaviour (R16 §12)
- **Unaffected life-safety:** nurse call (stale ADT names; feed paused if the agent is down); BMS/med gas.
- **Local, MUST:** wristband/label printing from the edge cache (census, pre-registered patients, downtime MRN blocks). If the agent is down, the shell prints to USB from cached templates. Local ID reads keep working.
- **Caches:** BCMA via a time-bounded offline MAR cache; badge SSO cached for the downtime viewer only, with local downtime accounts and sealed break-glass.
- **Queued:** SMS/WhatsApp (never time-critical alerts); RTLS events buffered by the agent and marked "late".
- **Degraded:** the agent issues tokens (pre-printed tickets if it is down); kiosks issue tokens only; terminals run standalone (reconciliation queue); screen pops lost (callback queue); SaaS comms → DECT/PA.
- **Verify later / deferred:** online ID lookups never block registration; fridge quarantine back-dated on reconnect; T&A punches batch-imported.
- **K reading:** for hospitals, "core down" means losing the cell (rare); internet loss is not offline; external channels queue ≥7 days. Outpatient sites follow R16 with the pooled tier as the core (K ADR-011, ADR-012, §7.9).
- **Drills:** encode the matrix in the hazard log and Code-Dark drills; test every degraded mode before go-live (R16 §17).

### 10.10 Reference architecture (R16 §14)
- **HAL contract:** a versioned JS bridge in which every call returns typed results plus an audit ID:
  - `hal.print.label/raw/document()`;
  - `hal.scan.onBarcode/document()`;
  - `hal.id.read({type})`, `hal.bio.capture()`, `hal.auth.onBadge()`;
  - `hal.sign.capture()`, `hal.pay.request()`, `hal.camera.photo()`, `hal.kiosk.lock()`.
- **Capabilities:** `hal.capabilities()` reports devices attached, healthy and permitted per workstation profile and user. The UI degrades gracefully: with no shell, print via the site print service.
- **Drivers:** signed plugins (ZPL/ESC-POS, spooler with tray control, PC/SC, HID/serial GS1, TWAIN/WIA, vendor SDKs) that load only if signature and policy allow.
- **Shell:** caches templates, the unit's wristband queue and downtime accounts, and prints to USB with no network. Supports N and N-1 servers. WebHID/WebUSB are a fallback only.
- **Edge agent** (K: in the cell for hospitals, an appliance for outpatient; K ADR-011):
  - one signed container set (BP pair: 4 vCPU, 16 GB, 200 GB SSD each);
  - functions: protocol bridges, print service, signage, local queue, continuity caches, downtime report push, device-health monitoring, store-and-forward with idempotency keys and ordered replay;
  - management: zero-touch certificate enrolment, signed config, no remote shell by default, audited time-boxed break-glass, outbound mTLS only.
  - It never holds the only copy of clinical state; it is home only for print spools, the day's queue state and buffered device events.

### 10.11 MVP tags (R16 §16 vs K §9.2)
- **MVP in both:** shell HAL; edge print spool and device bridge (K: in the cell or appliance); shaped wristbands; SMS/WhatsApp (K adds Viber, GSM/SMPP); queue state, ESC/POS tokens, HTML signage; semi-integrated terminals; on-glass signature; tap-to-switch.
- **R16 MVP, carried into K as rules:** care-team assignment feeding nurse call; no PAN, with three-way reconciliation (K §9.2; BP §9.2).
- **K raises to MVP:** passport MRZ and cold-chain quarantine (R16: P2); building power signals.
- **P2 in both:** ACM consumer, RTLS ingestion, signature pads, IVR.
- **K never:** pneumatic tube (R16: P3); alarm, nurse-call and RTLS engines.
- **R16 tags K does not mention:**
  - P2: CTI, secure messaging, code-event orchestrator, kiosks, QMS adapter, infant protection, Imprivata;
  - P3: hand hygiene, BMS points, med gas, bedside terminals;
  - MVP-lite: T&A import.

### 10.12 Implications (R16 §17, K notes inline)
1. Lowest-plane rule as an ADR (K: plane B inside the cell).
2. Shell and agent ship in the first train, with core signing, SBOM and fleet.
3. Care-team assignment is a core domain (BP ADR-024).
4. No alarm, nurse-call or RTLS engines.
5. RTLS times are proposals; they never overwrite attested times.
6. Queue state survives WAN loss.
7. Payment drivers with reconciliation and deposit refunds (K: partners by M12).
8. One `IdentityVerified` contract.
9. Template service with raster fallback and golden images.
10. HAL checklist includes mTLS workstation recognition.
11. Certified-hardware programme (K: Kurdistan list).
12. Pass-through pricing; hardware via SI partners.
13. Downtime matrix in the hazard log and drills.
14. One VLAN per device class; agent is the only bridge; audited calls; IEC 80001-1 network document.
15. Teaching-hospital biometric imports (India-only; no K equivalent).

---

## 11. Risks and implications (R08 §13, §14)

### 11.1 Risks: L/I → mitigation (K delta)
1. Scope explosion (H/H) → wedge sequencing; integrate LIS/PACS/ERP before replacing them.
2. Content depth (H/H) → content factory; importers; foundation packs.
3. Monolith decay (M/H) → Modulith CI; Packwerk rules; no cross-schema SQL.
4. Write ceiling (L-M/H) → cells; per-tenant DBs; partitioning; Citus spike (K: cells sized for 300 beds).
5. Bitemporal complexity (M/M) → platform library; full ES only where justified.
6. FHIR churn (H/M) → façade + codegen; profile packs; R6 tracking.
7. Silent interface failures (M/Critical) → ack state, owned queues, alarms, replay, contract tests.
8. Offline conflicts (M/Critical) → single writer, append-only facts, command revalidation, reconciliation queues (K: S9-K).
9. OSS licence changes (M/M) → foundation-governed deps; SBOM licence scanning (K §7.6 lists).
10. Cloud deprecation (M/M) → own the FHIR layer.
11. SaMD reclassification (M/H) → segregated 62304 modules (K: KDV-3).
12. Ransomware (M/Critical) → immutable backups, isolated recovery, continuity copies (K §7.9 L3).
13. On-prem drift (H/M) → N-2, automated upgrades (K: N-1, monthly train).
14. Low bandwidth (M/H) → edge cells; one round trip per screen; 1 Mbps tests.
15. AI errors (M/H) → draft states, provenance, evaluation, kill switches (K: AI P2).
16. Localisation (H/M) → owned packs; i18n day one; RTL suite.
17. Talent (M/M) → mainstream JVM; academy (K: S18-K survey).
18. Config sprawl (M/H) → three-way-merged overlays; config tests.

### 11.2 Implications (R08 §14)
1. ADRs 001–010 now (K register: K §7.2).
2. Clinical fact platform first: journal, bitemporal versions, entered-in-error, provenance, BALP.
3. The Orders/Meds/eMAR boundary is sacred; design its state machines with pharmacists and nurses before UI.
4. The Hub is a day-one product.
5. Ship the shell early; there is no go-live without wristbands.
6. Configuration is a product (registry, inheritance, change sets, bundles, overlays).
7. One set of Helm/GitOps artefacts for every cell (K: reference-cell CI from M9).
8. Offline matrix in the hazard log; continuity, downtime printing and back-entry before the first inpatient go-live.
9. R4 externally via a generated, tested mapping layer.
10. Isolate SaMD logic from the first commit (K: Dose Engine P2 plus a fallback control set, KDV-5).
11. AI scaffolding at MVP (K: P2, ADR-018).
12. Licence hygiene; no cloud-only health API.
13. Load tests with p95 build gates (K: 300-bed day M9; 1,000-bed M12).
14. Localisation packs as owned products.
15. CDC → lakehouse from day one; OMOP and SQL-on-FHIR views (K: central).

---

## 12. Ambiguities and conflicts
- **Cold-chain quarantine:** K §9.2 MVP vs R16 §16 / BP §9.2 P2. Kurdistan: MVP.
- **IPS:** K §9 day one vs BP §9 P2 (R06 §8 agrees with K).
- **Passport MRZ:** K §9.2 MVP vs R16 §16 / BP §9.2 P2.
- **Wallet links:** K §9.1 says R1.1; K §9.2 lists them under MVP plane C.
- **BAR:** in R06 §8 Phase 0, but K §9 / BP §9 list DFT only.
- **Documents:** K §9 "PDF/A + FHIR" vs BP §9 "PDF/A + CDA/FHIR".
- **CDS Hooks client:** R06 §8 Phase 0 vs BP §9 (kept by K) third-party P2.
- **CQL:** R08 §4.5 clinical rules vs BP ADR-017 (kept by K) P2, non-device.
- **AI scaffolding:** R08 §14 #11 MVP vs K ADR-018 P2.
- **Analyser standards:** worded differently in K §9, BP §9 and R06 §3.4.
- **NFR rows:** K §7.10 omits some BP §7.11 / R08 §12.6 rows; whether they lapse is unstated.
- **Licence-entitlement service:** absent from K ADR-015, as is date-of-service code versioning (BP ADR-015; R06 §7.3).
- **Edge Kafka:** R08 §6.2 single node vs K ADR-009 three brokers.
- **R16 §12 "cloud core down":** no direct hospital equivalent; §10.9 reads it via K ADR-011/012.
