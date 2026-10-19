"""Kubernetes and embedded-etcd facts for the cell substrate: API readiness, nodes and etcd members.

WP-0.2 plan §1 and slice S2 (OQ-122). kubectl runs on the host against the kubeconfig in HMS_CELL_HOME, which
points at the k3d server load balancer, so the API answers while any one server is down. etcd's member list
comes from etcd itself: its v3 JSON gateway on a node's address, with the client certificate k3s keeps on
that node. Embedded etcd records each member's peer URL as an address, so `member_problems` compares those
addresses with the nodes' fixed addresses. When etcd has no quorum it cannot list members; then each node's
own etcd configuration file still shows the peer address it was created with (`etcd_local_config`).
The parsers read JSON and YAML text, so the tests run on fixtures.
"""

from __future__ import annotations

import json
import os
import ssl
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Optional, Sequence

from .proc import Runner

ETCD_TLS = "/var/lib/rancher/k3s/server/tls/etcd"
ETCD_CONFIG = "/var/lib/rancher/k3s/server/db/etcd/config"
ETCD_CLIENT_PORT = 2379


class KubeError(RuntimeError):
    pass


def kubectl(runner: Runner, kubeconfig: Path, *args: str, timeout: float = 30):
    return runner(["kubectl", "--kubeconfig", str(kubeconfig), "--request-timeout=10s", *args], timeout=timeout)


def api_ready(runner: Runner, kubeconfig: Path) -> tuple[bool, str]:
    """GET /readyz through the load balancer: (True, 'ok') when the API server says it is ready."""
    r = kubectl(runner, kubeconfig, "get", "--raw", "/readyz")
    text = r.stdout.strip()
    if r.ok and text == "ok":
        return True, "ok"
    return False, text or r.tail(1) or f"exit {r.code}"


@dataclass(frozen=True)
class Node:
    name: str
    ready: bool
    internal_ip: str
    roles: tuple[str, ...]
    version: str

    def to_dict(self) -> dict[str, Any]:
        return {"name": self.name, "ready": self.ready, "internal_ip": self.internal_ip or None,
                "roles": list(self.roles), "version": self.version}


def parse_nodes(text: str) -> list[Node]:
    """`kubectl get nodes -o json` as Nodes, sorted by name."""
    try:
        data = json.loads(text or "{}")
    except json.JSONDecodeError as exc:
        raise KubeError(f"kubectl get nodes gave no JSON: {exc}") from exc
    out = []
    for item in data.get("items") or []:
        meta, status = item.get("metadata") or {}, item.get("status") or {}
        ready = any(c.get("type") == "Ready" and c.get("status") == "True" for c in status.get("conditions") or [])
        ip = next((a.get("address", "") for a in status.get("addresses") or [] if a.get("type") == "InternalIP"), "")
        labels = meta.get("labels") or {}
        roles = tuple(sorted(k.split("/", 1)[1] for k in labels if k.startswith("node-role.kubernetes.io/")))
        out.append(Node(name=str(meta.get("name") or ""), ready=ready, internal_ip=ip, roles=roles,
                        version=str((status.get("nodeInfo") or {}).get("kubeletVersion") or "")))
    return sorted(out, key=lambda n: n.name)


def nodes(runner: Runner, kubeconfig: Path) -> list[Node]:
    r = kubectl(runner, kubeconfig, "get", "nodes", "-o", "json")
    if not r.ok:
        raise KubeError(f"kubectl get nodes: {r.tail()}")
    return parse_nodes(r.stdout)


@dataclass(frozen=True)
class Pod:
    namespace: str
    name: str
    phase: str
    ready: bool
    node: str
    images: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        return {"namespace": self.namespace, "name": self.name, "phase": self.phase, "ready": self.ready,
                "node": self.node or None, "images": list(self.images)}


def parse_pods(text: str) -> list[Pod]:
    """`kubectl get pods -o json` as Pods. `images` are the images the containers run (status), else the spec's."""
    try:
        data = json.loads(text or "{}")
    except json.JSONDecodeError as exc:
        raise KubeError(f"kubectl get pods gave no JSON: {exc}") from exc
    out = []
    for item in data.get("items") or []:
        meta, spec, status = item.get("metadata") or {}, item.get("spec") or {}, item.get("status") or {}
        ready = any(c.get("type") == "Ready" and c.get("status") == "True" for c in status.get("conditions") or [])
        images = [str(c.get("image") or "") for c in spec.get("initContainers") or []]
        images += [str(c.get("image") or "") for c in spec.get("containers") or []]
        out.append(Pod(namespace=str(meta.get("namespace") or ""), name=str(meta.get("name") or ""),
                       phase=str(status.get("phase") or ""), ready=ready, node=str(spec.get("nodeName") or ""),
                       images=tuple(images)))
    return sorted(out, key=lambda p: (p.namespace, p.name))


def pods(runner: Runner, kubeconfig: Path, namespace: Optional[str] = None) -> list[Pod]:
    scope = ["-n", namespace] if namespace else ["-A"]
    r = kubectl(runner, kubeconfig, "get", "pods", *scope, "-o", "json")
    if not r.ok:
        raise KubeError(f"kubectl get pods: {r.tail()}")
    return parse_pods(r.stdout)


def foreign_images(all_pods: Sequence[Pod], registry_host: str) -> list[str]:
    """'namespace/pod: image' for each image not referenced from the local registry."""
    prefix = registry_host.rstrip("/") + "/"
    return [f"{p.namespace}/{p.name}: {image}" for p in all_pods for image in p.images if not image.startswith(prefix)]


# --------------------------------------------------------------------------- etcd


@dataclass(frozen=True)
class Member:
    id: str
    name: str
    peer_urls: tuple[str, ...]
    client_urls: tuple[str, ...]
    learner: bool = False

    @property
    def started(self) -> bool:
        """etcd lists a member that was added but has never started with an empty name and no client URLs."""
        return bool(self.name) and bool(self.client_urls)

    @property
    def peer_hosts(self) -> tuple[str, ...]:
        return tuple(sorted({urllib.parse.urlsplit(u).hostname or "" for u in self.peer_urls}))

    def node_name(self, node_names: Sequence[str]) -> Optional[str]:
        """k3s names a member <node name>-<8 hex>; the node whose name is the longest such prefix."""
        matches = [n for n in node_names if self.name == n or self.name.startswith(n + "-")]
        return max(matches, key=len) if matches else None

    def to_dict(self) -> dict[str, Any]:
        return {"id": self.id, "name": self.name, "peer_urls": list(self.peer_urls),
                "client_urls": list(self.client_urls), "learner": self.learner, "started": self.started}


def parse_members(text: str) -> list[Member]:
    """etcd's /v3/cluster/member/list JSON as Members, sorted by name (IDs are uint64, kept as strings)."""
    try:
        data = json.loads(text or "{}")
    except json.JSONDecodeError as exc:
        raise KubeError(f"etcd member list gave no JSON: {exc}") from exc
    if "members" not in data:
        raise KubeError(f"etcd member list has no 'members': {str(data)[:200]}")
    out = []
    for m in data.get("members") or []:
        out.append(Member(id=str(m.get("ID") or ""), name=str(m.get("name") or ""),
                          peer_urls=tuple(m.get("peerURLs") or ()), client_urls=tuple(m.get("clientURLs") or ()),
                          learner=bool(m.get("isLearner"))))
    return sorted(out, key=lambda m: (m.name, m.id))


def member_problems(members: Sequence[Member], node_addresses: dict[str, str]) -> list[str]:
    """Why etcd's members do not match the nodes (empty if each node is one started voting member whose peer
    URLs name exactly the node's fixed address). node_addresses maps node name -> fixed address."""
    problems = []
    names = list(node_addresses)
    claimed: dict[str, str] = {}
    for m in members:
        node = m.node_name(names)
        label = m.name or f"member {m.id}"
        if not m.started:
            problems.append(f"etcd member {m.id} ({m.peer_urls and m.peer_urls[0] or 'no peer URL'}) has not started")
        if m.learner:
            problems.append(f"etcd member {label} is a learner, not a voting member")
        if node is None:
            problems.append(f"etcd member {label} belongs to no node of this cell")
            continue
        if node in claimed:
            problems.append(f"node {node} has two etcd members: {claimed[node]} and {label}")
        claimed[node] = label
        want = node_addresses[node]
        if m.peer_hosts != (want,):
            problems.append(f"etcd member {label}: peer URL {', '.join(m.peer_urls) or 'none'} does not name node "
                            f"{node}'s fixed address {want}")
    for node in names:
        if node not in claimed:
            problems.append(f"node {node} has no etcd member")
    return problems


Fetch = Callable[[str, bytes, ssl.SSLContext], str]


def _post(url: str, body: bytes, context: ssl.SSLContext) -> str:
    request = urllib.request.Request(url, data=body, method="POST", headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=10, context=context) as response:  # noqa: S310 (etcd on the bridge)
        return response.read().decode("utf-8")


def etcd_members(runner: Runner, container: str, address: str, fetch: Optional[Fetch] = None) -> list[Member]:
    """The member list from the etcd on one node, over TLS with that node's etcd client certificate.

    The certificate and key are read with `docker exec` into a private temporary directory that is removed at
    once; they never go to HMS_CELL_HOME or the repository. Raises KubeError when etcd does not answer (it
    cannot list members without a quorum)."""
    files = {}
    for name in ("server-ca.crt", "client.crt", "client.key"):
        r = runner(["docker", "exec", container, "cat", f"{ETCD_TLS}/{name}"], timeout=30)
        if not r.ok or "-----BEGIN" not in r.stdout:
            raise KubeError(f"cannot read {ETCD_TLS}/{name} on {container}: {r.tail(1) or 'not PEM'}")
        files[name] = r.stdout
    with tempfile.TemporaryDirectory(prefix="hms-etcd-") as tmp:
        paths = {}
        for name, text in files.items():
            path = Path(tmp) / name
            fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            with os.fdopen(fd, "w", encoding="ascii", newline="\n") as handle:
                handle.write(text)
            paths[name] = str(path)
        context = ssl.create_default_context(cafile=paths["server-ca.crt"])
        context.load_cert_chain(paths["client.crt"], paths["client.key"])
        url = f"https://{address}:{ETCD_CLIENT_PORT}/v3/cluster/member/list"
        try:
            text = (fetch or _post)(url, b"{}", context)
        except (urllib.error.URLError, OSError, ssl.SSLError) as exc:
            raise KubeError(f"etcd on {container} ({url}) does not answer: {exc}") from exc
    return parse_members(text)


def parse_etcd_config(text: str) -> dict[str, Any]:
    """The fields of a k3s node's etcd configuration file that name it and its peer address."""
    import yaml  # PyYAML, pinned in tools/requirements.txt

    try:
        data = yaml.safe_load(text) or {}
    except yaml.YAMLError as exc:
        raise KubeError(f"etcd configuration is not YAML: {exc}") from exc
    if not isinstance(data, dict):
        raise KubeError("etcd configuration is not a mapping")
    peer = str(data.get("initial-advertise-peer-urls") or data.get("listen-peer-urls") or "")
    hosts = sorted({urllib.parse.urlsplit(u.strip()).hostname or "" for u in peer.split(",") if u.strip()}
                   - {"127.0.0.1", "localhost"})
    return {"name": data.get("name"), "peer_urls": peer, "peer_hosts": hosts,
            "initial_cluster": data.get("initial-cluster")}


def etcd_local_config(runner: Runner, container: str) -> dict[str, Any]:
    """One node's own etcd configuration (readable without a quorum, while the container runs)."""
    r = runner(["docker", "exec", container, "cat", ETCD_CONFIG], timeout=30)
    if not r.ok:
        raise KubeError(f"cannot read {ETCD_CONFIG} on {container}: {r.tail(1)}")
    return parse_etcd_config(r.stdout)


@dataclass
class Snapshot:
    """What `cell status` and R1 read about a running substrate."""

    api: tuple[bool, str] = (False, "not asked")
    nodes: list[Node] = field(default_factory=list)
    members: list[Member] = field(default_factory=list)
    etcd_error: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {"api_ready": self.api[0], "api_detail": self.api[1], "nodes": [n.to_dict() for n in self.nodes],
                "etcd_members": [m.to_dict() for m in self.members], "etcd_error": self.etcd_error or None}
