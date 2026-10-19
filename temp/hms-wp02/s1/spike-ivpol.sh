#!/bin/bash
# S1 spike, part 3: the CEL ImageValidatingPolicy (the successor Kyverno 1.19 names for ClusterPolicy verifyImages).
set -u
S=/tmp/hms-s1/spike; cd $S
REG=k3d-hms-registry.localhost:5000
K=reg.kyverno.io/kyverno/kyverno-cli@sha256:2fc27b9b52bc976781462b7f4db741fd73d03db39ef29923c2b5d131950751df
API=${1:-policies.kyverno.io/v1}
ivp() { cat <<P
apiVersion: $API
kind: ImageValidatingPolicy
metadata:
  name: ivp-$1
spec:
  validationActions: [Deny]
  matchConstraints:
    resourceRules:
    - apiGroups: [""]
      apiVersions: [v1]
      operations: [CREATE]
      resources: [pods]
  matchImageReferences:
  - glob: "$2"
  credentials:
    allowInsecureRegistry: true
  attestors:
  - name: cosign
    cosign:
      key:
        data: |
$(sed 's/^/          /' $3)
      ctlog:
        insecureIgnoreTlog: true
        insecureIgnoreSCT: true
  validations:
  - expression: >-
      images.containers.map(image, verifyImageSignatures(image, [attestors.cosign])).all(e, e > 0)
    message: failed image signature verification
P
}
ivp a "$REG/spike/a*" k2.pub > ivp-a.yaml; ivp b "$REG/spike/b*" k3.pub > ivp-b.yaml; ivp c "$REG/spike/c*" k3.pub > ivp-c.yaml; ivp bwrong "$REG/spike/b*" k2.pub > ivp-bwrong.yaml
kap() { docker run --rm --network hms-spike-offline -u $(id -u):$(id -g) -e HOME=/w -v $S:/w -w /w $K apply "$@" --registry --remove-color 2>&1 | grep -vE "^\s*$" | tail -5 | cut -c1-400; }
for r in a b c; do echo "=== IVP format $r, by digest"; kap ivp-$r.yaml --resource pod-$r-digest.yaml; done
echo "=== IVP negative: format b, wrong key"; kap ivp-bwrong.yaml --resource pod-b-digest.yaml
