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

## The cell's other components (WP-0.2 slice S1, facts of 2026-10-19)

Same method as above (GitHub REST API on 19 October 2026, read on the Windows host). "Releases in the last year" counts the GitHub releases not marked as pre-releases; where the project published 100 or more releases of any kind, only the latest 100 were read, so the figure is a lower bound (marked "at least"). Kafka and PostgreSQL publish their releases outside GitHub, so no release figure is given for them. The pin column gives the date the pinned version was released (`released` in `cell.yaml`, from the publisher's release page); the releases column gives the project's latest GA release, which may be another line. Pins and their reading: `deploy/site-cell/cell.yaml`, ADR-002, OQ-125, OQ-136.

| Project | Pin (role) | Licence and history | Steward (owner type) | Releases in the last year (latest GA) | Commit concentration | Ships to a site | Verdict and risk |
|---|---|---|---|---|---|---|---|
| k3s | v1.35.9+k3s1, released 2026-09-30 (Kubernetes on each cell node) | Apache-2.0, repository created 2018-05-31 | organisation `k3s-io` | at least 32 (2026-09-30) | top author 27.9%; 3 authors hold half | yes | Pinned. Its system images (pause, CoreDNS, local-path-provisioner) are Apache-2.0; its BusyBox helper is GPL-2.0 (DN-017) |
| CloudNativePG | 1.30.1, released 2026-09-23; chart 0.29.1 (PostgreSQL operator) | Apache-2.0, repository created 2022-03-10 | organisation `cloudnative-pg` | 22 (2026-09-23) | top author 19.2%; 5 authors hold half | yes | Pinned |
| PostgreSQL | 18.6, released 2026-08-13 (CloudNativePG `minimal-trixie` image, built 2026-10-12) | PostgreSQL Licence | PostgreSQL Global Development Group (community) | not counted (released outside GitHub) | not counted (GitHub holds a mirror) | yes | Pinned (§4.1). Licence not yet classified in the policy (DN-017) |
| Strimzi | 1.0.1, released 2026-06-17 (Kafka operator) | Apache-2.0, repository created 2016-05-06 | organisation `strimzi` | at least 11 (2026-10-12) | top author 33.8%; 3 authors hold half | yes | Pinned. Images on Red Hat UBI (OQ-133) |
| Apache Kafka | 4.2.0 (Strimzi's `kafka` image) | Apache-2.0, repository created 2011-08-15 | organisation `apache` | not counted (released outside GitHub) | top author 5.9%; 18 authors hold half | yes | Pinned |
| Temporal server | 1.32.1, released 2026-10-08; chart 1.7.0 (workflow) | MIT, repository created 2019-10-16 | organisation `temporalio` (a single corporate steward, §4.3) | at least 30 (2026-10-12) | top author 9.9%; 9 authors hold half | yes | Pinned. Single corporate steward: used only behind `WorkflowPort`, with ADR-010's fork-readiness note |
| Keycloak and its Operator | 26.8.1, released 2026-10-13 (identity) | Apache-2.0, repository created 2013-07-02 | organisation `keycloak` | at least 26 (2026-10-13) | top author 16.9%; 5 authors hold half | yes | Pinned. Images on Red Hat UBI (OQ-133) |
| OpenFGA | v1.18.3, released 2026-08-05; no chart (authorisation) | Apache-2.0, repository created 2022-06-08 | organisation `openfga` | at least 30 (2026-10-06) | top author 24.3%; 4 authors hold half | yes | Image pinned. Its chart 0.3.12 packages Bitnami charts and is not pinned; S6 runs OpenFGA from our own template (OQ-137) |
| Valkey | 9.1.2, released 2026-09-01 (cache only) | BSD-3-Clause, repository created 2024-03-22 | organisation `valkey-io` | 24 (2026-09-01) | top author 56.1%; 1 author holds half (bus factor 1 on this measure) | yes | Pinned. Risk: short licence history (under three years) and commit concentration; a cache only, never a system of record (§4.1) |
| OpenTelemetry Collector | 0.163.1, released 2026-10-16; chart 0.176.0 with its image tag set (`k8s` distribution) | Apache-2.0, repository `opentelemetry-collector-releases` created 2021-08-26 | organisation `open-telemetry` | 87, counting each distribution's tag (2026-10-16) | top author 29.1%; 4 authors hold half | yes | Pinned. Pre-1.0 numbering; patch releases are rare: 0.163.1 is the 0.163 line's patch release, and it only repaired the release workflow (OQ-136) |
| Kyverno | 1.19.1, released 2026-09-10; release manifest `install.yaml` (signature enforcement, ADR-030) | Apache-2.0, repository created 2019-02-04 | organisation `kyverno` | at least 16 (2026-09-10; GitHub also lists v1.19.2-rc.2 of 2026-10-17 without the pre-release mark) | top author 22.6%; 3 authors hold half | yes | Pinned. Supports Kubernetes 1.33-1.35 only, which sets the k3s pin (OQ-136); its chart 3.9.1 packages a Bitnami chart, so the release manifest is pinned instead (OQ-137) |
| Argo CD | 3.5.5, released 2026-10-12; chart 10.10.5 (delivery, dev profile) | Apache-2.0, repository created 2018-02-09 | organisation `argoproj` | at least 58 (2026-10-12) | top author 25.2%; 6 authors hold half | yes (dev and on site) | Pinned; Redis image open (OQ-138) |
| CNCF Distribution | 3.1.2, released 2026-09-24 (the local registry) | Apache-2.0, repository created 2014-12-22 | organisation `distribution` | 3 (2026-09-24) | top author 21.2%; 4 authors hold half | dev and CI now | Pinned. Low release cadence |
| cosign | v3.1.3, released 2026-08-06 (signing; build only) | Apache-2.0, repository created 2021-02-04 | organisation `sigstore` | 11 (2026-08-06) | top author 47.4%; 2 authors hold half | no | Pinned (OQ-135). Used with local keys only; no public transparency log (§4.3) |

crane (go-containerregistry v0.22.1, released 2026-09-04, Apache-2.0), the Kyverno CLI (v1.19.1, Apache-2.0) and k3d 5.8.3 (released 2025-02-15, MIT) are build-only tools and have no scorecard row (WP-0.2 plan §6).
