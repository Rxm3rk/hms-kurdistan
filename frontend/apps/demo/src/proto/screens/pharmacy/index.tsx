/**
 * The Pharmacy screen (hospital-wide). Stub from the pre-wiring; a screen builder replaces it.
 */
import type { ReactNode } from 'react';
import { useT } from '../../i18n/use-t.ts';
import { EmptyState, PageHeader } from '../../ui/index.ts';
import './pharmacy.css';
import { messages } from './messages.ts';

export function PharmacyScreen(): ReactNode {
  const t = useT(messages);
  return (
    <div className="pharmacy-screen">
      <PageHeader icon="pill" title={t('title')} subtitle={t('subtitle')} />
      <EmptyState icon="pill" title={t('placeholder')} body={t('placeholderBody')} />
    </div>
  );
}
