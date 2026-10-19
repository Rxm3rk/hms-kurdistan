#!/bin/bash
# Check each pinned image's index digest (then its amd64 digest) for a keyless signature by its publisher's
# GitHub Actions workflow, with the pinned cosign. Verification only: nothing is signed or uploaded.
set -u
COSIGN=ghcr.io/sigstore/cosign/cosign@sha256:6ca1127dc1e9ff19f3f2bfa214936813a86fbbf52919652eda49d393c888ad3c
Y=/mnt/c/Users/Surface/.t3/worktrees/hospitalmanagementsystem/wp02/deploy/site-cell/cell.yaml
python3 - "$Y" <<'PY' > /tmp/hms-s1/upstream-list.txt
import sys, yaml
d = yaml.safe_load(open(sys.argv[1]))
for e in d["images"] + d["tools"]:
    reg_repo = e["upstream"].rsplit(":", 1)[0]
    print(e["name"], reg_repo, e["index_digest"], e["digest"])
PY
org() {
  case "$1" in
    *rancher/*) echo 'k3s-io|rancher' ;; *k3d-io/*) echo k3d-io ;; *distribution/*) echo distribution ;;
    *kyverno*) echo kyverno ;; *cloudnative-pg/*) echo cloudnative-pg ;; *strimzi/*) echo strimzi ;;
    *temporalio/*) echo temporalio ;; *keycloak/*) echo keycloak ;; *openfga/*) echo openfga ;;
    *valkey/*) echo 'valkey-io|docker-library' ;; *chrislusf/*) echo seaweedfs ;; *otel/*) echo open-telemetry ;;
    *argoproj/*) echo argoproj ;; *go-containerregistry/*) echo google ;; *sigstore/*) echo sigstore ;; *) echo NONE ;;
  esac
}
while read -r name repo index amd64; do
  o=$(org "$repo"); res="no signature by github.com/($o)"
  for d in "$index" "$amd64"; do
    out=$(timeout 120 docker run --rm -e HOME=/tmp -e TUF_ROOT=/tmp/tuf "$COSIGN" verify "$repo@$d" \
      --certificate-identity-regexp "^https://github\.com/($o)/" \
      --certificate-oidc-issuer https://token.actions.githubusercontent.com --output json 2>/tmp/hms-s1/sigerr.txt)
    if [ $? -eq 0 ]; then
      subj=$(echo "$out" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(sorted({x.get("optional",{}).get("Subject","?") for x in d})[0])' 2>/dev/null)
      which=$([ "$d" = "$index" ] && echo index || echo amd64)
      res="VERIFIED on the $which digest; signer $subj"; break
    fi
  done
  [ "${res#VERIFIED}" = "$res" ] && res="$res ($(tail -1 /tmp/hms-s1/sigerr.txt | cut -c1-150))"
  echo "$name: $res"
done < /tmp/hms-s1/upstream-list.txt
