#!/usr/bin/env bash
# Debug probe (not part of the record): merge attacks on the allowed-signers trust walk of the R-01 fix.
# Main line: anchor A (a human's key). Side line, from the commit before it: anchor B (the agent's key,
# no trailer). Then a merge, and a record signed by B for HAZ-0001 residual_risk.accepted_by.
#   probe-merge.sh <clone> <commit with the fix>
# Every variant is expected to FAIL; a PASS would be a gate defect.
set -uo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
clone=$1
target=$2
cd "$clone" || exit 2
[ -z "$(git status --short)" ] || { echo "dirty clone"; exit 2; }
git checkout -q --detach "$target"
eval "$(sh tools/bootstrap env)"
PY=.tools/venv/bin/python
EDIT=(python3 -I "$HERE/plant_edit.py")
S=docs/safety/signoffs/allowed-signers.yaml
work=$(mktemp -d /tmp/probe-merge.XXXXXX)
export GNUPGHOME="$work/gnupg"
mkdir -m 700 "$GNUPGHOME"
gpg --batch --quiet --passphrase '' --quick-gen-key "Dr Scratch Reviewer <scratch-reviewer@hms.invalid>" ed25519 sign never
gpg --batch --quiet --passphrase '' --quick-gen-key "HMS build agent (scratch) <build-agent@hms.invalid>" ed25519 sign never
A=$(gpg --list-secret-keys --with-colons scratch-reviewer@hms.invalid | awk -F: '/^fpr:/ {print $10; exit}')
B=$(gpg --list-secret-keys --with-colons build-agent@hms.invalid | awk -F: '/^fpr:/ {print $10; exit}')
ID=(-c "user.name=Scratch" -c "user.email=scratch@hms.invalid")
V=$("$PY" -I "$HERE/so_version.py" "$clone" HAZ-0001 accepted)
D=$(date +%F)

record_by_B() {
  "${EDIT[@]}" replace docs/safety/hazard-log.yaml 'accepted_by: null' 'accepted_by: Dr Scratch Reviewer' '- id: HAZ-0001'
  cat > docs/safety/signoffs/SO-2026-0001.yaml <<EOF
id: SO-2026-0001
subject: HAZ-0001
subject_version: "$V"
field: residual_risk.accepted_by
role: cso
name: Dr Scratch Reviewer
date: "$D"
statement: Scratch record for a probe.
decision: accepted
authentication:
  method: signed-git-commit
EOF
  git add docs/safety/hazard-log.yaml docs/safety/signoffs/SO-2026-0001.yaml
  git "${ID[@]}" -c "user.signingkey=$B" commit -q -S -m "scratch: record signed by B"
}

check() {
  local label=$1 out code
  out=$(sh tools/hms safety check 2>&1)
  code=$?
  echo "== $label: exit $code"
  printf '%s\n' "$out" | grep -E '^(ERROR|WARN) .*(allowed-signers|SO-2026-0001|accepted_by)' | cut -c1-260 | head -4
}

reset() {
  git checkout -q --detach -f "$target"
  git reset -q --hard "$target"
  git clean -fdxq --exclude=.tools --exclude=node_modules
}

setup_sides() { # leaves HEAD at main (anchor A); SIDE holds the side commit (anchor B)
  git checkout -q --detach "$target"
  "${EDIT[@]}" signers-add "$S" "Dr Scratch Reviewer" cso "$B" "$D"
  git add "$S"
  git "${ID[@]}" commit -q -m "scratch: side anchor, lists B"
  SIDE=$(git rev-parse HEAD)
  git checkout -q --detach "$target"
  "${EDIT[@]}" signers-add "$S" "Dr Scratch Reviewer" cso "$A" "$D"
  git add "$S"
  git "${ID[@]}" commit -q -m "scratch: main anchor, lists A"
}

# 1. Unsigned merge keeping both keys (union).
setup_sides
git "${ID[@]}" merge -q --no-commit --no-ff "$SIDE" > /dev/null 2>&1
git checkout -q "$SIDE" -- "$S"
"${EDIT[@]}" signers-add "$S" "Dr Scratch Reviewer" cso "$A" "$D"
git add "$S"
git "${ID[@]}" commit -q -m "scratch: merge, union of A and B"
record_by_B
check "1 unsigned merge, union [B, A], record by B"
reset

# 2. Unsigned merge keeping the side's version [B] only.
setup_sides
git "${ID[@]}" merge -q --no-commit --no-ff -s ours "$SIDE" > /dev/null 2>&1
git checkout -q "$SIDE" -- "$S"
git add "$S"
git "${ID[@]}" commit -q -m "scratch: merge, side's version [B]"
record_by_B
check "2 unsigned merge, side's version [B], record by B"
reset

# 3. Merge keeping main's version [A], signed by A (legitimate merge); record by B.
setup_sides
git "${ID[@]}" merge -q --no-commit --no-ff -s ours "$SIDE" > /dev/null 2>&1
git "${ID[@]}" -c "user.signingkey=$A" commit -q -S -m "scratch: merge, keep [A], signed by A"
record_by_B
check "3 merge keeping [A] (signed by A), record by B"
reset

# 4. Union merge signed by A (a human merges the agent's branch without noticing the extra key).
setup_sides
git "${ID[@]}" merge -q --no-commit --no-ff "$SIDE" > /dev/null 2>&1
git checkout -q "$SIDE" -- "$S"
"${EDIT[@]}" signers-add "$S" "Dr Scratch Reviewer" cso "$A" "$D"
git add "$S"
git "${ID[@]}" -c "user.signingkey=$A" commit -q -S -m "scratch: merge, union, signed by A"
record_by_B
check "4 union merge signed by A, record by B"
reset

# 5. The side's anchor comes first: main anchors A later, on top of a merge of the side.
git checkout -q --detach "$target"
"${EDIT[@]}" signers-add "$S" "Dr Scratch Reviewer" cso "$B" "$D"
git add "$S"
git "${ID[@]}" commit -q -m "scratch: agent anchor first, lists B"
record_by_B
check "5 agent anchors B first, record by B (KA-011: expected PASS with the anchor warning)"
reset

gpgconf --kill gpg-agent
rm -rf "$work"
echo "clean: $(git status --short | wc -l) changes, HEAD $(git rev-parse --short HEAD)"
