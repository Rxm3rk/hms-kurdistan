/**
 * Inline SVG icons drawn in `currentColor` on a 24 x 24 grid: bundled, no icon font, no network.
 * Icons are decorative (`aria-hidden`); put the meaning in text beside them or in the control's label.
 * Icons that point a way (`chevron-forward`, `chevron-back`, `arrow-forward`, `arrow-back`) are mirrored in
 * right-to-left locales by ui.css, so "forward" always points along the reading direction.
 */
import type { ReactNode } from 'react';

const PATHS = {
  home: <path d="M3.5 10.5 12 3.5l8.5 7V20a.5.5 0 0 1-.5.5h-5.25v-6h-5.5v6H4a.5.5 0 0 1-.5-.5Z" />,
  users: (
    <>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3 19.5c.4-3.3 2.9-5.5 6-5.5s5.6 2.2 6 5.5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16.5 14.1c2.4.1 4.1 1.9 4.5 4.6" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.75" />
      <path d="M4.5 20c.6-3.9 3.6-6.25 7.5-6.25S18.9 16.1 19.5 20" />
    </>
  ),
  stethoscope: (
    <>
      <path d="M6 3.5H4.75v5a4.25 4.25 0 0 0 8.5 0v-5H12" />
      <path d="M9 12.75v1.75a5 5 0 0 0 10 0v-2" />
      <circle cx="19" cy="10.25" r="2.25" />
    </>
  ),
  bed: (
    <>
      <path d="M3 6v13M3 15.5h18V19M21 15.5v-3a2.5 2.5 0 0 0-2.5-2.5H11v5.5" />
      <circle cx="7" cy="11.5" r="2" />
    </>
  ),
  chart: (
    <>
      <path d="M14 3.5H6.5a1 1 0 0 0-1 1v15a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V8Z" />
      <path d="M14 3.5V8h4.5M12 11v6M9 14h6" />
    </>
  ),
  clipboard: (
    <>
      <rect x="5" y="4.5" width="14" height="16" rx="1.25" />
      <path d="M9 4.5V3.5h6v1M8.5 10h7M8.5 13.5h7M8.5 17h4" />
    </>
  ),
  pill: (
    <>
      <rect x="2.75" y="8.25" width="18.5" height="7.5" rx="3.75" transform="rotate(-45 12 12)" />
      <path d="m8.9 8.9 6.2 6.2" />
    </>
  ),
  flask: (
    <>
      <path d="M9.5 3.5h5M10.25 3.5v5.75L4.6 18.4a1.4 1.4 0 0 0 1.2 2.1h12.4a1.4 1.4 0 0 0 1.2-2.1l-5.65-9.15V3.5" />
      <path d="M7.4 14h9.2" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3.5h12v17l-2-1.25-2 1.25-2-1.25-2 1.25-2-1.25-2 1.25Z" />
      <path d="M9 8h6M9 11.5h6M9 15h3.5" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9M4 12h4M12 12h8" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
      <circle cx="10" cy="12" r="2" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 5.5 5.5" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15Z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3.5 21.5 20h-19Z" />
      <path d="M12 9.5v4.5" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="7.75" r="0.6" fill="currentColor" />
    </>
  ),
  check: <path d="m4.5 12.5 4.75 4.75L19.5 7" />,
  'check-circle': (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8 12.25 2.75 2.75L16.25 9.5" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6 6 18" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="1.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  'chevron-forward': <path d="m9 5 7 7-7 7" />,
  'chevron-back': <path d="m15 5-7 7 7 7" />,
  'chevron-down': <path d="m5 9 7 7 7-7" />,
  'arrow-forward': <path d="M4 12h15M13 6l6 6-6 6" />,
  'arrow-back': <path d="M20 12H5M11 6l-6 6 6 6" />,
  heart: <path d="M12 20s-7.5-4.5-7.5-10A4.25 4.25 0 0 1 12 7.4 4.25 4.25 0 0 1 19.5 10c0 5.5-7.5 10-7.5 10Z" />,
  activity: <path d="M3 12h4l2.5-6 5 12 2.5-6H21" />,
  droplet: <path d="M12 3.5s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11Z" />,
  thermometer: (
    <>
      <path d="M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0Z" />
      <path d="M12 9v7" />
    </>
  ),
  printer: (
    <>
      <path d="M7 8.5V3.5h10v5M7 17H4.5v-7a1.5 1.5 0 0 1 1.5-1.5h12a1.5 1.5 0 0 1 1.5 1.5v7H17" />
      <rect x="7" y="14" width="10" height="6.5" />
    </>
  ),
  filter: <path d="M4 5h16l-6.25 7.5V19l-3.5 1.5v-8Z" />,
  more: (
    <>
      <circle cx="6" cy="12" r="1.25" fill="currentColor" />
      <circle cx="12" cy="12" r="1.25" fill="currentColor" />
      <circle cx="18" cy="12" r="1.25" fill="currentColor" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="1.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  pen: (
    <>
      <path d="M15.5 4.5 19.5 8.5 9 19H5v-4Z" />
      <path d="m13 7 4 4" />
    </>
  ),
  refresh: (
    <>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.5 4v4.5H15" />
    </>
  ),
  money: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="1.5" />
      <circle cx="12" cy="12" r="2.75" />
      <path d="M6 9.5v5M18 9.5v5" />
    </>
  ),
  phone: <path d="M7.5 3.5h-2a1.5 1.5 0 0 0-1.5 1.6C4.6 13.3 10.7 19.4 18.9 20a1.5 1.5 0 0 0 1.6-1.5v-2l-4-1.75-2 2a11 11 0 0 1-5.25-5.25l2-2Z" />,
  logout: (
    <>
      <path d="M14 4.5H5.5v15H14" />
      <path d="M10 12h10.5M17 8.5l3.5 3.5-3.5 3.5" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  shield: (
    <>
      <path d="M12 3.5 19.5 6v6c0 4.5-3.2 7.4-7.5 8.5C7.7 19.4 4.5 16.5 4.5 12V6Z" />
      <path d="m8.75 12 2.25 2.25 4.25-4.5" />
    </>
  ),
  isolation: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6 6l12 12" />
    </>
  ),
  scan: <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M7 9v6M10 9v6M13.5 9v6M17 9v6" />,
  building: (
    <>
      <path d="M4.5 20.5V5.5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v15M14.5 9.5h4a1 1 0 0 1 1 1v10M3 20.5h18" />
      <path d="M8 8h3M8 11.5h3M8 15h3" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

/** The icons that point a way; ui.css mirrors them in right-to-left locales. */
const DIRECTIONAL: ReadonlySet<IconName> = new Set(['chevron-forward', 'chevron-back', 'arrow-forward', 'arrow-back', 'logout']);

export interface IconProps {
  readonly name: IconName;
  /** CSS size; 1.25em by default (follows the text). */
  readonly size?: string;
  readonly className?: string;
}

export function Icon({ name, size, className }: IconProps): ReactNode {
  const classes = ['ui-icon', DIRECTIONAL.has(name) ? 'ui-icon--directional' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <svg
      className={classes}
      viewBox="0 0 24 24"
      width={size ?? '1.25em'}
      height={size ?? '1.25em'}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-icon={name}
    >
      {PATHS[name]}
    </svg>
  );
}
