/**
 * The Cashier screen (hospital-wide). Stub from the pre-wiring; a screen builder replaces it.
 */
import type { ReactNode } from 'react';
import { useT } from '../../i18n/use-t.ts';
import { EmptyState, PageHeader } from '../../ui/index.ts';
import './cashier.css';
import { messages } from './messages.ts';

export function CashierScreen(): ReactNode {
  const t = useT(messages);
  return (
    <div className="cashier-screen">
      <PageHeader icon="money" title={t('title')} subtitle={t('subtitle')} />
      <EmptyState icon="money" title={t('placeholder')} body={t('placeholderBody')} />
    </div>
  );
}
