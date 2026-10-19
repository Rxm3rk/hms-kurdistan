#!/bin/bash
cd ~/src/hms-wp02 && git log --oneline -1 && ls tools/hmstools/cell/
export HMS_S3_ACCESS_KEY="SYNAKDEBUG01" HMS_S3_SECRET_KEY="SYNSKDEBUG0123456789"
docker ps -a --format '{{.Names}} {{.Status}}' | head
sh tools/hms cell worm --help 2>&1 | head -5
docker run -d --name s3-dbg -p 127.0.0.1:7079:7070 -e ROOT_ACCESS_KEY="$HMS_S3_ACCESS_KEY" -e ROOT_SECRET_KEY="$HMS_S3_SECRET_KEY" \
  ghcr.io/versity/versitygw:v1.4.1 --port :7070 posix --versioning-dir /tmp /tmp 2>&1 | head -2
sleep 3
sh tools/hms cell worm --endpoint http://127.0.0.1:7079 --label dbg --cell compose 2>&1 | tail -3
docker rm -f s3-dbg >/dev/null
