#!/bin/bash
# S1 pin re-check: chart versions from the publishers' Helm repositories (read-only; helm state in HMS_CELL_HOME).
set -u
H=${HMS_CELL_HOME:-$HOME/.local/share/hms-cell}
mkdir -p "$H/helm/cache" "$H/helm/config"; chmod 700 "$H"
export HELM_REPOSITORY_CONFIG=$H/helm/config/repositories.yaml HELM_REPOSITORY_CACHE=$H/helm/cache/repository HELM_CACHE_HOME=$H/helm/cache HELM_CONFIG_HOME=$H/helm/config HELM_DATA_HOME=$H/helm/data
add() { helm repo add "$1" "$2" --force-update >/dev/null 2>&1 || echo "repo add failed: $1 $2"; }
add cnpg https://cloudnative-pg.github.io/charts
add strimzi https://strimzi.io/charts/
add temporal https://go.temporal.io/helm-charts
add openfga https://openfga.github.io/helm-charts
add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts
add kyverno https://kyverno.github.io/kyverno/
add argo https://argoproj.github.io/argo-helm
helm repo update >/dev/null 2>&1
for c in cnpg/cloudnative-pg strimzi/strimzi-kafka-operator temporal/temporal openfga/openfga open-telemetry/opentelemetry-collector kyverno/kyverno argo/argo-cd; do
  echo "== $c"; helm search repo "$c" --versions -o json | python3 -c 'import json,sys; [print(e["version"], e["app_version"]) for e in json.load(sys.stdin)[:14]]'
done
for c in cnpg/cloudnative-pg strimzi/strimzi-kafka-operator temporal/temporal openfga/openfga open-telemetry/opentelemetry-collector kyverno/kyverno argo/argo-cd; do
  repo=${c%%/*}; name=${c##*/}
  python3 - "$HELM_REPOSITORY_CACHE/$repo-index.yaml" "$name" <<'PY'
import sys, yaml
d = yaml.safe_load(open(sys.argv[1]))
for e in d["entries"][sys.argv[2]][:14]:
    print(sys.argv[2], e["version"], e.get("appVersion"), str(e.get("created"))[:10], e.get("digest"), e["urls"][0])
PY
done
