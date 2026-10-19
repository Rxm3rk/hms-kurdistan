import re, sys
from pathlib import Path
import yaml
REPO = Path(r"C:\Users\Surface\.t3\projects\hospitalmanagementsystem")
lines = (REPO/"BUILD-PROMPT.md").read_text(encoding="utf-8").splitlines()
rows = {}
for ln in lines[185:230]:
    m = re.match(r"^\| (\d\d) \| (.*) \| (.*) \| (.*) \|$", ln)
    if m: rows[f"SI-{m.group(1)}"] = (m.group(2), m.group(3), m.group(4))
print("rows parsed:", len(rows))
doc = yaml.safe_load((REPO/"docs/safety/hazard-log.yaml").read_text(encoding="utf-8"))
for h in doc["hazards"]:
    if "invariant_text" in h:
        si = h["invariants"][0]
        t, e, hz = rows[si]
        covered = {cv for c in h["controls"] for cv in c.get("covers", [])}
        rebuilt = " ".join(" ".join(c["text"].split()) for c in h["invariant_clauses"])
        print(f"{si} {h['id']} text_eq={h['invariant_text']==t} enforced_eq={h['enforced_in']==e} seeded={h['seeded_hazard']} plan={re.findall(r'H\d+', hz)} clauses={len(h['invariant_clauses'])} rebuild={rebuilt==' '.join(t.split())} controls={len(h['controls'])} uncovered={[c['id'] for c in h['invariant_clauses'] if c['id'] not in covered]} preamble={'preamble' in covered} sac={h.get('sac')} invariants={h['invariants']}")
    else:
        print(f"(no quote) {h['id']} invariants={h['invariants']} label={h.get('sensitivity_label')} seeded={h['seeded_hazard']} controls={len(h['controls'])}")
print("seeded ids:", [s["id"] for s in doc["seeded_hazards"]])
print("statuses:", {h["status"] for h in doc["hazards"]})
print("risk_vocab status:", doc["risk_vocabulary"]["status"], doc["risk_vocabulary"]["approval"])
print("all controls planned:", all(c["state"]=="planned" for h in doc["hazards"] for c in h["controls"]), "| implemented_in & verified_by all empty:", all(not c["implemented_in"] and not c["verified_by"] for h in doc["hazards"] for c in h["controls"]))
print("cso_triage values:", {(h["cso_triage"]["by"], h["cso_triage"]["date"]) for h in doc["hazards"]})
print("accepted_by values:", {h["residual_risk"]["accepted_by"] for h in doc["hazards"]}, "| proposed:", {str(h["residual_risk"]["proposed"]) for h in doc["hazards"]})
print("total controls:", sum(len(h["controls"]) for h in doc["hazards"]))
# any approval-ish key anywhere with a value
def walk(n, path=""):
    if isinstance(n, dict):
        for k, v in n.items():
            p = f"{path}.{k}" if path else k
            if any(s in str(k).lower() for s in ("approv","accept","sign","triag","by")) and v not in (None, [], "", {}):
                print("FILLED-ISH:", p, repr(v)[:80])
            walk(v, p)
    elif isinstance(n, list):
        for i, v in enumerate(n): walk(v, f"{path}[{i}]")
walk(doc)
