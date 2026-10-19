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
requested``. A file whose SHA-256 differs from the manifest, or any file the manifest does not pin, fails the check
(the set was edited by hand). The check never writes into the goldens directory (``--candidates``, ``--pdf-out``
and ``--report`` must lie outside it).

Barcodes are decoded from the raw symbol bytes (zxing-cpp's plain text mode), and a DataMatrix must be a square
ECC 200 symbol and a Code 128 plain (§6.1). A new renderer identity (a library or font upgrade) has no approved set:
the check then compares every page with the most recently approved set of another identity and reports the
differences, and ``approve`` refuses the identity change without ``--accept-identity-change`` (a human compares the
``*.previous-diff.png`` images first; a Sorani and Arabic reader for identity text, KA-080).
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
_IDENTITY_HASH = re.compile(r"^[0-9a-f]{16}$")


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
        # Never echo the output: it could quote the document. The renderer always ends with a JSON line.
        result = {"status": "failed", "detail": f"no JSON result from the renderer (exit {proc.returncode})"}
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


# §6.1: wristbands and specimen labels carry DataMatrix ECC 200 (square symbols: the module forces them, and many
# scanners and printers do not read DMRE rectangles) or Code 128, printable ASCII without FNC1 or GS. The ISO/IEC
# 15424 symbology identifier tells plain ECC 200 (]d1) from GS1 (]d2) or ECI (]d4) content, and plain Code 128 (]C0)
# from GS1-128 (]C1).
EXPECTED_IDENTIFIERS = {"datamatrix": "]d1", "code128": "]C0"}


def decode_barcodes(image: Any) -> tuple[list[tuple[str, str]], list[str]]:
    """(the barcodes on ``image`` as (symbology, payload), the problems found).

    The payload is the symbol's raw bytes read as ASCII (zxing-cpp's plain text mode, never its human-readable
    rendering, which rewrites GS1 and ECI content). A payload that is not printable ASCII, a DataMatrix that is not
    plain ECC 200 or not square, and a Code 128 that is not plain are problems: the check fails on them.
    """
    import zxingcpp

    decoded: list[tuple[str, str]] = []
    problems: list[str] = []
    for found in zxingcpp.read_barcodes(image, text_mode=zxingcpp.TextMode.Plain):
        if not found.valid:
            continue
        symbology = _symbology(found.format)
        raw = bytes(found.bytes)
        payload = raw.decode("ascii", "replace")
        if not _PAYLOAD.match(payload) or payload != found.text:
            problems.append(f"{symbology}: the decoded content is not printable ASCII (§6.1)")
        expected_identifier = EXPECTED_IDENTIFIERS.get(symbology)
        if expected_identifier is not None and found.symbology_identifier != expected_identifier:
            problems.append(f"{symbology}: symbology identifier {found.symbology_identifier}, expected {expected_identifier} "
                            "(plain content, no GS1, ECI or FNC1)")
        if symbology == "datamatrix":
            size = str((found.extra or {}).get("Version", "")) if isinstance(found.extra, dict) else ""
            rows, cross, columns = size.partition("x")
            if not cross or rows != columns:
                problems.append(f"datamatrix: a {size or 'non-square'} symbol, not a square ECC 200 symbol (§6.1)")
        decoded.append((symbology, payload))
    return sorted(decoded), problems


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

MANIFEST = "manifest.json"


def load_set(set_dir: Path, identity: str) -> tuple[dict[str, Any] | None, list[str]]:
    """The approved set's manifest and any integrity problems (never trusts a file the manifest does not pin)."""
    manifest_path = set_dir / MANIFEST
    if not manifest_path.is_file():
        return None, []
    problems = []
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except ValueError:
        return None, [f"{manifest_path}: not valid JSON"]
    if not isinstance(manifest, dict):
        return None, [f"{manifest_path}: not a {SET_SCHEMA} manifest"]
    if manifest.get("schema") != SET_SCHEMA:
        problems.append(f"{manifest_path}: not a {SET_SCHEMA} manifest")
    if manifest.get("identity") != identity:
        problems.append(f"{manifest_path}: approved for a different renderer identity")
    pinned = set()
    fixtures = manifest.get("fixtures")
    for stem, entry in (fixtures.items() if isinstance(fixtures, dict) else ()):
        files = entry.get("files") if isinstance(entry, dict) else None
        for name, digest in (files.items() if isinstance(files, dict) else ()):
            pinned.add(name)
            path = set_dir / name
            if not _page_name_ok(stem, name) or not _inside(path, set_dir):
                problems.append(f"golden {name!r} is not a page file name of {stem}")
            elif not path.is_file():
                problems.append(f"golden {name} is missing")
            elif sha256_file(path) != digest:
                problems.append(f"golden {name} does not match the SHA-256 in its manifest")
    for path in sorted(set_dir.iterdir()):
        if path.name == MANIFEST:
            continue
        if not path.is_file():
            problems.append(f"{path.name} in the golden set is not a file")
        elif path.name not in pinned:
            problems.append(f"golden {path.name} is not in the manifest")
    return manifest, problems


def approved_sets(goldens_dir: Path) -> list[tuple[str, Path, dict[str, Any]]]:
    """Every approved set in the goldens directory as (approved_at, directory, manifest), oldest first."""
    sets = []
    if not goldens_dir.is_dir():
        return sets
    for directory in goldens_dir.iterdir():
        if not _IDENTITY_HASH.match(directory.name):
            continue  # not a set (for example an interrupted approval's staging directory)
        path = directory / MANIFEST
        if not path.is_file():
            continue
        try:
            manifest = json.loads(path.read_text(encoding="utf-8"))
        except ValueError:
            continue
        if isinstance(manifest, dict) and manifest.get("schema") == SET_SCHEMA:
            sets.append((str(manifest.get("approved_at", "")), directory, manifest))
    return sorted(sets, key=lambda item: (item[0], item[1].name))


def previous_set(goldens_dir: Path, identity_hash: str) -> tuple[Path, dict[str, Any]] | None:
    """The most recently approved set of another renderer identity, or None when there is none."""
    others = [(directory, manifest) for _, directory, manifest in approved_sets(goldens_dir) if directory.name != identity_hash]
    return others[-1] if others else None


_PAGE = re.compile(r"^(?P<stem>[A-Za-z0-9][A-Za-z0-9._-]*)-p(?P<number>[1-9][0-9]*)\.png$")


def _page_name_ok(stem: Any, name: Any) -> bool:
    if not isinstance(stem, str) or not isinstance(name, str) or not _STEM.match(stem):
        return False
    match = _PAGE.match(name)
    return match is not None and match.group("stem") == stem


@dataclass
class FixtureResult:
    fixture: Fixture
    status: str = "pass"
    reasons: list[str] = field(default_factory=list)
    render: dict[str, Any] = field(default_factory=dict)
    pages: list[dict[str, Any]] = field(default_factory=list)
    images: list[Any] = field(default_factory=list)
    diffs: dict[int, Any] = field(default_factory=dict)
    previous_diffs: dict[int, Any] = field(default_factory=dict)
    decoded: list[tuple[str, str]] = field(default_factory=list)
    pdf: bytes | None = None

    def fail(self, reason: str) -> None:
        self.status = "fail"
        self.reasons.append(reason)


def _inside(child: Path, parent: Path) -> bool:
    child, parent = Path(child).resolve(), Path(parent).resolve()
    return child == parent or parent in child.parents


def refuse_inside_goldens(path: Path | None, goldens_dir: Path, what: str) -> None:
    """Check mode never writes into the goldens directory (§10: candidates never overwrite an approved file)."""
    if path is not None and (_inside(path, goldens_dir) or _inside(goldens_dir, path)):
        raise HarnessError(f"{what} must be outside the goldens directory (the check never writes into the goldens)")


def _compare_page(image: Any, set_dir: Path, entry: dict[str, Any] | None, name: str) -> dict[str, Any]:
    """A page's comparison with one approved set: status match, differs (with a count and a diff image) or no-golden."""
    if not entry or name not in (entry.get("files") or {}):
        return {"status": "no-golden"}
    count, diff = compare(image, load_png(set_dir / name))
    if count == 0:
        return {"status": "match"}
    return {"status": "differs", "differing_pixels": count, "diff": diff}


def check(fixtures_dir: Path, goldens_dir: Path, candidates_dir: Path, *, font_dir: Path | None = None,
          pdf_out: Path | None = None, decode_dpi: int = DPI) -> dict[str, Any]:
    """Run the golden check. Returns the summary; writes candidates when anything fails.

    When the renderer identity has no approved set but another identity has one (a library or font upgrade), every
    page is also compared with the most recently approved set: the counts go into the candidate manifest
    (``previous_set``) and the difference images beside the candidates (``<fixture>-p<n>.previous-diff.png``), so a
    shaping change that comes with an upgrade is shown, never approved blind (``approve`` then needs an explicit
    flag).
    """
    fixtures_dir, goldens_dir, candidates_dir = Path(fixtures_dir), Path(goldens_dir), Path(candidates_dir)
    if _inside(candidates_dir, goldens_dir) or _inside(goldens_dir, candidates_dir):
        raise HarnessError("the candidates directory and the goldens directory must be separate (candidates never go into the goldens)")
    refuse_inside_goldens(pdf_out, goldens_dir, "--pdf-out")
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

    previous: dict[str, Any] | None = None
    previous_dir: Path | None = None
    previous_fixtures: dict[str, Any] = {}
    if manifest is None and not set_problems:
        found = previous_set(goldens_dir, identity_hash)
        if found is not None:
            previous_dir, previous_manifest = found
            _, previous_problems = load_set(previous_dir, str(previous_manifest.get("identity")))
            previous = {"identity_hash": previous_dir.name, "identity": previous_manifest.get("identity"),
                        "approved_at": previous_manifest.get("approved_at"), "integrity": previous_problems or "ok"}
            if previous_problems:
                reasons.append(f"the last approved set {previous_dir.name} fails its integrity check: {'; '.join(previous_problems)}")
            else:
                previous_fixtures = previous_manifest.get("fixtures") or {}

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
        barcode_problems: list[str] = []
        for image in decode_images:
            found, problems = decode_barcodes(image)
            result.decoded.extend(found)
            barcode_problems.extend(problems)
        result.decoded.sort()
        for problem in sorted(set(barcode_problems)):
            result.fail(f"barcode not as §6.1 requires: {problem}")
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
        previous_entry = previous_fixtures.get(fixture.stem)
        for number, image in enumerate(result.images, start=1):
            name = f"{fixture.stem}-p{number}.png"
            page: dict[str, Any] = {"page": number, "file": name, "size": list(image.size)}
            outcome = _compare_page(image, set_dir, entry, name)
            page["status"] = outcome["status"]
            if outcome["status"] == "differs":
                page["differing_pixels"] = outcome["differing_pixels"]
                if outcome["diff"] is not None:
                    result.diffs[number] = outcome["diff"]
                count = outcome["differing_pixels"]
                result.fail(f"{name}: " + ("size or mode differs from the golden" if count is None else f"{count} pixel(s) differ"))
            if previous_dir is not None and previous_fixtures:
                earlier = _compare_page(image, previous_dir, previous_entry, name)
                page["previous"] = {key: value for key, value in earlier.items() if key != "diff"}
                if earlier.get("diff") is not None:
                    result.previous_diffs[number] = earlier["diff"]
            result.pages.append(page)
        if result.status == "pass" and any(page["status"] == "no-golden" for page in result.pages):
            result.status = "no-golden"  # not compared: fails the check, but approve may accept it
    stale = sorted(set(approved) - {f.stem for f in fixtures}) if usable else []
    for stem in stale:
        reasons.append(f"approved golden for {stem} has no fixture")
    if previous is not None and previous_fixtures:
        previous.update(_previous_summary(results, previous_fixtures, {f.stem for f in fixtures}))
        reasons.append(
            f"renderer identity changed from {previous['identity_hash']}: {previous['pages_differing']} page(s) differ from "
            f"the last approved set, {previous['pages_new']} page(s) have no counterpart there "
            "(difference images: *.previous-diff.png)"
        )
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
        "previousSet": previous,
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
        summary["candidates"] = str(write_candidates(candidates_dir / identity_hash, identity_text, identity_hash, results,
                                                     reasons, previous))
    return summary


def _previous_summary(results: list[FixtureResult], previous_fixtures: dict[str, Any], stems: set[str]) -> dict[str, Any]:
    differing = new = same = 0
    for result in results:
        for page in result.pages:
            status = (page.get("previous") or {}).get("status")
            if status == "match":
                same += 1
            elif status == "differs":
                differing += 1
            else:
                new += 1
    dropped = sorted(set(previous_fixtures) - stems)
    return {"pages_matching": same, "pages_differing": differing, "pages_new": new, "fixtures_dropped": dropped}


def write_candidates(directory: Path, identity: str, identity_hash: str, results: list[FixtureResult], reasons: list[str],
                     previous: dict[str, Any] | None = None) -> Path:
    for path in list(directory.glob("*")):
        if path.name == ".work":
            continue
        if path.is_file() and (path.suffix in (".png", ".pdf") or path.name == MANIFEST):
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
        previous_diffs = {}
        for number, diff in result.previous_diffs.items():
            name = f"{fixture.stem}-p{number}.previous-diff.png"
            previous_diffs[name] = save_png(diff, directory / name)
        if result.pdf is not None:
            (directory / f"{fixture.stem}.pdf").write_bytes(result.pdf)
        fixtures[fixture.stem] = {
            "status": result.status, "reasons": result.reasons, "html_sha256": fixture.html_sha256,
            "template": {"id": fixture.request.template_id, "version": fixture.request.template_version,
                         "hash": fixture.request.template_content_hash, "provenance": fixture.request.provenance},
            "defaulted": fixture.defaulted, "pages": len(result.images), "files": files, "diffs": diffs,
            "previous_diffs": previous_diffs, "page_results": result.pages,
            "barcodes": {"expected": None if fixture.payloads is None else [f"{s}:{p}" for s, p in fixture.payloads],
                         "decoded": [f"{s}:{p}" for s, p in result.decoded]},
            "pdf_sha256": None if result.pdf is None else hashlib.sha256(result.pdf).hexdigest(),
        }
    manifest = {
        "schema": CANDIDATE_SCHEMA, "identity": identity, "identity_hash": identity_hash,
        "raster": raster_description(), "reasons": reasons, "previous_set": previous, "fixtures": fixtures,
        "note": "Candidates only: not approved. 'python -m hms_docrender.golden approve' (a human or the integrator) copies them into the goldens directory.",
    }
    (directory / MANIFEST).write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    return directory


def raster_description() -> dict[str, Any]:
    from importlib import metadata

    return {"dpi": DPI, "mode": "L (8-bit grey)", "rasteriser": f"pypdfium2 {metadata.version('pypdfium2')}",
            "decoder": f"zxing-cpp {metadata.version('zxing-cpp')}"}


_BLOCKING_PREFIXES = ("render failed", "barcode", "barcodes found", "the render reported")


def _validated_candidates(source: Path, manifest: Any) -> tuple[dict[str, Any], list[str]]:
    """The candidate manifest's fixtures, and every reason the set cannot be approved (names, pages, hashes)."""
    if not isinstance(manifest, dict) or not isinstance(manifest.get("fixtures"), dict) or not manifest["fixtures"]:
        raise HarnessError(f"{source / MANIFEST}: no fixtures")
    blocking = []
    for stem, entry in manifest["fixtures"].items():
        if not isinstance(stem, str) or not _STEM.match(stem) or not isinstance(entry, dict):
            blocking.append(f"{stem!r}: not a fixture name")
            continue
        files, pages, reasons = entry.get("files"), entry.get("pages"), entry.get("reasons")
        if not isinstance(files, dict) or not files:
            blocking.append(f"{stem}: no rendered pages")
            continue
        if not isinstance(pages, int) or isinstance(pages, bool) or pages != len(files):
            blocking.append(f"{stem}: the manifest's page count does not match its files")
        for reason in reasons if isinstance(reasons, list) else ["no reasons list"]:
            if not isinstance(reason, str) or reason.startswith(_BLOCKING_PREFIXES):
                blocking.append(f"{stem}: {reason}")
        numbers = []
        for name, digest in files.items():
            if not _page_name_ok(stem, name) or not _inside(source / name, source):
                blocking.append(f"{stem}: {name!r} is not a page file name of this fixture")
                continue
            numbers.append(int(_PAGE.match(name).group("number")))
            if not isinstance(digest, str) or not _SHA256.match(digest):
                blocking.append(f"{stem}: {name} has no SHA-256")
            elif not (source / name).is_file() or sha256_file(source / name) != digest:
                blocking.append(f"{stem}: candidate {name} changed after the check")
        if sorted(numbers) != list(range(1, len(files) + 1)):
            blocking.append(f"{stem}: the page files are not numbered 1 to {len(files)}")
    return manifest["fixtures"], blocking


def approve(candidates_dir: Path, goldens_dir: Path, approver: str, *, identity_hash: str | None = None,
            replace_existing: bool = False, accept_identity_change: bool = False) -> dict[str, Any]:
    """Copy a candidate set into the goldens directory.

    Refuses render and barcode failures, a malformed candidate manifest (page names must be ``<fixture>-p<n>.png``
    inside the set), silent replacement of an approved set of the same identity (``replace_existing``), and an
    identity change: a set for a new renderer identity while another identity has an approved set needs
    ``accept_identity_change``, given only after a human compared the ``*.previous-diff.png`` images, and the check
    must have compared the candidates with the current last approved set.
    """
    candidates_dir, goldens_dir = Path(candidates_dir), Path(goldens_dir)
    if not approver.strip():
        raise HarnessError("--approver names who approves (a human or the integrator)")
    if _inside(candidates_dir, goldens_dir) or _inside(goldens_dir, candidates_dir):
        raise HarnessError("the candidates directory and the goldens directory must be separate")
    sets = [p for p in candidates_dir.glob("*") if (p / MANIFEST).is_file()] if candidates_dir.is_dir() else []
    if identity_hash:
        sets = [p for p in sets if p.name == identity_hash]
    if len(sets) != 1:
        raise HarnessError(f"expected exactly one candidate set in {candidates_dir}, found {[p.name for p in sets]}; pass --identity-hash")
    source = sets[0]
    if not _IDENTITY_HASH.match(source.name):
        raise HarnessError(f"{source.name}: not an identity hash")
    try:
        manifest = json.loads((source / MANIFEST).read_text(encoding="utf-8"))
    except ValueError:
        raise HarnessError(f"{source / MANIFEST}: not valid JSON") from None
    if not isinstance(manifest, dict) or manifest.get("schema") != CANDIDATE_SCHEMA or manifest.get("identity_hash") != source.name:
        raise HarnessError(f"{source / MANIFEST}: not a candidate manifest for {source.name}")
    candidate_fixtures, blocking = _validated_candidates(source, manifest)
    if blocking:
        raise HarnessError("refused to approve: " + "; ".join(blocking), 1)
    target = goldens_dir / source.name
    identity_change = None
    if target.exists() and any(target.iterdir()):
        existing = {p.name: sha256_file(p) for p in target.glob("*.png")}
        incoming = {n: d for e in candidate_fixtures.values() for n, d in e["files"].items()}
        if existing != incoming and not replace_existing:
            raise HarnessError(f"{target} already holds a different approved set; pass --replace-existing to replace it (a changed golden named in a hazard's verified_by is stop-and-ask item 10)", 1)
    else:
        found = previous_set(goldens_dir, source.name)
        if found is not None:
            previous_dir, previous_manifest = found
            compared = manifest.get("previous_set") if isinstance(manifest.get("previous_set"), dict) else None
            if compared is None or compared.get("identity_hash") != previous_dir.name or compared.get("integrity") != "ok":
                raise HarnessError(
                    f"the renderer identity changed from {previous_dir.name} to {source.name}, and these candidates were not "
                    f"compared with that set; run the check again", 1)
            if not accept_identity_change:
                raise HarnessError(
                    f"refused to approve a renderer identity change from {previous_dir.name} to {source.name} without "
                    f"--accept-identity-change: {compared.get('pages_differing')} page(s) differ from the last approved set "
                    f"and {compared.get('pages_new')} have no counterpart there; a human compares the *.previous-diff.png "
                    "images first (a Sorani and Arabic reader for identity text, KA-080)", 1)
            identity_change = {
                "from_identity_hash": previous_dir.name, "from_identity": previous_manifest.get("identity"),
                "pages_matching": compared.get("pages_matching"), "pages_differing": compared.get("pages_differing"),
                "pages_new": compared.get("pages_new"), "fixtures_dropped": compared.get("fixtures_dropped"),
                "accepted_by": approver.strip(),
            }
    staging = goldens_dir / f".{source.name}.approving"
    shutil.rmtree(staging, ignore_errors=True)
    staging.mkdir(parents=True)
    fixtures = {}
    for stem, entry in sorted(candidate_fixtures.items()):
        for name in entry["files"]:
            shutil.copyfile(source / name, staging / name)
        fixtures[stem] = {"html_sha256": entry.get("html_sha256"), "template": entry.get("template"), "pages": entry["pages"],
                          "files": entry["files"], "barcodes": (entry.get("barcodes") or {}).get("decoded")}
    golden_manifest = {
        "schema": SET_SCHEMA, "identity": manifest.get("identity"), "identity_hash": source.name,
        "raster": manifest.get("raster"), "approved_by": approver.strip(),
        "approved_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "human_script_review": "requested",
        "note": ("Regression evidence only until a Sorani and Arabic reader signs the script review "
                 "(docs/specs/modules/platform-docs.md §10, KA-080)."),
        "identity_change": identity_change,
        "fixtures": fixtures,
    }
    (staging / MANIFEST).write_text(json.dumps(golden_manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    if target.exists():
        shutil.rmtree(target)
    staging.rename(target)
    return {"status": "approved", "goldenSet": str(target), "fixtures": sorted(fixtures), "human_script_review": "requested",
            "identityChange": identity_change}
