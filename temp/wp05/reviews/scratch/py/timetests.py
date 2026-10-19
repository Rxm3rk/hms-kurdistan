import sys, time, unittest
sys.path.insert(0, sys.argv[1])
loader = unittest.TestLoader()
suite = loader.discover(sys.argv[1] + "/hmstools/statemachines", pattern="test_*.py", top_level_dir=sys.argv[1])
times = []
class R(unittest.TextTestResult):
    def startTest(self, test):
        self._t = time.perf_counter(); super().startTest(test)
    def stopTest(self, test):
        times.append((time.perf_counter() - self._t, test.id())); super().stopTest(test)
t0 = time.perf_counter()
cls_times = {}
res = unittest.TextTestRunner(resultclass=R, verbosity=0, stream=open("nul" if sys.platform=="win32" else "/dev/null","w")).run(suite)
total = time.perf_counter() - t0
print("total", round(total,1), "tests", res.testsRun, "fail", len(res.failures), "err", len(res.errors))
for t, i in sorted(times, reverse=True)[:25]:
    print(f"{t:7.2f} {i}")
agg = {}
for t, i in times:
    k = ".".join(i.split(".")[:-1]); agg[k] = agg.get(k, 0) + t
print("--- per class (test bodies only)")
for k, v in sorted(agg.items(), key=lambda x: -x[1]):
    print(f"{v:7.2f} {k}")
print("sum of test bodies", round(sum(t for t,_ in times),1))
