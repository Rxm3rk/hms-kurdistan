/**
 * Small building blocks of the orders screen: the dose quantity, the medication line, warnings and the
 * read-only review of draft orders shown in the sign dialog.
 */
import { ClinicalNumber } from '@hms/design-system';
import type { ReactNode } from 'react';
import { ORDER_CATEGORY_LABEL, PRIORITY_LABEL, PRIORITY_TONE, ROUTE_LABEL, type Order, type OrderCategory, type Text3 } from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { Badge, Callout, Code, Icon, type IconName } from '../../ui/index.ts';
import { DURATION, FREQUENCY } from './catalogue.ts';
import { messages } from './messages.ts';
import { ORDERS_UNIT_MAP, type DraftOrder, type DraftWarning } from './model.ts';

export const CATEGORY_ICON: Readonly<Record<OrderCategory, IconName>> = {
  medication: 'pill',
  lab: 'flask',
  imaging: 'scan',
  nursing: 'heart',
  diet: 'droplet',
  consult: 'users',
};

/** A dose with its unit (mmol included), through the design system's ClinicalNumber. */
export function DoseQty({ value, unit }: { readonly value: string; readonly unit: string }): ReactNode {
  return <ClinicalNumber value={value} unit={unit} unitDisplayMap={ORDERS_UNIT_MAP} />;
}

/** Resolves warning variables: Text3 values become the current locale's text. */
export function useWarningText(): (warning: DraftWarning) => string {
  const t = useT(messages);
  const f = useFormat();
  return (warning) => {
    const vars: Record<string, string> = {};
    for (const [key, value] of Object.entries(warning.vars ?? {})) {
      vars[key] = typeof value === 'string' ? value : f.text(value as Text3);
    }
    return t(warning.key, vars);
  };
}

export function WarningList({ warnings, compact = false }: { readonly warnings: readonly DraftWarning[]; readonly compact?: boolean }): ReactNode {
  const text = useWarningText();
  if (warnings.length === 0) {
    return null;
  }
  return (
    <ul className={compact ? 'orders-warnings orders-warnings--compact' : 'orders-warnings'}>
      {warnings.map((warning) => (
        <li key={`${warning.key}-${JSON.stringify(warning.vars ?? {})}`} className={`orders-warning orders-warning--${warning.tone}`}>
          <Icon name={warning.tone === 'info' ? 'info' : 'alert'} size="1em" />
          <span>{text(warning)}</span>
        </li>
      ))}
    </ul>
  );
}

/** "1 g · Oral · Every 8 hours · 5 days" for a draft order. */
export function DraftLine({ draft }: { readonly draft: DraftOrder }): ReactNode {
  const f = useFormat();
  const med = draft.medication;
  if (med === null) {
    return draft.detail === null ? null : <span className="orders-line">{f.text(draft.detail)}</span>;
  }
  return (
    <span className="orders-line">
      <DoseQty value={med.dose} unit={med.unit} />
      <span aria-hidden="true">·</span>
      <span>{f.text(ROUTE_LABEL[med.route])}</span>
      <span aria-hidden="true">·</span>
      <span>{f.text(FREQUENCY[med.frequency])}</span>
      <span aria-hidden="true">·</span>
      <span>{f.text(DURATION[med.duration])}</span>
    </span>
  );
}

/** The title of a draft: the drug (Latin, left to right) or the test, with its short code. */
export function DraftTitle({ draft }: { readonly draft: DraftOrder }): ReactNode {
  const f = useFormat();
  return (
    <span className="orders-draft-title">
      <Icon name={CATEGORY_ICON[draft.category]} size="1.1em" />
      {draft.medication === null ? <span>{f.text(draft.title)}</span> : <Code>{draft.medication.drug}</Code>}
      {draft.code === null ? null : <Code className="orders-muted">{draft.code}</Code>}
    </span>
  );
}

/** The medication line of an existing order. */
export function OrderMedLine({ order }: { readonly order: Order }): ReactNode {
  const f = useFormat();
  const t = useT(messages);
  const med = order.medication;
  if (med === null) {
    return null;
  }
  return (
    <span className="orders-line">
      <DoseQty value={med.dose} unit={med.doseUnit} />
      <span aria-hidden="true">·</span>
      <span>{f.text(ROUTE_LABEL[med.route])}</span>
      <span aria-hidden="true">·</span>
      <span>{f.text(med.frequency)}</span>
      {med.prn && med.prnReason !== null ? (
        <>
          <span aria-hidden="true">·</span>
          <span>
            {t('prnShort')}: {f.text(med.prnReason)}
          </span>
        </>
      ) : null}
    </span>
  );
}

/** What the sign dialog shows in its review step for a list of drafts. */
export function DraftReview({ drafts }: { readonly drafts: readonly DraftOrder[] }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  return (
    <div className="orders-review">
      <p className="orders-review__heading">{t('reviewHeading', { count: drafts.length })}</p>
      <ol className="orders-review__list">
        {drafts.map((draft) => (
          <li key={draft.id} className="orders-review__item">
            <span className="orders-review__title">
              <DraftTitle draft={draft} />
              <Badge size="sm" tone="neutral">
                {f.text(ORDER_CATEGORY_LABEL[draft.category])}
              </Badge>
              {draft.priority === 'routine' ? null : (
                <Badge size="sm" tone={PRIORITY_TONE[draft.priority]}>
                  {f.text(PRIORITY_LABEL[draft.priority])}
                </Badge>
              )}
              {draft.override === null ? null : (
                <Badge size="sm" tone="danger" icon="alert">
                  {t('overrideBadge')}
                </Badge>
              )}
            </span>
            <DraftLine draft={draft} />
            <WarningList warnings={draft.warnings} compact />
          </li>
        ))}
      </ol>
    </div>
  );
}

/** What the sign dialog shows for one existing order. */
export function OrderReview({ order }: { readonly order: Order }): ReactNode {
  const f = useFormat();
  return (
    <div className="orders-review">
      <p className="orders-review__title">
        <Icon name={CATEGORY_ICON[order.category]} size="1.1em" />
        {order.medication === null ? <span>{f.text(order.title)}</span> : <Code>{order.medication.drug}</Code>}
        <Code className="orders-muted">{order.id}</Code>
      </p>
      <OrderMedLine order={order} />
      {order.detail === null ? null : <p className="orders-muted">{f.text(order.detail)}</p>}
      {order.alerts.map((alert) => (
        <Callout key={alert.text.en} tone={alert.tone}>
          {f.text(alert.text)}
        </Callout>
      ))}
    </div>
  );
}
