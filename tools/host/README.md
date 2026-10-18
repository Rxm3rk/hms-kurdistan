# Build host provisioning

`provision-ubuntu.sh` turns an Ubuntu 24.04 machine (a WSL2 distribution or a native install) into the HMS Kurdistan
build host that BUILD-PROMPT.md "Before the first session" describes: Docker Engine from Docker's apt repository,
kubectl, Helm, k3d, JDK 25, Node.js 24 LTS with Corepack, Python 3.12, Rust stable (rustup) and the Tauri 2
prerequisites. It is idempotent and verifies every downloaded binary against its publisher's SHA-256. Run it as root.

It is a host-preparation step, not part of the build: the build itself never installs system software
(BUILD-PROMPT.md §3.4 item 9). The human who owns the host ran it on 2026-10-18 with explicit approval; see
`docs/program/DECISIONS-NEEDED.md` (DN-001 to DN-004) for the record.

## Windows hosts (WSL2)

1. Install or repair WSL 2 and install Ubuntu 24.04 (`wsl --install -d Ubuntu-24.04`, or
   `wsl --install --from-file <verified .wsl image> --name Ubuntu-24.04`).
2. Size the VM in `%UserProfile%\.wslconfig` (the dev cell wants 32 GB; on smaller hosts use the lite cell, §5.1).
3. Run `wsl -d Ubuntu-24.04 -u root -- bash tools/host/provision-ubuntu.sh` from the repository root.

`tools/doctor` (run inside the Linux host) reports anything still missing.
