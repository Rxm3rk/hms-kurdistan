/**
 * Home for the cashier (Dlshad Omer): today's takings in Iraqi dinars and US dollars, the invoices still open,
 * the payments received today, the demo exchange rate and the seven-day receipts.
 */
import type { ReactNode } from 'react';
import {
  AUDIT_EVENTS,
  EXCHANGE_RATE,
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_TONE,
  PAYMENT_METHOD_LABEL,
  TRENDS,
  TREND_DAYS,
  cashTodayByCurrency,
  findStaff,
  getPatient,
  getPayer,
  iqdToUsd,
  paymentsToday,
  usdToIqd,
} from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { useOpenPatient, useScreenHref } from '../../shell/index.ts';
import {
  BarChart,
  Badge,
  Card,
  Code,
  DataTable,
  Grid,
  Money,
  PatientInline,
  StaffName,
  StatTile,
  type Column,
} from '../../ui/index.ts';
import { openInvoices, type OpenInvoiceRow } from './derive.ts';
import { messages } from './messages.ts';

export function CashierHome(): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const href = useScreenHref();
  const openPatient = useOpenPatient();

  const cash = cashTodayByCurrency();
  const payments = paymentsToday().toSorted((a, b) => b.payment.iso.localeCompare(a.payment.iso));
  const iqdCount = payments.filter((entry) => entry.payment.currency === 'IQD').length;
  const usdCount = payments.length - iqdCount;
  const totalIqd = cash.IQD + usdToIqd(cash.USD);
  const invoices = openInvoices();
  const owed = invoices.reduce((sum, row) => sum + row.balanceIqd, 0);
  const firstInvoice = invoices[0];
  const rateEvent = AUDIT_EVENTS.find((event) => event.id === 'SYN-AUD-0005');
  const rateBy = findStaff(rateEvent?.actorId);
  const lastDay = TREND_DAYS.length - 1;

  const columns: readonly Column<OpenInvoiceRow>[] = [
    {
      id: 'invoice',
      header: t('colInvoice'),
      nowrap: true,
      cell: (row) => (
        <span className="home-two-line">
          <Code>{row.invoice.id}</Code>
          <span className="home-muted">{f.time(row.invoice.issuedIso)}</span>
        </span>
      ),
    },
    { id: 'patient', header: t('colPatient'), cell: (row) => <PatientInline patient={row.patient} /> },
    {
      id: 'payer',
      header: t('colPayer'),
      cell: (row) => {
        const payer = getPayer(row.invoice.payerId);
        return (
          <span className="home-two-line">
            <span>{f.text(payer.name)}</span>
            {payer.coveragePct > 0 ? <span className="home-muted">{t('payerCovers', { percent: f.percent(payer.coveragePct / 100) })}</span> : null}
          </span>
        );
      },
    },
    {
      id: 'status',
      header: t('colStatus'),
      cell: (row) => (
        <Badge tone={INVOICE_STATUS_TONE[row.invoice.status]} size="sm">
          {f.text(INVOICE_STATUS_LABEL[row.invoice.status])}
        </Badge>
      ),
    },
    {
      id: 'balance',
      header: t('colBalance'),
      align: 'end',
      nowrap: true,
      cell: (row) =>
        row.invoice.currency === 'USD' ? (
          <span className="home-two-line home-end">
            <Money amount={iqdToUsd(row.balanceIqd)} currency="USD" className="home-strong" />
            <span className="home-muted">
              <Money amount={row.balanceIqd} />
            </span>
          </span>
        ) : (
          <Money amount={row.balanceIqd} className="home-strong" />
        ),
    },
  ];

  const revenue = TRENDS.revenueThousandIqd.map((value, index) => {
    const day = TREND_DAYS[index] ?? '';
    return {
      id: day,
      label: index === lastDay ? t('todayShort') : String(Number(day.slice(8, 10))),
      value,
      valueLabel: f.number(value),
    };
  });

  return (
    <>
      <Grid min="14rem">
        <StatTile
          label={t('tileTakenIqd')}
          value={<Money amount={cash.IQD} />}
          icon="money"
          tone="success"
          hint={t('paymentsCount', { count: iqdCount })}
          href={href('cashier')}
        />
        <StatTile
          label={t('tileTakenUsd')}
          value={<Money amount={cash.USD} currency="USD" />}
          icon="money"
          tone="success"
          hint={t('paymentsCount', { count: usdCount })}
          href={href('cashier')}
        />
        <StatTile
          label={t('tileTakenTotal')}
          value={<Money amount={totalIqd} />}
          icon="receipt"
          hint={f.text(EXCHANGE_RATE.note)}
          trend={TRENDS.revenueThousandIqd}
          trendLabel={t('revenueTitle')}
          href={href('cashier')}
        />
        <StatTile
          label={t('tileOpenInvoices')}
          value={f.number(invoices.length)}
          tone={invoices.length > 0 ? 'warning' : 'success'}
          icon="receipt"
          hint={t.rich('tileOpenInvoicesHint', { amount: <Money amount={owed} /> })}
          href={firstInvoice === undefined ? href('billing') : href('billing', { patient: firstInvoice.patient.id })}
        />
      </Grid>

      <div className="home-columns">
        <div className="home-main">
          <Card title={t('invoicesTitle')} subtitle={t('invoicesSubtitle', { count: invoices.length })} icon="receipt" flush footer={t('rowHintBilling')}>
            <DataTable
              caption={t('invoicesTitle')}
              columns={columns}
              rows={invoices}
              rowKey={(row) => row.invoice.id}
              rowTone={(row) => (row.invoice.status === 'open' ? 'warning' : undefined)}
              onRowAction={(row) => {
                openPatient(row.patient.id, 'billing');
              }}
              emptyText={t('invoicesEmpty')}
            />
          </Card>

          <Card title={t('revenueTitle')} subtitle={t('revenueSubtitle')} icon="chart">
            <BarChart data={revenue} label={t('revenueTitle')} orientation="vertical" height="9rem" />
            <p className="home-small home-chart-note">{t('revenueNote')}</p>
          </Card>
        </div>

        <div className="home-side">
          <Card title={t('rateTitle')} icon="money" tone="info">
            <p className="home-rate">
              {t('rateBig', { rate: f.number(EXCHANGE_RATE.usdToIqd) })}
            </p>
            <p className="home-small">
              {rateEvent === undefined || rateBy === undefined
                ? f.text(EXCHANGE_RATE.note)
                : t.rich('rateConfirmed', { time: f.time(rateEvent.iso), name: <StaffName member={rateBy} /> })}
            </p>
            <p className="home-small home-muted">{t('rateNote')}</p>
          </Card>

          <Card title={t('paymentsTitle')} subtitle={t('paymentsSubtitle', { count: payments.length })} icon="money">
            <ul className="home-list">
              {payments.map(({ invoice, payment }) => (
                <li key={payment.id} className="home-list__item">
                  <div className="home-list__main">
                    <p className="home-list__title home-payment">
                      <Money amount={payment.amount} currency={payment.currency} className="home-strong" />
                      <Badge tone="neutral" size="sm">
                        {f.text(PAYMENT_METHOD_LABEL[payment.method])}
                      </Badge>
                    </p>
                    <PatientInline patient={getPatient(invoice.patientId)} />
                    <span className="home-muted">
                      {f.time(payment.iso)} · {t('receipt')} <Code>{payment.receipt}</Code>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
