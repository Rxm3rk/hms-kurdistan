import sys, json
sys.path.insert(0, r"C:\Users\Surface\.t3\worktrees\hospitalmanagementsystem\t3-406132fc\backend\satellites\document-renderer")
from tests.support import make_request, run_cli
import subprocess
from hms_docrender.env import load_runtime, subprocess_env
plain = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>t</title></head><body><p>Hello SYN</p></body></html>'
req = json.dumps(make_request(plain).to_json())
p = subprocess.run([sys.executable, "-I", "-m", "hms_docrender", "render", "--out", r"C:\Users\Surface\AppData\Local\Temp\wp08d.pdf"], input=req.encode(), capture_output=True, env=subprocess_env(load_runtime()), cwd=r"C:\Users\Surface\.t3\worktrees\hospitalmanagementsystem\t3-406132fc\backend\satellites\document-renderer")
print("rc", p.returncode, "stdout", p.stdout[-300:], "stderr-tail", p.stderr[-200:])
