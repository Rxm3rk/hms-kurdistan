#!/bin/bash
# Records of record for WP-0.1 at a committed SHA, in the WSL clone (KA-001). Usage: records.sh <sha>
set -u
SHA=$1
OUT=/tmp/hms-records-$SHA; rm -rf "$OUT"; mkdir -p "$OUT"
cd ~/src/hospitalmanagementsystem || exit 2
git fetch -q origin '+refs/heads/*:refs/remotes/origin/*'
git checkout -q --detach "$SHA" || exit 2
git clean -fdq docs/program/evidence   # untracked records of earlier runs (they would mark this run -dirty, O-5)
echo "HEAD=$(git rev-parse --short HEAD) status-lines=$(git status --short | wc -l)"
ls -l backend/gradlew tools/ci/run tools/hms tools/doctor tools/bootstrap tools/host/provision-ubuntu.sh | awk '{print $1, $NF}'
sh tools/bootstrap > "$OUT/bootstrap.log" 2>&1; echo "bootstrap exit $?"
D=$(date +%F); S=$(git rev-parse --short HEAD)
move_records() { find docs/program/evidence -type f -newer "$OUT/.mark" -exec cp --parents {} "$OUT/" \; ; git clean -fdq docs/program/evidence; }
run() { touch "$OUT/.mark"; sleep 1; echo "== $*"; "$@" > "$OUT/$(echo "$*" | tr ' /' '__').log" 2>&1; echo "exit $?"; tail -3 "$OUT/$(echo "$*" | tr ' /' '__').log"; move_records; }
run tools/doctor --json
run tools/ci/run fast
run tools/ci/run merge
run tools/ci/run nightly
run tools/hms backlog spot-check --seed 20261018 --count 10
echo "== records"; find "$OUT/docs" -type f | sed "s#$OUT/##"
