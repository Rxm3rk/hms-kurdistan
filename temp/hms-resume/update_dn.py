"""Updates docs/program/DECISIONS-NEEDED.md for the provisioned host (18 Oct 2026)."""
import sys
from pathlib import Path

p = Path(sys.argv[1]) / "docs/program/DECISIONS-NEEDED.md"
s = p.read_text(encoding="utf-8")


def rep(old, new):
    global s
    assert s.count(old) == 1, ("not unique/absent", old[:80])
    s = s.replace(old, new)


start = s.index("## Blocking now")
end = s.index("\n---\n", start)
s = s[:start] + """## Blocking now

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
| At least 32 GB RAM and 8 cores for the Linux VM | 15.6 GB RAM, 8 logical cores | The VM has 10 GB of memory, 8 processors and 8 GB of swap (`%UserProfile%\\.wslconfig`) | DN-005, open |
| Reference cell (three servers, 32 cores, 128 GB, NVMe each) | none | none | DN-009, open |
""" + s[end:]

rep("""## DN-001: No Linux build host (WSL2 with Ubuntu 24.04 is not installed)

- **Status:** open
- **Blocks:** now (WP-0.2 and everything that depends on it; see `WORK-PACKAGES.md`)""",
"""## DN-001: No Linux build host (WSL2 with Ubuntu 24.04 is not installed)

- **Status:** closed (2026-10-18)
- **Resolution:** the human answered "Please do all the steps you have full approval go ahead" (18 October 2026), in reply to the list of host decisions. On that instruction the build agent carried out the host steps itself. This deviates from §3.4 item 9 and "Before the first session", which give host installation to the human; the human's explicit instruction is the authority, and it is recorded here.
  - WSL 2.6.3 was registered as installed but most of its files were missing. It was repaired from Windows' cached copy of the official installer (`wsl.2.6.3.0.x64.msi`), whose SHA-256 matched Microsoft's published release; the human approved the administrator prompt and pointed the repair at the verified copy. No reboot was needed.
  - Ubuntu 24.04.5 LTS was installed from the `mirrors.edge.kernel.org` copy of the official WSL image (`ubuntu-24.04.5-wsl-amd64.wsl`), verified against the SHA-256 Microsoft publishes for it (`bb415d82…039e`), because the Ubuntu server ran at about 60 KB/s. It is the default distribution, with the Linux user `surface` (uid 1000).
  - `%UserProfile%\\.wslconfig` gives the VM 10 GB of memory, 8 processors and 8 GB of swap (DN-005).
  - Everything inside Ubuntu is reproducible: `tools/host/provision-ubuntu.sh` (run as root; idempotent, a second run changed nothing; every downloaded binary is verified against its publisher's checksum).
  - The repository stays on the Windows file system, where the agent host (T3 Code) opens it. The Linux gates run in a clone in the WSL file system, `~/src/hospitalmanagementsystem`, at committed SHAs (KA-001).
- **Blocks:** now (WP-0.2 and everything that depends on it; see `WORK-PACKAGES.md`)""")

rep("""## DN-002: No container engine

- **Status:** open""", """## DN-002: No container engine

- **Status:** closed (2026-10-18)
- **Resolution:** option 1, Docker Engine 29.9.1 and Compose 5.6.0 from Docker's apt repository inside Ubuntu, installed by `tools/host/provision-ubuntu.sh` on the human's instruction (DN-001). Systemd is on in the Ubuntu 24.04 WSL image, `surface` is in the `docker` group, and `docker run hello-world` succeeded. Pull speeds measured from WSL: ghcr.io about 10 MB/s, quay.io about 18 MB/s, Docker Hub about 3 MB/s.""")

rep("""## DN-003: k3d, kubectl and Helm are missing

- **Status:** open""", """## DN-003: k3d, kubectl and Helm are missing

- **Status:** closed (2026-10-18)
- **Resolution:** kubectl 1.37.1 from the Kubernetes apt repository (pkgs.k8s.io), Helm 4.3.1 from get.helm.sh (SHA-256 checked) and k3d 5.8.3 from its GitHub release (SHA-256 checked against the release's `checksums.txt`), installed by `tools/host/provision-ubuntu.sh` on the human's instruction (DN-001). Versions follow the §4.1 rule. **For WP-0.2:** k3d 5.8.3's default k3s image runs Kubernetes 1.31, outside kubectl 1.37's supported version skew, so WP-0.2 pins a k3s image of a supported Kubernetes minor version.""")

rep("""## DN-004: Rust stable and the Tauri 2 prerequisites (desktop shell)

- **Status:** open""", """## DN-004: Rust stable and the Tauri 2 prerequisites (desktop shell)

- **Status:** closed (2026-10-18)
- **Resolution:** option 1. Rust 1.99.1 (rustup, stable toolchain, minimal profile) and the Tauri 2 Linux prerequisites (`libwebkit2gtk-4.1-dev`, `libxdo-dev`, `libssl-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, `build-essential`, `pkg-config`) are installed in Ubuntu by `tools/host/provision-ubuntu.sh` on the human's instruction (DN-001). Windows packaging of the shell still needs a Windows build step, which a human provides when WP-0.7 needs it ("Before the first session").""")

rep("""## DN-006: Confirm the project-local Windows toolchain in `.tools/`

- **Status:** open
- **Blocks:** now (confirmation of how WP-0.1 was built on this host)""", """## DN-006: Confirm the project-local Windows toolchain in `.tools/`

- **Status:** closed (2026-10-18)
- **Resolution:** confirmed by the human ("Please do all the steps you have full approval go ahead", 18 October 2026, in reply to the list that asked for this confirmation). The `.tools/` toolchain remains the Windows checkout's toolchain. On Linux, `tools/bootstrap` fetches the same kind of project-local toolchain into the WSL clone's `.tools/`.
- **Blocks:** now (confirmation of how WP-0.1 was built on this host)""")

rep("""- **Status:** open
- **Blocks:** WP-0.2 (the dev cell profile and its exit evidence)
- **Default in use:** the lite cell (§5.1: one Kafka broker, two PostgreSQL instances, no Argo CD), with every result from it labelled "lite".""",
"""- **Status:** open
- **Blocks:** now: WP-0.2 starts on the default, but its exit criterion on single-node loss needs this answer
- **Default in use:** the lite cell (§5.1: one Kafka broker, two PostgreSQL instances, no Argo CD), with every result from it labelled "lite".
- **Update (18 October 2026, after DN-001):** `%UserProfile%\\.wslconfig` gives the WSL VM 10 GB of memory, 8 processors and 8 GB of swap, which leaves about 5.6 GB for Windows. `tools/doctor` sets [P] guide thresholds for the cell profiles: the dev cell at 32 GB and 8 cores, the lite cell at 16 GB and 4 cores, and 50 GiB of free disk (OQ-094). The 10 GB VM is below the lite-cell guide too, so WP-0.2 measures what the lite cell actually uses on this host and records it before the threshold is confirmed or changed.""")

rep("""     ```ini
     [wsl2]
     memory=12GB
     processors=8
     swap=8GB
     ```

     Then run `wsl --shutdown` and reopen Ubuntu. The values are an example for a 15.6 GB host; adjust them to the work running on Windows.""",
"""     ```ini
     [wsl2]
     memory=10GB
     processors=8
     swap=8GB

     [experimental]
     autoMemoryReclaim=gradual
     ```

     This is the file in use. Raising `memory` (for example to 12GB) leaves Windows less headroom; run `wsl --shutdown` after any change.""")

s = s.rstrip("\n") + """

## DN-011: Merging Phase 0 work packages before the merge tier exists

- **Status:** open
- **Blocks:** now (how finished work packages reach `main`)
- **Default in use:** every Phase 0 branch stays unmerged and the next work package branches from it ("stacking", §3.6), recorded in `STATUS.md`. WP-0.2 branches from `wp/0.1-programme-bootstrap`.
- **Who decides:** the human lead.
- **Context:** §3.6 merges a `wp/*` branch into `main` only after `tools/ci/run merge` passes on the merge candidate and the review has no unresolved critical or major findings. The merge tier fails closed while any of its steps is NOT-BUILT (KA-003, §19.1 "no shortcuts"). Its steps arrive with WP-0.2 (Testcontainers integration tests; licence, vulnerability and container scans), WP-0.3 (migration upgrade-and-rollback, contract tests), WP-0.7 (end-to-end smoke in three languages, axe, RTL visual diffs) and WP-0.9 (SBOM). So no Phase 0 work package can merge until late in Phase 0, and the branches form a long stack.
- **Options:**
  1. **Stack the branches** (default, as §3.6 says) and merge the stack into `main` in order once the merge tier passes.
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
"""
p.write_text(s, encoding="utf-8", newline="\n")
print("ok")
