/**
 * Extra synthetic data for the chart screen only (the shared data module is read-only). SYNTHETIC DATA ONLY,
 * NOT FOR CLINICAL USE: every observation, note and history item is invented.
 *
 * - Vital signs over the last 72 hours: the shared 24-hour sets (src/proto/data/clinical.ts) extended back
 *   to the admission for the curated inpatients, generated 4-hourly sets for the census inpatients, and one
 *   triage set for outpatients who have arrived. Oxygen support and consciousness (ACVPU) are added, because
 *   NEWS2 needs them.
 * - Problem lists, extra notes (with clinical time and recorded time, for late entries), earlier history
 *   for the timeline, and the hospital-course text of the discharge summaries.
 */
import {
  APPOINTMENTS,
  CENSUS_GROUPS,
  DEMO_NOW,
  DEMO_TODAY,
  NOTES,
  currentEncounter,
  daysAgoAt,
  findPatient,
  todayAt,
  vitalsOf,
  type CensusGroup,
  type Diagnosis,
  type Encounter,
  type NoteKind,
  type Patient,
  type Text3,
  type VitalSigns,
} from '../../data/index.ts';

const T = (en: string, ckb: string, ar: string): Text3 => ({ en, ckb, ar });

// ---------------------------------------------------------------------------------------------------------
// Vital signs
// ---------------------------------------------------------------------------------------------------------

export type Consciousness = 'A' | 'C' | 'V' | 'P' | 'U' | 'sedated';

export type OxygenSupport =
  | { readonly kind: 'air' }
  | { readonly kind: 'nasal' | 'mask'; readonly lpm: string }
  | { readonly kind: 'ventilator'; readonly fio2: string };

export interface ChartVitals {
  readonly iso: string;
  readonly tempC: string;
  readonly heartRate: string;
  readonly systolic: string;
  readonly diastolic: string;
  readonly respRate: string;
  readonly spo2: string;
  readonly painScore: string | null;
  readonly oxygen: OxygenSupport;
  readonly consciousness: Consciousness;
  readonly recordedById: string;
  /** Recorded in the Emergency Department or another unit before the ward admission. */
  readonly beforeAdmission: boolean;
}

/** The start of the chart's 72-hour window. */
export const WINDOW_START_ISO = daysAgoAt(3, '09:30');
const WINDOW_START = Date.parse(WINDOW_START_ISO);
const SLOT_TIMES = ['01:30', '05:30', '09:30', '13:30', '17:30', '21:30'] as const;
const NIGHT_NURSE = 'SYN-STF-019';

/** The 4-hourly observation slots of the 72-hour window, oldest first. */
function windowSlots(): readonly string[] {
  const slots: string[] = [];
  for (const daysAgo of [3, 2, 1, 0]) {
    for (const hhmm of SLOT_TIMES) {
      const iso = daysAgoAt(daysAgo, hhmm);
      const at = Date.parse(iso);
      if (at >= WINDOW_START && at <= DEMO_NOW.getTime()) {
        slots.push(iso);
      }
    }
  }
  return slots;
}

const SLOTS = windowSlots();

function isNight(iso: string): boolean {
  return /T(21|01|05):30/.test(iso);
}

const AIR: OxygenSupport = { kind: 'air' };
const nasal = (lpm: string): OxygenSupport => ({ kind: 'nasal', lpm });
const mask = (lpm: string): OxygenSupport => ({ kind: 'mask', lpm });
const vent = (fio2: string): OxygenSupport => ({ kind: 'ventilator', fio2 });

interface Start {
  readonly temp: number;
  readonly hr: number;
  readonly sys: number;
  readonly dia: number;
  readonly rr: number;
  readonly spo2: number;
  readonly pain: number | null;
}

interface Lead {
  /** Values at admission; the generated sets run from these to the first shared set. */
  readonly start: Start;
  readonly nurse: string;
  /** Oxygen of the generated sets, oldest first (the last entry repeats). */
  readonly oxygen: readonly OxygenSupport[];
  readonly consciousness?: readonly Consciousness[];
}

/** Curated inpatients admitted before the shared 24-hour sets begin. */
const LEADS: Readonly<Record<string, Lead>> = {
  'SYN-PAT-0101': {
    start: { temp: 39.4, hr: 122, sys: 108, dia: 64, rr: 27, spo2: 88, pain: 4 },
    nurse: 'SYN-STF-010',
    oxygen: [mask('6'), mask('6'), nasal('4'), nasal('3'), nasal('3'), nasal('4')],
  },
  'SYN-PAT-0102': {
    start: { temp: 36.8, hr: 88, sys: 126, dia: 72, rr: 25, spo2: 90, pain: 0 },
    nurse: 'SYN-STF-002',
    oxygen: [nasal('2'), nasal('2'), nasal('2'), nasal('2'), nasal('1'), nasal('1'), AIR],
  },
  'SYN-PAT-0107': {
    start: { temp: 36.9, hr: 98, sys: 156, dia: 90, rr: 20, spo2: 95, pain: 8 },
    nurse: 'SYN-STF-009',
    oxygen: [AIR, AIR, AIR, AIR, nasal('2'), nasal('2'), AIR],
  },
  'SYN-PAT-0109': {
    start: { temp: 39.6, hr: 138, sys: 76, dia: 40, rr: 30, spo2: 88, pain: null },
    nurse: 'SYN-STF-015',
    oxygen: [mask('15'), vent('60'), vent('55'), vent('50'), vent('50'), vent('45')],
    consciousness: ['C', 'sedated'],
  },
};

/** Oxygen and consciousness of the shared sets (six per patient); everyone else breathes room air, alert. */
const SHARED_SUPPORT: Readonly<Record<string, { readonly oxygen: readonly OxygenSupport[]; readonly consciousness?: Consciousness }>> = {
  'SYN-PAT-0101': { oxygen: [nasal('4'), nasal('4'), nasal('3'), nasal('3'), nasal('2'), nasal('2')] },
  'SYN-PAT-0109': { oxygen: [vent('45'), vent('40'), vent('40'), vent('35'), vent('35'), vent('35')], consciousness: 'sedated' },
};

/** Small, fixed wobble so generated series do not look ruled. */
const WOBBLE = [0, 0.6, -0.4, 0.9, -0.7, 0.3, -0.2, 0.8, -0.9, 0.4, -0.5, 0.7, -0.3];

function round(value: number, decimals: number): string {
  return value.toFixed(decimals);
}

function fromShared(set: VitalSigns, index: number, admittedIso: string | undefined): ChartVitals {
  const support = SHARED_SUPPORT[set.patientId];
  return {
    iso: set.iso,
    tempC: set.tempC,
    heartRate: set.heartRate,
    systolic: set.systolic,
    diastolic: set.diastolic,
    respRate: set.respRate,
    spo2: set.spo2,
    painScore: set.painScore,
    oxygen: support?.oxygen[index] ?? AIR,
    consciousness: support?.consciousness ?? 'A',
    recordedById: set.recordedById,
    beforeAdmission: admittedIso !== undefined && set.iso < admittedIso,
  };
}

function leadSets(lead: Lead, first: VitalSigns, admittedIso: string): readonly ChartVitals[] {
  const slots = SLOTS.filter((iso) => iso >= admittedIso && iso < first.iso);
  const n = slots.length;
  const target = {
    temp: Number.parseFloat(first.tempC),
    hr: Number.parseFloat(first.heartRate),
    sys: Number.parseFloat(first.systolic),
    dia: Number.parseFloat(first.diastolic),
    rr: Number.parseFloat(first.respRate),
    spo2: Number.parseFloat(first.spo2),
    pain: first.painScore === null ? null : Number.parseFloat(first.painScore),
  };
  return slots.map((iso, i): ChartVitals => {
    const frac = n <= 1 ? 0 : i / n;
    const w = WOBBLE[i % WOBBLE.length] ?? 0;
    const at = (from: number, to: number): number => from + (to - from) * frac;
    const pain = lead.start.pain === null || target.pain === null ? null : Math.max(0, Math.min(10, Math.round(at(lead.start.pain, target.pain) + w)));
    const consciousness = lead.consciousness === undefined ? 'A' : (lead.consciousness[i] ?? lead.consciousness.at(-1) ?? 'A');
    const oxygen = lead.oxygen[i] ?? lead.oxygen.at(-1) ?? AIR;
    const ventilated = oxygen.kind === 'ventilator';
    return {
      iso,
      tempC: round(at(lead.start.temp, target.temp) + w * 0.15, 1),
      heartRate: round(at(lead.start.hr, target.hr) + w * 3, 0),
      systolic: round(at(lead.start.sys, target.sys) + w * 4, 0),
      diastolic: round(at(lead.start.dia, target.dia) + w * 2, 0),
      respRate: ventilated ? '18' : round(at(lead.start.rr, target.rr) + w, 0),
      spo2: round(Math.min(100, at(lead.start.spo2, target.spo2) + w * 0.6), 0),
      painScore: pain === null ? null : String(pain),
      oxygen,
      consciousness,
      recordedById: isNight(iso) ? NIGHT_NURSE : lead.nurse,
      beforeAdmission: false,
    };
  });
}

function censusGroupOf(patientId: string): CensusGroup | undefined {
  return (Object.keys(CENSUS_GROUPS) as CensusGroup[]).find((group) => CENSUS_GROUPS[group].includes(patientId));
}

/** A small deterministic random sequence for one patient. */
function sequence(seed: number): () => number {
  let state = (seed * 2654435761) % 4294967296;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const WARD_NURSE: Readonly<Record<Exclude<CensusGroup, 'outpatient'>, string>> = {
  'med-a': 'SYN-STF-010',
  'surg-b': 'SYN-STF-009',
  paeds: 'SYN-STF-014',
  icu: 'SYN-STF-015',
};

function censusInpatientSets(patient: Patient, group: Exclude<CensusGroup, 'outpatient'>, encounter: Encounter): readonly ChartVitals[] {
  const n = Number.parseInt(patient.id.slice(-4), 10);
  const rand = sequence(n);
  const child = ageInYears(patient.dob) < 14;
  const icu = group === 'icu';
  const base = child
    ? { temp: 37.0, hr: 108 + rand() * 14, sys: 96 + rand() * 8, dia: 58, rr: 24 + rand() * 4, spo2: 97 }
    : { temp: 36.8, hr: (icu ? 86 : 72) + rand() * 16, sys: 116 + rand() * 24, dia: 70 + rand() * 10, rr: (icu ? 18 : 15) + rand() * 3, spo2: icu ? 95 : 96 + rand() * 2 };
  const oxygen = icu && n % 2 === 0 ? nasal('2') : AIR;
  return SLOTS.filter((iso) => iso >= encounter.startIso).map((iso): ChartVitals => {
    const j = (): number => rand() * 2 - 1;
    return {
      iso,
      tempC: round(base.temp + j() * 0.4, 1),
      heartRate: round(base.hr + j() * 6, 0),
      systolic: round(base.sys + j() * 8, 0),
      diastolic: round(base.dia + j() * 5, 0),
      respRate: round(base.rr + j() * 1.5, 0),
      spo2: round(Math.min(100, base.spo2 + j() * 1.2), 0),
      painScore: String(Math.round(rand() * 3)),
      oxygen,
      consciousness: 'A',
      recordedById: isNight(iso) ? NIGHT_NURSE : WARD_NURSE[group],
      beforeAdmission: false,
    };
  });
}

/** Triage observations of today's curated outpatients. */
const TRIAGE: Readonly<Record<string, Omit<ChartVitals, 'iso' | 'oxygen' | 'consciousness' | 'beforeAdmission'>>> = {
  'SYN-PAT-0108': { tempC: '36.7', heartRate: '84', systolic: '148', diastolic: '92', respRate: '16', spo2: '97', painScore: '0', recordedById: 'SYN-STF-018' },
  'SYN-PAT-0111': { tempC: '36.8', heartRate: '102', systolic: '132', diastolic: '80', respRate: '16', spo2: '98', painScore: '0', recordedById: 'SYN-STF-018' },
  'SYN-PAT-0114': { tempC: '36.6', heartRate: '76', systolic: '124', diastolic: '78', respRate: '14', spo2: '99', painScore: '2', recordedById: 'SYN-STF-018' },
};

function addMinutes(iso: string, minutes: number): string {
  const at = new Date(Date.parse(iso) + minutes * 60000 + 3 * 3600000);
  return `${at.toISOString().slice(0, 16)}:00+03:00`;
}

function outpatientSets(patient: Patient): readonly ChartVitals[] {
  const visit = APPOINTMENTS.find((appointment) => appointment.patientId === patient.id && appointment.arrivedIso !== null);
  if (visit === undefined || visit.arrivedIso === null) {
    return [];
  }
  const iso = addMinutes(visit.arrivedIso, 6);
  const fixed = TRIAGE[patient.id];
  if (fixed !== undefined) {
    return [{ ...fixed, iso, oxygen: AIR, consciousness: 'A', beforeAdmission: false }];
  }
  const rand = sequence(Number.parseInt(patient.id.slice(-4), 10));
  return [
    {
      iso,
      tempC: round(36.5 + rand() * 0.6, 1),
      heartRate: round(68 + rand() * 20, 0),
      systolic: round(112 + rand() * 30, 0),
      diastolic: round(68 + rand() * 14, 0),
      respRate: round(14 + rand() * 3, 0),
      spo2: round(96 + rand() * 3, 0),
      painScore: String(Math.round(rand() * 2)),
      oxygen: AIR,
      consciousness: 'A',
      recordedById: 'SYN-STF-018',
      beforeAdmission: false,
    },
  ];
}

const VITALS_CACHE = new Map<string, readonly ChartVitals[]>();

/** The patient's observations in the 72-hour window, oldest first (empty when none are recorded). */
export function chartVitalsOf(patientId: string): readonly ChartVitals[] {
  const cached = VITALS_CACHE.get(patientId);
  if (cached !== undefined) {
    return cached;
  }
  const patient = findPatient(patientId);
  const encounter = currentEncounter(patientId);
  let sets: readonly ChartVitals[] = [];
  if (patient !== undefined) {
    const shared = vitalsOf(patientId);
    const admittedIso = encounter?.type === 'inpatient' ? encounter.startIso : undefined;
    const first = shared[0];
    if (shared.length > 0 && first !== undefined) {
      const lead = LEADS[patientId];
      const before = lead === undefined || admittedIso === undefined ? [] : leadSets(lead, first, admittedIso);
      sets = [...before, ...shared.map((set, i) => fromShared(set, i, admittedIso))];
    } else {
      const group = censusGroupOf(patientId);
      if (group !== undefined && group !== 'outpatient' && encounter !== undefined) {
        sets = censusInpatientSets(patient, group, encounter);
      } else {
        sets = outpatientSets(patient);
      }
    }
  }
  VITALS_CACHE.set(patientId, sets);
  return sets;
}

/** Whole years of age at the demo clock (year-only dates of birth count from 1 July). */
export function ageInYears(dob: string): number {
  const [y = '1900', m = '07', d = '01'] = dob.split('-');
  const [ty = '2026', tm = '10', td = '19'] = DEMO_TODAY.split('-');
  let years = Number(ty) - Number(y);
  if (Number(tm) < Number(m) || (Number(tm) === Number(m) && Number(td) < Number(d))) {
    years -= 1;
  }
  return years;
}

// ---------------------------------------------------------------------------------------------------------
// Problem list
// ---------------------------------------------------------------------------------------------------------

export type ProblemStatus = 'active' | 'chronic' | 'resolved';

export interface Problem {
  /** ICD-10 code. */
  readonly code: string;
  readonly text: Text3;
  readonly status: ProblemStatus;
  /** `YYYY`, `YYYY-MM` or `YYYY-MM-DD`. */
  readonly since: string;
  readonly primary: boolean;
}

const p = (code: string, status: ProblemStatus, since: string, en: string, ckb: string, ar: string): Problem => ({
  code,
  text: T(en, ckb, ar),
  status,
  since,
  primary: false,
});

/** Long-standing and past problems of the curated patients (the current diagnoses come from the encounter). */
const HISTORY_PROBLEMS: Readonly<Record<string, readonly Problem[]>> = {
  'SYN-PAT-0101': [
    p('I10', 'chronic', '2018', 'Essential hypertension', 'بەرزیی پەستانی خوێن', 'ارتفاع ضغط الدم الأساسي'),
    p('Z90.4', 'resolved', '1998', 'Appendicectomy', 'لابردنی ڕیخۆڵەکوێرە', 'استئصال الزائدة الدودية'),
  ],
  'SYN-PAT-0102': [
    p('I10', 'chronic', '1995', 'Hypertension', 'بەرزیی پەستانی خوێن', 'ارتفاع ضغط الدم'),
    p('H91.9', 'chronic', '2015', 'Hearing loss, both ears', 'کەمبوونەوەی بیستن، هەردوو گوێ', 'نقص السمع في الأذنين'),
    p('M81.0', 'chronic', '2019', 'Osteoporosis', 'پووکانی ئێسک', 'هشاشة العظام'),
    p('S72.0', 'resolved', '2019-05', 'Fracture of the left hip, fixed', 'شکانی لاقی چەپ، چاککرایەوە', 'كسر الورك الأيسر، مثبت'),
  ],
  'SYN-PAT-0105': [
    p('R63.4', 'active', '2026-09', 'Weight loss, 6 kg in 6 weeks', 'دابەزینی کێش، 6 kg لە 6 هەفتەدا', 'فقدان الوزن، 6 kg خلال 6 أسابيع'),
    p('Z72.0', 'chronic', '2004', 'Smoker, 20 pack-years', 'جگەرەکێش، 20 ساڵ-پاکەت', 'مدخن، 20 علبة-سنة'),
  ],
  'SYN-PAT-0106': [p('E66.9', 'chronic', '2020', 'Obesity', 'قەڵەوی', 'السمنة')],
  'SYN-PAT-0107': [
    p('I10', 'chronic', '2009', 'Hypertension', 'بەرزیی پەستانی خوێن', 'ارتفاع ضغط الدم'),
    p('N40', 'chronic', '2016', 'Benign prostatic enlargement', 'گەورەبوونی بێزیانی پرۆستات', 'تضخم البروستات الحميد'),
    p('H25.9', 'resolved', '2021-11', 'Cataract, right eye, operated', 'تەمی چاو، چاوی ڕاست، نەشتەرگەری کرا', 'ساد العين اليمنى، أجريت العملية'),
  ],
  'SYN-PAT-0108': [
    p('I10', 'chronic', '2015', 'Hypertension', 'بەرزیی پەستانی خوێن', 'ارتفاع ضغط الدم'),
    p('E78.5', 'chronic', '2017', 'Raised cholesterol', 'بەرزیی کۆلیستڕۆڵ', 'ارتفاع الكوليسترول'),
  ],
  'SYN-PAT-0109': [
    p('E11.9', 'chronic', '2012', 'Type 2 diabetes mellitus', 'شەکرەی جۆری 2', 'داء السكري من النوع الثاني'),
    p('N40', 'chronic', '2023-08', 'Benign prostatic enlargement', 'گەورەبوونی بێزیانی پرۆستات', 'تضخم البروستات الحميد'),
  ],
  'SYN-PAT-0112': [p('E10.9', 'chronic', '2011', 'Type 1 diabetes mellitus', 'شەکرەی جۆری 1', 'داء السكري من النوع الأول')],
};

/** Problems: the current encounter's diagnoses (active), then long-standing and past problems. */
export function problemsOf(patientId: string): readonly Problem[] {
  const encounter = currentEncounter(patientId);
  const since = encounter?.startIso.slice(0, 10) ?? DEMO_TODAY;
  const current: Problem[] = (encounter?.diagnoses ?? []).map((dx: Diagnosis) => ({
    code: dx.code,
    text: dx.text,
    status: 'active',
    since,
    primary: dx.primary,
  }));
  const history = (HISTORY_PROBLEMS[patientId] ?? []).filter((item) => !current.some((dx) => dx.code === item.code));
  return [...current, ...history];
}

// ---------------------------------------------------------------------------------------------------------
// Notes (clinical time and recorded time)
// ---------------------------------------------------------------------------------------------------------

export interface ChartNote {
  readonly id: string;
  readonly patientId: string;
  readonly kind: NoteKind;
  /** When the observation or care described happened. */
  readonly clinicalIso: string;
  /** When the note was written. */
  readonly recordedIso: string;
  readonly authorId: string;
  readonly title: Text3;
  readonly body: Text3;
  readonly signed: boolean;
}

/** A note counts as a late entry when it was written more than 60 minutes after the event. */
export const LATE_ENTRY_MINUTES = 60;

export function minutesLate(note: Pick<ChartNote, 'clinicalIso' | 'recordedIso'>): number {
  return Math.round((Date.parse(note.recordedIso) - Date.parse(note.clinicalIso)) / 60000);
}

interface NoteInput {
  readonly id: string;
  readonly patient: string;
  readonly kind: NoteKind;
  readonly at: string;
  /** When written, if later than `at`. */
  readonly written?: string;
  readonly by: string;
  readonly title: Text3;
  readonly body: Text3;
  readonly signed?: boolean;
}

function note(input: NoteInput): ChartNote {
  return {
    id: input.id,
    patientId: input.patient,
    kind: input.kind,
    clinicalIso: input.at,
    recordedIso: input.written ?? input.at,
    authorId: input.by,
    title: input.title,
    body: input.body,
    signed: input.signed ?? true,
  };
}

const NIGHT_SHIFT = T('Night shift', 'نۆبەتی شەو', 'المناوبة الليلية');

const EXTRA_NOTES: readonly ChartNote[] = [
  note({
    id: 'SYN-NOTE-C101A',
    patient: 'SYN-PAT-0101',
    kind: 'nursing',
    at: daysAgoAt(1, '08:00'),
    written: daysAgoAt(1, '11:40'),
    by: 'SYN-STF-010',
    title: T('Morning observations and care', 'پشکنین و چاودێریی بەیانی', 'العلامات الحيوية والرعاية الصباحية'),
    body: T(
      'At 08:00: temperature 38.9 °C, oxygen saturation 90% on 3 litres, increased to 4 litres; doctor informed. Paracetamol 1 g given by mouth. Written late because of an emergency elsewhere on the ward.',
      'کاتژمێر 08:00: پلەی گەرمی 38.9 °C، تێربوونی ئۆکسجین 90% بە 3 لیتر، زیادکرا بۆ 4 لیتر؛ پزیشک ئاگادار کرایەوە. پاراسیتامۆڵ 1 g لە ڕێگەی دەمەوە درا. درەنگ نووسرا بەهۆی حاڵەتێکی فریاکەوتن لە شوێنێکی تری قاوشەکەدا.',
      'الساعة 08:00: الحرارة 38.9 °C، تشبع الأكسجين 90% على 3 لترات، رُفع إلى 4 لترات؛ أُبلغ الطبيب. أُعطي باراسيتامول 1 g فموياً. كُتبت متأخرة بسبب حالة طارئة في مكان آخر من الردهة.',
    ),
  }),
  note({
    id: 'SYN-NOTE-C101B',
    patient: 'SYN-PAT-0101',
    kind: 'progress',
    at: daysAgoAt(1, '09:10'),
    by: 'SYN-STF-001',
    title: T('Ward round, day 2', 'سەردانی قاوش، ڕۆژی 2', 'جولة الردهة، اليوم الثاني'),
    body: T(
      'Still febrile, crackles at the right base. Saturation 90 to 92% on 4 litres. Blood cultures pending. Continue levofloxacin; no repeat chest X-ray yet. Review oxygen this evening.',
      'هێشتا تای هەیە، دەنگی خشەخش لە بنی سیی ڕاست. تێربوون 90 بۆ 92% بە 4 لیتر. ئەنجامی چاندنی خوێن چاوەڕوان دەکرێت. لێڤۆفلۆکساسین بەردەوام بێت؛ هێشتا تیشکی سنگ دووبارە ناکرێتەوە. ئێوارە پێداچوونەوە بە ئۆکسجیندا بکرێت.',
      'لا يزال محموماً، خراخر في قاعدة الرئة اليمنى. التشبع 90 إلى 92% على 4 لترات. زرع الدم قيد الانتظار. يستمر الليفوفلوكساسين؛ لا إعادة لصورة الصدر بعد. مراجعة الأكسجين مساءً.',
    ),
  }),
  note({
    id: 'SYN-NOTE-C101C',
    patient: 'SYN-PAT-0101',
    kind: 'nursing',
    at: todayAt('03:10'),
    written: todayAt('06:55'),
    by: NIGHT_NURSE,
    title: NIGHT_SHIFT,
    body: T(
      'Slept from midnight. At 03:10 capillary glucose 4.1 mmol/L; given a snack, 6.2 on recheck at 03:40. No insulin overnight. Oxygen reduced to 2 litres at 05:00.',
      'لە نیوەشەوەوە خەوت. کاتژمێر 03:10 شەکرەی خوێن 4.1 mmol/L بوو؛ خواردنێکی سووکی پێدرا، لە 03:40 دووبارە پشکنرا: 6.2. لە شەودا ئەنسولین نەدرا. کاتژمێر 05:00 ئۆکسجین کەمکرایەوە بۆ 2 لیتر.',
      'نام منذ منتصف الليل. الساعة 03:10 سكر الدم الشعري 4.1 mmol/L؛ أُعطي وجبة خفيفة، وعند الإعادة الساعة 03:40 كان 6.2. لا أنسولين خلال الليل. خُفض الأكسجين إلى لترين الساعة 05:00.',
    ),
  }),
  note({
    id: 'SYN-NOTE-C102A',
    patient: 'SYN-PAT-0102',
    kind: 'admission',
    at: daysAgoAt(4, '15:10'),
    by: 'SYN-STF-008',
    title: T('Admission: decompensated heart failure', 'خەواندن: لاوازیی تێکچووی دڵ', 'الإدخال: قصور قلب لا معاوض'),
    body: T(
      'About 88 years old. Breathless on minimal exertion for one week, cannot lie flat, pitting oedema to the knees. Crackles at both bases. Known chronic kidney disease stage 4. Plan: IV furosemide, daily weights, fluids limited to 1.5 litres, potassium and creatinine every day.',
      'تەمەنی نزیکەی 88 ساڵ. بۆ ماوەی هەفتەیەک بە کەمترین ماندووبوون هەناسەی سوار دەبێت، ناتوانێت ڕاکشێت، ئاوسانی قاچ تا ئەژنۆ. دەنگی خشەخش لە بنی هەردوو سی. نەخۆشیی درێژخایەنی گورچیلەی قۆناغی 4 هەیە. پلان: فیوروسێمایدی ناو دەمار، کێشانی ڕۆژانە، شلە سنووردار بە 1.5 لیتر، پۆتاسیۆم و کریاتینین هەموو ڕۆژێک.',
      'عمرها نحو 88 سنة. ضيق نفس عند أدنى جهد منذ أسبوع، لا تستطيع الاستلقاء، وذمة انطباعية حتى الركبتين. خراخر في قاعدتي الرئتين. مرض كلوي مزمن معروف بالمرحلة الرابعة. الخطة: فوروسيمايد وريدي، وزن يومي، تقييد السوائل إلى 1.5 لتر، البوتاسيوم والكرياتينين يومياً.',
    ),
  }),
  note({
    id: 'SYN-NOTE-C102B',
    patient: 'SYN-PAT-0102',
    kind: 'nursing',
    at: todayAt('03:00'),
    written: todayAt('06:40'),
    by: NIGHT_NURSE,
    title: NIGHT_SHIFT,
    body: T(
      'Restless at 03:00, heart rate 56, blood pressure 98/58. Repositioned and settled. Night doctor informed by phone; no new orders. Written late: one nurse for ten patients overnight.',
      'کاتژمێر 03:00 نائارام بوو، لێدانی دڵ 56، پەستانی خوێن 98/58. شوێنی گۆڕدرا و هێور بووەوە. بە تەلەفۆن پزیشکی شەو ئاگادار کرایەوە؛ فەرمانی نوێ نەدرا. درەنگ نووسرا: لە شەودا یەک پەرستار بۆ دە نەخۆش هەبوو.',
      'قلقة الساعة 03:00، النبض 56، ضغط الدم 98/58. غُيّرت وضعيتها فهدأت. أُبلغ طبيب الليل هاتفياً؛ لا أوامر جديدة. كُتبت متأخرة: ممرض واحد لعشرة مرضى خلال الليل.',
    ),
  }),
  note({
    id: 'SYN-NOTE-C103A',
    patient: 'SYN-PAT-0103',
    kind: 'admission',
    at: daysAgoAt(1, '15:00'),
    by: 'SYN-STF-006',
    title: T('Admission: neonatal jaundice', 'خەواندن: زەردوویی کۆرپە', 'الإدخال: يرقان الوليد'),
    body: T(
      'Born at 38 weeks by normal delivery, birth weight 3.1 kg. Visible jaundice at 20 hours; skin bilirubin meter reading high. Serum bilirubin sent; phototherapy started. Breastfeeding; mother O positive.',
      'لە هەفتەی 38 بە منداڵبوونی ئاسایی لەدایک بووە، کێشی لەدایکبوون 3.1 kg. زەردوویی لە کاتژمێری 20دا دیار بوو؛ پێوانەی بیلیڕووبین بە ئامێری پێست بەرز بوو. بیلیڕووبینی سیرەم نێردرا؛ چارەسەری ڕووناکی دەستی پێکرا. شیری دایک دەخوات؛ گرووپی خوێنی دایک O+.',
      'وُلدت بعمر 38 أسبوعاً بولادة طبيعية، وزن الولادة 3.1 kg. ظهر اليرقان بعمر 20 ساعة؛ قراءة جهاز البيليروبين الجلدي مرتفعة. أُرسل بيليروبين المصل؛ بدأ العلاج الضوئي. رضاعة طبيعية؛ زمرة دم الأم O+.',
    ),
  }),
  note({
    id: 'SYN-NOTE-C104A',
    patient: 'SYN-PAT-0104',
    kind: 'admission',
    at: daysAgoAt(1, '21:40'),
    by: 'SYN-STF-020',
    title: T('Admission: gastroenteritis with dehydration', 'خەواندن: هەوکردنی گەدە و ڕیخۆڵە لەگەڵ وشکبوونەوە', 'الإدخال: التهاب معدة وأمعاء مع جفاف'),
    body: T(
      'Seven-year-old with two days of vomiting and watery diarrhoea, about 8 times a day. Dry mouth, capillary refill 3 seconds, about 6% dehydrated. Plan: oral rehydration (nasogastric tube if not drinking), ondansetron once, sodium and potassium again in the morning.',
      'منداڵێکی 7 ساڵان، دوو ڕۆژە ڕشانەوە و سکچوونی ئاوی هەیە، نزیکەی 8 جار لە ڕۆژێکدا. دەمی وشکە، گەڕانەوەی ڕەنگی نینۆک 3 چرکە، نزیکەی 6% وشکبوونەوە. پلان: شلەی دەم (ئەگەر نەیخواردەوە بە بۆریی لووت-گەدە)، یەک جار ئۆندانسێترۆن، بەیانی سۆدیۆم و پۆتاسیۆم دووبارە.',
      'طفل عمره 7 سنوات مع إقياء وإسهال مائي منذ يومين، نحو 8 مرات يومياً. جفاف الفم، زمن عودة الامتلاء الشعري 3 ثوانٍ، جفاف بنحو 6%. الخطة: إماهة فموية (أنبوب أنفي معدي إن لم يشرب)، أوندانسيترون مرة واحدة، الصوديوم والبوتاسيوم مجدداً صباحاً.',
    ),
  }),
  note({
    id: 'SYN-NOTE-C105A',
    patient: 'SYN-PAT-0105',
    kind: 'admission',
    at: daysAgoAt(1, '17:10'),
    by: 'SYN-STF-001',
    title: T('Admission: suspected pulmonary tuberculosis', 'خەواندن: گومانی سیلی سی', 'الإدخال: اشتباه سل رئوي'),
    body: T(
      'Six weeks of cough, night sweats and 6 kg weight loss. Chest X-ray: cavity in the right upper lobe. Airborne isolation in negative-pressure room A-20. Plan: three sputum samples for acid-fast bacilli and GeneXpert, HIV test with consent, notify the TB programme if confirmed.',
      'شەش هەفتە کۆکە، ئارەقەکردنەوەی شەوانە و دابەزینی 6 kg کێش. تیشکی سنگ: کونێک لە بەشی سەرەوەی سیی ڕاست. دابڕانی هەوایی لە ژووری پەستانی نەرێنی A-20. پلان: سێ نموونەی بەڵغەم بۆ AFB و GeneXpert، پشکنینی HIV بە ڕەزامەندی، ئەگەر سەلمێنرا بەرنامەی سیل ئاگادار بکرێتەوە.',
      'سعال منذ ستة أسابيع وتعرق ليلي وفقدان 6 kg من الوزن. صورة الصدر: تكهف في الفص العلوي الأيمن. عزل هوائي في غرفة الضغط السلبي A-20. الخطة: ثلاث عينات قشع للعصيات الصامدة للحمض وGeneXpert، فحص HIV بعد الموافقة، إبلاغ برنامج السل عند التأكيد.',
    ),
  }),
  note({
    id: 'SYN-NOTE-C106A',
    patient: 'SYN-PAT-0106',
    kind: 'progress',
    at: daysAgoAt(1, '11:20'),
    by: 'SYN-STF-005',
    title: T('Operation note: laparoscopic cholecystectomy', 'تێبینیی نەشتەرگەری: لابردنی زراو بە لابراسکۆپی', 'ملاحظة العملية: استئصال المرارة بالمنظار'),
    body: T(
      'Four-port laparoscopic cholecystectomy under general anaesthesia. Inflamed gallbladder with several stones, removed intact. Latex-free theatre (latex allergy). Minimal blood loss. Plan: oral fluids tonight, regular paracetamol, no ibuprofen (allergy).',
      'لابردنی زراو بە لابراسکۆپی بە چوار کون لەژێر بێهۆشیی گشتیدا. زراوی هەوکردوو بە چەند بەردێک، بە تەواوی لابرا. ژووری نەشتەرگەریی بێ لاتێکس (هەستیاری بە لاتێکس). خوێنبەربوون زۆر کەم. پلان: ئەمشەو شلەی دەم، پاراسیتامۆڵی ڕێکخراو، ئایبوپرۆفین نا (هەستیاری).',
      'استئصال المرارة بالمنظار عبر أربع فتحات تحت التخدير العام. مرارة ملتهبة مع عدة حصيات، استؤصلت كاملة. غرفة عمليات خالية من اللاتكس (حساسية اللاتكس). نزف ضئيل. الخطة: سوائل فموية الليلة، باراسيتامول بانتظام، لا إيبوبروفين (حساسية).',
    ),
  }),
  note({
    id: 'SYN-NOTE-C107A',
    patient: 'SYN-PAT-0107',
    kind: 'admission',
    at: daysAgoAt(3, '16:00'),
    by: 'SYN-STF-005',
    title: T('Admission: fractured neck of femur', 'خەواندن: شکانی ملی ئێسکی ڕان', 'الإدخال: كسر عنق الفخذ'),
    body: T(
      'Fell at home this morning, cannot bear weight. Right leg shortened and turned outwards. X-ray: displaced fracture of the right femoral neck. Plan: hemiarthroplasty tomorrow, regular pain relief. Look-alike name on file: identity checked with MRN and grandfather\'s name.',
      'ئەمڕۆ بەیانی لە ماڵەوە کەوت، ناتوانێت لەسەر قاچی بوەستێت. قاچی ڕاست کورت بووەتەوە و بەرەو دەرەوە سووڕاوە. تیشک: شکانی جێگۆڕاوی ملی ئێسکی ڕانی ڕاست. پلان: سبەی گۆڕینی نیوەی جومگە، دژەئازاری ڕێکخراو. ناوێکی لێکچوو لە تۆماردایە: ناسنامە بە MRN و ناوی باپیر پشکنرا.',
      'سقط في المنزل صباح اليوم، لا يستطيع الاستناد على ساقه. الساق اليمنى قصيرة ومدورة للخارج. الأشعة: كسر منزاح في عنق الفخذ الأيمن. الخطة: تبديل نصف المفصل غداً، مسكنات منتظمة. يوجد اسم مشابه في السجلات: تم التحقق من الهوية برقم السجل واسم الجد.',
    ),
  }),
  note({
    id: 'SYN-NOTE-C107B',
    patient: 'SYN-PAT-0107',
    kind: 'progress',
    at: daysAgoAt(1, '09:00'),
    by: 'SYN-STF-005',
    title: T('Post-operative day 1', 'ڕۆژی یەکەمی دوای نەشتەرگەری', 'اليوم الأول بعد العملية'),
    body: T(
      'Comfortable; sat out in a chair with the physiotherapist. Haemoglobin stable. Wound clean. Continue enoxaparin; aim to walk with a frame tomorrow.',
      'ئاسوودەیە؛ لەگەڵ چارەسەرکاری سرووشتی لەسەر کورسی دانیشت. هیمۆگلۆبین جێگیرە. برین پاکە. ئینۆکساپارین بەردەوام بێت؛ ئامانج: سبەی بە چوارچێوەی ڕۆیشتن بڕوات.',
      'مرتاح؛ جلس على الكرسي مع أخصائي العلاج الطبيعي. الهيموغلوبين مستقر. الجرح نظيف. يستمر الإينوكسابارين؛ الهدف المشي بالمشاية غداً.',
    ),
  }),
  note({
    id: 'SYN-NOTE-C109A',
    patient: 'SYN-PAT-0109',
    kind: 'admission',
    at: daysAgoAt(2, '04:10'),
    by: 'SYN-STF-007',
    title: T('ICU admission: septic shock', 'خەواندن لە چاودێریی چڕ: شۆکی ژەهراویبوون', 'الإدخال إلى العناية المركزة: صدمة إنتانية'),
    body: T(
      'Brought by family with fever, confusion and blood pressure 76/40. Lactate 6.1. Urinary source likely; MRSA carrier, contact precautions. Intubated at 05:40 for worsening oxygenation. Noradrenaline started; meropenem and vancomycin after cultures.',
      'خێزانەکەی بە تا، تێکچوونی هۆش و پەستانی خوێنی 76/40 هێنایان. لاکتەیت 6.1. سەرچاوەکە بە ئەگەری زۆر میزە؛ هەڵگری MRSA، ڕێکاری بەرکەوتن. کاتژمێر 05:40 بەهۆی خراپبوونی ئۆکسجین بۆری خرایە ناو بۆڕیی هەوا. نۆرئەدرێنالین دەستی پێکرا؛ دوای چاندن مێرۆپینێم و ڤانکۆمایسین.',
      'أحضرته العائلة مصاباً بحمى وتشوش ذهني وضغط دم 76/40. اللاكتات 6.1. المصدر البولي مرجح؛ حامل لـ MRSA، احتياطات التلامس. نُبّب الساعة 05:40 لتدهور الأكسجة. بدأ النورأدرينالين؛ ميروبينيم وفانكومايسين بعد الزروع.',
    ),
  }),
  note({
    id: 'SYN-NOTE-C109B',
    patient: 'SYN-PAT-0109',
    kind: 'nursing',
    at: todayAt('06:00'),
    by: 'SYN-STF-015',
    title: T('ICU night summary', 'پوختەی شەوی چاودێریی چڕ', 'ملخص ليلة العناية المركزة'),
    body: T(
      'Stable overnight on the ventilator; FiO2 reduced to 35%. Noradrenaline weaned from 0.18 to 0.12. Urine output 40 to 50 mL an hour. Mouth care and turns every 2 hours; contact precautions kept.',
      'لە شەودا لەسەر ئامێری هەناسەدان جێگیر بوو؛ FiO2 کەمکرایەوە بۆ 35%. نۆرئەدرێنالین لە 0.18 بۆ 0.12 کەمکرایەوە. میز 40 بۆ 50 mL لە کاتژمێرێکدا. چاودێریی دەم و گۆڕینی شوێن هەر 2 کاتژمێر؛ ڕێکاری بەرکەوتن پارێزرا.',
      'مستقر خلال الليل على جهاز التنفس؛ خُفض FiO2 إلى 35%. خُفض النورأدرينالين من 0.18 إلى 0.12. الإدرار 40 إلى 50 mL في الساعة. عناية بالفم وتقليب كل ساعتين؛ مع الحفاظ على احتياطات التلامس.',
    ),
  }),
  note({
    id: 'SYN-NOTE-C110A',
    patient: 'SYN-PAT-0110',
    kind: 'admission',
    at: daysAgoAt(1, '23:20'),
    by: 'SYN-STF-020',
    title: T('Admission: acute appendicitis', 'خەواندن: هەوکردنی توندی ڕیخۆڵەکوێرە', 'الإدخال: التهاب الزائدة الحاد'),
    body: T(
      'Visitor from Poland, 46. Right lower abdominal pain for 18 hours, tender with guarding. White cell count 14.1. Ultrasound: inflamed appendix. Consent taken in English; laparoscopic appendicectomy tonight. Codeine intolerance (vomiting).',
      'میوانێک لە پۆڵەنداوە، تەمەن 46 ساڵ. 18 کاتژمێرە ئازاری لای ڕاستی خوارەوەی سکی هەیە، بە دەستلێدان ئازار و ڕەقبوون هەیە. خڕۆکە سپییەکان 14.1. سۆنار: ڕیخۆڵەکوێرەی هەوکردوو. ڕەزامەندی بە ئینگلیزی وەرگیرا؛ ئەمشەو لابردنی ڕیخۆڵەکوێرە بە لابراسکۆپی. کۆدین ناگونجێت (ڕشانەوە).',
      'زائرة من بولندا، 46 سنة. ألم أسفل البطن الأيمن منذ 18 ساعة، مع إيلام ودفاع. الكريات البيض 14.1. السونار: زائدة ملتهبة. أُخذت الموافقة بالإنجليزية؛ استئصال الزائدة بالمنظار الليلة. عدم تحمل الكودايين (إقياء).',
    ),
  }),
  note({
    id: 'SYN-NOTE-C112A',
    patient: 'SYN-PAT-0112',
    kind: 'admission',
    at: daysAgoAt(1, '19:40'),
    by: 'SYN-STF-008',
    title: T('Admission: diabetic ketoacidosis', 'خەواندن: ترشبوونی کیتۆنی شەکرە', 'الإدخال: الحماض الكيتوني السكري'),
    body: T(
      'Type 1 diabetes since 2011. Missed insulin for two days during a stomach illness. pH 7.12, ketones 6.4, glucose 28.6. Fixed-rate insulin infusion and fluids by the DKA protocol; glucose every hour, blood gas every 2 hours. Latex allergy noted.',
      'شەکرەی جۆری 1 لە 2011ەوە. لە کاتی نەخۆشییەکی گەدەدا دوو ڕۆژ ئەنسولینی وەرنەگرت. pH 7.12، کیتۆن 6.4، گلووکۆز 28.6. تکاندنی ئەنسولین بە ڕێژەی جێگیر و شلە بەپێی پرۆتۆکۆڵی DKA؛ شەکرە هەموو کاتژمێرێک، گازی خوێن هەر 2 کاتژمێر. هەستیاری بە لاتێکس تۆمار کرا.',
      'سكري النوع الأول منذ 2011. فوّت الأنسولين يومين خلال وعكة معدية. pH 7.12، الكيتونات 6.4، الغلوكوز 28.6. تسريب أنسولين بمعدل ثابت وسوائل حسب بروتوكول الحماض الكيتوني؛ السكر كل ساعة وغازات الدم كل ساعتين. سُجلت حساسية اللاتكس.',
    ),
  }),
  note({
    id: 'SYN-NOTE-C108A',
    patient: 'SYN-PAT-0108',
    kind: 'consult',
    at: todayAt('09:12'),
    by: 'SYN-STF-016',
    title: T('Diabetes clinic', 'نۆرینگەی شەکرە', 'عيادة السكري'),
    body: T(
      'HbA1c 9.1% (8.4% in April). Often misses the evening metformin. Blood pressure 148/92. Plan: add empagliflozin after a kidney check, dietitian referral, review in 3 months.',
      'HbA1c 9.1% (لە نیساندا 8.4%). زۆرجار دەرمانی مێتفۆرمینی ئێوارە لەبیر دەکات. پەستانی خوێن 148/92. پلان: دوای پشکنینی گورچیلە ئێمپاگلیفلۆزین زیاد بکرێت، ڕەوانەکردن بۆ خۆراکناس، دوای 3 مانگ پێداچوونەوە.',
      'HbA1c 9.1% (8.4% في نيسان). كثيراً ما ينسى جرعة الميتفورمين المسائية. ضغط الدم 148/92. الخطة: إضافة إمباغليفلوزين بعد فحص الكلى، إحالة إلى أخصائي التغذية، مراجعة بعد 3 أشهر.',
    ),
    signed: false,
  }),
  note({
    id: 'SYN-NOTE-C111A',
    patient: 'SYN-PAT-0111',
    kind: 'consult',
    at: todayAt('08:55'),
    by: 'SYN-STF-017',
    title: T('Cardiology clinic', 'نۆرینگەی دڵ', 'عيادة القلب'),
    body: T(
      'Fast, regular palpitations for 3 months, lasting minutes. ECG today: sinus rhythm, no pre-excitation. Taught vagal manoeuvres. Plan: 24-hour Holter, echocardiogram, review with the results.',
      'بۆ ماوەی 3 مانگ خولی لێدانی خێرا و ڕێکی دڵ، چەند خولەکێک دەخایەنێت. ECG ئەمڕۆ: ڕیتمی ئاسایی، هیچ نیشانەیەکی پێش-وروژان نییە. مانۆڕەکانی ڤاگاڵ فێر کرا. پلان: هۆڵتەری 24 کاتژمێر، ئێکۆی دڵ، پێداچوونەوە لەگەڵ ئەنجامەکان.',
      'نوبات خفقان سريع منتظم منذ 3 أشهر، تستمر دقائق. تخطيط القلب اليوم: نظم جيبي، لا تهيج مسبق. تم تعليم المناورات المبهمية. الخطة: هولتر 24 ساعة، إيكو القلب، مراجعة مع النتائج.',
    ),
  }),
  note({
    id: 'SYN-NOTE-C114A',
    patient: 'SYN-PAT-0114',
    kind: 'consult',
    at: todayAt('09:26'),
    by: 'SYN-STF-005',
    title: T('Pre-operative assessment', 'هەڵسەنگاندنی پێش نەشتەرگەری', 'تقييم ما قبل العملية'),
    body: T(
      'Right inguinal hernia, reducible, for planned repair. Allergies NOT yet assessed: nurse assessment ordered before any medicine. Bloods sent. Fit for day-case surgery if the results are normal.',
      'فەتقی گەدەی لای ڕاست، دەگەڕێتەوە شوێنی خۆی، بۆ چاککردنەوەی پلاندانراو. هەستیاری هێشتا هەڵنەسەنگێنراوە: پێش هەر دەرمانێک هەڵسەنگاندنی پەرستاری داواکراوە. پشکنینی خوێن نێردرا. ئەگەر ئەنجامەکان ئاسایی بن، گونجاوە بۆ نەشتەرگەریی هەمان ڕۆژ.',
      'فتق إربي أيمن قابل للرد، لإصلاح مجدول. الحساسية لم تُقيَّم بعد: طُلب تقييم تمريضي قبل أي دواء. أُرسلت التحاليل. لائق لجراحة اليوم الواحد إذا كانت النتائج طبيعية.',
    ),
    signed: false,
  }),
];

/** `Severe asthma` → `severe asthma`, but `COPD …` stays as it is. */
function lowerFirst(text: string): string {
  return /^[A-Z][a-z]/.test(text) ? `${text.charAt(0).toLowerCase()}${text.slice(1)}` : text;
}

function censusNotes(patientId: string): readonly ChartNote[] {
  const group = censusGroupOf(patientId);
  const encounter = currentEncounter(patientId);
  if (group === undefined || group === 'outpatient' || encounter === undefined) {
    return [];
  }
  const dx = encounter.diagnoses[0]?.text ?? T('', '', '');
  const admittedAt = addMinutes(encounter.startIso, 35);
  const notes: ChartNote[] = [
    {
      id: `SYN-NOTE-G${patientId.slice(-4)}A`,
      patientId,
      kind: 'admission',
      clinicalIso: admittedAt,
      recordedIso: admittedAt,
      authorId: encounter.attendingId,
      title: T(`Admission: ${dx.en}`, `خەواندن: ${dx.ckb}`, `الإدخال: ${dx.ar}`),
      body: T(
        `Admitted from the Emergency Department with ${lowerFirst(dx.en)}. Observations on arrival recorded; treatment started by the ward protocol. Plan: review on the consultant round.`,
        `لە بەشی فریاکەوتنەوە بە ${dx.ckb} خەوێنرا. پشکنینە ژیانییەکانی کاتی گەیشتن تۆمار کران؛ چارەسەر بەپێی پرۆتۆکۆڵی قاوش دەستی پێکرد. پلان: پێداچوونەوە لە سەردانی پزیشکی پسپۆڕدا.`,
        `أُدخل من قسم الطوارئ بتشخيص ${dx.ar}. سُجلت العلامات الحيوية عند الوصول؛ بدأ العلاج حسب بروتوكول الردهة. الخطة: مراجعة في جولة الاستشاري.`,
      ),
      signed: true,
    },
  ];
  if (encounter.startIso < todayAt('00:00')) {
    notes.push({
      id: `SYN-NOTE-G${patientId.slice(-4)}B`,
      patientId,
      kind: 'nursing',
      clinicalIso: todayAt('06:00'),
      recordedIso: todayAt('06:00'),
      authorId: NIGHT_NURSE,
      title: NIGHT_SHIFT,
      body: T(
        'Comfortable overnight. Observations within the expected range; no concerns raised. Eating and drinking.',
        'لە شەودا ئاسوودە بوو. پشکنینە ژیانییەکان لە سنووری چاوەڕوانکراودان؛ هیچ نیگەرانییەک نییە. دەخوات و دەخواتەوە.',
        'مرتاح خلال الليل. العلامات الحيوية ضمن المتوقع؛ لا مخاوف. يأكل ويشرب.',
      ),
      signed: true,
    });
  }
  return notes;
}

/** Every note of a patient (shared notes, the chart's extra notes, generated census notes), newest first by clinical time. */
export function chartNotesOf(patientId: string): readonly ChartNote[] {
  const shared: ChartNote[] = NOTES.filter((item) => item.patientId === patientId).map((item) => ({
    id: item.id,
    patientId: item.patientId,
    kind: item.kind,
    clinicalIso: item.iso,
    recordedIso: item.iso,
    authorId: item.authorId,
    title: item.title,
    body: item.body,
    signed: item.signed,
  }));
  return [...shared, ...EXTRA_NOTES.filter((item) => item.patientId === patientId), ...censusNotes(patientId)].toSorted((a, b) =>
    b.clinicalIso.localeCompare(a.clinicalIso),
  );
}

// ---------------------------------------------------------------------------------------------------------
// Earlier history (timeline)
// ---------------------------------------------------------------------------------------------------------

export type HistoryKind = 'encounter' | 'procedure' | 'allergy' | 'diagnosis';

export interface HistoryEvent {
  readonly iso: string;
  readonly kind: HistoryKind;
  readonly title: Text3;
  readonly detail: Text3 | null;
}

const h = (date: string, kind: HistoryKind, title: Text3, detail: Text3 | null = null): HistoryEvent => ({
  iso: `${date}T10:00:00+03:00`,
  kind,
  title,
  detail,
});

const HISTORY: Readonly<Record<string, readonly HistoryEvent[]>> = {
  'SYN-PAT-0101': [
    h('2014-06-03', 'allergy', T('Anaphylaxis to penicillin', 'ئەنافیلاکسی بە پێنیسیلین', 'صدمة تحسسية من البنسلين'), T('Emergency Department; adrenaline given. Allergy recorded.', 'بەشی فریاکەوتن؛ ئەدرێنالین درا. هەستیاری تۆمار کرا.', 'قسم الطوارئ؛ أُعطي الأدرينالين. سُجلت الحساسية.')),
    h('2026-04-14', 'encounter', T('Diabetes clinic', 'نۆرینگەی شەکرە', 'عيادة السكري'), T('HbA1c 7.6%; metformin continued.', 'HbA1c 7.6%؛ مێتفۆرمین بەردەوام بوو.', 'HbA1c 7.6%؛ استمر الميتفورمين.')),
  ],
  'SYN-PAT-0102': [
    h('2019-05-20', 'procedure', T('Left hip fracture fixed', 'شکانی لاقی چەپ چاککرایەوە', 'تثبيت كسر الورك الأيسر'), T('After a fall at home.', 'دوای کەوتن لە ماڵەوە.', 'بعد سقوط في المنزل.')),
    h('2026-07-02', 'encounter', T('Heart failure clinic', 'نۆرینگەی لاوازیی دڵ', 'عيادة قصور القلب'), T('Furosemide increased; potassium 5.0.', 'فیوروسێماید زیاد کرا؛ پۆتاسیۆم 5.0.', 'زيدت جرعة الفوروسيمايد؛ البوتاسيوم 5.0.')),
  ],
  'SYN-PAT-0106': [
    h('2024-03-08', 'allergy', T('Anaphylaxis to amoxicillin and clavulanic acid', 'ئەنافیلاکسی بە ئەمۆکسیسیلین و ئەسیدی کلاڤیولانیک', 'صدمة تحسسية من الأموكسيسيلين وحمض الكلافولانيك')),
    h('2026-09-15', 'encounter', T('Surgical clinic', 'نۆرینگەی نەشتەرگەری', 'عيادة الجراحة'), T('Listed for laparoscopic cholecystectomy.', 'بۆ لابردنی زراو بە لابراسکۆپی تۆمار کرا.', 'أُدرجت لاستئصال المرارة بالمنظار.')),
  ],
  'SYN-PAT-0107': [h('2021-11-04', 'procedure', T('Cataract operation, right eye', 'نەشتەرگەریی تەمی چاوی ڕاست', 'عملية ساد العين اليمنى'))],
  'SYN-PAT-0108': [
    h('2025-10-20', 'encounter', T('Diabetes clinic', 'نۆرینگەی شەکرە', 'عيادة السكري'), T('HbA1c 7.9%.', 'HbA1c 7.9%.', 'HbA1c 7.9%.')),
    h('2026-04-14', 'encounter', T('Diabetes clinic', 'نۆرینگەی شەکرە', 'عيادة السكري'), T('HbA1c 8.4%; metformin increased.', 'HbA1c 8.4%؛ مێتفۆرمین زیاد کرا.', 'HbA1c 8.4%؛ زيدت جرعة الميتفورمين.')),
  ],
  'SYN-PAT-0109': [h('2023-08-12', 'encounter', T('Urology clinic', 'نۆرینگەی میزەڕۆ', 'عيادة المسالك البولية'), T('Benign prostatic enlargement; tamsulosin started.', 'گەورەبوونی بێزیانی پرۆستات؛ تامسولۆسین دەستی پێکرا.', 'تضخم البروستات الحميد؛ بدأ التامسولوسين.'))],
  'SYN-PAT-0112': [
    h('2011-09-01', 'diagnosis', T('Type 1 diabetes diagnosed', 'شەکرەی جۆری 1 دەستنیشان کرا', 'تشخيص السكري من النوع الأول'), T('Paediatrics, aged 12.', 'بەشی منداڵان، تەمەن 12 ساڵ.', 'قسم الأطفال، بعمر 12 سنة.')),
    h('2025-02-10', 'encounter', T('Admission: diabetic ketoacidosis', 'خەواندن: ترشبوونی کیتۆنی شەکرە', 'الإدخال: الحماض الكيتوني السكري'), T('3 days, Medical Ward A.', '3 ڕۆژ، قاوشی ناوخۆیی A.', '3 أيام، الردهة الباطنية A.')),
  ],
};

export function historyOf(patientId: string): readonly HistoryEvent[] {
  return HISTORY[patientId] ?? [];
}

// ---------------------------------------------------------------------------------------------------------
// Discharge summary text (hospital course and follow-up), per curated inpatient
// ---------------------------------------------------------------------------------------------------------

export interface DischargeText {
  readonly course: Text3;
  readonly followUp: Text3;
  /** The doctor who will sign it. */
  readonly signerId: string;
}

export const DISCHARGE_TEXT: Readonly<Record<string, DischargeText>> = {
  'SYN-PAT-0101': {
    signerId: 'SYN-STF-001',
    course: T(
      'Admitted with right lower lobe pneumonia (CURB-65 score 2). Treated with intravenous levofloxacin because of severe penicillin allergy; oxygen weaned from 6 to 2 litres. Fever settling and CRP falling (210 to 142 mg/L).',
      'بە هەوکردنی بەشی خوارەوەی سیی ڕاست خەوێنرا (نمرەی CURB-65: 2). بەهۆی هەستیاریی توند بە پێنیسیلین، لێڤۆفلۆکساسینی ناو دەماری وەرگرت؛ ئۆکسجین لە 6 بۆ 2 لیتر کەمکرایەوە. تا دادەبەزێت و CRP کەم دەبێتەوە (210 بۆ 142 mg/L).',
      'أُدخل بالتهاب رئوي في الفص السفلي الأيمن (درجة CURB-65: 2). عولج بالليفوفلوكساسين الوريدي بسبب حساسية شديدة للبنسلين؛ خُفض الأكسجين من 6 إلى 2 لتر. الحمى تتراجع وCRP ينخفض (من 210 إلى 142 mg/L).',
    ),
    followUp: T(
      'Oral levofloxacin to complete 7 days. Diabetes clinic in 2 weeks. Chest X-ray in 6 weeks.',
      'لێڤۆفلۆکساسینی دەم تا تەواوبوونی 7 ڕۆژ. نۆرینگەی شەکرە دوای 2 هەفتە. تیشکی سنگ دوای 6 هەفتە.',
      'ليفوفلوكساسين فموي لإكمال 7 أيام. عيادة السكري بعد أسبوعين. صورة صدر بعد 6 أسابيع.',
    ),
  },
  'SYN-PAT-0102': {
    signerId: 'SYN-STF-001',
    course: T(
      'Admitted with decompensated heart failure on chronic kidney disease stage 4. Diuresed with IV furosemide, weight down 1.4 kg. Course complicated by rising potassium (6.8 mmol/L on 19 Oct) and a slow heart rate; spironolactone stopped.',
      'بە لاوازیی تێکچووی دڵ لەسەر نەخۆشیی درێژخایەنی گورچیلەی قۆناغی 4 خەوێنرا. بە فیوروسێمایدی ناو دەمار شلەی زیادە لابرا، کێش 1.4 kg دابەزی. بەرزبوونەوەی پۆتاسیۆم (6.8 mmol/L لە 19ی تشرینی یەکەم) و لێدانی هێواشی دڵ ئاڵۆزییان دروست کرد؛ سپیرۆنۆلاکتۆن ڕاگیرا.',
      'أُدخلت بقصور قلب لا معاوض على مرض كلوي مزمن بالمرحلة الرابعة. أُعطيت فوروسيمايد وريدي وانخفض الوزن 1.4 kg. تعقّد المسار بارتفاع البوتاسيوم (6.8 mmol/L في 19 تشرين الأول) وبطء القلب؛ أُوقف السبيرونولاكتون.',
    ),
    followUp: T(
      'Not ready for discharge: high potassium under treatment. DNACPR decision documented and discussed with the family.',
      'هێشتا ئامادە نییە بۆ دەرچوون: پۆتاسیۆمی بەرز لەژێر چارەسەردایە. بڕیاری DNACPR تۆمار کراوە و لەگەڵ خێزان گفتوگۆ کراوە.',
      'غير جاهزة للخروج: ارتفاع البوتاسيوم قيد العلاج. قرار عدم الإنعاش موثق ونوقش مع العائلة.',
    ),
  },
  'SYN-PAT-0103': {
    signerId: 'SYN-STF-006',
    course: T(
      'Admitted at 1 day of age with jaundice. Phototherapy started; bilirubin 248 µmol/L this morning, just below the treatment line. Feeding well.',
      'لە تەمەنی یەک ڕۆژیدا بە زەردوویی خەوێنرا. چارەسەری ڕووناکی دەستی پێکرا؛ بیلیڕووبین ئەمڕۆ بەیانی 248 µmol/L، کەمێک لە خوار هێڵی چارەسەرەوە. باش شیر دەخوات.',
      'أُدخلت بعمر يوم واحد بسبب اليرقان. بدأ العلاج الضوئي؛ البيليروبين 248 µmol/L صباح اليوم، أقل بقليل من خط العلاج. ترضع جيداً.',
    ),
    followUp: T(
      'Repeat bilirubin at 18:00. If falling, home tomorrow with a bilirubin check in 48 hours at the paediatric clinic.',
      'کاتژمێر 18:00 بیلیڕووبین دووبارە بکرێتەوە. ئەگەر دابەزی، سبەی بۆ ماڵەوە، لەگەڵ پشکنینی بیلیڕووبین دوای 48 کاتژمێر لە نۆرینگەی منداڵان.',
      'إعادة البيليروبين الساعة 18:00. إن انخفض، الخروج غداً مع فحص بيليروبين بعد 48 ساعة في عيادة الأطفال.',
    ),
  },
  'SYN-PAT-0104': {
    signerId: 'SYN-STF-006',
    course: T(
      'Admitted with gastroenteritis and moderate dehydration. Rehydrated by mouth with one dose of ondansetron; sodium 131 and potassium 3.3 on admission. Drinking well; fever settled.',
      'بە هەوکردنی گەدە و ڕیخۆڵە و وشکبوونەوەی مامناوەند خەوێنرا. بە شلەی دەم و یەک ژەم ئۆندانسێترۆن ئاوی لەشی گەڕایەوە؛ لە کاتی خەواندندا سۆدیۆم 131 و پۆتاسیۆم 3.3. باش دەخواتەوە؛ تاکەی نەما.',
      'أُدخل بالتهاب معدة وأمعاء وجفاف متوسط. أُعيدت إماهته فموياً مع جرعة أوندانسيترون واحدة؛ الصوديوم 131 والبوتاسيوم 3.3 عند الإدخال. يشرب جيداً؛ زالت الحمى.',
    ),
    followUp: T(
      'Home tomorrow if drinking well and salts are normal. Come back if vomiting returns, if drowsy, or if no urine for 8 hours.',
      'سبەی بۆ ماڵەوە ئەگەر باش خواردەوە و خوێکان ئاسایی بوون. بگەڕێنەوە ئەگەر ڕشانەوە گەڕایەوە، خەواڵوو بوو، یان 8 کاتژمێر میزی نەکرد.',
      'الخروج غداً إذا كان يشرب جيداً والأملاح طبيعية. العودة إذا عاد الإقياء أو ظهر النعاس أو انقطع البول 8 ساعات.',
    ),
  },
  'SYN-PAT-0105': {
    signerId: 'SYN-STF-001',
    course: T(
      'Admitted with suspected pulmonary tuberculosis (cavity in the right upper lobe). In airborne isolation; sputum tests pending.',
      'بە گومانی سیلی سی خەوێنرا (کونێک لە بەشی سەرەوەی سیی ڕاست). لە دابڕانی هەواییدایە؛ ئەنجامی پشکنینی بەڵغەم چاوەڕوان دەکرێت.',
      'أُدخل باشتباه سل رئوي (تكهف في الفص العلوي الأيمن). في عزل هوائي؛ نتائج القشع قيد الانتظار.',
    ),
    followUp: T(
      'Stays in isolation until three sputum smears are negative or treatment has started. Notify the TB programme if confirmed.',
      'لە دابڕاندا دەمێنێتەوە تا سێ پشکنینی بەڵغەم نەرێنی دەبن یان چارەسەر دەست پێدەکات. ئەگەر سەلمێنرا بەرنامەی سیل ئاگادار بکرێتەوە.',
      'يبقى في العزل حتى تصبح ثلاث لطاخات قشع سلبية أو يبدأ العلاج. يُبلغ برنامج السل عند التأكيد.',
    ),
  },
  'SYN-PAT-0106': {
    signerId: 'SYN-STF-005',
    course: T(
      'Planned laparoscopic cholecystectomy on 18 Oct for gallstones; no complications. Latex-free theatre. Eating, walking, and pain controlled with oral paracetamol.',
      'لە 18ی تشرینی یەکەم نەشتەرگەریی پلاندانراوی لابراسکۆپی بۆ لابردنی زراو بەهۆی بەردی زراو؛ بێ ئاڵۆزی. ژووری نەشتەرگەریی بێ لاتێکس. دەخوات، دەڕوات و ئازار بە پاراسیتامۆڵی دەم کۆنتڕۆڵ کراوە.',
      'استئصال المرارة بالمنظار مجدول في 18 تشرين الأول لحصى المرارة؛ دون مضاعفات. غرفة عمليات خالية من اللاتكس. تأكل وتمشي والألم مضبوط بالباراسيتامول الفموي.',
    ),
    followUp: T(
      'Paracetamol 1 g up to four times a day for 5 days; no ibuprofen (allergy). Surgical clinic in 2 weeks; remove dressings on day 5.',
      'پاراسیتامۆڵ 1 g تا چوار جار لە ڕۆژێکدا بۆ 5 ڕۆژ؛ ئایبوپرۆفین نا (هەستیاری). نۆرینگەی نەشتەرگەری دوای 2 هەفتە؛ لە ڕۆژی 5دا پێچانەکان لاببرێن.',
      'باراسيتامول 1 g حتى أربع مرات يومياً لمدة 5 أيام؛ لا إيبوبروفين (حساسية). عيادة الجراحة بعد أسبوعين؛ إزالة الضمادات في اليوم الخامس.',
    ),
  },
  'SYN-PAT-0107': {
    signerId: 'SYN-STF-005',
    course: T(
      'Fall at home with a displaced fracture of the right femoral neck. Hemiarthroplasty on 17 Oct; mobilising with physiotherapy. Enoxaparin to prevent clots.',
      'کەوتن لە ماڵەوە بە شکانی جێگۆڕاوی ملی ڕانی ڕاست. لە 17ی تشرینی یەکەم نیوەی جومگە گۆڕدرا؛ لەگەڵ چارەسەری سرووشتی دەجووڵێت. ئینۆکساپارین بۆ ڕێگری لە مەیینی خوێن.',
      'سقوط في المنزل مع كسر منزاح في عنق الفخذ الأيمن. تبديل نصف المفصل في 17 تشرين الأول؛ يتحرك مع العلاج الطبيعي. إينوكسابارين للوقاية من الخثرات.',
    ),
    followUp: T(
      'Home with family support once walking safely with a frame; falls clinic and bone health review. Enoxaparin for 28 days in total.',
      'کاتێک بە سەلامەتی بە چوارچێوەی ڕۆیشتن ڕۆیشت، بە پاڵپشتیی خێزان بۆ ماڵەوە؛ نۆرینگەی کەوتن و پێداچوونەوەی تەندروستیی ئێسک. ئینۆکساپارین بۆ کۆی 28 ڕۆژ.',
      'الخروج بدعم العائلة عند المشي بأمان بالمشاية؛ عيادة السقوط ومراجعة صحة العظام. إينوكسابارين لمدة 28 يوماً إجمالاً.',
    ),
  },
  'SYN-PAT-0109': {
    signerId: 'SYN-STF-007',
    course: T(
      'Septic shock from a urinary source with respiratory failure; intubated and on noradrenaline. Improving: noradrenaline down to 0.12 mcg/kg/min, lactate 3.4.',
      'شۆکی ژەهراویبوون لە سەرچاوەی میزەوە لەگەڵ لاوازیی هەناسەدان؛ لەسەر ئامێری هەناسەدان و نۆرئەدرێنالینە. باشتر دەبێت: نۆرئەدرێنالین کەمکرایەوە بۆ 0.12 mcg/kg/min، لاکتەیت 3.4.',
      'صدمة إنتانية من مصدر بولي مع فشل تنفسي؛ منبّب وعلى النورأدرينالين. يتحسن: خُفض النورأدرينالين إلى 0.12 mcg/kg/min، اللاكتات 3.4.',
    ),
    followUp: T(
      'Remains in intensive care. Sedation hold and a spontaneous breathing trial planned. Contact precautions (MRSA).',
      'لە چاودێریی چڕدا دەمێنێتەوە. ڕاگرتنی هێورکەرەوە و تاقیکردنەوەی هەناسەدانی خۆبەخۆ پلانیان بۆ دانراوە. ڕێکاری بەرکەوتن (MRSA).',
      'يبقى في العناية المركزة. إيقاف التخدير وتجربة التنفس التلقائي مخطط لهما. احتياطات التلامس (MRSA).',
    ),
  },
  'SYN-PAT-0110': {
    signerId: 'SYN-STF-005',
    course: T(
      'Acute appendicitis; laparoscopic appendicectomy on the night of admission, no complications. Intravenous ceftriaxone and metronidazole. Pain settling; codeine avoided (intolerance).',
      'هەوکردنی توندی ڕیخۆڵەکوێرە؛ هەمان شەوی خەواندن بە لابراسکۆپی لابرا، بێ ئاڵۆزی. سێفتریاکسۆن و مێترۆنیدازۆلی ناو دەمار. ئازار کەم دەبێتەوە؛ کۆدین بەکار نەهات (ناگونجان).',
      'التهاب زائدة حاد؛ استئصال بالمنظار ليلة الإدخال دون مضاعفات. سيفترياكسون وميترونيدازول وريدي. الألم يتراجع؛ تم تجنب الكودايين (عدم تحمل).',
    ),
    followUp: T(
      'Home tomorrow on oral antibiotics if eating. English discharge letter for her insurer; invoice in USD.',
      'ئەگەر خواردی، سبەی بە دژەبەکتریای دەم بۆ ماڵەوە. نامەی دەرچوون بە ئینگلیزی بۆ کۆمپانیای بیمەکەی؛ پسوولە بە دۆلار.',
      'الخروج غداً على مضادات حيوية فموية إن كانت تأكل. رسالة خروج بالإنجليزية لشركة التأمين؛ الفاتورة بالدولار.',
    ),
  },
  'SYN-PAT-0112': {
    signerId: 'SYN-STF-001',
    course: T(
      'Diabetic ketoacidosis after missed insulin. Fixed-rate insulin infusion and fluids; pH 7.12 to 7.28, ketones 6.4 to 2.1 mmol/L. Glucose 10% added.',
      'ترشبوونی کیتۆنی شەکرە دوای وەرنەگرتنی ئەنسولین. تکاندنی ئەنسولین بە ڕێژەی جێگیر و شلە؛ pH لە 7.12 بۆ 7.28، کیتۆن لە 6.4 بۆ 2.1 mmol/L. گلووکۆزی 10% زیاد کرا.',
      'حماض كيتوني سكري بعد تفويت الأنسولين. تسريب أنسولين بمعدل ثابت وسوائل؛ pH من 7.12 إلى 7.28، الكيتونات من 6.4 إلى 2.1 mmol/L. أُضيف غلوكوز 10%.',
    ),
    followUp: T(
      'Switch to insulin under the skin when ketones are below 0.6 and eating. Diabetes nurse teaches sick-day rules before discharge.',
      'کاتێک کیتۆن لە خوار 0.6 بوو و خواردی، گۆڕین بۆ ئەنسولینی ژێر پێست. پێش دەرچوون پەرستاری شەکرە ڕێساکانی ڕۆژانی نەخۆشی فێر دەکات.',
      'التحويل إلى الأنسولين تحت الجلد عندما تنخفض الكيتونات دون 0.6 ويأكل. تشرح ممرضة السكري قواعد أيام المرض قبل الخروج.',
    ),
  },
};
