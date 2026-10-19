import fs from 'node:fs';
const src = fs.readFileSync('C:/Users/Surface/hms-demo/frontend/apps/demo/src/proto/data/clinical.ts','utf8');
const plans = [...src.matchAll(/patientId: '(SYN-PAT-\d+)',[\s\S]*?temp: \[([^\]]*)\],\s*hr: \[([^\]]*)\],\s*sys: \[([^\]]*)\],[\s\S]*?rr: \[([^\]]*)\],\s*spo2: \[([^\]]*)\],[\s\S]*?news2: \[([^\]]*)\]/g)];
const arr = (s) => s.split(',').map((x) => Number(x.trim().replace(/'/g,'')));
const rr=(v)=>v<=8?3:v<=11?1:v<=20?0:v<=24?2:3;
const sp=(v)=>v<=91?3:v<=93?2:v<=95?1:0;
const sb=(v)=>v<=90?3:v<=100?2:v<=110?1:v<=219?0:3;
const hr=(v)=>v<=40?3:v<=50?1:v<=90?0:v<=110?1:v<=130?2:3;
const te=(v)=>v<=35?3:v<=36?1:v<=38?0:v<=39?1:2;
const oxy = {'SYN-PAT-0101':[1,1,1,1,1,1],'SYN-PAT-0109':[1,1,1,1,1,1]};
const sed = {'SYN-PAT-0109':true};
for (const m of plans) {
  const [_, id, t, h, s, r, o, n] = m;
  const T=arr(t),H=arr(h),S=arr(s),R=arr(r),O=arr(o);
  const calc = T.map((_,i)=>rr(R[i])+sp(O[i])+(oxy[id]?2:0)+sb(S[i])+hr(H[i])+(sed[id]?3:0)+te(T[i]));
  console.log(id, 'shared', n, 'calc', calc.join(', '));
}
