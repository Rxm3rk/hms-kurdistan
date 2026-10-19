#!/bin/bash
set -u
for r in google/go-containerregistry sigstore/cosign kyverno/kyverno distribution/distribution k3s-io/k3s keycloak/keycloak valkey-io/valkey open-telemetry/opentelemetry-collector-releases temporalio/temporal openfga/openfga cloudnative-pg/cloudnative-pg strimzi/strimzi-kafka-operator argoproj/argo-cd k3d-io/k3d; do
  echo "== $r"
  curl -fsSL --max-time 60 "https://api.github.com/repos/$r/releases?per_page=30" | python3 -c '
import json,sys
for e in json.load(sys.stdin):
    print(" ", e["tag_name"], e["published_at"][:10], "pre" if e["prerelease"] else "", "draft" if e["draft"] else "")' | head -16
done
