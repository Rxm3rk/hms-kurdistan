# Compare the spot-check log's printed records with the committed backlog.yaml. Args: log backlog.yaml
import json, re, sys, yaml
log = open(sys.argv[1], encoding='utf-8').read()
bl = {(r['id'], r.get('part')): r for r in yaml.safe_load(open(sys.argv[2], encoding='utf-8'))}
blocks = re.split(r'\n\[(\d+)/10\] ', log)[1:]
n = 0; bad = []
for i in range(0, len(blocks), 2):
    body = blocks[i + 1]
    rid = body.split()[0]
    rec = bl[(rid, None)]
    for m in re.finditer(r'->\s+(\w+): (.*)', body):
        f, v = m.group(1), m.group(2)
        if f == "status": continue
        val = json.loads(v)
        n += 1
        if rec.get(f) != val: bad.append((rid, f, val, rec.get(f)))
    hm = re.search(r'status: "(\w+)"; tests: (\[\]); notes: (\[\])', body)
    if not hm or rec['status'] != hm.group(1) or rec['tests'] or rec['notes']: bad.append((rid, 'hand-edited'))
print('rows', len(blocks) // 2, 'fields compared', n, 'differences', bad)
