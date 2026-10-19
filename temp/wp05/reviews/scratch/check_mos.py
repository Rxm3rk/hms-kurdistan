import sys, re, itertools, os
import yaml
ROOT = sys.argv[1]
SM = os.path.join(ROOT, "docs", "specs", "state-machines")


class L(yaml.SafeLoader):
    pass


L.yaml_implicit_resolvers = {k: [(t, r) for t, r in v if t != 'tag:yaml.org,2002:bool']
                             for k, v in yaml.SafeLoader.yaml_implicit_resolvers.items()}
L.add_implicit_resolver('tag:yaml.org,2002:bool', re.compile(r'^(?:true|false)$'), list('tf'))
OTHER_BOOL = re.compile(r'^(?:y|Y|yes|Yes|YES|n|N|no|No|NO|True|TRUE|False|FALSE|on|On|ON|off|Off|OFF)$')
problems_loader = []


def construct_mapping(loader, node, deep=False):
    keys = set()
    for kn, vn in node.value:
        k = loader.construct_object(kn, deep=deep)
        if k in keys:
            problems_loader.append("duplicate key %r at line %d" % (k, kn.start_mark.line + 1))
        keys.add(k)
    return loader.construct_mapping(node, deep=deep)


L.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, construct_mapping)


def check_scalars(node):
    if isinstance(node, yaml.ScalarNode):
        if node.style is None and OTHER_BOOL.match(node.value or ""):
            return [(node.value, node.start_mark.line + 1)]
        return []
    out = []
    if isinstance(node, yaml.MappingNode):
        for k, v in node.value:
            out += check_scalars(v)
    elif isinstance(node, yaml.SequenceNode):
        for v in node.value:
            out += check_scalars(v)
    return out


APPROVERS = {
    "medication-administration": {"pharmacist-panel", "nurse-panel", "cso"},
    "order": {"pharmacist-panel", "nurse-panel", "cso"},
    "specimen": {"lab-cso"},
}
# Edges drawn by 8.4 and R11 10.2/10.3/10.4 (reviewer's reading)
DRAWN = {
    "medication-administration": {
        ("scheduled", "in-progress"), ("in-progress", "completed"), ("in-progress", "not-done"),
        ("in-progress", "stopped"), ("in-progress", "entered-in-error"),
    },
    "order": {
        ("draft", "active"), ("draft", "pending-verification"), ("draft", "revoked"),
        ("pending-verification", "active"), ("active", "on-hold"), ("on-hold", "active"),
        ("active", "completed"), ("active", "revoked"), ("active", "entered-in-error"),
        ("pending-verification", "revoked"), ("pending-verification", "entered-in-error"),
    },
    "specimen": {
        ("ordered", "label-printed"), ("label-printed", "collected"), ("collected", "in-transit"),
        ("in-transit", "received"), ("received", "in-process"), ("in-process", "resulted"),
        ("resulted", "stored"), ("resulted", "disposed"),
    },
}

hazlog = open(os.path.join(ROOT, "docs", "safety", "hazard-log.yaml"), encoding="utf-8").read()

for m in ["medication-administration", "order", "specimen"]:
    print("=" * 70)
    print(m)
    problems_loader.clear()
    path = os.path.join(SM, m + ".yaml")
    txt = open(path, encoding="utf-8").read()
    doc = yaml.load(txt, Loader=L)
    node = yaml.compose(txt, Loader=L)
    ob = check_scalars(node)
    errs = []
    if problems_loader:
        errs.append(("loader", problems_loader[:]))
    if ob:
        errs.append(("implicit-bool-like values", ob))
    if True in doc or any(True in t for t in doc["transitions"]):
        errs.append("boolean key found")
    if not os.path.exists(os.path.join(SM, m + ".md")):
        errs.append("md missing")
    if doc["machine"] != m:
        errs.append("machine name")
    states = doc["states"]
    S = set(states)
    term = set(doc["terminal"])
    init = doc.get("initial", states[0])
    if not term <= S:
        errs.append(("terminal not states", term - S))
    if init not in S:
        errs.append("initial")
    preds = set(doc["predicates"])
    effs = set(doc.get("effects", {}) or {})
    T = []
    for i, t in enumerate(doc["transitions"]):
        f = t["from"]
        if f == "*":
            fs = [s for s in states if s != t["to"]]
        elif isinstance(f, list):
            fs = f
        else:
            fs = [f]
        for s in fs:
            if s not in S:
                errs.append(("bad from", i, s))
        if t["to"] not in S:
            errs.append(("bad to", i, t["to"]))
        g = t.get("guard", []) or []
        e = t.get("effects", []) or []
        for p in g:
            if p not in preds:
                errs.append(("unknown predicate", i, p))
        for x in e:
            if x not in effs:
                errs.append(("unknown effect", i, x))
        T.append(dict(i=i, fs=fs, on=t["on"], g=set(g), e=e, to=t["to"], raw_from=f,
                      pflag=t.get("proposed", False)))
    usedp = set().union(*[t["g"] for t in T])
    usede = set(itertools.chain(*[t["e"] for t in T]))
    if preds - usedp:
        errs.append(("unused predicates", preds - usedp))
    if effs - usede:
        errs.append(("unused effects", effs - usede))
    for a, b in itertools.combinations(T, 2):
        if a["on"] != b["on"]:
            continue
        common = set(a["fs"]) & set(b["fs"])
        if common and (a["g"] <= b["g"] or b["g"] <= a["g"]):
            errs.append(("static nondeterminism", a["i"], b["i"], sorted(common)))
    adj = {s: set() for s in states}
    for t in T:
        for s in t["fs"]:
            adj[s].add(t["to"])

    def reach(src, a):
        seen = {src}
        st = [src]
        while st:
            x = st.pop()
            for y in a[x]:
                if y not in seen:
                    seen.add(y)
                    st.append(y)
        return seen
    R = reach(init, adj)
    if S - R:
        errs.append(("unreachable", S - R))
    for s in R:
        rs = reach(s, adj)
        if term:
            if not (rs & term):
                errs.append(("liveness", s))
        elif init not in rs:
            errs.append(("liveness-no-terminal", s))
    adj2 = {s: set() for s in states}
    for t in T:
        if t["on"] == "MarkEnteredInError":
            continue
        for s in t["fs"]:
            adj2[s].add(t["to"])
    noeie = [s for s in states if s not in term and not (reach(s, adj2) & term)]
    print("non-terminal states with no ordinary (non-EIE) path to terminal:", noeie)
    for t in T:
        for s in t["fs"]:
            if s in term and "privilegedAndAudited" not in t["g"]:
                errs.append(("terminal exit without privilegedAndAudited", t["i"], s))
    tedges = set()
    for t in T:
        if t["raw_from"] == "*":
            tedges.add(("*", t["to"]))
        for s in t["fs"]:
            tedges.add((s, t["to"]))
    prop = set(tuple(p.split("→")) for p in doc.get("proposed", []) or [])
    for p in prop:
        if p not in tedges:
            errs.append(("proposed edge not a transition", p))
    for t in T:
        for s in t["fs"]:
            e = (s, t["to"])
            isprop = t["pflag"] or e in prop or (t["raw_from"] == "*" and ("*", t["to"]) in prop)
            if e not in DRAWN[m] and not isprop:
                errs.append(("UNDRAWN edge not proposed", t["i"], e))
            if e in DRAWN[m] and isprop:
                print("  note: drawn edge marked proposed:", t["i"], t["on"], e)
    for e in DRAWN[m]:
        if e not in tedges:
            errs.append(("drawn edge missing", e))
    a = doc["approval"]
    if a["status"] != "requested" or a["approved_by"] != [] or a["record"] is not None:
        errs.append("approval human fields")
    if set(a["required"]) != APPROVERS[m] or len(a["required"]) != len(APPROVERS[m]):
        errs.append(("approvers", a["required"]))
    for si in doc["invariants"]:
        if not re.match(r"^SI-(0[1-9]|1[0-9]|2[01])$", si):
            errs.append(("si", si))
    for h in doc.get("hazards", []):
        if not re.search(r"id:\s*" + h + r"\b", hazlog):
            errs.append(("hazard missing", h))
    groups = {}
    for t in T:
        for s in t["fs"]:
            groups.setdefault((s, t["on"]), []).append(t["i"])
    alts = {k: v for k, v in groups.items() if len(v) > 1}
    print("alternatives:", alts)
    for k, v in alts.items():
        for x, y in itertools.combinations(v, 2):
            print("   ", k, "sym diff:", sorted(T[x]["g"] - T[y]["g"]), "|", sorted(T[y]["g"] - T[x]["g"]))
    print("transitions:", len(T), "predicates:", len(preds), "effects:", len(effs))
    print("ERRORS:", errs if errs else "none")
