"""Kubernetes and etcd facts for the substrate on fixtures: nodes, pods, leases, etcd members and the address
comparison. kubectl-*.json, etcd-members-lite.json (k3s /db/info) and etcd-config-server-0.yaml are trimmed
output of the lite cell (WSL build host, 19 October 2026); etcd-members-prototype.json reconstructs the
prototype's members from the plan's §1 evidence."""

import json
import ssl
import unittest
from pathlib import Path
from unittest import mock

from hmstools.cell import docker, kube
from hmstools.cell.proc import Result
from hmstools.cell.tests.test_docker import fixture

LITE = {"k3d-hms-lite-server-0": "10.213.2.3", "k3d-hms-lite-server-1": "10.213.2.4",
        "k3d-hms-lite-server-2": "10.213.2.5"}


class NodesPodsTest(unittest.TestCase):
    def test_nodes(self):
        nodes = kube.parse_nodes(fixture("kubectl-nodes-lite.json"))
        self.assertEqual([n.name for n in nodes], sorted(LITE))
        self.assertTrue(all(n.ready for n in nodes))
        self.assertEqual({n.name: n.internal_ip for n in nodes}, LITE)
        self.assertIn("etcd", nodes[0].roles)
        self.assertEqual(nodes[0].version, "v1.35.9+k3s1")

    def test_a_node_without_ready_true_is_not_ready(self):
        data = json.loads(fixture("kubectl-nodes-lite.json"))
        for c in data["items"][1]["status"]["conditions"]:
            if c["type"] == "Ready":
                c["status"] = "Unknown"
        self.assertEqual([n.ready for n in kube.parse_nodes(json.dumps(data))], [True, False, True])

    def test_system_pods_come_from_the_local_registry(self):
        pods = kube.parse_pods(fixture("kubectl-pods-kube-system.json"))
        self.assertTrue(pods and all(p.ready and p.phase == "Running" for p in pods))
        self.assertEqual(kube.foreign_images(pods, "k3d-hms-registry.localhost:5000"), [])

    def test_an_image_from_elsewhere_is_named(self):
        data = json.loads(fixture("kubectl-pods-kube-system.json"))
        data["items"][0]["spec"]["containers"][0]["image"] = "docker.io/rancher/mirrored-coredns-coredns:1.14.7"
        foreign = kube.foreign_images(kube.parse_pods(json.dumps(data)), "k3d-hms-registry.localhost:5000")
        self.assertEqual(len(foreign), 1)
        self.assertIn("docker.io/rancher", foreign[0])

    def test_leases(self):
        text = json.dumps({"items": [{"metadata": {"name": "k3d-hms-lite-server-0"},
                                      "spec": {"renewTime": "2026-10-19T09:52:00.250000Z"}}]})
        self.assertAlmostEqual(kube.parse_leases(text)["k3d-hms-lite-server-0"], 1792403520.25, places=2)

    def test_api_ready_needs_ok(self):
        answers = iter([Result([], 0, "ok\n"), Result([], 1, "", "The connection to the server was refused")])
        runner = lambda argv, env=None, timeout=600.0: next(answers)  # noqa: E731
        self.assertEqual(kube.api_ready(runner, Path("k")), (True, "ok"))
        ready, detail = kube.api_ready(runner, Path("k"))
        self.assertFalse(ready)
        self.assertIn("refused", detail)


class MembersTest(unittest.TestCase):
    def test_the_lite_cells_members_match_its_nodes(self):
        members = kube.parse_members(fixture("etcd-members-lite.json"))
        self.assertEqual(len(members), 3)
        self.assertTrue(all(m.started and not m.learner for m in members))
        self.assertEqual(kube.member_problems(members, LITE), [])

    def test_the_prototypes_swapped_addresses_are_found(self):
        members = kube.parse_members(fixture("etcd-members-prototype.json"))
        containers = docker.parse_inspect(fixture("docker-inspect-prototype.json"))
        held = {c.name: c.networks["k3d-hms-proto"].address for c in containers}
        problems = kube.member_problems(members, held)
        self.assertEqual(len(problems), 2, problems)
        self.assertTrue(any("k3d-hms-proto-server-0" in p and "172.18.0.2" in p and "172.18.0.3" in p for p in problems))

    def test_unstarted_learner_foreign_and_missing_members(self):
        data = json.loads(fixture("etcd-members-lite.json"))
        data["members"][0].update({"name": "", "clientURLs": []})
        data["members"][1]["isLearner"] = True
        data["members"][2]["name"] = "k3d-other-server-0-12345678"
        problems = " | ".join(kube.member_problems(kube.parse_members(json.dumps(data)), LITE))
        self.assertIn("has not started", problems)
        self.assertIn("learner", problems)
        self.assertIn("belongs to no node", problems)
        self.assertIn("has no etcd member", problems)

    def test_member_names_map_to_the_longest_node_prefix(self):
        m = kube.Member(id="1", name="k3d-hms-lite-server-1-a74e8f3b", peer_urls=(), client_urls=())
        self.assertEqual(m.node_name(["k3d-hms-lite-server-1", "k3d-hms-lite-server-10"]), "k3d-hms-lite-server-1")

    def test_a_body_without_members_is_an_error(self):
        with self.assertRaises(kube.KubeError):
            kube.parse_members('{"error": "etcdserver: no leader"}')

    def test_etcd_members_asks_db_info_with_the_server_token(self):
        def runner(argv, env=None, timeout=600.0):
            if argv[:2] == ["docker", "inspect"]:
                return Result(argv, 0, "PATH=/bin\nK3S_TOKEN=SYN-token\n")
            return Result(argv, 0, "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n")

        seen = {}

        def fetch(url, headers, context):
            seen.update(url=url, headers=headers, context=context)
            return fixture("etcd-members-lite.json")

        with mock.patch.object(ssl, "create_default_context", return_value="ctx") as made:
            members = kube.etcd_members(runner, "k3d-hms-lite-server-0", "10.213.2.3", fetch=fetch)
        self.assertEqual(len(members), 3)
        self.assertEqual(seen["url"], "https://10.213.2.3:6443/db/info")
        self.assertEqual(seen["headers"]["Authorization"], "Basic c2VydmVyOlNZTi10b2tlbg==")  # server:SYN-token
        self.assertEqual(seen["context"], "ctx")
        self.assertTrue(made.call_args.kwargs["cafile"].endswith("server-ca.crt"))

    def test_no_token_is_an_error(self):
        runner = lambda argv, env=None, timeout=600.0: Result(argv, 0, "PATH=/bin\n")  # noqa: E731
        with self.assertRaises(kube.KubeError):
            kube.etcd_members(runner, "k3d-hms-lite-server-0", "10.213.2.3", fetch=lambda *a: "{}")


class EtcdConfigTest(unittest.TestCase):
    def test_peer_address_from_the_nodes_own_config(self):
        conf = kube.parse_etcd_config(fixture("etcd-config-server-0.yaml"))
        self.assertEqual(conf["peer_hosts"], ["10.213.2.3"])
        self.assertTrue(str(conf["name"]).startswith("k3d-hms-lite-server-0-"))


if __name__ == "__main__":
    unittest.main()
