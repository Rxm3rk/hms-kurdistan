import random, sys
# abstract model of SpecimenArbs: aspects -> predicate truth
T = [
 # (from set, command, guard predicates)
 ({'ordered'}, 'PrintLabels', ['active','wb','label','acc']),
 ({'ordered'}, 'PrintLabelsOv', ['active','nowb','twoid','ovchosen','notx','label','acc']),
 ({'ordered'}, 'AssignKit', ['active','wb','label','kit']),
 ({'label-printed'}, 'Reprint', ['active','label','reprint']),
 ({'label-printed'}, 'Collect', ['active','collector','ctime','wb','bedside']),
 ({'label-printed'}, 'CollectOv', ['active','collector','ctime','nowb','twoid','ovchosen','notx','bedside']),
 ({'ordered','label-printed'}, 'BackEnter', ['btallowed','paper','btlabel']),
 ({'collected'}, 'Dispatch', ['dispatch']),
 ({'in-transit'}, 'Receive', ['receipt']),
 ({'received'}, 'StartProcessing', ['accAll']),
 ({'received'}, 'StartProcessing', ['accSome','notAccAll']),
 ({'received'}, 'AcceptWithCaveat', ['notAccAll','cavAuth','cavAllowed','cavReason']),
 ({'in-process'}, 'MarkResulted', ['finished','noRecoll']),
 ({'in-process'}, 'MarkResulted', ['finished','recoll']),
 ({'resulted'}, 'Store', ['storage']),
 ({'resulted'}, 'Dispose', ['retNotReq','noHold']),
 ({'stored'}, 'Dispose', ['retElapsed','noHold']),
 ({'received','in-process'}, 'Reject', ['rejChosen']),
 ({'in-transit'}, 'Reject', ['labelDefect']),
 ({'ordered','label-printed'}, 'Cancel', ['ended']),
 ({'collected','in-transit','received','in-process'}, 'Cancel', ['ended']),
 ({'collected','in-transit','received','in-process'}, 'ReportLost', ['lost']),
 ({'stored'}, 'ReportLost', ['lost']),
 (None, 'EIE', ['eie']),
]
states=['ordered','label-printed','collected','in-transit','received','in-process','resulted','stored','disposed','rejected','cancelled','lost','entered-in-error']
T=[(set(states)-{'entered-in-error'} if f is None else f,c,g) for f,c,g in T]
to=['label-printed','label-printed','label-printed','label-printed','collected','collected','in-transit','in-transit','received','in-process','in-process','in-process','resulted','resulted','stored','disposed','disposed','rejected','rejected','cancelled','cancelled','lost','lost','entered-in-error']
commands=['CreateFromOrder','CreateForRecollection']+sorted({c for _,c,_ in T})
cmds20 = 20
P = dict(
 orders=(0.85,0.07),  # active, ended, else odd
 ident=(0.55,0.30),   # wristband, override, else broken
 twoidGood=0.9, ovChosen=0.9, notx=0.8, label=0.85, acc=0.85, kit=0.35, reprint=0.7,
 collector=0.85, ctime=0.85, bedside=0.85, backentry=0.10, dispatch=0.9, receipt=0.9,
 acc_all=0.5, acc_some=0.25, cavAuth=0.5, cavAllowed=0.6, cavReason=0.8,
 fin_clean=0.45, fin_rec=0.25, storage=0.9, ret_none=0.4, ret_elapsed=0.35, nohold=0.85,
 rej=0.16, labeldefect_share=0.5, lost=0.10, eie=0.025,
)
def draw(r):
  h={}
  o=r.random(); h['active']=o<P['orders'][0]; h['ended']=P['orders'][0]<=o<sum(P['orders'])
  i=r.random(); wb=i<P['ident'][0]; ov=P['ident'][0]<=i<sum(P['ident'])
  h['wb']=wb; h['nowb']=ov; h['twoid']=ov and r.random()<P['twoidGood']; h['ovchosen']=ov and r.random()<P['ovChosen']
  h['notx']=r.random()<P['notx']; h['label']=r.random()<P['label']; h['acc']=r.random()<P['acc']
  h['kit']=r.random()<P['kit']; h['reprint']=r.random()<P['reprint']; h['collector']=r.random()<P['collector']
  h['ctime']=(wb or ov) and r.random()<P['ctime']; h['bedside']=(wb or ov) and r.random()<P['bedside']
  b=r.random()<P['backentry']; h['btallowed']=h['paper']=h['btlabel']=b
  h['dispatch']=r.random()<P['dispatch']; h['receipt']=r.random()<P['receipt']
  a=r.random(); h['accAll']=a<P['acc_all']; h['accSome']=P['acc_all']<=a<P['acc_all']+P['acc_some']; h['notAccAll']=not h['accAll']
  h['cavAuth']=r.random()<P['cavAuth']; h['cavAllowed']=h['notAccAll'] and r.random()<P['cavAllowed']; h['cavReason']=r.random()<P['cavReason']
  f=r.random(); h['finished']=f<P['fin_clean']+P['fin_rec']; h['recoll']=P['fin_clean']<=f<P['fin_clean']+P['fin_rec']; h['noRecoll']=not h['recoll']
  h['storage']=r.random()<P['storage']
  t=r.random(); h['retNotReq']=t<P['ret_none']; h['retElapsed']=t<P['ret_none']+P['ret_elapsed']; h['noHold']=r.random()<P['nohold']
  j=r.random(); h['rejChosen']=j<P['rej']; h['labelDefect']=j<P['rej']*P['labeldefect_share']
  h['lost']=r.random()<P['lost']; h['eie']=r.random()<P['eie']
  return h
def run(seed, budget=1000):
  r=random.Random(seed); fired=[0]*len(T)
  appl={s:[c for c in commands if any(s in f and c==cc for f,cc,g in T)] for s in states}
  for _ in range(budget):
    s='ordered'; n=r.randint(1,32)
    for _ in range(n):
      ch=appl[s]
      pool = ch if ch and r.random()<0.85 else commands
      c=r.choice(pool); h=draw(r)
      cands=[k for k,(f,cc,g) in enumerate(T) if s in f and cc==c]
      ok=[k for k in cands if all(h[p] for p in T[k][2])]
      assert len(ok)<=1,(s,c)
      if ok: fired[ok[0]]+=1; s=to[ok[0]]
  return fired
mins=[]
for seed in range(int(sys.argv[1]) if len(sys.argv)>1 else 20):
  f=run(seed); mins.append(min(f))
  if seed<3: print([ (T[k][1],f[k]) for k in range(len(T))])
print('min fired per run', mins)
