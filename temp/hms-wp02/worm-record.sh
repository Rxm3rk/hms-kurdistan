#!/bin/bash
# Evidence of record: fast tier and the object-store WORM tests at a committed SHA (WSL build host).
set -u
SHA="$1"
cd ~/src/hms-wp02
git clean -fdq && git reset -q --hard && git fetch -q origin wp/0.2-environments && git checkout -q --detach "$SHA" && git clean -fdq || { echo "CHECKOUT FAILED"; exit 1; }
[ "$(git rev-parse HEAD)" = "$(git rev-parse "$SHA")" ] && [ -z "$(git status --porcelain)" ] || { echo "NOT CLEAN AT $SHA"; exit 1; }
echo "HEAD=$(git rev-parse --short HEAD)"; git status --short | head -3
eval "$(sh tools/bootstrap env)"
sh tools/bootstrap all >/dev/null 2>&1 || echo "bootstrap reported a problem"
sh tools/ci/run fast 2>&1 | tail -2
export HMS_S3_ACCESS_KEY="SYNAK$(openssl rand -hex 6 | tr a-f A-F)" HMS_S3_SECRET_KEY="SYNSK$(openssl rand -hex 16)"
cleanup() { docker rm -f s3-versitygw s3-seaweedfs s3-rustfs >/dev/null 2>&1; docker volume rm -f vgw-data vgw-vers swfs-data rfs-data >/dev/null 2>&1; }
cleanup
wait_port() { for i in $(seq 1 90); do curl -s -o /dev/null "http://127.0.0.1:$1/" && return 0; sleep 1; done; return 1; }
worm() { sh tools/hms cell worm --endpoint "http://127.0.0.1:$1" --label "$2" --cell compose --evidence "${@:3}" 2>&1 | grep -E "^(FAIL|ERROR)|: (PASS|FAIL)$|^evidence:"; }
docker run -d --name s3-versitygw -p 127.0.0.1:7071:7070 -v vgw-data:/data -v vgw-vers:/vers \
  -e ROOT_ACCESS_KEY="$HMS_S3_ACCESS_KEY" -e ROOT_SECRET_KEY="$HMS_S3_SECRET_KEY" \
  ghcr.io/versity/versitygw:v1.4.1 --port :7070 posix --versioning-dir /vers /data >/dev/null; wait_port 7071
worm 7071 versitygw-v1.4.1
mkdir -p /tmp/swfs && printf '{"identities":[{"name":"admin","credentials":[{"accessKey":"%s","secretKey":"%s"}],"actions":["Admin","Read","Write","List","Tagging"]}]}\n' "$HMS_S3_ACCESS_KEY" "$HMS_S3_SECRET_KEY" > /tmp/swfs/s3.json
docker run -d --name s3-seaweedfs -p 127.0.0.1:7072:8333 -v swfs-data:/data -v /tmp/swfs/s3.json:/etc/s3.json:ro \
  chrislusf/seaweedfs:4.48 server -dir=/data -s3 -s3.config=/etc/s3.json >/dev/null; wait_port 7072; sleep 5
worm 7072 seaweedfs-4.48 --state /tmp/swfs/state.json
docker restart s3-seaweedfs >/dev/null; wait_port 7072; sleep 8
worm 7072 seaweedfs-4.48 --recheck /tmp/swfs/state.json
docker run -d --name s3-rustfs -p 127.0.0.1:7073:9000 -v rfs-data:/data \
  -e RUSTFS_ACCESS_KEY="$HMS_S3_ACCESS_KEY" -e RUSTFS_SECRET_KEY="$HMS_S3_SECRET_KEY" rustfs/rustfs:1.0.3 >/dev/null; wait_port 7073; sleep 3
worm 7073 rustfs-1.0.3 --state /tmp/rfs-state.json
docker restart s3-rustfs >/dev/null; wait_port 7073; sleep 5
worm 7073 rustfs-1.0.3 --recheck /tmp/rfs-state.json
cleanup
ls docs/program/evidence/ci/ | grep "$(git rev-parse --short HEAD)"; ls docs/program/evidence/cell/
