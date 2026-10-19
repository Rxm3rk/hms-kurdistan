import sys, os, subprocess, shutil, tempfile
sys.path.insert(0, sys.argv[1])
from pathlib import Path
from hmstools.statemachines.tests.harness import Sandbox, FIXTURES, TOY_TARGETS
from hmstools.statemachines.loader import load_spec_text, canonical_sha256, load_spec
from hmstools.statemachines import emit
MAIN = "backend/modules/adt/src/main/kotlin/hms/adt/domain/toylight"
TEST = "backend/modules/adt/src/test/kotlin/hms/adt/domain/toylight"
box = Sandbox()
def fresh():
    box.reset(); box.add("clean", "toy-light.yaml", "toy-light.md"); box.install_kotlin("toy-light"); r = box.generate(); assert r.ok, r.errors
def r12():
    return [e.split("rule 12: ",1)[1] for e in box.check().errors if "rule 12" in e]
def show(label, errs): print(f"[{label}] ok={not errs} {errs[:3]}")
# A sub-interface second implementor
fresh(); box.write(f"{MAIN}/Loose.kt", "package hms.adt.domain.toylight\n\ninterface Loose : ToyLightPredicates {\n    override fun lampIntact(facts: ToyLightFacts) = true\n}\n\nobject LooseGuards : Loose {\n    override fun powerAvailable(facts: ToyLightFacts) = true\n    override fun privilegedAndAudited(facts: ToyLightFacts) = true\n}\n")
show("A sub-interface implementor", r12())
fresh(); box.write(f"{MAIN}/Alias.kt", "package hms.adt.domain.toylight\n\ntypealias P = ToyLightPredicates\n\nobject AliasGuards : P {\n}\n")
show("B typealias implementor", r12())
fresh(); box.write(f"{MAIN}/Deleg.kt", "package hms.adt.domain.toylight\n\nobject Wrapped : ToyLightPredicates by ToyLightGuards\n")
show("B2 delegation implementor", r12())
fresh(); box.write(f"{MAIN}/Imp.kt", "package hms.adt.domain.toylight\n\nimport hms.adt.domain.toylight.ToyLightPredicates as Q\n\nobject Q2 : Q {\n}\n")
show("B3 import-alias implementor", r12())
# C test-name tricks
base = (FIXTURES / "kotlin" / "ToyLightGuardsTest.kt.txt").read_text(encoding="utf-8")
for label, old, new in [
  ("C1 empty context names predicate", 'test("powerAvailable holds on mains power") {\n            ToyLightGuards.powerAvailable(off.copy(mainsOn = true)) shouldBe true\n        }', 'context("powerAvailable") { }'),
  ("C2 bang-disabled test", 'test("powerAvailable holds on mains power")', 'test("!powerAvailable holds on mains power")'),
  ("C3 focus prefix on another test", 'context("lampIntact")', 'context("f:lampIntact")'),
  ("C4 enabled = variable", 'test("powerAvailable holds on mains power")', 'test("powerAvailable holds on mains power").config(enabled = off.mainsOn)'),
  ("C5 @EnabledIf annotation", 'class ToyLightGuardsTest :', '@EnabledIf(Never::class)\nclass ToyLightGuardsTest :'),
  ("C6 enabledIf (lower) control", 'test("powerAvailable holds on mains power")', 'test("powerAvailable holds on mains power").config(enabledIf = { false })'),
  ("C7 never-invoked helper", 'class ToyLightGuardsTest :', 'fun neverRun() = FunSpec({ test("powerAvailable x") { } })\n\nclass ToyLightGuardsTest :'),
]:
    fresh(); t = base.replace(old, new); assert t != base, label
    if label.startswith("C7"): t = t.replace('test("powerAvailable holds on mains power")', 'test("power holds")')
    box.write(f"{TEST}/ToyLightGuardsTest.kt", t); show(label, r12())
# D schema '$' trailing newline
fresh()
spec = box.specs / "toy-light.yaml"
txt = spec.read_text(encoding="utf-8").replace("{from: on, on: SwitchOff,", '{from: on, on: "SwitchOff\n",')
spec.write_text(txt, encoding="utf-8", newline="\n")
res = box.check(); print("[D trailing newline in command] ok=", res.ok, [e for e in res.errors if "rule 1" in e][:2])
g = box.generate(); print("   generate ok=", g.ok, g.errors[:2])
mf = (box.root / TOY_TARGETS["toy-light"].main_file).read_text(encoding="utf-8")
print("   emitted:", [l for l in mf.splitlines() if "SwitchOff" in l][:3])
# E version 1.0
fresh(); txt = spec.read_text(encoding="utf-8").replace("version: 1", "version: 1.0"); spec.write_text(txt, encoding="utf-8", newline="\n")
res = box.check(); print("[E version 1.0] check ok=", res.ok, res.errors[:2])
g = box.generate(); mf = (box.root / TOY_TARGETS["toy-light"].main_file).read_text(encoding="utf-8")
print("   VERSION line:", [l for l in mf.splitlines() if "const val VERSION" in l])
# G CRLF / BOM spec -> same sha and check passes
fresh(); raw = spec.read_bytes()
txt2 = spec.read_text(encoding="utf-8").replace('  powerAvailable: "mains or generator power is present"', '  powerAvailable: |\n    mains or generator\n    power is present\n  extra: >\n    folded\n    text')
for loader_name in ("lf", "crlf", "bom+crlf"):
    t = txt2
    b = t.encode("utf-8")
    if "crlf" in loader_name: b = b.replace(b"\n", b"\r\n")
    if "bom" in loader_name: b = b"\xef\xbb\xbf" + b
    spec.write_bytes(b)
    print(f"[G {loader_name}] sha", canonical_sha256(load_spec(spec))[:16])
spec.write_bytes(raw)
spec.write_bytes(raw.replace(b"\n", b"\r\n")); res = box.check(); print("[G2 CRLF spec, LF generated] check ok=", res.ok, res.errors[:1])
# also pure-python loader vs C loader
import yaml
print("CSafeLoader present:", hasattr(yaml, "CSafeLoader"))
# F escaping into Kotlin
fresh(); txt = spec.read_text(encoding="utf-8").replace('"mains or generator power is present"', "'a \"q\" \\ ${x} $y */ /* end\u2028'")
spec.write_text(txt, encoding="utf-8", newline="\n"); g = box.generate(); print("[F] gen ok", g.ok, g.errors[:1])
mf = (box.root / TOY_TARGETS["toy-light"].main_file).read_text(encoding="utf-8")
for l in mf.splitlines():
    if "POWER_AVAILABLE(" in l or ("q" in l and "*" in l): print("   ", repr(l))
# H created_by command also used on a transition
fresh(); txt = spec.read_text(encoding="utf-8").replace("created_by: [Install]", "created_by: [Install, SwitchOn]"); spec.write_text(txt, encoding="utf-8", newline="\n")
res = box.check(); print("[H created_by command with a transition] ok=", res.ok, [e for e in res.errors if "rule 11" not in e][:2])
# I approval: each single field
for old, new in [("status: requested", "status: approved"), ("approved_by: []", "approved_by: [X]"), ("record: null", "record: SO-1"), ("record: null", 'record: ""'), ("status: requested", "status: returned")]:
    fresh(); txt = spec.read_text(encoding="utf-8").replace(old, new); spec.write_text(txt, encoding="utf-8", newline="\n")
    res = box.check(); print(f"[I {new}] refused=", not res.ok, [e.split('rule 9: ')[1][:50] for e in res.errors if 'rule 9' in e])
    g = box.generate(); print("     generate refused=", not g.ok)
box.close()
