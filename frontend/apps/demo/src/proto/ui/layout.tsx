/**
 * Layout helpers: Card, PageHeader, Grid, Stack, Toolbar, Section.
 */
import type { ReactNode } from 'react';
import type { Tone } from '../data/types.ts';
import { Icon, type IconName } from './icons.tsx';

function cx(...parts: readonly (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

export { cx };

export interface CardProps {
  /** The card's heading (an h2 by default). */
  readonly title?: ReactNode;
  /** A line under the title. */
  readonly subtitle?: ReactNode;
  readonly icon?: IconName;
  /** Controls at the end of the header (buttons, a link). */
  readonly actions?: ReactNode;
  /** A coloured edge at the inline start: a status card (danger for critical, warning for cautions). */
  readonly tone?: Tone;
  /** Heading level of the title. */
  readonly headingLevel?: 2 | 3 | 4;
  /** Remove the body padding (for tables that run to the edge). */
  readonly flush?: boolean;
  readonly footer?: ReactNode;
  readonly className?: string;
  readonly children?: ReactNode;
}

export function Card({
  title,
  subtitle,
  icon,
  actions,
  tone,
  headingLevel = 2,
  flush = false,
  footer,
  className,
  children,
}: CardProps): ReactNode {
  const Heading = `h${String(headingLevel)}` as 'h2' | 'h3' | 'h4';
  const hasHeader = title !== undefined || actions !== undefined;
  return (
    <section className={cx('ui-card', tone !== undefined && `ui-card--${tone}`, className)}>
      {hasHeader ? (
        <header className="ui-card__header">
          <div className="ui-card__heading">
            {icon === undefined ? null : <Icon name={icon} className="ui-card__icon" />}
            <div>
              {title === undefined ? null : <Heading className="ui-card__title">{title}</Heading>}
              {subtitle === undefined ? null : <p className="ui-card__subtitle">{subtitle}</p>}
            </div>
          </div>
          {actions === undefined ? null : <div className="ui-card__actions">{actions}</div>}
        </header>
      ) : null}
      <div className={cx('ui-card__body', flush && 'ui-card__body--flush')}>{children}</div>
      {footer === undefined ? null : <footer className="ui-card__footer">{footer}</footer>}
    </section>
  );
}

export interface PageHeaderProps {
  /** The page's h1. */
  readonly title: ReactNode;
  readonly subtitle?: ReactNode;
  readonly icon?: IconName;
  /** Small text above the title (the area, a breadcrumb). */
  readonly eyebrow?: ReactNode;
  /** Controls at the end (primary actions). */
  readonly actions?: ReactNode;
  /** Extra content under the title row (filters, tabs, summary badges). */
  readonly children?: ReactNode;
}

export function PageHeader({ title, subtitle, icon, eyebrow, actions, children }: PageHeaderProps): ReactNode {
  return (
    <header className="ui-page-header">
      <div className="ui-page-header__row">
        <div className="ui-page-header__titles">
          {eyebrow === undefined ? null : <p className="ui-page-header__eyebrow">{eyebrow}</p>}
          <h1 className="ui-page-header__title">
            {icon === undefined ? null : <Icon name={icon} className="ui-page-header__icon" />}
            <span>{title}</span>
          </h1>
          {subtitle === undefined ? null : <p className="ui-page-header__subtitle">{subtitle}</p>}
        </div>
        {actions === undefined ? null : <div className="ui-page-header__actions">{actions}</div>}
      </div>
      {children === undefined ? null : <div className="ui-page-header__extra">{children}</div>}
    </header>
  );
}

export interface GridProps {
  /** Minimum column width; columns fill the row (`auto-fill`). Default 16rem. */
  readonly min?: string;
  readonly gap?: 'sm' | 'md' | 'lg';
  readonly className?: string;
  readonly children?: ReactNode;
}

/** A responsive grid of equal columns, each at least `min` wide. */
export function Grid({ min = '16rem', gap = 'md', className, children }: GridProps): ReactNode {
  return (
    <div className={cx('ui-grid', `ui-grid--${gap}`, className)} style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(${min}, 100%), 1fr))` }}>
      {children}
    </div>
  );
}

export interface StackProps {
  readonly direction?: 'column' | 'row';
  readonly gap?: 'xs' | 'sm' | 'md' | 'lg';
  readonly align?: 'start' | 'center' | 'end' | 'stretch';
  readonly justify?: 'start' | 'center' | 'end' | 'between';
  readonly wrap?: boolean;
  readonly className?: string;
  readonly children?: ReactNode;
}

/** A flex column (default) or row with token gaps. */
export function Stack({ direction = 'column', gap = 'md', align, justify, wrap = false, className, children }: StackProps): ReactNode {
  return (
    <div
      className={cx(
        'ui-stack',
        `ui-stack--${direction}`,
        `ui-stack--gap-${gap}`,
        align !== undefined && `ui-stack--align-${align}`,
        justify !== undefined && `ui-stack--justify-${justify}`,
        wrap && 'ui-stack--wrap',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** A row of controls that wraps: filters, buttons. */
export function Toolbar({ children, className, label }: { readonly children?: ReactNode; readonly className?: string; readonly label?: string }): ReactNode {
  return (
    <div className={cx('ui-toolbar', className)} role="group" {...(label === undefined ? {} : { 'aria-label': label })}>
      {children}
    </div>
  );
}

/** A plain section with an h2 and optional actions, without the card frame. */
export function Section({
  title,
  actions,
  children,
  className,
}: {
  readonly title: ReactNode;
  readonly actions?: ReactNode;
  readonly children?: ReactNode;
  readonly className?: string;
}): ReactNode {
  return (
    <section className={cx('ui-section', className)}>
      <div className="ui-section__header">
        <h2 className="ui-section__title">{title}</h2>
        {actions === undefined ? null : <div className="ui-section__actions">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
