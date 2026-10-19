"""Point record-keeping references at the right control file and fix small wording items."""
import sys
from pathlib import Path

base = Path(sys.argv[1])


def edit(fname, pairs):
    p = base / fname
    s = p.read_text(encoding='utf-8')
    for old, new in pairs:
        n = s.count(old)
        assert n == 1, (fname, n, old[:70])
        s = s.replace(old, new)
    p.write_text(s, encoding='utf-8')


edit('part-02.md', [
    ("# STATUS, BACKLOG, WORK-PACKAGES, DECISIONS-NEEDED, KNOWN-ANOMALIES, reviews/",
     "# STATUS, BACKLOG, WORK-PACKAGES, DECISIONS-NEEDED, OPEN-QUESTIONS, ASSUMPTIONS, COMMANDS, KNOWN-ANOMALIES, evidence/, reviews/"),
])
edit('part-04b.md', [
    ("[P]. Record the change in `DECISIONS-NEEDED.md`.", "[P]. Record the change in `OPEN-QUESTIONS.md`."),
    ("record the choice in `DECISIONS-NEEDED.md`):", "record the choice in `OPEN-QUESTIONS.md`):"),
])
edit('part-04c.md', [
    ("log the semantics in `DECISIONS-NEEDED.md`.", "log the semantics in `OPEN-QUESTIONS.md`."),
])
edit('part-05.md', [
    ("every [L] value is listed in `DECISIONS-NEEDED.md` until confirmed.", "every [L] value is listed in `ASSUMPTIONS.md` until confirmed."),
    ("A mismatch returns the order to the prescriber. **The system performs no dose arithmetic.**",
     "A mismatch returns the order to the prescriber. **The system performs no dose arithmetic** (the definition and the narrow allowed comparisons are in §2.1)."),
])
edit('part-06b.md', [
    ("**Conflict to record in `DECISIONS-NEEDED.md`:**", "**Conflict to record in `OPEN-QUESTIONS.md`:**"),
])
edit('part-04d.md', [
    ("- **Support:** service-desk integration and a public status page.",
     "- **Support:** service-desk integration and a status page (built and run locally; publishing it is a [HUMAN] decision, §3.7)."),
])
edit('part-11-appendixA.md', [
    ("Keep this table in `docs/program/backlog.yaml` and treat it as the source of truth for scope.",
     "Keep this table in `docs/program/backlog.yaml` and use it for scope as §1 says: where it deliberately differs from K (a note, a [P] mark or an A.20 entry), follow it and keep the item open until a human confirms; where it differs from K without such a mark, K wins."),
    ("| Conflict | Resolution used here (record each in `DECISIONS-NEEDED.md` for confirmation) |",
     "| Conflict | Resolution used here (record each in `OPEN-QUESTIONS.md` for confirmation) |"),
    ("released only through the §9.30 release rule (G10, SI-07)",
     "released only through the §9.30 release rule (control-plane requirement G10, SI-07)"),
])
edit('part-07.md', [
    ("starting only after G3: hospital A's 90-day stabilisation", "starting only after company gate G3: hospital A's 90-day stabilisation"),
])
print('ok')
