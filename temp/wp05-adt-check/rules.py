import sys
import sys, re, yaml
sys.stdout.reconfigure(encoding="utf-8")
class L(yaml.SafeLoader): pass
L.yaml_implicit_resolvers = {k: [(t, r) for t, r in v if t != 'tag:yaml.org,2002:bool'] for k, v in yaml.SafeLoader.yaml_implicit_resolvers.items()}
L.add_implicit_resolver('tag:yaml.org,2002:bool', re.compile(r'^(?:true|false)$'), list('tf'))
APPROVERS = {"encounter": ["nurse-panel", "him", "cso"], "bed": ["nurse-panel", "bed-manager"]}
def check(path, hazlog):
    d = yaml.load(open(path, encoding='utf-8'), Loader=L)
    fails = []
    m = d["machine"]; S = d["states"]; init = d.get("initial", S[0]); term = set(d["terminal"])
    if path.replace("\\", "/").rsplit("/", 1)[1] != m + ".yaml": fails.append("r2 name")
    if d["owner"] != "adt": fails.append("r2 owner")
    if init not in S or not term <= set(S): fails.append("r3 initial/terminal")
    tr = []
    for i, t in enumerate(d["transitions"]):
        to = t["to"]; fr = t["from"]
        frs = [s for s in S if s != to] if fr == "*" else ([fr] if isinstance(fr, str) else fr)
        for s in frs + [to]:
            if s not in S: fails.append(f"r3 t{i} unknown state {s}")
        tr.append((i, frs, t["on"], t.get("guard", []), to, t.get("effects", [])))
    preds = set(d["predicates"]); effs = set(d.get("effects", {}))
    usedp = {p for t in tr for p in t[3]}; usede = {e for t in tr for e in t[5]}
    if usedp - preds: fails.append(f"r4 unknown predicates {usedp - preds}")
    if preds - usedp: fails.append(f"r4 unused predicates {preds - usedp}")
    if usede - effs: fails.append(f"r4 unknown effects {usede - effs}")
    if effs - usede: fails.append(f"r4 unused effects {effs - usede}")
    by = {}
    for (i, frs, on, g, to, e) in tr:
        for s in frs: by.setdefault((s, on), []).append((i, set(g)))
    for k, lst in by.items():
        for a in range(len(lst)):
            for b in range(a + 1, len(lst)):
                ga, gb = lst[a][1], lst[b][1]
                if ga <= gb or gb <= ga: fails.append(f"r5 {k} t{lst[a][0]} vs t{lst[b][0]}")
    succ = {s: set() for s in S}
    for (i, frs, on, g, to, e) in tr:
        for s in frs: succ[s].add(to)
    def reach(src):
        seen = {src}; st = [src]
        while st:
            x = st.pop()
            for y in succ[x]:
                if y not in seen: seen.add(y); st.append(y)
        return seen
    R = reach(init)
    if set(S) - R: fails.append(f"r3 unreachable {set(S) - R}")
    for s in R:
        goal = term if term else {init}
        if not (reach(s) & goal) and s not in goal: fails.append(f"r6 liveness from {s}")
        pass
    for (i, frs, on, g, to, e) in tr:
        if any(s in term for s in frs) and "privilegedAndAudited" not in g: fails.append(f"r7 t{i}")
    edges = {f"{s}→{to}" for (i, frs, on, g, to, e) in tr for s in frs}
    star = {f"*→{t['to']}" for t in d["transitions"] if t["from"] == "*"}
    for p in d.get("proposed", []):
        if p not in edges | star: fails.append(f"r8 proposed edge {p} has no transition")
    a = d["approval"]
    if a["status"] != "requested" or a["approved_by"] != [] or a["record"] is not None: fails.append("r9 approval human fields")
    if sorted(a["required"]) != sorted(APPROVERS[m]): fails.append("r9 approvers")
    for si in d["invariants"]:
        if not re.fullmatch(r"SI-(0[1-9]|1[0-9]|2[01])", si): fails.append(f"r10 {si}")
    for h in d.get("hazards", []):
        if f"id: {h}" not in hazlog: fails.append(f"r10 hazard {h}")
    import os
    if not os.path.exists(path[:-5] + ".md"): fails.append("r1 .md missing")
    # undrawn edges listed? print edges for manual comparison
    print(m, "transitions", len(tr), "edges", sorted(edges))
    print(m, "FAILS:" if fails else "all rules 2-10 hold (r1 .md check included)", fails)
hz = open(sys.argv[1], encoding='utf-8').read()
for p in sys.argv[2:]: check(p, hz)
