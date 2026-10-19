/**
 * Small pieces shared by the billing screen's parts: US-dollar amounts from integer cents, the USD equivalent
 * of a dinar amount, the claim status chip, the "simulated" tag and a label/amount row.
 */
import { Bdi } from '@hms/design-system';
import type { ReactNode } from 'react';
import { useLocale, useT } from '../../i18n/use-t.ts';
import { Badge, Money, type IconName } from '../../ui/index.ts';
import { CLAIM_STATUS_TONE, type ClaimStatus } from './billing-data.ts';
import { messages } from './messages.ts';
import { formatUsdCents, usdCentsFromIqd } from './money.ts';

export type BillingKey = keyof (typeof messages)['en'];

/** US dollars from integer cents, isolated in its own direction (like the shared Money). */
export function UsdMoney({ cents, className }: { readonly cents: number; readonly className?: string }): ReactNode {
  const locale = useLocale();
  return (
    <Bdi dir={locale === 'en' ? 'ltr' : 'rtl'} className={['ui-money', className ?? ''].filter(Boolean).join(' ')}>
      {formatUsdCents(cents, locale)}
    </Bdi>
  );
}

/** "≈ USD 58.30" for a dinar amount at the fixed demo rate. */
export function UsdEquivalent({ iqd, className }: { readonly iqd: number; readonly className?: string }): ReactNode {
  const t = useT(messages);
  return (
    <span className={['billing-equiv', className ?? ''].filter(Boolean).join(' ')}>
      {t.rich('usdEquivalent', { amount: <UsdMoney cents={usdCentsFromIqd(iqd)} /> })}
    </span>
  );
}

/** A dinar amount with its USD equivalent beneath (or USD first for invoices presented in dollars). */
export function MoneyPair({ iqd, usdFirst = false, strong = false }: { readonly iqd: number; readonly usdFirst?: boolean; readonly strong?: boolean }): ReactNode {
  const main = strong ? 'billing-strong' : '';
  return usdFirst ? (
    <span className="billing-pair">
      <UsdMoney cents={usdCentsFromIqd(iqd)} className={main} />
      <span className="billing-muted">
        <Money amount={iqd} />
      </span>
    </span>
  ) : (
    <span className="billing-pair">
      <Money amount={iqd} className={main} />
      <UsdEquivalent iqd={iqd} className="billing-muted" />
    </span>
  );
}

const CLAIM_KEY: Readonly<Record<ClaimStatus, BillingKey>> = {
  draft: 'claimDraft',
  submitted: 'claimSubmitted',
  approved: 'claimApproved',
  rejected: 'claimRejected',
};

const CLAIM_ICON: Readonly<Record<ClaimStatus, IconName>> = {
  draft: 'pen',
  submitted: 'clock',
  approved: 'check-circle',
  rejected: 'x',
};

export function claimKey(status: ClaimStatus): BillingKey {
  return CLAIM_KEY[status];
}

/** The claim status chip: draft, submitted, approved, rejected (icon and text, never colour alone). */
export function ClaimChip({ status, size = 'sm' }: { readonly status: ClaimStatus; readonly size?: 'sm' | 'md' }): ReactNode {
  const t = useT(messages);
  return (
    <Badge tone={CLAIM_STATUS_TONE[status]} icon={CLAIM_ICON[status]} size={size}>
      {t(CLAIM_KEY[status])}
    </Badge>
  );
}

/** Marks simulated hardware and simulated outside parties. */
export function SimulatedTag(): ReactNode {
  const t = useT(messages);
  return (
    <Badge tone="neutral" size="sm" icon="info">
      {t('simulated')}
    </Badge>
  );
}

/** One label and amount row of a summary list (`dl`). */
export function AmountRow({
  label,
  value,
  sign,
  emphasis,
  muted = false,
  note,
}: {
  readonly label: ReactNode;
  readonly value: ReactNode;
  /** A minus before deductions (payer share, exemption, payments). */
  readonly sign?: 'minus' | 'plus';
  readonly emphasis?: 'total' | 'grand';
  readonly muted?: boolean;
  readonly note?: ReactNode;
}): ReactNode {
  const classes = ['billing-row', emphasis === undefined ? '' : `billing-row--${emphasis}`, muted ? 'billing-row--muted' : ''].filter(Boolean).join(' ');
  return (
    <div className={classes}>
      <dt className="billing-row__label">
        {label}
        {note === undefined ? null : <span className="billing-row__note">{note}</span>}
      </dt>
      <dd className="billing-row__value">
        {sign === undefined ? null : (
          <span className="billing-row__sign" aria-hidden="true">
            {sign === 'minus' ? '−' : '+'}
          </span>
        )}
        {value}
      </dd>
    </div>
  );
}
