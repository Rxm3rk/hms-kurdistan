#!/bin/bash
for img in ghcr.io/versity/versitygw:v1.4.1 chrislusf/seaweedfs:4.48 rustfs/rustfs:1.0.3; do
  echo "=== pull $img"; timeout 300 docker pull -q "$img" || echo "PULL FAILED $img"
done
echo "=== versitygw posix --help"; docker run --rm ghcr.io/versity/versitygw:v1.4.1 posix --help 2>&1 | grep -iE "versioning|lock|usage|--" | head -30
echo "=== versitygw global --help (lock/iam)"; docker run --rm ghcr.io/versity/versitygw:v1.4.1 --help 2>&1 | grep -iE "lock|access|secret|port|region|health" | head -20
echo "=== seaweedfs s3 help (lock)"; docker run --rm chrislusf/seaweedfs:4.48 help s3 2>&1 | grep -iE "lock|config|port|iam" | head -20
echo "=== rustfs --help"; docker run --rm rustfs/rustfs:1.0.3 --help 2>&1 | head -40
docker images --format '{{.Repository}}:{{.Tag}} {{.Size}}' | grep -E "versity|seaweed|rustfs"
