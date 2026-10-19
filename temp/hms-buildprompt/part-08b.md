
---

## 19. CI/CD and release engineering

### 19.1 Pipeline tiers

**What CI means here.** Until a human provides a remote and a CI service, CI is `tools/ci/run <fast|merge|nightly|release>`, which you run locally (built in WP-0.1, listed in `COMMANDS.md`).
- **Evidence:** each run writes `docs/program/evidence/ci/<date>-<tier>-<sha>.json` with the commands, counts, durations, host, cell and result.
- **Blocks merge:** a `wp/*` branch merges into `main` only if `merge` passed on the merge candidate (§3.6).
- **Nightly:** run `tools/ci/run nightly` at the end of every session that changed code, unless a human has scheduled it. A red nightly is the next session's first task.
- **Hosted CI:** you may write hosted-CI configuration, but it is not evidence until it has actually run.
- **No shortcuts:** never report a shortened run as the gate. Record the actual sequence counts and durations.

| Tier | Trigger | Contents | Budget |
|---|---|---|---|
| **Fast** | Every commit | Compile; detekt, ktlint, ESLint, TypeScript; unit tests; short property-based runs (≈1,000 sequences per machine); architecture tests (§6.8); localisation lint; secret scan | ≤10 min |
| **Merge** | Every pull request | Integration tests (Testcontainers); contract tests (OpenAPI, AsyncAPI, HL7 v2 conformance profiles, FHIR validator); migration upgrade-and-rollback (N-1); end-to-end smoke in `en`, `ckb` and `ar`; axe accessibility checks; RTL visual diffs; licence, vulnerability and container scans; SBOM; coverage gates; mutation tests on touched Tier 2 code | ≤45 min |
| **Nightly** | End of every session that changed code, or a human-scheduled run | 10⁶ randomised property-based command sequences across all invariants (C2), at the application-command layer with in-memory adapters, plus at least 10⁴ sequences through each real channel adapter; the clinical scenario suites; full end-to-end; golden-image print tests; a scaled functional day (about 30 beds) on the dev cell, with p95 compared against the same host's last baseline (a regression above 15% across three runs fails); the **300-bed day** on the reference cell and the **1,000-bed day** on the central profile once that hardware exists; chaos (node kill, WAN cut, power-cut emulation, broker loss, database failover, clock skew); a restore test; parser fuzzing | Overnight |
| **Release** | Release branch or tag | Signed container images, Helm charts, Tier 2 sidecars, desktop shell and mobile builds; CycloneDX SBOM and VEX; SLSA provenance; cosign signatures; the **Release Evidence Pack** (§10.1); trilingual release notes; offline media image | Per release |

Any p95 regression in the reference-cell performance run blocks release (K §7.11). A red nightly is the first task of the next session.

### 19.2 Environments

`dev` (compose) → `ci` (an ephemeral dev cell plus the central profile) → `test` → `train` → reference cell on real hardware (when available) → production rings. Configuration bundles follow the same promotion path: BUILD → TEST → TRAIN → PROD. No production PHI exists outside production; every non-production environment uses synthetic data only.

### 19.3 Change classes (BP §5.4; K §5.4)

| Class | What | Process |
|---|---|---|
| **C0** | No change to clinical behaviour | Continuous delivery |
| **C1** | Clinical-behaviour change behind a flag | Ships flag-off by default; CSO review [HUMAN]; scenario suites green; accreditation-impact field filled |
| **C2** | Tier 2 changes, Tier 2 activations, regulated releases | Batched quarterly; regulatory-impact assessment; Boundary Register update; independent concurrence where K-05 requires it [HUMAN] |

### 19.4 Content pipeline (content is a regulated artefact)

Order catalogues, formulary, CDS rules, tariffs and packages, forms, templates and translations are versioned sources in `content/`, built into signed bundles and validated before promotion:
- schema and referential validation (every code resolves in the terminology service; every orderable has a charge mapping or an explicit "non-chargeable" flag);
- CDS rules: the CPOE error-category harness (§18.5); new or locally modified rules run silent for 2–4 weeks with replay against up to 90 days of orders where electronic orders exist;
- tariffs and packages: a **re-pricing replay of 3–6 months of encounters** before activation, with variance reports;
- drug-KB content releases are regression-replayed like code;
- translations: zero missing keys in clinical paths; clinician review recorded [HUMAN].

**Synthetic content is a gate, not a label.** Every content item and test fixture carries `provenance: synthetic | approved` as data. Promotion to TRAIN or PROD fails if any item is synthetic, and the Release Evidence Pack lists every synthetic item still present. Synthetic identifiers use reserved forms so they can never match a real product or patient:
- GTINs with the GS1 demonstration prefix 952;
- MRNs and accession numbers prefixed `SYN-`;
- drug names such as "Synthdrug A 500 mg tablet";
- codes from `urn:hms:synthetic:*` code systems, never real LOINC, ICD-10, ATC or SNOMED CT codes recalled from memory;
- thresholds and ranges whose source is recorded as "synthetic", never copied from guidelines.

### 19.5 Release trains and rings (ADR-021)

Weekly to the central site; a monthly on-site train with C2 changes quarterly; staged rings (reference cell ≥7 days → a non-flagship site ≥14 days → all sites; DP#1 never first); one deferral allowed per site for a go-live, a mass-casualty event or a shutdown; maximum drift N-1; signed offline media for cells that cannot reach us. The fleet console shows ring, version and drift per cell.

### 19.6 Delivery metrics

DORA targets: weekly deploys centrally, lead time under 7 days, change-failure rate under 10%, MTTR under 60 minutes. Track releases with a complete evidence pack (target 100%) and CSO triage time (≤2 working days) (K §17).

---

## 20. Documentation and evidence the build produces

Treat documentation as part of the product. The agent writes and maintains it; [HUMAN] reviewers approve the safety and regulatory items.

| Area | Artefacts |
|---|---|
| Architecture | C4 context, container and component diagrams as code; the bounded-context map; ADRs; the IEC 62304 software-system decomposition showing the Safety Kernel and the Tier 2 split, with the segregation and class-propagation analysis |
| Specifications | Module specs; executable state-machine specs; OpenAPI and AsyncAPI contracts; the domain-event catalogue; HL7 v2 conformance profiles per interface; the FHIR CapabilityStatement and profiles; the Kurdistan pack data dictionary |
| Safety and quality | Hazard log; per-release Clinical Safety Case Report; traceability matrix; SOUP list; ISO 14971 risk management file per Tier 2 module; IEC 62366-1 usability engineering file (use specification, user-interface specification, critical tasks, formative and summative evaluation plans); software development plan; verification plans and reports; known-anomalies list; instructions for use per module in three languages |
| Security and privacy | Threat model per module (STRIDE) and per deployment topology; SBOM and VEX per release; penetration-test readiness pack; data-flow maps; processor records; the hospital DPIA kit inputs |
| Operations | Runbooks: install, upgrade, rollback, restore, DR promotion, break-glass, downtime and Code-Dark, key rotation, certificate renewal, removable off-site backup; monitoring and alarm guide; capacity guide |
| Implementation | Migration Workbench guide; foundation-content guide; configuration guide; RG1–RG4 evidence templates; trilingual training material skeletons and in-product help |
