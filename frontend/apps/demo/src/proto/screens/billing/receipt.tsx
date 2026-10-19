/**
 * The 80 mm thermal paper previews: a payment receipt (or an interim statement when no payment is chosen) and
 * the cashier's shift report (Z report). Trilingual header (Sorani, Arabic, English), the hospital, numbers,
 * items, totals in IQD with the USD equivalent, the cashier and the time, a fake barcode and a "Synthetic"
 * watermark. The printer is simulated: "Print" only shows a confirmation. SYNTHETIC DATA ONLY.
 */
import { Bdi } from '@hms/design-system';
import type { ReactNode } from 'react';
import { HOSPITAL, PAYMENT_METHOD_LABEL, getPayer } from '../../data/index.ts';
import type { Invoice, Patient, StaffMember, Text3 } from '../../data/index.ts';
import { pickText, useFormat, useLocale, useT } from '../../i18n/use-t.ts';
import { Icon, personName, staffName } from '../../ui/index.ts';
import { SHIFT, getExemptionRule, groupLines, lineAmount, type AccountTotals, type ExemptionRequest, type PaymentRecord } from './billing-data.ts';
import { messages } from './messages.ts';
import { RATE_IQD_PER_USD, formatCentsNumber, formatIqdNumber, formatUsdCents, usdCentsFromIqd } from './money.ts';

const T = (en: string, ckb: string, ar: string): Text3 => ({ en, ckb, ar });

const RECEIPT_TITLE = T('Payment receipt', 'وەسڵی پارەدان', 'وصل قبض');
const STATEMENT_TITLE = T('Interim statement', 'کورتەی هەژماری کاتی', 'كشف حساب مؤقت');
const Z_TITLE = T('Shift report (Z)', 'ڕاپۆرتی نۆبە (Z)', 'تقرير الوردية (Z)');
const THANKS = T('Thank you. Get well soon.', 'سوپاس. هیوای چاکبوونەوەی خێرات بۆ دەخوازین.', 'شكراً لكم. نتمنى لكم الشفاء العاجل.');
const WATERMARK = T('SYNTHETIC', 'نموونە', 'تجريبي');
const NOT_VALID = T('Synthetic demo: not a valid receipt', 'نموونەی تاقیکاری: وەسڵی ڕاستەقینە نییە', 'عرض تجريبي: ليس وصلاً حقيقياً');

const SCRIPT_LANG: Readonly<Record<'en' | 'ckb' | 'ar', string>> = { en: 'en', ckb: 'ckb', ar: 'ar' };

/** A Text3 in all three languages, one line each (Sorani, Arabic, English, as Kurdistan receipts print). */
function Trilingual({ text, className }: { readonly text: Text3; readonly className?: string }): ReactNode {
  return (
    <div className={['billing-paper__tri', className ?? ''].filter(Boolean).join(' ')}>
      {(['ckb', 'ar', 'en'] as const).map((lang) => (
        <Bdi key={lang} dir={lang === 'en' ? 'ltr' : 'rtl'} lang={SCRIPT_LANG[lang]} className="billing-paper__tri-line">
          {text[lang]}
        </Bdi>
      ))}
    </div>
  );
}

/** A decorative, fake barcode drawn from the document number (always left to right). */
function FakeBarcode({ value }: { readonly value: string }): ReactNode {
  const bars: { readonly x: number; readonly w: number }[] = [];
  let x = 0;
  const codes = Array.from(value).map((char) => char.codePointAt(0) ?? 0);
  for (const [index, code] of [104, ...codes, 106].entries()) {
    for (let bit = 0; bit < 3; bit += 1) {
      const w = ((code >> (bit * 2)) & 3) + 1;
      if ((index + bit) % 2 === 0) {
        bars.push({ x, w });
      }
      x += w + 1;
    }
  }
  return (
    <div className="billing-paper__barcode" dir="ltr" aria-hidden="true">
      <svg viewBox={`0 0 ${String(x)} 24`} preserveAspectRatio="none" focusable="false">
        {bars.map((bar) => (
          <rect key={bar.x} x={bar.x} y={0} width={bar.w} height={24} />
        ))}
      </svg>
      <span className="billing-paper__barcode-text">{value}</span>
    </div>
  );
}

/** One line of the paper: label at the start, value at the end. */
function PaperRow({ label, value, strong = false, indent = false }: { readonly label: ReactNode; readonly value: ReactNode; readonly strong?: boolean; readonly indent?: boolean }): ReactNode {
  return (
    <div className={['billing-paper__row', strong ? 'billing-paper__row--strong' : '', indent ? 'billing-paper__row--indent' : ''].filter(Boolean).join(' ')}>
      <span className="billing-paper__label">{label}</span>
      <span className="billing-paper__value">{value}</span>
    </div>
  );
}

function Num({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <Bdi dir="ltr" className="billing-paper__num">
      {children}
    </Bdi>
  );
}

/** The paper itself: 80 mm wide, with the trilingual hospital header, the watermark and the footer. */
function ThermalPaper({ title, docNumber, label, children }: { readonly title: Text3; readonly docNumber: string; readonly label: string; readonly children: ReactNode }): ReactNode {
  const f = useFormat();
  return (
    <div className="billing-printer">
      <article className="billing-paper" aria-label={label}>
        <div className="billing-paper__watermark" aria-hidden="true">
          <span>{WATERMARK.en}</span>
          <span>{WATERMARK.ckb}</span>
          <span>{WATERMARK.ar}</span>
        </div>
        <header className="billing-paper__header">
          <span className="billing-paper__logo" aria-hidden="true">
            <Icon name="building" size="1.25rem" />
          </span>
          <Trilingual text={HOSPITAL.name} className="billing-paper__hospital" />
          <p className="billing-paper__small">{f.text(HOSPITAL.address)}</p>
          <p className="billing-paper__small">
            <Num>{HOSPITAL.phone}</Num>
          </p>
        </header>
        <hr className="billing-paper__rule" />
        <Trilingual text={title} className="billing-paper__title" />
        <hr className="billing-paper__rule" />
        {children}
        <hr className="billing-paper__rule" />
        <FakeBarcode value={docNumber} />
        <Trilingual text={THANKS} className="billing-paper__thanks" />
        <p className="billing-paper__void">
          <Bdi dir="auto">{f.text(NOT_VALID)}</Bdi>
        </p>
      </article>
    </div>
  );
}

export interface ReceiptContentProps {
  readonly patient: Patient;
  readonly invoice: Invoice;
  readonly totals: AccountTotals;
  readonly exemption: ExemptionRequest | undefined;
  /** Every payment of the invoice, in order. */
  readonly payments: readonly PaymentRecord[];
  /** The payment this receipt is for; null prints an interim statement. */
  readonly record: PaymentRecord | null;
  readonly cashier: StaffMember;
}

/** A payment receipt or an interim statement on 80 mm thermal paper. */
export function ThermalReceipt({ patient, invoice, totals, exemption, payments, record, cashier }: ReceiptContentProps): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const locale = useLocale();
  const n = (iqd: number): ReactNode => <Num>{formatIqdNumber(iqd, locale)}</Num>;
  const minus = (iqd: number): ReactNode => <Num>{`-${formatIqdNumber(iqd, locale)}`}</Num>;
  const payer = getPayer(invoice.payerId);

  const index = record === null ? payments.length : payments.findIndex((candidate) => candidate.id === record.id);
  const before = payments.slice(0, Math.max(0, index));
  const paidBefore = before.reduce((sum, item) => sum + item.appliedIqd, 0);
  const applied = record?.appliedIqd ?? 0;
  const balanceAfter = Math.max(0, totals.patientDueIqd - paidBefore - applied);
  const docNumber = record?.receipt ?? invoice.id;
  const iso = record?.iso ?? invoice.issuedIso;
  const exemptionRule = exemption?.status === 'approved' ? getExemptionRule(exemption.ruleId) : null;

  return (
    <ThermalPaper
      title={record === null ? STATEMENT_TITLE : RECEIPT_TITLE}
      docNumber={docNumber}
      label={record === null ? t('statementPreview') : t('receiptPreview')}
    >
      <div className="billing-paper__block">
        {record === null ? null : <PaperRow label={t('pReceiptNo')} value={<Num>{record.receipt}</Num>} />}
        <PaperRow label={t('pInvoiceNo')} value={<Num>{invoice.id}</Num>} />
        <PaperRow label={t('pDateTime')} value={<Num>{`${f.date(iso, 'short')} ${f.time(iso)}`}</Num>} />
        <PaperRow label={t('pCashier')} value={<Bdi dir={locale === 'en' ? 'ltr' : 'rtl'}>{staffName(cashier, locale)}</Bdi>} />
        <PaperRow label={t('pDesk')} value={f.text(SHIFT.desk)} />
      </div>
      <hr className="billing-paper__rule billing-paper__rule--light" />
      <div className="billing-paper__block">
        <PaperRow label={t('pPatient')} value={<Bdi dir={locale === 'en' ? 'ltr' : 'rtl'}>{personName(patient.name, locale)}</Bdi>} />
        {locale === 'en' ? null : <PaperRow label="" value={<Bdi dir="ltr">{patient.name.latin}</Bdi>} />}
        <PaperRow label={t('pMrn')} value={<Num>{patient.mrn}</Num>} />
        <PaperRow label={t('pDob')} value={<Num>{patient.dobPrecision === 'day' ? f.date(patient.dob, 'short') : patient.dob}</Num>} />
        <PaperRow label={t('pPayer')} value={payer.coveragePct > 0 ? `${f.text(payer.name)} · ${f.percent(payer.coveragePct / 100)}` : f.text(payer.name)} />
      </div>
      <hr className="billing-paper__rule" />
      <div className="billing-paper__items">
        <div className="billing-paper__row billing-paper__row--head">
          <span>{t('pItem')}</span>
          <span>{t('pAmountIqd')}</span>
        </div>
        {groupLines(invoice).flatMap((group) =>
          group.lines.map((item) => (
            <div key={item.id} className="billing-paper__item">
              <span className="billing-paper__item-name">{f.text(item.description)}</span>
              <PaperRow
                indent
                label={
                  <Num>
                    {`${f.number(item.quantity)} × ${formatIqdNumber(item.unitPriceIqd, locale)}`}
                  </Num>
                }
                value={n(lineAmount(item))}
              />
            </div>
          )),
        )}
      </div>
      <hr className="billing-paper__rule" />
      <div className="billing-paper__block">
        <PaperRow label={t('pGross')} value={n(totals.grossIqd)} />
        {totals.payerShareIqd > 0 ? <PaperRow label={t('pPayerShare', { percent: f.percent(totals.coveragePct / 100) })} value={minus(totals.payerShareIqd)} /> : null}
        {exemptionRule === null ? null : <PaperRow label={f.text(exemptionRule.label)} value={minus(totals.exemptionIqd)} />}
        <PaperRow strong label={t('pPatientDue')} value={n(totals.patientDueIqd)} />
        {paidBefore > 0 ? <PaperRow label={t('pPaidBefore')} value={minus(paidBefore)} /> : null}
      </div>
      {record === null ? null : (
        <>
          <hr className="billing-paper__rule billing-paper__rule--light" />
          <div className="billing-paper__block">
            <PaperRow strong label={t('pThisPayment')} value={f.text(PAYMENT_METHOD_LABEL[record.method])} />
            {record.tenders.map((tender) =>
              tender.currency === 'USD' ? (
                <PaperRow
                  key="usd"
                  indent
                  label={t('pUsdTender', { usd: formatUsdCents(tender.minor, locale), rate: formatIqdNumber(RATE_IQD_PER_USD, locale) })}
                  value={n(tender.valueIqd)}
                />
              ) : (
                <PaperRow key="iqd" indent label={t('pIqdTendered')} value={n(tender.minor)} />
              ),
            )}
            {record.changeIqd > 0 ? <PaperRow label={t('pChange')} value={n(record.changeIqd)} /> : null}
            {record.roundingIqd === 0 ? null : (
              <PaperRow
                indent
                label={t('pRounding')}
                value={<Num>{`${record.roundingIqd > 0 ? '+' : '-'}${formatIqdNumber(Math.abs(record.roundingIqd), locale)}`}</Num>}
              />
            )}
            {record.authCode === null ? null : <PaperRow indent label={t('pAuth')} value={<Num>{record.authCode}</Num>} />}
            <PaperRow label={t('pApplied')} value={n(applied)} />
          </div>
        </>
      )}
      <hr className="billing-paper__rule" />
      <div className="billing-paper__block">
        <PaperRow strong label={t('pBalance')} value={n(balanceAfter)} />
        <PaperRow label={t('pBalanceUsd')} value={<Num>{formatCentsNumber(usdCentsFromIqd(balanceAfter), locale)}</Num>} />
        <p className="billing-paper__small">{t('pRate', { rate: formatIqdNumber(RATE_IQD_PER_USD, locale) })}</p>
      </div>
    </ThermalPaper>
  );
}

export interface ZReportProps {
  readonly cashier: StaffMember;
  readonly closedIso: string | null;
  readonly receipts: number;
  readonly cashIqd: number;
  readonly cashUsdCents: number;
  readonly changeIqd: number;
  readonly cardIqd: number;
  /** Net cash rounding as the drawer sees it: negative when rounding was given to patients. */
  readonly roundingIqd: number;
  readonly expectedIqd: number;
  readonly expectedUsdCents: number;
  readonly countedIqd: number | null;
  readonly countedUsdCents: number | null;
}

/** The cashier's shift report on 80 mm thermal paper. */
export function ThermalZReport(props: ZReportProps): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const locale = useLocale();
  const n = (iqd: number): ReactNode => <Num>{formatIqdNumber(iqd, locale)}</Num>;
  const usd = (cents: number): ReactNode => <Num>{formatCentsNumber(cents, locale)}</Num>;
  const signed = (value: string, negative: boolean): ReactNode => <Num>{negative ? `-${value}` : value}</Num>;
  return (
    <ThermalPaper title={Z_TITLE} docNumber={SHIFT.zReport} label={t('zPreview')}>
      <div className="billing-paper__block">
        <PaperRow label={t('pShift')} value={<Num>{SHIFT.id}</Num>} />
        <PaperRow label={t('pDesk')} value={pickText(SHIFT.desk, locale)} />
        <PaperRow label={t('pCashier')} value={<Bdi dir={locale === 'en' ? 'ltr' : 'rtl'}>{staffName(props.cashier, locale)}</Bdi>} />
        <PaperRow label={t('pOpened')} value={<Num>{`${f.date(SHIFT.openedIso, 'short')} ${f.time(SHIFT.openedIso)}`}</Num>} />
        <PaperRow label={t('pClosed')} value={props.closedIso === null ? t('pStillOpen') : <Num>{`${f.date(props.closedIso, 'short')} ${f.time(props.closedIso)}`}</Num>} />
        <PaperRow label={t('pReceipts')} value={<Num>{f.number(props.receipts)}</Num>} />
      </div>
      <hr className="billing-paper__rule" />
      <div className="billing-paper__block">
        <PaperRow strong label={t('pTakings')} value="" />
        <PaperRow indent label={t('pCashIqd')} value={n(props.cashIqd)} />
        <PaperRow indent label={t('pChangeGiven')} value={signed(formatIqdNumber(props.changeIqd, locale), props.changeIqd > 0)} />
        <PaperRow indent label={t('pCashUsd')} value={usd(props.cashUsdCents)} />
        <PaperRow indent label={t('pCard')} value={n(props.cardIqd)} />
        <PaperRow indent label={t('pRoundingNet')} value={signed(formatIqdNumber(Math.abs(props.roundingIqd), locale), props.roundingIqd < 0)} />
      </div>
      <hr className="billing-paper__rule billing-paper__rule--light" />
      <div className="billing-paper__block">
        <PaperRow strong label={t('pDrawer')} value="" />
        <PaperRow indent label={t('pExpectedIqd')} value={n(props.expectedIqd)} />
        <PaperRow indent label={t('pCountedIqd')} value={props.countedIqd === null ? '—' : n(props.countedIqd)} />
        {props.countedIqd === null ? null : (
          <PaperRow
            indent
            strong
            label={t('pVarianceIqd')}
            value={signed(formatIqdNumber(Math.abs(props.countedIqd - props.expectedIqd), locale), props.countedIqd < props.expectedIqd)}
          />
        )}
        <PaperRow indent label={t('pExpectedUsd')} value={usd(props.expectedUsdCents)} />
        <PaperRow indent label={t('pCountedUsd')} value={props.countedUsdCents === null ? '—' : usd(props.countedUsdCents)} />
        {props.countedUsdCents === null ? null : (
          <PaperRow
            indent
            strong
            label={t('pVarianceUsd')}
            value={signed(formatCentsNumber(Math.abs(props.countedUsdCents - props.expectedUsdCents), locale), props.countedUsdCents < props.expectedUsdCents)}
          />
        )}
      </div>
      <hr className="billing-paper__rule billing-paper__rule--light" />
      <div className="billing-paper__signatures">
        <span>{t('pSignCashier')}</span>
        <span>{t('pSignSupervisor')}</span>
      </div>
    </ThermalPaper>
  );
}
