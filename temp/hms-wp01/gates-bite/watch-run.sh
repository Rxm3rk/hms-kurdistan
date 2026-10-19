#!/usr/bin/env bash
# Debug helper: print new result lines of a gates-bite run log; exit when the run has finished.
#   watch-run.sh <run.log>
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
