const fs=require('fs');
function edit(p, pairs){ let s=fs.readFileSync(p,'utf8'); const crlf=s.includes('\r\n'); if(crlf) s=s.replace(/\r\n/g,'\n'); for(const [a,b] of pairs){ if(!s.includes(a)) throw new Error(p+' missing '+a.slice(0,80)); s=s.replace(a,b);} if(crlf) s=s.replace(/\n/g,'\r\n'); fs.writeFileSync(p,s); }
const base='C:/Users/Surface/hms-demo/frontend/apps/demo/src/proto/';
let lab=fs.readFileSync(base+'data/lab.ts','utf8');
const firstImport = lab.indexOf('import ');
lab = lab.slice(0, firstImport) + "import { isAcknowledgedInSession } from './acknowledgements.ts';\n" + lab.slice(firstImport);
fs.writeFileSync(base+'data/lab.ts', lab);
edit(base+'data/lab.ts', [
 ["export function unacknowledgedCriticals(): readonly LabResult[] {\n  return RESULTS.filter((candidate) => candidate.critical !== null && !candidate.critical.acknowledged);\n}",
  "export function unacknowledgedCriticals(): readonly LabResult[] {\n  return RESULTS.filter(\n    (candidate) => candidate.critical !== null && !candidate.critical.acknowledged && !isAcknowledgedInSession(candidate.id),\n  );\n}"],
]);
edit(base+'data/index.ts', [["export * from './lab.ts';","export * from './lab.ts';\nexport * from './acknowledgements.ts';"]]);
edit(base+'screens/lab/lab-store.ts', [
 ["import { DEMO_NOW_ISO, type Text3 } from '../../data/index.ts';","import { acknowledgeCriticalResult, DEMO_NOW_ISO, resetCriticalAcknowledgements, type Text3 } from '../../data/index.ts';"],
 ["  acknowledge(ack: CriticalAck): void {\n    update((current) => ({ ...current, acks: { ...current.acks, [ack.resultId]: ack } }));\n  },",
  "  acknowledge(ack: CriticalAck): void {\n    update((current) => ({ ...current, acks: { ...current.acks, [ack.resultId]: ack } }));\n    // Shared with the other screens (home, ward board, chart): the result is no longer unacknowledged.\n    acknowledgeCriticalResult(ack.resultId);\n  },"],
 ["  reset(): void {\n    update(() => INITIAL);\n  },","  reset(): void {\n    update(() => INITIAL);\n    resetCriticalAcknowledgements();\n  },"],
]);
