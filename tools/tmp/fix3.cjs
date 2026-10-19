const fs=require('fs');const p='C:/Users/Surface/hms-demo/frontend/apps/demo/src/proto/shell/patient-picker.tsx';let s=fs.readFileSync(p,'utf8');
const r=(a,b)=>{ if(!s.includes(a)) throw new Error('missing '+a.slice(0,60)); s=s.replace(a,b); };
r("import { useMemo, useState, type ReactNode } from 'react';","import { useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';");
r("import { PATIENTS } from '../data/patients.ts';","import { PATIENTS } from '../data/patients.ts';\nimport { sessionPatients, subscribeSessionPatients } from '../data/session-patients.ts';");
r(`  const format = useFormat();
  return useMemo(() => {
    const identities = new Map(protoDirectory.list().map((entry) => [entry.patientId, entry.identity]));
    return PATIENTS.flatMap((patient): Row[] => {`,`  const format = useFormat();
  // Patients registered on the patients screen during this session are offered too.
  const session = useSyncExternalStore(subscribeSessionPatients, sessionPatients, sessionPatients);
  return useMemo(() => {
    const identities = new Map(protoDirectory.list().map((entry) => [entry.patientId, entry.identity]));
    return [...PATIENTS, ...session].flatMap((patient): Row[] => {`);
r("  }, [t, format]);\n}","  }, [t, format, session]);\n}");
fs.writeFileSync(p,s);
