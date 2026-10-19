import sys, json, yaml, re, itertools, collections
class L(yaml.SafeLoader): pass
L.yaml_implicit_resolvers = {k: [(t, r) for t, r in v if t != 'tag:yaml.org,2002:bool'] for k, v in yaml.SafeLoader.yaml_implicit_resolvers.items()}
L.add_implicit_resolver('tag:yaml.org,2002:bool', re.compile(r'^(?:true|false)$'), list('tf'))
doc = yaml.load(open(sys.argv[1], encoding='utf-8'), Loader=L)
states = doc['states']; prop = set(doc.get('proposed', []))
exp = []
for i,t in enumerate(doc['transitions']):
    f = t['from']
    fs = [s for s in states if s != t['to']] if f == '*' else ([f] if isinstance(f,str) else f)
    for s in fs:
        edge = ('*' if f=='*' else s)+'→'+t['to']
        exp.append((i,s,t['on'],tuple(t.get('guard',[])),t['to'],edge in prop or t.get('proposed',False), edge))
print("expanded", len(exp))
groups = collections.defaultdict(list)
for e in exp: groups[(e[1],e[2])].append(e)
for k,v in groups.items():
    if len(v)>1:
        print("ALT", k, [(e[3],e[4]) for e in v])
# drawn transitions (not proposed)
print("NOT PROPOSED:")
for e in exp:
    if not e[5]: print("  ", e[1], e[2], '->', e[4], e[3])
# edges in proposed not used
edges = {e[6] for e in exp}
print("unused proposed", prop - edges)
# liveness
adj = collections.defaultdict(set)
for e in exp: adj[e[1]].add(e[4])
term = set(doc['terminal'])
for s in states:
    seen={s}; st=[s]
    while st:
        x=st.pop()
        for y in adj[x]:
            if y not in seen: seen.add(y); st.append(y)
    if not (seen & term): print("NO TERMINAL from", s)
# terminal exits
for e in exp:
    if e[1] in term and 'privilegedAndAudited' not in e[3]: print("TERMINAL EXIT w/o priv", e)
# commands per state
cmds = collections.defaultdict(set)
for e in exp: cmds[e[1]].add(e[2])
for s in states: print(s, sorted(cmds[s]))
