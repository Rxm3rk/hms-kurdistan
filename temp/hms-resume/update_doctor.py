"""Points the doctor's install hints at tools/host/provision-ubuntu.sh (pinned, checksum-verified)."""
import sys
from pathlib import Path

p = Path(sys.argv[1]) / "tools/hmstools/doctor/fixes.py"
s = p.read_text(encoding="utf-8")


def rep(old, new):
    global s
    assert s.count(old) == 1, old[:80]
    s = s.replace(old, new)


rep('''Ubuntu commands target Ubuntu 24.04 inside WSL2 (BUILD-PROMPT.md "Before the first session").
They follow each vendor's own installation instructions.
"""''', '''Ubuntu commands target Ubuntu 24.04 inside WSL2 (BUILD-PROMPT.md "Before the first session").
They follow each vendor's own installation instructions. tools/host/provision-ubuntu.sh installs the
whole Linux toolchain in one idempotent run, with pinned versions and every download checked against
its publisher's checksum; the hints name it first where it covers the item.
"""

PROVISION = "sudo bash tools/host/provision-ubuntu.sh"''')

rep('''    "k3d": ["curl -fsSL https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash"],
    "kubectl": ["sudo snap install kubectl --classic"],
    "helm": ["sudo snap install helm --classic"],''', '''    "k3d": [
        f"{PROVISION}   # the pinned k3d release binary, SHA-256 checked against the release's checksums.txt",
    ],
    "kubectl": [f"{PROVISION}   # kubectl from the Kubernetes apt repository (pkgs.k8s.io)"],
    "helm": [f"{PROVISION}   # the pinned Helm release from get.helm.sh, SHA-256 checked"],''')

rep('''    "node": [
        "curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -",
        "sudo apt-get install -y nodejs   # Node.js 24 LTS; it includes Corepack",
    ],''', '''    "node": [
        f"{PROVISION}   # the pinned Node.js 24 LTS from nodejs.org, checked against SHASUMS256.txt; includes Corepack",
    ],''')

rep('''    "rust": [
        "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable",
        '. "$HOME/.cargo/env"',
    ],
    "tauri": [
        "sudo apt-get update && sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential curl wget file "
        "libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev pkg-config",
    ],''', '''    "rust": [
        f"{PROVISION}   # rustup with the stable toolchain, for the build user",
        "# or by hand: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable",
    ],
    "tauri": [
        f"{PROVISION}   # the Tauri 2 Linux packages",
        "# or by hand: sudo apt-get update && sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential curl wget"
        " file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev pkg-config",
    ],''')

rep('''        "4. Open Ubuntu-24.04 and clone the repository into the Linux file system, not under /mnt/c:",
        f"     mkdir -p ~/src && git clone {root_mnt_path} ~/src/hospitalmanagementsystem",
        "5. In ~/src/hospitalmanagementsystem run: git config --global core.autocrlf false && sh tools/bootstrap"
        " && sh tools/doctor",''', '''        "4. Open Ubuntu-24.04 and clone the repository into the Linux file system, not under /mnt/c:",
        f"     mkdir -p ~/src && git clone {root_mnt_path} ~/src/hospitalmanagementsystem",
        "5. Install the Linux toolchain (Docker Engine, kubectl, Helm, k3d, JDK 25, Node.js 24, Rust and the Tauri"
        " prerequisites; pinned and checksum-verified): sudo bash ~/src/hospitalmanagementsystem/tools/host/provision-ubuntu.sh",
        "6. In ~/src/hospitalmanagementsystem run: git config --global core.autocrlf false && sh tools/bootstrap"
        " && sh tools/doctor",''')
p.write_text(s, encoding="utf-8", newline="\n")
print("ok")
