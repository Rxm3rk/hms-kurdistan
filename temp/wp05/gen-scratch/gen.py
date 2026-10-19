import sys
from pathlib import Path
sys.path.insert(0, sys.argv[1])
from hmstools.statemachines import emit, loader, model
from hmstools.statemachines.targets import Target
out = Path(sys.argv[2])
for spec in sys.argv[3:]:
    p = Path(spec)
    doc = loader.load_spec(p)
    m = model.build(doc)
    t = Target(m.name, m.owner, "proj", f"hms.{m.owner}.domain.{m.name.replace('-', '')}")
    for f in emit.generate(m, t, f"docs/specs/state-machines/{p.name}", loader.canonical_sha256(doc)):
        target = out / f.path; target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(f.text, encoding="utf-8", newline="\n")
        print(target)
