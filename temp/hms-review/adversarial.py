import sys
TOOLS = r"C:\Users\Surface\.t3\projects\hospitalmanagementsystem\tools"
sys.path.insert(0, TOOLS)
import yaml
from hmstools.safety.tests.harness import Sandbox, hazard, control
import hmstools.safety.check as chk

def report(name, result, expect_ok):
    tag = "OK        " if result.ok == expect_ok else "UNEXPECTED"
    print(f"[{tag}] {name}: ok={result.ok} (expected ok={expect_ok})")
    for e in result.errors[:3]: print("      ERR ", e[:230])
    for w in result.warnings[:2]: print("      WARN", w[:160])

box = Sandbox()
def write_record(relname, data):
    p = box.safety/"signoffs"/relname
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(yaml.safe_dump(data, sort_keys=False), encoding="utf-8")
REC = dict(id="SO-2099-0001", subject="HAZ-0001", field="residual_risk.accepted_by", role="SYN-TEST-ROLE", name="SYN-TEST-SIGNER-A", date="2099-01-01", statement="syn", decision="accepted", authentication={"method":"signed-git-commit"})
fill = lambda d: hazard(d,"HAZ-0001")["residual_risk"].update(accepted_by="SYN-TEST-SIGNER-A")
sm = box.root/"docs"/"specs"/"state-machines"

box.reset(); write_record("sub/SO-2099-0001.yaml", REC); box.mutate(fill)
report("E1 record in a subdirectory of signoffs/ does not count", box.run(), False)

box.reset(); r=dict(REC); r["field"]="residual_risk"; write_record("SO-2099-0001.yaml", r); box.mutate(fill)
report("E2 record for parent path 'residual_risk' authorises accepted_by", box.run(), True)

box.reset(); r=dict(REC); r.pop("decision"); write_record("SO-2099-0001.yaml", r); box.mutate(fill)
report("E3 record without any 'decision' authorises", box.run(), True)

box.reset(); sm.mkdir(parents=True, exist_ok=True)
(sm/"order.yaml").write_text("machine: order\napproval: {status: requested, required: [cso], approved_by: [], record: null, approvers: [SYN-TEST-PANEL-A], signed: SYN-TEST-PANEL-A}\nreviewed_by: SYN-TEST-PANEL-A\nconfirmed_by: SYN-TEST-PANEL-A\n", encoding="utf-8")
report("E5 approval under other key names (approvers/signed/reviewed_by/confirmed_by) passes", box.run(), True)

box.reset(); r=dict(REC); r.update(subject="HAZ-0003", field="cso_triage.by", decision="triaged", date="2099-01-02", name="SYN-TEST-SIGNER-B"); write_record("SO-2099-0001.yaml", r)
box.mutate(lambda d: hazard(d,"HAZ-0003").update(cso_triage={"by":"SYN-TEST-SIGNER-B","date":"2099-01-02"}))
report("E7 record for cso_triage.by only does not authorise cso_triage.date", box.run(), False)

box.reset(); (box.safety/"hazard-log.yaml").write_text("", encoding="utf-8")
report("E9 empty hazard-log.yaml fails", box.run(), False)
box.reset(); (box.safety/"hazard-log.yaml").write_text("- a\n- b\n", encoding="utf-8")
report("E10 hazard-log.yaml that is a YAML list fails", box.run(), False)

box.reset(); box.mutate(lambda d: control(d,"CTRL-0001-4").update(description="Room and bed may be used as identifiers when the wristband is unreadable."))
report("E11 weakened control description (CTRL-0001-4) passes unnoticed", box.run(), True)

box.reset(); box.mutate(lambda d: control(d,"CTRL-0001-4").update(state="verified", implemented_in=["nowhere/at/all"], verified_by=["PropertyTest:does-not-exist"]))
report("E13 'verified' with non-existent test id and path passes", box.run(), True)

box.reset(); sm.mkdir(parents=True, exist_ok=True)
(sm/"medication-administration.yaml").write_text("machine: medication-administration\napproval: {status: approved, required: [pharmacist-panel, nurse-panel, cso], approved_by: [SYN-TEST-PANEL-A], record: SO-2099-0007}\n", encoding="utf-8")
write_record("SO-2099-0007.yaml", dict(REC, id="SO-2099-0007", subject="medication-administration", field="approval.approved_by", name="SYN-TEST-PANEL-A", decision="approved"))
report("E15 one record satisfies an approval with required: [3 panels]", box.run(), True)

box.reset()
(box.safety/"other.yaml").write_text("hazards:\n  - id: HAZ-9999\n    status: accepted\n    residual_risk: {proposed: null, accepted_by: null}\n", encoding="utf-8")
report("E16 'status: accepted' in a non-canonical YAML under docs/safety passes", box.run(), True)

box.reset()
text = (box.safety/"hazard-log.yaml").read_text(encoding="utf-8")
assert "owner: empi-squad\n    cso_triage: {by: null, date: null}" in text
text = text.replace("owner: empi-squad\n    cso_triage: {by: null, date: null}", "owner: &who empi-squad\n    cso_triage: {by: *who, date: 2099-01-01}", 1)
(box.safety/"hazard-log.yaml").write_text(text, encoding="utf-8")
report("E17 alias-filled cso_triage.by is caught", box.run(), False)

box.reset(); sm.mkdir(parents=True, exist_ok=True)
(sm/"order.yaml").write_text("machine: order\napproval: {status: Requested, required: [cso], approved_by: [], record: null}\n", encoding="utf-8")
report("E18 approval.status 'Requested' (capitalised) is flagged (fail-closed)", box.run(), False)

box.reset(); write_record("SO-2099-0001.YAML", REC); box.mutate(fill)
report("E19 record with .YAML suffix is ignored -> filled field unbacked -> fails", box.run(), False)

box.reset(); (box.safety/"later.YAML").write_text("entries:\n  - id: BR-1\n    signed_by: SYN\n", encoding="utf-8")
report("E20 .YAML artefact under docs/safety with signed_by is not scanned", box.run(), True)

box.reset()
def strip(d):
    for c in hazard(d,"HAZ-0013")["controls"]: c.pop("covers", None)
box.mutate(strip)
report("E21 controls without 'covers' leave clauses uncovered -> fails", box.run(), False)

box.reset()
text = (box.safety/"hazard-log.yaml").read_text(encoding="utf-8")
assert "    status: open\n    owner: empi-squad\n" in text
text = text.replace("    status: open\n    owner: empi-squad\n", "    status: open\n    status: accepted\n    owner: empi-squad\n", 1)
(box.safety/"hazard-log.yaml").write_text(text, encoding="utf-8")
report("E22 duplicate 'status' key inside a hazard is rejected", box.run(), False)

box.reset(); box.mutate(lambda d: control(d,"CTRL-0005-10").update(covers=["h"]))
report("E24 dropping clause d from CTRL-0005-10 covers still passes (d covered elsewhere)", box.run(), True)

box.reset(); box.mutate(lambda d: hazard(d,"HAZ-0005").update(invariant_text=hazard(d,"HAZ-0005")["invariant_text"].replace("10×/100×","10×")))
report("E25 removing '/100×' from SI-05 invariant_text is caught", box.run(), False)

box.reset(); box.mutate(lambda d: [c.update(implemented_in=["x"], verified_by=["PropertyTest:y"]) for c in hazard(d,"HAZ-0009")["controls"]])
r = box.run(); report("E26 planned controls with evidence lists: warning only", r, True)

box.reset()
sys.modules["jsonschema"] = None
try:
    chk.run_check(box.paths); print("[UNEXPECTED] missing jsonschema did not raise")
except chk.EnvironmentProblem as e:
    print("[OK        ] E23 missing jsonschema -> EnvironmentProblem (exit 2):", str(e)[:120])
box.close()
