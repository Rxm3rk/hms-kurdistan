import sys
import sys, yaml
sys.stdout.reconfigure(encoding="utf-8")
root = sys.argv[1]
hl = yaml.safe_load(open(root + "/docs/safety/hazard-log.yaml", encoding="utf-8"))
bl = yaml.safe_load(open(root + "/docs/program/backlog.yaml", encoding="utf-8"))
feat = {f["id"]: f for f in bl}
for h in hl["hazards"]:
    if h["id"] > "HAZ-0021": continue
    print("=====", h["id"], h["invariants"], h["seeded_hazard"], "|", h["enforced_in"], "| modules", h.get("modules"))
    print("  clauses:", [(c["id"], c["text"][:70]) for c in h["invariant_clauses"]])
    for f in h["features"]:
        x = feat.get(f)
        print("   ", f, x and x["work_packages"], x and x["title"])
    for c in h["controls"]:
        pv = [p for p in c["planned_verification"] if p.startswith("PropertyTest:")]
        if pv: print("   ctl", c["id"], c["covers"], pv)
