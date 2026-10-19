import random, re, sys
sys.path.insert(0,'.')
import yaml
spec=yaml.load(open(r'C:/Users/Surface/.t3/worktrees/hospitalmanagementsystem/t3-5dcdaa39/docs/specs/state-machines/result.yaml',encoding='utf-8'),Loader=yaml.BaseLoader)
states=spec['states']; trans=[]
for t in spec['transitions']:
    fr=t['from']; fr=[s for s in states if s!=t['to']] if fr=='*' else (fr if isinstance(fr,list) else [fr])
    trans.append((fr,t['on'],t.get('guard',[]),t['to']))
cmds=['RegisterResult']+sorted({t[1] for t in trans})
def draw(r):
    human = r.random()<0.95
    ver = r.random()<0.97
    T = human and ver and r.random()<0.95 and r.random()<0.95
    S = ver and r.random()<0.9
    Q = ver and r.random()<0.92
    C = r.random()<0.5
    D = r.random()<0.5
    P = human and r.random()<0.95 and r.random()<0.95
    CR = r.random()<0.75
    CA = r.random()<0.55
    ER = r.random()<0.45
    A = r.random()<0.5
    R = ver and r.random()<0.78
    return dict(technologistValidated=T,specimenUsable=S,qcAllowsRelease=Q,criticalValueFlagged=C,noCriticalValueFlagged=not C,
      patientDischarged=D,patientNotDischarged=not D,privilegedAndAudited=P,correctionReasonEntered=CR,cancellationReasonEntered=CA,
      errorReasonEntered=ER,autoverificationActive=A,autoverificationRulesPassed=R)
def run(seed):
    r=random.Random(seed); fired=[0]*len(trans)
    for s in range(1000):
        st='registered'
        for i in range(r.randint(1,32)):
            app=[c for c in cmds if any(st in t[0] and t[1]==c for t in trans)]
            c = r.choice(app) if app and r.random()<0.85 else r.choice(cmds)
            f=draw(r)
            m=[k for k,t in enumerate(trans) if st in t[0] and t[1]==c and all(f[g] for g in t[2])]
            assert len(m)<=1
            if m: fired[m[0]]+=1; st=trans[m[0]][3]
    return fired
mins=[]
for seed in range(20):
    f=run(seed); mins.append(min(f))
print('min fires per run', mins)
f=run(1); print(sorted(enumerate(f),key=lambda x:x[1])[:8])
