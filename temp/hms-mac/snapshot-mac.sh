#!/bin/sh
# HMS auto-save, MacBook version (adapted by the build lead on 19 Oct 2026 from the Windows laptop's).
# Every 10 minutes (launchd job com.hms.autosave):
#  1. For each branch listed in ~/.hms-snapshot/branches that is checked out in a worktree, records the
#     worktree's full state (tracked changes plus new files that are not ignored) as a commit under
#     refs/wip/<branch>. It never touches a branch, the staging area or any file in the worktree.
#     Each save has two parents, the branch commit and the previous save, so git gc never drops one.
#  2. Uploads those branches (never forced) and the saves (as refs/wip/mac/*) to the private GitHub repo,
#     only if a secret scan of every commit GitHub does not have yet comes back clean.
#
# List saves:   git -C <worktree> log --oneline refs/wip/<branch>
# Restore one:  git -C <worktree> restore --source=refs/wip/<branch> --worktree -- <path>
# Log:          ~/.hms-snapshot/snapshot.log
MAIN="$HOME/src/hms-kurdistan"
DIR="$HOME/.hms-snapshot"
LOG="$DIR/snapshot.log"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
export GIT_TERMINAL_PROMPT=0 GIT_OPTIONAL_LOCKS=0
stamp=$(date '+%Y-%m-%d %H:%M:%S')
mkdir -p "$DIR"
touch "$DIR/branches"

# One run at a time.
mkdir "$DIR/run.lock" 2>/dev/null || {
  [ -n "$(find "$DIR/run.lock" -maxdepth 0 -mmin +30 2>/dev/null)" ] && rm -rf "$DIR/run.lock" && mkdir "$DIR/run.lock" 2>/dev/null || exit 0
}
trap 'rm -rf "$DIR/run.lock"' EXIT INT TERM

owned() { grep -qxF "$1" "$DIR/branches"; }

git -C "$MAIN" worktree list --porcelain |
  awk '/^worktree /{wt=substr($0,10)} /^branch /{print wt "\t" substr($0,8)}' |
  while IFS="$(printf '\t')" read -r wt ref; do
    branch=${ref#refs/heads/}
    owned "$branch" || continue
    wip="refs/wip/$branch"
    gitdir=$(git -C "$wt" rev-parse --absolute-git-dir 2>/dev/null) || continue
    tmpidx="$gitdir/hms-autosave-index"
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
      [ "$(git -C "$wt" rev-parse "$prev^{tree}")" = "$tree" ] &&
        [ "$(git -C "$wt" rev-parse "$prev^1")" = "$head" ] && continue
      commit=$(echo "auto-save $stamp on $branch (mac)" | git -C "$wt" commit-tree "$tree" -p "$head" -p "$prev")
    else
      [ "$(git -C "$wt" rev-parse "HEAD^{tree}")" = "$tree" ] && continue
      commit=$(echo "auto-save $stamp on $branch (mac)" | git -C "$wt" commit-tree "$tree" -p "$head")
    fi
    [ -n "$commit" ] || { echo "$stamp $branch: FAILED to record the save" >>"$LOG"; continue; }
    git -C "$wt" update-ref -m "auto-save $stamp" "$wip" "$commit" $prev
    echo "$stamp $branch: saved $(git -C "$wt" rev-parse --short "$commit") ($(git -C "$wt" diff --shortstat HEAD "$commit" | sed 's/^ *//'))" >>"$LOG"
  done

upload() {
  branches=$(cat "$DIR/branches")
  [ -n "$branches" ] || return 0
  mkdir -p "$DIR/scan"
  report="$DIR/scan/last.json"
  heads=""; for b in $branches; do heads="$heads refs/heads/$b"; done
  if ! "$MAIN/.tools/bin/gitleaks" git --config "$MAIN/.gitleaks.toml" --redact --no-banner \
      --log-opts="--full-history -m$heads --glob=refs/wip/* --not --remotes=origin --glob=refs/hms-pushed/*" \
      --report-format json --report-path "$report" "$MAIN" >/dev/null 2>&1; then
    echo "$stamp UPLOAD BLOCKED: the secret scan failed or found something; see $report" >>"$LOG"
    return 0
  fi
  specs=""
  for b in $branches; do specs="$specs refs/heads/$b:refs/heads/$b"; done
  pushed_wips=""
  for b in $branches; do
    if git -C "$MAIN" rev-parse -q --verify "refs/wip/$b" >/dev/null; then
      specs="$specs refs/wip/$b:refs/wip/mac/$b"; pushed_wips="$pushed_wips refs/wip/$b"
    fi
  done
  if out=$(git -C "$MAIN" push --porcelain origin $specs 2>&1); then
    for r in $pushed_wips; do git -C "$MAIN" update-ref "refs/hms-pushed/${r#refs/}" "$r"; done
    n=$(printf '%s\n' "$out" | grep -cE '^[ *+-]	')
    echo "$stamp uploaded to GitHub ($n refs updated)" >>"$LOG"
  else
    echo "$stamp UPLOAD FAILED: $(printf '%s\n' "$out" | grep -iE 'fatal|error|rejected|!' | head -3 | tr '\n' ' ')" >>"$LOG"
  fi
}
upload
exit 0
