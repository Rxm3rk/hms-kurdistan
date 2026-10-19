#!/bin/sh
# HMS auto-save. Records the full working state of every HMS worktree that is on a branch
# (tracked changes plus new files that are not ignored) as a commit under refs/wip/<branch>.
# It never touches a branch, the staging area or any file in a worktree, and it never pushes.
# Each auto-save has two parents: the branch commit it was taken on, and the previous auto-save.
# That keeps every save reachable, so git gc never removes one.
#
# List saves:   git -C <worktree> log --oneline refs/wip/<branch>
# See changes:  git -C <worktree> diff HEAD refs/wip/<branch> --stat
# Restore one:  git -C <worktree> restore --source=refs/wip/<branch> --worktree -- <path>
#
# Run by the Windows scheduled task "HMS auto-save" every 10 minutes, through snapshot.vbs (hidden).
# Lives outside every repository on purpose, like the heavy-run limiter.
MAIN=/c/Users/Surface/.t3/projects/hospitalmanagementsystem
DIR=/c/Users/Surface/AppData/Local/hms-snapshot
LOG="$DIR/snapshot.log"
export GIT_TERMINAL_PROMPT=0 GIT_OPTIONAL_LOCKS=0
stamp=$(date '+%Y-%m-%d %H:%M:%S')

# One run at a time.
mkdir "$DIR/run.lock" 2>/dev/null || {
  [ -n "$(find "$DIR/run.lock" -maxdepth 0 -mmin +30 2>/dev/null)" ] && rm -rf "$DIR/run.lock" && mkdir "$DIR/run.lock" 2>/dev/null || exit 0
}
trap 'rm -rf "$DIR/run.lock"' EXIT INT TERM

git -C "$MAIN" worktree list --porcelain |
  awk '/^worktree /{wt=substr($0,10)} /^branch /{print wt "\t" substr($0,8)}' |
  while IFS="$(printf '\t')" read -r wt ref; do
    branch=${ref#refs/heads/}
    wip="refs/wip/$branch"
    gitdir=$(git -C "$wt" rev-parse --absolute-git-dir 2>/dev/null) || continue
    tmpidx="$gitdir/hms-autosave-index"
    # Start from a copy of the real index so unchanged files are not hashed again.
    cp "$gitdir/index" "$tmpidx" 2>/dev/null || rm -f "$tmpidx"
    if ! GIT_INDEX_FILE="$tmpidx" git -C "$wt" -c core.safecrlf=false add -A -- . \
        ':(exclude,glob)**/*.key' ':(exclude,glob)**/*.pem' ':(exclude,glob)**/*.p12' \
        ':(exclude,glob)**/*.pfx' ':(exclude,glob)**/*.jks' ':(exclude,glob)**/.env' \
        ':(exclude,glob)**/id_rsa*' ':(exclude,glob)**/id_ed25519*' 2>>"$LOG"; then
      echo "$stamp $branch: FAILED to read the worktree" >>"$LOG"; rm -f "$tmpidx"; continue
    fi
    tree=$(GIT_INDEX_FILE="$tmpidx" git -C "$wt" write-tree 2>>"$LOG")
    rm -f "$tmpidx"
    [ -n "$tree" ] || { echo "$stamp $branch: FAILED to write the tree" >>"$LOG"; continue; }
    head=$(git -C "$wt" rev-parse HEAD)
    prev=$(git -C "$wt" rev-parse -q --verify "$wip" 2>/dev/null)
    if [ -n "$prev" ]; then
      # Unchanged since the last save, and that save was taken on the current branch commit.
      [ "$(git -C "$wt" rev-parse "$prev^{tree}")" = "$tree" ] &&
        [ "$(git -C "$wt" rev-parse "$prev^1")" = "$head" ] && continue
      commit=$(echo "auto-save $stamp on $branch" | git -C "$wt" commit-tree "$tree" -p "$head" -p "$prev")
    else
      # No uncommitted work: nothing to save yet.
      [ "$(git -C "$wt" rev-parse "HEAD^{tree}")" = "$tree" ] && continue
      commit=$(echo "auto-save $stamp on $branch" | git -C "$wt" commit-tree "$tree" -p "$head")
    fi
    [ -n "$commit" ] || { echo "$stamp $branch: FAILED to record the save" >>"$LOG"; continue; }
    git -C "$wt" update-ref -m "auto-save $stamp" "$wip" "$commit" $prev
    echo "$stamp $branch: saved $(git -C "$wt" rev-parse --short "$commit") ($(git -C "$wt" diff --shortstat HEAD "$commit" | sed 's/^ *//'))" >>"$LOG"
  done

# Off-laptop copy. The human approved the private repo Rxm3rk/hms-kurdistan on 19 Oct 2026.
# Uploads main, the branches checked out in a worktree on this machine, and this machine's auto-saves
# (as refs/wip/windows/*). Never forced: a rejected ref stays rejected and is logged.
# Nothing is uploaded unless a secret scan of every commit GitHub does not have yet comes back clean.
upload() {
  git -C "$MAIN" remote get-url origin >/dev/null 2>&1 || return 0
  branches="main $(git -C "$MAIN" worktree list --porcelain | sed -n 's#^branch refs/heads/##p' | grep -vx main)"
  mkdir -p "$DIR/scan"
  report="$DIR/scan/last.json"
  heads=""; for b in $branches; do heads="$heads refs/heads/$b"; done
  if ! "$MAIN/.tools/bin/gitleaks.exe" git --config "$MAIN/.gitleaks.toml" --redact --no-banner \
      --log-opts="--full-history -m$heads --glob=refs/wip/* --not --remotes=origin --glob=refs/hms-pushed/*" \
      --report-format json --report-path "$report" "$MAIN" >/dev/null 2>&1; then
    echo "$stamp UPLOAD BLOCKED: the secret scan failed or found something; see $report" >>"$LOG"
    return 0
  fi
  specs=""
  for b in $branches; do specs="$specs refs/heads/$b:refs/heads/$b"; done
  wips=$(git -C "$MAIN" for-each-ref --format='%(refname)' 'refs/wip/')
  for r in $wips; do specs="$specs $r:refs/wip/windows/${r#refs/wip/}"; done
  if out=$(git -C "$MAIN" -c http.postBuffer=524288000 -c http.version=HTTP/1.1 \
      -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=120 push --porcelain origin $specs 2>&1); then
    # Remember what GitHub has, so the next scan only covers new commits.
    for r in $wips; do git -C "$MAIN" update-ref "refs/hms-pushed/${r#refs/}" "$r"; done
    n=$(printf '%s\n' "$out" | grep -cE '^[ *+-]	')
    echo "$stamp uploaded to GitHub ($n refs updated)" >>"$LOG"
  else
    echo "$stamp UPLOAD FAILED: $(printf '%s\n' "$out" | grep -iE 'fatal|error|rejected|!' | head -3 | tr '\n' ' ')" >>"$LOG"
  fi
}
upload

# The boss-demo prototype (C:\Users\Surface\hms-demo; outside the product repo, its own local git repo,
# never uploaded): commit any change so the demo work is never lost either.
DEMO=/c/Users/Surface/hms-demo
if [ -d "$DEMO/.git" ] && [ -n "$(git -C "$DEMO" status --porcelain 2>/dev/null)" ]; then
  git -C "$DEMO" add -A 2>>"$LOG" && git -C "$DEMO" commit -q -m "auto-save $stamp" 2>>"$LOG" &&
    echo "$stamp hms-demo: saved $(git -C "$DEMO" rev-parse --short HEAD)" >>"$LOG"
fi
exit 0
