/**
 * A sample of the patient-record access log (who opened which patient's record, when, where and why) and the
 * shape of this session's own audit events. SYNTHETIC: invented staff, patients and workstations.
 */
import { daysAgoAt, todayAt } from '../../data/index.ts';
import type { Text3, Tone } from '../../data/index.ts';

const T = (en: string, ckb: string, ar: string): Text3 => ({ en, ckb, ar });

export type AccessAction = 'view' | 'update' | 'print' | 'emergency';
export type AccessPurpose = 'care' | 'registration' | 'pharmacy' | 'billing' | 'lab' | 'discharge' | 'emergency';

export const ACCESS_ACTION_LABEL: Readonly<Record<AccessAction, Text3>> = {
  view: T('Viewed', 'بینی', 'اطّلع'),
  update: T('Recorded', 'تۆماری کرد', 'سجّل'),
  print: T('Printed', 'چاپی کرد', 'طبع'),
  emergency: T('Emergency access', 'دەستگەیشتنی فریاکەوتن', 'وصول طارئ'),
};

export const ACCESS_PURPOSE_LABEL: Readonly<Record<AccessPurpose, Text3>> = {
  care: T('Direct care', 'چاودێریی ڕاستەوخۆ', 'رعاية مباشرة'),
  registration: T('Registration', 'تۆمارکردن', 'التسجيل'),
  pharmacy: T('Medication review', 'پێداچوونەوەی دەرمان', 'مراجعة الأدوية'),
  billing: T('Billing', 'پسوولەکردن', 'الفوترة'),
  lab: T('Laboratory', 'تاقیگە', 'المختبر'),
  discharge: T('Discharge planning', 'پلانی دەرچوون', 'التخطيط للخروج'),
  emergency: T('Emergency, reason given', 'فریاکەوتن، هۆکار نووسراوە', 'طارئ، مع ذكر السبب'),
};

export interface AccessEvent {
  readonly id: string;
  readonly iso: string;
  readonly actorId: string;
  readonly patientId: string;
  readonly action: AccessAction;
  /** The part of the record. */
  readonly area: Text3;
  readonly purpose: AccessPurpose;
  readonly workstation: string;
  /** The reason typed for an emergency access. */
  readonly reason: Text3 | null;
}

const AREA = {
  lab: T('Laboratory results', 'ئەنجامەکانی تاقیگە', 'نتائج المختبر'),
  registration: T('Registration and arrival', 'تۆمار و هاتن', 'التسجيل والوصول'),
  orders: T('Orders', 'داواکارییەکان', 'الطلبات'),
  billing: T('Bill', 'پسوولە', 'الفاتورة'),
  mar: T('Medication chart', 'خشتەی دەرمان', 'سجل الأدوية'),
  chart: T('Patient chart', 'دۆسیەی نەخۆش', 'ملف المريض'),
  note: T('Progress note (draft)', 'تێبینیی ڕەوتی چارەسەر (ڕەشنووس)', 'ملاحظة متابعة (مسودة)'),
  dose: T('Dose given (insulin, witnessed)', 'دانی ژەم (ئەنسولین، بە شایەت)', 'إعطاء جرعة (أنسولين، بحضور شاهد)'),
  verify: T('Result verified (critical)', 'پشتڕاستکردنەوەی ئەنجام (مەترسیدار)', 'التحقق من النتيجة (حرجة)'),
  wristband: T('Wristband reprint', 'دووبارە چاپکردنی بازنەی دەست', 'إعادة طباعة سوار المعصم'),
} as const;

/** Newest first. */
export const ACCESS_EVENTS: readonly AccessEvent[] = [
  { id: 'SYN-ACC-0112', iso: todayAt('09:29'), actorId: 'SYN-STF-001', patientId: 'SYN-PAT-0102', action: 'view', area: AREA.lab, purpose: 'care', workstation: 'WS-MEDA-02', reason: null },
  { id: 'SYN-ACC-0111', iso: todayAt('09:26'), actorId: 'SYN-STF-018', patientId: 'SYN-PAT-0114', action: 'update', area: AREA.registration, purpose: 'registration', workstation: 'OPD-RECEPTION-1', reason: null },
  { id: 'SYN-ACC-0110', iso: todayAt('09:21'), actorId: 'SYN-STF-012', patientId: 'SYN-PAT-0101', action: 'view', area: AREA.orders, purpose: 'pharmacy', workstation: 'PHARM-01', reason: null },
  { id: 'SYN-ACC-0109', iso: todayAt('09:15'), actorId: 'SYN-STF-003', patientId: 'SYN-PAT-0110', action: 'view', area: AREA.billing, purpose: 'billing', workstation: 'CASH-01', reason: null },
  { id: 'SYN-ACC-0108', iso: todayAt('09:06'), actorId: 'SYN-STF-002', patientId: 'SYN-PAT-0102', action: 'view', area: AREA.mar, purpose: 'care', workstation: 'WS-MEDA-01', reason: null },
  { id: 'SYN-ACC-0107', iso: todayAt('09:00'), actorId: 'SYN-STF-016', patientId: 'SYN-PAT-0108', action: 'view', area: AREA.chart, purpose: 'care', workstation: 'OPD-2', reason: null },
  { id: 'SYN-ACC-0106', iso: todayAt('08:58'), actorId: 'SYN-STF-008', patientId: 'SYN-PAT-0112', action: 'update', area: AREA.note, purpose: 'care', workstation: 'WS-MEDA-03', reason: null },
  { id: 'SYN-ACC-0105', iso: todayAt('08:40'), actorId: 'SYN-STF-005', patientId: 'SYN-PAT-0106', action: 'view', area: AREA.chart, purpose: 'discharge', workstation: 'WS-SURGB-01', reason: null },
  { id: 'SYN-ACC-0104', iso: todayAt('08:12'), actorId: 'SYN-STF-010', patientId: 'SYN-PAT-0101', action: 'update', area: AREA.dose, purpose: 'care', workstation: 'WS-MEDA-01', reason: null },
  { id: 'SYN-ACC-0103', iso: todayAt('08:10'), actorId: 'SYN-STF-011', patientId: 'SYN-PAT-0102', action: 'update', area: AREA.verify, purpose: 'lab', workstation: 'LAB-02', reason: null },
  { id: 'SYN-ACC-0102', iso: todayAt('07:50'), actorId: 'SYN-STF-009', patientId: 'SYN-PAT-0110', action: 'print', area: AREA.wristband, purpose: 'care', workstation: 'WS-SURGB-02', reason: null },
  {
    id: 'SYN-ACC-0101',
    iso: daysAgoAt(1, '23:48'),
    actorId: 'SYN-STF-019',
    patientId: 'SYN-PAT-0109',
    action: 'emergency',
    area: AREA.chart,
    purpose: 'emergency',
    workstation: 'WS-MEDA-01',
    reason: T(
      'Called to help at a cardiac arrest call in ICU; the ICU nurse was busy with the resuscitation',
      'بانگ کرام بۆ یارمەتی لە حاڵەتێکی وەستانی دڵ لە ICU؛ پەرستاری ICU سەرقاڵی زیندووکردنەوە بوو',
      'استُدعيت للمساعدة في حالة توقف قلب في العناية المركزة؛ كانت ممرضة العناية منشغلة بالإنعاش',
    ),
  },
];

/** The kinds of audit event this session can add. */
export type SessionEventKind = 'config-saved' | 'config-refused' | 'rule-off' | 'rule-on' | 'access-reviewed' | 'export';

export interface SessionEvent {
  readonly id: string;
  readonly iso: string;
  readonly actorId: string;
  readonly kind: SessionEventKind;
  /** The setting or rule, or the patient-access entry. */
  readonly subject: Text3;
  /** The configuration level, or null. */
  readonly detail: Text3 | null;
  /** The new value, or null. */
  readonly value: Text3 | null;
  /** The reason the user typed (switching a rule off), or null. */
  readonly reason: string | null;
  readonly target: string | null;
  readonly tone: Tone;
}
