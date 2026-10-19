/**
 * EmptyState (nothing to show, with a next step) and Callout (an inline message in a tone: a critical result,
 * an allergy conflict, a hint).
 */
import type { ReactNode } from 'react';
import type { Tone } from '../data/types.ts';
import { Icon, type IconName } from './icons.tsx';

export interface EmptyStateProps {
  readonly title: ReactNode;
  readonly body?: ReactNode;
  readonly icon?: IconName | undefined;
  /** A button or link: what to do next. */
  readonly action?: ReactNode;
  readonly compact?: boolean;
}

export function EmptyState({ title, body, icon = 'info', action, compact = false }: EmptyStateProps): ReactNode {
  return (
    <div className={compact ? 'ui-empty ui-empty--compact' : 'ui-empty'}>
      <Icon name={icon} size="2rem" className="ui-empty__icon" />
      <p className="ui-empty__title">{title}</p>
      {body === undefined ? null : <p className="ui-empty__body">{body}</p>}
      {action === undefined ? null : <div className="ui-empty__action">{action}</div>}
    </div>
  );
}

const TONE_ICON: Readonly<Record<Tone, IconName>> = {
  neutral: 'info',
  info: 'info',
  accent: 'info',
  success: 'check-circle',
  warning: 'alert',
  danger: 'alert',
};

export interface CalloutProps {
  readonly tone?: Tone | undefined;
  readonly title?: ReactNode | undefined;
  readonly icon?: IconName | undefined;
  /** Buttons at the end (Acknowledge, Review). */
  readonly actions?: ReactNode | undefined;
  /** `alert` announces it at once (use for critical, unacknowledged results only). */
  readonly role?: 'status' | 'alert' | 'note';
  readonly className?: string | undefined;
  readonly children?: ReactNode;
}

export function Callout({ tone = 'info', title, icon, actions, role = 'note', className, children }: CalloutProps): ReactNode {
  return (
    <div className={['ui-callout', `ui-callout--${tone}`, className ?? ''].filter(Boolean).join(' ')} role={role}>
      <Icon name={icon ?? TONE_ICON[tone]} className="ui-callout__icon" />
      <div className="ui-callout__content">
        {title === undefined ? null : <p className="ui-callout__title">{title}</p>}
        {children === undefined ? null : <div className="ui-callout__body">{children}</div>}
      </div>
      {actions === undefined ? null : <div className="ui-callout__actions">{actions}</div>}
    </div>
  );
}
