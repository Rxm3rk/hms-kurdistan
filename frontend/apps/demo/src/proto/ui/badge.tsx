/**
 * Badge (alias Tag): a small status label in a tone. Colour only repeats the text: always give a text, and an
 * icon for safety states (allergy, critical, isolation).
 */
import type { ReactNode } from 'react';
import type { Tone } from '../data/types.ts';
import { Icon, type IconName } from './icons.tsx';

export interface BadgeProps {
  readonly tone?: Tone;
  readonly icon?: IconName;
  /** Filled (strong) instead of tinted: for the one thing on a screen that must be seen (critical). */
  readonly strong?: boolean;
  readonly size?: 'sm' | 'md';
  readonly className?: string;
  readonly children: ReactNode;
}

export function Badge({ tone = 'neutral', icon, strong = false, size = 'md', className, children }: BadgeProps): ReactNode {
  const classes = ['ui-badge', `ui-badge--${tone}`, strong ? 'ui-badge--strong' : '', `ui-badge--${size}`, className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <span className={classes}>
      {icon === undefined ? null : <Icon name={icon} size="1em" />}
      <span>{children}</span>
    </span>
  );
}

/** Same as Badge. */
export const Tag = Badge;

/** A small round dot in a tone, before a text (legends, bed states). Decorative. */
export function Dot({ tone = 'neutral' }: { readonly tone?: Tone }): ReactNode {
  return <span className={`ui-dot ui-dot--${tone}`} aria-hidden="true" />;
}
