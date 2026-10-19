# WP-0.2: Environments
Phase / release: Phase 0 Foundation / no clinical go-live (business plan M0–M9)   Features: none listed in §21
Read first: BUILD-PROMPT §4.1 (on-site substrate, Kubernetes packaging, object storage, secrets and keys, central site); §4.3 (signing in development and CI); §5.1; §6.7; §16.1–§16.2; §18.7; §19.1–§19.2. Research: K §7.8–§7.11; R08 §6; R16 §12, §14; R07 §6 (the §16 "Read:" line)
Depends on: WP-0.1   Simulators needed: none (§3.7 lists none for this work package)
Entry criteria:
- WP-0.1 merged, or reviewed and stacked (§3.6, §21): met. WP-0.1 is done (review `reviews/WP-0.1.md`, all findings resolved), and `wp/0.1-programme-bootstrap` at `09afa41` is merged into `wp/0.2-environments` with `--no-ff`, never rebased (DN-011).
- A Linux build host (DN-001), a container engine (DN-002) and k3d, kubectl and Helm (DN-003): met on 18 October 2026 (WSL2 with Ubuntu 24.04, Docker Engine 29.9.1, k3d 5.8.3, kubectl 1.37.1, Helm 4.3.1). Pin a k3s image whose Kubernetes version kubectl 1.37 supports; k3d 5.8.3's default (1.31) is outside the skew (DN-003).
- A decision on resources (DN-005). Default in use since 19 October 2026: the lite cell with three small PostgreSQL instances (option 4), because the host has 15.6 GB RAM and 8 cores, below the 32 GB the dev cell needs; the WSL VM has 10 GB of memory and 8 GB of swap. Measure and record what the lite cell uses.
Deliverables:
- A `docker compose` dev stack for fast inner-loop work, using the production container images (§5.1), in `deploy/compose/` (OQ-134).
- The dev cell: a three-node `k3d` cluster on the build host that mirrors the on-site cell and uses the production Helm charts (§5.1). On a host with less than 32 GB of RAM, the lite cell replaces it: §5.1 defines it as one Kafka broker, two PostgreSQL instances and no Argo CD; on this host it runs three PostgreSQL instances (DN-005 default), and every result is labelled "lite".
- CloudNativePG with three PostgreSQL instances and quorum synchronous replication: a commit waits for any one of the two standbys and never degrades to asynchronous (§5.1, §16.2).
- Strimzi Kafka 4.x in KRaft mode with three brokers (§4.1).
- Temporal on PostgreSQL persistence, Keycloak (Keycloak Operator), OpenFGA and Valkey (official images) (§4.1).
- An S3-compatible object store under Apache-2.0 or LGPL that implements Object Lock in compliance mode, chosen through the dependency scorecard and proven by a WORM test; not MinIO (§4.1): SeaweedFS 4.48 (ADR-029), chosen; the WORM test and its unit tests are built, and the records of record are owed (compose stack in S8, cell in S5); not met until they exist.
- Upstream operators and charts only; no Bitnami images or charts (§4.1).
- A local image registry with offline signing: a local cosign key pair (outside the repository in `HMS_CELL_HOME`, passphrase from `HMS_COSIGN_PASSWORD`; OQ-124, OQ-130), transparency-log upload disabled and offline verification; never keyless signing, Fulcio, the public Rekor log or a public registry (§4.3). Admission control refuses unsigned images (ADR-030, proposed).
- Argo CD in pull mode (not in the lite cell).
- An OpenTelemetry collector exporting PHI-free telemetry (§6.7; OQ-131).
- One-command bootstrap and teardown, listed in `COMMANDS.md`, with runbook entries in `docs/runbooks/`.
- The merge-tier steps that need containers (Testcontainers integration tests) become runnable in `tools/ci/run` (KA-003).
- **The lite-cell design** (plan of 19 October 2026; DN-005, OQ-122 to OQ-134):
  - Substrate: three k3s servers, each also a worker, with embedded etcd; fixed node addresses from a k3d configuration with a fixed subnet, checked against etcd's peer addresses by `cell up`; the k3d server load balancer kept; `--servers-memory 3g` [P]; traefik, servicelb and metrics-server disabled; every image pulled from the local registry only (OQ-122).
  - Images: mirrored by linux/amd64 digest with crane into the local registry (CNCF Distribution), signed with cosign offline and verified offline; pins in `deploy/site-cell/cell.yaml`, checked by `cell lint` in the fast tier (OQ-124, OQ-125).
  - Signature enforcement: Kyverno admission controller with a `verifyImages` policy and a registry-only rule; kube-system checked; `cell verify-running` for running pods (ADR-030, OQ-123).
  - PostgreSQL: one CloudNativePG `Cluster` of 3 instances, `synchronous: {method: any, number: 1, dataDurability: required}`, required anti-affinity on hostname, operator with 2 replicas; a primary-only NodePort service for the failover probe (OQ-126).
  - Kafka: one combined controller and broker node (Strimzi KRaft); Temporal, Keycloak, OpenFGA, Valkey, SeaweedFS and the OpenTelemetry collector at one replica each.
  - Budget: about 5.4 GiB for the cell and 5.9 GiB for the VM (an estimate, to be measured); `cell up` needs at least 6.5 GiB available [P]; the footprint test fails above 6.0 GiB in steady state [P]; C: must keep 15 GiB free (DN-013); the cell is stopped before heavy builds, and the nightly tier parks it during the fast steps (OQ-128).
  - What the lite cell cannot show: hardware faults, clock skew between nodes, real network latency, three-broker Kafka behaviour, Argo CD in steady state, and representative RTO and footprint numbers (KA-014, KA-015).
Exit criteria (evidence required):
- The cell boots from locally signed images with one command: `cell down --all && cell up --profile lite --evidence` from a clean start (`cell/<date>-cell-up-<sha>.json`, `cell/<date>-images-<sha>.json`), and the signature-enforcement tests SIG-01 to SIG-07 (`cell/<date>-signature-enforcement-<sha>.json`).
- A smoke test passes (`cell/<date>-smoke-<sha>.json`): API and three Ready nodes with fixed addresses; every running image signed; PostgreSQL (3 of 3 ready, `ANY 1` over both standbys, `synchronous_commit=on`, a write and read round trip); Kafka produce and consume; Temporal health; Keycloak OIDC discovery; OpenFGA check; Valkey; the WORM test; OpenTelemetry allowlist; egress default-deny (OQ-132, `cell/<date>-egress-<sha>.json`).
- Killing any single node (primary or standby) keeps PostgreSQL writable with no committed transaction lost, and losing two nodes stops writes instead of degrading to asynchronous. The criterion is not weakened. On this host it is tested on the lite cell with three PostgreSQL instances (DN-005 option 4, pending): the evidence is recorded and labelled lite, and the criterion is reported as "shown on the lite cell (three instances, DN-005 option 4, pending)", not as met, until DN-005 is answered (OQ-084). Tests (HAZ-0028), each with RPO 0, no split brain and convergence:
  - `ChaosTest:node-kill-primary` (N1), `ChaosTest:node-kill-standby` (N2), `ChaosTest:node-kill-each` (N3): `chaos/<date>-node-kill-<sha>.json`;
  - `ChaosTest:primary-pod-kill` (P1), `ChaosTest:primary-partition` (P2), `ChaosTest:standbys-fenced-writes-block` (Q1), `ChaosTest:two-node-loss-writes-stop` (Q2, Q3): `chaos/<date>-db-failover-<sha>.json`;
  - `ChaosTest:cell-restart-any-order` (R1): `chaos/<date>-cell-restart-<sha>.json`.
- The object store refuses to delete a locked object: `ContractTest:worm-W01-W11` and `ChaosTest:worm-recheck-after-restart` after pod deletion, node kill and R1 (HAZ-0029; `cell/<date>-worm-seaweedfs-4.48-<sha>.json`, `cell/<date>-worm-recheck-seaweedfs-4.48-<sha>.json`).
- Every result names its cell: dev-cell numbers "indicative", lite-cell numbers "lite" (§3.5, §5.1); the footprint is recorded in `perf/<date>-lite-cell-footprint-<sha>.json`.
- §22.2: `STATUS.md`, `BACKLOG.md`, `KNOWN-ANOMALIES.md` and the hazard log are current, and a reviewer report exists with no unresolved critical or major findings.
Hazards touched:
- H6 data loss or corruption, and H7 unavailability: HAZ-0028 (committed data lost, or writes accepted unsafely, after losing cell nodes); its controls are `planned`, and lite evidence takes them no further than `implemented` until DN-005 is answered.
- H6 and H14: HAZ-0029 (a locked object deleted or its retention shortened); controls `planned`.
[HUMAN] gates:
- None in §21.
- The host prerequisites were human decisions: DN-001, DN-002 and DN-003 are closed; DN-005 is open (its default, option 4, is in use). Host settings for the cell: DN-013 (free disk on C:), DN-015 (WSL idle termination) and DN-016 (inotify instances). The reference cell (DN-009) is not needed for this work package.
