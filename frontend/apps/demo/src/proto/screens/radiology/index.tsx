/**
 * The Radiology screen (hospital-wide). Stub from the pre-wiring; a screen builder replaces it.
 */
import type { ReactNode } from 'react';
import { useT } from '../../i18n/use-t.ts';
import { EmptyState, PageHeader } from '../../ui/index.ts';
import './radiology.css';
import { messages } from './messages.ts';

export function RadiologyScreen(): ReactNode {
  const t = useT(messages);
  return (
    <div className="radiology-screen">
      <PageHeader icon="scan" title={t('title')} subtitle={t('subtitle')} />
      <EmptyState icon="scan" title={t('placeholder')} body={t('placeholderBody')} />
    </div>
  );
}
