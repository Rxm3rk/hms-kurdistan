/**
 * Test harness for the command palette (slice S5b). The patients are synthetic (§18.10; NOT FOR CLINICAL
 * USE); the commands are the WP-0.7 kinds: navigation, density and language.
 */
import { render, screen, type RenderResult } from '@testing-library/react';
import type { ReactNode } from 'react';
import { vi, type Mock } from 'vitest';
import { LocaleProvider, type ModalStackGuard } from '../../src/index.ts';
import {
  CommandPalette,
  languageCommands,
  type PaletteCommand,
  type PaletteItem,
  type PalettePatient,
} from '../../src/command-palette/index.ts';
import { createModalStackGuard, ModalStackTestProvider } from '../../src/testing.tsx';
import { banner, text } from '../sign/harness.tsx';

export { banner, text };

export interface Fixture {
  readonly items: PaletteItem[];
  readonly runs: Record<string, Mock<() => void>>;
}

function command(id: string, group: PaletteCommand['group'], label: PaletteCommand['label'], run: () => void): PaletteCommand {
  return { kind: 'command', id, group, label, run };
}

function patient(id: string, names: Parameters<typeof banner>[1], open: () => void): PalettePatient {
  return { kind: 'patient', id, banner: banner(id, names), open };
}

/** Two navigation commands, two patients and two settings commands, each with its own spy. */
export function fixture(): Fixture {
  const runs: Record<string, Mock<() => void>> = {
    'nav.demo': vi.fn(),
    'nav.none': vi.fn(),
    'SYN-PAT-0001': vi.fn(),
    'SYN-PAT-0002': vi.fn(),
    'settings.language.ckb': vi.fn(),
    'settings.language.ar': vi.fn(),
  };
  const run = (id: string) => () => {
    runs[id]?.();
  };
  const setLocale = (locale: string): void => {
    runs[`settings.language.${locale}`]?.();
  };
  return {
    runs,
    items: [
      command('nav.demo', 'navigation', 'demo.banner.title', run('nav.demo')),
      command('nav.none', 'navigation', 'patientContext.none', run('nav.none')),
      patient('SYN-PAT-0001', { latin: 'Hêmin Azad Omer Kerîm', ckb: 'هێمن ئازاد عومەر کەریم' }, run('SYN-PAT-0001')),
      patient('SYN-PAT-0002', { latin: 'Rêbaz Azad Omer Kerîm', ckb: 'ڕێباز ئازاد عومەر کەریم' }, run('SYN-PAT-0002')),
      ...languageCommands('en', ['en', 'ckb', 'ar'], setLocale),
    ],
  };
}

export function PaletteHarness({
  guard,
  items,
  children,
}: {
  readonly guard: ModalStackGuard;
  readonly items: readonly PaletteItem[];
  readonly children?: ReactNode;
}): ReactNode {
  return (
    <LocaleProvider locale="en">
      <ModalStackTestProvider guard={guard}>
        <CommandPalette items={items} />
        {children}
      </ModalStackTestProvider>
    </LocaleProvider>
  );
}

export function renderPalette(
  items: readonly PaletteItem[],
  guard: ModalStackGuard = createModalStackGuard(),
): RenderResult & { readonly guard: ModalStackGuard } {
  return Object.assign(render(<PaletteHarness guard={guard} items={items} />), { guard });
}

export const paletteDialog = (): HTMLElement | null =>
  screen.queryByRole('dialog', { name: text('commandPalette.dialog.label') });

export const searchField = (): HTMLElement =>
  screen.getByRole('textbox', { name: text('commandPalette.search.label') });

/** The result items (React Aria also gives the "No matching commands" state the menuitem role). */
export const menuItems = (): HTMLElement[] =>
  screen.queryAllByRole('menuitem').filter((item) => item.hasAttribute('data-key'));

/** The highlighted item, if any: React Aria marks it `data-focused` and names it as the field's descendant. */
export function highlighted(): { readonly items: HTMLElement[]; readonly activeDescendant: string | null } {
  return {
    items: menuItems().filter((item) => item.hasAttribute('data-focused')),
    activeDescendant: searchField().getAttribute('aria-activedescendant'),
  };
}

export const NOTHING_HIGHLIGHTED = { items: [], activeDescendant: null };
