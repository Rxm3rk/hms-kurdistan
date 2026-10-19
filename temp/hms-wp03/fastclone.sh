#!/bin/sh
# WP-0.3 stream: run the full fast tier on an exact copy of the wp03 worktree's current files, in a
# single-branch scratch clone whose only branch is wp/0.3-platform-kernel. Reason: the shared repository
# holds host-created t3/* branches that fail repo check's §3.6 branch-name rule (DN-041); a clone made with
# --single-branch and no remote has none. Holds the worktree build lock and a host limiter slot.
set -e
WT=/c/Users/Surface/.t3/worktrees/hospitalmanagementsystem/t3-4f6f2a03
CL=/c/Users/Surface/AppData/Local/Temp/hms-wp03/fastclone
LOCK=/c/Users/Surface/AppData/Local/Temp/hms-wp03/gradle.lock
until mkdir "$LOCK" 2>/dev/null; do sleep 10; done
echo "pid=$$ fastclone since=$(date -Is)" > "$LOCK/owner"
trap 'rm -rf "$LOCK"' EXIT INT TERM
if [ ! -d "$CL/.git" ]; then
  git clone --quiet --single-branch --branch wp/0.3-platform-kernel "$WT" "$CL"
  git -C "$CL" remote remove origin
  ( cd "$CL" && powershell.exe -NoProfile -Command "New-Item -ItemType Junction -Path .tools -Target C:\Users\Surface\.t3\projects\hospitalmanagementsystem\.tools | Out-Null" )
fi
cd "$CL"
git fetch --quiet "$WT" wp/0.3-platform-kernel
git checkout --quiet -B wp/0.3-platform-kernel FETCH_HEAD
git reset --quiet --hard FETCH_HEAD
git clean --quiet -fd -e .tools
# Overlay the worktree's tracked and untracked (not ignored) files, and remove files deleted there.
( cd "$WT" && git ls-files -co --exclude-standard -z ) | ( cd "$WT" && xargs -0 tar cf - ) | tar xf -
( cd "$WT" && git ls-files -d -z ) | xargs -0 -r rm -f
if [ ! -d frontend/node_modules ]; then
  ( cd frontend && COREPACK_HOME='C:\Users\Surface\.t3\projects\hospitalmanagementsystem\.tools\corepack' corepack pnpm install --frozen-lockfile --offline >/dev/null )
fi
echo "fastclone: HEAD $(git rev-parse --short HEAD) + worktree overlay; branches: $(git for-each-ref --format='%(refname:short)' refs/heads refs/remotes | tr '\n' ' ')"
sh /c/Users/Surface/AppData/Local/Temp/hms-lock/heavy.sh wp03 sh tools/ci/run fast --no-evidence "$@"
