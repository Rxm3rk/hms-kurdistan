import sys
sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, sys.argv[1])
from pathlib import Path
from hmstools.statemachines.loader import load_spec
from hmstools.statemachines.model import build
m = build(load_spec(Path(sys.argv[2])))
for i, t in enumerate(m.transitions):
    if not m.is_proposed(t):
        print(i, getattr(t, 'from_states', None) or getattr(t, 'sources', None) or t, )
