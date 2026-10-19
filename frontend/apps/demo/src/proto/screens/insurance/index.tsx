/**
 * The Insurance & corporate screen (hospital-wide). Stub from the pre-wiring; a screen builder replaces it.
 */
import type { ReactNode } from 'react';
import { useT } from '../../i18n/use-t.ts';
import { EmptyState, PageHeader } from '../../ui/index.ts';
import './insurance.css';
import { messages } from './messages.ts';

export function InsuranceScreen(): ReactNode {
  const t = useT(messages);
  return (
    <div className="insurance-screen">
      <PageHeader icon="shield" title={t('title')} subtitle={t('subtitle')} />
      <EmptyState icon="shield" title={t('placeholder')} body={t('placeholderBody')} />
    </div>
  );
}
