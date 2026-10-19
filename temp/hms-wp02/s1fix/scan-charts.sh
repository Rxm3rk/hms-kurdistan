#!/bin/bash
# Scan every cached chart .tgz for the excluded vendor's name (any file), and refresh the OTel repo index.
set -u
H=${HMS_CELL_HOME:-$HOME/.local/share/hms-cell}
export HELM_REPOSITORY_CONFIG=$H/helm/config/repositories.yaml HELM_REPOSITORY_CACHE=$H/helm/cache/repository HELM_CACHE_HOME=$H/helm/cache HELM_CONFIG_HOME=$H/helm/config HELM_DATA_HOME=$H/helm/data
cd "$H/charts"
for f in *.tgz; do
  n=$(tar -xOzf "$f" | grep -aic bitnami)
  files=$(tar -tzf "$f" | while read -r m; do :; done; python3 - "$f" <<'PY'
import sys, tarfile
t = tarfile.open(sys.argv[1])
hits = sorted({m.name for m in t.getmembers() if m.isfile() and b"bitnami" in t.extractfile(m).read().lower()})
print(len(hits), " ".join(hits[:6]))
PY
)
  echo "$f lines=$n files=$files"
done
helm repo update open-telemetry >/dev/null 2>&1; helm search repo open-telemetry/opentelemetry-collector --versions 2>/dev/null | head -5
python3 -c '
import yaml,sys
d=yaml.safe_load(open(sys.argv[1]))
for e in d["entries"]["opentelemetry-collector"][:4]: print(e["version"], e["appVersion"], e["created"], e["digest"])' "$HELM_REPOSITORY_CACHE/open-telemetry-index.yaml"
