# ADR-007: On-site hospital cells, a Kurdistan central and DR site, and a PHI-free control plane
Status: accepted
Date: 2026-10-18   Source: K §7 (intro), §7.1 rules 5 and 9, §7.2, §7.6, §7.8, K-16, K-17, Appendix A.2 (KDV-1); BP §7.1, §7.2, §7.9; R08 §1 #9, §6.1, §6.2, §12.1 #5, §14 #7; R16 §14.1; R07 §9.1 #3; BUILD-PROMPT §2.2 rules 5 and 9, §4.1, §5.1, §16, §21 (WP-0.2, WP-1.13), §4.2

## Context

**The question.** Where the product runs, and how one set of artefacts serves every topology.

**BP** (BP §7.2, §7.9): sovereign cloud cells with a PHI-free global control plane; substrate portability (managed EKS and vanilla RKE2 + CloudNativePG + Strimzi) proven in CI from M9; a site edge agent per hospital; on-prem only from P2.

**What K changed** (K §7.2; K-16 and KDV-1, "Changed"). Cells become on-site hospital cells, with a Kurdistan central and DR site and a PHI-free control plane around them. The reasons: there is no in-country hyperscaler [L]; power and internet are unreliable [L]; and BP's own edge-cell trigger (WAN availability under 99.9%, or any outage over 1 h a month) would fire at most sites. K replaces one of BP's five architecture jobs with "run the whole hospital on site, safely, with exactly the same artefacts as the central site" (K §7 intro), and restates constitution rules 5 and 9 for it (K §7.1). Substrate portability is proven in CI from M9: k3s/RKE2 on site; managed or self-run Kubernetes centrally.

**The research supports this.** On-prem and edge deployments use the same signed artefacts (R08 §1 #9, §12.1 #5; R16 §14.1); a modular monolith makes 2–3 node hospital installs far simpler (R08 §4.1); R08 says to prove an on-prem and an edge install in the first year (R08 §14 #7). The control plane is PHI-free (R07 §9.1 #3).

**[P] marks.** The topology is K's. BUILD-PROMPT §4.1 marks as [P] the Kubernetes packaging rules, the object-storage choice and the development profile, recorded below.

## Decision

**On-site hospital cells,** a Kurdistan central and DR site, and a PHI-free control plane. Substrate portability (k3s/RKE2 on site; Kubernetes centrally) proven in CI.

**Topologies** (BUILD-PROMPT §5.1; K §7.8):
- **On-site hospital cell (MVP):** three nodes (or two plus a witness) on separate UPS feeds, running the full tenant: the modular monolith and its satellites; PostgreSQL as three instances with quorum synchronous replication; the event backbone; Temporal; Keycloak; OpenFGA; the Integration Hub; print, queue and device bridges; the reporting replica; Tier 2 sidecars; local terminology and drug-KB snapshots. An on-site immutable backup target (object-lock NAS) in a separate fire compartment or building. Outbound-only management. Co-signed local break-glass (ADR-027).
- **Kurdistan central and DR site (MVP):** colocation in Erbil or Sulaymaniyah, with its own DR in the other city (availability of suitable colocation is an assumption [L], Q-K11). It holds the PHI-free control plane (signed releases, configuration bundles, licences, PHI-free telemetry); the pooled tier for outpatient facilities (ADR-006); an encrypted warm standby of every hospital cell (async, RPO ≤15 min while replication is up); continuity instances; central terminology and analytics; the CI reference cell.
- **Site edge agent (MVP):** for outpatient-tier sites, and for a group's outpatient site attached to the group's hospital cell over metro links (ADR-011).
- **Continuity instance (MVP):** a read-only shadow per hospital at the DR site, with identity independent of the hospital's IdP.
- **Regional cloud (optional, P2):** ciphertext backups under hospital-held keys and PHI-free services only, after a counsel opinion (Q-K2).
- **Multi-site edge cell (P3):** ADR-025.

**Stack detail** (BUILD-PROMPT §4.1):
- **On-site substrate:** k3s or RKE2 on three nodes; Helm; Argo CD in pull mode; an OpenTelemetry collector exporting PHI-free telemetry to the central site.
- **Kubernetes packaging [P]:** upstream operators and charts only: CloudNativePG, Strimzi, the Keycloak Operator, the Temporal and OpenFGA charts, official Valkey images. No Bitnami images or charts.
- **Object storage [P]:** an S3-compatible server under Apache-2.0 or LGPL that implements Object Lock in compliance mode, chosen through the dependency scorecard and proven by a WORM test (an object cannot be deleted or its retention shortened before expiry). Not MinIO.
- **Central site:** Kubernetes in Kurdistan colocation; Prometheus; Grafana and Loki (AGPL) only centrally, unmodified, never shipped on site; OpenSearch only for central log search. Infrastructure as code with OpenTofu.
- **Reference hardware per hospital [E]:** three servers (16–32 cores, 128–256 GB RAM, NVMe with power-loss protection), a pair of 10 GbE switches, an object-lock NAS, two online double-conversion UPS units with ≥60 minutes runtime. The reference cell for C7, C9, the 300-bed day and the SLOs is three servers of 32 cores, 128 GB and NVMe each [HUMAN].
- **Development profile [P]:** a `docker compose` stack and the dev cell, a three-node `k3d` cluster that mirrors the on-site cell; a lite cell (one Kafka broker, two PostgreSQL instances, no Argo CD) on hosts with less than 32 GB of RAM. Both use the production images; the dev cell also uses the production Helm charts.

## Consequences (including safety and licence impact)

**Safety.**
- Losing the internet has no clinical effect at a hospital (bar #4; H7). Losing the internet does not make an on-site cell "offline" (SI-15; ADR-012).
- During an internet cut the on-site copy is the only copy of new data, so it must itself be protected: the on-site immutable backup sits in a separate fire compartment (K §7.8). The DR standby's RPO ≤15 min holds only while replication is up; during a cut the real recovery point equals the length of the cut (K-17; BUILD-PROMPT §16.2).
- Residency is a property of the cell (rule 9; SI-20): usable PHI never leaves the on-site cell and its Kurdistan DR standby (H13).

**Operations.** The hospital owns the hardware (K §7.8). Every performance, footprint or restore number names its cell; only reference-cell numbers count as evidence (BUILD-PROMPT §3.5, §5.1). The build host is WSL2 with Ubuntu 24.04.5 on an 8-core, 15.6 GB Windows 11 machine, with Docker Engine 29.9.1, k3d 5.8.3, kubectl 1.37.1 and Helm 4.3.1 installed by `tools/host/provision-ubuntu.sh` (DN-001 to DN-003, closed). The WSL VM is limited to 10 GB of memory, below the 32 GB the dev cell needs, so the dev cell runs there as the lite cell (one Kafka broker, two PostgreSQL instances, no Argo CD), with every result labelled "lite" (DN-005).

**Licence.** On-site installs count as distribution, so GPL and AGPL components ship only as unmodified separate containers with a source offer, and no AGPL observability stack runs on site (K §7.6; ADR-022). Bitnami is excluded because its free versioned images were withdrawn in 2025; MinIO is excluded (AGPL, and its community edition no longer ships maintained builds) (BUILD-PROMPT §4.1).

## Fitness test that guards it

**Guard (BUILD-PROMPT §4.2):** Conformance suite on both substrates.

**Where and when.**
- The conformance suite lives in `tests/conformance/` (BUILD-PROMPT §6.1). It runs on the three-node cell (the dev cell in CI; the reference cell before release) and on the central substrate (constitution rule 5).
- The dev cell is built in WP-0.2 (exit: the cell boots from locally signed images with one command; node-kill and object-lock checks). The installer, burn-in suite and central site arrive in WP-1.13.
- The reference-cell run waits for hardware [HUMAN: hardware].
- Related check (constitution rule 9, not this ADR's named guard): egress tests on every release (BUILD-PROMPT §6.8 item 11).

**State on 2026-10-18:** not implemented. On the current build host the dev cell runs only as the lite cell (DN-005), so any run there is labelled "lite". This ADR claims no result.

## Reopen if

No reopen trigger is set (BUILD-PROMPT §4.2 shows "—"). Any change to this ADR is stop-and-ask item 2 (BUILD-PROMPT §3.4).
