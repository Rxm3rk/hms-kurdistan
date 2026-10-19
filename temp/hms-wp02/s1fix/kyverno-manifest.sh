#!/bin/bash
# Fetch Kyverno v1.19.1's release manifest and checksums from the GitHub release page into HMS_CELL_HOME.
set -eu
H=${HMS_CELL_HOME:-$HOME/.local/share/hms-cell}
D=$H/manifests/kyverno-1.19.1
mkdir -p "$D"; cd "$D"
B=https://github.com/kyverno/kyverno/releases/download/v1.19.1
for f in checksums.txt install.yaml; do [ -s "$f" ] || curl -fsSL --retry 3 -o "$f" "$B/$f"; done
echo "== checksums.txt"; cat checksums.txt
echo "== sha256"; sha256sum install.yaml checksums.txt
echo "== images"; grep -oE 'image: *"?[^" ]+' install.yaml | sort | uniq -c
grep -oE '(reg\.kyverno\.io|ghcr\.io|docker\.io)/[a-z0-9./_-]+(:[A-Za-z0-9._-]+)?' install.yaml | sort | uniq -c
echo "== excluded vendor"; grep -ic bitnami install.yaml || true
echo "== kinds"; grep -E '^kind:' install.yaml | sort | uniq -c
echo "== deployments"; python3 - install.yaml <<'PY'
import sys, yaml
for d in yaml.safe_load_all(open(sys.argv[1])):
    if d and d.get("kind") in ("Deployment", "CronJob", "Job"):
        spec = d["spec"]
        pod = spec["jobTemplate"]["spec"]["template"]["spec"] if d["kind"] == "CronJob" else spec["template"]["spec"]
        imgs = [c["image"] for c in pod.get("initContainers", []) + pod["containers"]]
        print(d["kind"], d["metadata"]["name"], spec.get("replicas"), imgs)
PY
