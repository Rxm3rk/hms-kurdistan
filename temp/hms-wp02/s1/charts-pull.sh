#!/bin/bash
# Pull the pinned chart candidates into HMS_CELL_HOME/charts and check each against the repository index digest.
set -u
H=${HMS_CELL_HOME:-$HOME/.local/share/hms-cell}
export HELM_REPOSITORY_CONFIG=$H/helm/config/repositories.yaml HELM_REPOSITORY_CACHE=$H/helm/cache/repository HELM_CACHE_HOME=$H/helm/cache HELM_CONFIG_HOME=$H/helm/config HELM_DATA_HOME=$H/helm/data
mkdir -p "$H/charts"; cd "$H/charts"
for spec in cnpg/cloudnative-pg@0.29.1 strimzi/strimzi-kafka-operator@1.0.1 temporal/temporal@1.6.0 openfga/openfga@0.3.12 open-telemetry/opentelemetry-collector@0.175.1 kyverno/kyverno@3.9.1 argo/argo-cd@10.10.5; do
  c=${spec%@*}; v=${spec#*@}; repo=${c%%/*}; name=${c##*/}
  [ -f "$name-$v.tgz" ] || helm pull "$c" --version "$v" >/dev/null || { echo "PULL FAILED $spec"; continue; }
  f=$(ls "$name"*"$v.tgz" | head -1)
  got=$(sha256sum "$f" | cut -d' ' -f1)
  want=$(python3 -c 'import sys,yaml; d=yaml.safe_load(open(sys.argv[1])); print([e for e in d["entries"][sys.argv[2]] if e["version"]==sys.argv[3]][0]["digest"])' "$HELM_REPOSITORY_CACHE/$repo-index.yaml" "$name" "$v")
  echo "$f sha256=$got index=$want $([ "$got" = "$want" ] && echo MATCH || echo MISMATCH)"
  tar -xOzf "$f" "$name/Chart.yaml" | grep -E '^(kubeVersion|appVersion|version):|^  - name:|repository:|condition:' | sed 's/^/    /'
done
