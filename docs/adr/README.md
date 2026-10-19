# Architecture decision records

This directory holds the architecture decisions of HMS Kurdistan, one file per decision, in the form of template B.1 (BUILD-PROMPT Appendix B). ADR-001 to ADR-028 are the baseline of BUILD-PROMPT §4.2, written in WP-0.1. "Baseline" means accepted for the build. ADR-001 and ADR-009 stay accepted-provisional until their spike criteria pass on the reference cell (WP-0.6); the other 26 are accepted.

No ADR claims a guard result beyond a stored CI record it cites (ADR-010 and ADR-020 cite `docs/program/evidence/ci/2026-10-18-fast-d3e14de.json`). Each ADR's "Fitness test that guards it" section names the guard from §4.2, says where and when it will be implemented, and ends with a "State on 2026-10-18" line saying what exists.

## Index

| ADR | Title | Status | Guarded by (BUILD-PROMPT §4.2) | Where the guard is or will be implemented |
|---|---|---|---|---|
| [ADR-001](ADR-001-core-data-option-a.md) | Core data, Option A: our own FHIR-shaped domain model on PostgreSQL | accepted-provisional | Spike harness C1–C9 (§18.6) | `spikes/adr-001/`, WP-0.6: C1–C6 and C8 measured on the dev cell (indicative), C7 and C9 harnesses dry-run at reduced scale; the reference-cell run of C7 and C9 waits for hardware [HUMAN: hardware] |
| [ADR-002](ADR-002-runtime-kotlin-jvm-spring.md) | Runtime: Kotlin on the JVM, Spring Boot plus Spring Modulith | accepted | Build | The Gradle build under `backend/`, run by `tools/ci/run fast`; WP-0.1 |
| [ADR-003](ADR-003-modular-monolith-satellites.md) | Modular monolith plus satellites | accepted | Modulith verification; ArchUnit | ArchUnit rule library `backend/platform/arch-rules` (WP-0.1, fast tier); Spring Modulith verification from WP-0.3 |
| [ADR-004](ADR-004-event-model-es-lite.md) | Event model: event-sourcing-lite with the bitemporal journal as the transactional outbox | accepted | Spike S2; performance suite | Spike S2 in `spikes/adr-001/` (WP-0.6); the performance suite `tests/performance/` in the nightly tier, the 300-bed day once the reference cell exists [HUMAN: hardware] |
| [ADR-005](ADR-005-canonical-model-versioning.md) | Canonical Model Versioning and a projection compiler | accepted | Projection round-trip tests; FHIR validator | The Hub (`backend/hub/`): first projections and validation in WP-1.12; C4–C6 in the ADR-001 harness (WP-0.6); the FHIR validator in the merge tier |
| [ADR-006](ADR-006-tenancy.md) | Tenancy: tenant = the contracting enterprise; each hospital on its own on-site cell | accepted | RLS tests; tenancy tests | Tenancy tests in WP-0.3 and WP-1.1; RLS tests with the pooled tier in WP-1.13 (merge tier) |
| [ADR-007](ADR-007-on-site-cells-central-dr.md) | On-site hospital cells, a Kurdistan central and DR site, and a PHI-free control plane | accepted | Conformance suite on both substrates | `tests/conformance/`; the dev cell in WP-0.2; the installer and central site in WP-1.13; the reference cell [HUMAN: hardware] |
| [ADR-008](ADR-008-keys.md) | Keys: per-tenant envelope keys with crypto-shredding, sealed on site and escrowed at the DR site | accepted | Key-rotation and shredding tests | WP-0.4 (envelope keys and crypto-shredding against the swtpm and SoftHSM2 stand-ins, merge tier); WP-1.13 (TPM sealing, escrow at the DR site) |
| [ADR-009](ADR-009-messaging.md) | Messaging: journal-as-outbox and one event backbone everywhere | accepted-provisional | C9 footprint test; ordering tests | The C9 harness and the Kafka vs NATS comparison in `spikes/adr-001/` (WP-0.6), with the reference-cell run [HUMAN: hardware]; ordering tests in WP-0.3, WP-1.1b and WP-1.12 |
| [ADR-010](ADR-010-workflow-temporal.md) | Workflow: Temporal behind WorkflowPort for long-running processes | accepted | ArchUnit: no Temporal types outside the adapter | A rule in `backend/platform/arch-rules`, acting once the Temporal adapter exists (WP-0.3); fast tier |
| [ADR-011](ADR-011-edge-planes.md) | Edge planes A, B and C | accepted | Downtime matrix tests | WP-0.7 (shell HAL with simulated devices), WP-1.10 (GSM/SMPP gateway during an internet cut), WP-1.13 (edge agent; power-cut and WAN-cut chaos); nightly chaos |
| [ADR-012](ADR-012-offline-downtime-matrix.md) | Offline and downtime safety matrix in the hazard log | accepted | Offline conflict suite (S9-K) | WP-0.6 (offline-BCMA conflict replays in the C2 harness), WP-3.3 (BCMA offline mode), WP-3.14 (the S9-K suite on the real cell profile) |
| [ADR-013](ADR-013-trust-plane.md) | Trust Plane: Keycloak and OpenFGA with mandatory Policy and Audit SDKs | accepted | ArchUnit: no repository access without the SDK | A rule in `backend/platform/arch-rules`, acting once the Trust Plane SDK exists (WP-0.4); fast tier |
| [ADR-014](ADR-014-integration-hub.md) | The native Integration Hub owns every interface | accepted | Channel tests; zero-silent-drop chaos test | `backend/hub/`: WP-1.1b and WP-1.12; chaos in the nightly tier, conformance profiles in the merge tier |
| [ADR-015](ADR-015-terminology.md) | Terminology | accepted | Terminology conformance tests | The `terminology` module in WP-1.1 (`PLT-CORE-05`); merge tier |
| [ADR-016](ADR-016-regulated-module-segregation.md) | Regulated-module segregation | accepted | Static analysis (no dose arithmetic elsewhere); sidecar contract tests | A detekt rule plus an ArchUnit rule (no work package named in §21; can act once `Quantity` exists, WP-0.3); sidecar contract tests with each sidecar: WP-1.5, Phase 1.1, WP-3.5, WP-3.10, Phase 5 |
| [ADR-017](ADR-017-cds.md) | Clinical decision support: drug-KB adapter, DMN for non-device rules, native Tier 2 calculators | accepted | ArchUnit; Tier 2 boundary-value tests | An ArchUnit rule acting once a rules engine enters the build (WP-1.1, WP-1.5); Tier 2 boundary-value tests in WP-1.5 and WP-3.5 |
| [ADR-018](ADR-018-ai-gateway.md) | AI gateway and control plane (P2) | accepted | DB-credential scanner; `draft-ai` tests | The database-credential scanner: no work package named in §21, needed by Phase 5 at the latest; `draft-ai` tests in Phase 5 |
| [ADR-019](ADR-019-clients.md) | Clients: React/TypeScript with one design system, a Tauri 2 shell with the HAL, React Native mobile | accepted | — | None named |
| [ADR-020](ADR-020-configuration-content-as-code.md) | Configuration and content as code: signed bundles, promotion and no customer branches | accepted | Signed-bundle verification; branch detector | Branch and tenant-identifier detectors in `sh tools/hms repo check` (WP-0.1, fast tier); signed-bundle verification in WP-0.3 (`PLT-CFG-01`) and WP-1.1 (`PLT-CFG-02`) |
| [ADR-021](ADR-021-delivery-release-train.md) | Delivery: weekly central delivery, a monthly on-site release train and staged rings | accepted | Upgrade/rollback tests; drift telemetry | The N-1 migration upgrade-and-rollback test in the merge tier, from WP-0.3; cell upgrade and rollback, signed offline media, the fleet agent and the fleet console's drift view in WP-1.13; the reference cell before release [HUMAN: hardware] |
| [ADR-022](ADR-022-licence-dependency-governance.md) | Licence and dependency governance | accepted | ORT licence scan in CI | ORT in the merge tier, WP-0.9 (container engine and dev stack from WP-0.2); the policy files and `sh tools/hms licence check` written in WP-0.1 |
| [ADR-023](ADR-023-data-platform.md) | Data platform: reporting replica and read models on site, encrypted CDC bronze landing centrally | accepted | Freshness tests | No exit criterion in §21: read models from WP-0.3; the reporting replica and the CDC bronze landing in WP-1.11; silver layer, OMOP and SQL-on-FHIR in Phase 5 |
| [ADR-024](ADR-024-care-team-assignment.md) | Care-team assignment: an ES-lite core domain that feeds nurse call | accepted | Event tests | Not yet placed: BUILD-PROMPT gives the domain no feature ID, owning module or work package; the event infrastructure it needs comes in WP-0.3 |
| [ADR-025](ADR-025-single-hospital-edge-cell.md) | The single-hospital edge cell is the default; the multi-site edge cell is P3 | accepted | — | None named |
| [ADR-026](ADR-026-power-and-time.md) | Power: separate UPS feeds, crash-safe storage and time without the internet | accepted | Power-cut chaos tests; clock-skew tests | Nightly chaos on the dev cell (from WP-0.2); WP-1.13 (`PLT-PWR-01`, `PLT-SITE-01`); the burn-in power-cut test on an installed cell [HUMAN: hardware] |
| [ADR-027](ADR-027-fleet-operations.md) | Fleet operations: outbound-only management, co-signed local break-glass and supported hardware | accepted | Break-glass tests | WP-1.13 (`PLT-SITE-01`), although §21's exit evidence for WP-1.13 does not name the test |
| [ADR-028](ADR-028-search-postgresql.md) | Search: PostgreSQL full-text and trigram indexes in the product; OpenSearch only centrally | accepted | Search performance test | WP-1.2 (exit evidence: cross-script search ≤200 ms p95; dev-cell numbers are indicative); the nightly scaled day; the 300-bed day on the reference cell [HUMAN: hardware] |
| [ADR-038](ADR-038-document-rendering-and-print-pipeline.md) | Document rendering and the print pipeline: one layout for ZPL, ESC/POS and HTML; WeasyPrint renderer satellite | accepted-provisional | Golden images, byte fixtures, the font-coverage test and the offline-renderer tests (WP-0.8) | `backend/modules/platform-docs` (fast tier) and `backend/satellites/document-renderer` (the nightly `golden-image-print` step); S7-K on physical printers [HUMAN: printers] |

## Adding an ADR

1. **Number and name.** The next free number is ADR-029. Name the file `docs/adr/ADR-nnn-<slug>.md`, one file per number.
2. **Use template B.1** (BUILD-PROMPT Appendix B):

   ```markdown
   # ADR-0nn: <title>
   Status: proposed | accepted | accepted-provisional | superseded by ADR-0mm
   Date: <yyyy-mm-dd>   Source: <K §, BP §, R §>
   ## Context
   ## Decision
   ## Consequences (including safety and licence impact)
   ## Fitness test that guards it
   ## Reopen if
   ```

3. **Fill it in the way the baseline ADRs do.**
   - **Source:** cite every source precisely: K §n, BP §n, R0n §n, RL #n, BUILD-PROMPT §n.
   - **Context:** the question; what the research, BP and K say; any [P] mark; any difference between sources, which also goes to `docs/program/OPEN-QUESTIONS.md` (BUILD-PROMPT §1).
   - **Decision:** the decision in full, with the stack detail that belongs to it.
   - **Consequences:** safety (invariants and hazards), engineering, operations and licence impact.
   - **Fitness test:** the guard, where and when it is or will be implemented, and a "State on <date>" line. Never claim that a check exists or passes unless it does, with evidence (BUILD-PROMPT §3.5).
   - **Reopen if:** the trigger, or "No reopen trigger is set".
4. **Never write a person, panel or role into an approval or acceptance field.** Approvals come only from sign-off records a human adds (BUILD-PROMPT §3.5).
5. **Add a row to the index above** in the same change.

## Changing an ADR

- **Changing a baseline ADR is stop-and-ask item 2** (BUILD-PROMPT §3.4): record it in `docs/program/DECISIONS-NEEDED.md` and continue with other work. The baseline is all 28 ADRs above, including the two accepted-provisional ones. A new ADR that replaces a baseline decision also needs that decision, because the old ADR's status becomes "superseded by ADR-0mm" (template B.1).
- **ADR-001 and ADR-009** stay accepted-provisional until their spike criteria pass on the reference cell (WP-0.6) [HUMAN: hardware]. If a measured result already triggers a reopen rule, that is recorded instead (BUILD-PROMPT §21, WP-0.6).
- **The ADR freeze** at the Phase 0 exit is confirmed by the human lead (BUILD-PROMPT §21) [HUMAN].

## Decisions that BUILD-PROMPT says need an ADR

- Changing any choice marked [P]: [P] items are binding until an ADR changes them (BUILD-PROMPT conventions, §1).
- Switching the backend runtime away from Kotlin: an ADR backed by the S18-K talent survey (§4.1; ADR-002).
- A two-node-plus-witness on-site cell: its own ADR stating its RPO (§5.1).
- Production signing keys and any transparency log: an ADR and a [HUMAN] decision (§4.3; ADR-022).
- Any other decision taken while building: "ADRs for any decision" (§3.2, step 6 of the work-package loop; Definition of Done item 8, §22.1).
- Related: WP-0.8 keeps the document renderer choice accepted-provisional until spike S7-K (§4.1, §21).

## Reserved numbers

Parallel work-package branches each hold their own range of ADR numbers, so on one branch the numbers of the others are missing until the branches merge. `sh tools/hms repo check` accepts a missing number only while it is listed here; the baseline ADR-001 to ADR-028 can never be reserved. Remove a line when the branch that holds the number is merged.

- ADR-029 to ADR-037: held by the other parallel branches of 19 October 2026 (WP-0.2 holds ADR-029 and ADR-030).
- ADR-039 to ADR-040: held by WP-0.8 (`wp/0.8-documents-printing`) for later decisions.

## What the repository check enforces

`sh tools/hms repo check` (the `repo-check` step of the fast tier, `tools/hmstools/repo/rules.py`) checks every file `docs/adr/ADR-*.md`, the baseline ADR-001 to ADR-028 and every later number alike:

- **Numbers.** Each file is named `ADR-nnn-<lower-case-slug>.md`; there is exactly one file per number; ADR-001 to ADR-028 exist, and the numbers run without a gap up to the highest one present, except numbers listed under "Reserved numbers".
- **Template B.1.** The first line is the title `# ADR-nnn: <title>`, with the file's own number. Between the title and the first `##` heading stand exactly one `Status:` line, whose whole value is `proposed`, `accepted`, `accepted-provisional` or `superseded by ADR-nnn` (so `accepted, approved by the CSO` fails, and so does a second line such as `Status: approved by the CSO`), and accepted-provisional or superseded for ADR-001 and ADR-009; and exactly one `Date:` line, with a calendar date in `yyyy-mm-dd` form followed by a `Source:` field. The five B.1 headings (`## Context`, `## Decision`, `## Consequences (including safety and licence impact)`, `## Fitness test that guards it`, `## Reopen if`) appear at level 2, each exactly once and in that order; other level-2 sections may stand between them (ADR-002's "Pinned set"), and headings inside fenced code blocks do not count.
- **This index.** It exists and links every ADR file by its file name.

It does not check what the sections say, and it does not compare this index's Title and Status columns with the files.
