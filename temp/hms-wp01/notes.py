import json,sys
sys.stdout.reconfigure(encoding="utf-8")
raw=open(sys.argv[1],encoding='utf-8').read()
i=raw.find("{"); data=json.loads(raw[i:raw.rfind("}")+1])["result"]
for g in data:
    final=g.get('fixup') or g.get('fix')
    with open(f"notes-{g['group']}.txt","w",encoding="utf-8") as fh:
        fh.write(final['notes_for_lead'])
        fh.write("\n\n---- VERIFIER OTHER PROBLEMS ----\n"+(g.get('verdict') or {}).get('other_problems',''))
        fh.write("\n\n---- FINAL FINDINGS ----\n")
        for f in final['findings']:
            fh.write(f"\n[{f['id']}] {f['status']}\nNOTE: {f['resolution_note']}\nRESIDUAL: {f['residual']}\nFILES: {', '.join(f['files'])}\nTESTS: {f['tests'][:1500]}\n")
    print(g['group'], len(final['notes_for_lead']))
