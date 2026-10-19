#!/bin/bash
set -u
COSIGN=ghcr.io/sigstore/cosign/cosign@sha256:6ca1127dc1e9ff19f3f2bfa214936813a86fbbf52919652eda49d393c888ad3c
v() { docker run --rm -e HOME=/tmp -e TUF_ROOT=/tmp/tuf "$@"; }
subj() { python3 -c '
import json,sys
d=json.load(sys.stdin); x=d[0]
o=x.get("optional") or {}
print(o.get("Subject") or o.get("subject") or json.dumps(x)[:600])'; }
echo "== cnpg raw"; v "$COSIGN" verify ghcr.io/cloudnative-pg/cloudnative-pg@sha256:923c267ec29636db3bee20f993d0ec4973fa22998e1adad37da79e4d32b5bc07 --certificate-identity-regexp '^https://github\.com/cloudnative-pg/' --certificate-oidc-issuer https://token.actions.githubusercontent.com --output json 2>/dev/null | subj
for img in kyverno@sha256:b31d8511ae5fd6010e2a01ea72ebae08eb82fa51d91af14a1d9fe989949b4edb kyvernopre@sha256:c25c47461f06f2845a48c319ae86fbbc1730a7b9ed5b701889c9dc1f9ee94b09; do
  for reg in reg.kyverno.io/kyverno ghcr.io/kyverno; do
    echo "== $reg/$img with COSIGN_REPOSITORY=ghcr.io/kyverno/signatures"
    v -e COSIGN_REPOSITORY=ghcr.io/kyverno/signatures "$COSIGN" verify "$reg/$img" --certificate-identity-regexp '^https://github\.com/kyverno/kyverno/' --certificate-oidc-issuer https://token.actions.githubusercontent.com --output json 2>&1 | tail -c 700; echo
  done
done
echo "== cosign any identity"
v "$COSIGN" verify ghcr.io/sigstore/cosign/cosign@sha256:9e5c2f2edc34351160407ca3416c61855bdf9403c3c5936e0f0be7fc261611b8 --certificate-identity-regexp '.*' --certificate-oidc-issuer-regexp '.*' --output json 2>&1 | tail -c 900; echo
