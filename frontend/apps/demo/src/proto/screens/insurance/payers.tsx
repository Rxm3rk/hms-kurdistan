/**
 * The payers and ageing tabs: contracts and credit limits (with a hold on new credit), the payer statement,
 * and the receivables by ageing bucket.
 */
import { useState, type ReactNode } from 'react';
import { DEMO_TODAY, demoDate } from '../../data/index.ts';
import type { Tone } from '../../data/index.ts';
import { PAYER_ACCOUNTS, type Ageing, type Claim, type PayerAccount } from '../../data/ext/insurance.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import {
  BarChart,
  Badge,
  Button,
  Callout,
  Card,
  Code,
  DataTable,
  IconButton,
  KeyValueList,
  Meter,
  useToast,
  type Column,
} from '../../ui/index.ts';
import { messages } from './messages.ts';
import { ClaimBadge, IqdUsd, NoSelection, PatientCell } from './parts.tsx';

function creditState(payer: PayerAccount): { readonly tone: Tone; readonly key: 'creditOk' | 'creditNear' | 'creditFull' } {
  const used = payer.usedIqd / payer.creditLimitIqd;
  if (used >= 0.95) {
    return { tone: 'danger', key: 'creditFull' };
  }
  if (used >= 0.8) {
    return { tone: 'warning', key: 'creditNear' };
  }
  return { tone: 'success', key: 'creditOk' };
}

export function ageingTotal(a: Ageing): number {
  return a.d0to30 + a.d31to60 + a.d61to90 + a.d90plus;
}

export function PayersTab({ claims }: { readonly claims: readonly Claim[] }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(PAYER_ACCOUNTS[0]?.id ?? null);
  const [held, setHeld] = useState<ReadonlySet<string>>(new Set());
  const selected = PAYER_ACCOUNTS.find((p) => p.id === selectedId) ?? null;
  const soon = demoDate(-60);

  const columns: readonly Column<PayerAccount>[] = [
    {
      id: 'name',
      header: t('colPayer'),
      cell: (p) => (
        <span className="ins-stack">
          <span className="ins-strong">{f.text(p.name)}</span>
          <span className="ins-muted">
            {t(`pk_${p.kind}`)} · {t(`gov_${p.governorate}`)}
          </span>
        </span>
      ),
    },
    {
      id: 'contract',
      header: t('colContract'),
      cell: (p) => (
        <span className="ins-stack">
          <Code>{p.contractRef}</Code>
          <span className={p.contractEnds <= soon ? 'ins-warn' : 'ins-muted'}>{t('endsOn', { date: f.date(p.contractEnds) })}</span>
        </span>
      ),
    },
    { id: 'limit', header: t('colLimit'), cell: (p) => f.iqd(p.creditLimitIqd), align: 'end', nowrap: true },
    {
      id: 'used',
      header: t('colUsed'),
      cell: (p) => {
        const state = creditState(p);
        return (
          <span className="ins-meter-cell">
            <Meter value={p.usedIqd / p.creditLimitIqd} label={t('creditMeter', { payer: f.text(p.name) })} valueLabel={f.percent(p.usedIqd / p.creditLimitIqd)} tone={state.tone === 'success' ? 'accent' : state.tone} showText={false} />
            <span className="ins-muted">{f.percent(p.usedIqd / p.creditLimitIqd)}</span>
          </span>
        );
      },
    },
    { id: 'available', header: t('colAvailable'), cell: (p) => f.iqd(Math.max(0, p.creditLimitIqd - p.usedIqd)), align: 'end', nowrap: true },
    { id: 'terms', header: t('colTerms'), cell: (p) => t('termsDays', { days: p.paymentTermsDays }), nowrap: true },
    {
      id: 'state',
      header: t('colStatus'),
      cell: (p) => {
        if (held.has(p.id)) {
          return (
            <Badge tone="danger" icon="lock" size="sm">
              {t('onHold')}
            </Badge>
          );
        }
        const state = creditState(p);
        return (
          <Badge tone={state.tone} size="sm">
            {t(state.key)}
          </Badge>
        );
      },
      nowrap: true,
    },
  ];

  const payerClaims = selected === null ? [] : claims.filter((c) => c.payerId === selected.id);

  return (
    <div className="ins-split">
      <Card flush className="ins-list">
        <DataTable caption={t('payersTable')} columns={columns} rows={PAYER_ACCOUNTS} rowKey={(p) => p.id} onRowAction={(p) => setSelectedId(p.id)} selectedKey={selectedId} dense />
      </Card>
      {selected === null ? (
        <Card>
          <NoSelection />
        </Card>
      ) : (
        <Card
          title={f.text(selected.name)}
          subtitle={t(`pk_${selected.kind}`)}
          icon="building"
          className="ins-detail"
          actions={<IconButton icon="x" label={t('close')} onPress={() => setSelectedId(null)} />}
          footer={
            <div className="ins-actions">
              <Button variant="primary" icon="printer" onPress={() => toast({ tone: 'success', title: t('toastStatement', { payer: f.text(selected.name) }) })}>
                {t('sendStatement')}
              </Button>
              <Button
                variant={held.has(selected.id) ? 'secondary' : 'danger'}
                icon="lock"
                onPress={() => {
                  const next = new Set(held);
                  const name = f.text(selected.name);
                  if (next.has(selected.id)) {
                    next.delete(selected.id);
                    toast({ tone: 'info', title: t('toastRelease', { payer: name }) });
                  } else {
                    next.add(selected.id);
                    toast({ tone: 'warning', title: t('toastHold', { payer: name }) });
                  }
                  setHeld(next);
                }}
              >
                {held.has(selected.id) ? t('releaseCredit') : t('holdCredit')}
              </Button>
            </div>
          }
        >
          <div className="ins-detail__body">
            {selected.contractEnds <= soon ? <Callout tone="warning">{t('contractEndingSoon')}</Callout> : null}
            <Meter
              value={selected.usedIqd / selected.creditLimitIqd}
              label={t('creditMeter', { payer: f.text(selected.name) })}
              valueLabel={`${f.iqd(selected.usedIqd)} / ${f.iqd(selected.creditLimitIqd)}`}
              tone={creditState(selected).tone === 'success' ? 'accent' : creditState(selected).tone}
            />
            <KeyValueList
              items={[
                { id: 'contract', label: t('colContract'), value: <Code>{selected.contractRef}</Code> },
                { id: 'ends', label: t('validUntil'), value: f.date(selected.contractEnds) },
                { id: 'cover', label: t('defaultCover'), value: f.percent(selected.coveragePct / 100) },
                { id: 'currency', label: t('billingCurrency'), value: selected.currency },
                { id: 'contact', label: t('contact'), value: selected.contact },
                { id: 'phone', label: t('phone'), value: <Code>{selected.phone}</Code> },
                { id: 'gov', label: t('governorate'), value: t(`gov_${selected.governorate}`) },
                { id: 'terms', label: t('colTerms'), value: t('termsDays', { days: selected.paymentTermsDays }) },
              ]}
            />
            <h3 className="ins-h3">{t('statementLines')}</h3>
            {payerClaims.length === 0 ? (
              <p className="ins-muted">{t('noClaims')}</p>
            ) : (
              <ul className="ins-statement">
                {payerClaims.map((c) => (
                  <li key={c.id} className="ins-statement__row">
                    <span className="ins-stack">
                      <Code>{c.id}</Code>
                      <PatientCell patientId={c.patientId} />
                    </span>
                    <span className="ins-stack ins-end">
                      <IqdUsd amount={c.billedIqd} showUsd={selected.currency === 'USD'} />
                      <ClaimBadge status={c.status} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

interface AgeRow {
  readonly id: string;
  readonly name: string;
  readonly ageing: Ageing;
  readonly total: boolean;
}

export function AgeingTab(): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const sum: Ageing = PAYER_ACCOUNTS.reduce<Ageing>(
    (acc, p) => ({
      d0to30: acc.d0to30 + p.ageing.d0to30,
      d31to60: acc.d31to60 + p.ageing.d31to60,
      d61to90: acc.d61to90 + p.ageing.d61to90,
      d90plus: acc.d90plus + p.ageing.d90plus,
    }),
    { d0to30: 0, d31to60: 0, d61to90: 0, d90plus: 0 },
  );
  const rows: readonly AgeRow[] = [
    ...PAYER_ACCOUNTS.map((p) => ({ id: p.id, name: f.text(p.name), ageing: p.ageing, total: false })),
    { id: 'total', name: t('allPayersRow'), ageing: sum, total: true },
  ];
  const cell = (value: number, warn = false) => <span className={warn && value > 0 ? 'ins-warn ui-nowrap' : 'ui-nowrap'}>{value === 0 ? '–' : f.iqd(value)}</span>;
  const columns: readonly Column<AgeRow>[] = [
    { id: 'payer', header: t('colPayer'), cell: (r) => <span className={r.total ? 'ins-strong' : undefined}>{r.name}</span> },
    { id: 'b0', header: t('b0'), cell: (r) => cell(r.ageing.d0to30), align: 'end' },
    { id: 'b31', header: t('b31'), cell: (r) => cell(r.ageing.d31to60), align: 'end' },
    { id: 'b61', header: t('b61'), cell: (r) => cell(r.ageing.d61to90), align: 'end' },
    { id: 'b90', header: t('b90'), cell: (r) => cell(r.ageing.d90plus, true), align: 'end' },
    { id: 'total', header: t('colTotal'), cell: (r) => <span className="ins-strong ui-nowrap">{f.iqd(ageingTotal(r.ageing))}</span>, align: 'end' },
  ];
  const bars = [
    { id: 'b0', label: t('b0'), value: sum.d0to30, valueLabel: f.iqd(sum.d0to30) },
    { id: 'b31', label: t('b31'), value: sum.d31to60, valueLabel: f.iqd(sum.d31to60) },
    { id: 'b61', label: t('b61'), value: sum.d61to90, valueLabel: f.iqd(sum.d61to90), tone: 'warning' as const },
    { id: 'b90', label: t('b90'), value: sum.d90plus, valueLabel: f.iqd(sum.d90plus), tone: 'danger' as const },
  ];
  return (
    <div className="ins-ageing">
      <Card title={t('ageingTitle')} subtitle={t('ageingSubtitle', { date: f.date(DEMO_TODAY) })} icon="chart" footer={t('ageingNote')}>
        <BarChart data={bars} label={t('ageingTitle')} />
      </Card>
      <Card flush>
        <DataTable caption={t('ageingTable')} columns={columns} rows={rows} rowKey={(r) => r.id} rowTone={(r) => (r.total ? 'info' : undefined)} dense />
      </Card>
    </div>
  );
}
