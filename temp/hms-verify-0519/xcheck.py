# Throwaway cross-check, independent of tools/hmstools/backlog. Args: BUILD-PROMPT.md backlog.yaml hazard-log.yaml
import re, sys, yaml
bp_path, bl_path, hz_path = sys.argv[1:4]
raw = open(bp_path, 'rb').read().split(b'\n')
lines = [l.rstrip(b'\r').decode('utf-8') for l in raw]
# Appendix A feature tables: from "### A.1" to "### A.18"
start = next(i for i, l in enumerate(lines) if l.startswith('### A.1 '))
end = next(i for i, l in enumerate(lines) if l.startswith('### A.18 '))
rows = []
section = None
for i in range(start, end):
    l = lines[i]
    m = re.match(r'### (A\.\d+) ', l)
    if m:
        section = m.group(1); continue
    if not l.startswith('| `'):
        continue
    cells = [c.strip() for c in re.split('(?<!' + re.escape(chr(92)) + ')[|]', l)[1:-1]]
    assert len(cells) == 6, (i + 1, cells)
    idc, title, size, phase, stance, sc = cells
    idc = idc.strip('`')
    part = None
    if ' · part: ' in idc:
        idc, part = idc.split(' · part: ')
    dag = stance.endswith('†')
    if dag: stance = stance[:-1]
    k = sc.find(' · *')
    if k >= 0:
        scope, note = sc[:k], sc[k + 4:]
        assert note.endswith('*'); note = note[:-1]
    else:
        scope, note = sc, None
    rows.append(dict(line=i + 1, id=idc, part=part, group=idc.split('-')[0], section=section, title=title,
                     size=size, phase=phase, stance=stance, domain_level=dag, scope=scope,
                     kurdistan_note=note, placement_marked=bool(note and '[P]' in note)))
bl = yaml.safe_load(open(bl_path, encoding='utf-8'))
hz = yaml.safe_load(open(hz_path, encoding='utf-8'))
entries = hz['hazards'] if isinstance(hz, dict) else hz
haz = {}
for e in entries:
    for f in e.get('features') or []:
        haz.setdefault(f, []).append(e['id'])
key = lambda r: (r['id'], r.get('part'))
blmap = {key(r): r for r in bl}
srcmap = {key(r): r for r in rows}
mism = []
for r in rows:
    b = blmap.get(key(r))
    if b is None:
        mism.append((key(r), 'missing in backlog.yaml')); continue
    for f in ('group', 'section', 'title', 'size', 'phase', 'stance', 'domain_level', 'scope', 'kurdistan_note', 'placement_marked'):
        if b.get(f) != r[f]:
            mism.append((key(r), f, r[f], b.get(f)))
    exp_h = sorted(haz.get(r['id'], []))
    if sorted(b.get('hazards') or []) != exp_h:
        mism.append((key(r), 'hazards', exp_h, b.get('hazards')))
    if b.get('status') != 'todo' or b.get('tests') != [] or b.get('notes') != []:
        mism.append((key(r), 'hand-edited', b.get('status'), b.get('tests'), b.get('notes')))
extra = [k for k in blmap if k not in srcmap]
order_same = [key(r) for r in rows] == [key(r) for r in bl]
unknown_haz = sorted(set(haz) - {r['id'] for r in rows})
print('rows in Appendix A:', len(rows), '| unique feature IDs:', len({r['id'] for r in rows if not r['part']}),
      '| part rows:', sum(1 for r in rows if r['part']))
print('backlog.yaml records:', len(bl), '| extra records:', extra, '| same order:', order_same)
print('mismatches:', len(mism))
for m in mism: print('  ', m)
print('dagger stances:', sum(r['domain_level'] for r in rows), '| [P] rows:', [(r['id'], r['line']) for r in rows if r['placement_marked']])
print('hazard-log feature IDs not in Appendix A:', unknown_haz)
print('features with hazards:', sum(1 for r in rows if not r['part'] and haz.get(r['id'])),
      '| hazard links (feature rows):', sum(len(haz.get(r['id'], [])) for r in rows if not r['part']),
      '| hazard-log entries:', len(entries))
# A.18 with annotations honoured
base = {'S': 3, 'M': 8, 'L': 20, 'XL': 50}
def ew(s):
    if s == '≈3 ew': return 3
    if s == 'L+M': return 28
    m = re.match(r'(XL|L|M|S)\b(?: \((.*)\))?$', s)
    v = base[m.group(1)]; ann = m.group(2) or ''
    a = re.match(r'([−+-])(\d+)( net)?$', ann)
    if a:
        n = int(a.group(2))
        if a.group(3): return n
        return v - n if a.group(1) in '−-' else v + n
    return v
tot = {}
for r in rows:
    t = tot.setdefault(r['phase'], [0, 0])
    if not r['part']: t[0] += 1
    t[1] += ew(r['size'])
for p in ['R1', 'R1.1', 'R2a', 'R2b', 'R2.1', 'P2', 'P3', 'DROPPED-K']:
    print('A.18', p, tot[p])
mvp = [sum(tot[p][i] for p in ['R1', 'R1.1', 'R2a', 'R2b', 'R2.1']) for i in (0, 1)]
print('A.18 MVP', mvp, 'All', [sum(v[i] for v in tot.values()) for i in (0, 1)])
# the ten sampled rows: print yaml records with hazards
for id_ in sys.argv[4:]:
    b = blmap[(id_, None)]; r = srcmap[(id_, None)]
    print('SAMPLE', id_, r['line'], r['section'], b['work_packages'], b['hazards'], 'derived', sorted(haz.get(id_, [])))
