/**
 * StatTile: one headline number with its label, an optional unit, hint and trend sparkline. Pressable when
 * given `href` (navigates) or `onPress`.
 */
import type { ReactNode } from 'react';
import { Button as AriaButton, Link as AriaLink } from 'react-aria-components';
import type { Tone } from '../data/types.ts';
import { Sparkline } from './charts.tsx';
import { Icon, type IconName } from './icons.tsx';

export interface StatTileProps {
  /** Sentence case, no colon: "Beds occupied". */
  readonly label: ReactNode;
  readonly value: ReactNode;
  readonly unit?: ReactNode | undefined;
  /** A line under the value: "of 56 beds", "+3 since yesterday". */
  readonly hint?: ReactNode | undefined;
  /** A state tone: a coloured edge and icon colour (danger for unacknowledged critical results). */
  readonly tone?: Tone | undefined;
  readonly icon?: IconName | undefined;
  readonly trend?: readonly number[];
  /** Accessible name of the trend, required with `trend`. */
  readonly trendLabel?: string | undefined;
  readonly href?: string;
  readonly onPress?: () => void;
  readonly className?: string | undefined;
}

export function StatTile({ label, value, unit, hint, tone, icon, trend, trendLabel, href, onPress, className }: StatTileProps): ReactNode {
  const classes = ['ui-stat', tone === undefined ? '' : `ui-stat--${tone}`, href !== undefined || onPress !== undefined ? 'ui-stat--action' : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  const body = (
    <>
      <span className="ui-stat__top">
        <span className="ui-stat__label">{label}</span>
        {icon === undefined ? null : <Icon name={icon} className="ui-stat__icon" />}
      </span>
      <span className="ui-stat__value-row">
        <span className="ui-stat__value">{value}</span>
        {unit === undefined ? null : <span className="ui-stat__unit">{unit}</span>}
      </span>
      {hint === undefined && trend === undefined ? null : (
        <span className="ui-stat__bottom">
          {hint === undefined ? <span /> : <span className="ui-stat__hint">{hint}</span>}
          {trend === undefined ? null : <Sparkline values={trend} label={trendLabel ?? ''} tone={tone === 'danger' || tone === 'warning' ? tone : 'accent'} width={96} height={28} />}
        </span>
      )}
    </>
  );
  if (href !== undefined) {
    return (
      <AriaLink className={classes} href={href}>
        {body}
      </AriaLink>
    );
  }
  if (onPress !== undefined) {
    return (
      <AriaButton className={classes} onPress={onPress}>
        {body}
      </AriaButton>
    );
  }
  return <div className={classes}>{body}</div>;
}
