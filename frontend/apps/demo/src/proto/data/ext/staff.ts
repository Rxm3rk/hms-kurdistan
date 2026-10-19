/**
 * The staff master for the Staff & rosters screen: the shared demo staff plus a few more clinicians, each
 * with typed practitioner identifiers (Kurdistan Medical Syndicate, Iraqi Medical Association, KRG MOH
 * practising licence, nursing and pharmacists' syndicates; every number invented), clinical privileges,
 * the duty roster for three weeks (the week runs Saturday to Friday; Friday is the weekend) and today's
 * on-call rota. SYNTHETIC DATA ONLY, NOT FOR CLINICAL USE.
 */
import { STAFF, demoDate } from '../index.ts';
import type { DepartmentId, StaffMember, Text3 } from '../types.ts';
import { T, seeded } from './mi-common.ts';

const DR: Text3 = { en: 'Dr.', ckb: 'د.', ar: 'د.' };

/** Clinicians who are not in the shared list (anaesthesia, emergency, extra nurses). */
export const EXTRA_STAFF: readonly StaffMember[] = [
  { id: 'SYN-STF-021', name: { ckb: 'دەریا ئیسماعیل', ar: 'دريا إسماعيل', latin: 'Darya Ismail' }, prefix: DR, role: 'physician', title: T('Consultant anaesthetist', 'ڕاوێژکاری بێهۆشکردن', 'استشارية التخدير'), departmentId: 'general-surgery', phone: '+964 750 000 9021', active: true, lastSignInIso: '2026-10-19T07:05:00+03:00' },
  { id: 'SYN-STF-022', name: { ckb: 'بریار نادر', ar: 'بريار نادر', latin: 'Bryar Nadir' }, prefix: DR, role: 'physician', title: T('Emergency physician', 'پزیشکی فریاکەوتن', 'طبيب طوارئ'), departmentId: 'emergency', phone: '+964 750 000 9022', active: true, lastSignInIso: '2026-10-19T08:00:00+03:00' },
  { id: 'SYN-STF-023', name: { ckb: 'موحەممەد جاسم', ar: 'محمد جاسم', latin: 'Mohammed Jasim' }, prefix: DR, role: 'physician', title: T('Resident doctor, Emergency', 'پزیشکی نیشتەجێ، فریاکەوتن', 'طبيب مقيم، الطوارئ'), departmentId: 'emergency', phone: '+964 750 000 9023', active: true, lastSignInIso: '2026-10-18T21:40:00+03:00' },
  { id: 'SYN-STF-024', name: { ckb: 'هودا عەباس', ar: 'هدى عباس', latin: 'Huda Abbas' }, prefix: DR, role: 'physician', title: T('Specialist paediatrician', 'پسپۆڕی منداڵان', 'أخصائية أطفال'), departmentId: 'paediatrics', phone: '+964 750 000 9024', active: true, lastSignInIso: '2026-10-19T08:20:00+03:00' },
  { id: 'SYN-STF-025', name: { ckb: 'ڤیان شێروان', ar: 'فيان شيروان', latin: 'Vian Sherwan' }, prefix: null, role: 'nurse', title: T('Senior staff nurse, Intensive Care', 'پەرستاری باڵا، چاودێریی چڕ', 'ممرضة أولى، العناية المركزة'), departmentId: 'nursing', phone: '+964 750 000 9025', active: true, lastSignInIso: '2026-10-19T07:25:00+03:00' },
  { id: 'SYN-STF-026', name: { ckb: 'ڕوناک حوسێن', ar: 'روناك حسين', latin: 'Ronak Hussein' }, prefix: null, role: 'nurse', title: T('Staff nurse, Emergency', 'پەرستار، فریاکەوتن', 'ممرضة، الطوارئ'), departmentId: 'emergency', phone: '+964 750 000 9026', active: true, lastSignInIso: '2026-10-19T07:30:00+03:00' },
];

export const ALL_STAFF: readonly StaffMember[] = [...STAFF, ...EXTRA_STAFF];

const STAFF_BY_ID: ReadonlyMap<string, StaffMember> = new Map(ALL_STAFF.map((m) => [m.id, m]));

/** A staff member of the shared list or the extra clinicians, or undefined. */
export function staffById(id: string): StaffMember | undefined {
  return STAFF_BY_ID.get(id);
}

export type IdentifierSystem = 'kms' | 'ima' | 'moh' | 'kns' | 'kps' | 'kshp' | 'emp';

export interface PractitionerId {
  readonly system: IdentifierSystem;
  readonly value: string;
  /** `YYYY-MM-DD`, or null for identifiers that do not expire. */
  readonly expires: string | null;
  readonly verified: boolean;
}

export type PrivilegeStatus = 'granted' | 'supervised' | 'pending' | 'suspended';

export interface Privilege {
  readonly id: string;
  readonly text: Text3;
  readonly status: PrivilegeStatus;
}

export interface StaffProfile {
  readonly staffId: string;
  readonly employment: 'full-time' | 'part-time' | 'visiting';
  readonly joinedOn: string;
  readonly identifiers: readonly PractitionerId[];
  readonly privileges: readonly Privilege[];
  readonly languages: readonly ('ckb' | 'kmr' | 'ar' | 'en' | 'tr' | 'fa')[];
  readonly onCallEligible: boolean;
}

const PRIV: Readonly<Record<string, Text3>> = {
  admit: T('Admit and discharge inpatients', 'خەواندن و دەرکردنی نەخۆش', 'إدخال المرضى وإخراجهم'),
  prescribe: T('Prescribe medicines', 'نووسینی دەرمان', 'وصف الأدوية'),
  controlled: T('Prescribe controlled drugs', 'نووسینی دەرمانی کۆنترۆڵکراو', 'وصف الأدوية الخاضعة للرقابة'),
  cvc: T('Insert central venous catheters', 'دانانی کاتێتەری دەماری ناوەندی', 'إدخال القسطرة الوريدية المركزية'),
  lap: T('Laparoscopic surgery', 'نەشتەرگەریی لابرۆسکۆپی', 'الجراحة بالمنظار'),
  open: T('Open abdominal surgery', 'نەشتەرگەریی کراوەی سک', 'جراحة البطن المفتوحة'),
  sedation: T('Procedural sedation', 'هێوەرکردنەوە بۆ کردار', 'التهدئة الإجرائية'),
  ga: T('General anaesthesia', 'بێهۆشکردنی گشتی', 'التخدير العام'),
  echo: T('Report echocardiograms', 'ڕاپۆرتی ئێکۆی دڵ', 'كتابة تقارير صدى القلب'),
  cath: T('Coronary angiography', 'ئەنجیۆگرافیی دڵ', 'تصوير الأوعية التاجية'),
  vent: T('Manage mechanical ventilation', 'بەڕێوەبردنی هەناسەدەری دەستکرد', 'إدارة التنفس الاصطناعي'),
  neonatal: T('Neonatal resuscitation', 'زیندووکردنەوەی ساوا', 'إنعاش حديثي الولادة'),
  ct: T('Report CT and MRI', 'ڕاپۆرتی CT و MRI', 'كتابة تقارير المقطعي والرنين'),
  iv: T('Give IV medicines', 'دانی دەرمانی دەمار', 'إعطاء الأدوية الوريدية'),
  chemo: T('Give high-alert infusions (second check)', 'دانی ئینفیوژنی مەترسیدار (پشکنینی دووەم)', 'إعطاء التسريبات عالية الخطورة (تحقق ثانٍ)'),
  triage: T('ED triage (Manchester)', 'پۆلێنکردنی فریاکەوتن (مانچستەر)', 'فرز الطوارئ (مانشستر)'),
  verify: T('Verify and release results', 'پشتڕاستکردنەوە و بڵاوکردنەوەی ئەنجام', 'التحقق من النتائج وإصدارها'),
  dispense: T('Verify and dispense prescriptions', 'پشتڕاستکردنەوە و دابەشکردنی ڕەچەتە', 'التحقق من الوصفات وصرفها'),
};

const p = (id: string, status: PrivilegeStatus): Privilege => ({ id, text: PRIV[id] ?? T(id, id, id), status });

const PRIVILEGES_BY_STAFF: Readonly<Record<string, readonly Privilege[]>> = {
  'SYN-STF-001': [p('admit', 'granted'), p('prescribe', 'granted'), p('controlled', 'granted'), p('cvc', 'granted')],
  'SYN-STF-005': [p('admit', 'granted'), p('prescribe', 'granted'), p('lap', 'granted'), p('open', 'granted'), p('sedation', 'pending')],
  'SYN-STF-006': [p('admit', 'granted'), p('prescribe', 'granted'), p('neonatal', 'granted'), p('sedation', 'granted')],
  'SYN-STF-007': [p('admit', 'granted'), p('prescribe', 'granted'), p('controlled', 'granted'), p('cvc', 'granted'), p('vent', 'granted')],
  'SYN-STF-008': [p('prescribe', 'supervised'), p('admit', 'supervised'), p('cvc', 'pending')],
  'SYN-STF-016': [p('admit', 'granted'), p('prescribe', 'granted')],
  'SYN-STF-017': [p('admit', 'granted'), p('prescribe', 'granted'), p('echo', 'granted'), p('cath', 'pending')],
  'SYN-STF-013': [p('ct', 'granted'), p('sedation', 'supervised')],
  'SYN-STF-020': [p('prescribe', 'suspended'), p('admit', 'suspended')],
  'SYN-STF-021': [p('ga', 'granted'), p('sedation', 'granted'), p('cvc', 'granted'), p('controlled', 'granted')],
  'SYN-STF-022': [p('admit', 'granted'), p('prescribe', 'granted'), p('sedation', 'granted'), p('triage', 'granted')],
  'SYN-STF-023': [p('prescribe', 'supervised'), p('triage', 'granted'), p('sedation', 'pending')],
  'SYN-STF-024': [p('admit', 'granted'), p('prescribe', 'granted'), p('neonatal', 'pending')],
  'SYN-STF-012': [p('dispense', 'granted')],
  'SYN-STF-011': [p('verify', 'granted')],
};

const NURSE_PRIVS = [p('iv', 'granted'), p('chemo', 'granted')];

function identifiersOf(member: StaffMember, index: number, rnd: () => number): readonly PractitionerId[] {
  const n = (base: number) => String(base + Math.floor(rnd() * 8999));
  // Expiry dates spread so that a few fall within the next 90 days (and one has lapsed).
  const expiry = (months: number): string => demoDate(-Math.round(months * 30));
  const soon = index % 5 === 2 ? 1.5 : index % 7 === 3 ? -0.3 : 6 + (index % 4) * 5;
  const ids: PractitionerId[] = [];
  const gov = ['ERB', 'SUL', 'DHK'][index % 3] ?? 'ERB';
  switch (member.role) {
    case 'physician':
    case 'radiology':
      ids.push({ system: 'kms', value: `KMS-${gov}-${n(10000)}`, expires: expiry(soon), verified: index % 6 !== 4 });
      ids.push({ system: 'ima', value: `IMA-${n(100000)}`, expires: null, verified: true });
      ids.push({ system: 'moh', value: `MOH-PL-2026-${n(1000)}`, expires: expiry(soon + 2), verified: true });
      break;
    case 'nurse':
      ids.push({ system: 'kns', value: `KNS-${gov}-${n(20000)}`, expires: expiry(soon), verified: true });
      ids.push({ system: 'moh', value: `MOH-NL-2026-${n(1000)}`, expires: expiry(soon + 3), verified: index % 4 !== 1 });
      break;
    case 'pharmacist':
      ids.push({ system: 'kps', value: `KPS-${gov}-${n(3000)}`, expires: expiry(soon), verified: true });
      ids.push({ system: 'moh', value: `MOH-PH-2026-${n(1000)}`, expires: expiry(soon + 4), verified: true });
      break;
    case 'lab':
      ids.push({ system: 'kshp', value: `KSHP-${gov}-${n(5000)}`, expires: expiry(soon), verified: true });
      break;
    default:
      break;
  }
  ids.push({ system: 'emp', value: `EMP-${String(1040 + index * 13)}`, expires: null, verified: true });
  return ids;
}

const LANGS: readonly StaffProfile['languages'][] = [
  ['ckb', 'ar', 'en'],
  ['ckb', 'en'],
  ['ckb', 'kmr', 'ar'],
  ['ar', 'en', 'ckb'],
  ['ckb', 'ar', 'tr'],
  ['ckb', 'fa', 'en'],
];

export const PROFILES: Readonly<Record<string, StaffProfile>> = Object.fromEntries(
  ALL_STAFF.map((member, index) => {
    const rnd = seeded(4400 + index * 17);
    const clinical = member.role === 'physician' || member.role === 'nurse' || member.role === 'radiology';
    const profile: StaffProfile = {
      staffId: member.id,
      employment: index % 9 === 4 ? 'visiting' : index % 7 === 5 ? 'part-time' : 'full-time',
      joinedOn: `${String(2012 + (index % 13))}-${String((index % 12) + 1).padStart(2, '0')}-01`,
      identifiers: identifiersOf(member, index, rnd),
      privileges: PRIVILEGES_BY_STAFF[member.id] ?? (member.role === 'nurse' ? NURSE_PRIVS : []),
      languages: LANGS[index % LANGS.length] ?? ['ckb'],
      onCallEligible: clinical && member.active,
    };
    return [member.id, profile];
  }),
);

// ---------------------------------------------------------------------------------------------------------
// Duty roster
// ---------------------------------------------------------------------------------------------------------

export type ShiftCode = 'M' | 'E' | 'N' | 'D' | 'OC' | 'OFF' | 'AL';
export const SHIFT_CYCLE: readonly ShiftCode[] = ['M', 'E', 'N', 'D', 'OC', 'OFF', 'AL'];

/** Saturdays that start the three roster weeks: the week before, this week (17–23 Oct), next week. */
export const ROSTER_WEEKS: readonly string[] = [demoDate(9), demoDate(2), demoDate(-5)];

export function weekDays(weekStart: string): readonly string[] {
  const start = Date.parse(`${weekStart}T12:00:00+03:00`);
  return Array.from({ length: 7 }, (_, i) => new Date(start + i * 86_400_000 + 3 * 3_600_000).toISOString().slice(0, 10));
}

const ROSTERED = ALL_STAFF.filter((m) => m.active && (m.role === 'physician' || m.role === 'nurse' || m.role === 'lab' || m.role === 'pharmacist' || m.role === 'radiology'));
export const ROSTER_STAFF_IDS: readonly string[] = ROSTERED.map((m) => m.id);

function buildRoster(): Readonly<Record<string, ShiftCode>> {
  const roster: Record<string, ShiftCode> = {};
  ROSTERED.forEach((member, si) => {
    const rnd = seeded(900 + si * 31);
    for (const week of ROSTER_WEEKS) {
      weekDays(week).forEach((day, di) => {
        const friday = di === 6;
        let code: ShiftCode;
        if (member.role === 'nurse') {
          const pattern: readonly ShiftCode[] = ['M', 'M', 'E', 'E', 'N', 'N', 'OFF', 'OFF'];
          code = pattern[(si * 3 + di + ROSTER_WEEKS.indexOf(week) * 7) % pattern.length] ?? 'M';
          if (member.id === 'SYN-STF-019') {
            code = friday ? 'OFF' : 'N';
          }
        } else if (member.role === 'physician') {
          code = friday ? (rnd() > 0.8 ? 'OC' : 'OFF') : rnd() > 0.85 ? 'OC' : 'D';
        } else {
          code = friday ? 'OFF' : 'M';
        }
        if (member.id === 'SYN-STF-016' && week === ROSTER_WEEKS[2]) {
          code = 'AL';
        }
        roster[`${member.id}|${day}`] = code;
      });
    }
  });
  // Today's on-call doctors.
  roster[`SYN-STF-007|${demoDate(0)}`] = 'OC';
  roster[`SYN-STF-022|${demoDate(0)}`] = 'D';
  return roster;
}

export const ROSTER: Readonly<Record<string, ShiftCode>> = buildRoster();

// ---------------------------------------------------------------------------------------------------------
// On call today
// ---------------------------------------------------------------------------------------------------------

export interface OnCall {
  readonly id: string;
  readonly service: Text3;
  readonly departmentId: DepartmentId;
  readonly firstId: string;
  readonly secondId: string;
  readonly consultantId: string;
  readonly from: string;
  readonly to: string;
}

export const ON_CALL: readonly OnCall[] = [
  { id: 'oc-med', service: T('Internal medicine', 'نەخۆشییە ناوەکییەکان', 'الباطنية'), departmentId: 'internal-medicine', firstId: 'SYN-STF-008', secondId: 'SYN-STF-016', consultantId: 'SYN-STF-001', from: '16:00', to: '08:00' },
  { id: 'oc-surg', service: T('General surgery', 'نەشتەرگەریی گشتی', 'الجراحة العامة'), departmentId: 'general-surgery', firstId: 'SYN-STF-023', secondId: 'SYN-STF-005', consultantId: 'SYN-STF-005', from: '16:00', to: '08:00' },
  { id: 'oc-icu', service: T('Intensive care', 'چاودێریی چڕ', 'العناية المركزة'), departmentId: 'intensive-care', firstId: 'SYN-STF-021', secondId: 'SYN-STF-007', consultantId: 'SYN-STF-007', from: '08:00', to: '08:00' },
  { id: 'oc-paeds', service: T('Paediatrics', 'منداڵان', 'الأطفال'), departmentId: 'paediatrics', firstId: 'SYN-STF-024', secondId: 'SYN-STF-006', consultantId: 'SYN-STF-006', from: '14:00', to: '08:00' },
  { id: 'oc-cardio', service: T('Cardiology', 'دڵ', 'القلب'), departmentId: 'cardiology', firstId: 'SYN-STF-017', secondId: 'SYN-STF-017', consultantId: 'SYN-STF-017', from: '16:00', to: '08:00' },
  { id: 'oc-ed', service: T('Emergency department', 'فریاکەوتن', 'الطوارئ'), departmentId: 'emergency', firstId: 'SYN-STF-022', secondId: 'SYN-STF-023', consultantId: 'SYN-STF-022', from: '08:00', to: '20:00' },
  { id: 'oc-anaes', service: T('Anaesthesia', 'بێهۆشکردن', 'التخدير'), departmentId: 'general-surgery', firstId: 'SYN-STF-021', secondId: 'SYN-STF-007', consultantId: 'SYN-STF-021', from: '16:00', to: '08:00' },
  { id: 'oc-rad', service: T('Radiology', 'تیشکناسی', 'الأشعة'), departmentId: 'radiology', firstId: 'SYN-STF-013', secondId: 'SYN-STF-013', consultantId: 'SYN-STF-013', from: '16:00', to: '08:00' },
  { id: 'oc-lab', service: T('Laboratory', 'تاقیگە', 'المختبر'), departmentId: 'laboratory', firstId: 'SYN-STF-011', secondId: 'SYN-STF-011', consultantId: 'SYN-STF-011', from: '20:00', to: '08:00' },
  { id: 'oc-pharm', service: T('Pharmacy', 'دەرمانخانە', 'الصيدلية'), departmentId: 'pharmacy', firstId: 'SYN-STF-012', secondId: 'SYN-STF-012', consultantId: 'SYN-STF-012', from: '20:00', to: '08:00' },
];
