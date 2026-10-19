#!/bin/bash
set -euo pipefail
cd ~/src
if [ ! -d hms-wp02/.git ]; then git clone -q /mnt/c/Users/Surface/.t3/projects/hospitalmanagementsystem hms-wp02; fi
cd hms-wp02
git fetch -q origin wp/0.2-environments 2>/dev/null || git fetch -q origin
git checkout -q -B wp/0.2-environments origin/wp/0.2-environments 2>/dev/null || git checkout -q -B wp/0.2-environments origin/wp/0.1-programme-bootstrap
git log --oneline -1
sh tools/bootstrap venv 2>&1 | tail -3
df -h / | tail -1; free -m | sed -n 2p
docker system df
