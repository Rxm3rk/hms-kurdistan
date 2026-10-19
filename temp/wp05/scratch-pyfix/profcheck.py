import cProfile
import pstats
import sys
import time

sys.path.insert(0, sys.argv[1])
from hmstools.statemachines.tests.harness import Sandbox  # noqa: E402

box = Sandbox()
box.add("clean", "toy-light.yaml", "toy-light.md")
box.install_kotlin("toy-light")
t = time.perf_counter()
box.generate()
print("generate", round(time.perf_counter() - t, 3))
for _ in range(3):
    t = time.perf_counter()
    box.check()
    print("check", round(time.perf_counter() - t, 3))
cProfile.run("for _ in range(5): box.check()", sys.argv[2])
s = pstats.Stats(sys.argv[2])
s.sort_stats("cumulative").print_stats(30)
box.close()
