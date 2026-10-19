#!/bin/bash
# Publisher signatures on the pinned upstream digests, with the pinned cosign; verification only (nothing is
# signed or uploaded). Identity: the publisher's repository and, where it matches, the release tag's workflow.
set -u
COSIGN=ghcr.io/sigstore/cosign/cosign@sha256:6ca1127dc1e9ff19f3f2bfa214936813a86fbbf52919652eda49d393c888ad3c
GH=https://token.actions.githubusercontent.com
mkdir -p /tmp/hms-s1/tuf
v1() { timeout 180 docker run --rm -u "$(id -u):$(id -g)" -v /tmp/hms-s1/tuf:/tmp/tuf -e HOME=/tmp -e TUF_ROOT=/tmp/tuf "$@" >/dev/null 2>/tmp/hms-s1/sigerr.txt; }
v() { # retry only a failure to reach the TUF repository or Rekor, never a verification failure
  local i; for i in 1 2 3 4; do v1 "$@" && return 0
    grep -qE "updating local metadata|getting rekor public keys|timeout|TLS handshake|connection reset" /tmp/hms-s1/sigerr.txt || return 1
    sleep 5; done; return 1; }
check() { # name ref repo-regexp tag [extra docker args...]
  local name=$1 ref=$2 repo=$3 tag=$4; shift 4
  local tagged="^https://github\.com/$repo/\.github/workflows/.+@refs/tags/${tag//./\.}\$"
  if v "$@" "$COSIGN" verify "$ref" --certificate-identity-regexp "$tagged" --certificate-oidc-issuer $GH; then
    echo "$name: VERIFIED $ref, signer github.com/$repo workflow at refs/tags/$tag"
  elif v "$@" "$COSIGN" verify "$ref" --certificate-identity-regexp "^https://github\.com/$repo/" --certificate-oidc-issuer $GH; then
    echo "$name: VERIFIED $ref, signer a github.com/$repo workflow (not at refs/tags/$tag)"
  else echo "$name: NOT VERIFIED $ref ($(tail -1 /tmp/hms-s1/sigerr.txt | cut -c1-120))"; fi
}
check cloudnative-pg ghcr.io/cloudnative-pg/cloudnative-pg@sha256:923c267ec29636db3bee20f993d0ec4973fa22998e1adad37da79e4d32b5bc07 cloudnative-pg/cloudnative-pg v1.30.1
check postgresql ghcr.io/cloudnative-pg/postgresql@sha256:c9be7f221a05b18fe65259d9136affbabe3b39ad91c3b68f8f2f990a45f35f38 cloudnative-pg/postgres-containers none
check strimzi-operator quay.io/strimzi/operator@sha256:9c32dfe22d8602f43e8d8780706fbf65f023bcde3cef272688f35d1eead2640f strimzi/strimzi-kafka-operator 1.0.1
check kafka quay.io/strimzi/kafka@sha256:8cbd25d7bb132cc64fde7ac8460a5e4198fc67deadfd1bef5430866a7befbe47 strimzi/strimzi-kafka-operator 1.0.1
check openfga docker.io/openfga/openfga@sha256:01a6000aa6040a4d0bde6ea1d3359ac3b9f21dc972ac6103a87b38659a836776 openfga/openfga v1.18.3
check seaweedfs docker.io/chrislusf/seaweedfs@sha256:4e61d15fd35994cb1e43e1e553dff106794841fd9a99ade2fc8c8bfce4d7872d seaweedfs/seaweedfs 4.48
check otel-collector docker.io/otel/opentelemetry-collector-k8s@sha256:5bf46de110fccacb2957bcc98909fb98cf8b07baa67027e38f61699db620649a open-telemetry/opentelemetry-collector-releases v0.163.1
check argocd quay.io/argoproj/argocd@sha256:13db7b10db23283b1b36f855046602e18539a8a8204c9f6f039e8896c8897518 argoproj/argo-cd v3.5.5
check kyverno reg.kyverno.io/kyverno/kyverno@sha256:b31d8511ae5fd6010e2a01ea72ebae08eb82fa51d91af14a1d9fe989949b4edb kyverno/kyverno v1.19.1 -e COSIGN_REPOSITORY=ghcr.io/kyverno/signatures
check kyverno-pre reg.kyverno.io/kyverno/kyvernopre@sha256:c25c47461f06f2845a48c319ae86fbbc1730a7b9ed5b701889c9dc1f9ee94b09 kyverno/kyverno v1.19.1 -e COSIGN_REPOSITORY=ghcr.io/kyverno/signatures
check kyverno-cli reg.kyverno.io/kyverno/kyverno-cli@sha256:ced7b2be0b04250cabfe695f15307f69eb715fe23234816388af4f3812915b2a kyverno/kyverno v1.19.1 -e COSIGN_REPOSITORY=ghcr.io/kyverno/signatures
if v "$COSIGN" verify ghcr.io/sigstore/cosign/cosign@sha256:9e5c2f2edc34351160407ca3416c61855bdf9403c3c5936e0f0be7fc261611b8 --certificate-identity keyless@projectsigstore.iam.gserviceaccount.com --certificate-oidc-issuer https://accounts.google.com; then
  echo "cosign: VERIFIED by keyless@projectsigstore.iam.gserviceaccount.com (https://accounts.google.com)"
else echo "cosign: NOT VERIFIED ($(tail -1 /tmp/hms-s1/sigerr.txt | cut -c1-160))"; fi
# For the index digest the chain to the pinned linux/amd64 digest: the index lists it.
CRANE=gcr.io/go-containerregistry/crane@sha256:18efc5092649b2a674d384663044e04edf76705c4faa2875e8a322b4e80f070a
python3 - <<'PY'
import subprocess, yaml, json
d = yaml.safe_load(open("/mnt/c/Users/Surface/.t3/worktrees/hospitalmanagementsystem/wp02/deploy/site-cell/cell.yaml"))
bad = 0
for e in d["images"] + d["tools"]:
    repo = e["upstream"].rsplit(":", 1)[0]
    out = subprocess.run(["docker", "run", "--rm", "--network", "host",
        "gcr.io/go-containerregistry/crane@sha256:18efc5092649b2a674d384663044e04edf76705c4faa2875e8a322b4e80f070a",
        "manifest", f"{repo}@{e['index_digest']}"], capture_output=True, text=True).stdout
    try:
        listed = {m["digest"] for m in json.loads(out).get("manifests", [])}
    except Exception:
        listed = set()
    if e["digest"] not in listed:
        bad += 1
        print("index does not list the amd64 digest:", e["name"])
print(f"index lists the pinned linux/amd64 digest: {len(d['images']) + len(d['tools']) - bad} of {len(d['images']) + len(d['tools'])}")
PY
