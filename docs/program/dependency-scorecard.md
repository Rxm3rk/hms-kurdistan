# Dependency scorecard

BUILD-PROMPT §4.3 requires a scorecard for every runtime dependency: steward, funding, release cadence, bus factor and licence history. Critical-path dependencies with a single corporate steward are wrapped behind ports with a fork-readiness note (ADR-010, ADR-022). §4.1 uses the scorecard to choose the object store and to re-resolve pins at phase boundaries. This file was created in WP-0.2 (OQ-104); entries are added by the work package that adds a runtime dependency to a running system.

## Method

- **Facts, not impressions.** Each figure comes from the project's public repository metadata (GitHub REST API) on the date given: the licence the repository declares, the owner type, the creation date, the number of releases published in the 365 days before the date, the latest release, and commit concentration among the top 100 contributors (the share of the top author and the number of authors who together hold half the commits, a bus-factor proxy).
- **Funding is unverified.** No source in the research pack covers it, and this file records nothing it cannot cite. A human may add it with a source.
- **Licence history** records the licence the project has declared since the date shown. A change of licence or steward is the ADR-022 reopen trigger.
- **A score is not a test.** Fitness for a role is decided by that role's test (for the object store, the WORM test of ADR-029); the scorecard records the risk the project carries.

## Object storage (ADR-029; WP-0.2, facts of 2026-10-18)

| Project | Version (§4.1 rule) | Licence and history | Steward (owner type) | Releases in the last year (latest) | Commit concentration | Role test | Verdict |
|---|---|---|---|---|---|---|---|
| SeaweedFS | 4.48 | Apache-2.0, repository created 2014-07-14 | organisation `seaweedfs` | 47 (2026-09-28) | top author 74.5%; 1 author holds half (bus factor 1) | WORM PASS (W01–W10) | **Chosen** (ADR-029). Risk: single principal maintainer; mitigated by the S3-only port and the RustFS alternative |
| RustFS | 1.0.3 | Apache-2.0, repository created 2023-11-23 | organisation `rustfs` | 62 (2026-10-17) | top author 36.8%; 2 authors hold half | WORM PASS (W01–W10) | Qualified alternative. Risk: short licence history (under three years) |
| versitygw | v1.4.1 | Apache-2.0, repository created 2023-05-05 | organisation `versity` | 13 (2026-10-13) | top author 60.1%; 1 author holds half | **WORM FAIL** (W06: a COMPLIANCE retention could be shortened) | Rejected |

Not evaluated: Ceph RGW (LGPL; too heavy for a lite cell), Zenko CloudServer (Apache-2.0; not tested in WP-0.2). MinIO is excluded by §4.1.

## Other runtime dependencies

The dev cell's other components (CloudNativePG, Strimzi, Temporal, Keycloak, OpenFGA, Valkey, the OpenTelemetry collector, the Distribution registry, k3s and cosign) are scored here as WP-0.2 adds each one to the cell.
