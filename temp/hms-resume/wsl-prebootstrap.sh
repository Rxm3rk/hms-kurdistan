#!/bin/bash
# Creates the WSL clone and pre-fetches the Linux project-local toolchain into its .tools/ (git-ignored),
# using a copy of the not-yet-committed working tree. The copy is replaced by the committed branch later.
set -euo pipefail
SRC=/mnt/c/Users/Surface/.t3/projects/hospitalmanagementsystem
DST=$HOME/src/hospitalmanagementsystem
mkdir -p "$HOME/src"
if [ ! -d "$DST/.git" ]; then
  git -c safe.directory="$SRC" clone --no-hardlinks "$SRC" "$DST"
fi
cd "$DST"
git config core.autocrlf false
rsync -a --exclude=.git --exclude=.tools --exclude=node_modules --exclude=build --exclude=.gradle \
  --exclude=.kotlin --exclude=reports --exclude=__pycache__ "$SRC/" "$DST/"
echo "== clone at $(git rev-parse --short HEAD); working tree overlaid from Windows"
time sh tools/bootstrap --gradle-mirror https://mirrors.aliyun.com/gradle/distributions/v9.8.1/
echo "== bootstrap exit=$?"
