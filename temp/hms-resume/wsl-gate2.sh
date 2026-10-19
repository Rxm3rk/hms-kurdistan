#!/bin/bash
set -uo pipefail
cd "$HOME/src/hospitalmanagementsystem" || exit 2
OUT=/tmp/hms-evidence; rm -rf "$OUT"; mkdir -p "$OUT"
echo "== HEAD $(git rev-parse --short HEAD); changes before run: $(git status --porcelain | wc -l)"
sh tools/ci/run fast 2>&1; echo "== fast exit=$?"
SHA=$(git rev-parse --short HEAD)
cp docs/program/evidence/ci/*-fast-*.json "$OUT"/
sh tools/doctor > "$OUT/2026-10-18-$SHA.txt" 2>&1; echo "== doctor exit=$?"
sh tools/doctor --json 2>/dev/null | tail -n 1 > "$OUT/2026-10-18-$SHA.json"
ls -la "$OUT"; echo "== changes after run (evidence file expected): $(git status --porcelain)"
