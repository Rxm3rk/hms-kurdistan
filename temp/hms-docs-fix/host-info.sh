#!/bin/bash
# Read-only: what the host provisioning left behind (apt sources and keys, symlinks, services, git config).
echo "== apt sources:"; ls -1 /etc/apt/sources.list.d/
echo "== keyrings:"; ls -1 /etc/apt/keyrings/
echo "== /usr/local/bin:"; ls -l /usr/local/bin/ | awk 'NR>1 {print $9, $10, $11}'
echo "== /opt:"; ls -1 /opt/
echo "== services:"; systemctl is-enabled docker containerd 2>&1; systemctl is-active docker containerd 2>&1
echo "== docker group:"; getent group docker
echo "== build user's global git config:"; git config --global --list
echo "== rustup:"; ls -d ~/.rustup ~/.cargo 2>&1; ~/.cargo/bin/rustup show active-toolchain 2>&1 | head -2
echo "== WSL clone downloads:"; ls -l ~/src/hospitalmanagementsystem/.tools/downloads/ | awk 'NR>1 {print $5, $9}'
sha256sum ~/src/hospitalmanagementsystem/.tools/downloads/*.tar.gz ~/src/hospitalmanagementsystem/.tools/downloads/*.zip 2>/dev/null
echo "== wsl.conf:"; cat /etc/wsl.conf 2>/dev/null
echo "== apt history (upgrade lines):"; grep -c "^Upgrade:" /var/log/apt/history.log 2>/dev/null; grep "^Start-Date\|^Commandline" /var/log/apt/history.log 2>/dev/null | head -40
