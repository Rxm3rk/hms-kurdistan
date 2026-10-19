/**
 * Quality and patient safety: incident reports with their investigation and root-cause-analysis stage,
 * monthly incident counts, JCI (8th edition) chapter readiness, the KRG Ministry of Health licensing
 * checklist and the clinical hazard log. Every report, person and score is invented. SYNTHETIC DATA ONLY,
 * NOT FOR CLINICAL USE.
 */
import { daysAgoAt, demoDate } from '../clock.ts';
import type { Text3, WardId } from '../types.ts';
import { T, patientAt, staffAt } from './mi-common.ts';

export type IncidentCategory = 'fall' | 'medication' | 'infection' | 'pressure' | 'identification' | 'equipment' | 'specimen' | 'security' | 'needlestick' | 'communication';
export type Harm = 'near-miss' | 'none' | 'minor' | 'moderate' | 'severe' | 'sentinel';
export type IncidentStage = 'new' | 'triage' | 'investigation' | 'rca' | 'actions' | 'closed';
export const INCIDENT_STAGES: readonly IncidentStage[] = ['new', 'triage', 'investigation', 'rca', 'actions', 'closed'];

export interface IncidentAction {
  readonly id: string;
  readonly text: Text3;
  readonly ownerId: string;
  readonly due: string;
  readonly done: boolean;
}

export interface Incident {
  readonly id: string;
  readonly reportedIso: string;
  readonly category: IncidentCategory;
  readonly harm: Harm;
  readonly location: WardId | 'ed' | 'theatre' | 'lab' | 'pharmacy' | 'opd';
  readonly reporterId: string;
  readonly patientId: string | null;
  readonly stage: IncidentStage;
  readonly summary: Text3;
  readonly immediateAction: Text3;
  readonly handlerId: string;
  readonly anonymous: boolean;
  readonly actions: readonly IncidentAction[];
}

interface IncSeed {
  readonly days: number;
  readonly time: string;
  readonly category: IncidentCategory;
  readonly harm: Harm;
  readonly location: Incident['location'];
  readonly patient: number | null;
  readonly stage: IncidentStage;
  readonly summary: Text3;
  readonly immediate: Text3;
  readonly actions?: readonly [Text3, number, boolean][];
  readonly anonymous?: boolean;
}

const SEEDS: readonly IncSeed[] = [
  { days: 0, time: '07:10', category: 'fall', harm: 'minor', location: 'med-a', patient: 2, stage: 'new',
    summary: T('Patient found on the floor beside the bed at night; small laceration to the forehead.', 'نەخۆش لە شەودا لە تەنیشت جێگاکەی لەسەر زەوی دۆزرایەوە؛ برینێکی بچووک لە ناوچەوان.', 'وُجد المريض على الأرض بجانب السرير ليلاً؛ جرح صغير في الجبهة.'),
    immediate: T('Wound dressed, doctor reviewed, neuro observations started.', 'برینەکە پێچرا، پزیشک سەیری کرد، چاودێریی دەمار دەستی پێکرد.', 'ضُمد الجرح وراجعه الطبيب وبدأت المراقبة العصبية.') },
  { days: 0, time: '08:45', category: 'medication', harm: 'near-miss', location: 'icu', patient: 5, stage: 'triage',
    summary: T('Heparin infusion programmed at 10× the rate; caught at the independent double check.', 'ئینفیوژنی Heparin بە 10 هێندەی خێرایی دانرابوو؛ لە پشکنینی دووانەدا دۆزرایەوە.', 'بُرمج تسريب Heparin بعشرة أضعاف المعدل؛ اكتُشف أثناء التحقق المزدوج.'),
    immediate: T('Pump reprogrammed before the start; pharmacist informed.', 'پەمپەکە پێش دەستپێکردن ڕاست کرایەوە؛ دەرمانساز ئاگادار کرا.', 'أُعيدت برمجة المضخة قبل البدء؛ أُبلغ الصيدلي.') },
  { days: 1, time: '15:20', category: 'specimen', harm: 'none', location: 'ed', patient: 9, stage: 'investigation',
    summary: T('Blood sample labelled with another patient’s barcode; rejected by the laboratory.', 'نموونەی خوێن بە بارکۆدی نەخۆشێکی تر نیشانە کرابوو؛ تاقیگە ڕەتی کردەوە.', 'عُلّمت عينة دم بباركود مريض آخر؛ رفضها المختبر.'),
    immediate: T('Sample redrawn with two identifiers checked at the bedside.', 'نموونە دووبارە وەرگیرا لەگەڵ پشکنینی دوو ناسێنەر لە تەنیشت جێگا.', 'سُحبت العينة مجدداً مع التحقق من معرّفين بجانب السرير.'),
    actions: [[T('Re-train ED staff on bedside labelling', 'ڕاهێنانەوەی ستافی فریاکەوتن لەسەر نیشانەکردن لە تەنیشت جێگا', 'إعادة تدريب طاقم الطوارئ على التعليم بجانب السرير'), 10, false]] },
  { days: 2, time: '11:05', category: 'infection', harm: 'moderate', location: 'icu', patient: 7, stage: 'rca',
    summary: T('Central line bloodstream infection (CLABSI) on day 6 of the line.', 'هەوکردنی خوێن بەهۆی هێڵی ناوەندی (CLABSI) لە ڕۆژی 6ی هێڵەکە.', 'عدوى مجرى الدم المرتبطة بالقسطرة المركزية (CLABSI) في اليوم السادس.'),
    immediate: T('Line removed, cultures sent, antibiotics started.', 'هێڵەکە لابرا، چاندن نێردرا، دژەبەکتریا دەستی پێکرد.', 'أُزيلت القسطرة وأُرسلت المزارع وبدأت المضادات الحيوية.'),
    actions: [
      [T('Audit the central line insertion bundle for 4 weeks', 'وردبینیی کۆمەڵەی دانانی هێڵی ناوەندی بۆ 4 هەفتە', 'تدقيق حزمة إدخال القسطرة المركزية لمدة 4 أسابيع'), 14, false],
      [T('Daily line-necessity review on the ICU round', 'پێداچوونەوەی ڕۆژانەی پێویستیی هێڵ لە گەڕانی ICU', 'مراجعة يومية لضرورة القسطرة في جولة العناية'), 7, true],
    ] },
  { days: 3, time: '09:30', category: 'pressure', harm: 'minor', location: 'surg-b', patient: 11, stage: 'actions',
    summary: T('Stage 2 pressure injury on the sacrum found on day 4 after surgery.', 'برینی پەستانی پلە 2 لەسەر ساکرەم لە ڕۆژی 4ی دوای نەشتەرگەری دۆزرایەوە.', 'قرحة ضغط من الدرجة الثانية على العجز في اليوم الرابع بعد الجراحة.'),
    immediate: T('Pressure-relieving mattress, 2-hourly turns, tissue viability referral.', 'دۆشەکی سووککەرەوەی پەستان، گۆڕینی هەر 2 کاتژمێر، ڕەوانەکردن بۆ پسپۆڕی برین.', 'فراش مخفف للضغط، تقليب كل ساعتين، إحالة لأخصائي الجروح.'),
    actions: [[T('Braden score on admission for all surgical patients', 'نمرەی Braden لە کاتی خەواندن بۆ هەموو نەخۆشانی نەشتەرگەری', 'مقياس Braden عند الإدخال لكل مرضى الجراحة'), 5, true], [T('Order 6 more pressure-relieving mattresses', 'داواکردنی 6 دۆشەکی تر', 'طلب 6 فرشات إضافية'), 20, false]] },
  { days: 4, time: '22:40', category: 'security', harm: 'none', location: 'ed', patient: null, stage: 'closed', anonymous: true,
    summary: T('Verbal aggression towards a triage nurse by a relative.', 'توندوتیژیی زارەکی لەلایەن خزمێکەوە بەرامبەر پەرستاری پۆلێنکردن.', 'عدوان لفظي من أحد الأقارب على ممرضة الفرز.'),
    immediate: T('Security called; relative escorted out; staff debrief.', 'پاسەوان بانگ کرا؛ خزمەکە دەرکرا؛ دانیشتنی ستاف.', 'استُدعي الأمن؛ أُخرج القريب؛ جلسة مع الطاقم.') },
  { days: 5, time: '13:15', category: 'identification', harm: 'near-miss', location: 'theatre', patient: 13, stage: 'investigation',
    summary: T('Wrong-side marking noticed at the sign-in step of the surgical checklist.', 'نیشانەکردنی لای هەڵە لە هەنگاوی چوونەژوورەوەی لیستی پشکنینی نەشتەرگەری دۆزرایەوە.', 'لوحظ تعليم الجهة الخاطئة عند خطوة الدخول في قائمة التحقق الجراحية.'),
    immediate: T('Procedure paused; consent and imaging re-checked; correct side marked.', 'کردار وەستێنرا؛ ڕەزامەندی و وێنە دووبارە پشکنران؛ لای ڕاست نیشانە کرا.', 'أُوقف الإجراء؛ أُعيد فحص الموافقة والصور؛ عُلّمت الجهة الصحيحة.'),
    actions: [[T('Surgeon to mark the site with the patient awake, every case', 'نەشتەرگەر شوێنەکە نیشانە بکات کاتێک نەخۆش بە ئاگایە، هەموو جارێک', 'يعلّم الجراح الموضع والمريض مستيقظ في كل حالة'), 3, false]] },
  { days: 6, time: '10:50', category: 'equipment', harm: 'none', location: 'med-a', patient: null, stage: 'closed',
    summary: T('Defibrillator on the crash trolley failed its daily check (battery).', 'دیفیبریلەیتەری عەرەبانەی فریاکەوتن لە پشکنینی ڕۆژانەدا شکستی هێنا (پاتری).', 'فشل جهاز إزالة الرجفان في الفحص اليومي (البطارية).'),
    immediate: T('Replaced from ICU spare; biomedical engineering job raised.', 'لە یەدەگی ICU گۆڕدرا؛ کار بۆ ئەندازیاریی پزیشکی تۆمار کرا.', 'استُبدل من احتياطي العناية؛ فُتح طلب للهندسة الطبية.') },
  { days: 7, time: '04:20', category: 'medication', harm: 'minor', location: 'surg-b', patient: 15, stage: 'actions',
    summary: T('Second dose of Paracetamol 1 g given 2 h early; no harm, monitored.', 'دووەم دۆزی Paracetamol 1 g 2 کاتژمێر زووتر درا؛ هیچ زیانێک، چاودێری کرا.', 'أُعطيت الجرعة الثانية من Paracetamol 1 g قبل موعدها بساعتين؛ دون ضرر، مع المراقبة.'),
    immediate: T('Doctor informed; next dose re-timed on the eMAR.', 'پزیشک ئاگادار کرا؛ دۆزی داهاتوو لە eMAR کاتەکەی گۆڕا.', 'أُبلغ الطبيب؛ أُعيد توقيت الجرعة التالية في eMAR.'),
    actions: [[T('Show the last-given time on the eMAR dose button', 'نیشاندانی کاتی دوایین دۆز لەسەر دوگمەی eMAR', 'إظهار وقت آخر جرعة على زر eMAR'), 30, false]] },
  { days: 8, time: '16:30', category: 'needlestick', harm: 'minor', location: 'opd', patient: null, stage: 'closed',
    summary: T('Needlestick injury to a nurse while recapping a used needle.', 'برینی دەرزی بە پەرستارێک لە کاتی داپۆشینەوەی دەرزیی بەکارهاتوو.', 'وخز إبرة لممرضة أثناء إعادة تغطية إبرة مستعملة.'),
    immediate: T('First aid, occupational health review, baseline bloods taken.', 'یارمەتیی سەرەتایی، پێداچوونەوەی تەندروستیی پیشەیی، خوێنی بنەڕەت وەرگیرا.', 'إسعاف أولي، مراجعة الصحة المهنية، سُحبت فحوص الأساس.') },
  { days: 9, time: '12:00', category: 'communication', harm: 'moderate', location: 'paeds', patient: 3, stage: 'rca',
    summary: T('Critical potassium result not escalated for 3 h at handover.', 'ئەنجامی مەترسیداری پۆتاسیۆم بۆ 3 کاتژمێر لە کاتی گواستنەوەی ئەرکدا بەرز نەکرایەوە.', 'لم تُصعّد نتيجة بوتاسيوم حرجة لمدة 3 ساعات عند التسليم.'),
    immediate: T('Treated on discovery; family informed (duty of candour).', 'لە کاتی دۆزینەوە چارەسەر کرا؛ خێزان ئاگادار کرا.', 'عولج عند الاكتشاف؛ أُبلغت العائلة (واجب الإفصاح).'),
    actions: [[T('Critical results to page the doctor directly, not the ward phone', 'ئەنجامی مەترسیدار ڕاستەوخۆ بۆ پزیشک بنێردرێت نەک تەلەفۆنی قاوش', 'إرسال النتائج الحرجة مباشرة إلى الطبيب لا إلى هاتف الردهة'), 12, false], [T('SBAR handover tool on every ward', 'ئامرازی SBAR بۆ گواستنەوەی ئەرک لە هەموو قاوشێک', 'أداة SBAR للتسليم في كل ردهة'), 25, false]] },
  { days: 11, time: '19:45', category: 'fall', harm: 'none', location: 'surg-b', patient: 17, stage: 'closed',
    summary: T('Patient slipped in the bathroom, caught by the nurse; no injury.', 'نەخۆش لە گەرماو خلیسکا، پەرستار گرتی؛ برینی نەبوو.', 'انزلق المريض في الحمام وأمسكته الممرضة؛ دون إصابة.'),
    immediate: T('Non-slip mat placed; falls risk re-assessed.', 'ڕایەخی نەخلیسکێن دانرا؛ مەترسیی کەوتن دووبارە هەڵسەنگێنرا.', 'وُضعت سجادة مانعة للانزلاق؛ أُعيد تقييم خطر السقوط.') },
  { days: 13, time: '08:10', category: 'medication', harm: 'severe', location: 'med-a', patient: 1, stage: 'rca',
    summary: T('Insulin given without a recent glucose; hypoglycaemia needing IV dextrose.', 'ئینسولین بەبێ پشکنینی نوێی شەکر درا؛ کەمیی شەکر کە پێویستی بە دێکستڕۆزی دەمار بوو.', 'أُعطي الإنسولين دون قياس سكر حديث؛ هبوط سكر احتاج إلى دكستروز وريدي.'),
    immediate: T('Treated per hypoglycaemia protocol; recovered fully.', 'بەپێی پرۆتۆکۆلی کەمیی شەکر چارەسەر کرا؛ بە تەواوی چاک بووەوە.', 'عولج وفق بروتوكول هبوط السكر؛ تعافى تماماً.'),
    actions: [[T('Hard stop: insulin needs a glucose within 1 h on the eMAR', 'وەستانی ناچاری: ئینسولین پێویستی بە شەکری 1 کاتژمێری دوایی هەیە', 'إيقاف إلزامي: يتطلب الإنسولين قياس سكر خلال ساعة في eMAR'), 9, false]] },
  { days: 15, time: '14:35', category: 'specimen', harm: 'none', location: 'lab', patient: null, stage: 'closed',
    summary: T('Batch of 6 samples haemolysed after pneumatic tube transport.', 'کۆمەڵێک 6 نموونە دوای گواستنەوە بە بۆری پەستان تێکچوون.', 'تحلل 6 عينات بعد النقل بالأنبوب الهوائي.'),
    immediate: T('Samples redrawn; tube station speed checked.', 'نموونەکان دووبارە وەرگیران؛ خێرایی بۆری پشکنرا.', 'أُعيد سحب العينات؛ فُحصت سرعة محطة الأنبوب.') },
  { days: 18, time: '10:25', category: 'infection', harm: 'minor', location: 'surg-b', patient: 19, stage: 'actions',
    summary: T('Surgical site infection after appendicectomy, day 5.', 'هەوکردنی شوێنی نەشتەرگەری دوای لابردنی ئاپێندیکس، ڕۆژی 5.', 'عدوى موضع الجراحة بعد استئصال الزائدة، اليوم الخامس.'),
    immediate: T('Wound swab, antibiotics adjusted.', 'سواب لە برین، دژەبەکتریا گۆڕدرا.', 'مسحة من الجرح وتعديل المضادات الحيوية.'),
    actions: [[T('Check antibiotic prophylaxis timing in theatre', 'پشکنینی کاتی دژەبەکتریای خۆپاراستن لە هۆڵ', 'التحقق من توقيت المضاد الوقائي في العمليات'), 2, true]] },
  { days: 21, time: '03:15', category: 'equipment', harm: 'none', location: 'icu', patient: null, stage: 'closed',
    summary: T('Oxygen pipeline pressure alarm for 4 minutes during the night.', 'ئاگادارکردنەوەی پەستانی بۆری ئۆکسجین بۆ 4 خولەک لە شەودا.', 'إنذار ضغط خط الأكسجين لمدة 4 دقائق ليلاً.'),
    immediate: T('Cylinders connected; supplier attended within 1 h.', 'سیلیندەر بەسترا؛ دابینکەر لە ماوەی 1 کاتژمێردا هات.', 'وُصلت الأسطوانات؛ حضر المورد خلال ساعة.') },
  { days: 24, time: '17:50', category: 'identification', harm: 'none', location: 'opd', patient: 21, stage: 'closed',
    summary: T('Two patients with the same name called for the same clinic slot.', 'دوو نەخۆش بە هەمان ناو بۆ هەمان کاتی نۆرینگە بانگ کران.', 'نُودي على مريضين بالاسم نفسه للموعد نفسه في العيادة.'),
    immediate: T('Identified by date of birth and MRN before consultation.', 'پێش پشکنین بە بەرواری لەدایکبوون و MRN ناسێنران.', 'حُدّد كل منهما بتاريخ الميلاد وMRN قبل الاستشارة.') },
  { days: 27, time: '09:05', category: 'communication', harm: 'minor', location: 'ed', patient: 23, stage: 'closed',
    summary: T('Interpreter not arranged for an Arabic-speaking patient; consent delayed.', 'وەرگێڕ بۆ نەخۆشێکی عەرەبیزمان ئامادە نەکرابوو؛ ڕەزامەندی دواکەوت.', 'لم يُرتب مترجم لمريض ناطق بالعربية؛ تأخرت الموافقة.'),
    immediate: T('Arabic-speaking doctor took consent.', 'پزیشکێکی عەرەبیزمان ڕەزامەندیی وەرگرت.', 'أخذ طبيب ناطق بالعربية الموافقة.') },
];

export const INCIDENTS: readonly Incident[] = SEEDS.map((seed, index) => ({
  id: `SYN-INC-${String(2610 - index * 3)}`,
  reportedIso: daysAgoAt(seed.days, seed.time),
  category: seed.category,
  harm: seed.harm,
  location: seed.location,
  reporterId: staffAt(index * 3 + 1).id,
  patientId: seed.patient === null ? null : patientAt(seed.patient).id,
  stage: seed.stage,
  summary: seed.summary,
  immediateAction: seed.immediate,
  handlerId: staffAt(index % 2 === 0 ? 1 : 3).id,
  anonymous: seed.anonymous ?? false,
  actions: (seed.actions ?? []).map(([text, dueIn, done], i) => ({ id: `a${String(i)}`, text, ownerId: staffAt(index + i * 4).id, due: demoDate(-dueIn), done })),
}));

/** Reported incidents per month (last 6 months, oldest first): all reports and those with harm. */
export const MONTHLY_INCIDENTS: readonly { readonly month: string; readonly reported: number; readonly harm: number }[] = [
  { month: '2026-05', reported: 31, harm: 9 },
  { month: '2026-06', reported: 36, harm: 11 },
  { month: '2026-07', reported: 42, harm: 10 },
  { month: '2026-08', reported: 39, harm: 8 },
  { month: '2026-09', reported: 47, harm: 9 },
  { month: '2026-10', reported: 28, harm: 6 },
];

/** Date of the last sentinel event (for the "days since" counter). */
export const LAST_SENTINEL_ON = '2026-06-02';

// ---------------------------------------------------------------------------------------------------------
// Accreditation and licensing
// ---------------------------------------------------------------------------------------------------------

export interface Chapter {
  /** The JCI chapter abbreviation (Latin). */
  readonly code: string;
  readonly name: Text3;
  readonly elements: number;
  readonly met: number;
  readonly partial: number;
}

export const JCI_CHAPTERS: readonly Chapter[] = [
  { code: 'IPSG', name: T('International Patient Safety Goals', 'ئامانجە نێودەوڵەتییەکانی سەلامەتیی نەخۆش', 'الأهداف الدولية لسلامة المرضى'), elements: 26, met: 23, partial: 3 },
  { code: 'ACC', name: T('Access to Care and Continuity of Care', 'دەستگەیشتن و بەردەوامیی چاودێری', 'الوصول إلى الرعاية واستمراريتها'), elements: 52, met: 41, partial: 7 },
  { code: 'PCC', name: T('Patient-Centred Care', 'چاودێریی نەخۆش-تەوەر', 'الرعاية المتمحورة حول المريض'), elements: 48, met: 37, partial: 8 },
  { code: 'AOP', name: T('Assessment of Patients', 'هەڵسەنگاندنی نەخۆشان', 'تقييم المرضى'), elements: 71, met: 55, partial: 10 },
  { code: 'COP', name: T('Care of Patients', 'چاودێریی نەخۆشان', 'رعاية المرضى'), elements: 58, met: 44, partial: 9 },
  { code: 'ASC', name: T('Anaesthesia and Surgical Care', 'بێهۆشکردن و چاودێریی نەشتەرگەری', 'التخدير والرعاية الجراحية'), elements: 44, met: 38, partial: 4 },
  { code: 'MMU', name: T('Medication Management and Use', 'بەڕێوەبردن و بەکارهێنانی دەرمان', 'إدارة الأدوية واستخدامها'), elements: 63, met: 46, partial: 11 },
  { code: 'QPS', name: T('Quality Improvement and Patient Safety', 'باشترکردنی کوالیتی و سەلامەتیی نەخۆش', 'تحسين الجودة وسلامة المرضى'), elements: 34, met: 22, partial: 8 },
  { code: 'PCI', name: T('Prevention and Control of Infections', 'خۆپاراستن و کۆنترۆڵی هەوکردن', 'الوقاية من العدوى ومكافحتها'), elements: 55, met: 42, partial: 8 },
  { code: 'GLD', name: T('Governance, Leadership and Direction', 'حوکمڕانی، سەرکردایەتی و ئاراستە', 'الحوكمة والقيادة والتوجيه'), elements: 67, met: 49, partial: 12 },
  { code: 'FMS', name: T('Facility Management and Safety', 'بەڕێوەبردن و سەلامەتیی دامەزراوە', 'إدارة المرافق وسلامتها'), elements: 61, met: 47, partial: 9 },
  { code: 'SQE', name: T('Staff Qualifications and Education', 'شیاوی و پەروەردەی ستاف', 'مؤهلات الموظفين وتعليمهم'), elements: 57, met: 40, partial: 11 },
  { code: 'MOI', name: T('Management of Information', 'بەڕێوەبردنی زانیاری', 'إدارة المعلومات'), elements: 39, met: 31, partial: 5 },
];

export type LicenceState = 'done' | 'in-progress' | 'not-started';

export interface LicenceItem {
  readonly id: string;
  readonly item: Text3;
  readonly authority: Text3;
  readonly due: string;
  readonly state: LicenceState;
  readonly ownerId: string;
}

const MOH = T('KRG Ministry of Health', 'وەزارەتی تەندروستیی حکومەتی هەرێم', 'وزارة الصحة في حكومة الإقليم');
const DOH = T('Erbil Directorate of Health', 'بەڕێوەبەرایەتیی تەندروستیی هەولێر', 'مديرية صحة أربيل');
const CIVIL = T('Civil Defence Directorate', 'بەڕێوەبەرایەتیی بەرگریی شارستانی', 'مديرية الدفاع المدني');
const ENV = T('Board of Environment', 'دەستەی ژینگە', 'هيئة البيئة');

export const LICENCE_ITEMS: readonly LicenceItem[] = [
  { id: 'L01', item: T('Private hospital operating licence renewal (annual)', 'نوێکردنەوەی مۆڵەتی کارکردنی نەخۆشخانەی تایبەت (ساڵانە)', 'تجديد رخصة تشغيل المستشفى الأهلي (سنوي)'), authority: MOH, due: '2026-12-31', state: 'in-progress', ownerId: 'SYN-STF-004' },
  { id: 'L02', item: T('Medical director appointment letter on file', 'نامەی دامەزراندنی بەڕێوەبەری پزیشکی لە دۆسیەدایە', 'كتاب تعيين المدير الطبي في الملف'), authority: MOH, due: '2026-11-15', state: 'done', ownerId: 'SYN-STF-004' },
  { id: 'L03', item: T('Practising licences of all doctors verified with the syndicate', 'مۆڵەتی کارکردنی هەموو پزیشکان لەگەڵ سەندیکا پشتڕاست کرایەوە', 'التحقق من إجازات ممارسة جميع الأطباء مع النقابة'), authority: DOH, due: '2026-11-01', state: 'in-progress', ownerId: 'SYN-STF-001' },
  { id: 'L04', item: T('Fire safety inspection certificate', 'بڕوانامەی پشکنینی سەلامەتیی ئاگر', 'شهادة فحص السلامة من الحرائق'), authority: CIVIL, due: '2026-11-20', state: 'not-started', ownerId: 'SYN-STF-004' },
  { id: 'L05', item: T('Medical waste contract and incinerator log', 'گرێبەستی پاشماوەی پزیشکی و تۆماری سووتێنەر', 'عقد النفايات الطبية وسجل المحرقة'), authority: ENV, due: '2026-12-01', state: 'done', ownerId: 'SYN-STF-004' },
  { id: 'L06', item: T('Radiation protection licence (X-ray and CT)', 'مۆڵەتی پاراستن لە تیشک (X-ray و CT)', 'رخصة الوقاية من الإشعاع (الأشعة والمقطعي)'), authority: MOH, due: '2027-01-15', state: 'in-progress', ownerId: 'SYN-STF-013' },
  { id: 'L07', item: T('Pharmacy licence and narcotics register audit', 'مۆڵەتی دەرمانخانە و وردبینیی تۆماری ماددە هۆشبەرەکان', 'رخصة الصيدلية وتدقيق سجل المخدرات'), authority: DOH, due: '2026-11-10', state: 'done', ownerId: 'SYN-STF-012' },
  { id: 'L08', item: T('Laboratory quality certificate (external QA)', 'بڕوانامەی کوالیتیی تاقیگە (QA ی دەرەکی)', 'شهادة جودة المختبر (ضبط جودة خارجي)'), authority: DOH, due: '2026-12-20', state: 'not-started', ownerId: 'SYN-STF-011' },
  { id: 'L09', item: T('Statutory returns submitted on time (last 12 months)', 'ناردنی ڕاپۆرتە یاساییەکان لە کاتی خۆیدا (12 مانگی ڕابردوو)', 'تقديم التقارير الإلزامية في موعدها (آخر 12 شهراً)'), authority: MOH, due: '2026-12-31', state: 'in-progress', ownerId: 'SYN-STF-004' },
  { id: 'L10', item: T('Generator and oxygen plant maintenance records', 'تۆماری چاککردنەوەی مۆلیدە و وێستگەی ئۆکسجین', 'سجلات صيانة المولدة ومحطة الأكسجين'), authority: CIVIL, due: '2026-11-30', state: 'done', ownerId: 'SYN-STF-004' },
];

// ---------------------------------------------------------------------------------------------------------
// Hazard log (clinical risk register, ISO 14971 / DCB0129 style)
// ---------------------------------------------------------------------------------------------------------

export type HazardStatus = 'open' | 'mitigated' | 'accepted' | 'closed';

export interface Hazard {
  readonly id: string;
  readonly hazard: Text3;
  readonly cause: Text3;
  readonly controls: Text3;
  /** 1 (rare) to 5 (almost certain). */
  readonly likelihood: number;
  /** 1 (minor) to 5 (catastrophic). */
  readonly severity: number;
  /** After controls. */
  readonly residualLikelihood: number;
  readonly residualSeverity: number;
  readonly ownerId: string;
  readonly reviewOn: string;
  readonly status: HazardStatus;
}

const H = (id: string, hazard: Text3, cause: Text3, controls: Text3, l: number, s: number, rl: number, rs: number, owner: number, review: number, status: HazardStatus): Hazard => ({
  id, hazard, cause, controls, likelihood: l, severity: s, residualLikelihood: rl, residualSeverity: rs, ownerId: staffAt(owner).id, reviewOn: demoDate(-review), status,
});

export const HAZARDS: readonly Hazard[] = [
  H('HAZ-001', T('Wrong patient selected in the record', 'هەڵبژاردنی نەخۆشی هەڵە لە دۆسیە', 'اختيار المريض الخطأ في السجل'), T('Similar names; several records open', 'ناوی لەیەکچوو؛ چەند دۆسیەیەکی کراوە', 'أسماء متشابهة؛ عدة سجلات مفتوحة'), T('One patient per window; banner with two identifiers; switch confirmation', 'یەک نەخۆش بۆ هەر پەنجەرەیەک؛ بانەر بە دوو ناسێنەر؛ پشتڕاستکردنەوەی گۆڕین', 'مريض واحد لكل نافذة؛ شريط بمعرّفين؛ تأكيد التبديل'), 4, 5, 2, 5, 0, 30, 'mitigated'),
  H('HAZ-002', T('Allergy not seen when prescribing', 'هەستیاری لە کاتی نووسینی دەرماندا نەبینرا', 'عدم رؤية الحساسية عند الوصف'), T('Allergy recorded as free text', 'هەستیاری وەک دەقی ئازاد تۆمار کراوە', 'تسجيل الحساسية كنص حر'), T('Coded allergies; interruptive alert; override reason', 'هەستیاریی کۆدکراو؛ ئاگادارکردنەوەی بڕاو؛ هۆکاری تێپەڕاندن', 'حساسية مرمّزة؛ تنبيه مقاطع؛ سبب التجاوز'), 3, 5, 1, 5, 11, 45, 'mitigated'),
  H('HAZ-003', T('Critical result not acted on', 'کار لەسەر ئەنجامی مەترسیدار نەکرا', 'عدم التصرف بنتيجة حرجة'), T('Result phoned to the ward, not the doctor', 'ئەنجام بە تەلەفۆن بۆ قاوش نێردرا نەک پزیشک', 'إبلاغ النتيجة لهاتف الردهة لا للطبيب'), T('Critical banner; acknowledgement with read-back; escalation at 30 min', 'بانەری مەترسیدار؛ پشتڕاستکردنەوە بە دووبارەکردنەوە؛ بەرزکردنەوە دوای 30 خولەک', 'شريط حرج؛ إقرار مع إعادة القراءة؛ تصعيد بعد 30 دقيقة'), 3, 5, 2, 4, 10, 14, 'open'),
  H('HAZ-004', T('Dose unit misread (mg / microgram)', 'یەکەی دۆز بە هەڵە خوێنرایەوە (mg / مایکرۆگرام)', 'سوء قراءة وحدة الجرعة (mg / ميكروغرام)'), T('Abbreviations; trailing zeros', 'کورتکراوە؛ سفری کۆتایی', 'الاختصارات؛ الأصفار اللاحقة'), T('UCUM units; no trailing zero; leading zero enforced', 'یەکەی UCUM؛ بێ سفری کۆتایی؛ سفری پێشەوە ناچارییە', 'وحدات UCUM؛ دون أصفار لاحقة؛ صفر بادئ إلزامي'), 3, 4, 1, 4, 12, 60, 'mitigated'),
  H('HAZ-005', T('Records unavailable during a network outage', 'دۆسیە لە کاتی پچڕانی تۆڕدا بەردەست نییە', 'عدم توفر السجلات أثناء انقطاع الشبكة'), T('Power or internet failure', 'پچڕانی کارەبا یان ئینتەرنێت', 'انقطاع الكهرباء أو الإنترنت'), T('Local server; offline read-only mode; downtime forms', 'سێرڤەری ناوخۆیی؛ دۆخی خوێندنەوەی بێ هێڵ؛ فۆڕمی کاتی پچڕان', 'خادم محلي؛ وضع قراءة دون اتصال؛ نماذج التوقف'), 4, 4, 2, 3, 3, 21, 'mitigated'),
  H('HAZ-006', T('Bidirectional text reorders a dose', 'دەقی دوو ئاراستەیی ڕیزبەندیی دۆز تێکدەدات', 'النص ثنائي الاتجاه يعيد ترتيب الجرعة'), T('Latin numbers inside right-to-left text', 'ژمارەی لاتینی لە ناو دەقی ڕاست-بۆ-چەپ', 'أرقام لاتينية داخل نص من اليمين لليسار'), T('Isolated LTR spans for every number and unit', 'بەشی جیاکراوەی LTR بۆ هەموو ژمارە و یەکەیەک', 'مقاطع LTR معزولة لكل رقم ووحدة'), 3, 5, 1, 5, 4, 90, 'closed'),
  H('HAZ-007', T('Duplicate patient records created at registration', 'دروستبوونی دۆسیەی دووبارە لە تۆمارکردندا', 'إنشاء سجلات مكررة عند التسجيل'), T('Name spelt differently in three scripts', 'ناو بە سێ نووسین جیاواز نووسراوە', 'كتابة الاسم بثلاث طرق مختلفة'), T('Phonetic search across scripts; national ID match', 'گەڕانی دەنگی لە هەموو نووسینەکان؛ گونجاندنی ناسنامەی نیشتمانی', 'بحث صوتي عبر الكتابات؛ مطابقة الرقم الوطني'), 4, 3, 2, 3, 19, 40, 'open'),
  H('HAZ-008', T('Insulin given without a recent glucose', 'ئینسولین بەبێ شەکری نوێ درا', 'إعطاء الإنسولين دون قياس سكر حديث'), T('No hard stop on the eMAR', 'هیچ وەستانێکی ناچاری لە eMAR نییە', 'لا إيقاف إلزامي في eMAR'), T('Hard stop under review (incident SYN-INC-2574)', 'وەستانی ناچاری لە پێداچوونەوەدایە', 'الإيقاف الإلزامي قيد المراجعة'), 3, 4, 3, 4, 1, 9, 'open'),
  H('HAZ-009', T('Exchange-rate error on a USD invoice', 'هەڵەی نرخی ئاڵوگۆڕ لە پسوولەی دۆلار', 'خطأ سعر الصرف في فاتورة بالدولار'), T('Rate typed by hand each morning', 'نرخ هەموو بەیانییەک بە دەست دەنووسرێت', 'إدخال السعر يدوياً كل صباح'), T('Rate confirmed by a second user; shown on every receipt', 'نرخ لەلایەن بەکارهێنەری دووەمەوە پشتڕاست دەکرێتەوە', 'تأكيد السعر من مستخدم ثانٍ؛ يظهر على كل إيصال'), 3, 2, 2, 2, 2, 60, 'accepted'),
  H('HAZ-010', T('Report link opened by the wrong person', 'بەستەری ڕاپۆرت لەلایەن کەسی هەڵەوە کرایەوە', 'فتح رابط التقرير من شخص غير مخول'), T('Forwarded WhatsApp message', 'نامەی WhatsApp ی ناردراو', 'رسالة واتساب معاد توجيهها'), T('OTP to the registered phone; link expires in 72 h; audit trail', 'OTP بۆ تەلەفۆنی تۆمارکراو؛ بەستەر دوای 72 کاتژمێر بەسەردەچێت', 'رمز OTP للهاتف المسجل؛ ينتهي الرابط بعد 72 ساعة؛ سجل تدقيق'), 3, 3, 1, 3, 3, 30, 'mitigated'),
  H('HAZ-011', T('Infusion pump library out of date', 'کتێبخانەی پەمپی ئینفیوژن کۆنە', 'مكتبة مضخات التسريب قديمة'), T('Manual updates per pump', 'نوێکردنەوەی دەستی بۆ هەر پەمپێک', 'تحديث يدوي لكل مضخة'), T('Quarterly library update by biomedical engineering', 'نوێکردنەوەی چارەکانە لەلایەن ئەندازیاریی پزیشکییەوە', 'تحديث ربع سنوي من الهندسة الطبية'), 2, 5, 2, 4, 14, 18, 'open'),
  H('HAZ-012', T('Wrong-site surgery', 'نەشتەرگەری لە شوێنی هەڵە', 'جراحة في الموضع الخطأ'), T('Site not marked with the patient awake', 'شوێن نیشانە نەکراوە کاتێک نەخۆش بە ئاگایە', 'عدم تعليم الموضع والمريض مستيقظ'), T('WHO checklist; surgeon marks the site; time-out', 'لیستی WHO؛ نەشتەرگەر شوێنەکە نیشانە دەکات؛ وەستانی پشکنین', 'قائمة WHO؛ يعلّم الجراح الموضع؛ وقفة التحقق'), 2, 5, 1, 5, 4, 25, 'mitigated'),
];
