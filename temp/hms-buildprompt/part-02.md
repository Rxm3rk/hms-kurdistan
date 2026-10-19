
---

## 4. Fixed technical decisions

### 4.1 Technology stack

Pin each component to the newest generally available release that has had at least one patch release, is supported by the components that depend on it, and meets the minimum below. Pin it in the Gradle version catalogue, the pnpm lockfile and the Helm charts, and record the pinned set in ADR-002 and the SBOM. Re-resolve versions only at phase boundaries, through the dependency scorecard (§4.3).

| Layer | Choice | Licence | Source |
|---|---|---|---|
| Backend language and runtime | Kotlin 2.x on OpenJDK 25 LTS (21 minimum) | Apache-2.0; GPLv2+CE | K ADR-002. C#/.NET is the recorded near-tie; switching needs an ADR backed by the S18-K talent survey |
| Backend framework | Spring Boot (current GA line) with **Spring Modulith** for module boundaries, events and verification | Apache-2.0 | K §7.6 |
| Build | Gradle (Kotlin DSL), version catalogue, convention plugins in `build-logic/` | Apache-2.0 | [P] |
| Database | PostgreSQL 18 (17 minimum) on CloudNativePG, one database per tenant; on site, three instances with quorum synchronous replication (§5.1) | PostgreSQL | K §7.6; [P] quorum |
| SQL access and migrations | jOOQ open-source edition (type-safe SQL, works naturally with exclusion constraints and range types); Flyway community edition | Apache-2.0 | [P] |
| Event backbone | Kafka 4.x in KRaft mode via Strimzi (three small brokers on the three cell nodes); Debezium outbox CDC; CloudEvents 1.0 envelopes; Apicurio schema registry. **Fallback:** NATS JetStream everywhere if the on-site footprint test (C9) fails | Apache-2.0 | K ADR-009 |
| Workflow | Temporal on PostgreSQL persistence, used only behind a `WorkflowPort` interface | MIT | K ADR-010 |
| Identity and authorisation | Keycloak (OIDC, WebAuthn/passkeys, federation to the hospital IdP); OpenFGA (relationship-based checks such as care relationships), both wrapped by the Trust Plane SDK | Apache-2.0 | ADR-013 |
| Cache | Valkey, cache only, never a system of record | BSD-3 | K §7.6 |
| Search | PostgreSQL full-text search plus `pg_trgm`, with Kurdish/Arabic normalisation functions | PostgreSQL | K ADR-028 |
| Health standards | HAPI FHIR structures and validator; HAPI HL7 v2 | HAPI FHIR: Apache-2.0. HAPI HL7 v2: MPL-1.1 or GPL-2.0 (dual licence), used unmodified under MPL-1.1 | K §7.6 |
| Terminology | A terminology service on HAPI for ICD-10, LOINC, UCUM, ATC and local codes; Snowstorm only centrally and only if a SNOMED CT licence is taken | Apache-2.0 | K ADR-015 |
| Web client | React with strict TypeScript and **React Aria Components**; Vite; TanStack Router and TanStack Query; FormatJS (ICU MessageFormat); Zod for runtime validation | MIT/Apache-2.0 | K §7.6 (React, React Aria); [P] for the rest |
| Desktop shell | Tauri 2 with a hardware abstraction layer (HAL) for printers, scanners, badge and ID-card readers, MRZ readers and card terminals | MIT/Apache-2.0 | ADR-019 |
| Mobile | React Native (New Architecture) with Expo; encrypted SQLite (SQLCipher) for the offline store; MDM-managed devices | MIT/BSD | ADR-019; [P] for SQLCipher |
| Document rendering | HTML templates → PDF/A through a renderer with HarfBuzz-grade text shaping for Sorani and Arabic. Candidates: a WeasyPrint container (BSD) or headless Chromium. Spike S7-K decides by golden-image tests on the target printers | — | [P]; K §6.7 |
| Label and token printing | ZPL rendered server-side per printer DPI; `^PA` shaping with `^CI28` UTF-8 on Zebra firmware V60.14/V50.14 or later; `^GF` raster fallback; ESC/POS for token printers | — | K §6.7, §9.2; R16 §9.1 |
| Fonts | OFL-licensed fonts covering every Sorani letter (پ چ ژ گ ڤ ڕ ڵ ۆ ێ ە), for example Noto Sans Arabic / Noto Naskh Arabic or Vazirmatn; glyph coverage tested in CI | OFL-1.1 | [P]; K §6.7 |
| On-site substrate | k3s or RKE2 on three nodes; Helm; Argo CD in pull mode; OpenTelemetry collector exporting PHI-free telemetry to the central site | Apache-2.0 | K §7.6 |
| Kubernetes packaging | Upstream operators and charts: CloudNativePG, Strimzi, the Keycloak Operator, the Temporal and OpenFGA charts, official Valkey images. No Bitnami images or charts (Bitnami's free versioned images were withdrawn in 2025) | Apache-2.0; MIT; BSD | [P] |
| Object storage | An S3-compatible server under Apache-2.0 or LGPL that implements Object Lock in compliance mode, chosen through the dependency scorecard and proven by a WORM test (an object cannot be deleted or its retention shortened before expiry). Not MinIO (AGPL, and its community edition no longer ships maintained builds) | Apache-2.0 or LGPL | [P]; K §7.8 |
| Secrets and keys | OpenBao for secrets and the KMS; never HashiCorp Vault (BSL, denylisted). Development stand-ins: swtpm for the TPM and SoftHSM2 over PKCS#11 for the HSM | MPL-2.0; BSD | [P]; ADR-008 |
| Central site | Kubernetes in Kurdistan colocation; Prometheus; Grafana and Loki (AGPL) only centrally, unmodified, never shipped on site; OpenSearch only for central log search | Apache-2.0; AGPL (central only) | K §7.6; BP §7.7 |
| Infrastructure as code | OpenTofu | MPL-2.0 | BP §7.7 |
| Central analytics | Apache Iceberg, Trino, dbt Core, SQL-on-FHIR (P2: OMOP) | Apache-2.0 | K §7.6 |
| Imaging tier (integrated, not built) | dcm4chee (MPL-1.1) or an unmodified Orthanc container (GPLv3/AGPL with a source offer); OHIF viewer (MIT), labelled non-diagnostic | — | K §7.6 |
| Test tooling | JUnit (current major); Kotest (including property-based testing); Testcontainers; ArchUnit plus Spring Modulith verification; Playwright (web end-to-end and visual diffs); Maestro (mobile flows); Gatling (load); Chaos Mesh and Toxiproxy (chaos); axe-core (accessibility); Jazzer (fuzzing parsers); PIT (mutation testing on Tier 2 modules) | Apache/MIT/MPL/EPL | [P] |
| Quality and supply-chain tooling | detekt, ktlint, ESLint, Prettier; Semgrep CE; gitleaks; Trivy and OSV-Scanner; CycloneDX SBOMs; Sigstore cosign signing with SLSA provenance (local keys and no public transparency log in dev and CI, §4.3); OSS Review Toolkit (ORT) for licence compliance | Apache/MIT/LGPL | [P]; BP §7.7 |

**Locales [P]:** `en` (English), `ckb` (Central Kurdish / Sorani, Arabic script, RTL), `ar` (Arabic, RTL) for the UI; `ku-Arab` (Badini/Kurmanji in Arabic script) for patient-facing templates only; `ku-Latn` only if Q-K17 says Latin-script Kurmanji output is needed. Default time zone `Asia/Baghdad`, configurable per tenant.

### 4.2 ADR baseline

Create one file per ADR in `docs/adr/` during WP-0.1, with status, context, decision, consequences, the fitness test that guards it and its reopen trigger. "Baseline" means accepted for the build; ADR-001 and ADR-009 stay "accepted-provisional" until their spike criteria pass on the reference cell (WP-0.6).

| ADR | Decision | Guarded by | Reopen if |
|---|---|---|---|
| 001 | **Core data, Option A:** our own FHIR-shaped domain model on PostgreSQL, one database per tenant, HAPI libraries for structures and validation. Stable facts (Observation, Condition, AllergyIntolerance, QuestionnaireResponse) are stored FHIR-shaped so their projection is near-identity; translation is concentrated where FHIR is weakest (workflow states such as the verification queue). A repository/port abstraction stays whatever the outcome | Spike harness C1–C9 (§18.6) | Option B (FHIR-native core) passes C2 and beats A by ≥15 weighted points; or C2 fails for both, in which case stop and redesign the order/MAR boundary. If C9 fails for Option A, apply the ADR-009 (NATS JetStream) and ADR-010 (lighter workflow persistence) fallbacks and re-run C9 before any reopen (K §7.4) |
| 002 | **Runtime:** Kotlin on the JVM, Spring Boot plus Spring Modulith | Build | S18-K shows only .NET can be staffed |
| 003 | **Modular monolith plus satellites.** Orders, Medications (including the MAR), Results and Tasks share one transactional boundary (the Safety Kernel). RCM, the Integration Hub, the document renderer, the AI gateway (P2) and analytics are satellites (BP §7.2). Tier 2 modules are separate processes | Modulith verification; ArchUnit | Boundary violations rise for two consecutive sprints |
| 004 | **Event model:** event-sourcing-lite, with the bitemporal journal as the transactional outbox. Full event sourcing for MedicationOrder/MedicationAdministration only if the spike shows BCMA p95 ≤500 ms, order-sign ≤1.5 s, tooling ≤8 engineer-weeks and no critical-path cost | Spike S2; performance suite | Tooling >8 engineer-weeks; BCMA p95 >500 ms; upcasting >20% of medication capacity; any C1 miss |
| 005 | **Canonical Model Versioning and a projection compiler:** FHIR R4 (4.0.1) now; R5 only via backports (Subscriptions); R6 as a second projection when a partner or market needs it, with no storage migration. Bounded FHIR writes (Appointment, QuestionnaireResponse, DocumentReference, device/patient Observation, Consent, Task) become domain commands. Finance, supply and formulary stay internal aggregates because those resources leave R6 core | Projection round-trip tests; FHIR validator | A partner or market mandates R6 |
| 006 | **Tenancy:** tenant = the contracting enterprise. A single hospital runs on its own on-site cell. A group is one tenant on a primary cell; other hospitals join over dual metro links with a site edge agent only if 60 days of measured availability show ≥99.95% (including an exam-shutdown window, unless the links are private circuits), retested yearly; otherwise each hospital gets its own cell and tenant. Outpatient facilities use the pooled tier at the central site with `FORCE ROW LEVEL SECURITY` and no `BYPASSRLS` roles | RLS tests; tenancy tests | A group needs one record across sites whose links fail the test |
| 007 | **On-site hospital cells,** a Kurdistan central and DR site, and a PHI-free control plane. Substrate portability (k3s/RKE2 on site; Kubernetes centrally) proven in CI | Conformance suite on both substrates | — |
| 008 | **Keys:** per-tenant envelope keys with crypto-shredding; on site, keys sealed to the TPM or held in a small HSM, escrowed at the DR site under dual control; off-site copies encrypted under hospital-held keys | Key-rotation and shredding tests | A Kurdistan rule changes key custody |
| 009 | **Messaging:** journal-as-outbox, one event backbone everywhere: Kafka KRaft by default, NATS JetStream if C9 fails. Events keyed by patient. No hidden dead-letter topics | C9 footprint test; ordering tests | C9 fails on reference hardware |
| 010 | **Workflow:** Temporal behind `WorkflowPort` for long-running processes (discharge, pre-approval, claims, migration, cutover). Never order or MAR state, never sub-second decisions. Fork-readiness plan under ADR-022 | ArchUnit: no Temporal types outside the adapter | C9 fails (first apply the fallback: lighter workflow persistence behind the same `WorkflowPort`, then re-run C9), or the upstream licence or steward changes |
| 011 | **Edge planes:** A = workstation shell HAL; B = the on-site cell for hospitals, or a hardened site edge agent for outpatient sites; C = central adapters. Each integration lives in the lowest plane that meets its downtime need | Downtime matrix tests | — |
| 012 | **Offline and downtime safety matrix** in the hazard log (SI-15). "Offline" means losing the on-site cell (rare), losing the central site for pooled-tier sites, or mobile offline. Internet loss alone is not an offline state for a hospital | Offline conflict suite (S9-K) | S9-K finds an uncovered conflict class |
| 013 | **Trust Plane:** Keycloak + OpenFGA; mandatory Policy and Audit SDKs for all data access | ArchUnit: no repository access without the SDK | — |
| 014 | **Native Integration Hub** owns every interface | Channel tests; zero-silent-drop chaos test | — |
| 015 | **Terminology:** WHO ICD-10 (commercial-use permission needed), LOINC (seeded via LIVD), UCUM, ATC (WHOCC file licence), the regional drug master and local codes. SNOMED CT only if licensed (Q-K9); until then the free SNOMED Global Patient Set where useful. On-site cells receive terminology and drug-KB snapshots | Terminology conformance tests | SNOMED licence taken |
| 016 | **Regulated-module segregation:** Tier 2 functions run as separately versioned, process-isolated sidecars on the same node; the Boundary Register is the only activation switch; one Dose Engine | Static analysis (no dose arithmetic elsewhere); sidecar contract tests | — |
| 017 | **CDS:** a drug-KB adapter; DMN decision tables for non-device rules on an Apache-2.0 engine (Apache KIE/Drools DMN is the candidate, confirmed by the dependency scorecard); native deterministic Tier 2 calculators; CQL from P2 for measures, KPIs and non-device third-party CDS only. **No rules engine inside the device boundary** | ArchUnit; Tier 2 boundary-value tests | A change to the device boundary agreed through the Safety Board |
| 018 | **AI gateway and control plane (P2):** counsel-approved region pinning, zero retention, PHI minimisation, version pinning, kill switch, `draft-ai` state; an on-site small-model option evaluated; no model touches the database | DB-credential scanner; `draft-ai` tests | — |
| 019 | **Clients:** React/TypeScript with one design system; Tauri 2 shell with the HAL; React Native mobile | — | — |
| 020 | **Configuration and content as code:** signed bundles promoted BUILD → TEST → TRAIN → PROD; three-way merges; no customer branches | Signed-bundle verification; branch detector | — |
| 021 | **Delivery:** weekly continuous delivery to the central site; a **monthly on-site release train ("N")** with C2 regulated changes quarterly; cells pull signed releases over an outbound channel in staged rings (reference cell ≥7 days → a non-flagship site ≥14 days → all sites; DP#1 is never first); a site may defer one train for a go-live, a mass-casualty event or a shutdown; migrations always roll back to N-1; signed offline media with pinned keys and anti-rollback; maximum drift N-1; licences, certificates and updates tolerate ≥90 days without call-home, with no lockout | Upgrade/rollback tests; drift telemetry | Any cell beyond N-1 for >45 days |
| 022 | **Licence and dependency governance** (§4.3) | ORT licence scan in CI | Upstream licence change |
| 023 | **Data platform:** reporting replica (≤60 s) and read models on site; encrypted CDC bronze landing centrally in the MVP; silver layer, OMOP and SQL-on-FHIR in P2 | Freshness tests | — |
| 024 | **Care-team assignment** uses ES-lite and is a core domain that feeds nurse call | Event tests | — |
| 025 | **The single-hospital edge cell is the default.** The multi-site edge cell (several cells writing for one tenant) is P3, after a dedicated reconciliation hazard analysis | — | A group contract needs it |
| 026 | **Power:** separate UPS feeds per node with ≥60 minutes runtime and generator auto-start; crash-safe storage (synchronous commit, power-loss-protected drives); graceful shutdown below 10 minutes of UPS; mains, generator and UPS status monitored as building signals; clients autosave drafts and re-authenticate fast after a blip; GPS or stratum-1 NTP per cell; clock skew >1 s between nodes alarms; a node more than 5 s out is blocked from clinical writes | Power-cut chaos tests; clock-skew tests | Any data loss from power; any clinical write with skew >5 s |
| 027 | **Fleet operations:** outbound-only management channel; local break-glass for field engineers during internet cuts (on-site co-sign by the hospital IT lead or CSO, single-use sealed credentials rotated after use, operations plane only, recorded session the customer reviews within 5 working days); spare parts and remote hands per governorate; hardware only from the Kurdistan Supported Hardware List | Break-glass tests | Any cell down >4 h awaiting hardware |
| 028 | **Search:** PostgreSQL full-text and trigram indexes in the product (patient search p95 ≤200 ms); OpenSearch only for central logs and analytics | Search performance test | Patient search p95 >200 ms on the reference cell |

### 4.3 Licence and dependency policy

- **Allowlist:** Apache-2.0, MIT, BSD, ISC, MPL-2.0, LGPL, EPL, OFL (fonts). Also allowed, unmodified and recorded in the licence register:
  - MPL-1.1 libraries (for example HAPI HL7 v2, used under its MPL-1.1 option);
  - the LGPL-2.1 option of tri-licensed dcm4che and dcm4chee;
  - GPL-2.0 with the Classpath exception for the OpenJDK runtime;
  - operating-system packages inside base images, as unmodified system components listed in the SBOM.
- **Scope:** the policy governs everything shipped to a site. Build- and CI-only tools are checked for use restrictions (for example Semgrep registry rule terms or Docker Desktop's subscription terms), not distribution terms. Encode all of this as ORT curations and a policy file in WP-0.1.
- **GPL and AGPL** only as unmodified, separate containers with a source offer. Every Kurdistan hospital is an on-site install, and on-site installs count as distribution, so this rule is checked on every release (K §7.6).
- **Denylist:** BSL, SSPL, competing-use clauses, AI-ingestion clauses, "functional source" licences. Excluded by name: Camunda 8.6+, Redpanda, Mirth Connect ≥4.6, Liquibase under FSL, any cloud-only FHIR service, Medplum components inside the product (BP §7.7).
- **Dependency scorecard** for every runtime dependency: steward, funding, release cadence, bus factor, licence history. Critical-path dependencies with a single corporate steward (Temporal) are wrapped behind ports with a fork-readiness note.
- **SOUP list:** every third-party component used by Tier 1 or Tier 2 code is recorded with version, purpose, known anomalies and the verification that covers it (IEC 62304 practice, §20).
- **Signing in development and CI:** a local key pair from `cosign generate-key-pair` (git-ignored; passphrase from the environment); images stay in the dev cell's local registry; transparency-log upload is disabled (`--tlog-upload=false` in cosign 2, or a signing configuration without a Rekor service in cosign 3) and verification uses the matching offline option. Never keyless signing, Fulcio, the public Rekor log or a public registry. Production keys and any transparency log need an ADR and a [HUMAN] decision.

---

## 5. System architecture

### 5.1 Deployment topologies

| Topology | What runs there | Phase |
|---|---|---|
| **On-site hospital cell** | Three nodes (or two plus a witness) on separate UPS feeds. The full tenant: the modular monolith and its satellites (RCM, document renderer, analytics); PostgreSQL as three instances with quorum synchronous replication (a commit waits for any one of the two standbys and never degrades to asynchronous; a two-node-plus-witness cell needs its own ADR stating its RPO); the event backbone; Temporal; Keycloak; OpenFGA; the Integration Hub; print, queue and device bridges; the reporting replica; Tier 2 sidecars; local terminology and drug-KB snapshots. An on-site immutable backup target (object-lock NAS) in a separate fire compartment or building. Outbound-only management. Co-signed local break-glass (ADR-027) | MVP |
| **Kurdistan central and DR site** | Colocation in Erbil or Sulaymaniyah, with its own DR in the other city. The PHI-free control plane (signed releases, configuration bundles, licences, PHI-free telemetry); the **pooled tier** for outpatient facilities (database per tenant, FORCE RLS); an encrypted **warm standby of every hospital cell** (async, RPO ≤15 min while replication is up); continuity instances; central terminology and analytics; the CI reference cell | MVP |
| **Site edge agent** | For outpatient-tier sites on the pooled tier, and for a group's outpatient site attached to the group's hospital cell over metro links (DP#1's polyclinic on hospital A's cell, K §7.8): a hardened appliance outside the facility's Windows domain with a continuity replica, queue state, print spool and device bridge | MVP |
| **Continuity instance** | A read-only shadow per hospital at the DR site, with identity independent of the hospital's IdP, used when the hospital's own estate is compromised | MVP |
| **Regional cloud (optional)** | Ciphertext backups under hospital-held keys and PHI-free services only, after a counsel opinion (Q-K2) | P2 |
| **Multi-site edge cell** | Several cells writing for one group tenant | P3 |

**Reference hardware per hospital [E]:** three servers (16–32 cores, 128–256 GB RAM, NVMe with power-loss protection), a pair of 10 GbE switches, an object-lock NAS, two online double-conversion UPS units with ≥60 minutes runtime, rack and environmental monitoring. The **reference cell** for C7, C9, the 300-bed day and the SLOs is three servers of 32 cores, 128 GB and NVMe each, provided by a human [HUMAN] (K §7.4, §7.8).

**Development profile [P]:** a `docker compose` stack for fast inner-loop work, and the **dev cell**: a three-node `k3d` cluster on the build host that mirrors the on-site cell for integration and chaos tests. Both use the production container images; the dev cell also uses the production Helm charts. On a host with less than 32 GB of RAM, a **lite cell** (one Kafka broker, two PostgreSQL instances, no Argo CD) replaces the dev cell.

**Which cell a number comes from.** Every performance, footprint or restore result names its cell. Dev-cell numbers are "indicative" and lite-cell numbers "lite"; only reference-cell numbers count as evidence for C7, C9, the SLOs and release gates.

### 5.2 Bounded contexts and the module map

The context map is BP §7.4, unchanged for Kurdistan except that the revenue context gains dual-currency cash handling and the doctor-fee ledger (K §7.3). Each module below is a Spring Modulith application module (or a separate process where marked).

| Group | Module | Owns | May call synchronously |
|---|---|---|---|
| **Trust Plane** | `trust-identity` | Users, sessions, authenticators, badge and PIN, device registrations | — |
| | `trust-policy` | Roles, ABAC attributes, care relationships (OpenFGA), consent, sensitivity labels, purpose-of-use, break-the-glass | `trust-identity` |
| | `trust-audit` | BALP AuditEvents in a hash-chained WORM store; SIEM stream; access reports | — |
| | `trust-keys` | Envelope keys, crypto-shredding, escrow, egress policy | — |
| **Platform** | `platform-tenancy` | Enterprise structure, configuration chain, locks | Trust |
| | `platform-journal` | Bitemporal journal, outbox, domain-event publication, as-was queries | — |
| | `platform-config` | Signed bundles, promotion, feature flags and kill switches | Trust |
| | `platform-i18n` | Locales, catalogues, transliteration, name normalisation, calendars and holidays, digit policy | — |
| | `platform-tasks` *(Safety Kernel)* | Tasks, owned queues, pools, SLA timers, escalation chains, `TaskOrphaned` | Trust, journal |
| | `platform-docs` (+ renderer satellite) | Document templates, PDF/A, FHIR documents, labels, wristbands, print jobs, watermarking | Trust, i18n |
| | `platform-forms` | Versioned forms and assessments (QuestionnaireResponse-shaped facts) | Trust, journal |
| | `platform-notify` | PHI-free notifications, in-app inbox | Trust |
| | `platform-files` | Binary objects and document references in object-lock storage | Trust, keys |
| | `platform-workflow` | `WorkflowPort` and the Temporal adapter | — |
| | `platform-site` | Power and building signals, time sync status, downtime number blocks, backup orchestration, fleet agent | — |
| **Patient access and flow** | `empi` | Patients, identifiers, names, links and merges, matching, steward queue | Trust, i18n |
| | `scheduling` | Resources, slots, appointments, OPD tokens and queues, referrals intake | `empi`, tasks |
| | `adt` | Encounters, episodes, location history, beds, census, leave, transfers, discharge | `empi`, tasks |
| **Safety Kernel** (one transactional boundary, Tier 1) | `orders` | Orders and order sets, CPOE, order lifecycle, verbal-order read-back and co-sign | kernel, `cds` |
| | `medications` | Formulary, regional brand master, verification, dispensing (IP and OP), transcription control set, eMAR, BCMA, med rec, controlled drugs, patient-supplied medicines | kernel, `cds`, Tier 2 |
| | `results` | Result filing, acknowledgement, critical-result service, amended-result notices, pending-at-discharge routing | kernel |
| **Regulated modules** (Tier 2, separate processes, own release train) | `reg-ews` | NEWS2, PEWS, MEOWS from nurse-validated observations; escalation-task requests | pure function |
| | `reg-transfusion` | Bedside transfusion verification (T2) | pure function |
| | `reg-screening` | Presentation and local tiering of drug-KB screening results | pure function |
| | `reg-lis-rules` | LIS autoverification and interpretive rules | pure function |
| | `reg-dose` (P2) | The Dose Engine | pure function |
| **Clinical record** | `record` | Problems, allergies, observations, notes and signatures, immunisations, code status, documents | Trust, journal, tasks |
| | `nursing` | Assessments, flowsheets, I&O, care plans, worklists, brain-sheet, handover | `record`, kernel |
| | `ed` · `periop` · `icu` · `maternity` | Specialty workflows (§9) | `record`, kernel, `adt` |
| **Diagnostics** | `lis` | Accessioning, specimens, worklists, analyser results, QC, validation, lab-quality pack, send-outs | kernel |
| | `ris` | Imaging orders, protocoling, scheduling, MWL/MPPS, reports, PACS links, MRI safety | kernel |
| | `transfusion` | T1 workflow, blood-unit receipt and relabelling, issue, reactions, haemovigilance | kernel, `reg-transfusion` |
| **Knowledge** | `cds` | Alert registry, drug-KB adapter, non-device rule execution, tiers, silent mode, kill switches, PPV tracking | `terminology` |
| | `terminology` | Code systems, value sets, maps, licence entitlements | — |
| | `content` | Kurdistan foundation content and pack bundles | `platform-config` |
| | `safety-registry` | Hazard log service and Regulatory Boundary Register (TRU-REG-02) | — |
| **Revenue and ERP** | `rcm` *(satellite, ADR-003: its own deployable and schema on every cell)* | Accounts, ledger, charge router, tariffs, packages, deposits, estimates, cashiering, dual currency, discounts, refunds, doctor-fee ledger, credit contracts, pre-approvals, claims, statements | Trust (SDK); its own journal and outbox from the platform libraries |
| | `supply` | Item master, stores, lots, FEFO, indents, ward stock, consumption-to-charge, procurement-lite, consignment | Trust |
| | `finance-export` *(runs in the RCM satellite)* | AP/AR, daily summarised GL journals with drill-back; lite GL in P2 | `rcm` in-process; `supply` through its public API and events |
| | `workforce` | Staff master, typed practitioner identifiers, credentials, privileges; rostering in P2 | Trust |
| **Governance** | `him` | Legal health record, deficiencies, release of information, coding (R2.1) | `record` |
| | `statutory` | MLC, narcotics, births, deaths, notifiable diseases; KRG returns; DHIS2 export | kernel (read) |
| | `quality` | Incidents and RCA, accreditation-pack engine, safety dashboard | — |
| | `migration` | Migration Workbench, Legacy Data Viewer | via public APIs only |
| **Edges** (satellites) | `hub` | HL7 v2 engine, FHIR façade, DICOM, analyser bridges, Kurdistan pack adapters, channel operations | public APIs and events only |
| | `front-door` | WhatsApp/Viber/SMS adapters, report release, booking and payment links | public APIs and events only |
| | `analytics` | Read models, reporting replica, measures, CDC landing | events and CDC only |
| | `ai-gateway` (P2) | AI gateway and control plane | public APIs only, never the database |

**Dependency rules (enforced by ArchUnit and Modulith verification):**
- A module imports only another module's `api` package (commands, queries, published events). No module reads another module's tables.
- Only the Safety Kernel modules (`orders`, `medications`, `results`, `platform-tasks`) may share a database transaction. An order-sign is one atomic transaction: order + CDS override record + verification task + MAR schedule + charge event (ADR-001 criterion C1).
- Every module reaches its data store only through repositories wrapped by the Trust Plane Policy and Audit SDKs.
- `rcm` is a downstream conformist: it consumes clinical events (for example `ChargeGenerated`) and never changes clinical aggregates. SI-12 is enforced at the boundary: no RCM state can block an ADT, order or MAR command. Because `rcm` is a satellite, no kernel, ADT or order command calls it synchronously; screens that show both (for example the OP pharmacy POS) compose them in the BFF, and during an RCM outage clinical work continues while charge events wait in the outbox and post when RCM recovers.
- `hub` is the anti-corruption layer to every external format. No other module emits HL7 v2, FHIR, DICOM or Kurdistan formats directly.
- Tier 2 sidecars expose a pure-function, schema-versioned API. On timeout or error they fail to "unavailable, manual check required", never to "pass". Regulated values are displayed only by Tier 2-owned UI components (`frontend/packages/regulated-ui`) with render-integrity checks (a hash of the module output compared with what is drawn). Escalation tasks are created through a narrow, versioned task API whose contract is part of Tier 2 verification (BP §5.5).

### 5.3 Storage shapes, journal and events

Per tenant database (BP §7.6; R08 §3.11):
- **A. Relational aggregates** with foreign keys and exclusion constraints (for example, no double bed occupancy).
- **B. Immutable facts** with `valid_period`, `recorded_at`, `author`, `attester`, `source` (`user`, `device`, `ai-draft`, `migrated`, `interface`) and `supersedes_id`.
- **C. The bitemporal journal,** written in the same transaction as the state change. One append-only row per change: aggregate type and id, patient id, valid time, recorded time, actor, on-behalf-of, device, purpose-of-use, reason, payload, previous version. It is the transactional outbox and the write-audit trail. It is never updated.
- **D. Read models,** rebuildable from the journal and pushed to clients over server-sent events.

**Event layers:**
1. **Clinical journal** (above).
2. **Domain events:** CloudEvents 1.0 envelopes; schemas in Apicurio; backward-compatible evolution only, with a 12-month deprecation window; Debezium → Kafka keyed by patient so each patient's events stay ordered; at-least-once delivery; idempotent consumers. The event catalogue (§8.5) is a published product surface.
3. **Integration messages:** HL7 v2, FHIR and Kurdistan formats generated by the Hub from domain events; per-patient ordering (A08 never overtakes A01); MSH-10 idempotency; acknowledgement state per message; replay.

**Identifiers and time:** UUIDv7 for every identifier; instants stored in UTC with the original offset; every row carries `tenant_id` and, where it applies, `facility_id`. Downtime numbers (MRN, encounter and accession blocks) carry a site prefix. `TaskOrphaned` is a first-class alarm. Undeliverable messages land in owned queues that alarm after 5 minutes.

### 5.4 Clients

- **Web workspaces** (React) served from the cell, opened inside the **Tauri 2 shell** on hospital workstations so the shell's HAL can drive printers, scanners, badge readers, ID-card and MRZ readers, and card terminals. A plain browser works for roles that need no peripherals.
- **Mobile** (React Native): nurse mode (BCMA, bedside specimen labels, vitals, photos) and physician mode (result acknowledgement, critical read-back, patient-context secure chat, tablet rounds) (§15).
- **Signage** for queue display boards (RTL HTML).
- All clients survive power blips: drafts autosave, re-authentication is fast (badge tap ≤2 s), and nothing is lost on a workstation reboot.

---

## 6. Repository layout and engineering conventions

### 6.1 Monorepo layout [P]

```text
/
├── BUILD-PROMPT.md  BLUEPRINT.md  BLUEPRINT-KURDISTAN.md  research/   # plan and evidence (read-only for the build)
├── docs/
│   ├── program/        # STATUS, BACKLOG, WORK-PACKAGES, DECISIONS-NEEDED, OPEN-QUESTIONS, ASSUMPTIONS, COMMANDS, KNOWN-ANOMALIES, evidence/, reviews/
│   ├── adr/            # ADR-001 … ADR-0nn
│   ├── safety/         # hazard-log.yaml, traceability.csv, safety-case/, boundary-register/, soup.yaml
│   ├── specs/          # state-machines/, modules/, api/ (OpenAPI), events/ (AsyncAPI), hl7/, fhir/
│   ├── runbooks/       # operations, install, upgrade, restore, downtime, break-glass
│   └── user/           # help content in en, ckb, ar
├── backend/
│   ├── build-logic/    # Gradle convention plugins (Kotlin, detekt, jOOQ, Flyway, test tiers)
│   ├── platform/       # shared kernel libraries: ids, time, money, journal, trust-sdk, i18n, testing
│   ├── modules/        # one directory per application module (§5.2)
│   ├── app-hms/        # the modular-monolith Spring Boot application
│   ├── regulated/      # Tier 2 sidecars, each its own deployable and release train
│   ├── hub/            # Integration Hub satellite
│   └── satellites/     # rcm (with finance-export), document renderer, analytics, ai-gateway (P2)
├── frontend/
│   ├── apps/web  apps/shell  apps/mobile  apps/signage
│   └── packages/design-system  packages/regulated-ui  packages/i18n  packages/api-client
├── content/            # Kurdistan foundation content and pack sources (sample content flagged NOT FOR CLINICAL USE)
├── deploy/
│   ├── helm/  site-cell/  central/  edge-agent/  tofu/
├── tools/              # synthetic data generator, workload generator (1,000/300-bed day), migration CLI, golden-image tools
└── tests/              # cross-module scenario suites, end-to-end, performance, chaos, conformance
```

**Inside each backend module** (hexagonal): `api/` (the only package other modules may import), `domain/` (aggregates, state machines, invariants; pure Kotlin, no framework types), `application/` (command and query handlers, transactions, policy checks), `infrastructure/` (jOOQ repositories, adapters), `web/` (BFF endpoints for that module's screens), `events/` (outbound mappers), `test/` (unit, property, integration).

### 6.2 Backend conventions

- **Commands carry context:** tenant, facility, actor, on-behalf-of, device, purpose-of-use, clinical (valid) time, idempotency key and correlation id. They return the result and the new aggregate version. Optimistic concurrency on aggregate version.
- **Business outcomes are values, not exceptions:** sealed result types in the domain; RFC 9457 problem details at the HTTP boundary.
- **Money** is `BigDecimal` plus an ISO 4217 currency in a platform `Money` type with explicit rounding. Never floating point. IQD and USD; cash rounding per tenant (for example to IQD 250 [L]).
- **Time:** inject `Clock`; never call `now()` inside the domain. Clinical time and recorded time are separate fields everywhere.
- **Units:** every quantity carries a UCUM unit in a platform `Quantity` type. Unit-less doses do not compile into a valid command.
- **PHI-safe logging:** a logging API with an allowlist of fields; free-text and identifiers are never logged. CI runs the scenario suites with canary synthetic identities and fails if any canary value appears in logs, traces or metrics.
- **No tenant-specific code:** behaviour differences are configuration. A detector fails the build on tenant identifiers in code.

### 6.3 API conventions

- Contract-first OpenAPI 3.1 for module BFFs and public APIs, stored in `docs/specs/api/`, with generated TypeScript clients. AsyncAPI for published events.
- `Idempotency-Key` on every state-changing request. Cursor-based pagination. Versioned paths for public APIs (`/api/v1/...`), backward-compatible evolution, 12-month deprecation.
- Every endpoint passes through the policy enforcement point; every PHI read and write emits a BALP AuditEvent. Exports and prints are audited as their own event types.
- Server-sent events push read-model changes (worklists, boards, queues).
- The FHIR R4 façade and the HL7 v2 interfaces belong to the Hub (§12).

### 6.4 Database conventions

- One database per tenant; one schema per module; each module owns its tables.
- Every table has `tenant_id`, an UUIDv7 `id`, and audit columns; fact tables are bitemporal (`valid_period tstzrange`, `recorded_at`, `supersedes_id`). Database permissions and a linter forbid `UPDATE` and `DELETE` on fact tables.
- Use exclusion constraints, check constraints and foreign keys for invariants the database can hold; the domain holds the rest.
- Flyway migrations follow expand → migrate → contract. CI runs an upgrade-then-rollback test against the previous release (N-1) on every change.
- Encrypted volumes with keys sealed to the TPM; envelope encryption with per-tenant keys for documents, images and designated fields, so crypto-shredding works (ADR-008).
- Pooled tier: `FORCE ROW LEVEL SECURITY` on every table; no role has `BYPASSRLS`; RLS tests in CI.

### 6.5 Frontend conventions

- Strict TypeScript; no `any`. React Aria Components for every interactive primitive. Design tokens only.
- **RTL by construction:** CSS logical properties only (a lint rule bans `left`, `right`, `margin-left` and similar); `dir` comes from the locale; mixed strings (a Sorani name, an English drug, a dose and a unit) are bidi-isolated (`<bdi>`, `unicode-bidi: isolate`).
- **No string literals in JSX:** every user-facing string comes from the catalogues (ICU MessageFormat). Missing keys fail the build for clinical paths.
- **Clinical numerals** render through a `ClinicalNumber` component that always uses Western digits, on every locale. Eastern Arabic-Indic digits are allowed only for non-clinical numbers in patient-facing Kurdish and Arabic text, by configuration.
- **The banner** is mandatory on every clinical route (a test enforces it). One patient context per window.
- Defaults never select a dose, route or patient. Keyboard-first with a command palette. Density modes. No stacked modals. One sign/co-sign pattern everywhere.
- Accessibility details: text contrast ≥4.5:1; colour is never the only carrier of meaning; targets ≥24×24 px; doses always with a leading zero and never a trailing zero; WCAG 2.2 AA including Redundant Entry and Accessible Authentication (R08 §8).
- Per-route performance budgets and bundle-size budgets run in CI.

### 6.6 Configuration, content and flags

- **Configuration chain:** vendor foundation → Kurdistan pack → tenant → legal entity → facility → department → unit → user. The most specific value wins unless a parent has locked it. Safety invariants and Tier 2 activation are vendor-locked (K §7.7).
- **Clinical tier (no partial loop, K-24):** `CORE` or `CLINICAL_SAFETY` is one facility-level setting, locked against department, unit and user override.
  - `CLINICAL_SAFETY` turns on CPOE, pharmacist verification, eMAR/BCMA and transfusion verification together, for every inpatient area of the facility: wards, ED, OT/PACU, labour and delivery, ICU and NICU/PICU (T1 always; T2 where the Boundary Register allows). None of these can be enabled on its own.
  - `CORE` exposes no MAR, administration schedule or active-medicines view (control set B).
  - Changing the tier is a governed change backed by RG1–RG4 evidence.
  - Tests prove that no configuration state yields CPOE without eMAR/BCMA, or a MAR on any unit of a `CORE` facility.
- **Signed bundles** promoted BUILD → TEST → TRAIN → PROD, with three-way merges and no customer branches. Content (order catalogues, formulary, rules, tariffs, forms, templates, translations) is a regulated artefact: versioned, validated, signed, replayed before activation (§19.4).
- **Flags:** every CDS rule and clinical-behaviour flag has a kill switch. Safety-relevant changes default to off. Flag changes are audited.
- **Extension tiers (R08 §9):** (1) configuration (forms, order sets, rules, worklists, print templates: typed, validated, versioned, tested); (2) low-code (form builder, FHIRPath expressions, pathway templates compiled to our task engine; sandboxed, no database access); (3) server plugins (P2, `PLT-CFG-04`) that run out of process, receive events and return effects the core validates; (4) external SMART apps and CDS Hooks services. A PLAY environment beside BUILD → TEST → TRAIN → PROD lets hospital analysts experiment safely.

### 6.7 Observability

OpenTelemetry traces, metrics and logs, PHI-free by construction. On-site collectors buffer and export to the central site. SLO dashboards per cell. Alarms at minimum for: `TaskOrphaned`; dead-letter queue items older than 5 minutes; DR replication lag >15 minutes; clock skew >1 s; UPS on battery and runtime <10 minutes; disk, memory and certificate expiry; licence days remaining; backup failures; failed restore tests; integration channels without acknowledgements.

### 6.8 Fitness functions and static analysis (all in CI; a failure blocks merge)

1. No dose arithmetic outside `reg-dose`, exactly as defined in §2.1 (custom detekt rule plus ArchUnit on `Dose`/`Quantity` operations; the allowed comparisons (a)–(e) go through one audited comparison API).
2. No `UPDATE`/`DELETE` on fact tables.
3. Module boundaries (Modulith verification; ArchUnit layering; `domain` packages free of framework types).
4. No repository access without the Trust Plane SDK.
5. No PHI in logs, traces or metrics (canary scan).
6. No hard-coded user-facing strings; no physical CSS directions; banner present on clinical routes.
7. Licence scan, SBOM generation, secret scan, dependency vulnerability scan, container scan.
8. Branch-per-tenant and tenant-identifier detectors.
9. Migration upgrade-and-rollback test (N-1).
10. Read-model rebuild test from the journal.
11. Egress test: the cell's network policy allows only the approved outbound destinations.
12. Performance budgets (§0, §14.4) and the 300-bed-day regression gate.
13. Tier 2: 100% boundary-value coverage and a mutation score threshold.

---

## 7. Platform foundation (build this before any clinical module)

Each capability below is a backlog item in Appendix A (mostly `PLT-*` and `TRU-*`). Read: R08 §12; R07 §5 and §9.1; BP §7.

1. **Tenancy and enterprise structure.** Tenant → legal entity → facility → building → floor → department → unit → room → bed, plus service points (clinics, counters, labs, OT suites). Tenant calendars with the Friday–Saturday weekend and Kurdistan holidays (Newroz on 21 March, the Eids and others) as data [L]. Calendar-aware SLA timers.
2. **Trust Plane.** Identity: federation with the hospital IdP; phishing-resistant MFA (passkeys, FIDO2, smartcards; never SMS codes) for remote, privileged and vendor access; badge tap-and-go ≤2 s; badge plus PIN for co-signature, controlled drugs and break-the-glass; no shared accounts; deprovisioning within minutes. Authorisation: RBAC plus ABAC plus care relationship plus sensitivity labels plus purpose-of-use plus consent, decided by one policy decision point and enforced on every API, print and export. Break-the-glass with reason capture, privacy-office notification and review within one working day. Audit: BALP AuditEvents for every view, write, print and export, in a hash-chained WORM store that tenant admins cannot disable, with free SIEM streaming and a one-year patient access report in ≤5 s. Keys: per-tenant envelope keys, crypto-shredding, TPM/HSM sealing, escrow (§13).
3. **Clinical journal and fact store** with as-was queries ("what did the clinician see at 09:12") for medico-legal review and CDS replay. Back-entry tooling records valid time = paper time and recorded time = now, labelled.
4. **Task engine:** every task has an owner (a person, a pool or a queue), an SLA, an escalation chain and a state. Team inboxes with pools. `TaskOrphaned` fires within 5 minutes for unowned or unroutable work.
5. **Event backbone and outbox:** Debezium, CloudEvents, schema registry, per-patient ordering, idempotent consumers, owned and alarmed dead-letter queues, replay.
6. **Workflow port** with the Temporal adapter, for discharge, pre-approval, claims, migration and cutover.
7. **Configuration and content service:** the configuration chain with locks; signed bundles; promotion; replay harness.
8. **Flags and kill switches.**
9. **Terminology service:** code systems, value sets and maps, versioned by date of service; every coded element keeps local code, standard code, display, original text and code-system version (R06 §8).
10. **Localisation platform:** catalogues and translation memory for `en`, `ckb`, `ar` and `ku-Arab` templates; a **transliteration service** (Kurdish/Arabic ↔ Latin, with stored variants); **name normalisation** (ي/ی, ك/ک, ه/ە, alef forms, taa marbuta); collation and search normalisation; digit policy; calendars (§11).
11. **Documents and printing:** HTML templates → PDF/A and FHIR documents from one source; wristbands and labels rendered per printer DPI with Sorani and Arabic shaping or raster fallback; golden-image tests; a print spool on the cell; print watermarking; every print audited.
12. **Forms engine:** versioned, configurable forms and assessments with validation, scoring hooks (non-device only) and QuestionnaireResponse-shaped storage.
13. **Notifications:** in-app and push, never carrying PHI.
14. **Search:** patient search across scripts with trigram and normalised indexes, p95 ≤200 ms.
15. **Files:** object storage with object lock for documents, scans and photos.
16. **Safety registry (TRU-REG-02):** the hazard log and the Regulatory Boundary Register as services with UI, API and the CI gate (§10.1–§10.2).
17. **Read models and the reporting replica** (≤2 s boards, ≤60 s replica).
18. **Site services:** power and building signals (mains, generator, UPS) as events; time-sync health and the clock-skew write block; downtime number blocks with site prefix; backup orchestration; the fleet agent (outbound channel, release pulls, licence and certificate status).
19. **Downtime support:** the continuity replica; downtime packet printing (census, active orders, MAR, allergies, recent notes and results); back-entry reconciliation.
20. **Design-system shell:** workspace frame, banner, patient-context management, sign/co-sign pattern, command palette, density modes, RTL, autosave.
