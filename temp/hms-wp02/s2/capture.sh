#!/bin/bash
# Capture real outputs from the lite cell for the S2 unit-test fixtures (WSL build host). Writes only /tmp.
set -u
D=/tmp/hms-s2/real; mkdir -p $D
K=$HOME/.local/share/hms-cell/k3d/lite.kubeconfig
docker inspect k3d-hms-lite-server-0 k3d-hms-lite-server-1 k3d-hms-lite-server-2 k3d-hms-lite-serverlb > $D/inspect-lite.json
docker inspect k3d-hms-registry.localhost > $D/inspect-registry.json
kubectl --kubeconfig $K get nodes -o json > $D/nodes.json
kubectl --kubeconfig $K get pods -n kube-system -o json > $D/pods.json
T=$(docker inspect k3d-hms-lite-server-0 --format "{{range .Config.Env}}{{println .}}{{end}}" | sed -n "s/^K3S_TOKEN=//p")
curl -sk -u "server:$T" https://10.213.2.3:6443/db/info > $D/dbinfo.json
docker exec k3d-hms-lite-server-0 cat /var/lib/rancher/k3s/server/db/etcd/config > $D/etcd-config-0.yaml
ip -j -4 route > $D/routes.json
docker network inspect k3d-hms-lite --format '{{json .IPAM.Config}} {{.Id}}'
ls -la $D
