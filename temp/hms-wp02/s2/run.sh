#!/bin/bash
# S2 cell run (WSL build host, lite cell): run one 'tools/hms cell' command from the scratch tree; logs in /tmp/hms-s2.
set -u
cd /tmp/hms-s2/tree
mkdir -p /tmp/hms-s2/logs /tmp/hms-s2/records
log=/tmp/hms-s2/logs/$(date +%H%M%S)-$1.log
echo "== $(date -Is) free: $(free -m | awk '/^Mem:/ {print $7}') MiB available; C: $(df -BG /mnt/c | awk 'NR==2 {print $4}') free" | tee "$log"
~/src/hospitalmanagementsystem/.tools/venv/bin/python -B -I tools/hms.py cell "$@" 2>&1 | tee -a "$log"
rc=${PIPESTATUS[0]}
echo "rc=$rc ($(date -Is))" | tee -a "$log"
exit $rc
