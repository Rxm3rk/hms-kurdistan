#!/usr/bin/env bash
# watch-run.sh: print the result lines of a gates-bite.sh run as they arrive; exit when the run has finished.
#   bash watch-run.sh <record without .md>.logs/run.log
# It needs bash; run it with bash or sh (no exec bit needed): under sh it re-runs itself with bash.
[ -n "${BASH_VERSION:-}" ] || exec bash "$0" "$@"
log=$1
seen=0
for _ in $(seq 1 1800); do
  if [ -f "$log" ]; then
    total=$(wc -l < "$log")
    if [ "$total" -gt "$seen" ]; then
      sed -n "$((seen + 1)),${total}p" "$log" | grep -E --line-buffered 'plant [0-9]+ \[|: (FAIL|PASS|NOT-PLANTED) \(exit|wait done|NOTE|stopped|record written|UNEXPECTED|logs:' | cut -c1-240
      seen=$total
    fi
    grep -q ' logs: ' "$log" && exit 0
  fi
  sleep 2
done
