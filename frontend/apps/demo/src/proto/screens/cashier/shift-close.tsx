/**
 * Shift close: count the drawer note by note in each currency, compare with the expected cash, and close
 * the shift with the variance recorded. Card and transfer takings are listed apart; they are not in the
 * drawer.
 */
import { useState, type ReactNode } from 'react';
import { DEMO_NOW_ISO, type Currency } from '../../data/index.ts';
import { IQD_DENOMINATIONS, SHIFT, USD_DENOMINATIONS } from '../../data/ext/cashier.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { Badge, Button, Callout, Card, Code, KeyValueList, Money, TextInput, useToast } from '../../ui/index.ts';
import { messages } from './messages.ts';

export interface ShiftCloseProps {
  readonly expected: Readonly<Record<Currency, number>>;
  readonly nonCash: Readonly<Record<Currency, number>>;
  readonly closed: boolean;
  readonly onClose: (counted: Readonly<Record<Currency, number>>) => void;
}

function CountCard({
  currency,
  denominations,
  counts,
  setCount,
  expected,
}: {
  readonly currency: Currency;
  readonly denominations: readonly number[];
  readonly counts: Readonly<Record<number, string>>;
  readonly setCount: (denomination: number, value: string) => void;
  readonly expected: number;
}): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const total = denominations.reduce((sum, d) => sum + d * (Number(counts[d] ?? '0') || 0), 0);
  const variance = Math.round((total - expected) * 100) / 100;
  return (
    <Card title={currency === 'IQD' ? t('countIqd') : t('countUsd')} icon="money" subtitle={t('countSubtitle')}>
      <div className="cs-denoms">
        {denominations.map((d) => {
          const n = Number(counts[d] ?? '0') || 0;
          return (
            <div key={d} className="cs-denom">
              <span className="cs-denom__face">
                <Money amount={d} currency={currency} />
              </span>
              <TextInput
                label={t('countOf', { face: f.money(d, currency) })}
                hideLabel
                value={counts[d] ?? ''}
                onChange={(value) => { setCount(d, value.replace(/[^0-9]/g, '')); }}
                inputMode="numeric"
                dir="ltr"
                placeholder="0"
                className="cs-denom__input"
              />
              <span className="cs-denom__sum">
                <Money amount={d * n} currency={currency} />
              </span>
            </div>
          );
        })}
      </div>
      <KeyValueList
        columns={3}
        items={[
          { id: 'counted', label: t('counted'), value: <Money amount={total} currency={currency} className="cs-strong" /> },
          { id: 'expected', label: t('expected'), value: <Money amount={expected} currency={currency} /> },
          {
            id: 'variance',
            label: t('variance'),
            value:
              variance === 0 ? (
                <Badge tone="success" icon="check">{t('balanced')}</Badge>
              ) : (
                <Badge tone={Math.abs(variance) > (currency === 'IQD' ? 5000 : 5) ? 'danger' : 'warning'} icon="alert">
                  {variance > 0 ? t('over', { amount: f.money(variance, currency) }) : t('short', { amount: f.money(-variance, currency) })}
                </Badge>
              ),
          },
        ]}
      />
    </Card>
  );
}

export function ShiftClose({ expected, nonCash, closed, onClose }: ShiftCloseProps): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const [iqd, setIqd] = useState<Readonly<Record<number, string>>>({});
  const [usd, setUsd] = useState<Readonly<Record<number, string>>>({});
  const totalOf = (denoms: readonly number[], counts: Readonly<Record<number, string>>): number => denoms.reduce((sum, d) => sum + d * (Number(counts[d] ?? '0') || 0), 0);
  const countedIqd = totalOf(IQD_DENOMINATIONS, iqd);
  const countedUsd = totalOf(USD_DENOMINATIONS, usd);
  const started = countedIqd > 0 && countedUsd > 0;

  if (closed) {
    return (
      <Callout
        tone="success"
        title={t('shiftClosedTitle', { time: f.time(DEMO_NOW_ISO) })}
        actions={
          <Button icon="printer" onPress={() => { toast({ tone: 'info', title: t('toastZReport') }); }}>
            {t('actZReport')}
          </Button>
        }
      >
        {t('shiftClosedBody')}
      </Callout>
    );
  }

  return (
    <div className="cs-stack">
      <Callout tone="info" title={t('closeIntroTitle', { shift: SHIFT.id })}>
        {t('closeIntro')}
      </Callout>
      <div className="cs-split cs-split--even">
        <CountCard currency="IQD" denominations={IQD_DENOMINATIONS} counts={iqd} setCount={(d, v) => { setIqd((c) => ({ ...c, [d]: v })); }} expected={expected.IQD} />
        <CountCard currency="USD" denominations={USD_DENOMINATIONS} counts={usd} setCount={(d, v) => { setUsd((c) => ({ ...c, [d]: v })); }} expected={expected.USD} />
      </div>
      <Card title={t('nonCashTitle')} icon="receipt" subtitle={t('nonCashSubtitle')}>
        <KeyValueList
          columns={2}
          items={[
            { id: 'iqd', label: t('nonCashIqd'), value: <Money amount={nonCash.IQD} /> },
            { id: 'usd', label: t('nonCashUsd'), value: <Money amount={nonCash.USD} currency="USD" /> },
          ]}
        />
      </Card>
      <div className="cs-actions">
        <Button
          onPress={() => {
            setIqd({ 50000: String(Math.floor(expected.IQD / 50000)), 1000: String(Math.floor((expected.IQD % 50000) / 1000)), 500: String(Math.round((expected.IQD % 1000) / 500)) });
            setUsd({ 100: String(Math.floor(expected.USD / 100)), 20: String(Math.floor((expected.USD % 100) / 20)), 1: String(Math.round(expected.USD % 20)) });
          }}
        >
          {t('actDemoFill')}
        </Button>
        <Button
          variant="primary"
          icon="lock"
          isDisabled={!started}
          onPress={() => {
            onClose({ IQD: countedIqd, USD: countedUsd });
          }}
        >
          {t('actCloseShift')}
        </Button>
        <span className="cs-muted">
          {t('handOver')} <Code>{SHIFT.id}</Code>
        </span>
      </div>
    </div>
  );
}
