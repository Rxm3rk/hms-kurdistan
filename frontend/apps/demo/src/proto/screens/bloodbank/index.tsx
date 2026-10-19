/**
 * The Blood bank screen (hospital-wide). Stub from the pre-wiring; a screen builder replaces it.
 */
import type { ReactNode } from 'react';
import { useT } from '../../i18n/use-t.ts';
import { EmptyState, PageHeader } from '../../ui/index.ts';
import './bloodbank.css';
import { messages } from './messages.ts';

export function BloodBankScreen(): ReactNode {
  const t = useT(messages);
  return (
    <div className="bloodbank-screen">
      <PageHeader icon="droplet" title={t('title')} subtitle={t('subtitle')} />
      <EmptyState icon="droplet" title={t('placeholder')} body={t('placeholderBody')} />
    </div>
  );
}
