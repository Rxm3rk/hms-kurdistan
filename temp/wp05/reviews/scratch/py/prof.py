import sys, time
sys.path.insert(0, sys.argv[1])
from pathlib import Path
root = Path(sys.argv[1]).parent
t=time.perf_counter()
from hmstools.safety.plan import parse_plan
print("import plan", round(time.perf_counter()-t,2))
for i in range(3):
    t=time.perf_counter(); parse_plan(root/"BUILD-PROMPT.md"); print("parse_plan", round(time.perf_counter()-t,2))
from hmstools.statemachines import check
from hmstools.statemachines.check import Paths, run_check
p = Paths.for_root(root)
for i in range(2):
    t=time.perf_counter(); check._schema(p); print("schema", round(time.perf_counter()-t,3))
t=time.perf_counter(); check._hazard_ids(p); print("hazards", round(time.perf_counter()-t,2))
import subprocess
t=time.perf_counter()
for i in range(10): subprocess.run(["git","--version"],capture_output=True)
print("10 git spawns", round(time.perf_counter()-t,2))
import cProfile, pstats
cProfile.run("run_check(p)", "C:/Users/Surface/AppData/Local/Temp/wp05/reviews/scratch/py/prof.out")
s=pstats.Stats("C:/Users/Surface/AppData/Local/Temp/wp05/reviews/scratch/py/prof.out"); s.sort_stats("cumulative").print_stats(18)
