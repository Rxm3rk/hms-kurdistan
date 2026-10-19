export const meta = {
  name: 'signoff-verify-and-wp07-s0-integrate',
  description: 'Independently verify the sign-off gate (merge/conflict rule and record rules) at 05f159a; integrate WP-0.7 S0 programme entries on its branch',
  phases: [
    { title: 'Verify', detail: 'two verifiers of the sign-off gate, scratch repos only' },
    { title: 'Integrate', detail: 'WP-0.7 S0 programme entries in the worktree' },
    { title: 'Review', detail: 'records review of the S0 integration' },
    { title: 'Fix', detail: 'confirmed gate defects; S0 review issues' },
  ],
}

const MAIN = 'C:\\Users\\Surface\\.t3\\projects\\hospitalmanagementsystem'
const WT = 'C:\\Users\\Surface\\.t3\\worktrees\\hospitalmanagementsystem\\wp07'

const GATE_COMMON = `Context: the HMS Kurdistan hospital-system build (a hospital system for private hospitals in the Kurdistan Region of Iraq). Repository ${MAIN} (Windows checkout, Git Bash; WSL Ubuntu-24.04 available with gpg and ssh-keygen). Branch wp/0.1-programme-bootstrap at commit 05f159a, which resolved review finding R-01: the safety sign-off gate (tools/hmstools/safety/signoffs.py: GitAuthenticator with _walk, _before, _approve, _judge, _conflict_error; match_gate_field and withdrawals; check.py) decides whether a filled approval field in the hazard log or a state-machine spec is backed by a sign-off record that a listed human signed with a key in docs/safety/signoffs/allowed-signers.yaml. Read the code, its docstrings, docs/safety/signoffs/README.md, KNOWN-ANOMALIES.md KA-011, and the tests (tools/hmstools/safety/tests/test_git_authentication.py, test_signed_commits.py, test_signoff_gate.py). The plan of record is BUILD-PROMPT.md (§3.4, §3.5, §10; read-only).

You are an independent verification engineer. The gate is a safety control that keeps unauthorised or unattributable approvals out of the hazard log; your job is to confirm, with reproducible scratch tests, that it rejects every case it should reject and accepts the legitimate ones, and to report any case where its behaviour differs from its documented rule. Work only in scratch git repositories under WSL /tmp (copy the repository's tools/ tree and docs/safety/ there with git archive 05f159a, init git, create throwaway GPG and SSH keys in a temporary GNUPGHOME and delete them afterwards; run the gate with python -I tools/hms.py safety check or the GitAuthenticator class directly using ~/src/hospitalmanagementsystem/.tools/venv/bin/python). Never edit anything in ${MAIN} and never run git write commands there. The known, recorded limitation is KA-011: whoever makes the first trust-anchor commit (adding keys to a list that held none) is trusted, and only out-of-band fingerprint checks catch a wrong anchor; do not report that as a defect, but do report anything that widens it.

Return every case you built: setup, expected result under the documented rule, actual result (exit code and the gate's message), and a verdict (as documented / defect). A defect needs a minimal reproduction script (saved under C:\\Users\\Surface\\AppData\\Local\\Temp\\signoff-verify\\) and a proposed fix.`

const LENSES = [
  ['merge-rule', `Focus: the history of allowed-signers.yaml with merges. Build cases for: a side branch forked before the human's anchor that anchors another key, merged in either parent order, signed or unsigned, keeping either list or the union; settling a conflict (does it need an approval from every side, exactly as documented; can approvals from one side be counted for another; does an approval made before the conflict count; does a comment-only signed edit carry one approval and only one; does a change of roles or names between approvals restart them; does a key listed on both sides with different roles behave as documented); octopus and criss-cross merges; a revert of a merge; a third line merged after settling; a side that lists no key; an invalid version of the list during a conflict; a list moved, deleted and re-added; and history views that could hide commits from the walk (--full-history simplification, a merge that takes one parent's tree without changes). Also check that a legitimate path always exists to restore trust without rewriting history.`],
  ['record-rules', `Focus: the sign-off records and how they back fields. Build cases for: unsigned, badly signed (%G? values B, U, X, Y, R, E, N), signed by an unlisted key, by a listed key for another name or role, with a GPG subkey of a listed primary, with SSH keys versus GPG keys of the same fingerprint text, with an AI co-author trailer in any commit touching the record, edited after signing (also by a later unsigned commit), hidden local changes (assume-unchanged, skip-worktree, a racy-git timestamp), the working-tree file differing from HEAD, a shallow clone, replace refs and grafts (the gate runs git with --no-replace-objects), the decision-to-field matching (a 'triaged' decision on an acceptance field, a record for a parent or child field, another subject, a stale subject_version after the hazard changes), the new withdrawals (a later rejection or return withdrawing an acceptance; supersedes chains; a supersedes naming nothing or itself; a rejection signed by an unlisted key), and the risk-vocabulary role rule (cso always required). Confirm each documented tightening holds.`],
]

const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    cases: { type: 'string', description: 'every case: setup, expected, actual, verdict' },
    defects: { type: 'array', items: { type: 'object', properties: {
      title: { type: 'string' }, severity: { type: 'string', enum: ['critical', 'major', 'minor'] },
      reproduction: { type: 'string' }, expected: { type: 'string' }, actual: { type: 'string' }, fix: { type: 'string' },
    }, required: ['title', 'severity', 'reproduction', 'expected', 'actual', 'fix'] } },
  },
  required: ['cases', 'defects'],
}

const S0_COMMON = `Context: the HMS Kurdistan hospital-system build, work package WP-0.7 "Design system and client shells" (BUILD-PROMPT.md §21 row 0.7; read-only, 2951 lines). Workspace: the WP-0.7 worktree ${WT}, branch wp/0.7-design-system, now at 05f159a (the WP-0.1 review-fix commit), with slice S0's specification files untracked: docs/specs/modules/design-system.md, docs/specs/state-machines/patient-context.{yaml,md}, docs/specs/hal/** (README, schema, 69 fixtures). Its .tools is a junction to the main checkout's toolchain. The implementation plan is C:\\Users\\Surface\\AppData\\Local\\Temp\\hms-wp07\\plan.md; S0's final programme entries (with placeholders DN-new-n, OQ-new-n, KA-new-n, and hazard-log and safety-README texts) are in C:\\Users\\Surface\\AppData\\Local\\Temp\\hms-wp07\\s0-programme-entries.md; the human lead's exact answers are in C:\\Users\\Surface\\AppData\\Local\\Temp\\hms-wp07\\human-answers.txt.

Rules: honesty (§3.5: no claimed run that did not happen; no approval, sign-off or human decision written by you except the two the human gave, quoted exactly with date 2026-10-18 and "answered in chat through the question tool"); never weaken a safety invariant; British English and the exact style and table layouts of each programme file; never commit, reset, stash, checkout or rebase (the lead does git); never touch the main checkout ${MAIN}. Runs here are "Windows host", not evidence of record.

ID ranges reserved for WP-0.7 in docs/program/STATUS.md (main checkout): DN-020…DN-039, OQ-140…OQ-159, KA-025…KA-044, HAZ-0030…HAZ-0034, no ADR. Do not use numbers outside them.`

const INTEGRATE = `${S0_COMMON}

You integrate slice S0:
1. Assign real numbers to every placeholder (DN-new-n to DN-020 upward in order, OQ-new-n to OQ-140 upward, KA-new-n to KA-025 upward) consistently in the entries and in every spec file (grep -rn "\\-new-" docs/specs must find nothing afterwards).
2. Add the entries to docs/program/DECISIONS-NEEDED.md, OPEN-QUESTIONS.md and KNOWN-ANOMALIES.md in each file's format and section. The translation decision and the licence decision are closed DNs with the human's quoted answers; every CSO reading is open, [HUMAN], with its default in use; keep "Blocking now" at most ten items (most WP-0.7 items block "later" or "WP-0.7 close"). Respect each file's rules (read its header).
3. Apply the hazard-log notes (docs/safety/hazard-log.yaml) and the docs/safety/README.md Tightenings rows and open-question item exactly as the entries say, changing no invariant text and no control state; run sh tools/hms safety check and sh tools/hms backlog render then check.
4. docs/program/WORK-PACKAGES.md: WP-0.7 state "in progress" (match the existing format); docs/program/work-packages/WP-0.7.md: add the branch, the slice list and the S0 deliverables if the file's format has a place for them; the backlog rows of PLT-UX-01, PLT-UX-02, PLT-UX-03 and KRI-LOC-01 move to the status the backlog's rules give a feature whose spec is written (read docs/program/backlog.yaml's header and the backlog tool's rules first; render BACKLOG.md with the tool, never by hand).
5. Bootstrap the worktree's frontend packages if node_modules is missing (sh tools/bootstrap frontend, or whatever tools/bootstrap --help says), then run the fast tier in the worktree: sh tools/ci/run fast --no-evidence. It must PASS; fix anything in your files that fails it, and report anything else.
Return: every number assigned (placeholder -> real ID), every file changed, the check and fast-tier results exactly as printed, and a draft commit message (conventional style "docs(design-system): ...", body listing what S0 adds, the decisions recorded, "Hazards:" naming the hazard entries the spec's controls belong to as the hazard log lists them, and nothing claimed that did not run).`

phase('Verify')
const verifyP = parallel(LENSES.map(([key, lens]) => () =>
  agent(`${GATE_COMMON}\n\n${lens}`, { label: `verify:${key}`, phase: 'Verify', schema: VERIFY_SCHEMA, effort: 'high' })
    .then(r => r ? { lens: key, ...r } : null)))

phase('Integrate')
const s0P = agent(INTEGRATE, { label: 's0-integrate', phase: 'Integrate', effort: 'high', schema: {
  type: 'object',
  properties: { numbers: { type: 'string' }, files: { type: 'string' }, results: { type: 'string' }, commit_message: { type: 'string' }, notes: { type: 'string' } },
  required: ['numbers', 'files', 'results', 'commit_message', 'notes'],
} }).then(async s0 => {
  if (!s0) return { s0: null }
  const review = await agent(`${S0_COMMON}

You are an independent reviewer of the S0 integration in the worktree (git status --short, git diff, and the untracked spec files). Edit nothing. Check: every new ID is in the reserved range, unique and resolves everywhere it is cited (grep the main checkout's wp/0.2-environments branch too with git show, for OQ-106 and OQ-107 only); no placeholder is left; the two human decisions are quoted exactly from human-answers.txt and nothing else is presented as a human decision; every CSO reading is open with its default; the hazard-log and safety-README edits change no invariant text and no control state, and match the entries file; the backlog was rendered by the tool; the fast-tier result is as reported (re-run sh tools/hms repo check, safety check and backlog check yourself); style and table layouts match neighbouring entries. Report only real, specific issues with evidence.

The integrator reported: ${JSON.stringify(s0)}`, { label: 's0-review', phase: 'Review', effort: 'high', schema: {
    type: 'object',
    properties: { issues: { type: 'array', items: { type: 'object', properties: {
      severity: { type: 'string', enum: ['critical', 'major', 'minor'] }, file: { type: 'string' }, problem: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' },
    }, required: ['severity', 'file', 'problem', 'evidence', 'fix'] } } },
    required: ['issues'],
  } })
  if (!review || !review.issues.length) return { s0, review, fix: null }
  const fix = await agent(`${S0_COMMON}

Close the issues an independent reviewer found in the S0 integration. For each: confirm, fix if real, otherwise say why not. Then re-run the three checks and sh tools/ci/run fast --no-evidence in the worktree.

Integrator's report: ${JSON.stringify(s0)}
Issues: ${JSON.stringify(review.issues, null, 1)}

Return each outcome, the results exactly as printed, and the final commit message.`, { label: 's0-fix', phase: 'Fix', effort: 'high', schema: {
    type: 'object', properties: { outcomes: { type: 'string' }, results: { type: 'string' }, commit_message: { type: 'string' } },
    required: ['outcomes', 'results', 'commit_message'],
  } })
  return { s0, review, fix }
})

const [verify, wp07] = await Promise.all([verifyP, s0P])
const defects = verify.filter(Boolean).flatMap(v => v.defects.map(d => ({ lens: v.lens, ...d })))
log(`sign-off verification: ${defects.length} defects; S0 integration ${wp07 && wp07.s0 ? 'done' : 'FAILED'}`)

let gateFix = null
if (defects.length) {
  gateFix = await agent(`${GATE_COMMON}

Two independent verifiers reported these defects in the sign-off gate at 05f159a. You now own tools/hmstools/safety/** and docs/safety/signoffs/** and the KA-011 row of docs/program/KNOWN-ANOMALIES.md in ${MAIN} (you may edit those files in the Windows checkout; still no git writes). For each defect: reproduce it with its script; if real, fix it in the code, add a regression test (fake-git in test_git_authentication.py or test_signoff_gate.py, and a real-signature test in test_signed_commits.py where signatures matter), and update the docstring, README and KA-011 so every claim matches the code; if not real, explain with evidence. Never loosen a rule to make a case pass. Then run the safety tests on Windows (.tools/venv/Scripts/python.exe -I -m unittest discover -s tools/hmstools/safety/tests -t tools) and in WSL (MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu-24.04 --exec bash -lc 'cd /mnt/c/Users/Surface/.t3/projects/hospitalmanagementsystem && ~/src/hospitalmanagementsystem/.tools/venv/bin/python -I -m unittest discover -s tools/hmstools/safety/tests -t tools'), sh tools/hms safety check, and the secret scan (sh tools/ci/run fast --only secret-scan --no-evidence).

Defects: ${JSON.stringify(defects, null, 1)}

Return each defect's outcome, the files changed, the test results exactly as printed, and a draft commit message.`, { label: 'gate-fix', phase: 'Fix', effort: 'xhigh', schema: {
    type: 'object', properties: { outcomes: { type: 'string' }, files: { type: 'string' }, results: { type: 'string' }, commit_message: { type: 'string' } },
    required: ['outcomes', 'files', 'results', 'commit_message'],
  } })
}

return { verify, defects, gateFix, wp07 }
