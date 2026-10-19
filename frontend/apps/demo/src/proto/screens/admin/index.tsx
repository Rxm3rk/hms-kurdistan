/**
 * The admin screen. Stub from the scaffold.
 */
import type { ReactNode } from 'react';
import { useT } from '../../i18n/use-t.ts';
import { EmptyState, PageHeader } from '../../ui/index.ts';
import './admin.css';
import { messages } from './messages.ts';

export function AdminScreen(): ReactNode {
  const t = useT(messages);
  return (
    <div className="admin-screen">
      <PageHeader icon="settings" title={t('title')} subtitle={t('subtitle')} />
      <EmptyState icon="settings" title={t('placeholder')} body={t('placeholderBody')} />
    </div>
  );
}
