#!/bin/sh
# prepare.sh <cumulative-slices> <this-slice-paths...>: working tree and index = HEAD + this slice.
set -eu
W=/c/Users/Surface/.t3/worktrees/hospitalmanagementsystem/wp07
I=/c/Users/Surface/AppData/Local/Temp/hms-wp07/integrator
F=$I/final
cd "$W"
SLICES=$1; shift
# 1. restore every uncommitted file from the final snapshot
(cd "$F" && find . -type f | sed 's|^\./||') | while read f; do mkdir -p "$(dirname "$f")"; cp -p "$F/$f" "$f"; done
# 2. index back to HEAD
git reset -q
# 3. stage this slice's own paths
git add -- "$@"
# 4. programme docs holding the cumulative slices' entries
.tools/venv/Scripts/python.exe -I "$I/docs_for.py" "$F" "$W" "$SLICES"
git add -- docs/program/OPEN-QUESTIONS.md docs/program/KNOWN-ANOMALIES.md
# 5. make the working tree match the index: drop unstaged edits and untracked files (all are in the snapshot)
git diff --name-only -z | xargs -0 -r git checkout --
git ls-files --others --exclude-standard -z | xargs -0 -r rm -f
git status --short
