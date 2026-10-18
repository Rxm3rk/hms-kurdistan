# ADR-022: Licence and dependency governance
Status: accepted
Date: 2026-10-18   Source: K §7.2 (kept), §7.6, §18 (risk 29); BP §7.2, §7.7, §18 (risk 29); R02 §1 #13, §8.2; R08 §13 #9, §14 #12; BUILD-PROMPT §3.4 items 2 and 6, §3.7, §4.1 (Kubernetes packaging, Object storage, Secrets and keys, Central site, Quality and supply-chain tooling), §4.3, §6.1, §6.8 item 7, §13.1 (SD-3, SD-7), §16.1, §19.1, §20, §21 (WP-0.1, WP-0.2, WP-0.9), A.2 (TRU-SEC-01), §4.2

## Context

**The question.** Which licences the product may ship under, how dependencies are chosen and watched, and how both are enforced, for a product that every Kurdistan hospital installs on site.

**The research.**
- On-prem deployments count as distribution under the GPL, so GPL and AGPL components must be unmodified, separately run services, or kept out of the shipped product; permissive and weak-copyleft components (Apache, MIT, BSD, MPL, LGPL, EPL) are safe building blocks if the rules are followed (R02 §1 #13).
- R02's practical rules (R02 §8.2): a core allowlist (Apache-2.0, MIT, BSD, ISC, MPL-2.0, and LGPL and EPL as unmodified libraries or services); GPL and AGPL only as unmodified, separately deployed containers behind documented network APIs, with their source offer shipped with on-prem bundles and counsel review of any on-prem bundle that includes them; a denylist (BSL, competing-use licences, AI-training or ingestion clauses, unlicensed code); and a rug-pull hedge (foundation governance or several active forks, pinned versions, an exit adapter for every vendor-steered dependency).
- R08 lists OSS licence rug-pulls (Redis 2024, Camunda 8.6 in 2024, Mirth 4.6 in 2025) as a risk, mitigated by foundation-governed dependencies, abstraction layers and SBOM licence scanning (R08 §13 #9), and makes licence hygiene a policy: foundation-governed dependencies, SBOM and licence scanning in CI, and no hard dependency on a cloud-only health API (R08 §14 #12).

**BP** (BP §7.2, §7.7): ADR-022 "Licence and dependency governance (§7.7)", reopened on "upstream licence change". BP §7.7's policy follows R02 §8.2: the allowlist; GPL and AGPL only as unmodified separate containers with source offers; a denylist of BSL, competing-use and AI-ingestion clauses; licence scanning in CI; exclusions by name (Camunda 8.6+, Redpanda, Mirth ≥4.6, any cloud-only FHIR service, Medplum components in the product); and a dependency scorecard rating steward, funding, cadence, bus factor and licence history. Its flagged exposures: Snowstorm depends on Elasticsearch; Temporal has a single corporate steward, covered by ADR-010's workflow port and fork-readiness plan; Keycloak, OpenFGA and Strimzi are foundation-hosted but sit on the critical path, so the same upstream-licence-change trigger applies (BP §18, risk 29); the DMN engine is scored like any other dependency; and every release ships an SBOM/VEX and signed artefacts under IEC 81001-5-1 and NIST SSDF, behind a public vulnerability-disclosure policy.

**What K changed** (K §7.2, §7.6). K keeps BP's ADR-022 text and policy ("Licence policy is BP's (R02 §8.2)") and sharpens one consequence: every Kurdistan hospital is an on-site install, and on-site installs count as distribution under the GPL, so the unmodified-container rule is checked on every release; no AGPL observability stack runs on site, and cells export telemetry to the central site (K §7.6). K's risk 29 (an open-source licence or governance change in a critical dependency) is mitigated by the dependency scorecard, ports and unmodified containers on site, with the trigger "upstream licence or steward change" (K §18).

**What BUILD-PROMPT adds** (§4.3). The allowlist names OFL for fonts; four conditional items are allowed unmodified and recorded in a licence register; a scope rule separates what ships to a site from build- and CI-only tools; the denylist adds SSPL and "functional source" licences to BP's, and the exclusions add Liquibase under FSL; a SOUP list for Tier 1 and Tier 2 code; and the rules for signing in development and CI. Neither §4.2 nor §4.3 marks these [P]; §4.1 marks the quality and supply-chain tooling, including ORT and cosign, [P].

## Decision

**Licence and dependency governance** (§4.3).

**The policy** (BUILD-PROMPT §4.3, in full):
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

**Exclusions and placements from §4.1**, carried by the same policy: never HashiCorp Vault (BSL, denylisted; OpenBao instead); no Bitnami images or charts (Bitnami's free versioned images were withdrawn in 2025); not MinIO (AGPL, and its community edition no longer ships maintained builds); Grafana and Loki (AGPL) only centrally, unmodified, never shipped on site (ADR-007); for the integrated imaging tier, dcm4chee (MPL-1.1) or an unmodified Orthanc container (GPLv3/AGPL with a source offer).

**Supply-chain tooling [P]** (§4.1): detekt, ktlint, ESLint, Prettier; Semgrep CE; gitleaks; Trivy and OSV-Scanner; CycloneDX SBOMs; Sigstore cosign signing with SLSA provenance (local keys and no public transparency log in development and CI); the OSS Review Toolkit (ORT) for licence compliance.

**How WP-0.1 encodes the policy** (`tools/licence/README.md`):
- `tools/licence/policy.yaml`: the policy as data, read by the checker below and mirrored for ORT. It holds two scopes, `shipped` and `build-only` (a component of unknown scope is treated as shipped); the allowlist as SPDX identifiers; the conditional list (MPL-1.1, and the components `dcm4che-lgpl-option`, `openjdk-runtime`, `os-packages` and `gpl-separate-container`), with GPL and AGPL denied in any other shipped form; the denylist as SPDX identifiers and licence-name patterns (the Business Source License is `BUSL-1.1`; SPDX `BSL-1.0` is the permissive Boost licence), covering among others SSPL, the Elastic licence, the Functional Source License variants, Commons Clause, PolyForm and non-commercial licences, and AI-ingestion wording; the named exclusions of §4.3 plus those of §4.1 (HashiCorp Vault, MinIO, Bitnami); a list of licences without use restrictions that are acceptable for build-only tools, marked [P] in the file as WP-0.1's reading of the scope rule; and aliases from licence names to SPDX identifiers.
- `tools/licence/register.yaml`: the licence register, one entry per component used under a conditional rule. An entry records facts (component, licence or chosen option, rule, unmodified, source offer, the work package that added it) and is not an approval; it names no approver.
- `tools/licence/ort/license-classifications.yml`: the same categories for ORT. A unit test checks that it mirrors `policy.yaml`.
- `tools/licence/ort/evaluator.rules.kts`: ORT evaluator rules. A denied licence is an error, also for build-only packages; an unclassified licence is an error; a conditional licence or component is a warning that needs a register entry; GPL or AGPL in a shipped package is an error; GPL-2.0 with the Classpath exception outside the OpenJDK runtime is an error; a package excluded by name is an error.
- `tools/licence/ort/curations.yml`: ORT package curations that record facts about packages, never decisions: HAPI HL7 v2 concluded as MPL-1.1, unmodified; dcm4che concluded as its LGPL-2.1 option, unmodified. Neither package is a dependency yet.
- `.ort.yml`: the ORT repository configuration, with path excludes (documentation, programme tools, tests, build logic, spikes) and scope excludes (test, static-analysis, coverage, SBOM and code-generation configurations; pnpm devDependencies). Excluded paths and scopes are not shipped, but ORT still analyses them and the evaluator still checks them for denied licences.
- `sh tools/hms licence check`: applies `policy.yaml` to a CycloneDX JSON SBOM (`--sbom`) or to the output of `pnpm licenses list --json` (`--pnpm`). It fails on a denied, excluded or unmapped licence and warns on a conditional one until `register.yaml` has a matching entry; several declared licences on one component are combined with AND, as ORT does, and an OR expression takes its best option.
- **The rule for changing any of it:** a licence or dependency outside the allowlist is stop-and-ask item 2 (BUILD-PROMPT §3.4). It is recorded in `docs/program/DECISIONS-NEEDED.md`; `policy.yaml` and the classifications are never edited to make a check pass.

## Consequences (including safety and licence impact)

**Licence.**
- On-site installs are distribution under the GPL (K §7.6; R02 §1 #13), so GPL and AGPL code ships only as unmodified, separate containers with a source offer, checked on every release; no AGPL observability stack runs on site.
- The scorecard and ports keep an upstream licence or steward change from stranding the product: Temporal sits behind `WorkflowPort` with a fork-readiness note (ADR-010); Keycloak, OpenFGA and Strimzi are watched under the same trigger (BP §7.7).
- Snowstorm depends on Elasticsearch (BP §7.7). K runs Snowstorm only centrally and only if a SNOMED CT licence is taken, so Elasticsearch never runs on site (K §7.2; ADR-015). OpenSearch also runs only centrally (ADR-028).
- R02 §8.2 also advises counsel review of any on-prem bundle that includes GPL or AGPL containers. BP and BUILD-PROMPT do not carry that step; any counsel opinion is a [HUMAN] matter.

**Safety.**
- The SOUP list ties every third-party component in Tier 1 and Tier 2 code to its known anomalies and to the verification that covers it, which the Tier 2 safety files need (IEC 62304 practice; BUILD-PROMPT §20; ADR-016).
- Signed releases let a cell verify what it installs (BUILD-PROMPT §16.1; ADR-021), and the SBOM and VEX shipped with every release record what it contains and how known vulnerabilities affect it (SD-3, BUILD-PROMPT §13.1).

**Outward-facing steps.** BP §7.7 puts releases behind a public vulnerability-disclosure policy (also SD-7, BUILD-PROMPT §13.1). Publishing that policy, or anything to a public transparency log, is outward-facing and needs the human (BUILD-PROMPT §3.4 item 6, §3.7).

**Gaps on 2026-10-18.** BUILD-PROMPT names no file or work package for the dependency scorecard, and none exists yet. Its first named uses are the object-store choice in WP-0.2 (§4.1, §21) and the DMN engine (ADR-017); the version catalogue already marks the pre-1.0 OpenFGA SDK for it (`backend/gradle/libs.versions.toml`). The SOUP list (`docs/safety/soup.yaml`, BUILD-PROMPT §6.1) is a WP-0.9 deliverable.

## Fitness test that guards it

**Guard (BUILD-PROMPT §4.2):** ORT licence scan in CI.

**Where and when.**
- **ORT** runs in the merge tier ("licence, vulnerability and container scans; SBOM", BUILD-PROMPT §19.1; §6.8 item 7). WP-0.1 plans to run it from its official container image, so it needs the container engine and dev stack of WP-0.2; the local CI runner names WP-0.9, which builds the release pipeline (SBOM, VEX, signing, provenance; `TRU-SEC-01`), for this step. When ORT first runs, its image version is pinned and the evaluator rules are fixed against that version's DSL (`tools/licence/README.md`).
- **The separate-container rule** for GPL and AGPL is checked on every release (§4.3), in the release pipeline of WP-0.9.
- **The policy checker** `sh tools/hms licence check` is not ORT and not the named guard. The local CI runner names WP-0.9 for the merge-tier step that generates the CycloneDX SBOM and runs this check on it. Its unit tests (`tools/hmstools/licence/tests/test_licence.py`) run in the fast tier's Python unit tests.
- **Signing in development and CI:** the local registry with offline signing in WP-0.2; cosign signatures, SBOM, VEX and SLSA provenance in the release pipeline of WP-0.9.
- **The SOUP list:** WP-0.9.

**State on 2026-10-18:** ORT has never run. Its configuration is unvalidated: the evaluator rules follow the ORT rules DSL but have not been compiled against any ORT version (`tools/licence/README.md`). No dependency has been licence-checked by ORT (KA-005), and the licence register has no entries. This ADR claims no result.

## Reopen if

Upstream licence change.

Any change to this ADR is stop-and-ask item 2 (BUILD-PROMPT §3.4).

(K's risk register words the watch as "upstream licence or steward change" (K §18, risk 29). A steward change in Temporal is also ADR-010's trigger.)
