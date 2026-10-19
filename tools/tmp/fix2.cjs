const fs=require('fs');const p='C:/Users/Surface/hms-demo/frontend/apps/demo/src/proto/shell/proto-module.ts';let s=fs.readFileSync(p,'utf8');
const r=(a,b)=>{ if(!s.includes(a)) throw new Error('missing '+a.slice(0,60)); s=s.replace(a,b); };
r("import { bannerDataOf, findPatient, PATIENTS } from '../data/patients.ts';","import { bannerDataOf, findPatient, PATIENTS } from '../data/patients.ts';\nimport { sessionPatients } from '../data/session-patients.ts';");
r(`let entries: readonly PatientListEntry[] | null = null;

/** Every synthetic patient as a list entry (parsed once). */
function listEntries(): readonly PatientListEntry[] {
  entries ??= PATIENTS.map((patient) => ({
    patientId: patient.id,
    identity: parseBannerData(bannerDataOf(patient), SYNTHETIC_BANNER_VOCABULARIES),
  }));
  return entries;
}`,`let entries: readonly PatientListEntry[] | null = null;
let entriesSession: readonly unknown[] | null = null;

/**
 * Every synthetic patient, then this session's registrations, as list entries (parsed again only after a
 * registration).
 */
function listEntries(): readonly PatientListEntry[] {
  const session = sessionPatients();
  if (entries === null || entriesSession !== session) {
    entries = [...PATIENTS, ...session].map((patient) => ({
      patientId: patient.id,
      identity: parseBannerData(bannerDataOf(patient), SYNTHETIC_BANNER_VOCABULARIES),
    }));
    entriesSession = session;
  }
  return entries;
}`);
fs.writeFileSync(p,s);
