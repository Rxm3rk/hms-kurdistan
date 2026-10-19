import sys
def rep(path, old, new):
    b = open(path, 'rb').read()
    crlf = b'\r\n' in b
    s = b.decode('utf-8')
    assert s.count(old) == 1, (path, old[:60], s.count(old))
    s = s.replace(old, new)
    open(path, 'wb').write(s.encode('utf-8'))
    print('ok', path, 'crlf' if crlf else 'lf')
R='docs/program/evidence/README.md'
rep(R, "| `licence/` | Licence-check outputs and their inputs, per scope (§4.3) |",
       "| `licence/` | Licence-check outputs and the dependency lists they were computed from (§4.3) |")
rep(R, "keeps the record's name with `-<scope>-input` added before the extension, for example `licence/2026-10-19-licence-05f159a-shipped-input.json` beside `licence/2026-10-19-licence-05f159a.txt`.",
       "keeps the record's name with `-<list>-input` added before the extension, where `<list>` names the input rather than a licence scope: for the licence check, `shipped` (the shipped dependencies, checked in the shipped scope) and `all` (every dependency, checked as build-only). For example `licence/2026-10-19-licence-05f159a-shipped-input.json` and `licence/2026-10-19-licence-05f159a-all-input.json` beside `licence/2026-10-19-licence-05f159a.txt`.")
rep(R, "| The Linux build host (the WSL clone), no cell: fast-tier and doctor evidence of record |",
       "| The Linux build host (the WSL clone, or a scratch clone for the gates-bite matrix), no cell: CI-tier, doctor, gates-bite, spot-check and licence evidence of record |")
S='docs/program/evidence/backlog/2026-10-19-spot-check-05f159a.md'
rep(S, "Exit code 0. Seed **20261018**.",
       "Exit code 0, as reported by the lead who ran it; the stored output (stdout only) does not print it, and it ends normally after all ten rows with the `Sampled rows` line. Seed **20261018**.")
C='docs/program/COMMANDS.md'
rep(C, "WSL at `05f159a` (exit 0; the record `evidence/backlog/2026-10-19-spot-check-05f159a.md`)",
       "WSL at `05f159a` (exit 0 as reported by the lead who ran it, not printed in the stored output; the record `evidence/backlog/2026-10-19-spot-check-05f159a.md`)")
rep(C, "WSL at `05f159a`, before the records of record: reused the pinned JDK",
       "WSL clone at `05f159a`, no stored record (so not a record of record), before the records of record: reused the pinned JDK")
rep(C, "with its record stored under `docs/program/evidence/`: these are the records of record.",
       "with its record stored under `docs/program/evidence/`: these are the records of record. A WSL cell that says its run has no stored record is not a record of record.")
