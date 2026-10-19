/**
 * Display labels (en, ckb, ar) and tones for every coded value in the data. Screens use these instead of
 * writing their own, so a bed state or an order status reads the same on every screen.
 * The ckb and ar texts are AI drafts, unreviewed.
 */
import type {
  AllergySeverity,
  AppointmentStatus,
  BedState,
  ChargeCategory,
  ContainerType,
  EncounterType,
  Governorate,
  InvoiceStatus,
  IsolationType,
  MarStatus,
  NoteKind,
  OrderCategory,
  OrderPriority,
  OrderStatus,
  PaymentMethod,
  ResultFlag,
  RoleId,
  RouteId,
  Sex,
  SpecimenStatus,
  StaffRole,
  Text3,
  Tone,
} from './types.ts';

type Labels<K extends string> = Readonly<Record<K, Text3>>;
type Tones<K extends string> = Readonly<Record<K, Tone>>;

export const ROLE_LABEL: Labels<RoleId> = {
  physician: { en: 'Physician', ckb: 'پزیشک', ar: 'طبيب' },
  nurse: { en: 'Nurse', ckb: 'پەرستار', ar: 'ممرض' },
  cashier: { en: 'Cashier', ckb: 'خەزنەدار', ar: 'أمين صندوق' },
  admin: { en: 'Administrator', ckb: 'بەڕێوەبەر', ar: 'مدير النظام' },
};

export const STAFF_ROLE_LABEL: Labels<StaffRole> = {
  ...ROLE_LABEL,
  lab: { en: 'Laboratory', ckb: 'تاقیگە', ar: 'المختبر' },
  pharmacist: { en: 'Pharmacist', ckb: 'دەرمانساز', ar: 'صيدلاني' },
  radiology: { en: 'Radiology', ckb: 'تیشکناسی', ar: 'الأشعة' },
  reception: { en: 'Reception', ckb: 'پێشوازی', ar: 'الاستقبال' },
};

export const GOVERNORATE_LABEL: Labels<Governorate> = {
  erbil: { en: 'Erbil', ckb: 'هەولێر', ar: 'أربيل' },
  sulaymaniyah: { en: 'Sulaymaniyah', ckb: 'سلێمانی', ar: 'السليمانية' },
  duhok: { en: 'Duhok', ckb: 'دهۆک', ar: 'دهوك' },
  halabja: { en: 'Halabja', ckb: 'هەڵەبجە', ar: 'حلبجة' },
};

export const SEX_LABEL: Labels<Sex> = {
  female: { en: 'Female', ckb: 'مێ', ar: 'أنثى' },
  male: { en: 'Male', ckb: 'نێر', ar: 'ذكر' },
};

export const SEVERITY_LABEL: Labels<AllergySeverity> = {
  mild: { en: 'Mild', ckb: 'سووک', ar: 'خفيف' },
  moderate: { en: 'Moderate', ckb: 'مامناوەند', ar: 'متوسط' },
  severe: { en: 'Severe', ckb: 'توند', ar: 'شديد' },
};

export const ISOLATION_LABEL: Labels<IsolationType> = {
  contact: { en: 'Contact precautions', ckb: 'ڕێکاری بەرکەوتن', ar: 'احتياطات التلامس' },
  droplet: { en: 'Droplet precautions', ckb: 'ڕێکاری دڵۆپە', ar: 'احتياطات الرذاذ' },
  airborne: { en: 'Airborne precautions', ckb: 'ڕێکاری هەوایی', ar: 'احتياطات الانتقال الهوائي' },
};

export const BED_STATE_LABEL: Labels<BedState> = {
  available: { en: 'Available', ckb: 'بەتاڵ', ar: 'شاغر' },
  occupied: { en: 'Occupied', ckb: 'گیراو', ar: 'مشغول' },
  cleaning: { en: 'Cleaning', ckb: 'پاککردنەوە', ar: 'قيد التنظيف' },
  blocked: { en: 'Blocked', ckb: 'داخراو', ar: 'خارج الخدمة' },
  reserved: { en: 'Reserved', ckb: 'تەرخانکراو', ar: 'محجوز' },
};

export const BED_STATE_TONE: Tones<BedState> = {
  available: 'success',
  occupied: 'info',
  cleaning: 'warning',
  blocked: 'neutral',
  reserved: 'accent',
};

export const ENCOUNTER_TYPE_LABEL: Labels<EncounterType> = {
  inpatient: { en: 'Inpatient', ckb: 'نەخۆشی خەوێنراو', ar: 'مريض راقد' },
  outpatient: { en: 'Outpatient', ckb: 'نەخۆشی دەرەکی', ar: 'مريض خارجي' },
  emergency: { en: 'Emergency', ckb: 'فریاکەوتن', ar: 'طوارئ' },
};

export const APPOINTMENT_STATUS_LABEL: Labels<AppointmentStatus> = {
  booked: { en: 'Booked', ckb: 'کاتی گیراوە', ar: 'محجوز' },
  arrived: { en: 'Waiting', ckb: 'چاوەڕێ دەکات', ar: 'في الانتظار' },
  'in-consultation': { en: 'In consultation', ckb: 'لای پزیشکە', ar: 'عند الطبيب' },
  completed: { en: 'Completed', ckb: 'تەواوبوو', ar: 'مكتمل' },
  'no-show': { en: 'Did not attend', ckb: 'ئامادە نەبوو', ar: 'لم يحضر' },
  cancelled: { en: 'Cancelled', ckb: 'هەڵوەشێنرایەوە', ar: 'ملغى' },
};

export const APPOINTMENT_STATUS_TONE: Tones<AppointmentStatus> = {
  booked: 'neutral',
  arrived: 'warning',
  'in-consultation': 'accent',
  completed: 'success',
  'no-show': 'danger',
  cancelled: 'neutral',
};

export const ORDER_CATEGORY_LABEL: Labels<OrderCategory> = {
  lab: { en: 'Laboratory', ckb: 'تاقیگە', ar: 'مختبر' },
  imaging: { en: 'Imaging', ckb: 'وێنەگرتن', ar: 'تصوير' },
  medication: { en: 'Medication', ckb: 'دەرمان', ar: 'دواء' },
  nursing: { en: 'Nursing', ckb: 'پەرستاری', ar: 'تمريض' },
  diet: { en: 'Diet', ckb: 'خۆراک', ar: 'نظام غذائي' },
  consult: { en: 'Referral', ckb: 'ڕەوانەکردن', ar: 'إحالة' },
};

export const ORDER_STATUS_LABEL: Labels<OrderStatus> = {
  draft: { en: 'Draft', ckb: 'ڕەشنووس', ar: 'مسودة' },
  'pending-signature': { en: 'Awaiting signature', ckb: 'چاوەڕێی واژۆ', ar: 'بانتظار التوقيع' },
  active: { en: 'Active', ckb: 'چالاک', ar: 'نشط' },
  'in-progress': { en: 'In progress', ckb: 'لە جێبەجێکردندایە', ar: 'قيد التنفيذ' },
  'on-hold': { en: 'On hold', ckb: 'ڕاگیراوە', ar: 'معلّق' },
  completed: { en: 'Completed', ckb: 'تەواوبوو', ar: 'مكتمل' },
  cancelled: { en: 'Cancelled', ckb: 'هەڵوەشێنرایەوە', ar: 'ملغى' },
};

export const ORDER_STATUS_TONE: Tones<OrderStatus> = {
  draft: 'neutral',
  'pending-signature': 'warning',
  active: 'info',
  'in-progress': 'accent',
  'on-hold': 'warning',
  completed: 'success',
  cancelled: 'neutral',
};

export const PRIORITY_LABEL: Labels<OrderPriority> = {
  routine: { en: 'Routine', ckb: 'ئاسایی', ar: 'روتيني' },
  urgent: { en: 'Urgent', ckb: 'بەپەلە', ar: 'عاجل' },
  stat: { en: 'STAT', ckb: 'دەستبەجێ', ar: 'فوري' },
};

export const PRIORITY_TONE: Tones<OrderPriority> = {
  routine: 'neutral',
  urgent: 'warning',
  stat: 'danger',
};

export const ROUTE_LABEL: Labels<RouteId> = {
  po: { en: 'Oral', ckb: 'لە ڕێگەی دەم', ar: 'فموي' },
  iv: { en: 'IV', ckb: 'ناو دەمار', ar: 'وريدي' },
  'iv-infusion': { en: 'IV infusion', ckb: 'تکاندنی ناو دەمار', ar: 'تسريب وريدي' },
  im: { en: 'IM', ckb: 'ناو ماسولکە', ar: 'عضلي' },
  sc: { en: 'Subcutaneous', ckb: 'ژێر پێست', ar: 'تحت الجلد' },
  neb: { en: 'Nebulised', ckb: 'هەڵمژین', ar: 'استنشاق بالرذاذ' },
  ng: { en: 'Nasogastric', ckb: 'بۆری لووت-گەدە', ar: 'أنبوب أنفي معدي' },
  top: { en: 'Topical', ckb: 'سەر پێست', ar: 'موضعي' },
};

export const MAR_STATUS_LABEL: Labels<MarStatus> = {
  given: { en: 'Given', ckb: 'دراوە', ar: 'أُعطي' },
  due: { en: 'Due now', ckb: 'کاتی هاتووە', ar: 'مستحق الآن' },
  overdue: { en: 'Overdue', ckb: 'دواکەوتووە', ar: 'متأخر' },
  scheduled: { en: 'Scheduled', ckb: 'خشتەکراوە', ar: 'مجدول' },
  held: { en: 'Held', ckb: 'ڕاگیراوە', ar: 'موقوف' },
  refused: { en: 'Refused', ckb: 'ڕەتکرایەوە', ar: 'رُفض' },
  running: { en: 'Running', ckb: 'بەردەوامە', ar: 'جارٍ' },
};

export const MAR_STATUS_TONE: Tones<MarStatus> = {
  given: 'success',
  due: 'accent',
  overdue: 'danger',
  scheduled: 'neutral',
  held: 'warning',
  refused: 'warning',
  running: 'info',
};

export const SPECIMEN_STATUS_LABEL: Labels<SpecimenStatus> = {
  ordered: { en: 'To collect', ckb: 'وەرنەگیراوە', ar: 'بانتظار السحب' },
  collected: { en: 'Collected', ckb: 'وەرگیرا', ar: 'تم السحب' },
  received: { en: 'Received in lab', ckb: 'گەیشتە تاقیگە', ar: 'استُلم في المختبر' },
  'in-progress': { en: 'In analysis', ckb: 'لە شیکردنەوەدایە', ar: 'قيد التحليل' },
  resulted: { en: 'Resulted', ckb: 'ئەنجام دەرچوو', ar: 'صدرت النتيجة' },
  verified: { en: 'Verified', ckb: 'پشتڕاستکرایەوە', ar: 'تم التحقق' },
  rejected: { en: 'Rejected', ckb: 'ڕەتکرایەوە', ar: 'مرفوض' },
};

export const SPECIMEN_STATUS_TONE: Tones<SpecimenStatus> = {
  ordered: 'warning',
  collected: 'neutral',
  received: 'info',
  'in-progress': 'accent',
  resulted: 'info',
  verified: 'success',
  rejected: 'danger',
};

export const CONTAINER_LABEL: Labels<ContainerType> = {
  serum: { en: 'Gold top (serum)', ckb: 'سەرقاپی زەرد (سیرەم)', ar: 'أنبوب أصفر (مصل)' },
  edta: { en: 'Lavender top (EDTA)', ckb: 'سەرقاپی مۆر (EDTA)', ar: 'أنبوب بنفسجي (EDTA)' },
  citrate: { en: 'Blue top (citrate)', ckb: 'سەرقاپی شین (سیترات)', ar: 'أنبوب أزرق (سترات)' },
  'blood-gas': { en: 'Blood gas syringe', ckb: 'دەرزیی گازی خوێن', ar: 'محقنة غازات الدم' },
  'blood-culture': { en: 'Blood culture bottles', ckb: 'بوتڵی چاندنی خوێن', ar: 'قناني زرع الدم' },
  sputum: { en: 'Sputum pot', ckb: 'دەفری بەڵغەم', ar: 'وعاء القشع' },
  capillary: { en: 'Capillary (heel or finger)', ckb: 'مووی خوێن (پاژنە یان پەنجە)', ar: 'شعيري (الكعب أو الإصبع)' },
};

export const RESULT_FLAG_LABEL: Labels<ResultFlag> = {
  normal: { en: 'Normal', ckb: 'ئاسایی', ar: 'طبيعي' },
  low: { en: 'Low', ckb: 'نزم', ar: 'منخفض' },
  high: { en: 'High', ckb: 'بەرز', ar: 'مرتفع' },
  'critical-low': { en: 'Critical low', ckb: 'نزمی مەترسیدار', ar: 'منخفض حرج' },
  'critical-high': { en: 'Critical high', ckb: 'بەرزی مەترسیدار', ar: 'مرتفع حرج' },
  abnormal: { en: 'Abnormal', ckb: 'نائاسایی', ar: 'غير طبيعي' },
  pending: { en: 'Pending', ckb: 'چاوەڕوانە', ar: 'قيد الانتظار' },
};

export const RESULT_FLAG_TONE: Tones<ResultFlag> = {
  normal: 'neutral',
  low: 'warning',
  high: 'warning',
  'critical-low': 'danger',
  'critical-high': 'danger',
  abnormal: 'warning',
  pending: 'neutral',
};

export const NOTE_KIND_LABEL: Labels<NoteKind> = {
  admission: { en: 'Admission note', ckb: 'تێبینیی خەواندن', ar: 'ملاحظة الإدخال' },
  progress: { en: 'Progress note', ckb: 'تێبینیی ڕەوتی چارەسەر', ar: 'ملاحظة المتابعة' },
  nursing: { en: 'Nursing note', ckb: 'تێبینیی پەرستاری', ar: 'ملاحظة تمريضية' },
  consult: { en: 'Consultation', ckb: 'ڕاوێژ', ar: 'استشارة' },
  'discharge-plan': { en: 'Discharge plan', ckb: 'پلانی دەرچوون', ar: 'خطة الخروج' },
};

export const INVOICE_STATUS_LABEL: Labels<InvoiceStatus> = {
  draft: { en: 'Interim (not issued)', ckb: 'کاتی (دەرنەچووە)', ar: 'مؤقتة (غير صادرة)' },
  open: { en: 'Unpaid', ckb: 'نەدراوە', ar: 'غير مدفوعة' },
  'partially-paid': { en: 'Part paid', ckb: 'بەشێکی دراوە', ar: 'مدفوعة جزئياً' },
  paid: { en: 'Paid', ckb: 'دراوە', ar: 'مدفوعة' },
  void: { en: 'Void', ckb: 'هەڵوەشاوە', ar: 'ملغاة' },
};

export const INVOICE_STATUS_TONE: Tones<InvoiceStatus> = {
  draft: 'neutral',
  open: 'warning',
  'partially-paid': 'info',
  paid: 'success',
  void: 'neutral',
};

export const PAYMENT_METHOD_LABEL: Labels<PaymentMethod> = {
  cash: { en: 'Cash', ckb: 'نەختینە', ar: 'نقداً' },
  card: { en: 'Card', ckb: 'کارت', ar: 'بطاقة' },
  insurance: { en: 'Insurance', ckb: 'بیمە', ar: 'تأمين' },
  transfer: { en: 'Bank transfer', ckb: 'گواستنەوەی بانکی', ar: 'تحويل مصرفي' },
};

export const CHARGE_CATEGORY_LABEL: Labels<ChargeCategory> = {
  consultation: { en: 'Consultation', ckb: 'سەردانی پزیشک', ar: 'استشارة' },
  bed: { en: 'Bed and nursing', ckb: 'جێگە و پەرستاری', ar: 'السرير والتمريض' },
  laboratory: { en: 'Laboratory', ckb: 'تاقیگە', ar: 'المختبر' },
  imaging: { en: 'Imaging', ckb: 'وێنەگرتن', ar: 'التصوير' },
  pharmacy: { en: 'Pharmacy', ckb: 'دەرمانخانە', ar: 'الصيدلية' },
  procedure: { en: 'Procedure', ckb: 'نەشتەرگەری و کردار', ar: 'إجراء' },
  theatre: { en: 'Operating theatre', ckb: 'هۆڵی نەشتەرگەری', ar: 'صالة العمليات' },
  supplies: { en: 'Supplies', ckb: 'پێداویستی', ar: 'مستلزمات' },
};
