"""Build a runtime classpath from the Gradle cache for a root module (scratch tool, not in the repo)."""
import json, sys, re, xml.etree.ElementTree as ET
from pathlib import Path
CACHE = Path(sys.argv[1])
roots = sys.argv[2:]
def vkey(v):
    return [int(x) if x.isdigit() else x for x in re.split(r"[.-]", v)]
def versions(g, m):
    d = CACHE / g / m
    if not d.is_dir(): return []
    return sorted((p.name for p in d.iterdir()), key=lambda v: [(0, x) if isinstance(x, int) else (1, x) for x in vkey(v)])
def files(g, m, v, suffix):
    d = CACHE / g / m / v
    return [p for p in d.rglob("*" + suffix)] if d.is_dir() else []
def deps(g, m, v):
    mods = [p for p in files(g, m, v, ".module")]
    if mods:
        data = json.loads(mods[0].read_text(encoding="utf-8"))
        for var in data.get("variants", []):
            attrs = var.get("attributes", {})
            if attrs.get("org.gradle.usage") == "java-runtime" and attrs.get("org.gradle.category", "library") == "library" and attrs.get("org.gradle.docstype") is None:
                if "available-at" in var:
                    a = var["available-at"]; return [(a["group"], a["module"], a["version"])], False
                out = [(d["group"], d["module"], d.get("version", {}).get("requires") or d.get("version", {}).get("strictly") or d.get("version", {}).get("prefers")) for d in var.get("dependencies", [])]
                return out, True
    poms = files(g, m, v, ".pom")
    out = []
    if poms:
        t = ET.parse(poms[0]); ns = {"m": "http://maven.apache.org/POM/4.0.0"}
        for d in t.getroot().findall("m:dependencies/m:dependency", ns):
            scope = (d.findtext("m:scope", default="compile", namespaces=ns))
            if scope not in ("compile", "runtime") or d.findtext("m:optional", default="false", namespaces=ns) == "true": continue
            out.append((d.findtext("m:groupId", namespaces=ns), d.findtext("m:artifactId", namespaces=ns), d.findtext("m:version", namespaces=ns)))
    return out, True
seen = {}
queue = [tuple(r.split(":")) for r in roots]
missing = []
while queue:
    g, m, v = queue.pop(0)
    if (g, m) in seen: continue
    vs = versions(g, m)
    if not vs: missing.append(f"{g}:{m}:{v}"); seen[(g, m)] = None; continue
    import os
    chosen = v if (os.environ.get('PREFER_DECLARED') and v in vs) else vs[-1]
    seen[(g, m)] = chosen
    ds, has_jar = deps(g, m, chosen)
    for d in ds:
        if d[0] and d[1]: queue.append(d)
jars = []
for (g, m), v in seen.items():
    if v is None: continue
    js = [p for p in files(g, m, v, ".jar") if not p.name.endswith(("-sources.jar", "-javadoc.jar"))]
    jars.extend(js)
print(";".join(str(j) for j in jars))
print("MISSING:", missing, file=sys.stderr)
