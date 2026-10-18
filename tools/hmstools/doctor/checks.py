"""The prerequisite checks of tools/doctor (BUILD-PROMPT.md "Before the first session", §5.1, WP-0.1)."""

from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from ..bootstrap.steps import JDK_RELEASE, PINNED_JDK, is_pinned_jdk, normalise, parse_java_version, parse_pins_text
from .fixes import UBUNTU, windows_steps
from .host import Host

# --------------------------------------------------------------------------- thresholds [P]
# RAM is compared with the total memory the Linux environment sees. A machine or VM with a nominal
# 32 GB reports a little less (firmware and kernel reservations), hence the measured floors.
DEV_CELL_RAM_GIB = 30.0  # [P] the dev cell needs 32 GB nominal (BUILD-PROMPT.md "Resources")
LITE_CELL_RAM_GIB = 15.0  # [P] the lite cell needs 16 GB nominal; revisit when WP-0.2 measures it
DEV_CELL_CORES = 8  # BUILD-PROMPT.md "Resources"
LITE_CELL_CORES = 4  # [P]
DISK_FREE_GIB = 50.0  # [P] images for the cell, Gradle, pnpm and Corepack caches, k3d volumes, build output
WINDOWS_RESERVE_GIB = 4.0  # [P] memory left to Windows when sizing the WSL2 VM
# WSL2 keeps each distribution's virtual disk on a Windows drive: C: unless it was moved [P]. Space inside the
# virtual disk is only real while that drive has it, so on WSL2 the disk check also counts this drive.
WSL_WINDOWS_DRIVE = Path("/mnt/c")

FAST_TIER_ITEMS = ("jdk", "node", "pnpm", "venv", "gitleaks")


@dataclass
class Item:
    id: str
    name: str
    ok: bool
    found: str
    need: str
    required: bool = True
    fix_key: Optional[str] = None
    note: str = ""

    @property
    def status(self) -> str:
        if self.ok:
            return "OK"
        return "MISSING" if self.required else "WARN"

    def to_dict(self, windows_host: bool) -> dict:
        fix = {"ubuntu": UBUNTU.get(self.fix_key or self.id, [])} if not self.ok else {}
        if not self.ok and windows_host:
            fix["windows"] = ["see the Windows host steps (WSL2) printed at the end"]
        return {
            "id": self.id,
            "name": self.name,
            "status": self.status,
            "required": self.required,
            "found": self.found,
            "need": self.need,
            "note": self.note,
            "fix": fix,
        }


@dataclass
class Report:
    tier: str
    items: list[Item] = field(default_factory=list)
    profile: Optional[str] = None
    host: dict = field(default_factory=dict)
    windows_host: bool = False
    windows_steps: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return all(item.ok or not item.required for item in self.items)


# --------------------------------------------------------------------------- helpers


def first_line(text: str) -> str:
    return text.strip().splitlines()[0].strip() if text.strip() else ""


def version_tuple(text: str) -> Optional[tuple[int, ...]]:
    match = re.search(r"(\d+)\.(\d+)(?:\.(\d+))?", text)
    if not match:
        return None
    return tuple(int(x) for x in match.groups() if x is not None)


def is_windows(host: Host) -> bool:
    return host.system().lower().startswith(("windows", "msys", "mingw", "cygwin"))


def is_wsl2(host: Host) -> bool:
    proc_version = (host.read_text("/proc/version") or "").lower()
    return host.system() == "Linux" and "microsoft" in proc_version and (
        "wsl2" in proc_version or "microsoft-standard" in proc_version
    )


def exe(host: Host, name: str) -> str:
    return name + ".exe" if is_windows(host) else name


def to_mnt_path(path: Path) -> str:
    """C:\\Users\\x -> /mnt/c/Users/x (how WSL2 sees a Windows path)."""
    text = str(path)
    match = re.match(r"^([A-Za-z]):[\\/](.*)$", text)
    if match:
        return "/mnt/" + match.group(1).lower() + "/" + match.group(2).replace("\\", "/")
    match = re.match(r"^/([a-zA-Z])/(.*)$", text)  # Git Bash form /c/Users/x
    if match:
        return "/mnt/" + match.group(1).lower() + "/" + match.group(2)
    return text


# --------------------------------------------------------------------------- individual checks


def check_os(host: Host) -> Item:
    need = "Linux (Ubuntu 24.04 in WSL2 or native); repository not under /mnt/<drive>"
    system = host.system()
    if system != "Linux":
        label = f"{system} {host.release()} ({host.version()})"
        if host.env("MSYSTEM"):
            label += f", {host.env('MSYSTEM')} shell (Git Bash)"
        return Item("os", "Operating system", False, label, need)
    wsl2 = is_wsl2(host)
    os_release = host.read_text("/etc/os-release") or ""
    pretty = re.search(r'^PRETTY_NAME="?([^"\n]+)"?', os_release, re.M)
    distro = pretty.group(1) if pretty else "Linux"
    label = f"{distro}, kernel {host.release()}" + (" (WSL2)" if wsl2 else "")
    root = host.root.as_posix()
    if re.match(r"^/mnt/[a-zA-Z](/|$)", root):
        return Item(
            "os", "Operating system", False, label + f"; repository at {root}", need,
            note="The repository is on the Windows file system; clone it into the Linux file system.",
        )
    note = "" if "Ubuntu 24.04" in distro else "Ubuntu 24.04 is the reference distribution; others may work."
    return Item("os", "Operating system", True, label, need, note=note)


def check_container(host: Host) -> list[Item]:
    engines = [name for name in ("docker", "podman") if host.which(name)]
    need = "docker or podman, with its daemon or service reachable"
    if not engines:
        return [
            Item("container-engine", "Container engine", False, "neither docker nor podman on PATH", need),
            Item(
                "container-daemon", "Container engine reachable", False, "no engine", "the engine answers 'info'",
                fix_key="container-daemon",
            ),
        ]
    engine = engines[0]
    code, version = host.run([engine, "--version"], timeout=20)
    engine_item = Item("container-engine", "Container engine", code == 0, first_line(version) or engine, need)
    fmt = "{{.ServerVersion}}" if engine == "docker" else "{{.Version.Version}}"
    code, info = host.run([engine, "info", "--format", fmt], timeout=30)
    reachable = code == 0 and bool(info.strip()) and "error" not in info.lower()
    daemon = Item(
        "container-daemon", "Container engine reachable", reachable,
        f"{engine} server {first_line(info)}" if reachable else f"{engine} info failed: {first_line(info)[:120]}",
        "the engine answers 'info'",
    )
    return [engine_item, daemon]


def check_simple(host: Host, item_id: str, name: str, argv: list[str], need: str) -> Item:
    if not host.which(argv[0]):
        return Item(item_id, name, False, f"{argv[0]} not on PATH", need)
    code, out = host.run(argv, timeout=30)
    return Item(item_id, name, code == 0, first_line(out)[:120] or f"exit code {code}", need)


def java_candidates(host: Host) -> list[tuple[str, Path]]:
    found: list[tuple[str, Path]] = []
    java_home = host.env("JAVA_HOME")
    if java_home:
        found.append(("JAVA_HOME", Path(java_home) / "bin" / exe(host, "java")))
    on_path = host.which("java")
    if on_path:
        found.append(("PATH", Path(on_path)))
    for directory in host.glob(host.root / ".tools", "jdk-*"):
        home = directory / "Contents" / "Home" if host.exists(directory / "Contents" / "Home") else directory
        found.append((f".tools/{directory.name}", home / "bin" / exe(host, "java")))
    return found


def check_jdk(host: Host) -> Item:
    """The pinned JDK (ADR-002, tools/hmstools/bootstrap/steps.py), not any JDK 25. tools/ci/run and
    'tools/bootstrap env' put a .tools/jdk-* that reports the pinned release first; without one the build
    runs on JAVA_HOME, or on java from PATH when JAVA_HOME is unset, so that JDK must report the pin."""
    need = (
        f"the pinned JDK, {PINNED_JDK.describe()} (ADR-002): .tools/{JDK_RELEASE} from 'sh tools/bootstrap jdk', "
        "or a JAVA_HOME or PATH java that reports exactly that release"
    )
    seen = []
    project = None  # a .tools/jdk-* that reports the pin
    system = None  # the first of JAVA_HOME and PATH: what the build uses without a pinned .tools/jdk-*
    for label, java in java_candidates(host):
        local = label.startswith(".tools/")
        if not host.exists(java):
            if label == "JAVA_HOME":  # set, but holds no java: the build would fail on it
                seen.append("JAVA_HOME: no java")
                system = system or seen[-1]
            continue
        code, out = host.run([str(java), "-XX:-UsePerfData", "-version"], timeout=60)
        identity = parse_java_version(out) if code == 0 else None
        if identity is None:
            seen.append(f"{label}: unusable")
        elif is_pinned_jdk(identity):
            seen.append(f"{label}: {identity.describe()}, the pinned release")
            project = project or (seen[-1] if local else None)
        else:
            seen.append(f"{label}: {identity.describe()}, not the pinned release")
        if not local:
            system = system or seen[-1]
    if project:
        return Item("jdk", "JDK 25 (pinned)", True, project, need)
    if system and system.endswith(", the pinned release"):
        return Item("jdk", "JDK 25 (pinned)", True, system, need)
    return Item("jdk", "JDK 25 (pinned)", False, "; ".join(seen) or "no java found", need)


def check_node(host: Host) -> Item:
    need = "Node.js 24 LTS"
    if not host.which("node"):
        return Item("node", "Node.js 24", False, "node not on PATH", need)
    code, out = host.run(["node", "--version"], timeout=30)
    version = version_tuple(out)
    ok = code == 0 and version is not None and version[0] == 24
    return Item("node", "Node.js 24", ok, first_line(out) or f"exit code {code}", need)


def check_pnpm(host: Host) -> Item:
    need = "pnpm through Corepack ('corepack pnpm'), never 'corepack enable'"
    if not host.which("corepack"):
        return Item("pnpm", "pnpm via Corepack", False, "corepack not on PATH (it ships with Node.js 24)", need)
    code, corepack = host.run(["corepack", "--version"], timeout=30)
    if code != 0:
        return Item("pnpm", "pnpm via Corepack", False, f"corepack --version failed: {first_line(corepack)}", need)
    env = host.environ()
    env["COREPACK_ENABLE_DOWNLOAD_PROMPT"] = "0"
    env["COREPACK_ENABLE_NETWORK"] = "0"  # the doctor never downloads; a missing pnpm is reported instead
    env["COREPACK_HOME"] = str(host.root / ".tools" / "corepack")  # the project-local cache the build uses
    frontend = host.root / "frontend"
    cwd = frontend if host.exists(frontend / "package.json") else host.root
    code, out = host.run(["corepack", "pnpm", "--version"], timeout=60, cwd=cwd, env=env)
    version = first_line(out)
    if code == 0 and re.fullmatch(r"\d+\.\d+\.\d+.*", version):
        where = "frontend/package.json packageManager" if cwd == frontend else "Corepack default"
        return Item("pnpm", "pnpm via Corepack", True, f"pnpm {version} (corepack {first_line(corepack)}, {where})", need)
    return Item(
        "pnpm", "pnpm via Corepack", False,
        f"corepack {first_line(corepack)}; 'corepack pnpm --version' offline: {version[:120]}", need,
    )


def check_rust(host: Host) -> Item:
    need = "Rust stable (rustc and cargo)"
    if not host.which("rustc") or not host.which("cargo"):
        missing = [name for name in ("rustc", "cargo") if not host.which(name)]
        home = host.env("HOME")
        cargo_bin = Path(home) / ".cargo" / "bin" if home else None
        if cargo_bin and all(host.exists(cargo_bin / name) for name in ("rustc", "cargo")):
            return Item(
                "rust", "Rust stable and cargo", False,
                f"{', '.join(missing)} not on PATH in this shell, but rustup installed them in ~/.cargo/bin", need,
                fix_key="rust-path",
                note="rustup adds '. \"$HOME/.cargo/env\"' to ~/.profile and ~/.bashrc; a non-login shell reads neither.",
            )
        return Item("rust", "Rust stable and cargo", False, f"{', '.join(missing)} not on PATH", need)
    code_r, rustc = host.run(["rustc", "--version"], timeout=30)
    code_c, cargo = host.run(["cargo", "--version"], timeout=30)
    stable = code_r == 0 and code_c == 0 and not re.search(r"nightly|beta|dev", rustc)
    return Item("rust", "Rust stable and cargo", stable, f"{first_line(rustc)}; {first_line(cargo)}", need)


TAURI_PACKAGES = [
    ("webkit2gtk-4.1", ["webkit2gtk-4.1"]),
    ("appindicator", ["ayatana-appindicator3-0.1", "appindicator3-0.1"]),
    ("librsvg2", ["librsvg-2.0"]),
    ("openssl", ["openssl"]),
]


def check_tauri(host: Host) -> Item:
    need = "pkg-config finds webkit2gtk-4.1, (ayatana-)appindicator3, librsvg-2.0 and openssl"
    if host.system() != "Linux":
        return Item(
            "tauri", "Tauri 2 Linux prerequisites", False, f"not checked on {host.system()} (Linux only)", need,
            note="Checked inside the Linux build environment.",
        )
    if not host.which("pkg-config"):
        return Item("tauri", "Tauri 2 Linux prerequisites", False, "pkg-config not on PATH", need)
    missing = []
    for label, modules in TAURI_PACKAGES:
        if not any(host.run(["pkg-config", "--exists", module], timeout=20)[0] == 0 for module in modules):
            missing.append(label)
    found = "all present" if not missing else "missing: " + ", ".join(missing)
    return Item("tauri", "Tauri 2 Linux prerequisites", not missing, found, need)


def check_python(host: Host) -> Item:
    major, minor, micro = host.python_version()
    return Item(
        "python", "Python 3.12", (major, minor) == (3, 12), f"{major}.{minor}.{micro} (the interpreter running doctor)",
        "Python 3.12",
    )


def check_git(host: Host) -> list[Item]:
    items = []
    if not host.which("git"):
        items.append(Item("git", "Git", False, "git not on PATH", "git"))
        items.append(Item("autocrlf", "core.autocrlf", False, "git missing", "false or input"))
    else:
        code, out = host.run(["git", "--version"], timeout=20)
        items.append(Item("git", "Git", code == 0, first_line(out), "git"))
        code, value = host.run(["git", "-C", str(host.root), "config", "--get", "core.autocrlf"], timeout=20)
        effective = value.strip().lower() if code == 0 and value.strip() else "unset (false)"
        ok = effective in {"false", "input", "unset (false)"}
        items.append(Item("autocrlf", "core.autocrlf (effective)", ok, effective, "false or input"))
    attributes = host.read_text(str(host.root / ".gitattributes"))
    if attributes is None:
        items.append(Item("gitattributes", ".gitattributes", False, "missing", "present, with '* text=auto eol=lf'"))
    else:
        has_lf = bool(re.search(r"^\*\s+text=auto\s+eol=lf\s*$", attributes, re.M))
        items.append(
            Item(
                "gitattributes", ".gitattributes", has_lf,
                "present" + ("" if has_lf else ", without '* text=auto eol=lf'"),
                "present, with '* text=auto eol=lf'",
            )
        )
    return items


def venv_python_path(host: Host) -> Optional[Path]:
    for candidate in (
        host.root / ".tools" / "venv" / "Scripts" / "python.exe",
        host.root / ".tools" / "venv" / "bin" / "python",
    ):
        if host.exists(candidate):
            return candidate
    return None


VENV_PROBE = (
    "import json, sys, importlib.metadata as m; "
    "print(json.dumps({'python': '%d.%d.%d' % sys.version_info[:3], "
    "'packages': {d.metadata['Name']: d.version for d in m.distributions()}}))"
)


def check_venv(host: Host) -> Item:
    need = "the project venv .tools/venv: Python 3.12 with the pins of tools/requirements.txt"
    python = venv_python_path(host)
    if python is None:
        return Item("venv", "Project venv", False, ".tools/venv missing", need)
    requirements = host.read_text(str(host.root / "tools" / "requirements.txt"))
    pins = parse_pins_text(requirements) if requirements else {}
    code, out = host.run([str(python), "-I", "-c", VENV_PROBE], timeout=60)
    try:
        state = json.loads(out.strip().splitlines()[-1])
    except (ValueError, IndexError):
        return Item("venv", "Project venv", False, f".tools/venv python does not run: {first_line(out)[:100]}", need)
    packages = {normalise(k): v for k, v in state["packages"].items()}
    problems = [] if state["python"].startswith("3.12.") else [f"Python {state['python']}"]
    problems += [f"{n} {packages.get(n, 'missing')}!={v}" for n, v in sorted(pins.items()) if packages.get(n) != v]
    if not pins:
        problems.append("tools/requirements.txt missing or empty")
    found = f"Python {state['python']}, {len(pins)} pins " + ("match" if not problems else "differ: " + ", ".join(problems))
    return Item("venv", "Project venv", not problems, found, need)


def check_gitleaks(host: Host) -> Item:
    need = "gitleaks 8.x in .tools/bin"
    binary = host.root / ".tools" / "bin" / exe(host, "gitleaks")
    if not host.exists(binary):
        return Item("gitleaks", "gitleaks in .tools/bin", False, f".tools/bin/{binary.name} missing", need)
    code, out = host.run([str(binary), "version"], timeout=30)
    version = version_tuple(out)
    ok = code == 0 and version is not None and version[0] == 8
    return Item("gitleaks", "gitleaks in .tools/bin", ok, first_line(out) or f"exit code {code}", need)


def resource_items(host: Host) -> tuple[list[Item], str, dict]:
    """RAM, cores and free disk, and the cell profile the host supports."""
    windows = is_windows(host)
    ram = host.ram_gib()
    cores = host.cpu_count()
    disk = host.disk_free_gib(host.root)
    disk_label = "unknown" if disk is None else f"{disk:.1f} GiB free on the repository volume"
    windows_disk = None
    if is_wsl2(host) and host.exists(WSL_WINDOWS_DRIVE):
        windows_disk = host.disk_free_gib(WSL_WINDOWS_DRIVE)
        if windows_disk is not None:
            disk_label += f" (the WSL2 virtual disk); {windows_disk:.1f} GiB free on C:, which holds that disk"
            disk = windows_disk if disk is None else min(disk, windows_disk)
    # On a Windows host the cells run in the WSL2 VM, which can be given the host RAM minus what Windows needs.
    linux_ram = None if ram is None else (max(ram - WINDOWS_RESERVE_GIB, 0.0) if windows else ram)
    if linux_ram is None:
        profile = "none"
    elif linux_ram >= DEV_CELL_RAM_GIB and cores >= DEV_CELL_CORES:
        profile = "dev cell"
    elif linux_ram >= LITE_CELL_RAM_GIB and cores >= LITE_CELL_CORES:
        profile = "lite cell"
    else:
        profile = "none"
    ram_label = "unknown" if ram is None else f"{ram:.1f} GiB"
    if windows and ram is not None:
        ram_label += f" on the Windows host; about {linux_ram:.1f} GiB can go to the WSL2 VM"
    items = [
        Item(
            "ram", "RAM", linux_ram is not None and linux_ram >= LITE_CELL_RAM_GIB, ram_label,
            f">= 32 GB for the dev cell (measured >= {DEV_CELL_RAM_GIB:.0f} GiB), "
            f">= 16 GB for the lite cell (>= {LITE_CELL_RAM_GIB:.0f} GiB) [P]",
            note="" if profile != "lite cell" else "Below the dev cell: results from this host are labelled 'lite'.",
        ),
        Item(
            "cpu", "CPU cores", cores >= LITE_CELL_CORES, f"{cores} logical cores",
            f">= {DEV_CELL_CORES} for the dev cell, >= {LITE_CELL_CORES} for the lite cell [P]",
        ),
        Item(
            "disk", "Free disk", disk is not None and disk >= DISK_FREE_GIB, disk_label,
            f">= {DISK_FREE_GIB:.0f} GiB free [P]",
            note="" if windows_disk is None else
            "On WSL2 the smaller figure counts: the virtual disk can only grow while its Windows drive has space [P].",
        ),
    ]
    numbers = {
        "ram_gib": None if ram is None else round(ram, 1),
        "linux_ram_gib": None if linux_ram is None else round(linux_ram, 1),
        "cpu_count": cores,
        "disk_free_gib": None if disk is None else round(disk, 1),
        "windows_drive_free_gib": None if windows_disk is None else round(windows_disk, 1),
    }
    return items, profile, numbers


def wslconfig_suggestion(ram: Optional[float], cores: int) -> tuple[int, int]:
    if ram is None:
        return 32, max(cores, 8)
    memory = 32 if ram - WINDOWS_RESERVE_GIB >= 32 else int(math.floor(ram - WINDOWS_RESERVE_GIB))
    return max(memory, 1), max(min(cores, 16), 1)


# --------------------------------------------------------------------------- run


def run_checks(host: Host, tier: str = "full") -> Report:
    report = Report(tier=tier, windows_host=is_windows(host))
    if tier == "fast":
        report.items = [check_jdk(host), check_node(host), check_pnpm(host), check_venv(host), check_gitleaks(host)]
    else:
        items = [check_os(host)]
        items += check_container(host)
        items.append(check_simple(host, "k3d", "k3d", ["k3d", "version"], "k3d (dev cell, WP-0.2)"))
        items.append(check_simple(host, "kubectl", "kubectl", ["kubectl", "version", "--client"], "kubectl"))
        items.append(check_simple(host, "helm", "Helm", ["helm", "version", "--short"], "Helm"))
        items.append(check_jdk(host))
        items.append(check_node(host))
        items.append(check_pnpm(host))
        items.append(check_rust(host))
        items.append(check_tauri(host))
        items.append(check_python(host))
        items += check_git(host)
        items.append(check_venv(host))
        items.append(check_gitleaks(host))
        resources, profile, numbers = resource_items(host)
        items += resources
        report.items = items
        report.profile = profile
        report.host.update(numbers)
        if report.windows_host:
            memory, processors = wslconfig_suggestion(numbers["ram_gib"], numbers["cpu_count"])
            report.windows_steps = windows_steps(to_mnt_path(host.root), memory, processors)
    report.host.update(
        {"system": host.system(), "release": host.release(), "machine": host.machine(), "root": str(host.root)}
    )
    return report
