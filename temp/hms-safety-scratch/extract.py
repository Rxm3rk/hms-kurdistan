import sys
import json, re, sys
sys.stdout.reconfigure(encoding="utf-8")
text = open(sys.argv[1], encoding="utf-8").read().splitlines()
def section(start, end):
    out=[]; on=False
    for line in text:
        if line.startswith(start): on=True; continue
        if on and line.startswith(end): break
        if on: out.append(line)
    return out
for line in section("### 2.1 ", "### 2.2 "):
    m = re.match(r"^\| (\d\d) \| (.*) \| (.*) \| (.*) \|$", line)
    if m:
        print("SI-"+m.group(1), json.dumps(m.group(2), ensure_ascii=False))
        print("   enforced:", json.dumps(m.group(3), ensure_ascii=False), " hazard:", m.group(4))
for line in section("### 2.4 ", "---"):
    if line.startswith("H1 "):
        print(line)
sac = {}
for line in section("### 18.4 ", "### 18.5 "):
    m = re.match(r"^\| (\d\d) \| (.*) \| (.*) \|$", line)
    if m:
        sis = re.findall(r"SI-\d\d", m.group(3))
        for s in sis: sac.setdefault(s, []).append("SAC-"+m.group(1))
        if not sis: sac.setdefault("none", []).append("SAC-"+m.group(1))
print(json.dumps(sac, indent=0))
