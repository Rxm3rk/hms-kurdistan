"""Docker facts for the substrate on JSON fixtures: fixed addresses, the prototype's failure, host routes.

docker-inspect-lite.json and docker-inspect-registry.json are trimmed `docker inspect` output of the lite cell
(WSL build host, 19 October 2026; tokens and environments removed). docker-inspect-prototype.json reconstructs
the WP-0.2 prototype after the WSL termination of 18 October from the plan's §1 evidence: no fixed address
(IPAMConfig null) and server-0 and server-1 holding each other's creation-time addresses.
"""

import json
import unittest
from pathlib import Path

from hmstools.cell import docker
from hmstools.cell.proc import Result

FIXTURES = Path(__file__).resolve().parent / "fixtures"
NET, SUBNET = "k3d-hms-lite", "10.213.2.0/24"


def fixture(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


def lite() -> list:
    return docker.parse_inspect(fixture("docker-inspect-lite.json"))


def with_registry() -> list:
    return lite() + docker.parse_inspect(fixture("docker-inspect-registry.json"))


class ParseTest(unittest.TestCase):
    def test_reads_the_lite_cell(self):
        found = {c.name: c for c in with_registry()}
        self.assertEqual(sorted(found), ["k3d-hms-lite-server-0", "k3d-hms-lite-server-1", "k3d-hms-lite-server-2",
                                         "k3d-hms-lite-serverlb", "k3d-hms-registry.localhost"])
        s0 = found["k3d-hms-lite-server-0"]
        self.assertEqual((s0.role, s0.restart_policy, s0.memory_bytes), ("server", "unless-stopped", 3 * 1024 ** 3))
        self.assertEqual(s0.networks[NET].fixed, s0.networks[NET].address)
        self.assertTrue(s0.image.startswith("localhost:5000/rancher/k3s@sha256:"))
        registry = found["k3d-hms-registry.localhost"]
        self.assertEqual(set(registry.networks), {NET, "hms-registry", "hms-cell-offline"})
        self.assertEqual(registry.networks["hms-cell-offline"].fixed, "")  # IPAMConfig {} fixes nothing

    def test_servers_in_creation_order(self):
        names = [c.name for c in docker.servers(list(reversed(lite())))]
        self.assertEqual(names, ["k3d-hms-lite-server-0", "k3d-hms-lite-server-1", "k3d-hms-lite-server-2"])

    def test_no_json_is_an_error(self):
        with self.assertRaises(docker.DockerError):
            docker.parse_inspect("Error: No such object")


class AddressTest(unittest.TestCase):
    def test_the_lite_cell_has_every_address_fixed(self):
        self.assertEqual(docker.address_problems(with_registry(), NET, SUBNET), [])

    def test_the_prototype_fails_the_check(self):
        problems = docker.address_problems(docker.parse_inspect(fixture("docker-inspect-prototype.json")),
                                           "k3d-hms-proto", "172.18.0.0/16")
        self.assertEqual(len(problems), 3, problems)
        self.assertTrue(all("IPAMConfig is null" in p for p in problems), problems)

    def test_a_container_holding_another_address_fails(self):
        data = json.loads(fixture("docker-inspect-lite.json"))
        data[1]["NetworkSettings"]["Networks"][NET]["IPAddress"] = "10.213.2.9"
        problems = docker.address_problems(docker.parse_inspect(json.dumps(data)), NET, SUBNET)
        self.assertEqual(len(problems), 1)
        self.assertIn("not its fixed", problems[0])

    def test_a_stopped_container_keeps_its_fixed_address(self):
        data = json.loads(fixture("docker-inspect-lite.json"))
        data[0]["State"]["Running"] = False
        data[0]["NetworkSettings"]["Networks"][NET]["IPAddress"] = ""
        self.assertEqual(docker.address_problems(docker.parse_inspect(json.dumps(data)), NET, SUBNET), [])

    def test_off_network_outside_subnet_and_shared_addresses_fail(self):
        data = json.loads(fixture("docker-inspect-lite.json"))
        data[0]["NetworkSettings"]["Networks"] = {}
        data[1]["NetworkSettings"]["Networks"][NET]["IPAMConfig"]["IPv4Address"] = "10.99.0.4"
        data[1]["NetworkSettings"]["Networks"][NET]["IPAddress"] = "10.99.0.4"
        fixed = data[3]["NetworkSettings"]["Networks"][NET]
        fixed["IPAMConfig"]["IPv4Address"] = fixed["IPAddress"] = data[2]["NetworkSettings"]["Networks"][NET]["IPAddress"]
        problems = " | ".join(docker.address_problems(docker.parse_inspect(json.dumps(data)), NET, SUBNET))
        self.assertIn("not on the network", problems)
        self.assertIn("outside 10.213.2.0/24", problems)
        self.assertIn("share the fixed address", problems)

    def test_snapshot_compares_equal_only_when_nothing_moved(self):
        before = docker.addresses(with_registry(), NET)
        self.assertEqual(before, docker.addresses(with_registry(), NET))
        self.assertEqual(before["k3d-hms-lite-server-0"]["fixed"], before["k3d-hms-lite-server-0"]["address"])


class FixAddressTest(unittest.TestCase):
    def setUp(self):
        self.calls = []

    def runner(self, argv, env=None, timeout=600.0):
        self.calls.append(list(argv))
        return Result(list(argv), 0)

    def test_reattaches_at_the_held_address_with_aliases(self):
        data = json.loads(fixture("docker-inspect-lite.json"))
        lb = data[3]["NetworkSettings"]["Networks"][NET]
        lb["IPAMConfig"] = None
        lb["Aliases"] = ["k3d-hms-lite-serverlb", data[3]["Id"][:12], "lb-alias"]
        container = docker.parse_inspect(json.dumps(data))[3]
        line = docker.fix_address(self.runner, container, NET)
        self.assertEqual(self.calls[0], ["docker", "network", "disconnect", NET, "k3d-hms-lite-serverlb"])
        self.assertEqual(self.calls[1], ["docker", "network", "connect", "--ip", lb["IPAddress"], "--alias", "lb-alias",
                                         NET, "k3d-hms-lite-serverlb"])
        self.assertIn("now fixed", line)

    def test_a_fixed_address_is_left_alone(self):
        docker.fix_address(self.runner, lite()[3], NET)
        self.assertEqual(self.calls, [])

    def test_a_stopped_container_cannot_be_fixed(self):
        data = json.loads(fixture("docker-inspect-lite.json"))
        data[3]["NetworkSettings"]["Networks"][NET].update({"IPAMConfig": None, "IPAddress": ""})
        with self.assertRaises(docker.DockerError):
            docker.fix_address(self.runner, docker.parse_inspect(json.dumps(data))[3], NET)


class RouteTest(unittest.TestCase):
    def test_the_cell_subnet_overlaps_no_route_on_this_host(self):
        self.assertEqual(docker.route_overlaps(fixture("ip-route.json"), SUBNET, ["br-b558c0c38d58"]), [])

    def test_the_plans_first_subnet_overlaps_the_wsl_network(self):
        hits = docker.route_overlaps(fixture("ip-route.json"), "172.28.0.0/16")
        self.assertTrue(any(h.startswith("172.28.192.0/20") for h in hits), hits)

    def test_the_cell_networks_own_bridge_does_not_count(self):
        routes = json.loads(fixture("ip-route.json"))
        bridge = next(r["dev"] for r in routes if r.get("dst") == SUBNET)
        self.assertEqual(docker.route_overlaps(fixture("ip-route.json"), SUBNET, [bridge]), [])
        self.assertEqual(docker.route_overlaps(fixture("ip-route.json"), SUBNET), [f"{SUBNET} dev {bridge}"])


if __name__ == "__main__":
    unittest.main()
