#!/bin/bash
p() { local s=$(date +%s.%N); if timeout 300 docker pull -q "$1" >/dev/null 2>&1; then local e=$(date +%s.%N); local sz=$(docker image inspect "$1" --format '{{.Size}}'); echo "$1: $(echo "$sz/1048576" | bc) MB in $(echo "$e-$s" | bc | cut -c1-6)s"; else echo "$1: FAILED or >300s"; fi; }
p docker.io/valkey/valkey:8.1-alpine
p ghcr.io/cloudnative-pg/cloudnative-pg:1.27.1
p quay.io/strimzi/operator:0.48.0
