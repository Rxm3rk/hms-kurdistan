"""Throwaway independent cross-check of the §21 work-package ID sets in backlog.yaml.

Method (deliberately crude and different from the tool): for each §21 table row, take the WP number and the
code spans that look like feature IDs in the WP cell and the Scope/Features cell only; for the Phase 1.1,
4, 5 and 6 paragraphs, every feature-ID code span in the first paragraph. Qualifiers are ignored here; the
script only compares which WPs name which IDs. It then prints every row's labels for review by eye.
"""
import re
import sys
from collections import defaultdict

import yaml

sys.stdout.reconfigure(encoding="utf-8")
root = sys.argv[1]
lines = [l.rstrip("\r") for l in open(root + "/BUILD-PROMPT.md", "rb").read().decode("utf-8").split("\n")]
s = lines.index("## 21. Build sequence: phases, work packages and exit criteria")
e = next(i for i in range(s + 1, len(lines)) if lines[i].startswith("## "))
ID = re.compile(r"`([A-Z][A-Z0-9]*(?:-[A-Z0-9]+[a-z]?)+)`")

expected = defaultdict(set)
phase = None
para_done = set()
for n in range(s, e):
    line = lines[n]
    m = re.match(r"### (Phase [\d.]+)", line)
    if m:
        phase = m.group(1)
        continue
    if line.startswith("| **"):
        cells = [c.strip() for c in line.split("|")[1:-1]]
        wp = "WP-" + re.match(r"\*\*(\d+\.\d+[a-z]?) ", cells[0]).group(1)
        for t in ID.findall(cells[0]) + ID.findall(cells[2]):
            expected[t].add(wp)
        continue
    if phase in ("Phase 1.1", "Phase 4", "Phase 5", "Phase 6") and line.strip() and phase not in para_done:
        for t in ID.findall(line):
            expected[t].add(phase)
        para_done.add(phase)

data = yaml.safe_load(open(root + "/docs/program/backlog.yaml", encoding="utf-8"))
got = defaultdict(set)
for r in data:
    for label in r["work_packages"]:
        got[r["id"]].add(label.split(" ")[0] if label.startswith("WP-") else " ".join(label.split(" ")[:2]))

problems = 0
for fid in sorted(set(expected) | set(got)):
    if expected[fid] != got[fid]:
        print("DIFF", fid, "expected", sorted(expected[fid]), "yaml", sorted(got[fid]))
        problems += 1
print("IDs named in §21:", len(expected), "; IDs with WPs in yaml:", len(got), "; set differences:", problems)
print()
for r in data:
    key = r["id"] + (f" · part: {r['part']}" if r.get("part") else "")
    if len(r["work_packages"]) > 1 or any("(" in w for w in r["work_packages"]):
        print(f"{key:28} {r['work_packages']}")
