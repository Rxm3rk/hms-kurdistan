import sys, json, re
try:
    import yaml
except ImportError:
    print("noyaml"); sys.exit(1)
root = sys.argv[1]
names = ["encounter","order","medication-administration","specimen","result","bed","appointment","credit-claim"]
out = {}
for n in names:
    d = yaml.safe_load(open(f"{root}/docs/specs/state-machines/{n}.yaml", encoding="utf-8"))
    states = d["states"]
    trs = d["transitions"]
    prop_edges = set(d.get("proposed") or [])
    nprop = 0; flagged = 0
    for t in trs:
        on = t.get("on", t.get(True))
        frm = t["from"]; to = t["to"]
        if frm == "*": edges = [f"*→{to}"]
        elif isinstance(frm, list): edges = [f"{s}→{to}" for s in frm]
        else: edges = [f"{frm}→{to}"]
        if t.get("proposed") is True or any(e in prop_edges for e in edges):
            nprop += 1
        if t.get("proposed") is True: flagged += 1
    cmds = list(dict.fromkeys([*(d.get("created_by") or []), *(t.get("on", t.get(True)) for t in trs)]))
    out[n] = dict(states=len(states), terminal=d["terminal"], initial=d.get("initial", states[0]),
                  transitions=len(trs), proposed_transitions=nprop, flagged=flagged, proposed_edges=len(prop_edges),
                  predicates=len(d["predicates"]), effects=len(d.get("effects") or {}), commands=len(cmds),
                  invariants=d["invariants"], approval_required=d["approval"]["required"], approval_status=d["approval"]["status"],
                  approved_by=d["approval"]["approved_by"], owner=d["owner"], version=d["version"])
for k,v in out.items(): print(k, json.dumps(v, ensure_ascii=False))
tot = {k: sum(v[k] for v in out.values()) for k in ["states","transitions","proposed_transitions","proposed_edges","predicates","effects","commands"]}
print("TOTAL", tot)
