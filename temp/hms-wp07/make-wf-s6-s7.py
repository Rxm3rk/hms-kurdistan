import json
BASE = r'C:/Users/Surface/.claude-waybaba/projects/C--Users-Surface--t3-projects-hospitalmanagementsystem/a7252630-2217-4120-a4d4-d624bcd2935a'
src = open(BASE + '/workflows/scripts/wp07-build-to-demo-wf_e941d75c-50c.js', encoding='utf-8').read()
body = src[src.index('\nconst WT ='):src.index('\nconst log_ = []')]
meta = """export const meta = {
  name: 'wp07-s6-commit-s7',
  description: 'WP-0.7: commit the finished S6 web frame (its fast tier is already running), then build S7 (E2E harness) with no review, and commit it',
  phases: [
    { title: 'S6 commit', detail: 'wait for the running fast tier, commit S6 and the status' },
    { title: 'E2E', detail: 'S7 Playwright, axe, RTL visual baselines, screenshots (no review, human decision 4)' },
    { title: 'Checkpoint', detail: 'fast tier and one commit per slice' },
  ],
}
"""
a = "async function checkpoint(results) {"
b = "return agent(`${COMMON}\\n\\nYou are the checkpoint integrator;"
assert a in body, 'a'
assert b in body, 'b'
body = body.replace(a, "async function checkpoint(results, note = '') {")
body = body.replace(b, "return agent(`${COMMON}${note}\\n\\nYou are the checkpoint integrator;")
note = (
    "IMPORTANT, state at hand-over (19 Oct ~12:30): an earlier checkpoint attempt for S6 already staged S6's files "
    "(git status shows them in the index) and started the fast tier on that tree at 12:22:08 "
    "(tools/hms.py ci fast --no-evidence; logs in build/ci-logs/20261019T122208-fast-5438e9e-2676f7 and "
    "C:\\\\Users\\\\Surface\\\\AppData\\\\Local\\\\Temp\\\\hms-wp07\\\\s6-fast*). That run is STILL RUNNING; its Python unit step "
    "takes about 19 minutes on this host. Do not start a second fast tier while it runs: wait for it to finish (poll its log "
    "directory with an until-loop in a background command; never a whole-drive search), then use its result if the worktree "
    "has not changed since 12:22. Re-run the fast tier (through sh C:/Users/Surface/AppData/Local/Temp/hms-lock/heavy.sh) only if "
    "it failed for a reason you fixed, or the tree changed. The human lead's decision 4 (19 Oct, 'abolish most of the reviews') "
    "applies: there is no review step."
)
main = """
const NOTE_S6 = '\\n\\n' + %s
const log_ = []
phase('S6 commit')
const c4 = await checkpoint([args.s6], NOTE_S6)
log_.push({ c4 })
if (!c4 || !/[0-9a-f]{7}/.test(c4.commits || '')) log('S6 did not commit; S7 still runs, and its checkpoint will find the S6 files uncommitted')

phase('E2E')
const s7 = await slice('S7', 'E2E')
const c5 = await checkpoint([s7])
log_.push({ s7, c5 })
return log_
""" % json.dumps(note)
out = meta + body + main
open(r'C:/Users/Surface/AppData/Local/Temp/hms-wp07/wf-s6-commit-s7.js', 'w', encoding='utf-8').write(out)
J = [json.loads(l) for l in open(BASE + '/subagents/workflows/wf_e941d75c-50c/journal.jsonl', encoding='utf-8')]
lab = {o['key']: o.get('label') for o in J if o.get('type') == 'started'}
res = {lab.get(o['key']): o['result'] for o in J if o.get('type') == 'result' and lab.get(o['key']) in ('S6:impl', 'S6:review', 'S6:fix')}
json.dump({'id': 'S6', 'impl': res.get('S6:impl'), 'review': res.get('S6:review'), 'fix': res.get('S6:fix')},
          open(r'C:/Users/Surface/AppData/Local/Temp/hms-wp07/s6-results.json', 'w', encoding='utf-8'), ensure_ascii=False)
print('ok', len(out), 'NO_REVIEW' in out, sorted(res))
