"""Unit tests for 'tools/hms repo check'. Every rule runs against fixture repositories in temporary
directories, never against the real repository state."""

from __future__ import annotations

import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from hmstools.repo import rules

REAL_ROOT = Path(__file__).resolve().parents[4]
GIT = ["git", "-c", "core.autocrlf=false", "-c", "user.name=fixture", "-c", "user.email=fixture@example.invalid",
       "-c", "commit.gpgsign=false", "-c", "init.defaultBranch=main"]

ADR_TEMPLATE = """# ADR-{n:03d}: Fixture decision {n}
Status: {status}
Date: 2026-10-18   Source: BUILD-PROMPT.md §4.2
## Context
Fixture.
## Decision
Fixture.
## Consequences (including safety and licence impact)
Fixture.
## Fitness test that guards it
Fixture.
## Reopen if
Fixture.
"""


def git(root: Path, *args: str) -> str:
    proc = subprocess.run([*GIT, "-C", str(root), *args], capture_output=True, check=True)
    return proc.stdout.decode("utf-8", "replace")


def write(root: Path, rel: str, text: str = "x\n", data: bytes | None = None) -> Path:
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    if data is not None:
        path.write_bytes(data)
    else:
        path.write_bytes(text.encode("utf-8"))
    return path


def write_adr_index(root: Path) -> None:
    names = sorted(p.name for p in (root / "docs/adr").glob("ADR-*.md"))
    rows = "".join(f"| [{name[:7]}]({name}) | fixture |\n" for name in names)
    write(root, rules.ADR_INDEX, "# ADRs\n\n| ADR | Title |\n|---|---|\n" + rows)


def build_good_repo(root: Path, commit: bool = True, init: bool = True) -> None:
    root.mkdir(parents=True)
    if init:
        empty_template = root.parent / "git-template"  # no hook samples: fewer files, faster on Windows
        empty_template.mkdir(exist_ok=True)
        git(root, "init", "-q", "-b", "main", f"--template={empty_template}")
    shutil.copy(REAL_ROOT / ".gitattributes", root / ".gitattributes")
    shutil.copy(REAL_ROOT / ".gitignore", root / ".gitignore")
    write(root, "BUILD-PROMPT.md", "# plan\n")
    write(root, "tools/config/tenant-identifiers.yaml",
          (REAL_ROOT / rules.TENANT_CONFIG).read_text(encoding="utf-8"))
    for name in rules.REQUIRED_FILES:
        write(root, name, "# fixture\n")
    write(root, "docs/program/DECISIONS-NEEDED.md",
          "# Decisions needed\n\n## Blocking now\n\n- DN-001 one\n- DN-002 two\n  - detail line\n- DN-003 three\n\n"
          "## All items\n\n- DN-004 later\n")
    write(root, "docs/program/STATUS.md", "".join(f"line {i}\n" for i in range(20)))
    for n in rules.ADR_NUMBERS:
        status = "accepted-provisional" if n in rules.ADR_PROVISIONAL else "accepted"
        write(root, f"docs/adr/ADR-{n:03d}-fixture-{n}.md", ADR_TEMPLATE.format(n=n, status=status))
    write_adr_index(root)
    write(root, "backend/modules/empi/src/main/kotlin/Empi.kt", "package hms.empi\n\nclass Empi\n")
    write(root, "frontend/apps/web/src/main.ts", "export const ok = true;\n")
    for name in rules.EXECUTABLES:
        write(root, name, "#!/bin/sh\nexit 0\n")
    if init and commit:
        git(root, "add", "-A")
        git(root, "update-index", "--chmod=+x", "--", *rules.EXECUTABLES)
        git(root, "commit", "-q", "-m", "fixture")


class RepoFixture(unittest.TestCase):
    needs_git = False  # the CRLF and branch rules read git; the other rules read files only
    commit = False  # only the tests that need branches pay for a commit

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name) / "repo"
        build_good_repo(self.root, commit=self.commit, init=self.needs_git or self.commit)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def run_rules(self, *only: str):
        return rules.run(self.root, set(only) if only else None)

    def assert_error(self, result, fragment: str) -> None:
        self.assertTrue(any(fragment in e for e in result.errors), f"no error containing {fragment!r}: {result.errors}")


class GoodRepository(RepoFixture):
    commit = True

    def test_fixture_passes_every_rule(self) -> None:
        result = self.run_rules()
        self.assertEqual(result.errors, [])
        self.assertTrue(result.ok)
        self.assertEqual(result.counts["adrs_valid"], 28)
        self.assertEqual(result.counts["blocking_now_items"], 3)
        self.assertEqual(result.counts["status_lines"], 20)
        self.assertEqual(result.counts["branches"], 1)

    def test_checkresult_json_shape(self) -> None:
        data = self.run_rules().to_dict()
        self.assertEqual(set(data), {"check", "ok", "counts", "errors", "warnings"})
        self.assertEqual(data["check"], "repo")


class Crlf(RepoFixture):
    needs_git = True

    def test_crlf_in_untracked_text_file_fails(self) -> None:
        write(self.root, "tools/new_script.py", data=b"print(1)\r\nprint(2)\r\n")
        self.assert_error(self.run_rules("crlf"), "tools/new_script.py has CRLF")

    def test_crlf_in_tracked_file_fails(self) -> None:
        write(self.root, "backend/modules/empi/src/main/kotlin/Empi.kt", data=b"package hms.empi\r\n")
        self.assert_error(self.run_rules("crlf"), "Empi.kt has CRLF")

    def test_ignored_files_are_not_checked(self) -> None:
        write(self.root, "backend/build/generated.txt", data=b"a\r\nb\r\n")
        write(self.root, "frontend/node_modules/pkg/index.js", data=b"a\r\n")
        self.assertEqual(self.run_rules("crlf").errors, [])

    def test_binary_attribute_and_crlf_attribute_are_respected(self) -> None:
        write(self.root, "assets/logo.png", data=b"\x89PNG\r\n\x1a\n")
        write(self.root, "fonts/x.woff2", data=b"wOF2\r\n")
        write(self.root, "backend/gradlew.bat", data=b"@echo off\r\n")
        self.assertEqual(self.run_rules("crlf").errors, [])

    def test_nul_bytes_mark_a_file_binary(self) -> None:
        write(self.root, "data/blob.dat", data=b"\x00\x01\r\n")
        self.assertEqual(self.run_rules("crlf").errors, [])

    def test_plan_of_record_crlf_is_a_warning_not_an_error(self) -> None:
        write(self.root, "BUILD-PROMPT.md", data=b"# plan\r\n")
        write(self.root, "research/01-report.md", data=b"text\r\n")
        result = self.run_rules("crlf")
        self.assertEqual(result.errors, [])
        self.assertEqual(result.counts["crlf_plan_of_record"], 2)
        self.assertTrue(any("BUILD-PROMPT.md" in w for w in result.warnings))

    def test_lone_lf_passes(self) -> None:
        write(self.root, "docs/notes.md", data=b"a\nb\n")
        self.assertEqual(self.run_rules("crlf").errors, [])


class Required(RepoFixture):
    def test_missing_control_file_fails(self) -> None:
        (self.root / "docs/program/KNOWN-ANOMALIES.md").unlink()
        (self.root / "CHANGELOG.md").unlink()
        result = self.run_rules("required")
        self.assert_error(result, "docs/program/KNOWN-ANOMALIES.md is missing")
        self.assert_error(result, "CHANGELOG.md is missing")

    def test_missing_adr_fails(self) -> None:
        next((self.root / "docs/adr").glob("ADR-005-*.md")).unlink()
        self.assert_error(self.run_rules("required"), "ADR-005-*.md is missing")

    def test_duplicate_adr_number_fails(self) -> None:
        write(self.root, "docs/adr/ADR-003-another.md", ADR_TEMPLATE.format(n=3, status="accepted"))
        self.assert_error(self.run_rules("required"), "more than one file for ADR-003")

    def test_adr_without_required_heading_fails(self) -> None:
        path = next((self.root / "docs/adr").glob("ADR-012-*.md"))
        path.write_text(path.read_text(encoding="utf-8").replace("## Fitness test that guards it\n", ""), encoding="utf-8")
        self.assert_error(self.run_rules("required"), "no '## Fitness test that guards it' heading")

    def test_adr_without_status_or_date_fails(self) -> None:
        path = next((self.root / "docs/adr").glob("ADR-020-*.md"))
        text = path.read_text(encoding="utf-8").replace("Status: accepted\n", "").replace("Date: 2026-10-18", "Date: soon")
        path.write_text(text, encoding="utf-8")
        result = self.run_rules("required")
        self.assert_error(result, "no 'Status:' line")
        self.assert_error(result, "is not yyyy-mm-dd")

    def test_unknown_status_fails(self) -> None:
        path = next((self.root / "docs/adr").glob("ADR-021-*.md"))
        path.write_text(path.read_text(encoding="utf-8").replace("Status: accepted", "Status: maybe"), encoding="utf-8")
        self.assert_error(self.run_rules("required"), "status 'maybe'")

    def test_a_status_with_an_approval_appended_fails(self) -> None:
        # The plant of review finding R-17: the status regex matched by prefix, so this passed.
        path = next((self.root / "docs/adr").glob("ADR-021-*.md"))
        text = path.read_text(encoding="utf-8").replace("Status: accepted\n", "Status: accepted, approved by the CSO\n")
        path.write_text(text, encoding="utf-8")
        result = self.run_rules("required")
        self.assert_error(result, "ADR-021-fixture-21.md: status 'accepted, approved by the CSO' is not exactly one of")
        self.assertEqual(result.counts["adrs_valid"], 27)

    def test_title_source_and_heading_order_are_checked_through_the_rule(self) -> None:
        cases = {
            "ADR-004": ("# ADR-004: Fixture decision 4\n", "# Fixture decision 4\n",
                        "the first line '# Fixture decision 4' is not the title '# ADR-nnn: <title>'"),
            "ADR-005": ("   Source: BUILD-PROMPT.md §4.2", "", "no 'Source:' field on the Date line"),
            "ADR-006": ("## Decision\nFixture.\n## Consequences", "## Consequences", "no '## Decision' heading"),
        }
        for number, (old, new, _) in cases.items():
            path = next((self.root / "docs/adr").glob(f"{number}-*.md"))
            text = path.read_text(encoding="utf-8")
            self.assertIn(old, text)
            path.write_text(text.replace(old, new), encoding="utf-8")
        path = next((self.root / "docs/adr").glob("ADR-007-*.md"))
        text = path.read_text(encoding="utf-8").replace("## Context\n", "## TMP\n").replace("## Decision\n", "## Context\n")
        path.write_text(text.replace("## TMP\n", "## Decision\n"), encoding="utf-8")
        result = self.run_rules("required")
        for number, (_, _, fragment) in cases.items():
            self.assert_error(result, f"{number}-fixture-{int(number[4:])}.md: {fragment}")
        self.assert_error(result, "ADR-007-fixture-7.md: the B.1 headings are out of order")
        self.assertEqual(result.counts["adrs_valid"], 24)

    def test_adr_beyond_the_baseline_is_checked_too(self) -> None:
        write(self.root, "docs/adr/ADR-029-later.md", ADR_TEMPLATE.format(n=29, status="accepted").replace("## Decision\n", ""))
        write_adr_index(self.root)
        self.assert_error(self.run_rules("required"), "ADR-029-later.md: no '## Decision' heading")

    def test_adr_numbers_without_a_gap(self) -> None:
        write(self.root, "docs/adr/ADR-030-skips-one.md", ADR_TEMPLATE.format(n=30, status="accepted"))
        write_adr_index(self.root)
        result = self.run_rules("required")
        self.assert_error(result, "ADR-029-*.md is missing (ADR numbers run without a gap up to ADR-030)")
        self.assertEqual(result.counts["adrs_total"], 30)

    def test_adr_gap_reserved_for_a_parallel_branch_is_accepted(self) -> None:
        write(self.root, "docs/adr/ADR-032-later.md", ADR_TEMPLATE.format(n=32, status="accepted"))
        write_adr_index(self.root)
        index = self.root / "docs/adr/README.md"
        index.write_text(
            index.read_text(encoding="utf-8")
            + "\n## Reserved numbers\n\n- ADR-029 to ADR-030: held by another branch.\n- ADR-031: held by a third branch.\n",
            encoding="utf-8",
        )
        result = self.run_rules("required")
        self.assertFalse([e for e in result.errors if "is missing" in e], result.errors)
        self.assertEqual(result.counts["adrs_total"], 32)

    def test_adr_gap_not_listed_as_reserved_still_fails(self) -> None:
        write(self.root, "docs/adr/ADR-031-later.md", ADR_TEMPLATE.format(n=31, status="accepted"))
        write_adr_index(self.root)
        index = self.root / "docs/adr/README.md"
        index.write_text(index.read_text(encoding="utf-8") + "\n## Reserved numbers\n\n- ADR-029: held by another branch.\n", encoding="utf-8")
        self.assert_error(self.run_rules("required"), "ADR-030-*.md is missing (ADR numbers run without a gap up to ADR-031)")

    def test_baseline_adr_can_never_be_reserved(self) -> None:
        (self.root / "docs/adr").mkdir(parents=True, exist_ok=True)
        for path in (self.root / "docs/adr").glob("ADR-005-*.md"):
            path.unlink()
        write_adr_index(self.root)
        index = self.root / "docs/adr/README.md"
        index.write_text(index.read_text(encoding="utf-8") + "\n## Reserved numbers\n\n- ADR-005: not allowed.\n", encoding="utf-8")
        self.assert_error(self.run_rules("required"), "ADR-005-*.md is missing (§4.2 baseline)")

    def test_adr_file_name_must_follow_the_pattern(self) -> None:
        write(self.root, "docs/adr/ADR-029_Bad_Name.md", ADR_TEMPLATE.format(n=29, status="accepted"))
        self.assert_error(self.run_rules("required"), "ADR-029_Bad_Name.md: the name is not ADR-nnn-<lower-case-slug>.md")

    def test_every_adr_is_linked_from_the_index(self) -> None:
        index = self.root / rules.ADR_INDEX
        index.write_text(index.read_text(encoding="utf-8").replace("(ADR-017-fixture-17.md)", "(ADR-017.md)"),
                         encoding="utf-8", newline="\n")
        self.assert_error(self.run_rules("required"), "ADR-017-fixture-17.md: not linked from docs/adr/README.md")

    def test_missing_adr_index_fails(self) -> None:
        (self.root / rules.ADR_INDEX).unlink()
        self.assert_error(self.run_rules("required"), "docs/adr/README.md (the ADR index) is missing")

    def test_adr_001_and_009_must_stay_provisional(self) -> None:
        path = next((self.root / "docs/adr").glob("ADR-009-*.md"))
        path.write_text(path.read_text(encoding="utf-8").replace("accepted-provisional", "accepted"), encoding="utf-8")
        self.assert_error(self.run_rules("required"), "ADR-009 accepted-provisional")

    def test_bold_status_and_date_lines_are_accepted(self) -> None:
        path = next((self.root / "docs/adr").glob("ADR-002-*.md"))
        text = path.read_text(encoding="utf-8").replace("Status: accepted", "**Status:** accepted")
        path.write_text(text.replace("Date: 2026-10-18", "**Date:** 2026-10-18"), encoding="utf-8")
        self.assertEqual(self.run_rules("required").errors, [])


class AdrTemplate(unittest.TestCase):
    """rules.adr_problems against template B.1, one deviation at a time (no repository needed)."""

    def problems(self, n: int = 3, status: str = "accepted", replace: tuple[str, str] | None = None,
                 text: str | None = None) -> list[str]:
        body = text if text is not None else ADR_TEMPLATE.format(n=n, status=status)
        if replace:
            self.assertIn(replace[0], body)
            body = body.replace(replace[0], replace[1])
        return rules.adr_problems(n, body)

    def assert_problem(self, fragment: str, **kwargs) -> None:
        found = self.problems(**kwargs)
        self.assertTrue(any(fragment in p for p in found), f"no problem containing {fragment!r}: {found}")

    def test_the_template_itself_passes(self) -> None:
        self.assertEqual(self.problems(), [])
        self.assertEqual(self.problems(n=1, status="accepted-provisional"), [])
        self.assertEqual(self.problems(status="proposed"), [])
        self.assertEqual(self.problems(status="superseded by ADR-031"), [])

    def test_status_must_be_the_whole_value(self) -> None:
        for status in ["accepted, approved by the CSO", "accepted (by the CSO)", "accepted-provisional pending C9",
                       "proposed or accepted", "superseded by ADR-031 and ADR-032", "superseded by ADR-31",
                       "accepted.", "superseded"]:
            self.assert_problem(f"status {status!r} is not exactly one of", status=status)

    def test_exactly_one_status_and_one_date_line(self) -> None:
        # The review verifier's plant: a second Status line after an allowed one, anywhere in the header.
        date = "Date: 2026-10-18   Source: BUILD-PROMPT.md §4.2\n"
        for second in [f"{date}Status: approved by the CSO\n", f"Status: approved by the CSO\n{date}",
                       f"{date}\n**Status:** accepted\n"]:
            found = self.problems(replace=(date, second))
            self.assertTrue(any("2 'Status:' lines between the title and the first '##' heading; template B.1 has "
                                "exactly one" in p for p in found), (second, found))
        self.assert_problem("'Status: approved by the CSO'", replace=(date, f"{date}Status: approved by the CSO\n"))
        self.assert_problem("2 'Date:' lines", replace=(date, f"{date}Date: 2026-10-19   Source: K §7.2\n"))
        # A Status line in the body is not part of the header and is not counted (the Context of an ADR may quote one).
        self.assertEqual(self.problems(replace=("## Context\nFixture.\n", "## Context\nStatus: approved by the CSO\n")), [])

    def test_provisional_rule_still_applies(self) -> None:
        self.assert_problem("§4.2 keeps ADR-009 accepted-provisional", n=9, status="accepted")
        self.assertEqual(self.problems(n=9, status="superseded by ADR-040"), [])

    def test_title_line_must_be_first_and_in_b1_form(self) -> None:
        self.assert_problem("is not the title '# ADR-nnn: <title>'", replace=("# ADR-003: Fixture decision 3", "# Fixture decision 3"))
        self.assert_problem("is not the title", replace=("# ADR-003: Fixture decision 3", "# ADR-3: Fixture decision 3"))
        self.assert_problem("is not the title", replace=("# ADR-003: Fixture decision 3", "## ADR-003: Fixture decision 3"))
        self.assert_problem("is not the title", replace=("# ADR-003: Fixture decision 3", "# ADR-003 Fixture decision 3"))
        self.assert_problem("is not the title", replace=("# ADR-003: Fixture decision 3", "# ADR-003:"))
        self.assert_problem("is not the title", replace=("# ADR-003: Fixture decision 3\n", "Preamble.\n# ADR-003: Fixture decision 3\n"))

    def test_title_number_must_match_the_file(self) -> None:
        self.assert_problem("the title names ADR-004, the file name ADR-003",
                            replace=("# ADR-003: Fixture", "# ADR-004: Fixture"))

    def test_date_line_needs_a_source_field(self) -> None:
        self.assert_problem("no 'Source:' field on the Date line", replace=("   Source: BUILD-PROMPT.md §4.2", ""))
        self.assert_problem("no 'Source:' field", replace=("Source: BUILD-PROMPT.md §4.2", "Source:"))
        self.assert_problem("no 'Source:' field", replace=("   Source: BUILD-PROMPT.md §4.2", " (from BUILD-PROMPT.md §4.2)"))
        self.assertEqual(self.problems(replace=("   Source:", " **Source:**")), [])

    def test_date_must_be_a_calendar_date(self) -> None:
        self.assert_problem("'2026-02-30' is not a calendar date", replace=("2026-10-18", "2026-02-30"))
        self.assert_problem("is not yyyy-mm-dd", replace=("2026-10-18", "18-10-2026"))
        self.assert_problem("is not yyyy-mm-dd", replace=("2026-10-18", "2026-10-180"))

    def test_status_and_date_must_sit_in_the_header(self) -> None:
        text = ADR_TEMPLATE.format(n=3, status="accepted")
        text = text.replace("Status: accepted\n", "").replace("## Context\nFixture.\n", "## Context\nStatus: accepted\n")
        found = rules.adr_problems(3, text)
        self.assertTrue(any("no 'Status:' line between the title" in p for p in found), found)
        moved = ADR_TEMPLATE.format(n=3, status="accepted").replace("Date: 2026-10-18   Source: BUILD-PROMPT.md §4.2\n", "")
        moved = moved.replace("## Reopen if\nFixture.\n", "## Reopen if\nDate: 2026-10-18   Source: x\n")
        self.assertTrue(any("no 'Date:' line" in p for p in rules.adr_problems(3, moved)))

    def test_headings_must_be_level_2_with_the_b1_text(self) -> None:
        self.assert_problem("no '## Context' heading", replace=("## Context\n", "### Context\n"))
        self.assert_problem("no '## Decision' heading", replace=("## Decision\n", "# Decision\n"))
        self.assert_problem("no '## Consequences (including safety and licence impact)' heading",
                            replace=("## Consequences (including safety and licence impact)\n", "## Consequences\n"))
        self.assert_problem("no '## Fitness test that guards it' heading",
                            replace=("## Fitness test that guards it\n", "## Fitness test\n"))
        self.assert_problem("no '## Reopen if' heading", replace=("## Reopen if\n", "**Reopen if**\n"))

    def test_headings_once_each_and_in_b1_order(self) -> None:
        self.assert_problem("the '## Decision' heading appears 2 times", replace=("## Reopen if\n", "## Decision\n## Reopen if\n"))
        swapped = ADR_TEMPLATE.format(n=3, status="accepted").replace("## Context\n", "## TMP\n")
        swapped = swapped.replace("## Decision\n", "## Context\n").replace("## TMP\n", "## Decision\n")
        found = rules.adr_problems(3, swapped)
        self.assertTrue(any("the B.1 headings are out of order (Decision, Context," in p for p in found), found)

    def test_other_level_2_sections_and_fenced_examples(self) -> None:
        extra = ("## Consequences (including safety and licence impact)\n",
                 "## Pinned set\nVersions.\n## Consequences (including safety and licence impact)\n")
        self.assertEqual(self.problems(replace=extra), [])
        fenced = ("## Context\nFixture.\n", "## Context\n```markdown\n## Reopen if\n# ADR-099: example\n```\n")
        self.assertEqual(self.problems(replace=fenced), [])
        only_in_fence = ("## Reopen if\nFixture.\n", "```\n## Reopen if\n```\n")
        self.assert_problem("no '## Reopen if' heading", replace=only_in_fence)

    def test_a_byte_order_mark_does_not_hide_the_title(self) -> None:
        self.assertEqual(self.problems(text="﻿" + ADR_TEMPLATE.format(n=3, status="accepted")), [])

    def test_real_adr_header_passes(self) -> None:
        # The form every ADR in docs/adr uses: a blank line after the Date line and long Source lists.
        text = ("# ADR-002: Runtime: Kotlin on the JVM, Spring Boot plus Spring Modulith\nStatus: accepted\n"
                "Date: 2026-10-18   Source: K §7.2, §7.6, §15.4 (S18-K), K-13; BP §7.2, §7.7; BUILD-PROMPT §4.1, §4.2\n\n"
                "## Context\n\nx\n\n## Decision\n\nx\n\n## Pinned set\n\nx\n\n"
                "## Consequences (including safety and licence impact)\n\nx\n\n## Fitness test that guards it\n\nx\n\n"
                "## Reopen if\n\nx\n")
        self.assertEqual(rules.adr_problems(2, text), [])


class Tenants(RepoFixture):
    def test_registered_identifier_in_backend_code_fails_with_line(self) -> None:
        write(self.root, "backend/modules/adt/src/main/kotlin/Special.kt",
              "package hms.adt\n\n// behaviour for one site\nval site = \"SYN-TENANT-0001\"\n")
        self.assert_error(self.run_rules("tenants"), "backend/modules/adt/src/main/kotlin/Special.kt:4")

    def test_pattern_catches_unregistered_synthetic_identifier(self) -> None:
        write(self.root, "deploy/site-cell/values.yaml", "tenant: SYN-TENANT-0042\n")
        self.assert_error(self.run_rules("tenants"), "pattern synthetic-tenant-id")

    def test_names_match_across_spaces_hyphens_and_underscores(self) -> None:
        write(self.root, "content/packs/kurdistan/x.json", '{"name": "synthetic_example-hospital one"}\n')
        self.assert_error(self.run_rules("tenants"), "Synthetic Example Hospital One")

    def test_hostname_in_frontend_config_fails(self) -> None:
        write(self.root, "frontend/apps/web/.env.production", "API=https://syn-tenant-0002.hms.invalid/api\n")
        self.assert_error(self.run_rules("tenants"), "syn-tenant-0002.hms.invalid")

    def test_dependency_and_build_directories_are_skipped(self) -> None:
        write(self.root, "frontend/node_modules/x/index.js", "SYN-TENANT-0001\n")
        write(self.root, "backend/app-hms/build/out.txt", "SYN-TENANT-0001\n")
        write(self.root, "frontend/dist/app.js", "SYN-TENANT-0001\n")
        self.assertEqual(self.run_rules("tenants").errors, [])

    def test_files_outside_the_scanned_roots_are_not_checked(self) -> None:
        write(self.root, "docs/notes.md", "SYN-TENANT-0001 is the reserved synthetic example\n")
        self.assertEqual(self.run_rules("tenants").errors, [])

    def test_identifier_inside_a_longer_word_does_not_match(self) -> None:
        write(self.root, "backend/modules/empi/src/main/kotlin/Ids.kt", "val x = \"XSYN-TENANT-0001X\"\n")
        result = self.run_rules("tenants")
        self.assertFalse(any("SYN-TENANT-0001 (no" in e for e in result.errors))

    def test_missing_registry_is_an_environment_error(self) -> None:
        (self.root / rules.TENANT_CONFIG).unlink()
        result = self.run_rules("tenants")
        self.assert_error(result, "environment:")
        self.assertEqual(result.counts.get("environment_error"), 1)


class Branches(RepoFixture):
    commit = True

    def branch(self, name: str) -> None:
        git(self.root, "branch", name)

    def test_allowed_branch_names(self) -> None:
        for name in ["wp/0.1-programme-bootstrap", "wp/1.1b-hub-core", "release/1.0.0", "release/r2a",
                     "hotfix/receipt-rounding"]:
            self.branch(name)
        result = self.run_rules("branches")
        self.assertEqual(result.errors, [])
        self.assertEqual(result.counts["branches"], 6)

    def test_other_branch_names_fail(self) -> None:
        self.branch("feature/new-thing")
        self.branch("wp/0.1")
        self.assert_error(self.run_rules("branches"), "branch: feature/new-thing: does not match")
        self.assert_error(self.run_rules("branches"), "branch: wp/0.1: does not match")

    def test_forbidden_words_fail_even_in_valid_shapes(self) -> None:
        self.branch("wp/0.7-client-shells")
        self.branch("hotfix/customer-a")
        self.branch("release/1.0-tenant")
        result = self.run_rules("branches")
        self.assert_error(result, "wp/0.7-client-shells: contains the word 'client'")
        self.assert_error(result, "hotfix/customer-a: contains the word 'customer'")
        self.assert_error(result, "contains the word 'tenant'")

    def test_registered_tenant_in_branch_name_fails(self) -> None:
        self.branch("hotfix/syn-tenant-0002-fix")
        self.branch("wp/2.1-synthetic-example-polyclinic-two")
        result = self.run_rules("branches")
        self.assert_error(result, "names registered tenant 'SYN-TENANT-0002'")
        self.assert_error(result, "names registered tenant 'Synthetic Example Polyclinic Two'")

    def test_remote_tracking_branches_are_checked(self) -> None:
        sha = git(self.root, "rev-parse", "HEAD").strip()
        git(self.root, "remote", "add", "origin", "https://example.invalid/hms.git")
        git(self.root, "update-ref", "refs/remotes/origin/main", sha)
        git(self.root, "update-ref", "refs/remotes/origin/HEAD", sha)
        git(self.root, "update-ref", "refs/remotes/origin/hospital-a", sha)
        result = self.run_rules("branches")
        self.assert_error(result, "branch: origin/hospital-a: does not match")
        self.assertEqual(result.counts["branches"], 3)

    def test_refs_outside_branches_are_not_branches(self) -> None:
        sha = git(self.root, "rev-parse", "HEAD").strip()
        git(self.root, "update-ref", "refs/t3/checkpoints/abc/ordinal/1", sha)
        git(self.root, "tag", "customer-tag")
        self.assertEqual(self.run_rules("branches").errors, [])


class Limits(RepoFixture):
    def decisions(self, text: str) -> None:
        write(self.root, "docs/program/DECISIONS-NEEDED.md", text)

    def test_more_than_ten_blocking_items_fails(self) -> None:
        items = "".join(f"- DN-{i:03d} item\n" for i in range(1, 12))
        self.decisions(f"# Decisions\n\n## Blocking now\n\n{items}\n## Later\n")
        self.assert_error(self.run_rules("limits"), "'Blocking now' has 11 items")

    def test_exactly_ten_items_passes(self) -> None:
        items = "".join(f"{i}. DN-{i:03d} item\n" for i in range(1, 11))
        self.decisions(f"# Decisions\n\n## Blocking now (at most ten)\n\n{items}")
        result = self.run_rules("limits")
        self.assertEqual(result.errors, [])
        self.assertEqual(result.counts["blocking_now_items"], 10)

    def test_table_rows_are_counted(self) -> None:
        self.decisions("# D\n\n## Blocking now\n\n| ID | What |\n|---|---|\n| DN-001 | a |\n| DN-002 | b |\n\n## Rest\n")
        self.assertEqual(self.run_rules("limits").counts["blocking_now_items"], 2)

    def test_missing_blocking_now_list_fails(self) -> None:
        self.decisions("# Decisions\n\n## Everything\n\n- DN-001\n")
        self.assert_error(self.run_rules("limits"), "has no 'Blocking now' list")

    def test_status_line_limit(self) -> None:
        write(self.root, "docs/program/STATUS.md", "".join(f"l{i}\n" for i in range(150)))
        self.assertEqual(self.run_rules("limits").errors, [])
        write(self.root, "docs/program/STATUS.md", "".join(f"l{i}\n" for i in range(151)))
        self.assert_error(self.run_rules("limits"), "STATUS.md has 151 lines")


class Modes(RepoFixture):
    """(f) git stores the entry scripts as executable (review finding R-02)."""

    commit = True  # build_good_repo commits the entry scripts as executable

    def test_executable_entry_scripts_pass(self) -> None:
        result = self.run_rules("modes")
        self.assertEqual(result.errors, [])
        self.assertEqual(result.counts["executables_checked"], len(rules.EXECUTABLES))

    def test_a_script_stored_without_the_executable_bit_fails(self) -> None:
        for path in ("backend/gradlew", "tools/ci/run"):
            with self.subTest(path=path):
                git(self.root, "update-index", "--chmod=-x", "--", path)
                self.assert_error(self.run_rules("modes"), f"modes: {path} is stored with mode 100644, not 100755")
                git(self.root, "update-index", "--chmod=+x", "--", path)
        self.assertEqual(self.run_rules("modes").errors, [])

    def test_the_index_counts_not_the_last_commit(self) -> None:
        # The rule reads the index, which is what the next commit stores: a staged fix passes before it is committed.
        git(self.root, "update-index", "--chmod=-x", "--", "tools/hms")
        git(self.root, "commit", "-q", "-m", "mode lost")
        self.assert_error(self.run_rules("modes"), "modes: tools/hms is stored with mode 100644")
        git(self.root, "update-index", "--chmod=+x", "--", "tools/hms")
        self.assertEqual(self.run_rules("modes").errors, [])

    def test_a_script_git_does_not_track_fails(self) -> None:
        # The review found that a script removed from the index passed: the next commit would not store it.
        git(self.root, "rm", "-q", "--cached", "--", "tools/doctor")
        result = self.run_rules("modes")
        self.assert_error(result, "modes: tools/doctor is not in git's index")
        self.assertEqual(len(result.errors), 1)
        self.assertEqual(result.counts["executables_checked"], len(rules.EXECUTABLES) - 1)
        git(self.root, "add", "--", "tools/doctor")
        git(self.root, "update-index", "--chmod=+x", "--", "tools/doctor")
        self.assertEqual(self.run_rules("modes").errors, [])


class Helpers(unittest.TestCase):
    def test_blocking_now_items_ignores_nested_lines(self) -> None:
        text = "## Blocking now\n- a\n  - nested\n  continuation\n- b\n## Next\n- c\n"
        self.assertEqual(rules.blocking_now_items(text), 2)
        self.assertIsNone(rules.blocking_now_items("# nothing\n"))

    def test_plan_of_record_paths(self) -> None:
        self.assertTrue(rules.in_plan_of_record("research/blueprint-drafts/x.md"))
        self.assertTrue(rules.in_plan_of_record("BLUEPRINT.md"))
        self.assertFalse(rules.in_plan_of_record("docs/program/STATUS.md"))


if __name__ == "__main__":
    unittest.main()
