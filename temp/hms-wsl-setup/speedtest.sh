#!/bin/bash
cat /etc/resolv.conf | grep -v '^#'
ip -4 addr show eth0 | grep inet
t() { curl -s -o /dev/null -L -r 0-4000000 -w "%{speed_download} B/s %{size_download}B code=%{http_code}  $1\n" --max-time 10 "$1"; }
t http://archive.ubuntu.com/ubuntu/pool/main/l/linux-firmware/linux-firmware_20240318.git3b128b60-0ubuntu2_amd64.deb &
t http://security.ubuntu.com/ubuntu/pool/main/l/linux-firmware/linux-firmware_20240318.git3b128b60-0ubuntu2_amd64.deb &
t https://mirrors.edge.kernel.org/ubuntu/pool/main/l/linux-firmware/linux-firmware_20240318.git3b128b60-0ubuntu2_amd64.deb &
t https://mirror.init7.net/ubuntu/pool/main/l/linux-firmware/linux-firmware_20240318.git3b128b60-0ubuntu2_amd64.deb &
t https://download.docker.com/linux/ubuntu/dists/noble/stable/binary-amd64/Packages &
t https://pkgs.k8s.io/core:/stable:/v1.34/deb/Packages &
t https://get.helm.sh/helm-v3.19.0-linux-amd64.tar.gz &
t https://nodejs.org/dist/v24.13.0/node-v24.13.0-linux-x64.tar.xz &
t https://static.rust-lang.org/rustup/dist/x86_64-unknown-linux-gnu/rustup-init &
t https://packages.adoptium.net/artifactory/deb/dists/noble/main/binary-amd64/Packages &
t https://apt.corretto.aws/dists/stable/main/binary-amd64/Packages &
wait
