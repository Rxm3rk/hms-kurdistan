#!/usr/bin/env bash
# snapshot.sh (dry runs only): commit a snapshot of a working tree (tracked and untracked files, not
# ignored ones) as an unreferenced commit of a scratch clone, to try the plants against work that is not
# committed yet. A record of such a commit is a dry run, never a record of record.
#
#   bash snapshot.sh <worktree> <clone-dir> [base]
#
#   worktree   the checkout to snapshot; read only (a temporary index in the clone's .git is used)
#   clone-dir  a scratch clone (git config hms.scratchClone true) that already holds the base commit
#   base       the parent of the snapshot commit (default: the worktree's HEAD)
#
# Prints the snapshot commit; pass it to gates-bite.sh. Nothing is written to the worktree's repository.
# It needs bash; run it with bash or sh (no exec bit needed): under sh it re-runs itself with bash.
[ -n "${BASH_VERSION:-}" ] || exec bash "$0" "$@"
set -euo pipefail

die() { echo "snapshot: $*" >&2; exit 2; }

[ $# -ge 2 ] || die "usage: bash snapshot.sh <worktree> <clone-dir> [base]"
src=$1
clone=$2
srcgit=(env -u GIT_INDEX_FILE git -c "safe.directory=$(realpath "$src")" -C "$src")
base=${3:-$("${srcgit[@]}" rev-parse HEAD)}
[ "$(git -C "$clone" config --get hms.scratchClone)" = true ] || die "$clone is not marked as a scratch clone"
git -C "$clone" rev-parse --verify --quiet "$base^{commit}" > /dev/null ||
  die "the clone has no commit $base; fetch it first (setup-clone.sh)"
index="$clone/.git/snapshot-index"
rm -f "$index"
export GIT_INDEX_FILE="$index"
git --git-dir="$clone/.git" --work-tree="$src" read-tree "$base"
git --git-dir="$clone/.git" --work-tree="$src" -c core.autocrlf=false -c core.filemode=false add -A . 2> /dev/null
# A Windows checkout has no exec bits (core.filemode false): take each file's mode from the worktree's own
# index (ls-files only reads it), so that staged mode changes are in the snapshot.
exec_paths() { # git command...: the paths its 'ls-files -s' lists as 100755, one per line
  "$@" ls-files -s | awk -F '\t' '$1 ~ /^100755 / {print $2}' | sort
}
want=$(exec_paths "${srcgit[@]}")
have=$(exec_paths git --git-dir="$clone/.git" --work-tree="$src")
comm -23 <(printf '%s\n' "$want") <(printf '%s\n' "$have") | sed '/^$/d' | while IFS= read -r path; do
  git --git-dir="$clone/.git" --work-tree="$src" update-index --chmod=+x -- "$path" 2> /dev/null || true
done
comm -13 <(printf '%s\n' "$want") <(printf '%s\n' "$have") | sed '/^$/d' | while IFS= read -r path; do
  git --git-dir="$clone/.git" --work-tree="$src" update-index --chmod=-x -- "$path" 2> /dev/null || true
done
tree=$(git --git-dir="$clone/.git" write-tree)
commit=$(git --git-dir="$clone/.git" -c user.name=snapshot -c user.email=snapshot@hms.invalid \
  commit-tree "$tree" -p "$base" -m "snapshot of a working tree (scratch, unreferenced)")
rm -f "$index"
git --git-dir="$clone/.git" diff --stat "$base" "$commit" | tail -1 >&2
echo "$commit"
