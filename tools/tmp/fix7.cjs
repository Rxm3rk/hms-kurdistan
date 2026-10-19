const fs=require('fs');
function edit(p, pairs){ let s=fs.readFileSync(p,'utf8'); const crlf=s.includes('\r\n'); if(crlf) s=s.replace(/\r\n/g,'\n'); for(const [a,b] of pairs){ if(!s.includes(a)) throw new Error(p+' missing '+a.slice(0,80)); s=s.replace(a,b);} if(crlf) s=s.replace(/\n/g,'\r\n'); fs.writeFileSync(p,s); }
const base='C:/Users/Surface/hms-demo/frontend/apps/demo/src/proto/';
edit(base+'data/patients.ts', [
 ["const FALL_RISK: Text3 = { en: 'High fall risk', ckb: 'مەترسیی بەرزی کەوتن', ar: 'خطر سقوط مرتفع' };",
  "/** The \"High fall risk\" alert text (the curated patients' fall-risk assessment). */\nexport const FALL_RISK: Text3 = { en: 'High fall risk', ckb: 'مەترسیی بەرزی کەوتن', ar: 'خطر سقوط مرتفع' };"],
 ["/** True when the patient has an allergy whose code is `code` (e.g. 'SYN-ALG-PENICILLIN'). */",
  "/** True when the patient carries the \"High fall risk\" alert. */\nexport function hasFallRiskAlert(patient: Patient): boolean {\n  return patient.alerts.some((alert) => alert.text === FALL_RISK || alert.text.en === FALL_RISK.en);\n}\n\n/** True when the patient has an allergy whose code is `code` (e.g. 'SYN-ALG-PENICILLIN'). */"],
]);
edit(base+'screens/home/derive.ts', [
 ["const FALL_RISK_EN = 'High fall risk';\n\n/** True when the patient carries the \"High fall risk\" alert. */\nexport function hasFallRisk(patient: Patient): boolean {\n  return patient.alerts.some((alert) => alert.text.en === FALL_RISK_EN);\n}",
  "/** True when the patient carries the \"High fall risk\" alert. */\nexport function hasFallRisk(patient: Patient): boolean {\n  return hasFallRiskAlert(patient);\n}"],
 ["const CRITICAL_PATIENTS: ReadonlySet<string> = new Set(unacknowledgedCriticals().map((result) => result.patientId));\n",
  "/** Patients with an unacknowledged critical result (read live: the lab screen's acknowledgement clears it). */\nfunction criticalPatients(): ReadonlySet<string> {\n  return new Set(unacknowledgedCriticals().map((result) => result.patientId));\n}\n"],
 ["  if (CRITICAL_PATIENTS.has(patient.id)) {","  if (criticalPatients().has(patient.id)) {"],
 ["  unacknowledgedCriticals,","  hasFallRiskAlert,\n  unacknowledgedCriticals,"],
]);
edit(base+'screens/ward/board-data.ts', [
 ["  return patient.alerts.some((alert) => alert.text.en === 'High fall risk') || ageInYears(patient.dob) >= 75;",
  "  return hasFallRiskAlert(patient) || ageInYears(patient.dob) >= 75;"],
 ["  unacknowledgedCriticals,","  hasFallRiskAlert,\n  unacknowledgedCriticals,"],
]);
