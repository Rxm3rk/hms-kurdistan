"""Independent scratch parser for the WP-0.1 backlog review. Read-only; writes nothing."""
import difflib
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")
ROOT = Path(sys.argv[1])


def lines_of(rel):
    return (ROOT / rel).read_bytes().decode("utf-8").replace("\r\n", "\n").split("\n")


BP = lines_of("BUILD-PROMPT.md")
K = lines_of("BLUEPRINT-KURDISTAN.md")
OQ = lines_of("docs/program/OPEN-QUESTIONS.md")
ASSUM = lines_of("docs/program/ASSUMPTIONS.md")
WPS = lines_of("docs/program/WORK-PACKAGES.md")
BMD = lines_of("docs/program/BACKLOG.md")
import yaml  # noqa: E402

YAML = yaml.safe_load((ROOT / "docs/program/backlog.yaml").read_text(encoding="utf-8"))


def cells(line):
    s = line.strip()
    assert s.startswith("|"), line
    out, buf, i = [], [], 1
    while i < len(s):
        c = s[i]
        if c == "\\" and i + 1 < len(s) and s[i + 1] == "|":
            buf.append("|")
            i += 2
            continue
        if c == "|":
            out.append("".join(buf).strip())
            buf = []
        else:
            buf.append(c)
        i += 1
    if "".join(buf).strip():
        out.append("".join(buf).strip())
    return out


ID_RE = re.compile(r"^[A-Z]+(?:-[A-Z0-9]+[a-z]?)+$")
SIZES = {"S": 3, "M": 8, "L": 20, "XL": 50}


def ew_of(size):
    m = re.match(r"^≈(\d+) ew$", size)
    if m:
        n = int(m.group(1))
        return n, n
    m = re.match(r"^((?:XL|L|M|S)(?:\+(?:XL|L|M|S))*)(?: \((.*)\))?$", size)
    if not m:
        raise ValueError(f"size {size!r}")
    face = sum(SIZES[c] for c in m.group(1).split("+"))
    ann = m.group(2)
    if ann is None:
        return face, face
    mm = re.match(r"^[−-](\d+)$", ann)
    if mm:
        return face - int(mm.group(1)), face
    mm = re.match(r"^\+(\d+) net$", ann)
    if mm:
        return int(mm.group(1)), face
    if ann.startswith("BP "):
        return face, face
    raise ValueError(f"annotation {ann!r} in {size!r}")


# ---------------------------------------------------------------- Appendix A
a_start = next(i for i, l in enumerate(BP) if l.startswith("## Appendix A."))
a_end = next(i for i in range(a_start + 1, len(BP)) if BP[i].startswith("## "))
a18_line = next(i for i in range(a_start, a_end) if BP[i].startswith("### A.18 "))

rows = []  # dicts
sections = []
current = None
leading_space_rows = []
i = a_start
while i < a_end:
    l = BP[i]
    m = re.match(r"^### A\.(\d+) ([A-Z]+): (.*)$", l)
    if l.startswith("### "):
        current = (f"A.{m.group(1)}", m.group(2), m.group(3).strip()) if m else None
        if m:
            sections.append(current)
        i += 1
        continue
    if l.startswith("| ID | Feature |") and i + 1 < a_end and BP[i + 1].startswith("|---"):
        hdr = cells(l)
        j = i + 2
        while j < a_end and BP[j].lstrip().startswith("|"):
            if not BP[j].startswith("|"):
                leading_space_rows.append(j + 1)
            c = cells(BP[j])
            assert len(c) == 6, (j + 1, c)
            idc = c[0]
            assert idc.startswith("`") and idc.endswith("`"), (j + 1, idc)
            inner = idc[1:-1]
            pm = re.match(r"^(\S+) · part: (.+)$", inner)
            fid, part = (pm.group(1), pm.group(2)) if pm else (inner, None)
            assert ID_RE.match(fid), (j + 1, fid)
            sm = re.match(r"^([BIP](?:\+[BIP])*)(†?)$", c[4])
            assert sm, (j + 1, c[4])
            scope_cell = c[5]
            k = scope_cell.find(" · *")
            if k >= 0:
                scope, note = scope_cell[:k], scope_cell[k + 4 :]
                assert note.endswith("*") and "*" not in note[:-1], (j + 1, note)
                note = note[:-1]
            else:
                scope, note = scope_cell, None
            ew, face = ew_of(c[2])
            rows.append(
                dict(
                    line=j + 1,
                    raw=BP[j],
                    section=current[0] if current else None,
                    group=current[1] if current else None,
                    id=fid,
                    part=part,
                    key=fid if part is None else f"{fid} · part: {part}",
                    title=c[1],
                    size=c[2],
                    phase=c[3],
                    stance=sm.group(1),
                    dagger=sm.group(2) == "†",
                    scope=scope,
                    note=note,
                    p_mark=(note is not None and "[P]" in note) or "[P]" in scope,
                    ew=ew,
                    face=face,
                    hdr=tuple(hdr),
                )
            )
            j += 1
        i = j
        continue
    i += 1

print("=== 1. INDEPENDENT COUNT ===")
print("feature-table sections:", len(sections), [s[0] for s in sections])
print("headers seen:", Counter(r["hdr"] for r in rows))
print("rows parsed:", len(rows), "part rows:", sum(1 for r in rows if r["part"]))
ids = [r["id"] for r in rows if r["part"] is None]
print("unique feature IDs (non-part rows):", len(set(ids)))
print("duplicate IDs among non-part rows:", [k for k, n in Counter(ids).items() if n > 1])
print("part rows whose base ID is not a feature:", [r["key"] for r in rows if r["part"] and r["id"] not in ids])
print("rows beginning with whitespace (parser-robustness probe):", leading_space_rows)
print("ID/group mismatches:", [(r["line"], r["id"], r["group"]) for r in rows if r["id"].split("-")[0] != r["group"]])
# sweep for backticked IDs anywhere in A.1-A.17 region that are not row IDs
tok = re.compile(r"`([A-Z]+(?:-[A-Z0-9]+[a-z]?)+)`")
region = "\n".join(BP[a_start:a18_line])
swept = set(tok.findall(region))
row_ids = set(ids)
print("backticked IDs in A.1-A.17 region not a row ID:", sorted(swept - row_ids))
print("row IDs not found by sweep:", sorted(row_ids - swept))
# IDs mentioned anywhere else in BUILD-PROMPT (outside Appendix A) that are not in Appendix A
whole = "\n".join(BP[:a_start] + BP[a_end:])
elsewhere = set(tok.findall(whole))
print("backticked ID-like tokens elsewhere in BUILD-PROMPT not in Appendix A:", sorted(elsewhere - row_ids))

# ---------------------------------------------------------------- A.18 own parse
a18 = {}
j = a18_line + 1
while not BP[j].startswith("|"):
    j += 1
j += 2
while BP[j].startswith("|"):
    c = [x.replace("**", "").strip() for x in cells(BP[j])]
    a18[c[0]] = (int(c[1]), int(c[2]))
    j += 1
PHASES = ["R1", "R1.1", "R2a", "R2b", "R2.1", "P2", "P3", "DROPPED-K"]
mine = {}
for p in PHASES:
    inp = [r for r in rows if r["phase"] == p]
    mine[p] = (sum(1 for r in inp if r["part"] is None), sum(r["ew"] for r in inp), sum(r["face"] for r in inp))
mvp_ph = PHASES[:5]
mine["MVP (R1 to R2.1)"] = tuple(sum(mine[p][k] for p in mvp_ph) for k in range(3))
mine["All"] = tuple(sum(mine[p][k] for p in PHASES) for k in range(3))
print("\n--- A.18 vs my count (ids, ew annotated, ew face) ---")
for label, (cnt, ew) in a18.items():
    m = mine[label]
    flag = "" if (cnt, ew) == (m[0], m[1]) else "  <-- DIFF"
    print(f"{label:18} A.18 {cnt:4} {ew:5} | mine {m[0]:4} {m[1]:5} (face {m[2]:5}){flag}")
print("rows with non-plain sizes:", [(r["key"], r["size"], r["ew"], r["face"]) for r in rows if r["ew"] != r["face"] or "+" in r["size"] or "(" in r["size"] or "≈" in r["size"]])

# ---------------------------------------------------------------- compare with backlog.yaml
print("\n=== YAML vs source ===")
ykeys = [(r["id"] if r.get("part") is None else f"{r['id']} · part: {r['part']}") for r in YAML]
print("yaml rows:", len(YAML), "unique keys:", len(set(ykeys)), "dups:", [k for k, n in Counter(ykeys).items() if n > 1])
src = {r["key"]: r for r in rows}
ymap = dict(zip(ykeys, YAML))
print("in source not yaml:", sorted(set(src) - set(ymap)))
print("in yaml not source:", sorted(set(ymap) - set(src)))
print("source order == yaml order:", [r["key"] for r in rows] == ykeys)
field_diffs = []
for key, r in src.items():
    y = ymap.get(key)
    if y is None:
        continue
    pairs = [
        ("title", r["title"], y.get("title")),
        ("size", r["size"], y.get("size")),
        ("phase", r["phase"], y.get("phase")),
        ("stance", r["stance"], y.get("stance")),
        ("domain_level", r["dagger"], y.get("domain_level")),
        ("scope", r["scope"], y.get("scope")),
        ("kurdistan_note", r["note"], y.get("kurdistan_note")),
        ("placement_marked", r["p_mark"], y.get("placement_marked")),
        ("group", r["group"], y.get("group")),
        ("section", r["section"], y.get("section")),
        ("id", r["id"], y.get("id")),
        ("part", r["part"], y.get("part")),
    ]
    for name, a, b in pairs:
        if a != b:
            field_diffs.append((key, name, a, b))
print("field differences across all rows:", len(field_diffs))
for d in field_diffs:
    print("  ", d)
print("yaml statuses:", Counter(r.get("status") for r in YAML))
print("yaml rows with non-empty tests/hazards/notes:", [(k, y.get("tests"), y.get("hazards"), y.get("notes")) for k, y in ymap.items() if y.get("tests") or y.get("hazards") or y.get("notes")])
print("yaml rows with unknown fields:", [(k, sorted(set(y) - {"id","part","group","section","title","size","phase","phase","stance","domain_level","scope","kurdistan_note","placement_marked","status","work_packages","tests","hazards","notes"})) for k, y in ymap.items() if set(y) - {"id","part","group","section","title","size","phase","stance","domain_level","scope","kurdistan_note","placement_marked","status","work_packages","tests","hazards","notes"}])
print("yaml rows missing fields:", [k for k, y in ymap.items() if not {"id","group","section","title","size","phase","stance","domain_level","scope","kurdistan_note","placement_marked","status","work_packages","tests","hazards","notes"} <= set(y)])
print("yaml rows with empty work_packages:", [(k, y["phase"]) for k, y in ymap.items() if not y.get("work_packages")])

# ---------------------------------------------------------------- compare with BACKLOG.md
print("\n=== BACKLOG.md vs source ===")
g_start = next(i for i, l in enumerate(BMD) if l.startswith("## A.1 "))
mdkeys = []
for l in BMD[g_start:]:
    m = re.match(r"^\| `([^`]+)` \|", l)
    if m:
        mdkeys.append(m.group(1))
print("md rows:", len(mdkeys), "unique:", len(set(mdkeys)), "dups:", [k for k, n in Counter(mdkeys).items() if n > 1])
print("in source not md:", sorted(set(src) - set(mdkeys)))
print("in md not source:", sorted(set(mdkeys) - set(src)))
print("md order == yaml order:", mdkeys == ykeys)
# md cell check: size/phase/stance/status per row
md_rows = {}
for l in BMD[g_start:]:
    m = re.match(r"^\| `([^`]+)` \|", l)
    if m:
        md_rows[m.group(1)] = cells(l)
md_diffs = []
for key, r in src.items():
    c = md_rows.get(key)
    if not c:
        continue
    st = r["stance"] + ("†" if r["dagger"] else "")
    exp = [f"`{key}`", r["title"].replace("|", "\\|"), r["size"], r["phase"], st]
    got = c[:5]
    if exp != got:
        md_diffs.append((key, exp, got))
print("md field differences (id,title,size,phase,stance):", md_diffs)
print("md statuses:", Counter(c[5] for c in md_rows.values()))

# ---------------------------------------------------------------- my 10 chosen rows
print("\n=== 2. MY TEN ROWS (source raw line, then yaml record) ===")
CHOSEN = ["PLT-SITE-01", "TRU-REG-01", "ACC-ID-02", "CLN-CDS-02", "NUR-FLW-01", "DX-BB-KRI-01", "DEV-SDC-01", "SPC-MAT-01", "RCM-SCH-01 · part: scheme", "ERP-IMP-01", "OPS-RTL-01", "INT-SEAM-01", "AI-PAT-01", "DFD-REC-01", "IMP-MIG-01", "KRI-ID-01", "MED-KRI-01"]
for key in CHOSEN:
    r = src[key]
    y = ymap[key]
    print(f"\n[{key}] line {r['line']} {r['section']}")
    print("  SRC:", r["raw"])
    print("  YML:", json.dumps({k: y[k] for k in ("id","part","title","size","phase","stance","domain_level","scope","kurdistan_note","placement_marked","status","work_packages","tests","hazards","notes") if k in y}, ensure_ascii=False))

# ---------------------------------------------------------------- placements vs OPEN-QUESTIONS (c)
print("\n=== 2b/5. NOTES signalling a difference from K vs OPEN-QUESTIONS section (c) ===")
c_start = next(i for i, l in enumerate(OQ) if l.startswith("## (c)"))
d_start = next(i for i, l in enumerate(OQ) if l.startswith("## (d)"))
oq_c_ids = {}
for l in OQ[c_start:d_start]:
    m = re.match(r"^\| (OQ-\d+) \| `([^`]+)`", l)
    if m:
        oq_c_ids.setdefault(m.group(2), []).append(m.group(1))
# section (d) IDs with their own OQ items (OQ-088..090)
oq_d_ids = set(re.findall(r"### OQ-\d+: `([A-Z][A-Z0-9-]+)`", "\n".join(OQ[d_start:])))
b_start = next(i for i, l in enumerate(OQ) if l.startswith("## (b)"))
a20_oq_ids = set(tok.findall("\n".join(OQ[b_start:c_start])))
print("IDs tracked in (c):", len(oq_c_ids), " in (d) with own item:", sorted(oq_d_ids), " mentioned in (b):", sorted(a20_oq_ids))
kw = re.compile(r"Placed |\[P\]|Conflict:|nferred|not addressed in K|unaddressed in K|Not in K|K §4\.3|K §4\.1|K §4\.2|unstated|K §9\.1 assumes|K drops|K →")
flagged = [r for r in rows if r["note"] and kw.search(r["note"])]
print("rows whose note signals a placement/difference (keyword heuristic):", len(flagged))
for r in flagged:
    where = []
    if r["id"] in oq_c_ids:
        where.append("c:" + ",".join(oq_c_ids[r["id"]]))
    if r["id"] in oq_d_ids:
        where.append("d")
    if r["id"] in a20_oq_ids:
        where.append("b/A.20")
    print(f"  {'OK ' if where else 'NOT TRACKED'} {r['id']:14} {r['phase']:9} note={r['note']!r} -> {where}")
print("\nIDs in (c) whose note has none of the keywords:", [i for i in oq_c_ids if i in src and not (src[i]['note'] and kw.search(src[i]['note']))])
print("[P] rows:", [r["id"] for r in rows if r["p_mark"]], "-> tracked:", {r["id"]: oq_c_ids.get(r["id"]) for r in rows if r["p_mark"]})

# ---------------------------------------------------------------- 5. Q-K defaults vs §23
print("\n=== 5. Q-K1..Q-K19: §23 'Default to build with' vs OPEN-QUESTIONS ===")
s23 = {}
for l in BP:
    m = re.match(r"^\| (Q-K\d+) \| (.*?) \| (.*) \|$", l)
    if m:
        s23[m.group(1)] = (m.group(2).strip(), m.group(3).strip())
print("§23 rows:", len(s23))
oq_qk = {}
cur = None
for l in OQ:
    m = re.match(r"^### (OQ-\d+) · (Q-K\d+): (.*)$", l)
    if m:
        cur = m.group(2)
        oq_qk[cur] = {"oq": m.group(1), "title": m.group(3)}
        continue
    if cur:
        m = re.match(r"^- \*\*(.+?):\*\* (.*)$", l)
        if m:
            oq_qk[cur][m.group(1)] = m.group(2).strip()
        if l.startswith("## "):
            cur = None
print("OQ Q-K items:", len(oq_qk), sorted(oq_qk, key=lambda s: int(s[3:])))


def norm(s):
    s = s.strip()
    if s.endswith("."):
        s = s[:-1]
    return s[:1].lower() + s[1:]


for qk in sorted(s23, key=lambda s: int(s[3:])):
    q, d = s23[qk]
    o = oq_qk.get(qk, {})
    od = o.get("Default to build with (§23)", "<MISSING>")
    oqq = o.get("Question (K §19.2)", "<MISSING>")
    same = norm(od) == norm(d)
    exact = od == d
    print(f"{qk}: default {'IDENTICAL' if exact else ('same modulo case/period' if same else 'DIFFERENT')}")
    if not same:
        print("   §23:", d)
        print("   OQ :", od)
    if norm(q) != norm(oqq):
        print(f"   question differs from §23 (OQ cites K §19.2):\n   §23: {q}\n   OQ : {oqq}")

# ---------------------------------------------------------------- A.20 vs OQ (b)
print("\n=== 5b. A.20 rows vs OPEN-QUESTIONS (b) ===")
a20_start = next(i for i in range(a_start, a_end) if BP[i].startswith("### A.20"))
a20 = []
for l in BP[a20_start:a_end]:
    if l.startswith("| ") and not l.startswith("| Conflict") and not l.startswith("|---"):
        c = cells(l)
        a20.append((c[0], c[1]))
oqb = []
for l in OQ[b_start:c_start]:
    m = re.match(r"^\| (OQ-\d+) \|", l)
    if m:
        c = cells(l)
        oqb.append((c[0], c[1], c[2], c[3], c[4]))
print("A.20 rows:", len(a20), " OQ (b) rows:", len(oqb))
for (ac, ar), ob in zip(a20, oqb):
    flags = []
    if ac != ob[1]:
        flags.append(f"conflict text differs: A.20={ac!r} OQ={ob[1]!r}")
    if ar != ob[2]:
        flags.append(f"resolution differs: A.20={ar!r} OQ={ob[2]!r}")
    print(f"  {ob[0]} {ob[4]:5} {'OK' if not flags else '; '.join(flags)}")

# ---------------------------------------------------------------- 7. §21 Phase 0 vs WORK-PACKAGES.md
print("\n=== 7. §21 Phase 0 table vs WORK-PACKAGES.md Phase 0 table ===")
p0 = {}
for l in BP:
    m = re.match(r"^\| \*\*(0\.\d) ", l)
    if m:
        c = cells(l)
        p0[m.group(1)] = dict(wp=c[0], dep=c[1], scope=c[2], exit=c[3])
wps = {}
for l in WPS:
    m = re.match(r"^\| \[WP-(0\.\d)\]", l)
    if m:
        c = cells(l)
        wps[m.group(1)] = dict(title=c[1], dep=c[2], scope=c[3], exit=c[4], state=c[5])
for n in sorted(p0):
    a, b = p0[n], wps.get(n)
    if not b:
        print(n, "MISSING in WORK-PACKAGES.md")
        continue
    for col in ("dep", "scope", "exit"):
        if a[col] != b[col]:
            print(f"\nWP-{n} {col} DIFFERS:")
            for d in difflib.ndiff([a[col]], [b[col]]):
                if d[0] in "+-?":
                    print("   ", d[:400])
        else:
            print(f"WP-{n} {col}: identical")
    # title/feature list from §21 WP cell
    print(f"WP-{n} §21 wp cell: {a['wp'][:120]}  | WORK-PACKAGES title: {b['title'][:120]}")

# ---------------------------------------------------------------- 6. ASSUMPTIONS vs K Appendix B
print("\n=== 6. ASSUMPTIONS.md L-rows vs K Appendix B (first six columns) ===")
kb = {}
for l in K:
    m = re.match(r"^\| (L-\d+) \|", l)
    if m:
        c = cells(l)
        kb[m.group(1)] = c
am = {}
for l in ASSUM:
    m = re.match(r"^\| (L-\d+) \|", l)
    if m:
        c = cells(l)
        am[m.group(1)] = c
print("K rows:", len(kb), " ASSUMPTIONS rows:", len(am), " missing:", sorted(set(kb) - set(am), key=lambda s: int(s[2:])), " extra:", sorted(set(am) - set(kb)))
for lid in sorted(kb, key=lambda s: int(s[2:])):
    a, b = kb[lid], am.get(lid)
    if not b:
        continue
    diffs = [(i, a[i], b[i]) for i in range(6) if a[i] != b[i]]
    if diffs:
        print(f"  {lid}: col diffs {diffs}")
print("(no line above a given L-n means its six K columns are reproduced verbatim)")
print("\nASSUMPTIONS defaults column (for the K text comparison):")
for lid in ["L-9", "L-10", "L-13", "L-14", "L-15", "L-17", "L-18", "L-19", "L-20", "L-23", "L-26", "L-29", "L-30", "L-33", "L-34", "L-35"]:
    print(f"  {lid}: default={am[lid][6]!r}\n        key={am[lid][7]!r}")
