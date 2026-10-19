/**
 * The patient's invoice: header, charges grouped by category (prices in IQD), discounts and exemptions (each
 * needs a supervisor's co-signature), the claim to the insurer or public coverage (draft, submitted,
 * approved, rejected), the amount due in IQD with the USD equivalent, payment taking and the receipts.
 * SYNTHETIC DATA ONLY, NOT FOR CLINICAL USE.
 */
import { useIsModalOpen } from '@hms/design-system';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  CHARGE_CATEGORY_LABEL,
  ENCOUNTER_TYPE_LABEL,
  EXCHANGE_RATE,
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_TONE,
  PAYMENT_METHOD_LABEL,
  encountersOf,
  findStaff,
  getDepartment,
  getPayer,
  getWard,
} from '../../data/index.ts';
import type { Invoice, Patient } from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { SignAction, useClinicalPatient, useRole } from '../../shell/index.ts';
import {
  Badge,
  Button,
  Callout,
  Card,
  Code,
  Dialog,
  EmptyState,
  Icon,
  KeyValueList,
  Money,
  Segmented,
  SelectField,
  StaffName,
  TextInput,
  useToast,
} from '../../ui/index.ts';
import {
  SHIFT,
  accountTotals,
  exemptionAmount,
  getExemptionRule,
  groupLines,
  lineAmount,
  rulesFor,
  tbTestLines,
  type AccountTotals,
  type BillingAccount,
  type Claim,
  type ExemptionId,
  type ExemptionRequest,
  type PaymentRecord,
} from './billing-data.ts';
import { billingActions, claimOf, paymentsOf, useBillingSession } from './billing-store.ts';
import { messages } from './messages.ts';
import { formatIqdNumber, usdCentsFromIqd } from './money.ts';
import { AmountRow, ClaimChip, MoneyPair, SimulatedTag, UsdEquivalent, UsdMoney } from './parts.tsx';
import { PaymentPanel } from './payment-panel.tsx';
import { ThermalReceipt } from './receipt.tsx';

// ---------------------------------------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------------------------------------

function InvoiceHeader({ invoice, patient, estimated, claim, onStatement }: { readonly invoice: Invoice; readonly patient: Patient; readonly estimated: boolean; readonly claim: Claim | null; readonly onStatement: () => void }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const payer = getPayer(invoice.payerId);
  const encounter = encountersOf(patient.id).find((candidate) => candidate.id === invoice.encounterId);
  const wardId = encounter?.wardId ?? null;
  const ward = wardId === null ? undefined : getWard(wardId);
  const attending = findStaff(encounter?.attendingId);

  const items = [
    {
      id: 'payer',
      label: t('hPayer'),
      value: (
        <span className="billing-pair">
          <span>{f.text(payer.name)}</span>
          <span className="billing-muted">{payer.coveragePct > 0 ? t('payerCovers', { percent: f.percent(payer.coveragePct / 100) }) : t('payerSelf')}</span>
        </span>
      ),
    },
    {
      id: 'encounter',
      label: t('hEncounter'),
      value:
        encounter === undefined ? (
          <Code>{invoice.encounterId}</Code>
        ) : (
          <span className="billing-pair">
            <span>
              {f.text(ENCOUNTER_TYPE_LABEL[encounter.type])} · {f.text(getDepartment(encounter.departmentId).name)}
            </span>
            <span className="billing-muted">
              {ward === undefined ? f.date(encounter.startIso) : t.rich('hWardBed', { ward: f.text(ward.name), bed: <Code>{encounter.bedId ?? '—'}</Code> })}
            </span>
          </span>
        ),
    },
    {
      id: 'attending',
      label: t('hAttending'),
      value: attending === undefined ? '—' : <StaffName member={attending} />,
    },
    { id: 'issued', label: estimated ? t('hEstimated') : t('hIssued'), value: f.dateTime(invoice.issuedIso) },
    { id: 'currency', label: t('hPresented'), value: invoice.currency === 'USD' ? t('presentedUsd') : t('presentedIqd') },
    {
      id: 'claim',
      label: t('hClaim'),
      value: claim === null ? <span className="billing-muted">{t('claimNone')}</span> : <ClaimChip status={claim.status} />,
    },
  ];

  return (
    <Card
      title={t.rich('invoiceTitle', { id: <Code>{invoice.id}</Code> })}
      subtitle={estimated ? t('estimateSubtitle') : t('invoiceSubtitle', { count: invoice.lines.length })}
      icon="receipt"
      actions={
        <span className="billing-actions">
          <Badge tone={estimated ? 'neutral' : INVOICE_STATUS_TONE[invoice.status]} strong={false}>
            {estimated ? t('statusEstimate') : f.text(INVOICE_STATUS_LABEL[invoice.status])}
          </Badge>
          <Button size="sm" icon="printer" onPress={onStatement}>
            {t('statementButton')}
          </Button>
        </span>
      }
    >
      <KeyValueList items={items} columns={3} />
      {invoice.note === null ? null : (
        <p className="billing-note">
          <span className="billing-note__label">{t('hNote')}</span> {f.text(invoice.note)}
        </p>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Charges
// ---------------------------------------------------------------------------------------------------------

function ChargesCard({ invoice, totals }: { readonly invoice: Invoice; readonly totals: AccountTotals }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const tb = new Set(tbTestLines(invoice).map((item) => item.id));
  const groups = groupLines(invoice);
  return (
    <Card title={t('chargesTitle')} subtitle={t('chargesSubtitle')} icon="clipboard" flush>
      <div className="billing-lines-wrap">
        <table className="billing-lines">
          <caption className="hms-visually-hidden">{t('chargesTitle')}</caption>
          <thead>
            <tr>
              <th scope="col" className="billing-lines__date">
                {t('colDate')}
              </th>
              <th scope="col">{t('colService')}</th>
              <th scope="col" className="billing-lines__num">
                {t('colQty')}
              </th>
              <th scope="col" className="billing-lines__num">
                {t('colUnit')}
              </th>
              <th scope="col" className="billing-lines__num">
                {t('colAmount')}
              </th>
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody key={group.category}>
              <tr className="billing-lines__group">
                <th scope="colgroup" colSpan={5}>
                  <span>{f.text(CHARGE_CATEGORY_LABEL[group.category])}</span>
                  <span className="billing-lines__count">{t('itemsCount', { count: group.lines.length })}</span>
                </th>
              </tr>
              {group.lines.map((item) => (
                <tr key={item.id}>
                  <td className="billing-lines__date">{f.date(item.serviceOn, 'short')}</td>
                  <td>
                    <span className="billing-lines__desc">{f.text(item.description)}</span>
                    {tb.has(item.id) ? (
                      <Badge tone="info" size="sm">
                        {t('tbLine')}
                      </Badge>
                    ) : null}
                  </td>
                  <td className="billing-lines__num">{f.number(item.quantity)}</td>
                  <td className="billing-lines__num">{formatIqdNumber(item.unitPriceIqd, f.locale)}</td>
                  <td className="billing-lines__num billing-strong">{formatIqdNumber(lineAmount(item), f.locale)}</td>
                </tr>
              ))}
              <tr className="billing-lines__subtotal">
                <td colSpan={4}>{t('subtotal', { category: f.text(CHARGE_CATEGORY_LABEL[group.category]) })}</td>
                <td className="billing-lines__num">{formatIqdNumber(group.subtotalIqd, f.locale)}</td>
              </tr>
            </tbody>
          ))}
          <tfoot>
            <tr className="billing-lines__total">
              <th scope="row" colSpan={4}>
                {t('grossCharges')}
              </th>
              <td className="billing-lines__num">
                <Money amount={totals.grossIqd} />
              </td>
            </tr>
            <tr className="billing-lines__equiv">
              <td colSpan={4}>{t('usdAtRate')}</td>
              <td className="billing-lines__num">
                <UsdMoney cents={usdCentsFromIqd(totals.grossIqd)} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Discounts and exemptions
// ---------------------------------------------------------------------------------------------------------

function ExemptionReview({ invoice, request, totals }: { readonly invoice: Invoice; readonly request: ExemptionRequest; readonly totals: AccountTotals }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const rule = getExemptionRule(request.ruleId);
  const amount = exemptionAmount(invoice, rule);
  const requester = findStaff(request.requestedById);
  return (
    <div className="billing-review">
      <p className="billing-review__title">{t('reviewTitle')}</p>
      <KeyValueList
        columns={1}
        items={[
          { id: 'invoice', label: t('reviewInvoice'), value: <Code>{invoice.id}</Code> },
          { id: 'rule', label: t('reviewRule'), value: `${f.text(rule.label)} (${f.text(rule.basis)})` },
          { id: 'evidence', label: f.text(rule.evidence), value: <Code>{request.evidence}</Code> },
          { id: 'amount', label: t('reviewAmount'), value: <Money amount={amount} /> },
          { id: 'after', label: t('reviewBalanceAfter'), value: <Money amount={Math.max(0, totals.balanceIqd - amount)} /> },
          {
            id: 'by',
            label: t('reviewRequestedBy'),
            value: requester === undefined ? '—' : t.rich('byAt', { name: <StaffName member={requester} />, time: f.time(request.requestedIso) }),
          },
        ]}
      />
      <p className="billing-small billing-muted">{t('reviewNote')}</p>
    </div>
  );
}

function ExemptionCard({ invoice, totals, request }: { readonly invoice: Invoice; readonly totals: AccountTotals; readonly request: ExemptionRequest | undefined }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const { user } = useRole();
  const { actionsDisabled } = useClinicalPatient();
  const rules = rulesFor(invoice);
  const [ruleId, setRuleId] = useState<ExemptionId>(rules.find((rule) => rule.scope === 'tb-tests')?.id ?? 'gov-employee');
  const [evidence, setEvidence] = useState('');
  const rule = getExemptionRule(ruleId);
  const preview = exemptionAmount(invoice, rule);
  const settled = totals.balanceIqd === 0 && totals.paidIqd > 0;

  if (request === undefined || request.status === 'rejected') {
    return (
      <Card title={t('exTitle')} subtitle={t('exSubtitle')} icon="shield">
        {request?.status === 'rejected' ? (
          <Callout tone="neutral" title={t('exRejectedTitle', { rule: f.text(getExemptionRule(request.ruleId).label) })}>
            {t('exRejectedBody', { time: f.time(request.decidedIso ?? request.requestedIso) })}
          </Callout>
        ) : null}
        {settled ? (
          <p className="billing-muted">{t('exSettled')}</p>
        ) : (
          <div className="billing-ex-form">
            <SelectField
              label={t('exType')}
              selectedKey={ruleId}
              onSelectionChange={(id) => {
                const next = rules.find((candidate) => candidate.id === id);
                if (next !== undefined) {
                  setRuleId(next.id);
                }
              }}
              options={rules.map((candidate) => ({ id: candidate.id, label: `${f.text(candidate.label)} · ${f.text(candidate.basis)}` }))}
            />
            <TextInput
              label={f.text(rule.evidence)}
              value={evidence}
              onChange={setEvidence}
              dir="ltr"
              description={t('exEvidenceHint', { example: rule.evidenceExample })}
              isRequired
            />
            <p className="billing-ex-preview">
              {t.rich('exPreview', { amount: <Money amount={preview} className="billing-strong" /> })}
            </p>
            <div className="billing-actions">
              <Button
                variant="secondary"
                icon="shield"
                isDisabled={actionsDisabled || evidence.trim() === '' || preview === 0}
                onPress={() => {
                  billingActions.requestExemption(invoice.id, ruleId, evidence.trim(), user.id);
                  setEvidence('');
                  toast({ tone: 'info', title: t('exRequestedToast'), body: t('exRequestedToastBody') });
                }}
              >
                {t('exRequest')}
              </Button>
              <span className="billing-small billing-muted">{t('exNeedsApproval')}</span>
            </div>
          </div>
        )}
      </Card>
    );
  }

  const current = getExemptionRule(request.ruleId);
  const amount = exemptionAmount(invoice, current);
  const requester = findStaff(request.requestedById);

  if (request.status === 'pending') {
    return (
      <Card
        title={t('exTitle')}
        icon="shield"
        tone="warning"
        actions={
          <Badge tone="warning" icon="clock">
            {t('exPending')}
          </Badge>
        }
      >
        <div className="billing-ex-summary">
          <p className="billing-ex-summary__rule">
            <span className="billing-strong">{f.text(current.label)}</span> <span className="billing-muted">· {f.text(current.basis)}</span>
          </p>
          <KeyValueList
            columns={3}
            items={[
              { id: 'amount', label: t('reviewAmount'), value: <Money amount={amount} className="billing-strong" /> },
              { id: 'evidence', label: f.text(current.evidence), value: <Code>{request.evidence}</Code> },
              {
                id: 'by',
                label: t('reviewRequestedBy'),
                value: requester === undefined ? '—' : t.rich('byAt', { name: <StaffName member={requester} />, time: f.time(request.requestedIso) }),
              },
            ]}
          />
          <p className="billing-small billing-muted">{t('exPendingNote')}</p>
          <div className="billing-actions">
            <SignAction
              kind="cosign"
              label={t('exApprove')}
              isDisabled={actionsDisabled}
              review={<ExemptionReview invoice={invoice} request={request} totals={totals} />}
              onSigned={() => {
                billingActions.decideExemption(invoice.id, 'approved');
              }}
            />
            <Button
              variant="ghost"
              icon="x"
              onPress={() => {
                billingActions.decideExemption(invoice.id, 'rejected');
              }}
            >
              {t('exReject')}
            </Button>
            <Button
              variant="ghost"
              onPress={() => {
                billingActions.withdrawExemption(invoice.id);
              }}
            >
              {t('exWithdraw')}
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title={t('exTitle')}
      icon="shield"
      tone="success"
      actions={
        <Badge tone="success" icon="check-circle">
          {t('exApproved')}
        </Badge>
      }
    >
      <p className="billing-ex-summary__rule">
        <span className="billing-strong">{f.text(current.label)}</span> <span className="billing-muted">· {f.text(current.basis)}</span>
      </p>
      <p>{t.rich('exApprovedBody', { amount: <Money amount={amount} className="billing-strong" />, time: f.time(request.decidedIso ?? request.requestedIso) })}</p>
      {totals.creditIqd > 0 ? (
        <Callout tone="info" title={t('creditTitle')}>
          {t.rich('creditBody', { amount: <Money amount={totals.creditIqd} /> })}
        </Callout>
      ) : null}
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Insurance and company credit
// ---------------------------------------------------------------------------------------------------------

function ClaimCard({ invoice, claim, totals }: { readonly invoice: Invoice; readonly claim: Claim | null; readonly totals: AccountTotals }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const payer = getPayer(invoice.payerId);

  if (claim === null) {
    return (
      <Card title={t('claimTitle')} icon="building">
        <p>{t('claimSelfPay')}</p>
        <p className="billing-small billing-muted">{t('claimSelfPayHint')}</p>
      </Card>
    );
  }

  const steps: readonly { readonly id: string; readonly label: string; readonly state: 'done' | 'current' | 'todo' | 'failed' }[] = [
    { id: 'draft', label: t('claimDraft'), state: claim.status === 'draft' ? 'current' : 'done' },
    {
      id: 'submitted',
      label: t('claimSubmitted'),
      state: claim.status === 'draft' ? 'todo' : claim.status === 'submitted' ? 'current' : 'done',
    },
    {
      id: 'decision',
      label: claim.status === 'rejected' ? t('claimRejected') : claim.status === 'approved' ? t('claimApproved') : t('claimDecision'),
      state: claim.status === 'approved' ? 'done' : claim.status === 'rejected' ? 'failed' : 'todo',
    },
  ];

  const move = (status: Claim['status'], toastKey: 'claimSubmittedToast' | 'claimApprovedToast' | 'claimRejectedToast'): void => {
    billingActions.moveClaim(invoice, status);
    toast({ tone: status === 'rejected' ? 'warning' : 'success', title: t(toastKey, { id: claim.id }) });
  };

  return (
    <Card
      title={t('claimTitle')}
      subtitle={f.text(payer.name)}
      icon="building"
      {...(claim.status === 'rejected' ? { tone: 'danger' as const } : {})}
      actions={<ClaimChip status={claim.status} size="md" />}
    >
      <div className="billing-claim">
        <KeyValueList
          columns={3}
          items={[
            { id: 'coverage', label: t('claimCoverage'), value: f.percent(totals.coveragePct / 100) },
            { id: 'share', label: t('claimPayerShare'), value: <MoneyPair iqd={totals.payerShareIqd} usdFirst={invoice.currency === 'USD'} strong /> },
            { id: 'terms', label: t('claimTerms'), value: t('claimTermsDays', { days: claim.paymentTermsDays }) },
            { id: 'id', label: t('claimNumber'), value: <Code>{claim.id}</Code> },
            { id: 'ref', label: t('claimReference'), value: claim.reference === null ? '—' : <Code>{claim.reference}</Code> },
            { id: 'currency', label: t('claimCurrency'), value: payer.currency === 'USD' ? t('presentedUsd') : t('presentedIqd') },
          ]}
        />

        <ol className="billing-steps" aria-label={t('claimProgress')}>
          {steps.map((step, index) => (
            <li key={step.id} className={`billing-steps__step billing-steps__step--${step.state}`} aria-current={step.state === 'current' ? 'step' : undefined}>
              <span className="billing-steps__marker" aria-hidden="true">
                {step.state === 'done' ? <Icon name="check" size="0.9em" /> : step.state === 'failed' ? <Icon name="x" size="0.9em" /> : f.number(index + 1)}
              </span>
              <span className="billing-steps__label">{step.label}</span>
            </li>
          ))}
        </ol>

        {claim.status === 'rejected' && claim.rejectionReason !== null ? (
          <Callout tone="danger" title={t('claimRejectedTitle')}>
            <p>{f.text(claim.rejectionReason)}</p>
            <p>{t.rich('claimAtRisk', { amount: <Money amount={totals.payerShareIqd} /> })}</p>
          </Callout>
        ) : null}
        {claim.status === 'approved' ? (
          <Callout tone="success" title={t('claimApprovedTitle')}>
            {t.rich('claimApprovedBody', { amount: <Money amount={totals.payerShareIqd} />, days: claim.paymentTermsDays })}
          </Callout>
        ) : null}

        <ul className="billing-events" aria-label={t('claimHistory')}>
          {claim.events.toReversed().map((event, index) => (
            <li key={`${event.iso}-${event.status}-${String(index)}`} className="billing-events__item">
              <span className="billing-events__time">{f.dateTime(event.iso)}</span>
              <ClaimChip status={event.status} />
              {event.note === null ? null : <span className="billing-events__note">{f.text(event.note)}</span>}
              {event.simulated ? <SimulatedTag /> : null}
            </li>
          ))}
        </ul>

        <div className="billing-actions">
          {claim.status === 'draft' ? (
            <Button variant="secondary" icon="arrow-forward" onPress={() => { move('submitted', 'claimSubmittedToast'); }}>
              {t('claimSubmit')}
            </Button>
          ) : null}
          {claim.status === 'submitted' ? (
            <>
              <Button variant="secondary" icon="check" onPress={() => { move('approved', 'claimApprovedToast'); }}>
                {t('claimSimApprove')}
              </Button>
              <Button variant="ghost" icon="x" onPress={() => { move('rejected', 'claimRejectedToast'); }}>
                {t('claimSimReject')}
              </Button>
            </>
          ) : null}
          {claim.status === 'rejected' ? (
            <Button variant="secondary" icon="refresh" onPress={() => { move('submitted', 'claimSubmittedToast'); }}>
              {t('claimResubmit')}
            </Button>
          ) : null}
          {claim.status === 'draft' || claim.status === 'submitted' || claim.status === 'rejected' ? <SimulatedTag /> : null}
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Amount due and payments
// ---------------------------------------------------------------------------------------------------------

function TotalsCard({ invoice, totals, request }: { readonly invoice: Invoice; readonly totals: AccountTotals; readonly request: ExemptionRequest | undefined }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const payer = getPayer(invoice.payerId);
  const rule = request === undefined ? undefined : getExemptionRule(request.ruleId);
  const usdFirst = invoice.currency === 'USD';
  return (
    <Card title={t('totalsTitle')} icon="money" className="billing-totals">
      <dl className="billing-rows">
        <AmountRow label={t('grossCharges')} value={<Money amount={totals.grossIqd} />} />
        {totals.payerShareIqd > 0 ? (
          <AmountRow
            label={t('payerShareRow', { payer: f.text(payer.name) })}
            note={f.percent(totals.coveragePct / 100)}
            value={<Money amount={totals.payerShareIqd} />}
            sign="minus"
          />
        ) : null}
        <AmountRow label={t('patientShare')} value={<Money amount={totals.patientShareIqd} />} emphasis="total" />
        {totals.exemptionIqd > 0 && rule !== undefined ? (
          <AmountRow label={f.text(rule.label)} note={t('exApproved')} value={<Money amount={totals.exemptionIqd} />} sign="minus" />
        ) : null}
        {totals.pendingExemptionIqd > 0 && rule !== undefined ? (
          <AmountRow label={f.text(rule.label)} note={t('exPendingNotApplied')} value={<Money amount={totals.pendingExemptionIqd} />} sign="minus" muted />
        ) : null}
        {totals.paidIqd > 0 ? <AmountRow label={t('paidSoFar')} value={<Money amount={totals.paidIqd} />} sign="minus" /> : null}
      </dl>
      <div className={`billing-balance${totals.balanceIqd === 0 ? ' billing-balance--settled' : ''}`}>
        <span className="billing-balance__label">{t('balanceDue')}</span>
        {usdFirst ? (
          <>
            <UsdMoney cents={usdCentsFromIqd(totals.balanceIqd)} className="billing-balance__amount" />
            <span className="billing-balance__equiv">
              <Money amount={totals.balanceIqd} />
            </span>
          </>
        ) : (
          <>
            <Money amount={totals.balanceIqd} className="billing-balance__amount" />
            <UsdEquivalent iqd={totals.balanceIqd} className="billing-balance__equiv" />
          </>
        )}
      </div>
      {totals.creditIqd > 0 ? (
        <p className="billing-credit">{t.rich('creditBody', { amount: <Money amount={totals.creditIqd} /> })}</p>
      ) : null}
      <p className="billing-small billing-muted">
        {f.text(EXCHANGE_RATE.note)}. {usdFirst ? t('usdPresentedNote') : t('iqdKeptNote')}
      </p>
    </Card>
  );
}

function PaymentsCard({ payments, onReceipt }: { readonly payments: readonly PaymentRecord[]; readonly onReceipt: (record: PaymentRecord) => void }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  return (
    <Card title={t('paymentsTitle')} subtitle={t('paymentsCount', { count: payments.length })} icon="receipt">
      {payments.length === 0 ? (
        <EmptyState compact icon="receipt" title={t('paymentsEmpty')} />
      ) : (
        <ul className="billing-payments">
          {payments.toReversed().map((record) => {
            const cashier = findStaff(record.receivedById);
            return (
              <li key={record.id} className="billing-payments__item">
                <div className="billing-payments__main">
                  <span className="billing-payments__top">
                    <Code>{record.receipt}</Code>
                    <Badge size="sm" tone={record.method === 'card' ? 'info' : 'neutral'}>
                      {f.text(PAYMENT_METHOD_LABEL[record.method])}
                    </Badge>
                    {record.session ? (
                      <Badge size="sm" tone="success" icon="check">
                        {t('takenNow')}
                      </Badge>
                    ) : null}
                  </span>
                  <span className="billing-payments__tenders">
                    {record.tenders.map((tender) =>
                      tender.currency === 'USD' ? <UsdMoney key="usd" cents={tender.minor} /> : <Money key="iqd" amount={tender.minor} />,
                    )}
                    {record.changeIqd > 0 ? <span className="billing-muted">{t.rich('changeShort', { amount: <Money amount={record.changeIqd} /> })}</span> : null}
                  </span>
                  <span className="billing-small billing-muted">
                    {f.dateTime(record.iso)}
                    {cashier === undefined ? null : <> · <StaffName member={cashier} /></>}
                  </span>
                </div>
                <div className="billing-payments__end">
                  <Money amount={record.appliedIqd} className="billing-strong" />
                  <Button size="sm" variant="ghost" icon="printer" onPress={() => { onReceipt(record); }}>
                    {t('receiptButton')}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------
// The view
// ---------------------------------------------------------------------------------------------------------

type ReceiptRequest = { readonly kind: 'statement' } | { readonly kind: 'receipt'; readonly record: PaymentRecord };

function InvoiceView({ patient, account }: { readonly patient: Patient; readonly account: BillingAccount }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const session = useBillingSession();
  const { invoice, estimated } = account;
  const payments = paymentsOf(session, invoice);
  const request = session.exemptions[invoice.id];
  const totals = accountTotals(invoice, request, payments);
  const claim = claimOf(session, invoice);
  const [receipt, setReceipt] = useState<ReceiptRequest | null>(null);
  const record = receipt?.kind === 'receipt' ? receipt.record : null;
  // A card payment completes after a short (simulated) wait: open its receipt only if no other dialog took the
  // window's single modal slot in the meantime (the receipt stays available in the payments list).
  const modalOpen = useIsModalOpen();
  const slot = useRef({ modalOpen, receiptOpen: receipt !== null });
  useEffect(() => {
    slot.current = { modalOpen, receiptOpen: receipt !== null };
  }, [modalOpen, receipt]);
  const cashier = findStaff(record?.receivedById ?? SHIFT.cashierId) ?? findStaff(SHIFT.cashierId);

  return (
    <div className="billing-layout">
      <div className="billing-main">
        {estimated ? (
          <Callout tone="info" title={t('estimateTitle')}>
            {t('estimateBody')}
          </Callout>
        ) : null}
        <InvoiceHeader
          invoice={invoice}
          patient={patient}
          estimated={estimated}
          claim={claim}
          onStatement={() => {
            setReceipt({ kind: 'statement' });
          }}
        />
        <ChargesCard invoice={invoice} totals={totals} />
        <ExemptionCard invoice={invoice} totals={totals} request={request} />
        <ClaimCard invoice={invoice} claim={claim} totals={totals} />
      </div>
      <div className="billing-aside">
        <TotalsCard invoice={invoice} totals={totals} request={request} />
        <PaymentPanel
          invoice={invoice}
          totals={totals}
          onRecorded={(entry) => {
            if (slot.current.receiptOpen || !slot.current.modalOpen) {
              setReceipt({ kind: 'receipt', record: entry });
            }
          }}
        />
        <PaymentsCard
          payments={payments}
          onReceipt={(entry) => {
            setReceipt({ kind: 'receipt', record: entry });
          }}
        />
      </div>

      <Dialog
        isOpen={receipt !== null}
        onOpenChange={(open) => {
          if (!open) {
            setReceipt(null);
          }
        }}
        title={record === null ? t('statementPreview') : t('receiptPreview')}
        subtitle={
          <span className="billing-dialog-sub">
            {f.text(SHIFT.printer)} <SimulatedTag />
          </span>
        }
        actions={
          <>
            <Button
              onPress={() => {
                setReceipt(null);
              }}
            >
              {t('close')}
            </Button>
            <Button
              variant="primary"
              icon="printer"
              onPress={() => {
                toast({ tone: 'success', title: t('printedToast'), body: t('printedToastBody', { printer: f.text(SHIFT.printer) }) });
                setReceipt(null);
              }}
            >
              {t('printSimulated')}
            </Button>
          </>
        }
      >
        {receipt === null || cashier === undefined ? null : (
          <ThermalReceipt patient={patient} invoice={invoice} totals={totals} exemption={request} payments={payments} record={record} cashier={cashier} />
        )}
      </Dialog>
    </div>
  );
}

export function InvoiceTab({ patient, accounts }: { readonly patient: Patient; readonly accounts: readonly BillingAccount[] }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const [selectedId, setSelectedId] = useState<string | null>(accounts[0]?.invoice.id ?? null);
  const account = accounts.find((candidate) => candidate.invoice.id === selectedId) ?? accounts[0];

  if (account === undefined) {
    return <EmptyState icon="receipt" title={t('noInvoiceTitle')} body={t('noInvoiceBody')} />;
  }

  return (
    <div className="billing-invoice">
      {accounts.length > 1 ? (
        <Segmented
          label={t('chooseInvoice')}
          value={account.invoice.id}
          onChange={setSelectedId}
          options={accounts.map((candidate) => ({ id: candidate.invoice.id, label: `${candidate.invoice.id} · ${f.date(candidate.invoice.issuedIso)}` }))}
        />
      ) : null}
      <InvoiceView key={account.invoice.id} patient={patient} account={account} />
    </div>
  );
}

