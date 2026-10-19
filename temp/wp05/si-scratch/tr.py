import sys, yaml
sys.stdout.reconfigure(encoding="utf-8")
class L(yaml.SafeLoader): pass
for ch in "oOyYnN":
    L.yaml_implicit_resolvers.pop(ch, None)
d = yaml.load(open(sys.argv[1], encoding="utf-8"), Loader=L)
for i, t in enumerate(d["transitions"]):
    print(i, t["from"], t["on"], "->", t["to"], "G:", ",".join(t.get("guard", [])), "E:", ",".join(t.get("effects", [])))
