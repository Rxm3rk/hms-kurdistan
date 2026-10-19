/**
 * Buttons on React Aria: Button (an action), LinkButton (navigation that looks like a button) and IconButton
 * (an icon with an accessible label). Variants: primary (one per area), secondary, ghost, danger.
 */
import type { ReactNode } from 'react';
import { Button as AriaButton, Link as AriaLink } from 'react-aria-components';
import { Icon, type IconName } from './icons.tsx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

function classes(variant: ButtonVariant, size: ButtonSize, extra: string | undefined, iconOnly = false): string {
  return ['ui-button', `ui-button--${variant}`, `ui-button--${size}`, iconOnly ? 'ui-button--icon-only' : '', extra ?? '']
    .filter(Boolean)
    .join(' ');
}

export interface ButtonProps {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly icon?: IconName;
  /** An icon after the text (for example `chevron-forward`, mirrored in RTL). */
  readonly iconEnd?: IconName;
  readonly onPress?: () => void;
  readonly isDisabled?: boolean;
  readonly type?: 'button' | 'submit' | 'reset';
  readonly 'aria-label'?: string;
  readonly 'aria-describedby'?: string;
  readonly className?: string | undefined;
  readonly children?: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconEnd,
  onPress,
  isDisabled = false,
  type = 'button',
  className,
  children,
  ...aria
}: ButtonProps): ReactNode {
  return (
    <AriaButton
      className={classes(variant, size, className)}
      type={type}
      isDisabled={isDisabled}
      {...(onPress === undefined ? {} : { onPress })}
      {...aria}
    >
      {icon === undefined ? null : <Icon name={icon} />}
      {children === undefined ? null : <span>{children}</span>}
      {iconEnd === undefined ? null : <Icon name={iconEnd} />}
    </AriaButton>
  );
}

export interface LinkButtonProps {
  /** An app address, from `useScreenHref()` (src/proto/shell), so locale and density are kept. */
  readonly href: string;
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly icon?: IconName;
  readonly iconEnd?: IconName;
  readonly 'aria-label'?: string;
  readonly className?: string | undefined;
  readonly children?: ReactNode;
}

export function LinkButton({ href, variant = 'secondary', size = 'md', icon, iconEnd, className, children, ...aria }: LinkButtonProps): ReactNode {
  return (
    <AriaLink className={classes(variant, size, className)} href={href} {...aria}>
      {icon === undefined ? null : <Icon name={icon} />}
      {children === undefined ? null : <span>{children}</span>}
      {iconEnd === undefined ? null : <Icon name={iconEnd} />}
    </AriaLink>
  );
}

export interface IconButtonProps {
  readonly icon: IconName;
  /** Required: the button's accessible name (from your messages). */
  readonly label: string;
  readonly onPress?: () => void;
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly isDisabled?: boolean;
  readonly className?: string | undefined;
}

export function IconButton({ icon, label, onPress, variant = 'ghost', size = 'md', isDisabled = false, className }: IconButtonProps): ReactNode {
  return (
    <AriaButton
      className={classes(variant, size, className, true)}
      aria-label={label}
      isDisabled={isDisabled}
      {...(onPress === undefined ? {} : { onPress })}
    >
      <Icon name={icon} />
    </AriaButton>
  );
}

/** A plain text link inside the app (RAC Link, navigates without a reload). */
export function TextLink({ href, children, className }: { readonly href: string; readonly children: ReactNode; readonly className?: string | undefined }): ReactNode {
  return (
    <AriaLink className={['ui-link', className ?? ''].filter(Boolean).join(' ')} href={href}>
      {children}
    </AriaLink>
  );
}
