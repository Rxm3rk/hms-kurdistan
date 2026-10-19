/**
 * The cashier desk: today's takings split into IQD and USD, the open invoices of the hospital, the payments
 * of the day, the shift's drawer (opening float, cash in, change out, expected) and closing the shift with a
 * note-by-note cash count and a Z report on 80 mm paper. Everything is session state; the printer and the
 * card terminal are simulated. SYNTHETIC DATA ONLY, NOT FOR CLINICAL USE.
 */
import { useState, type ReactNode } from 'react';
import {
  INVOICES,
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_TONE,
  PAYMENT_METHOD_LABEL,
  findPatient,
  findStaff,
  getPayer,
} from '../../data/index.ts';
import type { Invoice, Patient } from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { useCurrentPatientId, useOpenPatient, useRole } from '../../shell/index.ts';
import {
  BarChart,
  Badge,
  Button,
  Callout,
  Card,
  Code,
  DataTable,
  Dialog,
  Grid,
  Money,
  PatientInline,
  StaffName,
  StatTile,
  TextInput,
  useToast,
  type Column,
} from '../../ui/index.ts';
import { SHIFT, accountTotals, inThisShift, type AccountTotals, type Claim, type PaymentRecord } from './billing-data.ts';
import { allPaymentsToday, billingActions, claimOf, paymentsOf, useBillingSession, type BillingSession } from './billing-store.ts';
import { messages } from './messages.ts';
import { IQD_NOTES, USD_NOTES, formatUsdCents, iqdFromUsdCents, notesFor, parseIqd, roundCash } from './money.ts';
import { ClaimChip, SimulatedTag, UsdEquivalent, UsdMoney } from './parts.tsx';
import { ThermalZReport } from './receipt.tsx';

interface OpenRow {
  readonly invoice: Invoice;
  readonly patient: Patient;
  readonly totals: AccountTotals;
  readonly claim: Claim | null;
}

const STATUS_ORDER: Readonly<Record<Invoice['status'], number>> = { open: 0, 'partially-paid': 1, draft: 2, paid: 3, void: 4 };

function openRows(session: BillingSession): readonly OpenRow[] {
  return INVOICES.flatMap((invoice): OpenRow[] => {
    const patient = findPatient(invoice.patientId);
    if (patient === undefined || invoice.status === 'void') {
      return [];
    }
    const totals = accountTotals(invoice, session.exemptions[invoice.id], paymentsOf(session, invoice));
    return totals.balanceIqd > 0 ? [{ invoice, patient, totals, claim: claimOf(session, invoice) }] : [];
  }).toSorted((a, b) => STATUS_ORDER[a.invoice.status] - STATUS_ORDER[b.invoice.status] || b.invoice.issuedIso.localeCompare(a.invoice.issuedIso));
}

/** How many invoices still have a balance (for the tab badge). */
export function openInvoiceCount(session: BillingSession): number {
  return openRows(session).length;
}

interface Takings {
  readonly receipts: number;
  readonly iqdTendered: number;
  readonly changeIqd: number;
  readonly usdCents: number;
  readonly cashIqd: number;
  readonly cashUsdCents: number;
  readonly cardIqd: number;
  /** Positive: patients gained (the drawer holds less than the value applied). */
  readonly roundingIqd: number;
}

function sumTakings(records: readonly PaymentRecord[]): Takings {
  let iqdTendered = 0;
  let changeIqd = 0;
  let usdCents = 0;
  let cashIqd = 0;
  let cashUsdCents = 0;
  let cardIqd = 0;
  let roundingIqd = 0;
  for (const record of records) {
    changeIqd += record.changeIqd;
    roundingIqd += record.roundingIqd;
    for (const tender of record.tenders) {
      if (tender.currency === 'IQD') {
        iqdTendered += tender.minor;
      } else {
        usdCents += tender.minor;
      }
      if (record.method === 'cash') {
        if (tender.currency === 'IQD') {
          cashIqd += tender.minor;
        } else {
          cashUsdCents += tender.minor;
        }
      } else {
        cardIqd += tender.valueIqd;
      }
    }
  }
  return { receipts: records.length, iqdTendered, changeIqd, usdCents, cashIqd, cashUsdCents, cardIqd, roundingIqd };
}

type CountKey = `iqd-${number}` | `usd-${number}`;

export function DeskTab(): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const session = useBillingSession();
  const openPatient = useOpenPatient();
  const currentId = useCurrentPatientId();
  const { roleId, user, setRole } = useRole();

  const [counting, setCounting] = useState(false);
  const [counts, setCounts] = useState<Partial<Record<CountKey, string>>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const rows = openRows(session);
  const owed = rows.reduce((sum, row) => sum + row.totals.balanceIqd, 0);
  const today = allPaymentsToday(session);
  const day = sumTakings(today);
  const shiftRecords = today.filter((record) => inThisShift(record.iso));
  const shift = sumTakings(shiftRecords);
  const cashier = findStaff(SHIFT.cashierId) ?? user;

  const dayNetIqd = day.iqdTendered - day.changeIqd;
  const dayTotalIqd = dayNetIqd + iqdFromUsdCents(day.usdCents);
  const expectedIqd = SHIFT.floatIqd + shift.cashIqd - shift.changeIqd;
  const expectedUsdCents = SHIFT.floatUsdCents + shift.cashUsdCents;
  const closed = session.shiftClose;

  // ---- cash count ----
  const countOf = (key: CountKey): number | null => parseIqd(counts[key] ?? '');
  const countInvalid = [...IQD_NOTES.map((note): CountKey => `iqd-${note}`), ...USD_NOTES.map((note): CountKey => `usd-${note}`)].some((key) => countOf(key) === null);
  const countedIqd = IQD_NOTES.reduce((sum, note) => sum + note * (countOf(`iqd-${note}`) ?? 0), 0);
  const countedUsdCents = USD_NOTES.reduce((sum, note) => sum + note * 100 * (countOf(`usd-${note}`) ?? 0), 0);
  const varianceIqd = countedIqd - expectedIqd;
  const varianceUsd = countedUsdCents - expectedUsdCents;

  const fillSample = (): void => {
    const iqdNotes = notesFor(roundCash(expectedIqd, 'down'), IQD_NOTES);
    const usdNotes = notesFor((expectedUsdCents - (expectedUsdCents % 100)) / 100, USD_NOTES);
    const next: Partial<Record<CountKey, string>> = {};
    IQD_NOTES.forEach((note, index) => {
      next[`iqd-${note}`] = String(iqdNotes[index] ?? 0);
    });
    USD_NOTES.forEach((note, index) => {
      next[`usd-${note}`] = String(usdNotes[index] ?? 0);
    });
    setCounts(next);
  };

  const varianceTone = (value: number, tolerance: number): 'success' | 'info' | 'warning' =>
    value === 0 ? 'success' : Math.abs(value) < tolerance ? 'info' : 'warning';

  const varianceText = (value: number, currency: 'IQD' | 'USD'): ReactNode => {
    if (value === 0) {
      return t('varBalanced');
    }
    const amount = currency === 'IQD' ? <Money amount={Math.abs(value)} /> : <UsdMoney cents={Math.abs(value)} />;
    return value > 0 ? t.rich('varOver', { amount }) : t.rich('varShort', { amount });
  };

  // ---- tables ----
  const openColumns: readonly Column<OpenRow>[] = [
    {
      id: 'invoice',
      header: t('colInvoice'),
      nowrap: true,
      cell: (row) => (
        <span className="billing-pair">
          <Code>{row.invoice.id}</Code>
          <span className="billing-muted">{f.time(row.invoice.issuedIso)}</span>
        </span>
      ),
    },
    {
      id: 'patient',
      header: t('colPatient'),
      cell: (row) => (
        <span className="billing-pair">
          <PatientInline patient={row.patient} />
          {row.patient.id === currentId ? (
            <Badge size="sm" tone="accent" icon="user">
              {t('openNow')}
            </Badge>
          ) : null}
        </span>
      ),
    },
    {
      id: 'payer',
      header: t('colPayer'),
      cell: (row) => (
        <span className="billing-pair">
          <span>{f.text(getPayer(row.invoice.payerId).name)}</span>
          {row.claim === null ? null : <ClaimChip status={row.claim.status} />}
        </span>
      ),
    },
    {
      id: 'status',
      header: t('colStatus'),
      cell: (row) => (
        <Badge size="sm" tone={INVOICE_STATUS_TONE[row.invoice.status]}>
          {f.text(INVOICE_STATUS_LABEL[row.invoice.status])}
        </Badge>
      ),
    },
    {
      id: 'balance',
      header: t('colBalance'),
      align: 'end',
      nowrap: true,
      cell: (row) => (
        <span className="billing-pair billing-pair--end">
          <Money amount={row.totals.balanceIqd} className="billing-strong" />
          <UsdEquivalent iqd={row.totals.balanceIqd} className="billing-muted" />
        </span>
      ),
    },
  ];

  const paymentColumns: readonly Column<PaymentRecord>[] = [
    {
      id: 'time',
      header: t('colTime'),
      nowrap: true,
      cell: (record) => (
        <span className="billing-pair">
          <span>{f.time(record.iso)}</span>
          {inThisShift(record.iso) ? null : <span className="billing-muted billing-small">{t('earlierShift')}</span>}
        </span>
      ),
    },
    { id: 'receipt', header: t('colReceipt'), nowrap: true, cell: (record) => <Code>{record.receipt}</Code> },
    {
      id: 'patient',
      header: t('colPatient'),
      cell: (record) => {
        const patient = findPatient(record.patientId);
        return patient === undefined ? <Code>{record.patientId}</Code> : <PatientInline patient={patient} />;
      },
    },
    {
      id: 'method',
      header: t('colMethod'),
      cell: (record) => (
        <span className="billing-pair">
          <Badge size="sm" tone={record.method === 'card' ? 'info' : 'neutral'}>
            {f.text(PAYMENT_METHOD_LABEL[record.method])}
          </Badge>
          {record.session ? (
            <Badge size="sm" tone="success" icon="check">
              {t('takenNow')}
            </Badge>
          ) : null}
        </span>
      ),
    },
    {
      id: 'tendered',
      header: t('colTendered'),
      cell: (record) => (
        <span className="billing-pair">
          {record.tenders.map((tender) => (tender.currency === 'USD' ? <UsdMoney key="usd" cents={tender.minor} /> : <Money key="iqd" amount={tender.minor} />))}
          {record.changeIqd > 0 ? <span className="billing-muted billing-small">{t.rich('changeShort', { amount: <Money amount={record.changeIqd} /> })}</span> : null}
        </span>
      ),
    },
    { id: 'value', header: t('colValue'), align: 'end', nowrap: true, cell: (record) => <Money amount={record.appliedIqd} className="billing-strong" /> },
    {
      id: 'by',
      header: t('colBy'),
      cell: (record) => {
        const member = findStaff(record.receivedById);
        return member === undefined ? '—' : <StaffName member={member} />;
      },
    },
  ];

  const methodBars = [
    { id: 'cash-iqd', label: t('mCashIqd'), value: day.cashIqd - day.changeIqd, valueLabel: f.iqd(day.cashIqd - day.changeIqd) },
    { id: 'cash-usd', label: t('mCashUsd'), value: iqdFromUsdCents(day.cashUsdCents), valueLabel: formatUsdCents(day.cashUsdCents, f.locale) },
    { id: 'card', label: t('mCard'), value: day.cardIqd, valueLabel: f.iqd(day.cardIqd) },
  ];

  const countField = (key: CountKey, note: number, currency: 'IQD' | 'USD'): ReactNode => {
    const count = countOf(key) ?? 0;
    const lineTotal = currency === 'IQD' ? <Money amount={note * count} /> : <UsdMoney cents={note * 100 * count} />;
    return (
      <div key={key} className="billing-count__row">
        <span className="billing-count__note">{currency === 'IQD' ? <Money amount={note} /> : <UsdMoney cents={note * 100} />}</span>
        <TextInput
          className="billing-count__input"
          label={t('countLabel', { note: currency === 'IQD' ? f.iqd(note) : formatUsdCents(note * 100, f.locale) })}
          hideLabel
          value={counts[key] ?? ''}
          onChange={(value) => {
            setCounts((current) => ({ ...current, [key]: value }));
          }}
          dir="ltr"
          inputMode="numeric"
          placeholder="0"
        />
        <span className="billing-count__total">{lineTotal}</span>
      </div>
    );
  };

  return (
    <div className="billing-desk">
      <Grid min="14rem">
        <StatTile label={t('tIqd')} value={<Money amount={dayNetIqd} />} icon="money" tone="success" hint={t('tIqdHint', { count: today.filter((record) => record.tenders.some((tender) => tender.currency === 'IQD')).length })} />
        <StatTile label={t('tUsd')} value={<UsdMoney cents={day.usdCents} />} icon="money" tone="success" hint={t.rich('tUsdHint', { amount: <Money amount={iqdFromUsdCents(day.usdCents)} /> })} />
        <StatTile label={t('tTotal')} value={<Money amount={dayTotalIqd} />} icon="receipt" hint={t('tTotalHint', { count: day.receipts })} />
        <StatTile label={t('tOpen')} value={f.number(rows.length)} icon="clipboard" tone={rows.length > 0 ? 'warning' : 'success'} hint={t.rich('tOpenHint', { amount: <Money amount={owed} /> })} />
      </Grid>

      <div className="billing-desk__columns">
        <Card
          title={t('openTitle')}
          subtitle={t('openSubtitle')}
          icon="receipt"
          flush
          footer={<span className="billing-small billing-muted">{t('openFooter')}</span>}
        >
          <DataTable
            caption={t('openTitle')}
            columns={openColumns}
            rows={rows}
            rowKey={(row) => row.invoice.id}
            selectedKey={rows.find((row) => row.patient.id === currentId)?.invoice.id ?? null}
            rowTone={(row) => (row.invoice.status === 'open' ? 'warning' : undefined)}
            onRowAction={(row) => {
              if (row.patient.id !== currentId) {
                openPatient(row.patient.id, 'billing');
              }
            }}
            emptyText={t('openEmpty')}
          />
        </Card>

        <div className="billing-desk__side">
          <Card
            title={t('shiftTitle')}
            subtitle={f.text(SHIFT.desk)}
            icon="clock"
            {...(closed === null ? {} : { tone: 'neutral' as const })}
            actions={
              closed === null ? (
                <Badge tone="success" icon="check-circle">
                  {t('shiftOpen')}
                </Badge>
              ) : (
                <Badge tone="neutral" icon="lock">
                  {t('shiftClosedAt', { time: f.time(closed.closedIso) })}
                </Badge>
              )
            }
          >
            <div className="billing-shift">
              <p className="billing-shift__meta">
                <Code>{SHIFT.id}</Code>
                <span>·</span>
                <StaffName member={cashier} />
              </p>
              <p className="billing-small billing-muted">
                {t('shiftHours', { from: f.time(SHIFT.openedIso), to: f.time(SHIFT.plannedCloseIso), since: f.relative(SHIFT.openedIso) })}
              </p>
              <table className="billing-drawer">
                <caption className="hms-visually-hidden">{t('drawerTitle')}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t('drawerTitle')}</th>
                    <th scope="col" className="billing-drawer__num">
                      {t('currencyIqd')}
                    </th>
                    <th scope="col" className="billing-drawer__num">
                      {t('currencyUsd')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">{t('drawerFloat')}</th>
                    <td className="billing-drawer__num">
                      <Money amount={SHIFT.floatIqd} />
                    </td>
                    <td className="billing-drawer__num">
                      <UsdMoney cents={SHIFT.floatUsdCents} />
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">{t('drawerCashIn')}</th>
                    <td className="billing-drawer__num">
                      +<Money amount={shift.cashIqd} />
                    </td>
                    <td className="billing-drawer__num">
                      +<UsdMoney cents={shift.cashUsdCents} />
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">{t('drawerChange')}</th>
                    <td className="billing-drawer__num">
                      −<Money amount={shift.changeIqd} />
                    </td>
                    <td className="billing-drawer__num billing-muted">—</td>
                  </tr>
                  <tr className="billing-drawer__total">
                    <th scope="row">{t('drawerExpected')}</th>
                    <td className="billing-drawer__num">
                      <Money amount={expectedIqd} />
                    </td>
                    <td className="billing-drawer__num">
                      <UsdMoney cents={expectedUsdCents} />
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="billing-small">
                {t.rich('drawerCard', { amount: <Money amount={shift.cardIqd} /> })} <SimulatedTag />
              </p>
              <p className="billing-small">
                {shift.roundingIqd === 0
                  ? t('drawerRoundingNone')
                  : t.rich(shift.roundingIqd > 0 ? 'drawerRoundingGiven' : 'drawerRoundingKept', { amount: <Money amount={Math.abs(shift.roundingIqd)} /> })}
              </p>
              {closed === null ? null : (
                <Callout tone="neutral" title={t('closedSummaryTitle')}>
                  <p>{t.rich('closedSummaryIqd', { counted: <Money amount={closed.countedIqd} />, variance: varianceText(closed.countedIqd - closed.expectedIqd, 'IQD') })}</p>
                  <p>{t.rich('closedSummaryUsd', { counted: <UsdMoney cents={closed.countedUsdCents} />, variance: varianceText(closed.countedUsdCents - closed.expectedUsdCents, 'USD') })}</p>
                </Callout>
              )}
              <div className="billing-actions">
                {closed === null ? (
                  <Button
                    variant="primary"
                    icon="lock"
                    isDisabled={roleId !== 'cashier' || counting}
                    onPress={() => {
                      setCounting(true);
                    }}
                  >
                    {t('countAndClose')}
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    icon="refresh"
                    onPress={() => {
                      billingActions.reopenShift();
                      setCounts({});
                    }}
                  >
                    {t('reopenShift')}
                  </Button>
                )}
                <Button
                  icon="printer"
                  onPress={() => {
                    setReportOpen(true);
                  }}
                >
                  {closed === null ? t('xReport') : t('zReport')}
                </Button>
              </div>
              {roleId !== 'cashier' && closed === null ? (
                <p className="billing-small billing-muted">
                  {t('closeCashierOnly')}{' '}
                  <Button size="sm" variant="ghost" icon="user" onPress={() => { setRole('cashier'); }}>
                    {t('switchToCashier')}
                  </Button>
                </p>
              ) : null}
            </div>
          </Card>

          <Card title={t('methodTitle')} subtitle={t('methodSubtitle')} icon="chart">
            <BarChart data={methodBars} label={t('methodTitle')} />
          </Card>
        </div>
      </div>

      {counting && closed === null ? (
        <Card title={t('countTitle')} subtitle={t('countSubtitle')} icon="money" tone="accent">
          <div className="billing-count">
            <fieldset className="billing-count__group">
              <legend className="billing-count__legend">{t('countIqd')}</legend>
              {IQD_NOTES.map((note) => countField(`iqd-${note}`, note, 'IQD'))}
              <div className="billing-count__sum">
                <span>{t('countedTotal')}</span>
                <Money amount={countedIqd} className="billing-strong" />
              </div>
            </fieldset>
            <fieldset className="billing-count__group">
              <legend className="billing-count__legend">{t('countUsd')}</legend>
              {USD_NOTES.map((note) => countField(`usd-${note}`, note, 'USD'))}
              <div className="billing-count__sum">
                <span>{t('countedTotal')}</span>
                <UsdMoney cents={countedUsdCents} className="billing-strong" />
              </div>
            </fieldset>
          </div>
          {countInvalid ? (
            <p className="billing-error" role="alert">
              {t('countInvalid')}
            </p>
          ) : null}
          <div className="billing-variance">
            <Callout tone={varianceTone(varianceIqd, 250)} title={t('varIqdTitle')}>
              <p>{t.rich('varExpected', { amount: <Money amount={expectedIqd} /> })}</p>
              <p className="billing-strong">{varianceText(varianceIqd, 'IQD')}</p>
              {varianceIqd !== 0 && Math.abs(varianceIqd) < 250 ? <p className="billing-small">{t('varWithinStep')}</p> : null}
            </Callout>
            <Callout tone={varianceTone(varianceUsd, 1)} title={t('varUsdTitle')}>
              <p>{t.rich('varExpected', { amount: <UsdMoney cents={expectedUsdCents} /> })}</p>
              <p className="billing-strong">{varianceText(varianceUsd, 'USD')}</p>
            </Callout>
          </div>
          <div className="billing-actions">
            <Button
              variant="ghost"
              onPress={() => {
                setCounting(false);
              }}
            >
              {t('cancel')}
            </Button>
            <Button variant="ghost" icon="refresh" onPress={fillSample}>
              {t('fillSample')}
            </Button>
            <Button
              variant="primary"
              icon="lock"
              isDisabled={countInvalid || roleId !== 'cashier'}
              onPress={() => {
                setConfirmOpen(true);
              }}
            >
              {t('closeShift')}
            </Button>
          </div>
        </Card>
      ) : null}

      <Card title={t('paymentsTodayTitle')} subtitle={t('paymentsCount', { count: today.length })} icon="money" flush>
        <DataTable
          caption={t('paymentsTodayTitle')}
          columns={paymentColumns}
          rows={today}
          rowKey={(record) => record.id}
          emptyText={t('paymentsEmpty')}
          dense
        />
      </Card>

      <Dialog
        isOpen={confirmOpen}
        onOpenChange={setConfirmOpen}
        role="alertdialog"
        title={t('confirmCloseTitle')}
        subtitle={t('confirmCloseSubtitle', { id: SHIFT.id })}
        actions={
          <>
            <Button
              onPress={() => {
                setConfirmOpen(false);
              }}
            >
              {t('keepOpen')}
            </Button>
            <Button
              variant="primary"
              icon="lock"
              onPress={() => {
                billingActions.closeShift({ countedIqd, countedUsdCents, expectedIqd, expectedUsdCents });
                setConfirmOpen(false);
                setCounting(false);
                toast({ tone: 'success', title: t('closedToast'), body: t('closedToastBody', { id: SHIFT.zReport }) });
              }}
            >
              {t('closeShift')}
            </Button>
          </>
        }
      >
        <ul className="billing-confirm">
          <li>{t.rich('confirmIqd', { counted: <Money amount={countedIqd} />, variance: varianceText(varianceIqd, 'IQD') })}</li>
          <li>{t.rich('confirmUsd', { counted: <UsdMoney cents={countedUsdCents} />, variance: varianceText(varianceUsd, 'USD') })}</li>
          <li>{t('confirmEffect')}</li>
        </ul>
      </Dialog>

      <Dialog
        isOpen={reportOpen}
        onOpenChange={setReportOpen}
        title={closed === null ? t('xReport') : t('zReport')}
        subtitle={
          <span className="billing-dialog-sub">
            {f.text(SHIFT.printer)} <SimulatedTag />
          </span>
        }
        actions={
          <>
            <Button
              onPress={() => {
                setReportOpen(false);
              }}
            >
              {t('close')}
            </Button>
            <Button
              variant="primary"
              icon="printer"
              onPress={() => {
                toast({ tone: 'success', title: t('printedToast'), body: t('printedToastBody', { printer: f.text(SHIFT.printer) }) });
                setReportOpen(false);
              }}
            >
              {t('printSimulated')}
            </Button>
          </>
        }
      >
        <ThermalZReport
          cashier={cashier}
          closedIso={closed?.closedIso ?? null}
          receipts={shift.receipts}
          cashIqd={shift.cashIqd}
          cashUsdCents={shift.cashUsdCents}
          changeIqd={shift.changeIqd}
          cardIqd={shift.cardIqd}
          roundingIqd={-shift.roundingIqd}
          expectedIqd={closed?.expectedIqd ?? expectedIqd}
          expectedUsdCents={closed?.expectedUsdCents ?? expectedUsdCents}
          countedIqd={closed?.countedIqd ?? null}
          countedUsdCents={closed?.countedUsdCents ?? null}
        />
      </Dialog>
    </div>
  );
}
