import re, sys
from pathlib import Path

root = Path(sys.argv[1])
out = open(sys.argv[2], 'w', encoding='utf-8', newline='\n')
errors = []
notes = []


def err(m):
    errors.append(m)


bp = (root / 'BUILD-PROMPT.md').read_text(encoding='utf-8').split('\n')
k = (root / 'BLUEPRINT-KURDISTAN.md').read_text(encoding='utf-8').split('\n')
mine = ['docs/program/STATUS.md', 'docs/program/WORK-PACKAGES.md', 'docs/program/DECISIONS-NEEDED.md',
        'docs/program/OPEN-QUESTIONS.md', 'docs/program/ASSUMPTIONS.md', 'docs/program/KNOWN-ANOMALIES.md',
        'docs/program/reviews/README.md', 'docs/program/evidence/README.md', 'CHANGELOG.md',
        'docs/specs/README.md', 'docs/specs/state-machines/README.md', 'docs/specs/modules/README.md',
        'docs/specs/api/README.md', 'docs/specs/events/README.md', 'docs/specs/hl7/README.md',
        'docs/specs/fhir/README.md', 'docs/runbooks/README.md', 'docs/user/README.md',
        'docs/content-sources/README.md', 'content/README.md', 'content/licensed/README.md',
        'deploy/README.md', 'deploy/helm/README.md', 'deploy/site-cell/README.md', 'deploy/central/README.md',
        'deploy/edge-agent/README.md', 'deploy/tofu/README.md', 'tests/README.md'] + \
       [f'docs/program/work-packages/WP-0.{i}.md' for i in range(1, 10)]

# 1 encoding and line endings
for f in mine:
    b = (root / f).read_bytes()
    if b.startswith(b'\xef\xbb\xbf'):
        err(f'{f}: BOM')
    if b'\r' in b:
        err(f'{f}: CR found')
    if not b.endswith(b'\n'):
        err(f'{f}: no final newline')
    if b.endswith(b'\n\n'):
        err(f'{f}: trailing blank line')
    for i, line in enumerate(b.decode('utf-8').split('\n'), 1):
        if line.rstrip() != line:
            err(f'{f}:{i}: trailing whitespace')
notes.append(f'files checked: {len(mine)}')


def table_rows(lines, start_pat, stop_pat='^#'):
    s = next(i for i, line in enumerate(lines) if re.match(start_pat, line))
    rows = []
    for line in lines[s + 1:]:
        if re.match(stop_pat, line):
            break
        if line.startswith('|') and not re.match(r'^\|[-| ]+\|$', line):
            rows.append([c.strip() for c in line.strip().strip('|').split('|')])
    return rows


oq = (root / 'docs/program/OPEN-QUESTIONS.md').read_text(encoding='utf-8')
oqlines = oq.split('\n')

# 2 Q-K headings, once each
heads = re.findall(r'^### (OQ-\d{3}) · (Q-K\d+):', oq, re.M)
qk = [h[1] for h in heads]
for n in range(1, 20):
    c = qk.count(f'Q-K{n}')
    if c != 1:
        err(f'Q-K{n} heading count {c}')
if len(qk) != 19:
    err(f'Q-K headings {len(qk)}')

krows = [r for r in table_rows(k, r'^### 19\.2 Decisions still required') if r[0].startswith('Q-K')]
if len(krows) != 19:
    err(f'K 19.2 rows {len(krows)}')
blocks = re.split(r'^### ', oq, flags=re.M)
qblock = {}
for bl in blocks:
    m = re.match(r'OQ-\d{3} · (Q-K\d+):', bl)
    if m:
        qblock[m.group(1)] = bl
for r in krows:
    qid, question, by, default = r[0], r[1], r[2], r[3]
    bl = qblock.get(qid, '')
    qtext = re.search(r'\*\*Question \(K §19\.2\):\*\* (.*)', bl).group(1)
    if qtext.rstrip('.') not in question:
        err(f'{qid}: question not a substring of K:\n   mine {qtext!r}\n   K    {question!r}')
    kdef = re.search(r"\*\*K's default if unanswered:\*\* (.*)", bl).group(1).replace(' (K §14.5)', '')
    if kdef.rstrip('.').lower() != default.rstrip('.').lower():
        err(f'{qid}: K default differs:\n   mine {kdef!r}\n   K    {default!r}')
    dl = re.search(r'\*\*Deadline:\*\* (.*)', bl).group(1).rstrip('.')
    if dl.lower() != by.lower() and not (qid == 'Q-K18' and dl == 'company gate G3'):
        err(f'{qid}: deadline {dl!r} vs {by!r}')
    if '**Status:** open' not in bl:
        err(f'{qid}: status')

brows = [r for r in table_rows(bp, r'^## 23\. Open decisions') if r[0].startswith('Q-K')]
if len(brows) != 19:
    err(f'§23 rows {len(brows)}')


def norm(s):
    return re.sub(r'[`.]', '', s).lower().strip()


for r in brows:
    bl = qblock.get(r[0], '')
    bd = re.search(r'\*\*Default to build with \(§23\):\*\* (.*)', bl).group(1)
    if norm(bd) != norm(r[2]):
        err(f'{r[0]}: build default differs:\n   mine {bd!r}\n   bp   {r[2]!r}')

# 3 A.20 rows
a20 = [r for r in table_rows(bp, r'^### A\.20 ') if r[0] != 'Conflict']
notes.append(f'A.20 rows in BUILD-PROMPT: {len(a20)}')
for conflict, res in a20:
    hits = [line for line in oqlines if line.startswith('| OQ-') and f'| {conflict} | {res} |' in line]
    if len(hits) != 1:
        err(f'A.20 row not found exactly once: {conflict[:60]}')

# 4 OQ ids unique and sequential, statuses
ids = re.findall(r'(?:^### |^\| )(OQ-\d{3})', oq, re.M)
if len(ids) != len(set(ids)):
    err('duplicate OQ ids')
nums = sorted(int(i[3:]) for i in ids)
if nums != list(range(1, len(nums) + 1)):
    err(f'OQ ids not sequential: {nums}')
notes.append(f'OQ items: {len(ids)}')
for line in oqlines:
    if line.startswith('| OQ-') and not line.rstrip().endswith('| open |'):
        err(f'OQ row without open status: {line[:40]}')
for bl in blocks:
    m = re.match(r'(OQ-\d{3})', bl)
    if m and '**Status:**' not in bl:
        err(f'{m.group(1)} block without status')

# 10 Appendix A notes verbatim in (c), and coverage
s = next(i for i, line in enumerate(bp) if line.startswith('## Appendix A. The backlog'))
e = next(i for i, line in enumerate(bp) if line.startswith('### A.18'))
anotes = {}
for line in bp[s:e]:
    if line.startswith('| `'):
        cells = [c.strip() for c in line.strip().strip('|').split('|')]
        fid = cells[0].strip('`')
        scope = '|'.join(cells[5:])
        if ' · *' in scope:
            anotes[fid] = (cells[3], scope.split(' · *', 1)[1].rstrip('*'))
crow = [line for line in oqlines if re.match(r'^\| OQ-0(4\d|5\d|6\d|7\d|8[0-2]) ', line)]
have = set()
for line in crow:
    cells = [c.strip() for c in line.strip().strip('|').split('|')]
    fid = re.match(r'`([^`]+)`', cells[1]).group(1)
    have.add(fid)
    ph, note = anotes[fid]
    if cells[2] != ph:
        err(f'{fid}: phase {cells[2]} vs {ph}')
    if not cells[3].startswith(note):
        err(f'{fid}: note not verbatim:\n   mine {cells[3]!r}\n   bp   {note!r}')
notes.append(f'(c) rows: {len(crow)}')
need = set()
for fid, (ph, note) in anotes.items():
    if 'Placed' in note or '[P]' in note or re.search('[Ii]nferred', note) or ' · ' in note:
        need.add(fid)
missing = need - have
if missing:
    err(f'(c) missing: {sorted(missing)}')
extra = have - need
if extra:
    notes.append(f'(c) rows beyond the automatic selection: {sorted(extra)}')

# 5 ASSUMPTIONS
asm = (root / 'docs/program/ASSUMPTIONS.md').read_text(encoding='utf-8').split('\n')
lrows = [[c.strip() for c in line.strip().strip('|').split('|')] for line in asm if re.match(r'^\| L-\d+ \|', line)]
lids = [r[0] for r in lrows]
for n in range(1, 38):
    if lids.count(f'L-{n}') != 1:
        err(f'L-{n} count {lids.count(f"L-{n}")}')
krb = {r[0]: r for r in table_rows(k, r'^## Appendix B\. Kurdistan assumption register') if r[0].startswith('L-')}
if len(krb) != 37:
    err(f'K Appendix B rows {len(krb)}')
for r in lrows:
    if len(r) != 9:
        err(f'{r[0]} columns {len(r)}')
        continue
    kr = krb[r[0]]
    for idx, name in [(1, 'assumption'), (2, 'used in'), (3, 'verify'), (4, 'owner'), (5, 'by')]:
        if r[idx] != kr[idx]:
            err(f'{r[0]} {name}:\n   mine {r[idx]!r}\n   K    {kr[idx]!r}')
    if r[8] != 'not-built':
        err(f'{r[0]} status')
    if not r[6] or not r[7]:
        err(f'{r[0]} default or key empty')

# 6 work-package files
order = ['Phase / release:', 'Features:', 'Read first:', 'Depends on:', 'Simulators needed:', 'Entry criteria:',
         'Deliverables:', 'Exit criteria (evidence required):', 'Hazards touched:', '[HUMAN] gates:']
p0 = {re.match(r'\*\*(0\.\d)', r[0]).group(1): r for r in table_rows(bp, r'^### Phase 0: Foundation') if r[0].startswith('**0.')}
deps = {'—': '—', '0.1': 'WP-0.1', '0.2': 'WP-0.2', '0.3': 'WP-0.3', '0.4, 0.5': 'WP-0.4, WP-0.5',
        '0.1 (badge flow: 0.4)': 'WP-0.1 (badge flow: WP-0.4)', 'all other Phase 0 WPs': 'all other Phase 0 WPs'}
for i in range(1, 10):
    t = (root / f'docs/program/work-packages/WP-0.{i}.md').read_text(encoding='utf-8')
    lines = t.split('\n')
    if not t.startswith(f'# WP-0.{i}: '):
        err(f'WP-0.{i}: title')
    pos = -1
    for h in order:
        p = t.find(h)
        if p < 0:
            err(f'WP-0.{i}: missing {h}')
        if p < pos:
            err(f'WP-0.{i}: {h} out of order')
        pos = p
    if not lines[1].startswith('Phase / release:') or '   Features:' not in lines[1]:
        err(f'WP-0.{i}: line 2 shape')
    if not lines[2].startswith('Read first:'):
        err(f'WP-0.{i}: line 3 shape')
    if not lines[3].startswith('Depends on:') or '   Simulators needed:' not in lines[3]:
        err(f'WP-0.{i}: line 4 shape')
    for h in order[5:]:
        if f'\n{h}\n' not in t:
            err(f'WP-0.{i}: {h} not on its own line')
    dep_bp = p0[f'0.{i}'][1]
    if deps[dep_bp] not in lines[3]:
        err(f'WP-0.{i}: depends {lines[3]!r} vs {dep_bp!r}')
    title_bp = re.match(r'\*\*0\.\d (.*?)\*\*', p0[f'0.{i}'][0]).group(1)
    if lines[0] != f'# WP-0.{i}: {title_bp}':
        err(f'WP-0.{i}: title {lines[0]!r} vs {title_bp!r}')
    feats_bp = re.findall(r'`([A-Z]+-[A-Z0-9-]+)`', p0[f'0.{i}'][0])
    for fid in feats_bp:
        if f'`{fid}`' not in lines[1]:
            err(f'WP-0.{i}: feature {fid} missing from line 2')
    ex = re.sub('`', '', p0[f'0.{i}'][3])
    flat = re.sub('`', '', t)
    for frag in re.split(r'; |\. ', ex):
        frag = frag.strip().rstrip('.')
        if len(frag) > 12 and frag[:40].lower() not in flat.lower():
            notes.append(f'WP-0.{i}: exit fragment paraphrased, check: {frag[:70]!r}')

# 7 DECISIONS-NEEDED
dn = (root / 'docs/program/DECISIONS-NEEDED.md').read_text(encoding='utf-8')
bn = dn.split('## Blocking now', 1)[1].split('\n## ', 1)[0]
items = re.findall(r'^\d+\. \*\*(DN-\d{3})\*\*', bn, re.M)
if len(items) > 10:
    err('Blocking now > 10')
notes.append(f'Blocking now: {items}')
dblocks = re.split(r'^## (?=DN-)', dn, flags=re.M)[1:]
dids = []
for bl in dblocks:
    did = bl[:6]
    dids.append(did)
    for fld in ['**Status:**', '**Blocks:**', '**Default in use:**', '**Who decides:**', '**Context:**', '**Options:**']:
        if fld not in bl:
            err(f'{did}: missing {fld}')
    blocks_now = re.search(r'\*\*Blocks:\*\* now', bl) is not None
    if blocks_now != (did in items):
        err(f'{did}: blocks-now mismatch with the list')
if dids != [f'DN-{n:03d}' for n in range(1, 11)]:
    err(f'DN ids {dids}')

# 8 STATUS
st = (root / 'docs/program/STATUS.md').read_text(encoding='utf-8').split('\n')
if len(st) >= 150:
    err('STATUS too long')
for fld in ['# STATUS (updated', 'Phase:', 'Work package:', 'Branch:', 'Last green:', 'In-flight slice:',
            'Open review findings:', 'Blocking decisions:', '## Last session', '## Next exact step',
            '## Blocked / waiting on humans', '## Read next:']:
    if not any(fld in line for line in st):
        err(f'STATUS missing {fld}')
notes.append(f'STATUS lines: {len(st) - 1}')

# 9 KNOWN-ANOMALIES
ka = (root / 'docs/program/KNOWN-ANOMALIES.md').read_text(encoding='utf-8').split('\n')
karows = [[c.strip() for c in line.strip().strip('|').split('|')] for line in ka if line.startswith('| KA-')]
if [r[0] for r in karows] != [f'KA-{n:03d}' for n in range(1, 7)]:
    err('KA ids')
for r in karows:
    if len(r) != 6:
        err(f'{r[0]} columns')

# dangling references
alltext = '\n'.join((root / f).read_text(encoding='utf-8') for f in mine)
for ref in sorted(set(re.findall(r'OQ-\d{3}', alltext))):
    if ref not in ids:
        err(f'dangling {ref}')
for ref in sorted(set(re.findall(r'DN-\d{3}', alltext))):
    if ref not in dids:
        err(f'dangling {ref}')
for ref in sorted(set(re.findall(r'KA-\d{3}', alltext))):
    if ref not in [r[0] for r in karows]:
        err(f'dangling {ref}')

print('\n'.join(notes), file=out)
print('ERRORS:', len(errors), file=out)
print('\n'.join(errors), file=out)
out.close()
sys.exit(1 if errors else 0)
