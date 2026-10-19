import collections, sys, csv
sys.path.insert(0, '.')
from rows import R
ids = [r[1] for r in R if r[9] == 1]
print('rows', len(R), 'counted IDs', len(ids), 'unique', len(set(ids)))
# check every R14 id present
r14 = [row['id'] for row in csv.DictReader(open('r14.csv', encoding='utf-8'))]
present = set(r[1] for r in R)
missing = [i for i in r14 if i not in present]
print('R14 ids missing from rows:', missing)
extra = sorted(present - set(r14))
print('ids not in R14:', extra)
c = collections.Counter(); w = collections.Counter()
for t, i, n, s, e, p, st, sc, no, cnt in R:
    c[p] += cnt; w[p] += e
order = ['R1', 'R1.1', 'R2a', 'R2b', 'R2.1', 'MVP?', 'P2', 'P3', 'DROPPED-K']
for p in order:
    print(p, c[p], w[p])
mvp = ['R1', 'R1.1', 'R2a', 'R2b', 'R2.1', 'MVP?']
print('MVP total', sum(c[p] for p in mvp), sum(w[p] for p in mvp))
print('ALL', sum(c.values()), sum(w.values()))
tc = collections.defaultdict(collections.Counter)
tw = collections.defaultdict(collections.Counter)
for t, i, n, s, e, p, st, sc, no, cnt in R:
    tc[t][p] += cnt; tw[t][p] += e
for t in tc:
    print(t, dict(tc[t]), dict(tw[t]))
for t, i, n, s, e, p, st, sc, no, cnt in R:
    if len(sc.split()) > 20: print('SCOPE>20', i, len(sc.split()))
    if len(no.split()) > 12: print('NOTE>12', i, len(no.split()), no)
