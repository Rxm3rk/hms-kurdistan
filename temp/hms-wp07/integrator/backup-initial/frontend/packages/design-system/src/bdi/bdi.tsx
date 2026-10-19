/**
 * `Bdi`: bidi isolation for a value of unknown direction (BUILD-PROMPT.md §6.5, §14.7, §18.9 "Bidi";
 * docs/specs/modules/design-system.md §2.7).
 *
 * Renders `<bdi>` with `unicode-bidi: isolate`, an explicit `dir` and the value's `lang` where known:
 * `ltr` for MRNs, numbers with units, dates, drug names and Latin names; `rtl` for Sorani and Arabic names;
 * `auto` only for free text of unknown direction. Message placeholders that carry such values are filled
 * with `Bdi` elements, never with bare strings, so a Sorani name beside a Latin MRN and a weight in kilograms
 * keeps each part in order in every locale.
 */
import type { CSSProperties, ReactNode } from 'react';

export type BdiDirection = 'ltr' | 'rtl' | 'auto';

export interface BdiProps {
  /** Required: a value's direction is always stated, never inherited from the surrounding text. */
  readonly dir: BdiDirection;
  /** The value's language, for example `ckb`, `ar` or `ckb-Latn`, where known. */
  readonly lang?: string;
  readonly className?: string;
  readonly children?: ReactNode;
}

// Inline as well as in base.css, so the isolation holds even where the stylesheet is not loaded.
const ISOLATE: CSSProperties = { unicodeBidi: 'isolate' };

export function Bdi({ dir, lang, className, children }: BdiProps): ReactNode {
  return (
    <bdi
      dir={dir}
      lang={lang}
      className={className === undefined ? 'hms-bdi' : `hms-bdi ${className}`}
      style={ISOLATE}
    >
      {children}
    </bdi>
  );
}
