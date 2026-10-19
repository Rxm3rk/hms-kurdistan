import sys, re, yaml, itertools
sys.stdout.reconfigure(encoding="utf-8")
class L(yaml.SafeLoader): pass
L.yaml_implicit_resolvers = {k: [(t, r) for t, r in v if t != 'tag:yaml.org,2002:bool'] for k, v in yaml.SafeLoader.yaml_implicit_resolvers.items()}
L.add_implicit_resolver('tag:yaml.org,2002:bool', re.compile(r'^(?:true|false)$'), list('tf'))
d = yaml.load(open(sys.argv[1], encoding='utf-8'), Loader=L)
req = sys.argv[2].split(',')
S = d['states']; T = set(d['terminal']); init = d.get('initial', S[0]); P = set(d['predicates']); E = set(d.get('effects', {}))
errs = []
def exp(t):
    f = t['from']
    if f == '*': return [s for s in S if s != t['to']]
    return f if isinstance(f, list) else [f]
for s in list(T) + [init]:
    if s not in S: errs.append(f'not a state: {s}')
usedP, usedE, edges = set(), set(), set()
for i, t in enumerate(d['transitions']):
    if t['to'] not in S: errs.append(f'T{i} to {t["to"]}')
    for s in exp(t):
        if s not in S: errs.append(f'T{i} from {s}')
    for p in t.get('guard', []):
        usedP.add(p)
        if p not in P: errs.append(f'T{i} unknown predicate {p}')
    for e in t.get('effects', []):
        usedE.add(e)
        if e not in E: errs.append(f'T{i} unknown effect {e}')
    for s in exp(t):
        if s in T and 'privilegedAndAudited' not in t.get('guard', []): errs.append(f'T{i} leaves terminal {s} without privilegedAndAudited')
    if t['from'] == '*': edges.add(f'*→{t["to"]}')
    for s in exp(t):
        edges.add(f'{s}→{t["to"]}')
for p in P - usedP: errs.append(f'unused predicate {p}')
for e in E - usedE: errs.append(f'unused effect {e}')
# determinism
tr = d['transitions']
for (i, a), (j, b) in itertools.combinations(enumerate(tr), 2):
    if a['on'] != b['on']: continue
    common = set(exp(a)) & set(exp(b))
    if not common: continue
    ga, gb = set(a.get('guard', [])), set(b.get('guard', []))
    if ga <= gb or gb <= ga: errs.append(f'nondeterministic T{i} T{j} on {a["on"]} from {sorted(common)}')
# reachability & liveness
adj = {s: set() for s in S}
for t in tr:
    for s in exp(t): adj[s].add(t['to'])
def reach(src):
    seen = {src}; st = [src]
    while st:
        x = st.pop()
        for y in adj[x]:
            if y not in seen: seen.add(y); st.append(y)
    return seen
R = reach(init)
for s in S:
    if s not in R: errs.append(f'unreachable {s}')
for s in R:
    if T and not (reach(s) & T): errs.append(f'no terminal reachable from {s}')
for p in d.get('proposed', []):
    if p not in edges: errs.append(f'proposed edge not a transition edge: {p}')
a = d['approval']
if a['status'] != 'requested' or a['approved_by'] != [] or a['record'] is not None or sorted(a['required']) != sorted(req): errs.append(f'approval block {a}')
for si in d['invariants']:
    n = int(si[3:])
    if not 1 <= n <= 21: errs.append(si)
hz = open(sys.argv[3], encoding='utf-8').read()
for h in d.get('hazards', []):
    if f'id: {h}' not in hz: errs.append(f'hazard missing {h}')
print('owner', d['owner'], 'machine', d['machine'])
print('states', len(S), 'transitions', len(tr), 'predicates', len(P), 'effects', len(E), 'proposed', len(d.get('proposed', [])))
undrawn = sorted(e for e in edges if e not in set(d.get('proposed', [])))
print('edges not in proposed (must be R11/§8.4/§9.23 drawn):', undrawn)
print('ERRORS:', len(errs)); [print(' ', e) for e in errs]
