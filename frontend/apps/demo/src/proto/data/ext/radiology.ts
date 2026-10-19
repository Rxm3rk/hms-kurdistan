/**
 * Radiology information system: requests, protocols, modality rooms and today's schedule, report templates
 * and critical findings. SYNTHETIC DATA ONLY, NOT FOR CLINICAL USE. Report text is written in English, as
 * radiologists in the Kurdistan Region usually report.
 */
import { daysAgoAt, todayAt } from '../clock.ts';
import type { OrderPriority, Text3 } from '../types.ts';

const T = (en: string, ckb: string, ar: string): Text3 => ({ en, ckb, ar });

export type Modality = 'XR' | 'CT' | 'MR' | 'US';
export type RadStatus = 'requested' | 'protocolled' | 'scheduled' | 'arrived' | 'in-progress' | 'completed' | 'reported' | 'verified';

export interface RadRoom {
  readonly id: string;
  readonly modality: Modality;
  /** Equipment, Latin. */
  readonly equipment: string;
  readonly name: Text3;
}

export const RAD_ROOMS: readonly RadRoom[] = [
  { id: 'XR-1', modality: 'XR', equipment: 'Siemens Ysio Max (DR)', name: T('X-ray room 1', 'ژووری تیشکی 1', 'غرفة الأشعة 1') },
  { id: 'XR-P', modality: 'XR', equipment: 'Fujifilm FDR Go (portable)', name: T('Portable X-ray', 'تیشکی گوازراوە', 'أشعة متنقلة') },
  { id: 'CT-1', modality: 'CT', equipment: 'Siemens SOMATOM go.Up 32', name: T('CT scanner', 'سکانەری CT', 'جهاز المفراس') },
  { id: 'MR-1', modality: 'MR', equipment: 'GE SIGNA Explorer 1.5T', name: T('MRI 1.5 T', 'MRI 1.5 T', 'رنين 1.5 تسلا') },
  { id: 'US-1', modality: 'US', equipment: 'Mindray Resona 7', name: T('Ultrasound room 1', 'ژووری سۆنار 1', 'غرفة السونار 1') },
  { id: 'US-2', modality: 'US', equipment: 'GE LOGIQ E10', name: T('Ultrasound room 2', 'ژووری سۆنار 2', 'غرفة السونار 2') },
];

export interface RadExam {
  readonly code: string;
  readonly modality: Modality;
  readonly name: Text3;
  readonly durationMin: number;
  /** Protocol options for this exam, Latin. */
  readonly protocols: readonly string[];
  readonly templateId: string;
}

export const RAD_EXAMS: readonly RadExam[] = [
  { code: 'XR-CHEST-PA', modality: 'XR', name: T('Chest X-ray PA', 'تیشکی سنگ PA', 'أشعة صدر PA'), durationMin: 10, protocols: ['PA erect', 'AP supine (portable)', 'PA + lateral'], templateId: 'TPL-CXR' },
  { code: 'XR-KNEE', modality: 'XR', name: T('Knee X-ray, 2 views', 'تیشکی ئەژنۆ، 2 دیمەن', 'أشعة ركبة، وضعيتان'), durationMin: 10, protocols: ['AP + lateral', 'Standing AP + lateral + skyline'], templateId: 'TPL-GEN' },
  { code: 'XR-ABD', modality: 'XR', name: T('Abdominal X-ray', 'تیشکی سک', 'أشعة بطن'), durationMin: 10, protocols: ['AP supine', 'AP supine + erect chest'], templateId: 'TPL-GEN' },
  { code: 'CT-HEAD', modality: 'CT', name: T('CT head', 'CTی سەر', 'مفراس الرأس'), durationMin: 15, protocols: ['Non-contrast, stroke protocol', 'Non-contrast, trauma', 'Pre and post contrast'], templateId: 'TPL-CTH' },
  { code: 'CT-CTPA', modality: 'CT', name: T('CT pulmonary angiogram', 'CTی خوێنبەرەکانی سی', 'تصوير الشريان الرئوي بالمفراس'), durationMin: 20, protocols: ['CTPA, bolus tracking, 60 mL contrast', 'CTPA, low-dose, 40 mL contrast'], templateId: 'TPL-CTPA' },
  { code: 'CT-ABD', modality: 'CT', name: T('CT abdomen and pelvis', 'CTی سک و حەوز', 'مفراس البطن والحوض'), durationMin: 20, protocols: ['Portal venous phase, oral + IV contrast', 'Non-contrast (renal colic)', 'Triple phase liver'], templateId: 'TPL-GEN' },
  { code: 'MR-LSPINE', modality: 'MR', name: T('MRI lumbar spine', 'MRIی بڕبڕەی پشت', 'رنين الفقرات القطنية'), durationMin: 30, protocols: ['Routine non-contrast', 'With gadolinium (post-operative)'], templateId: 'TPL-MRLS' },
  { code: 'MR-BRAIN', modality: 'MR', name: T('MRI brain', 'MRIی مێشک', 'رنين الدماغ'), durationMin: 35, protocols: ['Routine + DWI', 'Stroke protocol (DWI, FLAIR, SWI)', 'With gadolinium'], templateId: 'TPL-GEN' },
  { code: 'US-ABD', modality: 'US', name: T('Ultrasound abdomen', 'سۆناری سک', 'سونار البطن'), durationMin: 20, protocols: ['Full abdomen, fasting', 'Right upper quadrant'], templateId: 'TPL-USA' },
  { code: 'US-OB', modality: 'US', name: T('Obstetric ultrasound', 'سۆناری دووگیانی', 'سونار الحمل'), durationMin: 25, protocols: ['First trimester dating', 'Anomaly scan 20 weeks', 'Growth and Doppler'], templateId: 'TPL-GEN' },
  { code: 'US-DVT', modality: 'US', name: T('Venous Doppler, lower limb', 'دۆپلەری دەماری قاچ', 'دوبلر أوردة الطرف السفلي'), durationMin: 20, protocols: ['Compression + colour Doppler, unilateral', 'Bilateral'], templateId: 'TPL-GEN' },
];

export function findExam(code: string): RadExam | undefined {
  return RAD_EXAMS.find((exam) => exam.code === code);
}

export interface RadRequest {
  /** Accession number, `SYN-RAD-…`. */
  readonly id: string;
  readonly patientId: string;
  readonly examCode: string;
  readonly priority: OrderPriority;
  readonly status: RadStatus;
  readonly requestedById: string;
  readonly requestedIso: string;
  readonly indication: Text3;
  readonly contrast: boolean;
  readonly protocol: string | null;
  readonly roomId: string | null;
  readonly scheduledIso: string | null;
  readonly report: string | null;
  readonly reportedById: string | null;
  readonly critical: boolean;
  /** The patient may be pregnant: a check before ionising radiation. */
  readonly pregnancyCheck: 'not-applicable' | 'negative' | 'to-confirm';
}

function rq(
  id: string,
  patientId: string,
  examCode: string,
  priority: OrderPriority,
  status: RadStatus,
  requestedById: string,
  requestedIso: string,
  indication: Text3,
  extra: Partial<Omit<RadRequest, 'id' | 'patientId' | 'examCode' | 'priority' | 'status' | 'requestedById' | 'requestedIso' | 'indication'>> = {},
): RadRequest {
  return {
    id,
    patientId,
    examCode,
    priority,
    status,
    requestedById,
    requestedIso,
    indication,
    contrast: extra.contrast ?? false,
    protocol: extra.protocol ?? null,
    roomId: extra.roomId ?? null,
    scheduledIso: extra.scheduledIso ?? null,
    report: extra.report ?? null,
    reportedById: extra.reportedById ?? null,
    critical: extra.critical ?? false,
    pregnancyCheck: extra.pregnancyCheck ?? 'not-applicable',
  };
}

const RAD = 'SYN-STF-013';

export const RAD_REQUESTS: readonly RadRequest[] = [
  rq('SYN-RAD-26-4101', 'SYN-PAT-0110', 'CT-HEAD', 'stat', 'in-progress', 'SYN-STF-016', todayAt('09:05'), T('Sudden left-sided weakness, onset 07:40; stroke pathway', 'لاوازیی لای چەپ لەناکاو، 07:40؛ ڕێڕەوی جەڵدە', 'ضعف مفاجئ في الجانب الأيسر منذ 07:40؛ مسار السكتة'), { protocol: 'Non-contrast, stroke protocol', roomId: 'CT-1', scheduledIso: todayAt('09:15') }),
  rq('SYN-RAD-26-4102', 'SYN-PAT-0112', 'XR-CHEST-PA', 'urgent', 'scheduled', 'SYN-STF-017', todayAt('08:50'), T('Chest pain, rule out pneumothorax', 'ئازاری سنگ، دڵنیابوون لە نەبوونی هەوای سنگ', 'ألم صدري، استبعاد استرواح الصدر'), { protocol: 'PA erect', roomId: 'XR-1', scheduledIso: todayAt('09:45') }),
  rq('SYN-RAD-26-4103', 'SYN-PAT-0105', 'CT-CTPA', 'urgent', 'requested', 'SYN-STF-005', todayAt('08:30'), T('Pleuritic pain, tachycardia, D-dimer raised', 'ئازاری پلیورایی، لێدانی خێرای دڵ، D-dimer بەرز', 'ألم جنبي، تسرع قلب، ارتفاع D-dimer'), { contrast: true, pregnancyCheck: 'not-applicable' }),
  rq('SYN-RAD-26-4104', 'SYN-PAT-0106', 'US-ABD', 'routine', 'protocolled', 'SYN-STF-008', daysAgoAt(1, '16:10'), T('Right upper quadrant pain, deranged LFTs', 'ئازاری چارەکی سەرەوەی ڕاست، LFT تێکچوو', 'ألم الربع العلوي الأيمن، اضطراب وظائف الكبد'), { protocol: 'Right upper quadrant' , pregnancyCheck: 'negative' }),
  rq('SYN-RAD-26-4105', 'SYN-PAT-0107', 'XR-ABD', 'urgent', 'completed', 'SYN-STF-008', todayAt('07:10'), T('Distension and vomiting after surgery; ileus?', 'هەڵئاوسان و ڕشانەوە دوای نەشتەرگەری؛ ئیلیەس؟', 'انتفاخ وتقيؤ بعد الجراحة؛ علوص؟'), { protocol: 'AP supine + erect chest', roomId: 'XR-P', scheduledIso: todayAt('07:40') }),
  rq('SYN-RAD-26-4106', 'SYN-PAT-0109', 'XR-CHEST-PA', 'routine', 'completed', 'SYN-STF-007', todayAt('05:30'), T('Daily ICU film; endotracheal tube position', 'وێنەی ڕۆژانەی ICU؛ شوێنی بۆری هەناسە', 'صورة يومية للعناية؛ موضع الأنبوب الرغامي'), { protocol: 'AP supine (portable)', roomId: 'XR-P', scheduledIso: todayAt('06:00') }),
  rq('SYN-RAD-26-4107', 'SYN-PAT-0101', 'XR-CHEST-PA', 'routine', 'reported', 'SYN-STF-005', daysAgoAt(1, '10:00'), T('Community-acquired pneumonia, follow-up', 'هەوکردنی سی، بەدواداچوون', 'ذات الرئة المكتسبة، متابعة'), {
    protocol: 'PA erect',
    roomId: 'XR-1',
    scheduledIso: daysAgoAt(1, '11:20'),
    report: 'Right lower zone consolidation, slightly improved compared with the film of 15/10. No pleural effusion. Heart size normal.\n\nIMPRESSION: Resolving right lower lobe pneumonia.',
    reportedById: RAD,
  }),
  rq('SYN-RAD-26-4108', 'SYN-PAT-0233', 'US-ABD', 'routine', 'arrived', 'SYN-STF-020', daysAgoAt(2, '12:15'), T('Raised ALT, fatty liver?', 'ALT بەرز، جگەری چەور؟', 'ارتفاع ALT، كبد دهني؟'), { protocol: 'Full abdomen, fasting', roomId: 'US-1', scheduledIso: todayAt('09:30') }),
  rq('SYN-RAD-26-4109', 'SYN-PAT-0234', 'MR-LSPINE', 'routine', 'scheduled', 'SYN-STF-005', daysAgoAt(5, '11:40'), T('Low back pain with left L5 radiculopathy, 8 weeks', 'ئازاری خوارەوەی پشت لەگەڵ ڕادیکیولۆپاتیی L5ی چەپ، 8 هەفتە', 'ألم أسفل الظهر مع اعتلال جذر L5 الأيسر، 8 أسابيع'), { protocol: 'Routine non-contrast', roomId: 'MR-1', scheduledIso: todayAt('11:00') }),
  rq('SYN-RAD-26-4110', 'SYN-PAT-0235', 'US-OB', 'routine', 'scheduled', 'SYN-STF-020', daysAgoAt(7, '09:00'), T('Booking scan, 12 weeks by dates', 'سۆناری تۆمارکردن، 12 هەفتە', 'سونار التسجيل، 12 أسبوعاً'), { protocol: 'First trimester dating', roomId: 'US-2', scheduledIso: todayAt('10:15') }),
  rq('SYN-RAD-26-4111', 'SYN-PAT-0108', 'MR-BRAIN', 'urgent', 'requested', 'SYN-STF-016', todayAt('08:05'), T('New seizure; known renal impairment', 'فێی نوێ؛ کەمیی کاری گورچیلە', 'نوبة صرع جديدة؛ قصور كلوي معروف'), { contrast: false }),
  rq('SYN-RAD-26-4112', 'SYN-PAT-0213', 'CT-ABD', 'urgent', 'protocolled', 'SYN-STF-008', todayAt('07:55'), T('Post-operative fever day 4, collection?', 'تا لە ڕۆژی 4ی دوای نەشتەرگەری، کۆبوونەوەی شلە؟', 'حمى بعد الجراحة اليوم الرابع، تجمع؟'), { contrast: true, protocol: 'Portal venous phase, oral + IV contrast' }),
  rq('SYN-RAD-26-4113', 'SYN-PAT-0228', 'US-DVT', 'urgent', 'requested', 'SYN-STF-007', todayAt('09:10'), T('Swollen left calf, ICU day 6', 'پووکی چەپی ئاوساو، ڕۆژی 6ی ICU', 'تورم ربلة الساق اليسرى، اليوم السادس في العناية'), {}),
  rq('SYN-RAD-26-4114', 'SYN-PAT-0216', 'XR-KNEE', 'routine', 'requested', 'SYN-STF-008', todayAt('08:40'), T('Fall on the ward, right knee pain', 'کەوتن لە قاوش، ئازاری ئەژنۆی ڕاست', 'سقوط في الردهة، ألم الركبة اليمنى'), {}),
  rq('SYN-RAD-26-4115', 'SYN-PAT-0236', 'CT-HEAD', 'routine', 'verified', 'SYN-STF-016', daysAgoAt(1, '18:20'), T('Headache and vomiting', 'سەرئێشە و ڕشانەوە', 'صداع وتقيؤ'), {
    protocol: 'Non-contrast, trauma',
    roomId: 'CT-1',
    scheduledIso: daysAgoAt(1, '19:00'),
    report: 'No intracranial haemorrhage, mass effect or midline shift. Grey-white differentiation preserved. Ventricles normal for age.\n\nIMPRESSION: Normal non-contrast CT head.',
    reportedById: RAD,
  }),
  rq('SYN-RAD-26-4116', 'SYN-PAT-0229', 'CT-CTPA', 'stat', 'reported', 'SYN-STF-007', daysAgoAt(0, '02:20'), T('Sudden hypoxia, ventilated', 'کەمبوونەوەی ئۆکسجینی لەناکاو، لەسەر هەناسەدەر', 'نقص أكسجة مفاجئ، على جهاز التنفس'), {
    contrast: true,
    protocol: 'CTPA, bolus tracking, 60 mL contrast',
    roomId: 'CT-1',
    scheduledIso: todayAt('02:45'),
    report: 'Filling defects in the right main and left lower lobe pulmonary arteries. RV/LV ratio 1.2 with straightening of the septum.\n\nIMPRESSION: Bilateral pulmonary emboli with CT signs of right heart strain.',
    reportedById: RAD,
    critical: true,
  }),
  rq('SYN-RAD-26-4117', 'SYN-PAT-0237', 'US-ABD', 'routine', 'completed', 'SYN-STF-005', daysAgoAt(1, '13:00'), T('Recurrent epigastric pain', 'ئازاری دووبارەی سەرەوەی گەدە', 'ألم شرسوفي متكرر'), { protocol: 'Full abdomen, fasting', roomId: 'US-1', scheduledIso: todayAt('08:30'), pregnancyCheck: 'negative' }),
  rq('SYN-RAD-26-4118', 'SYN-PAT-0102', 'XR-CHEST-PA', 'routine', 'scheduled', 'SYN-STF-005', todayAt('08:10'), T('Heart failure, fluid status', 'سستیی دڵ، دۆخی شلە', 'قصور القلب، حالة السوائل'), { protocol: 'AP supine (portable)', roomId: 'XR-P', scheduledIso: todayAt('10:30') }),
  rq('SYN-RAD-26-4119', 'SYN-PAT-0240', 'MR-BRAIN', 'routine', 'scheduled', 'SYN-STF-016', daysAgoAt(4, '15:00'), T('Chronic headache, red flags absent', 'سەرئێشەی درێژخایەن، بێ نیشانەی مەترسی', 'صداع مزمن، بلا علامات إنذار'), { protocol: 'Routine + DWI', roomId: 'MR-1', scheduledIso: todayAt('12:00'), pregnancyCheck: 'to-confirm' }),
  rq('SYN-RAD-26-4120', 'SYN-PAT-0221', 'US-ABD', 'urgent', 'scheduled', 'SYN-STF-006', todayAt('08:20'), T('Child with right iliac fossa pain; appendicitis?', 'منداڵ بە ئازاری لای ڕاستی خوارەوەی سک؛ ئاپێندیسایتس؟', 'طفل بألم الحفرة الحرقفية اليمنى؛ التهاب الزائدة؟'), { protocol: 'Full abdomen, fasting', roomId: 'US-2', scheduledIso: todayAt('09:50') }),
];

// ---------------------------------------------------------------------------------------------------------
// Report templates
// ---------------------------------------------------------------------------------------------------------

export interface ReportTemplate {
  readonly id: string;
  readonly name: Text3;
  /** English report body with blanks to complete. */
  readonly body: string;
}

export const REPORT_TEMPLATES: readonly ReportTemplate[] = [
  {
    id: 'TPL-CXR',
    name: T('Chest X-ray, normal', 'تیشکی سنگ، ئاسایی', 'أشعة صدر، طبيعية'),
    body: 'Lungs are clear. No focal consolidation, pleural effusion or pneumothorax. Cardiomediastinal contour within normal limits. Bones unremarkable.\n\nIMPRESSION: No acute cardiopulmonary abnormality.',
  },
  {
    id: 'TPL-CTH',
    name: T('CT head, non-contrast', 'CTی سەر، بێ کۆنتراست', 'مفراس رأس، بلا تباين'),
    body: 'No acute intracranial haemorrhage. No established territorial infarct. No mass effect or midline shift. Ventricles and sulci appropriate for age. Visualised paranasal sinuses clear.\n\nIMPRESSION: ',
  },
  {
    id: 'TPL-CTPA',
    name: T('CT pulmonary angiogram', 'CTی خوێنبەرەکانی سی', 'تصوير الشريان الرئوي'),
    body: 'Contrast opacification of the pulmonary arteries is adequate. No filling defect to the subsegmental level. RV/LV ratio < 1. Lungs: \nPleura: \n\nIMPRESSION: No pulmonary embolism.',
  },
  {
    id: 'TPL-MRLS',
    name: T('MRI lumbar spine', 'MRIی بڕبڕەی پشت', 'رنين الفقرات القطنية'),
    body: 'Alignment normal. Vertebral body heights preserved. Conus ends at L1.\nL3/4: \nL4/5: \nL5/S1: \n\nIMPRESSION: ',
  },
  {
    id: 'TPL-USA',
    name: T('Ultrasound abdomen', 'سۆناری سک', 'سونار البطن'),
    body: 'Liver: normal size and echotexture. Gallbladder: no calculi, wall not thickened. CBD: mm. Pancreas: partly obscured by bowel gas. Spleen: cm. Kidneys: right cm, left cm, no hydronephrosis.\n\nIMPRESSION: ',
  },
  {
    id: 'TPL-GEN',
    name: T('General (free text)', 'گشتی (دەقی ئازاد)', 'عام (نص حر)'),
    body: 'TECHNIQUE: \nFINDINGS: \n\nIMPRESSION: ',
  },
];

/** Room schedule hours shown on the board. */
export const SCHEDULE_HOURS: readonly string[] = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00'];

/** Report turnaround (requested to verified), hours, last 7 days per modality. */
export const REPORT_TAT_HOURS: Readonly<Record<Modality, number>> = { XR: 3.2, CT: 1.4, MR: 18.5, US: 2.1 };
