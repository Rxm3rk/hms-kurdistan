/**
 * The banner's status icons (docs/specs/modules/design-system.md §2.1 rule 2, §3 "Icons").
 *
 * Every status has its own text and its own icon shape, so colour only repeats what text and shape already
 * say (§6.5). The shapes are inline SVG drawn in `currentColor`, bundled with the code (no icon font, no
 * network). None of them carries a direction, so none is mirrored in right-to-left locales. Each icon is
 * decorative (`aria-hidden`): the status text beside it is what assistive technology reads, once [P]
 * (OQ-161). `data-icon` names the shape, so tests can tell the shapes apart.
 *
 * The first element of each drawing is its outline. Within one banner field no two statuses share an outline
 * (a circle, a dashed circle, a square, a wide card, or a polygon or curved outline of its own), so the
 * statuses differ by silhouette and not only by a small inner mark (UnitTest:colour-not-only-carrier reads
 * the outlines from the drawings). How they look at their real size is held by the E2E:visual baselines.
 */
import type { ReactNode } from 'react';

export const ICON_SHAPES = [
  'missing',
  'unavailable',
  'error',
  'identity-incomplete',
  'approximate',
  'none-known',
  'not-assessed',
  'allergy',
  'none-recorded',
  'documented',
  'isolation',
  'untranslated',
] as const;

export type IconShape = (typeof ICON_SHAPES)[number];

/** Each shape on a 16 × 16 grid. */
const PATHS: Readonly<Record<IconShape, ReactNode>> = {
  // A dashed circle: nothing is recorded here.
  missing: <circle cx="8" cy="8" r="6" strokeDasharray="2.4 2" />,
  // A triangle with an exclamation mark: the data could not be read.
  unavailable: (
    <>
      <path d="M8 1.75 14.75 14H1.25Z" />
      <path d="M8 6v3.75" />
      <circle cx="8" cy="11.9" r="0.4" fill="currentColor" />
    </>
  ),
  // An octagon with a cross: the banner's error state.
  error: (
    <>
      <path d="M5.2 1.25h5.6l3.95 3.95v5.6l-3.95 3.95H5.2l-3.95-3.95V5.2Z" />
      <path d="m5.75 5.75 4.5 4.5m0-4.5-4.5 4.5" />
    </>
  ),
  // An identity card with an exclamation mark.
  'identity-incomplete': (
    <>
      <rect x="1.25" y="3" width="13.5" height="10" rx="1.25" />
      <path d="M8 5.5v3.5" />
      <circle cx="8" cy="11" r="0.4" fill="currentColor" />
    </>
  ),
  // A square with a tilde: approximately. Its outline differs from the date of birth's other statuses (a
  // dashed circle, a triangle).
  approximate: (
    <>
      <rect x="1.75" y="1.75" width="12.5" height="12.5" rx="1.5" />
      <path d="M4.5 8.75c1-2 2.25-2 3.5-.75s2.5 1.25 3.5-.75" />
    </>
  ),
  // An empty-set sign: none known.
  'none-known': (
    <>
      <circle cx="8" cy="8" r="5" />
      <path d="M3 13 13 3" />
    </>
  ),
  // A square with a question mark: not assessed. Its outline differs from NKA's circle, so "not assessed"
  // and "no known allergies" are never told apart by the inner mark alone.
  'not-assessed': (
    <>
      <rect x="1.75" y="1.75" width="12.5" height="12.5" rx="1.5" />
      <path d="M6.1 6.25a1.95 1.95 0 1 1 2.6 1.85c-.45.2-.7.55-.7 1.05v.4" />
      <circle cx="8" cy="11.4" r="0.4" fill="currentColor" />
    </>
  ),
  // A diamond with an exclamation mark: allergies are recorded.
  allergy: (
    <>
      <path d="M8 1.25 14.75 8 8 14.75 1.25 8Z" />
      <path d="M8 4.75v4" />
      <circle cx="8" cy="10.9" r="0.4" fill="currentColor" />
    </>
  ),
  // A circle with a bar: recorded as none.
  'none-recorded': (
    <>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M4.75 8h6.5" />
    </>
  ),
  // A document with lines: documented.
  documented: (
    <>
      <path d="M3.25 1.25h6.5l3 3v10.5h-9.5Z" />
      <path d="M5.5 7.25h5m-5 2.5h5m-5 2.5h3" />
    </>
  ),
  // A shield: isolation precautions are active.
  isolation: <path d="M8 1.25 13.75 3.5V8c0 3.25-2.5 5.75-5.75 6.75C4.75 13.75 2.25 11.25 2.25 8V3.5Z" />,
  // A globe: the label is in another language.
  untranslated: (
    <>
      <circle cx="8" cy="8" r="6.25" />
      <ellipse cx="8" cy="8" rx="2.75" ry="6.25" />
      <path d="M1.75 8h12.5" />
    </>
  ),
};

export interface StatusIconProps {
  readonly shape: IconShape;
}

export function StatusIcon({ shape }: StatusIconProps): ReactNode {
  return (
    <svg
      className="hms-banner-icon"
      data-icon={shape}
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[shape]}
    </svg>
  );
}
