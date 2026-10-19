import json
BASE = r'C:/Users/Surface/.claude-waybaba/projects/C--Users-Surface--t3-projects-hospitalmanagementsystem/a7252630-2217-4120-a4d4-d624bcd2935a'
src = open(BASE + '/workflows/scripts/wp02-lite-cell-s0-s2-wf_1504a938-d16.js', encoding='utf-8').read()
body = src[src.index('\nconst WT ='):src.index('\nconst out = []')]
meta = """export const meta = {
  name: 'wp02-s2-substrate',
  description: 'WP-0.2 S2: the k3d substrate with fixed node addresses and the full-restart test R1, implemented with no review (human decision 4); S0 and S1 stay staged/uncommitted until DN-017 is answered',
  phases: [
    { title: 'S2', detail: 'k3d lite/dev configs, fixed subnet, full-restart test R1' },
  ],
}
"""
assert "if (NO_REVIEW.has(id)) return" in body
note = (
    "\\n\\nSTATE AT HAND-OVER (19 Oct ~12:35): S0 and S1 are implemented but NOT committed. S0's programme entries are staged; "
    "S1's files are unstaged or untracked in the worktree. Their checkpoint fast tiers failed only on cell-lint's two DN-017 licence errors "
    "(PostgreSQL not classified in tools/licence/policy.yaml; BusyBox GPL-2.0-only in the k3s local-path helper without a register entry), "
    "which wait for the human lead. Do NOT change tools/licence/policy.yaml or tools/licence/register.yaml, and do not weaken the lint. "
    "Do NOT touch the git index or make commits (the lead commits S0+S1+S2 together after DN-017). Build S2 on top of the working tree as it is. "
    "The human lead's decision 4 (19 Oct, 'abolish most of the reviews') applies: there is no review step. "
    "When you run the fast tier at the end, report cell-lint's DN-017 failure as expected and every other step's result. "
    "Use sh C:/Users/Surface/AppData/Local/Temp/hms-lock/heavy.sh for the fast tier. Never run find / or any whole-drive search."
)
main = """
const S2_NOTE = %s
SLICES.S2 = SLICES.S2 + S2_NOTE
phase('S2')
const r = await slice('S2')
return r
""" % json.dumps(note)
out = meta + body + main
open(r'C:/Users/Surface/AppData/Local/Temp/hms-wp02/wf-s2-substrate.js', 'w', encoding='utf-8').write(out)
print('ok', len(out))
