#!/bin/bash
# S1 review fixes, WSL build host: a real charts fetch of two files, drop the unpinned chart archives, then
# mirror, sign and verify the lite profile (the new OpenTelemetry 0.163.1 pin) with a scratch record.
set -u
H=${HMS_CELL_HOME:-$HOME/.local/share/hms-cell}
HMS() { ~/src/hospitalmanagementsystem/.tools/venv/bin/python -B -I tools/hms.py "$@"; }
cd /tmp/hms-s1/tree
free -m | sed -n 2p; df -B1 /mnt/c | tail -1
mkdir -p /tmp/hms-s1/aside
mv "$H/charts/cloudnative-pg-0.29.1.tgz" "$H/manifests/keycloak-operator-26.8.1/keycloakrealmimports.k8s.keycloak.org-v1.yml" /tmp/hms-s1/aside/
echo "== charts fetch (two files moved aside)"; HMS cell charts fetch | grep -E "downloaded|fetched|FAIL|PASS"; echo "rc=${PIPESTATUS[0]}"
cmp /tmp/hms-s1/aside/cloudnative-pg-0.29.1.tgz "$H/charts/cloudnative-pg-0.29.1.tgz" && echo "cnpg chart: identical to the earlier copy"
cmp /tmp/hms-s1/aside/keycloakrealmimports.k8s.keycloak.org-v1.yml "$H/manifests/keycloak-operator-26.8.1/keycloakrealmimports.k8s.keycloak.org-v1.yml" && echo "realm-import CRD: identical"
rm -rf /tmp/hms-s1/aside
rm -f "$H/charts/kyverno-3.9.1.tgz" "$H/charts/openfga-0.3.12.tgz"; ls "$H/charts"
echo "== images mirror"; HMS cell images mirror --profile lite | grep -vE "^OK .* present"; echo "rc=${PIPESTATUS[0]}"
export HMS_COSIGN_PASSWORD="$(cat "$H/cosign.password")"
echo "== images sign"; HMS cell images sign --profile lite | grep -vE "already signed"; echo "rc=${PIPESTATUS[0]}"
unset HMS_COSIGN_PASSWORD
echo "== images verify"; HMS cell images verify --profile lite --evidence-dir /tmp/hms-s1/records | tail -4; echo "rc=${PIPESTATUS[0]}"
df -B1 /mnt/c | tail -1
