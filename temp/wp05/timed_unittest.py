import sys, time, unittest
class R(unittest.TextTestResult):
    def startTest(self, t):
        self._t0 = time.perf_counter(); super().startTest(t)
    def stopTest(self, t):
        super().stopTest(t); times.append((time.perf_counter() - self._t0, t.id()))
times = []
suite = unittest.defaultTestLoader.discover("tools", pattern="test_*.py", top_level_dir="tools")
t0 = time.perf_counter()
res = unittest.TextTestRunner(resultclass=R, verbosity=0, stream=open(sys.argv[1] + ".err", "w")).run(suite)
total = time.perf_counter() - t0
mods = {}
for d, i in times:
    k = ".".join(i.split(".")[:2]); mods[k] = mods.get(k, 0) + d
with open(sys.argv[1], "w") as f:
    f.write(f"total {total:.1f}s tests {res.testsRun} failures {len(res.failures)} errors {len(res.errors)}\n")
    for k, v in sorted(mods.items(), key=lambda x: -x[1]): f.write(f"{v:8.1f} {k}\n")
    for d, i in sorted(times, reverse=True)[:40]: f.write(f"{d:8.1f} {i}\n")
