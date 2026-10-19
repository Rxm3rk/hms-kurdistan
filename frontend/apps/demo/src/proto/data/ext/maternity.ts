/**
 * Maternity: the labour ward board, partograph examinations, delivery records, newborns linked to their
 * mothers, and KRG Ministry of Health birth notifications. SYNTHETIC DATA ONLY, NOT FOR CLINICAL USE.
 */
import { daysAgoAt, todayAt } from '../index.ts';
import type { Patient, PersonName, Text3, Tone } from '../types.ts';
import { extPatient } from './care-people.ts';

export type LabourStage = 'antenatal' | 'latent' | 'active' | 'second' | 'third' | 'delivered';
export type Membranes = 'intact' | 'clear' | 'meconium' | 'blood-stained';
export type RiskFlag = 'previous-cs' | 'gdm' | 'pre-eclampsia' | 'breech' | 'preterm' | 'twins' | 'gbs' | 'anaemia';

export interface PartographExam {
  /** `HH:mm` on the demo day (or the evening before, with `prevDay`). */
  readonly iso: string;
  readonly dilationCm: number;
  /** Head palpable above the brim, in fifths (5 to 0). */
  readonly descentFifths: number;
  readonly fhr: number;
  /** Contractions in 10 minutes. */
  readonly contractions: number;
  readonly pulse: number;
  readonly sys: number;
  readonly dia: number;
}

export interface LabourWoman {
  readonly id: string;
  readonly patient: Patient;
  readonly room: string;
  readonly gravida: number;
  readonly para: number;
  /** Gestation at the demo day: weeks and days. */
  readonly gaWeeks: number;
  readonly gaDays: number;
  readonly stage: LabourStage;
  /** When the active phase started (4 cm), the partograph's zero. */
  readonly activeFromIso: string | null;
  readonly membranes: Membranes;
  readonly risks: readonly RiskFlag[];
  readonly midwife: Text3;
  readonly obstetrician: Text3;
  readonly exams: readonly PartographExam[];
  readonly oxytocin: boolean;
  readonly epidural: boolean;
  readonly husband: PersonName;
  readonly husbandNationalId: string;
}

export type DeliveryMode = 'svd' | 'vacuum' | 'forceps' | 'elective-cs' | 'emergency-cs';
export type Perineum = 'intact' | 'first' | 'second' | 'episiotomy' | 'not-applicable';

export interface Newborn {
  readonly id: string;
  readonly baby: Patient;
  readonly motherId: string;
  readonly birthIso: string;
  readonly sex: 'male' | 'female';
  readonly weightG: number;
  readonly apgar1: number;
  readonly apgar5: number;
  readonly mode: DeliveryMode;
  readonly ebl: number;
  readonly perineum: Perineum;
  /** Matching wristband numbers on mother and baby. */
  readonly bandId: string;
  readonly bandsChecked: boolean;
  readonly vitaminK: boolean;
  readonly bcgHepB: boolean;
  readonly notification: 'draft' | 'submitted';
  readonly notificationNo: string;
  readonly attendant: Text3;
}

const MIDWIVES: readonly Text3[] = [
  { en: 'Midwife Shirin Ahmed', ckb: 'مامان شیرین ئەحمەد', ar: 'القابلة شيرين أحمد' },
  { en: 'Midwife Hero Karim', ckb: 'مامان هێرۆ کەریم', ar: 'القابلة هيرو كريم' },
  { en: 'Midwife Payman Rashid', ckb: 'مامان پەیمان ڕەشید', ar: 'القابلة بيمان رشيد' },
];

const OBSTETRICIANS: readonly Text3[] = [
  { en: 'Dr. Avesta Jalal', ckb: 'د. ئاڤێستا جەلال', ar: 'د. آفيستا جلال' },
  { en: 'Dr. Kazhal Sadiq', ckb: 'د. کەژاڵ سدیق', ar: 'د. كژال صديق' },
];

const HUSBANDS: readonly PersonName[] = [
  { latin: 'Rebwar Hassan Omar', ckb: 'ڕێبوار حەسەن عومەر', ar: 'ريبوار حسن عمر' },
  { latin: 'Karzan Jalal Ahmed', ckb: 'کارزان جەلال ئەحمەد', ar: 'كارزان جلال أحمد' },
  { latin: 'Ahmed Khalid Mahmood', ckb: 'ئەحمەد خالید مەحموود', ar: 'أحمد خالد محمود' },
  { latin: 'Shwan Farhad Qadir', ckb: 'شوان فەرهاد قادر', ar: 'شوان فرهاد قادر' },
  { latin: 'Mustafa Ali Hussein', ckb: 'مستەفا عەلی حوسێن', ar: 'مصطفى علي حسين' },
  { latin: 'Dlshad Sharif Saeed', ckb: 'دڵشاد شەریف سەعید', ar: 'دلشاد شريف سعيد' },
  { latin: 'Hawkar Tofiq Ibrahim', ckb: 'هاوکار تۆفیق ئیبراهیم', ar: 'هاوكار توفيق إبراهيم' },
  { latin: 'Omar Rashid Karim', ckb: 'عومەر ڕەشید کەریم', ar: 'عمر رشيد كريم' },
  { latin: 'Sardar Najmaddin Sadiq', ckb: 'سەردار نەجمەدین سدیق', ar: 'سردار نجم الدين صديق' },
  { latin: 'Yousif Haider Abdulrahman', ckb: 'یوسف حەیدەر عەبدولڕەحمان', ar: 'يوسف حيدر عبد الرحمن' },
];

function mother(n: number, age: number): Patient {
  return extPatient(500 + n, { sex: 'female', age, payerId: n % 3 === 0 ? 'syn-insurance' : n % 3 === 1 ? 'self-pay' : 'government' });
}

function ex(hhmm: string, dilationCm: number, descentFifths: number, fhr: number, contractions: number, pulse = 88, sys = 118, dia = 74, prevDay = false): PartographExam {
  return { iso: prevDay ? daysAgoAt(1, hhmm) : todayAt(hhmm), dilationCm, descentFifths, fhr, contractions, pulse, sys, dia };
}

interface Seed {
  readonly room: string;
  readonly age: number;
  readonly g: number;
  readonly p: number;
  readonly ga: readonly [number, number];
  readonly stage: LabourStage;
  readonly activeFrom: string | null;
  readonly membranes: Membranes;
  readonly risks: readonly RiskFlag[];
  readonly exams: readonly PartographExam[];
  readonly oxytocin?: boolean;
  readonly epidural?: boolean;
}

const SEEDS: readonly Seed[] = [
  // Progressing normally, primigravida.
  { room: 'LDR-1', age: 24, g: 1, p: 0, ga: [39, 4], stage: 'active', activeFrom: '05:00', membranes: 'clear', risks: [], epidural: true, exams: [ex('05:00', 4, 4, 138, 3), ex('07:00', 5, 4, 142, 3), ex('09:00', 7, 3, 140, 4)] },
  // Slow: crossed the alert line, near the action line.
  { room: 'LDR-2', age: 29, g: 2, p: 1, ga: [40, 2], stage: 'active', activeFrom: '02:30', membranes: 'meconium', risks: ['previous-cs'], oxytocin: true, exams: [ex('02:30', 4, 5, 136, 2), ex('04:30', 5, 4, 150, 3), ex('06:30', 5, 4, 162, 3, 104, 126, 82), ex('08:30', 6, 4, 164, 4, 108, 130, 84)] },
  // Second stage.
  { room: 'LDR-3', age: 31, g: 3, p: 2, ga: [38, 6], stage: 'second', activeFrom: '06:10', membranes: 'clear', risks: ['gbs'], exams: [ex('06:10', 5, 3, 134, 4), ex('08:00', 8, 2, 130, 4), ex('09:10', 10, 1, 128, 5)] },
  // Pre-eclampsia, induced.
  { room: 'LDR-4', age: 35, g: 2, p: 0, ga: [37, 1], stage: 'active', activeFrom: '07:30', membranes: 'intact', risks: ['pre-eclampsia', 'gdm'], oxytocin: true, epidural: true, exams: [ex('07:30', 4, 5, 144, 3, 96, 154, 102), ex('09:15', 5, 4, 140, 3, 98, 150, 98)] },
  // Latent phase.
  { room: 'LDR-5', age: 21, g: 1, p: 0, ga: [40, 0], stage: 'latent', activeFrom: null, membranes: 'intact', risks: ['anaemia'], exams: [ex('08:20', 2, 5, 146, 2)] },
  // Antenatal triage: preterm tightenings.
  { room: 'Triage-1', age: 27, g: 2, p: 1, ga: [33, 3], stage: 'antenatal', activeFrom: null, membranes: 'intact', risks: ['preterm'], exams: [ex('09:05', 1, 5, 150, 1)] },
  // Antenatal triage: twins for elective CS.
  { room: 'Triage-2', age: 33, g: 3, p: 2, ga: [37, 0], stage: 'antenatal', activeFrom: null, membranes: 'intact', risks: ['twins', 'previous-cs'], exams: [] },
  // Third stage.
  { room: 'LDR-6', age: 26, g: 2, p: 1, ga: [39, 1], stage: 'third', activeFrom: '04:40', membranes: 'clear', risks: [], exams: [ex('04:40', 4, 4, 140, 3), ex('06:40', 7, 2, 138, 4), ex('08:10', 10, 0, 134, 5)] },
  // Delivered earlier today (postnatal).
  { room: 'PN-1', age: 28, g: 1, p: 1, ga: [39, 6], stage: 'delivered', activeFrom: '01:00', membranes: 'clear', risks: [], exams: [ex('01:00', 4, 4, 140, 3), ex('03:00', 7, 2, 136, 4), ex('04:40', 10, 0, 130, 5)] },
  { room: 'PN-2', age: 32, g: 4, p: 4, ga: [38, 2], stage: 'delivered', activeFrom: null, membranes: 'clear', risks: ['previous-cs'], exams: [] },
  { room: 'PN-3', age: 25, g: 2, p: 2, ga: [40, 1], stage: 'delivered', activeFrom: '20:30', membranes: 'clear', risks: [], exams: [ex('20:30', 4, 4, 142, 3, 86, 116, 72, true), ex('22:30', 8, 1, 138, 4, 88, 118, 74, true)] },
];

export const LABOUR_WOMEN: readonly LabourWoman[] = SEEDS.map((seed, i) => ({
  id: `MAT-${String(i + 1).padStart(2, '0')}`,
  patient: mother(i, seed.age),
  room: seed.room,
  gravida: seed.g,
  para: seed.p,
  gaWeeks: seed.ga[0],
  gaDays: seed.ga[1],
  stage: seed.stage,
  activeFromIso: seed.activeFrom === null ? null : seed.room === 'PN-3' ? daysAgoAt(1, seed.activeFrom) : todayAt(seed.activeFrom),
  membranes: seed.membranes,
  risks: seed.risks,
  midwife: MIDWIVES[i % MIDWIVES.length] ?? MIDWIVES[0]!,
  obstetrician: OBSTETRICIANS[i % OBSTETRICIANS.length] ?? OBSTETRICIANS[0]!,
  exams: seed.exams,
  oxytocin: seed.oxytocin ?? false,
  epidural: seed.epidural ?? false,
  husband: HUSBANDS[i % HUSBANDS.length] ?? HUSBANDS[0]!,
  husbandNationalId: `SYN-NID-${String(188_400_000 + i * 6131)}`,
}));

function babyName(mum: Patient, sex: 'male' | 'female'): PersonName {
  const first = (s: string): string => s.split(' ')[0] ?? s;
  return sex === 'male'
    ? { latin: `Baby boy of ${first(mum.name.latin)}`, ckb: `کوڕی ${first(mum.name.ckb)}`, ar: `مولود ${first(mum.name.ar)}` }
    : { latin: `Baby girl of ${first(mum.name.latin)}`, ckb: `کچی ${first(mum.name.ckb)}`, ar: `مولودة ${first(mum.name.ar)}` };
}

export function makeBaby(n: number, mum: Patient, sex: 'male' | 'female', birthIso: string): Patient {
  const base = extPatient(560 + n, { sex, age: 0, dob: birthIso.slice(0, 10), name: babyName(mum, sex) });
  return { ...base, governorate: mum.governorate, city: mum.city, payerId: mum.payerId, name: { ...babyName(mum, sex), ownScript: 'ckb' } };
}

const BIRTHS: readonly { readonly mother: string; readonly sex: 'male' | 'female'; readonly iso: string; readonly weightG: number; readonly apgar: readonly [number, number]; readonly mode: DeliveryMode; readonly ebl: number; readonly perineum: Perineum; readonly submitted: boolean }[] = [
  { mother: 'MAT-09', sex: 'female', iso: todayAt('05:12'), weightG: 3240, apgar: [8, 9], mode: 'svd', ebl: 300, perineum: 'first', submitted: false },
  { mother: 'MAT-10', sex: 'male', iso: todayAt('07:45'), weightG: 3610, apgar: [9, 10], mode: 'elective-cs', ebl: 650, perineum: 'not-applicable', submitted: false },
  { mother: 'MAT-11', sex: 'male', iso: daysAgoAt(1, '23:20'), weightG: 2980, apgar: [7, 9], mode: 'vacuum', ebl: 400, perineum: 'episiotomy', submitted: true },
];

export const NEWBORNS: readonly Newborn[] = BIRTHS.map((b, i) => {
  const mum = LABOUR_WOMEN.find((w) => w.id === b.mother) ?? LABOUR_WOMEN[0]!;
  return {
    id: `NB-${String(i + 1).padStart(2, '0')}`,
    baby: makeBaby(i, mum.patient, b.sex, b.iso),
    motherId: mum.id,
    birthIso: b.iso,
    sex: b.sex,
    weightG: b.weightG,
    apgar1: b.apgar[0],
    apgar5: b.apgar[1],
    mode: b.mode,
    ebl: b.ebl,
    perineum: b.perineum,
    bandId: `SYN-BND-${String(4410 + i)}`,
    bandsChecked: i !== 1,
    vitaminK: true,
    bcgHepB: i === 2,
    notification: b.submitted ? 'submitted' : 'draft',
    notificationNo: `SYN-BN-2026-${String(18_240 + i)}`,
    attendant: mum.midwife,
  };
});

export const STAGE_LABEL: Readonly<Record<LabourStage, Text3>> = {
  antenatal: { en: 'Antenatal assessment', ckb: 'هەڵسەنگاندنی پێش منداڵبوون', ar: 'تقييم ما قبل الولادة' },
  latent: { en: 'Latent first stage', ckb: 'قۆناغی یەکەمی شاراوە', ar: 'المرحلة الأولى الكامنة' },
  active: { en: 'Active first stage', ckb: 'قۆناغی یەکەمی چالاک', ar: 'المرحلة الأولى النشطة' },
  second: { en: 'Second stage', ckb: 'قۆناغی دووەم', ar: 'المرحلة الثانية' },
  third: { en: 'Third stage', ckb: 'قۆناغی سێیەم', ar: 'المرحلة الثالثة' },
  delivered: { en: 'Delivered, postnatal', ckb: 'منداڵی بوو، دوای منداڵبوون', ar: 'وضعت، ما بعد الولادة' },
};

export const STAGE_TONE: Readonly<Record<LabourStage, Tone>> = {
  antenatal: 'neutral',
  latent: 'info',
  active: 'accent',
  second: 'warning',
  third: 'warning',
  delivered: 'success',
};

export const MEMBRANES_LABEL: Readonly<Record<Membranes, Text3>> = {
  intact: { en: 'Membranes intact', ckb: 'پەردەکان ساغن', ar: 'الأغشية سليمة' },
  clear: { en: 'Ruptured, clear liquor', ckb: 'دڕاوە، ئاوی ڕوون', ar: 'متمزقة، سائل صافٍ' },
  meconium: { en: 'Ruptured, meconium-stained', ckb: 'دڕاوە، ئاوی میکۆنیۆمدار', ar: 'متمزقة، ملوّثة بالعقي' },
  'blood-stained': { en: 'Ruptured, blood-stained', ckb: 'دڕاوە، خوێناوی', ar: 'متمزقة، مدمّاة' },
};

export const RISK_LABEL: Readonly<Record<RiskFlag, Text3>> = {
  'previous-cs': { en: 'Previous caesarean', ckb: 'قەیسەریی پێشوو', ar: 'قيصرية سابقة' },
  gdm: { en: 'Gestational diabetes', ckb: 'شەکرەی دووگیانی', ar: 'سكري الحمل' },
  'pre-eclampsia': { en: 'Pre-eclampsia', ckb: 'پێش-ئیکلامپسیا', ar: 'ما قبل الارتعاج' },
  breech: { en: 'Breech', ckb: 'پێ لە پێشەوە', ar: 'مجيء مقعدي' },
  preterm: { en: 'Preterm', ckb: 'پێش کات', ar: 'خداج' },
  twins: { en: 'Twins', ckb: 'دووانە', ar: 'توأم' },
  gbs: { en: 'GBS positive', ckb: 'GBS پۆزەتیڤ', ar: 'GBS إيجابي' },
  anaemia: { en: 'Anaemia', ckb: 'کەمخوێنی', ar: 'فقر الدم' },
};

export const MODE_LABEL: Readonly<Record<DeliveryMode, Text3>> = {
  svd: { en: 'Spontaneous vaginal delivery', ckb: 'منداڵبوونی سروشتی', ar: 'ولادة مهبلية تلقائية' },
  vacuum: { en: 'Vacuum-assisted delivery', ckb: 'منداڵبوون بە ڤاکیووم', ar: 'ولادة بالشفط' },
  forceps: { en: 'Forceps delivery', ckb: 'منداڵبوون بە فۆرسێپس', ar: 'ولادة بالملقط' },
  'elective-cs': { en: 'Elective caesarean section', ckb: 'قەیسەریی پلان بۆ دانراو', ar: 'قيصرية اختيارية' },
  'emergency-cs': { en: 'Emergency caesarean section', ckb: 'قەیسەریی فریاکەوتن', ar: 'قيصرية طارئة' },
};

export const PERINEUM_LABEL: Readonly<Record<Perineum, Text3>> = {
  intact: { en: 'Intact', ckb: 'ساغ', ar: 'سليم' },
  first: { en: 'First-degree tear', ckb: 'دڕانی پلەی یەک', ar: 'تمزق من الدرجة الأولى' },
  second: { en: 'Second-degree tear', ckb: 'دڕانی پلەی دوو', ar: 'تمزق من الدرجة الثانية' },
  episiotomy: { en: 'Episiotomy', ckb: 'بڕینی پەرینە', ar: 'بضع الفرج' },
  'not-applicable': { en: 'Not applicable', ckb: 'پێویست نییە', ar: 'لا ينطبق' },
};

export const MIDWIFE_LIST = MIDWIVES;
