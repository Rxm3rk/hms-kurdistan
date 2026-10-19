export const meta = {
  name: 'wp01-closeout',
  description: 'Finish the WP-0.1 review fixes (sign-off merge lock, gitleaks hit, integration wrap-up, gates-bite script into the repo), review from four angles, close the issues',
  phases: [
    { title: 'Finish', detail: 'sign-off fixes, integration wrap-up and the gates-bite port in parallel, file-disjoint' },
    { title: 'Plants', detail: 'merge plants and a full gates-bite dry run against the finished fix' },
    { title: 'Review', detail: 'code, sign-off attack, records and plan-conformance lenses' },
    { title: 'Close', detail: 'fix confirmed issues, final suite and checks' },
  ],
}

const REPO = 'C:\\Users\\Surface\\.t3\\projects\\hospitalmanagementsystem'
const NOTES = 'C:\\Users\\Surface\\AppData\\Local\\Temp\\hms-wp01'
const GB = 'C:\\Users\\Surface\\AppData\\Local\\Temp\\hms-wp01\\gates-bite'

const COMMON = `Context: the HMS Kurdistan hospital-system build (a hospital system for private hospitals in the Kurdistan Region of Iraq), work package WP-0.1 (programme bootstrap). Repository: ${REPO} (Windows checkout; Git Bash and PowerShell available; WSL Ubuntu-24.04 available). Branch wp/0.1-programme-bootstrap at 6ca3e3a, with a large uncommitted working tree that resolves the automated review docs/program/reviews/WP-0.1.md (findings R-01 to R-21 in its section 3; resolution rules in docs/program/reviews/README.md). Four groups did the fixes; their final reports (with the problems their adversarial verifiers raised and the cross-file edits they asked for) are in ${NOTES}\\notes-signoff-gate.txt, notes-hazard-log.txt, notes-host-docs-oq.txt and notes-tools-ka.txt. An integrator then applied the cross-file edits but was cut off by a usage limit before it verified its work or reported. Governing text: BUILD-PROMPT.md (plan of record, read-only, 2951 lines; read sections with Grep and line-ranged Read).

Ground rules (non-negotiable):
- Honesty (BUILD-PROMPT §3.5): never claim a run that did not happen; never write an approval, a sign-off or a human decision; runs on this Windows checkout are "Windows host", not evidence of record. Never weaken or reinterpret a safety invariant (§3.4 item 1); a tightening is recorded as such.
- Read-only: BUILD-PROMPT.md, BLUEPRINT*.md, research/**, docs/program/reviews/WP-0.1.md, docs/program/evidence/**, docs/program/STATUS.md (the lead rewrites it; report what it must say).
- Git in the Windows checkout: never commit, stash, reset, restore, checkout, clean or rebase. The index already holds six mode-only changes (100644 to 100755: backend/gradlew, tools/ci/run, tools/hms, tools/doctor, tools/bootstrap, tools/host/provision-ubuntu.sh) and the staged new file tools/hmstools/backlog/hazards.py; never touch them. Leave new files unstaged (the lead stages at commit time). Scratch work goes under %TEMP% or WSL /tmp, or in a WSL scratch clone, never in the checkout.
- Style: match surrounding text exactly (British English, plain precise sentences, §-references, paths in backticks, the existing ID formats and table layouts).
- Record numbers in use: OQ up to OQ-121, KA up to KA-013, DN up to DN-014 (OQ-106 and OQ-107 live on the stacked branch wp/0.2-environments). New ones continue at OQ-122, KA-014, DN-015; grep before assigning.
- Tests: .tools/venv/Scripts/python.exe -I -m unittest discover -s tools -t tools -p "test_*.py" (whole suite, about 600 tests, about 5 minutes), or one area with -s tools/hmstools/<area>/tests -t tools. Checks: sh tools/hms safety check ; sh tools/hms repo check ; sh tools/hms backlog check. Tests that need gpg or ssh-keygen run in WSL: MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu-24.04 --exec bash -lc 'cd /mnt/c/Users/Surface/.t3/projects/hospitalmanagementsystem && ~/src/hospitalmanagementsystem/.tools/venv/bin/python -I -m unittest discover -s tools/hmstools/safety/tests -t tools'. Other agents edit other files at the same time, so a failure outside your files may be theirs: re-run, and report it rather than chase it. Report counts exactly as printed, with the host.`

const SIGNOFF = `${COMMON}

You own: tools/hmstools/safety/** (code and tests), docs/safety/signoffs/** (README, schemas, allowed-signers.yaml) and the KA-011 row of docs/program/KNOWN-ANOMALIES.md (no other row, and no other file). Read notes-signoff-gate.txt first, then signoffs.py (GitAuthenticator and its docstring), check.py, test_git_authentication.py, test_signed_commits.py, test_signoff_gate.py and the review's R-01 and R-20.

A separate "gates bite" agent planted violations against a snapshot of this fix (its scripts are in ${GB}: gates-bite.sh, its sign-off section "The sign-off gate with a listed key (scratch trust anchor)", and probe-merge.sh) and found two real problems. Fix both.

1. The secret scan fails on a clean tree. gitleaks' generic-api-key rule flags tools/hmstools/safety/tests/test_git_authentication.py lines 27 to 29 (KEY_A, SUBKEY_A, KEY_B are hex literals beside the word KEY). Generate the synthetic fingerprints at import time (for example from hashlib of a fixed label) or otherwise make them not look like secrets, without adding an allowlist that weakens the scanner. Then run the project's secret scan on the working tree the way the fast tier does (tools/hmstools/ci/tiers.py secret_scan: .tools/bin/gitleaks.exe with .gitleaks.toml; read how it is invoked, run the same command in the Windows checkout, and also check every other new test or fixture file you own for the same pattern). It must report no finding.

2. A merge can lock the gate for good. When two lines of history each anchored a key independently (main anchors key A for the CSO; a side branch forked before that anchor anchors key B), _before() returns the _CONFLICT state whose keepers are the keys listed on every side, which is empty. Every later change is then rejected ("which not every side lists"), including a merge signed by A that keeps A's list, and since the trusted version stays _CONFLICT nothing can ever restore trust short of rewriting history. Fail-closed is right for the merge itself; a permanent lock is not. Redesign the conflict rule so that:
   - no single side's key can decide alone where the sides trust different versions (otherwise an agent that anchors its own key on a side branch forked before the human's anchor could take over the list: the KA-011 weakness must not grow from "the first anchor" to "any time, through a merge");
   - trust can be restored without rewriting history: a version of the list becomes trusted after the conflict once, for every keyed side, a good signature by a key that side lists (with the role rules the list carries, and no AI co-author trailer) has approved that same signer content. Approvals are commits that touch the list (only those appear in the history walk), so compare the parsed signer content rather than the blob, letting a comment-only edit carry a further approval; an edit that changes the signer content starts the approvals again. A key listed on every side satisfies every side in one commit, so this generalises today's "a key listed on every side" rule;
   - every rogue variant in probe-merge.sh still fails closed, every existing test still passes or is updated with a written reason, and the original fail-closed behaviour for unsigned, unlisted, AI-trailer and invalid-version changes is unchanged. Consider octopus merges, criss-cross merges, a revert of the merge, and a later merge of a third line.
   Choose the cleanest implementation you can justify (you may restructure _Trusted, _before and _judge). Write tests in both test files: the fake-git tests and real-git tests (real GPG or SSH signatures in temporary repositories, run in WSL), including each probe-merge.sh scenario and the recovery path. Update the GitAuthenticator docstring, the error and warning messages (a locked gate must say exactly what restores it), docs/safety/signoffs/README.md and the KA-011 row, so that every claim matches the code. Verify each claim in KA-011 against the code before writing it.

Finally run the safety tests on Windows and in WSL, the secret scan, and sh tools/hms safety check. Return: what you changed (file, what, why), the new rule in plain words, each probe-merge.sh scenario and its result, test counts, and anything another file must now say (for the lead or the closer).`

const WRAPUP = `${COMMON}

You finish the integrator's work. You own every file except tools/hmstools/safety/**, docs/safety/signoffs/**, docs/program/KNOWN-ANOMALIES.md (another agent edits KA-011 now; report any KA problem instead of editing) and tools/ci/gates-bite/** (another agent creates it).

The integrator's brief listed these items (check each against the four notes files too, which have the exact texts):
- KNOWN-ANOMALIES.md: KA-011 description (now owned by another agent), KA-013 for the state-machine spec version limitation, KA-006 and KA-008 re-checked against the final hazard log, KA-010's Closes-with cell reading exactly "the R-05 resolution commit (SHA recorded in docs/program/reviews/WP-0.1.md)". Read-only for you: verify and report.
- DECISIONS-NEEDED.md: the R-03 edits near lines 5 and 16; DN-014 as the hazard-log group wrote it.
- OPEN-QUESTIONS.md: OQ-120 (the SI-05 clause d gap before the Dose Engine) and OQ-121 (whether a hazard's risk acceptance survives linking a release or an incident); docs/safety/README.md open question 9 and the hazard-log notes point to OQ-120 (docs/safety/README.md and docs/safety/hazard-log.yaml are yours; docs/safety/signoffs/ is not).
- docs/adr/README.md (the "No ADR claims a guard result" sentence); ADR-019:42 and tools/licence/README.md:20-21 (the frontend command runs from frontend/); ADR-002's two backend/gradlew commands; ADR-022's licence behaviour; docs/program/COMMANDS.md (licence row, backlog-check row, hazards no longer hand-edited, the JDK pin and checksum wording in §1, the repo-check row).
- tools/host/provision-ubuntu.sh: comments only, header claims matching tools/host/README.md and DN-001, and that the build does not use the system OpenJDK; behaviour suggestions stay suggestions for the lead.
- tools/hmstools/ci/runner.py: the full Java identity in the CI host record, with tests, consistent with bootstrap's JavaIdentity; tools/ci/README.md documents the fields.
- the new repo-check rule (f): git's index stores the entry scripts and backend/gradlew as executable (100755), in tools/hmstools/repo/rules.py with tests in test_repo.py, documented in COMMANDS.md and tools/README.md. The integrator had to repair two string literals in rules.py that the shell had collapsed (a NUL and a tab): confirm the file has no stray control bytes and the rule is correct on Windows and Linux (core.fileMode false on Windows).
- After all hazard-log edits: sh tools/hms backlog render, then sh tools/hms backlog check.
- The contradiction sweep: git grep for any doc still saying a conditional licence only warns, any Corretto or "latest" JDK fallback promise, any "no decision authorises" wording, the --dir frontend command form, and fix them in files you own (not plan of record, not evidence).
Re-read each file and confirm every item is applied correctly and reads well; finish anything missing or wrong; check every ID reference you touch resolves. Then run the whole tools suite and the three checks, and list git status --short.

Return: what you verified as already applied, what you changed and why, every note item not applied and why, test and check results, a draft of what docs/program/STATUS.md must now say (keep it at most 150 lines in total, at most ten Blocking-now items in DECISIONS-NEEDED), and anything only the lead can do.`

const PORT = `${COMMON}

You own a new directory tools/ci/gates-bite/ (and nothing else in the checkout). The "gates bite" plant matrix (BUILD-PROMPT §19.1 and the WP-0.1 exit evidence; review finding R-06's direction: re-run the plant matrix at a committed SHA in the WSL clone, with the right evidence names) is today a script outside the repository: ${GB}\\gates-bite.sh with gb_record.py, plant_edit.py and so_version.py (setup-plant-clone.sh, snapshot-fix.sh, watch-run.sh, stop-run.sh and show-errors.sh are operator helpers; probe-merge.sh is a separate probe). Bring it into the repository so the record of record can be reproduced from the commit:
- tools/ci/gates-bite/ holds the script and its helpers with a README.md: what it proves (each gate fails on a planted violation and passes once it is removed), how to run it (in a scratch clone at a committed SHA, never in the checkout it lives in; it must refuse to run in a dirty tree or in the developer's checkout), what it writes (a Markdown record named per docs/program/evidence/README.md, which you read), how long it takes, and its known PASS rows (the control plant and the KA-011 plant) and why they pass.
- No hard-coded paths to %TEMP%, ~/src/hms-plant or this machine: take the clone path and output path as arguments, with the defaults documented. Run it with sh or bash explicitly (no exec bit needed; say so in the README).
- Nothing in the committed files may trip the repository's own gates: any planted secret, AI trailer or forbidden pattern must be generated at run time, not written literally. Run the project's secret scan (tools/hmstools/ci/tiers.py secret_scan shows how; .tools/bin/gitleaks.exe with .gitleaks.toml) and sh tools/hms repo check over the working tree, and fix any finding in your files.
- Keep the plant list and the expected results exactly as the dry runs established them (read the script's comments and the last record /tmp/gates-bite-fix-snapshot.md in WSL); do not add or drop plants except to fix a defect, which you report.
- Dry-run it in WSL: make a scratch clone (for example ~/src/hms-plant, which the previous agent left clean at 6ca3e3a, or a fresh clone of ~/src/hospitalmanagementsystem), commit a snapshot of the Windows working tree there as an unreferenced commit the way snapshot-fix.sh does, and run every section except the sign-off section (another agent is changing the sign-off gate right now; the sign-off section is re-run after it finishes) and except the Gradle section if it takes longer than 20 minutes (then run only one Gradle plant and say so). Delete temporary keyrings afterwards.
Return: the files you created, how the README tells the operator to run it, the dry-run results per plant (FAIL or PASS and the naming line), anything you could not run, and the exact command the lead should use for the record of record at the fix commit.`

const PLANTS = (signoff, port) => `${COMMON}

The sign-off gate fix and the port of the gates-bite script into tools/ci/gates-bite/ have both finished. Their reports:
SIGN-OFF FIX: ${JSON.stringify(signoff)}
PORT: ${JSON.stringify(port)}

You own tools/ci/gates-bite/** now. Add the merge plants from ${GB}\\probe-merge.sh to the sign-off section of tools/ci/gates-bite/gates-bite.sh, each as its own plant with an expected result under the new rule: every rogue variant (a side branch forked before the anchor anchors the agent's key B, then merged either way round, with or without B's signature, keeping either side's list) must FAIL with the gate naming why; the recovery path (approvals from every keyed side for the same signer content) is a control that must PASS and is labelled as the control; the KA-011 plant stays a known-limitation PASS. Then run the full plant matrix once in a WSL scratch clone, against a snapshot of the Windows working tree committed there as an unreferenced commit, including the sign-off section (Gradle section: one plant if the full section takes more than 20 minutes; say so). If a plant behaves unexpectedly, find out whether the script or the gate is wrong; fix the script if it is the script, and report a gate defect with a reproduction instead of editing the gate (not yours). Update the README for the new plants. Return the per-plant table (plant, expected, result, naming line), totals, any gate defect with its reproduction, and the exact command for the record of record.`

const LENSES = [
  {
    key: 'code',
    prompt: `Lens: CODE AND TESTS (all Python except the sign-off trust chain, which another reviewer attacks). Review every changed or new Python file (git diff --stat; git status --short for untracked files): licence, repo (including the new executable-bit rule (f)), backlog (including hazards.py), bootstrap, doctor, ci (runner host record), and safety/check.py and the parts of signoffs.py outside GitAuthenticator (decision-to-field matching, subject_version, content_version, scan_gate_fields). For each finding with code (R-05's backlog part, R-14, R-17, R-18, R-20 and any other), read the code, run its tests, and try to break it with scratch cases (scratch only under %TEMP% or WSL /tmp). Look for regressions in the existing gates (the review report's section 2 plant matrix must still fail in every case), fail-open paths, exceptions swallowed silently, Windows/Linux differences, and tests that assert nothing.`,
  },
  {
    key: 'signoff-attack',
    prompt: `Lens: ATTACK THE SIGN-OFF GATE. You are an agent that wants a sign-off record to authorise a hazard acceptance without the human. Read GitAuthenticator in tools/hmstools/safety/signoffs.py and its docstring, check.py, the README in docs/safety/signoffs/ and KA-011. In WSL scratch repositories under /tmp (copy the tools/ tree and docs/safety/ there, init git, make throwaway GPG and SSH keys in a temporary GNUPGHOME; delete them after), try every route: unsigned or AI-trailer commits, keys not listed, subkeys, SSH versus GPG key types, role and name mismatches, signer_key mismatch, editing a record after signing, assume-unchanged and skip-worktree, shallow clones, grafts and replace refs, history rewrites, merges in every order (side branch forked before the anchor, octopus, criss-cross, reverts of merges, a third line merged later), the new recovery rule after a conflict (can one side's key collect all approvals alone, for example by listing itself on both sides, by comment-only edits, by changing roles between approvals, or by an approval that predates the conflict?), commit-message tricks, and anything else. Report each route you tried with its result; an issue is any route that authorises without the human beyond the recorded KA-011 first-anchor limitation, or any legitimate human route that locks forever.`,
  },
  {
    key: 'records',
    prompt: `Lens: RECORDS, HONESTY AND CROSS-REFERENCES. Review every changed documentation and record file: docs/program/{KNOWN-ANOMALIES,DECISIONS-NEEDED,OPEN-QUESTIONS,COMMANDS,WORK-PACKAGES}.md, docs/program/work-packages/WP-0.1.md, docs/safety/**, docs/adr/**, the READMEs (including tools/ci/gates-bite/README.md if it exists), tools/host/**, backend/gradle/libs.versions.toml comments. Check: every ID reference resolves and every number is unique (OQ-, DN-, KA-, HAZ-, CTRL-, SI-, R-, ADR-); no claim of a run, check or verification that the repository does not back (invented hashes, counts or dates, or "verified" without a record; compare every SHA-256 written with tools/hmstools/bootstrap/steps.py and the DN entries); nothing records a human approval or decision that was not quoted from the human; Windows-host versus evidence-of-record labelling is right; the docs agree with the code (what the sign-off gate, the licence check, the repo check and the CI runner actually do); style and table layouts match neighbouring entries; the repo check's limits (STATUS.md at most 150 lines, at most ten Blocking-now items).`,
  },
  {
    key: 'plan',
    prompt: `Lens: PLAN CONFORMANCE. For every finding R-01 to R-21 (and observation O-8), read the finding's Where, Rule and Direction in docs/program/reviews/WP-0.1.md and the BUILD-PROMPT text it cites, then check the working tree against it: is every location addressed, is the Direction followed or the departure justified in the changed file itself, and is anything the rule requires still missing? Pay particular attention to the safety texts: docs/safety/hazard-log.yaml changes (CTRL-0014-4 and HAZ-0014 against SI-14 in §2.1; CTRL-0005-7 and -10 against SI-05 and §2.1 (c); CTRL-0011-9 against SI-11 and §10.3 D; every nightly property control against §18.3; the recorded tightenings): quote the invariant text and confirm it is unchanged and not narrowed; and the schema departures from Appendix B.2. Note which findings still need the lead's evidence re-runs (R-06, R-07 and any other) and say plainly for each finding whether its Resolution may honestly say "resolved" once the lead's re-runs are stored.`,
  },
]

const ISSUES_SCHEMA = {
  type: 'object',
  properties: {
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['critical', 'major', 'minor'] },
          file: { type: 'string' },
          location: { type: 'string' },
          problem: { type: 'string' },
          evidence: { type: 'string', description: 'what you read or ran that shows it' },
          fix: { type: 'string' },
        },
        required: ['severity', 'file', 'location', 'problem', 'evidence', 'fix'],
      },
    },
    findings_check: { type: 'string', description: 'per review finding in your lens, or per attack route: one line each' },
  },
  required: ['issues', 'findings_check'],
}

const REPORT = {
  type: 'object',
  properties: {
    changes: { type: 'string', description: 'file, what, why' },
    results: { type: 'string', description: 'tests, checks, dry runs: counts exactly as printed, with host' },
    not_done: { type: 'string', description: 'anything not done and why' },
    for_lead: { type: 'string', description: 'decisions, record texts, STATUS draft, commands only the lead can run' },
  },
  required: ['changes', 'results', 'not_done', 'for_lead'],
}

phase('Finish')
const [signoff, wrapup, port] = await parallel([
  () => agent(SIGNOFF, { label: 'signoff-fix', phase: 'Finish', schema: REPORT, effort: 'xhigh' }),
  () => agent(WRAPUP, { label: 'wrap-up', phase: 'Finish', schema: REPORT, effort: 'high' }),
  () => agent(PORT, { label: 'gates-bite-port', phase: 'Finish', schema: REPORT, effort: 'high' }),
])
log(`finish: signoff ${signoff ? 'ok' : 'FAILED'}, wrap-up ${wrapup ? 'ok' : 'FAILED'}, port ${port ? 'ok' : 'FAILED'}`)
if (!signoff) return { error: 'signoff agent returned nothing', wrapup, port }

const reviewInput = `Reports of the agents that just finished:
SIGN-OFF FIX: ${JSON.stringify(signoff)}
WRAP-UP: ${JSON.stringify(wrapup)}
GATES-BITE PORT: ${JSON.stringify(port)}`

phase('Plants')
const [plants, ...reviews] = await parallel([
  () => port ? agent(PLANTS(signoff, port), { label: 'gates-bite-plants', phase: 'Plants', schema: REPORT, effort: 'high' }) : Promise.resolve(null),
  ...LENSES.map(l => () =>
    agent(`${COMMON}

You are an independent reviewer of the whole uncommitted working tree (git diff, plus untracked files from git status --short). You edit nothing in the checkout: no file writes, no git writes there. ${l.prompt}

${reviewInput}

Report only real, specific issues with evidence; rank them. Do not report style nits unless they break the neighbouring format.`,
      { label: `review:${l.key}`, phase: 'Review', schema: ISSUES_SCHEMA, effort: 'high' })
      .then(r => r ? { lens: l.key, ...r } : null)),
])

const all = reviews.filter(Boolean)
const issues = all.flatMap(r => r.issues.map(i => ({ lens: r.lens, ...i })))
log(`${issues.length} issues from ${all.length} reviewers (${issues.filter(i => i.severity !== 'minor').length} critical or major); plants ${plants ? 'ok' : 'missing'}`)

phase('Close')
const close = await agent(`${COMMON}

You close the issues that four independent reviewers and the gates-bite plant run found in the uncommitted working tree. You may edit any file the ground rules allow. For each issue: confirm it (read the evidence yourself, reproduce where you can); if real, fix it; if not real, say why with evidence. For a sign-off gate change, add or update tests in both test files and re-run the safety tests in WSL. Re-run the affected tests and, at the end, the whole tools suite (Windows), the safety tests in WSL, the secret scan the way the fast tier runs it, and the three checks.

${reviewInput}
GATES-BITE PLANTS: ${JSON.stringify(plants)}

Issues:
${JSON.stringify(issues, null, 1)}

Their per-finding and per-route checks:
${JSON.stringify(all.map(r => ({ lens: r.lens, findings_check: r.findings_check })), null, 1)}

Return: for each issue, fixed / rejected (with reason) / left for the lead (with reason); the final test and check results; a draft of what docs/program/STATUS.md must say (at most 150 lines; it replaces the current draft); the one-line Resolution note for each of R-01 to R-21 (without the SHA; the lead adds it); and the lead's remaining steps (evidence re-runs with exact commands).`,
  { label: 'close', phase: 'Close', effort: 'xhigh', schema: {
    type: 'object',
    properties: {
      outcomes: { type: 'string' },
      tests: { type: 'string' },
      status_draft: { type: 'string' },
      resolution_notes: { type: 'string' },
      for_lead: { type: 'string' },
    },
    required: ['outcomes', 'tests', 'status_draft', 'resolution_notes', 'for_lead'],
  } })

return { signoff, wrapup, port, plants, reviews: all, close }
