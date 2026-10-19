"""The cell substrate: the k3d cluster of three k3s servers, `cell up --only substrate`, `cell start`, `cell stop`,
`cell status` and the full-restart test R1 (`cell chaos cell-restart`).

WP-0.2 plan §1, §2.1, §4.2 and slice S2 (OQ-122; DN-015; KA-022; HAZ-0028, CTRL-0028-3).
- `up`: refuses below the memory and disk lines; checks deploy/site-cell/k3d/<profile>.k3d.yaml against cell.yaml
  and the host routes; verifies the signature of every substrate image offline, the k3s image first; creates the
  cluster from the local registry's digests; fixes the load balancer's and the registry's address on the cell
  network; waits for the API and the nodes; checks that every node's fixed address is its node address and its
  etcd member's peer address, and that every kube-system pod runs an image from the local registry.
  Idempotent: an existing cluster is started and checked, never recreated. If its API is not ready within the
  bound, `up` prints the nodes' addresses against etcd's and stops (recreating needs `cell down`, S7).
- `start` starts the nodes and the load balancer with `docker start` (any order works with fixed addresses) and
  waits; `stop` stops them (the registry keeps running); `status` reports without changing anything.
- R1 (tests/chaos/scenarios/cell-restart.yaml): kill the three nodes at once, start them in reverse order, and
  pass only if the API and all nodes are ready within the bound, every address is unchanged and fixed, and etcd
  has all its members, each at its node's address.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Optional

from . import docker, kube
from .config import ConfigError, Image
from .proc import GIB, GuardError, mem_available_gib, write_private

K3D_DIR = Path("deploy/site-cell/k3d")
SCENARIO_DIR = Path("tests/chaos/scenarios")
PROFILES = ("lite", "dev")
# k3d's helper images, taken from the local registry through these k3d environment variables.
HELPER_IMAGES = {"K3D_IMAGE_LOADBALANCER": "k3d-proxy", "K3D_IMAGE_TOOLS": "k3d-tools"}
REQUIRED_K3S_ARGS = ("--disable=traefik,servicelb,metrics-server", "--disable-default-registry-endpoint")
READY_BOUND_S = 300  # [P] the bound on API readiness for 'up' and 'start'; R1 reads its own from the scenario
PRESSURE_LIMIT = 10.0  # [P] memory pressure (avg10, %) above which a run is disturbed (WP-0.2 plan §4.1)


class SubstrateError(RuntimeError):
    pass


# --------------------------------------------------------------------------- the k3d configuration


def memory_gib(text: str) -> float:
    """A k3d/Docker memory size such as '3g', '3072m' or '3Gi' in GiB."""
    value = str(text).strip().lower().rstrip("ib").rstrip("b")
    units = {"k": 1 / (1024 * 1024), "m": 1 / 1024, "g": 1.0, "t": 1024.0}
    try:
        if value and value[-1] in units:
            return float(value[:-1]) * units[value[-1]]
        return float(value) / GIB
    except ValueError as exc:
        raise ConfigError(f"not a memory size: {text!r}") from exc


@dataclass
class Profile:
    name: str
    path: Path
    data: dict[str, Any]

    @property
    def cluster(self) -> str:
        return str(self.data["metadata"]["name"])

    @property
    def network(self) -> str:
        return str(self.data.get("network") or f"k3d-{self.cluster}")

    @property
    def subnet(self) -> str:
        return str(self.data.get("subnet") or "")

    @property
    def servers(self) -> int:
        return int(self.data.get("servers") or 0)

    @property
    def servers_memory_gib(self) -> float:
        return memory_gib(((self.data.get("options") or {}).get("runtime") or {}).get("serversMemory") or "0")

    def k3s_args(self) -> list[str]:
        extra = ((self.data.get("options") or {}).get("k3s") or {}).get("extraArgs") or []
        return [str(entry.get("arg")) for entry in extra if isinstance(entry, dict)]


def load_profile(root: Path, name: str) -> Profile:
    import yaml  # PyYAML, pinned in tools/requirements.txt

    if name not in PROFILES:
        raise ConfigError(f"unknown profile {name!r}; one of {PROFILES}")
    path = root / K3D_DIR / f"{name}.k3d.yaml"
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ConfigError(f"{path}: the top level must be a mapping")
    return Profile(name=name, path=path, data=data)


def profile_problems(profile: Profile, registry_host: str) -> list[str]:
    """Why a k3d configuration does not give the substrate WP-0.2 needs (empty if it does)."""
    import ipaddress

    d = profile.data
    problems = []
    if d.get("apiVersion") != "k3d.io/v1alpha5" or d.get("kind") != "Simple":
        problems.append("want apiVersion k3d.io/v1alpha5 and kind Simple (the schema k3d 5.8 reads)")
    if not str((d.get("metadata") or {}).get("name") or ""):
        problems.append("metadata.name (the cluster name) is missing")
    if "image" in d:
        problems.append("'image' is set; cell up fills it in from cell.yaml as <registry>/<path>@<pinned digest>")
    if profile.servers != 3 or int(d.get("agents") or 0) != 0:
        problems.append(f"want three servers and no agents (the on-site shape), got servers={d.get('servers')!r} "
                        f"agents={d.get('agents')!r}")
    try:
        net = ipaddress.ip_network(profile.subnet)
        if net.subnet_of(ipaddress.ip_network("172.16.0.0/12")):
            problems.append(f"subnet {profile.subnet} is inside 172.16.0.0/12, where WSL and Docker pick their own "
                            "networks (OQ-122)")
        if net.num_addresses < 16:
            problems.append(f"subnet {profile.subnet} is too small for the nodes, load balancer and registry")
    except ValueError:
        problems.append(f"subnet {profile.subnet!r} is not a fixed subnet (want for example 10.213.2.0/24); without "
                        "one, k3d gives no node a fixed address")
    api = d.get("kubeAPI") or {}
    if api.get("hostIP") != "127.0.0.1" or not str(api.get("hostPort") or "").isdigit():
        problems.append("kubeAPI must publish the API on 127.0.0.1 at a fixed hostPort")
    k3d_opts = (d.get("options") or {}).get("k3d") or {}
    if k3d_opts.get("disableLoadbalancer"):
        problems.append("the server load balancer is disabled; kubectl would then depend on one server")
    uses = (d.get("registries") or {}).get("use") or []
    if registry_host not in uses:
        problems.append(f"registries.use does not name the local registry {registry_host}")
    args = profile.k3s_args()
    for needed in (*REQUIRED_K3S_ARGS, f"--system-default-registry={registry_host}"):
        if needed not in args:
            problems.append(f"k3s argument {needed} is missing")
    extra = ((d.get("options") or {}).get("k3s") or {}).get("extraArgs") or []
    for entry in extra:
        if isinstance(entry, dict) and entry.get("nodeFilters") != ["server:*"]:
            problems.append(f"k3s argument {entry.get('arg')} must apply to every server (nodeFilters ['server:*'])")
    try:
        if profile.servers_memory_gib <= 0:
            problems.append("options.runtime.serversMemory is not set")
    except ConfigError as exc:
        problems.append(str(exc))
    kube_conf = (d.get("options") or {}).get("kubeconfig") or {}
    if kube_conf.get("updateDefaultKubeconfig") is not False:
        problems.append("options.kubeconfig.updateDefaultKubeconfig must be false (the kubeconfig lives in "
                        "HMS_CELL_HOME)")
    return problems


def rendered(profile: Profile, k3s_ref: str) -> dict[str, Any]:
    """The configuration k3d receives: the profile's file with the k3s image filled in."""
    out = json.loads(json.dumps(profile.data))
    out["image"] = k3s_ref
    return out


# --------------------------------------------------------------------------- the substrate


@dataclass
class Check:
    name: str
    ok: bool
    detail: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {"check": self.name, "ok": self.ok, "detail": self.detail}


@dataclass
class Substrate:
    """One profile's cluster. `ctx` is images.Ctx (pins, HMS_CELL_HOME, the runner); the clock, the sleep, the
    memory reading and the etcd fetch are replaceable for the tests."""

    ctx: Any
    profile: Profile
    clock: Callable[[], float] = time.monotonic
    wall: Callable[[], float] = time.time
    sleep: Callable[[float], None] = time.sleep
    mem_gib: Callable[[], Optional[float]] = mem_available_gib
    pressure: Callable[[], Optional[float]] = lambda: memory_pressure()
    etcd_fetch: Optional[kube.Fetch] = None

    @property
    def runner(self):
        return self.ctx.runner

    @property
    def state_dir(self) -> Path:
        return self.ctx.home / "k3d"

    @property
    def kubeconfig(self) -> Path:
        return self.state_dir / f"{self.profile.name}.kubeconfig"

    @property
    def registry_container(self) -> str:
        return str(self.ctx.registry["container"])

    # --- references
    def k3s_image(self) -> Image:
        return self.ctx.cfg.image(str(self.ctx.cfg.data["kubernetes"]["image"]))

    def host_ref(self, image: Image) -> str:
        """The reference the host's Docker pulls: the local registry on loopback, at the pinned digest."""
        return f"{self.ctx.push_host}/{image.local}@{image.digest}"

    def substrate_images(self) -> list[Image]:
        """Every image the substrate runs, the k3s image first: the nodes, k3d's helpers and k3s's own pods."""
        k3s = self.k3s_image()
        rest = [i for i in self.ctx.cfg.profile_images(self.profile.name) if i.role == "substrate" and i.name != k3s.name]
        for name in HELPER_IMAGES.values():
            if name not in {i.name for i in rest}:
                raise ConfigError(f"cell.yaml has no substrate image {name!r} (k3d's helper)")
        return [k3s, *rest]

    # --- guards
    def memory_guard(self, what: str) -> float:
        """Refuse to start the cell below the line: cell.yaml's for lite; for an unmeasured profile, all of its
        servers' memory (KA-015)."""
        minimum = float(self.ctx.cfg.guards["cell_min_available_gib"])
        if self.profile.name != "lite":
            minimum = max(minimum, self.profile.servers * self.profile.servers_memory_gib)
        available = self.mem_gib()
        if available is None:
            raise GuardError(f"{what}: cannot read MemAvailable (/proc/meminfo); the cell runs on the Linux build host")
        if available < minimum:
            raise GuardError(f"{what}: {available:.1f} GiB available, below the {minimum:g} GiB the {self.profile.name} "
                             "cell needs before it starts; stop other heavy jobs (Gradle, Playwright) and try again")
        return available

    # --- reading the cluster
    def containers(self) -> list[docker.Container]:
        return docker.cluster_containers(self.runner, self.profile.cluster)

    def tracked(self, containers: list[docker.Container]) -> list[docker.Container]:
        """The containers whose address on the cell network must be fixed: nodes, load balancer, registry."""
        out = list(containers)
        try:
            out += docker.inspect(self.runner, [self.registry_container])
        except docker.DockerError:
            pass
        return out

    def snapshot(self, node_addresses: dict[str, str]) -> kube.Snapshot:
        """API readiness, the nodes, and etcd's members asked of the first node (by address) that answers."""
        snap = kube.Snapshot()
        snap.api = kube.api_ready(self.runner, self.kubeconfig)
        try:
            snap.nodes = kube.nodes(self.runner, self.kubeconfig)
        except kube.KubeError as exc:
            snap.api = (snap.api[0], f"{snap.api[1]}; {exc}")
        if not node_addresses:
            snap.etcd_error = "no server node holds an address to ask etcd at"
        for name, address in node_addresses.items():
            try:
                snap.members = kube.etcd_members(self.runner, name, address, fetch=self.etcd_fetch)
                snap.etcd_error = ""
                break
            except kube.KubeError as exc:
                snap.etcd_error = str(exc)
        return snap

    def address_checks(self, containers: list[docker.Container], snap: Optional[kube.Snapshot]) -> list[Check]:
        net, subnet = self.profile.network, self.profile.subnet
        tracked = self.tracked(containers)
        problems = docker.address_problems(tracked, net, subnet)
        if self.registry_container not in {c.name for c in tracked}:
            problems.append(f"{self.registry_container}: not found; run 'tools/hms cell registry up'")
        checks = [Check("fixed-addresses", not problems,
                        "; ".join(problems) or f"{len(tracked)} containers hold their fixed address on {net}")]
        if snap is None:
            return checks
        fixed = held_addresses(containers, net)
        node_problems = []
        by_name = {n.name: n for n in snap.nodes}
        for name, address in fixed.items():
            node = by_name.get(name)
            if node is None:
                node_problems.append(f"no Kubernetes node {name}")
            elif node.internal_ip != address:
                node_problems.append(f"node {name} has InternalIP {node.internal_ip or 'none'}, not {address}")
        checks.append(Check("node-addresses", not node_problems,
                            "; ".join(node_problems) or "every node's InternalIP is its fixed address"))
        if snap.etcd_error:
            checks.append(Check("etcd-members", False, snap.etcd_error))
        else:
            member_problems = kube.member_problems(snap.members, fixed)
            checks.append(Check("etcd-members", not member_problems, "; ".join(member_problems) or
                                f"{len(snap.members)} started voting members, each at its node's fixed address"))
        return checks

    def wait_ready(self, bound_s: float, poll_s: float = 2.0, started: Optional[float] = None,
                   pressure_max: Optional[list[float]] = None,
                   renewed_after: Optional[float] = None) -> dict[str, Optional[float]]:
        """Poll until the API is ready and every server node is Ready, or until bound_s after `started`.
        With renewed_after (a wall-clock time), a node counts as Ready only once its kubelet has also renewed
        its lease after that time. Returns the seconds (from `started`) at which each first held, or None."""
        start = self.clock() if started is None else started
        out: dict[str, Optional[float]] = {"api_ready_s": None, "nodes_ready_s": None}
        while True:
            now = self.clock() - start
            if pressure_max is not None:
                reading = self.pressure()
                if reading is not None:
                    pressure_max.append(reading)
            if out["api_ready_s"] is None and kube.api_ready(self.runner, self.kubeconfig)[0]:
                out["api_ready_s"] = round(now, 1)
            if out["api_ready_s"] is not None and out["nodes_ready_s"] is None:
                try:
                    found = kube.nodes(self.runner, self.kubeconfig)
                except kube.KubeError:
                    found = []
                ready = len(found) >= self.profile.servers and all(n.ready for n in found)
                if ready and renewed_after is not None:
                    try:
                        leases = kube.node_leases(self.runner, self.kubeconfig)
                    except kube.KubeError:
                        leases = {}
                    ready = all(leases.get(n.name, 0.0) > renewed_after for n in found)
                if ready:
                    out["nodes_ready_s"] = round(self.clock() - start, 1)
            if out["nodes_ready_s"] is not None or self.clock() - start > bound_s:
                return out
            self.sleep(poll_s)

    def explain_not_ready(self, containers: list[docker.Container]) -> list[str]:
        """The comparison §1 asks for when an existing cluster does not come back: each node's fixed and current
        address against the peer address its own etcd configuration names."""
        lines = []
        for c in docker.servers(containers):
            endpoint = c.networks.get(self.profile.network)
            peer = "?"
            if c.running:
                try:
                    peer = ", ".join(kube.etcd_local_config(self.runner, c.name)["peer_hosts"]) or "none"
                except kube.KubeError as exc:
                    peer = f"unreadable ({exc})"
            lines.append(f"{c.name}: running={c.running} fixed={endpoint.fixed if endpoint else None} "
                         f"holds={endpoint.address if endpoint else None} etcd peer address={peer}")
        lines.append("cell up never recreates a cluster: inspect it, then 'k3d cluster delete "
                     f"{self.profile.cluster}' by hand (cell down comes in S7); the last resort on a node is "
                     "'k3s server --cluster-reset' (docs/runbooks/dev-cell.md, S7)")
        return lines

    # --- actions
    def check_network(self) -> str:
        subnets = docker.network_subnets(self.runner, self.profile.network)
        if subnets is not None and self.profile.subnet not in subnets:
            raise SubstrateError(f"network {self.profile.network} exists with subnets {subnets}, not "
                                 f"{self.profile.subnet}; it is not this cell's")
        ignore = [docker.bridge_device(self.runner, self.profile.network)] if subnets is not None else []
        if self.routes_json is not None:
            text = self.routes_json()
        else:
            r = self.runner(["ip", "-j", "-4", "route"], timeout=30)
            if not r.ok:
                raise SubstrateError(f"cannot read the host routes (ip -j -4 route): {r.tail()}")
            text = r.stdout
        overlaps = docker.route_overlaps(text, self.profile.subnet, [d for d in ignore if d])
        if overlaps:
            raise SubstrateError(f"subnet {self.profile.subnet} overlaps host routes {overlaps}; choose another in "
                                 f"{self.profile.path.name}")
        return f"subnet {self.profile.subnet}: overlaps no host route"

    def verify_images(self) -> list[str]:
        from .images import verify

        outcomes = verify(self.ctx, self.substrate_images())
        bad = [o for o in outcomes if not o.ok]
        if bad:
            raise SubstrateError("signature check failed, nothing started: " +
                                 "; ".join(f"{o.name}: {o.detail}" for o in bad))
        return [f"verified {o.name}: {o.detail}" for o in outcomes]

    def registry_running(self) -> None:
        try:
            found = docker.inspect(self.runner, [self.registry_container])
        except docker.DockerError as exc:
            raise SubstrateError(f"the local registry is not there ({exc}); run 'tools/hms cell registry up'") from exc
        if not found[0].running:
            raise SubstrateError(f"{self.registry_container} is stopped; run 'tools/hms cell registry up'")

    def helper_env(self) -> dict[str, str]:
        return {var: self.host_ref(self.ctx.cfg.image(name)) for var, name in HELPER_IMAGES.items()}

    def fix_addresses(self) -> list[str]:
        """Fix the load balancer's and the registry's address on the cell network (k3d fixes only the nodes')."""
        steps = []
        net = self.profile.network
        others = [c for c in self.tracked(self.containers()) if c.role != "server"]
        for c in others:
            if net in c.networks:
                steps.append(docker.fix_address(self.runner, c, net))
        return steps

    def write_kubeconfig(self) -> str:
        r = self.runner(["k3d", "kubeconfig", "get", self.profile.cluster], timeout=60)
        if not r.ok or "apiVersion" not in r.stdout:
            raise SubstrateError(f"k3d kubeconfig get {self.profile.cluster}: {r.tail()}")
        write_private(self.kubeconfig, r.stdout)
        return f"kubeconfig {self.kubeconfig} (mode 600)"

    def create(self) -> list[str]:
        k3s = self.k3s_image()
        config = rendered(self.profile, self.host_ref(k3s))
        path = self.state_dir / f"{self.profile.name}.k3d.yaml"
        write_private(path, json.dumps(config, indent=2) + "\n")  # JSON is YAML; k3d reads it
        self.ctx.disk_guard("cell up")
        r = self.runner(["k3d", "cluster", "create", "--config", str(path)], env=self.helper_env(), timeout=900)
        if not r.ok:
            raise SubstrateError(f"k3d cluster create failed: {r.tail(5)}")
        return [f"created cluster {self.profile.cluster} from {path} (k3s {self.host_ref(k3s)})"]

    def start_nodes(self, containers: list[docker.Container]) -> list[str]:
        stopped = [c.name for c in containers if not c.running]
        if not stopped:
            return ["every node and the load balancer were running"]
        nodes_first = [c.name for c in docker.servers(containers) if not c.running]
        nodes_first += [n for n in stopped if n not in nodes_first]
        docker.run_ok(self.runner, ["docker", "start", *nodes_first], "docker start", timeout=300)
        return [f"started {', '.join(nodes_first)}"]

    def ready_or_explain(self, steps: list[str], bound_s: float = READY_BOUND_S) -> dict[str, Optional[float]]:
        times = self.wait_ready(bound_s)
        if times["nodes_ready_s"] is None:
            lines = self.explain_not_ready(self.containers())
            raise SubstrateError(f"the API or a node is not ready within {bound_s:g} s (api_ready_s="
                                 f"{times['api_ready_s']}):\n  " + "\n  ".join(lines))
        steps.append(f"API ready after {times['api_ready_s']} s; {self.profile.servers} nodes Ready after "
                     f"{times['nodes_ready_s']} s")
        return times

    def pods_check(self, bound_s: float = READY_BOUND_S, poll_s: float = 3.0) -> Check:
        """Every kube-system pod Running and Ready, each image from the local registry (no pull bypassed it)."""
        start = self.clock()
        while True:
            found = kube.pods(self.runner, self.kubeconfig, "kube-system")
            foreign = kube.foreign_images(found, self.ctx.host)
            if foreign:
                return Check("system-pods", False, "images not from the local registry: " + "; ".join(foreign))
            waiting = [f"{p.name} ({p.phase})" for p in found if p.phase != "Succeeded" and not p.ready]
            if found and not waiting:
                return Check("system-pods", True, f"{len(found)} kube-system pods ready, every image from "
                                                  f"{self.ctx.host}")
            if self.clock() - start > bound_s:
                return Check("system-pods", False, f"not ready within {bound_s:g} s: {', '.join(waiting) or 'no pods'}")
            self.sleep(poll_s)

    def up(self) -> tuple[list[str], list[Check]]:
        steps: list[str] = []
        problems = profile_problems(self.profile, self.ctx.host)
        if problems:
            raise SubstrateError(f"{self.profile.path.name}: " + "; ".join(problems))
        containers = self.containers()
        if not containers or any(not c.running for c in containers):
            steps.append(f"{self.mem_gib_text('cell up')} available")
        self.registry_running()
        steps.append(self.check_network())
        steps += self.verify_images()
        if containers:
            steps.append(f"cluster {self.profile.cluster} exists; starting and checking it, never recreating it")
            steps += self.start_nodes(containers)
        else:
            steps += self.create()
        steps += self.fix_addresses()
        steps.append(self.write_kubeconfig())
        self.ready_or_explain(steps)
        return steps, self.checks(with_pods=True)

    def mem_gib_text(self, what: str) -> str:
        return f"{self.memory_guard(what):.1f} GiB"

    def start(self) -> tuple[list[str], list[Check]]:
        containers = self.containers()
        if not containers:
            raise SubstrateError(f"no cluster {self.profile.cluster}; run 'tools/hms cell up --only substrate'")
        steps = []
        if any(not c.running for c in containers):
            steps.append(f"{self.mem_gib_text('cell start')} available")
        self.registry_running()
        steps += self.start_nodes(containers)
        if not self.kubeconfig.exists():
            steps.append(self.write_kubeconfig())
        self.ready_or_explain(steps)
        return steps, self.checks(with_pods=False)

    def stop(self) -> list[str]:
        containers = self.containers()
        if not containers:
            raise SubstrateError(f"no cluster {self.profile.cluster}")
        running = [c.name for c in containers if c.running]
        if not running:
            return [f"cluster {self.profile.cluster} is already stopped"]
        lb = [c.name for c in containers if c.running and c.role != "server"]
        nodes = [c.name for c in docker.servers(containers) if c.running]
        docker.run_ok(self.runner, ["docker", "stop", "--time", "60", *lb, *nodes], "docker stop", timeout=600)
        return [f"stopped {', '.join(lb + nodes)}; the registry and HMS_CELL_HOME are kept"]

    def checks(self, with_pods: bool) -> list[Check]:
        containers = self.containers()
        servers = docker.servers(containers)
        snap = self.snapshot(held_addresses(containers, self.profile.network))
        checks = [Check("api-ready", snap.api[0], snap.api[1]),
                  Check("nodes-ready", len(snap.nodes) == self.profile.servers and all(n.ready for n in snap.nodes),
                        ", ".join(f"{n.name}={'Ready' if n.ready else 'NotReady'}" for n in snap.nodes) or "no nodes")]
        checks += self.address_checks(containers, snap)
        policies = {c.name: c.restart_policy for c in containers}
        checks.append(Check("restart-policy", all(p == "unless-stopped" for p in policies.values()),
                            ", ".join(f"{n}={p}" for n, p in policies.items())))
        want = int(self.profile.servers_memory_gib * GIB)
        memory = {c.name: c.memory_bytes for c in servers}
        checks.append(Check("servers-memory", all(abs(m - want) < 1024 * 1024 for m in memory.values()),
                            f"want {self.profile.servers_memory_gib:g} GiB each; " +
                            ", ".join(f"{n}={m / GIB:g} GiB" for n, m in memory.items())))
        k3s = self.host_ref(self.k3s_image())
        images = {c.name: c.image for c in servers}
        checks.append(Check("k3s-image", all(i == k3s for i in images.values()),
                            k3s if all(i == k3s for i in images.values()) else json.dumps(images)))
        if with_pods:
            checks.append(self.pods_check())
        return checks

    def status(self) -> tuple[str, list[Check], dict[str, Any]]:
        """The cell's state without changing anything: 'absent', 'stopped', 'partial' or 'running'."""
        containers = self.containers()
        details: dict[str, Any] = {"cluster": self.profile.cluster, "network": self.profile.network,
                                   "subnet": self.profile.subnet,
                                   "containers": [c.to_dict() for c in self.tracked(containers)]}
        if not containers:
            return "absent", [], details
        running = [c for c in containers if c.running]
        if not running:
            return "stopped", self.address_checks(containers, None), details
        if len(running) < len(containers):
            return "partial", self.address_checks(containers, None), details
        return "running", self.checks(with_pods=False), details


def held_addresses(containers: list[docker.Container], network: str) -> dict[str, str]:
    """Server node -> its fixed address on the network, or the address it holds if none is fixed (the
    fixed-addresses check fails that case on its own)."""
    out = {}
    for c in docker.servers(containers):
        endpoint = c.networks.get(network)
        if endpoint and (endpoint.fixed or endpoint.address):
            out[c.name] = endpoint.fixed or endpoint.address
    return out


# --------------------------------------------------------------------------- R1


def load_scenario(root: Path, name: str) -> dict[str, Any]:
    import yaml  # PyYAML, pinned in tools/requirements.txt

    path = root / SCENARIO_DIR / f"{name}.yaml"
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    problems = scenario_problems(data)
    if problems:
        raise ConfigError(f"{path}: " + "; ".join(problems))
    return data


def scenario_problems(data: Any) -> list[str]:
    if not isinstance(data, dict):
        return ["not a mapping"]
    problems = [f"missing {key!r}" for key in ("id", "name", "test", "verification", "hazards", "controls", "kill",
                                               "start_order", "bounds", "pass") if key not in data]
    if problems:
        return problems
    bounds = data["bounds"] or {}
    for key in ("api_ready_s", "poll_s", "memory_pressure_avg10_max"):
        if not isinstance(bounds.get(key), (int, float)) or bounds.get(key) <= 0:
            problems.append(f"bounds.{key} must be a positive number")
    if data["kill"] != "all-servers":
        problems.append(f"kill is {data['kill']!r}; R1 kills all-servers")
    if data["start_order"] not in ("reverse", "creation"):
        problems.append(f"start_order is {data['start_order']!r}; one of reverse, creation")
    return problems


def memory_pressure(text: Optional[str] = None) -> Optional[float]:
    """'some avg10' from /proc/pressure/memory, in %, or None where there is no PSI."""
    if text is None:
        try:
            text = Path("/proc/pressure/memory").read_text(encoding="ascii")
        except OSError:
            return None
    for line in text.splitlines():
        if line.startswith("some "):
            for part in line.split():
                if part.startswith("avg10="):
                    return float(part.split("=", 1)[1])
    return None


@dataclass
class RestartReport:
    scenario: dict[str, Any]
    profile: str
    result: str = "ERROR"
    error: str = ""
    timeline: list[dict[str, Any]] = field(default_factory=list)
    before: dict[str, Any] = field(default_factory=dict)
    after: dict[str, Any] = field(default_factory=dict)
    times: dict[str, Optional[float]] = field(default_factory=dict)
    checks: list[Check] = field(default_factory=list)
    host: dict[str, Any] = field(default_factory=dict)

    @property
    def passed(self) -> bool:
        return self.result == "PASS"

    def to_dict(self) -> dict[str, Any]:
        s = self.scenario
        return {"scenario": {k: s.get(k) for k in ("id", "name", "verification", "hazards", "controls", "kill",
                                                   "start_order", "bounds")},
                "profile": self.profile, "result": self.result, "error": self.error or None,
                "times_s": self.times, "checks": [c.to_dict() for c in self.checks], "timeline": self.timeline,
                "before": self.before, "after": self.after, "host": self.host}


def restart_test(sub: Substrate, scenario: dict[str, Any]) -> RestartReport:
    """R1: kill every server node at once, start them in the scenario's order, and judge the restart."""
    report = RestartReport(scenario=scenario, profile=sub.profile.name)
    bounds = scenario["bounds"]
    bound, poll, pressure_limit = float(bounds["api_ready_s"]), float(bounds["poll_s"]), float(
        bounds["memory_pressure_avg10_max"])
    net = sub.profile.network
    t0 = sub.clock()

    def mark(event: str, **extra: Any) -> None:
        report.timeline.append({"t_s": round(sub.clock() - t0, 1), "event": event, **extra})

    # Precondition: a healthy running substrate. Nothing is killed otherwise.
    state, checks, _ = sub.status()
    bad = [c for c in checks if not c.ok]
    if state != "running" or bad:
        report.error = (f"precondition: the cell is {state}" + (": " + "; ".join(f"{c.name}: {c.detail}" for c in bad)
                                                               if bad else "") + "; nothing was killed")
        return report
    containers = sub.containers()
    servers = docker.servers(containers)
    if len(servers) != sub.profile.servers:
        report.error = f"precondition: {len(servers)} server nodes, want {sub.profile.servers}; nothing was killed"
        return report
    fixed = {c.name: c.networks[net].fixed for c in servers}
    before_snap = sub.snapshot(fixed)
    report.before = {"addresses": docker.addresses(sub.tracked(containers), net),
                     "etcd_members": [m.to_dict() for m in before_snap.members],
                     "restart_policies": {c.name: c.restart_policy for c in servers}}
    report.host["mem_available_gib_before"] = _round(sub.mem_gib())
    names = [c.name for c in servers]
    order = list(reversed(names)) if scenario["start_order"] == "reverse" else names
    policies = {c.name: c.restart_policy or "no" for c in servers}
    pressure: list[float] = []
    try:
        # Docker must not restart a killed node behind the test's back (WP-0.2 plan §4.2).
        docker.run_ok(sub.runner, ["docker", "update", "--restart=no", *names], "docker update")
        mark("restart policy set to no", nodes=names)
        killed_at = sub.wall()
        docker.run_ok(sub.runner, ["docker", "kill", *names], "docker kill")
        mark("killed", nodes=names)
        still = [c.name for c in docker.inspect(sub.runner, names) if c.running]
        if still:
            raise SubstrateError(f"still running after docker kill: {still}")
        first_start = None
        for name in order:
            docker.run_ok(sub.runner, ["docker", "start", name], f"docker start {name}", timeout=120)
            if first_start is None:
                first_start = sub.clock()
            mark("started", node=name)
        for name in names:
            docker.run_ok(sub.runner, ["docker", "update", f"--restart={policies[name]}", name], "docker update")
        mark("restart policy restored", policies=policies)
        times = sub.wait_ready(bound, poll, started=first_start, pressure_max=pressure, renewed_after=killed_at)
        report.times = {"api_ready_s": times["api_ready_s"], "nodes_ready_s": times["nodes_ready_s"],
                        "bound_s": bound}
        mark("api ready" if times["api_ready_s"] is not None else "api not ready within the bound",
             after_first_start_s=times["api_ready_s"])
    except (docker.DockerError, SubstrateError) as exc:
        report.error = str(exc)
        mark("error", detail=str(exc))
        for name in names:  # never leave a node without its restart policy
            sub.runner(["docker", "update", f"--restart={policies[name]}", name], timeout=60)
        return report

    # Judge. etcd may need a moment more than the API to list members; retry within the bound.
    after_containers = sub.containers()
    after_snap = sub.snapshot(fixed)
    while after_snap.etcd_error and first_start is not None and sub.clock() - first_start <= bound:
        sub.sleep(poll)
        after_snap = sub.snapshot(fixed)
    report.after = {"addresses": docker.addresses(sub.tracked(after_containers), net),
                    "etcd_members": [m.to_dict() for m in after_snap.members], "etcd_error": after_snap.etcd_error or None,
                    "nodes": [n.to_dict() for n in after_snap.nodes],
                    "restart_policies": {c.name: c.restart_policy for c in docker.servers(after_containers)}}
    try:
        leases = kube.node_leases(sub.runner, sub.kubeconfig)
        report.after["lease_renewed_s_after_kill"] = {n: round(t - killed_at, 1) for n, t in sorted(leases.items())}
    except kube.KubeError as exc:
        report.after["lease_renewed_s_after_kill"] = str(exc)
    api_s, nodes_s = report.times.get("api_ready_s"), report.times.get("nodes_ready_s")
    report.checks.append(Check("api-ready-within-bound", api_s is not None and api_s <= bound,
                               f"/readyz ok {api_s} s after the first start (bound {bound:g} s)" if api_s is not None
                               else f"not ready within {bound:g} s"))
    report.checks.append(Check("nodes-ready-within-bound", nodes_s is not None and nodes_s <= bound,
                               f"{sub.profile.servers} nodes Ready, each kubelet's lease renewed after the kill, "
                               f"{nodes_s} s after the first start" if nodes_s is not None
                               else f"not all Ready with a lease renewed after the kill within {bound:g} s"))
    unchanged = report.before["addresses"] == report.after["addresses"]
    report.checks.append(Check("addresses-unchanged", unchanged, "every node, the load balancer and the registry "
                               "hold the address they held before" if unchanged else
                               f"before {report.before['addresses']}; after {report.after['addresses']}"))
    report.checks += [c for c in sub.address_checks(after_containers, after_snap)]
    same_members = sorted(m["id"] for m in report.before["etcd_members"]) == sorted(m.id for m in after_snap.members)
    report.checks.append(Check("etcd-same-members", same_members and not after_snap.etcd_error,
                               f"the same {len(after_snap.members)} member IDs as before" if same_members else
                               f"before {[m['id'] for m in report.before['etcd_members']]}; after "
                               f"{[m.id for m in after_snap.members]} {after_snap.etcd_error}".rstrip()))
    restored = report.after["restart_policies"] == report.before["restart_policies"]
    report.checks.append(Check("restart-policy-restored", restored, json.dumps(report.after["restart_policies"])))
    peak = max(pressure) if pressure else None
    report.host.update({"mem_available_gib_after": _round(sub.mem_gib()), "memory_pressure_avg10_max": peak,
                        "memory_pressure_limit": pressure_limit})
    if all(c.ok for c in report.checks):
        report.result = "DISTURBED" if peak is not None and peak > pressure_limit else "PASS"
    else:
        report.result = "FAIL"
    return report


def _round(value: Optional[float]) -> Optional[float]:
    return None if value is None else round(value, 2)
