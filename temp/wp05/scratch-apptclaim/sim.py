"""Rough P7 coverage simulation of a machine's YAML with independent predicate probabilities (scratch, not evidence).

Usage: sim.py <yaml> <probs.json> [sequences] [runs]
probs.json: {"p": {predicate: prob}, "complement": {pred: of_pred}, "partition": {"var": {pred: prob,...}}}
"""
import json
import random
import sys

import yaml

spec = yaml.safe_load(open(sys.argv[1], encoding="utf-8"))
cfg = json.load(open(sys.argv[2], encoding="utf-8"))
sequences = int(sys.argv[3]) if len(sys.argv) > 3 else 1000
runs = int(sys.argv[4]) if len(sys.argv) > 4 else 20
states = spec["states"]
transitions = []
for i, t in enumerate(spec["transitions"]):
    frm = t["from"]
    if frm == "*":
        frm = [s for s in states if s != t["to"]]
    elif isinstance(frm, str):
        frm = [frm]
    transitions.append((i, set(frm), str(t.get("on", t.get(True))), t.get("guard", []) or [], t["to"]))
commands = sorted({t[2] for t in transitions} | set(spec["created_by"]))
applicable = {s: sorted({t[2] for t in transitions if s in t[1]}) for s in states}


def draw(rng):
    holds = {}
    for name, p in cfg["p"].items():
        holds[name] = rng.random() < p
    for name, of in cfg.get("complement", {}).items():
        holds[name] = not holds[of]
    for var, options in cfg.get("partition", {}).items():
        r = rng.random()
        acc = 0.0
        chosen = None
        for pred, p in options.items():
            acc += p
            if r < acc and chosen is None:
                chosen = pred
        for pred in options:
            holds[pred] = pred == chosen
    for name, expr in cfg.get("derived", {}).items():
        holds[name] = eval(expr, {}, holds)
    return holds


missing = {i: 0 for i in range(len(transitions))}
mins = {i: 10**9 for i in range(len(transitions))}
for run in range(runs):
    rng = random.Random(run)
    fired = [0] * len(transitions)
    for _ in range(sequences):
        state = spec["initial"]
        for _ in range(rng.randint(1, 32)):
            pool = applicable[state] if applicable[state] and rng.random() < 0.85 else commands
            cmd = rng.choice(pool)
            h = draw(rng)
            cands = [t for t in transitions if state in t[1] and t[2] == cmd]
            ok = [t for t in cands if all(h[g] for g in t[3])]
            if len(ok) > 1:
                print("AMBIGUOUS", state, cmd, [t[0] for t in ok])
                sys.exit(1)
            if ok:
                fired[ok[0][0]] += 1
                state = ok[0][4]
    for i, n in enumerate(fired):
        if n == 0:
            missing[i] += 1
        mins[i] = min(mins[i], n)
print("runs", runs, "sequences", sequences)
for i in range(len(transitions)):
    if missing[i] or mins[i] < 5:
        print(f"t{i} {transitions[i][2]} {sorted(transitions[i][1])}->{transitions[i][4]}: missing in {missing[i]} runs, min fired {mins[i]}")
print("ok")
