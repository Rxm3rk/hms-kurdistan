#!/bin/bash
set -u
pkill -f GradleDaemon; pkill -f KotlinCompileDaemon; pkill -f 'kotlin-daemon'; sleep 3
free -m | sed -n 2p
helm repo add cnpg https://cloudnative-pg.github.io/charts >/dev/null 2>&1; helm repo update cnpg >/dev/null 2>&1
helm upgrade --install cnpg cnpg/cloudnative-pg --version 0.29.1 -n cnpg-system --create-namespace --wait --timeout 300s 2>&1 | tail -2
kubectl -n cnpg-system get deploy -o wide 2>&1 | tail -2
kubectl create namespace hms-data 2>/dev/null
cat <<YAML | kubectl apply -f - 2>&1 | tail -1
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata: {name: proto-pg, namespace: hms-data}
spec:
  instances: 3
  imageName: ghcr.io/cloudnative-pg/postgresql:18.1-system-trixie
  storage: {size: 1Gi}
  postgresql:
    synchronous: {method: any, number: 1, dataDurability: required}
    parameters: {shared_buffers: "64MB", max_connections: "50"}
  resources:
    requests: {memory: "128Mi", cpu: "100m"}
    limits: {memory: "512Mi"}
YAML
for i in $(seq 1 60); do r=$(kubectl -n hms-data get cluster proto-pg -o jsonpath='{.status.readyInstances}' 2>/dev/null); [ "$r" = "3" ] && break; sleep 5; done
kubectl -n hms-data get cluster proto-pg 2>&1 | tail -2
kubectl -n hms-data get pods -o wide 2>&1 | awk '{print $1, $3, $7}'
P=$(kubectl -n hms-data get cluster proto-pg -o jsonpath='{.status.currentPrimary}')
kubectl -n hms-data exec "$P" -c postgres -- psql -U postgres -Atc "show synchronous_standby_names; show synchronous_commit;" 2>&1
docker stats --no-stream --format '{{.Name}} {{.MemUsage}}' | grep k3d-hms-proto
free -m | sed -n 2p
