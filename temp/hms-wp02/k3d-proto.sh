#!/bin/bash
set -u
k3d cluster delete hms-proto >/dev/null 2>&1
start=$(date +%s)
k3d cluster create hms-proto --servers 3 --agents 0 --image rancher/k3s:v1.37.1-k3s1 \
  --k3s-arg "--disable=traefik@server:*" --k3s-arg "--disable=metrics-server@server:*" \
  --no-lb --wait --timeout 300s 2>&1 | tail -3
echo "create took $(( $(date +%s) - start )) s"
kubectl get nodes -o wide 2>&1 | head -5
sleep 20
docker stats --no-stream --format '{{.Name}} {{.MemUsage}} {{.CPUPerc}}' | grep k3d-hms-proto
free -m | sed -n 2p
