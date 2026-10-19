/**
 * The Maternity & newborns screen (hospital-wide). Stub from the pre-wiring; a screen builder replaces it.
 */
import type { ReactNode } from 'react';
import { useT } from '../../i18n/use-t.ts';
import { EmptyState, PageHeader } from '../../ui/index.ts';
import './maternity.css';
import { messages } from './messages.ts';

export function MaternityScreen(): ReactNode {
  const t = useT(messages);
  return (
    <div className="maternity-screen">
      <PageHeader icon="users" title={t('title')} subtitle={t('subtitle')} />
      <EmptyState icon="users" title={t('placeholder')} body={t('placeholderBody')} />
    </div>
  );
}
