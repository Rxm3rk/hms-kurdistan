# Digest 04: Security, privacy, medico-legal record, AI governance, front door, mobile

**Sources:** R07 §5, §6, §8, §9 (§0–§4 skimmed); R09 §5–§9; R16 §11; K §10, §11; BP §10, §11; scope restatements in K §4.3–§9 and §18–§19; RL #4, #8.
**Precedence:** K wins where its Appendix A records a change; otherwise BP is inherited (K §0).
**Tags:** [L] local assumption; [I] inference.
**Deltas:** non-Kurdistan rails, laws, clocks and certifications are removed unless marked "generic pattern".

## 0. Conflicts and ambiguities

- **Privacy monitoring (AU-6):** in the MUST-at-GA audit baseline (K §10), but listed as P2 (K §4.3 Admin row; BP §10).
- **Report release:** "OTP or expiring link" (K §4.3) vs OTP **plus** knowledge check with a single-use link valid ≤72 h (K §9.2, the more specific rule).
- **Labels:** SI-21 as restated lists six (K §5.1); K §10 adds employee-as-patient.
- **Patient app:** MVP in RL #4 and R09 §7.9, but P2 in K §4.3. K wins (K §0).
- **Alarm and nurse-call routing to phones:** a listed mobile capability (R09 §8 #2), but never built in Kurdistan, where the HMS is never in the primary alarm path (K-09; K §9.2).
- **Site-loss RTO:** cross-region ≤60 min by contract (R07 §6.2; RL #8) vs ≤4 h by contract (K §7.10; K-17).
- **Patch SLA:** critical/KEV ≤7 days (R07 SD-8) vs ≤7 days centrally and ≤14 days on site (K §10, §7.10).
- **G17–G26 timing:** "by M30" (BP §11.3). K is silent, and its AI platform starts in P2 at ≈M42 (K §11.2–§11.3).
- **AI error rates (1.47%/3.45%):** "floor to beat" (BP §11.3) vs "reference point only … not a validated floor" (K §11.3). K wins.
- **Audit-log retention:** R07 AU-4's figures are US/India. K sets none; its 25-year floor covers records (K §10.1).

---

## 1. R07 §5 security architecture checklist

**Levels:** MUST = release-blocking for GA in any market. SHOULD = within 12 months of GA, or a market-specific MUST (R07 §5).
**Kurdistan:** every MUST applies except **IA-4, CN-3, AP-1 and AI-1** (K §10).

**Frame:** every module uses the Trust Plane's shared services and touches data only through the Policy and Audit SDKs (R07 §9.1 #1; ADR-013 Keycloak + OpenFGA, kept, K §7.2).

### 1.1 Identity and authentication (R07 §5.1)

| ID | Level | Build | Kurdistan |
|---|---|---|---|
| IA-1 | MUST | SAML 2.0/OIDC federation with the hospital IdP; SCIM; automatic deprovisioning within minutes; no local workforce passwords | K §10 |
| IA-2 | MUST | Phishing-resistant MFA (FIDO2/passkeys, smartcard, platform authenticators) for remote, privileged, admin, vendor-support and developer access; no password-only remote access; no SMS OTP for privileged users | "Never SMS codes" (K §10) |
| IA-3 | MUST | Badge tap-and-go (RFID/NFC + PIN); fast user switching; session roaming; location-specific inactivity/proximity lock; kiosk mode; VDI | Tap-to-switch ≤2 s; login ≤5 s p95 (K §6.8) |
| IA-4 | MUST (US) | **DROPPED** (K §10): DEA EPCS signing, identity proofing, two-person approval, EPCS reports | Badge + PIN for controlled drugs remains (K §10) |
| IA-5 | MUST | Unique user IDs; no shared or generic accounts; no default passwords; workload identity, never static service keys | K §10 |
| IA-6 | MUST | Vendor privileged access: JIT elevation, approval, session recording, customer-visible log, optional lockbox | **Lockbox mandatory** for every vendor session (K §10) |
| IA-7 | MUST | Step-up authentication for BTG, bulk export, EPCS, admin policy changes, key operations | Badge + PIN for co-signature, controlled drugs, BTG (K §10) |
| IA-8 | SHOULD | Risk-based authentication (device posture, impossible travel, token binding/DPoP); one-click session revocation per user or tenant | Not in K |
| IA-9 | MUST | IAL2-equivalent proofing for portal accounts; proxy access (parent, guardian, caregiver); adolescent confidentiality configurable by jurisdiction | No patient accounts in the MVP; patient app P2 (K §4.3) |
| IA-10 | MUST | Credentials stored with Argon2id/bcrypt; secrets never logged | — |
| IA-11 | MUST | Help-desk identity verification before MFA or password resets (video/ID check, manager callback); resets logged and alerted | K §10 |

### 1.2 Authorisation and segmentation (R07 §5.2)

| ID | Level | Build | Kurdistan |
|---|---|---|---|
| AZ-1 | MUST | One policy decision point: RBAC (role catalogue) + ABAC (facility, department, encounter, care team, time, device trust, purpose). Enforced server-side on every API, search, report, print and export | K §10 |
| AZ-2 | MUST | Care-relationship access (attending, care team, consult, scheduled or recent encounter, ED arrival); otherwise a reason prompt or BTG | K §10 |
| AZ-3 | MUST | HL7 confidentiality codes (N/R/V) + sensitivity categories, propagated to documents, results, orders, messages, prints, FHIR `meta.security` and analytics | SI-21 labels: HIV, mental health, reproductive and sexual health, GBV, forensic/MLC, VIP (K §5.1); employee-as-patient (K §10). R07's US categories = generic pattern |
| AZ-4 | MUST | BTG: reason code + free text; time-boxed and scope-limited; immediate privacy-office notice; mandatory retrospective review queue with outcomes | Reviewed within 1 working day (K §10) |
| AZ-5 | MUST | Field-level masking; confidential demographics (protected address, masked national IDs); "restricted patient" mode | — |
| AZ-6 | MUST | Scoping by group, legal entity and facility; cross-entity access only through configured data-sharing agreements | Configuration chain (K §7.7) |
| AZ-7 | MUST | Purpose of use on every access and disclosure (treatment, payment, operations, research, public health, legal, patient request) | K §10; SI-21 |
| AZ-8 | SHOULD | Patient-directed restrictions ("hide from provider X"), with emergency override | Not in K |

### 1.3 Consent (R07 §5.3)

| ID | Level | Build | Kurdistan |
|---|---|---|---|
| CN-1 | MUST | Consent registry on FHIR Consent. R07's scope list (Part 2, NHS, DPDP/ABDM, PIPL, EHDS) = generic pattern | Treatment eConsent by the performing clinician; messaging consent per channel; research opt-in; optional guardian/co-signer (K §10) |
| CN-2 | MUST | Consent enforced at the policy enforcement point for interfaces, FHIR, exports and analytics, not only in the UI | K §10 |
| CN-3 | MUST (US) | **DROPPED** (K §10): Part 2 redisclosure notices; US accounting of disclosures | The ROI disclosure log stays (K §10.1) |
| CN-4 | SHOULD | Patient consent and access-transparency dashboard (who, when, why) | Patient access log in P2 (K §10) |

### 1.4 Audit (R07 §5.4)

| ID | Level | Build | Kurdistan |
|---|---|---|---|
| AU-1 | MUST | **Events logged:** every view, create, update, delete, print, export, search, login/logout, failed access, consent change, BTG and admin change.<br>**Fields:** who (user, role, on-behalf-of, client ID); what (patient, resource, field set, query); when (UTC, NTP); where (device, IP, workstation, location, app); why (purpose, BTG reason); outcome | K §10; GPS/stratum-1 NTP per cell (ADR-026) |
| AU-2 | MUST | FHIR AuditEvent per IHE BALP; ATNA syslog (RFC 5424/TLS) for legacy; OpenTelemetry for system events | ATNA/BALP (K §9) |
| AU-3 | MUST | Append-only, hash-chained, periodically anchored; WORM in a separate security account; tenant admins cannot disable it; integrity reports | K §10 |
| AU-4 | MUST | Retention configurable per jurisdiction and log class. R07's defaults (6 y, 1 y, 180 days) are US/India | No figure (§0) |
| AU-5 | MUST | Near-real-time SIEM streaming (syslog/CEF/JSON/webhooks) at no extra charge, plus our own SOC | "Free SIEM streaming" (K §10) |
| AU-6 | MUST | Privacy analytics (household, coworker, neighbour, VIP, employee-patient, terminated user, high-volume, after-hours); case management; feed to third-party tools | Phase conflict (§0); monthly access reports to the hospital privacy lead (K §10) |
| AU-7 | MUST | Patient- and user-centric audit reports; export with chain of custody; eDiscovery/legal-hold integration | 1-year patient access report ≤5 s (BP §10) |
| AU-8 | SHOULD | Patient-visible access log; staff names suppressible | P2 (K §10) |

### 1.5 Data protection, keys and DLP (R07 §5.5)

| ID | Level | Build | Kurdistan |
|---|---|---|---|
| DP-1 | MUST | TLS 1.2+ (prefer 1.3) externally; mTLS service mesh internally; HSTS; no plaintext MLLP on untrusted networks | — |
| DP-2 | MUST | AES-256 at rest for all stores: databases, objects, search indexes, caches, queues, logs, backups, analytics copies | K §10 |
| DP-3 | MUST | Envelope encryption with per-tenant KMS/HSM keys (FIPS 140-3 where required); rotation; crypto-shredding on exit | On-site small HSM or TPM-sealed KMS, escrowed at DR under dual control (ADR-008) |
| DP-4 | SHOULD (MUST for sovereign deals) | BYOK for enterprise; HYOK in sovereign cells | Off-site copies under hospital-held keys; HYOK integration not needed (ADR-008) |
| DP-5 | MUST | Secrets vault; no secrets in code or images; automatic rotation; detection in CI | — |
| DP-6 | MUST | No unmanaged local PHI; encrypted, policy-controlled offline stores; remote wipe | Encrypted mobile cache (K §6.6); wipe a stolen node (K §10) |
| DP-7 | SHOULD | Application-layer encryption/tokenisation of national IDs and the most sensitive results (R07's examples = generic pattern) | Not in K |
| DP-8 | MUST | DLP: export throttles and approvals; watermarking of prints and PDFs (user, time, patient); bulk-FHIR anomaly detection; mobile clipboard/screenshot limits; egress monitoring | Watermarking (K §10); bulk-export anomaly detection (BP §10) |
| DP-9 | MUST | Retention/erasure engine: schedules, legal holds, permitted erasure, backup-expiry alignment, deletion certificates | Never auto-delete; 25-year floor (K §10.1) |
| DP-10 | SHOULD | De-identification/pseudonymisation service; re-identification keys held separately | — |

### 1.6 Platform, tenancy, residency (R07 §5.6)

| ID | Level | Build | Kurdistan |
|---|---|---|---|
| PL-1 | MUST | Cells with a hard blast radius; per-tenant database or schema + RLS; per-tenant keys; noisy-neighbour limits | On-site cell per hospital; pooled tier with FORCE RLS for outpatient sites (ADR-006/007) |
| PL-2 | MUST (architecture) | Sovereign-cell blueprint, including on-prem, with identical controls | On-site cell by default; same signed artefacts everywhere (K-16; K §7.1 rule 5) |
| PL-3 | MUST | PHI-free global control plane; scrubbed telemetry; support reaches data only inside the cell | K-16; K §7.8 |
| PL-4 | MUST | IaC, immutable images, CIS baselines, drift detection, CMDB | — |
| PL-5 | MUST | Separate environments; no production PHI outside production | K §10 |

### 1.7 Secure SDLC and supply chain (R07 §5.7)

| ID | Level | Build | Kurdistan |
|---|---|---|---|
| SD-1 | MUST | IEC 81001-5-1 + NIST SSDF; STRIDE + LINDDUN per epic; security requirements traceability | K §10 |
| SD-2 | MUST | CI gates: SAST, SCA, secrets, IaC/container scans, DAST on staging; two-person review; protected branches | — |
| SD-3 | MUST | SBOM (CycloneDX/SPDX) + VEX for every release and artefact; given to customers on request | K §10 |
| SD-4 | SHOULD | Sigstore signing; SLSA L3 provenance target; hermetic builds for critical components | Signed releases and offline media, pinned keys, anti-rollback (ADR-021) |
| SD-5 | MUST | Memory-safe languages for new services; framework-level removal of injection/XSS | — |
| SD-6 | MUST | OWASP ASVS L2; L3 for authentication/authorisation/BTG/admin/PHI APIs; MASVS; API Top 10 | — |
| SD-7 | MUST | Public VDP with safe harbour; bug bounty; CVEs with CWE/CPE; become a CNA | VDP (K §10); CNA by M30 (BP §10) |
| SD-8 | MUST | Critical/KEV ≤7 days, high ≤30 days; on-prem auto-updates with signed packages | ≤7 days centrally / ≤14 on site (K §10) |
| SD-9 | MUST | Continuous scanning (formally ≥ every 6 months); attack-surface management | — |
| SD-10 | MUST pen test / SHOULD red team | Independent pen test annually and after major change; annual red/purple team | First by M14, then annually (K §9.3) |
| SD-11 | MUST | Sub-processor risk management; open-source governance; exit plans for critical suppliers | Sub-processors bound by DPA terms (K §10) |

### 1.8 APIs and integration (R07 §5.8)

| ID | Level | Build | Kurdistan |
|---|---|---|---|
| AP-1 | MUST (US) | **DROPPED** (K §10): SMART App Launch v2 scopes, OAuth 2.0 + PKCE, short-lived tokens, refresh rotation, non-discriminatory app vetting | K §9 still builds a FHIR R4 façade with SMART 2.2 + PKCE |
| AP-2 | MUST / SHOULD | SMART Backend Services (JWT assertion) for systems; UDAP for B2B trust (TEFCA context = US) | — |
| AP-3 | MUST | API gateway: rate limits, schema validation, bulk anomaly detection, per-client quotas, partner mTLS, message integrity | — |
| AP-4 | MUST | Interface engine: TLS, journaling with replay after downtime, dead-letter handling, PHI-minimised logs | Hub replay; owned dead-letter queue alarmed at 5 min; zero silent drops (K §9) |

### 1.9 Endpoints, mobile, devices (R07 §5.9)

| ID | Level | Build | Kurdistan |
|---|---|---|---|
| EN-1 | MUST | Browser-first; signed desktop clients without local admin; managed updates | — |
| EN-2 | MUST | Mobile: MDM/MAM, attestation, root detection, encrypted storage, no PHI in push, biometric unlock bound to device keys | §9 (K §6.6) |
| EN-3 | MUST | Segmented device gateway (VLANs, no device-to-internet path), read-only by default; publish network requirements for IEC 80001-1 files and MDS2-style disclosures | VLAN per device class (K §9.2) |
| EN-4 | MUST | Downtime printing of wristbands, specimen labels and MAR that works with the core down | — |

### 1.10 AI controls (R07 §5.10)

| ID | Level | Build | Kurdistan |
|---|---|---|---|
| AI-1 | MUST (US, ONC (b)(11)) | **DROPPED** (K §10): DSI inventory with source attributes and model cards; intervention risk management; fairness monitoring | Still built via G1–G2 in P2 (K §11.2–§11.3) |
| AI-2 | MUST | Oversight UX: inputs, basis, knowns/unknowns; never auto-execute orders; capture accept/override reasons | — |
| AI-3 | MUST | Auto-log AI inputs, outputs, versions, user actions | — |
| AI-4 | MUST | No PHI to external models without a DPA and residency compliance; prompt-injection defences; provenance labels | Only via a Safety-Board processor entry + counsel opinion + hospital approval (K §10; SI-20) |
| AI-5 | MUST (regulated) | PCCP-style change plans for regulated models; versioned rollback for others | — |

### 1.11 Engineering items from the R07 §1–§4 skim

- **Processor duties:** a DPA with sub-processor flow-down; notify the controller without undue delay (contracts 24–48 h); a DPIA kit. Rights tooling: free first copy, rectification by addendum, erasure limited by retention law (R07 §1.2).
- **What a cell holds:** its own stores, keys, backups, logs, IdP endpoints and jump-hosts. The control plane holds only scrubbed telemetry, artefacts and licences (R07 §1.9).
- **Standards:** IEC 62304 (class B-like for clinical code), ISO 14971, IEC 81001-5-1, ISO 27789/BALP audit schema, HL7 labels/DS4P (R07 §2.6).
- **Incident lessons:**
  - central logs, EDR, a 24×7 SOC and PHI-store canaries;
  - immutable backups including identity;
  - degraded modes for third parties;
  - field-level encryption;
  - survive a compromised customer endpoint;
  - decommission legacy environments (R07 §4.3–§4.4).

---

## 2. Resilience and downtime (R07 §6; K §7.8–§7.10)

**Targets.**
- **R07 §6.1:**
  - no clinical data loss;
  - read-only access within minutes;
  - T0 read/write ≤72 h, even after a destructive attack;
  - 4–6 weeks of safe degraded operation;
  - offline backups for all critical systems, including Active Directory, restored to a common point in time.
- **K keeps** the same, with tenant restore ≤24 h (engineering) (K §7.9 L3, §7.10).

**Tiers (R07 §6.2; the canonical table per RL #8):**

| Tier | Functions | Availability | RTO | RPO | Cyber RTO | Downtime mode |
|---|---|---|---|---|---|---|
| T0 | ADT/index, allergies, problems, medication lists, CPOE, eMAR/BCMA, results and critical alerts, blood administration, notes read | Writes 99.95% SLA / 99.99% SLO; reads 99.99% | ≤5 min engineering, ≤15 min contract; ≤60 min cross-region | 0; ≤5 min cross-region | ≤72 h (tenant ≤24 h engineering) | Read-only viewer; encrypted local snapshot ≤15 min stale; printed packets |
| T1 | LIS interfaces, pharmacy, radiology, OR scheduling, nursing documentation write | 99.95% | ≤1 h | ≤5 min | ≤5 days | Paper; queued replay; downtime accession/MRN blocks |
| T2 | Registration, scheduling, portal, billing, claims, supply, HR | 99.9% | ≤4 h | ≤15 min | ≤7–14 days | Offline capture; batch back-entry |
| T3 | Warehouse, BI, research, AI training | 99.5% | ≤24–72 h | ≤24 h | ≤30 days | None |

**Kurdistan NFRs (K §7.10):**
- T0 writes at the on-site cell: 99.99% SLO / 99.95% monthly SLA, excluding hospital power and network beyond the contracted obligations.
- In-cell RPO/RTO: 0/≤5 min (engineering), 0/≤15 min (contract).
- Site loss: ≤5 min/≤60 min (engineering), ≤15 min/≤4 h (contract).
- Planned downtime: 0 (a major database upgrade ≤30 min a year).

**R07 §6.3 requirements (MUST unless noted):**

| # | Requirement | Kurdistan |
|---|---|---|
| 1 | Multi-AZ for T0/T1; single writer + synchronous standby; active-active only for stateless tiers and read models; DR failover tested ≥2×/yr | Three-node on-site cell (L0); DR warm standby (L2) (K §7.9) |
| 2 | WORM backups in a separate account with separate identity, credentials and admins. Covers databases, objects, identity configuration (IdP, directory, PAM), key escrow, IaC, CI/CD, audit logs. ≥90 days of restore points | On site (object-lock NAS, separate fire compartment) and at the DR site, ≥90 days (K §7.8, §10) |
| 3 | Clean-room rebuild from known-good images and IaC into a fresh account; common verified point in time; malware/integrity scan of restored data | K §7.9 L3, §10 |
| 4 | Quarterly automated restore tests per tier; annual cyber-recovery exercise with a customer; evidence kept | Quarterly per hospital; annual exercise incl. estate-down (K §7.9, §10.2) |
| 5 | Read-only downtime system:<br>(a) encrypted unit snapshots refreshed every 15 min, with local printers;<br>(b) a read-only shadow with independent identity and sealed break-glass accounts;<br>(c) unit PDF packets (census, MAR, medications, allergies/code status, pending results) every 1–4 h;<br>(d) patient downtime notices | Continuity instance at the Kurdistan DR site with independent identity (MVP; RG4 at hospital A); cellular clean kit per unit; packets every 1–4 h (K §7.8–§7.9) |
| 6 | Offline mobile BCMA with a time-bounded encrypted MAR cache, reconciled on reconnect; pre-allocated MRN/encounter/accession blocks; downtime wristbands and labels | ADR-012 unchanged; SI-15 (K §5.1) |
| 7 | Back-entry keeping original event times, flagged "documented during downtime"; paper scanning; reconciliation of administrations, duplicate orders, results and charges | SI-10, sized for frequent back-entry (K §5.1) |
| 8 | Durable queues with replay; clinically prioritised catch-up; fax/print fallback | Store-and-forward ≥7 days (K §7.9) |
| 9 | Independent status page; out-of-band incident communications; downtime templates; anti-scam patient messages | Status page on the optional regional cloud (K §7.8); GSM/SMPP gateway; voice for critical messages (K §7.9) |
| 10 | SAFER self-assessment workbook (US = generic pattern) | L4 follows "SAFER contingency planning" (K §7.9) |
| 11 | Joint playbooks: customer-estate ransomware; compromise of our cell; vendor credentials; insider snooping; credential stuffing; extortion; third-party outage; region outage; device network; DDoS. Each has clinical decision points and regulatory clocks | Non-Kurdistan clocks dropped; hospital notified ≤24 h; clocks are parameters (K §10) |
| 12 | Annual tabletop per customer (half-yearly for T0 sites); annual Code Dark per unit; after-action reports feed the hazard log | Code-Dark twice a year per unit; monthly game days; WAN-loss drills before announced shutdowns (K §7.9) |
| 13 | Downtime hazards (wrong patient on paper, missed critical results, duplicate doses, blood-matching delay); two identifiers on downtime outputs; phone escalation scripts | Outpatient lab: critical results phoned, read-back logged, back-entry ≤4 h (K §7.9) |

**Kurdistan additions (K §7.2, §7.9; K §18):**
- **WAN loss and shutdowns:** no clinical effect at hospitals; certificates and licences work ≥90 days.
- **Outpatient tier:**
  - edge continuity ≤2 min stale (engineering) / ≤15 min (contract);
  - pre-stage on announced shutdown days;
  - sites exposed daily are offered an on-site cell.
- **Power (ADR-026):**
  - a separate UPS per node (≥60 min) plus generator auto-start;
  - UPS also at the pharmacy, ED, ICU, lab and nursing stations;
  - crash-safe storage; graceful shutdown below 10 min of UPS; client autosave;
  - generator transfer tested monthly.
- **Ransomware:** the on-site cell is a hardened appliance outside the hospital domain.
- **Time (ADR-026):** GPS or stratum-1 NTP per cell. Skew >1 s alarms; a node >5 s out is blocked from clinical writes.
- **Site loss:**
  - lag >15 min alarms the hospital;
  - during a cut the RPO equals the cut's length;
  - cuts >24 h trigger a daily encrypted removable off-site backup.
- **Never offline** (at hospitals, only if the cell is lost): prescribing without CDS; bed or OT allocation; identifiers outside blocks; controlled-drug moves; merges.
- **Releases (ADR-021):** signed monthly train in rings; signed offline media; maximum drift N-1; ≥90 days without call-home.
- **Risk triggers (K §18):**
  - a failed quarterly restore, or an exploited flaw unpatched >7/>14 days (#7);
  - a pooled-tier outage or DR lag >24 h (#10).

---

## 3. Medico-legal record (R07 §8; K §10.1; BP §10.2)

| Topic | R07 requirement | Kurdistan position |
|---|---|---|
| Legal health record (LHR) | Per-tenant definition, separate from operational metadata. Configure which documents, results, images, messages, audit metadata and device data belong to it. Release rendering: paginated PDF + structured export, with version history and signature manifestation (R07 §8.1) | LHR per tenant (K §10.1); HIM with LHR in the MVP (K §4.3); PDF/A + FHIR documents from one source (K §9). C-CDA and the designated record set = US generic pattern |
| Entry metadata | Author, authenticator, signature time, event time, entry time (late entries flagged), versions, amendment links, source/device provenance (R07 §8.1) | SI-10 (K §5.1) |
| Retention | Jurisdiction-aware engine with per-record-class schedules. Default: never auto-delete without an approved policy and no active hold. Applies to backups, archives, indexes and analytics copies (R07 §8.2) | **Never auto-delete; 25-year floor** (the only verified regional figure, UAE) until rules are confirmed. Destruction needs a schedule, approval and legal-hold check; a litigation hold overrides every schedule (K §10.1; KDV-12; Q-K5) |
| E-signatures | Authenticated user + intent + manifestation + linkage + audit; co-signature workflows; pluggable providers per market (R07 §8.3, generic pattern) | **Simple e-signature with strong authentication and audit + a pluggable provider** if Iraqi law requires qualified signatures. Law No. 78/2012 applicability open (K §10.1; Q-K5; L-17). Badge + PIN for co-signature (K §10). On-glass signing in the MVP; signature pads P2 (K §9.2) |
| Amendments | Never overwrite or delete signed entries. A correction is a linked new version with reason, author and time; the original stays viewable. Patient amendments: addendum + flag + statement of disagreement. Late and downtime entries flagged. Controlled wrong-patient "move" with audit and corrected messages downstream (R07 §8.4) | Addendum, never overwrite (K §10). SI-06: signed notes immutable; amendments are versions; entered-in-error replaces delete (K §5.1); signed rendering hashed (BP §5.1) |
| Legal hold | Patient, encounter, user or date-range scope. Suspends purges on all copies; preserves versions and audit trails; records custodian and chain of custody (R07 §8.5) | Hold overrides every schedule (K §10.1) |
| Release of information | Identity and authority checks (proxy, attorney, subpoena vs court order); clocks; fees; label-based redaction; disclosure accounting; portal, secure-link or structured delivery (R07 §8.5) | Intake, identity/authority checks, redaction of labelled content, disclosure log, SLA timers. **Manual register until R2.1** (K §10.1). No statutory clock known (K §10) |
| Court export | Audit exports with chain of custody (R07 AU-7) | Hash + audit trail + certificate template, once admissibility is confirmed (K §10.1; Q-K5) |
| Portal default | US Cures Act immediate release (R07 §8.5) | Dropped; the K §9.2 rule applies (§8) |

---

## 4. R07 §9 implications

**Ten decisions (R07 §9.1):**

| # | Decision | Kurdistan |
|---|---|---|
| 1 | Trust Plane with mandatory Policy/Audit SDKs; retrofitting is the costliest vendor mistake | Kept (BP §10; ADR-013) |
| 2 | Labels and purpose of use from day one, propagated through FHIR `meta.security`, documents, prints and analytics | SI-21 set (K §5.1) |
| 3 | Region-pinned cells; PHI-free control plane; on-prem variant | On-site cell + Kurdistan DR site (K-16) |
| 4 | Phishing-resistant MFA, no exceptions; badge tap-and-go; JIT PAM with recording; customer-visible support log | Kept, plus mandatory lockbox (K §10) |
| 5 | Downtime-first v1: read-only system, offline BCMA, ID blocks, back-entry | Strengthened (K-18) |
| 6 | Isolated, tested recovery; clean room; point-in-time restore; quarterly tests; public 72 h T0 SLA | Kept (K §10) |
| 7 | Core outside device regulation; device-grade functions in a Regulated Modules track; integrate cleared transfusion and early-warning products | Boundary Register with local opinions (K-05, K-06) |
| 8 | IEC 81001-5-1 + SSDF; SBOM/VEX; signed artefacts; VDP; CVEs | Kept (K §10) |
| 9 | Audit log as product: privacy monitoring, patient access view, forensic exports, free SIEM streaming | Patient view P2 (K §10) |
| 10 | Built-in AI governance: registry, oversight UI, AI event logs, bias monitoring, residency-safe routing | P2 under G1–G16 (K §11.3) |

**Roadmap (R07 §9.2), filtered:**
- **Phase 0 (M0–M3), generic:** ISMS scope; Trust Plane; boundary memo per module; CISO, DPO and CSO; hazard log; SSDLC, SBOM, VDP; threat models. Exit: ADRs approved, hazard log live, CI gates enforced. In K, one QMS/ISMS runs from M0 (K-04).
- **Phase 1, generic:** ISO 27001/27701, pen test, DPIA kit, tested clean-room DR, downtime system. K timing (K §9.3):
  - ISO 27001 (+27701) by M24;
  - pen test by M14;
  - SOC 2 only if a buyer requires it;
  - US$2–5M cyber/PI insurance before the wedge RG4 (M21).
- **Phases 2–3 (India, GCC, EU):** out. ISO 13485 deferred to G5; CE IIa only after a G5 Gulf decision; ISO 42001 by M48 (K §9.3).
- **Phase 4:** EMRAM enablement becomes EMRAM readiness reports in P2 (K §4.3).
- **CISA pledge (R07 §3.1):** US generic pattern; K silent.

**Watch list:**
- R07 §9.3 is all non-Kurdistan, so it is out.
- K's list, reviewed quarterly by the DPO and counsel: an Iraqi PDP law; Iraqi cybercrime law; national health insurance in the Region; KRG e-government/health-IT rules; KRG–federal jurisdiction over health data.
- If a law passes: DPAs, notices and rights workflows updated within 90 days (K §10.2).

**Do not (R07 §9.4; K §10):**
- PHI in logs, analytics or third-party SaaS outside the cell;
- a single clearinghouse/lab/e-Rx dependency without a degraded mode;
- in-core BECS or continuous deterioration alerting in v1;
- trackers or session replay on authenticated pages;
- "HIPAA/GDPR certified" claims;
- PHI in push notifications (K §10);
- PHI to an external LLM without a DPA and a counsel opinion (K §10).

---

## 5. Kurdistan security additions (K §10)

**Baseline:** the controls in §1's Kurdistan column (K §10).

**Physical (on-site cells):**
- a locked server room with an access log and tamper alerts;
- encrypted disks, keys sealed to the TPM and escrowed at the DR site;
- no local admin accounts; remote wipe for a stolen node (K §10);
- hardware only from the Kurdistan Supported Hardware List;
- spares and remote hands per governorate (ADR-027).

**Vendor access:** JIT privileged access with session recording; **customer lockbox approval of every vendor session**; a **customer-visible support-access log** (K §10); an outbound-only management channel (ADR-027).

**Field-engineer break-glass during shutdowns (K §10; ADR-027):**
- an on-site co-sign by the hospital IT lead or CSO;
- single-use sealed credentials, rotated after use;
- the operations plane only;
- a recorded session the customer reviews within 5 working days.

**Insider and VIP risk:** a VIP label for public figures and officials; BTG reviewed within one working day; monthly access reports to the hospital privacy lead (K §10).

**Ransomware:** immutable backups on site and at DR with ≥90 days of restore points; clean-room rebuild; quarterly restore tests; an annual cyber-recovery exercise; a published 72 h T0 objective (K §10).

**Breach notification:** the hospital is notified ≤24 h after we confirm a breach. No statutory clock is known [L]; playbooks need only new clock values when a law arrives (K §10).

**Privacy by contract (GDPR-grade, R07 §1.2 model; K §10):**
- **Roles:** the hospital is the controller and we are the processor; the DPA lists sub-processors bound by the same terms.
- **Lawful basis:** health care under professional secrecy. Consent is not the basis for core clinical record-keeping. Messaging, research and secondary use are opt-in.
- **Rights:** access; a patient-visible access log in P2; corrections by addendum.
- **Tooling:** a DPIA kit per hospital.

**Consent registry:** treatment eConsent by the performing clinician; messaging consent per channel; research opt-in; an optional guardian or co-signer (K §10).

**Residency (K §10; SI-20, K §5.1; K §7.1 rule 9):**
- Usable PHI stays in the on-site cell and the Kurdistan DR site. Anything off-site is ciphertext under hospital-held keys.
- Offshore ciphertext backups need a counsel opinion and hospital approval.
- Offshore AI inference needs the same, plus a **Safety-Board per-tenant processor entry** (DPA, zero retention, region pinning, minimisation, payload audit). This is the only SI-20 exception.
- Message bodies carry no clinical content.
- Egress tests run on every release.
- Default until Q-K2 is answered: no PHI offshore (K §19.2).

**Recurring obligations (K §10.2):**

| Obligation | Cycle | Owner |
|---|---|---|
| ISO 27001 surveillance (recertification every 3 years) | Annual | CISO |
| Penetration test | Annual | CISO |
| Restore test per hospital | Quarterly | SRE lead |
| Cyber-recovery exercise with a customer | Annual | CISO + COO |
| External audit of the safety management system | Annual | Chief CSO |
| Cyber/PI insurance | Annual | CFO |
| Code-Dark drills per unit | Twice a year | Hospital + implementation lead |

---

## 6. AI governance

**Hospital operating model to support (R09 §5.2):** a risk-tiered committee; an inventory of every AI tool; local validation; monitoring; transparency to clinicians and patients; third-party terms; AI-literacy training; decommissioning criteria.

**Components engineering builds (R09 §5.3, §9.1; K §11.4):**

| Component | Must provide |
|---|---|
| Registry | Every model, prompt and agent, vendor or local: version, owner, intended use, risk tier, approval status, deployment scope (sites, units, roles) |
| Model-card store | Source attributes, card fields, instructions for use; an "i" button on every AI output |
| Evaluation harness | Golden datasets; silent-mode runner; local validation report (calibration, PPV at thresholds, subgroups); LLM regression on every model or prompt change. K: **English, Arabic and Sorani** sets gate every release (K §11.3) |
| Runtime monitoring | Input drift; outcome-linked performance; override/dismissal rates; edit distance; latency and cost; subgroup dashboards. BP adds abandonment, share of draft retained, time-in-note, coding shift, and cost per encounter against US$0.05–0.30 (BP §11.3) |
| HITL UX kit | Citations, confidence, "AI-generated" badges, accept/edit/reject with reason codes, per-item order acceptance; one design system |
| Feedback capture | Structured reasons ("not clinically relevant", "already addressed", "incorrect") feeding monitoring and vendors |
| Safety-event reporting | In the incident module, with blinded options. K: one-click reporting with provenance on every AI surface; monthly Chief CSO review (K §11.3) |
| Provenance | Model + version, prompt-template version, sources, raw output, human edits, signer + time; immutable |
| Policy engine | Disclosure rules, consent rules, segmentation, toggles by site, role and population |
| Kill switch | Per model, per site, instantly (SI-19) |
| Equity toolkit | Stratified reports; protected-attribute input flags |
| Grounding service | Permission-filtered, source-cited context per patient, task and user; enforces segmentation and BTG. All models call it; none query the database (R09 §9.1 #3; K §11.2) |
| Model gateway | Multi-vendor; region pinning; zero retention; budgets; PHI redaction; version pinning; fallback; no hard-wired vendor (R09 §9.1 #4). K adds counsel-approved pinning, PHI minimisation, a kill switch, and an on-site small-model option (K §11.2; ADR-018) |
| Agent framework | Tool scopes; approval for writes; sandbox; action logs; customer low-code only once governance is enforced (R09 §9.1 #8) |
| Other (R09 §9.1 #7, #9, #10) | Typed FHIR outputs with source spans; per-feature telemetry; device-grade functions in a separate QMS module or with cleared partners |

**G1–G16, MUST at GA (R09 §5.4).** In K they are MUST at AI GA, applied as if a Kurdistan framework existed [L] (K §11.3).

| # | Requirement | Kurdistan note |
|---|---|---|
| G1 | Registry of models, prompts and agents: version pinning, owner, intended use, risk tier, approval | — |
| G2 | Model cards/source attributes per DSI, in workflow, customer-editable for local models; kept regardless of HTI-5 | US basis = generic pattern |
| G3 | Immutable, exportable provenance (model, version, sources, output, edits, signer) | — |
| G4 | No AI output enters the record, reaches a patient, or executes an order or claim without an accountable human, unless a governed narrow-autonomy policy allows it | SI-07 `draft-ai` from P2 (K §5.1); never auto-sign, file or message (K §11.3) |
| G5 | Structured override/feedback reasons on alerts and drafts | — |
| G6 | Retrospective and silent evaluation: calibration, PPV/sensitivity, alert burden, subgroups | Predictive models silent first (K §11.2) |
| G7 | Monitoring of drift, performance, usage, edit distance, overrides, subgroup gaps, with thresholds | Drift and equity for AI-0 (K §11.2) |
| G8 | Safety events into incident management, with a blinded option | K §11.3 |
| G9 | Per-feature, per-site disable and instant rollback | K §11.2 |
| G10 | Patient-facing AI identifies itself; AI-drafted patient messages labelled (generic pattern) | Patient text only from approved templates (K §11.2) |
| G11 | Recording consent for ambient, opt-out honoured | Ambient P3 |
| G12 | PHI minimisation; region-pinned inference; no vendor retention or training unless contracted; segmentation | SI-20, SI-21 (K §5.1, §10) |
| G13 | Agents: least-privilege scopes; write approval; injection defences; action logs | — |
| G14 | Classification record per AI feature, with evidence | Boundary Register (K-05); AI-3 record (K §11.2) |
| G15 | Regression evaluation before any model/prompt update; release notes; PCCP for device modules (generic pattern) | Trilingual evaluation gate (K §11.3) |
| G16 | Declared protected-attribute inputs; stratified reports (US §1557 = generic pattern) | Equity-audited outreach (K §11.2) |

**SHOULD within 12–18 months (R09 §5.4):**
- G17 CHAI model card and intake controls (US); G18 CHAI/RUAIH control map (US);
- G19 ISO 42001 + NIST RMF (K: 42001 by M48);
- G20 outcome dashboards; G21 coding-integrity monitor;
- G22 governed low-code agent builder; G23 patient AI transparency page; G24 federated benchmarks;
- G25 EU deployer pack (out); G26 AI-literacy tracking per role.

**Avoid (R09 §9.3):** in-house speech or LLMs; black-box alerts; inadvertent devices; auto-writing, auto-signing or auto-messaging; "time saved" sales; prediction-based rationing without equity audits; governance on paper only.

**Kurdistan phasing (K §11.2; K-23; K §4.3):**

| Tier | Features | Phase | Rule |
|---|---|---|---|
| Platform | Gateway (counsel-approved pinning, zero retention, minimisation, version pinning, kill switch, on-site small-model option); grounding; control plane; HITL kit | **P2** (≈M42, after G3) | No model touches the database |
| AI-1 documentation | Source-cited **English discharge drafts** with an omission checklist (diagnoses, discharge medications, follow-up, pending results) before sign-off; **English dictation structuring**, which avoids Kurdish speech recognition | P2 | `draft-ai` until signed; per-sentence citations; unsourced diagnoses blocked |
| AI-1 patient language | Sorani/Badini/Arabic instructions from a vetted template library. AI only **suggests** a template; new text is approved by a bilingual clinician | P2 | No free machine translation |
| AI-0 operational | Insurer document packs; equity-audited no-show outreach; capacity and LOS forecasts | P2 | Drift + equity monitoring |
| Ambient | Arabic and English first; Sorani/Badini only after two partners pass S8-K | P3 | Partners only |
| AI-3 device-grade | Cleared partner deterioration and sepsis models, silent first | P3 | Classification record |

- **No ambient AI in the MVP**; AI products are excluded from it (K-23; K §4.3).
- **Degrade cleanly:** show "unavailable" and keep the manual path, including during shutdowns [I] (K §11.2).
- **Build vs partner:** build the gateway, grounding, control plane, HITL, evaluation and provenance; partner for speech, LLMs and predictive models (K §11.4).
- **Pricing:** ≥30% margin, ≥1.43× the S8-K unit cost (K §11.4).
- **Cross-border inference:** counsel opinion + hospital approval (K-23) via the SI-20 processor entry (K §10).

---

## 7. Data platform (R09 §6; K §11.1; BP §11.1)

**Layers (R09 §6.2):**
- **Path:** bitemporal journal-backed transactional core → log-based CDC (sub-minute) → governed, region-pinned lakehouse on open table formats.
- **Bronze:** CDC, HL7/FHIR/DICOM metadata, device streams, claims, ERP, patient-generated data.
- **Silver:** conformed canonical model + terminology normalisation.
- **Gold:** dimensional marts; FHIR projection (Bulk source); OMOP v5.4; measure outputs; registry extracts; ML sets, feature store, vector indexes.
- **De-identified tier.**
- **Above:** real-time services (FHIR API, CDS Hooks/SMART, Subscriptions, grounding, online features, streaming), a semantic layer and the AI control plane.

**Principles (R09 §6.2):**
1. The journal is written in the same transaction as current state and doubles as the outbox; log-based CDC; full event sourcing only for order/MAR aggregates, by ADR.
2. One canonical model; all projections from the same silver layer so numbers reconcile.
3. Terminology services as infrastructure.
4. CQL measure engine with configurable indicators (national specifics = generic pattern).
5. BI over a governed semantic layer (certified metrics; RLS by facility, department, role). Text-to-SQL only over it, never raw tables.
6. Streaming analytics: bed state, boarding, OR status, early-warning scoring, alarm analytics, sepsis timers.
7. FHIR Bulk `$export` (system, group, patient) with SMART Backend Services.
8. OMOP + OHDSI tools.

**Secondary use (R09 §6.3–§6.4, §9.3 #9):**
- both de-identification routes, plus tokenisation/PPRL (HIPAA = generic pattern);
- opt-in federation (OMOP, FHIR, federated query); federated learning needs a common model, secure aggregation and agreements;
- synthetic data for development and test only, never validation;
- opt-in, de-identified benchmarking;
- no nightly-ETL lock-in: expose Parquet/Delta/Iceberg, SQL, FHIR Bulk and OMOP.

**Kurdistan phasing (K §11.1):**

| Phase | Components |
|---|---|
| MVP | **On site:** read models (≤2 s); reporting replica (≤60 s) with MIS, JCI measures, KRG returns, safety telemetry and the owner's dashboard (revenue/collections by currency, unbilled consumption, deposits outstanding, corporate receivables); report builder (K §4.3).<br>**Centrally:** encrypted per-tenant CDC bronze landing for migration staging, CDS replay and analytics |
| P2 | Silver layer; OMOP and SQL-on-FHIR as outputs; command-centre data |
| P3 | Opt-in cross-hospital benchmarking, hospitals as co-owners. **Never sell identifiable data** |

**Inherited from BP, not restated in K (BP §11.1):**
- bronze stored as Iceberg;
- semantic layer and text-to-SQL only over it, in P2;
- OMOP/SQL-on-FHIR never the operational model;
- one indicator catalogue for MIS, accreditation KPIs and returns.

**ADRs:** ADR-023 kept. ADR-028: PostgreSQL search in the product; OpenSearch only for central logs and analytics (K §7.2).

---

## 8. Digital front door (R09 §7; K §9.1–§9.2, §4.3)

**Phases (K §4.3):** MVP = R1/R2/R2.1 (M22–M40); P2 = M38–M54 (GA wave M50); P3 = M52+.

**Kurdistan rules, MVP (K §9.2 Plane C; K §4.3):**
- **Channels:** WhatsApp, Viber and SMS **without an account**, using trilingual templates.
- **Report release** (phones are shared within families [L]):
  - an **OTP to the registered mobile plus a knowledge check**;
  - **single-use links valid ≤72 h**;
  - **no clinical content in message bodies** (also SI-20);
  - **SI-21-labelled results and pregnancy tests are never released by message** (K §5.1);
  - every release is logged in BALP.
- **Adapters:** booking links; wallet payment links; KRG returns; DHIS2.
- **IVR:** P2, same release rule (K §9.2).
- **Shutdowns:** SMS via the per-site GSM/SMPP gateway (no internet); voice calls for critical messages [I]; central adapters queue ≥7 days (K §9.1, §7.9).
- **Payments:** semi-integrated card terminals; wallet/QR links in R1.1 (e.g. FIB, FastPay, ZainCash, Qi Card [L]); no card PAN in the HMS; wallets and national ID never built (K §9.1–§9.2; K-09).
- **Consent:** per channel, opt-in (K §10).
- **Language:** preferred output language captured at registration; Badini templates reviewed by Duhok staff; Eastern Arabic-Indic digits optional for non-clinical numbers, but clinical numerals always Western (K §6.7).
- **Commercial:** messaging passed through at cost plus a capped margin (K §9.2).
- **Referrers:** critical results reach external referring doctors for outpatient-tier results (SI-04; K §4.3). Referrer portal **without commission features** in P2 (K §4.3).

**R09 generic patterns retained:**
- **Engagement engine:** one channel-agnostic engine renders every journey, with per-channel consent, templates and delivery receipts (R09 §7.7).
- **Release rules engine:** documented preventing-harm exception; "expect a call" flag; templated explanations (R09 §7.3).
- **Activation:** mobile-first; proxy flows core; staff activate patients (R09 §7.1).
- **Scheduling:** decision-tree self-scheduling; waitlist auto-fill (R09 §7.4).
- **On site:** queue status by SMS/WhatsApp; family updates (R09 §7.5).
- **Telehealth:** browser video, interpreter three-way calls (R09 §7.6).
- **Accessibility:** WCAG 2.2 AA, low-bandwidth mode, human-verified clinical templates (R09 §7.8).
- **AI agents, if ever built:** strict scope, human escalation, no AI diagnosis (R09 §7.4). Not in the K plan.

**Feature matrix (R09 §7.9 vs K):**

| F# | Feature | R09 | Kurdistan |
|---|---|---|---|
| F8 | Outreach without an account | MVP | **MVP** (K §4.3) |
| F3/F4 | Results release + explanation | MVP; AI P1 | **MVP** under the K §9.2 rule; AI template suggestion **P2** (K §11.2) |
| F6 | Self-scheduling | MVP | **MVP** booking links |
| F11 | Payments | MVP | **MVP** wallet links (R1.1) |
| F23 | Kiosk + tokens | MVP (emerging) | Tokens/signage **MVP**; kiosks **P2** (K §4.3, §9.2) |
| F24 | Multilingual + RTL | MVP | **MVP** trilingual (K §6.7) |
| F27 | Consent | MVP | **MVP** (K §10) |
| F29 | Education content | MVP | **MVP** approved templates (K §4.3) |
| F1, F5, F9, F12, F14, F15 | Account, messaging, e-check-in, proxy, refills, forms | MVP | Patient app **P2**; features not itemised (K §4.3) |
| F13 | Video | MVP | Teleconsultation **P2** |
| F17 | RPM | P1 | **P3** |
| F20 | Voice/chat agents | P1 | IVR **P2**, no AI agents |
| F19 | Patient AI assistant | P1 | Not planned; AI never messages patients (K §11.3) |
| F28 | Patient-access API | MVP | SMART 2.2 façade exists (K §9); patient use unspecified |
| F25 | WCAG 2.2 AA | MVP | BP §6.7 (with VPAT); not restated in K |
| F10, F26 | US pricing; national apps/HIEs | MVP | **Out** (US; no national exchange [L], K §9) |

Not addressed in K: F2, F7, F16, F18, F21, F22, F30, F31, F32.

---

## 9. Clinician mobile (R09 §8; K §6.6)

**App (K §6.6; ADR-019 kept).** One React Native app with two modes:
- **Nurse mode:** BCMA, bedside specimen labels, vitals, photos.
- **Physician mode:** result acknowledgement, critical read-back, patient-context secure chat, tablet rounds.

**Rules (K §6.6, §4.3, §7.10; K §5.1; BP §5.1):**
- encrypted offline cache;
- administration only against orders verified pre-outage (SI-15);
- no PHI in notifications;
- MDM on shared devices; MDM work profile for physician mode on personal phones;
- SI-16 banner on every view;
- offline commands revalidated by the server, with no last-writer-wins;
- offline BCMA in the MVP; BCMA p95 500 ms.

**R07 controls:** EN-2; DP-6 remote wipe; DP-8 clipboard/screenshot limits; SD-6 MASVS; a time-bounded, encrypted MAR cache reconciled on reconnect (R07 §6.3 #6).

**R09 §8 capabilities vs K:**

| # | Capability | Kurdistan |
|---|---|---|
| 1 | Unified app: lists, results, notes, orders with sign, in-basket, media capture, barcode, dictation/ambient, cited AI chart summary | Two-mode app; AI P2, ambient P3 (K §11.2) |
| 2 | Communication: patient-context chat; role addressing from on-call schedules; escalation and read receipts; critical-result acknowledgement; nurse-call/alarm routing | Chat + read-back (K §6.6); SI-04 named recipient, read-back, timed escalation; alarm routing in conflict (§0) |
| 3 | Paging replacement: priorities, pager/SMS failover, quiet hours, audit | Not in K |
| 4 | Voice: commands, dictation, ambient | English dictation structuring P2; ambient P3 |
| 5 | Productivity telemetry (time in EHR, after-hours, message volume) | Not in K §6.6 |
| 6 | Shared-device security: badge/biometric login, MDM, offline read-only views, DLP | MDM; tap-to-switch ≤2 s (K §9.2) |
| 7 | Team in-basket: pools, delegation, AI pre-triage, burden analytics | Team inbox with pools; in-basket AI not a priority (K §6.4) |

---

## 10. Device and peripheral security (R16 §11)

| # | Requirement (R16 §11) | Kurdistan |
|---|---|---|
| 1 | **Segmentation:** dedicated VLANs per device class (nurse call, RTLS, BMS, POS, printers, kiosks). The site edge agent is the **only** bridge to HMS services; traffic to the cloud is outbound mTLS only, with nothing inbound from the internet. Consistent with EN-3, IEC 80001-1 and PCI POS segmentation | VLAN per class (K §9.2). Plane B is merged into the on-site cell for hospitals and stays a hardened appliance at outpatient sites (ADR-011). Outbound-only traffic (K §7.3, §7.8) |
| 2 | **Workstation identity:** a device certificate per shell or kiosk, bound to a logical workstation record (location, printers, kiosk mode, allowed devices) | — |
| 3 | **Firmware and SBOM:** partners supply firmware notes, an SBOM (SPDX/CycloneDX), a CVE process and an end-of-support date. The device registry correlates SBOMs with vulnerability feeds. Our shell and edge agent ship signed, with SBOMs (EU CRA framing = generic pattern) | Kurdistan Supported Hardware List with in-country service (K §9.2; ADR-027) |
| 4 | **Least privilege in the shell:** capabilities (raw print, ID read, biometric capture, pay) granted per workstation profile and per role; every call audited in BALP; no arbitrary native code from the web layer | Tauri 2 shell with the HAL (ADR-019, kept) |
| 5 | **Kiosk hardening:** assigned-access OS, no local admin, auto-logout, privacy screens, tamper sensors, PCI PTS PIN pads only | Kiosks P2 (K §4.3) |

**Also (K §9.1–§9.2):** no card PAN in the HMS; semi-integrated terminals; the HMS is never in the primary alarm path; no alarm, nurse-call or RTLS engine is ever built.
