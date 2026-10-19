from pathlib import Path
p = Path("docs/program/STATUS.md"); s = p.read_text(encoding="utf-8")
import re
s = re.sub(r"# STATUS \(updated [^)]*\)", "# STATUS (updated 2026-10-19 11:25 Asia/Baghdad)", s)
start = s.index("In-flight slice:"); end = s.index("\n", start)
s = s[:start] + ("In-flight slice: S1 (specification, schema, generator and checks, engine and harness, project skeleton, scenario framework): "
 "reviewed (one pass each: `plumbing-python` 0 critical, 3 major, 8 minor; `plumbing-kotlin` 0 critical, 2 major, 12 minor); "
 "the Python findings py-01…py-11 are fixed, the harness findings kt-01…kt-14 are being fixed (vacuous checks and P3 coverage; new `StepCheck.appliesTo`), then the fast tier in the clean clone `%TEMP%\wp05\ft` and the S1 commit. "
 "S4 (nightly steps `property-1e6`, `si-domain-layer`, `scenario-suites`, `si-status`): built with S1's Python fixes, to be committed with S1. "
 "S2 (the eight machines' Kotlin): six agents, Guards present for all eight; scoped Gradle runs queue behind one host-wide slot (host memory below 3.5 GB free). "
 "S3 (SI scaffold `tests/invariants`): one agent, in progress") + s[end:]
p.write_text(s, encoding="utf-8", newline="\n")
