p = "genreg.py"
s = open(p, encoding="utf-8").read()
a = """root = sys.argv[1]
spec_layer = json.load(open(sys.argv[2], encoding="utf-8")) if len(sys.argv) > 2 else {}
"""
b = """root = sys.argv[1]
# genreg.py <root> <enabled machines, comma-separated> <spec-layer json>...
enabled = set(sys.argv[2].split(",")) if len(sys.argv) > 2 and sys.argv[2] else set()
spec_layer = {}
for path in sys.argv[3:]:
    for si, items in json.load(open(path, encoding="utf-8")).items():
        spec_layer.setdefault(si, []).extend(i for i in items if i["machine"] in enabled)
"""
assert a in s
s = s.replace(a, b)
open(p, "w", encoding="utf-8", newline="\n").write(s)
