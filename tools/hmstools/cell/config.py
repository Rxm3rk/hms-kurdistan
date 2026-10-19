"""deploy/site-cell/cell.yaml, the cell's single source of pins: loading it and `tools/hms cell lint`.

WP-0.2 plan, slice S1 (OQ-124, OQ-125). The lint is pure Python and runs in the fast tier on every host. It
fails when:
- an image or tool has no well-formed digest, or a chart or manifest file no SHA-256;
- an image or tool has no release date, or a chart or manifest no publication date, as YYYY-MM-DD no later than
  'resolved_on' (the §4.1 re-check reads them);
- a manifest is pinned neither by commit nor by release, or a file of it is not fetched at that commit or from
  that release;
- a licence fails tools/licence/policy.yaml (the same evaluator and licence register as `tools/hms licence`;
  an image that does not ship is checked in the build-only scope);
- the name of the vendor whose free images §4.1 excludes appears anywhere in the file;
- two images share a local path, or a name;
- a profile's expected memory adds up to more than its budget, or one component's expected figure exceeds its
  limit;
- a cross-reference is dangling (a chart's image, the registry image, an image's profile or component).

The lint reads cell.yaml only. What a chart archive or manifest contains is checked by `tools/hms cell charts
verify` (charts.py), against the copies in HMS_CELL_HOME.
"""

from __future__ import annotations

import hashlib
import os
import re
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Any, Optional

from ..common import CheckResult

CELL_YAML = Path("deploy/site-cell/cell.yaml")
POLICY = Path("tools/licence/policy.yaml")
REGISTER = Path("tools/licence/register.yaml")
DEFAULT_HOME = "~/.local/share/hms-cell"

DIGEST = re.compile(r"^sha256:[0-9a-f]{64}$")
SHA256 = re.compile(r"^[0-9a-f]{64}$")
# registry host (with a dot, or a port) / repository : tag. A reference with a digest belongs in 'digest'.
UPSTREAM = re.compile(r"^(?P<registry>[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?)/(?P<repository>[a-z0-9]+([._/-][a-z0-9]+)*)"
                      r":(?P<tag>[A-Za-z0-9_][A-Za-z0-9._-]{0,127})$")
LOCAL = re.compile(r"^[a-z0-9]+([._-][a-z0-9]+)*(/[a-z0-9]+([._-][a-z0-9]+)*)*$")
NAME = re.compile(r"^[a-z0-9][a-z0-9-]*$")
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
# The vendor whose free versioned images were withdrawn in 2025 (§4.1; tools/licence/policy.yaml exclusion).
EXCLUDED_VENDOR = re.compile(r"bitnami", re.IGNORECASE)


class ConfigError(ValueError):
    pass


def cell_home(env: Optional[dict[str, str]] = None) -> Path:
    """HMS_CELL_HOME, or ~/.local/share/hms-cell: cell state outside the repository (OQ-124)."""
    env = os.environ if env is None else env
    return Path(os.path.expanduser(env.get("HMS_CELL_HOME") or DEFAULT_HOME))


@dataclass(frozen=True)
class Image:
    name: str
    upstream: str
    digest: str
    index_digest: str
    local: str
    licence: str
    role: str
    component: str
    profiles: tuple[str, ...]
    ships: bool

    @property
    def parts(self) -> dict[str, str]:
        m = UPSTREAM.match(self.upstream)
        if not m:
            raise ConfigError(f"image {self.name}: upstream {self.upstream!r} is not <registry>/<repository>:<tag>")
        return m.groupdict()

    @property
    def tag(self) -> str:
        return self.parts["tag"]

    @property
    def upstream_by_digest(self) -> str:
        """The publisher's reference to exactly the pinned linux/amd64 manifest."""
        p = self.parts
        return f"{p['registry']}/{p['repository']}@{self.digest}"

    def local_ref(self, host: str) -> str:
        return f"{host}/{self.local}@{self.digest}"

    def local_tag_ref(self, host: str) -> str:
        return f"{host}/{self.local}:{self.tag}"


@dataclass(frozen=True)
class Tool:
    name: str
    upstream: str
    digest: str
    index_digest: str
    licence: str

    @property
    def ref(self) -> str:
        """`docker run` reference: the publisher's repository at the pinned linux/amd64 digest."""
        m = UPSTREAM.match(self.upstream)
        if not m:
            raise ConfigError(f"tool {self.name}: upstream {self.upstream!r} is not <registry>/<repository>:<tag>")
        return f"{m['registry']}/{m['repository']}@{self.digest}"

    @property
    def version(self) -> str:
        m = UPSTREAM.match(self.upstream)
        return m["tag"] if m else ""


@dataclass
class CellConfig:
    path: Path
    text: str
    data: dict[str, Any]
    images: list[Image] = field(default_factory=list)
    tools: list[Tool] = field(default_factory=list)

    @property
    def pin_set_sha256(self) -> str:
        """The hash of the pin set that evidence records name (OQ-129): SHA-256 of cell.yaml's bytes."""
        return hashlib.sha256(self.text.encode("utf-8")).hexdigest()

    @property
    def registry(self) -> dict[str, Any]:
        return self.data["registry"]

    @property
    def guards(self) -> dict[str, Any]:
        return self.data["guards"]

    @property
    def signing(self) -> dict[str, Any]:
        return self.data["signing"]

    @property
    def profiles(self) -> dict[str, Any]:
        return self.data["profiles"]

    def image(self, name: str) -> Image:
        for image in self.images:
            if image.name == name:
                return image
        raise ConfigError(f"no image named {name!r} in {self.path.name}")

    def tool(self, name: str) -> Tool:
        for tool in self.tools:
            if tool.name == name:
                return tool
        raise ConfigError(f"no tool named {name!r} in {self.path.name}")

    def profile_images(self, profile: str) -> list[Image]:
        if profile not in self.profiles:
            raise ConfigError(f"unknown profile {profile!r}; one of {sorted(self.profiles)}")
        return [image for image in self.images if profile in image.profiles]


IMAGE_FIELDS = ("name", "upstream", "digest", "index_digest", "local", "licence", "role", "component", "profiles",
                "ships", "released")
TOOL_FIELDS = ("name", "upstream", "digest", "index_digest", "licence", "released", "purpose")
CHART_FIELDS = ("name", "repository", "version", "app_version", "url", "sha256", "published", "profiles", "images")
MANIFEST_FIELDS = ("name", "version", "source", "published", "profiles", "images", "files")
TOP_LEVEL = ("schema_version", "resolved_on", "platform", "kubernetes", "registry", "guards", "signing", "profiles",
             "charts", "manifests", "images", "tools")


def parse(text: str, path: Path = CELL_YAML) -> tuple[Optional[CellConfig], list[str]]:
    """Parse cell.yaml text. Returns the config (None if it cannot be used at all) and the structural errors."""
    import yaml  # PyYAML, pinned in tools/requirements.txt

    try:
        data = yaml.safe_load(text)
    except yaml.YAMLError as exc:
        return None, [f"{path.name} is not valid YAML: {exc}"]
    if not isinstance(data, dict):
        return None, [f"{path.name}: the top level must be a mapping"]
    errors = [f"missing top-level key {key!r}" for key in TOP_LEVEL if key not in data]
    if errors:
        return None, errors
    if data["schema_version"] != 1:
        errors.append(f"schema_version is {data['schema_version']!r}; this tool reads 1")
    if data["platform"] != "linux/amd64":
        errors.append(f"platform is {data['platform']!r}; the digests are linux/amd64 manifests")
    cfg = CellConfig(path=path, text=text, data=data)
    for i, entry in enumerate(data["images"] or []):
        where = f"images[{i}]" + (f" ({entry.get('name')})" if isinstance(entry, dict) and entry.get("name") else "")
        if not isinstance(entry, dict):
            errors.append(f"{where}: not a mapping")
            continue
        missing = [key for key in IMAGE_FIELDS if entry.get(key) in (None, "", [])]
        if missing:
            errors.append(f"{where}: missing {', '.join(missing)}")
            continue
        profiles = entry["profiles"]
        cfg.images.append(Image(
            name=str(entry["name"]), upstream=str(entry["upstream"]), digest=str(entry["digest"]),
            index_digest=str(entry["index_digest"]), local=str(entry["local"]), licence=str(entry["licence"]),
            role=str(entry["role"]), component=str(entry["component"]),
            profiles=tuple(str(p) for p in profiles) if isinstance(profiles, list) else (str(profiles),),
            ships=entry["ships"] is True,
        ))
        if not isinstance(entry["ships"], bool):
            errors.append(f"{where}: ships must be true or false")
    for i, entry in enumerate(data["tools"] or []):
        where = f"tools[{i}]" + (f" ({entry.get('name')})" if isinstance(entry, dict) and entry.get("name") else "")
        if not isinstance(entry, dict):
            errors.append(f"{where}: not a mapping")
            continue
        missing = [key for key in TOOL_FIELDS if entry.get(key) in (None, "")]
        if missing:
            errors.append(f"{where}: missing {', '.join(missing)}")
            continue
        cfg.tools.append(Tool(name=str(entry["name"]), upstream=str(entry["upstream"]), digest=str(entry["digest"]),
                              index_digest=str(entry["index_digest"]), licence=str(entry["licence"])))
    return cfg, errors


def load(path: Path) -> CellConfig:
    """Load cell.yaml for a command that needs it whole; a structural error is a ConfigError."""
    text = path.read_text(encoding="utf-8")
    cfg, errors = parse(text, path)
    if cfg is None or errors:
        raise ConfigError(f"{path}: " + "; ".join(errors))
    return cfg


# --------------------------------------------------------------------------- lint


def _check_reference(kind: str, entry: Any, errors: list[str]) -> None:
    upstream = getattr(entry, "upstream", "")
    if not UPSTREAM.match(upstream):
        errors.append(f"{kind} {entry.name}: upstream {upstream!r} is not <registry>/<repository>:<tag> (a digest "
                      "belongs in 'digest')")
    if not DIGEST.match(entry.digest):
        errors.append(f"{kind} {entry.name}: no digest (want sha256:<64 hex>, the linux/amd64 manifest), got "
                      f"{entry.digest!r}")
    if not DIGEST.match(entry.index_digest):
        errors.append(f"{kind} {entry.name}: index_digest {entry.index_digest!r} is not sha256:<64 hex>")


def _date_error(what: str, value: Any, resolved_on: Any) -> Optional[str]:
    """A release or publication date: a quoted YYYY-MM-DD that is a real date, no later than 'resolved_on'."""
    text = value if isinstance(value, str) else None
    if text is None or not DATE.match(text):
        return f"{what}: want a quoted date YYYY-MM-DD, got {value!r}"
    try:
        when = date.fromisoformat(text)
    except ValueError:
        return f"{what}: {text!r} is not a date"
    try:
        resolved = date.fromisoformat(str(resolved_on))
    except ValueError:
        return f"{what}: resolved_on {resolved_on!r} is not a date YYYY-MM-DD"
    if when > resolved:
        return f"{what}: {text} is after resolved_on ({resolved})"
    return None


def _licence_errors(cfg: CellConfig, policy_path: Path, register_path: Path, counts: dict[str, int]) -> list[str]:
    from ..licence.policy import ALLOWED, CONDITIONAL, Component, Evaluator, Policy, load_register

    errors: list[str] = []
    policy = Policy.load(policy_path)
    register, problems = load_register(register_path, policy)
    errors += [f"licence register: {problem}" for problem in problems]
    evaluator = Evaluator(policy, register)
    components: list[tuple[str, Component]] = []
    for image in cfg.images:
        m = UPSTREAM.match(image.upstream)
        repository, tag = (m["repository"], m["tag"]) if m else (image.upstream, "")
        components.append((f"image {image.name}", Component(
            name=image.name, version=tag, purl=f"pkg:docker/{repository}@{tag}", type="container",
            scope="shipped" if image.ships else "build-only", licences=[image.licence], source=str(CELL_YAML))))
    for tool in cfg.tools:
        m = UPSTREAM.match(tool.upstream)
        repository, tag = (m["repository"], m["tag"]) if m else (tool.upstream, "")
        components.append((f"tool {tool.name}", Component(
            name=tool.name, version=tag, purl=f"pkg:docker/{repository}@{tag}", type="container",
            scope="build-only", licences=[tool.licence], source=str(CELL_YAML))))
    for what, component in components:
        verdict = evaluator.evaluate(component)
        where = f"{what} ({component.licences[0]}, {component.scope})"
        if verdict.level == ALLOWED:
            counts["licences_allowed"] += 1
        elif verdict.level == CONDITIONAL and evaluator.registered(component, verdict):
            counts["licences_conditional_registered"] += 1
        elif verdict.level == CONDITIONAL:
            errors.append(f"licence: {where}: {verdict.reason}; allowed only with an entry in {REGISTER.as_posix()} "
                          f"(rule {verdict.rule!r}, licence {verdict.licence!r}, unmodified: true), which records "
                          f"none for it ({verdict.condition})")
        else:
            errors.append(f"licence: {where}: {verdict.name}: {verdict.reason}")
    return errors


def lint(path: Path, policy_path: Path, register_path: Path) -> CheckResult:
    result = CheckResult(check="cell-lint")
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        result.errors.append(f"cannot read {path}: {exc}")
        return result
    for number, line in enumerate(text.splitlines(), 1):
        if EXCLUDED_VENDOR.search(line):
            result.errors.append(f"line {number}: names the vendor whose images and charts §4.1 excludes")
    cfg, errors = parse(text, path)
    result.errors += errors
    if cfg is None:
        return result
    data = cfg.data
    counts = {"images": len(cfg.images), "tools": len(cfg.tools), "charts": 0, "manifest_files": 0,
              "profiles": len(data["profiles"] or {}), "licences_allowed": 0, "licences_conditional_registered": 0}

    # names and local paths
    seen_names: dict[str, str] = {}
    seen_local: dict[str, str] = {}
    for image in cfg.images:
        _check_reference("image", image, result.errors)
        if not NAME.match(image.name):
            result.errors.append(f"image {image.name!r}: a name is lower-case letters, digits and hyphens")
        if image.name in seen_names:
            result.errors.append(f"image name {image.name!r} is used twice")
        seen_names[image.name] = image.name
        if not LOCAL.match(image.local):
            result.errors.append(f"image {image.name}: local path {image.local!r} is not a repository path")
        if image.local in seen_local:
            result.errors.append(f"images {seen_local[image.local]} and {image.name} share the local path {image.local!r}")
        else:
            seen_local[image.local] = image.name
    for tool in cfg.tools:
        _check_reference("tool", tool, result.errors)
    resolved_on = data["resolved_on"]
    for kind, entries in (("image", data["images"] or []), ("tool", data["tools"] or [])):
        for entry in entries:
            if isinstance(entry, dict) and entry.get("released") not in (None, ""):
                problem = _date_error(f"{kind} {entry.get('name')}: released", entry["released"], resolved_on)
                if problem:
                    result.errors.append(problem)

    # profiles and budgets
    profiles = data["profiles"] or {}
    for name, profile in profiles.items():
        components = (profile or {}).get("components") or {}
        budget = (profile or {}).get("budget_mib")
        total = 0
        for component, figures in components.items():
            if figures is None:
                continue
            expected, limit = figures.get("expected_mib"), figures.get("limit_mib")
            if not isinstance(expected, int) or not isinstance(limit, int):
                result.errors.append(f"profile {name}: component {component} needs integer expected_mib and limit_mib")
                continue
            if expected > limit:
                result.errors.append(f"profile {name}: component {component} expects {expected} MiB, above its "
                                     f"limit of {limit} MiB")
            total += expected
        if budget is not None:
            if not isinstance(budget, int):
                result.errors.append(f"profile {name}: budget_mib must be an integer")
            elif total > budget:
                result.errors.append(f"profile {name}: the components' expected memory adds up to {total} MiB, above "
                                     f"the profile budget of {budget} MiB")
            counts[f"{name}_expected_mib"] = total
        for image in cfg.images:
            if name in image.profiles and image.component not in components:
                result.errors.append(f"image {image.name}: component {image.component!r} is not in profile {name}")
    for image in cfg.images:
        for profile in image.profiles:
            if profile not in profiles:
                result.errors.append(f"image {image.name}: unknown profile {profile!r}")

    # cross-references
    names = {image.name for image in cfg.images}
    registry_image = (data["registry"] or {}).get("image")
    if registry_image not in names:
        result.errors.append(f"registry.image {registry_image!r} is not an image in this file")
    kube_image = (data["kubernetes"] or {}).get("image")
    if kube_image not in names:
        result.errors.append(f"kubernetes.image {kube_image!r} is not an image in this file")
    tool_names = {tool.name for tool in cfg.tools}
    for needed in ("crane", "cosign"):
        if needed not in tool_names:
            result.errors.append(f"tools: no {needed!r} entry (the cell tooling runs it from its pinned image)")

    # charts and manifests
    for i, chart in enumerate(data["charts"] or []):
        label = chart.get("name") if isinstance(chart, dict) else None
        where = f"chart {label}" if label else f"charts[{i}]"
        if not isinstance(chart, dict):
            result.errors.append(f"{where}: not a mapping")
            continue
        counts["charts"] += 1
        missing = [key for key in CHART_FIELDS if chart.get(key) in (None, "", [])]
        if missing:
            result.errors.append(f"{where}: missing {', '.join(missing)}")
        if not SHA256.match(str(chart.get("sha256") or "")):
            result.errors.append(f"{where}: no SHA-256 of its .tgz (want 64 hex), got {chart.get('sha256')!r}")
        if chart.get("published") not in (None, ""):
            problem = _date_error(f"{where}: published", chart["published"], resolved_on)
            if problem:
                result.errors.append(problem)
        if not str(chart.get("url") or "").startswith("https://"):
            result.errors.append(f"{where}: url {chart.get('url')!r} is not an https URL")
        for ref in chart.get("images") or []:
            if ref not in names:
                result.errors.append(f"{where}: image {ref!r} is not an image in this file")
    for i, manifest in enumerate(data["manifests"] or []):
        label = manifest.get("name") if isinstance(manifest, dict) else None
        where = f"manifest {label}" if label else f"manifests[{i}]"
        if not isinstance(manifest, dict):
            result.errors.append(f"{where}: not a mapping")
            continue
        missing = [key for key in MANIFEST_FIELDS if manifest.get(key) in (None, "", [])]
        if missing:
            result.errors.append(f"{where}: missing {', '.join(missing)}")
        if manifest.get("published") not in (None, ""):
            problem = _date_error(f"{where}: published", manifest["published"], resolved_on)
            if problem:
                result.errors.append(problem)
        commit, release = manifest.get("commit"), manifest.get("release")
        if (commit is None) == (release is None):
            result.errors.append(f"{where}: pin it by exactly one of 'commit' (the 40-hex commit of its tag) or "
                                 "'release' (the release whose assets it uses)")
        elif commit is not None and not re.match(r"^[0-9a-f]{40}$", str(commit)):
            result.errors.append(f"{where}: commit {commit!r} is not the 40-hex commit of its tag")
        files = manifest.get("files") or []
        for entry in files:
            counts["manifest_files"] += 1
            url, sha = str((entry or {}).get("url") or ""), str((entry or {}).get("sha256") or "")
            if not SHA256.match(sha):
                result.errors.append(f"{where}: file {url or '?'} has no SHA-256 (want 64 hex)")
            if not url.startswith("https://"):
                result.errors.append(f"{where}: file {url!r} is not an https URL")
            if commit is not None and str(commit) not in url:
                result.errors.append(f"{where}: file {url!r} is not fetched at the pinned commit")
            if release is not None and f"/releases/download/{release}/" not in url:
                result.errors.append(f"{where}: file {url!r} is not an asset of release {release}")
        for ref in manifest.get("images") or []:
            if ref not in names:
                result.errors.append(f"{where}: image {ref!r} is not an image in this file")

    # licences, with the policy and register WP-0.1 built (§4.3)
    try:
        result.errors += _licence_errors(cfg, policy_path, register_path, counts)
    except (OSError, ValueError, KeyError) as exc:
        result.errors.append(f"cannot evaluate licences: {exc}")
    result.counts = counts
    return result
