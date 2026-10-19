"""Chart archives and release manifests in HMS_CELL_HOME: `tools/hms cell charts fetch|verify`.

WP-0.2 plan, slice S1 (OQ-124, OQ-137; BUILD-PROMPT.md §4.1 "No Bitnami images or charts").
- `charts fetch`: downloads each pinned chart .tgz into HMS_CELL_HOME/charts/<file name of its URL>, and each
  manifest file into HMS_CELL_HOME/manifests/<name>-<version>/<file name of its URL>, from the https URL that
  cell.yaml records (the publisher's Helm repository or release page). A download is kept only if its SHA-256 is
  the pinned one; a file already there with another checksum is reported and never overwritten. The disk guard
  runs before each download (DN-013).
- `charts verify`: every pinned chart and manifest file is present with its pinned SHA-256, and none packages a
  chart of the vendor §4.1 excludes or names an image of it.

`cell lint` reads cell.yaml only; this module reads what the pins point at. Archives are read in memory
(`tarfile.extractfile`), never unpacked to disk. In a chart archive (and in any chart archive nested in it):
- a chart's metadata (Chart.yaml, Chart.lock, requirements.yaml, requirements.lock) that names the vendor is a
  packaged chart of that vendor: an error, whether or not the chart enables it;
- a values file or template that names an image under the vendor's repository path is an error;
- any other mention (a README link, a comment crediting a template) is counted in `notes`, not failed.
In a manifest file, an image under the vendor's repository path is an error and any other mention a note.
"""

from __future__ import annotations

import hashlib
import io
import re
import tarfile
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

from .config import EXCLUDED_VENDOR, CellConfig
from .proc import ensure_private_dir

CHART_METADATA = ("Chart.yaml", "Chart.lock", "requirements.yaml", "requirements.lock")
# An image reference under the vendor's repository path: 'docker.io/<vendor>/x', 'repository: <vendor>/x'.
VENDOR_IMAGE = re.compile(r"(?:^|[\s\"'=:/])" + EXCLUDED_VENDOR.pattern + r"/[a-z0-9]", re.IGNORECASE | re.MULTILINE)
MAX_DOWNLOAD = 64 * 1024 * 1024


@dataclass(frozen=True)
class Artefact:
    kind: str  # "chart" or "manifest"
    name: str
    url: str
    sha256: str
    path: Path


def artefacts(cfg: CellConfig, home: Path) -> list[Artefact]:
    """Every pinned chart archive and manifest file, with its place in HMS_CELL_HOME."""
    out = []
    for chart in cfg.data.get("charts") or []:
        url = str(chart["url"])
        out.append(Artefact("chart", str(chart["name"]), url, str(chart["sha256"]),
                            home / "charts" / url.rsplit("/", 1)[-1]))
    for manifest in cfg.data.get("manifests") or []:
        folder = home / "manifests" / f"{manifest['name']}-{manifest['version']}"
        for entry in manifest.get("files") or []:
            url = str(entry["url"])
            out.append(Artefact("manifest", str(manifest["name"]), url, str(entry["sha256"]),
                                folder / url.rsplit("/", 1)[-1]))
    return out


def _is_values_or_template(member: str) -> bool:
    base = member.rsplit("/", 1)[-1]
    return "/templates/" in f"/{member}" or base.startswith("values") or base.endswith((".tpl",))


def scan_chart(data: bytes, where: str = "") -> tuple[list[str], int]:
    """(errors, notes) for a chart archive: packaged charts or images of the excluded vendor (see the module)."""
    errors: list[str] = []
    notes = 0
    try:
        tar = tarfile.open(fileobj=io.BytesIO(data), mode="r:*")
    except (tarfile.TarError, OSError) as exc:
        return [f"{where or 'archive'}: not a chart archive ({exc})"], 0
    with tar:
        for member in tar.getmembers():
            if not member.isfile():
                continue
            handle = tar.extractfile(member)
            if handle is None:
                continue
            content = handle.read()
            name = f"{where}{member.name}"
            if member.name.endswith(".tgz"):
                nested_errors, nested_notes = scan_chart(content, f"{name}!/")
                errors += nested_errors
                notes += nested_notes
                continue
            text = content.decode("utf-8", "replace")
            if not EXCLUDED_VENDOR.search(text):
                continue
            if member.name.rsplit("/", 1)[-1] in CHART_METADATA:
                errors.append(f"{name}: packages a chart of the vendor whose images and charts §4.1 excludes (OQ-137)")
            elif _is_values_or_template(member.name) and VENDOR_IMAGE.search(text):
                errors.append(f"{name}: names an image of the vendor whose images and charts §4.1 excludes")
            else:
                notes += 1
    return errors, notes


def scan_manifest(data: bytes, where: str) -> tuple[list[str], int]:
    text = data.decode("utf-8", "replace")
    if VENDOR_IMAGE.search(text):
        return [f"{where}: names an image of the vendor whose images and charts §4.1 excludes"], 0
    return [], 1 if EXCLUDED_VENDOR.search(text) else 0


@dataclass
class ArtefactOutcome:
    kind: str
    name: str
    file: str
    sha256: str
    present: Optional[bool] = None
    action: str = ""
    notes: int = 0
    detail: str = ""

    @property
    def ok(self) -> bool:
        return self.present is True and not self.detail.startswith("ERROR")

    def to_dict(self) -> dict[str, Any]:
        return {"kind": self.kind, "name": self.name, "file": self.file, "sha256": self.sha256,
                "present": self.present, "action": self.action, "vendor_mentions_not_failed": self.notes,
                "detail": self.detail}


def _check(artefact: Artefact, data: bytes, out: ArtefactOutcome) -> None:
    got = hashlib.sha256(data).hexdigest()
    if got != artefact.sha256:
        out.present = False
        out.detail = f"ERROR SHA-256 {got}, not the pinned {artefact.sha256}"
        return
    out.present = True
    where = f"{artefact.path.name}"
    errors, out.notes = scan_chart(data, f"{where}!/") if artefact.kind == "chart" else scan_manifest(data, where)
    if errors:
        out.detail = "ERROR " + "; ".join(errors[:5]) + (f"; and {len(errors) - 5} more" if len(errors) > 5 else "")
    else:
        out.detail = "SHA-256 matches the pin; " + ("no packaged chart or image of the excluded vendor"
                                                    if artefact.kind == "chart" else "names no image of the excluded vendor")


def _outcome(artefact: Artefact, home: Path) -> ArtefactOutcome:
    try:
        shown = artefact.path.relative_to(home).as_posix()
    except ValueError:
        shown = str(artefact.path)
    return ArtefactOutcome(artefact.kind, artefact.name, shown, artefact.sha256)


def verify(ctx: Any) -> list[ArtefactOutcome]:
    outcomes = []
    for artefact in artefacts(ctx.cfg, ctx.home):
        out = _outcome(artefact, ctx.home)
        out.action = "verify"
        outcomes.append(out)
        if not artefact.path.is_file():
            out.present, out.detail = False, "ERROR not in HMS_CELL_HOME; run 'tools/hms cell charts fetch'"
            continue
        _check(artefact, artefact.path.read_bytes(), out)
    return outcomes


def download(url: str) -> bytes:
    """GET an https URL (redirects followed), at most MAX_DOWNLOAD bytes."""
    if not url.startswith("https://"):
        raise ValueError(f"not an https URL: {url}")
    with urllib.request.urlopen(url, timeout=300) as response:  # noqa: S310 (https only, checked above)
        data = response.read(MAX_DOWNLOAD + 1)
    if len(data) > MAX_DOWNLOAD:
        raise ValueError(f"{url}: larger than {MAX_DOWNLOAD} bytes")
    return data


def fetch(ctx: Any) -> list[ArtefactOutcome]:
    getter = ctx.download or download
    outcomes = []
    for artefact in artefacts(ctx.cfg, ctx.home):
        out = _outcome(artefact, ctx.home)
        outcomes.append(out)
        if artefact.path.is_file():
            data = artefact.path.read_bytes()
            if hashlib.sha256(data).hexdigest() != artefact.sha256:
                out.present = False
                out.detail = (f"ERROR {out.file} is there with another SHA-256; not overwritten (move it aside and "
                              "fetch again)")
                continue
            out.action = "present"
            _check(artefact, data, out)
            continue
        if not artefact.url.startswith("https://"):
            out.present, out.detail = False, f"ERROR not an https URL: {artefact.url}"
            continue
        ctx.disk_guard(f"fetch {artefact.name}")  # GuardError stops the whole run
        try:
            data = getter(artefact.url)
        except (OSError, ValueError) as exc:
            out.present, out.detail = False, f"ERROR download failed: {exc}"
            continue
        out.action = "downloaded"
        _check(artefact, data, out)
        if out.present:  # the checksum matched: keep it, even if the vendor scan failed, so verify reports it too
            ensure_private_dir(artefact.path.parent)
            partial = artefact.path.with_name(artefact.path.name + ".partial")
            partial.write_bytes(data)
            partial.replace(artefact.path)
            ctx.say(f"fetched {artefact.name}: {artefact.url} -> {out.file}")
    return outcomes
