"""The local registry and the image lock: `cell registry up`, `cell keys init`, `cell images mirror|sign|verify`.

WP-0.2 plan, slice S1 (OQ-124, OQ-130, OQ-135; BUILD-PROMPT.md §4.1, §4.3).
- `registry up`: the CNCF Distribution registry, pinned by digest, created with `k3d registry create`, storage in
  HMS_CELL_HOME, published on loopback only, attached to its own network and to an --internal network that holds
  nothing else.
- `images mirror`: `crane copy --platform linux/amd64` of each pinned manifest digest from its publisher into the
  local registry under its local path and tag (the digest is kept). Idempotent: an image already present at its
  pinned digest is not pulled again; a local tag that points elsewhere is an error, never overwritten. Before
  each pull the disk guard stops the run below the DN-013 line.
- `images sign`: cosign 3 with the cell key and the service-free signing configuration, on the internal network.
  An image that already verifies is not signed again.
- `images verify`: every image of the profile is present at its pinned digest and its signature verifies against
  the cell key offline. `--evidence` writes the record (cell/<date>-images-<shortsha>[-dirty].json).
"""

from __future__ import annotations

import hashlib
import json
import os
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Optional

from . import signing
from .config import CellConfig, Image
from .proc import DockerRun, GuardError, Result, Runner, ensure_private_dir, host_user, require_disk, run, write_private


class CellError(RuntimeError):
    pass


@dataclass
class Ctx:
    cfg: CellConfig
    home: Path
    env: dict[str, str]
    runner: Runner = run
    say: Callable[[str], None] = print
    http_get: Optional[Callable[[str], int]] = None
    free_gib: Optional[Callable[[], float]] = None  # tests replace the disk guard's measurement
    download: Optional[Callable[[str], bytes]] = None  # tests replace the https download of charts and manifests

    # --- paths and references
    @property
    def registry(self) -> dict[str, Any]:
        return self.cfg.registry

    @property
    def host(self) -> str:
        """The registry's name on the Docker networks: what pods and signatures reference."""
        return str(self.registry["host"])

    @property
    def push_host(self) -> str:
        """The registry as crane reaches it from the host network: localhost:<port>, which crane speaks HTTP to
        without its --insecure option (which would also drop TLS checks on the publisher's side)."""
        return "localhost:" + str(self.registry["host_port"]).rsplit(":", 1)[-1]

    @property
    def key_dir(self) -> Path:
        return self.home / str(self.cfg.signing["key_dir"])

    @property
    def config_dir(self) -> Path:
        return self.home

    @property
    def signing_config_path(self) -> Path:
        return self.home / str(self.cfg.signing["signing_config"])

    @property
    def passphrase_file(self) -> Path:
        return self.home / str(self.cfg.signing["passphrase_file"])

    # --- guards
    def disk_guard(self, what: str) -> float:
        minimum = float(self.cfg.guards["disk_min_free_gib"])
        if self.free_gib is not None:
            free = self.free_gib()
            if free < minimum:
                raise GuardError(f"{what}: {free:.1f} GiB free, below the {minimum:g} GiB line (DN-013); stopped "
                                 "before pulling anything more")
            return free
        return require_disk(Path(str(self.cfg.guards["disk_path"])), minimum, what)

    # --- tool containers
    def crane(self, *args: str) -> Result:
        return self.runner(DockerRun(self.cfg.tool("crane").ref, list(args), network="host").argv(), timeout=1800)

    def cosign(self, args: list[str], *, network: str, keys_read_only: bool = True, with_passphrase: bool = False,
               with_config: bool = False) -> Result:
        mounts = [(str(self.key_dir), signing.IN_CONTAINER_KEYS, keys_read_only)]
        if with_config:
            mounts.append((str(self.signing_config_path), f"{signing.IN_CONTAINER_CONFIG}/signing-config.json", True))
        env = None
        names: list[str] = []
        if with_passphrase:
            env = {signing.COSIGN_ENV: signing.passphrase(self.env)}
            names = [signing.COSIGN_ENV]
        docker = DockerRun(self.cfg.tool("cosign").ref, signing.check_argv(args), network=network, user=host_user(),
                           mounts=mounts, env_names=names, env_values={"HOME": "/tmp", "TUF_ROOT": "/tmp/tuf"})
        return self.runner(docker.argv(), env=env, timeout=600)

    def docker(self, *args: str, timeout: float = 600) -> Result:
        return self.runner(["docker", *args], timeout=timeout)


# --------------------------------------------------------------------------- registry


def _network(ctx: Ctx, spec: dict[str, Any], internal: bool) -> str:
    name, subnet = str(spec["name"]), str(spec["subnet"])
    r = ctx.docker("network", "inspect", name, "--format", "{{json .IPAM.Config}}|{{.Internal}}")
    if r.ok:
        config, _, is_internal = r.stdout.strip().rpartition("|")
        try:
            subnets = {entry.get("Subnet") for entry in json.loads(config or "[]")}
        except json.JSONDecodeError:
            subnets = set()
        if subnet not in subnets or (is_internal == "true") != internal:
            raise CellError(f"network {name} exists with subnets {sorted(s for s in subnets if s)} and internal="
                            f"{is_internal}; cell.yaml wants {subnet} and internal={str(internal).lower()}. Remove it "
                            "(docker network rm) or fix cell.yaml")
        return f"network {name}: present ({subnet}{', internal' if internal else ''})"
    create = ["network", "create", "--driver", "bridge", "--subnet", subnet, "--label", "app=hms-cell"]
    if internal:
        create.append("--internal")
    r = ctx.docker(*create, name)
    if not r.ok:
        raise CellError(f"cannot create network {name}: {r.tail()}")
    return f"network {name}: created ({subnet}{', internal' if internal else ''})"


def _probe(ctx: Ctx, url: str) -> int:
    if ctx.http_get is not None:
        return ctx.http_get(url)
    try:
        with urllib.request.urlopen(url, timeout=10) as response:  # noqa: S310 (loopback HTTP registry)
            return response.status
    except urllib.error.HTTPError as exc:
        return exc.code
    except OSError:
        return 0


def registry_up(ctx: Ctx) -> list[str]:
    reg = ctx.registry
    image = ctx.cfg.image(str(reg["image"]))
    pinned = image.upstream_by_digest
    container = str(reg["container"])
    steps = [_network(ctx, reg["network"], internal=False), _network(ctx, reg["offline_network"], internal=True)]
    r = ctx.docker("inspect", container, "--format", "{{.Config.Image}}|{{.State.Running}}")
    if r.ok:
        running_image, _, running = r.stdout.strip().rpartition("|")
        if running_image != pinned:
            raise CellError(f"{container} runs {running_image}, not the pinned {pinned}; remove it with 'k3d registry "
                            f"delete {reg['k3d_name']}' (its storage in HMS_CELL_HOME stays) and run this again")
        if running != "true":
            r = ctx.docker("start", container)
            if not r.ok:
                raise CellError(f"cannot start {container}: {r.tail()}")
            steps.append(f"registry {container}: started")
        else:
            steps.append(f"registry {container}: running")
    else:
        ctx.disk_guard("registry up")
        storage = ensure_private_dir(ctx.home / str(reg["storage"]))
        create = ["k3d", "registry", "create", str(reg["k3d_name"]), "--image", pinned, "--port", str(reg["host_port"]),
                  "--default-network", str(reg["network"]["name"]), "-v", f"{storage}:/var/lib/registry", "--no-help"]
        r = ctx.runner(create, timeout=600)
        if not r.ok:
            raise CellError(f"k3d registry create failed: {r.tail()}")
        steps.append(f"registry {container}: created from {pinned}")
    offline = str(reg["offline_network"]["name"])
    r = ctx.docker("inspect", container, "--format", "{{json .NetworkSettings.Networks}}")
    networks = json.loads(r.stdout or "{}") if r.ok and r.stdout.strip() else {}
    if offline not in networks:
        r = ctx.docker("network", "connect", offline, container)
        if not r.ok:
            raise CellError(f"cannot attach {container} to {offline}: {r.tail()}")
        steps.append(f"registry {container}: attached to {offline}")
    url = f"http://{reg['host_port']}/v2/"
    status = _probe(ctx, url)
    if status != 200:
        raise CellError(f"the registry does not answer: GET {url} gave {status or 'no response'}")
    steps.append(f"registry answers GET {url} with 200")
    return steps


# --------------------------------------------------------------------------- mirror


def is_absent(r: Result) -> bool:
    text = (r.stderr + r.stdout).upper()
    return not r.ok and ("MANIFEST_UNKNOWN" in text or "NAME_UNKNOWN" in text or "NOT FOUND" in text)


def local_digest(ctx: Ctx, image: Image) -> tuple[Optional[str], Optional[str]]:
    """The digest the local registry serves for the image's local tag: (digest, None), (None, None) if absent, or
    (None, error)."""
    r = ctx.crane("digest", f"{ctx.push_host}/{image.local}:{image.tag}")
    if r.ok:
        return r.stdout.strip().splitlines()[-1].strip(), None
    if is_absent(r):
        return None, None
    return None, f"crane digest failed: {r.tail()}"


@dataclass
class ImageOutcome:
    name: str
    upstream: str
    digest: str
    local_ref: str
    present: Optional[bool] = None
    action: str = ""
    signed: Optional[bool] = None
    verified: Optional[bool] = None
    detail: str = ""

    @property
    def ok(self) -> bool:
        return self.present is True and self.verified is not False and not self.detail.startswith("ERROR")

    def to_dict(self) -> dict[str, Any]:
        return {"name": self.name, "upstream": self.upstream, "digest": self.digest, "local_ref": self.local_ref,
                "present": self.present, "action": self.action, "verified": self.verified, "detail": self.detail}


def mirror(ctx: Ctx, images: list[Image]) -> list[ImageOutcome]:
    outcomes = []
    for image in images:
        out = ImageOutcome(image.name, image.upstream, image.digest, image.local_ref(ctx.host))
        outcomes.append(out)
        found, error = local_digest(ctx, image)
        if error:
            out.detail = f"ERROR {error}"
            continue
        if found == image.digest:
            out.present, out.action = True, "present"
            continue
        if found is not None:
            out.present = False
            out.detail = (f"ERROR the local tag {image.local}:{image.tag} points to {found}, not the pinned "
                          f"{image.digest}; not overwritten")
            continue
        ctx.disk_guard(f"mirror {image.name}")  # GuardError stops the whole run
        r = ctx.crane("copy", "--platform", "linux/amd64", image.upstream_by_digest,
                      f"{ctx.push_host}/{image.local}:{image.tag}")
        if not r.ok:
            out.present, out.detail = False, f"ERROR crane copy failed: {r.tail()}"
            continue
        found, error = local_digest(ctx, image)
        out.present = found == image.digest
        out.action = "copied"
        if not out.present:
            out.detail = f"ERROR after the copy the local tag gives {found or error}, not {image.digest}"
        ctx.say(f"copied  {image.name}: {image.upstream_by_digest} -> {image.local_tag_ref(ctx.host)}")
    return outcomes


# --------------------------------------------------------------------------- keys and signing


def ensure_signing_config(ctx: Ctx) -> Path:
    """Write the service-free signing configuration into HMS_CELL_HOME, or check the one there."""
    path = ctx.signing_config_path
    if path.exists():
        problems = signing.signing_config_problems(json.loads(path.read_text(encoding="utf-8")))
        if problems:
            raise CellError(f"{path}: {'; '.join(problems)}; refusing to sign with it")
        return path
    ensure_private_dir(path.parent)
    path.write_text(signing.signing_config_text(), encoding="utf-8", newline="\n")
    return path


def keys_init(ctx: Ctx, generate_passphrase: bool = False) -> list[str]:
    private, public = signing.key_paths(ctx.home, str(ctx.cfg.signing["key_dir"]))
    steps = []
    ensure_private_dir(ctx.home)
    ensure_private_dir(ctx.key_dir)
    if private.exists() and public.exists():
        steps.append(f"key pair present in {ctx.key_dir}")
    elif private.exists() or public.exists():
        raise CellError(f"{ctx.key_dir} holds only half a key pair; move it aside and run this again")
    else:
        if not ctx.env.get(signing.PASSPHRASE_ENV):
            if not generate_passphrase:
                raise signing.SigningError(f"{signing.PASSPHRASE_ENV} is not set: set it, or pass "
                                           "--generate-passphrase to write a random one to HMS_CELL_HOME (OQ-130)")
            if ctx.passphrase_file.exists():
                raise CellError(f"{ctx.passphrase_file} exists but no key pair does; export {signing.PASSPHRASE_ENV} "
                                "from it, or move it aside, and run this again")
            value = signing.new_passphrase()
            write_private(ctx.passphrase_file, value + "\n")
            ctx.env = {**ctx.env, signing.PASSPHRASE_ENV: value}
            steps.append(f"generated a random passphrase into {ctx.passphrase_file} (mode 600); export "
                         f"{signing.PASSPHRASE_ENV} from that file before signing")
        r = ctx.cosign(signing.generate_key_pair_args(), network="none", keys_read_only=False, with_passphrase=True)
        if not r.ok or not private.exists() or not public.exists():
            raise CellError(f"cosign generate-key-pair failed: {r.tail()}")
        if os.name == "posix":
            private.chmod(0o600)
            public.chmod(0o644)
        steps.append(f"generated the cell key pair in {ctx.key_dir} (private key mode 600)")
    ensure_signing_config(ctx)
    steps.append(f"public key fingerprint {signing.public_key_fingerprint(public.read_text(encoding='ascii'))}")
    return steps


def verify_one(ctx: Ctx, image: Image) -> tuple[bool, str]:
    _, public = signing.key_paths(ctx.home, str(ctx.cfg.signing["key_dir"]))
    if not public.exists():
        return False, f"no public key at {public}; run 'tools/hms cell keys init'"
    r = ctx.cosign(signing.verify_args(image.local_ref(ctx.host)), network=str(ctx.registry["offline_network"]["name"]))
    if not r.ok:
        return False, f"cosign verify failed: {r.tail(2)}"
    return signing.parse_verify_output(r.stdout, image.digest)


def sign(ctx: Ctx, images: list[Image]) -> list[ImageOutcome]:
    signing.passphrase(ctx.env)  # fail closed before anything runs
    private, _ = signing.key_paths(ctx.home, str(ctx.cfg.signing["key_dir"]))
    if not private.exists():
        raise CellError(f"no cell key at {private}; run 'tools/hms cell keys init'")
    ensure_signing_config(ctx)
    outcomes = []
    for image in images:
        out = ImageOutcome(image.name, image.upstream, image.digest, image.local_ref(ctx.host))
        outcomes.append(out)
        found, error = local_digest(ctx, image)
        out.present = found == image.digest
        if not out.present:
            out.detail = f"ERROR not in the local registry at its pinned digest ({error or found or 'absent'}); mirror first"
            continue
        ok, detail = verify_one(ctx, image)
        if ok:
            out.action, out.verified, out.detail = "already signed", True, detail
            continue
        r = ctx.cosign(signing.sign_args(image.local_ref(ctx.host)), network=str(ctx.registry["offline_network"]["name"]),
                       with_passphrase=True, with_config=True)
        if not r.ok:
            out.verified, out.detail = False, f"ERROR cosign sign failed: {r.tail(2)}"
            continue
        out.action = "signed"
        out.verified, out.detail = verify_one(ctx, image)
        if not out.verified:
            out.detail = "ERROR signed, but " + out.detail
        ctx.say(f"signed  {image.name}: {image.local_ref(ctx.host)}")
    return outcomes


def verify(ctx: Ctx, images: list[Image]) -> list[ImageOutcome]:
    outcomes = []
    for image in images:
        out = ImageOutcome(image.name, image.upstream, image.digest, image.local_ref(ctx.host), action="verify")
        outcomes.append(out)
        found, error = local_digest(ctx, image)
        out.present = found == image.digest
        if not out.present:
            out.verified, out.detail = False, f"ERROR not in the local registry at its pinned digest ({error or found or 'absent'})"
            continue
        out.verified, out.detail = verify_one(ctx, image)
        if not out.verified:
            out.detail = "ERROR " + out.detail
    return outcomes


def record_details(ctx: Ctx, profile: str, outcomes: list[ImageOutcome], free_gib: Optional[float]) -> dict[str, Any]:
    _, public = signing.key_paths(ctx.home, str(ctx.cfg.signing["key_dir"]))
    fingerprint = signing.public_key_fingerprint(public.read_text(encoding="ascii")) if public.exists() else None
    config_sha = (hashlib.sha256(ctx.signing_config_path.read_bytes()).hexdigest()
                  if ctx.signing_config_path.exists() else None)
    return {
        "profile": profile,
        "pin_set_sha256": ctx.cfg.pin_set_sha256,
        "cell_yaml": ctx.cfg.path.name,
        "registry": {"host": ctx.host, "image": ctx.cfg.image(str(ctx.registry["image"])).upstream_by_digest},
        "tools": {t.name: t.ref for t in ctx.cfg.tools},
        "signing": {"public_key_fingerprint": fingerprint, "signing_config_sha256": config_sha,
                    "format": ctx.cfg.signing.get("format"), "transparency_log": "none (no Rekor in the signing "
                    "configuration; verified with --insecure-ignore-tlog=true)",
                    "network": f"{ctx.registry['offline_network']['name']} (--internal; holds only the registry)"},
        "disk_free_gib": None if free_gib is None else round(free_gib, 1),
        "counts": {"images": len(outcomes), "present": sum(1 for o in outcomes if o.present),
                   "verified": sum(1 for o in outcomes if o.verified), "failed": sum(1 for o in outcomes if not o.ok)},
        "images": [o.to_dict() for o in outcomes],
    }
