/**
 * DensityProvider (docs/specs/modules/design-system.md §2.5): sets data-density on <html>, defaults to
 * comfortable, stores the choice per user on the device and ignores an unknown stored value.
 */
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { DensityProvider, densityStorageKey, loadDensity, useDensity } from '../src/index.ts';

function Toggle(): ReactNode {
  const { density, setDensity } = useDensity();
  return (
    <button
      type="button"
      data-testid="toggle"
      data-density-value={density}
      onClick={() => {
        setDensity(density === 'compact' ? 'comfortable' : 'compact');
      }}
    />
  );
}

const html = (): HTMLElement => document.documentElement;

afterEach(() => {
  delete html().dataset.density;
  localStorage.clear();
});

describe('DensityProvider', () => {
  it('sets data-density="comfortable" on <html> by default', () => {
    render(
      <DensityProvider>
        <Toggle />
      </DensityProvider>,
    );
    expect(html()).toHaveAttribute('data-density', 'comfortable');
  });

  it('switches to compact and back, and stores the choice per user', async () => {
    const user = userEvent.setup();
    const view = render(
      <DensityProvider userKey="staff-a">
        <Toggle />
      </DensityProvider>,
    );
    await user.click(screen.getByTestId('toggle'));
    expect(html()).toHaveAttribute('data-density', 'compact');
    expect(localStorage.getItem(densityStorageKey('staff-a'))).toBe('compact');
    expect(loadDensity('staff-a')).toBe('compact');

    // Another user at the same device gets their own density.
    view.rerender(
      <DensityProvider userKey="staff-b">
        <Toggle />
      </DensityProvider>,
    );
    expect(html()).toHaveAttribute('data-density', 'comfortable');
    view.rerender(
      <DensityProvider userKey="staff-a">
        <Toggle />
      </DensityProvider>,
    );
    expect(html()).toHaveAttribute('data-density', 'compact');
  });

  it('falls back to comfortable for an unknown stored value', () => {
    localStorage.setItem(densityStorageKey('staff-c'), 'tiny');
    render(
      <DensityProvider userKey="staff-c">
        <Toggle />
      </DensityProvider>,
    );
    expect(html()).toHaveAttribute('data-density', 'comfortable');
  });

  it('keeps the choice in memory only without a user key', async () => {
    const user = userEvent.setup();
    render(
      <DensityProvider>
        <Toggle />
      </DensityProvider>,
    );
    await user.click(screen.getByTestId('toggle'));
    expect(html()).toHaveAttribute('data-density', 'compact');
    expect(localStorage.length).toBe(0);
  });
});
