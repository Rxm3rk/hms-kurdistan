"""Aligns ADR-002's pinned set with backend/gradle/libs.versions.toml and records the frontend pins."""
import sys
from pathlib import Path

p = Path(sys.argv[1]) / "docs/adr/ADR-002-runtime-kotlin-jvm-spring.md"
s = p.read_text(encoding="utf-8")
start = s.index("**Backend** (resolved for Phase 0 under the version rule above):")
end = s.index("## Consequences (including safety and licence impact)")
new = """**Backend** (resolved for Phase 0 under the version rule above; `backend/gradle/libs.versions.toml`, which also records each licence):
- JDK: OpenJDK 25.0.4 (Eclipse Temurin 25.0.4.1+1) through `jvmToolchain(25)`. Each checkout gets it project-local under `.tools/` (git-ignored) from `tools/bootstrap`, which verifies the download's SHA-256 (KA-002).
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

**Not yet pinned.** The servers, operators, images and charts that later work packages bring in are pinned by the work package that first uses them, under the same rule, and recorded here: PostgreSQL (18; 17 minimum) on CloudNativePG, Kafka brokers on Strimzi, the Temporal server, Keycloak, OpenFGA, Valkey, the object store, Argo CD, the OpenTelemetry collector and their Helm charts in WP-0.2; OpenBao, SoftHSM2 and swtpm when keys arrive (WP-0.4). No version is recorded for them here until it is resolved.

"""
s = s[:start] + new + s[end:]
assert "Frontend pins: recorded by the WP-0.1 integration step." not in s
p.write_text(s, encoding="utf-8", newline="\n")
print("ok")
