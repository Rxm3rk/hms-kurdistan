"""Extends the repo check's ADR rule to every ADR file and the ADR index, with tests."""
import sys
from pathlib import Path

root = Path(sys.argv[1])


def rep(rel, old, new):
    p = root / rel
    s = p.read_text(encoding="utf-8")
    assert s.count(old) == 1, (rel, old[:80])
    p.write_text(s.replace(old, new), encoding="utf-8", newline="\n")


R = "tools/hmstools/repo/rules.py"
rep(R, "(b) the programme control files exist, and ADR-001 to ADR-028 follow template B.1;",
    "(b) the programme control files exist; every ADR file follows template B.1, the numbers run without a gap from\n"
    "    ADR-001 (the §4.2 baseline is ADR-001 to ADR-028), and the index docs/adr/README.md links every ADR;")
rep(R, """ADR_NUMBERS = range(1, 29)  # the §4.2 baseline
""", """ADR_NUMBERS = range(1, 29)  # the §4.2 baseline
ADR_FILE = re.compile(r"^ADR-(\\d{3})-[a-z0-9]+(?:-[a-z0-9]+)*\\.md$")
ADR_INDEX = "docs/adr/README.md"
""")
rep(R, """    adr_dir = root / "docs" / "adr"
    good = 0
    for number in ADR_NUMBERS:
        matches = sorted(adr_dir.glob(f"ADR-{number:03d}-*.md")) if adr_dir.is_dir() else []
        if not matches:
            result.errors.append(f"adr: docs/adr/ADR-{number:03d}-*.md is missing (§4.2 baseline)")
            continue
        if len(matches) > 1:
            result.errors.append(f"adr: more than one file for ADR-{number:03d}: {', '.join(m.name for m in matches)}")
            continue
        problems = adr_problems(number, matches[0].read_text(encoding="utf-8", errors="replace"))
        for problem in problems:
            result.errors.append(f"adr: docs/adr/{matches[0].name}: {problem} (template B.1)")
        if not problems:
            good += 1
    result.counts.update({"required_files_present": present, "adrs_valid": good})""",
"""    adr_dir = root / "docs" / "adr"
    found: dict[int, list[Path]] = {}
    for path in sorted(adr_dir.glob("ADR-*.md")) if adr_dir.is_dir() else []:
        match = ADR_FILE.match(path.name)
        if not match:
            result.errors.append(f"adr: docs/adr/{path.name}: the name is not ADR-nnn-<lower-case-slug>.md (template B.1)")
            continue
        found.setdefault(int(match.group(1)), []).append(path)
    highest = max([ADR_NUMBERS[-1], *found])
    index_path = root / ADR_INDEX
    index = index_path.read_text(encoding="utf-8", errors="replace") if index_path.is_file() else None
    if index is None:
        result.errors.append(f"adr: {ADR_INDEX} (the ADR index) is missing")
    good = 0
    for number in range(1, highest + 1):
        matches = found.get(number, [])
        if not matches:
            reason = "§4.2 baseline" if number in ADR_NUMBERS else f"ADR numbers run without a gap up to ADR-{highest:03d}"
            result.errors.append(f"adr: docs/adr/ADR-{number:03d}-*.md is missing ({reason})")
            continue
        if len(matches) > 1:
            result.errors.append(f"adr: more than one file for ADR-{number:03d}: {', '.join(m.name for m in matches)}")
            continue
        problems = [f"{p} (template B.1)" for p in adr_problems(number, matches[0].read_text(encoding="utf-8", errors="replace"))]
        if index is not None and f"({matches[0].name})" not in index:
            problems.append(f"not linked from {ADR_INDEX}")
        for problem in problems:
            result.errors.append(f"adr: docs/adr/{matches[0].name}: {problem}")
        if not problems:
            good += 1
    result.counts.update({"required_files_present": present, "adrs_total": highest, "adrs_valid": good})""")

T = "tools/hmstools/repo/tests/test_repo.py"
rep(T, """    for n in rules.ADR_NUMBERS:
        status = "accepted-provisional" if n in rules.ADR_PROVISIONAL else "accepted"
        write(root, f"docs/adr/ADR-{n:03d}-fixture-{n}.md", ADR_TEMPLATE.format(n=n, status=status))
""", """    for n in rules.ADR_NUMBERS:
        status = "accepted-provisional" if n in rules.ADR_PROVISIONAL else "accepted"
        write(root, f"docs/adr/ADR-{n:03d}-fixture-{n}.md", ADR_TEMPLATE.format(n=n, status=status))
    write_adr_index(root)
""")
rep(T, """def build_good_repo(root: Path, commit: bool = True, init: bool = True) -> None:""",
"""def write_adr_index(root: Path) -> None:
    names = sorted(p.name for p in (root / "docs/adr").glob("ADR-*.md"))
    rows = "".join(f"| [{name[:7]}]({name}) | fixture |\\n" for name in names)
    write(root, rules.ADR_INDEX, "# ADRs\\n\\n| ADR | Title |\\n|---|---|\\n" + rows)


def build_good_repo(root: Path, commit: bool = True, init: bool = True) -> None:""")
rep(T, """    def test_adr_001_and_009_must_stay_provisional(self) -> None:""",
"""    def test_adr_beyond_the_baseline_is_checked_too(self) -> None:
        write(self.root, "docs/adr/ADR-029-later.md", ADR_TEMPLATE.format(n=29, status="accepted").replace("## Decision\\n", ""))
        write_adr_index(self.root)
        self.assert_error(self.run_rules("required"), "ADR-029-later.md: no '## Decision' heading")

    def test_adr_numbers_without_a_gap(self) -> None:
        write(self.root, "docs/adr/ADR-030-skips-one.md", ADR_TEMPLATE.format(n=30, status="accepted"))
        write_adr_index(self.root)
        result = self.run_rules("required")
        self.assert_error(result, "ADR-029-*.md is missing (ADR numbers run without a gap up to ADR-030)")
        self.assertEqual(result.counts["adrs_total"], 30)

    def test_adr_file_name_must_follow_the_pattern(self) -> None:
        write(self.root, "docs/adr/ADR-029_Bad_Name.md", ADR_TEMPLATE.format(n=29, status="accepted"))
        self.assert_error(self.run_rules("required"), "ADR-029_Bad_Name.md: the name is not ADR-nnn-<lower-case-slug>.md")

    def test_every_adr_is_linked_from_the_index(self) -> None:
        index = self.root / rules.ADR_INDEX
        index.write_text(index.read_text(encoding="utf-8").replace("(ADR-017-fixture-17.md)", "(ADR-017.md)"),
                         encoding="utf-8", newline="\\n")
        self.assert_error(self.run_rules("required"), "ADR-017-fixture-17.md: not linked from docs/adr/README.md")

    def test_missing_adr_index_fails(self) -> None:
        (self.root / rules.ADR_INDEX).unlink()
        self.assert_error(self.run_rules("required"), "docs/adr/README.md (the ADR index) is missing")

    def test_adr_001_and_009_must_stay_provisional(self) -> None:""")
print("ok")
