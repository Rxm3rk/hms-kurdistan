/**
 * Roles and permissions for the administration screen's "Users and roles" tab. SYNTHETIC, for the prototype:
 * a simplified picture of role-based access, not the product's permission model.
 */
import type { StaffRole, Text3 } from '../../data/index.ts';

const T = (en: string, ckb: string, ar: string): Text3 => ({ en, ckb, ar });

/** What each role may reach, in one line. */
export const ACCESS_SCOPE: Readonly<Record<StaffRole, Text3>> = {
  physician: T('Patients of own department; emergency access with a reason', 'نەخۆشانی بەشی خۆی؛ دەستگەیشتنی فریاکەوتن بە هۆکار', 'مرضى قسمه؛ وصول طارئ مع ذكر السبب'),
  nurse: T('Patients of own ward; emergency access with a reason', 'نەخۆشانی قاوشی خۆی؛ دەستگەیشتنی فریاکەوتن بە هۆکار', 'مرضى ردهته؛ وصول طارئ مع ذكر السبب'),
  cashier: T('Bills and registration details only', 'تەنها پسوولە و زانیاریی تۆمارکردن', 'الفواتير وبيانات التسجيل فقط'),
  admin: T('Settings, users and audit; no clinical records', 'ڕێکخستن، بەکارهێنەران و تۆماری چاودێری؛ بێ دۆسیەی کلینیکی', 'الإعدادات والمستخدمون والتدقيق؛ دون السجلات السريرية'),
  lab: T('Laboratory worklist and results', 'لیستی کاری تاقیگە و ئەنجامەکان', 'قائمة عمل المختبر والنتائج'),
  pharmacist: T('Medication orders on every ward', 'داواکارییەکانی دەرمان لە هەموو قاوشەکان', 'طلبات الأدوية في جميع الردهات'),
  radiology: T('Imaging worklist and reports', 'لیستی کاری وێنەگرتن و ڕاپۆرتەکان', 'قائمة عمل التصوير والتقارير'),
  reception: T('Registration and appointments', 'تۆمارکردن و کاتی سەردان', 'التسجيل والمواعيد'),
};

/** Accounts locked after failed sign-ins (see the audit log). */
export const LOCKED_ACCOUNTS: ReadonlySet<string> = new Set(['SYN-STF-020']);

export type Grant = 'full' | 'limited' | 'none';

export type MatrixRole = Extract<StaffRole, 'physician' | 'nurse' | 'pharmacist' | 'lab' | 'cashier' | 'admin'>;

export const MATRIX_ROLES: readonly MatrixRole[] = ['physician', 'nurse', 'pharmacist', 'lab', 'cashier', 'admin'];

export interface Permission {
  readonly id: string;
  readonly name: Text3;
  readonly grants: Readonly<Record<MatrixRole, Grant>>;
  /** What "limited" means for this permission. */
  readonly limitedNote: Text3 | null;
}

export const PERMISSIONS: readonly Permission[] = [
  {
    id: 'view-record',
    name: T('Open the patient record', 'کردنەوەی دۆسیەی نەخۆش', 'فتح ملف المريض'),
    grants: { physician: 'full', nurse: 'full', pharmacist: 'full', lab: 'limited', cashier: 'limited', admin: 'none' },
    limitedNote: T('Laboratory and billing see only their part', 'تاقیگە و پسوولەکردن تەنها بەشی خۆیان دەبینن', 'المختبر والفوترة يريان جزءهما فقط'),
  },
  {
    id: 'write-orders',
    name: T('Write orders', 'نووسینی داواکاری', 'كتابة الطلبات'),
    grants: { physician: 'full', nurse: 'limited', pharmacist: 'limited', lab: 'none', cashier: 'none', admin: 'none' },
    limitedNote: T('Nursing orders; pharmacist substitutions by protocol', 'داواکاریی پەرستاری؛ گۆڕینی دەرمان لەلایەن دەرمانسازەوە بەپێی پرۆتۆکۆڵ', 'طلبات التمريض؛ بدائل الصيدلاني حسب البروتوكول'),
  },
  {
    id: 'sign-orders',
    name: T('Sign orders', 'واژۆکردنی داواکاری', 'توقيع الطلبات'),
    grants: { physician: 'full', nurse: 'none', pharmacist: 'none', lab: 'none', cashier: 'none', admin: 'none' },
    limitedNote: T('Residents need a consultant co-signature', 'پزیشکی نیشتەجێ پێویستی بە واژۆی هاوبەشی ڕاوێژکارە', 'يحتاج المقيمون إلى توقيع مشترك من الاستشاري'),
  },
  {
    id: 'give-medication',
    name: T('Record medicines given', 'تۆمارکردنی دانی دەرمان', 'تسجيل إعطاء الأدوية'),
    grants: { physician: 'limited', nurse: 'full', pharmacist: 'none', lab: 'none', cashier: 'none', admin: 'none' },
    limitedNote: T('Doctors only in emergencies', 'پزیشک تەنها لە فریاکەوتندا', 'الأطباء في الطوارئ فقط'),
  },
  {
    id: 'results',
    name: T('Verify or acknowledge results', 'پشتڕاستکردنەوەی ئەنجام', 'التحقق من النتائج أو تأكيد الاطلاع'),
    grants: { physician: 'full', nurse: 'limited', pharmacist: 'none', lab: 'full', cashier: 'none', admin: 'none' },
    limitedNote: T('Nurses see results and escalate', 'پەرستار ئەنجام دەبینێت و ڕایدەگەیەنێت', 'الممرضون يرون النتائج ويصعّدونها'),
  },
  {
    id: 'payments',
    name: T('Take payments', 'وەرگرتنی پارە', 'استلام المدفوعات'),
    grants: { physician: 'none', nurse: 'none', pharmacist: 'none', lab: 'none', cashier: 'full', admin: 'limited' },
    limitedNote: T('Administrators see reports only', 'بەڕێوەبەر تەنها ڕاپۆرت دەبینێت', 'المديرون يرون التقارير فقط'),
  },
  {
    id: 'configuration',
    name: T('Change settings and safety switches', 'گۆڕینی ڕێکخستن و کلیلەکانی سەلامەتی', 'تغيير الإعدادات ومفاتيح السلامة'),
    grants: { physician: 'none', nurse: 'none', pharmacist: 'none', lab: 'none', cashier: 'none', admin: 'full' },
    limitedNote: null,
  },
  {
    id: 'audit',
    name: T('Read the audit log', 'خوێندنەوەی تۆماری چاودێری', 'قراءة سجل التدقيق'),
    grants: { physician: 'none', nurse: 'none', pharmacist: 'none', lab: 'none', cashier: 'none', admin: 'full' },
    limitedNote: null,
  },
];
