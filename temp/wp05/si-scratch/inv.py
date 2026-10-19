import sys, yaml
sys.stdout.reconfigure(encoding="utf-8")
hl = yaml.safe_load(open(sys.argv[1] + "/docs/safety/hazard-log.yaml", encoding="utf-8"))
from collections import defaultdict
m = defaultdict(list)
for h in hl["hazards"]:
    for si in h.get("invariants") or []:
        m[si].append(h["id"])
for k in sorted(m): print(k, m[k])
for h in hl["hazards"]:
    if h["id"] >= "HAZ-0022":
        pv = [p for c in h["controls"] for p in c["planned_verification"] if p.startswith("PropertyTest:")]
        print(h["id"], h["invariants"], h["title"][:60], len(pv))
