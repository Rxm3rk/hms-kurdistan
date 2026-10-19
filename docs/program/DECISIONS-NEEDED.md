# Decisions needed

Only items that block work belong here (BUILD-PROMPT §3.1, §3.4). Each item has an ID (DN-nnn), a status (`open`, `answered`, `closed`), what it blocks (`now`, a work package, or `later`), the default in use, who decides, the context and the options. Questions that do not block work yet are in `OPEN-QUESTIONS.md`; the [L] register is in `ASSUMPTIONS.md`.

The build agent never installs system software, enables OS features or changes system-wide settings (§3.4 item 9). The commands below are for the human to run. DN-001 records the one deviation: on the human's instruction of 18 October 2026 the build agent carried out the host steps itself (§3.4 item 9). The commands follow each vendor's published installation route; check the vendor's current page before running them. Where a version must be chosen, apply the §4.1 rule (newest generally available release that has had at least one patch release) and record the pinned set in ADR-002.

## Blocking now

At most ten items. Answer these first.

1. **DN-005** The lite cell as §5.1 defines it (two PostgreSQL instances) cannot show WP-0.2's single-node-loss criterion: choose how it will be met. WP-0.2 runs on the default in use since 19 October 2026, three small PostgreSQL instances inside the lite cell (option 4), with every result labelled "lite".
2. **DN-011** No work package can merge into `main` until the merge tier exists and passes: confirm that the Phase 0 branches stack meanwhile, or choose another rule.

Next to block (not "now"): DN-013 if C: falls below 15 GiB free while WP-0.2 pulls the cell's images (29.3 GiB free on 19 October 2026); DN-015 and DN-016 if the cell's nightly runs prove unreliable on the defaults; DN-009 for reference-cell runs (WP-0.6 and the Phase 0 exit); DN-010 for pushing, pull requests and human review routing; DN-014 for the CDS registry gate (WP-1.5).

Closed on 18 October 2026: DN-001 to DN-004 (on the human's instruction the build agent provisioned the Linux build host itself, a recorded deviation from §3.4 item 9) and DN-006 (confirmed).

Closed on 19 October 2026: DN-017 (option 1: PostgreSQL allowed, and BusyBox recorded in the licence register with a source offer).

## Host check

`tools/doctor` (WP-0.1) is the recorded check; its output is stored under `docs/program/evidence/doctor/`. This table compares the morning check, made with version commands, with the host after provisioning.

| Prerequisite ("Before the first session") | Found on 18 Oct 2026, morning (Windows only) | After provisioning (18 Oct 2026) | Item |
|---|---|---|---|
| Linux: WSL2 with Ubuntu 24.04, repository in the WSL file system | `wsl --status` failed ("The system cannot find the file specified."): most of WSL 2.6.3's files were missing | WSL 2.6.3 repaired; Ubuntu 24.04.5 LTS is the default distribution. The Linux gates run in the clone `~/src/hospitalmanagementsystem` (KA-001) | DN-001, closed |
| Container engine (Docker Engine in WSL2, Rancher Desktop or Podman) | `docker`, `podman`, `nerdctl` not on PATH | Docker Engine 29.9.1 with Compose 5.6.0 in WSL; user `surface` in the `docker` group | DN-002, closed |
| k3d, kubectl and Helm | none on PATH | k3d 5.8.3, kubectl 1.37.1, Helm 4.3.1 in WSL | DN-003, closed |
| JDK 25 | no system `java`; project-local Temurin 25.0.4.1 in `.tools/` | OpenJDK 25.0.4.1 (Ubuntu package) in WSL, which the build does not use; every checkout also gets the pinned JDK, Temurin 25.0.4.1+1, from `tools/bootstrap`, and the build runs on it (ADR-002, KA-002) | DN-006, closed |
| Node.js 24 LTS with pnpm through Corepack | Node 24.13.0, Corepack 0.34.5 | Node 24.22.0, Corepack 0.36.0 in WSL | none |
| Rust stable and the Tauri 2 prerequisites | `rustc`, `cargo`, `rustup` not on PATH | Rust 1.99.1 (rustup, stable) and the Tauri 2 Linux packages in WSL | DN-004, closed |
| Python 3.12 | 3.12.10, project venv in `.tools/venv` | 3.12.3 in WSL | none |
| Git with LF line endings | Git 2.50.1; `core.autocrlf=true` at system scope, `false` in this repository | Git 2.43.0 in WSL with `core.autocrlf=false` (global) | DN-007 (Windows side only) |
| At least 32 GB RAM and 8 cores for the Linux VM | 15.6 GB RAM, 8 logical cores | The VM has 10 GB of memory, 8 processors and 8 GB of swap (`%UserProfile%\.wslconfig`) | DN-005, open |
| Reference cell (three servers, 32 cores, 128 GB, NVMe each) | none | none | DN-009, open |

---

## DN-001: No Linux build host (WSL2 with Ubuntu 24.04 is not installed)

- **Status:** closed (2026-10-18)
- **Resolution:** the human answered "Please do all the steps you have full approval go ahead" (18 October 2026), in reply to the list of host decisions. On that instruction the build agent carried out the host steps itself. This deviates from §3.4 item 9 and "Before the first session", which give host installation to the human; the human's explicit instruction is the authority, and it is recorded here.
  - WSL 2.6.3 was registered as installed but most of its files were missing. It was repaired from Windows' cached copy of the official installer (`wsl.2.6.3.0.x64.msi`), whose SHA-256 matched Microsoft's published release; the human approved the administrator prompt and pointed the repair at the verified copy. No reboot was needed. The SHA-256 was not written down at the time. A copy of the installer is still in `%LOCALAPPDATA%\Temp\hms-wsl-src\` (247,123,968 bytes); its SHA-256, computed on the Windows host on 18 October 2026 while review finding R-11 was being resolved, is `562c79aba6ce9b6e9170f069d31e3717f10d76dd8bfbee39b07eae0ca4a02ca0`, the digest GitHub lists for that asset of Microsoft's WSL release 2.6.3 (`github.com/microsoft/WSL`).
  - Ubuntu 24.04.5 LTS was installed from the `mirrors.edge.kernel.org` copy of the official WSL image (`ubuntu-24.04.5-wsl-amd64.wsl`), verified against the SHA-256 Microsoft publishes for it, because the Ubuntu server ran at about 60 KB/s. The SHA-256 is `bb415d824822c4b878125729af451a5d18fb13d1cf5cbed9a7393ad64ac6039e`, the value Microsoft's `distributions/DistributionInfo.json` (`github.com/microsoft/WSL`) gives for `releases.ubuntu.com/24.04.5/ubuntu-24.04.5-wsl-amd64.wsl`; the image kept in `%LOCALAPPDATA%\Temp\hms-wsl-src\` gave the same value when it was re-computed on the Windows host on 18 October 2026 (review finding R-11). A mirror is not an official source, so this download is a deviation from §3.7, recorded here; the only other mirror download is the Gradle zip (DN-006). Ubuntu 24.04.5 is the default distribution, with the Linux user `surface` (uid 1000).
  - `%UserProfile%\.wslconfig` gives the VM 10 GB of memory, 8 processors and 8 GB of swap (DN-005).
  - Everything inside Ubuntu is reproducible: `tools/host/provision-ubuntu.sh` (run as root; idempotent; a second run changed nothing, with no stored record). Its header and `tools/host/README.md` say what it verifies and what it trusts. Helm, k3d and Node.js are pinned and checked against a SHA-256 before install (k3d's is written into the script; Helm's and Node.js's checksum files come from the same servers over TLS). apt checks every package against its repository's key, but the Docker and Kubernetes keys were downloaded over TLS and trusted without a fingerprint check. `rustup-init.sh` was fetched over TLS and run unverified, and installed that day's stable Rust (1.99.1, DN-004). No apt package is pinned to a version (kubectl follows its 1.37 channel).
  - System-wide changes the script made (line numbers in `tools/host/provision-ubuntu.sh`; the state was read back on the WSL host on 18 October 2026):
    - `apt-get update` and `apt-get -y upgrade` of the whole distribution, then the base packages (lines 24-27);
    - the Docker apt key and source, `/etc/apt/keyrings/docker.asc` and `/etc/apt/sources.list.d/docker.list` (lines 30-35), and the Kubernetes ones, `/etc/apt/keyrings/kubernetes-apt-keyring.gpg` and `/etc/apt/sources.list.d/kubernetes.list` (lines 38-42). The Corretto fallback (lines 53-58) did not run: the Ubuntu archive has `openjdk-25-jdk-headless`, and no Corretto key or source exists on the host;
    - Docker Engine, Compose, Buildx and kubectl (line 45); `surface` added to the `docker` group (line 46); `systemctl enable --now docker containerd` (line 47), so both services start with every boot of the distribution (DN-002, DN-003);
    - OpenJDK 25 from the Ubuntu archive (line 51);
    - Helm as `/usr/local/bin/helm` (line 67) and k3d as `/usr/local/bin/k3d` (line 77) (DN-003);
    - Node.js v24.22.0 unpacked into `/opt/node-v24.22.0-linux-x64` (line 87), with `node`, `npm`, `npx` and `corepack` symlinked into `/usr/local/bin` (line 90);
    - the Tauri 2 Linux packages (line 93, DN-004);
    - for the build user `surface` only: Rust through rustup in `~/.cargo` and `~/.rustup` (line 97, DN-004), and rustup's line `. "$HOME/.cargo/env"` added to `~/.profile` and `~/.bashrc`; the global git configuration `core.autocrlf=false` and `init.defaultBranch=main` in `~/.gitconfig` (line 101);
    - the `hello-world` image, pulled from Docker Hub by tag on the first run and kept in Docker's image store; line 107 runs it with `--rm` on every run of the script, so it ran twice and left no container.
  - The repository stays on the Windows file system, where the agent host (T3 Code) opens it. The Linux gates run in a clone in the WSL file system, `~/src/hospitalmanagementsystem`, at committed SHAs (KA-001).
- **Blocks:** nothing since it closed on 18 October 2026; until then, now (WP-0.2 and everything that depends on it; see `WORK-PACKAGES.md`)
- **Default in use:** WP-0.1 and other container-free work continue on the Windows host with a project-local toolchain (KA-001, DN-006). Every result from this host is labelled "indicative (Windows host, no cell)".
- **Who decides:** the human running the build (host owner); needs administrator rights.
- **Context:** BUILD-PROMPT "Before the first session" says the build runs in Linux: on Windows, install WSL2 with Ubuntu 24.04, put the repository in the WSL file system (not under `/mnt/c`) and start the agent session there. The dev cell (§5.1), the container stack and the Tauri Linux build all assume it.
- **Options:**
  1. **Install WSL2 with Ubuntu 24.04 (recommended).** In an elevated PowerShell:

     ```powershell
     wsl --install -d Ubuntu-24.04
     ```

     Reboot, start "Ubuntu 24.04" once and create the Linux user. Then, inside Ubuntu:

     ```bash
     sudo apt-get update && sudo apt-get install -y git
     git config --global core.autocrlf false
     mkdir -p ~/src
     git clone /mnt/c/Users/Surface/.t3/projects/hospitalmanagementsystem ~/src/hms
     cd ~/src/hms && git checkout wp/0.1-programme-bootstrap
     ```

     A clone takes committed work only; `.tools/` is Windows-specific and stays behind. The clone's `origin` points at the Windows path until a real remote exists (DN-010). Then install the Linux toolchain the build prompt lists (JDK 25, Node.js 24 LTS with Corepack, Python 3.12) from the vendors' Ubuntu instructions, for example Eclipse Temurin from the Adoptium apt repository (`temurin-25-jdk`) and Node.js 24 from nodejs.org or NodeSource; Ubuntu 24.04 ships Python 3.12 as `python3`. Re-run `tools/doctor` inside WSL and start the next session there.
  2. A separate Linux machine or VM with Ubuntu 24.04 and the same toolchain.
  3. Stay on Windows. Then WP-0.2 and every work package that depends on it stay blocked (§3.4 "When everything left is blocked").

## DN-002: No container engine

- **Status:** closed (2026-10-18)
- **Resolution:** option 1, Docker Engine 29.9.1 and Compose 5.6.0 from Docker's apt repository inside Ubuntu, installed by `tools/host/provision-ubuntu.sh` on the human's instruction (DN-001). Systemd is on in the Ubuntu 24.04 WSL image, `surface` is in the `docker` group, and `docker run hello-world` succeeded. Pull speeds measured from WSL: ghcr.io about 10 MB/s, quay.io about 18 MB/s, Docker Hub about 3 MB/s. Docker's apt key was downloaded over TLS and trusted without a fingerprint check, and Docker Engine is not pinned to a version. DN-001 itemises the system-wide changes with their script lines: the Docker apt key and source, the `docker` group, and `systemctl enable --now docker containerd`.
- **Blocks:** nothing since it closed on 18 October 2026; until then, now (WP-0.2: the `docker compose` dev stack and the k3d dev cell; the merge tier's Testcontainers integration tests)
- **Default in use:** none. Container-free work only.
- **Who decides:** the human running the build (host owner).
- **Context:** BUILD-PROMPT "Before the first session" asks for Docker Engine inside WSL2, Rancher Desktop or Podman, and notes that Docker Desktop needs a paid subscription in larger organisations. k3d creates its cluster nodes as containers through the Docker API.
- **Options:**
  1. **Docker Engine inside WSL2 from Docker's apt repository (recommended for k3d).** Inside Ubuntu 24.04, after DN-001:

     ```bash
     sudo apt-get update
     sudo apt-get install -y ca-certificates curl
     sudo install -m 0755 -d /etc/apt/keyrings
     sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
     sudo chmod a+r /etc/apt/keyrings/docker.asc
     echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
     sudo apt-get update
     sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
     sudo usermod -aG docker "$USER"
     ```

     Docker Engine runs as a systemd service: check that `/etc/wsl.conf` contains `[boot]` and `systemd=true` (add it if missing), then run `wsl --shutdown` from Windows and reopen Ubuntu. Verify with `docker version` and `docker compose version`.
  2. **Rancher Desktop** (Windows installer from rancherdesktop.io, using its WSL2 integration). It can also provide kubectl and Helm.
  3. **Podman** inside Ubuntu: `sudo apt-get install -y podman`. k3d targets the Docker API; check k3d's Podman notes before choosing this option.

## DN-003: k3d, kubectl and Helm are missing

- **Status:** closed (2026-10-18)
- **Resolution:** kubectl 1.37.1 from the Kubernetes apt repository (pkgs.k8s.io; its key downloaded over TLS and trusted without a fingerprint check), Helm 4.3.1 from get.helm.sh (SHA-256 checked against the `.sha256sum` file from the same server) and k3d 5.8.3 from its GitHub release (SHA-256 written into the script from the release's `checksums.txt`), installed by `tools/host/provision-ubuntu.sh` on the human's instruction (DN-001). Versions follow the §4.1 rule. DN-001 itemises the system-wide changes with their script lines: the Kubernetes apt key and source, `/usr/local/bin/helm` and `/usr/local/bin/k3d`. **For WP-0.2:** k3d 5.8.3's default k3s image runs Kubernetes 1.31, outside kubectl 1.37's supported version skew, so WP-0.2 pins a k3s image of a supported Kubernetes minor version.
- **Blocks:** nothing since it closed on 18 October 2026; until then, now (WP-0.2: the three-node dev cell, Helm charts, Argo CD)
- **Default in use:** none.
- **Who decides:** the human running the build (host owner).
- **Context:** BUILD-PROMPT "Before the first session" lists k3d, kubectl and Helm; §5.1 defines the dev cell as a three-node `k3d` cluster that uses the production Helm charts.
- **Options:** install all three inside Ubuntu after DN-001 and DN-002. Pin versions per §4.1 and record them in ADR-002.
  - **kubectl** (Kubernetes' published binary install, with checksum):

    ```bash
    KVER=$(curl -L -s https://dl.k8s.io/release/stable.txt)
    curl -LO "https://dl.k8s.io/release/${KVER}/bin/linux/amd64/kubectl"
    curl -LO "https://dl.k8s.io/release/${KVER}/bin/linux/amd64/kubectl.sha256"
    echo "$(cat kubectl.sha256)  kubectl" | sha256sum --check
    sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
    kubectl version --client
    ```

  - **Helm** (release tarball from get.helm.sh with its checksum; replace `<version>` with the pinned release):

    ```bash
    curl -LO https://get.helm.sh/helm-<version>-linux-amd64.tar.gz
    curl -LO https://get.helm.sh/helm-<version>-linux-amd64.tar.gz.sha256sum
    sha256sum --check helm-<version>-linux-amd64.tar.gz.sha256sum
    tar -xzf helm-<version>-linux-amd64.tar.gz
    sudo install -m 0755 linux-amd64/helm /usr/local/bin/helm
    helm version
    ```

  - **k3d** (the k3d project's install script, pinned with `TAG`):

    ```bash
    curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | TAG=<version> bash
    k3d version
    ```

    The k3d binary comes from GitHub releases, which run at 20–30 KB/s on this network, so allow for a slow download.
  - Rancher Desktop (DN-002 option 2) bundles kubectl and Helm; k3d is still needed for the three-node dev cell.

## DN-004: Rust stable and the Tauri 2 prerequisites (desktop shell)

- **Status:** closed (2026-10-18)
- **Resolution:** option 1. Rust 1.99.1 (rustup, stable toolchain, minimal profile) and the Tauri 2 Linux prerequisites (`libwebkit2gtk-4.1-dev`, `libxdo-dev`, `libssl-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, `build-essential`, `pkg-config`) are installed in Ubuntu by `tools/host/provision-ubuntu.sh` on the human's instruction (DN-001). `rustup-init.sh` was fetched from sh.rustup.rs over TLS and run unverified, and installed that day's stable toolchain; no Rust version is pinned. DN-001 itemises the changes with their script lines (the Tauri packages; rustup in the build user's home, with the line it adds to `~/.profile` and `~/.bashrc`). Windows packaging of the shell still needs a Windows build step, which a human provides when WP-0.7 needs it ("Before the first session").
- **Blocks:** nothing since it closed on 18 October 2026; until then, WP-0.7 (the Tauri shell with HAL interfaces and simulated devices). The web parts of WP-0.7 do not need it.
- **Default in use:** WP-0.7 web work (design system, banner, `ClinicalNumber`, locales and RTL, Playwright, axe and RTL-diff harnesses) can proceed without Rust; the Tauri shell waits and its absence is recorded as a known anomaly when WP-0.7 starts.
- **Who decides:** the human running the build (host owner).
- **Context:** BUILD-PROMPT "Before the first session" lists Rust stable and the Tauri 2 system prerequisites; §4.1 fixes Tauri 2 with a HAL; Windows packaging of the shell needs Windows and a human provides it when needed.
- **Options:**
  1. **Inside Ubuntu (recommended, after DN-001):**

     ```bash
     curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
     sudo apt-get update
     sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
     rustc --version && cargo --version
     ```

     Check the package list against the Tauri 2 prerequisites page before running it.
  2. On Windows instead: rustup-init.exe from rustup.rs plus the Microsoft C++ Build Tools and WebView2 that Tauri 2 lists for Windows. Needed in any case later for Windows packaging.
  3. Defer the shell: build the web parts of WP-0.7 now and the shell when Rust is available.

## DN-005: Host resources are below what the dev cell needs (lite cell)

- **Status:** open
- **Blocks:** now: WP-0.2 starts on the default, but its exit criterion on single-node loss needs this answer
- **Default in use:** until 19 October 2026, the lite cell as §5.1 defines it (one Kafka broker, two PostgreSQL instances, no Argo CD); since then option 4 below (three small PostgreSQL instances inside the lite cell; see the update of 19 October 2026). Every result from the lite cell is labelled "lite".
- **Update (18 October 2026, after DN-001):** `%UserProfile%\.wslconfig` gives the WSL VM 10 GB of memory, 8 processors and 8 GB of swap, which leaves about 5.6 GB for Windows. `tools/doctor` sets [P] guide thresholds for the cell profiles: the dev cell at 32 GB and 8 cores, the lite cell at 16 GB and 4 cores, and 50 GiB of free disk (OQ-094). The 10 GB VM is below the lite-cell guide too, so WP-0.2 measures what the lite cell actually uses on this host and records it before the threshold is confirmed or changed.
- **Update (19 October 2026).** **Default in use until the human answers:** the lite cell runs three small PostgreSQL instances with quorum synchronous replication (option 4), with one Kafka broker and no Argo CD as §5.1 defines; every result from it is labelled "lite".
  - **Why.** Two instances cannot show the single-node-loss criterion at all. Three are planned to fit the 10 GB VM: the WP-0.2 plan estimates about 5.4 GiB for the cell and 5.9 GiB for the whole VM, an estimate and not a measurement; the footprint test measures it (`docs/program/evidence/perf/`), and the figure is added here when a record exists. The change departs from §5.1's lite-cell definition by adding a PostgreSQL instance; it does not weaken any criterion.
  - **Status of the criterion until you choose.** The node-kill evidence is recorded and labelled lite. WP-0.2's third exit criterion is reported as "shown on the lite cell (three instances, DN-005 option 4, pending)", not as met.
  - **Your options.** Option 1: the records stay on file as indicative, and the criterion stays open (OQ-084). Options 2 and 3: the same commands run again on the larger host or on the reference cell. Option 4: you approve the three-instance lite cell and say whether its evidence meets the criterion.
  - **What the lite evidence cannot show.** Hardware faults (the nodes share one kernel, disk and power supply), clock skew between nodes, real network latency, and RTO on reference hardware (KA-014).
- **Who decides:** the human lead.
- **Context:** the host has 15.6 GB RAM and 8 logical cores. BUILD-PROMPT "Before the first session" asks for at least 32 GB of RAM and 8 cores for the Linux VM; with less, the agent uses the compose profile and a lite cell. **Consequence for WP-0.2:** its exit evidence includes "killing any single node (primary or standby) keeps PostgreSQL writable with no committed transaction lost, and losing two nodes stops writes instead of degrading to asynchronous". That behaviour needs three PostgreSQL instances with quorum synchronous replication (§5.1, §16.2). A lite cell with two instances cannot show it as written. The criterion is not weakened: on a lite cell that part of WP-0.2 stays open (recorded as OQ-084).
- **Options:**
  1. **Accept the lite cell** (the default until 19 October 2026) and leave the three-instance failover evidence open until a bigger host or the reference cell exists. Limit WSL2 so Windows keeps headroom, in `%UserProfile%\.wslconfig`:

     ```ini
     [wsl2]
     memory=10GB
     processors=8
     swap=8GB

     [experimental]
     autoMemoryReclaim=gradual
     ```

     This is the file in use. Raising `memory` (for example to 12GB) leaves Windows less headroom; run `wsl --shutdown` after any change.
  2. **A bigger host** that can give the Linux VM at least 32 GB of RAM and 8 cores, so the full dev cell runs.
  3. **Provide the reference cell early** (DN-009) and run the cell evidence there.
  4. Approve running three small PostgreSQL instances inside the lite cell (the default in use since 19 October 2026, pending this decision). This departs from §5.1's lite-cell definition, so it needs the human's decision.

## DN-006: Confirm the project-local Windows toolchain in `.tools/`

- **Status:** closed (2026-10-18)
- **Resolution:** confirmed by the human ("Please do all the steps you have full approval go ahead", 18 October 2026, in reply to the list that asked for this confirmation). The `.tools/` toolchain remains the Windows checkout's toolchain. On Linux, `tools/bootstrap` fetches the same kind of project-local toolchain into the WSL clone's `.tools/`.
- **Blocks:** nothing since it closed on 18 October 2026; until then, now (confirmation of how WP-0.1 was built on this host)
- **Default in use:** the project-local toolchain under `.tools/` (git-ignored), read as §3.4 item 9's "project-local tooling that the build fetches" (KA-002):
  - Eclipse Temurin JDK 25.0.4.1 (`.tools/jdk-25.0.4.1+1`), SHA-256 verified;
  - Gradle 9.8.1 unpacked in `.tools/gradle-9.8.1` and pre-seeded in the wrapper cache (`.tools/gradle-home`). The zip was fetched from the Aliyun mirror and verified against the official SHA-256 (`dce76f55f8e251a3a1f130eb120f30b3d271de2b76c9b0729d316b5a1b6dc01f`), because downloads from GitHub and services.gradle.org run at 20–30 KB/s here; `COMMANDS.md` §1 records the same mirror fetch in the WSL clone (`--gradle-mirror`). A deviation from §3.7 (see Context). The wrapper's `distributionUrl` stays the official services.gradle.org URL;
  - a Python 3.12 venv (`.tools/venv`) with PyYAML and jsonschema from PyPI.
- **Who decides:** the human lead.
- **Context:** fetching the `.tools/` toolchain installed nothing system-wide, changed no PATH or system setting and never ran `corepack enable`; the system changes on this host are DN-001's. §3.7 allows downloads from official registries. Two files on this host came from a mirror instead, and each is a recorded deviation from §3.7 whose content matches the official SHA-256: the Gradle 9.8.1 zip, from the Aliyun mirror (`dce76f55f8e251a3a1f130eb120f30b3d271de2b76c9b0729d316b5a1b6dc01f`, above), and the Ubuntu 24.04.5 WSL image, from `mirrors.edge.kernel.org` (`bb415d824822c4b878125729af451a5d18fb13d1cf5cbed9a7393ad64ac6039e`, DN-001).
- **Options:**
  1. Confirm the reading (default).
  2. Require official download sources only: re-fetch the Gradle distribution from services.gradle.org (slow on this network) and replace the cache entry.
  3. Stop Windows-host work until DN-001 is done and rebuild the toolchain inside WSL.

## DN-007: The host's Git sets `core.autocrlf=true`

- **Status:** open
- **Blocks:** later (other clones made on this host)
- **Default in use:** the repository sets `core.autocrlf=false` in its own configuration (`git config --local`), and `.gitattributes` (`* text=auto eol=lf`, a WP-0.1 deliverable) enforces LF for text files.
- **Who decides:** the host owner.
- **Context:** `git config --show-origin --show-scope --get-all core.autocrlf` shows `true` at system scope (`C:/Program Files/Git/etc/gitconfig`) and `false` at local scope. BUILD-PROMPT "Before the first session" asks for `git config --global core.autocrlf false`. Changing user or system Git configuration is a host-wide change for the human, not for the build agent.
- **Options:**
  1. Run `git config --global core.autocrlf false` (user scope; overrides the system value for this Windows user).
  2. Run `git config --system core.autocrlf false` from an elevated shell (all users).
  3. Leave it: the repository-local setting and `.gitattributes` already protect this repository.

## DN-008: Confirm the repository-local Git identity

- **Status:** open
- **Blocks:** later (authorship of the commits made in this repository)
- **Default in use:** `user.name "Ahmad"` and the account e-mail address are set in the repository's own configuration (`git config --local user.name` / `user.email`), because no identity was configured.
- **Who decides:** the repository owner.
- **Context:** the plan-of-record commit `ed023b6` already carries this identity. No global configuration was changed.
- **Options:**
  1. Confirm.
  2. Give a different name or address; later commits use it. Existing commits are not rewritten without your instruction (§3.6).

## DN-009: The reference cell hardware [HUMAN]

- **Status:** open
- **Blocks:** WP-0.6 (reference-cell runs of C7 and C9), the reference-cell install in the Phase 0 exit, and later the 300-bed day and release gates
- **Default in use:** dev-cell numbers labelled "indicative" (on this host, lite-cell numbers labelled "lite"). ADR-001 and ADR-009 stay accepted-provisional until a reference-cell run (§4.2, WP-0.6).
- **Who decides:** the human lead (hardware and budget).
- **Context:** §5.1 defines the reference cell as three servers of 32 cores, 128 GB and NVMe each, provided by a human; only reference-cell numbers count as evidence for C7, C9, the SLOs and release gates (§3.5). WP-0.6 itself can finish without it (C7 and C9 harnesses built and dry-run at reduced scale).
- **Options:**
  1. Provide the reference cell (name the date it will be available).
  2. Defer: Phase 0 closes with the reference-cell install and C7/C9 evidence waiting.

## DN-010: Git remote, hosted CI and real CODEOWNERS handles

- **Status:** open
- **Blocks:** later (pushing, pull requests, hosted CI, human code-review routing)
- **Default in use:** no remote; CI is `tools/ci/run <fast|merge|nightly|release>` run locally (§19.1); CODEOWNERS uses placeholder handles (KA-004); commits stay local (§3.6).
- **Who decides:** the human lead.
- **Context:** §3.6 allows pushing and pull requests only when a remote exists and the human asks. §19.1 says hosted-CI configuration is not evidence until it has run. SD-2 two-person review needs real human reviewers (§13.1).
- **Options:**
  1. Provide a remote (hosted or self-hosted), say whether hosted CI may run, and give the reviewer handles per module.
  2. Keep everything local for now.

## DN-011: Merging Phase 0 work packages before the merge tier exists

- **Status:** open
- **Blocks:** now (how finished work packages reach `main`)
- **Default in use:** every Phase 0 branch stays unmerged and the next work package branches from it ("stacking", §3.6), recorded in `STATUS.md`. WP-0.2 branches from `wp/0.1-programme-bootstrap`.
- **Who decides:** the human lead.
- **Context:** §3.6 merges a `wp/*` branch into `main` only after `tools/ci/run merge` passes on the merge candidate and the review has no unresolved critical or major findings. The merge tier fails closed while any of its steps is NOT-BUILT (KA-003, §19.1 "no shortcuts"). `sh tools/ci/run merge --list` names the work package that builds each step: WP-0.3 (Testcontainers integration tests, AsyncAPI contract tests, the N-1 migration test, coverage gates), WP-0.4 (OpenAPI contract tests), WP-0.7 (end-to-end smoke in three languages, axe, RTL visual diffs), WP-0.9 (ORT licence scan, vulnerability and container scans, SBOM), WP-1.1b (HL7 v2 conformance profiles), WP-1.5 (mutation tests on the first Tier 2 sidecar) and WP-1.12 (the FHIR validator). Read strictly, no work package can merge into `main` before WP-1.12, and the branches form a stack that long.
- **Options:**
  1. **Stack the branches** (default, as §3.6 says) and merge the stack into `main` in order once the merge tier passes (after WP-1.12).
  2. Merge a reviewed work package when every merge-tier step that exists passes and the NOT-BUILT steps are listed in the merge commit. This changes §3.6's rule, so it is the human's decision.

## DN-012: Four plan-of-record files are committed with CRLF line endings

- **Status:** open
- **Blocks:** later
- **Default in use:** the files stay as committed. The plan of record is read-only for the build, so the agent does not renormalise them. `tools/hms repo check` reports them as warnings, not errors, and the backlog generator gives the same result for LF and CRLF input (tested).
- **Who decides:** the human lead.
- **Context:** `git ls-files --eol` shows `i/crlf` for `BUILD-PROMPT.md`, `research/09-ai-analytics-digital-front-door.md`, `research/blueprint-drafts/proposal-A-market-business-first.md` and `research/blueprint-drafts/proposal-C-platform-architecture-first.md`. Every other text file is LF. `.gitattributes` (`* text=auto eol=lf`) does not rewrite files that are already committed with CRLF.
- **Options:**
  1. Leave them (default).
  2. Renormalise them in one commit (`git add --renormalize` on those four files). Only the line endings change; the text is identical.

## DN-013: Free disk on C: is below the guide

- **Status:** open
- **Blocks:** WP-0.2 (container images, the k3d cell's volumes, build caches)
- **Default in use:** continue. WP-0.2 records how much space the lite cell takes, and stops pulling images or creating volumes if C: falls below 15 GiB free [P], so the Windows system drive never fills.
- **Update (19 October 2026, measured on the WSL build host and the Windows host):**
  - C: had 29.33 GiB free (31,488,036,864 bytes, `df -B1 /mnt/c` in WSL; Windows reported the same), and the WSL virtual disk `ext4.vhdx` had grown to 20.67 GiB (22,191,013,888 bytes; 8.9 GB on 18 October).
  - Clearing the WP-0.2 prototype (the k3d cluster `hms-proto` and the five images no pin uses: RustFS 1.0.3, versitygw v1.4.1, CloudNativePG 1.27.1, the Strimzi 0.48.0 operator and Valkey 8.1) reduced Docker's images from 2.533 GB to 1.134 GB and its volumes from 3.766 GB (13 volumes) to none (`docker system df`). `df -h /mnt/c` showed 30G available both before and after (the free space before was not recorded more precisely): the virtual disk does not shrink when files inside it are deleted.
  - The 15 GiB stop line [P] is to be enforced by the cell tooling: `cell images mirror` and `cell up` will refuse to pull or create volumes below it (WP-0.2 slices S1 and S7; not built yet). Until then the cell owner checks `df -h /mnt/c` before every pull.
- **Who decides:** the host owner.
- **Context:** the WSL2 virtual disk (`ext4.vhdx`, 8.9 GB on 18 October 2026) lives on C:, which has about 35 GiB free (86% used); inside WSL the virtual disk reports about 950 GiB, which is only its maximum size. `tools/doctor` therefore counts the Windows drive too and reports 36.4 GiB free on C: against its [P] guide of 50 GiB (OQ-094; `docs/program/evidence/doctor/2026-10-18-d3e14de.txt`). The only other drive, G:, has about 33 GB free, so moving the distribution there gains nothing.
- **Options:**
  1. Free space on C: (for example old downloads, temporary files, and, if Docker Desktop is no longer used, the leftover `docker-desktop` WSL distribution that `wsl -l -v` still lists).
  2. Add a larger drive and move the distribution to it (`wsl --manage Ubuntu-24.04 --move <folder>` in Windows).
  3. Continue with the default and watch the figure; the doctor reports it on every run.

## DN-014: The CSO's reading of SI-14's "a measured PPV" for the day-0 CDS baseline [HUMAN]

- **Status:** open
- **Blocks:** WP-1.5 (the CDS foundation: the alert registry of the `cds` module with its tiers and silent mode, and the `CLN-CDS-03` PPV telemetry; CTRL-0014-4 and CTRL-0014-5 of HAZ-0014 in `docs/safety/hazard-log.yaml`)
- **Default in use:** the stricter interim reading, planned in the hazard log. Its tightening [P] (`docs/safety/README.md`, "Tightenings") is the strict reading of "a measured PPV": a rule without a measured PPV is not interruptive, and the vendor's validation of the go-live baseline does not count as one. The hazard log also plans the path of option 1 below, so that WP-1.5 can build it: a baseline rule (Tier A/B) with no measured PPV yet becomes interruptive only under an explicit exception for that rule that a human has approved, recorded only from a sign-off record (§3.5). That exception is the CSO's reading, not a tightening of this build, and none exists until the CSO decides; meanwhile promotion of a go-live bundle is blocked while a baseline rule has neither a measured PPV nor an exception. Nothing is built yet: every control is `planned`.
- **Who decides:** the CSO [HUMAN].
- **Context:** SI-14 (§2.1) reads: "Hard stops come only from a governed list. Every interruptive rule has an owner, evidence, a measured PPV and a review-by date. The vendor-validated go-live baseline (Tier A/B) is interruptive from day 0. New or locally modified rules run silent first. Tier A/B rules are never retired on override rate alone". §14.3 says why the baseline interrupts from day 0: "a first site has no order history to replay". Read word for word, a baseline rule at a first site has no locally measured PPV on day 0, so the second and third sentences meet there. How they fit together is a reading of a safety invariant, which is never the agent's decision (§3.4 item 1). The WP-0.1 hazard log planned a registry gate that left out the PPV and put the question in a README note; the automated review found that this narrowed the invariant (finding R-04, `docs/program/reviews/WP-0.1.md`).
- **Options:**
  1. **Keep the interim reading (default):** every interruptive rule needs a measured PPV, and each baseline rule that is to interrupt from day 0 needs an explicit exception that the CSO approves in a sign-off record. WP-1.5 builds the exception record and the promotion block.
  2. **Accept the PPV measured in the vendor's validation** of the baseline as "a measured PPV" until local telemetry measures one, recorded per rule in the registry with its source. A baseline rule with that evidence then needs no exception.
  3. **Another reading** that the CSO states; WP-1.5 builds the gate to it, and HAZ-0014's controls are changed to match.

## DN-015: WSL stops the distribution when it is idle, which powers off the whole cell [HUMAN]

- **Status:** open
- **Blocks:** nothing now; later, how reliable the cell's nightly runs are (WP-0.2's nightly chaos and cell steps, §18.7, §19.1)
- **Default in use:** during a cell session the cell owner keeps a detached keeper process running from Windows, and stops it at the end of the session: `Start-Process -WindowStyle Hidden wsl.exe -ArgumentList '-d','Ubuntu-24.04','--exec','sleep','infinity'`. The cell is created with fixed node addresses (OQ-122), so that a termination is survivable: the cell then restarts as after a power cut (KA-022), which the restart test R1 checks. The build agent changes no WSL setting (§3.4 item 9).
- **Who decides:** the host owner.
- **Context:** the planning session's read-only inspection of the systemd journal found that WSL stopped the distribution five times on 18 October 2026 between 17:47 and 21:40 (`InitTerminateInstanceInternal … calling reboot(RB_POWER_OFF)`); two boots lasted only 27 s and 25 s, which fits idle termination after the last `wsl.exe` exits. Each stop kills all three k3d nodes at once. The WP-0.2 prototype cluster then came back with its node addresses swapped, and its embedded etcd lost quorum; the prototype is not evidence and was deleted on 19 October 2026. Microsoft's WSL settings page (`learn.microsoft.com/windows/wsl/wsl-config`, updated 16 October 2026) documents two idle timers in `%UserProfile%\.wslconfig`: `instanceIdleTimeout` in `[general]`, the milliseconds a distribution may be idle before it is shut down (default 15000; -1 disables it), and `vmIdleTimeout` in `[wsl2]`, the milliseconds the VM may be idle before it is shut down (default 60000; Windows 11 only).
- **Options:**
  1. **Keep the default** (the keeper process during cell sessions, fixed node addresses). Every termination outside a session is still a whole-cell power cut.
  2. **Turn off idle shutdown of the distribution** in `%UserProfile%\.wslconfig`, then run `wsl --shutdown`:

     ```ini
     [general]
     instanceIdleTimeout=-1
     ```

     The VM then keeps its memory (up to the 10 GB limit) until `wsl --shutdown` or a Windows restart. Check with `wsl --version` that the installed WSL (2.6.3 on 18 October 2026) supports the key, and Microsoft's page for its current name.
  3. Option 2, and run the nightly tier only while the keeper process is up.

## DN-016: `fs.inotify.max_user_instances` is 128 in WSL [HUMAN]

- **Status:** open
- **Blocks:** nothing now; the cell, if k3s or a pod fails with "too many open files"
- **Default in use:** continue with 128. If k3s or a pod logs "too many open files", work on the cell stops and this item moves to "Blocking now". The build agent changes no system setting (§3.4 item 9).
- **Who decides:** the host owner.
- **Context:** read in WSL on 19 October 2026: `fs.inotify.max_user_instances = 128`, `fs.inotify.max_user_watches = 524288`. The three k3s nodes run as containers on the VM's one kernel, so their kubelets, containerd instances and pods share the per-user inotify instance limit; clusters of several nodes on one host are known to exhaust 128.
- **Options:**
  1. **Raise the limit to 512 and keep it across restarts** (in Ubuntu):

     ```sh
     sudo sysctl -w fs.inotify.max_user_instances=512
     echo 'fs.inotify.max_user_instances = 512' | sudo tee /etc/sysctl.d/90-hms-inotify.conf
     ```

  2. **Keep 128** (default) and act only if the error appears.

## DN-017: Two cell images fail the licence policy: the PostgreSQL licence is not classified, and BusyBox (GPL-2.0) has no licence-register entry

- **Status:** closed (2026-10-19)
- **Resolution:** option 1, the human lead's answer of 19 October 2026, asked in chat with two questions:
  - **PostgreSQL.** Question: "...the database we chose, PostgreSQL, uses its own free licence (similar to MIT/BSD). Our build plan already names it, but the licence list doesn't include it yet. Add it to the approved list?" Answer: "Approve it (Recommended)" (option text: "Add the PostgreSQL licence to the allowed list. It's a permissive open-source licence, and the plan and architecture decision already assume it.").
  - **BusyBox.** Question: "...k3s uses a tiny helper tool called BusyBox to create storage folders. It's under the GPL licence. Our rules allow GPL only as an unchanged, separate container, and only if we offer its source code. How should we handle it?" Answer: "Allow, with source offer (Recommended)" (option text: "Record it in the licence register as an unmodified separate container, and publish where customers can get BusyBox's source code. This is the standard way everyone ships k3s.").
  - Applied as option 1 words it: `PostgreSQL` is in `allowed` in `tools/licence/policy.yaml` and in `tools/licence/ort/license-classifications.yml`; `tools/licence/register.yaml` has the entry `component: '^pkg:docker/rancher/mirrored-library-busybox@'`, `licence: GPL-2.0-only`, `rule: gpl-separate-container`, `unmodified: true`, `added_in: WP-0.2`, and a `source_offer` saying the product publishes BusyBox 1.37.0's source with every site release, on the release media and where customers obtain the release (not published yet: no release exists; the release pipeline, WP-0.9, builds it). `tools/hms cell lint` then passes (`licences_allowed=26, licences_conditional_registered=1`).
- **Blocks:** nothing since it closed on 19 October 2026; until then, now: the fast tier's new `cell-lint` step (WP-0.2 slice S1) failed on these two images, so no commit that adds it could pass the fast tier (§3.6). Nothing else waited on it: the images are mirrored and signed in the lite cell's local registry, which ships nothing.
- **Default in use (until it closed):** none that passes. The lint fails closed: adding a licence to the policy, or recording a GPL component with a source offer, is stop-and-ask item 2 (§3.4), and `tools/licence/policy.yaml` says to record such a case here rather than edit the policy to make a check pass.
- **Who decides:** the human lead.
- **Context** (`tools/hms cell lint`, 19 October 2026, on the Windows host and the WSL build host):
  1. **PostgreSQL.** `ghcr.io/cloudnative-pg/postgresql` (18.6, `minimal-trixie`) carries PostgreSQL itself, under the PostgreSQL Licence (SPDX `PostgreSQL`); the image's OCI label says Apache-2.0, the licence of CloudNativePG's build files. §4.1 names the PostgreSQL licence for the database, and ADR-001 says it is on the allowlist, but §4.3's allowlist does not list it and `tools/licence/policy.yaml` does not classify it, so the evaluator reports it "unmapped".
  2. **BusyBox.** k3s's local-path provisioner starts helper pods from `rancher/mirrored-library-busybox:1.37.0` (BusyBox, GPL-2.0-only) to create and remove volume directories, so every cell that uses local-path volumes ships it. §4.3 allows GPL "only as unmodified, separate containers with a source offer", and the policy's `gpl-separate-container` rule asks for a licence-register entry with `source_offer`. busybox.net lists 1.37.0 (27 September 2024) as an unstable release, and the 1.37 line has no patch release: the version is k3s's default, not one §4.1's rule would pick, which also bears on option 2.
  - The lint checks the licence each image declares. What is inside an image (the GPL tools inside the k3s image, OpenJDK inside Kafka and Keycloak, UBI packages) is not scanned until WP-0.9 (KA-019, OQ-133).
- **Options:**
  1. Add `PostgreSQL` to `allowed` in `tools/licence/policy.yaml` and to `tools/licence/ort/license-classifications.yml` (as §4.1 and ADR-001 read it), and add a licence-register entry for the BusyBox image: `component: '^pkg:docker/rancher/mirrored-library-busybox@'`, `licence: GPL-2.0-only`, `rule: gpl-separate-container`, `unmodified: true`, `source_offer:` where the product will publish BusyBox 1.37.0's source, `added_in: WP-0.2`.
  2. As option 1 for PostgreSQL; and replace the BusyBox helper with an image under an allowlisted licence (k3s's `local-path-config` ConfigMap names the helper image), recorded as a deviation from k3s's defaults.
  3. Another rule that the human states.
