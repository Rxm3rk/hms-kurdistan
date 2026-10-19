import sys, yaml, itertools
class L(yaml.SafeLoader): pass
# treat on/yes/no as strings
for ch in list(L.yaml_implicit_resolvers):
    L.yaml_implicit_resolvers[ch]=[(t,r) for t,r in L.yaml_implicit_resolvers[ch] if t!='tag:yaml.org,2002:bool']
d=yaml.load(open(sys.argv[1],encoding='utf-8'),Loader=L)
S=d['states']; T=set(d['terminal'])
ex=[]
for i,t in enumerate(d['transitions']):
    fr=t['from']; fr=[s for s in S if s!=t['to']] if fr=='*' else (fr if isinstance(fr,list) else [fr])
    for f in fr: ex.append((i,f,t['on'],frozenset(t.get('guard',[])),t['to'],tuple(t.get('effects',[]))))
# determinism
from collections import defaultdict
g=defaultdict(list)
for e in ex: g[(e[1],e[2])].append(e)
for k,v in g.items():
    for a,b in itertools.combinations(v,2):
        if a[3]<=b[3] or b[3]<=a[3]: print('SUBSET',k,a[0],b[0])
# terminal exits
for e in ex:
    if e[1] in T and 'privilegedAndAudited' not in e[3]: print('TERMEXIT no PA',e[:3])
# liveness w/o EIE
adj=defaultdict(set)
for e in ex:
    if e[2]!='MarkEnteredInError': adj[e[1]].add(e[4])
for s in S:
    seen={s};st=[s]
    while st:
        x=st.pop()
        for y in adj[x]:
            if y not in seen: seen.add(y);st.append(y)
    if not (seen & T): print('NO TERMINAL (w/o EIE) from',s)
# edges vs proposed
edges=set((e[1],e[4]) for e in ex)
prop=set(d.get('proposed',[]))
print('edges:',len(edges))
for f,t in sorted(edges): 
    tag = f"{f}→{t}" in prop or f"*→{t}" in prop
    print(' ',f,'->',t,'P' if tag else '')
used=set(p for e in ex for p in e[3]); print('unused preds',set(d['predicates'])-used)
usedE=set(p for e in ex for p in e[5]); print('unused effects',set(d.get('effects',{}))-usedE)
