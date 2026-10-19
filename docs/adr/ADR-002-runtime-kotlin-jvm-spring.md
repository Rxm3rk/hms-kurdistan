# ADR-002: Runtime: Kotlin on the JVM, Spring Boot plus Spring Modulith
Status: accepted
Date: 2026-10-18   Source: K §7.2, §7.6, §15.4 (S18-K), K-13; BP §7.2, §7.7; R08 §1 #12, §4.1, §12.5, §13 #17; BUILD-PROMPT §4.1, §4.3, §6.1, §6.2, §4.2

## Context

**The question.** Which language, runtime and framework the backend is written in.

**The research** (R08 §12.5, §1 #12): Kotlin on JVM 21/25 LTS with Spring Boot and Spring Modulith, because the deepest HL7 tooling (HAPI FHIR and v2, the CQL engine, Snowstorm, EHRbase) is JVM-native, and a hospital core is long-lived, CPU-heavy domain logic where static typing and the JVM's runtime maturity pay off. Spring Modulith verifies module structure, tests modules in isolation and observes them at module level (R08 §4.1). C#/.NET is a near-tie; R08 says to decide by team composition. Kotlin skills are scarcer than Java, and Java interop mitigates that (R08 §12.5; risk R08 §13 #17).

**BP** (BP §7.2): Kotlin on JVM 21/25, Spring Boot + Modulith; C#/.NET a near-tie, decided by founding-team composition; reopen if the founding team is predominantly .NET.

**What K changed** (K §7.2; K-13). The default is the same, but the decision is taken at M2–M3 on the actual founding team and the S18-K talent survey, because Kotlin skills are scarcer than Java (R08 §12.5) and senior JVM engineers are scarce in Kurdistan [L]. K words the reopen trigger as "the founding team or S18-K shows .NET is the only stack we can staff at 50+ engineers" (K §7.2), and K-13 adds "S18-K (M2) or the M6 hiring checkpoint shows JVM squads cannot be staffed (then C#)". S18-K is a K spike (M0–M2) and is outside this build's reach; its result is a human input.

**[P] marks.** The runtime decision is K's, not [P]. The build tooling is [P] (BUILD-PROMPT §4.1: Gradle with the Kotlin DSL, a version catalogue and convention plugins), as are the base package and the quality and test tooling choices.

## Decision

**Runtime:** Kotlin on the JVM, Spring Boot plus Spring Modulith.

**Stack detail that belongs to this decision** (BUILD-PROMPT §4.1):
- **Language and runtime:** Kotlin 2.x on OpenJDK 25 LTS (21 minimum). C#/.NET is the recorded near-tie; switching needs an ADR backed by the S18-K talent survey.
- **Framework:** Spring Boot (current GA line) with Spring Modulith for module boundaries, events and verification (K §7.6).
- **Build [P]:** Gradle with the Kotlin DSL, a version catalogue and convention plugins in `backend/build-logic/`. The Gradle root is `backend/` with the wrapper `backend/gradlew`; `sh backend/gradlew -p backend fastTier` runs compilation, detekt, ktlintCheck, unit tests, short property-based tests (system property `hms.pbt.sequences`, default 1000) and architecture tests for every project.
- **Packages [P]:** base package `hms`. Application modules use `hms.<module>` with hyphens turned into dots (for example `trust-identity` → `hms.trust.identity`, `reg-dose` → `hms.reg.dose`). Layers are the sub-packages `api`, `domain`, `application`, `infrastructure`, `web` and `events` (BUILD-PROMPT §6.1). Shared kernel libraries under `backend/platform/` use `hms.kernel.<lib>`.
- **Conventions** (BUILD-PROMPT §6.2): commands carry tenant, facility, actor, on-behalf-of, device, purpose-of-use, clinical time, idempotency key and correlation id; business outcomes are sealed result types, with RFC 9457 problem details at the HTTP boundary; `Money` is `BigDecimal` plus an ISO 4217 currency, never floating point; `Clock` is injected and the domain never calls `now()`; every quantity carries a UCUM unit in a platform `Quantity` type; PHI-safe logging with a field allowlist; no tenant-specific code.
- **Quality and test tooling [P]:** detekt and ktlint; JUnit (current major), Kotest including property-based testing, Testcontainers, ArchUnit plus Spring Modulith verification (BUILD-PROMPT §4.1).
- **Version rule** (BUILD-PROMPT §4.1): pin each component to the newest generally available release that has had at least one patch release, is supported by the components that depend on it, and meets the minimum. Pin it in the Gradle version catalogue, the pnpm lockfile and the Helm charts, and record the pinned set here and in the SBOM. Re-resolve versions only at phase boundaries, through the dependency scorecard (§4.3).

## Pinned set

**Where the pins live.** The authoritative pins are in `backend/gradle/libs.versions.toml`, `frontend/pnpm-lock.yaml`, `tools/hmstools/bootstrap/steps.py` for the JDK (the catalogue holds the JDK major only), `deploy/site-cell/cell.yaml` for the cell's images and charts and, later, the Helm charts under `deploy/helm/`. This section is a record of them. If it ever differs from those files, the files win and this section is corrected. Pins are re-resolved only at phase boundaries, through the dependency scorecard (BUILD-PROMPT §4.3).

**Backend** (resolved for Phase 0 under the version rule above; `backend/gradle/libs.versions.toml`, which also records each licence):
- JDK: Eclipse Temurin 25.0.4.1+1 (OpenJDK 25.0.4.1; Adoptium release `jdk-25.0.4.1+1`). The release and the SHA-256 of each platform's archive (Linux x64 and aarch64, Windows x64, macOS x64 and aarch64) are pinned in `tools/hmstools/bootstrap/steps.py` (`JDK_RELEASE`, `JDK_ARCHIVES`); `backend/gradle/libs.versions.toml` holds the major only (`java = "25"`), used through `jvmToolchain(25)`. `sh tools/bootstrap jdk` installs exactly that release, project-local under `.tools/jdk-25.0.4.1+1` (git-ignored), after checking the archive against the recorded SHA-256. It fetches no other release or vendor: a JDK in `.tools/` that does not report `Temurin-25.0.4.1+1` (build `25.0.4.1+1-LTS`) is not used, and a failed download fails the step. `tools/doctor` passes its JDK item only for that release (KA-002). Like every pin here, the release and its checksums are re-resolved only at a phase boundary (BUILD-PROMPT §4.1), in one commit that changes `steps.py` and this line.
- Gradle 9.8.1 through the wrapper (distribution SHA-256 `dce76f55f8e251a3a1f130eb120f30b3d271de2b76c9b0729d316b5a1b6dc01f`, the official checksum).
- Spring Boot 4.1.1. Its BOM manages, and the catalogue repeats:
  - Spring Framework 7.0.9;
  - Kotlin 2.3.21 and kotlinx-coroutines 1.10.2;
  - Jackson 3.1.5 (`tools.jackson`), with the Jackson annotations 2.21;
  - jOOQ 3.21.7 and Flyway 12.4.0;
  - PostgreSQL JDBC 42.7.13;
  - Apache Kafka clients 4.2.1 (newer 4.x lines exist; the BOM's version wins);
  - JUnit Jupiter 6.0.3 and Testcontainers 2.0.5;
  - Jakarta Dependency Injection API 2.0.1.
- Spring Modulith 2.1.1.
- Client libraries pinned now, used from the work package that needs them: Debezium 3.6.3.Final; CloudEvents Java SDK 4.1.1; Apicurio Registry serdes 3.3.3; Temporal Java SDK 1.36.1 (only behind `WorkflowPort`, ADR-010); OpenFGA Java SDK 0.10.1 (pre-1.0, recorded for the dependency scorecard); Keycloak admin client 26.0.12; HAPI FHIR 8.12.1; HAPI HL7 v2 2.5.1 (used unmodified under its MPL-1.1 option, §4.3).
- Kotest 6.2.6 and ArchUnit 1.5.1.
- detekt 1.23.8. The detekt 2.x line is still alpha, so it fails the version rule. detekt 1.23.8 embeds the Kotlin 2.0.21 compiler, so `org.jetbrains.kotlin` artefacts are pinned to 2.0.21 inside the detekt configuration only; the product itself compiles with Kotlin 2.3.21.
- ktlint Gradle plugin 14.2.0 with ktlint 1.8.0.
- Kover 0.9.11 and the CycloneDX Gradle plugin 3.5.1, pinned but not applied yet (coverage gates and SBOMs belong to the merge and release tiers, §19.1).

**Frontend** (`frontend/pnpm-workspace.yaml` catalogue and `frontend/pnpm-lock.yaml`, lockfile format 9.0; every direct dependency is pinned exactly):
- Node.js 24 LTS (`engines`: `>=24 <25`); pnpm 12.12.1 through Corepack (`packageManager`, with its sha512 integrity; the lockfile pins pnpm itself too).
- Runtime dependencies of the workspace packages: `@formatjs/icu-messageformat-parser` 3.5.21 (`@hms/i18n`); `@typescript-eslint/utils` 8.71.2 and `postcss` 8.5.30 (`@hms/eslint-plugin`, a build tool).
- Development tools: TypeScript 6.0.3; ESLint 10.9.1 with `@eslint/js` 10.0.1; typescript-eslint 8.71.2 (and `@typescript-eslint/parser` 8.71.2); Prettier 3.9.10; Vite 8.3.4; Vitest 5.0.5; `@types/node` 24.13.6.
- No application framework is installed yet: React, React Aria Components, TanStack Router and Query, FormatJS's runtime and Zod are pinned by WP-0.7, which builds the first app.

**Programme tools** (build and CI only, never shipped to a site): Python 3.12 in the project venv under `.tools/` with PyYAML 6.0.3 and jsonschema 4.26.0, plus jsonschema's dependencies attrs 26.1.0, jsonschema-specifications 2025.9.1, referencing 0.37.0, rpds-py 2026.9.1 and typing_extensions 4.16.0, installed with `pip --require-hashes` from `tools/requirements.txt`, the tools' authoritative pin. gitleaks 8.30.1, checked against its release checksums.

**Dev and lite cell** (resolved for Phase 0 on 19 October 2026 in WP-0.2, slice S1; `deploy/site-cell/cell.yaml` is the authoritative pin: every image by the digest of its linux/amd64 manifest and its release date, every chart by version and the SHA-256 of its `.tgz`, which equals the digest in the publisher's Helm repository index, every release manifest by commit or release and its SHA-256; how the rule was read: OQ-107, OQ-125, OQ-136; no chart that packages a Bitnami chart, OQ-137):
- Kubernetes: k3s v1.35.9+k3s1, the newest line that Kyverno 1.19, Strimzi 1.0.1 and CloudNativePG 1.30 all support; with its system images pause 3.10.2, CoreDNS 1.14.7, local-path-provisioner 0.0.37 and BusyBox 1.37.0. k3d 5.8.3 creates the cell (its proxy and tools images 5.8.3).
- PostgreSQL 18.6 (CloudNativePG's `minimal-trixie` image) on CloudNativePG 1.30.1 (chart 0.29.1).
- Kafka 4.2.0 in KRaft mode on Strimzi 1.0.1 (chart 1.0.1).
- Temporal server and admin-tools 1.32.1 (chart 1.7.0; the UI 2.54.1 in the dev profile only).
- Keycloak and the Keycloak Operator 26.8.1 (the operator's manifests at the commit of tag 26.8.1, each with its SHA-256).
- OpenFGA v1.18.3 (the official image; S6 runs it from our own template, because chart 0.3.12 packages Bitnami charts, OQ-137).
- Valkey 9.1.2 (the official image, in our own template).
- SeaweedFS 4.48 (ADR-029).
- OpenTelemetry Collector 0.163.1, `k8s` distribution (chart 0.176.0, which ships 0.162.0, with its image tag set).
- Kyverno 1.19.1 (its release manifest `install.yaml`, not chart 3.9.1, which packages a Bitnami chart; ADR-030, OQ-137).
- Argo CD 3.5.5 (chart 10.10.5), dev profile only; its Redis image is not pinned yet (OQ-138).
- CNCF Distribution 3.1.2 as the local registry.
- Build-only tools, run from their images by digest: cosign v3.1.3 (signing with a signing configuration without Rekor, OQ-135), crane v0.22.1 (go-containerregistry) and the Kyverno CLI v1.19.1 (offline policy checks).

**Not yet pinned.** OpenBao, SoftHSM2 and swtpm when keys arrive (WP-0.4); Testcontainers' Ryuk image when WP-0.2 wires Testcontainers (slice S9). No version is recorded for them here until it is resolved.

## Consequences (including safety and licence impact)

**Safety.**
- Reusing the JVM health-standards libraries (HAPI FHIR and HL7 v2) means interface parsing and validation are not hand-built, which reduces H15 (seam failure) and H6 (corruption) risk at the interfaces.
- Spring Modulith verification and ArchUnit enforce the module boundaries that the Safety Kernel depends on (ADR-003).
- Sealed result types and an injected `Clock` support "nothing fails silently" (constitution rule 6) and the clinical-time rules (SI-10).

**Staffing.** Kotlin and senior JVM engineers are scarce in Kurdistan [L] (K §7.2). This ADR stays reopenable on S18-K. Java interop and mainstream JVM skills are the mitigation (R08 §12.5, §13 #17).

**Tooling.**
- detekt 1.23.8 analyses Kotlin 2.3.21 sources with its embedded Kotlin 2.0.21 front end. Any language construct it cannot analyse is recorded as a known anomaly. The planned custom dose-arithmetic rule (BUILD-PROMPT §6.8 item 1) is paired with an ArchUnit rule, so it does not rest on detekt alone (ADR-016).
- detekt 2.x is re-evaluated at the next phase boundary, once it has a GA release with at least one patch release.
- The Linux build host BUILD-PROMPT expects now exists: WSL2 with Ubuntu 24.04.5 on the Windows 11 machine, provisioned by `tools/host/provision-ubuntu.sh` (DN-001 to DN-004, closed). The gates of record run in a clone in the WSL file system; the Windows checkout, where the agent session runs, keeps a project-local toolchain in `.tools/` for editing and the fast tier, and its runs are labelled "Windows host" (KA-001, KA-002). The pins do not depend on the host.

**Licence.** Kotlin (Apache-2.0), Spring Boot and Spring Modulith (Apache-2.0) are on the allowlist (BUILD-PROMPT §4.1, §4.3). The OpenJDK runtime (GPL-2.0 with the Classpath exception) is allowed only unmodified and recorded in the licence register (§4.3): it is to be recorded in `tools/licence/register.yaml` when a shipped image first carries it, and until then `tools/hms licence check` fails on it (ADR-022). The JDK in `.tools/` is a build tool and ships nowhere. The licence of every other pinned artefact is established by the ORT scan (ADR-022), not asserted here.

## Fitness test that guards it

**Guard (BUILD-PROMPT §4.2):** Build.

**Where and when.** The Gradle build under `backend/` (wrapper `backend/gradlew`, catalogue `backend/gradle/libs.versions.toml`, convention plugins in `backend/build-logic/`) is created in WP-0.1. `sh backend/gradlew -p backend fastTier` is part of the fast tier, run through `tools/ci/run fast`, which writes its evidence to `docs/program/evidence/ci/` (BUILD-PROMPT §19.1).

**State on 2026-10-18:** being built in WP-0.1 by the backend part of the work package. This ADR claims no build result; the result is the CI evidence record.

## Reopen if

S18-K shows only .NET can be staffed.

(K's wording of the same trigger, for reference: "The founding team or S18-K shows .NET is the only stack we can staff at 50+ engineers" (K §7.2); K-13 adds the M6 hiring checkpoint.)

Any change to this ADR is stop-and-ask item 2 (BUILD-PROMPT §3.4).
