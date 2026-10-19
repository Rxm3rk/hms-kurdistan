#!/bin/bash
# Run the fast tier in the WSL scratch clone (no evidence written). Usage: fast.sh <label>
set -u
cd /tmp/hms-integ/tree
echo "== $(date -Is) $1 HEAD $(git rev-parse --short HEAD) tree $(git rev-parse HEAD^{tree}); free $(free -m | awk '/^Mem:/ {print $7}') MiB"
[ -d frontend/node_modules ] || sh tools/bootstrap frontend
eval "$(sh tools/bootstrap env)"
sh tools/ci/run fast --no-evidence
rc=$?
echo "rc=$rc ($(date -Is))"
exit $rc
