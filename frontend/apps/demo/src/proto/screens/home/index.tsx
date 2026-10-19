/**
 * The home screen. Stub from the scaffold.
 */
import type { ReactNode } from 'react';
import { useT } from '../../i18n/use-t.ts';
import { EmptyState, PageHeader } from '../../ui/index.ts';
import './home.css';
import { messages } from './messages.ts';

export function HomeScreen(): ReactNode {
  const t = useT(messages);
  return (
    <div className="home-screen">
      <PageHeader icon="home" title={t('title')} subtitle={t('subtitle')} />
      <EmptyState icon="home" title={t('placeholder')} body={t('placeholderBody')} />
    </div>
  );
}
