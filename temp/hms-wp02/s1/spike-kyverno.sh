#!/bin/bash
# S1 spike, part 2: does the pinned Kyverno (CLI, same verification library as the admission controller) verify
# each signature format offline? Runs on the internal network that holds only the registry.
set -u
S=/tmp/hms-s1/spike; cd $S
REG=k3d-hms-registry.localhost:5000
D=sha256:412c4a7219cb8a299a37337f3d87810c5340095322e15594a1637785adad0f17
K=reg.kyverno.io/kyverno/kyverno-cli@sha256:2fc27b9b52bc976781462b7f4db741fd73d03db39ef29923c2b5d131950751df
policy() { # name image-glob pubkey-file
  cat <<P
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: spike-$1
spec:
  validationFailureAction: Enforce
  background: false
  rules:
  - name: verify-$1
    match:
      any:
      - resources:
          kinds: [Pod]
    verifyImages:
    - imageReferences: ["$2"]
      mutateDigest: true
      verifyDigest: true
      required: true
      imageRegistryCredentials:
        allowInsecureRegistry: true
      attestors:
      - entries:
        - keys:
            publicKeys: |-
$(sed 's/^/              /' $3)
            rekor:
              ignoreTlog: true
            ctlog:
              ignoreSCT: true
P
}
pod() { cat <<P
apiVersion: v1
kind: Pod
metadata:
  name: spike-$1
  namespace: default
spec:
  containers:
  - name: c
    image: $2
P
}
policy a "$REG/spike/a*" k2.pub > pol-a.yaml; policy b "$REG/spike/b*" k3.pub > pol-b.yaml; policy c "$REG/spike/c*" k3.pub > pol-c.yaml
policy bwrong "$REG/spike/b*" k2.pub > pol-bwrong.yaml
for r in a b c; do pod $r-digest "$REG/spike/$r@$D" > pod-$r-digest.yaml; pod $r-tag "$REG/spike/$r:1" > pod-$r-tag.yaml; done
kap() { docker run --rm --network hms-spike-offline -u $(id -u):$(id -g) -e HOME=/w -v $S:/w -w /w $K apply "$@" --registry --remove-color 2>&1 | grep -vE "^\s*$" | tail -6 | cut -c1-400; }
for r in a b c; do
  echo "=== format $r, by digest"; kap pol-$r.yaml --resource pod-$r-digest.yaml
  echo "=== format $r, by tag"; kap pol-$r.yaml --resource pod-$r-tag.yaml -o out-$r.yaml; grep image: out-$r.yaml 2>/dev/null
done
echo "=== negative: format b, wrong key"; kap pol-bwrong.yaml --resource pod-b-digest.yaml
