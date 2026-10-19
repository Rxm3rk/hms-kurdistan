/**
 * The Stores & inventory screen (hospital-wide). Stub from the pre-wiring; a screen builder replaces it.
 */
import type { ReactNode } from 'react';
import { useT } from '../../i18n/use-t.ts';
import { EmptyState, PageHeader } from '../../ui/index.ts';
import './inventory.css';
import { messages } from './messages.ts';

export function InventoryScreen(): ReactNode {
  const t = useT(messages);
  return (
    <div className="inventory-screen">
      <PageHeader icon="building" title={t('title')} subtitle={t('subtitle')} />
      <EmptyState icon="building" title={t('placeholder')} body={t('placeholderBody')} />
    </div>
  );
}
