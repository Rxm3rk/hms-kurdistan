#!/bin/bash
for spec in k3s-io/k3s@v1.35.9+k3s1 coredns/coredns@v1.14.7 rancher/local-path-provisioner@v0.0.37 k3d-io/k3d@v5.8.3 distribution/distribution@v3.1.2 kyverno/kyverno@v1.19.1 cloudnative-pg/cloudnative-pg@v1.30.1 strimzi/strimzi-kafka-operator@1.0.1 temporalio/temporal@v1.32.1 temporalio/ui-server@v2.54.1 temporalio/ui@v2.54.1 keycloak/keycloak@26.8.1 openfga/openfga@v1.18.3 valkey-io/valkey@9.1.2 seaweedfs/seaweedfs@4.48 open-telemetry/opentelemetry-collector-releases@v0.163.1 open-telemetry/opentelemetry-collector-releases@v0.162.0 argoproj/argo-cd@v3.5.5 google/go-containerregistry@v0.22.1 sigstore/cosign@v3.1.3 apache/kafka@4.2.0; do
  repo=${spec%@*}; tag=${spec#*@}
  enc=$(python -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1],safe=''))" "$tag")
  out=$(curl -s "https://api.github.com/repos/$repo/releases/tags/$enc" | python -c "import json,sys; r=json.load(sys.stdin); print(r.get('published_at'), r.get('prerelease'), r.get('message',''))")
  echo "$spec $out"
done
