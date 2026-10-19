#!/bin/bash
# The WP-0.1 run of record in the WSL clone at a committed SHA.
set -uo pipefail
cd "$HOME/src/hospitalmanagementsystem" || exit 2
OUT=/tmp/hms-evidence; rm -rf "$OUT"; mkdir -p "$OUT"
git clean -fdq                                   # drop the working-tree overlay; ignored .tools/ stays
git fetch -q origin
git checkout -q --detach origin/wp/0.1-programme-bootstrap
echo "== HEAD $(git rev-parse --short HEAD) $(git log -1 --format=%s)"
git status --short | head -5; echo "== status lines: $(git status --short | wc -l)"
time sh tools/bootstrap; echo "== bootstrap exit=$?"
time sh tools/ci/run fast; echo "== fast exit=$?"
ls docs/program/evidence/ci/ | tail -3
cp docs/program/evidence/ci/*-fast-*.json "$OUT"/ 2>/dev/null
SHA=$(git rev-parse --short HEAD)
sh tools/doctor > "$OUT/2026-10-18-$SHA.txt" 2>&1; echo "== doctor exit=$?"
sh tools/doctor --json 2>/dev/null | tail -n 1 > "$OUT/2026-10-18-$SHA.json"; echo "== doctor --json exit=${PIPESTATUS[0]}"
git status --short | head; ls -la "$OUT"
