/**
 * Clinical decision-support rules with their kill switches, for the administration screen. SYNTHETIC: names,
 * counts and change history are invented for the prototype. Rules locked by the vendor or the Kurdistan pack
 * cannot be switched off at the hospital.
 */
import { daysAgoAt, todayAt } from '../../data/index.ts';
import type { Text3 } from '../../data/index.ts';
import type { LevelId } from './config-data.ts';

const T = (en: string, ckb: string, ar: string): Text3 => ({ en, ckb, ar });

export interface SafetyRule {
  readonly id: string;
  readonly name: Text3;
  readonly description: Text3;
  /** Interruptive: stops the user until answered. Advisory: shown beside the work. */
  readonly kind: 'interruptive' | 'advisory';
  /** The level that owns the rule. */
  readonly level: LevelId;
  /** Locked by its owner: the hospital cannot switch it off. */
  readonly locked: boolean;
  readonly on: boolean;
  /** Times it fired today (synthetic). */
  readonly firedToday: number;
  /** Who last changed it (null: set by a signed release). */
  readonly changedById: string | null;
  readonly changedIso: string;
  readonly reason: Text3;
}

const RELEASE = T('Signed release 2026.2', 'وەشانی واژۆکراوی 2026.2', 'الإصدار الموقّع 2026.2');

export const SAFETY_RULES: readonly SafetyRule[] = [
  {
    id: 'SYN-CDS-001',
    name: T('Drug–allergy conflict', 'ناکۆکیی دەرمان و هەستیاری', 'تعارض الدواء مع الحساسية'),
    description: T(
      'Stops an order for a medicine the patient is allergic to (fired today for a drafted amoxicillin-clavulanate order).',
      'داواکاریی دەرمانێک ڕادەگرێت کە نەخۆش هەستیاریی پێی هەیە (ئەمڕۆ بۆ داواکارییەکی ڕەشنووسی ئەمۆکسیسیلین-کلاڤولانات دەرکەوت).',
      'يوقف طلب دواء لدى المريض حساسية منه (ظهر اليوم لطلب أموكسيسيلين-كلافولانات في المسودة).',
    ),
    kind: 'interruptive',
    level: 'vendor',
    locked: true,
    on: true,
    firedToday: 1,
    changedById: null,
    changedIso: daysAgoAt(48, '10:00'),
    reason: RELEASE,
  },
  {
    id: 'SYN-CDS-002',
    name: T('Critical result alert and escalation', 'ئاگادارکردنەوە و ڕاگەیاندنی ئەنجامی مەترسیدار', 'تنبيه النتائج الحرجة وتصعيدها'),
    description: T(
      'Alerts the responsible doctor to a critical result and escalates to the doctor on call after 30 minutes.',
      'پزیشکی بەرپرس لە ئەنجامی مەترسیدار ئاگادار دەکاتەوە و دوای 30 خولەک بە پزیشکی نۆبەدار ڕایدەگەیەنێت.',
      'ينبّه الطبيب المسؤول إلى النتيجة الحرجة ويصعّدها إلى الطبيب المناوب بعد 30 دقيقة.',
    ),
    kind: 'interruptive',
    level: 'pack',
    locked: true,
    on: true,
    firedToday: 1,
    changedById: null,
    changedIso: daysAgoAt(48, '10:00'),
    reason: RELEASE,
  },
  {
    id: 'SYN-CDS-003',
    name: T('Second-nurse check for high-alert medicines', 'پشکنینی پەرستاری دووەم بۆ دەرمانە مەترسیدارەکان', 'تحقق ممرضة ثانية للأدوية عالية الخطورة'),
    description: T(
      'Asks for a second nurse before insulin, opioids, anticoagulants or concentrated potassium are recorded as given.',
      'پێش تۆمارکردنی دانی ئەنسولین، ئەفیوونییەکان، دژەمەیین یان پۆتاسیۆمی چڕ داوای پەرستاری دووەم دەکات.',
      'يطلب ممرضة ثانية قبل تسجيل إعطاء الأنسولين أو الأفيونات أو مضادات التخثر أو البوتاسيوم المركز.',
    ),
    kind: 'interruptive',
    level: 'pack',
    locked: true,
    on: true,
    firedToday: 6,
    changedById: null,
    changedIso: daysAgoAt(48, '10:00'),
    reason: RELEASE,
  },
  {
    id: 'SYN-CDS-004',
    name: T('Severe drug–drug interactions', 'کارلێکی توندی نێوان دەرمانەکان', 'التداخلات الدوائية الشديدة'),
    description: T(
      'Stops an order that interacts severely with a current medicine; moderate interactions are shown as advice.',
      'داواکارییەک ڕادەگرێت کە کارلێکی توندی لەگەڵ دەرمانێکی ئێستا هەیە؛ کارلێکی مامناوەند وەک ئامۆژگاری پیشان دەدرێت.',
      'يوقف الطلب الذي يتداخل بشدة مع دواء حالي؛ وتظهر التداخلات المتوسطة كنصيحة.',
    ),
    kind: 'interruptive',
    level: 'facility',
    locked: false,
    on: true,
    firedToday: 2,
    changedById: 'SYN-STF-004',
    changedIso: daysAgoAt(16, '11:40'),
    reason: T(
      'Turned back on after the drug knowledge update was checked by the pharmacy committee',
      'دوای ئەوەی لیژنەی دەرمانخانە نوێکردنەوەی زانیاریی دەرمانەکانی پشکنی، دووبارە کرایەوە',
      'أعيد تشغيلها بعد أن راجعت لجنة الصيدلة تحديث قاعدة معارف الأدوية',
    ),
  },
  {
    id: 'SYN-CDS-005',
    name: T('Duplicate therapy', 'دووبارەبوونەوەی چارەسەر', 'ازدواجية العلاج'),
    description: T(
      'Advises when two active orders are from the same drug class.',
      'ئامۆژگاری دەکات کاتێک دوو داواکاریی چالاک لە هەمان پۆلی دەرمانن.',
      'ينصح عندما يكون طلبان نشطان من الفئة الدوائية نفسها.',
    ),
    kind: 'advisory',
    level: 'facility',
    locked: false,
    on: true,
    firedToday: 3,
    changedById: 'SYN-STF-004',
    changedIso: daysAgoAt(30, '09:15'),
    reason: T('Introduced with the go-live', 'لەگەڵ دەستپێکردنی کار زیاد کرا', 'أضيفت مع بدء التشغيل'),
  },
  {
    id: 'SYN-CDS-006',
    name: T('Renal dose advice', 'ئامۆژگاریی بڕی دەرمان بەپێی گورچیلە', 'نصيحة جرعات الكلى'),
    description: T(
      'Suggests a dose change when the latest eGFR is low (fired today for a patient with eGFR 13).',
      'کاتێک دوایین eGFR نزمە گۆڕینی بڕ پێشنیار دەکات (ئەمڕۆ بۆ نەخۆشێک بە eGFR 13 دەرکەوت).',
      'يقترح تعديل الجرعة عندما يكون آخر eGFR منخفضاً (ظهر اليوم لمريضة بقيمة eGFR 13).',
    ),
    kind: 'advisory',
    level: 'facility',
    locked: false,
    on: true,
    firedToday: 1,
    changedById: 'SYN-STF-004',
    changedIso: daysAgoAt(30, '09:15'),
    reason: T('Introduced with the go-live', 'لەگەڵ دەستپێکردنی کار زیاد کرا', 'أضيفت مع بدء التشغيل'),
  },
  {
    id: 'SYN-CDS-007',
    name: T('Paediatric dose range by weight', 'مەودای بڕی دەرمانی منداڵ بەپێی کێش', 'مدى جرعات الأطفال حسب الوزن'),
    description: T(
      'Stops a child’s dose outside the safe range for their weight.',
      'بڕی دەرمانی منداڵ ڕادەگرێت ئەگەر لە دەرەوەی مەودای سەلامەتی کێشەکەی بێت.',
      'يوقف جرعة الطفل إذا كانت خارج المدى الآمن لوزنه.',
    ),
    kind: 'interruptive',
    level: 'facility',
    locked: false,
    on: true,
    firedToday: 0,
    changedById: 'SYN-STF-004',
    changedIso: daysAgoAt(30, '09:15'),
    reason: T('Introduced with the go-live', 'لەگەڵ دەستپێکردنی کار زیاد کرا', 'أضيفت مع بدء التشغيل'),
  },
  {
    id: 'SYN-CDS-008',
    name: T('Look-alike patient names', 'ناوی لێکچووی نەخۆشان', 'أسماء المرضى المتشابهة'),
    description: T(
      'Warns when another patient in the hospital has a very similar name (fired today: two names differ only in the grandfather’s name).',
      'ئاگادار دەکاتەوە کاتێک نەخۆشێکی تر لە نەخۆشخانە ناوێکی زۆر لێکچووی هەیە (ئەمڕۆ دەرکەوت: دوو ناو تەنها لە ناوی باپیردا جیاوازن).',
      'ينبّه عندما يكون لمريض آخر في المستشفى اسم مشابه جداً (ظهر اليوم: اسمان يختلفان في اسم الجد فقط).',
    ),
    kind: 'advisory',
    level: 'facility',
    locked: false,
    on: true,
    firedToday: 2,
    changedById: 'SYN-STF-004',
    changedIso: daysAgoAt(30, '09:15'),
    reason: T('Introduced with the go-live', 'لەگەڵ دەستپێکردنی کار زیاد کرا', 'أضيفت مع بدء التشغيل'),
  },
  {
    id: 'SYN-CDS-009',
    name: T('Pregnancy and breastfeeding advice', 'ئامۆژگاریی سکپڕی و شیردان', 'نصائح الحمل والرضاعة'),
    description: T(
      'Advises on medicines to avoid in pregnancy or breastfeeding.',
      'ئامۆژگاری دەکات لەسەر ئەو دەرمانانەی لە کاتی سکپڕی یان شیرداندا دوور دەکەونەوە.',
      'ينصح بالأدوية التي يجب تجنبها أثناء الحمل أو الرضاعة.',
    ),
    kind: 'advisory',
    level: 'facility',
    locked: false,
    on: false,
    firedToday: 0,
    changedById: 'SYN-STF-004',
    changedIso: daysAgoAt(3, '14:20'),
    reason: T(
      'Too many false alerts; content under review by the pharmacy committee',
      'ئاگادارکردنەوەی هەڵەی زۆر؛ ناوەڕۆکەکە لەلایەن لیژنەی دەرمانخانەوە پێداچوونەوەی بۆ دەکرێت',
      'تنبيهات خاطئة كثيرة؛ المحتوى قيد المراجعة لدى لجنة الصيدلة',
    ),
  },
  {
    id: 'SYN-CDS-010',
    name: T('Early warning score (NEWS2 5 or more)', 'نمرەی ئاگادارکردنەوەی زوو (NEWS2 5 یان زیاتر)', 'درجة الإنذار المبكر (NEWS2 من 5 فأكثر)'),
    description: T(
      'Tells the nurse in charge and the ward doctor when a patient’s early warning score reaches 5.',
      'سەرپەرشتیاری پەرستاری و پزیشکی قاوش ئاگادار دەکاتەوە کاتێک نمرەی ئاگادارکردنەوەی زووی نەخۆش دەگاتە 5.',
      'يُعلم الممرضة المسؤولة وطبيب الردهة عندما تبلغ درجة الإنذار المبكر للمريض 5.',
    ),
    kind: 'advisory',
    level: 'facility',
    locked: false,
    on: true,
    firedToday: 4,
    changedById: 'SYN-STF-004',
    changedIso: todayAt('07:05'),
    reason: T(
      'Escalation list updated for the new ward doctor rota',
      'لیستی ڕاگەیاندن بۆ خشتەی نوێی پزیشکانی قاوش نوێ کرایەوە',
      'حُدّثت قائمة التصعيد وفق جدول مناوبات أطباء الردهة الجديد',
    ),
  },
];
