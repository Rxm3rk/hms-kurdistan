#!/usr/bin/env bash
# One-off setup of the throwaway clone ~/src/hms-plant for the gates-bite dry run.
set -euo pipefail
SRC=/mnt/c/Users/Surface/.t3/projects/hospitalmanagementsystem
DEST="$HOME/src/hms-plant"
LOG=/tmp/hms-plant-setup.log
exec > >(tee -a "$LOG") 2>&1
echo "== $(date -Is) setup start"
if [ ! -d "$DEST/.git" ]; then
  git clone "$SRC" "$DEST"
fi
cd "$DEST"
git config core.autocrlf false
git checkout --detach 6ca3e3a
git status --short
start=$(date +%s)
sh tools/bootstrap "$@"
echo "== bootstrap exit 0 in $(( $(date +%s) - start )) s"
git status --short
echo "== $(date -Is) setup done"
