#!/bin/bash
# S2 scratch experiment (WSL build host): does k3d 5.8.3 with a fixed subnet give nodes, LB and registry fixed addresses?
set -u
mkdir -p /tmp/hms-s2
K3S=localhost:5000/rancher/k3s@sha256:b87c71679c0be70cab5eb34f05ebe5e2906bf80fbd1d99b389c1e9643954520c
export K3D_IMAGE_LOADBALANCER=localhost:5000/k3d-io/k3d-proxy@sha256:86df1112d4ba91b3c5c8cfabfad384e562612305a18f7473057cc0c00045bfd2
export K3D_IMAGE_TOOLS=localhost:5000/k3d-io/k3d-tools@sha256:79b6b3cd0b5066918eaaf79efcf3106edf97f6a7232a144bc7366afed979515f
cat > /tmp/hms-s2/exp.yaml <<Y
apiVersion: k3d.io/v1alpha5
kind: Simple
metadata:
  name: hms-exp
servers: 1
agents: 0
image: $K3S
subnet: 10.213.9.0/24
registries:
  use:
    - k3d-hms-registry.localhost:5000
options:
  k3d:
    wait: true
    timeout: 240s
  k3s:
    extraArgs:
      - arg: --disable=traefik,servicelb,metrics-server
        nodeFilters: [server:*]
      - arg: --system-default-registry=k3d-hms-registry.localhost:5000
        nodeFilters: [server:*]
      - arg: --disable-default-registry-endpoint
        nodeFilters: [server:*]
  kubeconfig:
    updateDefaultKubeconfig: false
    switchCurrentContext: false
  runtime:
    serversMemory: 3g
Y
free -m | sed -n 2p
time k3d cluster create --config /tmp/hms-s2/exp.yaml 2>&1 | tail -15
for c in k3d-hms-exp-server-0 k3d-hms-exp-serverlb k3d-hms-registry.localhost; do
  echo "== $c"; docker inspect $c --format '{{json .NetworkSettings.Networks}}' | python3 -c 'import json,sys; d=json.load(sys.stdin); [print(k, v.get("IPAMConfig"), v.get("IPAddress")) for k,v in d.items()]'
  docker inspect $c --format '{{.HostConfig.RestartPolicy.Name}} mem={{.HostConfig.Memory}} img={{.Config.Image}}'
done
docker network inspect k3d-hms-exp --format '{{json .IPAM}} {{json .Labels}}'
docker exec k3d-hms-exp-server-0 cat /etc/hosts
docker exec k3d-hms-exp-server-0 cat /etc/rancher/k3s/registries.yaml
k3d kubeconfig get hms-exp > /tmp/hms-s2/exp.kubeconfig
KUBECONFIG=/tmp/hms-s2/exp.kubeconfig kubectl get nodes -o wide
KUBECONFIG=/tmp/hms-s2/exp.kubeconfig kubectl get pods -A -o wide
sleep 30
KUBECONFIG=/tmp/hms-s2/exp.kubeconfig kubectl get pods -A -o wide
KUBECONFIG=/tmp/hms-s2/exp.kubeconfig kubectl get events -A | tail -8
