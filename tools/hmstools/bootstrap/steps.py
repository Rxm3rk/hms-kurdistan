"""The bootstrap steps: JDK 25, the Gradle distribution, gitleaks, the project venv and the shell environment."""

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


# =========================================================================== JDK


def java_version(java: Path, env: Optional[dict[str, str]] = None) -> Optional[str]:
    """Return the version string that ``java -version`` reports, or None."""
    # -XX:-UsePerfData stops the JVM writing hsperfdata files into the system temporary directory.
    code, out = run_quiet([str(java), "-XX:-UsePerfData", "-version"], timeout=60, env=env)
    if code != 0:
        return None
    match = re.search(r'version "([^"]+)"', out)
    return match.group(1) if match else None


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


def project_jdks(root: Path) -> list[tuple[Path, str]]:
    """Every .tools/jdk-* directory with a working java, newest version first."""
    found = []
    for candidate in sorted(tools_dir(root).glob("jdk-*")):
        if not candidate.is_dir():
            continue
        home = java_home_of(candidate)
        if java_exe(home).is_file():
            version = java_version(java_exe(home))
            if version:
                found.append((home, version))

    def key(item: tuple[Path, str]) -> list[int]:
        return [int(part) for part in re.findall(r"\d+", item[1])]

    return sorted(found, key=key, reverse=True)


def find_project_jdk(root: Path) -> Optional[tuple[Path, str]]:
    for home, version in project_jdks(root):
        if java_major(version) == JDK_MAJOR:
            return home, version
    return None


@dataclass
class Asset:
    url: str
    name: str
    sha256: str
    vendor: str


def temurin_asset(os_name: str, arch: str) -> Asset:
    api_os = {"linux": "linux", "windows": "windows", "mac": "mac"}[os_name]
    url = (
        f"https://api.adoptium.net/v3/assets/latest/{JDK_MAJOR}/hotspot"
        f"?architecture={arch}&image_type=jdk&os={api_os}&vendor=eclipse"
    )
    data = json.loads(http_get(url).decode("utf-8"))
    if not data:
        raise BootstrapError(f"the Adoptium API returned no JDK {JDK_MAJOR} for {os_name}/{arch}")
    package = data[0]["binary"]["package"]
    return Asset(url=package["link"], name=package["name"], sha256=package["checksum"], vendor="Eclipse Temurin")


def corretto_asset(os_name: str, arch: str) -> Asset:
    corretto_os = {"linux": "linux", "windows": "windows", "mac": "macos"}[os_name]
    ext = "zip" if os_name == "windows" else "tar.gz"
    name = f"amazon-corretto-{JDK_MAJOR}-{arch}-{corretto_os}-jdk.{ext}"
    checksum = http_get(f"https://corretto.aws/downloads/latest_sha256/{name}").decode("ascii").strip().split()[0]
    # "latest" moves, so the cached file name carries the checksum prefix.
    return Asset(
        url=f"https://corretto.aws/downloads/latest/{name}",
        name=f"{checksum[:12]}-{name}",
        sha256=checksum,
        vendor="Amazon Corretto",
    )


def ensure_jdk(root: Path) -> Path:
    existing = find_project_jdk(root)
    if existing:
        home, version = existing
        log(f"JDK: reusing {home.relative_to(root).as_posix()} (java {version})")
        return home
    os_name, arch = host_os(), host_arch()
    try:
        asset = temurin_asset(os_name, arch)
    except (BootstrapError, KeyError, ValueError) as exc:
        log(f"JDK: the Eclipse Temurin assets API failed ({exc}); falling back to Amazon Corretto {JDK_MAJOR}")
        asset = corretto_asset(os_name, arch)
    log(f"JDK: fetching {asset.vendor} {asset.name}")
    archive = download(asset.url, tools_dir(root) / "downloads" / asset.name, asset.sha256)
    staging = tools_dir(root) / f".staging-jdk-{os.getpid()}"
    remove_tree(staging)
    try:
        extract_archive(archive, staging)
        top = single_top_dir(staging)
        target = tools_dir(root) / (top.name if top.name.startswith("jdk-") else f"jdk-{top.name}")
        if target.exists():
            log(f"JDK: {target.name} exists but is not a working JDK {JDK_MAJOR}; replacing it")
            remove_tree(target)
        os.replace(top, target)
    finally:
        remove_tree(staging)
    home = java_home_of(target)
    version = java_version(java_exe(home))
    if java_major(version) != JDK_MAJOR:
        raise BootstrapError(f"the JDK in {target} reports version {version!r}, expected {JDK_MAJOR}")
    log(f"JDK: installed {target.relative_to(root).as_posix()} (java {version})")
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


# =========================================================================== env


def to_posix(path: Path) -> str:
    """C:\\x\\y -> /c/x/y for MSYS shells (Git Bash); other paths unchanged."""
    text = str(path)
    match = re.match(r"^([A-Za-z]):[\\/](.*)$", text)
    if not match:
        return text
    return "/" + match.group(1).lower() + "/" + match.group(2).replace("\\", "/")


def toolchain_env(root: Path) -> dict[str, str]:
    """JAVA_HOME, GRADLE_USER_HOME and the PATH entries to prepend, as native absolute paths."""
    env = {"GRADLE_USER_HOME": str(tools_dir(root) / "gradle-home")}
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
        lines.append(f"echo 'tools/bootstrap env: no JDK {JDK_MAJOR} in .tools/; run sh tools/bootstrap jdk' >&2")
    lines.append(f"export GRADLE_USER_HOME={shell_quote(convert(tools_dir(root) / 'gradle-home'))}")
    lines.append(f"export PATH={shell_quote(':'.join(path_parts))}:\"$PATH\"")
    return "\n".join(lines) + "\n"
