"""Offline signing: the cosign argument builders, the signing configuration and the output parsers (§4.3)."""

import base64
import hashlib
import json
import unittest

from hmstools.cell import signing

REF = "k3d-r.localhost:5000/rancher/k3s@sha256:" + "1" * 64
DIGEST = "sha256:" + "1" * 64


class ArgumentBuilderTest(unittest.TestCase):
    BANNED = ("tlog-upload", "fulcio", "rekor-url", "identity-token", "oidc", "keyless", "use-signing-config",
              "certificate-identity", "timestamp-server")

    def all_argvs(self):
        return {"generate": signing.generate_key_pair_args(), "sign": signing.sign_args(REF),
                "verify": signing.verify_args(REF)}

    def test_no_keyless_fulcio_rekor_or_upload_option_ever_appears(self):
        for name, argv in self.all_argvs().items():
            for arg in argv:
                for banned in self.BANNED:
                    self.assertNotIn(banned, arg, f"{name}: {argv}")

    def test_sign_uses_the_cell_key_and_the_service_free_signing_config(self):
        argv = signing.sign_args(REF)
        self.assertEqual(argv[0], "sign")
        self.assertEqual(argv[argv.index("--key") + 1], "/keys/cosign.key")
        self.assertEqual(argv[argv.index("--signing-config") + 1], "/cfg/signing-config.json")
        self.assertEqual(argv[-1], REF)

    def test_verify_uses_the_public_key_and_the_offline_option(self):
        argv = signing.verify_args(REF)
        self.assertEqual(argv[argv.index("--key") + 1], "/keys/cosign.pub")
        self.assertIn("--insecure-ignore-tlog=true", argv)

    def test_tags_are_refused(self):
        for builder in (signing.sign_args, signing.verify_args):
            with self.assertRaises(signing.SigningError):
                builder("k3d-r.localhost:5000/rancher/k3s:v1")

    def test_the_guard_rejects_every_forbidden_option(self):
        for bad in ("--tlog-upload=false", "--tlog-upload", "--fulcio-url=https://x", "--rekor-url=https://x",
                    "--identity-token=t", "--oidc-issuer=https://x", "--use-signing-config=true",
                    "--certificate-identity=me", "--timestamp-server-url=https://x", "--sk"):
            with self.assertRaises(signing.SigningError, msg=bad):
                signing.check_argv(["sign", bad, REF])
        self.assertEqual(signing.check_argv(["verify", "--insecure-ignore-tlog=true", REF])[0], "verify")


class SigningConfigTest(unittest.TestCase):
    def test_it_names_no_service(self):
        data = json.loads(signing.signing_config_text())
        self.assertEqual(signing.signing_config_problems(data), [])
        for key in ("caUrls", "oidcUrls", "rekorTlogUrls", "tsaUrls"):
            self.assertEqual(data[key], [])

    def test_a_config_naming_rekor_is_refused(self):
        data = signing.signing_config()
        data["rekorTlogUrls"] = [{"url": "https://rekor.sigstore.dev"}]
        self.assertTrue(any("rekorTlogUrls" in p for p in signing.signing_config_problems(data)))
        self.assertTrue(signing.signing_config_problems([]))


class ParserTest(unittest.TestCase):
    def payload(self, digest=DIGEST):
        return {"critical": {"identity": {"docker-reference": "r/x"}, "image": {"docker-manifest-digest": digest},
                             "type": "https://sigstore.dev/cosign/sign/v1"}, "optional": {}}

    def test_a_verified_payload_for_the_digest_passes(self):
        ok, detail = signing.parse_verify_output("\n" + json.dumps([self.payload()]) + "\n", DIGEST)
        self.assertTrue(ok, detail)

    def test_text_before_the_json_is_skipped(self):
        ok, _ = signing.parse_verify_output("Verification for ...\n" + json.dumps([self.payload()]), DIGEST)
        self.assertTrue(ok)

    def test_failures(self):
        other = "sha256:" + "2" * 64
        for stdout in ("", "[]", "not json [", json.dumps([self.payload(other)]),
                       json.dumps([self.payload(), self.payload(other)]), json.dumps([{"critical": {}}])):
            ok, _ = signing.parse_verify_output(stdout, DIGEST)
            self.assertFalse(ok, stdout)

    def test_public_key_fingerprint_is_the_sha256_of_the_der(self):
        der = bytes(range(91))
        body = base64.b64encode(der).decode()
        pem = f"-----BEGIN PUBLIC KEY-----\n{body[:64]}\n{body[64:]}\n-----END PUBLIC KEY-----\n"
        self.assertEqual(signing.public_key_fingerprint(pem), "SHA256:" + hashlib.sha256(der).hexdigest())
        with self.assertRaises(signing.SigningError):
            signing.public_key_fingerprint("nope")


class PassphraseTest(unittest.TestCase):
    def test_it_fails_closed_without_the_variable(self):
        with self.assertRaises(signing.SigningError):
            signing.passphrase({})
        with self.assertRaises(signing.SigningError):
            signing.passphrase({"HMS_COSIGN_PASSWORD": ""})
        self.assertEqual(signing.passphrase({"HMS_COSIGN_PASSWORD": "p"}), "p")

    def test_generated_passphrases_are_long_and_distinct(self):
        a, b = signing.new_passphrase(), signing.new_passphrase()
        self.assertNotEqual(a, b)
        self.assertGreaterEqual(len(a), 40)


if __name__ == "__main__":
    unittest.main()
