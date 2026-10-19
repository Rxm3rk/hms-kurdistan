#!/bin/bash
# Exploratory WORM runs against the object-store candidates (synthetic credentials, throwaway containers).
set -u
SRC=/mnt/c/Users/Surface/.t3/projects/hospitalmanagementsystem
cd ~/src/hms-wp02
rsync -a --delete "$SRC/tools/hmstools/cell/" tools/hmstools/cell/ --exclude __pycache__
export HMS_S3_ACCESS_KEY="SYNAK$(openssl rand -hex 6 | tr a-f A-F)" HMS_S3_SECRET_KEY="SYNSK$(openssl rand -hex 16)"
cleanup() { docker rm -f s3-versitygw s3-seaweedfs s3-rustfs >/dev/null 2>&1; docker volume rm -f vgw-data vgw-vers swfs-data rfs-data >/dev/null 2>&1; }
cleanup
wait_port() { for i in $(seq 1 60); do curl -s -o /dev/null "http://127.0.0.1:$1/" && return 0; sleep 1; done; return 1; }

echo "##### versitygw v1.4.1"
docker run -d --name s3-versitygw -p 127.0.0.1:7071:7070 -v vgw-data:/data -v vgw-vers:/vers \
  -e ROOT_ACCESS_KEY="$HMS_S3_ACCESS_KEY" -e ROOT_SECRET_KEY="$HMS_S3_SECRET_KEY" \
  ghcr.io/versity/versitygw:v1.4.1 --port :7070 posix --versioning-dir /vers /data >/dev/null
wait_port 7071 || { echo "versitygw did not start"; docker logs s3-versitygw 2>&1 | tail -20; }
sh tools/hms cell worm --endpoint http://127.0.0.1:7071 --label versitygw-v1.4.1 2>&1 | tail -14

echo "##### seaweedfs 4.48"
mkdir -p /tmp/swfs && cat > /tmp/swfs/s3.json <<JSON
{"identities":[{"name":"admin","credentials":[{"accessKey":"$HMS_S3_ACCESS_KEY","secretKey":"$HMS_S3_SECRET_KEY"}],"actions":["Admin","Read","Write","List","Tagging"]}]}
JSON
docker run -d --name s3-seaweedfs -p 127.0.0.1:7072:8333 -v swfs-data:/data -v /tmp/swfs/s3.json:/etc/s3.json:ro \
  chrislusf/seaweedfs:4.48 server -dir=/data -s3 -s3.config=/etc/s3.json >/dev/null
wait_port 7072 || { echo "seaweedfs did not start"; docker logs s3-seaweedfs 2>&1 | tail -20; }
sleep 5
sh tools/hms cell worm --endpoint http://127.0.0.1:7072 --label seaweedfs-4.48 2>&1 | tail -14

echo "##### rustfs 1.0.3"
docker run -d --name s3-rustfs -p 127.0.0.1:7073:9000 -v rfs-data:/data \
  -e RUSTFS_ACCESS_KEY="$HMS_S3_ACCESS_KEY" -e RUSTFS_SECRET_KEY="$HMS_S3_SECRET_KEY" rustfs/rustfs:1.0.3 >/dev/null
wait_port 7073 || { echo "rustfs did not start"; docker logs s3-rustfs 2>&1 | tail -20; }
sleep 3
sh tools/hms cell worm --endpoint http://127.0.0.1:7073 --label rustfs-1.0.3 2>&1 | tail -14

docker stats --no-stream --format '{{.Name}} {{.MemUsage}}' s3-versitygw s3-seaweedfs s3-rustfs 2>/dev/null
cleanup
