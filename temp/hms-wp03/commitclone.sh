#!/bin/sh
# WP-0.3: run the full fast tier on exactly what the next commit will hold: the worktree's HEAD plus the
# listed paths copied from the worktree (nothing else), in the scratch clone. Leaves the worktree build
# lock alone (separate build dirs), takes a host limiter slot.  Usage: commitclone.sh <path>...
set -e
WT=/c/Users/Surface/.t3/worktrees/hospitalmanagementsystem/t3-4f6f2a03
CL=/c/Users/Surface/AppData/Local/Temp/hms-wp03/fastclone
cd "$CL"
git fetch --quiet "$WT" wp/0.3-platform-kernel
git checkout --quiet -B wp/0.3-platform-kernel FETCH_HEAD
git reset --quiet --hard FETCH_HEAD
git clean --quiet -fd -e .tools
( cd "$WT" && git ls-files -co --exclude-standard -z -- "$@" | xargs -0 tar cf - ) | tar xf -
git add -A
echo "commitclone: HEAD $(git rev-parse --short HEAD); staged: $(git diff --cached --name-only | wc -l) files; branches: $(git for-each-ref --format='%(refname:short)' refs/heads | tr '\n' ' ')"
sh /c/Users/Surface/AppData/Local/Temp/hms-lock/heavy.sh wp03 sh tools/ci/run fast --no-evidence
