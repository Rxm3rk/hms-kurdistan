export const meta = {
  name: 'wp02-commit-s0-s2',
  description: 'WP-0.2: apply the human DN-017 licence decisions, then commit S0+S1 and S2 (fast tier in WSL on each exact tree) and the programme records; no review (decision 4)',
  phases: [{ title: 'Commit', detail: 'DN-017 edits, fast tier per commit, commits, STATUS' }],
}
const WT = 'C:\\Users\\Surface\\.t3\\worktrees\\hospitalmanagementsystem\\wp02'
const prompt = `You are the WP-0.2 checkpoint integrator for HMS Kurdistan, a hospital system for private hospitals in the Kurdistan Region of Iraq. You alone make git commits, in the worktree ${WT} only (branch wp/0.2-environments, HEAD 889beec, "merge: wp/0.1-programme-bootstrap at 09afa41 into wp/0.2-environments"). Read BUILD-PROMPT.md §3.5 and §3.6 in that worktree for the commit rules.

STATE
- S0 (programme entries) is staged but has never been committed.
- S1 (pins, image lock, registry, keys, signed mirror, cell-lint) is unstaged or untracked. Its earlier checkpoint fast tiers failed ONLY on cell-lint's two DN-017 licence errors.
- S2 (k3d substrate, fixed node addresses, full-restart test R1) is unstaged or untracked. Its implementer's full report is the last "result" line of C:\\Users\\Surface\\.claude-waybaba\\projects\\C--Users-Surface--t3-projects-hospitalmanagementsystem\\a7252630-2217-4120-a4d4-d624bcd2935a\\subagents\\workflows\\wf_39d4d480-d20\\journal.jsonl.
- S1's reports are in ...\\subagents\\workflows\\wf_1504a938-d16\\journal.jsonl (labels S1:impl, S1:review, S1:fix, checkpoint:S1). S0's are in the same file (labels S0:*, checkpoint:S0).
- Read those reports for the commit bodies: tests and counts, hosts, files. Use python -c with json to pull out the lines you need; the files are large.
- A Windows fast tier for S2 may still be queued in the background behind %TEMP%\\hms-lock\\heavy.sh with the label wp02-s2-fast, writing to C:\\Users\\Surface\\AppData\\Local\\Temp\\hms-wp02\\s2\\fast-windows.txt. Stop it first, because it would run on a tree you are changing. Find it with PowerShell: Get-CimInstance Win32_Process | Where-Object CommandLine -match 'wp02-s2-fast'. Stop only those processes.

DECISIONS TO APPLY
Read C:\\Users\\Surface\\AppData\\Local\\Temp\\hms-wp02\\dn017-decision.md and apply it exactly:
- DN-017 option 1, exactly as docs/program/DECISIONS-NEEDED.md words it:
  - add PostgreSQL to allowed in tools/licence/policy.yaml and to tools/licence/ort/license-classifications.yml;
  - add the licence-register entry for the BusyBox helper image in tools/licence/register.yaml, with source_offer as the option describes;
  - close DN-017, quoting the human's answers.
- Add DN-075 (review policy, decision 4) and DN-076 (MacBook split, postponed) as closed, recorded human decisions, quoting the human.
- Add KA-090 (the fast-tier time budget on the Windows host).
- Update the human-decision list in STATUS.md if it has one.
- Do not weaken any lint or test.

COMMITS (in this order; each only after the fast tier passes on that commit's exact tree)
1. S0 + S1 + the DN-017 licence edits, as one commit, because S0 was never committed alone. The message must cover both, in the repository's style: read git log -8 --format=%B. Use a conventional subject, a body with what it adds, the tests and their counts with the host, a "Hazards:" line naming the HAZ entries and controls exactly as docs/safety/hazard-log.yaml lists them (never guess), and the trailer "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>".
2. S2: the k3d substrate, fixed addresses, the R1 restart test and the cell tools. Same style. Note in the body the lite R1 numbers (labelled lite, not SLO evidence) and the measured k3d behaviour (k3d 5.8.3 does not fix the load balancer's and registry's addresses; cell up re-attaches them).
3. docs(programme): WP-0.2 status after S0, S1 and S2. This covers STATUS.md (B.5 layout, at most 150 lines; S3 is next, and the R1 records are scratch only), DN-075, DN-076, KA-090, OQ-122's notes from the S2 report, and backlog notes via sh tools/hms backlog render if a feature's state changes.

FAST TIER
On the Windows host the Python unit step takes about 880 s of its 900 s timeout and often times out, so run the gate on the WSL build host (Ubuntu-24.04, user surface) instead.
- Build an exact copy of each commit candidate's tree in a WSL scratch directory. A good way is to export the staged tree with git archive "$(git write-tree)" after staging exactly that commit's files. See S2's helper scripts in C:\\Users\\Surface\\AppData\\Local\\Temp\\hms-wp02\\s2\\ (sync-tree.sh, run.sh) for how the S2 agent synced trees.
- Run: sh tools/bootstrap env, then sh tools/ci/run fast --no-evidence, there. It takes about 150 s.
- State in each commit body that the fast tier ran on the WSL build host on the exact tree.
- If WSL is unusable, fall back to the Windows host through sh C:/Users/Surface/AppData/Local/Temp/hms-lock/heavy.sh.
- If a step fails: fix it if the failure is small and clearly inside that commit's slice; otherwise don't commit that slice, and report why.

RULES
- Never use --no-verify; never amend, rebase, force or push (the auto-save uploads on its own).
- No key, passphrase or credential in any commit: check git diff --cached before each commit.
- Synthetic data only. Never mark a [HUMAN] approval.
- There is no review step (human decision 4).
- Never run find / or any whole-drive search; search only inside the worktree or named folders.
- This laptop is short on memory: run one heavy thing at a time.

Return the commits (full SHA and subject), each fast-tier result (host, steps, counts) and anything not committed with the reason.`
phase('Commit')
return await agent(prompt, { label: 'wp02:commit-s0-s2', phase: 'Commit', effort: 'high', schema: { type: 'object', properties: { commits: { type: 'string' }, results: { type: 'string' }, not_committed: { type: 'string' } }, required: ['commits', 'results', 'not_committed'] } })
