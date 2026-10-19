/**
 * The Management dashboard screen (hospital-wide). Stub from the pre-wiring; a screen builder replaces it.
 */
import type { ReactNode } from 'react';
import { useT } from '../../i18n/use-t.ts';
import { EmptyState, PageHeader } from '../../ui/index.ts';
import './dashboard.css';
import { messages } from './messages.ts';

export function DashboardScreen(): ReactNode {
  const t = useT(messages);
  return (
    <div className="dashboard-screen">
      <PageHeader icon="activity" title={t('title')} subtitle={t('subtitle')} />
      <EmptyState icon="activity" title={t('placeholder')} body={t('placeholderBody')} />
    </div>
  );
}
