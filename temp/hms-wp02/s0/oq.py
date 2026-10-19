"""S0: OPEN-QUESTIONS.md entries OQ-122 to OQ-134 and the status updates of OQ-084, OQ-094 and OQ-104."""
import sys

p = sys.argv[1]
s = open(p, encoding="utf-8").read()


def rep(old, new):
    global s
    assert s.count(old) == 1, old[:60]
    s = s.replace(old, new)


rep(
    "- **Reading in use:** the criterion is not weakened; on a lite cell it stays open and the evidence says so.\n- **Status:** moved (blocks WP-0.2 on this host: DN-005)",
    "- **Reading in use:** the criterion is not weakened; on a lite cell it stays open and the evidence says so.\n"
    "- **Update (19 October 2026):** WP-0.2 gathers the evidence on a lite cell with three PostgreSQL instances (DN-005 option 4, the default in use), labelled \"lite\" and reported as \"shown on the lite cell, pending\"; whether it meets the criterion is DN-005's decision.\n"
    "- **Status:** moved (blocks WP-0.2 on this host: DN-005)",
)
rep(
    "- **Next:** WP-0.2 measures what the lite cell uses on this host (a 10 GB VM, DN-005) and confirms or changes the lite-cell and disk thresholds.\n- **Status:** open",
    "- **Next:** WP-0.2 measures what the lite cell uses on this host (a 10 GB VM, DN-005) and confirms or changes the lite-cell and disk thresholds.\n"
    "- **Update (19 October 2026):** the lite-cell threshold is to be set from the footprint test's record (`docs/program/evidence/perf/`, WP-0.2); the plan's estimate of about 5.9 GiB in the VM is not a measurement. Until then the doctor reports no cell profile on this 9.7 GiB VM.\n"
    "- **Status:** open",
)
rep(
    "- **Reading in use:** the scorecard is created as `docs/program/dependency-scorecard.md` by the first work package that adds a runtime dependency to a running system: WP-0.2, which also chooses the object store through it [P].\n- **Status:** open",
    "- **Reading in use:** the scorecard is created as `docs/program/dependency-scorecard.md` by the first work package that adds a runtime dependency to a running system: WP-0.2, which also chooses the object store through it [P].\n"
    "- **Update (19 October 2026):** the file exists since `a1d5fd6` with the object-storage rows (ADR-029); WP-0.2 adds a row for each runtime dependency of the cell before it closes.\n"
    "- **Status:** open",
)

anchor = "which gives SeaweedFS 4.48 (published 2026-09-28).\n- **Status:** open\n"
assert s.endswith(anchor), "section (g) is not at the end of the file"
s += """
### OQ-122: The lite cell's topology: three k3s servers with fixed addresses
- **Choice:** three k3s servers, each also a worker, with embedded etcd: the on-site shape, so that losing two nodes also loses the control-plane quorum, as it would on site. The cluster is created from a k3d configuration with a fixed subnet (172.28.0.0/16), so that every node, the server load balancer and the registry keep their address across restarts; `cell up` fails when a node has no fixed address or its address differs from its etcd member's peer address. The k3d server load balancer is kept, so kubectl reaches the API while any one server is down. k3d `--servers-memory 3g` [P], so each kubelet schedules against 3 GiB. k3s runs with `--disable=traefik,servicelb,metrics-server`, `--system-default-registry` pointing at the local registry and `--disable-default-registry-endpoint`, so no image pull can bypass the local registry. If the pinned k3d does not fix the addresses, the fallback (restart policy `no`, nodes started in creation order) gets a KA.
- **Why:** the WP-0.2 prototype, created without a fixed subnet, came back from a WSL termination with its node addresses swapped, and its embedded etcd lost quorum (DN-015).
- **Status:** open

### OQ-123: Signature enforcement: Kyverno, offline, kube-system included, local registry only
- **Choice:** §4.3 requires local signing and offline verification but names no admission controller. The cell uses the Kyverno admission controller (ADR-030, proposed) with a `verifyImages` policy holding the cell's public key: no transparency log or certificate timestamp is checked (`ignoreTlog`, `ignoreSCT`), tags are rewritten to digests (`mutateDigest`, `verifyDigest`), a signature is `required`, and `failurePolicy` is `Fail`. Kyverno's `resourceFilters` are overridden so that only the `kyverno` namespace is excluded, so kube-system is checked. A validate rule admits only images from the local registry. Kyverno's own images are verified with the cosign CLI before it is installed, and `cell verify-running` checks every running container, including pods that started before the policy.
- **Status:** open

### OQ-124: Mirroring by digest, one local path per image, cell state in `HMS_CELL_HOME`
- **Choice:** every image is copied from its publisher's registry by the digest of its linux/amd64 manifest (`crane copy --platform linux/amd64`, which keeps that digest) into the local registry, under a local path recorded in `deploy/site-cell/cell.yaml`; no two images share a path, and pods reference the local path by digest. Cell state lives outside the repository in `HMS_CELL_HOME` (default `~/.local/share/hms-cell`): the cosign key pair, the chart cache, the S3 credentials, the WORM state and the probe logs. Every clone on the host then shares one key, one registry and one cluster, and the private key cannot be committed, which is stricter than §4.3's "git-ignored".
- **Status:** open

### OQ-125: How the cell's pins are read
- **Choice:** the §4.1 rule ("the newest generally available release that has had at least one patch release" and that its consumers support) is applied to the application version, and the chart release that ships it is pinned with it; a chart's own numbering does not count. It is read strictly for Strimzi (1.0.1, because 1.1 to 1.3 have no patch release yet) and OpenFGA (v1.18.3, because 1.19 to 1.22 have none). k3s is pinned at v1.37.1-k3s1 only if every operator's support matrix covers Kubernetes 1.37, otherwise at v1.36.5-k3s1. The values in the WP-0.2 plan are provisional (registry listings of 18 October 2026); each is re-checked before it is pinned and recorded in ADR-002 and the dependency scorecard.
- **Status:** open

### OQ-126: What "no committed transaction lost" means in the failover tests
- **Choice:** CloudNativePG renders `synchronous_standby_names = 'ANY 1 (...)'` naming both standbys, with `synchronous_commit = on`, so a commit returns only after its WAL is flushed on the primary and on at least one standby; `dataDurability: required` keeps absent standbys in the list, so commits wait instead of degrading to asynchronous. The test probe counts a write as acknowledged only if the autocommit INSERT returned CommandComplete and no "canceling wait for synchronous replication" warning arrived. Write classes: `ack`; `ack_local_only` (the warning arrived: the commit is on the primary only, and any such write fails the test); `not_sent`; `ambiguous` (sent, then the connection broke: reported, never failed). The probe never cancels a query and never sets `statement_timeout`. RPO 0: every acknowledged write is present after recovery, with no phantom rows. The write RTO passes at 300 s or less, the §16.2 engineering figure (RTO ≤5 min). While two nodes are down, no write may be acknowledged from 1 s after the second kill until the restore. A run with memory pressure above 10% (avg10) [P] is marked "disturbed" and never counts as a pass.
- **Status:** open

### OQ-127: Splitting the nightly chaos step, and the owner of each part
- **Choice:** the single nightly `chaos` step of `tools/ci/run` is split. WP-0.2 builds `chaos-node-kill`, `chaos-db-failover` (which includes isolating the primary, the §18.7 network partition for the database) and `chaos-restart`. The others stay NOT-BUILT and name their owner (KA-016): `chaos-broker-loss`, WP-0.3 [P] (it needs the event flow, and a single lite broker only shows a restart); `chaos-wan-cut` and `chaos-power-cut`, WP-1.13 (in its exit criteria); `chaos-clock-skew`, WP-1.13 [P] (the k3d nodes share one clock; ADR-026); `chaos-slow-terminology`, WP-1.1 (§18.7 lists it, §19.1 does not); `chaos-alarms` ("assert alarms ≤5 min"), WP-0.3 [P].
- **Status:** open

### OQ-128: Parking the cell in the nightly tier
- **Choice:** until the footprint test shows that the lite cell and the fast tier's build fit together in the 10 GB VM, a nightly run with a cell runs `cell-park` (stops the nodes), then the fast steps, `build-daemons-stop` (`gradlew --stop`), `cell-start` and the cell steps [P]. This also exercises a full restart every night. `cell up` refuses to start with less than 6.5 GiB available [P].
- **Status:** open

### OQ-129: Evidence directories for the cell, and a qualifier inside `<test>`
- **Choice:** cell records go to `docs/program/evidence/cell/` (image mirroring and signing, cell-up, smoke, signature enforcement, egress, WORM and its re-check, compose smoke), chaos records to `chaos/` and the footprint to `perf/`. A qualifier, such as the component and version under test, is part of the `<test>` field (`cell/<date>-worm-seaweedfs-4.48-<shortsha>.json`), so the README pattern `<yyyy-mm-dd>-<tier-or-test>-<shortsha>[-dirty].<ext>` still holds. A rerun with the same name adds `-2`, `-3` and never overwrites an earlier record [P]. Each record names its cell and standing, the host, the git state and the hash of the pin set (`docs/program/evidence/README.md`).
- **Status:** open

### OQ-130: The cosign passphrase comes from `HMS_COSIGN_PASSWORD`
- **Choice:** §4.3 takes the passphrase "from the environment" without naming the variable. The cell tools read `HMS_COSIGN_PASSWORD` and pass it to cosign as `COSIGN_PASSWORD` inside the pinned cosign container; without it, signing fails closed. Where no passphrase is set, the cell owner generates a random one into a file in `HMS_CELL_HOME` with mode 600, exports it from there, and says so in the session report. Neither the key nor the passphrase enters the repository.
- **Status:** open

### OQ-131: The OpenTelemetry collector and its allowlist
- **Choice:** the upstream OpenTelemetry Collector from the official chart (`open-telemetry/opentelemetry-helm-charts`), one Deployment receiving OTLP. An allowlist processor passes only named attributes, so an attribute not on the list never reaches an exporter (§6.7 "PHI-free telemetry"). With no central site yet, it exports to a local debug sink (KA-017). The collector distribution (core or contrib) is the one whose image holds the processors the allowlist needs, chosen when it is pinned.
- **Status:** open

### OQ-132: The egress test is built in WP-0.2
- **Choice:** OQ-098 placed the §6.8 egress fitness function with the dev cell (WP-0.2). WP-0.2 builds it on the lite cell: default-deny NetworkPolicies for the application namespace, and a smoke check that TCP to 1.1.1.1:443 from `hms-app` fails while in-cell DNS and PostgreSQL work, recorded as `cell/<date>-egress-<shortsha>.json`. k3s enforces NetworkPolicies with its embedded controller.
- **Status:** open

### OQ-133: Red Hat UBI base images
- **Choice:** the Keycloak and Strimzi images are built on Red Hat Universal Base Image. Their OS packages are read as "operating-system packages inside base images, as unmodified system components listed in the SBOM" (§4.3), so the images are allowed. The OpenJDK inside the Kafka, Strimzi and Keycloak images falls under the `openjdk-runtime` rule. Both are recorded in the licence register before the WP-0.9 image scan (KA-019). A human confirms that the UBI terms allow these images to ship to sites.
- **Status:** open

### OQ-134: `deploy/compose/`, a directory §6.1 does not list
- **Choice:** §6.1 lists `deploy/helm/`, `site-cell/`, `central/`, `edge-agent/` and `tofu/`, and no home for the `docker compose` dev stack that §5.1 and §21 require. It goes in `deploy/compose/` (`compose.yaml`, its configuration and a README).
- **Status:** open
"""
open(p, "w", encoding="utf-8", newline="\n").write(s)
