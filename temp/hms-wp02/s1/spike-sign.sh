#!/bin/bash
# S1 spike, part 1: sign three copies of one image three ways, all on an internal (no internet) network.
set -u
S=/tmp/hms-s1/spike; rm -rf $S; mkdir -p $S; cd $S
REG=k3d-hms-registry.localhost:5000
CRANE="docker run --rm --network hms-registry gcr.io/go-containerregistry/crane@sha256:18efc5092649b2a674d384663044e04edf76705c4faa2875e8a322b4e80f070a"
COS3=ghcr.io/sigstore/cosign/cosign@sha256:6ca1127dc1e9ff19f3f2bfa214936813a86fbbf52919652eda49d393c888ad3c
COS2=ghcr.io/sigstore/cosign/cosign@sha256:404b8081d833085d12c21cda889c6f2f3731328768257c760e32fcf070be2cf9
docker network inspect hms-spike-offline >/dev/null 2>&1 || docker network create --internal --subnet 10.213.9.0/24 hms-spike-offline >/dev/null
docker network connect hms-spike-offline k3d-hms-registry.localhost 2>/dev/null || true
for r in a b c; do $CRANE copy --insecure --platform linux/amd64 docker.io/rancher/mirrored-pause@sha256:412c4a7219cb8a299a37337f3d87810c5340095322e15594a1637785adad0f17 $REG/spike/$r:1 2>&1 | tail -1; done
D=sha256:412c4a7219cb8a299a37337f3d87810c5340095322e15594a1637785adad0f17
run() { img=$1; shift; docker run --rm --network hms-spike-offline -u $(id -u):$(id -g) -v $S:/w -w /w -e COSIGN_PASSWORD=throwaway-spike -e HOME=/w -e TUF_ROOT=/w/tuf $img "$@"; }
echo "== keys (throwaway, spike only)"; run $COS2 generate-key-pair --output-key-prefix k2 2>&1 | tail -1; run $COS3 generate-key-pair --output-key-prefix k3 2>&1 | tail -1
cat > sc.json <<'J'
{"mediaType": "application/vnd.dev.sigstore.signingconfig.v0.2+json", "caUrls": [], "oidcUrls": [], "rekorTlogUrls": [], "rekorTlogConfig": {"selector": "ANY"}, "tsaUrls": [], "tsaConfig": {"selector": "ANY"}}
J
echo "== A: cosign 2.6.5 --tlog-upload=false"; time run $COS2 sign --key k2.key --tlog-upload=false --allow-http-registry=true --allow-insecure-registry=true -y $REG/spike/a@$D 2>&1 | tail -3
echo "== B: cosign 3.1.3 signing config without Rekor (new bundle format)"; time run $COS3 sign --key k3.key --signing-config sc.json --use-signing-config=false --allow-http-registry=true --allow-insecure-registry=true -y $REG/spike/b@$D 2>&1 | tail -5
echo "== B2: cosign 3.1.3 signing config without Rekor, only --signing-config"; run $COS3 sign --key k3.key --signing-config sc.json --allow-http-registry=true --allow-insecure-registry=true -y $REG/spike/b@$D 2>&1 | tail -3
echo "== C: cosign 3.1.3 legacy format --tlog-upload=false"; time run $COS3 sign --key k3.key --new-bundle-format=false --use-signing-config=false --tlog-upload=false --allow-http-registry=true --allow-insecure-registry=true -y $REG/spike/c@$D 2>&1 | tail -3
echo "== registry contents"; for r in a b c; do echo "-- spike/$r tags:"; $CRANE ls --insecure $REG/spike/$r; echo "-- referrers:"; curl -s http://127.0.0.1:5000/v2/spike/$r/referrers/$D | python3 -m json.tool | grep -E "artifactType|mediaType|digest" | head -6; done
echo "== verify A (cosign 2, offline)"; run $COS2 verify --key k2.pub --insecure-ignore-tlog=true --allow-http-registry=true --allow-insecure-registry=true $REG/spike/a@$D 2>&1 | tail -3 | cut -c1-300
echo "== verify B (cosign 3, offline)"; run $COS3 verify --key k3.pub --insecure-ignore-tlog=true --allow-http-registry=true --allow-insecure-registry=true $REG/spike/b@$D 2>&1 | tail -3 | cut -c1-300
echo "== verify C (cosign 3 legacy, offline)"; run $COS3 verify --key k3.pub --insecure-ignore-tlog=true --new-bundle-format=false --allow-http-registry=true --allow-insecure-registry=true $REG/spike/c@$D 2>&1 | tail -3 | cut -c1-300
echo "== verify C with cosign 2"; run $COS2 verify --key k3.pub --insecure-ignore-tlog=true --allow-http-registry=true --allow-insecure-registry=true $REG/spike/c@$D 2>&1 | tail -3 | cut -c1-300
echo "== negative: verify A with the wrong key"; run $COS2 verify --key k3.pub --insecure-ignore-tlog=true --allow-http-registry=true --allow-insecure-registry=true $REG/spike/a@$D 2>&1 | tail -2 | cut -c1-300
ls -la $S
