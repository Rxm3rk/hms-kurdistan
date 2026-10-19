/**
 * Taking a payment at the cash desk: cash in US dollars and Iraqi dinars together (for example 50 USD and the
 * rest in IQD), change always in IQD, rounded to the nearest 250 IQD with the rounding shown as its own line;
 * or a card through the simulated terminal. Every amount is an integer (dinars, cents). The payment is kept
 * in the screen's session state; nothing is written back. SYNTHETIC DATA ONLY.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { DEMO_NOW_ISO } from '../../data/index.ts';
import type { Invoice } from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { useClinicalPatient, useRole } from '../../shell/index.ts';
import { Button, Callout, Card, Checkbox, Money, Segmented, StaffName, TextInput, useToast } from '../../ui/index.ts';
import { SHIFT, type AccountTotals, type PaymentRecord, type Tender } from './billing-data.ts';
import { billingActions, useBillingSession } from './billing-store.ts';
import { messages } from './messages.ts';
import {
  CASH_STEP_IQD,
  RATE_IQD_PER_USD,
  iqdFromUsdCents,
  isCashable,
  parseIqd,
  parseUsdCents,
  roundCash,
} from './money.ts';
import { AmountRow, SimulatedTag, UsdEquivalent, UsdMoney } from './parts.tsx';

type Method = 'cash' | 'card';

type Outcome =
  | { readonly kind: 'empty' }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'change'; readonly exactChange: number; readonly changeGiven: number; readonly rounding: number }
  | { readonly kind: 'rounded-off'; readonly shortfall: number }
  | { readonly kind: 'short'; readonly stillDue: number };

/** The next multiple of `step` at or above `amount`. */
function ceilTo(amount: number, step: number): number {
  const r = amount % step;
  return r === 0 ? amount : amount - r + step;
}

const TERMINAL_DELAY_MS = 1400;

export function PaymentPanel({
  invoice,
  totals,
  onRecorded,
}: {
  readonly invoice: Invoice;
  readonly totals: AccountTotals;
  readonly onRecorded: (record: PaymentRecord) => void;
}): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const { roleId, user, setRole } = useRole();
  const { patient, actionsDisabled } = useClinicalPatient();
  const session = useBillingSession();

  const [method, setMethod] = useState<Method>('cash');
  const [usdText, setUsdText] = useState('');
  const [iqdText, setIqdText] = useState('');
  const [partOk, setPartOk] = useState(false);
  const [terminal, setTerminal] = useState<'idle' | 'waiting'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  const due = totals.balanceIqd;

  if (session.shiftClose !== null) {
    return (
      <Card title={t('payTitle')} icon="money">
        <Callout tone="warning" title={t('shiftClosedTitle')} actions={<Button size="sm" onPress={() => { billingActions.reopenShift(); }}>{t('reopenShift')}</Button>}>
          {t('shiftClosedBody', { time: f.time(session.shiftClose.closedIso) })}
        </Callout>
      </Card>
    );
  }

  if (roleId !== 'cashier') {
    return (
      <Card title={t('payTitle')} icon="money">
        <Callout
          tone="info"
          title={t('cashierOnlyTitle')}
          actions={
            <Button size="sm" icon="user" onPress={() => { setRole('cashier'); }}>
              {t('switchToCashier')}
            </Button>
          }
        >
          {t.rich('cashierOnlyBody', { name: <StaffName member={user} /> })}
        </Callout>
      </Card>
    );
  }

  if (due === 0) {
    return (
      <Card title={t('payTitle')} icon="money" tone="success">
        <Callout tone="success" title={t('settledTitle')}>
          {totals.creditIqd > 0 ? t.rich('settledCredit', { amount: <Money amount={totals.creditIqd} /> }) : t('settledBody')}
        </Callout>
      </Card>
    );
  }

  // ---- cash calculation (integers only) ----
  const usdCents = parseUsdCents(usdText);
  const iqd = parseIqd(iqdText);
  const usdInvalid = usdCents === null;
  const usdCoins = usdCents !== null && usdCents % 100 !== 0;
  const iqdInvalid = iqd === null;
  const iqdNotCashable = iqd !== null && !isCashable(iqd);
  const usdValue = usdCents === null ? 0 : iqdFromUsdCents(usdCents);
  const iqdIn = iqd ?? 0;
  const remainderAfterUsd = Math.max(0, due - usdValue);
  const askIqd = roundCash(remainderAfterUsd, 'down');
  const askRounding = remainderAfterUsd - askIqd;
  const received = usdValue + iqdIn;
  const hasError = usdInvalid || usdCoins || iqdInvalid || iqdNotCashable;

  let outcome: Outcome;
  if (hasError) {
    outcome = { kind: 'invalid' };
  } else if (received === 0) {
    outcome = { kind: 'empty' };
  } else if (received >= due) {
    const exactChange = received - due;
    const changeGiven = roundCash(exactChange, 'up');
    outcome = { kind: 'change', exactChange, changeGiven, rounding: changeGiven - exactChange };
  } else if (roundCash(due - received, 'down') === 0) {
    outcome = { kind: 'rounded-off', shortfall: due - received };
  } else {
    outcome = { kind: 'short', stillDue: due - received };
  }

  const canRecord = !actionsDisabled && (outcome.kind === 'change' || outcome.kind === 'rounded-off' || (outcome.kind === 'short' && partOk));

  const iqdSuggestions = Array.from(
    new Set([askIqd, ceilTo(askIqd, 5_000), ceilTo(askIqd, 25_000), ceilTo(askIqd, 50_000)].filter((value) => value > 0)),
  ).slice(0, 4);

  const reset = (): void => {
    setUsdText('');
    setIqdText('');
    setPartOk(false);
  };

  const record = (): void => {
    if (!canRecord || usdCents === null || iqd === null) {
      return;
    }
    const numbers = billingActions.nextNumbers();
    const tenders: Tender[] = [];
    if (usdCents > 0) {
      tenders.push({ currency: 'USD', minor: usdCents, valueIqd: usdValue });
    }
    if (iqd > 0) {
      tenders.push({ currency: 'IQD', minor: iqd, valueIqd: iqd });
    }
    const entry: PaymentRecord = {
      id: numbers.paymentId,
      receipt: numbers.receipt,
      invoiceId: invoice.id,
      patientId: patient.id,
      iso: DEMO_NOW_ISO,
      method: 'cash',
      tenders,
      appliedIqd: outcome.kind === 'short' ? received : due,
      changeIqd: outcome.kind === 'change' ? outcome.changeGiven : 0,
      roundingIqd: outcome.kind === 'change' ? outcome.rounding : outcome.kind === 'rounded-off' ? outcome.shortfall : 0,
      receivedById: user.id,
      authCode: null,
      session: true,
    };
    billingActions.recordPayment(entry);
    toast({ tone: 'success', title: t('paidToast', { receipt: entry.receipt }), body: t('paidToastBody') });
    reset();
    onRecorded(entry);
  };

  const sendToTerminal = (): void => {
    setTerminal('waiting');
    timer.current = setTimeout(() => {
      timer.current = null;
      const numbers = billingActions.nextNumbers();
      const entry: PaymentRecord = {
        id: numbers.paymentId,
        receipt: numbers.receipt,
        invoiceId: invoice.id,
        patientId: patient.id,
        iso: DEMO_NOW_ISO,
        method: 'card',
        tenders: [{ currency: 'IQD', minor: due, valueIqd: due }],
        appliedIqd: due,
        changeIqd: 0,
        roundingIqd: 0,
        receivedById: user.id,
        authCode: numbers.authCode,
        session: true,
      };
      billingActions.recordPayment(entry);
      setTerminal('idle');
      toast({ tone: 'success', title: t('cardToast', { code: numbers.authCode }), body: t('paidToastBody') });
      onRecorded(entry);
    }, TERMINAL_DELAY_MS);
  };

  const signedRounding = (value: number): ReactNode => (
    <span className="billing-signed">
      {value > 0 ? '+' : value < 0 ? '−' : ''}
      <Money amount={Math.abs(value)} />
    </span>
  );

  return (
    <Card
      title={t('payTitle')}
      subtitle={t.rich('payDue', {
        amount: (
          <>
            <Money amount={due} className="billing-strong" /> <UsdEquivalent iqd={due} />
          </>
        ),
      })}
      icon="money"
      tone="accent"
      className="billing-pay"
    >
      <div className="billing-pay__body">
        <Segmented
          label={t('payMethod')}
          value={method}
          onChange={(id) => {
            setMethod(id === 'card' ? 'card' : 'cash');
          }}
          options={[
            { id: 'cash', label: t('methodCash') },
            { id: 'card', label: t('methodCard') },
          ]}
        />

        {actionsDisabled ? <Callout tone="warning">{t('bannerBlocked')}</Callout> : null}

        {method === 'card' ? (
          <div className="billing-pay__card">
            <p className="billing-pay__terminal">
              <span>{t('terminalName', { id: SHIFT.terminal })}</span>
              <SimulatedTag />
            </p>
            <p className="billing-muted">{t('cardBody')}</p>
            <div className="billing-calc">
              <dl className="billing-rows">
                <AmountRow label={t('cardAmount')} value={<Money amount={due} />} emphasis="total" />
              </dl>
            </div>
            {terminal === 'waiting' ? (
              <p className="billing-pay__waiting" role="status">
                <span className="billing-spinner" aria-hidden="true" />
                {t('terminalWaiting')}
              </p>
            ) : (
              <Button variant="primary" icon="money" isDisabled={actionsDisabled} onPress={sendToTerminal}>
                {t('sendToTerminal')}
              </Button>
            )}
          </div>
        ) : (
          <div className="billing-pay__cash">
            <div className="billing-pay__field">
              <TextInput
                label={t('usdReceived')}
                value={usdText}
                onChange={setUsdText}
                dir="ltr"
                inputMode="decimal"
                placeholder="0"
                description={t('usdReceivedHint', { rate: f.number(RATE_IQD_PER_USD) })}
              />
              <div className="billing-quick" role="group" aria-label={t('quickUsd')}>
                {[20, 50, 100].map((dollars) => (
                  <Button key={dollars} size="sm" variant="ghost" onPress={() => { setUsdText(String(dollars)); }}>
                    {t('quickUsdValue', { amount: f.number(dollars) })}
                  </Button>
                ))}
                {usdText === '' ? null : (
                  <Button size="sm" variant="ghost" icon="x" onPress={() => { setUsdText(''); }}>
                    {t('clear')}
                  </Button>
                )}
              </div>
              {usdInvalid ? <p className="billing-error" role="alert">{t('usdInvalid')}</p> : null}
              {usdCoins ? <p className="billing-error" role="alert">{t('usdCoins')}</p> : null}
            </div>

            <div className="billing-calc" aria-live="polite">
              <dl className="billing-rows">
                <AmountRow label={t('calcDue')} value={<Money amount={due} />} />
                {usdCents !== null && usdCents > 0 ? (
                  <>
                    <AmountRow
                      label={t.rich('calcUsdValue', { usd: <UsdMoney cents={usdCents} />, rate: f.number(RATE_IQD_PER_USD) })}
                      value={<Money amount={usdValue} />}
                      sign="minus"
                    />
                    <AmountRow label={t('calcRemainder')} value={<Money amount={remainderAfterUsd} />} emphasis="total" />
                  </>
                ) : null}
                {askRounding === 0 ? null : (
                  <AmountRow label={t('calcAskRounding')} value={signedRounding(-askRounding)} muted note={t('calcAskRoundingNote')} />
                )}
                <AmountRow label={t('calcAsk')} value={<Money amount={askIqd} className="billing-strong" />} emphasis="total" />
              </dl>
            </div>

            <div className="billing-pay__field">
              <TextInput
                label={t('iqdReceived')}
                value={iqdText}
                onChange={setIqdText}
                dir="ltr"
                inputMode="numeric"
                placeholder="0"
                description={t('iqdReceivedHint')}
              />
              <div className="billing-quick" role="group" aria-label={t('quickIqd')}>
                {iqdSuggestions.map((value, index) => (
                  <Button key={value} size="sm" variant="ghost" onPress={() => { setIqdText(String(value)); }}>
                    {index === 0 ? t('quickExact', { amount: f.number(value) }) : f.number(value)}
                  </Button>
                ))}
                {iqdText === '' ? null : (
                  <Button size="sm" variant="ghost" icon="x" onPress={() => { setIqdText(''); }}>
                    {t('clear')}
                  </Button>
                )}
              </div>
              {iqdInvalid ? <p className="billing-error" role="alert">{t('iqdInvalid')}</p> : null}
              {iqdNotCashable ? <p className="billing-error" role="alert">{t('iqdNotCashable', { step: f.number(CASH_STEP_IQD) })}</p> : null}
            </div>

            {outcome.kind === 'empty' || outcome.kind === 'invalid' ? null : (
              <div className={`billing-calc billing-calc--result billing-calc--${outcome.kind}`} aria-live="polite">
                <dl className="billing-rows">
                  <AmountRow label={t('calcReceived')} value={<Money amount={received} />} />
                  {outcome.kind === 'change' ? (
                    <>
                      <AmountRow label={t('calcExactChange')} value={<Money amount={outcome.exactChange} />} />
                      <AmountRow
                        label={t('calcRounding')}
                        value={signedRounding(outcome.rounding)}
                        note={outcome.rounding > 0 ? t('roundingPatient') : outcome.rounding < 0 ? t('roundingHospital') : t('roundingNone')}
                      />
                      <AmountRow label={t('calcChange')} value={<Money amount={outcome.changeGiven} className="billing-strong" />} emphasis="grand" />
                    </>
                  ) : null}
                  {outcome.kind === 'rounded-off' ? (
                    <>
                      <AmountRow label={t('calcRounding')} value={signedRounding(outcome.shortfall)} note={t('roundingPatient')} />
                      <AmountRow label={t('calcChange')} value={<Money amount={0} />} emphasis="grand" />
                    </>
                  ) : null}
                  {outcome.kind === 'short' ? (
                    <AmountRow label={t('calcStillDue')} value={<Money amount={outcome.stillDue} className="billing-strong" />} emphasis="grand" />
                  ) : null}
                </dl>
                {outcome.kind === 'short' ? (
                  <Checkbox isSelected={partOk} onChange={setPartOk}>
                    {t('acceptPart')}
                  </Checkbox>
                ) : null}
              </div>
            )}

            <p className="billing-small billing-muted">{t('changeRule', { step: f.number(CASH_STEP_IQD) })}</p>

            <Button variant="primary" size="lg" icon="printer" isDisabled={!canRecord} onPress={record}>
              {t('recordPayment')}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
