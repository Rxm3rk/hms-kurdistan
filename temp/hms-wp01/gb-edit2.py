import sys
p = sys.argv[1]
t = open(p, encoding="utf-8", newline="").read()
reps = [
    ('"The plants are those of `docs/program/evidence/ci/2026-10-18-gates-bite.md` and of the WP-0.1 review "\n'
     '        "(`docs/program/reviews/WP-0.1.md` section 2), plus,',
     '"The plants are those of the first gates-bite record of WP-0.1 (18 October 2026) and of the WP-0.1 review "\n'
     '        "(`docs/program/reviews/WP-0.1.md` section 2), listed in `tools/ci/gates-bite/README.md`, plus,'),
    ('f"**Where it ran.** WSL build host, no cell. Clone',
     'f"**Where it ran.** {meta.get(\'host_label\', \'WSL build host, no cell\')}. Clone'),
    ('f"**How it ran.** `{meta[\'script\']}` (sha256 `{meta[\'script_sha256\']}`), run as `{meta[\'invocation\']}`. "\n',
     'f"**How it ran.** `{meta[\'script\']}` (sha256 `{meta[\'script_sha256\']}`), run as `{meta[\'invocation\']}`. "\n'
     '        f"{meta.get(\'script_source\', \'\')} "\n'),
]
for a, b in reps:
    n = t.count(a)
    if n != 1:
        sys.exit(f"{n} matches for {a[:90]!r}")
    t = t.replace(a, b)
open(p, "w", encoding="utf-8", newline="").write(t)
print("ok")
