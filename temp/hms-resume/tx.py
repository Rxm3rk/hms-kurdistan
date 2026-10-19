import json,sys
sys.stdout.reconfigure(encoding="utf-8")
path=sys.argv[1]; maxlen=int(sys.argv[2]) if len(sys.argv)>2 else 300
for line in open(path,encoding='utf-8'):
    try: o=json.loads(line)
    except: continue
    m=o.get('message') or {}
    role=m.get('role') or o.get('type')
    c=m.get('content')
    if isinstance(c,str):
        print(f"[{role}] TEXT {c[:maxlen]}"); continue
    for b in c or []:
        t=b.get('type')
        if t=='text': print(f"[{role}] TEXT {b['text'][:maxlen*4]}")
        elif t=='tool_use':
            i=b['input']; s=i.get('file_path') or i.get('command') or i.get('pattern') or json.dumps(i)
            extra=''
            if b['name'] in('Edit',): extra=' OLD:'+i.get('old_string','')[:120].replace('\n','⏎')+' NEW:'+i.get('new_string','')[:200].replace('\n','⏎')
            print(f"[{role}] TOOL {b['name']}: {str(s)[:maxlen]}{extra}")
        elif t=='tool_result':
            cc=b.get('content'); 
            if isinstance(cc,list): cc=' '.join(x.get('text','') for x in cc if isinstance(x,dict))
            print(f"[{role}] RESULT {str(cc)[:maxlen//2]}".replace('\n','⏎'))
