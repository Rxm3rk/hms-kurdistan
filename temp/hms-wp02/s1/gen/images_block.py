"""Scratch generator: the images and tools blocks of deploy/site-cell/cell.yaml from resolved.txt."""
import re, sys
D = {}
for line in open(sys.argv[1], encoding="utf-8"):
    m = re.match(r"(\S+) index=(sha256:[0-9a-f]{64}) amd64=(sha256:[0-9a-f]{64})", line)
    if m:
        D[m.group(1)] = (m.group(2), m.group(3))
IMAGES = [
    # name, upstream, local, licence, role, component, profiles, ships
    ("k3s", "docker.io/rancher/k3s:v1.35.9-k3s1", "rancher/k3s", "Apache-2.0", "substrate", "k3s-servers", "lite, dev", True),
    ("k3s-pause", "docker.io/rancher/mirrored-pause:3.10.2", "rancher/mirrored-pause", "Apache-2.0", "substrate", "k3s-servers", "lite, dev", True),
    ("k3s-coredns", "docker.io/rancher/mirrored-coredns-coredns:1.14.7", "rancher/mirrored-coredns-coredns", "Apache-2.0", "substrate", "k3s-servers", "lite, dev", True),
    ("k3s-local-path-provisioner", "docker.io/rancher/local-path-provisioner:v0.0.37", "rancher/local-path-provisioner", "Apache-2.0", "substrate", "k3s-servers", "lite, dev", True),
    ("k3s-local-path-helper", "docker.io/rancher/mirrored-library-busybox:1.37.0", "rancher/mirrored-library-busybox", "GPL-2.0-only", "substrate", "k3s-servers", "lite, dev", True),
    ("k3d-proxy", "ghcr.io/k3d-io/k3d-proxy:5.8.3", "k3d-io/k3d-proxy", "MIT", "substrate", "k3d-lb-registry", "lite, dev", False),
    ("k3d-tools", "ghcr.io/k3d-io/k3d-tools:5.8.3", "k3d-io/k3d-tools", "MIT", "substrate", "k3d-lb-registry", "lite, dev", False),
    ("registry", "docker.io/distribution/distribution:3.1.2", "distribution/distribution", "Apache-2.0", "registry", "k3d-lb-registry", "lite, dev", False),
    ("kyverno", "reg.kyverno.io/kyverno/kyverno:v1.19.1", "kyverno/kyverno", "Apache-2.0", "signature-enforcement", "kyverno", "lite, dev", True),
    ("kyverno-pre", "reg.kyverno.io/kyverno/kyvernopre:v1.19.1", "kyverno/kyvernopre", "Apache-2.0", "signature-enforcement", "kyverno", "lite, dev", True),
    ("kyverno-cli", "reg.kyverno.io/kyverno/kyverno-cli:v1.19.1", "kyverno/kyverno-cli", "Apache-2.0", "signature-enforcement", "kyverno", "lite, dev", True),
    ("kyverno-readiness-checker", "ghcr.io/kyverno/readiness-checker:v1.19.1", "kyverno/readiness-checker", "Apache-2.0", "signature-enforcement", "kyverno", "lite, dev", True),
    ("cloudnative-pg", "ghcr.io/cloudnative-pg/cloudnative-pg:1.30.1", "cloudnative-pg/cloudnative-pg", "Apache-2.0", "database-operator", "cnpg-operator", "lite, dev", True),
    ("postgresql", "ghcr.io/cloudnative-pg/postgresql:18.6-202610120828-minimal-trixie", "cloudnative-pg/postgresql", "PostgreSQL", "database", "postgresql", "lite, dev", True),
    ("strimzi-operator", "quay.io/strimzi/operator:1.0.1", "strimzi/operator", "Apache-2.0", "event-backbone-operator", "strimzi-operators", "lite, dev", True),
    ("kafka", "quay.io/strimzi/kafka:1.0.1-kafka-4.2.0", "strimzi/kafka", "Apache-2.0", "event-backbone", "kafka", "lite, dev", True),
    ("temporal-server", "docker.io/temporalio/server:1.32.1", "temporalio/server", "MIT", "workflow", "temporal", "lite, dev", True),
    ("temporal-admin-tools", "docker.io/temporalio/admin-tools:1.32.1", "temporalio/admin-tools", "MIT", "workflow", "temporal", "lite, dev", True),
    ("temporal-ui", "docker.io/temporalio/ui:2.54.1", "temporalio/ui", "MIT", "workflow", "temporal", "dev", True),
    ("keycloak-operator", "quay.io/keycloak/keycloak-operator:26.8.1", "keycloak/keycloak-operator", "Apache-2.0", "identity-operator", "keycloak", "lite, dev", True),
    ("keycloak", "quay.io/keycloak/keycloak:26.8.1", "keycloak/keycloak", "Apache-2.0", "identity", "keycloak", "lite, dev", True),
    ("openfga", "docker.io/openfga/openfga:v1.18.3", "openfga/openfga", "Apache-2.0", "authorisation", "small-services", "lite, dev", True),
    ("valkey", "docker.io/valkey/valkey:9.1.2", "valkey/valkey", "BSD-3-Clause", "cache", "small-services", "lite, dev", True),
    ("seaweedfs", "docker.io/chrislusf/seaweedfs:4.48", "chrislusf/seaweedfs", "Apache-2.0", "object-store", "small-services", "lite, dev", True),
    ("otel-collector", "docker.io/otel/opentelemetry-collector-k8s:0.162.0", "otel/opentelemetry-collector-k8s", "Apache-2.0", "telemetry", "small-services", "lite, dev", True),
    ("argocd", "quay.io/argoproj/argocd:v3.5.5", "argoproj/argocd", "Apache-2.0", "delivery", "argocd", "dev", True),
]
TOOLS = [
    ("crane", "gcr.io/go-containerregistry/crane:v0.22.1", "Apache-2.0", "copies images by digest (crane copy --platform linux/amd64)"),
    ("cosign", "ghcr.io/sigstore/cosign/cosign:v3.1.3", "Apache-2.0", "key pair, signing with a signing configuration without Rekor, offline verification (OQ-135)"),
]
out = ["images:"]
for name, up, local, lic, role, comp, prof, ships in IMAGES:
    idx, amd = D[up]
    out += [f"  - name: {name}", f"    upstream: {up}", f"    digest: {amd}", f"    index_digest: {idx}",
            f"    local: {local}", f"    licence: {lic}", f"    role: {role}", f"    component: {comp}",
            f"    profiles: [{prof}]", f"    ships: {'true' if ships else 'false'}"]
out += ["", "tools:"]
for name, up, lic, purpose in TOOLS:
    idx, amd = D[up]
    out += [f"  - name: {name}", f"    upstream: {up}", f"    digest: {amd}", f"    index_digest: {idx}",
            f"    licence: {lic}", f"    purpose: {purpose}"]
print("\n".join(out))
