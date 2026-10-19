import sys, re, yaml
sys.stdout.reconfigure(encoding="utf-8")
class L(yaml.SafeLoader): pass
L.yaml_implicit_resolvers = {k: [(t, r) for t, r in v if t != 'tag:yaml.org,2002:bool'] for k, v in yaml.SafeLoader.yaml_implicit_resolvers.items()}
L.add_implicit_resolver('tag:yaml.org,2002:bool', re.compile(r'^(?:true|false)$'), list('tf'))
d = yaml.load(open(sys.argv[1], encoding='utf-8'), Loader=L)
S = d['states']
def exp(t):
    f = t['from']; return [s for s in S if s != t['to']] if f == '*' else (f if isinstance(f, list) else [f])
running = {'pre-approval-requested','enhancement-requested','discharge-auth-requested','claim-docs-submitted','query-response','appeal'}
bad = []
for i, t in enumerate(d['transitions']):
    e = set(t.get('effects', [])); to = t['to']
    for s in exp(t):
        clocks = e & {'startSlaClock','pauseSlaClock','resumeSlaClock','stopSlaClock'}
        if to == 'query' and clocks != {'pauseSlaClock'}: bad.append((i, s, to, clocks))
        elif s == 'query' and to != 'query' and len(clocks & {'resumeSlaClock','stopSlaClock'}) != 1: bad.append((i, s, to, clocks))
        elif to in running - {'query-response'} and s != 'query' and 'startSlaClock' not in clocks: bad.append((i, s, to, clocks))
        elif s in running and to not in running | {'query'} and to != 'withdrawn' and 'stopSlaClock' not in clocks: bad.append((i, s, to, clocks))
        if 'pauseSlaClock' in clocks and to != 'query': bad.append(('pause-outside', i))
print('violations', bad)
