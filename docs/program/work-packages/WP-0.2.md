# WP-0.2: Environments
Phase / release: Phase 0 Foundation / no clinical go-live (business plan M0–M9)   Features: none listed in §21
Read first: BUILD-PROMPT §4.1 (on-site substrate, Kubernetes packaging, object storage, secrets and keys, central site); §4.3 (signing in development and CI); §5.1; §6.7; §16.1–§16.2; §18.7; §19.1–§19.2. Research: K §7.8–§7.11; R08 §6; R16 §12, §14; R07 §6 (the §16 "Read:" line)
Depends on: WP-0.1   Simulators needed: none (§3.7 lists none for this work package)
Entry criteria:
- WP-0.1 merged, or reviewed and stacked (§3.6, §21).
- A Linux build host (DN-001), a container engine (DN-002) and k3d, kubectl and Helm (DN-003): met on 18 October 2026 (WSL2 with Ubuntu 24.04, Docker Engine 29.9.1, k3d 5.8.3, kubectl 1.37.1, Helm 4.3.1). Pin a k3s image whose Kubernetes version kubectl 1.37 supports; k3d 5.8.3's default (1.31) is outside the skew (DN-003).
- A decision on resources (DN-005). Default: the lite cell, because the host has 15.6 GB RAM and 8 cores, below the 32 GB the dev cell needs; the WSL VM has 10 GB of memory and 8 GB of swap. Measure and record what the lite cell uses.
Deliverables:
- A `docker compose` dev stack for fast inner-loop work, using the production container images (§5.1).
- The dev cell: a three-node `k3d` cluster on the build host that mirrors the on-site cell and uses the production Helm charts (§5.1). On a host with less than 32 GB of RAM, the lite cell replaces it: one Kafka broker, two PostgreSQL instances, no Argo CD, every result labelled "lite".
- CloudNativePG with three PostgreSQL instances and quorum synchronous replication: a commit waits for any one of the two standbys and never degrades to asynchronous (§5.1, §16.2).
- Strimzi Kafka 4.x in KRaft mode with three brokers (§4.1).
- Temporal on PostgreSQL persistence, Keycloak (Keycloak Operator), OpenFGA and Valkey (official images) (§4.1).
- An S3-compatible object store under Apache-2.0 or LGPL that implements Object Lock in compliance mode, chosen through the dependency scorecard and proven by a WORM test; not MinIO (§4.1).
- Upstream operators and charts only; no Bitnami images or charts (§4.1).
- A local image registry with offline signing: a local cosign key pair (git-ignored, passphrase from the environment), transparency-log upload disabled and offline verification; never keyless signing, Fulcio, the public Rekor log or a public registry (§4.3).
- Argo CD in pull mode (not in the lite cell).
- An OpenTelemetry collector exporting PHI-free telemetry (§6.7).
- One-command bootstrap and teardown, listed in `COMMANDS.md`, with runbook entries in `docs/runbooks/`.
- The merge-tier steps that need containers (Testcontainers integration tests) become runnable in `tools/ci/run` (KA-003).
Exit criteria (evidence required):
- The cell boots from locally signed images with one command.
- A smoke test passes.
- Killing any single node (primary or standby) keeps PostgreSQL writable with no committed transaction lost, and losing two nodes stops writes instead of degrading to asynchronous. A lite cell (two PostgreSQL instances) cannot show this as written; the criterion is not weakened and stays open on a lite cell (DN-005, OQ-084).
- The object store refuses to delete a locked object.
- Every result names its cell: dev-cell numbers "indicative", lite-cell numbers "lite" (§3.5, §5.1).
Hazards touched:
- H6 data loss or corruption (quorum synchronous replication; no committed transaction lost on node loss).
- H7 unavailability (single-node loss keeps the database writable).
[HUMAN] gates:
- None in §21.
- The host prerequisites were human decisions: DN-001, DN-002 and DN-003 are closed; DN-005 is open. The reference cell (DN-009) is not needed for this work package.
