"""Cell evidence records: the cell label and the dirty flag."""

import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from hmstools.cell import evidence


def git(root, *args):
    subprocess.run(["git", "-C", str(root), *args], check=True, capture_output=True)


class EvidenceTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        git(self.root, "init", "-q")
        git(self.root, "-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "-q", "--allow-empty", "-m", "x")

    def tearDown(self):
        self.tmp.cleanup()

    def record(self, label):
        path = evidence.write(self.root, "worm", label, "compose", evidence.now_iso(), "PASS", {"k": 1})
        return path, json.loads(path.read_text(encoding="utf-8"))

    def test_untracked_evidence_outputs_do_not_make_later_records_dirty(self):
        first, rec1 = self.record("a")
        second, rec2 = self.record("b")
        self.assertFalse(rec1["git"]["dirty"])
        self.assertFalse(rec2["git"]["dirty"], rec2["git"])
        self.assertEqual(rec2["git"]["untracked_evidence_outputs_ignored"], 1)
        self.assertNotIn("-dirty", second.name)
        self.assertEqual(rec2["cell"], "compose")
        self.assertEqual(rec2["standing"], "indicative (compose stack, not a cell)")

    def test_other_untracked_files_still_count(self):
        (self.root / "scratch.txt").write_text("x", encoding="utf-8")
        path, rec = self.record("c")
        self.assertTrue(rec["git"]["dirty"])
        self.assertIn("-dirty", path.name)

    def test_a_rerun_with_the_same_name_never_overwrites(self):
        first, rec1 = self.record("same")
        second, _ = self.record("same")
        third, _ = self.record("same")
        stem = first.name[:-len(".json")]
        self.assertEqual(second.name, stem + "-2.json")
        self.assertEqual(third.name, stem + "-3.json")
        self.assertEqual(json.loads(first.read_text(encoding="utf-8")), rec1)

    def test_an_empty_label_is_left_out_and_a_scratch_directory_can_be_named(self):
        scratch = self.root / "scratch-out"
        path = evidence.write(self.root, "images", "", "lite", evidence.now_iso(), "PASS", {}, directory=scratch)
        self.assertEqual(path.parent, scratch)
        self.assertRegex(path.name, r"^\d{4}-\d{2}-\d{2}-images-[0-9a-f]{7,}(-dirty)?\.json$")
        self.assertFalse((self.root / "docs" / "program" / "evidence" / "cell").exists())
        self.assertEqual(json.loads(path.read_text(encoding="utf-8"))["standing"], "lite")

    def test_unknown_cell_is_refused(self):
        with self.assertRaises(ValueError):
            evidence.write(self.root, "worm", "x", "laptop", evidence.now_iso(), "PASS", {})


if __name__ == "__main__":
    unittest.main()
