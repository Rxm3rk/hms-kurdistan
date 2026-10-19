"""The substrate (`cell up --only substrate`, start, stop, status) and R1 against a fake cell: fake Docker, k3d and
kubectl answering from the lite-cell fixtures, a fake clock, and no network, containers or sleeping."""

import contextlib
import copy
import functools
import io
import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest import mock

from hmstools.cell import config, images, k3d, kube
from hmstools.cell.proc import GuardError, Result
from hmstools.cell.tests.test_docker import fixture

ROOT = Path(__file__).resolve().parents[4]
NET = "k3d-hms-lite"
SERVERS = ["k3d-hms-lite-server-0", "k3d-hms-lite-server-1", "k3d-hms-lite-server-2"]
LB = "k3d-hms-lite-serverlb"
REGISTRY = "k3d-hms-registry.localhost"
EPOCH = 1_792_400_000.0


@functools.lru_cache(maxsize=None)
def cell_config():
    return config.load(ROOT / config.CELL_YAML)  # parsed once: PyYAML is slow on the Windows host


@functools.lru_cache(maxsize=None)
def profile(name):
    return k3d.load_profile(ROOT, name)


@functools.lru_cache(maxsize=None)
def scenario_text():
    return json.dumps(k3d.load_scenario(ROOT, "cell-restart"))


class FakeCell:
    """Answers the docker, k3d, kubectl and ip command lines of the substrate code from the fixtures."""

    def __init__(self, clock):
        self.clock = clock
        self.calls: list[list[str]] = []
        self.envs: list[dict] = []
        self.created = False
        self.containers: dict[str, dict] = {}
        self.registry = json.loads(fixture("docker-inspect-registry.json"))[0]
        self.registry["NetworkSettings"]["Networks"].pop(NET)
        self.api_delay = 20.0  # seconds from the last node start to /readyz ok
        self.api_ready_at = 0.0
        self.never_ready = False
        self.members = json.loads(fixture("etcd-members-lite.json"))
        self.rotate_members_on_start = False

    # --- state
    def make_cluster(self, running=True):
        self.created = True
        for entry in json.loads(fixture("docker-inspect-lite.json")):
            entry = copy.deepcopy(entry)
            entry["State"]["Running"] = running
            if not running:
                entry["NetworkSettings"]["Networks"][NET]["IPAddress"] = ""
            self.containers[entry["Name"].lstrip("/")] = entry
        self.join_registry(fixed=True)
        self.api_ready_at = self.clock.t

    def join_registry(self, fixed):
        self.registry["NetworkSettings"]["Networks"][NET] = {
            "IPAMConfig": {"IPv4Address": "10.213.2.2"} if fixed else None, "IPAddress": "10.213.2.2",
            "Aliases": [REGISTRY], "Gateway": "10.213.2.1", "IPPrefixLen": 24}

    def running(self, name):
        return self.containers[name]["State"]["Running"]

    def api_ok(self):
        return (self.created and not self.never_ready and all(self.running(s) for s in SERVERS)
                and self.clock.t >= self.api_ready_at)

    def everything(self):
        return {**self.containers, REGISTRY: self.registry}

    # --- the runner
    def __call__(self, argv, env=None, timeout=600.0):
        argv = list(argv)
        self.calls.append(argv)
        self.envs.append(dict(env or {}))
        ok = lambda out="": Result(argv, 0, out)  # noqa: E731
        if argv[:3] == ["docker", "ps", "-a"]:
            return ok("\n".join(sorted(self.containers)) + "\n" if self.created else "")
        if argv[:2] == ["docker", "inspect"] and "--format" not in argv:
            found = []
            for name in argv[2:]:
                if name not in self.everything():
                    return Result(argv, 1, "[]", f"Error: No such object: {name}")
                found.append(self.everything()[name])
            return ok(json.dumps(found))
        if argv[:2] == ["docker", "network"]:
            return self.network(argv)
        if argv[:2] == ["docker", "update"]:
            policy = argv[2].split("=", 1)[1]
            for name in argv[3:]:
                self.containers[name]["HostConfig"]["RestartPolicy"]["Name"] = policy
            return ok()
        if argv[:2] == ["docker", "kill"]:
            for name in argv[2:]:
                self.set_running(name, False)
            return ok()
        if argv[:2] == ["docker", "stop"]:
            for name in argv[4:]:
                self.set_running(name, False)
            return ok()
        if argv[:2] == ["docker", "start"]:
            for name in argv[2:]:
                self.set_running(name, True)
            self.api_ready_at = self.clock.t + self.api_delay
            if self.rotate_members_on_start:
                self.members["members"][0]["ID"] += 1
            return ok()
        if argv[:2] == ["docker", "exec"]:
            return ok(fixture("etcd-config-server-0.yaml"))
        if argv[:3] == ["k3d", "cluster", "create"]:
            self.make_cluster()
            lb = self.containers[LB]["NetworkSettings"]["Networks"][NET]
            lb["IPAMConfig"] = None  # k3d 5.8.3 fixes only the nodes
            self.join_registry(fixed=False)
            return ok()
        if argv[:3] == ["k3d", "kubeconfig", "get"]:
            return ok("apiVersion: v1\nkind: Config\n")
        if argv[0] == "kubectl":
            return self.kubectl(argv)
        if argv[:2] == ["ip", "-j"]:
            routes = json.loads(fixture("ip-route.json"))  # captured while the cell ran: its own bridge route too
            return ok(json.dumps([r for r in routes if self.created or r.get("dst") != "10.213.2.0/24"]))
        return Result(argv, 127, "", "unexpected command")

    def set_running(self, name, running):
        entry = self.containers[name]
        entry["State"]["Running"] = running
        endpoint = entry["NetworkSettings"]["Networks"][NET]
        endpoint["IPAddress"] = (endpoint.get("IPAMConfig") or {}).get("IPv4Address", "10.213.2.99") if running else ""

    def network(self, argv):
        action = argv[2]
        if action == "inspect":
            if not self.created:
                return Result(argv, 1, "", "network not found")
            if "{{.Id}}" in argv:
                return Result(argv, 0, "b558c0c38d588858eb8075bf1c9abf7517523822e1a36862979b9bcffef0b478\n")
            return Result(argv, 0, json.dumps([{"Subnet": "10.213.2.0/24", "Gateway": "10.213.2.1"}]) + "\n")
        if action == "disconnect":
            return Result(argv, 0)
        if action == "connect":
            ip, name = argv[argv.index("--ip") + 1], argv[-1]
            self.everything()[name]["NetworkSettings"]["Networks"][NET]["IPAMConfig"] = {"IPv4Address": ip}
            return Result(argv, 0)
        return Result(argv, 1)

    def kubectl(self, argv):
        args = argv[4:]
        if args[:2] == ["get", "--raw"]:
            return Result(argv, 0, "ok") if self.api_ok() else Result(argv, 1, "", "connection refused")
        if not self.api_ok():
            return Result(argv, 1, "", "connection refused")
        if args[:2] == ["get", "nodes"]:
            return Result(argv, 0, fixture("kubectl-nodes-lite.json"))
        if args[:2] == ["get", "pods"]:
            return Result(argv, 0, fixture("kubectl-pods-kube-system.json"))
        if args[:2] == ["get", "leases"]:
            renew = datetime.fromtimestamp(EPOCH + self.api_ready_at, timezone.utc).isoformat().replace("+00:00", "Z")
            return Result(argv, 0, json.dumps({"items": [{"metadata": {"name": s}, "spec": {"renewTime": renew}}
                                                         for s in SERVERS]}))
        return Result(argv, 1, "", "unexpected kubectl")

    def of(self, *prefix):
        return [c for c in self.calls if c[:len(prefix)] == list(prefix)]


class FakeClock:
    def __init__(self):
        self.t = 0.0

    def __call__(self):
        return self.t

    def sleep(self, seconds):
        self.t += seconds


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.clock = FakeClock()
        self.fake = FakeCell(self.clock)
        self.cfg = cell_config()
        self.said = []
        ctx = images.Ctx(cfg=self.cfg, home=Path(self.tmp.name) / "cell-home", env={}, runner=self.fake,
                         say=self.said.append, free_gib=lambda: 30.0)
        self.mem = 9.0
        self.psi = 0.0
        self.sub = k3d.Substrate(ctx=ctx, profile=profile("lite"), clock=self.clock,
                                 wall=lambda: EPOCH + self.clock.t, sleep=self.clock.sleep, mem_gib=lambda: self.mem,
                                 pressure=lambda: self.psi)
        self.verified: list[list[str]] = []
        self.bad_signature: set[str] = set()
        patches = [mock.patch.object(images, "verify", self.fake_verify),
                   mock.patch.object(kube, "etcd_members", self.fake_members)]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)

    def tearDown(self):
        self.tmp.cleanup()

    def fake_verify(self, ctx, imgs):
        self.verified.append([i.name for i in imgs])
        return [images.ImageOutcome(i.name, i.upstream, i.digest, i.local_ref(ctx.host), present=True,
                                    verified=i.name not in self.bad_signature,
                                    detail="ERROR cosign verify failed" if i.name in self.bad_signature else "1 ok")
                for i in imgs]

    def fake_members(self, runner, container, address, fetch=None):
        if not self.fake.api_ok():
            raise kube.KubeError("etcd: no quorum")
        return kube.parse_members(json.dumps(self.fake.members))

    def scenario(self):
        return json.loads(scenario_text())


class ProfileTest(unittest.TestCase):
    def setUp(self):
        self.lite = profile("lite")
        self.host = "k3d-hms-registry.localhost:5000"

    def problems(self, change):
        data = copy.deepcopy(self.lite.data)
        change(data)
        return " | ".join(k3d.profile_problems(k3d.Profile("lite", self.lite.path, data), self.host))

    def test_both_profiles_pass(self):
        for name in ("lite", "dev"):
            self.assertEqual(k3d.profile_problems(profile(name), self.host), [], name)
        self.assertEqual(profile("lite").servers_memory_gib, 3.0)

    def test_no_fixed_subnet_fails(self):
        self.assertIn("not a fixed subnet", self.problems(lambda d: d.pop("subnet")))

    def test_a_subnet_inside_the_wsl_and_docker_range_fails(self):
        self.assertIn("172.16.0.0/12", self.problems(lambda d: d.update(subnet="172.28.0.0/16")))

    def test_the_image_comes_from_cell_yaml_only(self):
        self.assertIn("'image' is set", self.problems(lambda d: d.update(image="rancher/k3s:latest")))

    def test_the_load_balancer_stays(self):
        self.assertIn("load balancer is disabled",
                      self.problems(lambda d: d["options"]["k3d"].update(disableLoadbalancer=True)))

    def test_registry_only_pulls_are_required(self):
        def drop(d):
            d["options"]["k3s"]["extraArgs"] = [a for a in d["options"]["k3s"]["extraArgs"]
                                                if a["arg"] != "--disable-default-registry-endpoint"]
        self.assertIn("--disable-default-registry-endpoint is missing", self.problems(drop))
        self.assertIn("does not name the local registry", self.problems(lambda d: d["registries"].update(use=[])))

    def test_three_servers_and_a_loopback_api(self):
        self.assertIn("three servers", self.problems(lambda d: d.update(servers=1)))
        self.assertIn("127.0.0.1", self.problems(lambda d: d["kubeAPI"].update(hostIP="0.0.0.0")))

    def test_rendering_fills_in_only_the_image(self):
        out = k3d.rendered(self.lite, "localhost:5000/rancher/k3s@sha256:" + "1" * 64)
        self.assertEqual(out.pop("image"), "localhost:5000/rancher/k3s@sha256:" + "1" * 64)
        self.assertEqual(out, self.lite.data)

    def test_memory_sizes(self):
        self.assertEqual(k3d.memory_gib("3g"), 3.0)
        self.assertEqual(k3d.memory_gib("3072m"), 3.0)
        self.assertEqual(k3d.memory_gib("8Gi"), 8.0)
        with self.assertRaises(config.ConfigError):
            k3d.memory_gib("lots")


class UpTest(Base):
    def test_creates_from_the_verified_local_digest_and_fixes_every_address(self):
        steps, checks = self.sub.up()
        self.assertTrue(all(c.ok for c in checks), [c.to_dict() for c in checks])
        self.assertEqual(self.verified[0][0], "k3s")  # the k3s image's signature first
        self.assertTrue({"k3d-proxy", "k3d-tools", "k3s-pause", "k3s-coredns"} <= set(self.verified[0]))
        create = self.fake.of("k3d", "cluster", "create")
        self.assertEqual(len(create), 1)
        first_create = self.fake.calls.index(create[0])
        self.assertLess(self.fake.calls.index(self.fake.of("ip", "-j")[0]), first_create)
        rendered = json.loads(Path(create[0][-1]).read_text(encoding="utf-8"))
        k3s = self.cfg.image("k3s")
        self.assertEqual(rendered["image"], f"localhost:5000/rancher/k3s@{k3s.digest}")
        env = self.fake.envs[first_create]
        self.assertEqual(env["K3D_IMAGE_LOADBALANCER"], f"localhost:5000/k3d-io/k3d-proxy@{self.cfg.image('k3d-proxy').digest}")
        self.assertTrue(env["K3D_IMAGE_TOOLS"].startswith("localhost:5000/k3d-io/k3d-tools@sha256:"))
        connected = {c[-1] for c in self.fake.of("docker", "network", "connect")}
        self.assertEqual(connected, {LB, REGISTRY})
        self.assertTrue(any("never" not in s and "created cluster" in s for s in steps))
        self.assertTrue(self.sub.kubeconfig.exists())

    def test_refuses_below_the_memory_line_before_anything_runs(self):
        self.mem = 6.4
        with self.assertRaises(GuardError) as caught:
            self.sub.up()
        self.assertIn("6.5 GiB", str(caught.exception))
        self.assertEqual(self.fake.of("k3d"), [])
        self.assertEqual(self.verified, [])

    def test_a_bad_signature_starts_nothing(self):
        self.bad_signature = {"k3s"}
        with self.assertRaises(k3d.SubstrateError) as caught:
            self.sub.up()
        self.assertIn("nothing started", str(caught.exception))
        self.assertEqual(self.fake.of("k3d", "cluster", "create"), [])

    def test_a_missing_registry_starts_nothing(self):
        self.fake.registry["State"]["Running"] = False
        with self.assertRaises(k3d.SubstrateError):
            self.sub.up()
        self.assertEqual(self.fake.of("k3d", "cluster", "create"), [])

    def test_an_existing_cluster_is_started_never_recreated(self):
        self.fake.make_cluster(running=False)
        steps, checks = self.sub.up()
        self.assertEqual(self.fake.of("k3d", "cluster", "create"), [])
        self.assertTrue(all(c.ok for c in checks), [c.to_dict() for c in checks])
        start = self.fake.of("docker", "start")[0]
        self.assertEqual(start[2:5], SERVERS)
        self.assertTrue(any("never recreating" in s for s in steps))

    def test_a_cluster_that_does_not_come_back_is_explained_not_recreated(self):
        self.fake.make_cluster(running=False)
        self.fake.never_ready = True
        with self.assertRaises(k3d.SubstrateError) as caught:
            self.sub.up()
        text = str(caught.exception)
        self.assertIn("not ready within 300 s", text)
        self.assertIn("etcd peer address=10.213.2.3", text)
        self.assertIn("never recreates", text)
        self.assertEqual(self.fake.of("k3d", "cluster", "create"), [])

    def test_an_image_pulled_from_elsewhere_fails_the_check(self):
        data = json.loads(fixture("kubectl-pods-kube-system.json"))
        data["items"][0]["spec"]["containers"][0]["image"] = "docker.io/rancher/mirrored-coredns-coredns:1.14.7"
        original = self.fake.kubectl

        def kubectl(argv):
            if argv[4:6] == ["get", "pods"]:
                return Result(argv, 0, json.dumps(data))
            return original(argv)

        self.fake.kubectl = kubectl
        _, checks = self.sub.up()
        pods = next(c for c in checks if c.name == "system-pods")
        self.assertFalse(pods.ok)
        self.assertIn("docker.io/rancher", pods.detail)


class StartStopStatusTest(Base):
    def test_status_absent_stopped_running(self):
        self.assertEqual(self.sub.status()[0], "absent")
        self.fake.make_cluster(running=False)
        state, checks, _ = self.sub.status()
        self.assertEqual(state, "stopped")
        self.assertTrue(all(c.ok for c in checks), [c.to_dict() for c in checks])
        self.fake.make_cluster(running=True)
        state, checks, details = self.sub.status()
        self.assertEqual(state, "running")
        self.assertTrue(all(c.ok for c in checks), [c.to_dict() for c in checks])
        self.assertEqual(len(details["containers"]), 5)
        self.assertEqual(self.fake.of("docker", "start") + self.fake.of("docker", "stop"), [])

    def test_a_missing_registry_or_unfixed_load_balancer_is_unhealthy(self):
        self.fake.make_cluster(running=True)
        self.fake.containers[LB]["NetworkSettings"]["Networks"][NET]["IPAMConfig"] = None
        checks = {c.name: c for c in self.sub.status()[1]}
        self.assertFalse(checks["fixed-addresses"].ok)
        self.assertIn("IPAMConfig is null", checks["fixed-addresses"].detail)
        self.fake.containers[LB]["NetworkSettings"]["Networks"][NET]["IPAMConfig"] = {"IPv4Address": "10.213.2.6"}
        self.fake.registry["Name"] = "/something-else"
        checks = {c.name: c for c in self.sub.status()[1]}
        self.assertIn("registry up", checks["fixed-addresses"].detail)

    def test_stop_keeps_the_registry_and_start_brings_the_nodes_back(self):
        self.fake.make_cluster(running=True)
        self.sub.stop()
        stop = self.fake.of("docker", "stop")[0]
        self.assertEqual(stop[4], LB)
        self.assertNotIn(REGISTRY, stop)
        self.assertEqual(self.sub.status()[0], "stopped")
        steps, checks = self.sub.start()
        self.assertTrue(all(c.ok for c in checks), [c.to_dict() for c in checks])
        self.assertEqual(self.sub.status()[0], "running")

    def test_start_refuses_below_the_memory_line(self):
        self.fake.make_cluster(running=False)
        self.mem = 5.0
        with self.assertRaises(GuardError):
            self.sub.start()
        self.assertEqual(self.fake.of("docker", "start"), [])

    def test_an_unmeasured_profile_needs_all_its_server_memory(self):
        dev = k3d.Substrate(ctx=self.sub.ctx, profile=profile("dev"), mem_gib=lambda: 20.0)
        with self.assertRaises(GuardError) as caught:
            dev.memory_guard("cell up")
        self.assertIn("24 GiB", str(caught.exception))


class RestartTest(Base):
    def setUp(self):
        super().setUp()
        self.fake.make_cluster(running=True)

    def test_pass(self):
        report = k3d.restart_test(self.sub, self.scenario())
        self.assertEqual(report.result, "PASS", [c.to_dict() for c in report.checks] + [report.error])
        starts = [c[2] for c in self.fake.of("docker", "start")]
        self.assertEqual(starts, list(reversed(SERVERS)))
        updates = self.fake.of("docker", "update")
        self.assertEqual(updates[0], ["docker", "update", "--restart=no", *SERVERS])
        self.assertLess(self.fake.calls.index(updates[0]), self.fake.calls.index(self.fake.of("docker", "kill")[0]))
        self.assertEqual(self.fake.of("docker", "kill")[0][2:], SERVERS)  # all three in one command
        self.assertTrue(all(c[2] == "--restart=unless-stopped" for c in updates[1:]))
        self.assertEqual(report.times["api_ready_s"], 20.0)
        self.assertEqual(report.before["addresses"], report.after["addresses"])
        self.assertEqual(json.loads(json.dumps(report.to_dict()))["result"], "PASS")

    def test_a_cell_that_is_not_healthy_is_never_killed(self):
        self.fake.make_cluster(running=False)
        report = k3d.restart_test(self.sub, self.scenario())
        self.assertEqual(report.result, "ERROR")
        self.assertIn("nothing was killed", report.error)
        self.assertEqual(self.fake.of("docker", "kill"), [])

    def test_an_api_that_is_not_ready_within_the_bound_fails(self):
        self.fake.api_delay = 301.0
        report = k3d.restart_test(self.sub, self.scenario())
        self.assertEqual(report.result, "FAIL")
        failed = {c.name for c in report.checks if not c.ok}
        self.assertIn("api-ready-within-bound", failed)
        self.assertTrue(all(c[2] == "--restart=unless-stopped" for c in self.fake.of("docker", "update")[1:]))

    def test_a_stale_ready_condition_without_a_renewed_lease_is_not_ready(self):
        original = self.fake.kubectl

        def kubectl(argv):
            if argv[4:6] == ["get", "leases"]:
                old = datetime.fromtimestamp(EPOCH - 60, timezone.utc).isoformat().replace("+00:00", "Z")
                return Result(argv, 0, json.dumps({"items": [{"metadata": {"name": s}, "spec": {"renewTime": old}}
                                                             for s in SERVERS]}))
            return original(argv)

        self.fake.kubectl = kubectl
        report = k3d.restart_test(self.sub, self.scenario())
        self.assertEqual(report.result, "FAIL")
        self.assertIn("nodes-ready-within-bound", {c.name for c in report.checks if not c.ok})

    def test_changed_etcd_members_fail(self):
        self.fake.rotate_members_on_start = True
        report = k3d.restart_test(self.sub, self.scenario())
        self.assertEqual(report.result, "FAIL")
        self.assertIn("etcd-same-members", {c.name for c in report.checks if not c.ok})

    def test_a_moved_address_fails(self):
        original = self.fake.set_running

        def set_running(name, running):
            original(name, running)
            if running and name == SERVERS[0]:
                endpoint = self.fake.containers[name]["NetworkSettings"]["Networks"][NET]
                endpoint["IPAddress"] = endpoint["IPAMConfig"]["IPv4Address"] = "10.213.2.40"

        self.fake.set_running = set_running
        report = k3d.restart_test(self.sub, self.scenario())
        self.assertEqual(report.result, "FAIL")
        failed = {c.name for c in report.checks if not c.ok}
        self.assertTrue({"addresses-unchanged", "node-addresses", "etcd-members"} <= failed, failed)

    def test_memory_pressure_makes_the_run_disturbed_never_a_pass(self):
        self.psi = 12.5
        report = k3d.restart_test(self.sub, self.scenario())
        self.assertEqual(report.result, "DISTURBED")
        self.assertFalse(report.passed)
        self.assertEqual(report.host["memory_pressure_avg10_max"], 12.5)


class ScenarioTest(unittest.TestCase):
    def test_the_scenario_file(self):
        data = json.loads(scenario_text())
        self.assertEqual((data["id"], data["kill"], data["start_order"]), ("R1", "all-servers", "reverse"))
        self.assertEqual(data["bounds"]["api_ready_s"], 300)
        self.assertIn("HAZ-0028", data["hazards"])

    def test_problems(self):
        self.assertTrue(k3d.scenario_problems({"id": "R1"}))
        data = json.loads(scenario_text())
        data["bounds"]["api_ready_s"] = 0
        data["start_order"] = "random"
        problems = " | ".join(k3d.scenario_problems(data))
        self.assertIn("api_ready_s", problems)
        self.assertIn("start_order", problems)

    def test_memory_pressure_reading(self):
        text = "some avg10=1.25 avg60=0.50 avg300=0.10 total=123\nfull avg10=0.00 avg60=0.00 avg300=0.00 total=0\n"
        self.assertEqual(k3d.memory_pressure(text), 1.25)
        self.assertIsNone(k3d.memory_pressure(""))


class CliTest(unittest.TestCase):
    def test_up_needs_only_substrate(self):
        from hmstools.cell.__main__ import main

        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as caught:
            main(["up"])
        self.assertEqual(caught.exception.code, 2)
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            main(["up", "--only", "everything"])
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            main(["chaos", "node-kill"])


if __name__ == "__main__":
    unittest.main()
