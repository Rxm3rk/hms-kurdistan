import re, sys, collections
lines = open(sys.argv[1], encoding='utf-8').read().split('\n')
out = open(sys.argv[2], 'w', encoding='utf-8', newline='\n')
start = next(i for i,l in enumerate(lines) if l.startswith('## Appendix A. The backlog'))
end = next(i for i,l in enumerate(lines) if l.startswith('### A.18'))
c = collections.Counter(); cp = collections.Counter()
for l in lines[start:end]:
    if not re.match(r'^\| `', l): continue
    cells = [x.strip() for x in l.strip().strip('|').split('|')]
    fid = cells[0].strip('`'); phase = cells[3]
    if 'part:' in fid: cp[phase]+=1
    else: c[phase]+=1
print('ids', dict(c), sum(c.values()), file=out)
print('parts', dict(cp), file=out)
