import sys
import json,sys
sys.stdout.reconfigure(encoding="utf-8")
raw=open(sys.argv[1],encoding='utf-8').read()
i=raw.find("{"); obj=json.loads(raw[i:raw.rfind("}")+1]); data=obj["result"]
if data is None:
    print(raw[:2000]); sys.exit()
for g in data:
    print("="*100); print("GROUP", g['group'])
    v=g.get('verdict') or {}
    for x in v.get('verdicts',[]): print(f"  verify {x['id']}: {x['verdict']} :: {x['gaps'][:300]}")
    print("  verifier other:", (v.get('other_problems') or '')[:600])
    final=g.get('fixup') or g.get('fix')
    print("  FINAL from", 'fixup' if g.get('fixup') else 'fix')
    for f in final['findings']:
        print(f"  [{f['id']}] {f['status']} | note: {f['resolution_note'][:300]}")
        print(f"       residual: {f['residual'][:500]}")
    print("  NOTES_FOR_LEAD:", final['notes_for_lead'][:3500])
