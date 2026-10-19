#!/usr/bin/env bash
# Debug helper: show the first error lines of each log of a gates-bite run.  show-errors.sh <logdir> [glob]
dir=$1
glob=${2:-*.log}
for f in "$dir"/$glob; do
  case $f in */run.log) continue ;; esac
  echo "=== $(basename "$f")"
  awk 'f; /^$|^# ---- output ----$/{f=1}' "$f" | grep -E "${PATTERN:-^ERROR|FAIL|error|Error|failed|\bPASS\b}" | head -${N:-6} | cut -c1-260
done
