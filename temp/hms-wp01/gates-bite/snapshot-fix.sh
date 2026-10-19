#!/usr/bin/env bash
# Debug helper: snapshot the Windows checkout's working tree (tracked and untracked, not ignored) into an
# unreferenced commit of the throwaway clone, to try the plants against the in-progress fix.
# Read-only for the Windows checkout: a temporary index in the clone's .git is used, nothing is written
# to the Windows repository.
#   snapshot-fix.sh <windows checkout> <clone>
set -euo pipefail
src=$1
clone=$2
index="$clone/.git/snapshot-index"
rm -f "$index"
export GIT_INDEX_FILE="$index"
git --git-dir="$clone/.git" --work-tree="$src" read-tree 6ca3e3a
git --git-dir="$clone/.git" --work-tree="$src" -c core.autocrlf=false -c core.filemode=false add -A . 2> /dev/null
tree=$(git --git-dir="$clone/.git" write-tree)
commit=$(git --git-dir="$clone/.git" -c user.name=snapshot -c user.email=snapshot@hms.invalid \
  commit-tree "$tree" -p 6ca3e3a -m "snapshot of the in-progress WP-0.1 fix (scratch, unreferenced)")
rm -f "$index"
git --git-dir="$clone/.git" diff --stat 6ca3e3a "$commit" | tail -1 >&2
echo "$commit"
