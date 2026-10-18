# Work packages

The current phase plan and the BUILD-PROMPT §21 work packages, with their dependencies, exit criteria and state. Updated at the start and end of each work package (§3.1). Each work package has its own file under `work-packages/` (template B.4).

**Rules (§21).** Build in dependency order. A work package starts when the work packages in its "Depends on" column are merged, or reviewed and stacked (§3.6), and the simulators it needs exist (§3.7). Packages whose dependencies are met may run in any order. Gates, not dates: testing, validation and [HUMAN] gates are never compressed. Each work package follows §3.2 and ends with the Definition of Done (§22) and a reviewer report.

**States.** `todo`, `in-progress`, `blocked` (with the blocking item), `review` (handed over, awaiting the automated review), `done` (§22.2 met: exit criteria evidenced, control files current, review report with no unresolved critical or major findings).

## Phase 0: Foundation (business plan M0–M9; no clinical go-live)

| WP | Title | Depends on | Scope (§21) | Exit evidence (§21) | State |
|---|---|---|---|---|---|
| [WP-0.1](work-packages/WP-0.1.md) | Programme bootstrap | — | Monorepo layout (§6.1); programme control files (§3.1), including `OPEN-QUESTIONS.md` (Q-K list, A.20 conflicts), `ASSUMPTIONS.md` ([L] items) and `COMMANDS.md`; `backlog.yaml` generated from Appendix A by a script, with a ten-row spot check; baseline ADR files (§4.2); hazard log seeded with H1–H15 and one entry per SI-01…SI-21, every control `planned`; `tools/doctor`; `.gitattributes`; Gradle and pnpm workspaces; `tools/ci/run` with the fast tier and evidence records (§19.1); licence policy, ORT configuration and curations (§4.3); secret scanning; PR template; CODEOWNERS by module | `tools/ci/run fast` green on an empty skeleton with stored evidence; `tools/doctor` output recorded; every ADR file present; hazard log parses in CI; the backlog renders all 234 feature IDs | **review**: fast tier green in the WSL clone at `d3e14de` (`evidence/ci/2026-10-18-fast-d3e14de.json`), doctor recorded (`evidence/doctor/2026-10-18-d3e14de.txt`); awaiting the automated review |
| [WP-0.2](work-packages/WP-0.2.md) | Environments | 0.1 | `docker compose` dev stack; the dev cell (three-node `k3d`, §5.1; a lite cell on small hosts) with CloudNativePG (three instances, quorum synchronous replication), Strimzi Kafka KRaft (three brokers), Temporal, Keycloak, OpenFGA, Valkey and an S3-compatible object store with Object Lock; upstream operators and charts only; a local image registry with offline signing (§4.3); Argo CD in pull mode; OpenTelemetry collector; one-command bootstrap and teardown | The cell boots from locally signed images with one command; a smoke test passes; killing any single node (primary or standby) keeps PostgreSQL writable with no committed transaction lost, and losing two nodes stops writes instead of degrading to asynchronous; the object store refuses to delete a locked object | todo, **next**: stacked on `wp/0.1-programme-bootstrap` (DN-011); runs as a lite cell (DN-005), whose two PostgreSQL instances cannot show the single-node-loss criterion as written (OQ-084) |
| [WP-0.3](work-packages/WP-0.3.md) | Platform kernel (`PLT-CORE-01`, `PLT-CORE-02`, `PLT-CORE-04`, `PLT-CORE-07`, `PLT-CFG-01`) | 0.2 | Platform libraries (UUIDv7, `Clock`, clinical vs recorded time, `Money`, `Quantity` with UCUM); bitemporal journal-as-outbox; Debezium → Kafka with CloudEvents and Apicurio; enterprise hierarchy and the configuration chain with locks; signed configuration bundles; flags and kill switches; task engine with owners, SLA timers, escalation and `TaskOrphaned`; `WorkflowPort` with the Temporal adapter | Journal-rebuild test passes; events arrive in per-patient order with idempotent consumers; `TaskOrphaned` fires within 5 minutes in a chaos test; a locked setting cannot be overridden below its lock | todo (waits on WP-0.2) |
| [WP-0.4](work-packages/WP-0.4.md) | Trust Plane v1 (`TRU-IAM-01`, `TRU-IAM-02`, `TRU-IAM-03`, `TRU-PRV-01`, `TRU-AUD-01`, `TRU-KEY-01` base) | 0.3 | Keycloak federation and passkeys; badge-and-PIN flow against a simulated reader; the policy decision point (RBAC + ABAC + OpenFGA care relationships + labels + purpose-of-use); policy enforcement for API, print and export; break-the-glass with review queue; BALP audit to a hash-chained WORM store; per-tenant envelope keys and crypto-shredding; PHI-safe logging with the canary scan | ArchUnit proves no repository access without the SDK; every PHI read in the test suite produces an AuditEvent; tampering with the audit chain is detected; canary values never appear in logs, traces or metrics | todo (waits on WP-0.3) |
| [WP-0.5](work-packages/WP-0.5.md) | State machines and invariants (`PLT-CORE-03`) | 0.3 | Executable specs (Appendix B.3) for encounter, order, medication administration, specimen, result and bed, then appointment and credit claim (§8.4); generated property-test models; a test scaffold per SI with a named test for each; the scenario-suite framework | Each of the six machines that company gate G1 needs (encounter, order, medication administration, specimen, result, bed) has a spec with named-predicate guards, a generated model and passing property tests; every approval block reads `status: requested` with `approved_by` empty; approval requests filed in `DECISIONS-NEEDED.md` [HUMAN: pharmacist and nurse panels, lab CSO, HIM, CSO] | todo (waits on WP-0.3) |
| [WP-0.6](work-packages/WP-0.6.md) | Synthetic data and the ADR-001 harness (`PLT-OPS-06`) | 0.4, 0.5 | Synthetic population generator (§18.10); 1,000-bed-day and 300-bed-day workload generators; benchmark harness for spike criteria C1–C9 (§18.6), including offline-BCMA conflict replays; Kafka vs NATS footprint comparison. Option A measured; Options B and A′ assessed on paper (desk assessment) unless the human asks for a prototype. Spike code in `spikes/adr-001/`, not production code | A written spike report: C1–C6 and C8 measured on the dev cell (indicative); C7 and C9 harnesses built and dry-run at reduced scale. ADR-001 and ADR-009 stay accepted-provisional until a reference-cell run [HUMAN: hardware], unless a measured result already triggers a reopen rule, which is recorded | todo (waits on WP-0.4 and WP-0.5; reference-cell runs need DN-009) |
| [WP-0.7](work-packages/WP-0.7.md) | Design system and client shells (`PLT-UX-01`, `PLT-UX-02`, `PLT-UX-03` base, `KRI-LOC-01` base) | 0.1 (badge flow: 0.4) | Web workspace frame; banner component (SI-16) with patient-context management and re-verification at signing; sign/co-sign pattern; command palette; density modes; `ClinicalNumber`; locales `en`, `ckb`, `ar` with RTL; Tauri shell with HAL interfaces and simulated devices; React Native app skeleton; Playwright, axe and RTL-diff harnesses | A demo route renders the banner in three languages with correct RTL; axe clean; visual diffs stored; a simulated badge tap switches users in ≤2 s | todo; can start after WP-0.1 (Rust and the Tauri 2 Linux prerequisites are installed, DN-004); the badge-tap criterion needs WP-0.4 |
| [WP-0.8](work-packages/WP-0.8.md) | Documents and printing | 0.3 | Template engine; PDF/A renderer satellite with Sorani and Arabic shaping; ZPL renderer per printer DPI with `^PA`/`^CI28` and `^GF` fallback; golden-image test harness; font-coverage test for every Sorani letter; print audit and watermarking; the S7-K printer test kit | Golden images pass for the paths we rasterise ourselves (PDF/A pages at fixed DPI; the ZPL `^GF` raster decoded from our own output) for a trilingual wristband, specimen label and receipt. ZPL text-mode output is checked byte for byte against approved fixtures; its printed appearance is verified only in S7-K on physical printers [HUMAN: printers], and the S7-K kit is ready to run. The renderer choice stays accepted-provisional until S7-K. The font-coverage test passes. Label data never goes to an online renderer | todo (waits on WP-0.3) |
| [WP-0.9](work-packages/WP-0.9.md) | Safety registry and release evidence (`TRU-REG-01`, `TRU-REG-02`, `TRU-SEC-01`) | all other Phase 0 WPs | Hazard-log service and Regulatory Boundary Register (API and minimal UI) with the CI promotion gate; SOUP list; SBOM, VEX, signing and provenance in the release pipeline; the Release Evidence Pack generator | A dry-run release produces a complete evidence pack; promotion is blocked when a control for a feature in the release is not `verified` | todo (waits on WP-0.1 to WP-0.8) |

## Phase 0 exit criteria (§21)

- All nine work packages done (§22.2).
- Every CI tier runs through `tools/ci/run` with stored evidence, nightly property runs included.
- The spike report written (WP-0.6).
- The dev cell installs from signed artefacts. The reference-cell install waits for hardware [HUMAN] (DN-009).
- [HUMAN] state-machine approvals requested (WP-0.5).
- ADR freeze confirmed by the human lead [HUMAN].

On this host the dev-cell items can be met only by a lite cell (DN-005).

## Execution order on this host

Applies §3.4 "When everything left is blocked": if every remaining task in the current work package is blocked by an open DN item or a [HUMAN] gate, move to the next work package that does not depend on it; if there is none, update `STATUS.md`, report and end the session. Never work out of dependency order to stay busy.

The host since 18 October 2026: Windows 11 with WSL2 and Ubuntu 24.04 (DN-001 to DN-004 closed). Code is edited in the Windows checkout; the gates of record run in the WSL clone `~/src/hospitalmanagementsystem` at committed SHAs (KA-001). The WSL VM has 10 GB of memory, so every cell is a lite cell (DN-005).

1. **WP-0.1** closes with its commits, the fast tier green in the WSL clone with stored evidence, the doctor output recorded, and a review report. It cannot merge into `main` until the merge tier passes (DN-011), so it is reviewed and stacked.
2. **WP-0.2 is next,** branched from `wp/0.1-programme-bootstrap` (stacked, §3.6). It runs as a lite cell (DN-005); its three-instance failover criterion stays open on a lite cell until DN-005 is answered (OQ-084). Its k3s image is pinned to a Kubernetes version that kubectl 1.37 supports (DN-003).
3. **WP-0.3, WP-0.4, WP-0.5, WP-0.6, WP-0.8 and WP-0.9 wait on WP-0.2 by dependency** (0.3 depends on 0.2; 0.4, 0.5 and 0.8 on 0.3; 0.6 on 0.4 and 0.5; 0.9 on all others). None of them starts early, even where a part looks container-free (for example the WP-0.5 YAML specifications), because §21's "Depends on" column governs.
4. **WP-0.7 depends only on WP-0.1,** so it may run beside WP-0.2. Its web parts, the Tauri shell (Linux build) and the JavaScript side of the React Native skeleton can all be built here; device builds and Windows packaging need platform SDKs that a human provides ("Before the first session"). "A simulated badge tap switches users in ≤2 s" waits for the badge flow from WP-0.4 (§21: "badge flow: 0.4").

## Phases 1 to 6 (overview; traceable to §21)

Every state below is `todo`. Feature IDs refer to Appendix A; a feature listed under an earlier phase may be completed in a later one, and the Appendix A note says which part.

### Phase 1: R1 wedge (code-complete = RG1 at M19; live M22)

Wedge variants (Q-K1, K §13.1): W1-K is the plan; W2-K and W3-K stay buildable (§21).

| WP | Title | Depends on | Features | State |
|---|---|---|---|---|
| WP-1.1 | Enterprise, workforce, terminology, configuration | Phase 0 | `PLT-CORE-02` (full), `ERP-HR-01`, `PLT-CORE-05`, `PLT-CFG-02`, `PLT-CFG-03`, `PLT-CORE-06` (non-device rules) | todo |
| WP-1.1b | Hub core | 1.1 | `INT-ENG-01` (base): MLLP over TLS, acknowledgement state, owned dead-letter queues, ordered replay, outbound generation from domain events, DICOM and ASTM bridge skeletons, the simulators from §3.7. WPs 1.2, 1.4, 1.7 and 1.8 add their message types here, so no other module emits HL7 v2, FHIR or DICOM (§5.2) | todo |
| WP-1.2 | Identity and registration | 1.1b, 0.7, 0.8 | `ACC-ID-01`, `ACC-ID-02`, `ACC-ID-03`, `KRI-ID-01`, `ACC-REG-01`, `TRU-PRV-02` | todo |
| WP-1.3 | Scheduling, OPD flow and referrals | 1.2 | `ACC-SCH-01`, `ACC-OPD-01`, `ACC-SCH-02`, `INT-SEAM-01` | todo |
| WP-1.4 | Outpatient record and orders | 1.3 | `CLN-CHT-01`, `CLN-CHT-02`, `CLN-CHT-03`, `CLN-DOC-01`, `CLN-DOC-02`, `CLN-ORD-01`, `CLN-ORD-02` (outpatient), `CLN-IMM-01`, `CLN-IPC-01`, `CLN-INC-01` | todo |
| WP-1.5 | CDS foundation | 1.4 | `CLN-CDS-01`, `CLN-CDS-02` (outpatient subset), `CLN-CDS-03`, `reg-screening` sidecar | todo |
| WP-1.6 | Outpatient pharmacy and stores | 1.5 | `MED-FRM-01`, `MED-KRI-01`, `MED-OPP-01`, `MED-CS-01`, `ERP-INV-01` | todo |
| WP-1.7 | Diagnostics and LIS | 1.4 | `DX-ORD-01`, `DX-CRT-01`, `DX-LAB-01`, `DX-LAB-02`, `DX-LAB-03`, `DX-LAB-04`, `DX-LAB-05` | todo |
| WP-1.8 | RIS and PACS | 1.4 | `DX-RIS-01`, `DX-RIS-02`, `DX-PAC-01` | todo |
| WP-1.9 | Revenue | 1.2 (charge sources from 1.4–1.8 as they land) | `RCM-ACC-01`, `RCM-CHG-01`, `RCM-TAR-01`, `RCM-CSH-01`, `KRI-RCM-01`, `KRI-RCM-02`, `KRI-PAY-01`, `RCM-TAX-01`, `RCM-INS-01`, `RCM-SCH-01`, `RCM-DEN-01`, `ERP-FIN-01` | todo |
| WP-1.10 | Front door and messaging | 1.7, 1.8, 1.9 | `DFD-MSG-01`, `KRI-MSG-01`, `DFD-REC-01`, `KRI-LOC-01`, `KRI-LOC-02` (framework) | todo |
| WP-1.11 | Reporting and statutory | 1.6, 1.7, 1.9 | `OPS-MIS-01`, `OPS-STAT-01`, `OPS-STAT-02`, `AI-DAT-01`, `AI-DAT-02a`, `CLN-QI-01` (engine) | todo |
| WP-1.12 | Integration Hub completion | 1.1b, 1.4, 1.7 | `INT-ENG-01` (full), `INT-FHIR-01` (read), `INT-DOC-01`, `INT-IPS-01` | todo |
| WP-1.13 | On-site cell, central site, continuity | Phase 0 (grows alongside every Phase 1 WP) | `PLT-OPS-01`, `PLT-OPS-02`, `PLT-SITE-01`, `PLT-PWR-01`, `PLT-OPS-04`, `PLT-OPS-05`, `PLT-OPS-07`, `PLT-EDGE-01`, `TRU-BCP-01`, `TRU-BCP-02`, `TRU-BCP-03`, `TRU-BCP-04`, `TRU-BCP-05`, `TRU-KEY-01` (full), `TRU-SEC-02`, `TRU-SEC-03` | todo |
| WP-1.14 | Implementation tooling | 1.2–1.9 | `IMP-FND-01`, `IMP-MIG-01`, `IMP-RDY-01`, `IMP-TRN-01`, `IMP-TEL-01`, `IMP-SUP-01` | todo |
| WP-1.15 | R1 hardening and evidence | all other Phase 1 WPs | — | todo |

Phase 1 exit (R1): every R1 feature done; the R1 scenario suites, chaos suite and restore test green; zero open Sev-1 defects; no unmitigated high-risk hazard; zero untranslated strings in clinical paths; evidence pack complete. Go-live is a [HUMAN] decision through RG1–RG4 (§18.13).

### Phase 1.1: R1.1 (≈M25)

| Item | Features | Depends on | State |
|---|---|---|---|
| R1.1 items (no WP numbers in §21) | `DFD-PAY-01` wallet and QR payment links; `DFD-BOK-01` booking links; `KRI-STAT-02` DHIS2 export; document-pack automation (`RCM-INS-01`); LIS autoverification v1 in `reg-lis-rules`, activated only where the Boundary Register allows (`DX-LAB-03`); MIS breadth; queue display boards (`ACC-OPD-01`); FHIR SMART, Bulk and Subscriptions (`INT-FHIR-01`) | Phase 1 (phase order, §21) | todo |

Exit: each item works and its manual path is documented; autoverification passes its validation set and stays off until the Register says otherwise.

### Phase 2: R2a inpatient Core (code-complete M24, or M21 under W2-K; first live M27)

| WP | Title | Depends on | Features | State |
|---|---|---|---|---|
| WP-2.1 | ADT and bed board | 1.3 | `ACC-ADT-01`, `ACC-ADT-02`, `OPS-FLW-01` | todo |
| WP-2.2 | Inpatient billing | 2.1, 1.9 | `RCM-*` inpatient scope (§9.20–§9.21) | todo |
| WP-2.3 | Operating theatres: scheduling and billing | 2.1, 1.6, 1.9 | `SPC-OT-01`, `SPC-OT-03` (charging and stock) | todo |
| WP-2.4 | Inpatient pharmacy under control sets | 2.1, 1.5, 1.6 | `MED-DSP-01`, control sets B and C (§10.3), the patient-supplied medicine workflow | todo |
| WP-2.5 | Registers and maternity registration | 2.1 | `CLN-ACP-01`, `SPC-MAT-01` (newborn registration, mother–baby link, birth notification), `SPC-DTH-01`, `OPS-STAT-02` (MLC, births, deaths) | todo |
| WP-2.6 | R2a hardening | 2.1–2.5 | — | todo |

### Phase 3: R2b Clinical Safety (feature-complete = T-150 at M32; code freeze = RG1 at M34; live M37)

| WP | Title | Depends on | Features | State |
|---|---|---|---|---|
| WP-3.1 | Inpatient CPOE | Phase 2 | `CLN-ORD-02` (inpatient), `CLN-CDS-02` (full), `CLN-CDS-08` | todo |
| WP-3.2 | Verification and dispensing | 3.1 | `MED-PHV-01`, control set A, the KB ≥10× hard stop, the pharmacist-cover alarm | todo |
| WP-3.3 | eMAR and BCMA | 3.2 | `MED-MAR-01`, `MED-BCM-01`, `MED-INF-01`, `PLT-UX-04` | todo |
| WP-3.4 | Nursing | 2.1 | `NUR-FLW-01`, `NUR-FLW-02`, `NUR-CP-01`, `NUR-WND-01`, `CLN-BH-01` | todo |
| WP-3.5 | Early warning (Regulated Module #1) | 3.4 | `CLN-CDS-05` (`reg-ews`) and its fallback | todo |
| WP-3.6 | Emergency department | 3.1 | `CLN-ED-01`, `CLN-ED-02` | todo |
| WP-3.7 | Perioperative | 2.3, 3.3 | `SPC-OT-02`, `SPC-OT-03` (clinical record) | todo |
| WP-3.8 | ICU and code documentation | 3.3, 3.4 | `SPC-ICU-01` | todo |
| WP-3.9 | Maternity and diet | 2.5, 3.4 | `SPC-MAT-01` (L&D record), `SPC-DIE-01` | todo |
| WP-3.10 | Transfusion | 3.3 | `DX-BB-01`, `DX-BB-KRI-01`, `DX-BB-02` (optional) | todo |
| WP-3.11 | Results, discharge, handoff, med rec | 3.3 | `CLN-RES-01`, `CLN-DOC-03`, `CLN-MRC-01`, `CLN-HND-01` | todo |
| WP-3.12 | HIM and the legal record | 2.5 | `CLN-DOC-04`, chaperone documentation, guardian/co-signer consent, basic privacy reports (§13.1) | todo |
| WP-3.13 | Cutover tooling for active inpatients | 3.3 | `IMP-MIG-01` (inpatient pack) | todo |
| WP-3.14 | R2b validation | all other Phase 3 WPs | — | todo |

Phase 3 exit: everything in §22.3, plus BCMA, CPOE and transfusion scenario suites green; interruptive alerts ≤8 per 100 medication orders on replay; NICU/PICU scripts pass under control set A.

### Phase 4: R2.1 (by M40)

| Item | Features | Depends on | State |
|---|---|---|---|
| R2.1 items (no WP numbers in §21) | `SPC-AN-01` anaesthesia pre-assessment and intra-op/PACU record (lite); `RCM-COD-01` ICD-10 coding workbench; `DEV-GW-01` and `DEV-VAL-01` the validated ICU monitor feed; `ERP-PRC-01` procurement-lite with AP/AR breadth and the consignment bill-only purchase order; `IMP-GOV-01` governance intake; release-of-information workflow automation (`CLN-DOC-04`); secondary statutory returns (`OPS-STAT-01`) | Phase 3 (phase order, §21) | todo |

Each has a manual path until it ships.

### Phase 5: P2 depth (M38–M54; GA wave ≈M50)

| Item | Features | Depends on | State |
|---|---|---|---|
| GA wave, in this order | The Dose Engine first (`MED-DOSE-01`; shadow mode ≥4 weeks, C2 activation), then `CLN-AMS-01`, `DX-MIC-01`, `SPC-MAT-02`, `SPC-NIC-01`, `SPC-AN-02`, `DFD-APP-01`, `ERP-FIN-02`, `ERP-HTM-01` | Phase 4 (phase order, §21) | todo |
| Rest of P2 | `PLT-CFG-04`, `TRU-AUD-02`, `ACC-OPD-03`, `ACC-TRF-01`, `CLN-CDS-04`, `CLN-CDS-06` (Regulated Module #2), `CLN-ED-03`, `CLN-IPC-02`, `MED-INF-02`, `MED-ADC-01`, `MED-ONC-01`, `DX-POC-01`, `DX-RIS-03`, `DX-CRD-01`, `DX-BB-03a`, `SPC-OT-04`, `SPC-ICU-02`, `SPC-ONC-01`, `SPC-REH-01`, the scheme part of `RCM-SCH-01`, `RCM-AI-01`, `ERP-FIN-03`, `ERP-IMP-01`, `ERP-HR-02`, `ERP-ROS-01`, `ERP-SVC-01`, `OPS-CMD-01`, `OPS-RTL-01`, `INT-PH-01`, `AI-DAT-02b`, `DFD-TEL-01`, `DFD-CRM-01`, `IMP-MAT-01`, `IMP-CRT-01` | GA wave as ordered | todo |
| AI platform and products | `AI-GW-01`, `AI-GOV-01`, `AI-DCS-01`, `AI-SUM-01`, `AI-RCM-01`, `AI-PAT-01`; none of this starts before company gate G3 (≈M40, K-23) | company gate G3 [HUMAN] | todo |
| Items without IDs | The Iraq federal pack, IHE ACM consumer, referrer portal (no commission features), Ramadan mode, same-gender clinician preference, cross-referenced group identities, regional-cloud ciphertext backups (after Q-K2), and the first AI SKUs (dictation structuring, insurer document-pack assembly, template-suggested patient instructions, no-show outreach) | as above; Q-K2 for regional-cloud backups | todo |

### Phase 6: P3 (M52+ or partner-led)

| Item | Features | Depends on | State |
|---|---|---|---|
| P3 items | `PLT-OPS-03` multi-site edge cell (after a dedicated reconciliation hazard analysis), `NUR-STF-01`, `MED-IV-01`, `DX-LAB-06`, `DX-AP-01`, `DEV-ALM-01`, `DEV-SDC-01`, `SPC-ICU-03`, `SPC-DIA-01`, `SPC-OTH-01`, `RCM-CST-01`, `OPS-PRD-01`, `INT-OEHR-01`, `AI-AMB-01` (Sorani and Badini only after S8-K), `AI-NUR-01`, `AI-INB-01`, `AI-IMG-01`, `DFD-RPM-01`, `CLN-CDS-07`, federated benchmarking and an app marketplace | Phase 5 (phase order, §21) | todo |
