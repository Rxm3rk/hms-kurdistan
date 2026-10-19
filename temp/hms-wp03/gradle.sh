#!/bin/sh
# WP-0.3 stream: run Gradle in the wp03 worktree, one build at a time in this worktree (shared build dirs),
# and through the host-wide limiter. Usage: sh /c/Users/Surface/AppData/Local/Temp/hms-wp03/gradle.sh <gradle args...>
WT=/c/Users/Surface/.t3/worktrees/hospitalmanagementsystem/t3-4f6f2a03
LOCK=/c/Users/Surface/AppData/Local/Temp/hms-wp03/gradle.lock
cd "$WT" || exit 2
eval "$(sh tools/bootstrap env)"
waited=0
until mkdir "$LOCK" 2>/dev/null; do
  if [ -n "$(find "$LOCK" -maxdepth 0 -mmin +60 2>/dev/null)" ]; then rm -rf "$LOCK"; continue; fi
  [ $((waited % 120)) -eq 0 ] && echo "wp03 gradle.sh: waiting for the worktree build lock ($(cat "$LOCK/owner" 2>/dev/null))" >&2
  sleep 10; waited=$((waited + 10))
done
echo "pid=$$ args=$* since=$(date -Is)" > "$LOCK/owner"
trap 'rm -rf "$LOCK"' EXIT INT TERM
sh /c/Users/Surface/AppData/Local/Temp/hms-lock/heavy.sh wp03 sh backend/gradlew -p backend --console=plain "$@"
