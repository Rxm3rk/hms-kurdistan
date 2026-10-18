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
    if init and commit:
        git(root, "add", "-A")
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
        self.assert_error(self.run_rules("required"), "no '## Fitness test' heading")

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
