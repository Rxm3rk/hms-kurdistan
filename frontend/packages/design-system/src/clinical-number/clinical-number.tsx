/**
 * `ClinicalNumber`: a clinical numeral, with its unit when it has one (BUILD-PROMPT.md §2.1 SI-05, §6.5;
 * docs/specs/modules/design-system.md §2.6; CTRL-0005-17).
 *
 * It takes a decimal string exactly as entered or as returned by a knowledge base, never a JavaScript number,
 * and renders the display form that `@hms/ui-core` computes (leading zero, no trailing zero, one form of
 * zero, U+202F grouping; Western digits in every locale). The component itself does no arithmetic and no
 * formatting of its own. The number and its unit sit together in one `<bdi dir="ltr">` with a no-break space
 * between them, so `0.5 mg` keeps its order inside right-to-left text.
 *
 * A malformed value, or a unit outside the display map, is shown as "Invalid value"
 * (`clinical.number.invalid`) and an absent value as "Not recorded" (`clinical.value.missing`): never
 * guessed, never the raw input, never empty.
 */
import {
  formatClinicalNumber,
  formatClinicalQuantity,
  SYNTHETIC_UNIT_DISPLAY_MAP,
  type UnitDisplayMap,
} from '@hms/ui-core';
import type { ReactNode } from 'react';
import { Bdi } from '../bdi/bdi.tsx';
import { Message } from '../message/message.tsx';

export interface ClinicalNumberProps {
  /** The decimal string as entered or returned (`-?[0-9]*(\.[0-9]+)?`); empty, null or undefined is missing. */
  readonly value: string | null | undefined;
  /** The UCUM unit code (`mg`, `ug`, `kg`), shown through the unit display map; omit for a bare numeral. */
  readonly unit?: string;
  /**
   * UCUM code → display form. The default is ui-core's synthetic sample, NOT FOR CLINICAL USE, until the
   * governed map exists (OQ-152; KA-036).
   */
  readonly unitDisplayMap?: UnitDisplayMap;
  readonly className?: string;
}

export function ClinicalNumber({
  value,
  unit,
  unitDisplayMap = SYNTHETIC_UNIT_DISPLAY_MAP,
  className,
}: ClinicalNumberProps): ReactNode {
  const display =
    unit === undefined ? formatClinicalNumber(value) : formatClinicalQuantity(value, unit, unitDisplayMap);
  const classes = (modifier: string): string =>
    ['hms-clinical-number', modifier, className]
      .filter((part) => part !== undefined && part !== '')
      .join(' ');

  switch (display.status) {
    case 'valid':
      return (
        <Bdi dir="ltr" className={classes('')}>
          {display.text}
        </Bdi>
      );
    case 'invalid':
      return (
        <span className={classes('hms-clinical-number--invalid')} data-status="invalid">
          <Message id="clinical.number.invalid" />
        </span>
      );
    case 'missing':
      return (
        <span className={classes('hms-clinical-number--missing')} data-status="missing">
          <Message id="clinical.value.missing" />
        </span>
      );
  }
}
