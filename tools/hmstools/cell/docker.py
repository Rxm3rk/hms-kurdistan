"""Docker facts for the cell substrate: container and network inspection, fixed addresses and host routes.

WP-0.2 plan §1 and slice S2 (OQ-122; DN-015; KA-022). The prototype's nodes had no fixed address
(`IPAMConfig: null`), so Docker handed out addresses in start order after a restart and embedded etcd, which
stores each member's peer URL as an address, lost its quorum. Here every container on the cell network must
have a fixed address (`IPAMConfig.IPv4Address`) equal to the address it holds; `address_problems` says what is
wrong otherwise. The parsers read `docker inspect` and `ip -j route` JSON, so the tests run on fixtures.
"""

from __future__ import annotations

import ipaddress
import json
from dataclasses import dataclass, field
from typing import Any, Optional, Sequence

from .proc import Result, Runner


class DockerError(RuntimeError):
    pass


@dataclass(frozen=True)
class Endpoint:
    network: str
    address: str  # the address the container holds now ("" when stopped)
    fixed: str  # IPAMConfig.IPv4Address: the address Docker always gives it ("" when none is fixed)
    aliases: tuple[str, ...] = ()


@dataclass
class Container:
    name: str
    id: str
    image: str
    running: bool
    status: str
    restart_policy: str
    memory_bytes: int
    labels: dict[str, str] = field(default_factory=dict)
    networks: dict[str, Endpoint] = field(default_factory=dict)
    started_at: str = ""
    finished_at: str = ""

    @property
    def role(self) -> str:
        return self.labels.get("k3d.role", "")

    def to_dict(self) -> dict[str, Any]:
        return {"name": self.name, "image": self.image, "running": self.running, "status": self.status,
                "restart_policy": self.restart_policy, "memory_bytes": self.memory_bytes,
                "role": self.role or None,
                "networks": {n: {"address": e.address or None, "fixed": e.fixed or None}
                             for n, e in sorted(self.networks.items())}}


def parse_inspect(text: str) -> list[Container]:
    """`docker inspect <container>...` JSON (an array) as Containers."""
    try:
        data = json.loads(text or "[]")
    except json.JSONDecodeError as exc:
        raise DockerError(f"docker inspect gave no JSON: {exc}") from exc
    if not isinstance(data, list):
        raise DockerError("docker inspect gave no JSON array")
    out = []
    for entry in data:
        state = entry.get("State") or {}
        host = entry.get("HostConfig") or {}
        conf = entry.get("Config") or {}
        networks = {}
        for name, net in ((entry.get("NetworkSettings") or {}).get("Networks") or {}).items():
            net = net or {}
            ipam = net.get("IPAMConfig") or {}  # null on a container with no fixed address (the prototype)
            networks[name] = Endpoint(network=name, address=net.get("IPAddress") or "",
                                      fixed=ipam.get("IPv4Address") or "",
                                      aliases=tuple(net.get("Aliases") or ()))
        out.append(Container(
            name=str(entry.get("Name") or "").lstrip("/"),
            id=str(entry.get("Id") or ""),
            image=str(conf.get("Image") or ""),
            running=bool(state.get("Running")),
            status=str(state.get("Status") or ""),
            restart_policy=str((host.get("RestartPolicy") or {}).get("Name") or ""),
            memory_bytes=int(host.get("Memory") or 0),
            labels=dict(conf.get("Labels") or {}),
            networks=networks,
            started_at=str(state.get("StartedAt") or ""),
            finished_at=str(state.get("FinishedAt") or ""),
        ))
    return out


def inspect(runner: Runner, names: Sequence[str]) -> list[Container]:
    """Inspect containers by name; a missing container is a DockerError."""
    if not names:
        return []
    r = runner(["docker", "inspect", *names], timeout=60)
    if not r.ok:
        raise DockerError(f"docker inspect {' '.join(names)}: {r.tail()}")
    return parse_inspect(r.stdout)


def cluster_containers(runner: Runner, cluster: str) -> list[Container]:
    """Every container k3d made for the cluster (nodes and load balancer), sorted by name."""
    r = runner(["docker", "ps", "-a", "--filter", f"label=k3d.cluster={cluster}", "--format", "{{.Names}}"],
               timeout=60)
    if not r.ok:
        raise DockerError(f"docker ps: {r.tail()}")
    names = sorted(line.strip() for line in r.stdout.splitlines() if line.strip())
    return sorted(inspect(runner, names), key=lambda c: c.name)


def servers(containers: Sequence[Container]) -> list[Container]:
    """The k3s server nodes, in creation order (server-0, server-1, ...)."""
    nodes = [c for c in containers if c.role == "server"]

    def order(c: Container) -> tuple[int, str]:
        tail = c.name.rsplit("-", 1)[-1]
        return (int(tail) if tail.isdigit() else 1 << 30, c.name)

    return sorted(nodes, key=order)


def address_problems(containers: Sequence[Container], network: str, subnet: str) -> list[str]:
    """Why a container on the cell network could change address after a restart (empty if none can).

    Each container must be on the network with a fixed address (IPAMConfig.IPv4Address) inside the subnet;
    while it runs it must hold exactly that address. No two containers may share a fixed address.
    """
    problems = []
    net = ipaddress.ip_network(subnet)
    seen: dict[str, str] = {}
    for c in containers:
        endpoint = c.networks.get(network)
        if endpoint is None:
            problems.append(f"{c.name}: not on the network {network}")
            continue
        if not endpoint.fixed:
            problems.append(f"{c.name}: no fixed address on {network} (IPAMConfig is null; it holds "
                            f"{endpoint.address or 'none'}), so Docker may give it another address after a restart")
            continue
        try:
            inside = ipaddress.ip_address(endpoint.fixed) in net
        except ValueError:
            inside = False
        if not inside:
            problems.append(f"{c.name}: fixed address {endpoint.fixed} is outside {subnet}")
        if c.running and endpoint.address != endpoint.fixed:
            problems.append(f"{c.name}: holds {endpoint.address or 'no address'}, not its fixed {endpoint.fixed}")
        if endpoint.fixed in seen:
            problems.append(f"{c.name} and {seen[endpoint.fixed]} share the fixed address {endpoint.fixed}")
        seen[endpoint.fixed] = c.name
    return problems


def addresses(containers: Sequence[Container], network: str) -> dict[str, dict[str, Optional[str]]]:
    """Name -> {address, fixed} on one network: the snapshot R1 compares before and after."""
    out: dict[str, dict[str, Optional[str]]] = {}
    for c in containers:
        endpoint = c.networks.get(network)
        out[c.name] = {"address": (endpoint.address or None) if endpoint else None,
                       "fixed": (endpoint.fixed or None) if endpoint else None}
    return out


def fix_address(runner: Runner, container: Container, network: str) -> str:
    """Re-attach a running container to the network at the address it holds, now as a fixed address.

    k3d 5.8.3 fixes only the nodes' addresses; the load balancer and the registry get theirs from Docker in
    start order. `docker network connect --ip` stores the address in the container's IPAMConfig, so Docker
    gives it back on every start.
    """
    endpoint = container.networks.get(network)
    if endpoint is None or not endpoint.address:
        raise DockerError(f"{container.name} holds no address on {network}; start it first")
    if endpoint.fixed:
        return f"{container.name}: fixed at {endpoint.fixed}"
    keep = [a for a in endpoint.aliases if a not in (container.name, container.id[:12])]
    r = runner(["docker", "network", "disconnect", network, container.name], timeout=60)
    if not r.ok:
        raise DockerError(f"cannot detach {container.name} from {network}: {r.tail()}")
    connect = ["docker", "network", "connect", "--ip", endpoint.address]
    for alias in keep:
        connect += ["--alias", alias]
    r = runner([*connect, network, container.name], timeout=60)
    if not r.ok:
        raise DockerError(f"{container.name} is detached from {network} and could not be re-attached at "
                          f"{endpoint.address}: {r.tail()}; attach it by hand with '{' '.join(connect)} {network} "
                          f"{container.name}'")
    return f"{container.name}: re-attached to {network} at {endpoint.address}, now fixed"


def network_subnets(runner: Runner, network: str) -> Optional[list[str]]:
    """The subnets of a Docker network, or None if there is no such network."""
    r = runner(["docker", "network", "inspect", network, "--format", "{{json .IPAM.Config}}"], timeout=60)
    if not r.ok:
        return None
    try:
        config = json.loads(r.stdout.strip() or "[]") or []
    except json.JSONDecodeError as exc:
        raise DockerError(f"docker network inspect {network}: no JSON: {exc}") from exc
    return [str(entry.get("Subnet")) for entry in config if entry.get("Subnet")]


def route_overlaps(routes_json: str, subnet: str, ignore_devices: Sequence[str] = ()) -> list[str]:
    """Host routes (`ip -j -4 route` JSON) whose destination overlaps the subnet, as 'dst dev'. The default
    route and routes through ignore_devices (the cell network's own bridge) do not count."""
    try:
        routes = json.loads(routes_json or "[]")
    except json.JSONDecodeError as exc:
        raise DockerError(f"ip -j route gave no JSON: {exc}") from exc
    net = ipaddress.ip_network(subnet)
    hits = []
    for route in routes:
        dst, dev = str(route.get("dst") or ""), str(route.get("dev") or "")
        if dst in ("", "default") or dev in ignore_devices:
            continue
        try:
            other = ipaddress.ip_network(dst if "/" in dst else f"{dst}/32", strict=False)
        except ValueError:
            continue
        if other.version == net.version and other.overlaps(net):
            hits.append(f"{dst} dev {dev}")
    return hits


def bridge_device(runner: Runner, network: str) -> Optional[str]:
    """The Linux bridge of a Docker bridge network: br-<first 12 characters of its ID>."""
    r = runner(["docker", "network", "inspect", network, "--format", "{{.Id}}"], timeout=60)
    if not r.ok or not r.stdout.strip():
        return None
    return "br-" + r.stdout.strip()[:12]


def run_ok(runner: Runner, argv: list[str], what: str, timeout: float = 120) -> Result:
    r = runner(argv, timeout=timeout)
    if not r.ok:
        raise DockerError(f"{what}: {r.tail()}")
    return r
