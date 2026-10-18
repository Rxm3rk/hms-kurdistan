"""Tests for the root hygiene files: .gitattributes, .gitignore, .editorconfig, .gitleaks.toml and .github/."""

from __future__ import annotations

import configparser
import re
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]

MODULES = [  # BUILD-PROMPT.md §5.2 (application modules under backend/modules/)
    "trust-identity", "trust-policy", "trust-audit", "trust-keys", "platform-tenancy", "platform-journal",
    "platform-config", "platform-i18n", "platform-tasks", "platform-docs", "platform-forms", "platform-notify",
    "platform-files", "platform-workflow", "platform-site", "empi", "scheduling", "adt", "orders", "medications",
    "results", "record", "nursing", "ed", "periop", "icu", "maternity", "lis", "ris", "transfusion", "cds",
    "terminology", "content", "safety-registry", "supply", "workforce", "him", "statutory", "quality", "migration",
]
REGULATED = ["reg-ews", "reg-transfusion", "reg-screening", "reg-lis-rules", "reg-dose"]


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


class GitAttributes(unittest.TestCase):
    def test_lf_everywhere_and_binary_types(self) -> None:
        lines = {line.strip() for line in read(".gitattributes").splitlines() if line.strip() and not line.startswith("#")}
        self.assertIn("* text=auto eol=lf", lines)
        for ext in ["pdf", "png", "jpg", "jpeg", "gif", "ico", "webp", "ttf", "otf", "woff", "woff2", "zip", "jar",
                    "gz", "tgz", "der", "p12", "jks"]:
            self.assertIn(f"*.{ext} binary", lines, ext)
        for line in ["*.bat text eol=crlf", "*.cmd text eol=crlf", "gradlew text eol=lf", "*.sh text eol=lf"]:
            self.assertIn(line, lines)


class GitIgnore(unittest.TestCase):
    IGNORED = [
        ".tools/jdk/bin/java", "backend/app-hms/build/libs/a.jar", "build/ci-logs/x.log", "backend/.gradle/x",
        "backend/.kotlin/x", "frontend/node_modules/react/index.js", "frontend/apps/web/node_modules/x",
        "frontend/reports/junit/a.xml", "coverage/lcov.info", "frontend/apps/web/dist/index.html",
        "content/licensed/loinc.zip", "content/licensed/snomed/x.txt", "secrets/server.key", "tls/cert.pem",
        "cosign.key", ".env", ".env.local", "deploy/.env.production", ".idea/workspace.xml", ".vscode/launch.json",
        "tools/run.log", "tools/hmstools/__pycache__/x.pyc",
    ]
    NOT_IGNORED = [
        "content/licensed/README.md", "cosign.pub", ".vscode/settings.json", ".vscode/extensions.json",
        "backend/build-logic/build.gradle.kts", "backend/gradlew", "docs/program/evidence/ci/x.json",
        "tools/hmstools/ci/runner.py",
    ]

    def test_contract_entries(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            subprocess.run(["git", "init", "-q", tmp], check=True, capture_output=True)
            shutil.copy(ROOT / ".gitignore", Path(tmp) / ".gitignore")
            paths = self.IGNORED + self.NOT_IGNORED
            proc = subprocess.run(
                ["git", "-C", tmp, "check-ignore", "--no-index", "-v", "-n", "--stdin"],
                input="\n".join(paths).encode(), capture_output=True, check=False,
            )
            verdicts = {}
            for line in proc.stdout.decode().splitlines():
                source, path = line.split("\t", 1)
                verdicts[path] = source != "::" and not source.split(":", 2)[2].startswith("!")
        for path in self.IGNORED:
            self.assertTrue(verdicts[path], f"{path} should be ignored")
        for path in self.NOT_IGNORED:
            self.assertFalse(verdicts[path], f"{path} should not be ignored")


class EditorConfig(unittest.TestCase):
    def test_settings(self) -> None:
        parser = configparser.ConfigParser()
        parser.read_string("[root]\n" + read(".editorconfig"))
        star = parser["*"]
        self.assertEqual(star["charset"], "utf-8")
        self.assertEqual(star["end_of_line"], "lf")
        self.assertEqual(star["insert_final_newline"], "true")
        self.assertEqual(parser["*.{kt,kts}"]["indent_size"], "4")
        self.assertEqual(parser["*.gradle"]["indent_size"], "4")
        section = next(s for s in parser.sections() if s.startswith("*.{ts,tsx"))
        for ext in ["ts", "json", "yaml", "yml", "md"]:
            self.assertIn(ext, section)
        self.assertEqual(parser[section]["indent_size"], "2")


class Gitleaks(unittest.TestCase):
    def test_extends_defaults_and_allowlists_only_fixture_paths(self) -> None:
        text = read(".gitleaks.toml")
        self.assertRegex(text, r"(?m)^\[extend\]\s*\nuseDefault = true")
        paths = re.findall(r"'''(.*?)'''", text)
        self.assertTrue(paths)
        for path in paths:
            self.assertIn("tests/fixtures/", path)
        self.assertNotRegex(text, r"(?m)^\s*regexes\s*=")
        self.assertNotRegex(text, r"(?m)^\s*stopwords\s*=")


class PullRequestTemplate(unittest.TestCase):
    def test_exactly_the_section_3_6_fields(self) -> None:
        headings = re.findall(r"(?m)^## (.+)$", read(".github/pull_request_template.md"))
        self.assertEqual(headings, ["Feature IDs", "Safety impact", "Invariants touched", "Change class", "Evidence",
                                    "Migration and rollback notes", "Documentation updated"])
        text = read(".github/pull_request_template.md")
        for detail in ["none / possible / yes", "hazard IDs", "C0 / C1 / C2", "Test summary",
                       "Screenshots in three languages", "Performance delta"]:
            self.assertIn(detail, text)


class CodeOwners(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.text = read(".github/CODEOWNERS")
        cls.rules = []
        for line in cls.text.splitlines():
            if line.strip() and not line.startswith("#"):
                pattern, *owners = line.split()
                cls.rules.append((pattern, owners))

    def owners_of(self, path: str) -> list[str]:
        found: list[str] = []
        for pattern, owners in self.rules:  # the last matching pattern wins
            if pattern == "*":
                match = True
            elif pattern.endswith("/"):
                match = ("/" + path).startswith(pattern)
            else:
                match = "/" + path == pattern
            if match:
                found = owners
        return found

    def test_placeholder_handles_and_header(self) -> None:
        self.assertIn("PLACEHOLDERS until a remote exists", self.text)
        for _, owners in self.rules:
            for owner in owners:
                self.assertRegex(owner, r"^@hms-kurdistan/[a-z][a-z-]+$")

    def test_every_module_has_an_owner_line(self) -> None:
        for module in MODULES:
            self.assertIn(f"/backend/modules/{module}/", [p for p, _ in self.rules], module)
        for module in REGULATED:
            self.assertIn(f"/backend/regulated/{module}/", [p for p, _ in self.rules], module)

    def test_clinical_safety_owns_the_safety_paths(self) -> None:
        for path in ["docs/safety/hazard-log.yaml", "docs/safety/signoffs/x.md", "backend/regulated/reg-ews/build.gradle.kts",
                     "backend/regulated/anything/x.kt", "docs/specs/state-machines/order.yaml"]:
            self.assertIn("@hms-kurdistan/clinical-safety", self.owners_of(path), path)

    def test_module_paths_resolve_to_their_squad(self) -> None:
        self.assertEqual(self.owners_of("backend/modules/empi/src/main/kotlin/X.kt"), ["@hms-kurdistan/patient-access-squad"])
        self.assertIn("@hms-kurdistan/medications-squad", self.owners_of("backend/modules/medications/x.kt"))
        self.assertEqual(self.owners_of("some/random/file.txt"), ["@hms-kurdistan/architecture"])


if __name__ == "__main__":
    unittest.main()
