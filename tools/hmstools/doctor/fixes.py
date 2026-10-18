"""Install commands that tools/doctor prints for missing items. It prints them; it never runs them.

Ubuntu commands target Ubuntu 24.04 inside WSL2 (BUILD-PROMPT.md "Before the first session").
They follow each vendor's own installation instructions. tools/host/provision-ubuntu.sh installs the
whole Linux toolchain in one idempotent run, with pinned versions and every download checked against
its publisher's checksum; the hints name it first where it covers the item.
"""

from __future__ import annotations

PROVISION = "sudo bash tools/host/provision-ubuntu.sh"

UBUNTU: dict[str, list[str]] = {
    "os": [
        "The build runs in Linux: use Ubuntu 24.04 in WSL2 (Windows steps below) or a native Ubuntu 24.04 host.",
        "Keep the repository in the Linux file system, for example ~/src/hospitalmanagementsystem, never under /mnt/c.",
    ],
    "container-engine": [
        "# Docker Engine from Docker's apt repository (docs.docker.com/engine/install/ubuntu):",
        "sudo apt-get update && sudo apt-get install -y ca-certificates curl",
        "sudo install -m 0755 -d /etc/apt/keyrings",
        "sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc",
        "sudo chmod a+r /etc/apt/keyrings/docker.asc",
        'echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] '
        'https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" '
        "| sudo tee /etc/apt/sources.list.d/docker.list > /dev/null",
        "sudo apt-get update && sudo apt-get install -y docker-ce docker-ce-cli containerd.io "
        "docker-buildx-plugin docker-compose-plugin",
        'sudo usermod -aG docker "$USER"   # then open a new WSL shell',
        "# or Podman instead: sudo apt-get install -y podman",
    ],
    "container-daemon": [
        "sudo systemctl enable --now docker   # Podman needs no daemon: systemctl --user enable --now podman.socket",
        "# WSL2 needs systemd: /etc/wsl.conf must contain '[boot]' and 'systemd=true' "
        "(the Ubuntu 24.04 WSL image sets it); after changing it run 'wsl --shutdown' in Windows.",
    ],
    "k3d": [
        f"{PROVISION}   # the pinned k3d release binary, SHA-256 checked against the release's checksums.txt",
    ],
    "kubectl": [f"{PROVISION}   # kubectl from the Kubernetes apt repository (pkgs.k8s.io)"],
    "helm": [f"{PROVISION}   # the pinned Helm release from get.helm.sh, SHA-256 checked"],
    "jdk": [
        "sh tools/bootstrap jdk   # project-local Eclipse Temurin 25 in .tools/ (no system change; preferred)",
        "# or a system JDK from the Adoptium apt repository:",
        "sudo apt-get install -y wget apt-transport-https gpg",
        "wget -qO - https://packages.adoptium.net/artifactory/api/gpg/key/public | gpg --dearmor "
        "| sudo tee /etc/apt/trusted.gpg.d/adoptium.gpg > /dev/null",
        'echo "deb https://packages.adoptium.net/artifactory/deb '
        "$(awk -F= '/^VERSION_CODENAME/{print$2}' /etc/os-release) main\" "
        "| sudo tee /etc/apt/sources.list.d/adoptium.list",
        "sudo apt-get update && sudo apt-get install -y temurin-25-jdk",
    ],
    "node": [
        f"{PROVISION}   # the pinned Node.js 24 LTS from nodejs.org, checked against SHASUMS256.txt; includes Corepack",
    ],
    "pnpm": [
        "cd frontend && COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack pnpm --version",
        "# fetches the pnpm version pinned in frontend/package.json into the Corepack cache;"
        " run pnpm as 'corepack pnpm ...' and never 'corepack enable'",
    ],
    "rust": [
        f"{PROVISION}   # rustup with the stable toolchain, for the build user",
        "# or by hand: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable",
    ],
    "tauri": [
        f"{PROVISION}   # the Tauri 2 Linux packages",
        "# or by hand: sudo apt-get update && sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential curl wget"
        " file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev pkg-config",
    ],
    "python": ["sudo apt-get install -y python3 python3-venv python3-pip   # Ubuntu 24.04's python3 is 3.12"],
    "git": ["sudo apt-get install -y git"],
    "autocrlf": [
        "git config --global core.autocrlf false",
        "# if it is also set for this repository: git config --local core.autocrlf false",
    ],
    "gitattributes": ["git checkout -- .gitattributes   # restore it from the repository"],
    "venv": ["sh tools/bootstrap venv   # .tools/venv from tools/requirements.txt, hash-checked"],
    "gitleaks": ["sh tools/bootstrap gitleaks   # gitleaks 8.x into .tools/bin, checksum-verified"],
    "ram": [
        "Give the Linux environment more memory: 32 GB for the dev cell, 16 GB for the lite cell "
        "(on Windows, set 'memory' in .wslconfig, below)."
    ],
    "cpu": ["Give the Linux environment more cores: 8 for the dev cell (on Windows, 'processors' in .wslconfig)."],
    "disk": ["Free space on the volume that holds the repository, or move the repository to a larger volume."],
}


def windows_steps(root_mnt_path: str, wsl_memory_gb: int, wsl_processors: int) -> list[str]:
    """The Windows-side steps for preparing WSL2 (shown once, on Windows hosts)."""
    return [
        "1. In PowerShell as Administrator: wsl --install -d Ubuntu-24.04   (then restart Windows)",
        "2. Create %UserProfile%\\.wslconfig with:",
        "     [wsl2]",
        f"     memory={wsl_memory_gb}GB",
        f"     processors={wsl_processors}",
        "   then run: wsl --shutdown",
        "3. Container engine: Docker Engine inside WSL2 (Ubuntu commands above), or Rancher Desktop with WSL"
        " integration. Docker Desktop needs a paid subscription in larger organisations.",
        "4. Open Ubuntu-24.04 and clone the repository into the Linux file system, not under /mnt/c:",
        f"     mkdir -p ~/src && git clone {root_mnt_path} ~/src/hospitalmanagementsystem",
        "5. Install the Linux toolchain (Docker Engine, kubectl, Helm, k3d, JDK 25, Node.js 24, Rust and the Tauri"
        " prerequisites; pinned and checksum-verified): sudo bash ~/src/hospitalmanagementsystem/tools/host/provision-ubuntu.sh",
        "6. In ~/src/hospitalmanagementsystem run: git config --global core.autocrlf false && sh tools/bootstrap"
        " && sh tools/doctor",
    ]
