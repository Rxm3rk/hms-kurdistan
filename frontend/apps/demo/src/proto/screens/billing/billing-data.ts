/**
 * The billing screen's own synthetic data and money model. SYNTHETIC DATA ONLY, NOT FOR CLINICAL USE.
 *
 * - Claims to insurers and public coverage (status draft, submitted, approved, rejected), seeded per invoice.
 * - Exemption and discount rules (each needs a supervisor's approval before it reduces the bill).
 * - The cashier's shift at cash desk 2 (opening float in IQD and USD).
 * - An estimated interim bill for patients without an invoice in the shared data (built from the admission
 *   and today's orders with a small synthetic price list), so every patient has something to show.
 * - `accountTotals`: gross, payer share, patient share, exemption, payments and balance, in whole dinars.
 *
 * Money is integer dinars (USD in integer cents) through ./money.ts; nothing here uses floating point.
 */
import {
  DEMO_NOW_ISO,
  currentEncounter,
  bedOfPatient,
  daysAgoAt,
  getPayer,
  invoicesOf,
  lengthOfStayDays,
  ordersOf,
  todayAt,
} from '../../data/index.ts';
import type {
  ChargeCategory,
  Currency,
  Invoice,
  InvoiceLine,
  Patient,
  Payment,
  PaymentMethod,
  Text3,
  WardId,
} from '../../data/index.ts';
import { centsFromDataDollars, iqdFromUsdCents, percentOf } from './money.ts';

const T = (en: string, ckb: string, ar: string): Text3 => ({ en, ckb, ar });

// ---------------------------------------------------------------------------------------------------------
// Payments (shared data and this session) in one integer shape
// ---------------------------------------------------------------------------------------------------------

/** One currency handed over: whole dinars, or US cents. */
export interface Tender {
  readonly currency: Currency;
  /** Whole dinars for IQD; cents for USD. */
  readonly minor: number;
  /** Its value in dinars at the demo rate. */
  readonly valueIqd: number;
}

export interface PaymentRecord {
  readonly id: string;
  readonly receipt: string;
  readonly invoiceId: string;
  readonly patientId: string;
  readonly iso: string;
  readonly method: PaymentMethod;
  readonly tenders: readonly Tender[];
  /** Dinars applied to the invoice (the balance it settles). */
  readonly appliedIqd: number;
  /** Change handed back, in dinars (cash only; always IQD). */
  readonly changeIqd: number;
  /**
   * Cash rounding to the nearest 250 IQD: positive when the patient gained (more change or less to pay),
   * negative when the hospital gained. Zero for card payments.
   */
  readonly roundingIqd: number;
  readonly receivedById: string;
  /** Simulated card terminal authorisation, for card payments taken in this session. */
  readonly authCode: string | null;
  /** True for payments taken in this browser session (kept in React state, never written back). */
  readonly session: boolean;
}

/** A payment of the shared data as a record (dollar amounts converted once to integer cents). */
export function recordOfDataPayment(invoice: Invoice, payment: Payment): PaymentRecord {
  const minor = payment.currency === 'IQD' ? payment.amount : centsFromDataDollars(payment.amount);
  const valueIqd = payment.currency === 'IQD' ? minor : iqdFromUsdCents(minor);
  return {
    id: payment.id,
    receipt: payment.receipt,
    invoiceId: invoice.id,
    patientId: invoice.patientId,
    iso: payment.iso,
    method: payment.method,
    tenders: [{ currency: payment.currency, minor, valueIqd }],
    appliedIqd: valueIqd,
    changeIqd: 0,
    roundingIqd: 0,
    receivedById: payment.receivedById,
    authCode: null,
    session: false,
  };
}

/** Dinars that went into (or out of) the drawer for a record, per currency (cash only). */
export function drawerDelta(record: PaymentRecord): { readonly iqd: number; readonly usdCents: number } {
  if (record.method !== 'cash') {
    return { iqd: 0, usdCents: 0 };
  }
  let iqd = -record.changeIqd;
  let usdCents = 0;
  for (const tender of record.tenders) {
    if (tender.currency === 'IQD') {
      iqd += tender.minor;
    } else {
      usdCents += tender.minor;
    }
  }
  return { iqd, usdCents };
}

// ---------------------------------------------------------------------------------------------------------
// Claims to the payer
// ---------------------------------------------------------------------------------------------------------

export type ClaimStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export const CLAIM_STATUS_TONE: Readonly<Record<ClaimStatus, 'neutral' | 'info' | 'success' | 'danger'>> = {
  draft: 'neutral',
  submitted: 'info',
  approved: 'success',
  rejected: 'danger',
};

export interface ClaimEvent {
  readonly status: ClaimStatus;
  readonly iso: string;
  readonly note: Text3 | null;
  /** True for a step taken in this session (simulated insurer reply or a cashier's submission). */
  readonly simulated: boolean;
}

export interface Claim {
  readonly id: string;
  /** Pre-authorisation, guarantee of payment or batch reference. */
  readonly reference: string | null;
  readonly status: ClaimStatus;
  readonly events: readonly ClaimEvent[];
  readonly rejectionReason: Text3 | null;
  /** Days the payer takes to pay an approved claim (from the contract). */
  readonly paymentTermsDays: number;
}

const CLAIM_SEEDS: Readonly<Record<string, Claim>> = {
  'SYN-INV-26-0101': {
    id: 'SYN-CLM-26-04101',
    reference: 'SYN-MOH-BATCH-42',
    status: 'draft',
    events: [{ status: 'draft', iso: todayAt('08:30'), note: T('Added to this week\'s public coverage batch', 'خرایە کۆمەڵەی ئەم هەفتەیەی پشتیوانیی حکومی', 'أُضيفت إلى دفعة التغطية الحكومية لهذا الأسبوع'), simulated: false }],
    rejectionReason: null,
    paymentTermsDays: 60,
  },
  'SYN-INV-26-0110': {
    id: 'SYN-CLM-26-04110',
    reference: 'SYN-GOP-88213',
    status: 'approved',
    events: [
      { status: 'draft', iso: daysAgoAt(1, '22:10'), note: null, simulated: false },
      { status: 'submitted', iso: daysAgoAt(1, '22:40'), note: T('Guarantee of payment requested from the insurer\'s assistance line', 'داوای گەرەنتیی پارەدان لە هێڵی یارمەتیی بیمەکەر کرا', 'طُلب ضمان الدفع من خط المساعدة لدى شركة التأمين'), simulated: false },
      { status: 'approved', iso: todayAt('02:15'), note: T('Guarantee of payment received for 90%', 'گەرەنتیی پارەدان بۆ 90% وەرگیرا', 'استُلم ضمان الدفع بنسبة 90%'), simulated: false },
    ],
    rejectionReason: null,
    paymentTermsDays: 30,
  },
  'SYN-INV-26-0108': {
    id: 'SYN-CLM-26-04108',
    reference: null,
    status: 'approved',
    events: [
      { status: 'submitted', iso: todayAt('09:05'), note: null, simulated: false },
      { status: 'approved', iso: todayAt('09:05'), note: T('Approved at once: clinic visit within the policy', 'یەکسەر پەسەندکرا: سەردانی نۆرینگە لەناو پۆلیسەدایە', 'قُبلت فوراً: زيارة العيادة ضمن الوثيقة'), simulated: false },
    ],
    rejectionReason: null,
    paymentTermsDays: 45,
  },
  'SYN-INV-26-0106': {
    id: 'SYN-CLM-26-04106',
    reference: 'SYN-PA-55120',
    status: 'submitted',
    events: [
      { status: 'draft', iso: daysAgoAt(2, '11:00'), note: T('Pre-authorisation SYN-PA-55120 granted before surgery', 'ڕەزامەندیی پێشوەختی SYN-PA-55120 پێش نەشتەرگەری درا', 'مُنحت الموافقة المسبقة SYN-PA-55120 قبل العملية'), simulated: false },
      { status: 'submitted', iso: todayAt('08:52'), note: T('Final claim sent with the operation note', 'داواکاریی کۆتایی لەگەڵ ڕاپۆرتی نەشتەرگەری نێردرا', 'أُرسلت المطالبة النهائية مع تقرير العملية'), simulated: false },
    ],
    rejectionReason: null,
    paymentTermsDays: 45,
  },
  'SYN-INV-26-0104': {
    id: 'SYN-CLM-26-04104',
    reference: 'SYN-MOH-BATCH-41',
    status: 'rejected',
    events: [
      { status: 'submitted', iso: daysAgoAt(1, '10:20'), note: null, simulated: false },
      { status: 'rejected', iso: todayAt('08:40'), note: null, simulated: false },
    ],
    rejectionReason: T(
      'Referral letter from the primary health centre is missing',
      'نامەی ناردنی بنکەی تەندروستیی سەرەتایی نییە',
      'كتاب الإحالة من مركز الرعاية الصحية الأولية مفقود',
    ),
    paymentTermsDays: 60,
  },
  'SYN-INV-26-0103': {
    id: 'SYN-CLM-26-04103',
    reference: 'SYN-MOH-BATCH-42',
    status: 'draft',
    events: [{ status: 'draft', iso: todayAt('08:00'), note: null, simulated: false }],
    rejectionReason: null,
    paymentTermsDays: 60,
  },
};

/** The reason a simulated rejection gives when the seed has none. */
export const DEFAULT_REJECTION: Text3 = T(
  'The payer asks for the itemised bill and the discharge summary',
  'بیمەکەر داوای پسوولەی وردەکاری و پوختەی دەرچوون دەکات',
  'تطلب الجهة الدافعة الفاتورة المفصلة وملخص الخروج',
);

/** The claim of an invoice billed to a payer (null for self-pay). */
export function seedClaim(invoice: Invoice): Claim | null {
  if (getPayer(invoice.payerId).coveragePct === 0) {
    return null;
  }
  return (
    CLAIM_SEEDS[invoice.id] ?? {
      id: `SYN-CLM-26-${invoice.id.slice(-4)}`,
      reference: null,
      status: 'draft',
      events: [{ status: 'draft', iso: invoice.issuedIso, note: null, simulated: false }],
      rejectionReason: null,
      paymentTermsDays: 60,
    }
  );
}

// ---------------------------------------------------------------------------------------------------------
// Exemptions and discounts
// ---------------------------------------------------------------------------------------------------------

export type ExemptionId = 'gov-employee' | 'social-protection' | 'staff-family' | 'tb-programme';

export interface ExemptionRule {
  readonly id: ExemptionId;
  readonly label: Text3;
  /** What it takes off, in words. */
  readonly basis: Text3;
  readonly pct: number;
  /** `patient-share`: a share of the whole patient share; `tb-tests`: the patient share of TB test lines. */
  readonly scope: 'patient-share' | 'tb-tests';
  readonly evidence: Text3;
  /** An example evidence reference (synthetic). */
  readonly evidenceExample: string;
}

export const EXEMPTION_RULES: readonly ExemptionRule[] = [
  {
    id: 'gov-employee',
    label: T('Government employee exemption', 'بەخشینی فەرمانبەری حکومی', 'إعفاء موظف حكومي'),
    basis: T('25% of the patient share', '25%ی بەشی نەخۆش', '25% من حصة المريض'),
    pct: 25,
    scope: 'patient-share',
    evidence: T('Government employee ID card number', 'ژمارەی ناسنامەی فەرمانبەری', 'رقم هوية الموظف الحكومي'),
    evidenceExample: 'SYN-GOV-448120',
  },
  {
    id: 'social-protection',
    label: T('Social protection beneficiary', 'سوودمەندی تۆڕی پاراستنی کۆمەڵایەتی', 'مستفيد من شبكة الحماية الاجتماعية'),
    basis: T('100% of the patient share', '100%ی بەشی نەخۆش', '100% من حصة المريض'),
    pct: 100,
    scope: 'patient-share',
    evidence: T('Social protection card number', 'ژمارەی کارتی پاراستنی کۆمەڵایەتی', 'رقم بطاقة الحماية الاجتماعية'),
    evidenceExample: 'SYN-SPN-20931',
  },
  {
    id: 'staff-family',
    label: T('Hospital staff family discount', 'داشکاندنی خێزانی کارمەندانی نەخۆشخانە', 'خصم عائلة منتسبي المستشفى'),
    basis: T('20% of the patient share', '20%ی بەشی نەخۆش', '20% من حصة المريض'),
    pct: 20,
    scope: 'patient-share',
    evidence: T('Staff member\'s employee number', 'ژمارەی کارمەندی پەیوەندیدار', 'الرقم الوظيفي للمنتسب'),
    evidenceExample: 'SYN-STF-118',
  },
  {
    id: 'tb-programme',
    label: T('National tuberculosis programme', 'بەرنامەی نیشتمانیی سیل', 'البرنامج الوطني لمكافحة السل'),
    basis: T('Tuberculosis tests free of charge', 'پشکنینەکانی سیل بێبەرامبەرن', 'فحوص السل مجانية'),
    pct: 100,
    scope: 'tb-tests',
    evidence: T('Programme notification number', 'ژمارەی ئاگادارکردنەوەی بەرنامە', 'رقم التبليغ في البرنامج'),
    evidenceExample: 'SYN-NTP-0912',
  },
];

export function getExemptionRule(id: ExemptionId): ExemptionRule {
  const rule = EXEMPTION_RULES.find((candidate) => candidate.id === id);
  if (rule === undefined) {
    throw new Error(`Unknown exemption rule ${id}`);
  }
  return rule;
}

/** Tuberculosis test lines (GeneXpert, sputum AFB) of an invoice. */
export function tbTestLines(invoice: Invoice): readonly InvoiceLine[] {
  return invoice.lines.filter((item) => item.category === 'laboratory' && /GeneXpert|AFB/u.test(item.description.en));
}

/** The rules that apply to an invoice (the TB programme only where it has TB tests). */
export function rulesFor(invoice: Invoice): readonly ExemptionRule[] {
  const hasTb = tbTestLines(invoice).length > 0;
  return EXEMPTION_RULES.filter((rule) => rule.scope !== 'tb-tests' || hasTb);
}

function lineAmount(item: InvoiceLine): number {
  return item.quantity * item.unitPriceIqd;
}

/** The dinars a rule takes off this invoice's patient share. */
export function exemptionAmount(invoice: Invoice, rule: ExemptionRule): number {
  const coverage = getPayer(invoice.payerId).coveragePct;
  if (rule.scope === 'tb-tests') {
    const tbGross = tbTestLines(invoice).reduce((sum, item) => sum + lineAmount(item), 0);
    const tbPatientShare = tbGross - percentOf(tbGross, coverage);
    return percentOf(tbPatientShare, rule.pct);
  }
  const gross = invoice.lines.reduce((sum, item) => sum + lineAmount(item), 0);
  const patientShare = gross - percentOf(gross, coverage);
  return percentOf(patientShare, rule.pct);
}

export type ExemptionStatus = 'pending' | 'approved' | 'rejected';

export interface ExemptionRequest {
  readonly ruleId: ExemptionId;
  readonly evidence: string;
  readonly status: ExemptionStatus;
  readonly requestedIso: string;
  readonly requestedById: string;
  readonly decidedIso: string | null;
}

// ---------------------------------------------------------------------------------------------------------
// Totals
// ---------------------------------------------------------------------------------------------------------

export interface AccountTotals {
  readonly grossIqd: number;
  readonly coveragePct: number;
  readonly payerShareIqd: number;
  readonly patientShareIqd: number;
  /** Applied (approved) exemption. */
  readonly exemptionIqd: number;
  /** A pending exemption's amount (not applied until approved). */
  readonly pendingExemptionIqd: number;
  readonly patientDueIqd: number;
  readonly paidIqd: number;
  readonly balanceIqd: number;
  /** Paid beyond what is due (an exemption approved after a payment): owed back to the patient. */
  readonly creditIqd: number;
}

export function accountTotals(
  invoice: Invoice,
  exemption: ExemptionRequest | undefined,
  payments: readonly PaymentRecord[],
): AccountTotals {
  const grossIqd = invoice.lines.reduce((sum, item) => sum + lineAmount(item), 0);
  const coveragePct = getPayer(invoice.payerId).coveragePct;
  const payerShareIqd = percentOf(grossIqd, coveragePct);
  const patientShareIqd = grossIqd - payerShareIqd;
  const amount = exemption === undefined ? 0 : exemptionAmount(invoice, getExemptionRule(exemption.ruleId));
  const exemptionIqd = exemption?.status === 'approved' ? amount : 0;
  const pendingExemptionIqd = exemption?.status === 'pending' ? amount : 0;
  const patientDueIqd = patientShareIqd - exemptionIqd;
  const paidIqd = payments.reduce((sum, record) => sum + record.appliedIqd, 0);
  return {
    grossIqd,
    coveragePct,
    payerShareIqd,
    patientShareIqd,
    exemptionIqd,
    pendingExemptionIqd,
    patientDueIqd,
    paidIqd,
    balanceIqd: Math.max(0, patientDueIqd - paidIqd),
    creditIqd: Math.max(0, paidIqd - patientDueIqd),
  };
}

/** The invoice lines grouped by charge category, in a fixed order, with each group's subtotal. */
export function groupLines(invoice: Invoice): readonly { readonly category: ChargeCategory; readonly lines: readonly InvoiceLine[]; readonly subtotalIqd: number }[] {
  const order: readonly ChargeCategory[] = ['consultation', 'bed', 'procedure', 'theatre', 'laboratory', 'imaging', 'pharmacy', 'supplies'];
  return order
    .map((category) => {
      const lines = invoice.lines.filter((item) => item.category === category);
      return { category, lines, subtotalIqd: lines.reduce((sum, item) => sum + lineAmount(item), 0) };
    })
    .filter((group) => group.lines.length > 0);
}

export { lineAmount };

// ---------------------------------------------------------------------------------------------------------
// The cashier's shift
// ---------------------------------------------------------------------------------------------------------

export const SHIFT = {
  id: 'SYN-SHF-261019-D2',
  zReport: 'SYN-Z-261019-D2',
  desk: T('Cash desk 2, main entrance hall', 'سندووقی 2، هۆڵی دەروازەی سەرەکی', 'الصندوق 2، قاعة المدخل الرئيسي'),
  printer: T('80 mm receipt printer, cash desk 2', 'چاپکەری وەسڵی 80 ملم، سندووقی 2', 'طابعة الإيصالات 80 ملم، الصندوق 2'),
  terminal: 'SYN-POS-02',
  cashierId: 'SYN-STF-003',
  openedIso: todayAt('07:00'),
  plannedCloseIso: todayAt('15:00'),
  /** Opening float. */
  floatIqd: 250_000,
  floatUsdCents: 20_000,
} as const;

/** True for a payment taken during this shift (from its opening). */
export function inThisShift(iso: string): boolean {
  return Date.parse(iso) >= Date.parse(SHIFT.openedIso);
}

// ---------------------------------------------------------------------------------------------------------
// Estimated interim bill for patients without an invoice in the shared data
// ---------------------------------------------------------------------------------------------------------

const PRICE = {
  consultant: 25_000,
  specialist: 25_000,
  emergency: 50_000,
  lab: 12_000,
  imaging: 35_000,
  medicationDay: 15_000,
  referral: 25_000,
} as const;

const BED_PRICE: Readonly<Record<WardId, { readonly price: number; readonly text: Text3 }>> = {
  'med-a': { price: 75_000, text: T('Medical ward bed, per night', 'جێگەی قاوشی ناوەکی، بۆ هەر شەوێک', 'سرير ردهة الباطنية، لكل ليلة') },
  'surg-b': { price: 75_000, text: T('Surgical ward bed, per night', 'جێگەی قاوشی نەشتەرگەری، بۆ هەر شەوێک', 'سرير ردهة الجراحة، لكل ليلة') },
  paeds: { price: 40_000, text: T('Paediatric ward bed, per night', 'جێگەی قاوشی منداڵان، بۆ هەر شەوێک', 'سرير ردهة الأطفال، لكل ليلة') },
  icu: { price: 350_000, text: T('Intensive care bed, per night', 'جێگەی چاودێریی چڕ، بۆ هەر شەوێک', 'سرير العناية المركزة، لكل ليلة') },
};

const ISOLATION_BED = { price: 120_000, text: T('Isolation room, per night', 'ژووری جیاکردنەوە، بۆ هەر شەوێک', 'غرفة عزل، لكل ليلة') };
const CONSULTANT_TEXT = T('Consultant review', 'سەردانی پزیشکی ڕاوێژکار', 'مراجعة الطبيب الاستشاري');
const SPECIALIST_TEXT = T('Specialist clinic consultation', 'سەردانی نۆرینگەی پسپۆڕ', 'استشارة في عيادة اختصاصية');
const EMERGENCY_TEXT = T('Emergency department attendance', 'سەردانی بەشی فریاکەوتن', 'مراجعة قسم الطوارئ');

/** An interim bill estimated from the patient's current encounter and today's orders; null without an encounter. */
export function estimateFor(patient: Patient): Invoice | null {
  const encounter = currentEncounter(patient.id);
  if (encounter === undefined) {
    return null;
  }
  const tail = patient.id.slice(-4);
  let seq = 0;
  const lines: InvoiceLine[] = [];
  const add = (category: ChargeCategory, description: Text3, quantity: number, unitPriceIqd: number, serviceOn: string): void => {
    seq += 1;
    lines.push({ id: `SYN-EST-${tail}-${String(seq).padStart(2, '0')}`, category, description, quantity, unitPriceIqd, serviceOn });
  };
  const today = DEMO_NOW_ISO.slice(0, 10);

  if (encounter.type === 'inpatient' && encounter.wardId !== null) {
    const nights = Math.max(1, lengthOfStayDays(encounter));
    const bed = bedOfPatient(patient.id);
    const bedPrice = bed?.isolationRoom === true ? ISOLATION_BED : BED_PRICE[encounter.wardId];
    add('bed', bedPrice.text, nights, bedPrice.price, encounter.startIso.slice(0, 10));
    add('consultation', CONSULTANT_TEXT, nights, PRICE.consultant, today);
  } else if (encounter.type === 'emergency') {
    add('consultation', EMERGENCY_TEXT, 1, PRICE.emergency, today);
  } else {
    add('consultation', SPECIALIST_TEXT, 1, PRICE.specialist, today);
  }

  for (const order of ordersOf(patient.id)) {
    if (order.status === 'cancelled' || order.status === 'draft' || order.status === 'pending-signature') {
      continue;
    }
    const on = order.orderedIso.slice(0, 10);
    if (order.category === 'lab') {
      add('laboratory', order.title, 1, PRICE.lab, on);
    } else if (order.category === 'imaging') {
      add('imaging', order.title, 1, PRICE.imaging, on);
    } else if (order.category === 'medication') {
      add('pharmacy', order.title, 1, PRICE.medicationDay, on);
    } else if (order.category === 'consult') {
      add('consultation', order.title, 1, PRICE.referral, on);
    }
  }

  return {
    id: `SYN-INV-26-E${tail}`,
    patientId: patient.id,
    encounterId: encounter.id,
    issuedIso: DEMO_NOW_ISO,
    status: 'draft',
    payerId: patient.payerId,
    currency: getPayer(patient.payerId).currency,
    lines,
    payments: [],
    note: T(
      'Estimate built from the admission and today\'s orders with the synthetic price list; not issued yet',
      'خەمڵاندن لە خەواندن و داواکارییەکانی ئەمڕۆ بە لیستی نرخی نموونە؛ هێشتا دەرنەچووە',
      'تقدير من الإقامة وطلبات اليوم بقائمة الأسعار التجريبية؛ لم تصدر بعد',
    ),
  };
}

export interface BillingAccount {
  readonly invoice: Invoice;
  /** True for an estimate built here (no invoice in the shared data). */
  readonly estimated: boolean;
}

/** The patient's invoices (newest first), or an estimate when the shared data has none. */
export function accountsOf(patient: Patient): readonly BillingAccount[] {
  const invoices = invoicesOf(patient.id);
  if (invoices.length > 0) {
    return invoices.map((invoice) => ({ invoice, estimated: false }));
  }
  const estimate = estimateFor(patient);
  return estimate === null ? [] : [{ invoice: estimate, estimated: true }];
}
