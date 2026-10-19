#!/usr/bin/env bash
# stop-run.sh: stop a running gates-bite.sh and return its scratch clone to a clean detached commit.
#
#   bash stop-run.sh <clone-dir> <commit>
#
# The temporary GPG home of a stopped run stays under /tmp/gates-bite.*; delete it after stopping the
# gpg-agent that uses it (this script does both).
# It needs bash; run it with bash or sh (no exec bit needed): under sh it re-runs itself with bash.
[ -n "${BASH_VERSION:-}" ] || exec bash "$0" "$@"
clone=$1
commit=$2
[ "$(git -C "$clone" config --get hms.scratchClone)" = true ] || { echo "stop-run: $clone is not marked as a scratch clone" >&2; exit 2; }
pkill -f 'gates-bite\.sh' && echo "stopped gates-bite.sh"
sleep 3
cd "$clone" || exit 1
sh backend/gradlew -p backend --stop > /dev/null 2>&1
git checkout -q --detach -f "$commit"
git reset -q --hard "$commit"
for b in wp/9.9-syn-tenant-0001 customer-acme feature/scratch wp/9.9-scratch-secret; do
  git branch -q -D "$b" 2>/dev/null && echo "deleted branch $b"
done
git clean -fdxq --exclude=.tools --exclude=node_modules
for work in /tmp/gates-bite.*; do
  [ -d "$work" ] || continue
  [ -d "$work/gnupg" ] && GNUPGHOME="$work/gnupg" gpgconf --kill gpg-agent > /dev/null 2>&1
  rm -rf "$work" && echo "deleted $work"
done
echo "HEAD $(git rev-parse --short HEAD); status lines: $(git status --short | wc -l)"
git for-each-ref --format='%(refname)' refs/heads
