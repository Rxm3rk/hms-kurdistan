import sys, json, copy
from collections import Counter
from pathlib import Path
TOOLS = r"C:\Users\Surface\.t3\projects\hospitalmanagementsystem\tools"
sys.path.insert(0, TOOLS)
import yaml, jsonschema
from hmstools.safety import check as chk
REPO = Path(r"C:\Users\Surface\.t3\projects\hospitalmanagementsystem")
print("jsonschema", jsonschema.__version__, "| pyyaml", yaml.__version__, "| libyaml:", hasattr(yaml, "CSafeLoader"))
schema = json.loads((REPO/"docs/safety/hazard-log.schema.json").read_text(encoding="utf-8"))
doc = chk._normalise(yaml.safe_load((REPO/"docs/safety/hazard-log.yaml").read_text(encoding="utf-8")))
cls = jsonschema.validators.validator_for(schema)
raw = cls(schema, format_checker=cls.FORMAT_CHECKER)
eff = cls(chk._inline_local_refs(schema), format_checker=cls.FORMAT_CHECKER)
def errs(v, d): return sorted(f"{'/'.join(map(str,e.absolute_path))}: {e.message[:70]}" for e in v.iter_errors(d))
cases = {"real": doc}
def mut(name, fn):
    d = copy.deepcopy(doc); fn(d); cases[name] = d
mut("extra key on hazard", lambda d: d["hazards"][0].update(approved=True))
mut("accepted_by int", lambda d: d["hazards"][0]["residual_risk"].update(accepted_by=5))
mut("bad seeded id", lambda d: d["hazards"][0].update(seeded_hazard="X9"))
mut("bad cover id", lambda d: d["hazards"][0]["controls"][0].update(covers=["A"]))
mut("triage date pattern", lambda d: d["hazards"][0]["cso_triage"].update(date="2026-13-45x"))
mut("null seeded without note", lambda d: (d["hazards"][17].update(seeded_hazard=None), d["hazards"][17].pop("seeded_hazard_note")))
mut("empty clauses", lambda d: d["hazards"][0].update(invariant_clauses=[]))
mut("bad test name", lambda d: d["hazards"][0]["controls"][0].update(verified_by=["no-kind"]))
mut("approval status enum", lambda d: d["risk_vocabulary"]["approval"].update(status="maybe"))
mut("owner pattern", lambda d: d["hazards"][0].update(owner="empi"))
mut("extra key in control", lambda d: d["hazards"][0]["controls"][0].update(signed_by="X"))
mut("extra key in residual_risk", lambda d: d["hazards"][0]["residual_risk"].update(signed_by="X"))
mut("extra key in cso_triage", lambda d: d["hazards"][0]["cso_triage"].update(approved_by="X"))
mut("matrix level typo", lambda d: d["risk_vocabulary"]["matrix"]["major"].update(frequent="very_high"))
mut("invariant_text without clauses", lambda d: d["hazards"][0].pop("invariant_clauses"))
for name, d in cases.items():
    a, b = errs(raw, d), errs(eff, d)
    flag = "" if a == b else "  <-- DIFFER"
    print(f"{name}: raw={len(a)} inlined={len(b)}{flag}")
    if a != b:
        print("   raw-only:", [x for x in a if x not in b][:3]); print("   inl-only:", [x for x in b if x not in a][:3])
ctrls = [c for h in doc["hazards"] for c in h["controls"]]
print("controls:", len(ctrls), "| without risk_control_option:", sum(1 for c in ctrls if "risk_control_option" not in c),
      "| SI-entry controls without covers:", sum(1 for h in doc["hazards"] if "invariant_text" in h for c in h["controls"] if "covers" not in c))
print("type counts:", dict(Counter(c["type"] for c in ctrls)))
print("type->risk_control_option:", dict(Counter((c["type"], c.get("risk_control_option")) for c in ctrls)))
print("planned_verification entries:", sum(len(c["planned_verification"]) for c in ctrls), "| controls with [HUMAN] in planned_verification:", sum(1 for c in ctrls if any("HUMAN" in p for p in c["planned_verification"])))
