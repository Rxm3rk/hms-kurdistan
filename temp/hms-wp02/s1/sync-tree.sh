#!/bin/bash
# Scratch WSL copy of the wp02 worktree for the S1 cell run: a clone at the branch HEAD plus the worktree's
# uncommitted files, so records carry the real short SHA and dirty flag. Reads the repository; writes only /tmp.
set -eu
T=/tmp/hms-s1/tree
SRC=/mnt/c/Users/Surface/.t3/worktrees/hospitalmanagementsystem/wp02
if [ ! -d $T/.git ]; then
  git clone -q --branch wp/0.2-environments /mnt/c/Users/Surface/.t3/projects/hospitalmanagementsystem $T
fi
git -C $T fetch -q origin wp/0.2-environments && git -C $T checkout -q -B wp/0.2-environments FETCH_HEAD 2>/dev/null || true
rsync -a --delete --exclude .git --exclude .tools --exclude node_modules --exclude __pycache__ --exclude build \
  --exclude 'frontend/reports' --exclude '.gradle' "$SRC/" "$T/"
git -C $T log --oneline -1
git -C $T status --short | head -40
