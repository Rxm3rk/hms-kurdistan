/**
 * The density setting (BUILD-PROMPT.md §6.5 "Density modes"; docs/specs/modules/design-system.md §2.5).
 *
 * `DensityControl` is a React Aria radio group, "Density": Comfortable or Compact. It reads and sets the
 * density of the nearest `DensityProvider`, which sets `data-density` on `<html>` and stores the choice per
 * user on the device. `useDensityCommand` gives the command palette's "Change density" command, which
 * switches to the other mode and names it.
 *
 * Targets stay at least 24 × 24 CSS px in both modes (--hms-target-min-size; E2E targets-24px) and text
 * contrast at least 4.5:1 (tokens-contrast).
 */
import type { MessageKey } from '@hms/i18n';
import type { ReactNode } from 'react';
import { Label, RadioButton, RadioField, RadioGroup } from 'react-aria-components';
import type { PaletteCommand } from '../command-palette/commands.ts';
import { Message } from '../message/message.tsx';
import { DENSITIES, isDensity, useDensity, type Density } from '../providers/density-provider.tsx';

export const DENSITY_LABEL: Readonly<Record<Density, MessageKey>> = {
  comfortable: 'density.comfortable',
  compact: 'density.compact',
};

export function DensityControl(): ReactNode {
  const { density, setDensity } = useDensity();
  return (
    <RadioGroup
      className="hms-density-control"
      orientation="horizontal"
      value={density}
      onChange={(value) => {
        if (isDensity(value)) {
          setDensity(value);
        }
      }}
    >
      <Label className="hms-density-control__label">
        <Message id="density.label" />
      </Label>
      <div className="hms-density-control__options">
        {DENSITIES.map((option) => (
          <RadioField key={option} value={option} className="hms-density-control__field">
            <RadioButton className="hms-density-control__option">
              <Message id={DENSITY_LABEL[option]} />
            </RadioButton>
          </RadioField>
        ))}
      </div>
    </RadioGroup>
  );
}

/** The other density mode. */
export function otherDensity(density: Density): Density {
  return density === 'compact' ? 'comfortable' : 'compact';
}

/** The palette's "Change density" command: switches to the other mode, which it shows as its detail. */
export function useDensityCommand(): PaletteCommand {
  const { density, setDensity } = useDensity();
  const next = otherDensity(density);
  return {
    kind: 'command',
    id: 'settings.density',
    group: 'settings',
    label: 'commandPalette.command.changeDensity',
    detail: { key: DENSITY_LABEL[next] },
    run: () => {
      setDensity(next);
    },
  };
}
