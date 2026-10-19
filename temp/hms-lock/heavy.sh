#!/bin/sh
# Host-wide limiter for heavy runs (full fast tier, Gradle builds, full test suites) on this 15.6 GB laptop.
# Usage: sh "$TEMP/hms-lock/heavy.sh" <label> <command> [args...]
# At most two heavy runs at once (the second only with >= 3.5 GB free); others wait. A slot older than 90 minutes is treated as stale.
# Lives outside every repository on purpose.
LOCKROOT="/c/Users/Surface/AppData/Local/Temp/hms-lock"
label="$1"; shift
[ -n "$label" ] && [ $# -gt 0 ] || { echo "usage: heavy.sh <label> <command> [args...]" >&2; exit 2; }
slot=""
waited=0
while [ -z "$slot" ]; do
  for s in 1 2; do
    d="$LOCKROOT/slot$s.lock"
    # The second slot only when the host has room (the WP-0.2 cell lives in the same 15.6 GB).
    if [ "$s" = 2 ]; then
      free_kb=$(awk '/^MemFree:/ {print $2}' /proc/meminfo 2>/dev/null)
      [ -n "$free_kb" ] && [ "$free_kb" -lt 3500000 ] && continue
    fi
    if [ -d "$d" ] && [ -n "$(find "$d" -maxdepth 0 -mmin +90 2>/dev/null)" ]; then
      echo "heavy.sh: removing stale $d ($(cat "$d/owner" 2>/dev/null))" >&2
      rm -rf "$d"
    fi
    if mkdir "$d" 2>/dev/null; then
      slot="$d"
      echo "$label pid=$$ since=$(date -Is)" > "$d/owner"
      break
    fi
  done
  if [ -z "$slot" ]; then
    [ $((waited % 120)) -eq 0 ] && echo "heavy.sh: waiting for a slot ($(cat "$LOCKROOT"/slot*.lock/owner 2>/dev/null | tr '\n' ';'))" >&2
    sleep 15; waited=$((waited + 15))
  fi
done
trap 'rm -rf "$slot"' EXIT INT TERM
echo "heavy.sh: $label got $(basename "$slot") after ${waited}s" >&2
"$@"
