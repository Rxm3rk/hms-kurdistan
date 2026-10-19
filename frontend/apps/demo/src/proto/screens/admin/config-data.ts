/**
 * The configuration chain of the administration screen: seven levels from the vendor down to one user, and a
 * few settings set (and sometimes locked) at different levels. SYNTHETIC, for the prototype only.
 *
 * A setting takes the value of the lowest level that sets it. A lock at a level means nobody below that level
 * can change the setting: an override below the lock is refused (and the refusal is audited).
 */
import { DEPARTMENTS, HOSPITAL, WARDS } from '../../data/index.ts';
import type { Text3 } from '../../data/index.ts';

const T = (en: string, ckb: string, ar: string): Text3 => ({ en, ckb, ar });

/** Wraps a left-to-right value (a number with a unit) in Unicode isolates, for plain-text option labels. */
const ltr = (value: string): string => `⁦${value}⁩`;
const same = (value: string): Text3 => ({ en: value, ckb: value, ar: value });

export type LevelId = 'vendor' | 'pack' | 'group' | 'facility' | 'department' | 'unit' | 'user';

export interface LevelInfo {
  readonly id: LevelId;
  readonly name: Text3;
  /** The example entity at this level in the demo chain. */
  readonly entity: Text3;
  /** Who may change settings at this level. */
  readonly managedBy: Text3;
}

const department = DEPARTMENTS.find((candidate) => candidate.id === 'internal-medicine');
const unit = WARDS.find((candidate) => candidate.id === 'med-a');

export const LEVELS: readonly LevelInfo[] = [
  {
    id: 'vendor',
    name: T('Vendor', 'دابینکەر', 'المورّد'),
    entity: T('HMS Kurdistan product baseline', 'بنەمای بەرهەمی HMS Kurdistan', 'الأساس المرجعي لمنتج HMS Kurdistan'),
    managedBy: T('Vendor releases only', 'تەنها وەشانەکانی دابینکەر', 'إصدارات المورّد فقط'),
  },
  {
    id: 'pack',
    name: T('Kurdistan pack', 'پاکێجی کوردستان', 'حزمة كوردستان'),
    entity: T('Kurdistan Region pack 2026.2 (synthetic)', 'پاکێجی هەرێمی کوردستان 2026.2 (نموونە)', 'حزمة إقليم كوردستان 2026.2 (تجريبية)'),
    managedBy: T('Regional clinical governance, signed releases', 'بەڕێوەبردنی کلینیکیی هەرێم، وەشانی واژۆکراو', 'الحوكمة السريرية الإقليمية، إصدارات موقّعة'),
  },
  {
    id: 'group',
    name: T('Hospital group', 'گرووپی نەخۆشخانە', 'مجموعة المستشفيات'),
    entity: T('Demo Health Group (synthetic)', 'گرووپی تەندروستیی نموونەیی (نموونە)', 'مجموعة الصحة التجريبية (تجريبية)'),
    managedBy: T('Group administrators', 'بەڕێوەبەرانی گرووپ', 'مديرو المجموعة'),
  },
  {
    id: 'facility',
    name: T('Facility', 'دامەزراوە', 'المنشأة'),
    entity: HOSPITAL.name,
    managedBy: T('Hospital administrators', 'بەڕێوەبەرانی نەخۆشخانە', 'مديرو المستشفى'),
  },
  {
    id: 'department',
    name: T('Department', 'بەش', 'القسم'),
    entity: department?.name ?? T('Internal Medicine', 'نەخۆشییە ناوەکییەکان', 'الأمراض الباطنية'),
    managedBy: T('Head of department, with an administrator', 'سەرۆکی بەش، لەگەڵ بەڕێوەبەرێک', 'رئيس القسم مع أحد المديرين'),
  },
  {
    id: 'unit',
    name: T('Unit', 'یەکە', 'الوحدة'),
    entity: unit?.name ?? T('Medical Ward A', 'قاوشی ناوەکی A', 'ردهة الباطنية A'),
    managedBy: T('Unit manager, with an administrator', 'بەرپرسی یەکە، لەگەڵ بەڕێوەبەرێک', 'مسؤول الوحدة مع أحد المديرين'),
  },
  {
    id: 'user',
    name: T('User', 'بەکارهێنەر', 'المستخدم'),
    entity: T('Dr. Shilan Kareem', 'د. شیلان کەریم', 'د. شيلان كريم'),
    managedBy: T('The user, personal preferences', 'بەکارهێنەر خۆی، ئارەزووە کەسییەکان', 'المستخدم نفسه، التفضيلات الشخصية'),
  },
];

export const LEVEL_IDS: readonly LevelId[] = LEVELS.map((level) => level.id);

/** The levels a hospital administrator may change (the ones above belong to the vendor, region and group). */
export const EDITABLE_LEVELS: readonly LevelId[] = ['facility', 'department', 'unit', 'user'];

export function levelIndex(level: LevelId): number {
  return LEVEL_IDS.indexOf(level);
}

export function levelInfo(level: LevelId): LevelInfo {
  return LEVELS.find((candidate) => candidate.id === level) ?? (LEVELS[0] as LevelInfo);
}

export interface ConfigOption {
  readonly id: string;
  readonly label: Text3;
}

export interface ConfigSetting {
  readonly id: string;
  readonly name: Text3;
  readonly description: Text3;
  readonly options: readonly ConfigOption[];
  /** The value each level sets (option id); levels that do not set it inherit from above. */
  readonly values: Readonly<Partial<Record<LevelId, string>>>;
  /** The level that locks the setting for every level below it, or null. */
  readonly lock: LevelId | null;
  readonly lockReason: Text3 | null;
}

export const SETTINGS: readonly ConfigSetting[] = [
  {
    id: 'two-identifiers',
    name: T('Two identifiers on every label and wristband', 'دوو ناسێنەر لەسەر هەموو لیبڵ و بازنەیەکی دەست', 'معرّفان على كل ملصق وسوار'),
    description: T(
      'Name with MRN and date of birth on wristbands, specimen labels and printouts.',
      'ناو لەگەڵ MRN و ڕێکەوتی لەدایکبوون لەسەر بازنەی دەست، لیبڵی نموونە و چاپکراوەکان.',
      'الاسم مع رقم السجل وتاريخ الميلاد على أساور المعصم وملصقات العينات والمطبوعات.',
    ),
    options: [
      { id: 'on', label: T('Required', 'پێویستە', 'إلزامي') },
      { id: 'off', label: T('Not required', 'پێویست نییە', 'غير إلزامي') },
    ],
    values: { vendor: 'on' },
    lock: 'vendor',
    lockReason: T(
      'Patient identification is part of the product’s safety baseline.',
      'ناسینەوەی نەخۆش بەشێکە لە بنەمای سەلامەتیی بەرهەمەکە.',
      'تحديد هوية المريض جزء من أساس السلامة في المنتج.',
    ),
  },
  {
    id: 'critical-potassium',
    name: T('Critical potassium threshold (high)', 'سنووری مەترسیداری پۆتاسیۆم (بەرز)', 'عتبة البوتاسيوم الحرجة (المرتفعة)'),
    description: T(
      'Results at or above this value are critical: a doctor must acknowledge them and the nurse escalates.',
      'ئەنجامی یەکسان یان سەرووی ئەم بڕە مەترسیدارە: پزیشک دەبێت بینینی پشتڕاست بکاتەوە و پەرستار ڕایدەگەیەنێت.',
      'النتائج المساوية لهذه القيمة أو الأعلى منها حرجة: يجب أن يؤكد الطبيب الاطلاع عليها وتصعّدها الممرضة.',
    ),
    options: [
      { id: '6', label: same(ltr('≥ 6 mmol/L')) },
      { id: '6.5', label: same(ltr('≥ 6.5 mmol/L')) },
      { id: '7', label: same(ltr('≥ 7 mmol/L')) },
    ],
    values: { vendor: '6', pack: '6.5' },
    lock: 'pack',
    lockReason: T(
      'Agreed by the regional laboratory network and clinical governance for every hospital in the Kurdistan Region.',
      'تۆڕی تاقیگە هەرێمییەکان و بەڕێوەبردنی کلینیکی بۆ هەموو نەخۆشخانەکانی هەرێمی کوردستان لەسەری ڕێککەوتوون.',
      'اتفقت عليها شبكة المختبرات الإقليمية والحوكمة السريرية لجميع مستشفيات إقليم كوردستان.',
    ),
  },
  {
    id: 'witness',
    name: T('Second-nurse check for high-alert medicines', 'پشکنینی پەرستاری دووەم بۆ دەرمانە مەترسیدارەکان', 'تحقق ممرضة ثانية للأدوية عالية الخطورة'),
    description: T(
      'Insulin, opioids, anticoagulants, concentrated electrolytes and vasopressors need a second nurse before they are given.',
      'ئەنسولین، ئەفیوونییەکان، دژەمەیینەکان، ئەلیکترۆلایتی چڕ و دەرمانی بەرزکەرەوەی پەستان پێش دان پێویستیان بە پەرستاری دووەمە.',
      'الأنسولين والأفيونات ومضادات التخثر والكهارل المركزة ورافعات الضغط تحتاج إلى ممرضة ثانية قبل إعطائها.',
    ),
    options: [
      { id: 'required', label: T('Required', 'پێویستە', 'إلزامي') },
      { id: 'advised', label: T('Advised', 'پێشنیارکراوە', 'موصى به') },
    ],
    values: { vendor: 'advised', pack: 'required' },
    lock: 'pack',
    lockReason: T('Kurdistan Region medication safety policy.', 'سیاسەتی سەلامەتیی دەرمانی هەرێمی کوردستان.', 'سياسة سلامة الأدوية في إقليم كوردستان.'),
  },
  {
    id: 'exchange-rate',
    name: T('Exchange rate for bills', 'نرخی ئاڵوگۆڕ بۆ پسوولەکان', 'سعر الصرف للفواتير'),
    description: T(
      'Where the daily US dollar rate on bills and receipts comes from.',
      'نرخی ڕۆژانەی دۆلار لەسەر پسوولە و وەسڵەکان لە کوێوە دێت.',
      'من أين يأتي سعر الدولار اليومي في الفواتير والإيصالات.',
    ),
    options: [
      { id: 'finance-daily', label: T('Finance office, each morning', 'نووسینگەی دارایی، هەموو بەیانییەک', 'القسم المالي، كل صباح') },
      { id: 'fixed', label: T('Fixed rate', 'نرخی جێگیر', 'سعر ثابت') },
    ],
    values: { vendor: 'fixed', group: 'finance-daily' },
    lock: 'group',
    lockReason: T(
      'One rate for every hospital of the group, so bills and reports agree.',
      'یەک نرخ بۆ هەموو نەخۆشخانەکانی گرووپ، بۆ ئەوەی پسوولە و ڕاپۆرتەکان یەک بگرنەوە.',
      'سعر واحد لجميع مستشفيات المجموعة لتتطابق الفواتير والتقارير.',
    ),
  },
  {
    id: 'language',
    name: T('Default language', 'زمانی بنەڕەت', 'اللغة الافتراضية'),
    description: T(
      'The language screens and printouts open in. Each user can still choose their own.',
      'ئەو زمانەی شاشە و چاپکراوەکان پێی دەکرێنەوە. هەر بەکارهێنەرێک دەتوانێت زمانی خۆی هەڵبژێرێت.',
      'اللغة التي تُفتح بها الشاشات والمطبوعات. يبقى لكل مستخدم أن يختار لغته.',
    ),
    options: [
      { id: 'ckb', label: T('Sorani Kurdish', 'کوردیی سۆرانی', 'الكردية السورانية') },
      { id: 'ar', label: T('Arabic', 'عەرەبی', 'العربية') },
      { id: 'en', label: T('English', 'ئینگلیزی', 'الإنجليزية') },
    ],
    values: { vendor: 'en', facility: 'ckb' },
    lock: null,
    lockReason: null,
  },
  {
    id: 'auto-signout',
    name: T('Automatic sign-out on shared computers', 'دەرچوونی خۆکار لە کۆمپیوتەرە هاوبەشەکان', 'تسجيل الخروج التلقائي على الحواسيب المشتركة'),
    description: T(
      'Shared ward computers sign the user out after this much inactivity.',
      'کۆمپیوتەرە هاوبەشەکانی قاوش دوای ئەم ماوە بێ جووڵەییە بەکارهێنەر دەردەکەن.',
      'تُخرج حواسيب الردهات المشتركة المستخدم بعد هذه المدة من عدم النشاط.',
    ),
    options: [
      { id: '5', label: T('5 minutes', '5 خولەک', '5 دقائق') },
      { id: '10', label: T('10 minutes', '10 خولەک', '10 دقائق') },
      { id: '15', label: T('15 minutes', '15 خولەک', '15 دقيقة') },
    ],
    values: { vendor: '15', facility: '5' },
    lock: 'facility',
    lockReason: T(
      'Hospital information security policy, after the 2026 audit.',
      'سیاسەتی ئاسایشی زانیاریی نەخۆشخانە، دوای پشکنینی 2026.',
      'سياسة أمن المعلومات في المستشفى بعد تدقيق 2026.',
    ),
  },
  {
    id: 'ward-round',
    name: T('Morning ward round', 'گەڕی بەیانیی قاوش', 'الجولة الصباحية في الردهة'),
    description: T(
      'When the medical team rounds; medicine times and observations are planned around it.',
      'کاتی گەڕی تیمی پزیشکی؛ کاتی دەرمان و پشکنینەکان بەپێی ئەو ڕێک دەخرێن.',
      'موعد جولة الفريق الطبي؛ تُنظَّم مواعيد الأدوية والمراقبة حوله.',
    ),
    options: [
      { id: '0800', label: same('08:00') },
      { id: '0830', label: same('08:30') },
      { id: '0900', label: same('09:00') },
    ],
    values: { facility: '0800', unit: '0830' },
    lock: null,
    lockReason: null,
  },
  {
    id: 'density',
    name: T('Screen density', 'چڕیی شاشە', 'كثافة الشاشة'),
    description: T('Comfortable or compact layout: a personal preference.', 'ڕیزبەندیی ئاسوودە یان چڕ: ئارەزوویەکی کەسییە.', 'تخطيط مريح أو مضغوط: تفضيل شخصي.'),
    options: [
      { id: 'comfortable', label: T('Comfortable', 'ئاسوودە', 'مريح') },
      { id: 'compact', label: T('Compact', 'چڕ', 'مضغوط') },
    ],
    values: { vendor: 'comfortable', user: 'compact' },
    lock: null,
    lockReason: null,
  },
];

/** Overrides made in this session: setting id → level → option id. */
export type Overrides = Readonly<Record<string, Readonly<Partial<Record<LevelId, string>>>>>;

/** The value a level sets for a setting (base data plus this session's overrides), ignoring levels below the lock. */
export function valueAt(setting: ConfigSetting, overrides: Overrides, level: LevelId): string | undefined {
  if (isBelowLock(setting, level)) {
    return undefined;
  }
  return overrides[setting.id]?.[level] ?? setting.values[level];
}

export function isBelowLock(setting: ConfigSetting, level: LevelId): boolean {
  return setting.lock !== null && levelIndex(level) > levelIndex(setting.lock);
}

/** The effective value at a level and where it comes from. */
export function effectiveAt(setting: ConfigSetting, overrides: Overrides, level: LevelId): { readonly optionId: string; readonly source: LevelId } | undefined {
  let found: { optionId: string; source: LevelId } | undefined;
  for (const candidate of LEVEL_IDS) {
    const value = valueAt(setting, overrides, candidate);
    if (value !== undefined) {
      found = { optionId: value, source: candidate };
    }
    if (candidate === level) {
      break;
    }
  }
  return found;
}

export function optionLabel(setting: ConfigSetting, optionId: string): Text3 {
  return setting.options.find((option) => option.id === optionId)?.label ?? same(optionId);
}
