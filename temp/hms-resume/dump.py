import json,sys
sys.stdout.reconfigure(encoding="utf-8")
d=json.load(open(sys.argv[1],encoding='utf-8'))
print(d.get('nextPosition'), d.get('hasMore'))
for it in d['items']:
    t=it.get('text') or it.get('content') or ''
    print('=====', it.get('role') or it.get('kind'), it.get('position'), it.get('runId','')[-12:])
    print(t if isinstance(t,str) else json.dumps(t)[:3000])
