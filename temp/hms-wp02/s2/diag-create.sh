#!/bin/bash
# S2 diagnosis (WSL build host): repeat the failed create directly with --no-rollback and watch the nodes.
set -u
docker network disconnect k3d-hms-lite k3d-hms-registry.localhost 2>/dev/null; docker network rm k3d-hms-lite 2>/dev/null
export K3D_IMAGE_LOADBALANCER=localhost:5000/k3d-io/k3d-proxy@sha256:86df1112d4ba91b3c5c8cfabfad384e562612305a18f7473057cc0c00045bfd2
export K3D_IMAGE_TOOLS=localhost:5000/k3d-io/k3d-tools@sha256:79b6b3cd0b5066918eaaf79efcf3106edf97f6a7232a144bc7366afed979515f
D=/tmp/hms-s2/diag; mkdir -p $D
( for i in $(seq 1 20); do sleep 15; date +%T; for c in k3d-hms-lite-server-0 k3d-hms-lite-server-1 k3d-hms-lite-server-2 k3d-hms-registry.localhost; do
    docker inspect $c --format "$c {{.State.Status}} {{range \$k,\$v := .NetworkSettings.Networks}}{{\$k}}={{\$v.IPAddress}}/{{if \$v.IPAMConfig}}{{\$v.IPAMConfig.IPv4Address}}{{end}} {{end}}" 2>/dev/null; done; done ) > $D/watch.txt 2>&1 &
W=$!
time k3d cluster create --config ~/.local/share/hms-cell/k3d/lite.k3d.yaml --no-rollback 2>&1 | grep -v "^\s*$" | tail -12
kill $W 2>/dev/null
cat $D/watch.txt | tail -12
for c in k3d-hms-lite-server-0 k3d-hms-lite-server-1; do echo "== $c"; docker logs $c 2>&1 | grep -iE "error|fail|fatal|refused|timeout" | grep -v "connection refused.*6443\|level=info" | tail -12 | cut -c1-260; done
free -m | sed -n 2p
