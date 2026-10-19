/**
 * Invoices, payments and currency helpers. SYNTHETIC DATA ONLY. Amounts are kept in integer Iraqi dinars and
 * converted to US dollars at the fixed demo rate (1 USD = 1,310 IQD, EXCHANGE_RATE in organisation.ts).
 */
import { DEMO_TODAY, daysAgoAt, demoDate, todayAt } from './clock.ts';
import { EXCHANGE_RATE, PAYERS } from './organisation.ts';
import type { ChargeCategory, Currency, Invoice, InvoiceLine, InvoiceTotals, Payer, PayerId, Payment, Text3 } from './types.ts';

const T = (en: string, ckb: string, ar: string): Text3 => ({ en, ckb, ar });
const CASHIER = 'SYN-STF-003';

/** US dollars for an amount in dinars, rounded to cents. */
export function iqdToUsd(iqd: number): number {
  return Math.round((iqd / EXCHANGE_RATE.usdToIqd) * 100) / 100;
}

/** Dinars for an amount in US dollars, rounded to whole dinars. */
export function usdToIqd(usd: number): number {
  return Math.round(usd * EXCHANGE_RATE.usdToIqd);
}

/** A payment's value in dinars. */
export function paymentIqd(payment: Payment): number {
  return payment.currency === 'IQD' ? payment.amount : usdToIqd(payment.amount);
}

export function getPayer(payerId: PayerId): Payer {
  const payer = PAYERS.find((candidate) => candidate.id === payerId);
  if (payer === undefined) {
    throw new Error(`Unknown payer ${payerId}`);
  }
  return payer;
}

let lineSeq = 0;

function line(category: ChargeCategory, description: Text3, quantity: number, unitPriceIqd: number, serviceOn: string): InvoiceLine {
  lineSeq += 1;
  return { id: `SYN-LINE-${String(lineSeq).padStart(4, '0')}`, category, description, quantity, unitPriceIqd, serviceOn };
}

function pay(receipt: number, iso: string, amount: number, currency: Currency, method: Payment['method']): Payment {
  return { id: `SYN-PAY-${String(receipt)}`, iso, amount, currency, method, receivedById: CASHIER, receipt: `SYN-RCT-${String(receipt)}` };
}

const D = {
  bedMedical: T('Medical ward bed, per night', 'جێگەی قاوشی ناوەکی، بۆ هەر شەوێک', 'سرير ردهة الباطنية، لكل ليلة'),
  bedSurgical: T('Surgical ward bed, per night', 'جێگەی قاوشی نەشتەرگەری، بۆ هەر شەوێک', 'سرير ردهة الجراحة، لكل ليلة'),
  bedIsolation: T('Isolation room, per night', 'ژووری جیاکردنەوە، بۆ هەر شەوێک', 'غرفة عزل، لكل ليلة'),
  bedIcu: T('Intensive care bed, per night', 'جێگەی چاودێریی چڕ، بۆ هەر شەوێک', 'سرير العناية المركزة، لكل ليلة'),
  bedPaeds: T('Paediatric ward bed, per night', 'جێگەی قاوشی منداڵان، بۆ هەر شەوێک', 'سرير ردهة الأطفال، لكل ليلة'),
  ventilator: T('Mechanical ventilation, per day', 'ئامێری هەناسەدان، بۆ هەر ڕۆژێک', 'التنفس الاصطناعي، لكل يوم'),
  consultant: T('Consultant review', 'سەردانی پزیشکی ڕاوێژکار', 'مراجعة الطبيب الاستشاري'),
  specialist: T('Specialist clinic consultation', 'سەردانی نۆرینگەی پسپۆڕ', 'استشارة في عيادة اختصاصية'),
  emergency: T('Emergency department attendance', 'سەردانی بەشی فریاکەوتن', 'مراجعة قسم الطوارئ'),
  cbc: T('Full blood count', 'پشکنینی تەواوی خوێن', 'تعداد دم كامل'),
  crp: T('C-reactive protein', 'پرۆتینی C-ی کاردانەوە', 'البروتين المتفاعل C'),
  renal: T('Renal profile', 'پرۆفایلی گورچیلە', 'وظائف الكلى'),
  culture: T('Blood culture, per set', 'چاندنی خوێن، بۆ هەر کۆمەڵەیەک', 'زرع دم، لكل مجموعة'),
  cxr: T('Chest X-ray', 'تیشکی سنگ', 'أشعة الصدر'),
  ctAbdomen: T('CT abdomen and pelvis', 'سی تی سکی و حەوز', 'تصوير مقطعي للبطن والحوض'),
  ecg: T('Electrocardiogram (ECG)', 'هێڵکاریی دڵ (ECG)', 'تخطيط القلب الكهربائي'),
  echo: T('Echocardiogram', 'ئیکۆی دڵ', 'تخطيط صدى القلب'),
  hba1c: T('HbA1c', 'HbA1c', 'HbA1c'),
  glucose: T('Fasting glucose', 'شەکرەی بەرچایی', 'سكر الصيام'),
  lipids: T('Lipid profile', 'پرۆفایلی چەوری', 'دهون الدم'),
  preopBloods: T('Pre-operative blood tests', 'پشکنینی خوێنی پێش نەشتەرگەری', 'تحاليل ما قبل العملية'),
  genexpert: T('GeneXpert MTB/RIF', 'GeneXpert MTB/RIF', 'GeneXpert MTB/RIF'),
  afb: T('Sputum AFB smear', 'پشکنینی بەڵغەم AFB', 'لطاخة القشع AFB'),
  abg: T('Arterial blood gas', 'گازی خوێنی شادەمار', 'غازات الدم الشرياني'),
  lapChole: T('Laparoscopic cholecystectomy', 'لابردنی زراو بە لابراسکۆپ', 'استئصال المرارة بالمنظار'),
  lapAppendix: T('Laparoscopic appendicectomy', 'لابردنی ڕیخۆڵەکوێرە بە لابراسکۆپ', 'استئصال الزائدة بالمنظار'),
  anaesthesia: T('General anaesthesia', 'بێهۆشیی گشتی', 'تخدير عام'),
  theatre: T('Operating theatre time', 'کاتی هۆڵی نەشتەرگەری', 'وقت صالة العمليات'),
  levofloxacin: T('Levofloxacin 750 mg infusion', 'لێڤۆفلۆکساسین 750 mg تکاندن', 'ليفوفلوكساسين 750 mg تسريب'),
  insulinPen: T('Insulin aspart pen', 'قەڵەمی ئەنسولین ئەسپارت', 'قلم أنسولين أسبارت'),
  enoxaparin: T('Enoxaparin 40 mg syringe', 'دەرزیی ئینۆکساپارین 40 mg', 'حقنة إينوكسابارين 40 mg'),
  meropenem: T('Meropenem 1 g vial', 'بوتڵی مێرۆپینێم 1 g', 'قارورة ميروبينيم 1 g'),
  noradrenaline: T('Noradrenaline 4 mg ampoule', 'ئەمپوولی نۆرئەدرێنالین 4 mg', 'أمبولة نورأدرينالين 4 mg'),
  antibioticsSurg: T('Ceftriaxone and metronidazole', 'سێفتریاکسۆن و مێترۆنیدازۆڵ', 'سيفترياكسون وميترونيدازول'),
  ivSupplies: T('IV cannula and infusion set', 'کانیولا و ئامێری تکاندن', 'كانيولا وجهاز تسريب'),
  ors: T('Oral rehydration salts', 'خوێی ئاوپێدانەوەی دەم', 'أملاح الإرواء الفموي'),
  phototherapy: T('Phototherapy, per day', 'چارەسەری ڕووناکی، بۆ هەر ڕۆژێک', 'العلاج الضوئي، لكل يوم'),
  bilirubin: T('Serum bilirubin', 'بیلیڕووبینی خوێن', 'البيليروبين في المصل'),
} as const;

export const INVOICES: readonly Invoice[] = [
  {
    id: 'SYN-INV-26-0101',
    patientId: 'SYN-PAT-0101',
    encounterId: 'SYN-ENC-0101',
    issuedIso: todayAt('08:30'),
    status: 'partially-paid',
    payerId: 'government',
    currency: 'IQD',
    lines: [
      line('bed', D.bedMedical, 2, 75_000, demoDate(1)),
      line('consultation', D.consultant, 3, 25_000, demoDate(0)),
      line('laboratory', D.cbc, 3, 10_000, demoDate(0)),
      line('laboratory', D.crp, 3, 12_000, demoDate(0)),
      line('laboratory', D.culture, 2, 30_000, demoDate(2)),
      line('imaging', D.cxr, 1, 35_000, demoDate(2)),
      line('pharmacy', D.levofloxacin, 3, 18_000, demoDate(0)),
      line('pharmacy', D.insulinPen, 1, 22_000, demoDate(2)),
      line('pharmacy', D.enoxaparin, 3, 9_500, demoDate(0)),
      line('supplies', D.ivSupplies, 1, 15_000, demoDate(2)),
    ],
    payments: [pay(50101, daysAgoAt(2, '13:10'), 50_000, 'IQD', 'cash')],
    note: T('Interim bill: admission continues', 'پسوولەی کاتی: خەواندن بەردەوامە', 'فاتورة مرحلية: الإقامة مستمرة'),
  },
  {
    id: 'SYN-INV-26-0110',
    patientId: 'SYN-PAT-0110',
    encounterId: 'SYN-ENC-0110',
    issuedIso: todayAt('07:45'),
    status: 'partially-paid',
    payerId: 'intl-insurance',
    currency: 'USD',
    lines: [
      line('consultation', D.emergency, 1, 50_000, demoDate(1)),
      line('imaging', D.ctAbdomen, 1, 180_000, demoDate(1)),
      line('laboratory', D.cbc, 1, 10_000, demoDate(1)),
      line('procedure', D.lapAppendix, 1, 1_850_000, demoDate(0)),
      line('procedure', D.anaesthesia, 1, 450_000, demoDate(0)),
      line('theatre', D.theatre, 1, 600_000, demoDate(0)),
      line('bed', D.bedSurgical, 1, 95_000, demoDate(0)),
      line('pharmacy', D.antibioticsSurg, 1, 42_000, demoDate(0)),
    ],
    payments: [pay(50102, todayAt('03:40'), 150, 'USD', 'card')],
    note: T(
      'Insurer billed in US dollars; guarantee of payment received',
      'بیمەکەر بە دۆلار پسوولەی بۆ دەردەچێت؛ گەرەنتیی پارەدان وەرگیرا',
      'تُصدر الفاتورة لشركة التأمين بالدولار؛ تم استلام ضمان الدفع',
    ),
  },
  {
    id: 'SYN-INV-26-0108',
    patientId: 'SYN-PAT-0108',
    encounterId: 'SYN-ENC-0108',
    issuedIso: todayAt('09:05'),
    status: 'paid',
    payerId: 'syn-insurance',
    currency: 'IQD',
    lines: [
      line('consultation', D.specialist, 1, 25_000, demoDate(0)),
      line('laboratory', D.hba1c, 1, 18_000, demoDate(0)),
      line('laboratory', D.glucose, 1, 5_000, demoDate(0)),
      line('laboratory', D.lipids, 1, 20_000, demoDate(0)),
    ],
    payments: [pay(50103, todayAt('09:06'), 13_600, 'IQD', 'cash')],
    note: null,
  },
  {
    id: 'SYN-INV-26-0111',
    patientId: 'SYN-PAT-0111',
    encounterId: 'SYN-ENC-0111',
    issuedIso: todayAt('08:57'),
    status: 'paid',
    payerId: 'self-pay',
    currency: 'IQD',
    lines: [
      line('consultation', D.specialist, 1, 30_000, demoDate(0)),
      line('imaging', D.ecg, 1, 15_000, demoDate(0)),
      line('imaging', D.echo, 1, 75_000, demoDate(0)),
    ],
    payments: [pay(50104, todayAt('09:00'), 50, 'USD', 'cash'), pay(50105, todayAt('09:00'), 54_500, 'IQD', 'cash')],
    note: T('Paid partly in US dollars at the demo rate', 'بەشێکی بە دۆلار درا بە نرخی نموونە', 'دُفع جزء منها بالدولار بسعر العرض'),
  },
  {
    id: 'SYN-INV-26-0114',
    patientId: 'SYN-PAT-0114',
    encounterId: 'SYN-ENC-0114',
    issuedIso: todayAt('09:26'),
    status: 'open',
    payerId: 'self-pay',
    currency: 'IQD',
    lines: [
      line('consultation', D.specialist, 1, 25_000, demoDate(0)),
      line('laboratory', D.preopBloods, 1, 45_000, demoDate(0)),
    ],
    payments: [],
    note: null,
  },
  {
    id: 'SYN-INV-26-0105',
    patientId: 'SYN-PAT-0105',
    encounterId: 'SYN-ENC-0105',
    issuedIso: todayAt('07:00'),
    status: 'draft',
    payerId: 'self-pay',
    currency: 'IQD',
    lines: [
      line('bed', D.bedIsolation, 1, 120_000, demoDate(1)),
      line('imaging', D.cxr, 1, 35_000, demoDate(1)),
      line('laboratory', D.genexpert, 1, 60_000, demoDate(0)),
      line('laboratory', D.afb, 3, 8_000, demoDate(0)),
    ],
    payments: [],
    note: T(
      'Tuberculosis tests are free under the national programme (to be credited)',
      'پشکنینەکانی سیل بەپێی بەرنامەی نیشتمانی بێبەرامبەرن (دەگەڕێنرێتەوە)',
      'فحوص السل مجانية ضمن البرنامج الوطني (ستُسترد)',
    ),
  },
  {
    id: 'SYN-INV-26-0109',
    patientId: 'SYN-PAT-0109',
    encounterId: 'SYN-ENC-0109',
    issuedIso: todayAt('07:10'),
    status: 'partially-paid',
    payerId: 'self-pay',
    currency: 'IQD',
    lines: [
      line('bed', D.bedIcu, 2, 350_000, demoDate(1)),
      line('bed', D.ventilator, 2, 150_000, demoDate(1)),
      line('pharmacy', D.meropenem, 6, 45_000, demoDate(0)),
      line('pharmacy', D.noradrenaline, 4, 28_000, demoDate(0)),
      line('laboratory', D.abg, 8, 15_000, demoDate(0)),
      line('laboratory', D.culture, 2, 30_000, demoDate(2)),
      line('consultation', D.consultant, 2, 25_000, demoDate(0)),
    ],
    payments: [
      pay(50106, daysAgoAt(2, '09:30'), 500_000, 'IQD', 'cash'),
      pay(50107, daysAgoAt(1, '12:15'), 300, 'USD', 'cash'),
    ],
    note: T('Family paying by instalments', 'خێزان بە قیست دەدات', 'العائلة تدفع على أقساط'),
  },
  {
    id: 'SYN-INV-26-0106',
    patientId: 'SYN-PAT-0106',
    encounterId: 'SYN-ENC-0106',
    issuedIso: todayAt('08:50'),
    status: 'open',
    payerId: 'syn-insurance',
    currency: 'IQD',
    lines: [
      line('procedure', D.lapChole, 1, 1_500_000, demoDate(1)),
      line('procedure', D.anaesthesia, 1, 400_000, demoDate(1)),
      line('theatre', D.theatre, 1, 500_000, demoDate(1)),
      line('bed', D.bedSurgical, 1, 75_000, demoDate(1)),
      line('laboratory', D.cbc, 2, 10_000, demoDate(0)),
    ],
    payments: [],
    note: T('Insurance pre-authorisation SYN-PA-55120', 'ڕەزامەندیی پێشوەختی بیمە SYN-PA-55120', 'موافقة التأمين المسبقة SYN-PA-55120'),
  },
  {
    id: 'SYN-INV-26-0104',
    patientId: 'SYN-PAT-0104',
    encounterId: 'SYN-ENC-0104',
    issuedIso: todayAt('08:00'),
    status: 'open',
    payerId: 'government',
    currency: 'IQD',
    lines: [
      line('bed', D.bedPaeds, 1, 40_000, demoDate(1)),
      line('laboratory', D.renal, 1, 15_000, demoDate(1)),
      line('pharmacy', D.ors, 4, 1_500, demoDate(0)),
      line('supplies', D.ivSupplies, 1, 15_000, demoDate(1)),
    ],
    payments: [],
    note: null,
  },
  {
    id: 'SYN-INV-26-0103',
    patientId: 'SYN-PAT-0103',
    encounterId: 'SYN-ENC-0103',
    issuedIso: todayAt('08:00'),
    status: 'draft',
    payerId: 'government',
    currency: 'IQD',
    lines: [
      line('bed', D.bedPaeds, 1, 40_000, demoDate(1)),
      line('procedure', D.phototherapy, 1, 30_000, demoDate(0)),
      line('laboratory', D.bilirubin, 3, 7_000, demoDate(0)),
    ],
    payments: [],
    note: null,
  },
];

/** The totals of an invoice in dinars: gross, payer share, patient share, paid and the balance due. */
export function invoiceTotals(invoice: Invoice): InvoiceTotals {
  const grossIqd = invoice.lines.reduce((sum, item) => sum + item.quantity * item.unitPriceIqd, 0);
  const payerShareIqd = Math.round((grossIqd * getPayer(invoice.payerId).coveragePct) / 100);
  const patientShareIqd = grossIqd - payerShareIqd;
  const paidIqd = invoice.payments.reduce((sum, payment) => sum + paymentIqd(payment), 0);
  return { grossIqd, payerShareIqd, patientShareIqd, paidIqd, balanceIqd: Math.max(0, patientShareIqd - paidIqd) };
}

/** One patient's invoices, newest first. */
export function invoicesOf(patientId: string): readonly Invoice[] {
  return INVOICES.filter((invoice) => invoice.patientId === patientId).toSorted((a, b) =>
    b.issuedIso.localeCompare(a.issuedIso),
  );
}

/** Every payment received on the demo day, with its invoice. */
export function paymentsToday(): readonly { readonly invoice: Invoice; readonly payment: Payment }[] {
  return INVOICES.flatMap((invoice) =>
    invoice.payments.filter((payment) => payment.iso.startsWith(DEMO_TODAY)).map((payment) => ({ invoice, payment })),
  );
}

/** Cash received today, by currency. */
export function cashTodayByCurrency(): Readonly<Record<Currency, number>> {
  const totals: Record<Currency, number> = { IQD: 0, USD: 0 };
  for (const { payment } of paymentsToday()) {
    totals[payment.currency] += payment.amount;
  }
  return totals;
}
