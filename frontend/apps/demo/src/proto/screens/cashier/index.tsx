/**
 * The cashier: the dual-currency drawer (IQD and USD at the demo exchange rate), deposits and top-ups,
 * running inpatient bills against deposits, discount and refund approvals, doctor-fee settlement, and the
 * per-currency shift close with a denomination count. Every change stays in this screen's state.
 */
import { useMemo, useState, type ReactNode } from 'react';
import {
  DEMO_NOW_ISO,
  EXCHANGE_RATE,
  findStaff,
  getPatient,
  iqdToUsd,
  locationOf,
  usdToIqd,
  type Currency,
  type Tone,
} from '../../data/index.ts';
import {
  CASH_TX,
  DISCOUNTS,
  DOCTOR_FEES,
  PAYER_ORGS,
  REFUNDS,
  RUNNING_BILLS,
  SHIFT,
  type ApprovalStatus,
  type CashTx,
  type DiscountRequest,
  type DoctorFee,
  type RefundRequest,
  type RunningBill,
  type TxKind,
  type TxMethod,
} from '../../data/ext/cashier.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { useGoTo } from '../../shell/index.ts';
import {
  Badge,
  Button,
  Callout,
  Card,
  Code,
  DataTable,
  Dialog,
  Grid,
  IconButton,
  KeyValueList,
  Meter,
  Money,
  PageHeader,
  PatientInline,
  SearchField,
  Segmented,
  SelectField,
  StaffName,
  StatTile,
  Tabs,
  TextInput,
  personName,
  staffName,
  useToast,
  type Column,
} from '../../ui/index.ts';
import './cashier.css';
import { messages } from './messages.ts';
import { ShiftClose } from './shift-close.tsx';

const KIND_KEY = { deposit: 'kDeposit', 'top-up': 'kTopUp', payment: 'kPayment', refund: 'kRefund', 'doctor-fee': 'kDoctorFee', exchange: 'kExchange' } as const satisfies Record<TxKind, string>;
const KIND_TONE: Readonly<Record<TxKind, Tone>> = { deposit: 'success', 'top-up': 'success', payment: 'info', refund: 'warning', 'doctor-fee': 'accent', exchange: 'neutral' };
const METHOD_KEY = { cash: 'mCash', card: 'mCard', transfer: 'mTransfer' } as const satisfies Record<TxMethod, string>;
const APPROVAL_TONE: Readonly<Record<ApprovalStatus | 'paid', Tone>> = { pending: 'warning', approved: 'info', rejected: 'neutral', paid: 'success' };
const APPROVAL_KEY = { pending: 'aPending', approved: 'aApproved', rejected: 'aRejected', paid: 'aPaid' } as const satisfies Record<ApprovalStatus | 'paid', string>;

function txIqd(tx: CashTx): number {
  return tx.currency === 'IQD' ? tx.amount : usdToIqd(tx.amount);
}

export function CashierScreen(): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const goTo = useGoTo();

  const [txs, setTxs] = useState<readonly CashTx[]>(CASH_TX);
  const [bills, setBills] = useState<readonly RunningBill[]>(RUNNING_BILLS);
  const [discounts, setDiscounts] = useState<readonly DiscountRequest[]>(DISCOUNTS);
  const [refunds, setRefunds] = useState<readonly RefundRequest[]>(REFUNDS);
  const [fees, setFees] = useState<readonly DoctorFee[]>(DOCTOR_FEES);
  const [closed, setClosed] = useState(false);
  const [tab, setTab] = useState('drawer');
  const [search, setSearch] = useState('');
  const [selectedBill, setSelectedBill] = useState<string | null>(null);
  const [receiptSeq, setReceiptSeq] = useState(30423);
  // Deposit dialog
  const [depositOpen, setDepositOpen] = useState(false);
  const [depPatient, setDepPatient] = useState('SYN-PAT-0103');
  const [depKind, setDepKind] = useState<'deposit' | 'top-up'>('top-up');
  const [depCurrency, setDepCurrency] = useState<Currency>('IQD');
  const [depAmount, setDepAmount] = useState('');
  const [depMethod, setDepMethod] = useState<TxMethod>('cash');
  // Converter
  const [convAmount, setConvAmount] = useState('100');
  const [convFrom, setConvFrom] = useState<Currency>('USD');

  const nextReceipt = (): string => {
    const r = `SYN-RCT-26-${String(receiptSeq)}`;
    setReceiptSeq((n) => n + 1);
    return r;
  };
  const addTx = (tx: Omit<CashTx, 'id' | 'iso' | 'receipt'>): string => {
    const receipt = nextReceipt();
    setTxs((current) => [...current, { ...tx, id: `TX-${String(current.length + 1).padStart(2, '0')}`, iso: DEMO_NOW_ISO, receipt }]);
    return receipt;
  };

  const cash = txs.filter((tx) => tx.method === 'cash');
  const expected: Record<Currency, number> = {
    IQD: SHIFT.floatIqd + cash.filter((tx) => tx.currency === 'IQD').reduce((s, tx) => s + tx.amount, 0),
    USD: Math.round((SHIFT.floatUsd + cash.filter((tx) => tx.currency === 'USD').reduce((s, tx) => s + tx.amount, 0)) * 100) / 100,
  };
  const nonCash: Record<Currency, number> = {
    IQD: txs.filter((tx) => tx.method !== 'cash' && tx.currency === 'IQD').reduce((s, tx) => s + tx.amount, 0),
    USD: txs.filter((tx) => tx.method !== 'cash' && tx.currency === 'USD').reduce((s, tx) => s + tx.amount, 0),
  };
  const depositsToday = txs.filter((tx) => tx.kind === 'deposit' || tx.kind === 'top-up').reduce((s, tx) => s + txIqd(tx), 0);
  const pendingApprovals = discounts.filter((d) => d.status === 'pending').length + refunds.filter((r) => r.status === 'pending').length;
  const unsettled = fees.filter((fee) => !fee.settled);
  const unsettledIqd = unsettled.reduce((s, fee) => s + Math.round(fee.grossIqd * (1 - fee.hospitalShare)), 0);

  const payerName = (id: string): string => {
    const p = PAYER_ORGS.find((x) => x.id === id);
    return p === undefined ? id : f.text(p.name);
  };
  const billFigures = (b: RunningBill): { readonly patientShare: number; readonly payerAmount: number; readonly balance: number } => {
    const payerAmount = Math.round(b.chargesIqd * b.payerShare);
    const patientShare = b.chargesIqd - payerAmount;
    return { patientShare, payerAmount, balance: b.depositsIqd - patientShare };
  };
  const needsTopUp = (b: RunningBill): boolean => billFigures(b).balance < b.thresholdIqd;

  const openDeposit = (patientId: string, kind: 'deposit' | 'top-up', amountIqd?: number): void => {
    setDepPatient(patientId);
    setDepKind(kind);
    setDepCurrency('IQD');
    setDepAmount(amountIqd === undefined ? '' : String(Math.max(0, Math.ceil(amountIqd / 1000) * 1000)));
    setDepMethod('cash');
    setDepositOpen(true);
  };

  // ---------------------------------------------------------------------------------------------------------
  // Drawer
  // ---------------------------------------------------------------------------------------------------------

  const txColumns: readonly Column<CashTx>[] = [
    { id: 'time', header: t('colTime'), nowrap: true, cell: (tx) => <span className="cs-two"><span>{f.time(tx.iso)}</span><Code className="cs-muted">{tx.receipt}</Code></span> },
    { id: 'kind', header: t('colKind'), cell: (tx) => <Badge tone={KIND_TONE[tx.kind]} size="sm">{t(KIND_KEY[tx.kind])}</Badge> },
    {
      id: 'who',
      header: t('colFromTo'),
      cell: (tx) => (tx.patientId !== null ? <PatientInline patient={getPatient(tx.patientId)} /> : tx.payee === null ? '—' : f.text(tx.payee)),
    },
    { id: 'method', header: t('colMethod'), cell: (tx) => t(METHOD_KEY[tx.method]) },
    {
      id: 'amount',
      header: t('colAmount'),
      align: 'end',
      nowrap: true,
      cell: (tx) => (
        <span className="cs-two cs-end">
          <Money amount={tx.amount} currency={tx.currency} className={tx.amount < 0 ? 'cs-strong cs-out' : 'cs-strong'} />
          {tx.currency === 'USD' ? <Money amount={usdToIqd(tx.amount)} className="cs-muted" /> : null}
        </span>
      ),
    },
  ];

  const conv = Number(convAmount.replace(/,/g, ''));
  const convOk = Number.isFinite(conv) && conv >= 0;
  const drawerTab = (
    <div className="cs-split">
      <Card
        title={t('txTitle')}
        subtitle={t('txSubtitle', { count: txs.length })}
        icon="receipt"
        flush
        actions={
          <Button size="sm" variant="primary" icon="plus" isDisabled={closed} onPress={() => { openDeposit('SYN-PAT-0103', 'deposit'); }}>
            {t('actDeposit')}
          </Button>
        }
      >
        <DataTable caption={t('txTitle')} dense columns={txColumns} rows={txs.toReversed()} rowKey={(tx) => tx.id} rowTone={(tx) => (tx.amount < 0 ? 'warning' : undefined)} />
      </Card>
      <div className="cs-stack">
        <Card title={t('drawerTitle')} icon="money" subtitle={f.text(SHIFT.counter)}>
          <div className="cs-drawer">
            <div className="cs-drawer__cur">
              <span className="cs-muted">{t('curIqd')}</span>
              <Money amount={expected.IQD} className="cs-big" />
              <span className="cs-muted">{t('floatOf', { amount: f.iqd(SHIFT.floatIqd) })}</span>
            </div>
            <div className="cs-drawer__cur">
              <span className="cs-muted">{t('curUsd')}</span>
              <Money amount={expected.USD} currency="USD" className="cs-big" />
              <span className="cs-muted">{t('floatOf', { amount: f.usd(SHIFT.floatUsd) })}</span>
            </div>
          </div>
          <p className="cs-muted cs-gap">
            {t('drawerTotal')} <Money amount={expected.IQD + usdToIqd(expected.USD)} className="cs-strong" />
          </p>
          {closed ? <Badge tone="neutral" icon="lock">{t('shiftClosedBadge')}</Badge> : <Badge tone="success" icon="check">{t('shiftOpen', { time: f.time(SHIFT.openedIso) })}</Badge>}
        </Card>
        <Card title={t('rateTitle')} icon="refresh" tone="info">
          <p className="cs-rate">{t('rateBig', { rate: f.number(EXCHANGE_RATE.usdToIqd) })}</p>
          <p className="cs-muted">{t('rateNote', { date: f.date(EXCHANGE_RATE.asOf) })}</p>
          <div className="cs-conv">
            <TextInput label={t('convAmount')} value={convAmount} onChange={setConvAmount} inputMode="decimal" dir="ltr" />
            <Segmented
              label={t('convFrom')}
              value={convFrom}
              onChange={(id) => { setConvFrom(id === 'IQD' ? 'IQD' : 'USD'); }}
              options={[
                { id: 'USD', label: 'USD → IQD' },
                { id: 'IQD', label: 'IQD → USD' },
              ]}
            />
            <p className="cs-conv__out">
              {convOk ? (convFrom === 'USD' ? <Money amount={usdToIqd(conv)} className="cs-big" /> : <Money amount={iqdToUsd(conv)} currency="USD" className="cs-big" />) : '—'}
            </p>
          </div>
        </Card>
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------------------------------------
  // Running bills
  // ---------------------------------------------------------------------------------------------------------

  const billRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return bills
      .filter((b) => {
        if (needle === '') {
          return true;
        }
        const p = getPatient(b.patientId);
        return [p.mrn, p.name.latin, p.name.ckb, p.name.ar].some((part) => part.toLowerCase().includes(needle));
      })
      .toSorted((a, b) => billFigures(a).balance - a.thresholdIqd - (billFigures(b).balance - b.thresholdIqd));
  }, [bills, search]);

  const billColumns: readonly Column<RunningBill>[] = [
    {
      id: 'patient',
      header: t('colPatient'),
      cell: (b) => {
        const loc = locationOf(b.patientId);
        return (
          <span className="cs-two">
            <PatientInline patient={getPatient(b.patientId)} />
            <span className="cs-muted">{loc === undefined ? '—' : `${f.text(loc.ward.name)} · ${loc.bedId}`} · {t('admitted', { when: f.relative(b.admittedIso) })}</span>
          </span>
        );
      },
    },
    { id: 'payer', header: t('colPayer'), cell: (b) => <span className="cs-two"><span>{payerName(b.payerId)}</span>{b.payerShare > 0 ? <span className="cs-muted">{t('covers', { pct: f.percent(b.payerShare) })}</span> : null}</span> },
    { id: 'charges', header: t('colCharges'), align: 'end', nowrap: true, cell: (b) => <Money amount={b.chargesIqd} /> },
    { id: 'patientShare', header: t('colPatientShare'), align: 'end', nowrap: true, cell: (b) => <Money amount={billFigures(b).patientShare} /> },
    { id: 'deposits', header: t('colDeposits'), align: 'end', nowrap: true, cell: (b) => <Money amount={b.depositsIqd} /> },
    {
      id: 'balance',
      header: t('colBalance'),
      align: 'end',
      nowrap: true,
      cell: (b) => {
        const bal = billFigures(b).balance;
        return (
          <span className="cs-two cs-end">
            <Money amount={bal} className={bal < 0 ? 'cs-strong cs-out' : 'cs-strong'} />
            {needsTopUp(b) ? <Badge tone="danger" size="sm">{t('topUpDue')}</Badge> : null}
          </span>
        );
      },
    },
  ];

  const selectedB = bills.find((b) => b.patientId === selectedBill) ?? null;
  const billDetail = (b: RunningBill): ReactNode => {
    const fig = billFigures(b);
    const patient = getPatient(b.patientId);
    const used = fig.patientShare / Math.max(1, b.depositsIqd);
    return (
      <Card
        title={personName(patient.name, f.locale)}
        subtitle={<Code>{patient.mrn}</Code>}
        icon="receipt"
        tone={needsTopUp(b) ? 'warning' : 'neutral'}
        actions={<IconButton icon="x" label={t('close')} onPress={() => { setSelectedBill(null); }} />}
      >
        <div className="cs-stack">
          <PatientInline patient={patient} secondary />
          <KeyValueList
            columns={2}
            items={[
              { id: 'payer', label: t('colPayer'), value: payerName(b.payerId) },
              { id: 'admitted', label: t('admittedOn'), value: f.dateTime(b.admittedIso) },
              { id: 'charges', label: t('colCharges'), value: <Money amount={b.chargesIqd} /> },
              { id: 'payerAmt', label: t('payerPart'), value: <Money amount={fig.payerAmount} /> },
              { id: 'patient', label: t('colPatientShare'), value: <Money amount={fig.patientShare} /> },
              { id: 'deposits', label: t('colDeposits'), value: <Money amount={b.depositsIqd} /> },
              { id: 'balance', label: t('colBalance'), value: <Money amount={fig.balance} className="cs-strong" /> },
              { id: 'usd', label: t('balanceUsd'), value: <Money amount={iqdToUsd(fig.balance)} currency="USD" /> },
            ]}
          />
          <Meter label={t('depositUsed')} value={used} valueLabel={f.percent(Math.min(used, 9.99))} tone={used > 1 ? 'danger' : used > 0.8 ? 'warning' : 'success'} />
          {needsTopUp(b) ? (
            <Callout tone="warning" title={t('topUpTitle')}>
              {t('topUpBody', { threshold: f.iqd(b.thresholdIqd) })}
            </Callout>
          ) : null}
          <div className="cs-actions">
            <Button variant="primary" icon="plus" isDisabled={closed} onPress={() => { openDeposit(b.patientId, 'top-up', needsTopUp(b) ? b.thresholdIqd - fig.balance + 500_000 : 500_000); }}>
              {t('actTopUp')}
            </Button>
            <Button icon="printer" onPress={() => { toast({ tone: 'info', title: t('toastStatement', { mrn: patient.mrn }) }); }}>
              {t('actStatement')}
            </Button>
            <Button variant="ghost" iconEnd="arrow-forward" onPress={() => { goTo('billing', { patient: patient.id }); }}>
              {t('actBilling')}
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  const billsTab = (
    <div className={selectedB === null ? undefined : 'cs-split'}>
      <Card title={t('billsTitle')} subtitle={t('billsSubtitle', { count: bills.filter(needsTopUp).length })} icon="bed" flush>
        <div className="cs-toolbar">
          <SearchField label={t('search')} hideLabel placeholder={t('searchPlaceholder')} value={search} onChange={setSearch} />
        </div>
        <DataTable
          caption={t('billsTitle')}
          dense
          columns={billColumns}
          rows={billRows}
          rowKey={(b) => b.patientId}
          selectedKey={selectedBill}
          onRowAction={(b) => { setSelectedBill(b.patientId); }}
          rowTone={(b) => (billFigures(b).balance < 0 ? 'danger' : needsTopUp(b) ? 'warning' : undefined)}
        />
      </Card>
      {selectedB === null ? null : billDetail(selectedB)}
    </div>
  );

  // ---------------------------------------------------------------------------------------------------------
  // Approvals
  // ---------------------------------------------------------------------------------------------------------

  const approvalsTab = (
    <div className="cs-stack">
      <Card title={t('discTitle')} subtitle={t('discSubtitle')} icon="shield" flush>
        <DataTable
          caption={t('discTitle')}
          rows={discounts}
          rowKey={(d) => d.id}
          rowTone={(d) => (d.status === 'pending' ? 'warning' : undefined)}
          columns={[
            { id: 'id', header: t('colRequest'), nowrap: true, cell: (d) => <span className="cs-two"><Code>{d.id}</Code><span className="cs-muted">{f.relative(d.requestedIso)}</span></span> },
            { id: 'patient', header: t('colPatient'), cell: (d) => <PatientInline patient={getPatient(d.patientId)} /> },
            { id: 'reason', header: t('colReason'), cell: (d) => <span className="cs-two"><span>{f.text(d.reason)}</span><span className="cs-muted">{(() => { const m = findStaff(d.requestedById); return m === undefined ? null : <StaffName member={m} />; })()}</span></span> },
            {
              id: 'amount',
              header: t('colDiscount'),
              align: 'end',
              nowrap: true,
              cell: (d) => (
                <span className="cs-two cs-end">
                  <span className="cs-strong">{f.percent(d.percent / 100)}</span>
                  <Money amount={Math.round((d.billIqd * d.percent) / 100)} className="cs-muted" />
                </span>
              ),
            },
            {
              id: 'status',
              header: t('colStatus'),
              cell: (d) =>
                d.status === 'pending' ? (
                  <span className="cs-row">
                    <Button
                      size="sm"
                      variant="primary"
                      icon="check"
                      onPress={() => {
                        setDiscounts((c) => c.map((x) => (x.id === d.id ? { ...x, status: 'approved' } : x)));
                        setBills((c) => c.map((b) => (b.patientId === d.patientId ? { ...b, chargesIqd: Math.round(b.chargesIqd * (1 - d.percent / 100)) } : b)));
                        toast({ tone: 'success', title: t('toastDiscApproved', { id: d.id }), body: t('toastDiscApprovedBody', { amount: f.iqd(Math.round((d.billIqd * d.percent) / 100)) }) });
                      }}
                    >
                      {t('actApprove')}
                    </Button>
                    <Button size="sm" variant="ghost" onPress={() => { setDiscounts((c) => c.map((x) => (x.id === d.id ? { ...x, status: 'rejected' } : x))); toast({ tone: 'warning', title: t('toastDiscRejected', { id: d.id }) }); }}>
                      {t('actReject')}
                    </Button>
                  </span>
                ) : (
                  <Badge tone={APPROVAL_TONE[d.status]} size="sm">{t(APPROVAL_KEY[d.status])}</Badge>
                ),
            },
          ]}
        />
      </Card>
      <Card title={t('refundTitle')} subtitle={t('refundSubtitle')} icon="refresh" flush>
        <DataTable
          caption={t('refundTitle')}
          rows={refunds}
          rowKey={(r) => r.id}
          rowTone={(r) => (r.status === 'pending' || r.status === 'approved' ? 'warning' : undefined)}
          columns={[
            { id: 'id', header: t('colRequest'), nowrap: true, cell: (r) => <span className="cs-two"><Code>{r.id}</Code><span className="cs-muted">{t('origReceipt')} <Code>{r.originalReceipt}</Code></span></span> },
            { id: 'patient', header: t('colPatient'), cell: (r) => <PatientInline patient={getPatient(r.patientId)} /> },
            { id: 'reason', header: t('colReason'), cell: (r) => f.text(r.reason) },
            { id: 'amount', header: t('colAmount'), align: 'end', nowrap: true, cell: (r) => <Money amount={r.amount} currency={r.currency} className="cs-strong" /> },
            {
              id: 'status',
              header: t('colStatus'),
              cell: (r) => {
                if (r.status === 'pending') {
                  return (
                    <span className="cs-row">
                      <Button size="sm" icon="check" onPress={() => { setRefunds((c) => c.map((x) => (x.id === r.id ? { ...x, status: 'approved' } : x))); toast({ tone: 'success', title: t('toastRefundApproved', { id: r.id }) }); }}>
                        {t('actApprove')}
                      </Button>
                      <Button size="sm" variant="ghost" onPress={() => { setRefunds((c) => c.map((x) => (x.id === r.id ? { ...x, status: 'rejected' } : x))); }}>
                        {t('actReject')}
                      </Button>
                    </span>
                  );
                }
                if (r.status === 'approved') {
                  return (
                    <Button
                      size="sm"
                      variant="primary"
                      icon="money"
                      isDisabled={closed}
                      onPress={() => {
                        const receipt = addTx({ kind: 'refund', patientId: r.patientId, payee: null, currency: r.currency, amount: -r.amount, method: 'cash' });
                        setRefunds((c) => c.map((x) => (x.id === r.id ? { ...x, status: 'paid' } : x)));
                        toast({ tone: 'success', title: t('toastRefundPaid', { amount: f.money(r.amount, r.currency) }), body: t('receiptNo', { receipt }) });
                      }}
                    >
                      {t('actPayRefund')}
                    </Button>
                  );
                }
                return <Badge tone={APPROVAL_TONE[r.status]} size="sm">{t(APPROVAL_KEY[r.status])}</Badge>;
              },
            },
          ]}
        />
      </Card>
    </div>
  );

  // ---------------------------------------------------------------------------------------------------------
  // Doctor fees
  // ---------------------------------------------------------------------------------------------------------

  const settle = (fee: DoctorFee, method: TxMethod): void => {
    const payable = Math.round(fee.grossIqd * (1 - fee.hospitalShare));
    const member = findStaff(fee.staffId);
    const payee = member === undefined ? { en: fee.staffId, ckb: fee.staffId, ar: fee.staffId } : { en: staffName(member, 'en'), ckb: staffName(member, 'ckb'), ar: staffName(member, 'ar') };
    const receipt = addTx({ kind: 'doctor-fee', patientId: null, payee, currency: 'IQD', amount: -payable, method });
    setFees((c) => c.map((x) => (x.staffId === fee.staffId ? { ...x, settled: true } : x)));
    toast({ tone: 'success', title: t('toastFeeSettled', { amount: f.iqd(payable) }), body: t('receiptNo', { receipt }) });
  };

  const feesTab = (
    <Card title={t('feesTitle')} subtitle={t('feesSubtitle', { period: f.text(DOCTOR_FEES[0]?.period ?? { en: '', ckb: '', ar: '' }) })} icon="stethoscope" flush>
      <DataTable
        caption={t('feesTitle')}
        rows={fees}
        rowKey={(fee) => fee.staffId}
        columns={[
          {
            id: 'doctor',
            header: t('colDoctor'),
            cell: (fee) => {
              const m = findStaff(fee.staffId);
              return m === undefined ? fee.staffId : <span className="cs-two"><StaffName member={m} /><span className="cs-muted">{f.text(m.title)}</span></span>;
            },
          },
          { id: 'cases', header: t('colCases'), align: 'end', cell: (fee) => f.number(fee.cases) },
          { id: 'gross', header: t('colGross'), align: 'end', nowrap: true, cell: (fee) => <Money amount={fee.grossIqd} /> },
          { id: 'share', header: t('colHospitalShare'), align: 'end', cell: (fee) => f.percent(fee.hospitalShare) },
          { id: 'payable', header: t('colPayable'), align: 'end', nowrap: true, cell: (fee) => <Money amount={Math.round(fee.grossIqd * (1 - fee.hospitalShare))} className="cs-strong" /> },
          {
            id: 'act',
            header: t('colStatus'),
            align: 'end',
            cell: (fee) =>
              fee.settled ? (
                <Badge tone="success" icon="check" size="sm">{t('settled')}</Badge>
              ) : (
                <span className="cs-row cs-row--end">
                  <Button size="sm" icon="money" isDisabled={closed} onPress={() => { settle(fee, 'cash'); }}>
                    {t('actSettleCash')}
                  </Button>
                  <Button size="sm" variant="ghost" onPress={() => { settle(fee, 'transfer'); }}>
                    {t('actSettleTransfer')}
                  </Button>
                </span>
              ),
          },
        ]}
      />
    </Card>
  );

  // ---------------------------------------------------------------------------------------------------------
  // Deposit dialog
  // ---------------------------------------------------------------------------------------------------------

  const amount = Number(depAmount.replace(/,/g, ''));
  const amountOk = Number.isFinite(amount) && amount > 0;
  const depositDialog = depositOpen ? (
    <Dialog
      isOpen
      onOpenChange={setDepositOpen}
      title={depKind === 'deposit' ? t('depDialogDeposit') : t('depDialogTopUp')}
      subtitle={f.text(EXCHANGE_RATE.note)}
      actions={
        <>
          <Button onPress={() => { setDepositOpen(false); }}>{t('cancel')}</Button>
          <Button
            variant="primary"
            icon="check"
            isDisabled={!amountOk}
            onPress={() => {
              const receipt = addTx({ kind: depKind, patientId: depPatient, payee: null, currency: depCurrency, amount, method: depMethod });
              const iqd = depCurrency === 'IQD' ? amount : usdToIqd(amount);
              setBills((c) => (c.some((b) => b.patientId === depPatient) ? c.map((b) => (b.patientId === depPatient ? { ...b, depositsIqd: b.depositsIqd + iqd } : b)) : c));
              toast({ tone: 'success', title: t('toastDeposit', { amount: f.money(amount, depCurrency) }), body: t('receiptNo', { receipt }) });
              setDepositOpen(false);
            }}
          >
            {t('actRecord')}
          </Button>
        </>
      }
    >
      <div className="cs-stack">
        <SelectField
          label={t('colPatient')}
          selectedKey={depPatient}
          onSelectionChange={setDepPatient}
          options={bills.map((b) => {
            const p = getPatient(b.patientId);
            return { id: p.id, label: `${personName(p.name, f.locale)} · ${p.mrn}` };
          })}
        />
        <Segmented
          label={t('colKind')}
          value={depKind}
          onChange={(id) => { setDepKind(id === 'deposit' ? 'deposit' : 'top-up'); }}
          options={[
            { id: 'deposit', label: t('kDeposit') },
            { id: 'top-up', label: t('kTopUp') },
          ]}
        />
        <Segmented
          label={t('currency')}
          value={depCurrency}
          onChange={(id) => { setDepCurrency(id === 'USD' ? 'USD' : 'IQD'); }}
          options={[
            { id: 'IQD', label: t('curIqd') },
            { id: 'USD', label: t('curUsd') },
          ]}
        />
        <TextInput
          label={t('colAmount')}
          value={depAmount}
          onChange={setDepAmount}
          inputMode="decimal"
          dir="ltr"
          isRequired
          {...(amountOk ? { description: depCurrency === 'IQD' ? t('equals', { amount: f.usd(iqdToUsd(amount)) }) : t('equals', { amount: f.iqd(usdToIqd(amount)) }) } : {})}
        />
        <SelectField
          label={t('colMethod')}
          selectedKey={depMethod}
          onSelectionChange={(id) => { setDepMethod(id as TxMethod); }}
          options={(Object.keys(METHOD_KEY) as TxMethod[]).map((m) => ({ id: m, label: t(METHOD_KEY[m]) }))}
        />
      </div>
    </Dialog>
  ) : null;

  const cashierStaff = findStaff(SHIFT.cashierId);

  return (
    <div className="cs-screen">
      <PageHeader
        icon="money"
        title={t('title')}
        subtitle={t('subtitle')}
        eyebrow={
          <>
            {f.text(SHIFT.counter)} · <Code>{SHIFT.id}</Code> {cashierStaff === undefined ? null : <>· <StaffName member={cashierStaff} /></>}
          </>
        }
        actions={
          <>
            <Button icon="lock" onPress={() => { setTab('close'); }}>
              {t('actGoClose')}
            </Button>
            <Button variant="primary" icon="plus" isDisabled={closed} onPress={() => { openDeposit('SYN-PAT-0103', 'deposit'); }}>
              {t('actDeposit')}
            </Button>
          </>
        }
      />
      <Grid min="12rem">
        <StatTile label={t('kpiIqd')} value={<Money amount={expected.IQD} />} icon="money" hint={t('kpiDrawerHint')} onPress={() => { setTab('drawer'); }} />
        <StatTile label={t('kpiUsd')} value={<Money amount={expected.USD} currency="USD" />} icon="money" hint={t('kpiRateHint', { rate: f.number(EXCHANGE_RATE.usdToIqd) })} onPress={() => { setTab('drawer'); }} />
        <StatTile label={t('kpiDeposits')} value={<Money amount={depositsToday} />} icon="receipt" tone="success" hint={t('kpiDepositsHint', { count: bills.filter(needsTopUp).length })} onPress={() => { setTab('bills'); }} />
        <StatTile label={t('kpiApprovals')} value={f.number(pendingApprovals)} icon="shield" tone={pendingApprovals > 0 ? 'warning' : 'success'} hint={t('kpiApprovalsHint')} onPress={() => { setTab('approvals'); }} />
        <StatTile label={t('kpiFees')} value={<Money amount={unsettledIqd} />} icon="stethoscope" hint={t('kpiFeesHint', { count: unsettled.length })} onPress={() => { setTab('fees'); }} />
      </Grid>
      <Tabs
        aria-label={t('tabsLabel')}
        selectedKey={tab}
        onSelectionChange={setTab}
        items={[
          { id: 'drawer', label: t('tabDrawer'), content: drawerTab },
          { id: 'bills', label: t('tabBills'), badge: f.number(bills.filter(needsTopUp).length), content: billsTab },
          { id: 'approvals', label: t('tabApprovals'), ...(pendingApprovals > 0 ? { badge: f.number(pendingApprovals) } : {}), content: approvalsTab },
          { id: 'fees', label: t('tabFees'), badge: f.number(unsettled.length), content: feesTab },
          {
            id: 'close',
            label: t('tabClose'),
            content: (
              <ShiftClose
                expected={expected}
                nonCash={nonCash}
                closed={closed}
                onClose={(counted) => {
                  setClosed(true);
                  const vi = counted.IQD - expected.IQD;
                  const vu = Math.round((counted.USD - expected.USD) * 100) / 100;
                  toast({
                    tone: vi === 0 && vu === 0 ? 'success' : 'warning',
                    title: t('toastShiftClosed'),
                    body: t('toastShiftClosedBody', { iqd: f.iqd(vi), usd: f.usd(vu) }),
                  });
                }}
              />
            ),
          },
        ]}
      />
      {depositDialog}
    </div>
  );
}
