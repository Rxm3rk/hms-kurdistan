import sys, glob, re
sys.path.insert(0, sys.argv[1])
import yaml
from hmstools.statemachines import loader
from pathlib import Path
class PyLoader(yaml.SafeLoader):
    yaml_implicit_resolvers = loader.SpecLoader.yaml_implicit_resolvers
    yaml_constructors = dict(loader.SpecLoader.yaml_constructors)
files = sorted(glob.glob(sys.argv[2] + "/*.yaml")) + [sys.argv[3]]
for f in files:
    t = Path(f).read_text(encoding="utf-8")
    a = loader.canonical_sha256(yaml.load(t, Loader=loader.SpecLoader))
    b = loader.canonical_sha256(yaml.load(t, Loader=PyLoader))
    c = loader.canonical_sha256(yaml.load(t.replace("\n", "\r\n"), Loader=loader.SpecLoader))
    print(Path(f).name, a == b == c, a[:12], loader.SpecLoader.__mro__[1].__name__)
