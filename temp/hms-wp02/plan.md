# WP-0.2 implementation plan: environments (the local dev cell)

**What I read.** BUILD-PROMPT §3, §4.1, §4.3, §5.1, §16, §18.7, §19.1, the §21 row for WP-0.2 and §22, plus K §7.6 and §7.8. I also read:
- `work-packages/WP-0.2.md` and the programme files in the main checkout, including the uncommitted WP-0.1 fixes;
- the three commits on `wp/0.2-environments`;
- `tools/hmstools/ci/tiers.py`, the runner and the doctor;
- the prototype scripts.

**What I inspected in WSL (read-only).** The prototype's containers, logs, Docker events and network, and the systemd journal for each boot.

**What I did not run.** `tools/ci/run nightly --list`: its launcher runs Python without `-B`, so it would write bytecode. Its output follows from `NIGHTLY_NOT_BUILT` in `tiers.py`, which I read instead.

**The WSL host at 01:45 on 19 October.**
- The VM has 9.7 GiB, with 4.8 GiB available and a load of 8–11. Another session's Gradle `gates-bite` job is running in `~/src/hms-plant` (three JVMs, about 4.7 GiB resident).
- C: has 30 GiB free. Docker uses the containerd image store.
- `fs.inotify.max_user_instances` is 128.
- cosign, crane and skopeo are not installed.

## 0. Before starting

- **Branch base.** The WP-0.1 review fixes are not yet committed on `wp/0.1-programme-bootstrap`.
  - Once they are, merge that branch into `wp/0.2-environments` with `git merge --no-ff`. Do not rebase: that rewrites the three WP-0.2 commits, and rewriting history is stop-and-ask item 6.
  - Expect conflicts in `OPEN-QUESTIONS.md`: WP-0.2's section (g), with OQ-106 and OQ-107, goes after WP-0.1's OQ-108 to OQ-121. Expect one in `docs/adr/README.md` too.
  - After the merge, `cell/evidence.py:code_git_info` repeats the runner's new rule for untracked evidence files. Call the runner's helper instead, and keep `test_evidence.py`.
- **ID ranges.** WP-0.7 is being specified at the same time from `6ca3e3a`. Reserve these ranges in STATUS.md:
  - WP-0.2: DN-015 to DN-019, OQ-122 to OQ-139, KA-014 to KA-024, HAZ-0028 to HAZ-0029, and ADR-030.
  - WP-0.7: starts at DN-020, OQ-140, KA-025 and HAZ-0030; it takes ADR-031 only if it stacks on this branch.
- **One cell owner.** Every session shares the WSL Docker. Only one agent drives the cell, and it never starts the cell while another heavy job is running: `cell up` refuses when less than 6.5 GiB is available. Other agents write code and unit tests on the Windows checkout.
- **Clear the prototype** (in S0, by the cell owner).
  - Run `k3d cluster delete hms-proto`.
  - Delete the images that no pin uses: RustFS, versitygw, CNPG 1.27.1, Strimzi 0.48.0 and Valkey 8.1.
  - Record `docker system df` and `df -h /mnt/c` before and after.
  - The prototype is not evidence, and none of its numbers is used.
- **Cell state lives outside the repository.** `HMS_CELL_HOME` (default `~/.local/share/hms-cell`) holds the cosign key pair, the chart cache, the S3 credentials, the WORM state and the probe logs.
  - Every clone then shares one key, one registry and one cluster.
  - The private key can never be committed, which is stricter than §4.3's "git-ignored".

## 1. Why the prototype's API server is down, and how the real cell avoids it

**Evidence**

1. **WSL stopped the distribution five times** between 17:47 and 21:40.
   - The journal shows `InitTerminateInstanceInternal … calling reboot(RB_POWER_OFF)`, and dockerd logs "failed to exit within 10s of signal 15 - using the force".
   - The boots at 21:28 and 21:36 lasted only 27 s and 25 s. That fits idle termination after the last `wsl.exe` exited.
   - Each termination stops all three nodes at once: in effect, a power cut to the whole cell.
2. **The nodes came back with swapped addresses.**
   - At 21:40 Docker restarted the node containers under their `unless-stopped` policy. It started server-1 first, then server-2 and server-0.
   - k3d had created the network without `--subnet`, so no container has a fixed address (`IPAMConfig: null`). Docker gave out addresses in start order.
   - At creation, server-0 had 172.18.0.2 and server-1 had 172.18.0.3. Now server-0 has .3 and server-1 has .2.
3. **etcd could not form a quorum.**
   - Embedded etcd stores each member's peer URL as an IP address, so every member now dials the wrong peer.
   - etcd refuses those connections ("ignored streaming request; ID mismatch", "failed to find remote peer in cluster"), so no quorum forms and the API server never becomes ready.
   - k3s on each node then shut itself down at 18:54Z and 19:08Z ("Shutdown request received: failed to wait for API server to become ready").
   - No k3s process runs now. The containers still show "Up" only because k3d's entrypoint helper keeps retrying kubectl against 127.0.0.1:6443; each node's log has about 4,600 "connection refused" lines.
4. **kubectl depended on one node.** The prototype used `--no-lb`, so kubectl reached the API only through server-0's port. That is where the `ServiceUnavailable` and `EOF` errors came from.
5. **Ruled out:**
   - Memory: no boot journal records an OOM kill, and `OOMKilled=false`.
   - The k3s version: etcd 3.7.1-k3s3 behaved correctly when it refused the mismatched peers.

**How the real cell avoids it**

- **Fixed node addresses.**
  - Create the cluster from a k3d config with `subnet: 172.28.0.0/16`, so that k3d's IPAM fixes the address of every node, of the server load balancer and of the registry.
  - `cell up` checks that each container's `IPAMConfig.IPv4Address` is set and matches etcd's peer URL for that member, and fails otherwise.
  - Fallback if the pinned k3d does not fix addresses: set the nodes' restart policy to `no`, and have `cell start` start them in creation order. That is fragile, so it needs a KA.
- **A restart test (R1, every nightly).** Kill all three nodes and start them in reverse order. The test passes only if:
  - the API is ready within 300 s [P];
  - the node addresses are unchanged;
  - PostgreSQL converges.
- **Keep the k3d server load balancer,** so kubectl still works when any one server is lost.
- **Fewer terminations.** During a cell session the cell owner keeps a detached keeper process running, and stops it at the end of the session:
  `Start-Process -WindowStyle Hidden wsl.exe -ArgumentList '-d','Ubuntu-24.04','--exec','sleep','infinity'`
  A permanent WSL setting is the human's decision (DN-015).
- **A recovery path.**
  - `cell up` is idempotent. If an existing cluster's API is not ready within 300 s, it prints the comparison of node addresses against etcd members and stops.
  - It never recreates a cluster silently: recreating needs `cell down` first.
  - The runbook gives `k3s server --cluster-reset` as the last resort.

## 2. The lite cell

### 2.1 Topology

**Nodes.** Three k3s servers, each also a worker, with embedded etcd. This is the on-site shape, so losing two nodes also loses the control-plane quorum, as it would on site.

**k3s arguments:**
- `--disable=traefik,servicelb,metrics-server`;
- `--system-default-registry` pointing at the local registry;
- `--disable-default-registry-endpoint`, so no image pull can bypass the local registry;
- k3d `--servers-memory 3g` [P], so each kubelet schedules against a realistic 3 GiB.

**Pods.** Every container sets requests to its expected memory use and limits to its budget.

**Components.**

| Component | Lite cell | Dev-cell difference (32 GB host) |
|---|---|---|
| CloudNativePG | Operator with 2 replicas and leader election, so failover never waits for a new pod to be created. One `Cluster` called `hms-pg`: 3 instances, `synchronous: {method: any, number: 1, dataDurability: required}`, `failoverQuorum: true` if the pinned CRD has it (check with `kubectl explain`), required pod anti-affinity on hostname, `shared_buffers` 64MB. One database each for the synthetic tenant, Temporal, Temporal visibility, Keycloak, OpenFGA and `hms_chaos` | Larger buffers |
| Strimzi Kafka (KRaft) | One `KafkaNodePool` with 1 node holding both the controller and broker roles; heap 256m; topic operator on, user operator off | 3 nodes; replication factor 3; minimum in-sync replicas 2 |
| Temporal | Official chart: frontend, history, matching and worker, 1 replica each; 4 history shards; web UI off; PostgreSQL persistence | UI on; more shards |
| Keycloak | Keycloak Operator plus one `Keycloak` with a local cache and heap at about 50% of its limit | 2 replicas |
| OpenFGA | Official chart, 1 replica, PostgreSQL store, playground off | — |
| Valkey | Official image as our own StatefulSet; `maxmemory 64mb`, no persistence (cache only, §4.1) | — |
| SeaweedFS 4.48 | One `weed server -s3` StatefulSet with a 1 GiB volume (ADR-029) | — |
| Registry | CNCF Distribution as the k3d registry, outside the cluster on the cell network | — |
| Signature enforcement | Kyverno admission controller, 1 replica; background, cleanup and reports controllers off (ADR-030) | 3 replicas |
| OpenTelemetry collector | 1 Deployment; OTLP in; allowlist processor; local debug exporter (there is no central site yet) | — |
| Argo CD | none (§5.1) | Core install, in pull mode from the local OCI chart registry |

### 2.2 Memory budget

The expected figures below are estimates. S7 measures them and must confirm them.

| Item | Limit (MiB) | Expected (MiB) |
|---|---|---|
| 3 × k3s server (k3s, etcd, containerd, kubelet, flannel; CoreDNS and local-path on one node) | 3,072 per node, covering its pods | 1,800 |
| k3d load balancer and registry | 64 + 128 | 60 |
| Kyverno admission controller | 384 | 200 |
| CNPG operator × 2 | 256 each | 200 |
| PostgreSQL × 3 | 512 each | 600 |
| Strimzi cluster operator and topic operator | 384 + 256 | 500 |
| Kafka, one combined node | 768 | 550 |
| Temporal × 4 services | 192 each | 480 |
| Keycloak Operator and Keycloak | 384 + 768 | 800 |
| OpenFGA, Valkey, SeaweedFS, OTel collector | 128, 128, 256, 256 | 270 |
| **Cell total** | | **≈ 5.4 GiB** |

**Headroom.** The Docker daemons, the kernel and systemd add about 0.45 GiB, so the VM uses about 5.9 GiB in all. That leaves about 3.8 GiB.

**Fit with the build tools.** That is not enough for the fast tier's Gradle, which another session measured at about 4.7 GiB resident. So:
- the nightly tier stops ("parks") the cell during the build steps (section 5);
- COMMANDS.md says: `cell stop` before heavy builds.

**Budget rules [P]:**
- `cell up` needs at least 6.5 GiB available before it starts.
- The footprint test fails if steady-state use is above 6.0 GiB, and records the actual figure either way.

### 2.3 What the lite cell can and cannot prove

**Can show,** with every result labelled "lite":
- one-command boot from locally signed images;
- the smoke test;
- killing any single node keeps PostgreSQL writable with no acknowledged write lost (with three instances; DN-005);
- losing two nodes stops writes, and so does losing both standbys;
- an unsigned image is refused;
- the object store refuses to delete a locked object, also after restarts;
- the cell survives a full restart.

**Cannot show:**
- **Hardware faults.** The three nodes share one kernel, disk and power supply, and `docker kill` keeps the page cache. So no node kill tests fsync durability against a power cut, a disk loss or a NIC loss.
- **Clock skew between nodes.** All nodes share one kernel clock.
- **Real network latency** between nodes.
- **Three-broker Kafka behaviour** and Argo CD in steady state.
- **Representative RTO and footprint numbers** for an on-site cell. Lite RTOs are indicative, never SLO evidence (§3.5).

### 2.4 DN-005: proposed wording

> **Update (19 October 2026).** **Default in use until the human answers:** the lite cell runs three small PostgreSQL instances with quorum synchronous replication (option 4), with one Kafka broker and no Argo CD as §5.1 defines; every result from it is labelled "lite".
>
> **Why.** Two instances cannot show the single-node-loss criterion at all. Three fit the 10 GB VM (measured: … GiB at peak, `evidence/perf/…`). The change departs from §5.1's lite-cell definition by adding a PostgreSQL instance; it does not weaken any criterion.
>
> **Status of the criterion until you choose.** The node-kill evidence is recorded and labelled lite. WP-0.2's third exit criterion is reported as "shown on the lite cell (three instances, DN-005 option 4, pending)", not as met.
>
> **Your options.**
> - Option 1: the records stay on file as indicative, and the criterion stays open (OQ-084).
> - Options 2 and 3: the same commands run again on the larger host or on the reference cell.
>
> **What the lite evidence cannot show.** Hardware faults (the nodes share one kernel, disk and power supply), clock skew between nodes, real network latency, and RTO on reference hardware.

## 3. Slices in build order

**Who changes which files.**
- `tools/hmstools/cell/__main__.py`, `deploy/site-cell/cell.yaml` and `tools/requirements*` change only in the cell owner's turns.
- Programme files (STATUS, KA, OQ, DN, the hazard log, ADRs, the scorecard and the CHANGELOG) change only in the integrator's commits, S0 and S11.

**Order.**
- S0, S1 and S2 run one after the other (cell owner).
- On the cell, S3, then S4, then S5. Other agents write their Python modules and unit tests beforehand, against fakes.
- S6's templates are written alongside S4 and S5, and deployed after S5.
- S7 follows S6. **All four exit criteria have evidence at this point.**
- S8, S9 and S10 follow in parallel. S9 uses the commands from S4, S5 and S7.
- S11 comes last.

---

**S0. Ready** (integrator, runs alone)
- **Programme entries:**
  - the ID ranges in STATUS;
  - DN-005 as in section 2.4; DN-015 and DN-016; the measured update to DN-013;
  - OQ-122 to OQ-134, KA-014 to KA-024, and HAZ-0028 and HAZ-0029 with their controls `planned` (all in section 9);
  - `work-packages/WP-0.2.md`: the lite design and the test names;
  - ADR-030 as proposed;
  - `docs/program/evidence/README.md`: add a `cell/` row, and state that a qualifier such as `worm-seaweedfs-4.48` belongs inside `<test>`.
- **WSL:** the branch merge, clearing the prototype, the keeper process.
- **Tests:** the fast tier (Windows checkout); the repo and safety checks accept the new entries.

**S1. Pins, image lock, registry and keys**
- **Files:** `deploy/site-cell/cell.yaml`; `tools/hmstools/cell/{config.py, proc.py, images.py, signing.py}` with their tests.
- **`cell.yaml`** is the single source of pins:
  - the k3s image;
  - each chart: repository, name, version and the SHA-256 of its `.tgz`;
  - the Keycloak Operator manifests: tag, URL and SHA-256;
  - each image: upstream reference, linux/amd64 manifest digest, local path, licence, role, profiles and whether it ships to a site;
  - the tool images (crane, cosign).
- **`cell lint`** (pure Python, a new fast-tier step). It fails when:
  - an image has no digest;
  - a chart has no SHA-256;
  - a licence fails `tools/licence/policy.yaml` (reuse `hmstools.licence`);
  - "bitnami" appears anywhere;
  - two images share a local path;
  - a profile's component budgets exceed the profile budget.
- **`cell keys init`:** `cosign generate-key-pair` in the pinned cosign container, writing to `HMS_CELL_HOME`, with the passphrase from `HMS_COSIGN_PASSWORD`. Without that variable it fails closed.
- **`cell registry up`:** `k3d registry create hms-registry.localhost --port 5000`, using the pinned Distribution image.
- **`cell images mirror|sign|verify`:** idempotent, and refuses to pull when C: has less than 15 GiB free (DN-013).
  - `crane copy --platform linux/amd64` copies the upstream digest. That keeps the platform manifest digest; avoid `docker push`, which with the containerd store tries to push every platform.
  - `cosign sign` signs with no transparency-log upload.
  - `cosign verify` checks offline.
  - The tool containers run on the cell network, so they use the in-cluster registry name.
- **Spike first (one hour):** which signature format the pinned Kyverno verifies offline.
  - If it reads what cosign 3.1.3 writes (a signing configuration with no Rekor), pin 3.1.3.
  - Otherwise pin 2.6.5 with `--tlog-upload=false`. §4.1's "supported by the components that depend on it" covers that choice.
- **Tests:**
  - unit tests: lint fails on a planted Bitnami image, a missing digest and a denied licence; the cosign argument builders never contain a keyless, Fulcio or tlog-upload flag; the output parsers;
  - in WSL: mirror, sign and verify every image, recorded as `cell/<date>-images-<sha>.json` with the public-key fingerprint.

**S2. The substrate**
- **Files:** `deploy/site-cell/k3d/{lite,dev}.k3d.yaml`; `tools/hmstools/cell/{k3d.py, docker.py, kube.py}`; `tests/chaos/scenarios/cell-restart.yaml`.
- **Deliverable:**
  - `cell up --only substrate`. Before starting nodes it verifies the k3s image's signature, then starts them from the local registry's digest.
  - The address check from section 1.
  - `cell stop`, `cell start` and `cell status`.
  - R1, the restart test.
- **Tests:**
  - unit tests with JSON fixtures; the prototype's `IPAMConfig: null` must fail the check;
  - in WSL: an R1 record on the bare substrate. S5 runs R1 again with PostgreSQL and the WORM check.

**S3. Signature enforcement**
- **Files:** `deploy/site-cell/values/kyverno.yaml`; `deploy/site-cell/policies/{verify-images,registry-only}.yaml`; `tools/hmstools/cell/signatures.py`.
- **Deliverable:**
  - Install Kyverno only after the cosign CLI has verified Kyverno's own images.
  - Override `resourceFilters` so only the `kyverno` namespace is excluded; kube-system is then checked.
  - `failurePolicy: Fail`.
  - Render the `verifyImages` policy with the host's public key: `ignoreTlog`, `ignoreSCT`, `mutateDigest`, `verifyDigest`, `required`, and `allowInsecureRegistry` (the registry is HTTP on the bridge; KA).
  - A validate rule that allows only images from the local registry.
  - Override every chart image. Disable the chart's hook jobs, or repoint them, if they render a Bitnami image.
  - `cell verify-running`: every container's image digest is in the signed lock and verifies offline. That covers pods that started before the policy.
  - `cell signatures --evidence`: SIG-01 to SIG-07 (section 4.3).
- **Tests:**
  - unit tests: the rendered policy holds the required flags and the key; the denial-message parser; set comparison in `verify-running`;
  - in WSL: the record.

**S4. PostgreSQL and the failover tests**
- **Files:**
  - `deploy/helm/hms-cell/{Chart.yaml, values.yaml, values-lite.yaml, values-dev.yaml}`;
  - `deploy/helm/hms-cell/templates/{postgres-cluster.yaml, postgres-databases.yaml, postgres-nodeport.yaml}`;
  - `deploy/site-cell/values/cloudnative-pg.yaml`;
  - `tools/hmstools/cell/{pgwire.py, probe.py, verdict.py, chaos.py}`;
  - `tests/chaos/{README.md, scenarios/node-kill.yaml, scenarios/db-failover.yaml}`.
- **Deliverable:**
  - The CNPG operator: 2 replicas, with `NoExecute` tolerations of 15 s for `not-ready` and `unreachable`. Kyverno gets the same tolerations.
  - The `Cluster` from section 2.1.
  - A primary-only NodePort service on 30432: our own selector, `cnpg.io/cluster=hms-pg` plus the primary role label (check the label name on the pinned version).
  - The probe, the verdict and the scenarios in section 4.
  - HAZ-0028 controls move to `implemented`.
- **Tests:**
  - `pgwire` against a fake server: SCRAM-SHA-256, notice capture, error classes;
  - the probe's classification;
  - planted failures that must give FAIL: a lost acknowledged write; an `ack_local_only` write; an acknowledgement inside the two-node window; an empty sync-standby sample; two primaries;
  - the RTO calculation;
  - the scenario engine run with fake Docker, Kubernetes and clock drivers.

**S5. The object store in the cell**
- **Files:** `templates/seaweedfs.yaml`. `cell worm --cell lite` reads its credentials from `HMS_CELL_HOME`; `worm.py` is unchanged.
- **Deliverable:**
  - The WORM test against the cell's NodePort.
  - `--recheck` after deleting the pod, after killing its node, and after R1.
  - R1, now with PostgreSQL convergence and the WORM recheck.
- **Tests:** the existing WORM unit tests; restart orchestration with fakes.

**S6. The other components**
- **Files:**
  - `deploy/site-cell/values/{strimzi,temporal,openfga,opentelemetry-collector}.yaml`, each with a `.dev.yaml`;
  - `deploy/site-cell/keycloak-operator.yaml` (URL, tag and SHA-256; fetched into `HMS_CELL_HOME`);
  - `templates/{kafka,keycloak,valkey,networkpolicies,otel-allowlist}.yaml`.
- **Image overrides:**
  - Strimzi: `STRIMZI_KAFKA_IMAGES` and the default image variables;
  - CNPG: the operand image;
  - Keycloak: `RELATED_IMAGE_KEYCLOAK`;
  - Temporal: server and admin-tools.
- **Tests: chart rendering** with `helm template` for both profiles:
  - every image is in the lock;
  - no image is from Bitnami;
  - PostgreSQL has required anti-affinity and the sync settings;
  - every container has requests and limits.

**S7. One command, smoke test, footprint**
- **Files:** `tools/hmstools/cell/{up.py, smoke.py, footprint.py}`; `tools/hmstools/doctor/checks.py`; `docs/runbooks/dev-cell.md`.
- **`cell up --profile lite --evidence`** runs these phases in order:
  1. preflight (`doctor --tier cell`: memory, disk, tools, inotify, ports);
  2. registry;
  3. images;
  4. k3d;
  5. Kyverno and the policies;
  6. the operators;
  7. the upstream charts and `hms-cell`;
  8. readiness waits;
  9. `verify-running`;
  10. smoke test;
  11. footprint.
- **Other commands:** `cell down [--all]`, and `cell check` (which the CI uses).
- **Smoke checks:**
  - the API and three Ready nodes with fixed addresses;
  - every running image signed;
  - PostgreSQL: three of three instances ready; `ANY 1` naming both standbys; `synchronous_commit=on`; two `quorum` rows in `pg_stat_replication`; a write and read round trip; `pg_trgm` available;
  - Kafka: produce and consume through a Job that uses the Kafka image;
  - Temporal: `operator cluster health` returns SERVING;
  - Keycloak: its OIDC discovery URL answers 200;
  - OpenFGA: health check, store, model and a check call;
  - Valkey: PING, SET and GET; `maxmemory`;
  - the object store: WORM W01–W11;
  - OpenTelemetry: a span is accepted, and an attribute not on the allowlist is absent from the exporter output [P];
  - egress: default-deny holds — TCP to 1.1.1.1:443 from `hms-app` fails, while in-cell DNS and PostgreSQL work (§6.8 item 11; OQ-098).
- **Footprint** goes to `perf/`.
- **Doctor:**
  - a new `--tier cell`;
  - the lite RAM threshold set from the measurement (OQ-094).
- **Tests:**
  - unit tests for each check evaluator and the parsers;
  - in WSL, from a clean start: `cell down --all && cell up --profile lite --evidence`.

**S8. Compose stack**
- **Files:** `deploy/compose/{compose.yaml, config/*, README.md}`; `tools/hmstools/cell/compose.py`.
- **Deliverable:**
  - The same digests from the local registry, each verified with cosign before `up`.
  - Components:
    - PostgreSQL (the CNPG image, one container);
    - Kafka: the Strimzi image with the command replaced by a KRaft single-node start. Fallback: `apache/kafka` at the same version, recorded as a deviation;
    - Temporal (server, plus an admin-tools schema job);
    - Keycloak in `start-dev`;
    - OpenFGA (`migrate`, then `run`);
    - Valkey, SeaweedFS and the OpenTelemetry collector.
  - `cell compose up|down|smoke` (cell `compose`). It refuses to start while the cell is running.
  - The WORM record of record that ADR-029 promised.

**S9. CI wiring and Testcontainers**
- **Files:**
  - `tools/hmstools/ci/{tiers.py, runner.py, __main__.py, tests/test_ci.py}`;
  - `backend/gradle/libs.versions.toml`: Testcontainers 2.0.5 and PostgreSQL JDBC 42.7.13 are already in ADR-002's set;
  - `backend/platform/testing/src/integrationTest/.../ContainerEngineSmokeTest.kt`: the pinned PostgreSQL image, `select 1`, and server version ≥ 18;
  - `testcontainers.properties`: Ryuk is mirrored and pinned.
- **Deliverable:**
  - The run's cell reaches the steps through `Context`.
  - Every cell step FAILs when the run's cell is `none`.
  - The steps listed in section 5.

**S10. Dev-cell profile and Argo CD in pull mode**
- **Files:** `deploy/site-cell/k3d/dev.k3d.yaml`; `values-dev.yaml`; `deploy/site-cell/argocd/**` (pinned core manifests, an `AppProject`, and `Application`s that pull `hms-cell` from the local OCI chart registry).
- **Deliverable:**
  - Rendered and server-side dry-run validated on the lite cell where its CRDs exist.
  - One optional run of Argo CD core on the lite cell, only if the measured headroom is at least 1 GiB (labelled lite).
  - Otherwise a KA records that it has never run.

**S11. Close-out** (integrator)
- **Documents:**
  - ADR-030 accepted;
  - ADR-002's "Not yet pinned" paragraph replaced with the pinned set;
  - the scorecard rows;
  - COMMANDS.md §7 (cell and compose);
  - `docs/runbooks/{dev-cell,chaos-drills}.md`;
  - the KA, OQ, DN and hazard entries; WORK-PACKAGES; STATUS; the CHANGELOG.
- **Records of record** from the WSL clone at the final SHA:
  - fast, merge, nightly `--cell lite` and release (each FAILs overall; the WP-0.2 steps PASS);
  - doctor;
  - a clean `cell up` with the smoke test;
  - signatures, chaos and footprint.
- **Then hand over for review.**

## 4. Exit tests and evidence

### 4.1 What "committed" means, and how the probe counts it

**What a commit waits for.** CNPG renders the replication settings as:
- `synchronous_standby_names = 'ANY 1 ("hms-pg-2","hms-pg-3")'`, naming both standbys;
- `synchronous_commit = on`.

So a commit returns only after its WAL is flushed on the primary and on at least one standby. `dataDurability: required` keeps absent standbys in that list. The list never empties, so commits wait rather than degrade to asynchronous.

**When a write counts as acknowledged:** the autocommit INSERT returned CommandComplete, *and* no "canceling wait for synchronous replication" notice arrived.

**Why the notice matters.** PostgreSQL returns success with that warning when a synchronous wait is cancelled, for example by `statement_timeout` or a cancel request. Such a commit is on the primary only.
- The probe never cancels a query and never sets `statement_timeout`.
- If the warning appears anyway, the write is classed `ack_local_only`, and any such write fails the test.
- WP-0.3 inherits this rule as CTRL-0028-4.

**Write classes:** `ack`, `ack_local_only`, `not_sent` (no connection was made) and `ambiguous` (sent, then the connection broke).

**The probe.**
- **Client.** `pgwire.py` is a standard-library PostgreSQL client in the style of `s3.py`. It runs on the WSL host and reaches the primary through the NodePort service, trying the three fixed node addresses in turn. TCP keepalive and a 5 s user timeout break dead connections; it never cancels.
- **Writers.** 8 threads insert `(run_id, writer, seq)` into `hms_chaos.probe`, about 20 per second each, with `RETURNING inet_server_addr()`. Each write is logged as a JSON line: send time, reply time, class and server.
- **Monitor.** Every second it reads, on the primary: `synchronous_standby_names`, `synchronous_commit` and `pg_stat_replication`.
- **Topology sampler.** Every second, while the API answers, it reads `status.currentPrimary`, node readiness and pod placement.

**The verdict**, computed after recovery from all probe rows on the new primary, and from every instance once replay has caught up (`kubectl exec psql`: count and a digest of the ordered keys):
- **RPO 0:** acknowledged writes minus rows present must be empty; there must be no `ack_local_only` writes and no phantom rows. Ambiguous writes found and not found are reported, never failed. The record also gives a time-based RPO: zero, or the age of the oldest missing acknowledgement at the moment of the kill.
- **RTO (writes):** from the kill to the first `ack` sent after it. It passes at 300 s or less, the §16.2/§16.4 engineering figure, cited in the scenario file. Also recorded: the time to NotReady, to the primary change, and to three of three ready after the node returns.
- **No split brain:** two server addresses never acknowledge writes in overlapping windows.
- **Convergence:** every instance has the same count and digest.
- **Two-node windows:** no `ack` sent from 1 s after the second kill until the restore, and every monitor sample shows `ANY 1` over both standbys with `synchronous_commit=on`.
- **Host pressure:** swap use and the `/proc/pressure/{memory,io}` maxima are recorded. A run with memory pressure above 10% (avg10) [P] is marked "disturbed", and is never counted as a pass.

### 4.2 Scenarios

**Common steps.** Node kills hold for 120 s [P]; two-node windows hold for 90 s [P]. The node's restart policy is set to `no` for the kill and restored after `docker start`.

**Pass conditions.** Each scenario's pass condition includes the RPO 0, no-split-brain and convergence checks in section 4.1. The table adds what is specific to each scenario.

| ID | Scenario | Pass condition (beyond the common checks) |
|---|---|---|
| N1 | `docker kill` the node holding the primary | A standby is promoted; write RTO ≤300 s |
| N2 | Kill each standby's node | Writes continue; the longest gap is reported |
| N3 | Kill each node in turn | Covers every placement of etcd leader, operator and Kyverno |
| P1 | Force-delete the primary pod | As N1 |
| P2 | Isolate the primary (`docker network disconnect`, then reconnect with `--ip` set to its fixed address) | The old primary's ambiguous writes are rewound away |
| Q1 | Fence both standbys (CNPG fencing annotation; the API stays up) | No `ack` in the window; every sample unchanged; after unfencing, the blocked commits complete |
| Q2 | Kill both standby nodes | No `ack` in the window; no promotion |
| Q3 | Kill the primary's node and one standby's node | No `ack`; no stale promotion |
| R1 | Kill all three nodes; start them in reverse order | API ready ≤300 s [P]; addresses unchanged; convergence; WORM recheck |

### 4.3 Signature and WORM tests

**Signature tests.**

| ID | Image or check | Expected result |
|---|---|---|
| SIG-01 | Unsigned image (built locally `FROM scratch`, pushed to the local registry) | Refused by admission |
| SIG-02 | Image signed with a throwaway key | Refused |
| SIG-03 | `docker.io/library/busybox` | Refused by the registry-only rule, with no network fetch |
| SIG-04 | Tag moved to unsigned content | Refused by tag; allowed by the signed digest |
| SIG-05 | Same image signed with the cell key (positive control) | Allowed under `--dry-run=server`, and rewritten to the digest |
| SIG-06 | Every running image | `verify-running` passes |
| SIG-07 | `cosign verify` on an `--internal` Docker network that holds only the registry | Verification succeeds with no internet route: this shows it works offline |

**WORM tests.** W01–W11 from ADR-029, and the recheck after each restart path (pod deletion, node kill, R1).

### 4.4 Evidence records

Names follow the README: `<date>-<test>-<shortsha>[-dirty].json`. Each record names its cell (`lite`) and standing, the host, the git state and the hash of the pin set. A rerun never overwrites an earlier record: add `-2`, `-3` [P].

- `ci/<date>-<tier>-<sha>.json` (cell `lite`)
- `cell/<date>-images-<sha>.json`
- `cell/<date>-cell-up-<sha>.json`: phase durations, digests and `verify-running` results
- `cell/<date>-smoke-<sha>.json`
- `cell/<date>-signature-enforcement-<sha>.json`
- `cell/<date>-egress-<sha>.json`
- `cell/<date>-worm-seaweedfs-4.48-<sha>.json` and `cell/<date>-worm-recheck-seaweedfs-4.48-<sha>.json`
- `cell/<date>-compose-smoke-<sha>.json`
- `chaos/<date>-node-kill-<sha>.json`, `chaos/<date>-db-failover-<sha>.json` and `chaos/<date>-cell-restart-<sha>.json`
- `perf/<date>-lite-cell-footprint-<sha>.json`: idle, smoke peak and chaos peak, plus disk and C: free
- `doctor/<date>-<sha>.{txt,json}`

### 4.5 Tests by slice

| Test | Slice | Where it runs |
|---|---|---|
| Unit tests for every new module, using fakes | S1–S9 | fast (`python-unit-tests`) |
| `cell lint` | S1 | fast (new `cell-lint` step) |
| Chart rendering (image set, no Bitnami, anti-affinity, sync settings, resources) | S6, S10 | merge `cell-charts`; release `helm-charts` |
| Testcontainers smoke test | S9 | merge `integration-tests` |
| Smoke test, SIG-06 and WORM | S7 | nightly `cell-check` |
| N1–N3 | S4 | nightly `chaos-node-kill` |
| P1, P2, Q1–Q3 | S4 | nightly `chaos-db-failover` |
| R1 with the WORM recheck | S2, S5 | nightly `chaos-restart` |
| SIG-01 to SIG-07, egress, footprint, compose smoke | S3, S7, S8 | on demand, with records |

## 5. CI tier wiring

**Fast tier:**
- add `cell-lint`.

**Merge tier:**
- `integration-tests` becomes built: `sh backend/gradlew -p backend integrationTest`. Its owner text becomes "WP-0.2 harness; tests WP-0.3".
- New `cell-charts` [P]: Helm lint and template, and the image-set test. Needs Helm, so WSL only.

**Nightly tier:**
- `cell-check` becomes built.
- The single `chaos` row is split:

| Step | State after WP-0.2 |
|---|---|
| `chaos-node-kill` | Built |
| `chaos-db-failover` | Built |
| `chaos-restart` | Built |
| `chaos-broker-loss` | NOT-BUILT, WP-0.3 [P]: needs the event flow; on lite, a single broker only shows a restart |
| `chaos-wan-cut` | NOT-BUILT, WP-1.13 (in its exit criteria) |
| `chaos-power-cut` | NOT-BUILT, WP-1.13 (in its exit criteria) |
| `chaos-clock-skew` | NOT-BUILT, WP-1.13 [P], ADR-026 (k3d nodes share one clock) |
| `chaos-slow-terminology` | NOT-BUILT, WP-1.1 (§18.7 lists it) |
| `chaos-alarms` ("assert alarms ≤5 min") | NOT-BUILT, WP-0.3 [P] |

**Nightly step order with a cell [P], until S7's measurement shows that the cell and the fast tier fit together:**
1. `cell-park` (stops the nodes);
2. the fast steps;
3. `build-daemons-stop` (`gradlew --stop`);
4. `cell-start`;
5. the cell steps.

This also exercises a full restart every night.

**Release tier:** `cell-check` and `helm-charts` become built. `signed-images` and `cosign-signatures` stay with WP-0.9.

**Tier totals.** Merge, nightly and release still fail overall (KA-003), but each WP-0.2 step must PASS.

## 6. New dependencies, pins and licences

**Version rule (§4.1).** Pin the newest generally available release whose line has had at least one patch release and that its consumers support. Re-check every pin in S1 with `helm search repo --versions` and the release dates, then record it in ADR-002 and the scorecard.

**Provisional pins** (registry listings of 18 October):

| Component | Pin | Note |
|---|---|---|
| k3s | v1.37.1-k3s1 | v1.36.5-k3s1 if an operator's support matrix stops at 1.36 |
| CNPG operator | 1.30.1 (chart 0.29.1) | — |
| PostgreSQL | newest 18.x CNPG `minimal-trixie` image | — |
| Strimzi | 1.0.1 | Versions 1.1 to 1.3 have no patch release yet |
| Kafka | newest 4.x that Strimzi 1.0.1 supports | — |
| Temporal | server 1.31.2 (chart 1.6.0) | 1.32 has no patch release |
| Keycloak and its Operator | 26.8.1 | — |
| OpenFGA | v1.18.3 (chart 0.3.12) | 1.19 to 1.22 have no patch releases; OQ-125 |
| Valkey | 9.1.2 | — |
| SeaweedFS | 4.48 | ADR-029 |
| OpenTelemetry collector | chart 0.175.1 (collector 0.161.0) | — |
| Distribution (registry) | 3.1.2 | — |
| cosign | 3.1.3, or 2.6.5 | S1 spike decides |
| Kyverno, Argo CD, crane | resolved in S1 | — |

| Dependency | Licence | Ships? | Scorecard row |
|---|---|---|---|
| k3s (with containerd, runc, flannel, CoreDNS, local-path, kube-router netpol) | Apache-2.0 | yes | yes |
| CloudNativePG; PostgreSQL | Apache-2.0; PostgreSQL | yes | yes |
| Strimzi; Apache Kafka | Apache-2.0 | yes | yes |
| Temporal server, admin-tools, chart | MIT | yes | yes (single corporate steward; ADR-010 fork note) |
| Keycloak and Keycloak Operator | Apache-2.0 | yes | yes |
| OpenFGA | Apache-2.0 | yes | yes |
| Valkey | BSD-3-Clause | yes | yes |
| OpenTelemetry Collector | Apache-2.0 | yes | yes |
| Kyverno | Apache-2.0 | yes | yes (ADR-030) |
| Argo CD | Apache-2.0 | yes (dev and on-site) | yes |
| CNCF Distribution | Apache-2.0 | dev and CI now | yes |
| cosign, crane, k3d (and its proxy and tools images), Testcontainers Ryuk | Apache-2.0; Apache-2.0; MIT; MIT | build only | cosign only |
| Testcontainers Java; PostgreSQL JDBC | MIT; BSD-2-Clause | test now | already in ADR-002 |

**Licence conditions:**
- **Conditional parts of images.** These must be in the licence register before the WP-0.9 scan (KA-019):
  - OpenJDK inside the Kafka, Strimzi and Keycloak images (`openjdk-runtime` rule);
  - OS packages in base images. Keycloak and Strimzi use Red Hat UBI; OQ-133 reads UBI as allowed under §4.3's OS-packages clause.
- **No new Python package.** The probe uses only the standard library. psycopg (LGPL-3.0) is the fallback only.

## 7. What this host can and cannot do

**WSL, 10 GB:**
- **Can:** everything in sections 3 and 4 on the lite cell, the compose stack, Testcontainers, and footprint measurement.
- **Cannot:** run the cell beside other heavy jobs, so jobs are serialised.

**Windows checkout:**
- **Can:** unit tests and `cell lint`.
- **Cannot:** anything that needs Docker (none there), so no cell, compose or Testcontainers runs.

**Has to wait:**
- the dev cell as a whole, three-broker Kafka, and Argo CD in steady state (32 GB; DN-005 options 2 and 3);
- reference-cell evidence (DN-009);
- hardware fault modes, clock skew between nodes and WAN cut (WP-1.13).

## 8. Fastest path to the exit criteria

1. S0, S1 and S2 (the substrate, with R1 passing).
2. S3: the "unsigned image refused" evidence.
3. S4: the node-kill and two-node evidence; criterion 3 is shown, pending DN-005.
4. S5: WORM in the cell, and after restarts (criterion 4).
5. S6 and S7: a clean `cell up --profile lite --evidence` with the smoke test (criteria 1 and 2).

**Rules for tonight:**
- Start each cell session only after the other session's Gradle job has finished.
- Keep the keeper process running.
- Stop pulling if C: falls below 15 GiB free.

## 9. Decisions and conflicts

**For DECISIONS-NEEDED:**
- **DN-005:** the update in section 2.4.
- **DN-015, WSL idle termination [HUMAN].**
  - Blocks: nothing now; it later affects how reliable nightly runs are.
  - Default in use: the keeper process, plus fixed node addresses.
  - Options: change the VM and distribution idle settings in `.wslconfig` (check Microsoft's current key names), or keep the default.
- **DN-016, `fs.inotify.max_user_instances` is 128 [HUMAN].** The command is `sysctl` to 512, persisted in `/etc/sysctl.d/`. Default: continue, and stop if k3s logs "too many open files".
- **DN-013:** add the measured disk figures; `cell up` enforces the 15 GiB stop line.

**For OPEN-QUESTIONS, section (g):**
- **OQ-122:** the topology — three k3s servers with fixed addresses, the load balancer kept, and `--servers-memory`.
- **OQ-123:** Kyverno, offline, kube-system included, and a registry-only rule.
- **OQ-124:** mirroring by digest with crane; the local path rule; `HMS_CELL_HOME`.
- **OQ-125:** how the pins were read: chart version against app version; the strict reading for Strimzi and OpenFGA; k3s 1.37 against the support matrices.
- **OQ-126:** what "acknowledged" means; the write classes; the RTO bound, citing §16.2.
- **OQ-127:** the split of the chaos step and the owners of each part.
- **OQ-128:** parking the cell in the nightly tier.
- **OQ-129:** the evidence directories, and the qualifier inside `<test>`.
- **OQ-130:** the cosign passphrase comes from `HMS_COSIGN_PASSWORD`.
- **OQ-131:** the OpenTelemetry distribution and its allowlist.
- **OQ-132:** the egress test in WP-0.2 (OQ-098).
- **OQ-133:** UBI base images.
- **OQ-134:** the new `deploy/compose/` directory, which §6.1 does not list.
- **Status updates:** OQ-084 (evidence gathered, the decision is DN-005's), OQ-094 (the measured threshold) and OQ-104 (the scorecard file now exists).

**For KNOWN-ANOMALIES:**

| ID | Anomaly |
|---|---|
| KA-014 | The lite cell shares one VM's kernel, disk, clock and power; `docker kill` keeps the page cache |
| KA-015 | The dev profile and Argo CD have never run as a whole |
| KA-016 | Chaos steps that are NOT-BUILT, each with its owner |
| KA-017 | OpenTelemetry exports to a local sink; the canary scan comes in WP-0.4 |
| KA-018 | The compose stack verifies signatures only at start |
| KA-019 | Image contents are not scanned for licences or vulnerabilities until WP-0.9 |
| KA-020 | The registry uses HTTP on the bridge |
| KA-021 | While Kyverno is down, pod creation is blocked: fail-closed by design, and measured |
| KA-022 | Every WSL termination is a whole-cell power cut |
| KA-023 | The commit-cancel rule is planned for the access layer (CTRL-0028-4) |
| KA-003 | Updated with the steps WP-0.2 builds |

**For the hazard log:**
- **HAZ-0028** (H6, H7; the first H7 entry, for KA-008): "Committed data lost, or writes accepted unsafely, after losing cell nodes". Controls:
  - CTRL-0028-1: quorum synchronous replication;
  - CTRL-0028-2: never degrade to asynchronous;
  - CTRL-0028-3: fixed addresses and restart survival;
  - CTRL-0028-4: no commit cancellation in the access layer (WP-0.3);
  - CTRL-0028-5: the nightly chaos suite.
  - `planned_verification`: `ChaosTest:node-kill-primary`, `-standby`, `-each`, `primary-pod-kill`, `primary-partition`, `standbys-fenced-writes-block`, `two-node-loss-writes-stop` and `cell-restart-any-order`.
  - The controls stay `implemented` until DN-005 decides whether lite evidence counts.
- **HAZ-0029** (H6, H14): a locked object deleted, or its retention shortened. Verification: `ContractTest:worm-W01-W11` and `ChaosTest:worm-recheck-after-restart`.

**Conflicts between the plan of record and the workspace:**
- §5.1's lite cell has two PostgreSQL instances, but the exit criterion needs three (DN-005).
- The evidence README has no `cell/` directory, and the cell records add a label (fixed in S0).
- `tools/ci/run --cell` does not accept `compose`, while `evidence.CELLS` does.
- The single nightly `chaos` row bundles drills that WP-1.13 owns. §18.7 adds partition and a slow terminology service, which §19.1 does not list.
- `tiers.py` gives `integration-tests` to WP-0.3, while `WP-0.2.md` says WP-0.2 makes it runnable.
- §4.1 says to pin "in the Helm charts", but the Keycloak Operator has no upstream chart and Valkey has only official images: one is pinned by manifest checksum, the other by our template.
- ADR-002's "Not yet pinned" paragraph is filled in. This records versions; it does not change the decision.
- §4.3 says the key is "git-ignored"; the plan keeps it outside the repository, which is stricter.
- ADR-029's guard says "dev cell"; on this host it runs on the lite cell.
- The doctor reports "no cell profile" at 9.7 GiB until OQ-094 changes the threshold.

### Critical Files for Implementation
- C:\Users\Surface\.t3\projects\hospitalmanagementsystem\tools\hmstools\ci\tiers.py
- C:\Users\Surface\.t3\projects\hospitalmanagementsystem\tools\hmstools\cell\__main__.py (on `wp/0.2-environments`)
- C:\Users\Surface\.t3\projects\hospitalmanagementsystem\tools\hmstools\cell\evidence.py (on `wp/0.2-environments`)
- C:\Users\Surface\.t3\projects\hospitalmanagementsystem\tools\hmstools\doctor\checks.py
- C:\Users\Surface\.t3\projects\hospitalmanagementsystem\docs\program\DECISIONS-NEEDED.md
