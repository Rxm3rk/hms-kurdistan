#!/bin/bash
# S1 review fixes, WSL build host: sync the scratch tree, place the Kyverno manifest, scan the two dropped
# charts with the new scanner (demonstration), then cell lint, charts fetch and charts verify.
set -u
true
H=${HMS_CELL_HOME:-$HOME/.local/share/hms-cell}
if [ -d "$H/manifests/kyverno-1.19.1" ]; then
  mkdir -p "$H/manifests/kyverno-v1.19.1" && mv "$H/manifests/kyverno-1.19.1/install.yaml" "$H/manifests/kyverno-v1.19.1/" \
    && rm -f "$H/manifests/kyverno-1.19.1/checksums.txt" && rmdir "$H/manifests/kyverno-1.19.1"
fi
cd /tmp/hms-s1/tree
HMS() { ~/src/hospitalmanagementsystem/.tools/venv/bin/python -B -I tools/hms.py "$@"; }
echo "== scanner on the charts no longer pinned"
~/src/hospitalmanagementsystem/.tools/venv/bin/python -B -c '
import sys; sys.path.insert(0, "tools")
from hmstools.cell.charts import scan_chart
for f in sys.argv[1:]:
    errors, notes = scan_chart(open(f, "rb").read(), f.rsplit("/", 1)[-1] + "!/")
    print(f.rsplit("/", 1)[-1], "errors:", len(errors), "notes:", notes)
    for e in errors[:4]: print("   ", e)
' "$H/charts/kyverno-3.9.1.tgz" "$H/charts/openfga-0.3.12.tgz" 2>&1 | grep -v "^    " | head; true
echo "== cell lint"; HMS cell lint | tail -4
echo "== charts fetch"; HMS cell charts fetch; echo "rc=$?"
echo "== charts verify"; HMS cell charts verify; echo "rc=$?"
