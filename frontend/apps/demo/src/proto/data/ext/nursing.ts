/**
 * Nursing shift brain-sheet: per-ward nurse allocation, today's nursing tasks (medicines from the shared MAR,
 * observations by NEWS2 frequency, care, PRN eligibility, changes since last shift, escalations), the NEWS2
 * calculator, and I-PASS handover defaults. SYNTHETIC DATA ONLY, NOT FOR CLINICAL USE.
 */
import { bedsOfWard, currentEncounter, findOrder, getPatient, latestVitals, marOf, WARDS } from '../index.ts';
import type { Patient, Text3, WardId } from '../types.ts';

// ---------------------------------------------------------------------------------------------------------
// NEWS2
// ---------------------------------------------------------------------------------------------------------

export type Acvpu = 'A' | 'C' | 'V' | 'P' | 'U';

export interface NursingObs {
  readonly rr: number;
  readonly spo2: number;
  /** SpO2 scale 2 for confirmed hypercapnic respiratory failure. */
  readonly scale: 1 | 2;
  readonly onOxygen: boolean;
  readonly sys: number;
  readonly dia: number;
  readonly hr: number;
  readonly acvpu: Acvpu;
  readonly temp: number;
  /** `HH:mm` on the demo day. */
  readonly time: string;
  readonly byId: string;
}

export interface News2Result {
  readonly total: number;
  readonly parts: Readonly<Record<'rr' | 'spo2' | 'air' | 'sys' | 'hr' | 'acvpu' | 'temp', number>>;
  /** A single parameter scored 3. */
  readonly redScore: boolean;
  readonly band: 'low' | 'low-medium' | 'medium' | 'high';
}

function band(value: number, bands: readonly (readonly [number, number])[]): number {
  for (const [upTo, score] of bands) {
    if (value <= upTo) {
      return score;
    }
  }
  return bands[bands.length - 1]?.[1] ?? 0;
}

/** NEWS2 (Royal College of Physicians, 2017) from one set of observations. */
export function news2(obs: Pick<NursingObs, 'rr' | 'spo2' | 'scale' | 'onOxygen' | 'sys' | 'hr' | 'acvpu' | 'temp'>): News2Result {
  const rr = band(obs.rr, [[8, 3], [11, 1], [20, 0], [24, 2], [Infinity, 3]]);
  let spo2: number;
  if (obs.scale === 1) {
    spo2 = band(obs.spo2, [[91, 3], [93, 2], [95, 1], [Infinity, 0]]);
  } else if (obs.spo2 <= 92 || !obs.onOxygen) {
    spo2 = band(obs.spo2, [[83, 3], [85, 2], [87, 1], [Infinity, 0]]);
  } else {
    spo2 = band(obs.spo2, [[92, 0], [94, 1], [96, 2], [Infinity, 3]]);
  }
  const air = obs.onOxygen ? 2 : 0;
  const sys = band(obs.sys, [[90, 3], [100, 2], [110, 1], [219, 0], [Infinity, 3]]);
  const hr = band(obs.hr, [[40, 3], [50, 1], [90, 0], [110, 1], [130, 2], [Infinity, 3]]);
  const acvpu = obs.acvpu === 'A' ? 0 : 3;
  const temp = band(obs.temp, [[35.0, 3], [36.0, 1], [38.0, 0], [39.0, 1], [Infinity, 2]]);
  const parts = { rr, spo2, air, sys, hr, acvpu, temp };
  const total = rr + spo2 + air + sys + hr + acvpu + temp;
  const redScore = Object.values(parts).some((score) => score === 3);
  return { total, parts, redScore, band: total >= 7 ? 'high' : total >= 5 ? 'medium' : redScore ? 'low-medium' : 'low' };
}

/** How often to observe at this score (NEWS2 clinical response). */
export function obsFrequencyHours(result: News2Result): number {
  if (result.band === 'high') {
    return 0.25;
  }
  if (result.band === 'medium' || result.band === 'low-medium') {
    return 1;
  }
  return result.total === 0 ? 12 : 4;
}

/** Plausible ranges for nurse validation: values outside are probably a typing error. */
export const PLAUSIBLE: Readonly<Record<'rr' | 'spo2' | 'sys' | 'dia' | 'hr' | 'temp', readonly [number, number]>> = {
  rr: [4, 60],
  spo2: [50, 100],
  sys: [50, 260],
  dia: [20, 160],
  hr: [25, 220],
  temp: [32, 43],
};

// ---------------------------------------------------------------------------------------------------------
// Allocation and observations
// ---------------------------------------------------------------------------------------------------------

export const WARD_NURSES: Readonly<Record<WardId, readonly string[]>> = {
  'med-a': ['SYN-STF-002', 'SYN-STF-009', 'SYN-STF-014'],
  'surg-b': ['SYN-STF-010', 'SYN-STF-019', 'SYN-STF-009'],
  paeds: ['SYN-STF-010', 'SYN-STF-014'],
  icu: ['SYN-STF-015', 'SYN-STF-019', 'SYN-STF-002'],
};

export interface BrainPatient {
  readonly patient: Patient;
  readonly bedId: string;
  readonly nurseId: string;
  readonly obs: NursingObs;
  /** Observations from the previous round, for the trend. */
  readonly previousNews2: number;
  readonly diagnosis: Text3;
  readonly dayOfStay: number;
}

function hash(text: string): number {
  let h = 0;
  for (const ch of text) {
    h = (h * 31 + ch.charCodeAt(0)) % 100_003;
  }
  return h;
}

function obsOf(patientId: string, nurseId: string): NursingObs {
  const shared = latestVitals(patientId);
  if (shared !== undefined) {
    return {
      rr: Number(shared.respRate),
      spo2: Number(shared.spo2),
      scale: 1,
      onOxygen: false,
      sys: Number(shared.systolic),
      dia: Number(shared.diastolic),
      hr: Number(shared.heartRate),
      acvpu: 'A',
      temp: Number(shared.tempC),
      time: '06:00',
      byId: shared.recordedById,
    };
  }
  const h = hash(patientId);
  const sick = h % 5 === 0;
  const watch = h % 7 === 1;
  return {
    rr: sick ? 21 : watch ? 19 : 14 + (h % 5),
    spo2: sick ? 95 : watch ? 95 : 96 + (h % 4),
    scale: 1,
    onOxygen: false,
    sys: sick ? 114 : 112 + (h % 34),
    dia: 62 + (h % 22),
    hr: sick ? 104 : watch ? 96 : 66 + (h % 22),
    acvpu: 'A',
    temp: sick ? 38.3 : Number((36.4 + (h % 9) / 10).toFixed(1)),
    time: h % 3 === 0 ? '02:00' : '06:00',
    byId: nurseId,
  };
}

export function brainPatients(wardId: WardId): readonly BrainPatient[] {
  const nurses = WARD_NURSES[wardId];
  return bedsOfWard(wardId)
    .filter((bed) => bed.patientId !== null)
    .map((bed, index) => {
      const patient = getPatient(bed.patientId ?? '');
      const nurseId = nurses[index % nurses.length] ?? nurses[0]!;
      const obs = obsOf(patient.id, nurseId);
      const encounter = currentEncounter(patient.id);
      const primary = encounter?.diagnoses.find((d) => d.primary) ?? encounter?.diagnoses[0];
      const score = news2(obs).total;
      const h = hash(patient.id);
      return {
        patient,
        bedId: bed.id,
        nurseId,
        obs,
        previousNews2: Math.max(0, score + ((h % 3) - 1) * (score > 3 ? 2 : 1)),
        diagnosis: primary?.text ?? encounter?.reason ?? { en: 'Admitted for assessment', ckb: 'بۆ هەڵسەنگاندن خەوێندراوە', ar: 'أُدخل للتقييم' },
        dayOfStay: encounter === undefined ? 1 : Math.max(1, Math.round((Date.parse('2026-10-19T09:30:00+03:00') - Date.parse(encounter.startIso)) / 86_400_000) + 1),
      };
    });
}

// ---------------------------------------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------------------------------------

export type TaskKind = 'medication' | 'observation' | 'care' | 'wound' | 'line' | 'glucose' | 'escalation';
export type TaskState = 'scheduled' | 'due' | 'overdue' | 'done';

export interface NurseTask {
  readonly id: string;
  readonly patientId: string;
  /** `HH:mm`, or null for PRN. */
  readonly time: string | null;
  readonly kind: TaskKind;
  readonly title: Text3;
  /** Latin drug line for medicines: `Levofloxacin 750 mg IV`. */
  readonly drugLine: string | null;
  readonly state: TaskState;
  readonly prn: boolean;
  /** For PRN: eligible again from this time (`HH:mm`); earlier than now means eligible. */
  readonly prnEligibleFrom: string | null;
  /** New or changed since the last shift's handover. */
  readonly changed: Text3 | null;
  readonly highAlert: boolean;
}

const NOW = '09:30';

function stateAt(time: string): TaskState {
  if (time < '09:00') {
    return 'overdue';
  }
  if (time <= '10:30') {
    return 'due';
  }
  return 'scheduled';
}

const T = {
  obs: { en: 'Observations and NEWS2', ckb: 'پشکنینی نیشانە ژیانییەکان و NEWS2', ar: 'العلامات الحيوية وNEWS2' },
  turn: { en: 'Reposition (pressure care)', ckb: 'گۆڕینی دۆخی لەش (ڕێگری لە برینی پاڵکەوتن)', ar: 'تغيير الوضعية (العناية بمناطق الضغط)' },
  wound: { en: 'Wound dressing check', ckb: 'پشکنینی پێچانی برین', ar: 'فحص ضماد الجرح' },
  cannula: { en: 'Cannula check (VIP score)', ckb: 'پشکنینی کانیولا (نمرەی VIP)', ar: 'فحص القنية الوريدية (درجة VIP)' },
  fluid: { en: 'Fluid balance chart total', ckb: 'کۆی هاوسەنگیی شلە', ar: 'مجموع ميزان السوائل' },
  bm: { en: 'Capillary blood glucose', ckb: 'شەکری خوێنی مووەکی', ar: 'سكر الدم الشعري' },
  mobility: { en: 'Mobilise with physiotherapist', ckb: 'جوڵاندن لەگەڵ فیزیۆتێراپیست', ar: 'التحريك مع أخصائي العلاج الطبيعي' },
  infusion: { en: 'Check running infusion and pump', ckb: 'پشکنینی شلەی ڕۆیشتوو و پەمپ', ar: 'فحص التسريب الجاري والمضخة' },
  med: { en: 'Give medicine', ckb: 'پێدانی دەرمان', ar: 'إعطاء الدواء' },
  prn: { en: 'PRN medicine available', ckb: 'دەرمانی کاتی پێویست بەردەستە', ar: 'دواء عند الحاجة متاح' },
  falls: { en: 'Falls risk reassessment', ckb: 'هەڵسەنگاندنەوەی مەترسیی کەوتن', ar: 'إعادة تقييم خطر السقوط' },
} as const satisfies Record<string, Text3>;

const CHANGES: readonly Text3[] = [
  { en: 'New order since handover: dose changed by the ward round', ckb: 'فەرمانی نوێ دوای ڕادەستکردن: ژەمەکە لە گەڕانی پزیشکەکاندا گۆڕا', ar: 'أمر جديد منذ التسليم: تغيرت الجرعة في جولة الأطباء' },
  { en: 'Started this morning', ckb: 'ئەمڕۆ بەیانی دەستیپێکرد', ar: 'بدأ صباح اليوم' },
  { en: 'Frequency increased after NEWS2 rose', ckb: 'ژمارەی جارەکان زیادکرا دوای بەرزبوونەوەی NEWS2', ar: 'زيد التكرار بعد ارتفاع NEWS2' },
];

const ROUTE_TEXT: Readonly<Record<string, string>> = { po: 'PO', iv: 'IV', 'iv-infusion': 'IV infusion', im: 'IM', sc: 'SC', neb: 'NEB', ng: 'NG', top: 'TOP' };

const CENSUS_MEDS: readonly { readonly line: string; readonly time: string; readonly high: boolean }[] = [
  { line: 'Amlodipine 5 mg PO', time: '08:00', high: false },
  { line: 'Ceftriaxone 1 g IV', time: '10:00', high: false },
  { line: 'Enoxaparin 40 mg SC', time: '18:00', high: true },
  { line: 'Omeprazole 20 mg PO', time: '08:00', high: false },
  { line: 'Metformin 500 mg PO', time: '13:00', high: false },
  { line: 'Atorvastatin 20 mg PO', time: '21:00', high: false },
  { line: 'Furosemide 40 mg IV', time: '10:00', high: false },
  { line: 'Insulin glargine 14 U SC', time: '22:00', high: true },
];

const PRN_MEDS: readonly string[] = ['Paracetamol 1 g PO', 'Ondansetron 4 mg IV', 'Lactulose 15 mL PO', 'Morphine 2 mg IV'];

export function tasksOf(patients: readonly BrainPatient[]): readonly NurseTask[] {
  const tasks: NurseTask[] = [];
  let n = 0;
  const push = (task: Omit<NurseTask, 'id'>): void => {
    n += 1;
    tasks.push({ id: `NT-${String(n).padStart(3, '0')}`, ...task });
  };
  for (const bp of patients) {
    const id = bp.patient.id;
    const h = hash(id);
    const score = news2(bp.obs);
    const freq = obsFrequencyHours(score);
    // Observations: next due from the last set at the NEWS2 frequency.
    const last = Number(bp.obs.time.slice(0, 2)) * 60 + Number(bp.obs.time.slice(3, 5));
    const dueMin = last + freq * 60;
    const dueTime = `${String(Math.floor(dueMin / 60) % 24).padStart(2, '0')}:${String(Math.round(dueMin % 60)).padStart(2, '0')}`;
    push({ patientId: id, time: dueTime, kind: 'observation', title: T.obs, drugLine: null, state: stateAt(dueTime), prn: false, prnEligibleFrom: null, changed: freq <= 1 && h % 2 === 0 ? CHANGES[2]! : null, highAlert: false });
    if (score.total >= 5) {
      push({
        patientId: id,
        time: bp.obs.time,
        kind: 'escalation',
        title: score.total >= 7
          ? { en: `Emergency response: NEWS2 ${String(score.total)}`, ckb: `وەڵامی فریاکەوتن: NEWS2 ${String(score.total)}`, ar: `استجابة طارئة: NEWS2 ${String(score.total)}` }
          : { en: `Escalate to doctor: NEWS2 ${String(score.total)}`, ckb: `ئاگادارکردنەوەی پزیشک: NEWS2 ${String(score.total)}`, ar: `تصعيد إلى الطبيب: NEWS2 ${String(score.total)}` },
        drugLine: null,
        state: 'overdue',
        prn: false,
        prnEligibleFrom: null,
        changed: null,
        highAlert: true,
      });
    }
    // Medicines: the shared MAR for the curated patients, a plain regimen for the census.
    const mar = marOf(id);
    if (mar.length > 0) {
      for (const dose of mar) {
        const order = findOrder(dose.orderId);
        const med = order?.medication;
        if (med === undefined || med === null || dose.status === 'given' || dose.status === 'held' || dose.status === 'refused') {
          continue;
        }
        const line = `${med.drug} ${med.dose} ${med.doseUnit} ${ROUTE_TEXT[med.route] ?? med.route}`;
        if (dose.status === 'running') {
          push({ patientId: id, time: '10:00', kind: 'line', title: T.infusion, drugLine: line, state: 'due', prn: false, prnEligibleFrom: null, changed: null, highAlert: med.highAlert });
          continue;
        }
        const time = dose.scheduledIso.slice(11, 16);
        push({ patientId: id, time, kind: 'medication', title: T.med, drugLine: line, state: dose.status === 'overdue' ? 'overdue' : dose.status === 'due' ? 'due' : 'scheduled', prn: false, prnEligibleFrom: null, changed: null, highAlert: med.highAlert });
      }
    } else {
      for (let i = 0; i < 2; i += 1) {
        const med = CENSUS_MEDS[(h + i * 3) % CENSUS_MEDS.length] ?? CENSUS_MEDS[0]!;
        push({ patientId: id, time: med.time, kind: 'medication', title: T.med, drugLine: med.line, state: stateAt(med.time), prn: false, prnEligibleFrom: null, changed: i === 0 && h % 4 === 1 ? CHANGES[0]! : null, highAlert: med.high });
      }
    }
    // PRN.
    if (h % 3 !== 2) {
      const prnLine = PRN_MEDS[h % PRN_MEDS.length] ?? PRN_MEDS[0]!;
      const from = h % 2 === 0 ? '07:10' : '11:40';
      push({ patientId: id, time: null, kind: 'medication', title: T.prn, drugLine: prnLine, state: from <= NOW ? 'due' : 'scheduled', prn: true, prnEligibleFrom: from, changed: null, highAlert: prnLine.startsWith('Morphine') });
    }
    // Care.
    const care: readonly (readonly [Text3, TaskKind, string])[] = [
      [T.turn, 'care', h % 2 === 0 ? '08:00' : '10:00'],
      [T.cannula, 'line', '10:00'],
      [h % 2 === 0 ? T.wound : T.fluid, h % 2 === 0 ? 'wound' : 'care', h % 2 === 0 ? '11:00' : '12:00'],
      [h % 3 === 0 ? T.bm : T.mobility, h % 3 === 0 ? 'glucose' : 'care', h % 3 === 0 ? '09:00' : '14:00'],
    ];
    care.forEach(([title, kind, time], i) => {
      if (i === 3 && h % 4 === 3) {
        push({ patientId: id, time: '15:00', kind: 'care', title: T.falls, drugLine: null, state: 'scheduled', prn: false, prnEligibleFrom: null, changed: CHANGES[1]!, highAlert: false });
        return;
      }
      push({ patientId: id, time, kind, title, drugLine: null, state: stateAt(time), prn: false, prnEligibleFrom: null, changed: null, highAlert: false });
    });
  }
  return tasks.toSorted((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99'));
}

// ---------------------------------------------------------------------------------------------------------
// I-PASS handover
// ---------------------------------------------------------------------------------------------------------

export type IllnessSeverity = 'stable' | 'watcher' | 'unstable';

export interface IpassEntry {
  readonly severity: IllnessSeverity;
  readonly summary: string;
  readonly actions: string;
  readonly awareness: string;
  readonly synthesis: string;
  readonly confirmed: boolean;
}

export const SEVERITY_LABEL: Readonly<Record<IllnessSeverity, Text3>> = {
  stable: { en: 'Stable', ckb: 'جێگیر', ar: 'مستقر' },
  watcher: { en: 'Watcher', ckb: 'لەژێر چاودێری', ar: 'تحت المراقبة' },
  unstable: { en: 'Unstable', ckb: 'ناجێگیر', ar: 'غير مستقر' },
};

const AWARENESS: Readonly<Record<IllnessSeverity, Text3>> = {
  stable: { en: 'If NEWS2 rises to 5 or more, call the ward doctor and repeat obs hourly.', ckb: 'ئەگەر NEWS2 گەیشتە 5 یان زیاتر، پزیشکی قاوش ئاگادار بکە و هەر کاتژمێرێک پشکنین دووبارە بکەرەوە.', ar: 'إذا ارتفع NEWS2 إلى 5 أو أكثر، اتصل بطبيب الردهة وكرر القياس كل ساعة.' },
  watcher: { en: 'Recheck obs in 1 hour. If SpO2 falls below 92% on oxygen, call the registrar.', ckb: 'دوای کاتژمێرێک پشکنین دووبارە بکەرەوە. ئەگەر SpO2 لەگەڵ ئۆکسجین لە 92% دابەزی، ڕێزیدێنت ئاگادار بکە.', ar: 'أعد القياس بعد ساعة. إذا انخفض SpO2 تحت 92% مع الأكسجين، اتصل بالطبيب المقيم.' },
  unstable: { en: 'Doctor reviewed at 09:10. Outreach team aware. If systolic falls below 90, call the emergency team.', ckb: 'پزیشک لە 09:10 پێداچوونەوەی کرد. تیمی دەرەوە ئاگادارە. ئەگەر پەستانی سیستۆلیک لە 90 دابەزی، تیمی فریاکەوتن بانگ بکە.', ar: 'راجعه الطبيب الساعة 09:10. فريق التواصل على علم. إذا انخفض الضغط الانقباضي تحت 90، استدعِ فريق الطوارئ.' },
};

export function ipassDefault(bp: BrainPatient, tasks: readonly NurseTask[], locale: 'en' | 'ckb' | 'ar'): IpassEntry {
  const score = news2(bp.obs);
  const severity: IllnessSeverity = score.total >= 5 ? 'unstable' : score.total >= 3 || score.redScore ? 'watcher' : 'stable';
  const next = tasks.filter((task) => task.patientId === bp.patient.id && task.state !== 'done' && !task.prn).slice(0, 3);
  const dayWord = { en: 'day', ckb: 'ڕۆژی', ar: 'اليوم' }[locale];
  return {
    severity,
    summary: `${bp.diagnosis[locale]} · ${dayWord} ${String(bp.dayOfStay)} · NEWS2 ${String(score.total)}`,
    actions: next.map((task) => `${task.time ?? ''} ${task.drugLine ?? task.title[locale]}`.trim()).join('\n'),
    awareness: AWARENESS[severity][locale],
    synthesis: '',
    confirmed: false,
  };
}

export const WARD_OPTIONS: readonly WardId[] = WARDS.map((ward) => ward.id);
