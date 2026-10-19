import re, sys, pathlib
BASE = {"DN": 19, "OQ": 139, "KA": 24}
MAX = {"DN": 39, "OQ": 159, "KA": 44}
pat = re.compile(r"\b(DN|OQ|KA)-new-(\d+)\b")
def sub(m):
    k, n = m.group(1), int(m.group(2))
    v = BASE[k] + n
    assert v <= MAX[k], (k, n)
    return f"{k}-{v:03d}"
for p in sys.argv[1:]:
    path = pathlib.Path(p)
    b = path.read_bytes()
    t = b.decode("utf-8")
    t2, c = pat.subn(sub, t)
    if c:
        path.write_bytes(t2.encode("utf-8"))
    print(p, c)
