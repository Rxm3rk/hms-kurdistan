import re, sys
lines = open(sys.argv[1], encoding='utf-8').read().split('\n')
out = open(sys.argv[2], 'w', encoding='utf-8', newline='\n')
start = next(i for i,l in enumerate(lines) if l.startswith('## Appendix A. The backlog'))
end = next(i for i,l in enumerate(lines) if l.startswith('### A.18'))
rows = []
for l in lines[start:end]:
    m = re.match(r'^\| `([^`]+)` \| (.*)$', l)
    if not m: continue
    cells = [c.strip() for c in l.strip().strip('|').split('|')]
    fid = cells[0].strip('`'); feat=cells[1]; size=cells[2]; phase=cells[3]; stance=cells[4]; scope='|'.join(cells[5:])
    rows.append((fid, feat, size, phase, stance, scope))
print(len(rows), file=out)
for r in rows:
    scope = r[5]
    note = ''
    if ' · *' in scope:
        note = scope.split(' · *',1)[1].rstrip('*')
    flags = []
    if 'Placed' in note: flags.append('PLACED')
    if '[P]' in note: flags.append('P')
    if re.search(r'[Ii]nferred', note): flags.append('INFERRED')
    if 'Conflict' in note: flags.append('CONFLICT')
    if re.search(r'unstated|silent|not addressed|unaddressed', note): flags.append('UNSTATED')
    if flags:
        print(r[0], '|', r[1], '|', r[3], '|', ','.join(flags), '|', note, file=out)
