"""PDF golden images: render, rasterise, compare, decode barcodes, write candidates, approve.

docs/specs/modules/platform-docs.md §6.2 (independent barcode decode, ``GoldenImage:barcode-decodes-*``) and §10
(PDF/A pages rasterised at 150 dpi in 8-bit grey with pypdfium2, compared pixel for pixel; renderer identity;
approval with ``human_script_review: requested``; candidates never overwrite an approved file).

Fixture metadata convention (``<meta name=... content=...>`` in the fixture's ``<head>``):

- ``hms.barcode.payloads``: every barcode the document must carry, as space-separated ``<symbology>:<payload>``
  tokens, symbology one of ``datamatrix``, ``code128``, ``qrcode``, ``pdf417``, ``aztec``; the payload runs to the
  next space (§6.1 payloads are printable ASCII built from R4 identifiers, so they hold no space). Example:
  ``content="datamatrix:HMS1|M:SYN-000123-7|E:SYN-E-000045|B:SYN-J-000001 code128:SYN-S-000077"``. An empty
  ``content`` declares no barcode. The barcodes decoded from all pages must equal the declared list as a multiset;
  a fixture without this meta element must contain no barcode (an undeclared barcode fails).
- ``hms.template.id``, ``hms.template.version``, ``hms.template.hash``, ``hms.template.provenance``: the request's
  template fields; ``dcterms.created``: its creation time; ``<title>`` its title; ``<html lang>`` its language.
  Missing values get fixed defaults (listed in the manifest as ``defaulted``); they change only the PDF's
  metadata, never its pages.

Layout of an approved set: ``<goldens>/<identity-hash>/<fixture>-p<n>.png`` plus ``manifest.json`` with each file's
SHA-256, each fixture's template id, version and hash, the renderer identity and ``human_script_review:
requested``. A file whose SHA-256 differs from the manifest fails the check (the set was edited by hand).
"""

from __future__ import annotations

import datetime
import hashlib
import json
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

from ..contract import CONTRACT_VERSION, InvalidRequest, RenderRequest
from ..env import load_runtime, subprocess_env

DPI = 150
SET_SCHEMA = "hms-docrender-golden-set/1"
CANDIDATE_SCHEMA = "hms-docrender-golden-candidates/1"
DEFAULT_CREATED = "2026-01-01T00:00:00Z"
SYMBOLOGIES = ("datamatrix", "code128", "qrcode", "pdf417", "aztec")
LANGUAGES = ("en", "ckb", "ar", "ku-Arab")
_PAYLOAD = re.compile(r"^[\x21-\x7e]+$")
_SHA256 = re.compile(r"^[0-9a-f]{64}$")
_STEM = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")


class HarnessError(Exception):
    """A usage or environment problem (exit 2 or 3), as opposed to a failed comparison (exit 1)."""

    def __init__(self, message: str, exit_code: int = 2):
        super().__init__(message)
        self.exit_code = exit_code


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


# --------------------------------------------------------------------------------------------- fixtures


class _MetaParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.meta: dict[str, list[str]] = {}
        self.lang: str | None = None
        self.title: str | None = None
        self._in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {k: (v or "") for k, v in attrs}
        if tag == "meta" and "name" in values:
            self.meta.setdefault(values["name"], []).append(values.get("content", ""))
        elif tag == "html" and "lang" in values and self.lang is None:
            self.lang = values["lang"]
        elif tag == "title" and self.title is None:
            self._in_title = True
            self.title = ""

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title = (self.title or "") + data


def parse_payloads(content: str) -> list[tuple[str, str]]:
    payloads = []
    for token in content.split():
        symbology, colon, payload = token.partition(":")
        symbology = symbology.lower()
        if not colon or symbology not in SYMBOLOGIES or not payload or not _PAYLOAD.match(payload):
            raise HarnessError(f"hms.barcode.payloads: malformed token {token!r} (expected <symbology>:<payload>, symbology one of {', '.join(SYMBOLOGIES)})")
        payloads.append((symbology, payload))
    return sorted(payloads)


@dataclass
class Fixture:
    path: Path
    stem: str
    html_sha256: str
    request: RenderRequest
    payloads: list[tuple[str, str]] | None
    defaulted: list[str] = field(default_factory=list)


def load_fixture(path: Path) -> Fixture:
    stem = path.stem
    if not _STEM.match(stem):
        raise HarnessError(f"{path.name}: fixture names use only letters, digits, '.', '_' and '-'")
    raw = path.read_bytes()
    html = raw.decode("utf-8")
    parser = _MetaParser()
    parser.feed(html)
    parser.close()
    meta = {name: values[0].strip() for name, values in parser.meta.items()}
    if any(len(values) > 1 for values in parser.meta.values()):
        raise HarnessError(f"{path.name}: a meta name appears twice")
    defaulted = []

    def pick(name: str, default: str) -> str:
        if meta.get(name):
            return meta[name]
        defaulted.append(name)
        return default

    template_id = pick("hms.template.id", f"SYN-FIXTURE-{stem}"[:128])
    version = pick("hms.template.version", "1")
    content_hash = pick("hms.template.hash", hashlib.sha256(raw).hexdigest())
    provenance = pick("hms.template.provenance", "synthetic")
    created = pick("dcterms.created", DEFAULT_CREATED)
    title = (parser.title or "").strip()
    if not title:
        defaulted.append("title")
        title = stem
    language = parser.lang if parser.lang in LANGUAGES else None
    if language is None:
        defaulted.append("lang")
        language = "en"
    data = {
        "contractVersion": CONTRACT_VERSION, "html": html, "pdfVariant": "pdf/a-2b", "title": title,
        "templateId": template_id, "templateVersion": int(version) if version.isdigit() else version,
        "templateContentHash": content_hash, "provenance": provenance, "language": language, "createdAt": created,
    }
    try:
        request = RenderRequest.from_json(data)
    except InvalidRequest as exc:
        raise HarnessError(f"{path.name}: its metadata does not make a valid request: {'; '.join(exc.errors)}") from None
    payloads = parse_payloads(meta["hms.barcode.payloads"]) if "hms.barcode.payloads" in parser.meta else None
    return Fixture(path, stem, hashlib.sha256(raw).hexdigest(), request, payloads, defaulted)


# --------------------------------------------------------------------------------------------- render, raster, decode


def _cli(args: list[str], *, stdin: str | None = None, font_dir: Path | None = None) -> tuple[int, dict[str, Any]]:
    runtime = load_runtime()
    argv = [sys.executable, "-I", "-m", "hms_docrender", *args]
    if font_dir is not None:
        argv += ["--font-dir", str(font_dir)]
    proc = subprocess.run(argv, input=(stdin or "").encode("utf-8"), capture_output=True, env=subprocess_env(runtime))
    lines = proc.stdout.decode("utf-8", "replace").strip().splitlines()
    try:
        result = json.loads(lines[-1])
    except (IndexError, ValueError):
        result = {"status": "failed", "detail": (proc.stdout + proc.stderr).decode("utf-8", "replace")[-1500:]}
    return proc.returncode, result


def renderer_identity(font_dir: Path | None) -> dict[str, Any]:
    code, result = _cli(["identity"], font_dir=font_dir)
    if code != 0 or result.get("status") != "ok":
        raise HarnessError(f"renderer identity unavailable: {result.get('detail')}", 3)
    return result


def render_fixture(fixture: Fixture, work: Path, font_dir: Path | None) -> tuple[bytes | None, dict[str, Any]]:
    out = work / f"{fixture.stem}.pdf"
    code, result = _cli(["render", "--out", str(out)], stdin=json.dumps(fixture.request.to_json()), font_dir=font_dir)
    if code != 0 or result.get("status") != "rendered":
        return None, result
    pdf = out.read_bytes()
    if hashlib.sha256(pdf).hexdigest() != result.get("sha256"):
        return None, {"status": "failed", "detail": "the PDF on disk does not match the SHA-256 the renderer reported"}
    return pdf, result


def rasterise(pdf: bytes, dpi: int = DPI) -> list[Any]:
    """Every page as an 8-bit greyscale PIL image (mode L) at ``dpi``."""
    import pypdfium2 as pdfium

    document = pdfium.PdfDocument(pdf)
    try:
        images = []
        for index in range(len(document)):
            page = document[index]
            try:
                image = page.render(scale=dpi / 72, grayscale=True).to_pil()
                images.append(image if image.mode == "L" else image.convert("L"))
            finally:
                page.close()
        return images
    finally:
        document.close()


def _symbology(barcode_format: Any) -> str:
    name = getattr(barcode_format, "name", None) or str(barcode_format).rsplit(".", 1)[-1]
    return re.sub(r"[^a-z0-9]", "", name.lower())


def decode_barcodes(image: Any) -> list[tuple[str, str]]:
    import zxingcpp

    return sorted((_symbology(found.format), found.text) for found in zxingcpp.read_barcodes(image) if found.valid)


def save_png(image: Any, path: Path) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", compress_level=9)
    return sha256_file(path)


def load_png(path: Path) -> Any:
    from PIL import Image

    with Image.open(path) as image:
        image.load()
        return image.copy()


def compare(candidate: Any, golden: Any) -> tuple[int | None, Any]:
    """(number of differing pixels or None for a size or mode mismatch, a difference image or None)."""
    from PIL import Image, ImageChops

    if golden.mode != "L" or candidate.size != golden.size:
        return None, None
    if candidate.tobytes() == golden.tobytes():
        return 0, None
    mask = ImageChops.difference(candidate, golden).point(lambda v: 255 if v else 0)
    count = mask.histogram()[255]
    base = golden.point(lambda v: 150 + v * 105 // 255).convert("RGB")
    diff = Image.composite(Image.new("RGB", golden.size, (255, 0, 0)), base, mask)
    return count, diff


# --------------------------------------------------------------------------------------------- golden sets


def load_set(set_dir: Path, identity: str) -> tuple[dict[str, Any] | None, list[str]]:
    """The approved set's manifest and any integrity problems (never trusts a file the manifest does not pin)."""
    manifest_path = set_dir / "manifest.json"
    if not manifest_path.is_file():
        return None, []
    problems = []
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except ValueError:
        return None, [f"{manifest_path}: not valid JSON"]
    if manifest.get("schema") != SET_SCHEMA:
        problems.append(f"{manifest_path}: not a {SET_SCHEMA} manifest")
    if manifest.get("identity") != identity:
        problems.append(f"{manifest_path}: approved for a different renderer identity")
    pinned = set()
    for stem, entry in (manifest.get("fixtures") or {}).items():
        for name, digest in (entry.get("files") or {}).items():
            pinned.add(name)
            path = set_dir / name
            if not path.is_file():
                problems.append(f"golden {name} is missing")
            elif sha256_file(path) != digest:
                problems.append(f"golden {name} does not match the SHA-256 in its manifest")
    for path in sorted(set_dir.glob("*.png")):
        if path.name not in pinned:
            problems.append(f"golden {path.name} is not in the manifest")
    return manifest, problems


@dataclass
class FixtureResult:
    fixture: Fixture
    status: str = "pass"
    reasons: list[str] = field(default_factory=list)
    render: dict[str, Any] = field(default_factory=dict)
    pages: list[dict[str, Any]] = field(default_factory=list)
    images: list[Any] = field(default_factory=list)
    diffs: dict[int, Any] = field(default_factory=dict)
    decoded: list[tuple[str, str]] = field(default_factory=list)
    pdf: bytes | None = None

    def fail(self, reason: str) -> None:
        self.status = "fail"
        self.reasons.append(reason)


def _inside(child: Path, parent: Path) -> bool:
    child, parent = child.resolve(), parent.resolve()
    return child == parent or parent in child.parents


def check(fixtures_dir: Path, goldens_dir: Path, candidates_dir: Path, *, font_dir: Path | None = None,
          pdf_out: Path | None = None, decode_dpi: int = DPI) -> dict[str, Any]:
    """Run the golden check. Returns the summary; writes candidates when anything fails."""
    fixtures_dir, goldens_dir, candidates_dir = Path(fixtures_dir), Path(goldens_dir), Path(candidates_dir)
    if _inside(candidates_dir, goldens_dir) or _inside(goldens_dir, candidates_dir):
        raise HarnessError("the candidates directory and the goldens directory must be separate (candidates never go into the goldens)")
    if not fixtures_dir.is_dir():
        raise HarnessError(f"no fixtures directory {fixtures_dir}")
    paths = sorted(fixtures_dir.glob("*.html"))
    if not paths:
        raise HarnessError(f"no *.html fixtures in {fixtures_dir}")
    fixtures = [load_fixture(path) for path in paths]
    identity = renderer_identity(font_dir)
    identity_text, identity_hash = identity["identity"], identity["identityHash"]
    set_dir = goldens_dir / identity_hash
    manifest, set_problems = load_set(set_dir, identity_text)
    reasons: list[str] = []
    if manifest is None and not set_problems:
        reasons.append(f"no approved golden images for {identity_hash} ({identity_text})")
    reasons.extend(set_problems)
    approved = (manifest or {}).get("fixtures") or {}
    usable = manifest is not None and not set_problems

    work = candidates_dir / identity_hash / ".work"
    shutil.rmtree(work, ignore_errors=True)
    work.mkdir(parents=True, exist_ok=True)
    results = []
    for fixture in fixtures:
        result = FixtureResult(fixture)
        results.append(result)
        pdf, rendered = render_fixture(fixture, work, font_dir)
        result.render = rendered
        if pdf is None:
            result.fail(f"render failed: {rendered.get('code', '')} {rendered.get('detail', '')}".strip())
            continue
        if rendered.get("rendererIdentity") != identity_text:
            result.fail("the render reported a different renderer identity")
        result.pdf = pdf
        result.images = rasterise(pdf, DPI)
        decode_images = result.images if decode_dpi == DPI else rasterise(pdf, decode_dpi)
        for image in decode_images:
            result.decoded.extend(decode_barcodes(image))
        result.decoded.sort()
        expected = fixture.payloads
        if expected is None and result.decoded:
            result.fail(f"barcodes found but the fixture declares none (no hms.barcode.payloads): {result.decoded}")
        elif expected is not None and result.decoded != expected:
            result.fail(f"barcode decode mismatch: expected {expected}, decoded {result.decoded}")
        entry = approved.get(fixture.stem) if usable else None
        if usable and entry is None:
            result.fail("no approved golden for this fixture")
        golden_pages = int(entry.get("pages", 0)) if entry else 0
        if entry and golden_pages != len(result.images):
            result.fail(f"page count {len(result.images)}, approved {golden_pages}")
        for number, image in enumerate(result.images, start=1):
            name = f"{fixture.stem}-p{number}.png"
            page = {"page": number, "file": name, "size": list(image.size)}
            if not entry or name not in (entry.get("files") or {}):
                page["status"] = "no-golden"
            else:
                count, diff = compare(image, load_png(set_dir / name))
                if count == 0:
                    page["status"] = "match"
                else:
                    page["status"] = "differs"
                    page["differing_pixels"] = count
                    if diff is not None:
                        result.diffs[number] = diff
                    result.fail(f"{name}: " + ("size or mode differs from the golden" if count is None else f"{count} pixel(s) differ"))
            result.pages.append(page)
        if result.status == "pass" and any(page["status"] == "no-golden" for page in result.pages):
            result.status = "no-golden"  # not compared: fails the check, but approve may accept it
    stale =sorted(set(approved) - {f.stem for f in fixtures}) if usable else []
    for stem in stale:
        reasons.append(f"approved golden for {stem} has no fixture")
    failed = bool(reasons) or any(r.status != "pass" for r in results)
    if pdf_out is not None:
        Path(pdf_out).mkdir(parents=True, exist_ok=True)
        for result in results:
            if result.pdf is not None:
                (Path(pdf_out) / f"{result.fixture.stem}.pdf").write_bytes(result.pdf)
    summary: dict[str, Any] = {
        "status": "fail" if failed else "pass",
        "identity": identity_text,
        "identityHash": identity_hash,
        "goldenSet": str(set_dir),
        "reasons": reasons,
        "fixtures": {r.fixture.stem: {"status": r.status, "reasons": r.reasons, "pages": r.pages,
                                       "barcodes": [f"{s}:{p}" for s, p in r.decoded]} for r in results},
        "candidates": None,
    }
    shutil.rmtree(work, ignore_errors=True)
    for empty in (work.parent, candidates_dir):
        if empty.is_dir() and not any(empty.iterdir()):
            empty.rmdir()  # nothing to keep: a passing check leaves no candidates behind
    if failed:
        summary["candidates"] = str(write_candidates(candidates_dir / identity_hash, identity_text, identity_hash, results, reasons))
    return summary


def write_candidates(directory: Path, identity: str, identity_hash: str, results: list[FixtureResult], reasons: list[str]) -> Path:
    for path in list(directory.glob("*")):
        if path.name == ".work":
            continue
        if path.is_file() and (path.suffix in (".png", ".pdf") or path.name == "manifest.json"):
            path.unlink()
    directory.mkdir(parents=True, exist_ok=True)
    fixtures: dict[str, Any] = {}
    for result in results:
        fixture = result.fixture
        files = {}
        for number, image in enumerate(result.images, start=1):
            name = f"{fixture.stem}-p{number}.png"
            files[name] = save_png(image, directory / name)
        diffs = {}
        for number, diff in result.diffs.items():
            name = f"{fixture.stem}-p{number}.diff.png"
            diffs[name] = save_png(diff, directory / name)
        if result.pdf is not None:
            (directory / f"{fixture.stem}.pdf").write_bytes(result.pdf)
        fixtures[fixture.stem] = {
            "status": result.status, "reasons": result.reasons, "html_sha256": fixture.html_sha256,
            "template": {"id": fixture.request.template_id, "version": fixture.request.template_version,
                         "hash": fixture.request.template_content_hash, "provenance": fixture.request.provenance},
            "defaulted": fixture.defaulted, "pages": len(result.images), "files": files, "diffs": diffs,
            "page_results": result.pages,
            "barcodes": {"expected": None if fixture.payloads is None else [f"{s}:{p}" for s, p in fixture.payloads],
                         "decoded": [f"{s}:{p}" for s, p in result.decoded]},
            "pdf_sha256": None if result.pdf is None else hashlib.sha256(result.pdf).hexdigest(),
        }
    manifest = {
        "schema": CANDIDATE_SCHEMA, "identity": identity, "identity_hash": identity_hash,
        "raster": raster_description(), "reasons": reasons, "fixtures": fixtures,
        "note": "Candidates only: not approved. 'python -m hms_docrender.golden approve' (a human or the integrator) copies them into the goldens directory.",
    }
    (directory / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    return directory


def raster_description() -> dict[str, Any]:
    from importlib import metadata

    return {"dpi": DPI, "mode": "L (8-bit grey)", "rasteriser": f"pypdfium2 {metadata.version('pypdfium2')}",
            "decoder": f"zxing-cpp {metadata.version('zxing-cpp')}"}


def approve(candidates_dir: Path, goldens_dir: Path, approver: str, *, identity_hash: str | None = None,
            replace_existing: bool = False) -> dict[str, Any]:
    """Copy a candidate set into the goldens directory. Refuses render or barcode failures and silent replacement."""
    candidates_dir, goldens_dir = Path(candidates_dir), Path(goldens_dir)
    if not approver.strip():
        raise HarnessError("--approver names who approves (a human or the integrator)")
    if _inside(candidates_dir, goldens_dir) or _inside(goldens_dir, candidates_dir):
        raise HarnessError("the candidates directory and the goldens directory must be separate")
    sets = [p for p in candidates_dir.glob("*") if (p / "manifest.json").is_file()] if candidates_dir.is_dir() else []
    if identity_hash:
        sets = [p for p in sets if p.name == identity_hash]
    if len(sets) != 1:
        raise HarnessError(f"expected exactly one candidate set in {candidates_dir}, found {[p.name for p in sets]}; pass --identity-hash")
    source = sets[0]
    manifest = json.loads((source / "manifest.json").read_text(encoding="utf-8"))
    if manifest.get("schema") != CANDIDATE_SCHEMA or manifest.get("identity_hash") != source.name:
        raise HarnessError(f"{source / 'manifest.json'}: not a candidate manifest for {source.name}")
    blocking = []
    for stem, entry in manifest["fixtures"].items():
        if not entry["files"]:
            blocking.append(f"{stem}: no rendered pages")
        for reason in entry["reasons"]:
            if reason.startswith(("render failed", "barcode", "barcodes found", "the render reported")):
                blocking.append(f"{stem}: {reason}")
        for name, digest in entry["files"].items():
            if sha256_file(source / name) != digest:
                blocking.append(f"{stem}: candidate {name} changed after the check")
    if blocking:
        raise HarnessError("refused to approve: " + "; ".join(blocking), 1)
    target = goldens_dir / source.name
    if target.exists() and any(target.iterdir()):
        existing = {p.name: sha256_file(p) for p in target.glob("*.png")}
        incoming = {n: d for e in manifest["fixtures"].values() for n, d in e["files"].items()}
        if existing != incoming and not replace_existing:
            raise HarnessError(f"{target} already holds a different approved set; pass --replace-existing to replace it (a changed golden named in a hazard's verified_by is stop-and-ask item 10)", 1)
        shutil.rmtree(target)
    target.mkdir(parents=True, exist_ok=True)
    fixtures = {}
    for stem, entry in sorted(manifest["fixtures"].items()):
        for name in entry["files"]:
            shutil.copyfile(source / name, target / name)
        fixtures[stem] = {"html_sha256": entry["html_sha256"], "template": entry["template"], "pages": entry["pages"],
                          "files": entry["files"], "barcodes": entry["barcodes"]["decoded"]}
    golden_manifest = {
        "schema": SET_SCHEMA, "identity": manifest["identity"], "identity_hash": manifest["identity_hash"],
        "raster": manifest["raster"], "approved_by": approver.strip(),
        "approved_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "human_script_review": "requested",
        "note": ("Regression evidence only until a Sorani and Arabic reader signs the script review "
                 "(docs/specs/modules/platform-docs.md §10, KA-080)."),
        "fixtures": fixtures,
    }
    (target / "manifest.json").write_text(json.dumps(golden_manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    return {"status": "approved", "goldenSet": str(target), "fixtures": sorted(fixtures), "human_script_review": "requested"}
