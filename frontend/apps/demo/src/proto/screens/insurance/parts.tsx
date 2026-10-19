/**
 * Small building blocks of the Insurance & corporate screen: the patient cell, money with its USD
 * equivalent, status badges and the empty detail panel.
 */
import type { ReactNode } from 'react';
import { getPatient, iqdToUsd } from '../../data/index.ts';
import type { Tone } from '../../data/index.ts';
import type { ClaimStatus, PreApproval, PreApprovalStatus } from '../../data/ext/insurance.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { Badge, Code, EmptyState, Money, PatientName } from '../../ui/index.ts';
import { messages } from './messages.ts';

export const PA_TONE: Readonly<Record<PreApprovalStatus, Tone>> = {
  draft: 'neutral',
  submitted: 'info',
  queried: 'warning',
  approved: 'success',
  partial: 'accent',
  denied: 'danger',
  expired: 'neutral',
};

export const CLAIM_TONE: Readonly<Record<ClaimStatus, Tone>> = {
  preparing: 'neutral',
  submitted: 'info',
  'under-review': 'info',
  'part-paid': 'warning',
  paid: 'success',
  rejected: 'danger',
};

export function PaBadge({ status }: { readonly status: PreApprovalStatus }): ReactNode {
  const t = useT(messages);
  return (
    <Badge tone={PA_TONE[status]} size="sm" {...(status === 'queried' ? { icon: 'alert' as const } : {})}>
      {t(`pa_${status}`)}
    </Badge>
  );
}

export function ClaimBadge({ status }: { readonly status: ClaimStatus }): ReactNode {
  const t = useT(messages);
  return (
    <Badge tone={CLAIM_TONE[status]} size="sm">
      {t(`cl_${status}`)}
    </Badge>
  );
}

/** A patient in a worklist cell: the name in the UI language and the MRN. */
export function PatientCell({ patientId }: { readonly patientId: string }): ReactNode {
  const patient = getPatient(patientId);
  return (
    <span className="ins-patient">
      <PatientName patient={patient} />
      <Code className="ins-muted">{patient.mrn}</Code>
    </span>
  );
}

/** An amount in dinars, with its USD equivalent underneath when `showUsd`. */
export function IqdUsd({ amount, showUsd = false }: { readonly amount: number; readonly showUsd?: boolean }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  return (
    <span className="ins-money">
      <Money amount={amount} />
      {showUsd ? <span className="ins-muted">{t('usdEquivalent', { amount: f.usd(iqdToUsd(amount)) })}</span> : null}
    </span>
  );
}

export function paTotals(request: PreApproval): { readonly gross: number; readonly payer: number; readonly patient: number } {
  let gross = 0;
  let payer = 0;
  for (const line of request.lines) {
    const amount = line.quantity * line.unitIqd;
    gross += amount;
    payer += Math.round((amount * line.payerPct) / 100);
  }
  return { gross, payer, patient: gross - payer };
}

export function NoSelection(): ReactNode {
  const t = useT(messages);
  return <EmptyState icon="info" title={t('selectTitle')} body={t('selectBody')} compact />;
}
