# Backend

The HMS Kurdistan backend: Kotlin on JDK 25 with Spring Boot and Spring Modulith (ADR-002, ADR-003), built with Gradle (Kotlin DSL). This directory is the Gradle root (BUILD-PROMPT §6.1). WP-0.1 built the skeleton: the build, the version catalogue, the convention plugins, the test tiers, the quality gates and the architecture rules. No application code exists yet.

## Layout

| Path | What lands there | Built by |
|---|---|---|
| `build-logic/` | Convention plugins: `hms.kotlin-conventions`, `hms.quality-conventions`, `hms.test-conventions` (later also jOOQ and Flyway) | WP-0.1 |
| `gradle/libs.versions.toml` | The version catalogue: every pinned backend component, with its licence (§4.1, ADR-002) | WP-0.1 |
| `config/detekt/detekt.yml` | detekt rules on top of the default configuration | WP-0.1 |
| `platform/` | Shared kernel libraries (`hms.kernel.<lib>`) | WP-0.1 (`arch-rules`, `testing`), WP-0.3 onwards |
| `modules/` | One directory per application module (§5.2) | WP-0.3 onwards |
| `app-hms/` | The modular-monolith Spring Boot application | WP-0.3 |
| `regulated/` | Tier 2 sidecars, each its own deployable and release train | Phase 1 onwards |
| `hub/` | The Integration Hub satellite | Phase 1 (§12) |
| `satellites/` | RCM (with finance-export), the document renderer, analytics, the AI gateway (P2) | WP-0.8, Phase 1 onwards |

**Packages [P].** The base package is `hms`. A module uses `hms.<module>` with hyphens turned into dots (`trust-identity` → `hms.trust.identity`, `reg-dose` → `hms.reg.dose`), with the layer sub-packages `api`, `domain`, `application`, `infrastructure`, `web` and `events` (§6.1). Other modules may import only `api`. Shared kernel libraries use `hms.kernel.<lib>`.

## Commands

From the repository root, after `sh tools/bootstrap` (Git Bash on Windows or a Linux shell):

```sh
eval "$(sh tools/bootstrap env)"           # JAVA_HOME, GRADLE_USER_HOME and PATH for the project-local toolchain
sh backend/gradlew -p backend fastTier     # the backend part of the fast tier
sh backend/gradlew -p backend fastTier -Phms.pbt.sequences=1000000   # the same with 10^6 sequences per property
```

The wrapper is run through `sh`, as `tools/ci/run` does, so the commands work whatever file mode the checkout gives `gradlew` (review finding R-02).

`fastTier` compiles every source set, runs detekt and ktlint, the unit tests, the property-based tests and the architecture tests, and checks that every project with production code ran its `ArchitectureTest`. It fails on the first error. JUnit XML lands in each project's `build/test-results/<task>/`. `tools/ci/run fast` runs it as one step and sums the counts. `docs/program/COMMANDS.md` lists every command.

## Test tiers

Each tier has its own source set [P] (OQ-096), so a task runs exactly the tests of its tier and its JUnit XML counts only tests that ran (§19.1):

| Source set | Task | Runs | Tier |
|---|---|---|---|
| `src/test` | `test` | Unit tests, including the project's `ArchitectureTest` | fast |
| `src/propertyTest` | `propertyTest` | Property-based tests (Kotest property). Each property takes its sequence count from `hms.kernel.testing.PropertyTestBudget.sequences()`: 1,000 by default, set with `-Phms.pbt.sequences=N` | fast (1,000); nightly (10⁶) |
| `src/integrationTest` | `integrationTest` | Integration tests with real infrastructure (Testcontainers) | merge (compiled in the fast tier) |

The property and integration source sets see the main code, including `internal` declarations, and inherit the unit-test dependencies. Never hard-code an iteration count in a property test.

## Quality gates

- **detekt 1.23.8** on the default rules plus `config/detekt/detekt.yml`, every finding fails the build. It runs as detekt-cli in a forked JVM (`build-logic/src/main/java/hms/buildlogic/DetektLauncher.java`) because its embedded Kotlin 2.0.21 compiler cannot run inside a JVM whose version has four parts (25.0.4.1). Kotlin artefacts are pinned to 2.0.21 inside the detekt tool configuration only.
- **ktlint 1.8.0** (Gradle plugin 14.2.0) with the `ktlint_official` style from `backend/.editorconfig`.
- **Kotlin warnings are errors**, and Java compiles with `-Xlint:all -Werror`.
- `verifyProjectConventions` fails if a project with sources does not apply all three convention plugins, so no project can drop out of the fast tier.

At `05f159a` each gate failed on a planted violation (ktlint, detekt, a false property, domain code reading the system clock, a module boundary crossed outside the api package: 5 of 5 plants FAIL) and passed again once it was removed; the fast tier on the clean tree passed. That is the record of record, `docs/program/evidence/ci/2026-10-19-gates-bite-05f159a.md` (WSL build host, no cell; made by `tools/ci/gates-bite/` in a scratch clone, `tools/ci/gates-bite/README.md`). The earlier run of 2026-10-18, `docs/program/evidence/ci/2026-10-18-gates-bite.md` (the first four plants, by hand on the Windows checkout before the first commit), is not evidence of record (review finding R-06).

## Fitness functions (§6.8)

`platform/arch-rules` (`hms.kernel.archrules.HmsArchitectureRules`) holds the rules that can be expressed now. Every rule has a test that fails on a violating fixture and passes on a compliant one, and every project with production code applies all of them in its `ArchitectureTest`:

| Rule | Source |
|---|---|
| Classes in `..domain..` packages depend on no framework types (Spring, Jakarta, javax, jOOQ, Jackson 2 and 3, Temporal, Kafka) | §6.1, §6.8 #3 |
| A module uses another module only through its `api` package; the shared kernel `hms.kernel..` is always allowed | §5.2, §6.1 |
| No `io.temporal..` types outside `..platform.workflow.infrastructure..` | ADR-010 |
| Domain code never reads the system clock (`Instant.now()`, `LocalDate.now()`, `System.currentTimeMillis()`, `Clock.systemUTC()`, Kotlin's `Clock.System` and similar); it takes an injected `Clock` | §6.2 |

The other §6.8 fitness functions need code that does not exist yet. Each is added by the work package that creates what it guards; the placements marked [P] are this programme's, not the prompt's:

| §6.8 | Fitness function | Added in |
|---|---|---|
| 1 | No dose arithmetic outside `reg-dose` (custom detekt rule plus ArchUnit on `Dose`/`Quantity` operations, one audited comparison API) | WP-0.3, when `Quantity` exists [P]; required before the medications module (§9.10 acceptance item 6) |
| 2 | No `UPDATE`/`DELETE` on fact tables (database permissions and a migration linter) | WP-0.3, with the bitemporal journal [P] |
| 3 | Spring Modulith verification of the module structure | WP-0.3, when `app-hms` exists [P] |
| 4 | No repository access without the Trust Plane SDK | WP-0.4 (its exit evidence) |
| 5 | No PHI in logs, traces or metrics (canary scan) | WP-0.4 (its exit evidence) |
| 6 | No hard-coded user-facing strings, no physical CSS directions | WP-0.1, frontend lint; the banner check on clinical routes in WP-0.7 |
| 7 | Licence scan, SBOM, secret scan, dependency and container scans | Secret scan: WP-0.1 (fast tier). ORT is configured in WP-0.1; the ORT run, the vulnerability and container scans and the SBOM join the merge tier in WP-0.9 (`sh tools/ci/run merge --list`) |
| 8 | Branch-per-tenant and tenant-identifier detectors | WP-0.1 (`sh tools/hms repo check`) |
| 9 | Migration upgrade-and-rollback test (N-1) | WP-0.3, with the first migrations [P]; the merge tier runs it (`migration-n-1`) |
| 10 | Read-model rebuild from the journal | WP-0.3 (its exit evidence: the journal-rebuild test) |
| 11 | Egress test of the cell's network policy | WP-0.2, with the dev cell [P] |
| 12 | Performance budgets and the 300-bed-day regression gate | WP-0.6 (workload generators); the 300-bed day needs the reference cell [HUMAN] |
| 13 | Tier 2 boundary-value coverage and mutation score | With the first Tier 2 sidecar, WP-1.5 (PIT in the merge tier) [P] |
