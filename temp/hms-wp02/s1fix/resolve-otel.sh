#!/bin/bash
# Resolve otel k8s 0.163.1 digests and image-config dates with the pinned crane (WSL build host).
set -u
CRANE=gcr.io/go-containerregistry/crane@sha256:18efc5092649b2a674d384663044e04edf76705c4faa2875e8a322b4e80f070a
c() { docker run --rm --network host "$CRANE" "$@"; }
R=docker.io/otel/opentelemetry-collector-k8s
echo "tags: $(c ls $R | grep -E '^0\.16[0-9]' | tr '\n' ' ')"
echo "index  0.163.1: $(c digest $R:0.163.1)"
echo "amd64  0.163.1: $(c digest --platform linux/amd64 $R:0.163.1)"
c manifest $R:0.163.1 | python3 -c 'import json,sys; d=json.load(sys.stdin); print("mediaType", d.get("mediaType")); [print("  ", m["platform"]["os"], m["platform"]["architecture"], m["digest"]) for m in d.get("manifests",[])]'
echo "created 0.163.1 amd64: $(c config --platform linux/amd64 $R:0.163.1 | python3 -c 'import json,sys; print(json.load(sys.stdin).get("created"))')"
for img in docker.io/rancher/mirrored-pause@sha256:412c4a7219cb8a299a37337f3d87810c5340095322e15594a1637785adad0f17 docker.io/rancher/mirrored-library-busybox@sha256:ad9fa4d07136a83e69a54ef00102f579d04eba431932de3b0f098cc5d5948f9f; do
  echo "created $img: $(c config $img | python3 -c 'import json,sys; print(json.load(sys.stdin).get("created"))')"
done
