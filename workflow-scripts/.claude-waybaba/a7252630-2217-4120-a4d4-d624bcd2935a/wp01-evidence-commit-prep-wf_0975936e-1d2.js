export const meta = {
  name: 'wp01-evidence-commit-prep',
  description: 'Write the WP-0.1 spot-check record at 05f159a, store the licence record, point the docs at the new records of record; independent check; fix',
  phases: [
    { title: 'Write', detail: 'spot-check record, licence record, doc pointers' },
    { title: 'Check', detail: 'independent re-verification of every claim' },
    { title: 'Fix', detail: 'close confirmed issues' },
  ],
}

const MAIN = 'C:\\Users\\Surface\\.t3\\projects\\hospitalmanagementsystem'
const REC = 'C:\\Users\\Surface\\AppData\\Local\\Temp\\hms-wp01\\rec05'

const COMMON = `Context: the HMS Kurdistan hospital-system build, work package WP-0.1 (programme bootstrap). Repository ${MAIN} (Windows checkout, Git Bash), branch wp/0.1-programme-bootstrap at 05f159a, the commit that resolved the review findings in docs/program/reviews/WP-0.1.md. The lead ran the records of record in the WSL clone ~/src/hospitalmanagementsystem at 05f159a on a clean tree (git status empty before and after) and copied them into the checkout (untracked): docs/program/evidence/ci/2026-10-19-{fast,merge,nightly}-05f159a.json, docs/program/evidence/ci/2026-10-19-gates-bite-05f159a.md (78 plants: 73 FAIL, 5 PASS; clean runs PASS), docs/program/evidence/doctor/2026-10-19-doctor-05f159a.{txt,json}. Raw outputs of the same run are in ${REC}: the spot-check output (tools_hms_backlog_spot-check_--seed_20261018_--count_10.log), the licence-check output 2026-10-19-licence-05f159a.txt and its inputs licences-shipped.json and licences-all.json, the doctor and tier logs, and bootstrap.log. Plan of record BUILD-PROMPT.md is read-only (2951 lines; read with line ranges).

Rules: honesty (BUILD-PROMPT §3.5): write only what the records show; label every run with where it ran ("WSL build host, no cell" for these; "Windows host" for anything you run in the checkout); never claim a run that did not happen. Never edit: BUILD-PROMPT.md, BLUEPRINT*.md, research/**, docs/program/reviews/WP-0.1.md (the lead fills its Resolution fields later), the stored records themselves, tools/hmstools/safety/**, docs/safety/signoffs/**, docs/program/KNOWN-ANOMALIES.md (another agent may be editing the sign-off gate and KA-011 right now). No git writes (no add, commit, stash, reset, checkout). British English; match each file's existing style and table layout exactly.`

const WRITE = `${COMMON}

Do the following in the checkout:
1. docs/program/evidence/backlog/2026-10-19-spot-check-05f159a.md: the spot-check record of record, in the format and depth of docs/program/evidence/backlog/2026-10-18-spot-check.md (read it all), for the WSL run at 05f159a (command, exit code 0, seed 20261018, the ten sampled rows in draw order from the log). Verify every row yourself, independently of the tool: read each source line straight from BUILD-PROMPT.md and compare it cell by cell with docs/program/backlog.yaml at 05f159a (git show 05f159a:docs/program/backlog.yaml), the §21 mentions (lines ~2267-2375) with work_packages, and the hand-edited fields with their defaults; hazards are now derived from the hazard log, so compare each row's hazards with the HAZ entries whose features list names that ID in git show 05f159a:docs/safety/hazard-log.yaml. Say who checked (the build agent (AI), not a person), where the tool ran (WSL build host, no cell, at 05f159a, clean tree) and where your verification ran (Windows host, against the committed files). Write a full cross-check of all 236 rows only if you run one yourself in this session with your own throwaway script outside the repository; otherwise say the 18 October cross-check is not repeated. State the result plainly, including any discrepancy.
2. Licence record: create docs/program/evidence/licence/ with 2026-10-19-licence-05f159a.txt (copied from ${REC}, unchanged) and its two inputs as 2026-10-19-licence-05f159a-shipped-input.json and 2026-10-19-licence-05f159a-all-input.json; add a licence/ row to the Layout table of docs/program/evidence/README.md ("Licence-check outputs and their inputs, per scope (§4.3)", written by tools/hms licence check, WP-0.1); if the README's naming section needs a word for input files, add one sentence.
3. Point the docs at the new records, replacing claims that rested on Windows runs or on d3e14de where a WSL record at 05f159a now exists: docs/program/COMMANDS.md (line 3's explanation, §1 bootstrap and doctor, §3 repo, safety, backlog and licence rows, §4 the Python, backend and frontend counts, §6 evidence rows including gates-bite, spot check, doctor, merge and nightly), backend/README.md (the gates-bite line near 54), tools/hmstools/backlog/tests/test_real_plan.py line ~18 (the comment that cites the spot-check record), tools/README.md and tools/ci/README.md where they cite gates-bite records. Read each record before citing its numbers (fast: 8 of 8 PASS, 1253 tests; merge FAIL with 15 NOT-BUILT steps; nightly FAIL with 12 NOT-BUILT steps; doctor 18 ok, 2 required missing (RAM, disk); gates-bite 78 plants 73 FAIL 5 PASS; check these against the files, do not copy them from here). Keep the 18 October files and their citations where the review cites them, labelled as earlier, non-record runs.
4. Run sh tools/hms repo check, sh tools/hms backlog check, the backlog tests (.tools/venv/Scripts/python.exe -I -m unittest discover -s tools/hmstools/backlog/tests -t tools) and the secret scan (sh tools/ci/run fast --only secret-scan --no-evidence).
Return: files written or changed (each with what), the per-row spot-check results and any discrepancy, the check results exactly as printed, and a draft STATUS.md "Last green" line and R-06/R-07 bullets for the lead.`

const REPORT = { type: 'object', properties: {
  files: { type: 'string' }, spot_check: { type: 'string' }, results: { type: 'string' }, for_lead: { type: 'string' },
}, required: ['files', 'spot_check', 'results', 'for_lead'] }

phase('Write')
const w = await agent(WRITE, { label: 'write', phase: 'Write', schema: REPORT, effort: 'high' })
if (!w) return { error: 'writer returned nothing' }

phase('Check')
const c = await agent(`${COMMON}

You are an independent checker. Edit nothing. Re-verify every claim the writer made in the new and changed files (git status --short; git diff): re-derive three or more spot-check rows yourself from BUILD-PROMPT.md, backlog.yaml and the hazard log at 05f159a (choose rows with several §21 mentions or several hazards); compare every number cited in COMMANDS.md, the READMEs and the spot-check record with the stored records; check the evidence README row and the naming of the new files against its naming rule; check that nothing claims a run that did not happen or mislabels where a run happened; check the 18 October citations still exist where the review cites them. Report only real, specific issues with evidence.

Writer's report: ${JSON.stringify(w)}`, { label: 'check', phase: 'Check', effort: 'high', schema: { type: 'object', properties: { issues: { type: 'array', items: { type: 'object', properties: {
  severity: { type: 'string', enum: ['critical', 'major', 'minor'] }, file: { type: 'string' }, problem: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' },
}, required: ['severity', 'file', 'problem', 'evidence', 'fix'] } } }, required: ['issues'] } })

if (!c || !c.issues.length) return { w, c, fix: null }
phase('Fix')
const f = await agent(`${COMMON}

Close the issues an independent checker found. For each: confirm, fix if real, otherwise say why not. Re-run the checks the writer ran.

Writer's report: ${JSON.stringify(w)}
Issues: ${JSON.stringify(c.issues, null, 1)}

Return each outcome, files changed, the check results exactly as printed, and the final draft STATUS lines for the lead.`, { label: 'fix', phase: 'Fix', schema: { type: 'object', properties: { outcomes: { type: 'string' }, results: { type: 'string' }, for_lead: { type: 'string' } }, required: ['outcomes', 'results', 'for_lead'] }, effort: 'high' })
return { w, c, f }
