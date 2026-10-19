#!/bin/bash
# Provision Ubuntu 24.04 (WSL2) as the HMS Kurdistan build host (BUILD-PROMPT.md "Before the first session").
# Idempotent; run as root. Every downloaded binary is verified against its publisher's SHA-256.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
BUILD_USER=surface
KUBECTL_MINOR=v1.37
HELM_VERSION=v4.3.1
NODE_VERSION=v24.22.0
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
lsb_release -ds; docker --version; docker compose version; kubectl version --client 2>/dev/null | head -1; helm version --short
java -version 2>&1 | head -1; node --version; corepack --version; python3 --version; git --version
su - "$BUILD_USER" -c '. ~/.cargo/env && rustc --version && cargo --version'
docker run --rm hello-world | grep -m1 "Hello from Docker"
echo PROVISION-OK
