#!/bin/bash
# List every image reference each pinned chart renders by default (helm template; no cluster).
set -u
H=${HMS_CELL_HOME:-$HOME/.local/share/hms-cell}
export HELM_CACHE_HOME=$H/helm/cache HELM_CONFIG_HOME=$H/helm/config HELM_DATA_HOME=$H/helm/data
cd "$H/charts"
imgs() { grep -oE '(image|value)?:? *"?[a-z0-9.-]+(:[0-9]+)?/[a-z0-9._/-]+(:[A-Za-z0-9._-]+)?(@sha256:[0-9a-f]{64})?"?' | grep -E 'image:|[a-z]+\.(io|com|org)/' | sed -E 's/^(image|value)?:? *//; s/"//g' | sort -u; }
echo "== cnpg"; helm template t cloudnative-pg-0.29.1.tgz -n cnpg-system 2>&1 | grep -E 'image:|POSTGRES_IMAGE|ghcr' -A1 | grep -oE '[a-z0-9.-]+\.[a-z]+/[^ "]+' | sort -u
echo "== strimzi"; helm template t strimzi-kafka-operator-helm-3-chart-1.0.1.tgz 2>&1 | grep -oE 'quay\.io/[^ ",]+' | sort -u
echo "== strimzi kafka images env"; helm template t strimzi-kafka-operator-helm-3-chart-1.0.1.tgz 2>&1 | grep -A3 'STRIMZI_KAFKA_IMAGES' | head -8
echo "== temporal"; helm template t temporal-1.6.0.tgz 2>&1 | grep -E 'image:' | sort | uniq -c
helm show values temporal-1.6.0.tgz | grep -nE '^[a-z]|enabled:|repository:|tag:' | head -80
echo "== openfga"; helm template t openfga-0.3.12.tgz 2>&1 | grep -E 'image:' | sort | uniq -c
echo "== otel"; helm template t opentelemetry-collector-0.175.1.tgz --set mode=deployment --set image.repository=otel/opentelemetry-collector-k8s 2>&1 | grep -E 'image:' | sort | uniq -c
echo "== kyverno"; helm template t kyverno-3.9.1.tgz -n kyverno 2>&1 | grep -E 'image:' | sort | uniq -c
echo "== argo"; helm template t argo-cd-10.10.5.tgz 2>&1 | grep -E 'image:' | sort | uniq -c
