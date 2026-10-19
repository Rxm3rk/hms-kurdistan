#!/usr/bin/env bash
# gates-bite.sh: prove that each fast-tier gate of HMS Kurdistan fails on a planted violation and passes
# once it is removed (BUILD-PROMPT §3.5, §19.1). Plants one violation at a time, runs only the gate
# concerned, records FAIL or PASS with the line that names the violation, then resets the clone.
#
#   bash gates-bite.sh <record.md> <commit> [clone-dir]
#
#   record.md  where the Markdown record is written (must be outside the clone); the full logs go to
#              <record without .md>.logs/
#   commit     the commit to test; the clone is checked out at it, detached
#   clone-dir  the WSL clone to run in (default: the git top level of the current directory)
#
# Environment:
#   HMS_GB_WAIT_PATTERN  before the Gradle plants, wait while 'pgrep -f' finds this (default: failover-v2;
#                        empty to skip)
#   HMS_GB_WAIT_MAX      the longest wait in seconds (default 1200), then go ahead anyway and note it
#
# The script DESTROYS uncommitted work in the clone (git reset --hard, git clean -fdx), so it refuses a
# clone with changes, and any clone under /mnt/ (a Windows checkout).
set -uo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
SCRIPT="$HERE/$(basename "$0")"
EDIT=(python3 -I "$HERE/plant_edit.py")
REC=(python3 -I "$HERE/gb_record.py")

die() { echo "gates-bite: $*" >&2; exit 2; }

[ $# -ge 2 ] || die "usage: bash gates-bite.sh <record.md> <commit> [clone-dir]"
RECORD=$(realpath -m "$1")
TARGET=$2
CLONE=${3:-$(git rev-parse --show-toplevel 2>/dev/null || true)}
[ -n "$CLONE" ] && [ -d "$CLONE/.git" ] || die "no clone: give the clone directory as the third argument"
CLONE=$(realpath "$CLONE")
case "$CLONE" in /mnt/*) die "refusing to run in $CLONE: a Windows checkout is never planted in" ;; esac
case "$RECORD" in "$CLONE"/*) die "the record must be written outside the clone ($RECORD)" ;; esac
case "$RECORD" in *.md) ;; *) die "the record path must end in .md" ;; esac
command -v python3 >/dev/null || die "python3 is missing"
command -v gpg >/dev/null || die "gpg is missing (needed for the signed sign-off plants)"

cd "$CLONE" || die "cannot cd to $CLONE"
REC_ROW=("${REC[@]}" row --strip "$CLONE/")
[ -z "$(git status --short)" ] || die "the clone has uncommitted changes; refusing to reset it: $(git status --short | head -5 | tr '\n' ' ')"
TARGET_SHA=$(git rev-parse --verify --quiet "$TARGET^{commit}") || die "unknown commit $TARGET"
SHORT_SHA=$(git rev-parse --short "$TARGET_SHA")

LOGDIR="${RECORD%.md}.logs"
rm -rf "$LOGDIR"
mkdir -p "$LOGDIR" "$(dirname "$RECORD")"
RESULTS="$LOGDIR/results.jsonl"
META="$LOGDIR/meta.json"
: > "$RESULTS"
WORK=$(mktemp -d /tmp/gates-bite.XXXXXX)
SCRATCH_GNUPGHOME="$WORK/gnupg"
export SCRATCH_GNUPGHOME

cleanup() {
  if [ -d "$SCRATCH_GNUPGHOME" ]; then GNUPGHOME="$SCRATCH_GNUPGHOME" gpgconf --kill gpg-agent >/dev/null 2>&1; fi
  rm -rf "$WORK"
}
trap cleanup EXIT

log() { printf '%s %s\n' "$(date +%H:%M:%S)" "$*" | tee -a "$LOGDIR/run.log" >&2; }
meta() { "${REC[@]}" meta --meta "$META" "$1" "$2"; }
NOTES=""
note() { NOTES="$NOTES$*"$'\n'; log "NOTE: $*"; }

read -r START_UP _ < /proc/uptime
meta started "$(date -Is)"
meta date "$(date +%F)"
meta clone "$CLONE"
meta script "$(basename "$SCRIPT")"
meta script_sha256 "$(sha256sum "$SCRIPT" | cut -d' ' -f1)"
meta invocation "bash $(basename "$SCRIPT") $1 $TARGET${3:+ $3}"

# --------------------------------------------------------------------------- checkout and toolchain

log "checking out $TARGET_SHA (detached) in $CLONE"
git checkout -q --detach "$TARGET_SHA" || die "checkout failed"
meta sha "$TARGET_SHA"
meta short_sha "$SHORT_SHA"
meta subject "$(git log -1 --format=%s "$TARGET_SHA")"

log "sh tools/bootstrap"
t0=$(date +%s)
if sh tools/bootstrap > "$LOGDIR/00-bootstrap.log" 2>&1; then
  meta bootstrap "exit 0 in $(( $(date +%s) - t0 )) s"
else
  die "sh tools/bootstrap failed; see $LOGDIR/00-bootstrap.log"
fi
eval "$(sh tools/bootstrap env)" || die "sh tools/bootstrap env failed"
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
[ -z "$(git status --short)" ] || die "bootstrap left changes in the tree: $(git status --short | head -5 | tr '\n' ' ')"

PY="$CLONE/.tools/venv/bin/python"
meta uname "$(uname -srmo)"
meta os "$(. /etc/os-release && echo "$PRETTY_NAME")$(grep -qi microsoft /proc/version && echo ' (WSL2)')"
meta cpus "$(nproc)"
meta ram "$(free -m | awk '/^Mem:/ {printf "%.1f GiB", $2 / 1024}')"
meta java "$("$JAVA_HOME/bin/java" -version 2>&1 | head -1)"
meta node "$(node -v)"
meta pnpm "$(cd frontend && corepack pnpm --version 2>/dev/null)"
meta gitleaks "gitleaks $(.tools/bin/gitleaks version 2>/dev/null)"
meta python "$("$PY" -c 'import platform; print(platform.python_version())')"
meta git "$(git --version | awk '{print $3}')"
meta gpg "$(gpg --version | head -1)"

REFS0=$(git for-each-ref --format='%(refname) %(objectname)' refs/heads refs/tags)
SCRATCH_BRANCHES=()

tree_state_ok() {
  [ -z "$(git status --short)" ] &&
    [ "$(git rev-parse HEAD)" = "$TARGET_SHA" ] &&
    [ "$(git for-each-ref --format='%(refname) %(objectname)' refs/heads refs/tags)" = "$REFS0" ] &&
    [ -z "$(git symbolic-ref -q HEAD)" ]
}

tree_differs() {
  [ -n "$(git status --short)" ] ||
    [ "$(git rev-parse HEAD)" != "$TARGET_SHA" ] ||
    [ "$(git for-each-ref --format='%(refname) %(objectname)' refs/heads refs/tags)" != "$REFS0" ]
}

reset_tree() {
  git checkout -q --detach -f "$TARGET_SHA"
  git reset -q --hard "$TARGET_SHA"
  local branch
  for branch in "${SCRATCH_BRANCHES[@]}"; do git branch -q -D "$branch" 2>/dev/null; done
  SCRATCH_BRANCHES=()
  git clean -fdxq --exclude=.tools --exclude=node_modules
}

# --------------------------------------------------------------------------- plants and gates

PLANT_NO=0
CUR_GATE=""
CUR_PLANT=""
PLANT_OK=1
ROWS_IN_PLANT=0
EXPECT=FAIL
LABEL=""
PLANT_NA=""
PLANT_NA_NEXT=""

plant() { # gate, description [, expect: FAIL | PASS | REPORT-R01]
  tree_state_ok || { note "the tree was not clean before plant $((PLANT_NO + 1)); stopped"; finish 1; }
  PLANT_NO=$((PLANT_NO + 1))
  CUR_GATE=$1
  CUR_PLANT=$2
  EXPECT=${3:-FAIL}
  LABEL=${4:-}
  PLANT_OK=1
  ROWS_IN_PLANT=0
  # A plant that needs something the commit under test does not have is recorded as not applicable.
  PLANT_NA=${PLANT_NA_NEXT:-}
  PLANT_NA_NEXT=""
  log "---- plant $PLANT_NO [$CUR_GATE] $CUR_PLANT${PLANT_NA:+ (not applicable: $PLANT_NA)}"
}

# Run one step of a plant; a failing step marks the plant NOT-PLANTED. Skipped for a plant not applicable here.
p() {
  [ -n "$PLANT_NA" ] && return 0
  "$@" >> "$LOGDIR/run.log" 2>&1 || { log "plant step failed: $*"; PLANT_OK=0; }
}

slug() { echo "$1" | tr -c 'A-Za-z0-9\n' '-' | tr -s '-' | cut -c1-60; }

# run_cmd KIND COMMAND TIMEOUT_S -> sets RC, DUR, LOG
run_cmd() {
  local tag=$1 command=$2 limit=$3
  LOG="$LOGDIR/$(printf '%02d' "$PLANT_NO")-$tag-$(slug "$command").log"
  [ -e "$LOG" ] && LOG="${LOG%.log}-$RANDOM.log"
  {
    echo "# gate: $CUR_GATE"
    echo "# plant: $CUR_PLANT"
    echo "# command: $command"
    echo "# commit: $TARGET_SHA"
    echo "# ---- output ----"
  } > "$LOG"
  # Durations from /proc/uptime: monotonic, unlike the WSL wall clock, which can step backwards.
  local t0 t1 _
  read -r t0 _ < /proc/uptime
  timeout --kill-after=30 "$limit" bash -c "$command" >> "$LOG" 2>&1 < /dev/null
  RC=$?
  read -r t1 _ < /proc/uptime
  DUR=$(awk -v a="$t1" -v b="$t0" 'BEGIN {printf "%.1f", a - b}')
}

# gate COMMAND [options for gb_record.py row: --regex RE --also RE --pass-codes 0,3 --json-check --timeout S]
gate() {
  local command=$1
  shift
  local limit=900 args=()
  while [ $# -gt 0 ]; do
    case $1 in
      --timeout) limit=$2; shift 2 ;;
      *) args+=("$1"); shift ;;
    esac
  done
  local same=()
  [ "$ROWS_IN_PLANT" -gt 0 ] && same=(--same-plant)
  ROWS_IN_PLANT=$((ROWS_IN_PLANT + 1))
  [ -n "$LABEL" ] && args+=(--label "$LABEL")
  if [ -n "$PLANT_NA" ]; then
    : > "$LOGDIR/$(printf '%02d' "$PLANT_NO")-not-applicable.log"
    "${REC_ROW[@]}" --results "$RESULTS" --n "$PLANT_NO" --gate "$CUR_GATE" --plant "$CUR_PLANT" "${same[@]}" \
      --command "$command" --log "$LOGDIR/$(printf '%02d' "$PLANT_NO")-not-applicable.log" \
      --not-applicable "$PLANT_NA" --expect "$EXPECT" "${args[@]}" | tee -a "$LOGDIR/run.log"
    return
  fi
  if [ "$PLANT_OK" -ne 1 ] || ! tree_differs; then
    log "plant $PLANT_NO was not applied; the gate is not run"
    : > "$LOGDIR/$(printf '%02d' "$PLANT_NO")-not-planted.log"
    "${REC_ROW[@]}" --results "$RESULTS" --n "$PLANT_NO" --gate "$CUR_GATE" --plant "$CUR_PLANT" "${same[@]}" \
      --command "$command" --log "$LOGDIR/$(printf '%02d' "$PLANT_NO")-not-planted.log" --not-planted \
      --expect "$EXPECT" --note "the plant could not be applied (see run.log); the gate was not run" "${args[@]}" | tee -a "$LOGDIR/run.log"
    return
  fi
  log "run: $command"
  run_cmd plant "$command" "$limit"
  "${REC_ROW[@]}" --results "$RESULTS" --n "$PLANT_NO" --gate "$CUR_GATE" --plant "$CUR_PLANT" "${same[@]}" \
    --command "$command" --log "$LOG" --exit "$RC" --duration "$DUR" --expect "$EXPECT" "${args[@]}" | tee -a "$LOGDIR/run.log"
}

end_plant() {
  reset_tree
  tree_state_ok || { note "after plant $PLANT_NO the clone did not return to a clean $SHORT_SHA; stopped"; finish 1; }
}

clean_gate() { # gate COMMAND [row options]
  local gate_name=$1 command=$2
  shift 2
  local limit=900 args=()
  while [ $# -gt 0 ]; do
    case $1 in
      --timeout) limit=$2; shift 2 ;;
      *) args+=("$1"); shift ;;
    esac
  done
  tree_state_ok || { note "the tree was not clean before the clean run of $gate_name; stopped"; finish 1; }
  CUR_GATE=$gate_name
  CUR_PLANT="(clean run, no plant)"
  log "clean run [$gate_name]: $command"
  run_cmd clean "$command" "$limit"
  "${REC_ROW[@]}" --results "$RESULTS" --gate "$gate_name" --kind "${KIND:-clean}" --command "$command" \
    --log "$LOG" --exit "$RC" --duration "$DUR" --expect PASS "${args[@]}" | tee -a "$LOGDIR/run.log"
  reset_tree
}

rand_chars() { # charset count
  head -c 8192 /dev/urandom | LC_ALL=C tr -dc "$1" | head -c "$2"
}

SCRATCH_ID=(-c "user.name=Dr Scratch Reviewer" -c "user.email=scratch-reviewer@hms.invalid")
AGENT_ID=(-c "user.name=HMS build agent (scratch)" -c "user.email=build-agent@hms.invalid")

# scratch_commit MODE MESSAGE [KEY] [WHO]: MODE is unsigned or signed (with KEY from the temporary keyring,
# default key A); WHO is reviewer (default) or agent, the commit identity. Checks %G? (and %GF when signed).
scratch_commit() {
  local mode=$1 message=$2 key=${3:-${SCRATCH_FPR:-}} who=${4:-reviewer} sig fpr
  local id=("${SCRATCH_ID[@]}")
  [ "$who" = agent ] && id=("${AGENT_ID[@]}")
  if [ "$mode" = signed ]; then
    GNUPGHOME="$SCRATCH_GNUPGHOME" git "${id[@]}" -c "user.signingkey=$key" -c gpg.format=openpgp \
      commit -q -S -m "$message" || return 1
    sig=$(GNUPGHOME="$SCRATCH_GNUPGHOME" git log -1 --format=%G?)
    fpr=$(GNUPGHOME="$SCRATCH_GNUPGHOME" git log -1 --format=%GF)
    [ "$sig" = G ] || { log "signed scratch commit has %G? = $sig, expected G"; return 1; }
    [ "$fpr" = "$key" ] || { log "signed scratch commit has %GF = $fpr, expected $key"; return 1; }
  else
    git "${id[@]}" commit -q -m "$message" || return 1
    sig=$(git log -1 --format=%G?)
    [ "$sig" = N ] || { log "unsigned scratch commit has %G? = $sig, expected N"; return 1; }
  fi
}

finish() {
  local code=${1:-0}
  reset_tree
  local after
  if tree_state_ok; then
    after="\`git status --short\` empty, \`HEAD\` detached at \`$SHORT_SHA\`, no scratch branch left"
  else
    after="the clone was NOT clean: $(git status --short | head -5 | tr '\n' ' ')"
  fi
  meta after "$after"
  meta finished "$(date -Is)"
  local now_up _ total
  read -r now_up _ < /proc/uptime
  total=$(awk -v a="$now_up" -v b="$START_UP" 'BEGIN {printf "%d", a - b}')
  meta duration "$((total / 60)) min $((total % 60)) s"
  meta notes "$NOTES"
  "${REC[@]}" render --results "$RESULTS" --meta "$META" --out "$RECORD" | tee -a "$LOGDIR/run.log"
  log "logs: $LOGDIR"
  exit "$code"
}

ADR() { ls docs/adr/ADR-"$1"-*.md 2>/dev/null | head -1; }

# The gate commands are the ones tools/ci/run uses for each step at the commit under test, read from
# 'sh tools/ci/run fast --list'. The 6ca3e3a forms are the fallback; any difference is noted in the record.
CI_LIST=$(sh tools/ci/run fast --list 2>/dev/null)
use_step() { # VAR STEP DEFAULT
  local got
  got=$(printf '%s\n' "$CI_LIST" | awk -v s="$2" '$1 == s && $2 == "built" { sub(/^[^ ]+ +built +/, ""); print; exit }')
  if [ -z "$got" ]; then
    note "\`sh tools/ci/run fast --list\` shows no built step $2 at this commit; the script ran \`$3\` for it"
    got=$3
  elif [ "$got" != "$3" ]; then
    note "At this commit \`tools/ci/run\` runs step $2 as \`$got\` (at 6ca3e3a: \`$3\`); the script ran the listed command"
  fi
  printf -v "$1" '%s' "$got"
}
use_step REPO repo-check 'sh tools/hms repo check --json'
use_step UNITTEST python-unit-tests ".tools/venv/bin/python -I -m unittest discover -s tools -t tools -p 'test_*.py'"
use_step SAFETY safety-check 'sh tools/hms safety check --json'
use_step BACKLOG backlog-check 'sh tools/hms backlog check --json'
use_step GRADLE backend-fast 'sh backend/gradlew -p backend fastTier -Phms.pbt.sequences=1000 --no-build-cache --console=plain'
use_step FE_STEP frontend-fast 'corepack pnpm run fast'
# secret-scan is a Python function step (two gitleaks runs over a mirror of the tree): run it through the runner.
SECRETS='sh tools/ci/run fast --only secret-scan --no-evidence'
CI_BACKLOG='sh tools/ci/run fast --only backlog-check --no-evidence'
# tools/ci/run runs the frontend step in frontend/ (Corepack takes the pnpm version from its package.json).
FE_FAST="cd frontend && $FE_STEP"
FE_ES='cd frontend && corepack pnpm run lint:es'
FE_CSS='cd frontend && corepack pnpm run lint:css'
FE_I18N='cd frontend && corepack pnpm run i18n:lint'
GRADLE_TASKS='^> Task \S+ FAILED|^Execution failed for task'

# Sections (HMS_GB_SECTIONS, space-separated; default all). A partial run is for debugging, never a record.
SECTIONS_ALL="repo unittest safety backlog ci secrets frontend backend clean final"
SECTIONS=${HMS_GB_SECTIONS:-$SECTIONS_ALL}
section() { [[ " $SECTIONS " == *" $1 "* ]]; }
if [ "$SECTIONS" != "$SECTIONS_ALL" ]; then
  note "PARTIAL run (HMS_GB_SECTIONS=$SECTIONS): a debugging run, not a record"
fi

# =========================================================================== repo-check
if section repo; then

plant repo-check "Untracked \`docs/scratch-crlf.md\` with CRLF line endings (outside the plan of record)"
printf 'Scratch file planted by the gates-bite script.\r\nIts lines end in CRLF.\r\n' > docs/scratch-crlf.md
gate "$REPO" --json-check --regex 'crlf: docs/scratch-crlf\.md'
end_plant

plant repo-check "\`SYN-TENANT-0001\` and its hostname \`syn-tenant-0001.hms.invalid\` in backend configuration (\`backend/platform/testing/src/main/resources/application-scratch.yaml\`)"
p mkdir -p backend/platform/testing/src/main/resources
printf 'hms:\n  tenant:\n    id: SYN-TENANT-0001\n    hostname: syn-tenant-0001.hms.invalid\n' > backend/platform/testing/src/main/resources/application-scratch.yaml
gate "$REPO" --json-check --regex 'tenant: backend/.*application-scratch\.yaml' --also 'tenant: backend/'
end_plant

for branch in wp/9.9-syn-tenant-0001 customer-acme feature/scratch; do
  plant repo-check "Branch \`$branch\` (created at the commit under test)"
  p git branch "$branch" "$TARGET_SHA"
  SCRATCH_BRANCHES+=("$branch")
  gate "$REPO" --json-check --regex "branch: $branch:"
  end_plant
done

plant repo-check "\`docs/program/STATUS.md\` padded to 159 lines (limit 150)"
p "${EDIT[@]}" pad-lines docs/program/STATUS.md 159
gate "$REPO" --json-check --regex 'STATUS\.md has [0-9]+ lines'
end_plant

plant repo-check "\`$(ADR 010)\` deleted"
p rm "$(ADR 010)"
gate "$REPO" --json-check --regex 'ADR-010'
end_plant

plant repo-check "ADR-001's status set to \`accepted\` (§4.2 keeps it accepted-provisional)"
p "${EDIT[@]}" replace-line "$(ADR 001)" '^\**Status' 'Status: accepted'
gate "$REPO" --json-check --regex 'ADR-001.*accepted'
end_plant

plant repo-check "ADR-002's \`## Reopen if\` heading renamed to \`## Revisit when\`"
p "${EDIT[@]}" replace "$(ADR 002)" '## Reopen if' '## Revisit when'
gate "$REPO" --json-check --regex 'ADR-002.*Reopen if'
end_plant

ADR002=$(basename "$(ADR 002)")
plant repo-check "The index link to ADR-002 in \`docs/adr/README.md\` broken (\`($ADR002)\` changed to \`(ADR-002-runtime.md)\`)"
p "${EDIT[@]}" replace docs/adr/README.md "($ADR002)" '(ADR-002-runtime.md)'
gate "$REPO" --json-check --regex 'ADR-002.*not linked'
end_plant

BLOCKING=$(sh tools/hms repo check --json --rule limits 2>/dev/null | tail -1 |
  python3 -I -c 'import json,sys; print(json.load(sys.stdin)["counts"].get("blocking_now_items", 0))' 2>/dev/null || echo 0)
ADD=$((13 - BLOCKING))
plant repo-check "13 \"Blocking now\" items in \`docs/program/DECISIONS-NEEDED.md\` ($BLOCKING present, $ADD scratch items added; limit 10)"
if [ "$ADD" -gt 0 ]; then
  ITEMS=""
  for i in $(seq 1 "$ADD"); do ITEMS="$ITEMS\\n- Scratch blocking item $i planted by the gates-bite script."; done
  p "${EDIT[@]}" insert-after docs/program/DECISIONS-NEEDED.md '^#+ *Blocking now' "$ITEMS"
else
  PLANT_OK=0
fi
gate "$REPO" --json-check --regex "Blocking now' has [0-9]+ items"
end_plant

fi
# =========================================================================== python-unit-tests
if section unittest; then

plant python-unit-tests "A failing test, \`tools/hmstools/repo/tests/test_gates_bite_scratch.py\` (\`assertEqual(1 + 1, 3)\`)"
cat > tools/hmstools/repo/tests/test_gates_bite_scratch.py <<'EOF'
"""Planted by the gates-bite script: a unit test that fails."""

import unittest


class GatesBiteScratchTest(unittest.TestCase):
    def test_planted_failure(self) -> None:
        self.assertEqual(1 + 1, 3, "planted failure")
EOF
gate "$UNITTEST" --regex 'FAIL: test_planted_failure' --also '^FAILED \(|^Ran [0-9]+ tests' --timeout 900
end_plant

fi
# =========================================================================== safety-check (sign-off gate)
if section safety; then

SO_DATE=$(date +%F)
mkdir -m 700 "$SCRATCH_GNUPGHOME"
GNUPGHOME="$SCRATCH_GNUPGHOME" gpg --batch --quiet --passphrase '' \
  --quick-gen-key "Dr Scratch Reviewer <scratch-reviewer@hms.invalid>" ed25519 sign never >> "$LOGDIR/run.log" 2>&1
GNUPGHOME="$SCRATCH_GNUPGHOME" gpg --batch --quiet --passphrase '' \
  --quick-gen-key "HMS build agent (scratch) <build-agent@hms.invalid>" ed25519 sign never >> "$LOGDIR/run.log" 2>&1
key_of() { GNUPGHOME="$SCRATCH_GNUPGHOME" gpg --list-secret-keys --with-colons "$1" 2>/dev/null | awk -F: '/^fpr:/ {print $10; exit}'; }
SCRATCH_FPR=$(key_of scratch-reviewer@hms.invalid)
SCRATCH_FPR_B=$(key_of build-agent@hms.invalid)
[ -n "$SCRATCH_FPR" ] && [ -n "$SCRATCH_FPR_B" ] || note "the temporary GPG keys could not be generated; the signed plants will show NOT-PLANTED"
log "temporary GPG keys A $SCRATCH_FPR and B $SCRATCH_FPR_B in $SCRATCH_GNUPGHOME"
note "The signed sign-off plants use a GPG home the script creates for the run under /tmp (\`\$SCRATCH_GNUPGHOME\` in the commands), holding two ed25519 keys generated for the run: key A, \`Dr Scratch Reviewer <scratch-reviewer@hms.invalid>\`, fingerprint \`$SCRATCH_FPR\` (it stands for a human signer), and key B, \`HMS build agent (scratch) <build-agent@hms.invalid>\`, fingerprint \`$SCRATCH_FPR_B\` (it stands for a key the agent controls). Plants that say \"the temporary key\" without a letter use key A. The check runs with that keyring so that git can verify both signatures (\`%G?\` = G). The keyring is deleted at the end of the run. Scratch commits use the reviewer's name and address as author and committer, or the agent's where a plant says so; none of them is pushed or kept."

# The record must be valid under the record schema at the commit under test, so that every sign-off
# plant reaches authentication: role is the role id 'cso' and decision 'accepted' (both valid at 6ca3e3a
# too); subject_version is HAZ-0001's current version as the check computes it, where the check has one.
SO_VERSION=$("$PY" -I "$HERE/so_version.py" "$CLONE" HAZ-0001 accepted 2>> "$LOGDIR/run.log")
if [ -n "$SO_VERSION" ]; then
  SO_VERSION_TEXT="\`subject_version\` HAZ-0001's current version as the check computes it, \`$SO_VERSION\`"
else
  SO_VERSION_TEXT="no \`subject_version\` (the check at this commit defines none)"
fi
log "sign-off record: role cso, decision accepted, subject_version '${SO_VERSION:-none}'"

fill_accepted_by() { # [NAME]
  "${EDIT[@]}" replace docs/safety/hazard-log.yaml 'accepted_by: null' "accepted_by: ${1:-Dr Scratch Reviewer}" '- id: HAZ-0001'
}

# write_record [DECISION] [SIGNER_KEY] [NAME] [ROLE]: the scratch record SO-2026-0001
# (default: accepted, key A, Dr Scratch Reviewer, cso).
write_record() {
  local decision=${1:-accepted} key=${2:-$SCRATCH_FPR} name=${3:-Dr Scratch Reviewer} role=${4:-cso}
  mkdir -p docs/safety/signoffs
  cat > docs/safety/signoffs/SO-2026-0001.yaml <<EOF
id: SO-2026-0001
subject: HAZ-0001
field: residual_risk.accepted_by
role: $role
name: $name
date: "$SO_DATE"
statement: Scratch record planted by the gates-bite script to test the sign-off gate; it authorises nothing.
decision: $decision
authentication:
  method: signed-git-commit
  signer_key: $key
EOF
  if [ -n "$SO_VERSION" ]; then
    printf 'subject_version: "%s"\n' "$SO_VERSION" >> docs/safety/signoffs/SO-2026-0001.yaml
  fi
}

# commit_record MODE [KEY] [MESSAGE] [WHO]: fill the field, write nothing else, commit the field and record.
commit_record() {
  git add docs/safety/hazard-log.yaml docs/safety/signoffs/SO-2026-0001.yaml &&
    scratch_commit "$1" "${3:-scratch: CSO acceptance of HAZ-0001}" "${2:-$SCRATCH_FPR}" "${4:-reviewer}"
}

# anchor NAME KEY [WHO] [MESSAGE]: a commit without a trailer (and without a signature, which an anchor
# does not need) that lists KEY for NAME, role cso, in a list that held no key: a trust anchor (KA-011).
anchor() {
  "${EDIT[@]}" signers-add "$SIGNERS" "$1" cso "$2" "$SO_DATE" &&
    git add "$SIGNERS" &&
    scratch_commit unsigned "${4:-scratch: trust anchor, lists the key of $1}" "" "${3:-reviewer}"
}

# add_signer_commit MODE NAME KEY [WHO]: a later commit that adds KEY to the list.
add_signer_commit() {
  "${EDIT[@]}" signers-add "$SIGNERS" "$2" cso "$3" "$SO_DATE" &&
    git add "$SIGNERS" &&
    scratch_commit "$1" "scratch: add the key of $2 to the allowed signers" "$3" "${4:-agent}"
}

GPG_SAFETY="GNUPGHOME=\"\$SCRATCH_GNUPGHOME\" $SAFETY"

# Whether the commit has the allowed-signers list of the R-01 fix, holding no key (as shipped). With it,
# the unanchored plants below stop at "no signer is trusted" before their own check, and the anchored
# plants further down reach each check; without it, the anchored plants are not applicable.
SIGNERS=docs/safety/signoffs/allowed-signers.yaml
ANCHOR_NA=""
if [ ! -f "$SIGNERS" ]; then
  ANCHOR_NA="there is no $SIGNERS at this commit (the R-01 fix is not in it), so no key can be listed"
elif ! grep -Eq '^signers:[[:space:]]*\[[[:space:]]*\][[:space:]]*$' "$SIGNERS"; then
  ANCHOR_NA="$SIGNERS already lists a key at this commit, so a scratch trust anchor cannot be made"
fi
UNANCHORED=()
if [ -f "$SIGNERS" ]; then
  UNANCHORED=(--regex 'no signer is trusted' --note "at this commit the list holds no key, so the gate stops at \"no signer is trusted\" before this check; the anchored plants below reach it")
fi

plant safety-check "HAZ-0001 \`residual_risk.accepted_by: Dr Scratch Reviewer\` filled, no sign-off record"
p fill_accepted_by
gate "$SAFETY" --json-check --regex 'no sign-off record' --regex 'accepted_by'
end_plant

plant safety-check "The same, with a matching record \`docs/safety/signoffs/SO-2026-0001.yaml\` left untracked (name Dr Scratch Reviewer, role \`cso\`, decision \`accepted\`, $SO_VERSION_TEXT, \`signer_key\` the fingerprint of the temporary key in the notes)"
p fill_accepted_by
p write_record
gate "$SAFETY" --json-check --regex 'untracked|uncommitted'
end_plant

plant safety-check "The same, the record and the field committed together in an unsigned scratch commit (\`git log --format=%G?\` = N)"
p fill_accepted_by
p write_record
p git add docs/safety/hazard-log.yaml docs/safety/signoffs/SO-2026-0001.yaml
p scratch_commit unsigned "scratch: CSO acceptance of HAZ-0001 (unsigned)"
gate "$SAFETY" --json-check --regex 'no (valid|good) signature' "${UNANCHORED[@]}"
end_plant

plant safety-check "The same, committed in a commit signed by a GPG key generated for the run in a temporary keyring, **with** an AI co-author trailer (\`Co-Authored-By: Claude <noreply@anthropic.com>\`); the check runs with that keyring"
p fill_accepted_by
p write_record
p git add docs/safety/hazard-log.yaml docs/safety/signoffs/SO-2026-0001.yaml
p scratch_commit signed "$(printf 'scratch: CSO acceptance of HAZ-0001\n\nCo-Authored-By: Claude <noreply@anthropic.com>')"
gate "$GPG_SAFETY" --json-check --regex 'AI co-author trailer' "${UNANCHORED[@]}"
end_plant

plant safety-check "R-01: the same, committed in a commit signed by the temporary GPG key, **no** trailer (the key is in no allowed-signers list; the check runs with that keyring). **Expected FAIL after R-01**; PASS before the fix is the known defect R-01" REPORT-R01
p fill_accepted_by
p write_record
p git add docs/safety/hazard-log.yaml docs/safety/signoffs/SO-2026-0001.yaml
p scratch_commit signed "scratch: CSO acceptance of HAZ-0001"
gate "$GPG_SAFETY" --json-check --regex 'allowed.signers|not (listed|allowed)|signer|fingerprint' \
  --regex 'signature|SO-2026-0001' --regex 'accepted_by' --also 'SO-2026-0001' --pass-regex '^safety: PASS'
end_plant

plant safety-check "HAZ-0001 \`status: open\` changed to \`status: accepted\`"
p "${EDIT[@]}" replace docs/safety/hazard-log.yaml 'status: open' 'status: accepted' '- id: HAZ-0001'
gate "$SAFETY" --json-check --regex "HAZ-0001.*accepted"
end_plant

plant safety-check "CTRL-0001-1 \`state: planned\` changed to \`state: verified\`, \`verified_by\` empty"
p "${EDIT[@]}" replace docs/safety/hazard-log.yaml 'state: planned' 'state: verified' '- id: CTRL-0001-1'
gate "$SAFETY" --json-check --regex "CTRL-0001-1.*verified_by"
end_plant

plant safety-check "One word of SI-01's \`invariant_text\` in HAZ-0001 changed (\"never room or bed\" to \"never room or ward\")"
p "${EDIT[@]}" replace docs/safety/hazard-log.yaml 'never room or bed. The name' 'never room or ward. The name' 'invariant_text:'
gate "$SAFETY" --json-check --regex 'HAZ-0001.*invariant_text'
end_plant

plant safety-check "CTRL-0001-4's \`covers\` list emptied (\`covers: [b]\` to \`covers: []\`)"
p "${EDIT[@]}" replace docs/safety/hazard-log.yaml 'covers: [b]' 'covers: []' '- id: CTRL-0001-4'
gate "$SAFETY" --json-check --regex 'not covered|covers'
end_plant

plant safety-check "HAZ-0001 \`cso_triage\` filled (\`{by: Dr Scratch Reviewer, date: \"$SO_DATE\"}\`), no record"
p "${EDIT[@]}" replace docs/safety/hazard-log.yaml 'cso_triage: {by: null, date: null}' "cso_triage: {by: Dr Scratch Reviewer, date: \"$SO_DATE\"}" '- id: HAZ-0001'
gate "$SAFETY" --json-check --regex 'cso_triage'
end_plant

plant safety-check "A state-machine spec \`docs/specs/state-machines/scratch-machine.yaml\` with \`approval.approved_by\` filled, no record"
cat > docs/specs/state-machines/scratch-machine.yaml <<'EOF'
# Planted by the gates-bite script: a state-machine spec whose approval is filled without a record.
machine: scratch-machine
version: 1
approval:
  required: [cso]
  approved_by: [Dr Scratch Reviewer]
  record: null
  status: requested
EOF
gate "$SAFETY" --json-check --regex 'approval\.approved_by|scratch-machine'
end_plant

plant safety-check "An unparsable hazard log (a line \`scratch: [unclosed\` appended)"
printf 'scratch: [unclosed\n' >> docs/safety/hazard-log.yaml
gate "$SAFETY" --json-check --regex 'does not parse|YAML'
end_plant

# --------------------------------------------------------------------------- the sign-off gate with a listed key
# Each plant first makes a scratch trust anchor that lists key A for the record's name and role, so that
# the checks after "no signer is trusted" are reached. They need the allowed-signers list of the R-01 fix,
# holding no key (as shipped): elsewhere they are recorded as not applicable at this commit.
if [ -n "$ANCHOR_NA" ]; then
  meta intro_signoff-anchor "These plants need the allowed-signers list of the R-01 fix, holding no key, to make a scratch trust anchor that lists key A. They are recorded as not applicable and not run, because $ANCHOR_NA."
else
meta intro_signoff-anchor "Each plant below first makes a scratch trust anchor: a commit without an AI co-author trailer (and without a signature, which an anchor does not need) that lists key A for Dr Scratch Reviewer, role \`cso\`, in the shipped \`$SIGNERS\` that holds no key, so that the checks after \"no signer is trusted\" are reached. The check reports each anchor as a warning (KA-011). The record is SO-2026-0001 for HAZ-0001 \`residual_risk.accepted_by\` (filled with \"Dr Scratch Reviewer\" in the same commit), role \`cso\`, decision \`accepted\`, $SO_VERSION_TEXT, unless a plant says otherwise. The keys are listed in the notes."
fi
anchored() { PLANT_NA_NEXT=$ANCHOR_NA; plant "$@"; }
TRAILER_MSG=$(printf 'scratch: CSO acceptance of HAZ-0001\n\nCo-Authored-By: Claude <noreply@anthropic.com>')

anchored signoff-anchor "Key A anchored; the record is signed by key B, which the list does not hold (\`signer_key\` B)"
p anchor "Dr Scratch Reviewer" "$SCRATCH_FPR"
p fill_accepted_by
p write_record accepted "$SCRATCH_FPR_B"
p commit_record signed "$SCRATCH_FPR_B"
gate "$GPG_SAFETY" --json-check --regex "signed by key ${SCRATCH_FPR_B:-B}, which .* does not list" --regex 'does not list'
end_plant

anchored signoff-anchor "Key A anchored; the record committed without a signature (\`%G?\` = N)"
p anchor "Dr Scratch Reviewer" "$SCRATCH_FPR"
p fill_accepted_by
p write_record
p commit_record unsigned
gate "$GPG_SAFETY" --json-check --regex 'no good signature'
end_plant

anchored signoff-anchor "Key A anchored; the record signed by key A in a commit with an AI co-author trailer (\`Co-Authored-By: Claude <noreply@anthropic.com>\`)"
p anchor "Dr Scratch Reviewer" "$SCRATCH_FPR"
p fill_accepted_by
p write_record
p commit_record signed "$SCRATCH_FPR" "$TRAILER_MSG"
gate "$GPG_SAFETY" --json-check --regex 'AI co-author trailer'
end_plant

anchored signoff-anchor "Key A anchored; the record signed by key A with \`decision: triaged\` on \`residual_risk.accepted_by\` (the field needs \`accepted\`)"
p anchor "Dr Scratch Reviewer" "$SCRATCH_FPR"
p fill_accepted_by
p write_record triaged
p commit_record signed
gate "$GPG_SAFETY" --json-check --regex "decision 'accepted'|only 'accepted'" --regex 'decision'
end_plant

anchored signoff-anchor "Key A anchored; the record signed by key A for HAZ-0001's current version, then a later commit changes HAZ-0001 (its title), so the record's \`subject_version\` is stale"
p anchor "Dr Scratch Reviewer" "$SCRATCH_FPR"
p fill_accepted_by
p write_record
p commit_record signed
p "${EDIT[@]}" replace docs/safety/hazard-log.yaml 'title: ' 'title: Scratch-edited after the sign-off, ' '- id: HAZ-0001'
p git add docs/safety/hazard-log.yaml
p scratch_commit unsigned "scratch: HAZ-0001 changed after the sign-off"
gate "$GPG_SAFETY" --json-check --regex 'another version of HAZ-0001' --regex 'version'
end_plant

anchored signoff-anchor "Key A anchored; a later commit without a signature adds key B for Dr Scratch Reviewer to the list (agent identity); the record is then signed by key B"
p anchor "Dr Scratch Reviewer" "$SCRATCH_FPR"
p add_signer_commit unsigned "Dr Scratch Reviewer" "$SCRATCH_FPR_B"
p fill_accepted_by
p write_record accepted "$SCRATCH_FPR_B"
p commit_record signed "$SCRATCH_FPR_B" "" agent
gate "$GPG_SAFETY" --json-check --regex 'changed the list without a good signature' --regex 'changed the list'
end_plant

anchored signoff-anchor "Key A anchored; a later commit signed by key B itself (not listed) adds key B to the list; the record is then signed by key B"
p anchor "Dr Scratch Reviewer" "$SCRATCH_FPR"
p add_signer_commit signed "Dr Scratch Reviewer" "$SCRATCH_FPR_B"
p fill_accepted_by
p write_record accepted "$SCRATCH_FPR_B"
p commit_record signed "$SCRATCH_FPR_B" "" agent
gate "$GPG_SAFETY" --json-check --regex "changed the list in a commit signed by key ${SCRATCH_FPR_B:-B}" --regex 'changed the list'
end_plant

anchored signoff-anchor "Key A anchored; a later commit without a signature empties the list, a commit without a trailer then lists key B (a second anchor attempt), and the record is signed by key B"
p anchor "Dr Scratch Reviewer" "$SCRATCH_FPR"
p "${EDIT[@]}" signers-clear "$SIGNERS"
p git add "$SIGNERS"
p scratch_commit unsigned "scratch: empty the allowed signers" "" agent
p anchor "Dr Scratch Reviewer" "$SCRATCH_FPR_B" agent
p fill_accepted_by
p write_record accepted "$SCRATCH_FPR_B"
p commit_record signed "$SCRATCH_FPR_B" "" agent
gate "$GPG_SAFETY" --json-check --regex 'changed the list without a good signature' --regex 'changed the list'
end_plant

anchored signoff-anchor "The anchor commit itself carries an AI co-author trailer (it lists key A); the record is then signed by key A"
p anchor "Dr Scratch Reviewer" "$SCRATCH_FPR" reviewer \
  "$(printf 'scratch: trust anchor, lists the key of Dr Scratch Reviewer\n\nCo-Authored-By: Claude <noreply@anthropic.com>')"
p fill_accepted_by
p write_record
p commit_record signed
gate "$GPG_SAFETY" --json-check --regex 'add a key in a commit that carries an AI co-author trailer' --regex 'trailer'
end_plant

anchored signoff-anchor "Key A anchored (role \`cso\` only); the record signed by key A names the role \`pharmacist-panel\`"
p anchor "Dr Scratch Reviewer" "$SCRATCH_FPR"
p fill_accepted_by
p write_record accepted "$SCRATCH_FPR" "Dr Scratch Reviewer" pharmacist-panel
p commit_record signed
gate "$GPG_SAFETY" --json-check --regex "not for the record's role" --regex 'role'
end_plant

anchored signoff-anchor "Key A anchored for Dr Scratch Reviewer; the record signed by key A names another person, Dr Other Person (the field is filled with that name)"
p anchor "Dr Scratch Reviewer" "$SCRATCH_FPR"
p fill_accepted_by "Dr Other Person"
p write_record accepted "$SCRATCH_FPR" "Dr Other Person"
p commit_record signed
gate "$GPG_SAFETY" --json-check --regex 'but the record names' --regex 'Dr Other Person'
end_plant

anchored signoff-anchor "Key A anchored; the record signed by key A gives key B as its \`authentication.signer_key\`"
p anchor "Dr Scratch Reviewer" "$SCRATCH_FPR"
p fill_accepted_by
p write_record accepted "$SCRATCH_FPR_B"
p commit_record signed
gate "$GPG_SAFETY" --json-check --regex 'signer_key .* is not the key that signed' --regex 'signer_key'
end_plant

anchored signoff-anchor "Key A anchored; the record signed by key A, then edited (its statement) in a later commit without a signature"
p anchor "Dr Scratch Reviewer" "$SCRATCH_FPR"
p fill_accepted_by
p write_record
p commit_record signed
p "${EDIT[@]}" replace docs/safety/signoffs/SO-2026-0001.yaml 'statement: Scratch record' 'statement: Edited scratch record'
p git add docs/safety/signoffs/SO-2026-0001.yaml
p scratch_commit unsigned "scratch: edit the signed record" "" agent
gate "$GPG_SAFETY" --json-check --regex 'no good signature'
end_plant

anchored signoff-anchor "Key A anchored; key B added to the list in the working tree only (not committed); the record is then signed by key B"
p anchor "Dr Scratch Reviewer" "$SCRATCH_FPR"
p fill_accepted_by
p write_record accepted "$SCRATCH_FPR_B"
p commit_record signed "$SCRATCH_FPR_B" "" agent
p "${EDIT[@]}" signers-add "$SIGNERS" "Dr Scratch Reviewer" cso "$SCRATCH_FPR_B" "$SO_DATE"
gate "$GPG_SAFETY" --json-check --regex "signed by key ${SCRATCH_FPR_B:-B}, which .* does not list" --regex 'does not list' \
  --also 'uncommitted changes'
end_plant

anchored signoff-anchor "Control, **expected PASS**: key A anchored; the record signed by key A matches its field, decision, role and \`subject_version\`. Valid record accepted (the gate is not simply closed)" \
  PASS "valid record accepted (the gate is not simply closed)"
p anchor "Dr Scratch Reviewer" "$SCRATCH_FPR"
p fill_accepted_by
p write_record
p commit_record signed
gate "$GPG_SAFETY" --json-check --pass-regex '^safety: PASS' --also 'is a trust anchor' --regex '^ERROR'
end_plant

anchored signoff-anchor "KA-011, **expected PASS**: with the shipped empty list, a commit by the agent identity without a trailer anchors the agent's own key B under the name Dr Scratch Reviewer, role \`cso\`; the record is then signed by key B. Known limitation KA-011; not a gate failure: the check warns that the anchor must be verified out of band" \
  PASS "known limitation KA-011; not a gate failure"
p anchor "Dr Scratch Reviewer" "$SCRATCH_FPR_B" agent
p fill_accepted_by
p write_record accepted "$SCRATCH_FPR_B"
p commit_record signed "$SCRATCH_FPR_B" "" agent
gate "$GPG_SAFETY" --json-check --pass-regex '^safety: PASS' --also 'is a trust anchor' --regex '^ERROR'
end_plant

fi
# =========================================================================== backlog-check
if section backlog; then

plant backlog-check "PLT-CORE-01 \`status: todo\` changed to \`status: built\`, \`tests: []\`"
p "${EDIT[@]}" replace docs/program/backlog.yaml 'status: todo' 'status: built' '- id: PLT-CORE-01'
gate "$BACKLOG" --json-check --regex "PLT-CORE-01.*built"
end_plant

plant backlog-check "PLT-CORE-01 \`status: todo\` changed to \`status: verified\`, \`tests: []\`"
p "${EDIT[@]}" replace docs/program/backlog.yaml 'status: todo' 'status: verified' '- id: PLT-CORE-01'
gate "$BACKLOG" --json-check --regex "PLT-CORE-01.*verified"
end_plant

plant backlog-check "PLT-CORE-01's title hand-edited in \`backlog.yaml\` (\"Clinical journal\" to \"Clinical journal (hand-edited)\")"
p "${EDIT[@]}" replace docs/program/backlog.yaml 'title: Clinical journal' 'title: Clinical journal (hand-edited)' '- id: PLT-CORE-01'
gate "$BACKLOG" --json-check --regex "PLT-CORE-01.*title"
end_plant

plant backlog-check "The KRI-ID-01 record deleted from \`backlog.yaml\`"
p "${EDIT[@]}" delete-block docs/program/backlog.yaml '- id: KRI-ID-01'
gate "$BACKLOG" --json-check --regex 'KRI-ID-01' --also '234|A\.18'
end_plant

plant backlog-check "\`docs/program/BACKLOG.md\` hand-edited (a line appended)"
printf 'Hand-edited line planted by the gates-bite script.\n' >> docs/program/BACKLOG.md
gate "$BACKLOG" --json-check --regex 'BACKLOG\.md'
end_plant

fi
# =========================================================================== CI runner contract
if section ci; then

plant ci-runner "\`tools/hmstools/backlog/__main__.py\` replaced by a check that prints \`{\"ok\": false, ...}\` as its JSON line and exits 0"
cat > tools/hmstools/backlog/__main__.py <<'EOF'
"""Planted by the gates-bite script: a check that exits 0 but reports ok=false."""

import json
import sys

print("backlog: planted check (exit code 0, ok=false)")
print(json.dumps({"check": "backlog", "ok": False, "counts": {}, "errors": [], "warnings": []}))
sys.exit(0)
EOF
bash -c "$BACKLOG" > "$LOGDIR/ci-runner-planted-check.log" 2>&1
PLANTED_RC=$?
CUR_PLANT="$CUR_PLANT (the planted \`$BACKLOG\` itself exited $PLANTED_RC)"
gate "$CI_BACKLOG" --pass-codes 3 --regex 'exit code 0 but the JSON says ok=false' --timeout 300
end_plant

fi
# =========================================================================== secret-scan
if section secrets; then

PAT="ghp_$(rand_chars 'A-Za-z0-9' 36)"

plant secret-scan "A GitHub personal access token (\`ghp_\` + 36 random alphanumerics, generated for the run) in an untracked file \`scratch-secrets/github-token.txt\`"
p mkdir -p scratch-secrets
printf 'GITHUB_TOKEN=%s\n' "$PAT" > scratch-secrets/github-token.txt
gate "$SECRETS" --pass-codes 3 --regex 'secret-scan: FAIL' --timeout 900
end_plant

plant secret-scan "The same token only in the history of a scratch branch \`wp/9.9-scratch-secret\` (one commit adds the file, the next deletes it; the working tree never holds it)"
make_history_branch() {
  local blob tree1 c1 c2 index="$WORK/index"
  blob=$(printf 'GITHUB_TOKEN=%s\n' "$PAT" | git hash-object -w --stdin) || return 1
  GIT_INDEX_FILE="$index" git read-tree "$TARGET_SHA" || return 1
  GIT_INDEX_FILE="$index" git update-index --add --cacheinfo "100644,$blob,scratch-secrets/github-token.txt" || return 1
  tree1=$(GIT_INDEX_FILE="$index" git write-tree) || return 1
  c1=$(git "${SCRATCH_ID[@]}" commit-tree "$tree1" -p "$TARGET_SHA" -m "scratch: add a token") || return 1
  c2=$(git "${SCRATCH_ID[@]}" commit-tree "$(git rev-parse "$TARGET_SHA^{tree}")" -p "$c1" -m "scratch: delete the token") || return 1
  rm -f "$index"
  git branch wp/9.9-scratch-secret "$c2"
}
p make_history_branch
SCRATCH_BRANCHES+=(wp/9.9-scratch-secret)
gate "$SECRETS" --pass-codes 3 --regex 'secret-scan: FAIL' --timeout 900
end_plant

plant secret-scan "An AWS access key id (\`AKIA\` + 16 random characters of [A-Z2-7]) in an untracked file \`scratch-secrets/aws.txt\`"
p mkdir -p scratch-secrets
printf 'aws_access_key_id = AKIA%s\n' "$(rand_chars 'A-Z2-7' 16)" > scratch-secrets/aws.txt
gate "$SECRETS" --pass-codes 3 --regex 'secret-scan: FAIL' --timeout 900
end_plant

plant secret-scan "A PEM private-key block (\`-----BEGIN RSA PRIVATE KEY-----\`, random body) in an untracked file \`scratch-secrets/deploy-key.txt\` (\`*.pem\` and \`*.key\` are git-ignored, so the scan never sees such names)"
p mkdir -p scratch-secrets
{
  echo '-----BEGIN RSA PRIVATE KEY-----'
  head -c 768 /dev/urandom | base64 -w 64
  echo '-----END RSA PRIVATE KEY-----'
} > scratch-secrets/deploy-key.txt
gate "$SECRETS" --pass-codes 3 --regex 'secret-scan: FAIL' --timeout 900
end_plant

plant secret-scan "Scope note, not a gate violation: a plain \`password = \"correct-horse\"\` assignment in an untracked file (no gitleaks default rule matches it; expected PASS, as the review recorded)" PASS
p mkdir -p scratch-secrets
printf 'password = "correct-horse"\n' > scratch-secrets/config.txt
gate "$SECRETS" --pass-codes 3 --regex 'secret-scan: FAIL' --pass-regex 'secret-scan: PASS' --timeout 900
end_plant

fi
# =========================================================================== frontend
if section frontend; then

plant frontend "\`frontend/packages/i18n/src/ScratchBanner.tsx\`: a \`title\` attribute and the text \"Hello\" as JSX literals, and \`marginLeft\` and \`textAlign: 'left'\` in an inline style"
cat > frontend/packages/i18n/src/ScratchBanner.tsx <<'EOF'
export function ScratchBanner() {
  return (
    <div title="Patient" style={{ marginLeft: 4, textAlign: 'left' }}>
      Hello
    </div>
  );
}
EOF
gate "$FE_ES" --regex 'hms/no-jsx-literals|hms/no-physical-css' --also 'hms/|✖ [0-9]+ problems' --timeout 600
gate "$FE_FAST" --regex 'hms/no-jsx-literals|hms/no-physical-css' --also '✖ [0-9]+ problems' --timeout 1200
end_plant

plant frontend "\`frontend/packages/i18n/src/scratch.css\`: \`margin-left: 4px\` and \`float: right\`"
cat > frontend/packages/i18n/src/scratch.css <<'EOF'
.scratch-banner {
  margin-left: 4px;
  float: right;
}
EOF
gate "$FE_CSS" --regex 'margin-left|float' --also 'margin-left|float' --timeout 600
gate "$FE_FAST" --regex 'margin-left|float' --timeout 1200
end_plant

plant frontend "The key \`language.en.endonym\` deleted from \`frontend/packages/i18n/src/messages/ckb.json\`"
p "${EDIT[@]}" json-del-key frontend/packages/i18n/src/messages/ckb.json language.en.endonym
gate "$FE_I18N" --regex 'language\.en\.endonym' --also 'FAIL' --timeout 600
gate "$FE_FAST" --regex 'language\.en\.endonym' --also 'Test Files .*failed|✖ [0-9]+ problems' --timeout 1200
end_plant

plant frontend "An ICU syntax error in \`frontend/packages/i18n/src/messages/ar.json\` (\`\"app.name\": \"HMS {Kurdistan\"\`)"
p "${EDIT[@]}" replace frontend/packages/i18n/src/messages/ar.json '"app.name": "HMS Kurdistan"' '"app.name": "HMS {Kurdistan"'
gate "$FE_I18N" --regex 'ICU|syntax' --also 'FAIL' --timeout 600
gate "$FE_FAST" --regex 'ICU|syntax' --also 'Test Files .*failed' --timeout 1200
end_plant

fi
# =========================================================================== wait for memory, then backend
if section backend || section clean || section final; then

WAIT_PATTERN=${HMS_GB_WAIT_PATTERN-failover-v2}
WAIT_MAX=${HMS_GB_WAIT_MAX-1200}
if [ -n "$WAIT_PATTERN" ]; then
  waited=0
  while pgrep -f -- "$WAIT_PATTERN" > /dev/null && [ "$waited" -lt "$WAIT_MAX" ]; do
    [ "$waited" -eq 0 ] && log "waiting while pgrep -f $WAIT_PATTERN finds a process (at most $WAIT_MAX s)"
    sleep 20
    waited=$((waited + 20))
  done
  if pgrep -f -- "$WAIT_PATTERN" > /dev/null; then
    meta wait_note "Before the Gradle plants it waited ${waited} s for another job on the VM (\`pgrep -f $WAIT_PATTERN\`), which was still running; it went ahead anyway."
    note "the Gradle plants ran while another job (pgrep -f $WAIT_PATTERN) was still running on the VM, after a ${waited} s wait"
  else
    meta wait_note "Before the Gradle plants it waited until \`pgrep -f $WAIT_PATTERN\` (another job sharing the VM's memory) found nothing: ${waited} s."
  fi
  log "wait done after $waited s"
fi
fi

KT=backend/platform/testing/src
if section backend; then

plant backend "\`$KT/main/kotlin/hms/kernel/testing/ScratchKtlint.kt\`: \`fun scratchTwice(value: Int) : Int = value * 2\` (a ktlint violation, detekt-clean)"
cat > "$KT/main/kotlin/hms/kernel/testing/ScratchKtlint.kt" <<'EOF'
package hms.kernel.testing

fun scratchTwice(value: Int) : Int = value * 2
EOF
gate "$GRADLE" --regex 'ScratchKtlint\.kt' --also "$GRADLE_TASKS" --timeout 1800
end_plant

plant backend "\`$KT/main/kotlin/hms/kernel/testing/ScratchDetekt.kt\`: \`fun noop() {}\` (a detekt violation, ktlint-clean)"
cat > "$KT/main/kotlin/hms/kernel/testing/ScratchDetekt.kt" <<'EOF'
package hms.kernel.testing

fun noop() {}
EOF
gate "$GRADLE" --regex 'ScratchDetekt\.kt|EmptyFunctionBlock' --also "$GRADLE_TASKS" --timeout 1800
end_plant

plant backend "\`$KT/propertyTest/kotlin/hms/kernel/testing/ScratchFailingPropertyTest.kt\`: the false property \"every \`Arb.int()\` is even\""
cat > "$KT/propertyTest/kotlin/hms/kernel/testing/ScratchFailingPropertyTest.kt" <<'EOF'
package hms.kernel.testing

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.property.Arb
import io.kotest.property.arbitrary.int
import io.kotest.property.checkAll

/** Planted by the gates-bite script: a property that is false. */
class ScratchFailingPropertyTest :
    FunSpec({
        test("a planted false property: every int is even") {
            checkAll(PropertyTestBudget.sequences(), Arb.int()) { value ->
                (value % 2) shouldBe 0
            }
        }
    })
EOF
gate "$GRADLE" --regex 'ScratchFailingPropertyTest.*FAILED|Property failed|ScratchFailingPropertyTest' --also "$GRADLE_TASKS" --timeout 1800
end_plant

plant backend "\`$KT/main/kotlin/hms/kernel/testing/domain/ScratchClock.kt\`: domain code calling \`Instant.now()\`"
mkdir -p "$KT/main/kotlin/hms/kernel/testing/domain"
cat > "$KT/main/kotlin/hms/kernel/testing/domain/ScratchClock.kt" <<'EOF'
package hms.kernel.testing.domain

import java.time.Instant

/** Planted by the gates-bite script: domain code that reads the system clock. */
class ScratchClock {
    fun stamp(): Instant = Instant.now()
}
EOF
gate "$GRADLE" --regex 'ScratchClock' --also "ArchitectureTest > .*FAILED|$GRADLE_TASKS" --timeout 1800
end_plant

plant backend "A class in \`hms.scratchbeta.application\` using \`hms.scratchalpha.domain\` (both under \`$KT/main/kotlin/hms/\`): a module boundary crossed outside the api package"
mkdir -p "$KT/main/kotlin/hms/scratchalpha/domain" "$KT/main/kotlin/hms/scratchbeta/application"
cat > "$KT/main/kotlin/hms/scratchalpha/domain/ScratchAlpha.kt" <<'EOF'
package hms.scratchalpha.domain

/** Planted by the gates-bite script: a domain type of module scratchalpha. */
class ScratchAlpha(
    val value: Int,
)
EOF
cat > "$KT/main/kotlin/hms/scratchbeta/application/ScratchBeta.kt" <<'EOF'
package hms.scratchbeta.application

import hms.scratchalpha.domain.ScratchAlpha

/** Planted by the gates-bite script: module scratchbeta reaches into scratchalpha's domain. */
class ScratchBeta {
    fun read(alpha: ScratchAlpha): Int = alpha.value
}
EOF
gate "$GRADLE" --regex "uses module 'scratchalpha'" --also "ArchitectureTest > .*FAILED|$GRADLE_TASKS|uses module 'scratchalpha'" --timeout 1800
end_plant

fi
# =========================================================================== clean runs
if section clean; then
log "==== clean runs"
clean_gate repo-check "$REPO" --json-check --pass-regex '^repo: PASS'
clean_gate python-unit-tests "$UNITTEST" --pass-regex '^Ran [0-9]+ tests' --timeout 900
clean_gate safety-check "$SAFETY" --json-check --pass-regex '^safety: PASS'
clean_gate backlog-check "$BACKLOG" --json-check --pass-regex '^backlog: PASS'
clean_gate ci-runner "$CI_BACKLOG" --pass-codes 3 --pass-regex '^tools/ci/run fast: PARTIAL' --timeout 300
clean_gate secret-scan "$SECRETS" --pass-codes 3 --pass-regex 'secret-scan: PASS' --timeout 900
clean_gate frontend "$FE_ES" --pass-regex 'eslint --max-warnings' --note 'no finding: ESLint prints nothing after its command line when it finds nothing' --timeout 600
clean_gate frontend "$FE_CSS" --pass-regex 'PASS|lint:css|checked' --timeout 600
clean_gate frontend "$FE_I18N" --pass-regex 'frontend-i18n-catalogues: PASS' --timeout 600
clean_gate frontend "$FE_FAST" --pass-regex 'frontend-i18n-catalogues: PASS|Tests +[0-9]+ passed' --timeout 1200
clean_gate backend "$GRADLE" --pass-regex 'BUILD SUCCESSFUL' --timeout 1800
fi

if section final; then
log "==== full fast tier on the clean tree"
tree_state_ok || { note "the tree was not clean before the final fast tier; stopped"; finish 1; }
CUR_GATE=fast-tier
CUR_PLANT="(clean run, no plant)"
run_cmd final 'sh tools/ci/run fast --no-evidence' 3600
"${REC_ROW[@]}" --results "$RESULTS" --gate fast-tier --kind final --command 'sh tools/ci/run fast --no-evidence' \
  --log "$LOG" --exit "$RC" --duration "$DUR" --expect PASS --pass-regex '^tools/ci/run fast: PASS' \
  --regex '^tools/ci/run fast: ' --also ': FAIL|NOT-BUILT' | tee -a "$LOGDIR/run.log"
RUN_JSON=$(ls -t build/ci-logs/*/run.json 2>/dev/null | head -1)
if [ -n "$RUN_JSON" ]; then
  cp "$RUN_JSON" "$LOGDIR/final-fast-run.json"
  "${REC[@]}" final-steps --meta "$META" "$LOGDIR/final-fast-run.json"
fi
if git status --short | grep -q .; then
  note "the final fast-tier run left changes in the tree: $(git status --short | head -5 | tr '\n' ' ')"
fi
fi
sh backend/gradlew -p backend --stop > /dev/null 2>&1

finish 0
