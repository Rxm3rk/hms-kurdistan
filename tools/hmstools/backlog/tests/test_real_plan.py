"""The parser against the real plan of record (BUILD-PROMPT.md, read-only): counts, flags, WP mapping, A.18."""

from __future__ import annotations

import re
import unittest
from collections import defaultdict

from hmstools.backlog.check import run_check
from hmstools.backlog.commands import generate, render, spot_check
from hmstools.backlog.plan import build_records, load_plan, map_references, parse_plan
from hmstools.backlog.tests.synthetic import SyntheticRepo
from hmstools.backlog.totals import compare_a18
from hmstools.common import repo_root

# The §21 work packages of features checked by hand against BUILD-PROMPT.md §21 (Phase 0 to Phase 6, with
# qualifiers, shared tails and features in several WPs); recorded in
# docs/program/evidence/backlog/2026-10-18-spot-check.md (an earlier Windows run, not evidence of record). The
# spot check of record, docs/program/evidence/backlog/2026-10-19-spot-check-05f159a.md, does not repeat it.
HAND_CHECKED = {
    "PLT-CORE-01": ["WP-0.3"],
    "PLT-CORE-03": ["WP-0.5"],
    "PLT-OPS-06": ["WP-0.6"],
    "PLT-UX-03": ["WP-0.7 (base)"],
    "KRI-LOC-01": ["WP-0.7 (base)", "WP-1.10"],
    "TRU-REG-02": ["WP-0.9"],
    "PLT-CORE-02": ["WP-0.3", "WP-1.1 (full)"],
    "TRU-KEY-01": ["WP-0.4 (base)", "WP-1.13 (full)"],
    "PLT-CORE-06": ["WP-1.1 (non-device rules)"],
    "INT-ENG-01": ["WP-1.1b (base)", "WP-1.12 (full)"],
    "CLN-ORD-02": ["WP-1.4 (outpatient)", "WP-3.1 (inpatient)"],
    "CLN-CDS-02": ["WP-1.5 (outpatient subset)", "WP-3.1 (full)"],
    "OPS-STAT-02": ["WP-1.11", "WP-2.5 (MLC, births, deaths)"],
    "KRI-LOC-02": ["WP-1.10 (framework)"],
    "INT-FHIR-01": ["WP-1.12 (read)", "Phase 1.1 (FHIR SMART, Bulk and Subscriptions)"],
    "RCM-INS-01": ["WP-1.9", "Phase 1.1 (document-pack automation)"],
    "DX-LAB-03": [
        "WP-1.7",
        "Phase 1.1 (LIS autoverification v1 in `reg-lis-rules`, activated only where the Boundary Register allows)",
    ],
    "MED-DSP-01": ["WP-2.4"],
    "SPC-OT-03": ["WP-2.3 (charging and stock)", "WP-3.7 (clinical record)"],
    "SPC-MAT-01": ["WP-2.5 (newborn registration, mother–baby link, birth notification)", "WP-3.9 (L&D record)"],
    "PLT-UX-04": ["WP-3.3"],
    "CLN-CDS-05": ["WP-3.5 (`reg-ews`) and its fallback"],
    "DX-BB-02": ["WP-3.10 (optional)"],
    "IMP-MIG-01": ["WP-1.14", "WP-3.13 (inpatient pack)"],
    "DEV-GW-01": ["Phase 4 (the validated ICU monitor feed)"],
    "DEV-VAL-01": ["Phase 4 (the validated ICU monitor feed)"],
    "CLN-DOC-04": ["WP-3.12", "Phase 4 (release-of-information workflow automation)"],
    "OPS-STAT-01": ["WP-1.11", "Phase 4 (secondary statutory returns)"],
    "MED-DOSE-01": ["Phase 5 (the Dose Engine first; shadow mode ≥4 weeks, C2 activation)"],
    "RCM-SCH-01": ["WP-1.9"],
    "RCM-SCH-01 · part: scheme": ["Phase 5 (the scheme part)"],
    "CLN-CDS-06": ["Phase 5 (sepsis screen, Regulated Module #2)"],
    "AI-GW-01": ["Phase 5 (the AI platform and products; none of this starts before company gate G3, ≈M40, K-23)"],
    "PLT-OPS-03": ["Phase 6 (multi-site edge cell (after a dedicated reconciliation hazard analysis))"],
    "AI-AMB-01": ["Phase 6 (Sorani and Badini only after S8-K)"],
    "CLN-CDS-07": ["Phase 6"],
    "DFD-REC-01": ["WP-1.10"],
    "DFD-REC-01 · part: PHR push": [],
    "RCM-US-01": [],
}


def _plan_text() -> str:
    """BUILD-PROMPT.md as text with LF line endings, whatever the working-tree copy uses."""
    return (repo_root() / "BUILD-PROMPT.md").read_bytes().decode("utf-8").replace("\r\n", "\n")


class RealPlanTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.plan = load_plan(repo_root() / "BUILD-PROMPT.md")
        cls.mapping = map_references(cls.plan)
        cls.records = {
            (r["id"] if "part" not in r else f"{r['id']} · part: {r['part']}"): r for r in build_records(cls.plan, cls.mapping)
        }

    def test_234_feature_ids_and_two_part_rows(self) -> None:
        ids = [f.id for f in self.plan.features if f.part is None]
        self.assertEqual(len(ids), 234)
        self.assertEqual(len(set(ids)), 234)
        self.assertEqual(sorted(f.key for f in self.plan.features if f.part), ["DFD-REC-01 · part: PHR push", "RCM-SCH-01 · part: scheme"])
        self.assertEqual(len(self.plan.sections), 17)

    def test_flags(self) -> None:
        self.assertEqual((self.records["DX-BB-KRI-01"]["stance"], self.records["DX-BB-KRI-01"]["domain_level"]), ("B+I", True))
        self.assertEqual(sorted(k for k, r in self.records.items() if r["placement_marked"]), ["CLN-CDS-01", "CLN-CDS-02"])
        self.assertEqual(
            self.records["PLT-UX-04"]["kurdistan_note"],
            "One app: nurse mode (BCMA, R2b) + physician mode (K §6.6) · Placed R2b: Mobile app is needed for nurse BCMA in R2b",
        )

    def test_work_package_mapping(self) -> None:
        wp = {k: r["work_packages"] for k, r in self.records.items()}
        self.assertEqual(wp["PLT-CORE-02"], ["WP-0.3", "WP-1.1 (full)"])
        self.assertEqual(wp["TRU-KEY-01"], ["WP-0.4 (base)", "WP-1.13 (full)"])
        self.assertEqual(wp["CLN-ORD-02"], ["WP-1.4 (outpatient)", "WP-3.1 (inpatient)"])
        self.assertEqual(wp["PLT-CORE-06"], ["WP-1.1 (non-device rules)"])
        self.assertEqual(wp["INT-FHIR-01"], ["WP-1.12 (read)", "Phase 1.1 (FHIR SMART, Bulk and Subscriptions)"])
        self.assertEqual(wp["RCM-SCH-01"], ["WP-1.9"])
        self.assertEqual(wp["RCM-SCH-01 · part: scheme"], ["Phase 5 (the scheme part)"])
        self.assertEqual(wp["CLN-DOC-04"], ["WP-3.12", "Phase 4 (release-of-information workflow automation)"])
        self.assertEqual(wp["PLT-OPS-03"][0], "Phase 6 (multi-site edge cell (after a dedicated reconciliation hazard analysis))")
        self.assertEqual(wp["RCM-US-01"], [])
        self.assertEqual([(r.wp, r.target) for r in self.mapping.wildcards], [("WP-2.2", "RCM-*")])
        self.assertEqual(self.mapping.unknown, [])
        not_dropped = [k for k, r in self.records.items() if not r["work_packages"] and r["phase"] != "DROPPED-K"]
        self.assertEqual(not_dropped, [])

    def test_hand_checked_work_packages(self) -> None:
        for key, expected in HAND_CHECKED.items():
            with self.subTest(feature=key):
                self.assertEqual(self.records[key]["work_packages"], expected)

    def test_work_package_sets_match_a_line_based_reading_of_section_21(self) -> None:
        """Independent of the item and qualifier parsing: which WPs name which IDs, read line by line.

        Read: the WP cell and the Scope/Features cell of every §21 table row, and the first paragraph of the
        Phase 1.1, 4, 5 and 6 sections. Not read: Depends-on and Exit-evidence cells, intros and bullets.
        """
        token = re.compile(r"`([A-Z][A-Z0-9]*(?:-[A-Z0-9]+[a-z]?)+)`")
        lines = _plan_text().split("\n")
        start = next(i for i, line in enumerate(lines) if line.startswith("## 21."))
        end = next(i for i in range(start + 1, len(lines)) if lines[i].startswith("## "))
        expected: dict[str, set[str]] = defaultdict(set)
        phase, paragraph_read = None, set()
        for line in lines[start:end]:
            heading = re.match(r"### (Phase [\d.]+)", line)
            if heading:
                phase = heading.group(1)
            elif line.startswith("| **"):
                cells = [c.strip() for c in line.split("|")[1:-1]]
                wp = "WP-" + re.match(r"\*\*(\S+) ", cells[0]).group(1)
                for feature_id in token.findall(cells[0]) + token.findall(cells[2]):
                    expected[feature_id].add(wp)
            elif phase in ("Phase 1.1", "Phase 4", "Phase 5", "Phase 6") and line.strip() and phase not in paragraph_read:
                paragraph_read.add(phase)
                for feature_id in token.findall(line):
                    expected[feature_id].add(phase)
        derived: dict[str, set[str]] = defaultdict(set)
        for record in self.records.values():
            for label in record["work_packages"]:
                derived[record["id"]].add(label.split(" (")[0])
        self.assertEqual(len(paragraph_read), 4)
        self.assertEqual(dict(derived), dict(expected))
        self.assertEqual(len(derived), 234 - 14)  # every feature ID except the 14 DROPPED-K ones

    def test_a18_reconciles(self) -> None:
        for row in compare_a18(list(self.records.values()), self.plan.a18):
            with self.subTest(row=row.label):
                self.assertEqual((row.count_diff, row.ew_diff), (0, 0))


class RealPlanLineEndingTest(unittest.TestCase):
    """BUILD-PROMPT.md is checked out with CRLF on some hosts (this Windows working tree, and the git index,
    hold CRLF) and with LF on others. Both must give the same records, files and check result."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.lf = _plan_text()
        cls.crlf = cls.lf.replace("\n", "\r\n")

    def test_lf_and_crlf_parse_identically(self) -> None:
        lf, crlf = parse_plan(self.lf), parse_plan(self.crlf)
        self.assertEqual(len(lf.features), 236)
        self.assertEqual(build_records(lf), build_records(crlf))
        self.assertEqual([f.row for f in lf.features], [f.row for f in crlf.features])
        self.assertEqual(lf.references, crlf.references)
        self.assertEqual(lf.a18, crlf.a18)
        self.assertFalse(any("\r" in f.row.text for f in crlf.features))

    def test_generate_render_check_and_spot_check_do_not_depend_on_line_endings(self) -> None:
        outputs = []
        hazard_log = (repo_root() / "docs" / "safety" / "hazard-log.yaml").read_bytes().decode("utf-8")
        for text in (self.lf, self.crlf):
            # Temporary copies of the plan of record (byte for byte) and of the real hazard log.
            repo = SyntheticRepo(text, hazard_log=hazard_log.replace("\r\n", "\n"))
            try:
                self.assertEqual(repo.paths.source.read_bytes().count(b"\r\n"), text.count("\r\n"))
                generate(repo.paths)
                render(repo.paths)
                result = run_check(repo.paths)
                self.assertEqual(result.errors, [])
                self.assertEqual(result.counts["features"], 234)
                self.assertGreater(result.counts["features_with_hazards"], 0)
                outputs.append(
                    (
                        repo.paths.backlog.read_bytes(),
                        repo.paths.markdown.read_bytes(),
                        spot_check(repo.paths, seed=20261018, count=10),
                        result.to_dict(),
                    )
                )
            finally:
                repo.cleanup()
        self.assertEqual(outputs[0], outputs[1])
        yaml_bytes, markdown_bytes, spot, _ = outputs[0]
        self.assertNotIn(b"\r", yaml_bytes)
        self.assertNotIn(b"\r", markdown_bytes)
        self.assertNotIn("\r", spot)


if __name__ == "__main__":
    unittest.main()
