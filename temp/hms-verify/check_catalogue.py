"""Check that every library and plugin in a Gradle version catalogue exists on Maven Central or the Plugin Portal."""
import sys
import tomllib
import urllib.request

CENTRAL = "https://repo1.maven.org/maven2/"
PORTAL = "https://plugins.gradle.org/m2/"

def exists(url: str) -> bool:
    req = urllib.request.Request(url, method="HEAD")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.status == 200
    except Exception:
        return False

def pom_url(base: str, group: str, artifact: str, version: str) -> str:
    return f"{base}{group.replace('.', '/')}/{artifact}/{version}/{artifact}-{version}.pom"

with open(sys.argv[1], "rb") as fh:
    cat = tomllib.load(fh)
versions = cat["versions"]
failures = 0
for name, spec in cat["libraries"].items():
    group, artifact = spec["module"].split(":")
    version = versions[spec["version"]["ref"]]
    where = [b for b in (CENTRAL, PORTAL) if exists(pom_url(b, group, artifact, version))]
    label = "central" if CENTRAL in where else ("portal" if where else "MISSING")
    if not where:
        failures += 1
    print(f"lib    {label:8} {group}:{artifact}:{version}")
for name, spec in cat["plugins"].items():
    pid = spec["id"]
    version = versions[spec["version"]["ref"]]
    marker = f"{pid}.gradle.plugin"
    where = [b for b in (PORTAL, CENTRAL) if exists(pom_url(b, pid, marker, version))]
    label = "portal" if PORTAL in where else ("central" if where else "MISSING")
    if not where:
        failures += 1
    print(f"plugin {label:8} {pid}:{version}")
print("failures:", failures)
sys.exit(1 if failures else 0)
