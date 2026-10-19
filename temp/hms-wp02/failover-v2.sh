#!/bin/bash
# Prototype (not evidence of record): wait for the k3d API and the 3-instance CNPG cluster, then run the failover probe.
set -u
LOG=/tmp/hms-failover-$(date +%Y%m%d-%H%M%S).log
exec > >(tee -a "$LOG") 2>&1
echo "log=$LOG"
for i in $(seq 1 120); do kubectl get --raw=/readyz >/dev/null 2>&1 && break; sleep 5; done
echo "api ready after ~$((i*5))s at $(date -Is)"
kubectl get nodes --no-headers
NS=hms-data
for i in $(seq 1 90); do r=$(kubectl -n $NS get cluster proto-pg -o jsonpath='{.status.readyInstances}' 2>/dev/null); [ "$r" = "3" ] && break; sleep 5; done
kubectl -n $NS get cluster proto-pg --no-headers 2>&1
P=$(kubectl -n $NS get cluster proto-pg -o jsonpath='{.status.currentPrimary}')
PNODE=$(kubectl -n $NS get pod "$P" -o jsonpath='{.spec.nodeName}')
echo "primary=$P on $PNODE"
SECRET=$(kubectl -n $NS get secret proto-pg-app -o jsonpath='{.data.password}' | base64 -d)
# writer pod on a node that is not the primary's
WNODE=$(kubectl get nodes -o name | sed 's#node/##' | grep -v "$PNODE" | head -1)
kubectl -n $NS delete pod writer --ignore-not-found >/dev/null
cat <<YAML | kubectl apply -f - >/dev/null
apiVersion: v1
kind: Pod
metadata: {name: writer, namespace: $NS}
spec:
  nodeName: $WNODE
  restartPolicy: Never
  containers:
  - name: w
    image: ghcr.io/cloudnative-pg/postgresql:18.1-system-trixie
    env: [{name: PGPASSWORD, value: "$SECRET"}]
    command: ["bash","-c"]
    args:
    - |
      psql -h proto-pg-rw -U app -d app -qAtc "create table if not exists t(seq int primary key, at timestamptz default now())"
      for i in \$(seq 1 400); do
        if timeout 5 psql -h proto-pg-rw -U app -d app -qAtc "insert into t(seq) values (\$i)" >/dev/null 2>&1; then echo "ACK \$i \$(date +%s.%N)"; else echo "ERR \$i \$(date +%s.%N)"; fi
        sleep 0.25
      done
YAML
kubectl -n $NS wait --for=condition=Ready pod/writer --timeout=120s >/dev/null 2>&1
sleep 12
echo "killing node $PNODE at $(date +%s.%N)"; docker kill "k3d-hms-proto-${PNODE#k3d-hms-proto-}" >/dev/null 2>&1 || docker kill "$PNODE" >/dev/null
for i in $(seq 1 40); do sleep 3; NP=$(kubectl -n $NS get cluster proto-pg -o jsonpath='{.status.currentPrimary}' 2>/dev/null); [ -n "$NP" ] && [ "$NP" != "$P" ] && break; done
echo "new primary=$NP at $(date +%s.%N)"
kubectl -n $NS wait --for=condition=Ready=false pod/writer --timeout=200s >/dev/null 2>&1 || true
for i in $(seq 1 60); do ph=$(kubectl -n $NS get pod writer -o jsonpath='{.status.phase}' 2>/dev/null); [ "$ph" = "Succeeded" ] || [ "$ph" = "Failed" ] && break; sleep 3; done
kubectl -n $NS logs writer > /tmp/writer.log 2>&1
echo "acks=$(grep -c ^ACK /tmp/writer.log) errs=$(grep -c ^ERR /tmp/writer.log)"
awk '/^ERR/{print $3; exit}' /tmp/writer.log | xargs -I{} echo "first ERR at {}"; awk '/^ERR/{e=1} e && /^ACK/{print "first ACK after ERR at", $3; exit}' /tmp/writer.log
NP=$(kubectl -n $NS get cluster proto-pg -o jsonpath='{.status.currentPrimary}')
kubectl -n $NS exec "$NP" -c postgres -- psql -U postgres -d app -Atc "select count(*), max(seq) from t" > /tmp/db.txt 2>&1; cat /tmp/db.txt
grep ^ACK /tmp/writer.log | awk '{print $2}' | sort -n > /tmp/acked.txt
kubectl -n $NS exec "$NP" -c postgres -- psql -U postgres -d app -Atc "select seq from t order by seq" | sort -n > /tmp/present.txt
echo "acked but missing: $(comm -23 /tmp/acked.txt /tmp/present.txt | wc -l)"
docker start "$PNODE" >/dev/null 2>&1 || true
