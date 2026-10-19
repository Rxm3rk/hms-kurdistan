import csv, sys, collections
S={'S':3,'M':8,'L':20,'XL':50}
rows=list(csv.DictReader(open(sys.argv[1],encoding='utf-8')))
print(len(rows))
c=collections.Counter(); w=collections.Counter()
dom=collections.defaultdict(lambda: collections.Counter()); domw=collections.defaultdict(lambda: collections.Counter())
for r in rows:
    c[r['tag']]+=1; w[r['tag']]+=S[r['size']]
    p=r['id'].split('-')[0]
    dom[p][r['tag']]+=1; domw[p][r['tag']]+=S[r['size']]
print(dict(c), dict(w))
for p in dom: print(p, dict(dom[p]), dict(domw[p]))
# check bad parse
for r in rows:
    if r['size'] not in S or r['tag'] not in ('MVP','P2','P3'): print('BAD',r)
