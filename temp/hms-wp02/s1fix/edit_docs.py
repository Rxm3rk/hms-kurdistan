"""One-off edits of the programme documents for the S1 review fixes (run from the worktree root)."""
from pathlib import Path


def edit(path, pairs):
    p = Path(path)
    s = p.read_bytes().decode("utf-8")
    assert "\r\n" not in s, path
    for old, new in pairs:
        assert s.count(old) == 1, (path, old[:90], s.count(old))
        s = s.replace(old, new)
    p.write_bytes(s.encode("utf-8"))


# ---------------------------------------------------------------- scorecard
edit("docs/program/dependency-scorecard.md", [
    ("so the figure is a lower bound (marked \"at least\"). Kafka and PostgreSQL publish their releases outside GitHub, so no release figure is given for them. Pins and their reading:",
     "so the figure is a lower bound (marked \"at least\"). Kafka and PostgreSQL publish their releases outside GitHub, so no release figure is given for them. The pin column gives the date the pinned version was released (`released` in `cell.yaml`, from the publisher's release page); the releases column gives the project's latest GA release, which may be another line. Pins and their reading:"),
    ("| k3s | v1.35.9+k3s1 (Kubernetes on each cell node) |", "| k3s | v1.35.9+k3s1, released 2026-09-30 (Kubernetes on each cell node) |"),
    ("| CloudNativePG | 1.30.1, chart 0.29.1 (PostgreSQL operator) |", "| CloudNativePG | 1.30.1, released 2026-09-23; chart 0.29.1 (PostgreSQL operator) |"),
    ("| PostgreSQL | 18.6 (CloudNativePG `minimal-trixie` image) |", "| PostgreSQL | 18.6, released 2026-08-13 (CloudNativePG `minimal-trixie` image, built 2026-10-12) |"),
    ("| Strimzi | 1.0.1 (Kafka operator) |", "| Strimzi | 1.0.1, released 2026-06-17 (Kafka operator) |"),
    ("| Temporal server | 1.32.1, chart 1.7.0 (workflow) |", "| Temporal server | 1.32.1, released 2026-10-08; chart 1.7.0 (workflow) |"),
    ("| Keycloak and its Operator | 26.8.1 (identity) |", "| Keycloak and its Operator | 26.8.1, released 2026-10-13 (identity) |"),
    ("| OpenFGA | v1.18.3, chart 0.3.12 (authorisation) |", "| OpenFGA | v1.18.3, released 2026-08-05; no chart (authorisation) |"),
    ("| Pinned. Its chart packages Bitnami subcharts (OQ-137) |",
     "| Pinned. Its chart 0.3.12 packages Bitnami charts, so it is not pinned; S6 runs OpenFGA from our own template (OQ-137) |"),
    ("| Valkey | 9.1.2 (cache only) |", "| Valkey | 9.1.2, released 2026-09-01 (cache only) |"),
    ("| OpenTelemetry Collector | 0.162.0, chart 0.176.0 (`k8s` distribution) |",
     "| OpenTelemetry Collector | 0.163.1, released 2026-10-16; chart 0.176.0 with its image tag set (`k8s` distribution) |"),
    ("| Pinned. Pre-1.0 numbering with no patch releases: OQ-107's reading |",
     "| Pinned. Pre-1.0 numbering; patch releases are rare: 0.163.1 is the 0.163 line's patch release, and it only repaired the release workflow (OQ-136) |"),
    ("| Kyverno | 1.19.1, chart 3.9.1 (signature enforcement, ADR-030) |",
     "| Kyverno | 1.19.1, released 2026-09-10; release manifest `install.yaml` (signature enforcement, ADR-030) |"),
    ("its chart packages a Bitnami subchart (OQ-137) |",
     "its chart 3.9.1 packages a Bitnami chart, so the release manifest is pinned instead (OQ-137) |"),
    ("| Argo CD | 3.5.5, chart 10.10.5 (delivery, dev profile) |", "| Argo CD | 3.5.5, released 2026-10-12; chart 10.10.5 (delivery, dev profile) |"),
    ("| CNCF Distribution | 3.1.2 (the local registry) |", "| CNCF Distribution | 3.1.2, released 2026-09-24 (the local registry) |"),
    ("| cosign | v3.1.3 (signing; build only) |", "| cosign | v3.1.3, released 2026-08-06 (signing; build only) |"),
    ("crane (go-containerregistry v0.22.1, Apache-2.0) and k3d 5.8.3 (MIT) are build-only tools and have no scorecard row (WP-0.2 plan §6).",
     "crane (go-containerregistry v0.22.1, released 2026-09-04, Apache-2.0), the Kyverno CLI (v1.19.1, Apache-2.0) and k3d 5.8.3 (released 2025-02-15, MIT) are build-only tools and have no scorecard row (WP-0.2 plan §6)."),
])

# ---------------------------------------------------------------- ADR-002
edit("docs/adr/ADR-002-runtime-kotlin-jvm-spring.md", [
    ("every image by the digest of its linux/amd64 manifest, every chart by version and the SHA-256 of its `.tgz`, which equals the digest in the publisher's Helm repository index; how the rule was read: OQ-107, OQ-125, OQ-136):",
     "every image by the digest of its linux/amd64 manifest and its release date, every chart by version and the SHA-256 of its `.tgz`, which equals the digest in the publisher's Helm repository index, every release manifest by commit or release and its SHA-256; how the rule was read: OQ-107, OQ-125, OQ-136; no chart that packages a Bitnami chart, OQ-137):"),
    ("- OpenFGA v1.18.3 (chart 0.3.12; OQ-137).", "- OpenFGA v1.18.3 (the official image; S6 runs it from our own template, because chart 0.3.12 packages Bitnami charts, OQ-137)."),
    ("- OpenTelemetry Collector 0.162.0, `k8s` distribution (chart 0.176.0).",
     "- OpenTelemetry Collector 0.163.1, `k8s` distribution (chart 0.176.0, which ships 0.162.0, with its image tag set)."),
    ("- Kyverno 1.19.1 (chart 3.9.1; ADR-030, OQ-137).",
     "- Kyverno 1.19.1 (its release manifest `install.yaml`, not chart 3.9.1, which packages a Bitnami chart; ADR-030, OQ-137)."),
    ("- Build-only tools, run from their images by digest: cosign v3.1.3 (signing with a signing configuration without Rekor, OQ-135) and crane v0.22.1 (go-containerregistry).",
     "- Build-only tools, run from their images by digest: cosign v3.1.3 (signing with a signing configuration without Rekor, OQ-135), crane v0.22.1 (go-containerregistry) and the Kyverno CLI v1.19.1 (offline policy checks)."),
])
