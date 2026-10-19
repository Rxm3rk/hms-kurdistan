#!/bin/sh
# WP-0.3 stream: the full fast tier in the wp03 worktree, holding the worktree build lock and a limiter slot.
WT=/c/Users/Surface/.t3/worktrees/hospitalmanagementsystem/t3-4f6f2a03
LOCK=/c/Users/Surface/AppData/Local/Temp/hms-wp03/gradle.lock
cd "$WT" || exit 2
until mkdir "$LOCK" 2>/dev/null; do sleep 10; done
echo "pid=$$ fast-tier since=$(date -Is)" > "$LOCK/owner"
trap 'rm -rf "$LOCK"' EXIT INT TERM
sh /c/Users/Surface/AppData/Local/Temp/hms-lock/heavy.sh wp03 sh tools/ci/run fast --no-evidence "$@"
