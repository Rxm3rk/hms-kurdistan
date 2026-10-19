/**
 * The Staff & rosters screen (hospital-wide). Stub from the pre-wiring; a screen builder replaces it.
 */
import type { ReactNode } from 'react';
import { useT } from '../../i18n/use-t.ts';
import { EmptyState, PageHeader } from '../../ui/index.ts';
import './staff.css';
import { messages } from './messages.ts';

export function StaffScreen(): ReactNode {
  const t = useT(messages);
  return (
    <div className="staff-screen">
      <PageHeader icon="user" title={t('title')} subtitle={t('subtitle')} />
      <EmptyState icon="user" title={t('placeholder')} body={t('placeholderBody')} />
    </div>
  );
}
