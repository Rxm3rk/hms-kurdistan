#!/bin/bash
set -u
H=${HMS_CELL_HOME:-$HOME/.local/share/hms-cell}
export HELM_REPOSITORY_CONFIG=$H/helm/config/repositories.yaml HELM_REPOSITORY_CACHE=$H/helm/cache/repository HELM_CACHE_HOME=$H/helm/cache HELM_CONFIG_HOME=$H/helm/config HELM_DATA_HOME=$H/helm/data
cd "$H/charts"
for spec in temporal/temporal@1.7.0 open-telemetry/opentelemetry-collector@0.176.0; do
  c=${spec%@*}; v=${spec#*@}; name=${c##*/}
  [ -f "$name-$v.tgz" ] || helm pull "$c" --version "$v" >/dev/null || echo "PULL FAILED $spec"
  sha256sum "$name-$v.tgz"
done
helm show values temporal-1.7.0.tgz | grep -nE "repository:|tag:|^[a-z]+:|^  enabled" | head -40
tar -tzf temporal-1.7.0.tgz | grep -c charts/ ; tar -xOzf temporal-1.7.0.tgz temporal/Chart.yaml
helm template t temporal-1.7.0.tgz --set server.config.persistence.default.driver=sql --set server.config.persistence.default.sql.driver=postgres12 2>&1 | grep -E "image:" | sort | uniq -c | head
rm -f opentelemetry-collector-0.175.1.tgz temporal-1.6.0.tgz
