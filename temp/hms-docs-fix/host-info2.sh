#!/bin/bash
# Read-only: timestamps of host files that first-run setup or provisioning may have written.
stat -c '%y %n' /etc/wsl.conf /home/surface /etc/apt/sources.list.d/docker.list /etc/apt/sources.list.d/kubernetes.list /etc/apt/keyrings/docker.asc /etc/apt/keyrings/kubernetes-apt-keyring.gpg /usr/local/bin/helm /usr/local/bin/k3d /usr/local/bin/node /opt/node-v24.22.0-linux-x64 /home/surface/.gitconfig /home/surface/.rustup 2>&1
echo "== groups of surface:"; id surface
echo "== sudoers.d:"; ls -l /etc/sudoers.d/ 2>&1
echo "== image build info:"; cat /etc/cloud/build.info 2>/dev/null; head -3 /etc/os-release
echo "== rustc:"; /home/surface/.cargo/bin/rustc --version
