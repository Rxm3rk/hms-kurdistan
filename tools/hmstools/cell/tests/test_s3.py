"""SigV4 signing for the cell's S3 test client."""

import unittest
from datetime import datetime, timezone

from hmstools.cell.s3 import canonical_query, parse_retention, retention_xml, sign, uri_encode

# The worked example "GET Object" from the AWS S3 documentation for Signature Version 4
# (Authenticating Requests: Using the Authorization Header). Its documented signature is the oracle.
AWS_ACCESS = "AKIAIOSFODNN7EXAMPLE"
AWS_SECRET = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
EMPTY = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"


class SigV4Test(unittest.TestCase):
    def test_aws_documented_get_object_example(self):
        headers = sign("GET", "/test.txt", {}, {"Host": "examplebucket.s3.amazonaws.com", "Range": "bytes=0-9"},
                       EMPTY, AWS_ACCESS, AWS_SECRET, "us-east-1", "20130524T000000Z")
        self.assertEqual(
            headers["authorization"],
            "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, "
            "SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, "
            "Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41",
        )

    def test_uri_encoding_and_query(self):
        self.assertEqual(uri_encode("a b/c~", True), "a%20b/c~")
        self.assertEqual(uri_encode("a/b", False), "a%2Fb")
        self.assertEqual(canonical_query({"versionId": "x y", "retention": ""}), "retention=&versionId=x%20y")

    def test_retention_round_trip(self):
        body = retention_xml("COMPLIANCE", datetime(2026, 10, 20, 12, 0, 0, tzinfo=timezone.utc))
        self.assertEqual(parse_retention(body), ("COMPLIANCE", "2026-10-20T12:00:00.000Z"))


if __name__ == "__main__":
    unittest.main()
