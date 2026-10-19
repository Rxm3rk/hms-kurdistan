/**
 * The cashier's day: the dual-currency drawer, deposits and top-ups, running inpatient bills, discount
 * approvals, refunds, doctor-fee settlement and the per-currency shift close with a denomination count.
 * SYNTHETIC DATA ONLY. Amounts are whole Iraqi dinars or US dollars with cents; payer names are invented.
 */
import { daysAgoAt, todayAt } from '../clock.ts';
import type { Currency, Text3 } from '../types.ts';

const T = (en: string, ckb: string, ar: string): Text3 => ({ en, ckb, ar });

export const SHIFT = {
  id: 'SHIFT-26-1019-A',
  cashierId: 'SYN-STF-003',
  openedIso: todayAt('07:30'),
  counter: T('Main cashier, counter 2', 'سندوقی سەرەکی، کاونتەری 2', 'الصندوق الرئيسي، الكاونتر 2'),
  floatIqd: 2_000_000,
  floatUsd: 200,
} as const;

export type TxKind = 'deposit' | 'top-up' | 'payment' | 'refund' | 'doctor-fee' | 'exchange';
export type TxMethod = 'cash' | 'card' | 'transfer';

export interface CashTx {
  readonly id: string;
  readonly iso: string;
  readonly kind: TxKind;
  readonly patientId: string | null;
  readonly payee: Text3 | null;
  readonly currency: Currency;
  /** Positive into the drawer, negative out of it. */
  readonly amount: number;
  readonly method: TxMethod;
  readonly receipt: string;
}

export const CASH_TX: readonly CashTx[] = [
  { id: 'TX-01', iso: todayAt('07:42'), kind: 'deposit', patientId: 'SYN-PAT-0106', payee: null, currency: 'IQD', amount: 1_500_000, method: 'cash', receipt: 'SYN-RCT-26-30411' },
  { id: 'TX-02', iso: todayAt('07:58'), kind: 'payment', patientId: 'SYN-PAT-0233', payee: null, currency: 'IQD', amount: 85_000, method: 'cash', receipt: 'SYN-RCT-26-30412' },
  { id: 'TX-03', iso: todayAt('08:05'), kind: 'deposit', patientId: 'SYN-PAT-0111', payee: null, currency: 'USD', amount: 500, method: 'cash', receipt: 'SYN-RCT-26-30413' },
  { id: 'TX-04', iso: todayAt('08:12'), kind: 'payment', patientId: 'SYN-PAT-0234', payee: null, currency: 'IQD', amount: 45_000, method: 'card', receipt: 'SYN-RCT-26-30414' },
  { id: 'TX-05', iso: todayAt('08:20'), kind: 'top-up', patientId: 'SYN-PAT-0107', payee: null, currency: 'IQD', amount: 750_000, method: 'cash', receipt: 'SYN-RCT-26-30415' },
  { id: 'TX-06', iso: todayAt('08:31'), kind: 'refund', patientId: 'SYN-PAT-0212', payee: null, currency: 'IQD', amount: -120_000, method: 'cash', receipt: 'SYN-RCT-26-30416' },
  { id: 'TX-07', iso: todayAt('08:40'), kind: 'payment', patientId: 'SYN-PAT-0110', payee: null, currency: 'USD', amount: 240, method: 'cash', receipt: 'SYN-RCT-26-30417' },
  { id: 'TX-08', iso: todayAt('08:52'), kind: 'doctor-fee', patientId: null, payee: T('Dr. Hoshyar Khidir, visiting fees', 'د. هۆشیار خدر، کرێی سەردان', 'د. هوشيار خضر، أجور الزيارات'), currency: 'IQD', amount: -600_000, method: 'cash', receipt: 'SYN-RCT-26-30418' },
  { id: 'TX-09', iso: todayAt('09:03'), kind: 'payment', patientId: 'SYN-PAT-0235', payee: null, currency: 'IQD', amount: 60_000, method: 'cash', receipt: 'SYN-RCT-26-30419' },
  { id: 'TX-10', iso: todayAt('09:10'), kind: 'top-up', patientId: 'SYN-PAT-0109', payee: null, currency: 'USD', amount: 1000, method: 'transfer', receipt: 'SYN-RCT-26-30420' },
  { id: 'TX-11', iso: todayAt('09:18'), kind: 'payment', patientId: 'SYN-PAT-0236', payee: null, currency: 'IQD', amount: 132_500, method: 'cash', receipt: 'SYN-RCT-26-30421' },
  { id: 'TX-12', iso: todayAt('09:24'), kind: 'deposit', patientId: 'SYN-PAT-0110', payee: null, currency: 'IQD', amount: 2_000_000, method: 'cash', receipt: 'SYN-RCT-26-30422' },
];

// ---------------------------------------------------------------------------------------------------------
// Running inpatient bills
// ---------------------------------------------------------------------------------------------------------

export interface PayerOrg {
  readonly id: string;
  readonly name: Text3;
  readonly kind: 'self' | 'corporate' | 'insurer' | 'ngo';
}

export const PAYER_ORGS: readonly PayerOrg[] = [
  { id: 'PO-SELF', name: T('Self-pay', 'خۆی دەیدات', 'على نفقته'), kind: 'self' },
  { id: 'PO-KAR', name: T('Kar Oil Services staff plan (synthetic)', 'پلانی کارمەندانی کار ئۆیڵ (نموونە)', 'خطة موظفي كار أويل (تجريبي)'), kind: 'corporate' },
  { id: 'PO-ASIA', name: T('Asia Telecom employees (synthetic)', 'کارمەندانی ئاسیا تێلیکۆم (نموونە)', 'موظفو آسيا تيليكوم (تجريبي)'), kind: 'corporate' },
  { id: 'PO-KHI', name: T('Kurdistan Health Insurance (synthetic)', 'بیمەی تەندروستیی کوردستان (نموونە)', 'تأمين كوردستان الصحي (تجريبي)'), kind: 'insurer' },
  { id: 'PO-NGO', name: T('Hope for Duhok Foundation (NGO, synthetic)', 'دەزگای هیوا بۆ دهۆک (ڕێکخراو، نموونە)', 'مؤسسة الأمل لدهوك (منظمة، تجريبي)'), kind: 'ngo' },
];

export interface RunningBill {
  readonly patientId: string;
  readonly admittedIso: string;
  readonly payerId: string;
  /** Payer share of charges, 0 to 1. */
  readonly payerShare: number;
  readonly chargesIqd: number;
  readonly depositsIqd: number;
  /** Deposit level below which the ward is told to collect a top-up. */
  readonly thresholdIqd: number;
}

export const RUNNING_BILLS: readonly RunningBill[] = [
  { patientId: 'SYN-PAT-0101', admittedIso: daysAgoAt(2, '12:40'), payerId: 'PO-KHI', payerShare: 0.8, chargesIqd: 3_450_000, depositsIqd: 500_000, thresholdIqd: 300_000 },
  { patientId: 'SYN-PAT-0102', admittedIso: daysAgoAt(4, '15:05'), payerId: 'PO-SELF', payerShare: 0, chargesIqd: 6_820_000, depositsIqd: 5_000_000, thresholdIqd: 1_000_000 },
  { patientId: 'SYN-PAT-0105', admittedIso: daysAgoAt(1, '17:10'), payerId: 'PO-ASIA', payerShare: 0.9, chargesIqd: 2_100_000, depositsIqd: 250_000, thresholdIqd: 200_000 },
  { patientId: 'SYN-PAT-0106', admittedIso: daysAgoAt(1, '13:20'), payerId: 'PO-SELF', payerShare: 0, chargesIqd: 2_950_000, depositsIqd: 3_500_000, thresholdIqd: 1_000_000 },
  { patientId: 'SYN-PAT-0107', admittedIso: daysAgoAt(3, '16:45'), payerId: 'PO-SELF', payerShare: 0, chargesIqd: 8_400_000, depositsIqd: 6_750_000, thresholdIqd: 1_500_000 },
  { patientId: 'SYN-PAT-0109', admittedIso: daysAgoAt(2, '03:45'), payerId: 'PO-KAR', payerShare: 1, chargesIqd: 14_900_000, depositsIqd: 1_310_000, thresholdIqd: 0 },
  { patientId: 'SYN-PAT-0110', admittedIso: todayAt('03:10'), payerId: 'PO-SELF', payerShare: 0, chargesIqd: 1_850_000, depositsIqd: 2_000_000, thresholdIqd: 1_000_000 },
  { patientId: 'SYN-PAT-0111', admittedIso: daysAgoAt(1, '09:00'), payerId: 'PO-SELF', payerShare: 0, chargesIqd: 1_210_000, depositsIqd: 655_000, thresholdIqd: 500_000 },
  { patientId: 'SYN-PAT-0112', admittedIso: daysAgoAt(1, '22:15'), payerId: 'PO-NGO', payerShare: 0.6, chargesIqd: 2_600_000, depositsIqd: 400_000, thresholdIqd: 400_000 },
  { patientId: 'SYN-PAT-0103', admittedIso: daysAgoAt(1, '14:40'), payerId: 'PO-KHI', payerShare: 0.8, chargesIqd: 1_740_000, depositsIqd: 100_000, thresholdIqd: 200_000 },
  { patientId: 'SYN-PAT-0213', admittedIso: daysAgoAt(5, '10:20'), payerId: 'PO-SELF', payerShare: 0, chargesIqd: 5_300_000, depositsIqd: 3_000_000, thresholdIqd: 1_000_000 },
  { patientId: 'SYN-PAT-0228', admittedIso: daysAgoAt(6, '01:30'), payerId: 'PO-SELF', payerShare: 0, chargesIqd: 11_200_000, depositsIqd: 9_000_000, thresholdIqd: 2_000_000 },
];

// ---------------------------------------------------------------------------------------------------------
// Discounts, refunds, doctor fees
// ---------------------------------------------------------------------------------------------------------

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface DiscountRequest {
  readonly id: string;
  readonly patientId: string;
  readonly billIqd: number;
  readonly percent: number;
  readonly reason: Text3;
  readonly requestedById: string;
  readonly requestedIso: string;
  readonly status: ApprovalStatus;
}

export const DISCOUNTS: readonly DiscountRequest[] = [
  { id: 'DSC-0441', patientId: 'SYN-PAT-0107', billIqd: 8_400_000, percent: 15, reason: T('Family of a martyr (Peshmerga) – hospital policy', 'خێزانی شەهید (پێشمەرگە) – سیاسەتی نەخۆشخانە', 'عائلة شهيد (بيشمركة) – سياسة المستشفى'), requestedById: 'SYN-STF-018', requestedIso: todayAt('08:15'), status: 'pending' },
  { id: 'DSC-0442', patientId: 'SYN-PAT-0213', billIqd: 5_300_000, percent: 10, reason: T('Hardship: social worker assessment attached', 'هەژاری: هەڵسەنگاندنی توێژەری کۆمەڵایەتی', 'ضائقة: مرفق تقييم الباحث الاجتماعي'), requestedById: 'SYN-STF-018', requestedIso: todayAt('08:47'), status: 'pending' },
  { id: 'DSC-0443', patientId: 'SYN-PAT-0236', billIqd: 132_500, percent: 50, reason: T('Hospital staff relative', 'خزمی کارمەندی نەخۆشخانە', 'قريب أحد موظفي المستشفى'), requestedById: 'SYN-STF-003', requestedIso: todayAt('09:15'), status: 'pending' },
  { id: 'DSC-0438', patientId: 'SYN-PAT-0228', billIqd: 11_200_000, percent: 5, reason: T('Long stay, prompt payment', 'مانەوەی درێژ، پارەدانی خێرا', 'إقامة طويلة، دفع فوري'), requestedById: 'SYN-STF-018', requestedIso: daysAgoAt(1, '15:00'), status: 'approved' },
  { id: 'DSC-0436', patientId: 'SYN-PAT-0102', billIqd: 6_820_000, percent: 30, reason: T('Requested by family; no grounds given', 'داوای خێزان؛ هیچ هۆکارێک نەدرا', 'بطلب العائلة؛ دون مبرر'), requestedById: 'SYN-STF-018', requestedIso: daysAgoAt(1, '11:20'), status: 'rejected' },
];

export interface RefundRequest {
  readonly id: string;
  readonly patientId: string;
  readonly currency: Currency;
  readonly amount: number;
  readonly reason: Text3;
  readonly originalReceipt: string;
  readonly status: ApprovalStatus | 'paid';
}

export const REFUNDS: readonly RefundRequest[] = [
  { id: 'RF-0201', patientId: 'SYN-PAT-0212', currency: 'IQD', amount: 120_000, reason: T('MRI cancelled by the hospital', 'MRI لەلایەن نەخۆشخانەوە هەڵوەشێنرایەوە', 'ألغى المستشفى الرنين'), originalReceipt: 'SYN-RCT-26-30101', status: 'paid' },
  { id: 'RF-0202', patientId: 'SYN-PAT-0106', currency: 'IQD', amount: 550_000, reason: T('Unused deposit at discharge', 'پێشەکیی بەکارنەهاتوو لە کاتی دەرچوون', 'عربون غير مستخدم عند الخروج'), originalReceipt: 'SYN-RCT-26-30411', status: 'approved' },
  { id: 'RF-0203', patientId: 'SYN-PAT-0111', currency: 'USD', amount: 120, reason: T('Duplicate payment for a lab panel', 'پارەدانی دووبارە بۆ پشکنینی تاقیگە', 'دفع مكرر لتحاليل مختبر'), originalReceipt: 'SYN-RCT-26-30413', status: 'pending' },
];

export interface DoctorFee {
  readonly staffId: string;
  readonly cases: number;
  readonly grossIqd: number;
  /** Hospital share, 0 to 1. */
  readonly hospitalShare: number;
  readonly period: Text3;
  readonly settled: boolean;
}

const WEEK = T('12–18 October', '12–18ی تشرینی یەکەم', '12–18 تشرين الأول');

export const DOCTOR_FEES: readonly DoctorFee[] = [
  { staffId: 'SYN-STF-001', cases: 41, grossIqd: 2_870_000, hospitalShare: 0.3, period: WEEK, settled: false },
  { staffId: 'SYN-STF-005', cases: 38, grossIqd: 2_660_000, hospitalShare: 0.3, period: WEEK, settled: false },
  { staffId: 'SYN-STF-006', cases: 29, grossIqd: 1_740_000, hospitalShare: 0.3, period: WEEK, settled: false },
  { staffId: 'SYN-STF-008', cases: 12, grossIqd: 9_600_000, hospitalShare: 0.4, period: WEEK, settled: false },
  { staffId: 'SYN-STF-017', cases: 24, grossIqd: 2_400_000, hospitalShare: 0.25, period: WEEK, settled: true },
  { staffId: 'SYN-STF-013', cases: 66, grossIqd: 3_960_000, hospitalShare: 0.5, period: WEEK, settled: false },
  { staffId: 'SYN-STF-020', cases: 33, grossIqd: 1_980_000, hospitalShare: 0.3, period: WEEK, settled: false },
];

/** Note and coin denominations counted at shift close. */
export const IQD_DENOMINATIONS: readonly number[] = [50_000, 25_000, 10_000, 5_000, 1_000, 500, 250];
export const USD_DENOMINATIONS: readonly number[] = [100, 50, 20, 10, 5, 1];
