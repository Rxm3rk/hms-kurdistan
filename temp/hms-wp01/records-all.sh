#!/bin/bash
# All WP-0.1 records of record at one committed SHA, one heavy job at a time. Usage: records-all.sh <sha>
set -u
SHA=$1
bash /mnt/c/Users/Surface/AppData/Local/Temp/hms-wp01/records.sh "$SHA"
OUT=/tmp/hms-records-$SHA
cd ~/src/hospitalmanagementsystem || exit 2
S=$(git rev-parse --short HEAD); D=$(date +%F)
echo "== licence"
( eval "$(sh tools/bootstrap env)" && mkdir -p build && cd frontend \
  && corepack pnpm --filter @hms/i18n licenses list --prod --json > ../build/licences-shipped.json \
  && corepack pnpm -r licenses list --json > ../build/licences-all.json && cd .. \
  && { echo "\$ sh tools/hms licence check --pnpm build/licences-shipped.json --json"; sh tools/hms licence check --pnpm build/licences-shipped.json --json; echo "exit $?";
       echo "\$ sh tools/hms licence check --pnpm build/licences-all.json --scope build-only --json"; sh tools/hms licence check --pnpm build/licences-all.json --scope build-only --json; echo "exit $?"; } ) > "$OUT/$D-licence-$S.txt" 2>&1
tail -4 "$OUT/$D-licence-$S.txt"
cp build/licences-shipped.json build/licences-all.json "$OUT/" 2>/dev/null
echo "== gates-bite"
SRC=/mnt/c/Users/Surface/.t3/projects/hospitalmanagementsystem; PLANT=$HOME/src/hms-plant
sh "$SRC/tools/ci/gates-bite/setup-clone.sh" "$SRC" "$PLANT" > "$OUT/gates-bite-setup.log" 2>&1; echo "setup exit $?"
COPY=$(mktemp -d); git -C "$SRC" archive "$SHA" tools/ci/gates-bite | tar -x -C "$COPY"
sh "$COPY/tools/ci/gates-bite/gates-bite.sh" --clone "$PLANT" --out "$OUT" "$SHA" > "$OUT/gates-bite.log" 2>&1; echo "gates-bite exit $?"
tail -15 "$OUT/gates-bite.log"
echo "== done"; ls -la "$OUT" "$OUT"/docs/program/evidence/* 2>/dev/null
