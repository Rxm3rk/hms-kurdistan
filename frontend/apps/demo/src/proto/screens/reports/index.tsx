/**
 * The Reports & returns screen (hospital-wide). Stub from the pre-wiring; a screen builder replaces it.
 */
import type { ReactNode } from 'react';
import { useT } from '../../i18n/use-t.ts';
import { EmptyState, PageHeader } from '../../ui/index.ts';
import './reports.css';
import { messages } from './messages.ts';

export function ReportsScreen(): ReactNode {
  const t = useT(messages);
  return (
    <div className="reports-screen">
      <PageHeader icon="printer" title={t('title')} subtitle={t('subtitle')} />
      <EmptyState icon="printer" title={t('placeholder')} body={t('placeholderBody')} />
    </div>
  );
}
