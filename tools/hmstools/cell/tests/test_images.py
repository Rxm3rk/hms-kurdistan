"""Registry, keys, mirror, sign and verify against a fake Docker (no network, no containers)."""

import json
import os
import tempfile
import unittest
from pathlib import Path

from hmstools.cell import config, images, signing
from hmstools.cell.proc import DockerRun, GuardError, Result, mem_available_gib, require_disk
from hmstools.cell.tests.test_config import GOOD

PUB = "-----BEGIN PUBLIC KEY-----\nAAECAwQFBgcICQ==\n-----END PUBLIC KEY-----\n"


class FakeDocker:
    """Answers the docker, k3d, crane and cosign command lines the cell tools build. `registry` maps a local
    'path:tag' to the digest it serves; `signed` holds the digests that verify."""

    def __init__(self, home: Path):
        self.home = home
        self.calls: list[tuple[list[str], dict]] = []
        self.registry: dict[str, str] = {}
        self.signed: set[str] = set()
        self.networks: dict[str, tuple[str, bool]] = {}
        self.container: tuple[str, bool] | None = None
        self.container_networks: set[str] = set()
        self.fail_copy = False

    def __call__(self, argv, env=None, timeout=600.0):
        argv = list(argv)
        self.calls.append((argv, dict(env or {})))
        if argv[:2] == ["docker", "network"]:
            return self.network(argv)
        if argv[:2] == ["docker", "inspect"]:
            if self.container is None:
                return Result(argv, 1, "", "No such object")
            if "{{json .NetworkSettings.Networks}}" in argv:
                return Result(argv, 0, json.dumps({n: {} for n in self.container_networks}))
            return Result(argv, 0, f"{self.container[0]}|{'true' if self.container[1] else 'false'}\n")
        if argv[:2] == ["docker", "start"]:
            self.container = (self.container[0], True)
            return Result(argv, 0)
        if argv[:3] == ["k3d", "registry", "create"]:
            self.container = (argv[argv.index("--image") + 1], True)
            self.container_networks.add(argv[argv.index("--default-network") + 1])
            return Result(argv, 0)
        if argv[:3] == ["docker", "run", "--rm"]:
            tool_args = argv[argv.index(next(a for a in argv if "@sha256:" in a and ("crane" in a or "cosign" in a))) + 1:]
            if "crane" in next(a for a in argv if "@sha256:" in a):
                return self.crane(argv, tool_args)
            return self.cosign(argv, tool_args, env or {})
        return Result(argv, 127, "", "unexpected command")

    def network(self, argv):
        if argv[2] == "inspect":
            name = argv[3]
            if name not in self.networks:
                return Result(argv, 1, "", "network not found")
            subnet, internal = self.networks[name]
            return Result(argv, 0, json.dumps([{"Subnet": subnet}]) + f"|{'true' if internal else 'false'}\n")
        if argv[2] == "create":
            self.networks[argv[-1]] = (argv[argv.index("--subnet") + 1], "--internal" in argv)
            return Result(argv, 0)
        if argv[2] == "connect":
            self.container_networks.add(argv[3])
            return Result(argv, 0)
        return Result(argv, 1)

    def crane(self, argv, args):
        if args[0] == "digest":
            key = args[1].split("/", 1)[1]
            if key in self.registry:
                return Result(argv, 0, self.registry[key] + "\n")
            return Result(argv, 1, "", "MANIFEST_UNKNOWN: manifest unknown")
        if args[0] == "copy":
            if self.fail_copy:
                return Result(argv, 1, "", "copy failed")
            source, dest = args[-2], args[-1]
            self.registry[dest.split("/", 1)[1]] = source.split("@", 1)[1]
            return Result(argv, 0)
        return Result(argv, 1)

    def cosign(self, argv, args, env):
        if args[0] == "generate-key-pair":
            keys = self.home / "keys"
            (keys / "cosign.key").write_text("ENCRYPTED", encoding="ascii")
            (keys / "cosign.pub").write_text(PUB, encoding="ascii")
            return Result(argv, 0)
        digest = args[-1].split("@", 1)[1]
        if args[0] == "sign":
            self.signed.add(digest)
            return Result(argv, 0)
        if args[0] == "verify":
            if digest in self.signed:
                payload = [{"critical": {"image": {"docker-manifest-digest": digest}}}]
                return Result(argv, 0, json.dumps(payload))
            return Result(argv, 1, "", "Error: no signatures found")
        return Result(argv, 1)

    def runs_of(self, tool):
        return [argv for argv, _ in self.calls if argv[:2] == ["docker", "run"] and any(tool in a and "@sha256:" in a for a in argv)]


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.home = Path(self.tmp.name) / "cell-home"
        cfg, errors = config.parse(GOOD)
        self.assertEqual(errors, [])
        self.cfg = cfg
        self.fake = FakeDocker(self.home)
        self.free = 30.0
        self.said: list[str] = []
        self.ctx = images.Ctx(cfg=cfg, home=self.home, env={"HMS_COSIGN_PASSWORD": "s3cret-pass"}, runner=self.fake,
                              say=self.said.append, http_get=lambda url: 200, free_gib=lambda: self.free)

    def tearDown(self):
        self.tmp.cleanup()

    def lite(self):
        return self.cfg.profile_images("lite")


class RegistryTest(Base):
    def test_creates_networks_and_the_registry_from_the_pinned_digest(self):
        steps = images.registry_up(self.ctx)
        self.assertEqual(self.fake.networks, {"n": ("10.213.0.0/24", False), "o": ("10.213.1.0/24", True)})
        create = next(argv for argv, _ in self.fake.calls if argv[:3] == ["k3d", "registry", "create"])
        self.assertEqual(create[create.index("--image") + 1], f"docker.io/distribution/distribution@{self.cfg.image('registry').digest}")
        self.assertEqual(create[create.index("--port") + 1], "127.0.0.1:5000")
        self.assertIn("o", self.fake.container_networks)
        self.assertTrue(any("200" in s for s in steps))

    def test_idempotent(self):
        images.registry_up(self.ctx)
        calls = len(self.fake.calls)
        steps = images.registry_up(self.ctx)
        self.assertFalse(any(argv[:3] == ["k3d", "registry", "create"] for argv, _ in self.fake.calls[calls:]))
        self.assertTrue(any("running" in s for s in steps))

    def test_a_registry_from_another_image_is_refused(self):
        self.fake.container = ("docker.io/library/registry:2", True)
        with self.assertRaises(images.CellError):
            images.registry_up(self.ctx)

    def test_a_network_with_another_subnet_is_refused(self):
        self.fake.networks["o"] = ("10.99.0.0/24", True)
        with self.assertRaises(images.CellError):
            images.registry_up(self.ctx)

    def test_an_offline_network_that_is_not_internal_is_refused(self):
        self.fake.networks["o"] = ("10.213.1.0/24", False)
        with self.assertRaises(images.CellError):
            images.registry_up(self.ctx)


class MirrorTest(Base):
    def test_copies_by_digest_then_is_idempotent(self):
        outcomes = images.mirror(self.ctx, self.lite())
        self.assertTrue(all(o.ok and o.action == "copied" for o in outcomes), [o.to_dict() for o in outcomes])
        for argv in self.fake.runs_of("crane"):
            self.assertEqual(argv[argv.index("--network") + 1], "host")
            self.assertNotIn("--insecure", argv)
        copies = [argv for argv in self.fake.runs_of("crane") if "copy" in argv]
        self.assertEqual(len(copies), 3)
        for argv in copies:
            self.assertEqual(argv[argv.index("--platform") + 1], "linux/amd64")
            self.assertRegex(argv[-2], r"@sha256:[0-9a-f]{64}$")
            self.assertTrue(argv[-1].startswith("localhost:5000/"))
        before = len(self.fake.runs_of("crane"))
        again = images.mirror(self.ctx, self.lite())
        self.assertTrue(all(o.action == "present" for o in again))
        self.assertFalse(any("copy" in argv for argv in self.fake.runs_of("crane")[before:]))

    def test_a_moved_local_tag_is_an_error_and_never_overwritten(self):
        db = self.cfg.image("db")
        self.fake.registry[f"{db.local}:{db.tag}"] = "sha256:" + "9" * 64
        outcomes = {o.name: o for o in images.mirror(self.ctx, self.lite())}
        self.assertFalse(outcomes["db"].ok)
        self.assertIn("not overwritten", outcomes["db"].detail)
        self.assertEqual(self.fake.registry[f"{db.local}:{db.tag}"], "sha256:" + "9" * 64)

    def test_the_disk_guard_stops_before_any_pull(self):
        self.free = 14.9
        with self.assertRaises(GuardError) as caught:
            images.mirror(self.ctx, self.lite())
        self.assertIn("DN-013", str(caught.exception))
        self.assertFalse(any("copy" in argv for argv in self.fake.runs_of("crane")))

    def test_a_failed_copy_fails_that_image(self):
        self.fake.fail_copy = True
        outcomes = images.mirror(self.ctx, self.lite())
        self.assertTrue(all(not o.ok for o in outcomes))


class KeysTest(Base):
    def test_without_a_passphrase_it_fails_closed(self):
        self.ctx.env = {}
        with self.assertRaises(signing.SigningError):
            images.keys_init(self.ctx)
        self.assertEqual(self.fake.runs_of("cosign"), [])

    def test_generate_passphrase_writes_a_private_file_and_says_so(self):
        self.ctx.env = {}
        steps = images.keys_init(self.ctx, generate_passphrase=True)
        secret_file = self.home / "cosign.password"
        self.assertTrue(secret_file.exists())
        if os.name == "posix":
            self.assertEqual(secret_file.stat().st_mode & 0o777, 0o600)
            self.assertEqual((self.home / "keys" / "cosign.key").stat().st_mode & 0o777, 0o600)
        self.assertTrue(any("generated a random passphrase" in s for s in steps))
        argv, env = next((a, e) for a, e in self.fake.calls if any("cosign" in x and "@sha256:" in x for x in a))
        value = secret_file.read_text(encoding="utf-8").strip()
        self.assertNotIn(value, " ".join(argv))  # never on the command line
        self.assertEqual(env["COSIGN_PASSWORD"], value)
        self.assertEqual(argv[argv.index("--network") + 1], "none")
        self.assertTrue(any(s.startswith("public key fingerprint SHA256:") for s in steps))
        self.assertEqual(signing.signing_config_problems(json.loads((self.home / "signing-config.json").read_text())), [])

    def test_existing_keys_are_kept(self):
        images.keys_init(self.ctx)
        calls = len(self.fake.runs_of("cosign"))
        steps = images.keys_init(self.ctx)
        self.assertEqual(len(self.fake.runs_of("cosign")), calls)
        self.assertTrue(any("present" in s for s in steps))


class SignVerifyTest(Base):
    def setUp(self):
        super().setUp()
        images.keys_init(self.ctx)
        images.mirror(self.ctx, self.lite())

    def test_sign_then_verify_offline(self):
        outcomes = images.sign(self.ctx, self.lite())
        self.assertTrue(all(o.ok and o.action == "signed" for o in outcomes), [o.to_dict() for o in outcomes])
        for argv in self.fake.runs_of("cosign"):
            if "generate-key-pair" in argv:
                continue
            self.assertEqual(argv[argv.index("--network") + 1], "o")  # the internal network
            self.assertNotIn("s3cret-pass", " ".join(argv))
            for arg in argv:
                self.assertIsNone(signing.FORBIDDEN.match(arg), arg)
        signs = [argv for argv in self.fake.runs_of("cosign") if "sign" in argv and "verify" not in argv]
        self.assertTrue(all(argv[-1].startswith("k3d-r.localhost:5000/") and "@sha256:" in argv[-1] for argv in signs))
        verified = images.verify(self.ctx, self.lite())
        self.assertTrue(all(o.ok and o.verified for o in verified))
        details = images.record_details(self.ctx, "lite", verified, 29.0)
        self.assertEqual(details["counts"], {"images": 3, "present": 3, "verified": 3, "failed": 0})
        self.assertTrue(details["signing"]["public_key_fingerprint"].startswith("SHA256:"))
        self.assertEqual(details["pin_set_sha256"], self.cfg.pin_set_sha256)

    def test_already_signed_images_are_not_signed_again(self):
        images.sign(self.ctx, self.lite())
        before = len(self.fake.runs_of("cosign"))
        outcomes = images.sign(self.ctx, self.lite())
        self.assertTrue(all(o.action == "already signed" for o in outcomes))
        self.assertFalse(any("sign" in argv and "verify" not in argv for argv in self.fake.runs_of("cosign")[before:]))

    def test_sign_without_a_passphrase_fails_before_running_anything(self):
        self.ctx.env = {}
        before = len(self.fake.calls)
        with self.assertRaises(signing.SigningError):
            images.sign(self.ctx, self.lite())
        self.assertEqual(len(self.fake.calls), before)

    def test_a_tampered_signing_config_is_refused(self):
        path = self.home / "signing-config.json"
        data = json.loads(path.read_text())
        data["rekorTlogUrls"] = [{"url": "https://rekor.sigstore.dev"}]
        path.write_text(json.dumps(data))
        with self.assertRaises(images.CellError):
            images.sign(self.ctx, self.lite())

    def test_unsigned_and_missing_images_fail_verification(self):
        outcomes = {o.name: o for o in images.verify(self.ctx, self.lite())}
        self.assertTrue(all(not o.ok for o in outcomes.values()))
        db = self.cfg.image("db")
        del self.fake.registry[f"{db.local}:{db.tag}"]
        images.sign(self.ctx, [self.cfg.image("k3s")])
        outcomes = {o.name: o for o in images.verify(self.ctx, self.lite())}
        self.assertTrue(outcomes["k3s"].ok)
        self.assertFalse(outcomes["db"].present)
        self.assertFalse(outcomes["registry"].ok)


class ProcTest(unittest.TestCase):
    def test_docker_run_passes_secrets_by_name_only(self):
        argv = DockerRun("img@sha256:" + "1" * 64, ["x"], network="o", user="1000:1000",
                         mounts=[("/h/keys", "/keys", True)], env_names=["COSIGN_PASSWORD"],
                         env_values={"HOME": "/tmp"}).argv()
        self.assertEqual(argv[:3], ["docker", "run", "--rm"])
        self.assertIn("COSIGN_PASSWORD", argv)
        self.assertIn("/h/keys:/keys:ro", argv)
        self.assertIn("HOME=/tmp", argv)
        self.assertEqual(argv[-2:], ["img@sha256:" + "1" * 64, "x"])

    def test_mem_available(self):
        self.assertAlmostEqual(mem_available_gib("MemTotal: 10 kB\nMemAvailable:    7340032 kB\n"), 7.0)
        self.assertIsNone(mem_available_gib("MemTotal: 10 kB\n"))

    def test_disk_guard(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertGreater(require_disk(Path(tmp), 0, "t"), 0)
            with self.assertRaises(GuardError):
                require_disk(Path(tmp), 10 ** 9, "t")
            with self.assertRaises(GuardError):
                require_disk(Path(tmp) / "missing", 1, "t")


if __name__ == "__main__":
    unittest.main()
