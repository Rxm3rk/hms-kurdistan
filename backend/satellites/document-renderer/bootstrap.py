"""Bootstrap the document renderer's runtime (docs/specs/modules/platform-docs.md §7.5, §10; ADR-038; DN-067).

Standard library only. Run it with the project venv's interpreter in isolated mode:

    .tools/venv/Scripts/python.exe -I backend/satellites/document-renderer/bootstrap.py [--target DIR]   (Windows)
    .tools/venv/bin/python -I backend/satellites/document-renderer/bootstrap.py [--target DIR]           (Linux)

``--target`` defaults to ``<repo>/.tools/docrender``. What it does, idempotently (a second run re-verifies and only
repairs what is missing or wrong):

1. creates a virtual environment in the target from the base CPython 3.12 interpreter;
2. installs requirements.txt with ``pip --require-hashes --no-deps --only-binary=:all:`` (only the wheels for this
   platform), then checks every installed file against its RECORD hash, refuses unexpected distributions and any
   site-packages file no RECORD lists (a planted .pth, sitecustomize.py or shadow module), and runs
   ``pip check``;
3. on Windows, downloads the MSYS2 UCRT64 packages pinned in ``runtime/msys2-ucrt64.lock.json`` from
   repo.msys2.org, verifies each package's SHA-256, and extracts only the listed ``ucrt64/bin`` DLLs, each verified
   by SHA-256, into ``<target>/pango/bin`` (nothing is installed system-wide; the zstd decompression uses the pinned
   ``zstandard`` wheel inside the target);
   on Linux, uses the distribution's Pango, HarfBuzz, fontconfig and FreeType (installing them is a system change
   for the human, DN-067; this script never installs system packages);
4. writes the hermetic fontconfig file, a ``.pth`` file that puts this satellite's source on the target's path,
   and ``<target>/runtime.json``: the versions of everything that draws (part of the renderer identity, §10),
   including the native library versions read back from the loaded libraries.

Downloads come only from pypi.org / files.pythonhosted.org and repo.msys2.org (BUILD-PROMPT.md §3.7), and every
file is verified by SHA-256 before use.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import platform
import re
import shutil
import subprocess
import sys
import urllib.request
import venv
from pathlib import Path

BOOTSTRAP_VERSION = 1
SATELLITE_DIR = Path(__file__).resolve().parent
REPO_DIR = SATELLITE_DIR.parents[2]
REQUIREMENTS = SATELLITE_DIR / "requirements.txt"
MSYS2_LOCK = SATELLITE_DIR / "runtime" / "msys2-ucrt64.lock.json"
DEFAULT_TARGET = REPO_DIR / ".tools" / "docrender"
PYPI_INDEX = "https://pypi.org/simple"
MSYS2_REPO = "https://repo.msys2.org/mingw/ucrt64/"
IS_WINDOWS = os.name == "nt"
PTH_NAME = "hms_docrender_source.pth"
ALLOWED_EXTRA_DISTRIBUTIONS = {"pip"}  # ensurepip's own pip (bundled with CPython, not downloaded)
# Keep identical to hms_docrender/env.py BASE_INTERPRETER_DLLS: CPython's own copies serve the MSYS2 DLLs.
BASE_INTERPRETER_DLLS = ("libffi-8.dll",)

# Keep identical to hms_docrender/env.py FONTCONFIG_XML (a unit test compares them).
FONTCONFIG_XML = """<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<!-- HMS document renderer: hermetic fontconfig (docs/specs/modules/platform-docs.md §7.5).
     No <dir> and no <include> on purpose: no system or user font is visible, so every glyph in a PDF
     comes from a document @font-face rule that loads a pinned print font through hms-font:. -->
<fontconfig>
  <cachedir prefix="relative">cache</cachedir>
</fontconfig>
"""

DN067_HINT = (
    "The Linux runtime uses the distribution's Pango libraries, a system change for the host owner (DN-067): "
    "sudo apt-get update && sudo apt-get install -y libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz-subset0 fontconfig"
)


class BootstrapError(Exception):
    pass


# --------------------------------------------------------------------------------------------- requirements

_REQ_LINE = re.compile(r"^([A-Za-z0-9][A-Za-z0-9._-]*)==([A-Za-z0-9._+!-]+)\s*(?:;\s*(.+?))?\s*$")
_HASH = re.compile(r"^--hash=sha256:([0-9a-f]{64})$")
_MARKER = re.compile(r"""^sys_platform\s*(==|!=)\s*["']([a-z0-9]+)["']$""")


def normalise(name: str) -> str:
    return re.sub(r"[-_.]+", "-", name).lower()


def parse_requirements(text: str) -> list[dict]:
    """Pins from a hash-pinned requirements file: name, version, marker, hashes. Refuses anything else."""
    logical, current = [], ""
    for raw in text.splitlines():
        line = raw.split(" #", 1)[0].strip() if not raw.lstrip().startswith("#") else ""
        if not line:
            if current:
                logical.append(current)
                current = ""
            continue
        if line.endswith("\\"):
            current += line[:-1] + " "
        else:
            logical.append(current + line)
            current = ""
    if current:
        logical.append(current)
    pins = []
    for entry in logical:
        parts = entry.split()
        hashes = [p for p in parts if p.startswith("--hash=")]
        spec = " ".join(p for p in parts if not p.startswith("--hash="))
        match = _REQ_LINE.match(spec)
        if not match:
            raise BootstrapError(f"requirements.txt: not an exact pin: {spec!r}")
        digests = []
        for item in hashes:
            found = _HASH.match(item)
            if not found:
                raise BootstrapError(f"requirements.txt: {match.group(1)}: not a sha256 hash: {item}")
            digests.append(found.group(1))
        if not digests:
            raise BootstrapError(f"requirements.txt: {match.group(1)} has no --hash")
        pins.append({"name": normalise(match.group(1)), "version": match.group(2), "marker": match.group(3), "hashes": digests})
    return pins


def marker_applies(marker: str | None) -> bool:
    if marker is None:
        return True
    match = _MARKER.match(marker.strip())
    if not match:
        raise BootstrapError(f"requirements.txt: unsupported environment marker {marker!r}")
    equal = sys.platform == match.group(2)
    return equal if match.group(1) == "==" else not equal


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


# --------------------------------------------------------------------------------------------- helpers run inside the target


def helper_verify_installed(requirements: Path) -> int:
    """Run by the target's interpreter: report missing, mismatched, tampered and unexpected distributions."""
    from importlib import metadata

    pins = {p["name"]: p for p in parse_requirements(requirements.read_text(encoding="utf-8")) if marker_applies(p["marker"])}
    report = {"missing": [], "mismatched": [], "tampered": [], "unexpected": [], "installed": {}}
    seen = set()
    for dist in metadata.distributions():
        name = normalise(dist.metadata["Name"])
        if name in seen:
            report["tampered"].append(f"{name}: installed twice")
            continue
        seen.add(name)
        report["installed"][name] = dist.version
        if name not in pins:
            if name not in ALLOWED_EXTRA_DISTRIBUTIONS:
                report["unexpected"].append(f"{name}=={dist.version}")
            continue
        if dist.version != pins[name]["version"]:
            report["mismatched"].append(f"{name}: {dist.version} installed, {pins[name]['version']} pinned")
            continue
        for item in dist.files or []:
            if item.hash is None:
                continue
            if item.hash.mode != "sha256":
                report["tampered"].append(f"{name}: {item} has a {item.hash.mode} RECORD hash")
                continue
            path = Path(dist.locate_file(item))
            if not path.is_file():
                report["tampered"].append(f"{name}: {item} is missing")
                continue
            actual = base64.urlsafe_b64encode(bytes.fromhex(sha256_file(path))).rstrip(b"=").decode("ascii")
            if actual != item.hash.value:
                report["tampered"].append(f"{name}: {item} does not match its RECORD hash")
    report["missing"] = sorted(set(pins) - seen)
    report["unlisted"] = unlisted_site_files()
    print(json.dumps(report))
    return 0


def unlisted_site_files() -> list[str]:
    """Files in site-packages that no distribution's RECORD lists (run by the target's interpreter).

    A planted ``.pth``, ``sitecustomize.py`` or shadow module would run or be imported even under ``-I`` (site-packages
    ``.pth`` files are still processed), so the only files allowed besides the RECORD-listed ones are this script's
    own ``.pth`` and ``__pycache__`` byte code.
    """
    import sysconfig
    from importlib import metadata

    listed = set()
    for dist in metadata.distributions():
        for item in dist.files or []:
            listed.add(os.path.normcase(str(Path(dist.locate_file(item)).resolve())))
    unlisted = []
    for root in sorted({sysconfig.get_path("purelib"), sysconfig.get_path("platlib")}):
        for directory, subdirectories, files in os.walk(root):
            subdirectories[:] = [name for name in subdirectories if name != "__pycache__"]
            for name in files:
                path = Path(directory, name)
                if path.parent == Path(root) and name == PTH_NAME:
                    continue
                if os.path.normcase(str(path.resolve())) not in listed:
                    unlisted.append(path.relative_to(root).as_posix())
    return sorted(unlisted)


def download(url: str, dest: Path, expected_sha256: str) -> None:
    if not url.startswith(MSYS2_REPO):
        raise BootstrapError(f"refused to download from {url}: only {MSYS2_REPO}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.is_file() and sha256_file(dest) == expected_sha256:
        return
    partial = dest.with_name(dest.name + ".partial")
    with urllib.request.urlopen(url, timeout=300) as response, partial.open("wb") as out:
        shutil.copyfileobj(response, out)
    actual = sha256_file(partial)
    if actual != expected_sha256:
        partial.unlink(missing_ok=True)
        raise BootstrapError(f"SHA-256 mismatch for {url}: got {actual}, pinned {expected_sha256}")
    os.replace(partial, dest)


def helper_extract_msys2(target: Path) -> int:
    """Run by the target's interpreter on Windows (it has the pinned zstandard wheel)."""
    import tarfile

    import zstandard

    lock = json.loads(MSYS2_LOCK.read_text(encoding="utf-8"))
    if lock.get("schema") != "hms-docrender-msys2-lock/1" or lock.get("repo") != MSYS2_REPO:
        raise BootstrapError(f"{MSYS2_LOCK}: unexpected schema or repository")
    bin_dir = target / "pango" / "bin"
    downloads = target / "downloads" / "msys2"
    bin_dir.mkdir(parents=True, exist_ok=True)
    expected = {dll["name"]: dll["sha256"] for package in lock["packages"] for dll in package["dlls"]}
    unexpected = sorted(p.name for p in bin_dir.iterdir() if p.name not in expected)
    if unexpected:
        raise BootstrapError(f"{bin_dir} holds files the lock does not list: {unexpected}; delete the directory and run again")
    for package in lock["packages"]:
        filename = package["filename"]
        if not re.fullmatch(r"mingw-w64-ucrt-x86_64-[A-Za-z0-9._+-]+-any\.pkg\.tar\.zst", filename) or package["url"] != MSYS2_REPO + filename:
            raise BootstrapError(f"{MSYS2_LOCK}: unexpected package entry {filename!r}")
        wanted = {dll["name"]: dll["sha256"] for dll in package["dlls"]}
        for name in wanted:
            if not re.fullmatch(r"[A-Za-z0-9._+-]+\.dll", name):
                raise BootstrapError(f"{MSYS2_LOCK}: unexpected DLL name {name!r}")
        todo = {n: d for n, d in wanted.items() if not ((bin_dir / n).is_file() and sha256_file(bin_dir / n) == d)}
        if not todo:
            continue
        archive = downloads / filename
        download(package["url"], archive, package["sha256"])
        found = set()
        with archive.open("rb") as raw, zstandard.ZstdDecompressor().stream_reader(raw) as stream:
            with tarfile.open(fileobj=stream, mode="r|") as tar:
                for member in tar:
                    if not member.isfile() or not member.name.startswith("ucrt64/bin/"):
                        continue
                    name = member.name[len("ucrt64/bin/"):]
                    if name not in todo:
                        continue
                    data = tar.extractfile(member).read()
                    if sha256_bytes(data) != todo[name]:
                        raise BootstrapError(f"{filename}: {name} does not match its pinned SHA-256")
                    partial = bin_dir / (name + ".partial")
                    partial.write_bytes(data)
                    os.replace(partial, bin_dir / name)
                    found.add(name)
        missing = sorted(set(todo) - found)
        if missing:
            raise BootstrapError(f"{filename}: does not contain {missing}")
        print(f"  {package['name']} {package['version']}: {', '.join(sorted(found))}")
    return 0


# --------------------------------------------------------------------------------------------- main flow


def target_python(target: Path) -> Path:
    return target / ("Scripts/python.exe" if IS_WINDOWS else "bin/python")


def run(argv: list, *, capture: bool = False, env: dict | None = None) -> subprocess.CompletedProcess:
    result = subprocess.run([str(a) for a in argv], capture_output=capture, text=True, env=env)
    if result.returncode != 0:
        detail = (result.stdout or "") + (result.stderr or "") if capture else ""
        raise BootstrapError(f"command failed ({result.returncode}): {' '.join(str(a) for a in argv)}\n{detail}".rstrip())
    return result


def check_interpreter() -> str:
    if sys.implementation.name != "cpython" or sys.version_info[:2] != (3, 12):
        raise BootstrapError(f"needs CPython 3.12 (the wheels are cp312); this is {sys.implementation.name} {platform.python_version()}")
    machine = platform.machine().lower()
    if IS_WINDOWS and machine in ("amd64", "x86_64"):
        return "win_amd64"
    if sys.platform == "linux" and machine in ("x86_64", "amd64"):
        return "linux_x86_64"
    raise BootstrapError(f"no pinned wheels for {sys.platform} {machine} (only win_amd64 and linux x86_64)")


def ensure_venv(target: Path) -> Path:
    python = target_python(target)
    if not python.is_file():
        print(f"creating the virtual environment {target}")
        venv.EnvBuilder(with_pip=True, symlinks=not IS_WINDOWS, clear=False).create(str(target))
    version = run([python, "-I", "-c", "import sys; print('%d.%d' % sys.version_info[:2])"], capture=True).stdout.strip()
    if version != "3.12":
        raise BootstrapError(f"{python} is Python {version}, not 3.12; delete {target} and run again")
    return python


def verify_installed(python: Path) -> dict:
    out = run([python, "-I", Path(__file__).resolve(), "_verify-installed", REQUIREMENTS], capture=True).stdout
    return json.loads(out.strip().splitlines()[-1])


def install_requirements(python: Path) -> dict:
    report = verify_installed(python)
    if report["unexpected"]:
        raise BootstrapError(f"the target holds distributions requirements.txt does not pin: {report['unexpected']}; delete it and run again")
    if report["missing"] or report["mismatched"] or report["tampered"]:
        print("installing requirements.txt (hash-checked wheels only)")
        argv = [python, "-I", "-m", "pip", "install", "--require-hashes", "--no-deps", "--only-binary=:all:", "--isolated",
                "--disable-pip-version-check", "--no-input", "--index-url", PYPI_INDEX, "-r", REQUIREMENTS]
        if report["tampered"]:
            argv.append("--force-reinstall")
        run(argv)
        report = verify_installed(python)
    problems = report["missing"] + report["mismatched"] + report["tampered"] + report["unexpected"]
    problems += [f"site-packages/{name} is in no distribution's RECORD" for name in report.get("unlisted", [])]
    if problems:
        raise BootstrapError("installed packages do not match requirements.txt: " + "; ".join(problems))
    run([python, "-I", "-m", "pip", "check", "--disable-pip-version-check"], capture=True)
    print(f"python packages verified: {len(report['installed'])} distributions, every RECORD hash checked")
    return report


def write_if_changed(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.is_file() or path.read_text(encoding="utf-8") != text:
        path.write_text(text, encoding="utf-8", newline="\n")


def base_interpreter_dlls(python: Path) -> dict:
    """SHA-256 of the DLLs CPython itself ships that also serve the MSYS2 libraries (hms_docrender/env.py)."""
    if not IS_WINDOWS:
        return {}
    base = Path(run([python, "-I", "-c", "import sys; print(sys.base_prefix)"], capture=True).stdout.strip()) / "DLLs"
    return {name: sha256_file(base / name) for name in BASE_INTERPRETER_DLLS if (base / name).is_file()}


def runtime_record(platform_tag: str, python: Path, report: dict) -> dict:
    record = {
        "schema": "hms-docrender-runtime/1",
        "bootstrap": BOOTSTRAP_VERSION,
        "platform": platform_tag,
        "python": {"implementation": "cpython", "version": platform.python_version()},
        "source": str(SATELLITE_DIR),
        "requirements_sha256": sha256_file(REQUIREMENTS),
        "packages": dict(sorted(report["installed"].items())),
        "fontconfig_sha256": sha256_bytes(FONTCONFIG_XML.encode("utf-8")),
    }
    if IS_WINDOWS:
        lock = json.loads(MSYS2_LOCK.read_text(encoding="utf-8"))
        record["msys2"] = {
            "lock_sha256": sha256_file(MSYS2_LOCK),
            "packages": {p["name"]: p["version"] for p in lock["packages"]},
            "dlls": {d["name"]: d["sha256"] for p in lock["packages"] for d in p["dlls"]},
        }
        record["base_interpreter_dlls"] = base_interpreter_dlls(python)
    return record


def bootstrap(target: Path) -> None:
    platform_tag = check_interpreter()
    target = target.resolve()
    print(f"document renderer runtime: {target} ({platform_tag})")
    python = ensure_venv(target)
    report = install_requirements(python)
    if IS_WINDOWS:
        print(f"MSYS2 UCRT64 runtime from {MSYS2_LOCK.name}")
        run([python, "-I", Path(__file__).resolve(), "_extract-msys2", target])
        print("MSYS2 DLLs verified")
    write_if_changed(target / "fontconfig" / "fonts.conf", FONTCONFIG_XML)
    purelib = run([python, "-I", "-c", "import sysconfig; print(sysconfig.get_path('purelib'))"], capture=True).stdout.strip()
    write_if_changed(Path(purelib) / PTH_NAME, str(SATELLITE_DIR) + "\n")
    record = runtime_record(platform_tag, python, report)
    runtime_json = target / "runtime.json"
    previous = json.loads(runtime_json.read_text(encoding="utf-8")) if runtime_json.is_file() else {}
    # Written without "native" first: hms_docrender refuses to render until the native versions are recorded.
    write_if_changed(runtime_json, json.dumps(record, indent=2, sort_keys=True) + "\n")
    env = {k: v for k, v in os.environ.items()
           if k.upper() in ("SYSTEMDRIVE", "SYSTEMROOT", "WINDIR", "PROGRAMDATA") or k.upper().startswith("HMS_DOCRENDER_")}
    env["PATH"] = os.environ.get("PATH", "") if not IS_WINDOWS else env.get("SYSTEMROOT", r"C:\Windows") + r"\System32"
    doctor = subprocess.run([str(python), "-I", "-m", "hms_docrender", "doctor"], capture_output=True, text=True, env=env)
    try:
        state = json.loads(doctor.stdout.strip().splitlines()[-1])
    except (IndexError, ValueError):
        state = {"status": "failed", "detail": (doctor.stdout + doctor.stderr).strip()[-2000:]}
    if doctor.returncode != 0 or state.get("status") != "ok":
        hint = "" if IS_WINDOWS else "\n" + DN067_HINT
        raise BootstrapError(f"the runtime does not load: {state.get('detail')}{hint}")
    record["native"] = state["native"]
    record["pdfium"] = state["python"]["pdfium"]
    if previous.get("native") and previous["native"] != record["native"]:
        print(f"note: the native libraries changed since the last bootstrap: {previous['native']} -> {record['native']}")
    write_if_changed(runtime_json, json.dumps(record, indent=2, sort_keys=True) + "\n")
    print("native libraries: " + ", ".join(f"{k} {v}" for k, v in sorted(record["native"].items())))
    fonts = state.get("fonts", {})
    print(f"print fonts: {fonts.get('status')}" + (f" ({fonts.get('detail')})" if fonts.get("detail") else ""))
    print(f"wrote {runtime_json}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Bootstrap the HMS document renderer runtime (standard library only).")
    parser.add_argument("--target", type=Path, default=DEFAULT_TARGET, help=f"runtime directory (default: {DEFAULT_TARGET})")
    args, rest = parser.parse_known_args(argv)
    try:
        if rest[:1] == ["_verify-installed"]:
            return helper_verify_installed(Path(rest[1]))
        if rest[:1] == ["_extract-msys2"]:
            return helper_extract_msys2(Path(rest[1]))
        if rest:
            parser.error(f"unrecognised arguments: {' '.join(rest)}")
        bootstrap(args.target)
        return 0
    except BootstrapError as exc:
        print(f"bootstrap failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
