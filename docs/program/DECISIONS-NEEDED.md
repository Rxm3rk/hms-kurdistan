# Decisions needed

Only items that block work belong here (BUILD-PROMPT §3.1, §3.4). Each item has an ID (DN-nnn), a status (`open`, `answered`, `closed`), what it blocks (`now`, a work package, or `later`), the default in use, who decides, the context and the options. Questions that do not block work yet are in `OPEN-QUESTIONS.md`; the [L] register is in `ASSUMPTIONS.md`.

The build agent never installs system software, enables OS features or changes system-wide settings (§3.4 item 9). The commands below are for the human to run. They follow each vendor's published installation route; check the vendor's current page before running them. Where a version must be chosen, apply the §4.1 rule (newest generally available release that has had at least one patch release) and record the pinned set in ADR-002.

## Blocking now

At most ten items. Answer these first.

1. **DN-005** The lite cell cannot show WP-0.2's single-node-loss criterion: choose how it will be met. WP-0.2 starts now on the default.
2. **DN-011** No work package can merge into `main` until the merge tier exists and passes: confirm that the Phase 0 branches stack meanwhile, or choose another rule.

Next to block (not "now"): DN-009 for reference-cell runs (WP-0.6 and the Phase 0 exit); DN-010 for pushing, pull requests and human review routing.

Closed on 18 October 2026: DN-001 to DN-004 (the Linux build host was provisioned at the human's instruction) and DN-006 (confirmed).

## Host check

`tools/doctor` (WP-0.1) is the recorded check; its output is stored under `docs/program/evidence/doctor/`. This table compares the morning check, made with version commands, with the host after provisioning.

| Prerequisite ("Before the first session") | Found on 18 Oct 2026, morning (Windows only) | After provisioning (18 Oct 2026) | Item |
|---|---|---|---|
| Linux: WSL2 with Ubuntu 24.04, repository in the WSL file system | `wsl --status` failed ("The system cannot find the file specified."): most of WSL 2.6.3's files were missing | WSL 2.6.3 repaired; Ubuntu 24.04.5 LTS is the default distribution. The Linux gates run in the clone `~/src/hospitalmanagementsystem` (KA-001) | DN-001, closed |
| Container engine (Docker Engine in WSL2, Rancher Desktop or Podman) | `docker`, `podman`, `nerdctl` not on PATH | Docker Engine 29.9.1 with Compose 5.6.0 in WSL; user `surface` in the `docker` group | DN-002, closed |
| k3d, kubectl and Helm | none on PATH | k3d 5.8.3, kubectl 1.37.1, Helm 4.3.1 in WSL | DN-003, closed |
| JDK 25 | no system `java`; project-local Temurin 25.0.4.1 in `.tools/` | OpenJDK 25.0.4.1 (Ubuntu package) in WSL; every checkout also gets a project-local JDK 25 from `tools/bootstrap` | DN-006, closed |
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
  - WSL 2.6.3 was registered as installed but most of its files were missing. It was repaired from Windows' cached copy of the official installer (`wsl.2.6.3.0.x64.msi`), whose SHA-256 matched Microsoft's published release; the human approved the administrator prompt and pointed the repair at the verified copy. No reboot was needed.
  - Ubuntu 24.04.5 LTS was installed from the `mirrors.edge.kernel.org` copy of the official WSL image (`ubuntu-24.04.5-wsl-amd64.wsl`), verified against the SHA-256 Microsoft publishes for it (`bb415d82…039e`), because the Ubuntu server ran at about 60 KB/s. It is the default distribution, with the Linux user `surface` (uid 1000).
  - `%UserProfile%\.wslconfig` gives the VM 10 GB of memory, 8 processors and 8 GB of swap (DN-005).
  - Everything inside Ubuntu is reproducible: `tools/host/provision-ubuntu.sh` (run as root; idempotent, a second run changed nothing; every downloaded binary is verified against its publisher's checksum).
  - The repository stays on the Windows file system, where the agent host (T3 Code) opens it. The Linux gates run in a clone in the WSL file system, `~/src/hospitalmanagementsystem`, at committed SHAs (KA-001).
- **Blocks:** now (WP-0.2 and everything that depends on it; see `WORK-PACKAGES.md`)
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
- **Resolution:** option 1, Docker Engine 29.9.1 and Compose 5.6.0 from Docker's apt repository inside Ubuntu, installed by `tools/host/provision-ubuntu.sh` on the human's instruction (DN-001). Systemd is on in the Ubuntu 24.04 WSL image, `surface` is in the `docker` group, and `docker run hello-world` succeeded. Pull speeds measured from WSL: ghcr.io about 10 MB/s, quay.io about 18 MB/s, Docker Hub about 3 MB/s.
- **Blocks:** now (WP-0.2: the `docker compose` dev stack and the k3d dev cell; the merge tier's Testcontainers integration tests)
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
- **Resolution:** kubectl 1.37.1 from the Kubernetes apt repository (pkgs.k8s.io), Helm 4.3.1 from get.helm.sh (SHA-256 checked) and k3d 5.8.3 from its GitHub release (SHA-256 checked against the release's `checksums.txt`), installed by `tools/host/provision-ubuntu.sh` on the human's instruction (DN-001). Versions follow the §4.1 rule. **For WP-0.2:** k3d 5.8.3's default k3s image runs Kubernetes 1.31, outside kubectl 1.37's supported version skew, so WP-0.2 pins a k3s image of a supported Kubernetes minor version.
- **Blocks:** now (WP-0.2: the three-node dev cell, Helm charts, Argo CD)
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
- **Resolution:** option 1. Rust 1.99.1 (rustup, stable toolchain, minimal profile) and the Tauri 2 Linux prerequisites (`libwebkit2gtk-4.1-dev`, `libxdo-dev`, `libssl-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, `build-essential`, `pkg-config`) are installed in Ubuntu by `tools/host/provision-ubuntu.sh` on the human's instruction (DN-001). Windows packaging of the shell still needs a Windows build step, which a human provides when WP-0.7 needs it ("Before the first session").
- **Blocks:** WP-0.7 (the Tauri shell with HAL interfaces and simulated devices). The web parts of WP-0.7 do not need it.
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
- **Default in use:** the lite cell (§5.1: one Kafka broker, two PostgreSQL instances, no Argo CD), with every result from it labelled "lite".
- **Update (18 October 2026, after DN-001):** `%UserProfile%\.wslconfig` gives the WSL VM 10 GB of memory, 8 processors and 8 GB of swap, which leaves about 5.6 GB for Windows. `tools/doctor` sets [P] guide thresholds for the cell profiles: the dev cell at 32 GB and 8 cores, the lite cell at 16 GB and 4 cores, and 50 GiB of free disk (OQ-094). The 10 GB VM is below the lite-cell guide too, so WP-0.2 measures what the lite cell actually uses on this host and records it before the threshold is confirmed or changed.
- **Who decides:** the human lead.
- **Context:** the host has 15.6 GB RAM and 8 logical cores. BUILD-PROMPT "Before the first session" asks for at least 32 GB of RAM and 8 cores for the Linux VM; with less, the agent uses the compose profile and a lite cell. **Consequence for WP-0.2:** its exit evidence includes "killing any single node (primary or standby) keeps PostgreSQL writable with no committed transaction lost, and losing two nodes stops writes instead of degrading to asynchronous". That behaviour needs three PostgreSQL instances with quorum synchronous replication (§5.1, §16.2). A lite cell with two instances cannot show it as written. The criterion is not weakened: on a lite cell that part of WP-0.2 stays open (recorded as OQ-084).
- **Options:**
  1. **Accept the lite cell** (default) and leave the three-instance failover evidence open until a bigger host or the reference cell exists. Limit WSL2 so Windows keeps headroom, in `%UserProfile%\.wslconfig`:

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
  4. Approve running three small PostgreSQL instances inside the lite cell. This departs from §5.1's lite-cell definition, so it needs the human's decision.

## DN-006: Confirm the project-local Windows toolchain in `.tools/`

- **Status:** closed (2026-10-18)
- **Resolution:** confirmed by the human ("Please do all the steps you have full approval go ahead", 18 October 2026, in reply to the list that asked for this confirmation). The `.tools/` toolchain remains the Windows checkout's toolchain. On Linux, `tools/bootstrap` fetches the same kind of project-local toolchain into the WSL clone's `.tools/`.
- **Blocks:** now (confirmation of how WP-0.1 was built on this host)
- **Default in use:** the project-local toolchain under `.tools/` (git-ignored), read as §3.4 item 9's "project-local tooling that the build fetches" (KA-002):
  - Eclipse Temurin JDK 25.0.4.1 (`.tools/jdk-25.0.4.1+1`), SHA-256 verified;
  - Gradle 9.8.1 unpacked in `.tools/gradle-9.8.1` and pre-seeded in the wrapper cache (`.tools/gradle-home`). The zip was fetched from the Aliyun mirror and verified against the official SHA-256 (`dce76f55f8e251a3a1f130eb120f30b3d271de2b76c9b0729d316b5a1b6dc01f`), because downloads from GitHub and services.gradle.org run at 20–30 KB/s here. The wrapper's `distributionUrl` stays the official services.gradle.org URL;
  - a Python 3.12 venv (`.tools/venv`) with PyYAML and jsonschema from PyPI.
- **Who decides:** the human lead.
- **Context:** nothing was installed system-wide, no PATH or system setting was changed and `corepack enable` was not run. The mirror download is the one place where a file did not come straight from the official source; its content matches the official checksum.
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
