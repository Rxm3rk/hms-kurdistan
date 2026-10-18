"""`tools/hms cell worm` end to end against the fake S3 server: --state, --recheck, exit codes."""

import contextlib
import io
import json
import os
import tempfile
import threading
import unittest
from pathlib import Path
from unittest import mock

from hmstools.cell.__main__ import main
from hmstools.cell.tests.test_worm import FakeS3

CREDS = {"HMS_S3_ACCESS_KEY": "SYN-AK", "HMS_S3_SECRET_KEY": "SYN-SK"}


class CellCliTest(unittest.TestCase):
    def setUp(self):
        self.server = FakeS3(enforce=True)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.url = "http://127.0.0.1:" + str(self.server.server_address[1])
        self.tmp = tempfile.TemporaryDirectory()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.tmp.cleanup()

    def run_cli(self, *argv):
        out = io.StringIO()
        with contextlib.redirect_stdout(out), mock.patch.dict(os.environ, CREDS):
            code = main(list(argv))
        return code, out.getvalue()

    def test_worm_state_then_recheck(self):
        state = str(Path(self.tmp.name) / "state.json")
        code, out = self.run_cli("worm", "--endpoint", self.url, "--label", "fake", "--state", state)
        self.assertEqual(code, 0, out)
        self.assertIn("worm [fake, cell compose]: PASS", out)
        recorded = json.loads(Path(state).read_text(encoding="utf-8"))
        self.assertEqual(set(recorded), {"bucket", "key", "version", "sha256"})

        code, out = self.run_cli("worm", "--recheck", state, "--endpoint", self.url, "--label", "fake")
        self.assertEqual(code, 0, out)
        self.assertIn("worm-recheck [fake, cell compose]: PASS", out)

        self.server.enforce = False  # a restart that lost the lock
        code, out = self.run_cli("worm", "--recheck", state, "--endpoint", self.url, "--label", "fake")
        self.assertEqual(code, 1, out)

    def test_json_line_is_last(self):
        code, out = self.run_cli("worm", "--endpoint", self.url, "--label", "fake", "--json")
        self.assertEqual(code, 0)
        last = json.loads(out.strip().splitlines()[-1])
        self.assertEqual((last["check"], last["ok"], last["cell"]), ("worm", True, "compose"))

    def test_missing_credentials_is_an_environment_error(self):
        err = io.StringIO()
        with contextlib.redirect_stderr(err), mock.patch.dict(os.environ, {}, clear=True):
            code = main(["worm", "--endpoint", self.url, "--label", "fake"])
        self.assertEqual(code, 2)
        self.assertIn("HMS_S3_ACCESS_KEY", err.getvalue())


if __name__ == "__main__":
    unittest.main()
