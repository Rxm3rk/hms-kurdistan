import sys

p = sys.argv[1]
t = open(p, encoding="utf-8", newline="").read()
reps = [
    (
        "# =========================================================================== safety-check (sign-off gate)\n"
        "if section safety; then\n",
        "# =========================================================================== safety-check\n"
        "# Two sections share the safety-check gate, in this order: signoff (the sign-off gate: approval fields,\n"
        "# records, signatures and the allowed-signers list) and hazards (the hazard log's own rules). Their plants\n"
        "# are interleaved below so that a full run keeps the plant numbers of the earlier records.\n"
        "if section signoff; then\n",
    ),
    (
        "end_plant\n\nplant safety-check \"HAZ-0001 \\`status: open\\` changed to \\`status: accepted\\`\"\n",
        "end_plant\n\nfi\nif section hazards; then\n\nplant safety-check \"HAZ-0001 \\`status: open\\` changed to \\`status: accepted\\`\"\n",
    ),
    (
        "end_plant\n\nplant safety-check \"HAZ-0001 \\`cso_triage\\` filled",
        "end_plant\n\nfi\nif section signoff; then\n\nplant safety-check \"HAZ-0001 \\`cso_triage\\` filled",
    ),
    (
        "end_plant\n\nplant safety-check \"An unparsable hazard log",
        "end_plant\n\nfi\nif section hazards; then\n\nplant safety-check \"An unparsable hazard log",
    ),
    (
        "end_plant\n\n# --------------------------------------------------------------------------- the sign-off gate with a listed key\n",
        "end_plant\n\nfi\nif section signoff; then\n\n# --------------------------------------------------------------------------- the sign-off gate with a listed key\n",
    ),
    (
        'SECTIONS_ALL="repo unittest safety backlog ci secrets frontend backend clean final"',
        'SECTIONS_ALL="repo unittest signoff hazards backlog ci secrets frontend backend clean final"',
    ),
    (
        "if section safety; then command -v gpg",
        "if section signoff; then command -v gpg",
    ),
]
for a, b in reps:
    n = t.count(a)
    if n != 1:
        sys.exit(f"{n} matches for {a[:90]!r}")
    t = t.replace(a, b)
open(p, "w", encoding="utf-8", newline="").write(t)
print("ok")
