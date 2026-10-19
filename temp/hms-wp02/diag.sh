#!/bin/bash
docker ps -a --format '{{.Names}} {{.Status}}'
for s in 0 1 2; do echo "== server-$s"; docker logs --tail 6 k3d-hms-proto-server-$s 2>&1 | cut -c1-230; done
timeout 20 kubectl get --raw='/readyz?verbose' 2>&1 | grep -v '^\[+\]' | head -15
free -m | sed -n 2p
