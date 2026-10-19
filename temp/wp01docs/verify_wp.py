import re, sys
from pathlib import Path

root = Path(sys.argv[1])
out = open(sys.argv[2], 'w', encoding='utf-8', newline='\n')
bp = (root / 'BUILD-PROMPT.md').read_text(encoding='utf-8').split('\n')
wp = (root / 'docs/program/WORK-PACKAGES.md').read_text(encoding='utf-8').split('\n')
errors = []


def rows(lines, start_pat):
    s = next(i for i, line in enumerate(lines) if re.match(start_pat, line))
    res = []
    for line in lines[s + 1:]:
        if line.startswith('#'):
            break
        if line.startswith('|') and not re.match(r'^\|[-| ]+\|$', line):
            res.append([c.strip() for c in line.strip().strip('|').split('|')])
    return res


checked = 0
for pat_bp, pat_wp in [(r'^### Phase 1: R1 wedge', r'^### Phase 1: R1 wedge'),
                       (r'^### Phase 2: R2a', r'^### Phase 2: R2a'),
                       (r'^### Phase 3: R2b', r'^### Phase 3: R2b')]:
    b = {}
    for r in rows(bp, pat_bp):
        m = re.match(r'\*\*(\d+\.\d+b?) (.*?)\*\*', r[0])
        if m:
            b[m.group(1)] = (m.group(2), r[1], r[2])
    w = {}
    for r in rows(wp, pat_wp):
        m = re.match(r'WP-(\d+\.\d+b?)$', r[0])
        if m:
            w[m.group(1)] = (r[1], r[2], r[3], r[4])
    if set(b) != set(w):
        errors.append(f'{pat_bp}: WP sets differ: {sorted(set(b) ^ set(w))}')
    for key, (title, dep, feats) in b.items():
        if key not in w:
            continue
        wt, wd, wf, ws = w[key]
        checked += 1
        if wt != title:
            errors.append(f'WP-{key}: title {wt!r} vs {title!r}')
        if wd != dep:
            errors.append(f'WP-{key}: depends {wd!r} vs {dep!r}')
        if wf != feats:
            errors.append(f'WP-{key}: features differ:\n   mine {wf!r}\n   bp   {feats!r}')
        if ws != 'todo':
            errors.append(f'WP-{key}: state {ws!r}')

# Phase 0 table: scope and exit text against §21 (backticks ignored)
b0 = {}
for r in rows(bp, r'^### Phase 0: Foundation'):
    m = re.match(r'\*\*(0\.\d) (.*?)\*\*', r[0])
    if m:
        b0[m.group(1)] = r
w0 = {}
for r in rows(wp, r'^## Phase 0: Foundation'):
    m = re.search(r'WP-(0\.\d)', r[0])
    if m:
        w0[m.group(1)] = r
for key, r in b0.items():
    wr = w0[key]
    checked += 1
    if wr[2] != r[1]:
        errors.append(f'WP-{key}: P0 depends {wr[2]!r} vs {r[1]!r}')
    exit_bp = re.sub('`', '', r[3])
    exit_w = re.sub('`', '', wr[4])
    for frag in re.split(r'; |\. ', exit_bp):
        frag = frag.strip().rstrip('.')
        if len(frag) > 12 and frag[:35].lower() not in exit_w.lower():
            errors.append(f'WP-{key}: P0 exit fragment not found: {frag[:60]!r}')
print(f'rows checked: {checked}', file=out)
print('ERRORS:', len(errors), file=out)
print('\n'.join(errors), file=out)
out.close()
sys.exit(1 if errors else 0)
