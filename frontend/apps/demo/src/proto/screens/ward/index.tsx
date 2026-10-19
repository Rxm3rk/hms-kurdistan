/**
 * The ward screen. Stub from the scaffold.
 */
import type { ReactNode } from 'react';
import { useT } from '../../i18n/use-t.ts';
import { EmptyState, PageHeader } from '../../ui/index.ts';
import './ward.css';
import { messages } from './messages.ts';

export function WardScreen(): ReactNode {
  const t = useT(messages);
  return (
    <div className="ward-screen">
      <PageHeader icon="bed" title={t('title')} subtitle={t('subtitle')} />
      <EmptyState icon="bed" title={t('placeholder')} body={t('placeholderBody')} />
    </div>
  );
}
