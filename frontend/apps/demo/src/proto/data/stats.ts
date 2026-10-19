/**
 * Hospital figures for dashboards: today's key figures (computed from the data) and seven-day trends
 * (synthetic series), plus the administration audit log. SYNTHETIC DATA ONLY.
 */
import { demoDate, daysAgoAt, todayAt } from './clock.ts';
import { APPOINTMENTS, ENCOUNTERS } from './encounters.ts';
import { unacknowledgedCriticals } from './lab.ts';
import { MAR, ORDERS } from './orders.ts';
import { bedCounts, occupancy } from './wards.ts';
import { cashTodayByCurrency } from './billing.ts';
import type { AuditEvent, Text3 } from './types.ts';

const T = (en: string, ckb: string, ar: string): Text3 => ({ en, ckb, ar });

/** The seven days of the trends, oldest first: 13 to 19 October 2026 (Friday 16 and Saturday 17 are the weekend). */
export const TREND_DAYS: readonly string[] = [6, 5, 4, 3, 2, 1, 0].map((daysAgo) => demoDate(daysAgo));

/** Seven-day series, oldest first; the last value is today so far (09:30). */
export const TRENDS = {
  admissions: [21, 24, 19, 14, 12, 23, 6],
  discharges: [19, 22, 20, 11, 9, 18, 2],
  outpatientVisits: [148, 156, 151, 12, 31, 162, 47],
  emergencyAttendances: [96, 88, 102, 121, 117, 94, 31],
  occupancyPct: [81, 84, 86, 83, 79, 85, 76],
  /** Cash and card receipts, in thousands of dinars. */
  revenueThousandIqd: [18_450, 21_300, 19_875, 6_200, 5_900, 22_640, 4_310],
  averageLengthOfStayDays: ['4.1', '4.0', '4.3', '4.4', '4.2', '3.9', '4.0'],
} as const;

/** Today's key figures at 09:30, computed from the data. */
export function todaysFigures() {
  const beds = bedCounts();
  const cash = cashTodayByCurrency();
  return {
    beds,
    occupancyPct: Math.round(occupancy() * 100),
    inpatients: ENCOUNTERS.filter((encounter) => encounter.type === 'inpatient' && encounter.status === 'active').length,
    expectedDischargesToday: ENCOUNTERS.filter(
      (encounter) => encounter.type === 'inpatient' && encounter.expectedDischargeOn === demoDate(0),
    ).length,
    appointmentsToday: APPOINTMENTS.filter((appointment) => appointment.status !== 'cancelled').length,
    waitingNow: APPOINTMENTS.filter((appointment) => appointment.status === 'arrived').length,
    criticalResultsUnacknowledged: unacknowledgedCriticals().length,
    ordersAwaitingSignature: ORDERS.filter((order) => order.status === 'pending-signature').length,
    dosesOverdue: MAR.filter((dose) => dose.status === 'overdue').length,
    dosesDueNow: MAR.filter((dose) => dose.status === 'due').length,
    cashTodayIqd: cash.IQD,
    cashTodayUsd: cash.USD,
  };
}

const RAW_AUDIT_EVENTS: readonly AuditEvent[] = [
  {
    id: 'SYN-AUD-0001',
    iso: todayAt('09:26'),
    actorId: 'SYN-STF-018',
    action: T('Registered arrival at the Surgical Clinic', 'هاتنی نەخۆشی لە نۆرینگەی نەشتەرگەری تۆمار کرد', 'سجّل وصول المريض إلى عيادة الجراحة'),
    target: 'SYN-PAT-0114',
    tone: 'neutral',
  },
  {
    id: 'SYN-AUD-0002',
    iso: todayAt('09:12'),
    actorId: 'SYN-STF-012',
    action: T(
      'Allergy alert raised on a drafted antibiotic order',
      'ئاگادارکردنەوەی هەستیاری لەسەر داواکارییەکی ڕەشنووسی دژەبەکتریا دەرکەوت',
      'ظهر تنبيه حساسية على طلب مضاد حيوي في المسودة',
    ),
    target: 'SYN-ORD-0102',
    tone: 'danger',
  },
  {
    id: 'SYN-AUD-0003',
    iso: todayAt('08:10'),
    actorId: 'SYN-STF-011',
    action: T('Verified a critical result (potassium 6.8 mmol/L)', 'ئەنجامێکی مەترسیداری پشتڕاست کردەوە (پۆتاسیۆم 6.8 mmol/L)', 'تحقق من نتيجة حرجة (بوتاسيوم 6.8 mmol/L)'),
    target: 'SYN-SPC-260001',
    tone: 'danger',
  },
  {
    id: 'SYN-AUD-0004',
    iso: todayAt('08:15'),
    actorId: 'SYN-STF-004',
    action: T('Signed in', 'چووە ژوورەوە', 'سجّل الدخول'),
    target: null,
    tone: 'neutral',
  },
  {
    id: 'SYN-AUD-0005',
    iso: todayAt('08:02'),
    actorId: 'SYN-STF-004',
    action: T('Confirmed the exchange rate: 1 USD = 1,310 IQD', 'نرخی ئاڵوگۆڕی پشتڕاست کردەوە: 1 دۆلار = 1,310 دینار', 'أكّد سعر الصرف: 1 دولار = 1,310 دينار'),
    target: null,
    tone: 'info',
  },
  {
    id: 'SYN-AUD-0006',
    iso: todayAt('07:31'),
    actorId: 'SYN-STF-004',
    action: T('Account locked after 5 failed sign-ins', 'هەژمار داخرا دوای 5 هەوڵی سەرنەکەوتووی چوونەژوورەوە', 'قُفل الحساب بعد 5 محاولات دخول فاشلة'),
    target: 'SYN-STF-020',
    tone: 'warning',
  },
  {
    id: 'SYN-AUD-0007',
    iso: daysAgoAt(1, '23:48'),
    actorId: 'SYN-STF-019',
    action: T(
      'Emergency access to a record outside own ward (reason given)',
      'دەستگەیشتنی فریاکەوتن بە دۆسیەیەک لە دەرەوەی قاوشی خۆی (هۆکار نووسرا)',
      'وصول طارئ إلى سجل خارج ردهته (مع ذكر السبب)',
    ),
    target: 'SYN-PAT-0109',
    tone: 'warning',
  },
  {
    id: 'SYN-AUD-0008',
    iso: todayAt('02:05'),
    actorId: 'SYN-STF-004',
    action: T('Nightly backup completed and verified', 'پاشەکەوتی شەوانە تەواو بوو و پشتڕاست کرایەوە', 'اكتمل النسخ الاحتياطي الليلي وتم التحقق منه'),
    target: null,
    tone: 'success',
  },
];

/** The audit log, newest first. */
export const AUDIT_EVENTS: readonly AuditEvent[] = RAW_AUDIT_EVENTS.toSorted((a, b) => b.iso.localeCompare(a.iso));
