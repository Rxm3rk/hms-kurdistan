#!/bin/bash
# The WP-0.1 run of record in the WSL clone at a committed SHA (run with 'bash -l', a login shell).
set -uo pipefail
cd "$HOME/src/hospitalmanagementsystem" || exit 2
OUT=/tmp/hms-evidence; rm -rf "$OUT"; mkdir -p "$OUT"
git clean -fdq && git fetch -q origin && git checkout -q --detach origin/wp/0.1-programme-bootstrap
echo "== HEAD $(git rev-parse --short HEAD); changes before run: $(git status --porcelain | wc -l)"
sh tools/bootstrap 2>&1 | tail -2; echo "== bootstrap exit=${PIPESTATUS[0]}"
sh tools/ci/run fast 2>&1; echo "== fast exit=$?"
SHA=$(git rev-parse --short HEAD)
cp docs/program/evidence/ci/*-fast-*.json "$OUT"/
git clean -fdq
sh tools/doctor > "$OUT/2026-10-18-$SHA.txt" 2>&1; echo "== doctor exit=$?"
sh tools/doctor --json 2>/dev/null | tail -n 1 > "$OUT/2026-10-18-$SHA.json"
ls -la "$OUT"; echo "== changes after run: $(git status --porcelain | wc -l)"
