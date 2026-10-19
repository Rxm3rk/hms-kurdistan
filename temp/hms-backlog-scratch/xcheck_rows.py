"""Throwaway independent cross-check of backlog.yaml against BUILD-PROMPT.md Appendix A.

Deliberately written without the hmstools.backlog code: raw bytes, CRLF stripped per line, a regex split
on unescaped pipes, and its own size arithmetic.
"""
import re
import sys
from collections import defaultdict

sys.stdout.reconfigure(encoding="utf-8")

import yaml

root = sys.argv[1]
raw = open(root + "/BUILD-PROMPT.md", "rb").read().decode("utf-8")
lines = [l.rstrip("\r") for l in raw.split("\n")]

a_start = lines.index("## Appendix A. The backlog of record (Kurdistan)")
a_end = next(i for i in range(a_start + 1, len(lines)) if lines[i].startswith("## "))

rows = []
section = group = None
for n in range(a_start, a_end):
    line = lines[n]
    m = re.match(r"### (A\.(\d+)) ([A-Z]+): ", line)
    if m:
        section, group = m.group(1), m.group(3)
        if int(m.group(2)) > 17:
            section = group = None
        continue
    if line.startswith("### "):
        section = group = None
        continue
    if section and line.startswith("| `"):
        cells = [c.strip().replace("\\|", "|") for c in re.split(r"(?<!\\)\|", line)[1:-1]]
        assert len(cells) == 6, (n + 1, cells)
        rows.append((n + 1, section, group, cells))

print("rows", len(rows))

def parse(cells):
    idc, title, size, phase, stance, scope = cells
    inner = idc.strip("`")
    part = None
    if " · part: " in inner:
        inner, part = inner.split(" · part: ")
    dagger = stance.endswith("†")
    stance_v = stance[:-1] if dagger else stance
    note = None
    k = scope.find(" · *")
    if k >= 0:
        assert scope.endswith("*"), scope
        note = scope[k + 4 : -1]
        scope_v = scope[:k]
    else:
        scope_v = scope
    return dict(id=inner, part=part, title=title, size=size, phase=phase, stance=stance_v,
                domain_level=dagger, scope=scope_v, kurdistan_note=note,
                placement_marked=bool(note and "[P]" in note))

data = yaml.safe_load(open(root + "/docs/program/backlog.yaml", encoding="utf-8"))
by_key = {}
for r in data:
    key = (r["id"], r.get("part"))
    assert key not in by_key, key
    by_key[key] = r

mismatch = 0
for line_no, section, group, cells in rows:
    p = parse(cells)
    p["section"], p["group"] = section, group
    r = by_key.pop((p["id"], p["part"]), None)
    if r is None:
        print("MISSING in yaml", line_no, p["id"], p["part"])
        mismatch += 1
        continue
    for k, v in p.items():
        if k == "part" and v is None:
            if "part" in r:
                print("unexpected part", p["id"])
                mismatch += 1
            continue
        if r.get(k) != v:
            print("MISMATCH", line_no, p["id"], k, repr(r.get(k)), "!=", repr(v))
            mismatch += 1
    if r["status"] != "todo" or r["tests"] or r["hazards"] or r["notes"]:
        print("hand field not default", p["id"])
print("extra in yaml:", list(by_key))
print("field mismatches:", mismatch)

ids = [parse(c)["id"] for _, _, _, c in rows if " · part: " not in c[0]]
print("feature ID rows", len(ids), "unique", len(set(ids)))
print("[P] rows:", [parse(c)["id"] for _, _, _, c in rows if parse(c)["placement_marked"]])
print("dagger rows:", len([1 for _, _, _, c in rows if parse(c)["domain_level"]]))
print("rows with escaped pipes:", [n for n, _, _, c in rows if "|" in "".join(c)])
print("[P] anywhere in Appendix A rows (raw):", [n for n, _, _, _ in rows if "[P]" in lines[n - 1]])

# Size arithmetic, independent of the tool.
EW = {"S": 3, "M": 8, "L": 20, "XL": 50}
def ew(size, face=False):
    s = size
    if s.startswith("≈"):
        return int(re.match(r"≈(\d+) ew$", s).group(1))
    m = re.match(r"^([A-Z+]+)(?: \((.*)\))?$", s)
    base = sum(EW[c] for c in m.group(1).split("+"))
    ann = m.group(2)
    if face or ann is None or ann.startswith("BP "):
        return base
    if re.fullmatch(r"[−-]\d+", ann):
        return base - int(ann[1:])
    if re.fullmatch(r"\+\d+ net", ann):
        return int(ann[1:].split()[0])
    raise ValueError(size)

cnt, tot, face = defaultdict(int), defaultdict(int), defaultdict(int)
for _, _, _, c in rows:
    p = parse(c)
    if p["part"] is None:
        cnt[p["phase"]] += 1
    tot[p["phase"]] += ew(p["size"])
    face[p["phase"]] += ew(p["size"], face=True)
order = ["R1", "R1.1", "R2a", "R2b", "R2.1", "P2", "P3", "DROPPED-K"]
for ph in order:
    print(f"{ph:10} ids {cnt[ph]:4} ew {tot[ph]:5} face {face[ph]:5}")
mvp = order[:5]
print("MVP ids", sum(cnt[p] for p in mvp), "ew", sum(tot[p] for p in mvp), "face", sum(face[p] for p in mvp))
print("All ids", sum(cnt.values()), "ew", sum(tot.values()), "face", sum(face.values()))
print("non-plain sizes:", sorted({p for _, _, _, c in rows for p in [c[2]] if p not in EW}))
