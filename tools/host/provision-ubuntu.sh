#!/bin/bash
# Provision Ubuntu 24.04 (WSL2) as the HMS Kurdistan build host (BUILD-PROMPT.md "Before the first session").
# Idempotent; run as root: sudo bash tools/host/provision-ubuntu.sh (or, from Windows, wsl -d Ubuntu-24.04 -u root -- bash tools/host/provision-ubuntu.sh).
# Set BUILD_USER to the non-root account that runs the build (default: surface). tools/host/README.md says what
# is verified and what is trusted: Helm, k3d and Node.js are pinned and checked against a SHA-256 before install
# (k3d's is written below; Helm's and Node.js's checksum files come from the same servers over TLS), and apt checks
# each package against its repository's key. Trusted on TLS alone: the Docker and Kubernetes apt keys (Corretto's
# too, if its fallback runs) and rustup-init.sh, which runs unverified and installs that day's stable Rust. No apt
# package or Rust version is pinned (kubectl follows its 1.37 channel). The build does not use the OpenJDK installed
# here: tools/ci/run and tools/bootstrap env put the pinned JDK in .tools/ first (ADR-002). System-wide changes, each
# with its line in DN-001 (docs/program/DECISIONS-NEEDED.md): apt-get upgrade; apt keys, sources and packages; the
# docker group and services; /opt, /usr/local/bin; the build user's Rust, profiles, git config; the hello-world image.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
BUILD_USER=${BUILD_USER:-surface}
KUBECTL_MINOR=v1.37
HELM_VERSION=v4.3.1
NODE_VERSION=v24.22.0
K3D_VERSION=v5.8.3
K3D_SHA256=dbaa79a76ace7f4ca230a1ff41dc7d8a5036a8ad0309e9c54f9bf3836dbe853e  # from the release checksums.txt
log() { printf '\n==> %s\n' "$*"; }

log "apt base packages"
apt-get update -qq
apt-get -y -qq upgrade
apt-get install -y -qq build-essential curl wget git unzip zip xz-utils ca-certificates gnupg pkg-config file jq \
  python3 python3-venv python3-pip rsync socat lsb-release apt-transport-https

log "Docker Engine (docker.com apt repository)"
install -m 0755 -d /etc/apt/keyrings
if [ ! -s /etc/apt/keyrings/docker.asc ]; then
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
fi
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list

log "kubectl (pkgs.k8s.io ${KUBECTL_MINOR})"
if [ ! -s /etc/apt/keyrings/kubernetes-apt-keyring.gpg ]; then
  curl -fsSL "https://pkgs.k8s.io/core:/stable:/${KUBECTL_MINOR}/deb/Release.key" | gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg
  chmod a+r /etc/apt/keyrings/kubernetes-apt-keyring.gpg
fi
echo "deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/${KUBECTL_MINOR}/deb/ /" > /etc/apt/sources.list.d/kubernetes.list

apt-get update -qq
apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin kubectl
usermod -aG docker "$BUILD_USER"
systemctl enable --now docker containerd

log "JDK 25"
if apt-cache show openjdk-25-jdk-headless >/dev/null 2>&1; then
  apt-get install -y -qq openjdk-25-jdk-headless
else
  echo "openjdk-25-jdk-headless not in the Ubuntu archive; install Corretto 25 instead" >&2
  if [ ! -s /etc/apt/keyrings/corretto.gpg ]; then
    curl -fsSL https://apt.corretto.aws/corretto.key | gpg --dearmor -o /etc/apt/keyrings/corretto.gpg
  fi
  echo "deb [signed-by=/etc/apt/keyrings/corretto.gpg] https://apt.corretto.aws stable main" > /etc/apt/sources.list.d/corretto.list
  apt-get update -qq && apt-get install -y -qq java-25-amazon-corretto-jdk
fi

log "Helm ${HELM_VERSION}"
if ! command -v helm >/dev/null || [ "$(helm version --template '{{.Version}}' 2>/dev/null)" != "$HELM_VERSION" ]; then
  tmp=$(mktemp -d); cd "$tmp"
  curl -fsSLO "https://get.helm.sh/helm-${HELM_VERSION}-linux-amd64.tar.gz"
  curl -fsSLO "https://get.helm.sh/helm-${HELM_VERSION}-linux-amd64.tar.gz.sha256sum"
  sha256sum -c "helm-${HELM_VERSION}-linux-amd64.tar.gz.sha256sum"
  tar -xzf "helm-${HELM_VERSION}-linux-amd64.tar.gz" && install -m 0755 linux-amd64/helm /usr/local/bin/helm
  cd / && rm -rf "$tmp"
fi

log "k3d ${K3D_VERSION}"
if ! command -v k3d >/dev/null || ! k3d version 2>/dev/null | grep -q "k3d version ${K3D_VERSION}"; then
  tmp=$(mktemp -d); cd "$tmp"
  # GitHub release downloads can be very slow on some networks; a copy verified elsewhere may be passed as $K3D_BINARY.
  if [ -n "${K3D_BINARY:-}" ]; then cp "$K3D_BINARY" k3d-linux-amd64; else curl -fsSLo k3d-linux-amd64 "https://github.com/k3d-io/k3d/releases/download/${K3D_VERSION}/k3d-linux-amd64"; fi
  echo "${K3D_SHA256}  k3d-linux-amd64" | sha256sum -c -
  install -m 0755 k3d-linux-amd64 /usr/local/bin/k3d
  cd / && rm -rf "$tmp"
fi

log "Node.js ${NODE_VERSION}"
if [ ! -x "/opt/node-${NODE_VERSION}-linux-x64/bin/node" ]; then
  tmp=$(mktemp -d); cd "$tmp"
  curl -fsSLO "https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-linux-x64.tar.xz"
  curl -fsSL "https://nodejs.org/dist/${NODE_VERSION}/SHASUMS256.txt" | grep " node-${NODE_VERSION}-linux-x64.tar.xz\$" > SHASUMS256.txt
  sha256sum -c SHASUMS256.txt
  tar -xJf "node-${NODE_VERSION}-linux-x64.tar.xz" -C /opt
  cd / && rm -rf "$tmp"
fi
for b in node npm npx corepack; do ln -sf "/opt/node-${NODE_VERSION}-linux-x64/bin/$b" "/usr/local/bin/$b"; done

log "Tauri 2 Linux prerequisites"
apt-get install -y -qq libwebkit2gtk-4.1-dev libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev

log "Rust stable (rustup, as ${BUILD_USER})"
if [ ! -x "/home/${BUILD_USER}/.cargo/bin/rustc" ]; then
  su - "$BUILD_USER" -c 'curl --proto "=https" --tlsv1.2 -fsSL https://sh.rustup.rs -o /tmp/rustup-init.sh && sh /tmp/rustup-init.sh -y --profile minimal --default-toolchain stable && rm /tmp/rustup-init.sh'
fi

log "git settings for ${BUILD_USER}"
su - "$BUILD_USER" -c 'git config --global core.autocrlf false; git config --global init.defaultBranch main'

log "versions"
lsb_release -ds; docker --version; docker compose version; kubectl version --client 2>/dev/null | head -1; helm version --short; k3d version | head -1
java -version 2>&1 | head -1; node --version; corepack --version; python3 --version; git --version
su - "$BUILD_USER" -c '. ~/.cargo/env && rustc --version && cargo --version'
docker run --rm hello-world | grep -m1 "Hello from Docker"
echo PROVISION-OK
