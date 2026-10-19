import pathlib
p=pathlib.Path("tools/hmstools/ci/tiers.py"); s=p.read_text(encoding="utf-8")
a='BACKEND_JUNIT = [("backend", "**/build/test-results/**/*.xml")]'
assert a in s
s=s.replace(a,
'''# The tests/invariants and tests/scenarios Gradle projects build under tests/<name>/build, outside backend/
# (docs/specs/modules/state-machines-and-invariants.md §7).
BACKEND_JUNIT = [("backend", "**/build/test-results/**/*.xml"), ("tests", "**/build/test-results/**/*.xml")]''')
b='''        CommandStep("safety-check", ["sh", "tools/hms", "safety", "check", "--json"], check_json=True, timeout=300),
'''
assert b in s
s=s.replace(b,b+'''        CommandStep(
            "state-machines-check", ["sh", "tools/hms", "statemachines", "check", "--json"], check_json=True, timeout=300,
        ),
''')
p.write_text(s,encoding="utf-8",newline="\n")
t=pathlib.Path("tools/hmstools/ci/tests/test_ci.py"); u=t.read_text(encoding="utf-8")
c='''        self.assertEqual(names, ["doctor-fast", "repo-check", "python-unit-tests", "safety-check", "backlog-check",
                                 "backend-fast", "frontend-fast", "secret-scan"])'''
assert c in u
u=u.replace(c,'''        self.assertEqual(names, ["doctor-fast", "repo-check", "python-unit-tests", "safety-check", "state-machines-check",
                                 "backlog-check", "backend-fast", "frontend-fast", "secret-scan"])''')
d='''        for name in ["doctor-fast", "repo-check", "safety-check", "backlog-check"]:'''
assert d in u
u=u.replace(d,'''        self.assertEqual(steps["state-machines-check"].argv, ["sh", "tools/hms", "statemachines", "check", "--json"])
        for name in ["doctor-fast", "repo-check", "safety-check", "state-machines-check", "backlog-check"]:''')
t.write_text(u,encoding="utf-8",newline="\n")
