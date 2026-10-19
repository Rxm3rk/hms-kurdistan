/**
 * The patient front door: WhatsApp, Viber and SMS message templates in Sorani, Arabic and English, the
 * outbound queue (appointment reminders, results ready, payment requests) with delivery statuses, and the
 * secure links (booking, wallet payment, report download by OTP or expiring link) with their audit trail.
 * Phone numbers are the obviously fake +964 750 000 …; every message is invented.
 * SYNTHETIC DATA ONLY, NOT FOR CLINICAL USE.
 */
import { DEMO_NOW } from '../clock.ts';
import type { Text3 } from '../types.ts';
import { T, patientAt } from './mi-common.ts';

export type Channel = 'whatsapp' | 'viber' | 'sms';
export type TemplateKind = 'reminder' | 'booking' | 'payment' | 'result' | 'otp' | 'discharge' | 'noshow';
export type TemplateApproval = 'approved' | 'pending' | 'rejected';

export interface MessageTemplate {
  readonly id: string;
  readonly kind: TemplateKind;
  readonly name: Text3;
  /** Body per language with `{placeholders}` (ckb, ar and en are all patient-facing). */
  readonly body: Text3;
  readonly channels: readonly Channel[];
  /** WhatsApp Business template approval status. */
  readonly approval: TemplateApproval;
  readonly variables: readonly string[];
}

export const TEMPLATES: readonly MessageTemplate[] = [
  {
    id: 'TPL-REM-24', kind: 'reminder', channels: ['whatsapp', 'viber', 'sms'], approval: 'approved', variables: ['name', 'clinic', 'date', 'time', 'doctor'],
    name: T('Appointment reminder, 24 h before', 'بیرخستنەوەی کات، 24 کاتژمێر پێش', 'تذكير بالموعد قبل 24 ساعة'),
    body: T(
      'Hello {name}, this is a reminder of your appointment at the {clinic} on {date} at {time} with {doctor}. Reply 1 to confirm or 2 to change. Demo Teaching Hospital, Erbil.',
      'سڵاو {name}، ئەمە بیرخستنەوەی کاتی چاوپێکەوتنتە لە {clinic} لە {date} کاتژمێر {time} لەگەڵ {doctor}. بۆ پشتڕاستکردنەوە 1 بنێرە یان بۆ گۆڕین 2. نەخۆشخانەی فێرکاریی نموونەیی، هەولێر.',
      'مرحباً {name}، نذكّرك بموعدك في {clinic} يوم {date} الساعة {time} مع {doctor}. أرسل 1 للتأكيد أو 2 للتغيير. المستشفى التعليمي التجريبي، أربيل.',
    ),
  },
  {
    id: 'TPL-REM-2H', kind: 'reminder', channels: ['whatsapp', 'sms'], approval: 'approved', variables: ['name', 'time', 'room'],
    name: T('Same-day reminder, 2 h before', 'بیرخستنەوەی هەمان ڕۆژ، 2 کاتژمێر پێش', 'تذكير في اليوم نفسه قبل ساعتين'),
    body: T(
      '{name}, your appointment is today at {time}, room {room}. Please arrive 15 minutes early and bring your ID card.',
      '{name}، کاتی چاوپێکەوتنت ئەمڕۆیە کاتژمێر {time}، ژووری {room}. تکایە 15 خولەک زووتر وەرە و ناسنامەکەت لەگەڵ خۆت بهێنە.',
      '{name}، موعدك اليوم الساعة {time}، الغرفة {room}. يرجى الحضور قبل 15 دقيقة وإحضار بطاقة الهوية.',
    ),
  },
  {
    id: 'TPL-BOOK', kind: 'booking', channels: ['whatsapp', 'viber'], approval: 'approved', variables: ['name', 'link'],
    name: T('Online booking link', 'بەستەری کات گرتنی ئۆنلاین', 'رابط الحجز الإلكتروني'),
    body: T(
      'Hello {name}, book or change your appointment here: {link}. The link is personal; do not share it.',
      'سڵاو {name}، لێرە کات بگرە یان بیگۆڕە: {link}. بەستەرەکە تایبەتە بە تۆ؛ لەگەڵ کەس بەشی مەکە.',
      'مرحباً {name}، احجز موعدك أو غيّره من هنا: {link}. الرابط شخصي؛ لا تشاركه.',
    ),
  },
  {
    id: 'TPL-PAY', kind: 'payment', channels: ['whatsapp', 'sms'], approval: 'approved', variables: ['name', 'amount', 'link', 'expires'],
    name: T('Deposit or bill payment link (FIB, FastPay, ZainCash)', 'بەستەری پارەدان (FIB، FastPay، ZainCash)', 'رابط الدفع (FIB، FastPay، ZainCash)'),
    body: T(
      '{name}, an amount of {amount} is due. Pay securely with your wallet: {link} (valid until {expires}). Keep the receipt number.',
      '{name}، بڕی {amount} ماوە. بە جزدانەکەت بە سەلامەتی بیدە: {link} (بەکاردێت تا {expires}). ژمارەی پسوولەکە بپارێزە.',
      '{name}، مبلغ {amount} مستحق. ادفع بأمان عبر محفظتك: {link} (صالح حتى {expires}). احتفظ برقم الإيصال.',
    ),
  },
  {
    id: 'TPL-RES', kind: 'result', channels: ['whatsapp', 'viber', 'sms'], approval: 'approved', variables: ['name', 'link'],
    name: T('Report ready for download', 'ڕاپۆرت ئامادەیە بۆ داگرتن', 'التقرير جاهز للتنزيل'),
    body: T(
      '{name}, your report is ready. Open {link} and enter the code sent to this phone. The link expires in 72 hours.',
      '{name}، ڕاپۆرتەکەت ئامادەیە. {link} بکەرەوە و ئەو کۆدەی بۆ ئەم تەلەفۆنە نێردراوە بنووسە. بەستەرەکە دوای 72 کاتژمێر بەسەردەچێت.',
      '{name}، تقريرك جاهز. افتح {link} وأدخل الرمز المرسل إلى هذا الهاتف. ينتهي الرابط بعد 72 ساعة.',
    ),
  },
  {
    id: 'TPL-OTP', kind: 'otp', channels: ['sms', 'whatsapp'], approval: 'approved', variables: ['code'],
    name: T('One-time code', 'کۆدی یەکجاری', 'رمز لمرة واحدة'),
    body: T(
      'Your Demo Teaching Hospital code is {code}. It is valid for 5 minutes. Staff will never ask you for this code.',
      'کۆدی نەخۆشخانەی فێرکاریی نموونەیی بۆ تۆ {code}یە. بۆ 5 خولەک بەکاردێت. ستاف هەرگیز داوای ئەم کۆدەت لێ ناکات.',
      'رمزك من المستشفى التعليمي التجريبي هو {code}. صالح لمدة 5 دقائق. لن يطلب منك الموظفون هذا الرمز أبداً.',
    ),
  },
  {
    id: 'TPL-DIS', kind: 'discharge', channels: ['whatsapp', 'viber'], approval: 'pending', variables: ['name', 'date', 'clinic'],
    name: T('Discharge follow-up', 'بەدواداچوونی دوای دەرچوون', 'متابعة بعد الخروج'),
    body: T(
      '{name}, we hope you are recovering well. Your follow-up visit is on {date} at the {clinic}. Call 0750 000 0000 if you feel worse.',
      '{name}، هیوادارین باش چاک ببیتەوە. سەردانی بەدواداچوونت لە {date} لە {clinic}یە. ئەگەر خراپتر بوویت پەیوەندی بە 0750 000 0000 بکە.',
      '{name}، نتمنى لك الشفاء العاجل. موعد المتابعة يوم {date} في {clinic}. اتصل على 0750 000 0000 إذا ساءت حالتك.',
    ),
  },
  {
    id: 'TPL-NOSHOW', kind: 'noshow', channels: ['sms'], approval: 'rejected', variables: ['name', 'link'],
    name: T('Missed appointment', 'کاتی لەدەستچوو', 'موعد فائت'),
    body: T(
      '{name}, we missed you today. Book a new time here: {link}.',
      '{name}، ئەمڕۆ نەهاتیت. لێرە کاتێکی نوێ بگرە: {link}.',
      '{name}، لم تحضر اليوم. احجز موعداً جديداً من هنا: {link}.',
    ),
  },
];

// ---------------------------------------------------------------------------------------------------------
// Outbound queue
// ---------------------------------------------------------------------------------------------------------

export type DeliveryStatus = 'scheduled' | 'queued' | 'sent' | 'delivered' | 'read' | 'replied' | 'failed' | 'opted-out';

export interface OutboundMessage {
  readonly id: string;
  readonly patientId: string;
  readonly templateId: string;
  readonly channel: Channel;
  readonly language: 'ckb' | 'ar' | 'en';
  readonly scheduledIso: string;
  readonly status: DeliveryStatus;
  readonly statusIso: string;
  /** Delivery failure reason or the patient's reply. */
  readonly detail: Text3 | null;
  /** What the message is about (appointment, invoice, report). */
  readonly about: Text3;
}

const mins = (m: number): string => new Date(DEMO_NOW.getTime() + m * 60_000).toISOString();

const Q: readonly [number, string, Channel, OutboundMessage['language'], number, DeliveryStatus, number, Text3 | null, Text3][] = [
  [0, 'TPL-REM-24', 'whatsapp', 'ckb', -780, 'read', -760, null, T('Internal Medicine Clinic, 20 Oct 10:00', 'نۆرینگەی ناوەکی، 20 تشرینی یەکەم 10:00', 'عيادة الباطنية، 20 تشرين الأول 10:00')],
  [1, 'TPL-REM-24', 'whatsapp', 'ckb', -780, 'replied', -700, T('Replied 1: confirmed', 'وەڵامی 1: پشتڕاستکرایەوە', 'رد 1: مؤكد'), T('Cardiology Clinic, 20 Oct 09:30', 'نۆرینگەی دڵ، 20 تشرینی یەکەم 09:30', 'عيادة القلب، 20 تشرين الأول 09:30')],
  [2, 'TPL-REM-24', 'viber', 'ar', -780, 'delivered', -778, null, T('Diabetes Clinic, 20 Oct 11:15', 'نۆرینگەی شەکرە، 20 تشرینی یەکەم 11:15', 'عيادة السكري، 20 تشرين الأول 11:15')],
  [3, 'TPL-REM-24', 'sms', 'ckb', -780, 'failed', -779, T('Number unreachable (operator code 30)', 'ژمارەکە بەردەست نییە (کۆدی 30)', 'الرقم غير متاح (رمز المشغل 30)'), T('Surgical Clinic, 20 Oct 12:00', 'نۆرینگەی نەشتەرگەری، 20 تشرینی یەکەم 12:00', 'عيادة الجراحة، 20 تشرين الأول 12:00')],
  [4, 'TPL-REM-2H', 'whatsapp', 'ckb', -75, 'read', -60, null, T('Internal Medicine Clinic, today 11:00', 'نۆرینگەی ناوەکی، ئەمڕۆ 11:00', 'عيادة الباطنية، اليوم 11:00')],
  [5, 'TPL-REM-2H', 'sms', 'ar', -50, 'delivered', -49, null, T('Paediatric Clinic, today 11:30', 'نۆرینگەی منداڵان، ئەمڕۆ 11:30', 'عيادة الأطفال، اليوم 11:30')],
  [6, 'TPL-REM-2H', 'whatsapp', 'ckb', 30, 'scheduled', 30, null, T('Cardiology Clinic, today 12:00', 'نۆرینگەی دڵ، ئەمڕۆ 12:00', 'عيادة القلب، اليوم 12:00')],
  [7, 'TPL-REM-2H', 'whatsapp', 'en', 60, 'scheduled', 60, null, T('Surgical Clinic, today 12:30', 'نۆرینگەی نەشتەرگەری، ئەمڕۆ 12:30', 'عيادة الجراحة، اليوم 12:30')],
  [8, 'TPL-RES', 'whatsapp', 'ckb', -40, 'read', -32, null, T('Lab report SYN-SPC-260014', 'ڕاپۆرتی تاقیگە SYN-SPC-260014', 'تقرير مختبر SYN-SPC-260014')],
  [9, 'TPL-RES', 'viber', 'ckb', -25, 'sent', -25, null, T('Radiology report, chest X-ray', 'ڕاپۆرتی تیشک، تیشکی سنگ', 'تقرير أشعة، صورة صدر')],
  [10, 'TPL-PAY', 'whatsapp', 'ar', -120, 'read', -100, null, T('Deposit IQD 1,000,000', 'بارمتە 1,000,000 دینار', 'تأمين 1,000,000 دينار')],
  [11, 'TPL-PAY', 'sms', 'ckb', -15, 'delivered', -14, null, T('Invoice SYN-INV-8821, IQD 245,000', 'پسوولەی SYN-INV-8821، 245,000 دینار', 'فاتورة SYN-INV-8821، 245,000 دينار')],
  [12, 'TPL-OTP', 'sms', 'ckb', -8, 'delivered', -8, null, T('Report download code', 'کۆدی داگرتنی ڕاپۆرت', 'رمز تنزيل التقرير')],
  [13, 'TPL-REM-24', 'whatsapp', 'ckb', -780, 'opted-out', -780, T('Patient opted out of WhatsApp messages', 'نەخۆش نامەی WhatsApp ی ڕەتکردووەتەوە', 'ألغى المريض الاشتراك في رسائل واتساب'), T('Internal Medicine Clinic, 20 Oct 13:00', 'نۆرینگەی ناوەکی، 20 تشرینی یەکەم 13:00', 'عيادة الباطنية، 20 تشرين الأول 13:00')],
  [14, 'TPL-BOOK', 'whatsapp', 'ckb', -200, 'read', -190, null, T('Follow-up booking', 'کات گرتنی بەدواداچوون', 'حجز متابعة')],
  [15, 'TPL-REM-24', 'viber', 'ckb', 240, 'queued', 240, null, T('Diabetes Clinic, 20 Oct 14:00', 'نۆرینگەی شەکرە، 20 تشرینی یەکەم 14:00', 'عيادة السكري، 20 تشرين الأول 14:00')],
  [16, 'TPL-REM-24', 'whatsapp', 'ar', 240, 'queued', 240, null, T('Cardiology Clinic, 20 Oct 14:30', 'نۆرینگەی دڵ، 20 تشرینی یەکەم 14:30', 'عيادة القلب، 20 تشرين الأول 14:30')],
  [17, 'TPL-PAY', 'whatsapp', 'en', -300, 'failed', -299, T('WhatsApp: recipient not on WhatsApp', 'WhatsApp: وەرگر لە WhatsApp نییە', 'واتساب: المستلم غير مسجل في واتساب'), T('Deposit USD 750.00', 'بارمتە 750.00 دۆلار', 'تأمين 750.00 دولار')],
  [18, 'TPL-RES', 'sms', 'ar', -400, 'delivered', -399, null, T('Lab report SYN-SPC-260009', 'ڕاپۆرتی تاقیگە SYN-SPC-260009', 'تقرير مختبر SYN-SPC-260009')],
  [19, 'TPL-REM-24', 'whatsapp', 'ckb', -780, 'replied', -650, T('Replied 2: asks to change', 'وەڵامی 2: داوای گۆڕین دەکات', 'رد 2: يطلب التغيير'), T('Paediatric Clinic, 20 Oct 10:30', 'نۆرینگەی منداڵان، 20 تشرینی یەکەم 10:30', 'عيادة الأطفال، 20 تشرين الأول 10:30')],
  [20, 'TPL-DIS', 'whatsapp', 'ckb', 120, 'scheduled', 120, null, T('Discharge follow-up, Surgical Ward B', 'بەدواداچوونی دەرچوون، قاوشی نەشتەرگەری B', 'متابعة بعد الخروج، ردهة الجراحة B')],
];

export const OUTBOX: readonly OutboundMessage[] = Q.map(([patient, templateId, channel, language, at, status, statusAt, detail, about], index) => ({
  id: `SYN-MSG-${String(70120 + index)}`,
  patientId: patientAt(patient * 2 + 1).id,
  templateId,
  channel,
  language,
  scheduledIso: mins(at),
  status,
  statusIso: mins(statusAt),
  detail,
  about,
}));

// ---------------------------------------------------------------------------------------------------------
// Secure links (booking, wallet payment, report download)
// ---------------------------------------------------------------------------------------------------------

export type LinkKind = 'booking' | 'payment' | 'report';
export type LinkStatus = 'active' | 'used' | 'expired' | 'revoked';
export type LinkAccess = 'otp' | 'expiring';

export interface LinkEvent {
  readonly iso: string;
  readonly event: 'created' | 'sent' | 'opened' | 'otp-sent' | 'otp-ok' | 'otp-failed' | 'downloaded' | 'paid' | 'booked' | 'expired' | 'revoked';
  /** IP or device, synthetic. */
  readonly device: string | null;
}

export interface SecureLink {
  readonly id: string;
  readonly kind: LinkKind;
  readonly patientId: string;
  readonly access: LinkAccess;
  readonly createdIso: string;
  readonly expiresIso: string;
  readonly status: LinkStatus;
  readonly url: string;
  readonly about: Text3;
  /** For payment links: amount and currency; wallet used once paid. */
  readonly amount: number | null;
  readonly currency: 'IQD' | 'USD' | null;
  readonly wallet: string | null;
  readonly events: readonly LinkEvent[];
}

const ev = (m: number, event: LinkEvent['event'], device: string | null = null): LinkEvent => ({ iso: mins(m), event, device });

export const LINKS: readonly SecureLink[] = [
  { id: 'LNK-7Q2KD', kind: 'report', patientId: patientAt(17).id, access: 'otp', createdIso: mins(-40), expiresIso: mins(-40 + 72 * 60), status: 'used', url: 'https://demo.hms.krd/r/7Q2KD', about: T('Lab report SYN-SPC-260014', 'ڕاپۆرتی تاقیگە SYN-SPC-260014', 'تقرير مختبر SYN-SPC-260014'), amount: null, currency: null, wallet: null,
    events: [ev(-40, 'created'), ev(-40, 'sent'), ev(-33, 'opened', 'Android · Asiacell 4G'), ev(-33, 'otp-sent'), ev(-32, 'otp-ok', 'Android · Asiacell 4G'), ev(-31, 'downloaded', 'Android · Asiacell 4G')] },
  { id: 'LNK-M8X1P', kind: 'report', patientId: patientAt(19).id, access: 'otp', createdIso: mins(-25), expiresIso: mins(-25 + 72 * 60), status: 'active', url: 'https://demo.hms.krd/r/M8X1P', about: T('Radiology report, chest X-ray', 'ڕاپۆرتی تیشک، تیشکی سنگ', 'تقرير أشعة، صورة صدر'), amount: null, currency: null, wallet: null,
    events: [ev(-25, 'created'), ev(-25, 'sent'), ev(-12, 'opened', 'iPhone · Korek 4G'), ev(-12, 'otp-sent'), ev(-11, 'otp-failed', 'iPhone · Korek 4G')] },
  { id: 'LNK-3HT9A', kind: 'payment', patientId: patientAt(21).id, access: 'expiring', createdIso: mins(-120), expiresIso: mins(24 * 60), status: 'used', url: 'https://demo.hms.krd/p/3HT9A', about: T('Admission deposit', 'بارمتەی خەواندن', 'تأمين الإدخال'), amount: 1_000_000, currency: 'IQD', wallet: 'FIB',
    events: [ev(-120, 'created'), ev(-120, 'sent'), ev(-101, 'opened', 'Android · Zain 4G'), ev(-98, 'paid', 'FIB wallet')] },
  { id: 'LNK-Z4R6W', kind: 'payment', patientId: patientAt(23).id, access: 'expiring', createdIso: mins(-15), expiresIso: mins(48 * 60), status: 'active', url: 'https://demo.hms.krd/p/Z4R6W', about: T('Invoice SYN-INV-8821', 'پسوولەی SYN-INV-8821', 'فاتورة SYN-INV-8821'), amount: 245_000, currency: 'IQD', wallet: null,
    events: [ev(-15, 'created'), ev(-15, 'sent')] },
  { id: 'LNK-B1N7C', kind: 'payment', patientId: patientAt(35).id, access: 'expiring', createdIso: mins(-300), expiresIso: mins(-300 + 24 * 60), status: 'active', url: 'https://demo.hms.krd/p/B1N7C', about: T('Deposit, international patient', 'بارمتە، نەخۆشی بیانی', 'تأمين، مريض دولي'), amount: 750, currency: 'USD', wallet: null,
    events: [ev(-300, 'created'), ev(-299, 'sent')] },
  { id: 'LNK-K9D2E', kind: 'booking', patientId: patientAt(29).id, access: 'expiring', createdIso: mins(-200), expiresIso: mins(7 * 24 * 60), status: 'used', url: 'https://demo.hms.krd/b/K9D2E', about: T('Follow-up booking', 'کات گرتنی بەدواداچوون', 'حجز متابعة'), amount: null, currency: null, wallet: null,
    events: [ev(-200, 'created'), ev(-200, 'sent'), ev(-185, 'opened', 'Android · Asiacell 4G'), ev(-183, 'booked')] },
  { id: 'LNK-P5S8L', kind: 'report', patientId: patientAt(37).id, access: 'otp', createdIso: mins(-400), expiresIso: mins(-400 + 72 * 60), status: 'used', url: 'https://demo.hms.krd/r/P5S8L', about: T('Lab report SYN-SPC-260009', 'ڕاپۆرتی تاقیگە SYN-SPC-260009', 'تقرير مختبر SYN-SPC-260009'), amount: null, currency: null, wallet: null,
    events: [ev(-400, 'created'), ev(-399, 'sent'), ev(-220, 'opened', 'Windows · home Wi-Fi'), ev(-220, 'otp-sent'), ev(-219, 'otp-ok', 'Windows · home Wi-Fi'), ev(-219, 'downloaded', 'Windows · home Wi-Fi')] },
  { id: 'LNK-E2W4Y', kind: 'report', patientId: patientAt(41).id, access: 'expiring', createdIso: mins(-5000), expiresIso: mins(-5000 + 72 * 60), status: 'expired', url: 'https://demo.hms.krd/r/E2W4Y', about: T('Discharge summary', 'پوختەی دەرچوون', 'ملخص الخروج'), amount: null, currency: null, wallet: null,
    events: [ev(-5000, 'created'), ev(-5000, 'sent'), ev(-5000 + 72 * 60, 'expired')] },
  { id: 'LNK-H6J3T', kind: 'report', patientId: patientAt(43).id, access: 'otp', createdIso: mins(-1500), expiresIso: mins(-1500 + 72 * 60), status: 'revoked', url: 'https://demo.hms.krd/r/H6J3T', about: T('Pathology report', 'ڕاپۆرتی پاسۆلۆجی', 'تقرير علم الأمراض'), amount: null, currency: null, wallet: null,
    events: [ev(-1500, 'created'), ev(-1500, 'sent'), ev(-1400, 'opened', 'Android · unknown network'), ev(-1400, 'otp-failed', 'Android · unknown network'), ev(-1399, 'otp-failed', 'Android · unknown network'), ev(-1398, 'otp-failed', 'Android · unknown network'), ev(-1390, 'revoked')] },
  { id: 'LNK-R7V1M', kind: 'booking', patientId: patientAt(45).id, access: 'expiring', createdIso: mins(-60), expiresIso: mins(7 * 24 * 60), status: 'active', url: 'https://demo.hms.krd/b/R7V1M', about: T('New patient booking, Cardiology', 'کات گرتنی نەخۆشی نوێ، دڵ', 'حجز مريض جديد، القلب'), amount: null, currency: null, wallet: null,
    events: [ev(-60, 'created'), ev(-60, 'sent'), ev(-48, 'opened', 'iPhone · Korek 4G')] },
  { id: 'LNK-C3F8Q', kind: 'payment', patientId: patientAt(47).id, access: 'expiring', createdIso: mins(-90), expiresIso: mins(22 * 60), status: 'used', url: 'https://demo.hms.krd/p/C3F8Q', about: T('Pharmacy bill', 'پسوولەی دەرمانخانە', 'فاتورة الصيدلية'), amount: 86_500, currency: 'IQD', wallet: 'FastPay',
    events: [ev(-90, 'created'), ev(-90, 'sent'), ev(-70, 'opened', 'Android · Zain 4G'), ev(-69, 'paid', 'FastPay wallet')] },
  { id: 'LNK-W2A5N', kind: 'payment', patientId: patientAt(49).id, access: 'expiring', createdIso: mins(-45), expiresIso: mins(23 * 60), status: 'used', url: 'https://demo.hms.krd/p/W2A5N', about: T('Outpatient consultation', 'پشکنینی نۆرینگە', 'استشارة عيادة خارجية'), amount: 35_000, currency: 'IQD', wallet: 'ZainCash',
    events: [ev(-45, 'created'), ev(-45, 'sent'), ev(-41, 'opened', 'Android · Zain 4G'), ev(-40, 'paid', 'ZainCash wallet')] },
];

/** Messages sent per day, last 7 days (oldest first): delivered and failed. */
export const DELIVERY_WEEK: readonly { readonly date: string; readonly delivered: number; readonly failed: number; readonly whatsapp: number; readonly viber: number; readonly sms: number }[] = [
  { date: '2026-10-13', delivered: 412, failed: 9, whatsapp: 288, viber: 61, sms: 72 },
  { date: '2026-10-14', delivered: 436, failed: 12, whatsapp: 301, viber: 66, sms: 81 },
  { date: '2026-10-15', delivered: 405, failed: 7, whatsapp: 279, viber: 58, sms: 75 },
  { date: '2026-10-16', delivered: 96, failed: 2, whatsapp: 70, viber: 11, sms: 17 },
  { date: '2026-10-17', delivered: 214, failed: 6, whatsapp: 151, viber: 29, sms: 40 },
  { date: '2026-10-18', delivered: 448, failed: 11, whatsapp: 318, viber: 63, sms: 78 },
  { date: '2026-10-19', delivered: 131, failed: 3, whatsapp: 95, viber: 17, sms: 22 },
];
