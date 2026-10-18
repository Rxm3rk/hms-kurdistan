"""The WORM test's verdict, against fake S3 servers that do and do not enforce Object Lock."""

import threading
import unittest
import urllib.parse
import xml.etree.ElementTree as ET
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from hmstools.cell.s3 import S3Client
from hmstools.cell.worm import recheck_worm, run_worm

NS = "{http://s3.amazonaws.com/doc/2006-03-01/}"


class FakeS3(ThreadingHTTPServer):
    """Path-style S3 subset: buckets, versioned objects, retention. `enforce` toggles Object Lock."""

    def __init__(self, enforce: bool, lock_supported: bool = True):
        super().__init__(("127.0.0.1", 0), Handler)
        self.enforce, self.lock_supported = enforce, lock_supported
        self.buckets: dict = {}
        self.counter = 0


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):  # keep test output quiet
        pass

    def _parts(self):
        url = urllib.parse.urlsplit(self.path)
        bits = [urllib.parse.unquote(p) for p in url.path.split("/") if p]
        query = dict(urllib.parse.parse_qsl(url.query, keep_blank_values=True))
        return (bits[0] if bits else ""), ("/".join(bits[1:]) if len(bits) > 1 else ""), query

    def _send(self, status, body=b"", headers=None):
        self.send_response(status)
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _error(self, status, code):
        self._send(status, ("<Error><Code>" + code + "</Code></Error>").encode())

    def _body(self):
        return self.rfile.read(int(self.headers.get("Content-Length") or 0))

    def do_PUT(self):
        s = self.server
        bucket, key, query = self._parts()
        body = self._body()
        if not key:
            if self.headers.get("x-amz-bucket-object-lock-enabled") and not s.lock_supported:
                return self._error(501, "NotImplemented")
            s.buckets[bucket] = {}
            return self._send(200)
        versions = s.buckets[bucket].setdefault(key, {})
        if "retention" in query:
            v = versions.get(query.get("versionId"))
            if v is None:
                return self._error(404, "NoSuchVersion")
            root = ET.fromstring(body)
            mode, until = root.find(NS + "Mode").text, root.find(NS + "RetainUntilDate").text
            if s.enforce and v["mode"] == "COMPLIANCE" and (mode != "COMPLIANCE" or until < v["until"]):
                return self._error(403, "AccessDenied")
            v["mode"], v["until"] = mode, until
            return self._send(200)
        s.counter += 1
        vid = "v" + str(s.counter)
        versions[vid] = {"body": body, "mode": self.headers.get("x-amz-object-lock-mode"),
                         "until": self.headers.get("x-amz-object-lock-retain-until-date")}
        return self._send(200, headers={"x-amz-version-id": vid})

    def do_GET(self):
        bucket, key, query = self._parts()
        v = self.server.buckets.get(bucket, {}).get(key, {}).get(query.get("versionId"))
        if v is None:
            return self._error(404, "NoSuchVersion")
        if "retention" in query:
            xml = ('<Retention xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Mode>' + v["mode"]
                   + "</Mode><RetainUntilDate>" + v["until"] + "</RetainUntilDate></Retention>")
            return self._send(200, xml.encode())
        return self._send(200, v["body"])

    def do_DELETE(self):
        s = self.server
        bucket, key, query = self._parts()
        if not key:
            if any(s.buckets.get(bucket, {}).values()):
                return self._error(409, "BucketNotEmpty")
            s.buckets.pop(bucket, None)
            return self._send(204)
        versions = s.buckets[bucket].get(key, {})
        v = versions.get(query.get("versionId"))
        if v is None:
            return self._error(404, "NoSuchVersion")
        if s.enforce and v["mode"] == "COMPLIANCE":
            return self._error(403, "AccessDenied")
        del versions[query["versionId"]]
        if not versions:
            del s.buckets[bucket][key]
        return self._send(204)


class WormVerdictTest(unittest.TestCase):
    def run_against(self, **kwargs):
        server = FakeS3(**kwargs)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            client = S3Client("http://127.0.0.1:" + str(server.server_address[1]), "SYN-AK", "SYN-SK", timeout=5)
            return run_worm(client)
        finally:
            server.shutdown()
            server.server_close()

    def test_enforcing_server_passes(self):
        report = self.run_against(enforce=True)
        self.assertTrue(report.passed, [c.to_dict() for c in report.cases])
        self.assertEqual([c.id for c in report.cases],
                         ["W01", "W02", "W03", "W04", "W05", "W06", "W07", "W08", "W09", "W10", "W11"])

    def test_server_that_deletes_locked_objects_fails(self):
        report = self.run_against(enforce=False)
        self.assertFalse(report.passed)
        failed = {c.id for c in report.cases if not c.passed and not c.informational}
        # The locked version is deleted at W04, so every later refusal sees a 404 and must not pass;
        # the now-empty bucket can then be deleted too (W08), which removes the control's bucket (W10).
        self.assertTrue({"W04", "W05", "W06", "W07", "W08", "W09"} <= failed, failed)
        self.assertTrue(all(c.passed for c in report.cases if c.id in {"W01", "W02", "W03"}))

    def test_server_without_object_lock_fails_early(self):
        report = self.run_against(enforce=True, lock_supported=False)
        self.assertFalse(report.passed)
        self.assertIsNotNone(report.error)
        self.assertEqual(len(report.cases), 1)

    def test_recheck_after_restart(self):
        for enforce in (True, False):
            server = FakeS3(enforce=True)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                client = S3Client("http://127.0.0.1:" + str(server.server_address[1]), "SYN-AK", "SYN-SK", timeout=5)
                first = run_worm(client)
                self.assertTrue(first.passed)
                server.enforce = enforce  # a "restart" that keeps (True) or loses (False) the lock
                again = recheck_worm(client, first.bucket, first.key, first.version, first.sha256)
                self.assertEqual(again.passed, enforce, [c.to_dict() for c in again.cases])
            finally:
                server.shutdown()
                server.server_close()

    def test_unreachable_endpoint_fails(self):
        report = run_worm(S3Client("http://127.0.0.1:9", "SYN-AK", "SYN-SK", timeout=2))
        self.assertFalse(report.passed)
        self.assertIn("cannot reach", report.error or "")


if __name__ == "__main__":
    unittest.main()
