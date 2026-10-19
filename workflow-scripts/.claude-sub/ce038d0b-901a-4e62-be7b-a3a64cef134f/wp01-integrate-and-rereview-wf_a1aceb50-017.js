export const meta = {
  name: 'wp01-integrate-and-rereview',
  description: 'Apply the cross-group follow-ups of the WP-0.1 fixes, then a three-lens review of the whole diff, then close confirmed issues',
  phases: [
    { title: 'Integrate', detail: 'one agent applies every cross-file note in order' },
    { title: 'Review', detail: 'code, records and plan-conformance lenses in parallel' },
    { title: 'Close', detail: 'fix confirmed issues' },
  ],
}

const REPO = 'C:\\Users\\Surface\\.t3\\projects\\hospitalmanagementsystem'
const NOTES = 'C:\\Users\\Surface\\AppData\\Local\\Temp\\hms-wp01'

const COMMON = `Context: the HMS Kurdistan hospital-system build, work package WP-0.1 (programme bootstrap). Repository: ${REPO} (Windows checkout; Git Bash and PowerShell). Branch wp/0.1-programme-bootstrap at 6ca3e3a, with a large uncommitted working tree that resolves the automated review docs/program/reviews/WP-0.1.md (findings R-01 to R-21, section 3). Four groups did that work in parallel; their final reports, including exact edits they needed in files they did not own and the problems their adversarial verifiers raised, are in ${NOTES}\\notes-signoff-gate.txt, notes-hazard-log.txt, notes-host-docs-oq.txt and notes-tools-ka.txt. Governing text: BUILD-PROMPT.md (plan of record, read-only, 2951 lines, read with line ranges).

Ground rules:
- Honesty (BUILD-PROMPT §3.5): never claim a run that did not happen; never write an approval, sign-off or human decision; runs on this checkout are "Windows host", not evidence of record. Never weaken or reinterpret a safety invariant (§3.4 item 1); tightenings must be recorded as such.
- Read-only: BUILD-PROMPT.md, BLUEPRINT*.md, research/**, docs/program/reviews/WP-0.1.md, docs/program/evidence/**.
- docs/program/STATUS.md belongs to the lead: do not edit it; report what it must say.
- Git: do not commit, stash, reset, restore, checkout or clean. The index already holds six mode-only changes (100644 to 100755 for backend/gradlew, tools/ci/run, tools/hms, tools/doctor, tools/bootstrap, tools/host/provision-ubuntu.sh); never touch them. You may stage a new untracked file only if asked below.
- Style: match surrounding text exactly (British English, plain precise sentences, §-references, paths in backticks, existing ID formats and table layouts).
- Tests: .tools/venv/Scripts/python.exe -I -m unittest discover -s tools -t tools -p "test_*.py" (whole suite, about 580 tests, about 5 minutes), or one area with -s tools/hmstools/<area>/tests -t tools. Checks: sh tools/hms safety check ; sh tools/hms repo check ; sh tools/hms backlog check. Tests needing gpg or ssh-keygen may need WSL: MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu-24.04 --exec bash -lc 'cd /mnt/c/Users/Surface/.t3/projects/hospitalmanagementsystem && ~/src/hospitalmanagementsystem/.tools/venv/bin/python -I -m unittest discover -s tools/hmstools/safety/tests -t tools'. Report counts exactly as printed and the host.
- Record numbers already used: OQ-106, OQ-107 (stacked branch wp/0.2-environments), OQ-108 to OQ-119 (this fix), DN-014 (this fix), KA up to KA-012. New ones continue at OQ-120, KA-013 and DN-015.`

const INTEGRATE = `${COMMON}

You are the integrator. Read all four notes files in full, plus the review report's findings, then apply every cross-file change the groups and their verifiers asked for, in order, re-reading each file before editing. In particular (check the notes for the exact text; this list is not exhaustive):
- docs/program/KNOWN-ANOMALIES.md: replace KA-011's description with the sign-off group's final text (verify each claim in it against tools/hmstools/safety/signoffs.py and its tests before writing it; correct anything the code does not do); add KA-013 for the state-machine spec version limitation; re-check KA-006 and KA-008 against the final hazard log; KA-010's Closes-with cell keeps a clear placeholder for the R-05 commit SHA, written exactly as: "the R-05 resolution commit (SHA recorded in docs/program/reviews/WP-0.1.md)".
- docs/program/DECISIONS-NEEDED.md: the R-03 edits at lines ~5 and ~16; keep DN-014 as the hazard-log group wrote it.
- docs/program/OPEN-QUESTIONS.md: add OQ-120 for the SI-05 clause d gap before the Dose Engine (the hazard-log group's text; it blocks nothing now, matters before R2b go-live), and OQ-121 for the CSO question whether a hazard's risk acceptance should survive linking a release or an incident; make docs/safety/README.md's open question 9 and the relevant hazard-log notes point to OQ-120.
- docs/adr/README.md line ~5 (the "No ADR claims a guard result" sentence); docs/adr/ADR-019-clients.md:42 and tools/licence/README.md:20-21 (the frontend command must be run from frontend/); ADR-002 lines ~24 and ~83 to sh backend/gradlew if the notes ask; ADR-022 lines ~42-48 for the new licence behaviour; docs/program/COMMANDS.md (licence row, backlog-check row, hazards no longer hand-edited, the JDK pin and checksum wording in §1, anything else the notes list).
- tools/host/provision-ubuntu.sh: comments only (do not change behaviour); make its header's claims match what tools/host/README.md and DN-001 list, or list the missing items there; mention that the build does not use the system OpenJDK the script installs (the pinned .tools JDK is put first). The groups' suggestions to change the script's behaviour stay suggestions: list them for the lead.
- tools/hmstools/ci/runner.py records only the first line of java -version: if the tools group's note asks to record the full identity (vendor and build), implement it with a test, consistent with tools/hmstools/bootstrap/steps.py's JavaIdentity.
- Stage the new untracked file tools/hmstools/backlog/hazards.py (git add tools/hmstools/backlog/hazards.py) only after confirming it is used and tested. Leave every other new untracked file unstaged (the lead stages everything at commit time).
- After all hazard-log edits are final: sh tools/hms backlog render, then sh tools/hms backlog check.
- Then search for every remaining contradiction the verifiers named (for example any doc still saying a conditional licence only warns, any doc still promising a Corretto or "latest" JDK fallback, any "no decision authorises" wording, the --dir frontend command form) with git grep, and fix those in non-plan-of-record files.
- Finally run the whole tools suite and the three checks, and list git status --short.
Return: every change you made (file, what), every note item you did NOT apply and why, the test and check results, and a draft of exactly what docs/program/STATUS.md must now say (current state of the review fixes, the new records, the remaining evidence re-runs) for the lead.`

const REPORT_SCHEMA = {
  type: 'object',
  properties: {
    applied: { type: 'string' },
    not_applied: { type: 'string' },
    tests: { type: 'string' },
    status_draft: { type: 'string' },
    for_lead: { type: 'string', description: 'decisions or follow-ups only the lead can do' },
  },
  required: ['applied', 'not_applied', 'tests', 'status_draft', 'for_lead'],
}

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
    findings_check: { type: 'string', description: 'per review finding in your lens: resolved / not, one line each' },
  },
  required: ['issues', 'findings_check'],
}

const LENSES = [
  {
    key: 'code',
    prompt: `Lens: CODE AND TESTS. Review every changed or new Python file (git diff --stat; git status --short for untracked files): tools/hmstools/safety (signoffs.py, check.py, schemas under docs/safety), licence, repo, backlog (including hazards.py), bootstrap, doctor, ci. For each finding with code (R-01, R-14, R-17, R-18, R-20, R-05's backlog part): read the code, run its tests, and try to break it with your own scratch cases (scratch files only under %TEMP% or WSL /tmp; never in the repository): signature status and fingerprint matching, the allowed-signers trust chain (merges, reverts, re-anchoring, shallow clones), decision-to-field matching, subject_version, the licence register matching, the ADR status/H1/Source/order rules, the JDK pin and identity check, hazards derivation and its check. Also look for regressions in the existing gates (the review report section 2 plant matrix must still fail in every case), fail-open paths, exceptions that pass silently, Windows/Linux differences, and tests that assert nothing.`,
  },
  {
    key: 'records',
    prompt: `Lens: RECORDS, HONESTY AND CROSS-REFERENCES. Review every changed documentation and record file: docs/program/{KNOWN-ANOMALIES,DECISIONS-NEEDED,OPEN-QUESTIONS,COMMANDS,WORK-PACKAGES,STATUS}.md, docs/program/work-packages/WP-0.1.md, docs/safety/**, docs/adr/**, the READMEs, tools/host/**, backend/gradle/libs.versions.toml comments. Check: every ID reference resolves and every number is unique (OQ-, DN-, KA-, HAZ-, CTRL-, SI-, R-, ADR-); no claim of a run, check or verification that the repository does not back (look for invented hashes, counts, dates or "verified" without a record; compare every SHA-256 written with tools/hmstools/bootstrap/steps.py and DN entries); nothing records a human approval or decision that was not quoted from the human; the Windows-host versus evidence-of-record labelling is right; STATUS.md (the earlier session's uncommitted draft, which the lead will rewrite) does not say anything now false; the docs agree with the code (for example what the sign-off gate, the licence check and the repo check actually do); style and table layouts match the neighbouring entries; the limits the repo check enforces (STATUS.md at most 150 lines, at most ten Blocking-now items).`,
  },
  {
    key: 'plan',
    prompt: `Lens: PLAN CONFORMANCE. For every finding R-01 to R-21 (and observation O-8), read the finding's Where, Rule and Direction in docs/program/reviews/WP-0.1.md and the BUILD-PROMPT text it cites, then check the working tree against it: is every location addressed, is the Direction followed or the departure justified in the changed file itself, and is anything the rule requires still missing? Pay particular attention to the safety texts: docs/safety/hazard-log.yaml changes (CTRL-0014-4 and HAZ-0014 against SI-14 in §2.1; CTRL-0005-7 and -10 against SI-05 and §2.1 (c); CTRL-0011-9 against SI-11 and §10.3 D; every nightly property control against §18.3 line ~2021; the recorded tightenings) — quote the invariant text and confirm it is unchanged and not narrowed; and the schema departures from Appendix B.2. Say plainly for each finding whether the Resolution field may honestly say "resolved".`,
  },
]

phase('Integrate')
const integ = await agent(INTEGRATE, { label: 'integrate', phase: 'Integrate', schema: REPORT_SCHEMA })
if (!integ) return { error: 'integrator returned nothing' }

phase('Review')
const reviews = await parallel(LENSES.map(l => () =>
  agent(`${COMMON}

You are an independent reviewer of the whole uncommitted working tree (git diff, plus untracked files from git status --short). You edit nothing: no file writes, no git writes. ${l.prompt}

The integrator reported:
${JSON.stringify(integ, null, 1)}

Report only real, specific issues with evidence; rank them. Do not report style nits unless they break the neighbouring format.`,
    { label: `review:${l.key}`, phase: 'Review', schema: ISSUES_SCHEMA, effort: 'high' })
    .then(r => r ? { lens: l.key, ...r } : null)))

const all = reviews.filter(Boolean)
const issues = all.flatMap(r => r.issues.map(i => ({ lens: r.lens, ...i })))
log(`${issues.length} issues from ${all.length} reviewers (${issues.filter(i => i.severity !== 'minor').length} critical or major)`)
if (!issues.length) return { integ, reviews: all, close: null }

phase('Close')
const close = await agent(`${COMMON}

You close the issues three independent reviewers found in the uncommitted working tree. For each issue: confirm it (read the evidence yourself); if real, fix it within the ground rules; if not real, say why with evidence. Re-run the affected tests and, at the end, the whole tools suite and the three checks.

Issues:
${JSON.stringify(issues, null, 1)}

Their per-finding checks:
${JSON.stringify(all.map(r => ({ lens: r.lens, findings_check: r.findings_check })), null, 1)}

Return: for each issue, fixed / rejected (with reason) / left for the lead (with reason); the final test and check results; and an updated draft of what docs/program/STATUS.md must say, and the one-line Resolution note for each of R-01 to R-21 (without the SHA; the lead adds it).`,
  { label: 'close', phase: 'Close', schema: {
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

return { integ, reviews: all, close }