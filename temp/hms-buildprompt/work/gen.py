import sys, collections
sys.path.insert(0, '.')
from rows import R

TITLES = {
 'PLT': 'PLT · Platform/NFR',
 'TRU': 'TRU · Trust plane, security, downtime',
 'ACC': 'ACC · Patient access',
 'CLN': 'CLN · Clinical core',
 'NUR': 'NUR · Nursing',
 'MED': 'MED · Medication',
 'DX': 'DX · Diagnostics (LIS, RIS, imaging, transfusion)',
 'DEV': 'DEV · Devices',
 'SPC': 'SPC · Specialty',
 'RCM': 'RCM · Revenue',
 'ERP': 'ERP · ERP',
 'OPS': 'OPS · Operations',
 'INT': 'INT · Interoperability',
 'AI': 'AI · AI and data',
 'DFD': 'DFD · Front door',
 'IMP': 'IMP · Implementation tooling and telemetry',
 'KRI': 'KRI · Kurdistan features (K §4.1)',
}

out = []
w = out.append
w(open('head.md', encoding='utf-8').read().rstrip('\n'))
w('')
w('## 2. Backlog by domain')
w('')
w('Scope is R14 text, trimmed, or BP/K text for new items.')
w('')
order = []
for r in R:
    if r[0] not in order: order.append(r[0])
for t in order:
    w('### ' + TITLES[t])
    w('')
    w('| ID | Feature | Size | Phase | Stance | Scope | Kurdistan note |')
    w('|---|---|---|---|---|---|---|')
    for (tt, i, n, s, e, p, st, sc, no, cnt) in R:
        if tt != t: continue
        idc = i if cnt == 1 else i.replace(' (', ' · part (').replace('part (scheme part)', 'part: scheme').replace('part (PHR push)', 'part: PHR push')
        w('| %s | %s | %s | %s | %s | %s | %s |' % (idc, n, s, p, st, sc, no))
    w('')
w(open('tail.md', encoding='utf-8').read().rstrip('\n'))
open('digest.md', 'w', encoding='utf-8').write('\n'.join(out) + '\n')
print('ok')
