"""The bootstrap steps: the pinned JDK 25 (one recorded Eclipse Temurin release), the Gradle distribution,
gitleaks, the project venv, the frontend packages and the shell environment."""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional
from urllib.parse import quote

from .core import (
    BootstrapError,
    base36,
    download,
    exe_name,
    extract_archive,
    host_arch,
    host_os,
    http_get,
    link_or_copy,
    log,
    private_env,
    remove_tree,
    run_quiet,
    sha256_file,
    single_top_dir,
    tools_dir,
)

JDK_MAJOR = 25

# JDK: one recorded Eclipse Temurin release, the one ADR-002 names, with the SHA-256 of each platform's
# archive recorded here; never "latest" and no other vendor as a fallback. The checksums are the ones the
# Adoptium API lists for exactly this release (api.adoptium.net/v3/assets/release_name/eclipse/<release>,
# image_type=jdk, vendor=eclipse), and each matched the release's own <archive>.sha256.txt when recorded on
# 2026-10-18. Re-resolve only at a phase boundary (BUILD-PROMPT §4.1): choose the newest Temurin 25 GA
# release, read every archive name and checksum from that API, check each against its .sha256.txt, and
# change the constants below and ADR-002's pinned set in the same commit.
JDK_RELEASE = "jdk-25.0.4.1+1"  # Adoptium release name; also the archive's top-level directory
JDK_VERSION = "25.0.4.1"  # java.version: 'java -version' prints: openjdk version "25.0.4.1"
JDK_RUNTIME_VERSION = "25.0.4.1+1-LTS"  # java.runtime.version: "(build 25.0.4.1+1-LTS)"
JDK_VENDOR_VERSION = "Temurin-25.0.4.1+1"  # java.vendor.version: "Runtime Environment Temurin-25.0.4.1+1"
JDK_DOWNLOAD_BASE = "https://github.com/adoptium/temurin25-binaries/releases/download/jdk-25.0.4.1%2B1"
JDK_ARCHIVES: dict[tuple[str, str], tuple[str, str]] = {
    # (os, arch): (archive name, SHA-256). Adoptium publishes no Windows aarch64 JDK for this release.
    ("linux", "x64"): (
        "OpenJDK25U-jdk_x64_linux_hotspot_25.0.4.1_1.tar.gz",
        "dbb698396d478e7fa2b1e50f4103324b2a99b90569ee27c33f2261f9215cf41e",
    ),
    ("windows", "x64"): (
        "OpenJDK25U-jdk_x64_windows_hotspot_25.0.4.1_1.zip",
        "00c847d804f4a78e9f04f2683faf14fed898535b177b7fc704486cb0284e9283",
    ),
    ("linux", "aarch64"): (
        "OpenJDK25U-jdk_aarch64_linux_hotspot_25.0.4.1_1.tar.gz",
        "69df11a02cfa3ef7d7ca645e03edce6778ec090e100f6ae2b42097865730ac52",
    ),
    ("mac", "x64"): (
        "OpenJDK25U-jdk_x64_mac_hotspot_25.0.4.1_1.tar.gz",
        "e6229d9504f7922053ab31821b9e6bee8761daf7b026a3476d1a027563009880",
    ),
    ("mac", "aarch64"): (
        "OpenJDK25U-jdk_aarch64_mac_hotspot_25.0.4.1_1.tar.gz",
        "61979887f7506a24a57439ff99adb8b3a7fc89977d9cfe3b8984f58a981b7b9d",
    ),
}

# Gradle: used when backend/gradle/wrapper/gradle-wrapper.properties does not exist yet.
GRADLE_DEFAULT_URL = "https://services.gradle.org/distributions/gradle-9.8.1-bin.zip"
GRADLE_DEFAULT_SHA256 = "dce76f55f8e251a3a1f130eb120f30b3d271de2b76c9b0729d316b5a1b6dc01f"
WRAPPER_PROPERTIES = Path("backend/gradle/wrapper/gradle-wrapper.properties")

# gitleaks: pinned to the latest stable 8.x release when WP-0.1 was built (resolved 18 Oct 2026 from the
# official GitHub releases). "--gitleaks-version latest" re-resolves it.
GITLEAKS_DEFAULT_VERSION = "8.30.1"
GITLEAKS_RELEASES = "https://github.com/gitleaks/gitleaks/releases/download"
GITLEAKS_API = "https://api.github.com/repos/gitleaks/gitleaks/releases?per_page=100"

REQUIREMENTS_IN = Path("tools/requirements.in")
REQUIREMENTS_TXT = Path("tools/requirements.txt")
VENV = Path(".tools/venv")

# Corepack keeps the pnpm it downloads here (COREPACK_HOME), inside .tools/ like the Gradle home.
COREPACK_HOME = "corepack"


# =========================================================================== JDK


@dataclass(frozen=True)
class JavaIdentity:
    """What ``java -version`` says about a JDK: java.version, java.runtime.version, java.vendor.version."""

    version: str
    runtime_version: Optional[str] = None
    vendor_version: Optional[str] = None

    def describe(self) -> str:
        vendor = f", {self.vendor_version}" if self.vendor_version else ""
        build = f"build {self.runtime_version}" if self.runtime_version else "no build string"
        return f'java "{self.version}"{vendor} ({build})'


PINNED_JDK = JavaIdentity(JDK_VERSION, JDK_RUNTIME_VERSION, JDK_VENDOR_VERSION)


def parse_java_version(output: str) -> Optional[JavaIdentity]:
    """Parse ``java -version`` output, for example:

        openjdk version "25.0.4.1" 2026-08-18 LTS
        OpenJDK Runtime Environment Temurin-25.0.4.1+1 (build 25.0.4.1+1-LTS)
    """
    version = re.search(r'version "([^"]+)"', output)
    if not version:
        return None
    runtime = re.search(r"Runtime Environment(?: (\S+))? \(build ([^)\s]+)\)", output)
    return JavaIdentity(
        version=version.group(1),
        runtime_version=runtime.group(2) if runtime else None,
        vendor_version=runtime.group(1) if runtime else None,
    )


def java_identity(java: Path, env: Optional[dict[str, str]] = None) -> Optional[JavaIdentity]:
    """Run ``java -version`` and parse it; None if it does not run or prints no version."""
    # -XX:-UsePerfData stops the JVM writing hsperfdata files into the system temporary directory.
    code, out = run_quiet([str(java), "-XX:-UsePerfData", "-version"], timeout=60, env=env)
    return parse_java_version(out) if code == 0 else None


def is_pinned_jdk(identity: Optional[JavaIdentity]) -> bool:
    """True only for exactly the recorded release: version, build and vendor version all match."""
    return identity == PINNED_JDK


def java_major(version: Optional[str]) -> Optional[int]:
    if not version:
        return None
    match = re.match(r"(\d+)(?:\.(\d+))?", version)
    if not match:
        return None
    first = int(match.group(1))
    if first == 1 and match.group(2):  # 1.8 style
        return int(match.group(2))
    return first


def java_home_of(directory: Path) -> Path:
    mac_home = directory / "Contents" / "Home"
    return mac_home if mac_home.is_dir() else directory


def java_exe(home: Path) -> Path:
    return home / "bin" / exe_name("java")


def project_jdks(root: Path) -> list[tuple[Path, JavaIdentity]]:
    """Every .tools/jdk-* directory with a java that runs and reports a version, the pinned release's own
    directory (.tools/jdk-25.0.4.1+1) first, the rest by name."""
    found = []
    candidates = sorted(tools_dir(root).glob("jdk-*"), key=lambda p: (p.name != JDK_RELEASE, p.name))
    for candidate in candidates:
        if not candidate.is_dir():
            continue
        home = java_home_of(candidate)
        if java_exe(home).is_file():
            identity = java_identity(java_exe(home))
            if identity:
                found.append((home, identity))
    return found


def find_project_jdk(root: Path) -> Optional[tuple[Path, JavaIdentity]]:
    """The project-local JDK that reports exactly the pinned release, or None. Any other .tools/jdk-*
    (another patch level, another vendor) is never used."""
    for home, identity in project_jdks(root):
        if is_pinned_jdk(identity):
            return home, identity
    return None


@dataclass
class Asset:
    url: str
    name: str
    sha256: str
    vendor: str


def pinned_jdk_asset(os_name: str, arch: str) -> Asset:
    """The pinned Temurin archive for this platform, with its recorded SHA-256 (no network access)."""
    entry = JDK_ARCHIVES.get((os_name, arch))
    if entry is None:
        supported = ", ".join(f"{o}/{a}" for o, a in sorted(JDK_ARCHIVES))
        raise BootstrapError(
            f"no pinned {JDK_RELEASE} archive is recorded for {os_name}/{arch} (recorded: {supported}); "
            "adding a platform means recording its official checksum in tools/hmstools/bootstrap/steps.py"
        )
    name, sha256 = entry
    return Asset(url=f"{JDK_DOWNLOAD_BASE}/{name}", name=name, sha256=sha256, vendor="Eclipse Temurin")


def ensure_jdk(root: Path) -> Path:
    """The pinned Temurin release in .tools/jdk-25.0.4.1+1: reused if it reports exactly that release,
    otherwise fetched and checked against the recorded SHA-256. There is no fallback to another release
    or vendor: if the download fails, the step fails."""
    found = project_jdks(root)
    for home, identity in found:
        if is_pinned_jdk(identity):
            log(f"JDK: reusing {home.relative_to(root).as_posix()} ({identity.describe()}, the pinned release)")
            return home
    for home, identity in found:
        major = java_major(identity.version)
        log(
            f"JDK: not using {home.relative_to(root).as_posix()}: it reports {identity.describe()} "
            f"(JDK {major if major is not None else '?'}), not the pinned {PINNED_JDK.describe()}"
        )
    asset = pinned_jdk_asset(host_os(), host_arch())
    cached = tools_dir(root) / "downloads" / asset.name
    log(f"JDK: fetching the pinned {asset.vendor} {JDK_RELEASE}: {asset.name} (recorded sha256 {asset.sha256})")
    try:
        archive = download(asset.url, cached, asset.sha256)
    except BootstrapError as exc:
        raise BootstrapError(
            f"{exc}. No other JDK is fetched instead: the pin is the one ADR-002 records. Run "
            f"'sh tools/bootstrap jdk' again to resume, or place the official {asset.name} ({asset.url}) at "
            f"{cached.relative_to(root).as_posix()}; it is checked against the recorded SHA-256 before use"
        ) from exc
    staging = tools_dir(root) / f".staging-jdk-{os.getpid()}"
    target = tools_dir(root) / JDK_RELEASE
    remove_tree(staging)
    try:
        extract_archive(archive, staging)
        top = single_top_dir(staging)
        if top.name != JDK_RELEASE:
            raise BootstrapError(f"{asset.name} unpacks to {top.name!r}, not {JDK_RELEASE!r}")
        if target.exists():
            log(f"JDK: {target.name} exists but does not report the pinned release; replacing it")
            remove_tree(target)
        os.replace(top, target)
    finally:
        remove_tree(staging)
    home = java_home_of(target)
    identity = java_identity(java_exe(home))
    if not is_pinned_jdk(identity):
        found_text = identity.describe() if identity else "nothing (java does not run)"
        raise BootstrapError(f"the JDK in {target} reports {found_text}, expected {PINNED_JDK.describe()}")
    log(f"JDK: installed {target.relative_to(root).as_posix()} ({identity.describe()})")
    return home


# =========================================================================== Gradle


def read_properties(path: Path) -> dict[str, str]:
    """Parse a Java .properties file (the subset Gradle wrapper files use)."""
    values: dict[str, str] = {}
    with open(path, encoding="utf-8") as handle:
        for raw in handle:
            line = raw.strip()
            if not line or line[0] in "#!":
                continue
            match = re.match(r"((?:\\.|[^=:\s])+)\s*[=:\s]\s*(.*)$", line)
            if not match:
                continue
            key, value = (re.sub(r"\\(.)", r"\1", part) for part in match.groups())
            values[key] = value
    return values


def gradle_dist_hash(url: str) -> str:
    """The wrapper's directory name for a distribution URL: base-36 of the MD5 of the URL (PathAssembler)."""
    return base36(int.from_bytes(hashlib.md5(url.encode("utf-8")).digest(), "big"))


@dataclass
class GradleDist:
    url: str
    sha256: str
    zip_name: str
    dist_name: str
    zip_path: Path
    source: str


def gradle_dist(root: Path) -> GradleDist:
    props_file = root / WRAPPER_PROPERTIES
    if props_file.is_file():
        props = read_properties(props_file)
        url = props.get("distributionUrl")
        if not url:
            raise BootstrapError(f"{WRAPPER_PROPERTIES} has no distributionUrl")
        sha = props.get("distributionSha256Sum", "").strip()
        if not sha:
            # The checksum always comes from the official host, never from a mirror.
            sha = http_get(url + ".sha256").decode("ascii").strip().split()[0]
            log(f"Gradle: {WRAPPER_PROPERTIES} has no distributionSha256Sum; using the official {url}.sha256")
        if props.get("zipStoreBase", "GRADLE_USER_HOME") != "GRADLE_USER_HOME":
            raise BootstrapError("zipStoreBase other than GRADLE_USER_HOME is not supported by tools/bootstrap")
        zip_store = props.get("zipStorePath", "wrapper/dists")
        source = WRAPPER_PROPERTIES.as_posix()
    else:
        url, sha, zip_store = GRADLE_DEFAULT_URL, GRADLE_DEFAULT_SHA256, "wrapper/dists"
        source = "built-in default (no gradle-wrapper.properties yet)"
    zip_name = url.rsplit("/", 1)[-1]
    dist_name = zip_name[:-4] if zip_name.endswith(".zip") else zip_name
    zip_path = tools_dir(root) / "gradle-home" / zip_store / dist_name / gradle_dist_hash(url) / zip_name
    return GradleDist(url=url, sha256=sha.lower(), zip_name=zip_name, dist_name=dist_name, zip_path=zip_path, source=source)


def mirror_url(mirror: str, zip_name: str) -> str:
    return mirror if mirror.endswith(".zip") else mirror.rstrip("/") + "/" + zip_name


def ensure_gradle(root: Path, mirror: Optional[str] = None) -> Path:
    dist = gradle_dist(root)
    log(f"Gradle: {dist.zip_name} from {dist.source}")
    if dist.zip_path.is_file() and sha256_file(dist.zip_path) == dist.sha256:
        log(f"Gradle: reusing verified {dist.zip_path.relative_to(root).as_posix()}")
        return dist.zip_path
    cached = tools_dir(root) / "downloads" / dist.zip_name
    source_url = mirror_url(mirror, dist.zip_name) if mirror else dist.url
    if mirror:
        log(f"Gradle: fetching from the mirror {source_url}; verifying against the official checksum {dist.sha256}")
    download(source_url, cached, dist.sha256)
    link_or_copy(cached, dist.zip_path)
    if sha256_file(dist.zip_path) != dist.sha256:
        dist.zip_path.unlink()
        raise BootstrapError(f"{dist.zip_path} does not match {dist.sha256} after copying")
    log(f"Gradle: placed {dist.zip_path.relative_to(root).as_posix()}; the wrapper unpacks it on first use")
    return dist.zip_path


# =========================================================================== gitleaks


def gitleaks_asset_name(version: str, os_name: str, arch: str) -> str:
    gl_os = {"linux": "linux", "windows": "windows", "mac": "darwin"}[os_name]
    gl_arch = {"x64": "x64", "aarch64": "arm64"}[arch]
    ext = "zip" if os_name == "windows" else "tar.gz"
    return f"gitleaks_{version}_{gl_os}_{gl_arch}.{ext}"


def parse_checksums(text: str) -> dict[str, str]:
    sums = {}
    for line in text.splitlines():
        parts = line.split()
        if len(parts) == 2 and len(parts[0]) == 64:
            sums[parts[1].lstrip("*")] = parts[0].lower()
    return sums


def latest_gitleaks_8() -> str:
    releases = json.loads(http_get(GITLEAKS_API, headers={"Accept": "application/vnd.github+json"}).decode("utf-8"))
    versions = []
    for release in releases:
        tag = release.get("tag_name", "")
        match = re.fullmatch(r"v(8)\.(\d+)\.(\d+)", tag)
        if match and not release.get("draft") and not release.get("prerelease"):
            versions.append(tuple(int(x) for x in match.groups()))
    if not versions:
        raise BootstrapError("no stable gitleaks 8.x release found")
    return ".".join(str(x) for x in max(versions))


def gitleaks_exe(root: Path) -> Path:
    return tools_dir(root) / "bin" / exe_name("gitleaks")


def gitleaks_version(exe: Path) -> Optional[str]:
    code, out = run_quiet([str(exe), "version"], timeout=30)
    if code != 0:
        return None
    match = re.search(r"(\d+\.\d+\.\d+)", out)
    return match.group(1) if match else None


def ensure_gitleaks(root: Path, version: str = GITLEAKS_DEFAULT_VERSION) -> Path:
    if version == "latest":
        version = latest_gitleaks_8()
        log(f"gitleaks: latest stable 8.x is {version}")
    if not re.fullmatch(r"8\.\d+\.\d+", version):
        raise BootstrapError(f"gitleaks version must be 8.x.y or 'latest', not {version!r}")
    exe = gitleaks_exe(root)
    if exe.is_file() and gitleaks_version(exe) == version:
        log(f"gitleaks: reusing {exe.relative_to(root).as_posix()} ({version})")
        return exe
    asset = gitleaks_asset_name(version, host_os(), host_arch())
    folder = tools_dir(root) / "downloads" / f"gitleaks-{version}"
    folder.mkdir(parents=True, exist_ok=True)
    sums_name = f"gitleaks_{version}_checksums.txt"
    sums_file = folder / sums_name
    sums = parse_checksums(sums_file.read_text(encoding="utf-8")) if sums_file.is_file() else {}
    if asset not in sums:
        text = http_get(f"{GITLEAKS_RELEASES}/v{version}/{sums_name}").decode("utf-8")
        sums = parse_checksums(text)
        sums_file.write_text(text, encoding="utf-8", newline="\n")
    if asset not in sums:
        raise BootstrapError(f"{sums_name} lists no checksum for {asset}")
    archive = download(f"{GITLEAKS_RELEASES}/v{version}/{asset}", folder / asset, sums[asset])
    staging = tools_dir(root) / f".staging-gitleaks-{os.getpid()}"
    remove_tree(staging)
    try:
        extract_archive(archive, staging)
        binary = staging / exe_name("gitleaks")
        if not binary.is_file():
            raise BootstrapError(f"{asset} does not contain {binary.name}")
        exe.parent.mkdir(parents=True, exist_ok=True)
        os.replace(binary, exe)
        os.chmod(exe, 0o755)
    finally:
        remove_tree(staging)
    found = gitleaks_version(exe)
    if found != version:
        raise BootstrapError(f"{exe} reports version {found!r}, expected {version}")
    log(f"gitleaks: installed {exe.relative_to(root).as_posix()} ({version}, {asset} sha256 {sums[asset]})")
    return exe


# =========================================================================== venv


def normalise(name: str) -> str:
    return re.sub(r"[-_.]+", "-", name).lower()


def parse_pins_text(text: str) -> dict[str, str]:
    """Return {normalised name: version} for every ``name==version`` line of requirements text."""
    pins: dict[str, str] = {}
    for raw in text.splitlines():
        line = raw.split("#", 1)[0].strip()
        match = re.match(r"([A-Za-z0-9][A-Za-z0-9._-]*)==([^\s;\\]+)", line)
        if match:
            pins[normalise(match.group(1))] = match.group(2)
    return pins


def parse_pins(path: Path) -> dict[str, str]:
    """Return {normalised name: version} for every ``name==version`` line of a requirements file."""
    with open(path, encoding="utf-8") as handle:
        return parse_pins_text(handle.read())


def venv_python(root: Path) -> Path:
    venv = root / VENV
    windows = venv / "Scripts" / "python.exe"
    posix = venv / "bin" / "python"
    if host_os() == "windows":
        return windows if windows.exists() or not posix.exists() else posix
    return posix


_PROBE = (
    "import json, sys, importlib.metadata as m\n"
    "out = {'python': '%d.%d.%d' % sys.version_info[:3], 'packages': {}}\n"
    "for d in m.distributions():\n"
    "    out['packages'][d.metadata['Name']] = d.version\n"
    "print(json.dumps(out))\n"
)


def venv_state(python: Path) -> Optional[dict]:
    code, out = run_quiet([str(python), "-I", "-c", _PROBE], timeout=60)
    if code != 0:
        return None
    try:
        data = json.loads(out.strip().splitlines()[-1])
    except (ValueError, IndexError):
        return None
    data["packages"] = {normalise(k): v for k, v in data["packages"].items()}
    return data


def venv_mismatches(state: Optional[dict], pins: dict[str, str]) -> list[str]:
    if state is None:
        return ["the venv Python does not run"]
    problems = []
    if not state["python"].startswith("3.12."):
        problems.append(f"Python {state['python']} (need 3.12)")
    for name, version in sorted(pins.items()):
        have = state["packages"].get(name)
        if have != version:
            problems.append(f"{name} {have or 'missing'} (need {version})")
    return problems


def find_python312() -> list[str]:
    if sys.version_info[:2] == (3, 12):
        base = getattr(sys, "_base_executable", None) or sys.executable
        return [base]
    candidates = [["python3.12"], ["python3"], ["python"]]
    if host_os() == "windows":
        candidates.insert(0, ["py", "-3.12"])
    for argv in candidates:
        if not shutil.which(argv[0]):
            continue
        code, out = run_quiet(argv + ["-c", "import sys; print('%d.%d' % sys.version_info[:2])"], timeout=30)
        if code == 0 and out.strip().endswith("3.12"):
            return argv
    raise BootstrapError(
        "Python 3.12 not found; install it (Ubuntu 24.04: sudo apt-get install -y python3 python3-venv)"
    )


def ensure_venv(root: Path) -> Path:
    requirements = root / REQUIREMENTS_TXT
    pins = parse_pins(requirements)
    if not pins:
        raise BootstrapError(f"{REQUIREMENTS_TXT} has no pinned requirements")
    python = venv_python(root)
    if python.exists():
        problems = venv_mismatches(venv_state(python), pins)
        if not problems:
            log(f"venv: reusing {VENV.as_posix()} (matches {REQUIREMENTS_TXT.as_posix()})")
            return python
        log(f"venv: {VENV.as_posix()} does not match {REQUIREMENTS_TXT} ({'; '.join(problems)}); rebuilding it")
    base = find_python312()
    env = private_env(root)
    code = subprocess.run([*base, "-m", "venv", "--clear", str(root / VENV)], env=env, check=False).returncode
    if code != 0:
        raise BootstrapError(f"python -m venv failed with exit code {code}")
    python = venv_python(root)
    install = [
        str(python), "-I", "-m", "pip", "install", "--no-input", "--disable-pip-version-check",
        "--require-hashes", "-r", str(requirements),
    ]
    code = subprocess.run(install, env=env, check=False).returncode
    if code != 0:
        raise BootstrapError(f"pip install --require-hashes failed with exit code {code}")
    problems = venv_mismatches(venv_state(python), pins)
    if problems:
        raise BootstrapError(f"the new venv still does not match {REQUIREMENTS_TXT}: {'; '.join(problems)}")
    log(f"venv: created {VENV.as_posix()} from {REQUIREMENTS_TXT} (hash-checked)")
    return python


# =========================================================================== requirements lock

WANTED_WHEEL = re.compile(
    r"-(?:py3|py2\.py3)-none-any\.whl$"
    r"|-cp312-(?:cp312|abi3)-win_amd64\.whl$"
    r"|-cp312-(?:cp312|abi3)-manylinux[^-]*x86_64[^-]*\.whl$"
)


def select_files(urls: list[dict]) -> list[dict]:
    """The sdist plus the wheels for CPython 3.12 on Windows x64 and Linux x86_64 (and pure-Python wheels)."""
    chosen = []
    for entry in urls:
        name = entry["filename"]
        if entry.get("yanked"):
            continue
        if entry["packagetype"] == "sdist" or (entry["packagetype"] == "bdist_wheel" and WANTED_WHEEL.search(name)):
            chosen.append(entry)
    return sorted(chosen, key=lambda e: e["filename"])


def lock_requirements(root: Path) -> Path:
    source = root / REQUIREMENTS_IN
    lines_in = source.read_text(encoding="utf-8").splitlines()
    out = [
        "# Generated by 'sh tools/bootstrap requirements-lock' from tools/requirements.in and the PyPI JSON API.",
        "# Do not edit by hand. Install with: python -m pip install --require-hashes -r tools/requirements.txt",
        "# Hashes cover the sdist and the wheels for CPython 3.12 on Windows x64 and Linux x86_64.",
        "",
    ]
    for raw in lines_in:
        line = raw.split("#", 1)[0].strip()
        match = re.match(r"([A-Za-z0-9][A-Za-z0-9._-]*)==(\S+)$", line)
        if not match:
            continue
        name, version = match.groups()
        meta = json.loads(http_get(f"https://pypi.org/pypi/{quote(name)}/{quote(version)}/json").decode("utf-8"))
        files = select_files(meta["urls"])
        if not files:
            raise BootstrapError(f"PyPI lists no usable files for {name}=={version}")
        comment = raw.split("#", 1)[1].strip() if "#" in raw else ""
        if comment:
            out.append(f"# {comment}")
        out.append(f"{name}=={version} \\")
        hashes = [f"    --hash=sha256:{entry['digests']['sha256']}" for entry in files]
        out.append(" \\\n".join(hashes))
    target = root / REQUIREMENTS_TXT
    with open(target, "w", encoding="utf-8", newline="\n") as handle:
        handle.write("\n".join(out) + "\n")
    log(f"wrote {REQUIREMENTS_TXT.as_posix()}")
    return target


# =========================================================================== frontend


def ensure_frontend(root: Path) -> Path:
    """frontend/node_modules exactly as frontend/pnpm-lock.yaml pins it.

    Runs 'corepack pnpm install --frozen-lockfile' in frontend/. Corepack fetches the pnpm version that
    frontend/package.json pins and checks it against the packageManager hash; pnpm checks every package
    against the sha512 integrity in the lockfile and fails if the lockfile does not match package.json.
    Corepack's cache (COREPACK_HOME) and the pnpm store (storeDir in frontend/pnpm-workspace.yaml) are
    under .tools/, so nothing is written outside the repository. 'corepack enable' is never run.
    """
    frontend = root / "frontend"
    if not (frontend / "package.json").is_file():
        log("frontend: no frontend/package.json; nothing to install")
        return frontend
    corepack = shutil.which("corepack")
    if not corepack:
        raise BootstrapError("corepack is not on PATH; it ships with Node.js 24 LTS (see tools/doctor)")
    env = apply_toolchain_env(root, private_env(root))
    env["COREPACK_ENABLE_DOWNLOAD_PROMPT"] = "0"
    log("frontend: corepack pnpm install --frozen-lockfile (in frontend/)")
    try:
        proc = subprocess.run(
            [corepack, "pnpm", "install", "--frozen-lockfile"],
            cwd=frontend,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=1800,
            check=False,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise BootstrapError(f"corepack pnpm install could not run: {exc}") from exc
    output = proc.stdout.decode("utf-8", errors="replace").strip().splitlines()
    if proc.returncode != 0:
        tail = " | ".join(output[-8:])
        raise BootstrapError(f"corepack pnpm install --frozen-lockfile failed (exit {proc.returncode}): {tail}")
    if output:
        log(f"frontend: {output[-1]}")
    return frontend / "node_modules"


# =========================================================================== env


def to_posix(path: Path) -> str:
    """C:\\x\\y -> /c/x/y for MSYS shells (Git Bash); other paths unchanged."""
    text = str(path)
    match = re.match(r"^([A-Za-z]):[\\/](.*)$", text)
    if not match:
        return text
    return "/" + match.group(1).lower() + "/" + match.group(2).replace("\\", "/")


def toolchain_env(root: Path) -> dict[str, str]:
    """JAVA_HOME, GRADLE_USER_HOME, COREPACK_HOME and the PATH entries to prepend, as native absolute paths."""
    env = {
        "GRADLE_USER_HOME": str(tools_dir(root) / "gradle-home"),
        "COREPACK_HOME": str(tools_dir(root) / COREPACK_HOME),
    }
    jdk = find_project_jdk(root)
    if jdk:
        env["JAVA_HOME"] = str(jdk[0])
    path = [str(tools_dir(root) / "bin")]
    if jdk:
        path.append(str(jdk[0] / "bin"))
    env["PATH_PREPEND"] = os.pathsep.join(path)
    return env


def apply_toolchain_env(root: Path, base: Optional[dict[str, str]] = None) -> dict[str, str]:
    """A copy of ``base`` (default os.environ) with the project toolchain in front."""
    env = dict(os.environ if base is None else base)
    tool = toolchain_env(root)
    prepend = tool.pop("PATH_PREPEND")
    env.update(tool)
    env["PATH"] = prepend + os.pathsep + env.get("PATH", "")
    return env


def shell_quote(text: str) -> str:
    return "'" + text.replace("'", "'\"'\"'") + "'"


def env_script(root: Path, msys: Optional[bool] = None) -> str:
    """Shell lines for ``eval "$(sh tools/bootstrap env)"``."""
    if msys is None:
        msys = bool(os.environ.get("MSYSTEM")) or host_os() == "windows"
    convert = to_posix if msys else str
    jdk = find_project_jdk(root)
    lines = []
    path_parts = [convert(tools_dir(root) / "bin")]
    if jdk:
        lines.append(f"export JAVA_HOME={shell_quote(convert(jdk[0]))}")
        path_parts.append(convert(jdk[0] / "bin"))
    else:
        lines.append(
            f"echo 'tools/bootstrap env: no JDK {JDK_MAJOR} of the pinned release ({JDK_VENDOR_VERSION}) in .tools/; "
            "run sh tools/bootstrap jdk' >&2"
        )
    lines.append(f"export GRADLE_USER_HOME={shell_quote(convert(tools_dir(root) / 'gradle-home'))}")
    lines.append(f"export COREPACK_HOME={shell_quote(convert(tools_dir(root) / COREPACK_HOME))}")
    lines.append(f"export PATH={shell_quote(':'.join(path_parts))}:\"$PATH\"")
    return "\n".join(lines) + "\n"
