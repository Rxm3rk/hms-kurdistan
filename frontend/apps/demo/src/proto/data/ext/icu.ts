/**
 * Intensive care: the ICU bed overview with severity scores and organ support, the hourly flowsheet (vitals,
 * ventilator, infusions, intake and output), and the devices associated with each patient (lines, tubes and
 * connected equipment). SYNTHETIC DATA ONLY, NOT FOR CLINICAL USE.
 */
import { bedsOfWard, currentEncounter, daysAgoAt, getPatient } from '../index.ts';
import type { Patient, Text3 } from '../types.ts';

export type VentMode = 'SIMV-PC' | 'PRVC' | 'CPAP-PS' | 'HFNO' | null;

export interface IcuPatient {
  readonly bedId: string;
  readonly patient: Patient;
  readonly diagnosis: Text3;
  readonly icuDay: number;
  readonly apache2: number;
  readonly sofa: number;
  readonly vent: VentMode;
  readonly vasopressor: boolean;
  readonly rrt: boolean;
  readonly sedated: boolean;
  /** Richmond agitation-sedation scale. */
  readonly rass: number;
  readonly consultant: Text3;
}

export interface FlowRow {
  readonly id: string;
  readonly group: 'vitals' | 'vent' | 'infusion' | 'intake' | 'output';
  readonly label: Text3;
  /** Display unit, Latin. */
  readonly unit: string;
  readonly low?: number;
  readonly high?: number;
}

export const FLOW_ROWS: readonly FlowRow[] = [
  { id: 'hr', group: 'vitals', label: { en: 'Heart rate', ckb: 'لێدانی دڵ', ar: 'نبض القلب' }, unit: '/min', low: 50, high: 120 },
  { id: 'sbp', group: 'vitals', label: { en: 'Systolic BP', ckb: 'پەستانی سیستۆلیک', ar: 'الضغط الانقباضي' }, unit: 'mmHg', low: 90, high: 180 },
  { id: 'map', group: 'vitals', label: { en: 'Mean arterial pressure', ckb: 'تێکڕای پەستانی خوێنبەر', ar: 'متوسط الضغط الشرياني' }, unit: 'mmHg', low: 65, high: 110 },
  { id: 'rr', group: 'vitals', label: { en: 'Respiratory rate', ckb: 'ڕێژەی هەناسە', ar: 'معدل التنفس' }, unit: '/min', low: 10, high: 28 },
  { id: 'spo2', group: 'vitals', label: { en: 'SpO2', ckb: 'SpO2', ar: 'SpO2' }, unit: '%', low: 92 },
  { id: 'temp', group: 'vitals', label: { en: 'Temperature', ckb: 'پلەی گەرمی', ar: 'الحرارة' }, unit: '°C', low: 36, high: 38.3 },
  { id: 'cvp', group: 'vitals', label: { en: 'CVP', ckb: 'CVP', ar: 'CVP' }, unit: 'mmHg', low: 2, high: 14 },
  { id: 'fio2', group: 'vent', label: { en: 'FiO2', ckb: 'FiO2', ar: 'FiO2' }, unit: '%', high: 60 },
  { id: 'peep', group: 'vent', label: { en: 'PEEP', ckb: 'PEEP', ar: 'PEEP' }, unit: 'cmH2O', high: 12 },
  { id: 'vt', group: 'vent', label: { en: 'Tidal volume', ckb: 'قەبارەی هەناسە', ar: 'حجم المد' }, unit: 'mL' },
  { id: 'norad', group: 'infusion', label: { en: 'Noradrenaline', ckb: 'نۆرئەدرینالین', ar: 'نورأدرينالين' }, unit: 'mcg/kg/min', high: 0.3 },
  { id: 'propofol', group: 'infusion', label: { en: 'Propofol', ckb: 'پرۆپۆفۆڵ', ar: 'بروبوفول' }, unit: 'mg/h' },
  { id: 'fentanyl', group: 'infusion', label: { en: 'Fentanyl', ckb: 'فێنتانیل', ar: 'فنتانيل' }, unit: 'mcg/h' },
  { id: 'insulin', group: 'infusion', label: { en: 'Insulin (soluble)', ckb: 'ئەنسولین (تواوە)', ar: 'إنسولين (ذائب)' }, unit: 'U/h' },
  { id: 'ivfluid', group: 'intake', label: { en: 'IV fluids and drugs', ckb: 'شلە و دەرمانی ناو دەمار', ar: 'السوائل والأدوية الوريدية' }, unit: 'mL' },
  { id: 'enteral', group: 'intake', label: { en: 'Enteral feed', ckb: 'خۆراکی ڕیخۆڵەیی', ar: 'التغذية المعوية' }, unit: 'mL' },
  { id: 'urine', group: 'output', label: { en: 'Urine', ckb: 'میز', ar: 'البول' }, unit: 'mL', low: 30 },
  { id: 'drain', group: 'output', label: { en: 'Drains and NG', ckb: 'درەین و بۆری لووت', ar: 'المصارف والأنبوب الأنفي' }, unit: 'mL' },
];

export const FLOW_HOURS: readonly string[] = ['00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00', '08:00', '09:00'];

/** rowId → one value per hour (null: not recorded). */
export type Flowsheet = Readonly<Record<string, readonly (string | null)[]>>;

export type DeviceKind = 'cvc' | 'arterial' | 'ett' | 'urinary' | 'ng' | 'ventilator' | 'monitor' | 'pump' | 'dialysis';

export interface IcuDevice {
  readonly id: string;
  readonly kind: DeviceKind;
  /** Site or model, Latin or Text3-free (equipment labels are Latin). */
  readonly detail: string;
  readonly serial: string | null;
  readonly insertedIso: string;
  readonly removedIso: string | null;
  /** For connected equipment: data streams into the flowsheet. */
  readonly streaming: boolean;
  readonly bundleChecked: boolean;
}

export const DEVICE_LABEL: Readonly<Record<DeviceKind, Text3>> = {
  cvc: { en: 'Central venous catheter', ckb: 'کاتەتەری دەماری ناوەندی', ar: 'قسطرة وريدية مركزية' },
  arterial: { en: 'Arterial line', ckb: 'هێڵی خوێنبەر', ar: 'خط شرياني' },
  ett: { en: 'Endotracheal tube', ckb: 'بۆری ناو بۆری هەوا', ar: 'أنبوب رغامي' },
  urinary: { en: 'Urinary catheter', ckb: 'کاتەتەری میز', ar: 'قسطرة بولية' },
  ng: { en: 'Nasogastric tube', ckb: 'بۆری لووت بۆ گەدە', ar: 'أنبوب أنفي معدي' },
  ventilator: { en: 'Ventilator', ckb: 'ئامێری هەناسەدان', ar: 'جهاز التنفس الاصطناعي' },
  monitor: { en: 'Bedside monitor', ckb: 'مۆنیتەری لای جێگە', ar: 'جهاز المراقبة' },
  pump: { en: 'Infusion pump', ckb: 'پەمپی شلە', ar: 'مضخة التسريب' },
  dialysis: { en: 'CRRT machine', ckb: 'ئامێری دیالیزی بەردەوام', ar: 'جهاز الغسيل المستمر' },
};

/** Days after which a line should be reviewed for removal (care bundle). */
export const REVIEW_AFTER_DAYS: Readonly<Partial<Record<DeviceKind, number>>> = { cvc: 7, arterial: 5, urinary: 5, ett: 7, ng: 14 };

const DX = {
  septic: { en: 'Septic shock, pneumonia source', ckb: 'شۆکی سێپتیک، سەرچاوەی سییەکان', ar: 'صدمة إنتانية، مصدرها رئوي' },
  ards: { en: 'ARDS after aspiration', ckb: 'ARDS دوای هەڵمژین', ar: 'متلازمة الضائقة التنفسية بعد الشفط' },
  postop: { en: 'After emergency laparotomy, bowel perforation', ckb: 'دوای کردنەوەی سکی فریاکەوتن، کونبوونی ڕیخۆڵە', ar: 'بعد فتح البطن الإسعافي، انثقاب الأمعاء' },
  tbi: { en: 'Traumatic brain injury, road traffic collision', ckb: 'برینی مێشک لە ڕووداوی هاتوچۆ', ar: 'إصابة دماغية رضية، حادث سير' },
  dka: { en: 'Severe diabetic ketoacidosis', ckb: 'کیتۆئەسیدۆزیسی شەکرەی توند', ar: 'حماض كيتوني سكري شديد' },
  copd: { en: 'COPD exacerbation, type 2 respiratory failure', ckb: 'تەقینەوەی COPD، شکستی هەناسەی جۆری 2', ar: 'تفاقم الانسداد الرئوي، فشل تنفسي من النوع 2' },
  aki: { en: 'Acute kidney injury on CRRT, cardiogenic shock', ckb: 'برینی توندی گورچیلە لەسەر CRRT، شۆکی دڵ', ar: 'أذية كلوية حادة على الغسيل المستمر، صدمة قلبية' },
} as const satisfies Record<string, Text3>;

const CONSULTANT: Text3 = { en: 'Dr. Kosrat Hama', ckb: 'د. کۆسرەت حەمە', ar: 'د. كوسرت حمه' };

interface Profile {
  readonly dx: Text3;
  readonly apache2: number;
  readonly sofa: number;
  readonly vent: VentMode;
  readonly vasopressor: boolean;
  readonly rrt: boolean;
  readonly sedated: boolean;
  readonly rass: number;
  readonly icuDay: number;
}

const PROFILES: readonly Profile[] = [
  { dx: DX.ards, apache2: 24, sofa: 9, vent: 'PRVC', vasopressor: false, rrt: false, sedated: true, rass: -3, icuDay: 4 },
  { dx: DX.postop, apache2: 19, sofa: 6, vent: 'CPAP-PS', vasopressor: false, rrt: false, sedated: false, rass: 0, icuDay: 2 },
  { dx: DX.septic, apache2: 27, sofa: 11, vent: 'SIMV-PC', vasopressor: true, rrt: false, sedated: true, rass: -4, icuDay: 3 },
  { dx: DX.tbi, apache2: 22, sofa: 8, vent: 'PRVC', vasopressor: false, rrt: false, sedated: true, rass: -4, icuDay: 6 },
  { dx: DX.dka, apache2: 14, sofa: 3, vent: null, vasopressor: false, rrt: false, sedated: false, rass: 0, icuDay: 1 },
  { dx: DX.copd, apache2: 18, sofa: 5, vent: 'HFNO', vasopressor: false, rrt: false, sedated: false, rass: 0, icuDay: 2 },
  { dx: DX.aki, apache2: 29, sofa: 13, vent: 'SIMV-PC', vasopressor: true, rrt: true, sedated: true, rass: -3, icuDay: 9 },
];

function build(): readonly IcuPatient[] {
  return bedsOfWard('icu')
    .filter((bed) => bed.patientId !== null)
    .map((bed, index) => {
      const patient = getPatient(bed.patientId ?? '');
      const profile = PROFILES[index % PROFILES.length] ?? PROFILES[0]!;
      const encounter = currentEncounter(patient.id);
      const curated = patient.id === 'SYN-PAT-0109';
      return {
        bedId: bed.id,
        patient,
        diagnosis: curated ? (encounter?.diagnoses[0]?.text ?? profile.dx) : profile.dx,
        icuDay: profile.icuDay,
        apache2: profile.apache2,
        sofa: profile.sofa,
        vent: profile.vent,
        vasopressor: profile.vasopressor,
        rrt: profile.rrt,
        sedated: profile.sedated,
        rass: profile.rass,
        consultant: CONSULTANT,
      };
    });
}

export const ICU_PATIENTS: readonly IcuPatient[] = build();
export const ICU_BED_COUNT = 8;

function wave(seed: number, i: number, base: number, amp: number, drift = 0): number {
  return base + amp * Math.sin((seed + i) * 0.9) + drift * i;
}

function fmt(value: number, digits = 0): string {
  return value.toFixed(digits);
}

export function flowsheetOf(p: IcuPatient): Flowsheet {
  const seed = p.patient.id.charCodeAt(p.patient.id.length - 1) + p.apache2;
  const shocked = p.vasopressor;
  const hours = FLOW_HOURS.length;
  const series = (fn: (i: number) => string | null): (string | null)[] => Array.from({ length: hours }, (_, i) => fn(i));
  const ventilated = p.vent !== null && p.vent !== 'HFNO';
  return {
    hr: series((i) => fmt(wave(seed, i, shocked ? 112 : 88, 7, shocked ? -1.2 : 0))),
    sbp: series((i) => fmt(wave(seed, i, shocked ? 96 : 128, 6, shocked ? 1.5 : 0))),
    map: series((i) => fmt(wave(seed, i, shocked ? 62 : 82, 4, shocked ? 0.9 : 0))),
    rr: series((i) => fmt(wave(seed, i, p.vent === 'HFNO' ? 26 : 18, 3))),
    spo2: series((i) => fmt(Math.min(100, wave(seed, i, p.vent === 'HFNO' ? 91 : 95, 2, 0.2)))),
    temp: series((i) => (i % 2 === 0 ? fmt(wave(seed, i, shocked ? 38.4 : 37.1, 0.3, -0.04), 1) : null)),
    cvp: series((i) => (shocked || p.rrt ? fmt(wave(seed, i, 9, 2)) : null)),
    fio2: series((i) => (p.vent === null ? null : fmt(Math.max(30, wave(seed, i, ventilated ? 55 : 45, 5, -1.5))))),
    peep: series(() => (ventilated ? (p.vent === 'CPAP-PS' ? '6' : '10') : null)),
    vt: series((i) => (ventilated ? fmt(wave(seed, i, 430, 25)) : null)),
    norad: series((i) => (shocked ? fmt(Math.max(0.04, 0.18 - i * 0.006), 2) : null)),
    propofol: series(() => (p.sedated ? '120' : null)),
    fentanyl: series(() => (p.sedated ? '75' : null)),
    insulin: series((i) => (p.diagnosis === DX.dka ? fmt(Math.max(2, 6.6 - i * 0.4), 1) : p.sedated && i > 5 ? '2' : null)),
    ivfluid: series((i) => fmt(wave(seed, i, shocked ? 160 : 90, 25))),
    enteral: series((i) => (p.vent !== null && i > 1 ? (p.sedated ? '40' : '30') : null)),
    urine: series((i) => fmt(Math.max(5, wave(seed, i, p.rrt ? 12 : shocked ? 35 : 70, 12, shocked ? 2 : 0)))),
    drain: series((i) => (p.diagnosis === DX.postop ? fmt(wave(seed, i, 40, 15)) : i % 4 === 0 && p.vent !== null ? '50' : null)),
  };
}

/** Running fluid balance (intake minus output) from midnight. */
export function balanceOf(sheet: Flowsheet): readonly number[] {
  let running = 0;
  return FLOW_HOURS.map((_, i) => {
    const sum = (ids: readonly string[]): number => ids.reduce((acc, id) => acc + Number(sheet[id]?.[i] ?? 0), 0);
    running += sum(['ivfluid', 'enteral']) - sum(['urine', 'drain']);
    return running;
  });
}

const SERIAL = (prefix: string, n: number): string => `${prefix}-${String(10_000 + n * 137)}`;

export function devicesOf(p: IcuPatient, index: number): readonly IcuDevice[] {
  const d = (kind: DeviceKind, detail: string, daysAgo: number, hhmm: string, serial: string | null, extra: Partial<IcuDevice> = {}): IcuDevice => ({
    id: `${p.bedId}-${kind}-${detail.length}`,
    kind,
    detail,
    serial,
    insertedIso: daysAgoAt(daysAgo, hhmm),
    removedIso: null,
    streaming: serial !== null,
    bundleChecked: daysAgo < 3 || index % 2 === 0,
    ...extra,
  });
  const list: IcuDevice[] = [d('monitor', 'IntelliSyn MX550', p.icuDay - 1, '14:00', SERIAL('MON', index))];
  if (p.vent !== null) {
    list.push(d('ventilator', p.vent === 'HFNO' ? 'AirSyn HF60 high-flow' : 'VentaSyn V500', p.icuDay - 1, '15:10', SERIAL('VEN', index)));
  }
  if (p.vent !== null && p.vent !== 'HFNO' && p.vent !== 'CPAP-PS') {
    list.push(d('ett', '7.5 mm, 22 cm at lips', p.icuDay - 1, '15:00', null));
  }
  if (p.vasopressor || p.apache2 > 20) {
    list.push(d('cvc', 'Right internal jugular, triple lumen', p.icuDay - 1, '16:20', null, { bundleChecked: p.icuDay <= 7 }));
    list.push(d('arterial', 'Left radial, 20 G', p.icuDay - 1, '16:40', null));
    list.push(d('pump', 'Syringe pump ×3', p.icuDay - 1, '16:45', SERIAL('PMP', index)));
  }
  list.push(d('urinary', '14 Fr Foley', p.icuDay - 1, '15:30', null));
  if (p.vent !== null) {
    list.push(d('ng', '16 Fr, 60 cm at nostril', Math.max(0, p.icuDay - 2), '09:00', null));
  }
  if (p.rrt) {
    list.push(d('dialysis', 'PrismaSyn CRRT, right femoral Vascath', 3, '11:00', SERIAL('RRT', index)));
  }
  return list;
}

export const VENT_LABEL: Readonly<Record<Exclude<VentMode, null>, Text3>> = {
  'SIMV-PC': { en: 'Ventilated · SIMV-PC', ckb: 'هەناسەدانی دەستکرد · SIMV-PC', ar: 'تنفس اصطناعي · SIMV-PC' },
  PRVC: { en: 'Ventilated · PRVC', ckb: 'هەناسەدانی دەستکرد · PRVC', ar: 'تنفس اصطناعي · PRVC' },
  'CPAP-PS': { en: 'CPAP with pressure support', ckb: 'CPAP لەگەڵ پشتیوانیی پەستان', ar: 'CPAP مع دعم الضغط' },
  HFNO: { en: 'High-flow nasal oxygen', ckb: 'ئۆکسجینی لووتی بە لێشاوی بەرز', ar: 'أكسجين أنفي عالي التدفق' },
};
