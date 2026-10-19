# Build host provisioning

`provision-ubuntu.sh` turns an Ubuntu 24.04 machine (a WSL2 distribution or a native install) into the HMS Kurdistan
build host that BUILD-PROMPT.md "Before the first session" describes: Docker Engine from Docker's apt repository,
kubectl, Helm, k3d, JDK 25, Node.js 24 LTS with Corepack, Python 3.12, Rust stable (rustup) and the Tauri 2
prerequisites. It is idempotent. Run it as root. The JDK it installs (Ubuntu's OpenJDK 25, or Corretto 25 if the
archive lacks it) is not the build's JDK: `tools/ci/run` and `tools/bootstrap env` put the pinned JDK in `.tools/`
first, and `tools/doctor` passes only that release (ADR-002, KA-002).

It is a host-preparation step, not part of the build: BUILD-PROMPT.md §3.4 item 9 gives system changes to the
human. On 18 October 2026 the human answered the list of host decisions with "Please do all the steps you have full
approval go ahead", and on that instruction the build agent ran this script itself. This is a recorded deviation
from §3.4 item 9: `docs/program/DECISIONS-NEEDED.md` DN-001 holds the record and lists every system-wide change the
script makes; DN-002 to DN-004 record the components.

## What it verifies and what it trusts

Line numbers refer to `provision-ubuntu.sh`.

- **Checked against a SHA-256 before install:** Helm (lines 64-66, against the `.sha256sum` file fetched from
  get.helm.sh over TLS), k3d (lines 20 and 76, against the SHA-256 written into the script from the release's
  `checksums.txt`) and Node.js (lines 84-86, against the `SHASUMS256.txt` fetched from nodejs.org over TLS; its
  signature is not checked). These three are pinned to a version (lines 17-19).
- **Checked by apt only:** every apt package, against the signing key of its repository. The Ubuntu archive keys
  come with the distribution. The Docker, Kubernetes (pkgs.k8s.io) and, only if the fallback runs, Corretto keys are
  downloaded over TLS and trusted without a fingerprint check (lines 32, 39, 55). No apt package is pinned to a
  version: Docker Engine, the JDK and the Tauri packages are whatever the repositories serve that day, and kubectl
  follows its 1.37 channel (line 16).
- **Not verified:** `rustup-init.sh` is downloaded from sh.rustup.rs over TLS and run as the build user (line 97),
  and it installs that day's stable toolchain; no Rust version is pinned. The `hello-world` image (line 107) is
  pulled from Docker Hub by tag.
- **Beyond what the build needs:** `apt-get -y upgrade` (line 25) upgrades every installed package of the
  distribution.

## Windows hosts (WSL2)

1. Install or repair WSL 2 and install Ubuntu 24.04 (`wsl --install -d Ubuntu-24.04`, or
   `wsl --install --from-file <verified .wsl image> --name Ubuntu-24.04`).
2. Size the VM in `%UserProfile%\.wslconfig` (the dev cell wants 32 GB; on smaller hosts use the lite cell, §5.1).
3. Run `wsl -d Ubuntu-24.04 -u root -- bash tools/host/provision-ubuntu.sh` from the repository root.

`sh tools/doctor` (run inside the Linux host) reports anything still missing.
