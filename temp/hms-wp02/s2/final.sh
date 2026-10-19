#!/bin/bash
# S2 final cell run (WSL build host, lite cell). Scratch records under /tmp/hms-s2/records only.
set -u
R=/mnt/c/Users/Surface/AppData/Local/Temp/hms-wp02/s2/run.sh
bash /mnt/c/Users/Surface/AppData/Local/Temp/hms-wp02/s2/sync-tree.sh
echo "== removing the development cluster (created at 13:05 by a direct k3d diagnosis run)"
k3d cluster delete hms-lite 2>&1 | tail -1
docker network disconnect k3d-hms-lite k3d-hms-registry.localhost 2>/dev/null; docker network rm k3d-hms-lite 2>/dev/null
docker ps -a --format '{{.Names}}'; docker network ls --format '{{.Name}}' | tr '\n' ' '; echo
bash $R up --only substrate --profile lite || exit 1
bash $R status --profile lite
bash $R chaos cell-restart --profile lite --evidence-dir /tmp/hms-s2/records
bash $R chaos cell-restart --profile lite --evidence-dir /tmp/hms-s2/records
bash $R stop --profile lite
bash $R status --profile lite
docker ps -a --format '{{.Names}} {{.Status}}'
free -m | sed -n 2p; df -h /mnt/c | tail -1
