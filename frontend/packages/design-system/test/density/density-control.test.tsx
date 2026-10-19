/**
 * The density setting (docs/specs/modules/design-system.md §2.5; BUILD-PROMPT.md §6.5 "Density modes"):
 * the radio group switches between comfortable and compact from the keyboard and sets data-density on
 * <html>; the palette's "Change density" command switches to the other mode and names it.
 *
 * Targets of at least 24 × 24 px in compact density are checked in a real browser (E2E:targets-24px, S7);
 * jsdom has no layout.
 */
import { CATALOGUES } from '@hms/i18n';
import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { DensityProvider, LocaleProvider } from '../../src/index.ts';
import { CommandPalette } from '../../src/command-palette/index.ts';
import { DensityControl, otherDensity, useDensityCommand } from '../../src/density/index.ts';
import { createModalStackGuard, ModalStackTestProvider } from '../../src/testing.tsx';

const en = CATALOGUES.en;
const html = (): HTMLElement => document.documentElement;

function PaletteWithDensity(): ReactNode {
  const command = useDensityCommand();
  return <CommandPalette items={[command]} />;
}

function App(): ReactNode {
  return (
    <LocaleProvider locale="en">
      <ModalStackTestProvider guard={createModalStackGuard()}>
        <DensityProvider userKey="staff-synthetic">
          <DensityControl />
          <PaletteWithDensity />
        </DensityProvider>
      </ModalStackTestProvider>
    </LocaleProvider>
  );
}

afterEach(() => {
  delete html().dataset.density;
  localStorage.clear();
});

describe('density-control', () => {
  it('is a labelled radio group with both modes, comfortable chosen by default', () => {
    render(<App />);
    const group = screen.getByRole('radiogroup', { name: en['density.label'] });
    expect(within(group).getByRole('radio', { name: en['density.comfortable'] })).toBeChecked();
    expect(within(group).getByRole('radio', { name: en['density.compact'] })).not.toBeChecked();
    expect(html()).toHaveAttribute('data-density', 'comfortable');
  });

  it('switches density from the keyboard', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.tab();
    expect(screen.getByRole('radio', { name: en['density.comfortable'] })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: en['density.compact'] })).toBeChecked();
    expect(html()).toHaveAttribute('data-density', 'compact');
  });

  it('the palette command switches to the other mode and names it', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.keyboard('{Control>}k{/Control}');
    const item = await screen.findByRole('menuitem', { name: /Change density/ });
    expect(item).toHaveTextContent(en['density.compact']);
    await user.keyboard('{ArrowDown}{Enter}');
    await waitFor(() => {
      expect(html()).toHaveAttribute('data-density', 'compact');
    });
    expect(screen.getByRole('radio', { name: en['density.compact'] })).toBeChecked();
  });

  it('names the other mode', () => {
    expect(otherDensity('comfortable')).toBe('compact');
    expect(otherDensity('compact')).toBe('comfortable');
  });
});
