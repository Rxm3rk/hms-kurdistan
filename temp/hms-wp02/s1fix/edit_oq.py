"""One-off edits of OPEN-QUESTIONS.md for the S1 review fixes (run from the worktree root)."""
from pathlib import Path

p = Path("docs/program/OPEN-QUESTIONS.md")
s = p.read_bytes().decode("utf-8")
assert "\r\n" not in s


def rep(old, new):
    global s
    assert s.count(old) == 1, (old[:90], s.count(old))
    s = s.replace(old, new)


# OQ-123: update line
rep("""and `cell verify-running` checks every running container, including pods that started before the policy.
- **Status:** open

### OQ-124""", """and `cell verify-running` checks every running container, including pods that started before the policy.
- **Update (19 October 2026, slice S1):** the policy kind changes. OQ-135's spike showed that Kyverno 1.19.1's `ClusterPolicy` `verifyImages` finds no signature in the bundle cosign 3.1.3 writes, while an `ImageValidatingPolicy` (`policies.kyverno.io/v1`) verifies it offline, also for images that `tools/hms cell images sign` signed. S3 writes an `ImageValidatingPolicy` and maps each `ClusterPolicy` field named above to its counterpart (OQ-135). Kyverno is installed from its release manifest, not its chart (OQ-137).
- **Status:** open

### OQ-124""")

# OQ-125: update line
rep("""each is re-checked before it is pinned and recorded in ADR-002 and the dependency scorecard.
- **Status:** open

### OQ-126""", """each is re-checked before it is pinned and recorded in ADR-002 and the dependency scorecard.
- **Update (19 October 2026, slice S1):** k3s is pinned at v1.35.9+k3s1, neither of the two versions named above: Kyverno 1.19 supports Kubernetes 1.33 to 1.35 only, so 1.35 is the newest version every operator supports (OQ-136). The OpenTelemetry Collector is read strictly as well: 0.163.1, the 0.163 line's patch release, not OQ-107's reading for projects without patch releases (OQ-136).
- **Status:** open

### OQ-126""")

# OQ-135: production invocation checked
rep("""- **Limits:** the spike ran the Kyverno CLI, not the admission controller;""",
    """- **The production invocation (19 October 2026, after the S1 review):** in the spike, image B was signed twice, once with `--use-signing-config=false` added and once without it, so the spike alone did not show which invocation Kyverno had verified. `tools/hms cell images sign` uses the second form only (`signing.py` rejects `--use-signing-config`). On the WSL build host, the Kyverno 1.19.1 CLI (`kyverno apply --registry`, on the `--internal` network `hms-cell-offline`, with an `ImageValidatingPolicy` as above holding the cell's public key) passed the `k3s-pause` and `valkey` images that `cell images sign` had signed ("pass: 1, fail: 0" each), failed `k3s-pause` under a throwaway key, and failed the same digest under a repository the cell key never signed ("failed image signature verification", "pass: 0, fail: 1" each). Not evidence of record (scratch run, `/tmp/hms-s1/kyverno-prod`).
- **Limits:** the spike ran the Kyverno CLI, not the admission controller;""")

# OQ-136: OTel bullet
rep("""  - **OpenTelemetry Collector 0.162.0** (chart 0.176.0), not 0.161.0 (chart 0.175.1). Neither 0.161 nor 0.162 has a patch release; 0.163.1 (16 October 2026) is three days old and no chart ships 0.163 yet, so the OQ-107 reading (the newest release at least 14 days old) gives 0.162.0. The image is the `k8s` distribution""",
    """  - **OpenTelemetry Collector 0.163.1** (chart 0.176.0, which ships 0.162.0, with its image tag set, as for Temporal), not 0.161.0 (chart 0.175.1). The project does publish patch releases, so OQ-107's reading for projects without them does not apply: 0.163.1 (16 October 2026) is the 0.163 line's patch release, and no line from 0.156 to 0.162 has one, so 0.163.1 is what §4.1's rule gives. A first draft of S1 pinned 0.162.0 under OQ-107; the S1 review found that this stretched OQ-107. Note for the lead: 0.163.1 came out two hours after 0.163.0 and only repaired the release workflow ("fix: give workflows permission to read actions"); 0.163.0's images were never published (the registry lists only 0.163.0 nightlies), so the patch adds no fixes over 0.163.0. Reading 0.163.1 as a line's first release instead would leave no pinnable OpenTelemetry release under §4.1 as written. The image is the `k8s` distribution""")

# OQ-136: Kyverno via the release manifest; dates
rep("""  - Resolved for the first time: **Kyverno 1.19.1** (chart 3.9.1; 1.19.2 has release candidates only),""",
    """  - Resolved for the first time: **Kyverno 1.19.1** (its release manifest `install.yaml`, with the SHA-256 that its GitHub release lists for the asset, not chart 3.9.1, OQ-137; 1.19.2 has release candidates only),""")
rep("""  - Unchanged: CloudNativePG 1.30.1 (chart 0.29.1), Strimzi 1.0.1, Keycloak and its Operator 26.8.1, OpenFGA v1.18.3 (chart 0.3.12), Valkey 9.1.2,""",
    """  - Unchanged: CloudNativePG 1.30.1 (chart 0.29.1), Strimzi 1.0.1, Keycloak and its Operator 26.8.1, OpenFGA v1.18.3 (its image; no chart, OQ-137), Valkey 9.1.2,""")

# OQ-136: published digest paragraph
rep("""- **How "published digest" is read:** none of these publishers lists image digests in its release notes (checked for cosign and crane), so an image is pinned by the digest its publisher's registry served for the tag on 19 October 2026: the linux/amd64 manifest (what the cell runs and signs) and the multi-platform index it came from. Each chart's SHA-256 equals the digest in the publisher's Helm repository index (all seven checked). The Keycloak Operator manifests have no published checksum: they are fetched at the commit of tag 26.8.1 and their SHA-256 is recorded.""",
    """- **How "published digest" is read:** the release notes of cosign and crane list no image digest; the other publishers' release notes were not read for digests. An image is therefore pinned by the digest its publisher's registry served for the tag on 19 October 2026: the linux/amd64 manifest (what the cell runs and signs) and the multi-platform index it came from; for all 27 image and tool pins the index lists the pinned linux/amd64 digest (pinned crane, WSL build host). That is trust on first use, so after the S1 review each pin was also checked for its publisher's own signature with the pinned cosign (verification only, on the WSL build host on 19 October 2026; scratch output `/tmp/hms-s1/upstream-sigs3.txt`, not evidence of record):
  - **Signed by the publisher, verified (12 of 27):** CloudNativePG 1.30.1 and Kyverno 1.19.1 (its admission image, its init image and the CLI), OpenFGA v1.18.3, SeaweedFS 4.48, the OpenTelemetry Collector 0.163.1 and Argo CD v3.5.5, each by a keyless certificate for its own repository's GitHub workflow at the release tag; CloudNativePG's PostgreSQL 18.6 image (by a `cloudnative-pg/postgres-containers` workflow) and Strimzi's operator and Kafka images (by a `strimzi/strimzi-kafka-operator` workflow, not at the tag); cosign by `keyless@projectsigstore.iam.gserviceaccount.com`. Kyverno keeps its signatures in `ghcr.io/kyverno/signatures`.
  - **No publisher signature found (15 of 27):** k3s and its system images (pause, CoreDNS, local-path-provisioner, BusyBox), k3d's proxy and tools images, CNCF Distribution, Temporal (server, admin-tools, UI), Keycloak and its Operator, Valkey and crane: `cosign verify` reported "no signatures found". For these the pin rests on the registry's answer on 19 October 2026 alone (KA-019).
- Each chart's SHA-256 equals the digest in the publisher's Helm repository index (all five checked; the two dropped charts were checked too). The Kyverno manifest's SHA-256 equals the digest GitHub lists for the release asset (its `checksums.txt` covers only the CLI archives). The Keycloak Operator manifests have no published checksum: they are fetched at the commit of tag 26.8.1 and their SHA-256 is recorded. Each image and tool pin records the date the pinned version was released (`released`), and `cell lint` fails without it.""")

# OQ-137: update line
rep("""Proposed [P]: option 2, the strict reading, carried out in S3 (Kyverno) and S6 (OpenFGA). The charts stay pinned in `cell.yaml` until then; `cell lint` checks `cell.yaml` only, not the contents of a chart.""",
    """Proposed [P]: option 2, the strict reading, carried out in S3 (Kyverno) and S6 (OpenFGA). The charts stay pinned in `cell.yaml` until then; `cell lint` checks `cell.yaml` only, not the contents of a chart.
- **Update (19 October 2026, after the S1 review):** the default is now in the pins rather than deferred, because the review found that keeping the two charts pinned made `cell.yaml`'s "no Bitnami chart" claim untrue. `cell.yaml` pins Kyverno's release manifest (`install.yaml` of v1.19.1 with its SHA-256) instead of chart 3.9.1, and no OpenFGA chart (its image stays pinned; S6 writes the template). The Kyverno CLI moves to the build-only tools, and the readiness-checker image, used only by the chart's test hook, is no longer pinned. `tools/hms cell charts fetch|verify` checks what each chart archive and manifest holds: it fails on a Bitnami chart packaged at any depth (chart metadata naming the vendor) or a Bitnami image named in a chart's values or templates or in a manifest, and counts other mentions without failing (Argo CD's README links a `bitnami-labs` project; a Temporal template credits a Bitnami helper). On the WSL build host it passed the five pinned charts and four manifest files, and found 13 errors in Kyverno 3.9.1 and 27 in OpenFGA 0.3.12. If the lead chooses option 1 or 3, the charts return to `cell.yaml` and that check needs an exception for disabled subcharts.""")

p.write_bytes(s.encode("utf-8"))
print("ok")
