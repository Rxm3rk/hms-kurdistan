/**
 * The Quality & safety screen (hospital-wide). Stub from the pre-wiring; a screen builder replaces it.
 */
import type { ReactNode } from 'react';
import { useT } from '../../i18n/use-t.ts';
import { EmptyState, PageHeader } from '../../ui/index.ts';
import './quality.css';
import { messages } from './messages.ts';

export function QualityScreen(): ReactNode {
  const t = useT(messages);
  return (
    <div className="quality-screen">
      <PageHeader icon="check-circle" title={t('title')} subtitle={t('subtitle')} />
      <EmptyState icon="check-circle" title={t('placeholder')} body={t('placeholderBody')} />
    </div>
  );
}
