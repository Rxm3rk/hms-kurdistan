export const meta = {
  name: 'wp01-review-fixes',
  description: 'Resolve WP-0.1 review findings R-01..R-21 in four file-disjoint groups, adversarially verify each group, fix gaps',
  phases: [
    { title: 'Fix', detail: 'four groups with disjoint file ownership edit the checkout' },
    { title: 'Verify', detail: 'one adversarial verifier per group' },
    { title: 'Fix-up', detail: 'close any gaps the verifier found' },
  ],
}

const REPO = 'C:\\Users\\Surface\\.t3\\projects\\hospitalmanagementsystem'

const COMMON = `You are resolving findings of the automated review of work package WP-0.1 (programme bootstrap) of the HMS Kurdistan hospital-system build.

Repository: ${REPO} (the Windows checkout; Git Bash and PowerShell are available). Branch wp/0.1-programme-bootstrap at 6ca3e3a.
Governing text: BUILD-PROMPT.md (plan of record, read-only, 2951 lines; read the sections each finding cites with Grep and line-ranged Read). The review report is docs/program/reviews/WP-0.1.md: read its header, section 3 in full for your findings (Where, Rule, What happened, Failure scenario, Direction) and section 4 for observations about your files. The rules for resolving findings are in docs/program/reviews/README.md.

Ground rules (non-negotiable):
- Honesty (BUILD-PROMPT section 3.5): never claim a run that did not happen; never write an approval, a sign-off or a human decision; a run on this Windows checkout is "Windows host", never evidence of record. Never weaken, narrow or reinterpret a safety invariant (section 3.4 item 1); a tightening is allowed only when it is recorded as a tightening.
- Plan-of-record files are read-only: BUILD-PROMPT.md, BLUEPRINT.md, BLUEPRINT-KURDISTAN.md, research/**.
- The working tree already holds uncommitted work from an interrupted earlier session (modified: tools/hmstools/bootstrap, doctor, licence, repo; backend/gradle/libs.versions.toml; docs/program/KNOWN-ANOMALIES.md; docs/program/STATUS.md). Keep it. Three other agents are editing other files in this same checkout at the same time.
- Git: do not commit, stage, stash, reset, restore, checkout or clean anything. Read-only git commands (status, diff, log, show, ls-files, blame, grep) are fine.
- Edit only the files you own (listed below). For a file marked shared, re-read it immediately before every edit and change only the entries named for you. If a fix needs a change in a file you do not own (STATUS.md, KNOWN-ANOMALIES.md unless you own it, another group's files), do not make it: describe the exact change, with the text to add, in notes_for_lead.
- Never edit docs/program/STATUS.md or docs/program/reviews/WP-0.1.md. The lead fills the Resolution fields after committing.
- Never touch docs/program/evidence/**; the lead re-runs and stores evidence records in the WSL clone after the commit.
- Match the surrounding style exactly: British English; plain, precise sentences; section references written like "§3.5"; paths in backticks; IDs (KA-, DN-, OQ-, HAZ-, CTRL-, SI-, R-) in the existing formats; the comment density and idiom of the surrounding code. Read neighbouring entries before writing a new one and copy their structure.
- Tests: the Python tools tests run from the repository root with: .tools/venv/Scripts/python.exe -I -m unittest discover -s tools/hmstools/<area>/tests -t tools   (areas: backlog, bootstrap, ci, doctor, licence, repo, safety). The checks: sh tools/hms safety check ; sh tools/hms repo check ; sh tools/hms backlog check. Add or update tests for every behaviour change, including failing-case tests. If a test cannot run on Windows (for example it needs gpg, ssh-keygen or a POSIX feature), run it in WSL against this checkout:
  MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu-24.04 --exec bash -lc 'cd /mnt/c/Users/Surface/.t3/projects/hospitalmanagementsystem && ~/src/hospitalmanagementsystem/.tools/venv/bin/python -I -m unittest discover -s tools/hmstools/<area>/tests -t tools'
  and say which host each run used. Report test counts exactly as printed.
- Resolve each finding as its Direction says unless that would break a rule above; if you depart from the Direction, say why in the file you change and in your report.
- New record numbers: open questions continue at OQ-108 (OQ-106 and OQ-107 are taken on the stacked branch wp/0.2-environments); the next decision is DN-014. Use only the numbers assigned to your group below.
- Before you finish, re-read every hunk you changed (git diff -- <your files>) and check that each cross-reference you wrote (IDs, paths, line numbers, section numbers) resolves.`

const GROUPS = [
  {
    key: 'signoff-gate',
    ids: ['R-01', 'R-20'],
    owns: `Files you own: tools/hmstools/safety/signoffs.py; the sign-off parts of tools/hmstools/safety/check.py (shared with the hazard-log group, which owns the schema and hazard-entry checks in that file: re-read before each edit); tools/hmstools/safety/tests/** for sign-off tests; docs/safety/signoffs/** (README.md, signoff.schema.json, and the new docs/safety/signoffs/allowed-signers.yaml with a schema if you need one). Shared: docs/safety/README.md, only the paragraphs about sign-off records and the sign-off gate.`,
    task: `Findings: R-01 (major) and R-20 (minor).

The earlier session already wrote KA-011 in docs/program/KNOWN-ANOMALIES.md describing the intended R-01 fix; read it and implement exactly what it says, or report precisely where your implementation differs so the lead can update KA-011. Design to implement:
- docs/safety/signoffs/allowed-signers.yaml: a human-maintained list of signers (name, role or roles, key type gpg or ssh, full fingerprint, added date). It ships with no keys, with a header comment saying that only a human adds entries and that an agent never does. With no keys listed, no sign-off record can authorise anything, and the gate says so clearly.
- The gate accepts a sign-off record only from a commit whose signature git reports as good (%G? = G; reject U, as the Direction says) and whose signing-key fingerprint (%GF, or the primary key %GP for a gpg subkey) matches an entry in allowed-signers.yaml; the signer's listed role must cover the record's role. Keep every existing rejection (no record, untracked record, unsigned commit, AI co-author trailer, and so on).
- Trust anchor: the first commit that adds a key to allowed-signers.yaml is the trust anchor, which the reviewer and the human verify out of band (KA-011). Every later commit that changes allowed-signers.yaml must itself be signed by a key listed in the version of the file before that change; otherwise the gate fails. Decide whether git's own verification uses the local keyring (gpg) or an allowed-signers file (ssh, gpg.ssh.allowedSignersFile); support at least gpg and preferably ssh; document what is verified and what is trusted.
- R-20: require a decision field; match the decision kind to the field it authorises (accepted authorises residual_risk.accepted_by; triaged authorises cso_triage; approved authorises approval), so no decision or a triaged decision never authorises an acceptance; compare the record's subject_version with the subject's current version (find out what version a hazard entry or state-machine spec carries; if a subject has no version field, define the rule and document it); match approval.required roles (for example [cso]) against the record's role and the signer's listed role. Update docs/safety/signoffs/README.md (its line about "no decision authorises" is wrong after this) and the schema.
- Tests: failing-case tests for every rule above, using a temporary gpg home and temporary ssh keys (run them in WSL if they need gpg or ssh-keygen and Windows lacks them), plus the passing case where a listed key signs a matching record. The review's plant matrix (review report section 2, safety-check rows) must still fail in every case, and its R-01 plant (a record in a commit signed by a key the agent generated, not listed) must now fail.
- Run: the safety tests and sh tools/hms safety check (it must still PASS on the real repository, which has no sign-off records).`,
  },
  {
    key: 'hazard-log',
    ids: ['R-04', 'R-19', 'R-21'],
    owns: `Files you own: docs/safety/hazard-log.yaml; docs/safety/hazard-log.schema.json; the schema and hazard-entry parts of tools/hmstools/safety/check.py and their tests in tools/hmstools/safety/tests/** (shared with the sign-off group, which owns the sign-off parts: re-read before each edit). Shared: docs/safety/README.md (everything except the sign-off paragraphs, which the sign-off group edits); docs/program/DECISIONS-NEEDED.md (only to add the new entry DN-014, in the file's existing entry format and in the right list; respect the limit of at most ten "Blocking now" items).`,
    task: `Findings: R-04 (major), R-19 (minor), R-21 (minor).

- R-04: rewrite CTRL-0014-4 so the planned registry gate enforces all four requirements of SI-14 (owner, evidence, a measured PPV and a review-by date) and plans the stricter interim reading: a rule without a measured PPV is not interruptive; the vendor-validated day-0 baseline needs an explicit, human-approved exception. Quote SI-14 from BUILD-PROMPT section 2.1 exactly. File DN-014 for the CSO [HUMAN]: the CSO's reading of SI-14's "a measured PPV" for the day-0 CDS baseline before local telemetry exists; it blocks WP-1.5 (not "now"). Replace the open-question note in docs/safety/README.md (around line 124) with a pointer to DN-014. Check every other control and note under HAZ-0014 for the same narrowing.
- R-19: fix each bullet: CTRL-0005-7's "also stops any 100x deviation" claim against CTRL-0005-10 and section 2.1 (c); CTRL-0011-9's witness comparison (say which mode compares: the automated T2 behaviour versus the scripted two-person section 10.3 D fallback with no automated pass/fail); add "at least 10^4 sequences through each real channel adapter" (section 18.3, BUILD-PROMPT line ~2021, use its exact wording and the notation the other entries use, see the entry around hazard-log.yaml line 178) to every nightly property control that omits it (the review lists lines; sweep the whole file, not just those lines); record as tightenings the mechanisms the sources do not contain (the template linter, "confirmed by the registrar", and the one at about lines 2771-2772), or remove them, per section 3.4 item 1 and docs/safety/README.md line ~47; correct docs/safety/README.md line ~125 about section 18.5 suites for SI-09 and SI-18. Line numbers in the review refer to commit adb631c; find the text, not the line.
- R-21: say in docs/safety/README.md which template B.2 fields the schema makes mandatory and why, and that the control type enum is this build's proposal [P] (or carry section 10.1's design/protective/information in risk_control_option as the plan does); state the deviation from Appendix B.2 explicitly, or relax the schema to B.2 plus optional extras. Decide, justify, and test: either the B.2 example (BUILD-PROMPT lines ~2834-2855) validates, or the README says exactly why it does not.
- Follow the hazard log's own change rules (docs/safety/README.md): if entries carry versions or change history, update them. No approval or acceptance field may be filled.
- Run: the safety tests and sh tools/hms safety check (must PASS; report its counts).`,
  },
  {
    key: 'host-docs-oq',
    ids: ['R-02', 'R-03', 'R-06', 'R-08', 'R-09', 'R-11', 'R-12', 'R-16'],
    owns: `Files you own: docs/program/COMMANDS.md; backend/README.md; docs/program/work-packages/WP-0.1.md; tools/host/README.md; tools/host/provision-ubuntu.sh (comments and header text only: the script already ran, so do not change what it does; if you think its behaviour must change, say so in notes_for_lead); tools/README.md; tools/bootstrap (its comment at line 3 only); frontend/README.md; README.md (the repository root); docs/adr/ADR-001-*.md, ADR-010-*.md, ADR-016-*.md, ADR-017-*.md, ADR-020-*.md; docs/program/OPEN-QUESTIONS.md; docs/program/WORK-PACKAGES.md (only the sentence of R-09). Shared: docs/program/DECISIONS-NEEDED.md (only the entries DN-001 to DN-004 and DN-006, the sentence near line 197, and the "Blocks: now" of a closed item from observation O-8; the hazard-log group adds DN-014 at the same time). You do NOT own docs/adr/README.md (the tools group does; skip R-12's bullet about its line 83).
Git exception for R-02: you may run exactly: git update-index --chmod=+x backend/gradlew tools/ci/run tools/hms tools/doctor tools/bootstrap tools/host/provision-ubuntu.sh   and then verify with git ls-files -s on those paths. Look for any other committed entry script that the docs tell people to run directly (a shebang and no sh prefix in the docs) and include it if it qualifies; report the list. The mode change reaches the WSL clone only after the lead commits; the lead verifies it there, so do not claim it runs on Linux yet.`,
    task: `Findings: R-02 (major), R-03 (major), R-06 (minor, documentation part only), R-08, R-09, R-11, R-12, R-16 (minor), and observation O-8.

- R-02: set the executable bits (above) and correct docs/program/work-packages/WP-0.1.md lines ~18-19 (the frontend command runs from frontend/ as 'corepack pnpm run fast'; the backend command must match COMMANDS.md). Make COMMANDS.md, backend/README.md and WP-0.1.md agree; the "Checked" column must say honestly where each row was checked (Windows only until the lead re-runs in the WSL clone).
- R-03: make tools/host/README.md say what DN-001 says: on the human's instruction the build agent ran the provisioning itself, a recorded deviation from section 3.4 item 9; quote nothing the record does not contain.
- R-06 (documentation part): make COMMANDS.md line ~3 accurate (it says every command was run, while the ktlintFormat row says it was not). Do not touch evidence files; the lead re-runs and renames them.
- R-08: sweep BUILD-PROMPT.md Appendix A (lines ~2453-2742) for every row whose note records a difference from K (a note such as "K §4.3 lists ...", "Not in K §4.3; K §14.2 keeps P2/P3", a [P] mark, or an A.20 entry) and check which are not kept open in OPEN-QUESTIONS.md. The review names INT-DOC-01, AI-RCM-01, DX-RIS-03, DEV-SDC-01, ERP-FIN-03, AI-SUM-01, AI-INB-01, DFD-CRM-01 and INT-PH-01; confirm each and find any it missed. Add one open question per row to OPEN-QUESTIONS.md section (c), numbered from OQ-108 upward in the file's existing format, each open until a human confirms (BUILD-PROMPT section 1, around line 178). Report the final numbers.
- R-16: add open questions, numbered straight after your R-08 entries (the earlier session planned OQ-117 to OQ-119; use the next free numbers), for: ADR-016's and ADR-017's recorded difference from BP §7.2 (the dropped reopen trigger), and ADR-001 line ~72's interim C9 aggregation reading "until a human settles this" (section 1 around line 180: flag an interim default). Update each ADR so it names its OQ number.
- R-09: WORK-PACKAGES.md line ~32 becomes "can only be attempted on a lite cell; they stay open (DN-005)" or equivalent wording that does not weaken the criterion.
- R-11: state exactly what provision-ubuntu.sh verifies (Helm, k3d, Node checksums) and what it trusts on TLS alone (rustup-init.sh run unverified with an unpinned toolchain; the Docker, Kubernetes and Corretto apt keys; apt-get upgrade of the whole distribution), in the script header, tools/host/README.md, COMMANDS.md (line ~18) and DN-001; list every system-wide change in DN-001 to DN-004 (the upgrade, the global git configuration for the build user, the /usr/local/bin symlinks, systemctl enable --now docker containerd; a pointer to the script line per change is enough); fix the sentence near line 197 that calls the Gradle mirror the only non-official fetch, recording both mirror fetches (the Ubuntu WSL image from a kernel.org mirror and the Gradle zip) as section 3.7 deviations with their full hashes. If a full hash or the MSI checksum is not recoverable from the repository, the WSL host (look in ~/ and /tmp, and C:\\Users\\Surface\\Downloads and the AppData temp folders for the downloaded files; you may compute sha256 of a file that is still there) or the bootstrap pins, say plainly that it was not retained; never invent one.
- R-12: fix each bullet except docs/adr/README.md:83: tools/README.md and tools/bootstrap line 3 list every bootstrap step that tools/hmstools/bootstrap/__main__.py accepts (read it; frontend and requirements-lock included, and jdk if present); frontend/README.md line ~71 (@types/node 24.13.6 versus the Node.js v24.22.0 runtime on the host of record: say what is true without changing any version); root README.md line ~9 (the repository now holds the build skeleton, programme tooling and tests, but no product or clinical code yet); ADR-010 line ~42 (the Temporal-boundary rule exists and runs: backend/platform/arch-rules/src/main/kotlin/hms/kernel/archrules/HmsArchitectureRules.kt and TemporalBoundaryRuleTest.kt; verify, then say exactly what is and is not implemented); ADR-020 line ~60 (the stored fast record docs/program/evidence/ci/2026-10-18-fast-d3e14de.json shows repo-check PASS; cite it).
- O-8: the closed DN item that still says "Blocks: now".
- Run: sh tools/hms repo check (must PASS; it checks ADR format and the index) and sh tools/hms backlog check.`,
  },
  {
    key: 'tools-ka',
    ids: ['R-05', 'R-14', 'R-15', 'R-17', 'R-18'],
    owns: `Files you own: tools/hmstools/licence/**, tools/hmstools/repo/**, tools/hmstools/bootstrap/**, tools/hmstools/doctor/**, tools/hmstools/backlog/** and their tests; tools/licence/** (register.yaml, the ORT configuration and evaluator.rules.kts, the policy); backend/gradle/libs.versions.toml; docs/adr/ADR-002-*.md; docs/adr/ADR-014-*.md; docs/adr/README.md (including R-12's bullet about its line 83); docs/program/KNOWN-ANOMALIES.md; docs/program/backlog.yaml and BACKLOG.md (only through the backlog tool's generate/render commands, never by hand).`,
    task: `Findings: R-05, R-14, R-15, R-17, R-18 (all minor), plus R-12's bullet about docs/adr/README.md line 83.

Much of this was started by the interrupted session. First read the existing uncommitted diff in your files (git diff -- tools/hmstools backend/gradle/libs.versions.toml docs/program/KNOWN-ANOMALIES.md), then finish it and make it correct. Known state: the full tools suite on this checkout runs 422 tests with 1 failure, test_conditional_warns_until_registered in tools/hmstools/licence/tests/test_licence.py, which still expects the old warn-only behaviour.
- R-18: a conditional component without a licence-register entry now fails the in-house check; update the failing test to the new behaviour (rename it), and add tests for the passing case (component recorded in tools/licence/register.yaml) and for the register's schema if there is one. For the ORT evaluator rules (tools/licence/ort/evaluator.rules.kts), follow the Direction: either make the conditional rules errors, or keep them warnings only until the ORT run exists and say so in the rules file and the licence README; decide and record why.
- R-14: verify the earlier session's pin: tools/hmstools/bootstrap/steps.py now pins Eclipse Temurin jdk-25.0.4.1+1 with a SHA-256 per platform. Check the Corretto and "latest" fallbacks are gone everywhere (code, help text, docs, tests); check a JDK whose identity does not match the pin is rejected or replaced, with tests; check the checksums against the archives still on disk (.tools/downloads/ on this checkout for the Windows zip; in WSL, ~/src/hospitalmanagementsystem/.tools/downloads/ for the Linux tarball) and report what you could and could not confirm; never invent a checksum. Make ADR-002's pinned set (line ~35) say exactly what is pinned and where (steps.py), and that it is re-resolved only at phase boundaries (section 4.1).
- R-15: ADR-014 line ~35 says "to be recorded in the licence register" until the artefact is first depended on (the catalogue comment is already fixed; check it).
- R-17: verify the earlier session's tightening of tools/hmstools/repo/rules.py: the status regex is anchored (so "Status: accepted, approved by the CSO" fails), the H1 form, the Source: field and the B.1 section order are checked; add failing-case tests for each if any is missing. Then make docs/adr/README.md line ~83 describe exactly what the check does now (it also checks numbers above 028 for gaps and the index links, per R-12).
- R-05: KNOWN-ANOMALIES.md was extended to KA-012. Check every item R-05 lists is covered by a row with its hazard reference and the work package or decision that closes it: traceability.csv not generated; H7, H9, H11, H15 and the 22 SACs without a hazard entry; verified_by not cross-checked against evidence; the sign-off gate limitation (KA-011); the backlog hazards field; KA-005's first sentence. Then act on the Direction for the backlog: implement 'sh tools/hms backlog render' deriving each feature's hazards from the features lists in docs/safety/hazard-log.yaml, and a backlog check that fails when backlog.yaml and the hazard log disagree, with tests, if it fits the backlog tool cleanly; then regenerate backlog.yaml and BACKLOG.md with the tool, and set KA-010 to closed with "Closes with" naming the R-05 resolution commit (the lead fills the SHA). If you judge it does not fit cleanly, leave KA-010 open and say why. Note: the hazard-log group is editing docs/safety/hazard-log.yaml at the same time, so the lead re-runs the render at the end; say so in notes_for_lead.
- Make KNOWN-ANOMALIES.md consistent with what the other groups are doing: KA-011 describes the sign-off gate fix (the sign-off group implements it; leave KA-011 for the lead to adjust from their report).
- Run: every tools test (.tools/venv/Scripts/python.exe -I -m unittest discover -s tools -t tools -p "test_*.py"), sh tools/hms repo check, sh tools/hms backlog check. Report counts. Failures caused by another group's in-progress edits (safety) must be named as such, not hidden.`,
  },
]

const FIX_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          status: { type: 'string', enum: ['resolved', 'partly', 'not_resolved'] },
          changes: { type: 'string', description: 'what changed and why, file by file' },
          files: { type: 'array', items: { type: 'string' } },
          tests: { type: 'string', description: 'commands run, host, exact results' },
          residual: { type: 'string', description: 'anything left open, departures from the Direction' },
          resolution_note: { type: 'string', description: 'one-line note for the review Resolution field' },
        },
        required: ['id', 'status', 'changes', 'files', 'tests', 'residual', 'resolution_note'],
      },
    },
    notes_for_lead: { type: 'string', description: 'exact changes needed in files you do not own (STATUS.md, KNOWN-ANOMALIES.md, others), new record numbers used, follow-up runs' },
  },
  required: ['findings', 'notes_for_lead'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          verdict: { type: 'string', enum: ['resolved', 'gap'] },
          gaps: { type: 'string', description: 'each concrete gap with file and location; empty if resolved' },
          evidence: { type: 'string', description: 'what you read and ran to decide' },
        },
        required: ['id', 'verdict', 'gaps', 'evidence'],
      },
    },
    other_problems: { type: 'string', description: 'regressions, false claims, broken cross-references, style breaks, ownership violations' },
  },
  required: ['verdicts', 'other_problems'],
}

function fixPrompt(g) {
  return `${COMMON}

Your group: ${g.key}. ${g.owns}

${g.task}`
}

function verifyPrompt(g, fix) {
  return `${COMMON}

You are the ADVERSARIAL VERIFIER for group ${g.key} (findings ${g.ids.join(', ')}). You edit nothing: no file writes, no git writes. Default to verdict "gap" when you are not sure.
${g.owns}

The fixer reported:
${JSON.stringify(fix, null, 1)}

For each finding: read the finding in full in docs/program/reviews/WP-0.1.md, then read the actual changes (git diff -- <the files above>, git status --short for new untracked files, git ls-files -s for modes) and the surrounding code and docs. Try to refute that the finding is resolved:
- Is every location in "Where" addressed (find the text; line numbers are as of commit adb631c)? Does the fix follow the Direction, or does it justify a departure in the file itself?
- Re-run the tests and checks yourself (same commands, same hosts) and compare with the fixer's claims. For code changes, construct at least one bypass or edge case of your own and test it (scratch files only under %TEMP% or /tmp, never in the repository).
- Look for introduced defects: false or unverifiable claims, invented hashes or numbers, broken cross-references (IDs, paths, section numbers), a weakened or reinterpreted invariant, an approval written by the agent, wrong record numbering (OQ from 108; DN-014), STATUS or the review report edited, edits outside the group's files, style that does not match neighbouring entries.
Report a verdict per finding, with concrete gaps (file, location, what is wrong, what would fix it).`
}

function fixupPrompt(g, fix, verdict) {
  return `${COMMON}

Your group: ${g.key}. ${g.owns}

${g.task}

An earlier agent in your group already did most of this work, and reported:
${JSON.stringify(fix, null, 1)}

An adversarial verifier then found these gaps:
${JSON.stringify(verdict, null, 1)}

Close every gap the verifier found (or, if a gap is wrong, explain why with evidence). Re-run the tests and checks afterwards. Report the final state of every finding in your group, not just the ones you touched.`
}

phase('Fix')
const results = await pipeline(
  GROUPS,
  g => agent(fixPrompt(g), { label: `fix:${g.key}`, phase: 'Fix', schema: FIX_SCHEMA }),
  (fix, g) => fix
    ? agent(verifyPrompt(g, fix), { label: `verify:${g.key}`, phase: 'Verify', schema: VERDICT_SCHEMA, effort: 'high' })
        .then(v => ({ fix, verdict: v }))
    : { fix: null, verdict: null },
  (r, g) => {
    const gaps = r.verdict ? r.verdict.verdicts.filter(v => v.verdict === 'gap') : []
    const other = r.verdict && r.verdict.other_problems && r.verdict.other_problems.trim().length > 20
    if (!r.fix) return { group: g.key, ...r, fixup: null }
    if (!gaps.length && !other) { log(`${g.key}: verifier found no gaps`); return { group: g.key, ...r, fixup: null } }
    log(`${g.key}: ${gaps.length} finding(s) with gaps; fixing up`)
    return agent(fixupPrompt(g, r.fix, r.verdict), { label: `fixup:${g.key}`, phase: 'Fix-up', schema: FIX_SCHEMA })
      .then(fu => ({ group: g.key, ...r, fixup: fu }))
  },
)
return results