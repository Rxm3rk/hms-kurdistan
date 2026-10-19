#!/bin/sh
# WP-0.5 only: serialise Gradle runs inside the wp05 worktree, then pass through the host-wide limiter.
# Usage: sh /c/Users/Surface/AppData/Local/Temp/wp05/gradle.sh <gradle args...>
LOCK=/c/Users/Surface/AppData/Local/Temp/wp05/gradle.lock
ROOT=/c/Users/Surface/.t3/worktrees/hospitalmanagementsystem/t3-5dcdaa39
waited=0
until mkdir "$LOCK" 2>/dev/null; do
  if [ -n "$(find "$LOCK" -maxdepth 0 -mmin +240 2>/dev/null)" ]; then echo "wp05 gradle.sh: removing stale lock ($(cat "$LOCK/owner" 2>/dev/null))" >&2; rm -rf "$LOCK"; continue; fi
  [ $((waited % 120)) -eq 0 ] && echo "wp05 gradle.sh: waiting for the worktree Gradle lock ($(cat "$LOCK/owner" 2>/dev/null))" >&2
  sleep 10; waited=$((waited + 10))
done
echo "pid=$$ since=$(date -Is) args=$*" > "$LOCK/owner"
trap 'rm -rf "$LOCK"' EXIT INT TERM
cd "$ROOT" || exit 2
eval "$(sh tools/bootstrap env)"
sh /c/Users/Surface/AppData/Local/Temp/hms-lock/heavy.sh wp05 sh backend/gradlew -p backend "$@"
