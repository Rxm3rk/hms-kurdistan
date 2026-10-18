#!/usr/bin/env bash
# setup-clone.sh: make (or refresh) a scratch clone for gates-bite.sh and mark it as scratch.
#
#   bash setup-clone.sh <source> <clone-dir> [commit]
#
#   source     the repository to clone or fetch from (a path or URL), for example the WSL checkout
#   clone-dir  the scratch clone; created if missing. An existing directory must already be marked as a
#              scratch clone (git config hms.scratchClone true) and have no uncommitted changes
#   commit     checked out detached when given; it must be reachable from a branch of the source
#
# The clone gets core.autocrlf false and hms.scratchClone true. Never point clone-dir at a checkout that
# holds work: gates-bite.sh resets and cleans the clone it plants in.
# It needs bash; run it with bash or sh (no exec bit needed): under sh it re-runs itself with bash.
[ -n "${BASH_VERSION:-}" ] || exec bash "$0" "$@"
set -euo pipefail

die() { echo "setup-clone: $*" >&2; exit 2; }

[ $# -ge 2 ] || die "usage: bash setup-clone.sh <source> <clone-dir> [commit]"
src=$1
dest=$2
commit=${3:-}

case "$(realpath -m "$dest")" in /mnt/*) die "refusing $dest: a Windows checkout is never planted in" ;; esac
if [ -e "$dest" ]; then
  [ -d "$dest/.git" ] || die "$dest exists and is not a git clone"
  [ "$(git -C "$dest" config --get hms.scratchClone)" = true ] ||
    die "$dest exists and is not marked as a scratch clone; choose a new directory"
  [ -z "$(git -C "$dest" status --short)" ] || die "$dest has uncommitted changes"
  git -C "$dest" fetch -q "$src" '+refs/heads/*:refs/remotes/origin/*'
else
  git clone -q "$src" "$dest"
fi
git -C "$dest" config core.autocrlf false
git -C "$dest" config hms.scratchClone true
if [ -n "$commit" ]; then
  git -C "$dest" checkout -q --detach "$commit"
fi
echo "scratch clone $(realpath "$dest") at $(git -C "$dest" rev-parse --short HEAD); status lines: $(git -C "$dest" status --short | wc -l)"
