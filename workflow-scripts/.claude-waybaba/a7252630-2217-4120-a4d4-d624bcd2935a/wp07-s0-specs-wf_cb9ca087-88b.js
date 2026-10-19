export const meta = {
  name: 'wp07-s0-specs',
  description: 'WP-0.7 slice S0: design-system module spec, patient-context state machine, HAL contract and fixtures, with two independent reviews and a fix pass',
  phases: [
    { title: 'Author', detail: 'one agent writes the S0 specs in the WP-0.7 worktree' },
    { title: 'Review', detail: 'plan-conformance and clinical-safety/language lenses' },
    { title: 'Fix', detail: 'close confirmed issues' },
  ],
}

const WT = 'C:\\Users\\Surface\\.t3\\worktrees\\hospitalmanagementsystem\\wp07'
const MAIN = 'C:\\Users\\Surface\\.t3\\projects\\hospitalmanagementsystem'
const PLAN = 'C:\\Users\\Surface\\AppData\\Local\\Temp\\hms-wp07\\plan.md'
const ANSWERS = 'C:\\Users\\Surface\\AppData\\Local\\Temp\\hms-wp07\\human-answers.txt'

const COMMON = `Context: the HMS Kurdistan hospital-system build (a hospital system for private hospitals in the Kurdistan Region of Iraq; UI in English, Sorani Kurdish (ckb) and Arabic (ar), the last two right-to-left). Work package WP-0.7 "Design system and client shells" (BUILD-PROMPT.md §21 Phase 0 row 0.7; the plan of record BUILD-PROMPT.md is read-only, 2951 lines: read with Grep and line-ranged Read; relevant: §6 (frontend and design system, including §6.5 numbers and §6.x the banner and sign/co-sign), SI-01, SI-05 and SI-16 in §2.1, §10 where cited, Appendix B.3 state-machine template, §3 rules). Its implementation plan, approved by the lead: ${PLAN} (read all of it; you do slice S0).

Workspace: the WP-0.7 git worktree ${WT}, branch wp/0.7-design-system, created from wp/0.1-programme-bootstrap at 6ca3e3a. Its .tools is a junction to the main checkout's toolchain. The main checkout ${MAIN} holds the WP-0.1 review fixes uncommitted (the lead commits them soon and then rebases this branch): read the main checkout's docs/safety/hazard-log.yaml and docs/safety/README.md for the current HAZ, CTRL and SI identifiers (the fixes changed some). Never edit anything in the main checkout. In the worktree, never commit, reset, stash, checkout or rebase (the lead does git).

Rules: honesty (§3.5: no claimed run that did not happen, no approval or sign-off or human decision written by you; every approval block reads status requested with approved_by empty); never weaken a safety invariant; British English, plain precise sentences, §-references, paths in backticks; match the style of existing files in docs/specs/ (read docs/specs/README.md and its subfolders first).

The human lead's two decisions for WP-0.7 (2026-10-18, answered in chat through the question tool; exact text in ${ANSWERS}): translations "AI drafts, you check (Recommended)" (the agent drafts ckb and ar text, each label marked unreviewed; a clinician review stays a gate before any hospital use; a recorded deviation from the packages/i18n README rule against invented or machine translation); licences "Approve all three (Recommended)" (0BSD, Unicode-3.0 and Zlib added to the shipped-code allowlist as the human's decision).

Do not edit programme files (docs/program/**, docs/safety/**, CHANGELOG.md, the backlog): return the exact entries they need instead; the lead applies them after the rebase.`

const AUTHOR = `${COMMON}

Write slice S0 in the worktree:
1. docs/specs/modules/design-system.md: the module specification of the design system and client shells as the plan describes: components (banner, sign/co-sign, command palette, density modes, ClinicalNumber, Bdi, Modal with the stack guard, LocaleProvider), the banner's fields and rules (photo; MRN plus date of birth or the approximate-DOB flag; allergies with status nka, not-assessed or a list, where missing or invalid data never shows NKA; code status; isolation; dated weight; the name in the patient's script plus a Latin transliteration; identifiers never room or bed; colour never the only carrier; long four-part names wrap and are never truncated), the patient-context rules (one patient context per window; a context switch needs confirmation; re-verification at signing within 60 s of a context change, read inclusively, the stricter reading), number display (ISMP leading and trailing zero rules, Western digits only in the UI as a recorded tightening of §6.5, ClinicalNumber does no arithmetic, SI-05), RTL and bidi rules (logical CSS only, bdi isolation, dir and lang on html), the demo route (synthetic fixtures, a NOT FOR CLINICAL USE watermark, absent from production builds), the HAL contract summary, and a test table mapping every named test in the plan to its hazard-log control (CTRL-0016-x, CTRL-0005-17 and any other that applies; use the identifiers in the main checkout's hazard log, and say where a test has no control yet). Include the full message-key list for the banner and the other S2 to S6 components: key, English text, and a note for translators (clinical meaning, maximum length if any, placeholders in ICU syntax). Do not write ckb or ar text here; that is slice S2's catalogue work.
2. docs/specs/state-machines/patient-context.yaml: the patient-context machine in the Appendix B.3 template (states such as no-patient, patient-selected, switch-pending-confirmation, re-verification-required at signing; named-predicate guards with descriptions; owner module; the approval block with status requested and approved_by empty; transitions R11 does not draw marked proposed). Read the existing state-machine fixtures and schema under tools/hmstools/safety (and any spec schema the safety check uses) so the file validates.
3. docs/specs/hal/README.md, docs/specs/hal/hal-v1.schema.json (JSON Schema 2020-12) and docs/specs/hal/fixtures/*.json: the hardware abstraction layer contract between the web app and the Tauri shell: every call (hal.print.label, hal.print.raw, hal.print.document, hal.scan.onBarcode, hal.scan.document, hal.id.read, hal.auth.onBadge, hal.sign.capture, hal.pay.request, hal.camera.photo, hal.kiosk.lock, hal.capabilities) returns {ok, value | error, auditId}; the error vocabulary includes unavailable; no PHI in the audit log (H13); hal.id.read and hal.pay.request fail closed until their simulators exist. One fixture per call for success and one for each error kind that applies; every fixture validates against the schema (check with the venv's jsonschema: ${MAIN}\\.tools\\venv\\Scripts\\python.exe -I).
Then run in the worktree: sh tools/hms repo check ; sh tools/hms safety check (it validates state-machine specs); fix what they flag in your files, and report what they flag elsewhere.
Return: the files written, the check results exactly as printed (Windows host), and the exact programme entries the lead must add after the rebase: DN entries for the plan's decisions A to F (A branch base and ID allocation: default this branch stacks on wp/0.1 and records [P] choices as OQ entries, no new ADR; B and C closed by the human lead with the quoted answers and date; D Windows packaging, E Android SDK and macOS, F Expo and pnpm as open with their defaults), OQ entries for the plan's open questions, KA entries for what WP-0.7 will not build, and the backlog and WORK-PACKAGES notes. Leave the numbers as placeholders (DN-new-1, OQ-new-1...) for the lead to assign.`

const REPORT = {
  type: 'object',
  properties: {
    files: { type: 'string' },
    checks: { type: 'string' },
    programme_entries: { type: 'string', description: 'exact DN, OQ, KA, backlog texts for the lead' },
    notes: { type: 'string' },
  },
  required: ['files', 'checks', 'programme_entries', 'notes'],
}

const ISSUES = {
  type: 'object',
  properties: {
    issues: { type: 'array', items: { type: 'object', properties: {
      severity: { type: 'string', enum: ['critical', 'major', 'minor'] },
      file: { type: 'string' }, location: { type: 'string' }, problem: { type: 'string' },
      evidence: { type: 'string' }, fix: { type: 'string' },
    }, required: ['severity', 'file', 'location', 'problem', 'evidence', 'fix'] } },
  },
  required: ['issues'],
}

phase('Author')
const s0 = await agent(AUTHOR, { label: 'author', phase: 'Author', schema: REPORT, effort: 'high' })
if (!s0) return { error: 'author returned nothing' }

const LENSES = [
  ['plan', 'PLAN CONFORMANCE: compare every file with BUILD-PROMPT (the §21 row 0.7 exit criteria, §6, Appendix B.3, SI-16, SI-01, SI-05 and §3) and the implementation plan: anything required and missing, anything contradicting the plan of record, wrong or dangling identifiers (HAZ, CTRL, SI, H, PLT, KRI), schema or template departures, claims of runs that did not happen, approvals written by the agent. Validate the HAL fixtures against the schema and the state machine with the safety check yourself.'],
  ['clinical', 'CLINICAL SAFETY AND LANGUAGE: read the specs as a clinical safety officer and a Sorani/Arabic UI localiser would. Could any rule let the wrong patient be shown or acted on, NKA be shown for missing data, a number be misread (leading or trailing zeros, Eastern Arabic digits, bidi reordering of numbers and units), a name or identifier be truncated, a context switch go unconfirmed, a signature skip re-verification, or colour be the only carrier? Are the English message texts clear and clinically correct, and do the translator notes give enough context to translate safely (gender, plural, placeholder order in RTL)? Is the patient-context machine complete (every state reachable, no dead end, the 60-second boundary inclusive)?'],
]

phase('Review')
const reviews = await parallel(LENSES.map(([key, lens]) => () =>
  agent(`${COMMON}

You are an independent reviewer of slice S0 in the worktree (git status --short and the new files). Edit nothing. Lens: ${lens}

The author reported: ${JSON.stringify(s0)}

Report only real, specific issues with evidence, ranked.`, { label: `review:${key}`, phase: 'Review', schema: ISSUES, effort: 'high' })
    .then(r => r ? { lens: key, ...r } : null)))
const issues = reviews.filter(Boolean).flatMap(r => r.issues.map(i => ({ lens: r.lens, ...i })))
log(`${issues.length} review issues`)
if (!issues.length) return { s0, reviews, fix: null }

phase('Fix')
const fix = await agent(`${COMMON}

You close the issues two independent reviewers found in slice S0 in the worktree. For each: confirm it; fix it if real; otherwise say why not, with evidence. Then re-run sh tools/hms repo check and sh tools/hms safety check in the worktree, and validate every HAL fixture against the schema.

The author's report: ${JSON.stringify(s0)}

Issues: ${JSON.stringify(issues, null, 1)}

Return each issue's outcome, the check results, and the final programme entries for the lead (the author's list, corrected).`, { label: 'fix', phase: 'Fix', schema: {
  type: 'object',
  properties: { outcomes: { type: 'string' }, checks: { type: 'string' }, programme_entries: { type: 'string' } },
  required: ['outcomes', 'checks', 'programme_entries'],
}, effort: 'high' })

return { s0, reviews, fix }
