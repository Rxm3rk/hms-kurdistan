import sys, re, os
from collections import defaultdict, deque
import yaml
sys.stdout.reconfigure(encoding='utf-8')


class L(yaml.SafeLoader):
    pass


L.yaml_implicit_resolvers = {k: [(t, r) for t, r in v if t != 'tag:yaml.org,2002:bool']
                             for k, v in yaml.SafeLoader.yaml_implicit_resolvers.items()}
L.add_implicit_resolver('tag:yaml.org,2002:bool', re.compile(r'^(?:true|false)$'), list('tf'))


def no_dup(loader, node, deep=False):
    keys = set()
    for k, _ in node.value:
        kk = loader.construct_object(k, deep=deep)
        if kk in keys:
            raise ValueError("duplicate key %r at line %d" % (kk, k.start_mark.line + 1))
        keys.add(kk)
    return loader.construct_mapping(node, deep)


L.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, no_dup)

ROOT = sys.argv[1]
APPROVERS = {
    'encounter': ['nurse-panel', 'him', 'cso'],
    'bed': ['nurse-panel', 'bed-manager'],
    'result': ['lab-cso', 'physician-panel'],
    'appointment': ['opd-panel'],
    'credit-claim': ['rcm-lead', 'kurdistan-pack-pm'],
}
hazlog = open(os.path.join(ROOT, 'docs/safety/hazard-log.yaml'), encoding='utf-8').read()
haz_ids = set(re.findall(r'^\s*- id: (HAZ-\d{4})', hazlog, re.M))
bp = open(os.path.join(ROOT, 'BUILD-PROMPT.md'), encoding='utf-8').read()

for m in sys.argv[2:]:
    p = os.path.join(ROOT, 'docs/specs/state-machines', m + '.yaml')
    d = yaml.load(open(p, encoding='utf-8'), Loader=L)
    errs = []
    E = errs.append
    if not os.path.exists(p[:-5] + '.md'):
        E('no md')
    for i, t in enumerate(d['transitions']):
        if 'on' not in t:
            E('t%d has no on key: %s' % (i, list(t)))
    if d['machine'] != m:
        E('machine name')
    states = d['states']
    S = set(states)
    init = d.get('initial', states[0])
    term = set(d['terminal'])
    if init not in S:
        E('initial not a state')
    for s in term:
        if s not in S:
            E('terminal %s not a state' % s)
    exp = []
    for i, t in enumerate(d['transitions']):
        if t['to'] not in S:
            E('t%d to unknown' % i)
        f = t['from']
        if f == '*':
            fs = [s for s in states if s != t['to']]
        elif isinstance(f, list):
            fs = f
        else:
            fs = [f]
        for s in fs:
            if s not in S:
                E('t%d from %s unknown' % (i, s))
        exp.append((i, fs, t['on'], set(t.get('guard', [])), t['to'], tuple(t.get('effects', [])),
                    t.get('proposed', False), f == '*'))
    adj = defaultdict(set)
    for i, fs, on, g, to, ef, pr, star in exp:
        for s in fs:
            adj[s].add(to)

    def reach(src):
        seen = {src}
        q = deque([src])
        while q:
            u = q.popleft()
            for v in adj[u]:
                if v not in seen:
                    seen.add(v)
                    q.append(v)
        return seen

    seen = reach(init)
    if S - seen:
        E('unreachable %s' % (S - seen))
    preds = set(d['predicates'])
    effs = set((d.get('effects') or {}).keys())
    usedp, usede = set(), set()
    for i, fs, on, g, to, ef, pr, star in exp:
        for x in g:
            if x not in preds:
                E('t%d unknown predicate %s' % (i, x))
        usedp |= g
        for x in ef:
            if x not in effs:
                E('t%d unknown effect %s' % (i, x))
        usede |= set(ef)
    if preds - usedp:
        E('unused predicates %s' % (preds - usedp))
    if effs - usede:
        E('unused effects %s' % (effs - usede))
    by = defaultdict(list)
    for i, fs, on, g, to, ef, pr, star in exp:
        for s in fs:
            by[(s, on)].append((i, g))
    for k, lst in by.items():
        for a in range(len(lst)):
            for b in range(a + 1, len(lst)):
                ga, gb = lst[a][1], lst[b][1]
                if ga <= gb or gb <= ga:
                    E('static nondeterminism %s t%d t%d' % (k, lst[a][0], lst[b][0]))
    for s in seen:
        r = reach(s)
        if term:
            if not (r & term):
                E('liveness: no terminal from %s' % s)
        elif init not in r:
            E('liveness: initial not reachable from %s' % s)
    for i, fs, on, g, to, ef, pr, star in exp:
        for s in fs:
            if s in term and 'privilegedAndAudited' not in g:
                E('terminal exit without pA: t%d %s->%s %s' % (i, s, to, on))
    edges = set()
    for i, fs, on, g, to, ef, pr, star in exp:
        if star:
            edges.add('*→' + to)
        for s in fs:
            edges.add(s + '→' + to)
    prop = d.get('proposed', [])
    for e in prop:
        if e not in edges:
            E('proposed edge %s matches no transition' % e)
    a = d['approval']
    if a['status'] != 'requested' or a['approved_by'] != [] or a['record'] is not None:
        E('approval human fields')
    if sorted(a['required']) != sorted(APPROVERS[m]):
        E('approvers %s' % a['required'])
    for si in d['invariants']:
        if not re.fullmatch(r'SI-(0[1-9]|1[0-9]|2[01])', si):
            E('bad SI %s' % si)
    for h in d.get('hazards', []):
        if h not in haz_ids:
            E('hazard %s not in log' % h)
    for ev in d['events']:
        if ev not in bp:
            print('   note: event %s not literally in BUILD-PROMPT' % ev)
    nprop = 0
    drawn = []
    for i, fs, on, g, to, ef, pr, star in exp:
        isprop = pr or (star and ('*→' + to) in prop) or any((s + '→' + to) in prop for s in fs)
        if isprop:
            nprop += 1
        else:
            drawn.append((i, fs, on, to))
        if not star and len(fs) > 1:
            flags = [(s + '→' + to) in prop for s in fs]
            if any(flags) and not all(flags):
                print('   note: t%d %s mixes edges: %s' % (i, on, ['%s→%s%s' % (s, to, '(P)' if fl else '') for s, fl in zip(fs, flags)]))
    print('== %s: states=%d transitions=%d predicates=%d effects=%d proposed-edges=%d proposed-transitions=%d per-transition-flags=%d'
          % (m, len(states), len(d['transitions']), len(preds), len(effs), len(prop), nprop, sum(1 for x in exp if x[6])))
    print('   treated as drawn:')
    for i, fs, on, to in drawn:
        print('     t%d %s --%s--> %s' % (i, fs, on, to))
    print('   alternatives (state, command): distinguishing predicates')
    for k, lst in sorted(by.items()):
        if len(lst) > 1:
            common = set.intersection(*[x[1] for x in lst])
            print('     %s: %s' % (k, ' | '.join('t%d:%s' % (i, sorted(g - common)) for i, g in lst)))
    sig = defaultdict(list)
    for i, fs, on, g, to, ef, pr, star in exp:
        sig[(on, frozenset(g), ef, to, pr)].append((i, fs))
    for k, lst in sig.items():
        if len(lst) > 1:
            print('   mergeable: %s -> %s: %s' % (k[0], k[3], ', '.join('t%d%s' % (i, fs) for i, fs in lst)))
    print('   ERRORS:' if errs else '   rules 1-10: no failure')
    for e in errs:
        print('     ', e)
