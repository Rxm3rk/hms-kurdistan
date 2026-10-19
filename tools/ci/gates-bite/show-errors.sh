#!/usr/bin/env bash
# show-errors.sh: show the first error lines of each log of a gates-bite.sh run.
#   bash show-errors.sh <record without .md>.logs [glob]   (PATTERN and N override the pattern and count)
# It needs bash; run it with bash or sh (no exec bit needed): under sh it re-runs itself with bash.
[ -n "${BASH_VERSION:-}" ] || exec bash "$0" "$@"
dir=$1
glob=${2:-*.log}
for f in "$dir"/$glob; do
  case $f in */run.log) continue ;; esac
  echo "=== $(basename "$f")"
  awk 'f; /^$|^# ---- output ----$/{f=1}' "$f" | grep -E "${PATTERN:-^ERROR|FAIL|error|Error|failed|\bPASS\b}" | head -${N:-6} | cut -c1-260
done
