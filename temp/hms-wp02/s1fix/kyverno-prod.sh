#!/bin/bash
# Issue S1-7: Kyverno 1.19.1's CLI (ImageValidatingPolicy, policies.kyverno.io/v1) against images that
# 'tools/hms cell images sign' signed with the cell key, on the --internal network hms-cell-offline.
set -u
H=${HMS_CELL_HOME:-$HOME/.local/share/hms-cell}
W=/tmp/hms-s1/kyverno-prod; rm -rf $W; mkdir -p $W; cd $W
REG=k3d-hms-registry.localhost:5000
K=reg.kyverno.io/kyverno/kyverno-cli@sha256:2fc27b9b52bc976781462b7f4db741fd73d03db39ef29923c2b5d131950751df
cp "$H/keys/cosign.pub" cell.pub; cp /tmp/hms-s1/spike/k2.pub other.pub
ivp() { cat <<P
apiVersion: policies.kyverno.io/v1
kind: ImageValidatingPolicy
metadata:
  name: $1
spec:
  validationActions: [Deny]
  matchConstraints:
    resourceRules:
    - apiGroups: [""]
      apiVersions: [v1]
      operations: [CREATE]
      resources: [pods]
  matchImageReferences:
  - glob: "$REG/*"
  credentials:
    allowInsecureRegistry: true
  attestors:
  - name: cosign
    cosign:
      key:
        data: |
$(sed 's/^/          /' $2)
      ctlog:
        insecureIgnoreTlog: true
        insecureIgnoreSCT: true
  validations:
  - expression: >-
      images.containers.map(image, verifyImageSignatures(image, [attestors.cosign])).all(e, e > 0)
    message: failed image signature verification
P
}
pod() { printf 'apiVersion: v1\nkind: Pod\nmetadata:\n  name: %s\n  namespace: default\nspec:\n  containers:\n  - name: c\n    image: %s\n' "$1" "$2"; }
ivp cell-key cell.pub > ivp-cell.yaml; ivp other-key other.pub > ivp-other.yaml
pod pause $REG/rancher/mirrored-pause@sha256:412c4a7219cb8a299a37337f3d87810c5340095322e15594a1637785adad0f17 > pod-pause.yaml
pod valkey $REG/valkey/valkey@sha256:ac9c858b86dc81f3482d53a9d854547379a5f41e012500f839ab257c399063e0 > pod-valkey.yaml
pod unsigned $REG/spike/pause@sha256:412c4a7219cb8a299a37337f3d87810c5340095322e15594a1637785adad0f17 > pod-unsigned.yaml
docker network inspect hms-cell-offline --format 'network {{.Name}} internal={{.Internal}} containers={{len .Containers}}'
kap() { docker run --rm --network hms-cell-offline -u $(id -u):$(id -g) -e HOME=/w -v $W:/w -w /w $K apply "$@" --registry --remove-color 2>&1 | grep -vE "^\s*$" | tail -4 | cut -c1-300; }
echo "=== 1 cell key, k3s-pause (signed by cell images sign)"; kap ivp-cell.yaml --resource pod-pause.yaml
echo "=== 2 cell key, valkey (signed by cell images sign)"; kap ivp-cell.yaml --resource pod-valkey.yaml
echo "=== 3 throwaway key, k3s-pause (expect fail)"; kap ivp-other.yaml --resource pod-pause.yaml
echo "=== 4 cell key, same digest under spike/pause, never signed by the cell (expect fail)"; kap ivp-cell.yaml --resource pod-unsigned.yaml
