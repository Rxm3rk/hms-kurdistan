#!/bin/bash
# Resolve tag -> index digest and linux/amd64 manifest digest from each publisher's registry (crane, pinned by digest).
set -u
C="docker run --rm gcr.io/go-containerregistry/crane@sha256:18efc5092649b2a674d384663044e04edf76705c4faa2875e8a322b4e80f070a"
while read -r ref; do
  [ -z "$ref" ] && continue
  idx=$($C digest "$ref" 2>&1 | tail -1)
  amd=$($C digest --platform linux/amd64 "$ref" 2>&1 | tail -1)
  mt=$($C manifest "$ref" 2>/dev/null | python3 -c 'import json,sys; print(json.load(sys.stdin).get("mediaType","?"))')
  echo "$ref index=$idx amd64=$amd type=$mt"
done <<'LIST'
docker.io/rancher/k3s:v1.35.9-k3s1
docker.io/rancher/mirrored-pause:3.10.2
docker.io/rancher/mirrored-coredns-coredns:1.14.7
docker.io/rancher/local-path-provisioner:v0.0.37
docker.io/rancher/mirrored-library-busybox:1.37.0
ghcr.io/k3d-io/k3d-proxy:5.8.3
ghcr.io/k3d-io/k3d-tools:5.8.3
docker.io/distribution/distribution:3.1.2
gcr.io/go-containerregistry/crane:v0.22.1
ghcr.io/sigstore/cosign/cosign:v3.1.3
ghcr.io/sigstore/cosign/cosign:v2.6.5
reg.kyverno.io/kyverno/kyverno:v1.19.1
reg.kyverno.io/kyverno/kyvernopre:v1.19.1
reg.kyverno.io/kyverno/kyverno-cli:v1.19.1
ghcr.io/kyverno/readiness-checker:v1.19.1
ghcr.io/cloudnative-pg/cloudnative-pg:1.30.1
ghcr.io/cloudnative-pg/postgresql:18.6-202610120828-minimal-trixie
quay.io/strimzi/operator:1.0.1
quay.io/strimzi/kafka:1.0.1-kafka-4.2.0
docker.io/temporalio/server:1.32.1
docker.io/temporalio/admin-tools:1.32.1
quay.io/keycloak/keycloak-operator:26.8.1
quay.io/keycloak/keycloak:26.8.1
docker.io/openfga/openfga:v1.18.3
docker.io/valkey/valkey:9.1.2
docker.io/chrislusf/seaweedfs:4.48
docker.io/otel/opentelemetry-collector-k8s:0.162.0
docker.io/otel/opentelemetry-collector-contrib:0.162.0
quay.io/argoproj/argocd:v3.5.5
LIST
