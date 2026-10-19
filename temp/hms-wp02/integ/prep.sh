#!/bin/bash
# WP-0.2 checkpoint integrator: build an exact copy of a commit candidate's tree in a WSL scratch clone.
# Usage: prep.sh <parent-sha> <expected-tree-sha> <tar-path-in-wsl> <label>
# Scratch only (/tmp/hms-integ); reads the Windows repository; never writes to it.
set -eu
PARENT=$1; TREE=$2; TAR=$3; LABEL=$4
T=/tmp/hms-integ/tree
SRC=/mnt/c/Users/Surface/.t3/projects/hospitalmanagementsystem
if [ ! -d $T/.git ]; then
  mkdir -p /tmp/hms-integ
  git clone -q --branch wp/0.2-environments "$SRC" $T
  ln -s /home/surface/src/hms-wp02/.tools $T/.tools
fi
cd $T
git fetch -q origin wp/0.2-environments
git checkout -q --detach "$PARENT"
git reset -q --hard "$PARENT"
git clean -q -fd -e .tools -e frontend/node_modules -e build -e .gradle -e 'backend/**/build'
git ls-files -z | xargs -0 rm -f
tar -xf "$TAR"
git add -A
got=$(git write-tree)
echo "expected tree $TREE"
echo "scratch  tree $got"
[ "$got" = "$TREE" ] || { echo "TREE MISMATCH"; git status --short | head -20; exit 1; }
git -c user.name=integrator-scratch -c user.email=scratch@invalid commit -q -m "scratch candidate $LABEL (tree $TREE)" \
  -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git log --oneline -1
git status --short | wc -l
