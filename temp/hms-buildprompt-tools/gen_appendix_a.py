import re, sys, pathlib, collections
src = pathlib.Path(sys.argv[1]).read_text(encoding='utf-8')
out = pathlib.Path(sys.argv[2])
start = src.index('## 2. Backlog by domain'); end = src.index('### Review-added control sets')
body = src[start:end]
EW = {'S':3,'M':8,'L':20,'XL':50}
def ew(size):
    s=size.strip()
    if '+12 net' in s: return 12
    if '−3' in s or '-3' in s: return 5
    if s.startswith('L+M'): return 28
    if s.startswith('≈3'): return 3
    m=re.match(r'(XL|L|M|S)\b',s)
    return EW[m.group(1)] if m else 0
OV = {
 'PLT-UX-04':('R2b','Mobile app is needed for nurse BCMA in R2b'),
 'TRU-SEC-02':('R1','Controls built from R1; the certification itself is [HUMAN]'),
 'TRU-SEC-03':('R1','Controls built from R1; attestations are [HUMAN]'),
 'CLN-CDS-01':('R1','[P] Pulled to R1 so outpatient e-prescribing is screened'),
 'CLN-CDS-02':('R1','[P] Outpatient subset in R1; transcription checks R2a; full CPOE checks R2b'),
 'CLN-CDS-03':('R1','CDS runs from R1, so telemetry and the harness do too'),
 'CLN-DOC-02':('R1','Provenance from the first note; bloat indicators by R2b'),
 'CLN-IPC-01':('R1','Banner flag in R1; bed-board use in R2a'),
 'CLN-ACP-01':('R2a','Inpatient workflow; the banner field exists from R1'),
 'CLN-INC-01':('R1','Safety-event reporting from the first go-live'),
 'CLN-QI-01':('R1','Measure engine in R1; JCI and KRG packs complete by R2b'),
 'CLN-CDS-07':('P3','Device-grade partner model, silent first (K §11.2 AI-3)'),
 'MED-KRI-01':('R1','Brand master for the R1 POS; unit-dose labels by R2a'),
 'DX-BB-02':('R2b','Optional inbound adapter only; no interface assumed (K §9.1)'),
 'DFD-BOK-01':('R1.1','Ships with wallet payment links'),
 'IMP-TEL-01':('R1','Usability telemetry from the first go-live (T-120 baselines)'),
 'KRI-LOC-02':('R1','Framework in R1; Badini content before the first Duhok go-live'),
 'OPS-RTL-01':('P2','RTLS ingestion is P2 (K §4.3, §9.2); the engine is never built'),
}
EXTRA = {
 'CLN-ORD-02':'Outpatient orders R1; inpatient CPOE R2b',
 'CLN-RES-01':'Outpatient result acknowledgement runs in R1 through DX-ORD-01',
 'SPC-MAT-01':'Newborn registration, mother-baby link and birth notification R2a; electronic L&D record R2b',
 'SPC-OT-03':'OT charging and stock R2a; clinical intra-op record R2b',
 'ERP-IMP-01':'Consignment bill-only PO built in R2.1 with ERP-PRC-01',
 'DEV-GW-01':'Nothing clinical depends on a device feed before R2.1',
}
domains=[]; cur=None
for line in body.splitlines():
    h=re.match(r'^### (\S+) · (.+)$', line)
    if h:
        cur={'code':h.group(1),'name':h.group(2).strip(),'rows':[]}; domains.append(cur); continue
    if cur and line.startswith('| ') and not line.startswith('| ID') and not line.startswith('|---'):
        cells=[c.strip() for c in line.strip().strip('|').split('|')]
        if len(cells)<7: cells+=['']*(7-len(cells))
        cur['rows'].append(cells[:7])
tot=collections.OrderedDict((k,[0,0]) for k in ['R1','R1.1','R2a','R2b','R2.1','P2','P3','DROPPED-K'])
lines=[]
lines.append('## Appendix A. The backlog of record (Kurdistan)\n')
lines.append('Every feature the programme builds, integrates or deliberately drops, from R14 Appendix A as amended by BP §4.1 and K §4.1. **Sizes** are engineer-weeks of happy-path coding (S≈3, M≈8, L≈20, XL≈50); squad person-months ≈ engineer-weeks × 0.72 plus regulated overhead. **Stance:** B build, I integrate, P partner or licence († = domain-level stance). **Phase** is the first Kurdistan release that runs the feature: R1 wedge, R1.1, R2a inpatient Core, R2b Clinical Safety, R2.1, P2, P3, or DROPPED-K. Where this prompt places a feature differently from the K text or from a "not determinable" placement, the note says so, and **[P]** marks a safety-driven change of this prompt. Keep this table in `docs/program/backlog.yaml` and treat it as the source of truth for scope.\n')
for d in domains:
    lines.append(f"### A.{len([x for x in lines if x.startswith('### A.')])+1} {d['code']}: {d['name']}\n")
    lines.append('| ID | Feature | Size | Phase | Stance | Scope · Kurdistan note |')
    lines.append('|---|---|---|---|---|---|')
    for idc,feat,size,phase,stance,scope,note in d['rows']:
        base=idc.split(' · ')[0]
        is_part=' · part' in idc
        ph=phase
        notes=[n for n in [note] if n]
        if base in OV and not is_part:
            ph,why=OV[base]; notes.append(f"Placed {ph}: {why}")
        if base in EXTRA and not is_part:
            notes.append(EXTRA[base])
        txt=scope.rstrip('.')
        if notes: txt+=' · *'+' · '.join(n.rstrip('.') for n in notes)+'*'
        lines.append(f"| `{idc}` | {feat} | {size} | {ph} | {stance} | {txt} |")
        if ph in tot:
            if not is_part: tot[ph][0]+=1
            tot[ph][1]+=ew(size)
    lines.append('')
mvp=sum(tot[k][0] for k in ['R1','R1.1','R2a','R2b','R2.1']); mvpew=sum(tot[k][1] for k in ['R1','R1.1','R2a','R2b','R2.1'])
lines.append('### A.%d Totals after the placements above\n' % (len([x for x in lines if x.startswith('### A.')])+1))
lines.append('| Phase | Feature IDs | Engineer-weeks |'); lines.append('|---|---|---|')
for k,(n,w) in tot.items():
    lines.append(f'| {k} | {n} | {w} |')
lines.append(f'| **MVP (R1 to R2.1)** | **{mvp}** | **{mvpew}** |')
allids=sum(v[0] for v in tot.values())
lines.append(f'| **All** | **{allids}** | {sum(v[1] for v in tot.values())} |\n')
lines.append('These per-feature sums differ slightly from K\'s release-level figures (≈2,060 MVP engineer-weeks; ≈1,370 squad PM including the control sets) because K costs the AI gateway and control plane at 20 engineer-weeks where R14 sizes them at 40, and because of the placements noted above. K\'s release-level plan of record governs capacity; this table governs scope.\n')
out.write_text('\n'.join(lines), encoding='utf-8')
print('domains',len(domains),'ids',allids, dict(tot), 'mvp',mvp,mvpew)
