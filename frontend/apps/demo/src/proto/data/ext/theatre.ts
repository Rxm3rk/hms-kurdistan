/**
 * Operating theatres: rooms, the procedure / implant / consumable catalogues with synthetic tariffs, and the
 * theatre lists for today and the coming working days (Friday is the weekend), with WHO surgical safety
 * checklist progress and intra-op records. SYNTHETIC DATA ONLY, NOT FOR CLINICAL USE.
 */
import { CENSUS_GROUPS, demoDate, getPatient } from '../index.ts';
import type { Patient, Text3, Tone } from '../types.ts';
import { extPatient } from './care-people.ts';

export interface TheatreRoom {
  readonly id: string;
  readonly name: Text3;
  readonly start: string;
  readonly end: string;
}

export const THEATRE_ROOMS: readonly TheatreRoom[] = [
  { id: 'OT-1', name: { en: 'Theatre 1 · General surgery', ckb: 'هۆڵی 1 · نەشتەرگەریی گشتی', ar: 'الصالة 1 · الجراحة العامة' }, start: '08:00', end: '16:00' },
  { id: 'OT-2', name: { en: 'Theatre 2 · Orthopaedics and gynaecology', ckb: 'هۆڵی 2 · ئێسک و ئافرەتان', ar: 'الصالة 2 · العظام والنسائية' }, start: '08:00', end: '16:00' },
  { id: 'OT-3', name: { en: 'Theatre 3 · Emergency and day cases', ckb: 'هۆڵی 3 · فریاکەوتن و نەشتەرگەریی ڕۆژانە', ar: 'الصالة 3 · الطوارئ وجراحات اليوم الواحد' }, start: '08:00', end: '20:00' },
];

export interface ProcedureDef {
  readonly id: string;
  readonly name: Text3;
  /** Latin procedure code (synthetic, CPT-like). */
  readonly code: string;
  readonly minutes: number;
  readonly theatreFeeIqd: number;
  readonly anaesthesiaFeeIqd: number;
  readonly sided: boolean;
}

export const PROCEDURES: readonly ProcedureDef[] = [
  { id: 'lap-chole', name: { en: 'Laparoscopic cholecystectomy', ckb: 'لابردنی زراو بە لاپارۆسکۆپ', ar: 'استئصال المرارة بالمنظار' }, code: 'SYN-47562', minutes: 75, theatreFeeIqd: 1_450_000, anaesthesiaFeeIqd: 350_000, sided: false },
  { id: 'hernia', name: { en: 'Inguinal hernia repair with mesh', ckb: 'چاککردنەوەی فەتقی ناوگەڵ بە تۆڕ', ar: 'إصلاح الفتق الأربي بالشبكة' }, code: 'SYN-49505', minutes: 60, theatreFeeIqd: 950_000, anaesthesiaFeeIqd: 250_000, sided: true },
  { id: 'appendix', name: { en: 'Laparoscopic appendicectomy', ckb: 'لابردنی ڕیخۆڵەکوێرە بە لاپارۆسکۆپ', ar: 'استئصال الزائدة بالمنظار' }, code: 'SYN-44970', minutes: 60, theatreFeeIqd: 1_100_000, anaesthesiaFeeIqd: 300_000, sided: false },
  { id: 'tkr', name: { en: 'Total knee replacement', ckb: 'گۆڕینی تەواوی ئەژنۆ', ar: 'استبدال مفصل الركبة الكامل' }, code: 'SYN-27447', minutes: 120, theatreFeeIqd: 2_600_000, anaesthesiaFeeIqd: 450_000, sided: true },
  { id: 'orif', name: { en: 'ORIF distal radius fracture', ckb: 'چاککردنەوەی کراوەی شکانی سەری ئێسکی ڕادیەس', ar: 'رد مفتوح وتثبيت داخلي لكسر الكعبرة البعيد' }, code: 'SYN-25607', minutes: 90, theatreFeeIqd: 1_350_000, anaesthesiaFeeIqd: 300_000, sided: true },
  { id: 'csection', name: { en: 'Caesarean section (lower segment)', ckb: 'نەشتەرگەریی قەیسەری', ar: 'ولادة قيصرية (المقطع السفلي)' }, code: 'SYN-59510', minutes: 60, theatreFeeIqd: 1_200_000, anaesthesiaFeeIqd: 300_000, sided: false },
  { id: 'hyst', name: { en: 'Total abdominal hysterectomy', ckb: 'لابردنی منداڵدان لە ڕێگەی سک', ar: 'استئصال الرحم البطني الكامل' }, code: 'SYN-58150', minutes: 120, theatreFeeIqd: 1_900_000, anaesthesiaFeeIqd: 400_000, sided: false },
  { id: 'thyroid', name: { en: 'Total thyroidectomy', ckb: 'لابردنی تەواوی ڕژێنی دەرەقی', ar: 'استئصال الغدة الدرقية الكامل' }, code: 'SYN-60240', minutes: 120, theatreFeeIqd: 1_800_000, anaesthesiaFeeIqd: 400_000, sided: false },
  { id: 'tonsil', name: { en: 'Tonsillectomy', ckb: 'لابردنی لەوزە', ar: 'استئصال اللوزتين' }, code: 'SYN-42826', minutes: 45, theatreFeeIqd: 650_000, anaesthesiaFeeIqd: 200_000, sided: false },
  { id: 'debride', name: { en: 'Wound debridement', ckb: 'پاککردنەوەی برین', ar: 'تنضير الجرح' }, code: 'SYN-11042', minutes: 30, theatreFeeIqd: 450_000, anaesthesiaFeeIqd: 150_000, sided: false },
  { id: 'laparotomy', name: { en: 'Emergency laparotomy', ckb: 'کردنەوەی سکی فریاکەوتن', ar: 'فتح البطن الإسعافي' }, code: 'SYN-49000', minutes: 150, theatreFeeIqd: 2_200_000, anaesthesiaFeeIqd: 500_000, sided: false },
  { id: 'cysto', name: { en: 'Ureteroscopy and stone removal', ckb: 'ئاوێنەی بۆری میز و لابردنی بەرد', ar: 'تنظير الحالب واستخراج الحصاة' }, code: 'SYN-52352', minutes: 60, theatreFeeIqd: 1_050_000, anaesthesiaFeeIqd: 250_000, sided: true },
];

export function procedureOf(id: string): ProcedureDef {
  return PROCEDURES.find((p) => p.id === id) ?? PROCEDURES[0]!;
}

export interface ImplantDef {
  readonly id: string;
  /** Item names stay in Latin script, as printed on the box. */
  readonly name: string;
  readonly manufacturer: string;
  readonly priceIqd: number;
}

export const IMPLANTS: readonly ImplantDef[] = [
  { id: 'mesh', name: 'Polypropylene mesh 15 × 15 cm', manufacturer: 'Synthmed', priceIqd: 185_000 },
  { id: 'knee-fem', name: 'Femoral component, cemented, size 5', manufacturer: 'OrthoSyn', priceIqd: 1_650_000 },
  { id: 'knee-tib', name: 'Tibial tray, cemented, size 4', manufacturer: 'OrthoSyn', priceIqd: 1_250_000 },
  { id: 'knee-ins', name: 'Polyethylene insert 10 mm', manufacturer: 'OrthoSyn', priceIqd: 540_000 },
  { id: 'plate', name: 'Volar locking plate, 3-hole', manufacturer: 'FixaLab', priceIqd: 690_000 },
  { id: 'screw', name: 'Locking screw 2.4 mm × 18 mm', manufacturer: 'FixaLab', priceIqd: 72_000 },
  { id: 'clip', name: 'Titanium ligation clips (cartridge of 6)', manufacturer: 'Synthmed', priceIqd: 95_000 },
  { id: 'stent', name: 'Double-J ureteric stent 6 Fr × 26 cm', manufacturer: 'UroSyn', priceIqd: 160_000 },
  { id: 'cement', name: 'Bone cement with gentamicin 40 g', manufacturer: 'OrthoSyn', priceIqd: 210_000 },
];

export interface ConsumableDef {
  readonly id: string;
  readonly name: string;
  readonly unitPriceIqd: number;
}

export const CONSUMABLES: readonly ConsumableDef[] = [
  { id: 'trocar', name: 'Disposable trocar 12 mm', unitPriceIqd: 85_000 },
  { id: 'suture-vicryl', name: 'Vicryl 2-0 suture', unitPriceIqd: 14_000 },
  { id: 'suture-prolene', name: 'Prolene 3-0 suture', unitPriceIqd: 16_000 },
  { id: 'drape', name: 'Sterile drape pack', unitPriceIqd: 45_000 },
  { id: 'gown', name: 'Sterile surgical gown', unitPriceIqd: 12_000 },
  { id: 'diathermy', name: 'Diathermy pencil', unitPriceIqd: 22_000 },
  { id: 'gauze', name: 'Abdominal swabs (pack of 5)', unitPriceIqd: 9_000 },
  { id: 'drain', name: 'Redivac drain 14 Fr', unitPriceIqd: 28_000 },
  { id: 'catheter', name: 'Foley catheter 16 Fr', unitPriceIqd: 8_000 },
  { id: 'stapler', name: 'Skin stapler 35 W', unitPriceIqd: 65_000 },
];

export type CaseStatus = 'scheduled' | 'sent-for' | 'anaesthesia' | 'surgery' | 'recovery' | 'completed' | 'postponed';
export type CasePriority = 'elective' | 'urgent' | 'emergency';
export type AnaesthesiaType = 'general' | 'spinal' | 'regional' | 'local-sedation';
export type Side = 'left' | 'right' | 'none';

export interface ChecklistPhase {
  /** Item id to ticked. */
  readonly items: Readonly<Record<string, boolean>>;
  readonly confirmedTime: string | null;
  readonly confirmedById: string | null;
}

export interface UsedImplant {
  readonly implantId: string;
  readonly lot: string;
  readonly serial: string;
  readonly qty: number;
}

export interface UsedConsumable {
  readonly consumableId: string;
  readonly qty: number;
}

export interface TheatreCase {
  readonly id: string;
  readonly patient: Patient;
  readonly roomId: string;
  readonly date: string;
  readonly start: string;
  readonly procedureId: string;
  readonly side: Side;
  readonly surgeon: string;
  readonly anaesthetist: string;
  readonly anaesthesia: AnaesthesiaType;
  readonly priority: CasePriority;
  readonly status: CaseStatus;
  readonly signIn: ChecklistPhase;
  readonly timeOut: ChecklistPhase;
  readonly signOut: ChecklistPhase;
  /** Intra-op times, `HH:mm`. */
  readonly times: Readonly<Partial<Record<'anaesthesiaStart' | 'knifeToSkin' | 'closure' | 'outOfTheatre', string>>>;
  readonly implants: readonly UsedImplant[];
  readonly consumables: readonly UsedConsumable[];
  readonly chargesPosted: boolean;
  readonly note: Text3 | null;
}

export const SIGN_IN_ITEMS = ['identity', 'site-marked', 'machine-check', 'oximeter', 'allergy', 'airway', 'blood-loss'] as const;
export const TIME_OUT_ITEMS = ['introduced', 'confirm-patient', 'antibiotic', 'surgeon-events', 'anaesthesia-events', 'nursing-events', 'imaging'] as const;
export const SIGN_OUT_ITEMS = ['procedure-recorded', 'counts', 'specimen', 'equipment', 'recovery-concerns'] as const;

export const CHECKLIST_TEXT: Readonly<Record<string, Text3>> = {
  identity: { en: 'Patient has confirmed identity, site, procedure and consent', ckb: 'نەخۆش ناسنامە، شوێن، نەشتەرگەری و ڕەزامەندیی پشتڕاست کردووەتەوە', ar: 'أكد المريض هويته والموضع والإجراء والموافقة' },
  'site-marked': { en: 'Site marked (or not applicable)', ckb: 'شوێنەکە نیشانکراوە (یان پێویست نییە)', ar: 'تم تعليم الموضع (أو لا ينطبق)' },
  'machine-check': { en: 'Anaesthesia machine and medication check complete', ckb: 'پشکنینی ئامێری بێهۆشکردن و دەرمانەکان تەواوە', ar: 'اكتمل فحص جهاز التخدير والأدوية' },
  oximeter: { en: 'Pulse oximeter on the patient and working', ckb: 'ئامێری ئۆکسیمیتەر لەسەر نەخۆشە و کار دەکات', ar: 'مقياس التأكسج على المريض ويعمل' },
  allergy: { en: 'Known allergy checked', ckb: 'هەستیاریی ناسراو پشکنرا', ar: 'تم التحقق من الحساسية المعروفة' },
  airway: { en: 'Difficult airway or aspiration risk assessed; equipment available', ckb: 'مەترسیی ڕێگای هەوای قورس یان هەڵمژین هەڵسەنگێنرا؛ ئامێر بەردەستە', ar: 'تم تقييم صعوبة مجرى الهواء أو خطر الشفط؛ المعدات متوفرة' },
  'blood-loss': { en: 'Risk of more than 500 mL blood loss assessed; blood available if needed', ckb: 'مەترسیی لەدەستدانی زیاتر لە 500 mL خوێن هەڵسەنگێنرا؛ خوێن ئامادەیە', ar: 'تم تقييم خطر فقدان أكثر من 500 مل من الدم؛ الدم متوفر عند الحاجة' },
  introduced: { en: 'All team members introduced by name and role', ckb: 'هەموو ئەندامانی تیم بە ناو و ڕۆڵ ناسێنران', ar: 'عرّف جميع أعضاء الفريق بأسمائهم وأدوارهم' },
  'confirm-patient': { en: 'Patient name, procedure and incision site confirmed', ckb: 'ناوی نەخۆش، نەشتەرگەری و شوێنی بڕین پشتڕاستکرانەوە', ar: 'تم تأكيد اسم المريض والإجراء وموضع الشق' },
  antibiotic: { en: 'Antibiotic prophylaxis given within the last 60 minutes', ckb: 'دژەبەکتریای پێشوەختە لە 60 خولەکی ڕابردوودا درا', ar: 'أُعطي المضاد الحيوي الوقائي خلال آخر 60 دقيقة' },
  'surgeon-events': { en: 'Surgeon: critical steps, duration, expected blood loss', ckb: 'نەشتەرگەر: هەنگاوە گرنگەکان، ماوە، خوێنی چاوەڕوانکراو', ar: 'الجرّاح: الخطوات الحرجة، المدة، فقدان الدم المتوقع' },
  'anaesthesia-events': { en: 'Anaesthetist: patient-specific concerns', ckb: 'بێهۆشکەر: نیگەرانییە تایبەتەکانی نەخۆش', ar: 'طبيب التخدير: مخاوف خاصة بالمريض' },
  'nursing-events': { en: 'Nursing: sterility confirmed, equipment issues', ckb: 'پەرستاری: پاکژی پشتڕاستکرایەوە، کێشەی ئامێر', ar: 'التمريض: تأكيد التعقيم ومشاكل المعدات' },
  imaging: { en: 'Essential imaging displayed', ckb: 'وێنە پێویستەکان پیشان دراون', ar: 'الصور الأساسية معروضة' },
  'procedure-recorded': { en: 'Name of the procedure recorded', ckb: 'ناوی نەشتەرگەرییەکە تۆمارکرا', ar: 'تم تسجيل اسم الإجراء' },
  counts: { en: 'Instrument, swab and needle counts complete', ckb: 'ژماردنی ئامراز، لۆکە و دەرزی تەواوە', ar: 'اكتمل عدّ الأدوات والشاش والإبر' },
  specimen: { en: 'Specimen labelled (patient name read aloud)', ckb: 'نموونە نیشانەکرا (ناوی نەخۆش بە دەنگی بەرز خوێندرایەوە)', ar: 'تم تعليم العينة (قُرئ اسم المريض بصوت عالٍ)' },
  equipment: { en: 'Equipment problems to be addressed', ckb: 'کێشەکانی ئامێر کە دەبێت چارەسەر بکرێن', ar: 'مشاكل المعدات التي يجب معالجتها' },
  'recovery-concerns': { en: 'Key concerns for recovery reviewed by surgeon, anaesthetist and nurse', ckb: 'نیگەرانییە سەرەکییەکانی چاکبوونەوە لەلایەن نەشتەرگەر، بێهۆشکەر و پەرستار پێداچوونەوەی بۆ کرا', ar: 'راجع الجرّاح وطبيب التخدير والممرض المخاوف الرئيسية للإفاقة' },
};

export const STATUS_LABEL: Readonly<Record<CaseStatus, Text3>> = {
  scheduled: { en: 'Scheduled', ckb: 'خشتەکراو', ar: 'مجدول' },
  'sent-for': { en: 'Sent for', ckb: 'بانگکرا', ar: 'تم استدعاؤه' },
  anaesthesia: { en: 'In anaesthesia', ckb: 'لە بێهۆشکردندا', ar: 'قيد التخدير' },
  surgery: { en: 'In surgery', ckb: 'لە نەشتەرگەریدا', ar: 'قيد الجراحة' },
  recovery: { en: 'In recovery', ckb: 'لە ژووری چاکبوونەوە', ar: 'في الإفاقة' },
  completed: { en: 'Back to ward', ckb: 'گەڕایەوە قاوش', ar: 'عاد إلى الردهة' },
  postponed: { en: 'Postponed', ckb: 'دواخرا', ar: 'مؤجل' },
};

export const STATUS_TONE: Readonly<Record<CaseStatus, Tone>> = {
  scheduled: 'neutral',
  'sent-for': 'info',
  anaesthesia: 'accent',
  surgery: 'danger',
  recovery: 'warning',
  completed: 'success',
  postponed: 'neutral',
};

export const ANAESTHESIA_LABEL: Readonly<Record<AnaesthesiaType, Text3>> = {
  general: { en: 'General', ckb: 'گشتی', ar: 'عام' },
  spinal: { en: 'Spinal', ckb: 'بڕبڕەیی', ar: 'نخاعي' },
  regional: { en: 'Regional block', ckb: 'بلۆکی ناوچەیی', ar: 'إحصار موضعي' },
  'local-sedation': { en: 'Local with sedation', ckb: 'ناوچەیی لەگەڵ هێورکەرەوە', ar: 'موضعي مع تهدئة' },
};

export const PRIORITY_LABEL: Readonly<Record<CasePriority, Text3>> = {
  elective: { en: 'Elective', ckb: 'پلان بۆ دانراو', ar: 'اختياري' },
  urgent: { en: 'Urgent', ckb: 'بەپەلە', ar: 'عاجل' },
  emergency: { en: 'Emergency', ckb: 'فریاکەوتن', ar: 'طارئ' },
};

export const SIDE_LABEL: Readonly<Record<Side, Text3>> = {
  left: { en: 'Left', ckb: 'چەپ', ar: 'أيسر' },
  right: { en: 'Right', ckb: 'ڕاست', ar: 'أيمن' },
  none: { en: 'Not applicable', ckb: 'پێویست نییە', ar: 'لا ينطبق' },
};

/** Surgeons and anaesthetists, names already with the prefix. */
export const SURGEONS: readonly { readonly id: string; readonly name: Text3 }[] = [
  { id: 'saman', name: { en: 'Dr. Saman Rauf', ckb: 'د. سامان ڕەئووف', ar: 'د. سامان رؤوف' } },
  { id: 'dana', name: { en: 'Dr. Dana Mohammed', ckb: 'د. دانا محەمەد', ar: 'د. دانا محمد' } },
  { id: 'avesta', name: { en: 'Dr. Avesta Jalal', ckb: 'د. ئاڤێستا جەلال', ar: 'د. آفيستا جلال' } },
  { id: 'sana', name: { en: 'Dr. Sana Hawrami', ckb: 'د. سەنا هەورامی', ar: 'د. سنا هورامي' } },
  { id: 'bryar', name: { en: 'Dr. Bryar Nuri', ckb: 'د. بریار نووری', ar: 'د. بريار نوري' } },
];

export const ANAESTHETISTS: readonly { readonly id: string; readonly name: Text3 }[] = [
  { id: 'kosrat', name: { en: 'Dr. Kosrat Hama', ckb: 'د. کۆسرەت حەمە', ar: 'د. كوسرت حمه' } },
  { id: 'shadan', name: { en: 'Dr. Shadan Aziz', ckb: 'د. شادان عەزیز', ar: 'د. شادان عزيز' } },
  { id: 'farhad', name: { en: 'Dr. Farhad Sabir', ckb: 'د. فەرهاد سابیر', ar: 'د. فرهاد صابر' } },
];

export function personText(list: readonly { readonly id: string; readonly name: Text3 }[], id: string): Text3 {
  return list.find((p) => p.id === id)?.name ?? { en: id, ckb: id, ar: id };
}

function phase(items: readonly string[], done: boolean, time: string | null, by: string | null): ChecklistPhase {
  return { items: Object.fromEntries(items.map((item) => [item, done])), confirmedTime: done ? time : null, confirmedById: done ? by : null };
}

/** Working days shown: today and the next four (skipping Friday 23 October). */
export const THEATRE_DAYS: readonly string[] = [demoDate(0), demoDate(-1), demoDate(-2), demoDate(-3), demoDate(-5)];

const surgB = CENSUS_GROUPS['surg-b'];
const sp = (i: number): Patient => getPatient(surgB[i % surgB.length] ?? 'SYN-PAT-0106');
const xp = (n: number, sex: 'male' | 'female', age: number): Patient => extPatient(400 + n, { sex, age });

interface Seed {
  readonly room: string;
  readonly day: number;
  readonly start: string;
  readonly proc: string;
  readonly patient: Patient;
  readonly side?: Side;
  readonly surgeon: string;
  readonly anaesthetist: string;
  readonly anaesthesia: AnaesthesiaType;
  readonly priority?: CasePriority;
  readonly status?: CaseStatus;
}

const SEEDS: readonly Seed[] = [
  // Today, Theatre 1
  { room: 'OT-1', day: 0, start: '08:00', proc: 'lap-chole', patient: sp(0), surgeon: 'saman', anaesthetist: 'kosrat', anaesthesia: 'general', status: 'recovery' },
  { room: 'OT-1', day: 0, start: '09:30', proc: 'hernia', patient: getPatient('SYN-PAT-0107'), side: 'right', surgeon: 'saman', anaesthetist: 'kosrat', anaesthesia: 'spinal', status: 'anaesthesia' },
  { room: 'OT-1', day: 0, start: '10:45', proc: 'thyroid', patient: xp(1, 'female', 44), surgeon: 'bryar', anaesthetist: 'kosrat', anaesthesia: 'general', status: 'sent-for' },
  { room: 'OT-1', day: 0, start: '13:00', proc: 'lap-chole', patient: sp(2), surgeon: 'saman', anaesthetist: 'kosrat', anaesthesia: 'general' },
  { room: 'OT-1', day: 0, start: '14:30', proc: 'hernia', patient: xp(2, 'male', 58), side: 'left', surgeon: 'bryar', anaesthetist: 'kosrat', anaesthesia: 'spinal' },
  // Today, Theatre 2
  { room: 'OT-2', day: 0, start: '08:00', proc: 'tkr', patient: xp(3, 'female', 67), side: 'left', surgeon: 'dana', anaesthetist: 'shadan', anaesthesia: 'spinal', status: 'surgery' },
  { room: 'OT-2', day: 0, start: '10:30', proc: 'orif', patient: sp(3), side: 'right', surgeon: 'dana', anaesthetist: 'shadan', anaesthesia: 'regional' },
  { room: 'OT-2', day: 0, start: '12:15', proc: 'hyst', patient: xp(4, 'female', 49), surgeon: 'avesta', anaesthetist: 'shadan', anaesthesia: 'general' },
  { room: 'OT-2', day: 0, start: '14:30', proc: 'csection', patient: xp(5, 'female', 31), surgeon: 'avesta', anaesthetist: 'shadan', anaesthesia: 'spinal', priority: 'urgent' },
  // Today, Theatre 3
  { room: 'OT-3', day: 0, start: '07:10', proc: 'appendix', patient: xp(6, 'male', 22), surgeon: 'bryar', anaesthetist: 'farhad', anaesthesia: 'general', priority: 'emergency', status: 'completed' },
  { room: 'OT-3', day: 0, start: '08:40', proc: 'debride', patient: getPatient('SYN-PAT-0110'), surgeon: 'saman', anaesthetist: 'farhad', anaesthesia: 'local-sedation', priority: 'urgent', status: 'completed' },
  { room: 'OT-3', day: 0, start: '09:40', proc: 'cysto', patient: xp(7, 'male', 39), side: 'left', surgeon: 'bryar', anaesthetist: 'farhad', anaesthesia: 'spinal', status: 'sent-for' },
  { room: 'OT-3', day: 0, start: '11:00', proc: 'tonsil', patient: xp(8, 'female', 9), surgeon: 'sana', anaesthetist: 'farhad', anaesthesia: 'general' },
  { room: 'OT-3', day: 0, start: '12:00', proc: 'laparotomy', patient: xp(9, 'male', 63), surgeon: 'saman', anaesthetist: 'farhad', anaesthesia: 'general', priority: 'emergency' },
  { room: 'OT-3', day: 0, start: '15:00', proc: 'tonsil', patient: xp(10, 'male', 7), surgeon: 'sana', anaesthetist: 'farhad', anaesthesia: 'general', status: 'postponed' },
  // Coming days
  { room: 'OT-1', day: 1, start: '08:00', proc: 'lap-chole', patient: xp(11, 'female', 52), surgeon: 'saman', anaesthetist: 'kosrat', anaesthesia: 'general' },
  { room: 'OT-1', day: 1, start: '09:30', proc: 'thyroid', patient: xp(12, 'female', 38), surgeon: 'bryar', anaesthetist: 'kosrat', anaesthesia: 'general' },
  { room: 'OT-2', day: 1, start: '08:00', proc: 'tkr', patient: xp(13, 'male', 71), side: 'right', surgeon: 'dana', anaesthetist: 'shadan', anaesthesia: 'spinal' },
  { room: 'OT-2', day: 1, start: '10:30', proc: 'hyst', patient: xp(14, 'female', 46), surgeon: 'avesta', anaesthetist: 'shadan', anaesthesia: 'general' },
  { room: 'OT-3', day: 1, start: '09:00', proc: 'tonsil', patient: xp(10, 'male', 7), surgeon: 'sana', anaesthetist: 'farhad', anaesthesia: 'general' },
  { room: 'OT-1', day: 2, start: '08:00', proc: 'hernia', patient: xp(15, 'male', 45), side: 'right', surgeon: 'saman', anaesthetist: 'kosrat', anaesthesia: 'spinal' },
  { room: 'OT-2', day: 2, start: '08:00', proc: 'orif', patient: xp(16, 'female', 61), side: 'left', surgeon: 'dana', anaesthetist: 'shadan', anaesthesia: 'regional' },
  { room: 'OT-1', day: 3, start: '08:00', proc: 'lap-chole', patient: xp(17, 'female', 41), surgeon: 'bryar', anaesthetist: 'kosrat', anaesthesia: 'general' },
  { room: 'OT-2', day: 4, start: '08:00', proc: 'tkr', patient: xp(18, 'female', 66), side: 'right', surgeon: 'dana', anaesthetist: 'shadan', anaesthesia: 'spinal' },
];

function addMinutes(hhmm: string, minutes: number): string {
  const total = Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5)) + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

const DEFAULT_IMPLANTS: Readonly<Record<string, readonly UsedImplant[]>> = {
  'lap-chole': [{ implantId: 'clip', lot: 'SM-2609-114', serial: '', qty: 1 }],
  hernia: [{ implantId: 'mesh', lot: 'SM-2607-031', serial: 'PPM-55120', qty: 1 }],
  tkr: [
    { implantId: 'knee-fem', lot: 'OS-2605-882', serial: 'FEM5-20931', qty: 1 },
    { implantId: 'knee-tib', lot: 'OS-2605-871', serial: 'TIB4-11873', qty: 1 },
    { implantId: 'cement', lot: 'OS-2608-207', serial: '', qty: 2 },
  ],
};

const DEFAULT_CONSUMABLES: readonly UsedConsumable[] = [
  { consumableId: 'drape', qty: 1 },
  { consumableId: 'gown', qty: 4 },
  { consumableId: 'suture-vicryl', qty: 2 },
  { consumableId: 'diathermy', qty: 1 },
];

function build(): readonly TheatreCase[] {
  return SEEDS.map((seed, index) => {
    const status = seed.status ?? 'scheduled';
    const signedIn = ['anaesthesia', 'surgery', 'recovery', 'completed'].includes(status);
    const timedOut = ['surgery', 'recovery', 'completed'].includes(status);
    const signedOut = ['recovery', 'completed'].includes(status);
    const proc = procedureOf(seed.proc);
    const t = (m: number): string => addMinutes(seed.start, m);
    return {
      id: `SYN-OT-${String(2600 + index)}`,
      patient: seed.patient,
      roomId: seed.room,
      date: THEATRE_DAYS[seed.day] ?? THEATRE_DAYS[0]!,
      start: seed.start,
      procedureId: seed.proc,
      side: seed.side ?? 'none',
      surgeon: seed.surgeon,
      anaesthetist: seed.anaesthetist,
      anaesthesia: seed.anaesthesia,
      priority: seed.priority ?? 'elective',
      status,
      signIn: phase(SIGN_IN_ITEMS, signedIn, t(5), 'SYN-STF-019'),
      timeOut: phase(TIME_OUT_ITEMS, timedOut, t(20), 'SYN-STF-019'),
      signOut: phase(SIGN_OUT_ITEMS, signedOut, t(proc.minutes - 5), 'SYN-STF-019'),
      times: {
        ...(signedIn ? { anaesthesiaStart: t(8) } : {}),
        ...(timedOut ? { knifeToSkin: t(24) } : {}),
        ...(signedOut ? { closure: t(proc.minutes - 8), outOfTheatre: t(proc.minutes) } : {}),
      },
      implants: timedOut ? (DEFAULT_IMPLANTS[seed.proc] ?? []) : [],
      consumables: signedIn ? DEFAULT_CONSUMABLES : [],
      chargesPosted: status === 'completed',
      note: status === 'postponed' ? { en: 'Postponed: upper respiratory infection, rebooked for tomorrow', ckb: 'دواخرا: هەوکردنی ڕێگای هەناسەی سەرەوە، بۆ سبەی نۆرەی بۆ گیرا', ar: 'أُجّل: التهاب الجهاز التنفسي العلوي، أُعيد حجزه للغد' } : null,
    };
  });
}

export const THEATRE_CASES: readonly TheatreCase[] = build();

export function caseEnd(c: Pick<TheatreCase, 'start' | 'procedureId'>): string {
  return addMinutes(c.start, procedureOf(c.procedureId).minutes);
}

export function chargesOf(c: TheatreCase): { readonly theatreIqd: number; readonly anaesthesiaIqd: number; readonly implantsIqd: number; readonly consumablesIqd: number; readonly totalIqd: number } {
  const proc = procedureOf(c.procedureId);
  const implantsIqd = c.implants.reduce((sum, used) => sum + (IMPLANTS.find((i) => i.id === used.implantId)?.priceIqd ?? 0) * used.qty, 0);
  const consumablesIqd = c.consumables.reduce((sum, used) => sum + (CONSUMABLES.find((i) => i.id === used.consumableId)?.unitPriceIqd ?? 0) * used.qty, 0);
  return { theatreIqd: proc.theatreFeeIqd, anaesthesiaIqd: proc.anaesthesiaFeeIqd, implantsIqd, consumablesIqd, totalIqd: proc.theatreFeeIqd + proc.anaesthesiaFeeIqd + implantsIqd + consumablesIqd };
}
