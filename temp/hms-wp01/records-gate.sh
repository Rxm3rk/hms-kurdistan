#!/bin/bash
# Records of record after a code commit: fast, nightly, gates-bite. Usage: records-gate.sh <sha>
set -u
SHA=$1
OUT=/tmp/hms-records-$SHA; rm -rf "$OUT"; mkdir -p "$OUT"
cd ~/src/hospitalmanagementsystem || exit 2
git fetch -q origin '+refs/heads/*:refs/remotes/origin/*'
git checkout -q --detach "$SHA" || exit 2
git clean -fdq docs/program/evidence
echo "HEAD=$(git rev-parse --short HEAD) status-lines=$(git status --short | wc -l)"
sh tools/bootstrap > "$OUT/bootstrap.log" 2>&1; echo "bootstrap exit $?"
move_records() { find docs/program/evidence -type f -newer "$OUT/.mark" -exec cp --parents {} "$OUT/" \; ; git clean -fdq docs/program/evidence; }
run() { touch "$OUT/.mark"; sleep 1; echo "== $*"; "$@" > "$OUT/$(echo "$*" | tr ' /' '__').log" 2>&1; echo "exit $?"; tail -2 "$OUT/$(echo "$*" | tr ' /' '__').log"; move_records; }
run tools/ci/run fast
run tools/ci/run nightly
echo "== gates-bite"
SRC=/mnt/c/Users/Surface/.t3/projects/hospitalmanagementsystem; PLANT=$HOME/src/hms-plant
sh "$SRC/tools/ci/gates-bite/setup-clone.sh" "$SRC" "$PLANT" > "$OUT/gates-bite-setup.log" 2>&1; echo "setup exit $?"
COPY=$(mktemp -d); git -C "$SRC" archive "$SHA" tools/ci/gates-bite | tar -x -C "$COPY"
sh "$COPY/tools/ci/gates-bite/gates-bite.sh" --clone "$PLANT" --out "$OUT" "$SHA" > "$OUT/gates-bite.log" 2>&1; echo "gates-bite exit $?"
tail -4 "$OUT/gates-bite.log"
echo "== git status after: $(git status --short | wc -l)"
find "$OUT" -maxdepth 4 -type f -name '*.json' -o -maxdepth 1 -name '*.md' | sort
