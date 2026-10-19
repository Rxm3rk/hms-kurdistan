"""One-off edit of deploy/site-cell/cell.yaml for the S1 review fixes (run from the worktree root)."""
import re
from pathlib import Path

p = Path("deploy/site-cell/cell.yaml")
s = p.read_bytes().decode("utf-8")
assert "\r\n" not in s


def rep(old, new, count=1):
    global s
    assert s.count(old) == count, (old[:80], s.count(old))
    s = s.replace(old, new)


rep("""#   Pods reference <registry host>/<local>@<digest>.
# - tools: build-only images the cell tooling runs as containers, pulled by digest from the publisher.
# - charts: each pinned by version and the SHA-256 of its .tgz, which equals the digest in the publisher's
#   Helm repository index.
# - manifests: release manifests that have no chart, pinned by commit and SHA-256 (no checksum is published).
# 'tools/hms cell lint' (fast tier) checks this file: every digest and checksum present and well formed, every
# licence against tools/licence/policy.yaml and the licence register, no image or chart from the vendor whose
# free images §4.1 excludes, one local path per image, and each profile's memory budget.
""", """#   Pods reference <registry host>/<local>@<digest>. 'released' is the date the publisher released that
#   version (its release page), or, where it has none, the creation date in the image's configuration (noted).
# - tools: build-only images the cell tooling runs as containers, pulled by digest from the publisher.
# - charts: each pinned by version and the SHA-256 of its .tgz, which equals the digest in the publisher's
#   Helm repository index. A chart that packages a chart of the vendor below is not pinned (OQ-137).
# - manifests: release manifests used instead of a chart. Each is pinned either by 'commit' (files fetched at
#   that commit; no checksum is published, so the SHA-256 is recorded) or by 'release' (release assets, whose
#   SHA-256 equals the digest the publisher's release page lists for the asset).
# 'tools/hms cell lint' (fast tier) checks this file: every digest, checksum and date present and well formed,
# every licence against tools/licence/policy.yaml and the licence register, no image or chart from the vendor
# whose free images §4.1 excludes, one local path per image, and each profile's memory budget.
# 'tools/hms cell charts fetch|verify' downloads the charts and manifests into HMS_CELL_HOME, checks each
# against its SHA-256, and fails on a chart of that vendor packaged inside a chart, or an image of it named in a
# chart's values or templates or in a manifest.
""")

s2 = re.sub(r"  - name: openfga\n    repository: https://openfga.github.io/helm-charts\n.*?(?=  - name: opentelemetry-collector)",
            "", s, flags=re.S)
assert s2 != s
s = s2
s2 = re.sub(r"  - name: kyverno\n    repository: https://kyverno.github.io/kyverno/\n.*?(?=  - name: argo-cd)", "", s, flags=re.S)
assert s2 != s
s = s2
rep('''    note: "collector 0.162.0 (2026-09-29), the newest release at least 14 days old (OQ-107, OQ-136); the k8s distribution holds the redaction (allowlist), attributes, filter and transform processors and the debug exporter (OQ-131)"''',
    '''    note: "collector 0.163.1 (2026-10-16), the 0.163 line's patch release, set through the chart's image tag; the chart ships 0.162.0, whose line has no patch release (OQ-136). The k8s distribution holds the redaction (allowlist), attributes, filter and transform processors and the debug exporter (OQ-131)"''')

rep("""manifests:
  - name: keycloak-operator
    version: 26.8.1
    source: https://github.com/keycloak/keycloak-k8s-resources
    commit: 999a1d4e23b74eab7704426058b535a9e2a416e3   # tag 26.8.1
    profiles: [lite, dev]
""", """manifests:
  - name: kyverno
    version: v1.19.1
    source: https://github.com/kyverno/kyverno
    release: v1.19.1
    published: "2026-09-10"
    profiles: [lite, dev]
    images: [kyverno, kyverno-pre]
    note: "ADR-030. The release manifest instead of the chart, whose reports-server subchart packages a chart of the excluded vendor (OQ-137). S3 applies it without the background, cleanup and reports controllers' Deployments (ADR-030 turns them off), so their images are not pinned. The release's checksums.txt covers only the CLI archives; the SHA-256 is the digest GitHub lists for the asset"
    files:
      - url: https://github.com/kyverno/kyverno/releases/download/v1.19.1/install.yaml
        sha256: d3322cb346d3d42dd0f41e230b0d1d7bc5619960e1c36fdac4d9151d724b88e6
  - name: keycloak-operator
    version: 26.8.1
    source: https://github.com/keycloak/keycloak-k8s-resources
    commit: 999a1d4e23b74eab7704426058b535a9e2a416e3   # tag 26.8.1
    published: "2026-10-13"
    profiles: [lite, dev]
""")

s2 = re.sub(r"  - name: kyverno-cli\n.*?(?=  - name: cloudnative-pg\n)", "", s, flags=re.S)
assert s2 != s
s = s2

rep("""    upstream: docker.io/otel/opentelemetry-collector-k8s:0.162.0
    digest: sha256:87adfbde7aff1288d7da30cb0cfbe00d0785b40f3919b1b16b745f0e859f0125
    index_digest: sha256:ed6862e1506e11c08a0ec4cc7e1395eb5cf10e3acf2c2ba3846edc1b6b3916d6""",
    """    upstream: docker.io/otel/opentelemetry-collector-k8s:0.163.1
    digest: sha256:e8e86f8e05e767bad052c4ccfb49095f89bf24447810b806c4adbb3c95526396
    index_digest: sha256:5bf46de110fccacb2957bcc98909fb98cf8b07baa67027e38f61699db620649a""")

released = {
    "k3s": "2026-09-30", "k3s-pause": "2026-02-26", "k3s-coredns": "2026-08-19",
    "k3s-local-path-provisioner": "2026-08-05", "k3s-local-path-helper": "2024-09-27", "k3d-proxy": "2025-02-15",
    "k3d-tools": "2025-02-15", "registry": "2026-09-24", "kyverno": "2026-09-10", "kyverno-pre": "2026-09-10",
    "cloudnative-pg": "2026-09-23", "postgresql": "2026-08-13", "strimzi-operator": "2026-06-17",
    "kafka": "2026-06-17", "temporal-server": "2026-10-08", "temporal-admin-tools": "2026-10-08",
    "temporal-ui": "2026-09-11", "keycloak-operator": "2026-10-13", "keycloak": "2026-10-13",
    "openfga": "2026-08-05", "valkey": "2026-09-01", "seaweedfs": "2026-09-28", "otel-collector": "2026-10-16",
    "argocd": "2026-10-12",
}
notes = {
    "k3s-pause": "the Kubernetes pause image as k3s mirrors it; it has no release page, so 'released' is the image's creation date",
    "k3s-local-path-helper": "BusyBox 1.37.0 (busybox.net, 27 September 2024, listed there as unstable; the 1.37 line has no patch release), the helper k3s's local-path provisioner names by default; DN-017",
    "postgresql": "PostgreSQL 18.6 (postgresql.org, 13 August 2026); CloudNativePG built this image on 2026-10-12",
    "kafka": "Strimzi 1.0.1's image of Kafka 4.2.0; 'released' is Strimzi 1.0.1's date",
    "temporal-ui": "Temporal UI server v2.54.1",
    "openfga": "S6 runs it from a template in the hms-cell chart, not from the upstream chart, which packages charts of the excluded vendor (OQ-137)",
}
out = []
current = None
section = None
for line in s.split("\n"):
    if re.match(r"^[a-z_]+:", line):
        section = line.split(":", 1)[0]
    m = re.match(r"  - name: (\S+)$", line)
    if m:
        current = m.group(1)
    out.append(line)
    if section == "images" and line.startswith("    ships: ") and current in released:
        out.append(f'    released: "{released.pop(current)}"')
        if current in notes:
            out.append(f'    note: "{notes.pop(current)}"')
assert not released and not notes, (released, notes)
s = "\n".join(out)

rep("""    licence: Apache-2.0
    purpose: copies images by digest (crane copy --platform linux/amd64)
""", """    licence: Apache-2.0
    released: "2026-09-04"
    purpose: copies images by digest (crane copy --platform linux/amd64)
""")
rep("""    licence: Apache-2.0
    purpose: key pair, signing with a signing configuration without Rekor, offline verification (OQ-135)""",
    """    licence: Apache-2.0
    released: "2026-08-06"
    purpose: key pair, signing with a signing configuration without Rekor, offline verification (OQ-135)
  - name: kyverno-cli
    upstream: reg.kyverno.io/kyverno/kyverno-cli:v1.19.1
    digest: sha256:2fc27b9b52bc976781462b7f4db741fd73d03db39ef29923c2b5d131950751df
    index_digest: sha256:ced7b2be0b04250cabfe695f15307f69eb715fe23234816388af4f3812915b2a
    licence: Apache-2.0
    released: "2026-09-10"
    purpose: offline policy checks with 'kyverno apply --registry' on the internal network (OQ-135; S3)""")
p.write_bytes(s.encode("utf-8"))
print("ok")
