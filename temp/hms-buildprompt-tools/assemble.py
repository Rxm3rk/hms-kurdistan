import re, sys, pathlib
D = pathlib.Path(sys.argv[1]); OUT = pathlib.Path(sys.argv[2])
rd = lambda n: (D/n).read_text(encoding='utf-8')
# --- section 9: collect '### 9.N' blocks from module parts and sort numerically
mod_parts = [p for p in ['part-04a.md','part-04b.md','part-04c.md','part-04d.md','part-04e.md'] if (D/p).exists()]
intro9 = ''; blocks = {}
for p in mod_parts:
    t = rd(p)
    pieces = re.split(r'(?m)^(?=### 9\.\d+ )', t)
    head = pieces[0]
    if head.strip(): intro9 += head
    for b in pieces[1:]:
        n = int(re.match(r'### 9\.(\d+) ', b).group(1))
        if n in blocks: sys.exit(f'duplicate section 9.{n} in {p}')
        blocks[n] = b.rstrip()+'\n\n'
sec9 = intro9 + ''.join(blocks[k] for k in sorted(blocks))
p09b = rd('part-09b.md'); i = p09b.index('## Appendix B.')
order = [rd('part-01.md'), rd('part-02.md'), rd('part-03.md'), sec9,
         rd('part-05.md'), rd('part-06a.md'), rd('part-06b.md'), rd('part-07.md')]
for p in ['part-08a.md','part-08b.md','part-09a.md']:
    if (D/p).exists(): order.append(rd(p))
order += [p09b[:i], '\n---\n\n'+rd('part-11-appendixA.md'), '\n---\n\n'+p09b[i:]]
if (D/'part-12-appendixC.md').exists(): order.append('\n---\n\n'+rd('part-12-appendixC.md'))
doc = '\n'.join(s.rstrip()+'\n' for s in order)
doc = re.sub(r'\n{3,}', '\n\n', doc)
OUT.write_text(doc, encoding='utf-8')
# --- checks
heads = re.findall(r'(?m)^(#{2,4}) (.+)$', doc)
nums = set()
for lvl, h in heads:
    m = re.match(r'(\d+(?:\.\d+)*)\.? ', h)
    if m: nums.add(m.group(1))
dups = [h for h in set(h for _,h in heads) if [x for _,x in heads].count(h) > 1]
bad_refs = set()
for m in re.finditer(r'(?<![A-Za-z0-9])(K |BP |RL |R\d\d |§§?)?§(\d+(?:\.\d+)*)', doc):
    pre = doc[max(0,m.start()-6):m.start()+1]
    if re.search(r'(K|BP|RL|R\d\d|R0\d|R1\d)\s*$', doc[max(0,m.start()-5):m.start()]): continue
    ref = m.group(2)
    if ref not in nums: bad_refs.add(ref)
appx = doc[doc.index('## Appendix A.'):]
ids_def = set(re.findall(r'\| `([A-Z]{2,4}-[A-Z0-9]{2,5}(?:-[A-Z]{3})?-\d{2}[ab]?)', appx))
ids_used = set(re.findall(r'`([A-Z]{2,4}-[A-Z0-9]{2,5}(?:-[A-Z]{3})?-\d{2}[ab]?)`', doc))
missing = sorted(ids_used - ids_def)
sis = sorted(set(int(x) for x in re.findall(r'\bSI-(\d{2})\b', doc)))
print('words', len(re.findall(r"\S+", doc)), 'lines', doc.count('\n'))
print('sections', len(nums), 'dup headings', dups)
print('unresolved § refs', sorted(bad_refs, key=lambda s:[int(x) for x in s.split('.')]))
print('feature IDs used', len(ids_used), 'defined', len(ids_def), 'missing', missing)
print('SI range', sis[:1], sis[-1:], 'bad', [s for s in sis if s<1 or s>21])
print('9.x present', sorted(blocks))
