#!/bin/bash
f=$(ls -t /tmp/hms-failover-*.log 2>/dev/null | head -1); echo "$f"; tail -15 "$f" | cut -c1-200
uptime; free -m | sed -n 2p
