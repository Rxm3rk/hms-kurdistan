#!/usr/bin/env bash
# Debug helper: stop a running gates-bite.sh and return the throwaway clone to a clean detached commit.
#   stop-run.sh <clone> <commit>
clone=$1
commit=$2
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
echo "HEAD $(git rev-parse --short HEAD); status lines: $(git status --short | wc -l)"
git for-each-ref --format='%(refname)' refs/heads
