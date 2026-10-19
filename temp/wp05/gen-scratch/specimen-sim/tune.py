import importlib.util, random, sys
sys.argv=['x','0']
spec=importlib.util.spec_from_file_location('sim','sim.py'); sim=importlib.util.module_from_spec(spec); spec.loader.exec_module(sim)
C=dict(GOOD=0.92, ended=0.03, eie=0.01, lost=0.10, rej=0.09, back=0.4, retNot=0.2, retEl=0.2, reprint=0.3)
def draw(r):
  good = r.random()<C['GOOD']
  def g(p): return True if good else r.random()<p
  h={}
  o=r.random()
  h['ended']=r.random()<C['ended']
  h['active']=(not h['ended']) and (good or o<0.7)
  i=r.random()
  if good: wb=i<0.65; ov=not wb
  else: wb=i<0.45; ov=0.45<=i<0.75
  h['wb']=wb; h['nowb']=ov; h['twoid']=ov and g(0.85); h['ovchosen']=ov and g(0.85)
  h['notx']=g(0.75); h['label']=g(0.8); h['acc']=g(0.8)
  h['kit']=r.random()<(0.5 if good else 0.2); h['reprint']=r.random()<C['reprint']; h['collector']=g(0.8)
  h['ctime']=(wb or ov) and g(0.8); h['bedside']=(wb or ov) and g(0.8)
  b=r.random()<C['back']; h['btallowed']=h['paper']=h['btlabel']=b
  h['dispatch']=g(0.8); h['receipt']=g(0.8)
  a=r.random()
  if good: h['accAll']=a<0.7; h['accSome']=0.7<=a<0.95
  else: h['accAll']=a<0.35; h['accSome']=0.35<=a<0.6
  h['notAccAll']=not h['accAll']
  h['cavAuth']=r.random()<0.6; h['cavAllowed']=h['notAccAll'] and r.random()<0.7; h['cavReason']=r.random()<0.8
  f=r.random()
  if good: h['finished']=True; h['recoll']=f<0.35
  else: h['finished']=f<0.6; h['recoll']=f<0.2
  h['noRecoll']=not h['recoll']
  h['storage']=g(0.8)
  t=r.random()
  h['retNotReq']=t<C['retNot']; h['retElapsed']=t<C['retEl']; h['noHold']=g(0.75)
  j=r.random(); h['rejChosen']=j<C['rej']; h['labelDefect']=j<C['rej']/2
  h['lost']=r.random()<C['lost']; h['eie']=r.random()<C['eie']
  return h
sim.draw=draw
mins=[]; allf=[]
for seed in range(60):
  f=sim.run(seed); mins.append(min(f)); allf.append(f)
print([(sim.T[k][1], min(x[k] for x in allf), round(sum(x[k] for x in allf)/len(allf))) for k in range(len(sim.T))])
print(sorted(mins)[:10])
