#!/bin/bash
echo "== mem"; free -m | head -2
echo "== java/daemons"; ps -eo rss,etime,args --sort=-rss | grep -E 'java|k3s' | grep -v grep | head -8 | cut -c1-140
echo "== docker"; docker ps -a --format '{{.Names}} {{.Status}}' 2>&1 | head
echo "== k3d"; k3d cluster list 2>&1
echo "== kubectl"; timeout 15 kubectl get nodes 2>&1 | head; timeout 15 kubectl -n hms-data get cluster,pods 2>&1 | head -20
echo "== clones"; for d in ~/src/hospitalmanagementsystem ~/src/hms-wp02; do echo "$d: $(git -C $d rev-parse --abbrev-ref HEAD 2>&1) $(git -C $d log --oneline -1 2>&1) dirty=$(git -C $d status --short 2>/dev/null | wc -l)"; done
