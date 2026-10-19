import json, sys
path, n = sys.argv[1], int(sys.argv[2])
events = []
for line in open(path, encoding='utf-8'):
    try:
        d = json.loads(line)
    except Exception:
        continue
    msg = d.get('message') or {}
    role = msg.get('role') or d.get('type')
    content = msg.get('content')
    if isinstance(content, str):
        events.append((role, 'text', content))
        continue
    for c in content or []:
        t = c.get('type')
        if t == 'text':
            events.append((role, 'text', c['text']))
        elif t == 'tool_use':
            inp = c.get('input', {})
            s = inp.get('command') or inp.get('file_path') or inp.get('pattern') or json.dumps(inp)[:300]
            events.append((role, 'tool_use:' + c.get('name', ''), str(s)))
        elif t == 'tool_result':
            cc = c.get('content')
            if isinstance(cc, list):
                cc = ' '.join(x.get('text', '') for x in cc if isinstance(x, dict))
            events.append((role, 'tool_result', str(cc)))
print('total events', len(events))
for role, kind, s in events[-n:]:
    s = s.replace('\r', '')
    lim = 900 if kind == 'text' else 400
    print(f'[{role}] {kind}: {s[:lim]}')
    print('-')
