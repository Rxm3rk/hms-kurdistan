"""Structural check of docs/specs/state-machines/patient-context.yaml. Usage: python -I check_machine.py <root>"""
import itertools, sys
from pathlib import Path
import yaml
doc = yaml.safe_load((Path(sys.argv[1]) / "docs/specs/state-machines/patient-context.yaml").read_text(encoding="utf-8"))
B3 = ["machine", "version", "owner", "approval", "states", "terminal", "predicates", "transitions", "proposed", "invariants", "events"]
errors = []
if list(doc) != B3: errors.append(f"top-level keys {list(doc)} != B.3 {B3}")
ap = doc["approval"]
if ap["status"] != "requested" or ap["approved_by"] or ap["record"] is not None: errors.append("approval block filled")
states = set(doc["states"]); preds = doc["predicates"]
used = set(); pairs = set()
for t in doc["transitions"]:
    frm = t["from"]; frm = list(states - set(doc["terminal"])) if frm == "*" else (frm if isinstance(frm, list) else [frm])
    for g in t.get("guard", []):
        used.add(g)
        if g not in preds: errors.append(f"unknown predicate {g}")
    if t["to"] not in states: errors.append(f"unknown state {t['to']}")
    for f in frm:
        if f not in states: errors.append(f"unknown state {f}")
    if t["from"] == "*": pairs.add(f"*→{t['to']}")
    else:
        for f in frm: pairs.add(f"{f}→{t['to']}")
for p in preds:
    if p not in used: errors.append(f"predicate defined but unused: {p}")
if pairs != set(doc["proposed"]): errors.append(f"drawn pairs != proposed: extra {pairs-set(doc['proposed'])}, missing {set(doc['proposed'])-pairs}")
# Determinism: complement pairs are negations of one base predicate.
NEG = {"notReverifiedSinceLastChange": "reverifiedSinceLastChange", "contextStableBeyondWindow": "contextChangedWithinWindow",
       "identityNotDisputed": "identityDisputed", "bannerIdentityInvalid": "bannerIdentityValid",
       "reverificationNotHeldBySigner": "reverificationHeldBySigner", "contextChangedSinceSignOpened": "contextUnchangedSinceSignOpened",
       "samePatientRequested": "differentPatientRequested"}
groups = {}
for t in doc["transitions"]:
    frm = t["from"]; frm = sorted(states - set(doc["terminal"])) if frm == "*" else (frm if isinstance(frm, list) else [frm])
    for f in frm: groups.setdefault((f, t.get("on", t.get(True))), []).append(t)
base = sorted({NEG.get(p, p) for p in preds})
for (f, on), ts in groups.items():
    if len(ts) < 2: continue
    for vals in itertools.product([False, True], repeat=len(base)):
        env = dict(zip(base, vals))
        val = lambda p: (not env[NEG[p]]) if p in NEG else env[p]
        targets = {t["to"] for t in ts if all(val(g) for g in t.get("guard", []))}
        if len(targets) > 1:
            errors.append(f"nondeterministic {f} --{on}--> {targets}"); break
print(f"states={len(states)} predicates={len(preds)} transitions={len(doc['transitions'])} pairs={len(pairs)}")
print("\n".join(errors) or "machine structure OK")
sys.exit(1 if errors else 0)
