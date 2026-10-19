import sys, os, subprocess, shutil, tempfile
sys.path.insert(0, sys.argv[1])
from pathlib import Path
from hmstools.statemachines.tests.harness import Sandbox
from hmstools.statemachines.tests.test_approval import RECORD
empty = Path(tempfile.mkdtemp()) / "cfg"; empty.write_text("")
os.environ.update({"GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": str(empty)})
box = Sandbox()
def git(*a, cwd=None):
    d = subprocess.run(["git", "-C", str(cwd or box.root), *a], capture_output=True, text=True); assert d.returncode == 0, d.stderr; return d.stdout
git("init", "-q")
for k, v in (("user.name","SYN"),("user.email","syn@example.invalid"),("commit.gpgsign","false"),("core.autocrlf","false")): git("config", k, v)
box.add("clean", "toy-light.yaml", "toy-light.md")
box.write("docs/safety/signoffs/SO-2026-0901.yaml", RECORD.format(id="SO-2026-0901", subject="toy-light", version=1))
git("add","-A"); git("commit","-q","-m","spec and record")
spec = box.specs/"toy-light.yaml"
spec.write_text(spec.read_text(encoding="utf-8").replace("mains or generator power is present","mains power is present"), encoding="utf-8", newline="\n")
git("add","-A"); git("commit","-q","-m","changed spec, no bump")
full = [e for e in box.check(only="toy-light").errors if "rule 13" in e]
print("full clone rule 13 errors:", len(full), full[:1])
dst = Path(tempfile.mkdtemp()) / "shallow"
subprocess.run(["git","clone","-q","--depth","1","file://"+box.root.as_posix(), str(dst)], check=True)
print("is shallow:", git("rev-parse","--is-shallow-repository", cwd=dst).strip())
from hmstools.statemachines.check import Paths, run_check
p = box.paths; p2 = Paths.for_root(dst); p2.build_prompt = p.build_prompt; p2.hazard_log = p.hazard_log; p2.targets = p.targets
shal = [e for e in run_check(p2, only="toy-light").errors if "rule 13" in e]
print("shallow clone rule 13 errors:", len(shal), shal[:1])
box.close()
