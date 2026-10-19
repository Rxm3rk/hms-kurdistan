/**
 * UnitTest:palette-keyboard-only (docs/specs/modules/design-system.md §2.4, §9; BUILD-PROMPT.md §6.5,
 * §14.2 "keyboard-first"): every palette command can be found and run from the keyboard alone.
 *
 * Ctrl+K (Cmd+K on Apple platforms, on the physical K key) opens the palette with focus in the search
 * field; typing filters; the arrow keys move; Enter runs the highlighted item; Escape closes. No step of
 * this test uses a pointer.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Modal } from '../../src/index.ts';
import { isPaletteShortcut } from '../../src/command-palette/index.ts';
import { createModalStackGuard } from '../../src/testing.tsx';
import {
  fixture,
  highlighted,
  menuItems,
  paletteDialog,
  PaletteHarness,
  renderPalette,
  searchField,
  text,
} from './harness.tsx';

type User = ReturnType<typeof userEvent.setup>;

const openPalette = (): HTMLElement =>
  screen.getByRole('dialog', { name: text('commandPalette.dialog.label') });

async function openWithShortcut(user: User): Promise<void> {
  await user.keyboard('{Control>}k{/Control}');
  await waitFor(() => {
    expect(paletteDialog()).not.toBeNull();
  });
}

describe('palette-keyboard-only', () => {
  it('opens with Ctrl+K, with focus in the search field', async () => {
    const user = userEvent.setup();
    renderPalette(fixture().items);
    expect(paletteDialog()).toBeNull();
    await openWithShortcut(user);
    expect(searchField()).toHaveFocus();
    expect(screen.getByText(text('commandPalette.hint'))).toBeVisible();
  });

  it('lists every item, grouped in display order: navigation, patients, settings', async () => {
    const user = userEvent.setup();
    const { items } = fixture();
    renderPalette(items);
    await openWithShortcut(user);
    expect(menuItems().map((item) => item.dataset.key)).toEqual([
      'nav.demo',
      'nav.none',
      'SYN-PAT-0001',
      'SYN-PAT-0002',
      'settings.language.ckb',
      'settings.language.ar',
    ]);
  });

  // One test per item, each from a fresh palette, so that no single test opens the palette many times.
  it.each(fixture().items.map((item, index) => [item.id, index] as const))(
    'reaches and runs %s with the arrow keys and Enter',
    async (id, index) => {
      const user = userEvent.setup();
      const { items, runs } = fixture();
      renderPalette(items);
      await openWithShortcut(user);
      await user.keyboard('{ArrowDown}'.repeat(index + 1));
      const current = highlighted();
      expect(current.items).toHaveLength(1);
      expect(current.items[0]?.dataset.key).toBe(id);
      expect(menuItems().findIndex((item) => current.items.includes(item))).toBe(index);
      await user.keyboard('{Enter}');
      await waitFor(() => {
        expect(paletteDialog()).toBeNull();
      });
      for (const [runId, spy] of Object.entries(runs)) {
        expect(spy, runId).toHaveBeenCalledTimes(runId === id ? 1 : 0);
      }
    },
  );

  it('finds a command by typing, then runs it from the keyboard', async () => {
    const user = userEvent.setup();
    const { items, runs } = fixture();
    renderPalette(items);
    await openWithShortcut(user);
    await user.keyboard(text('language.ar.endonym'));
    expect(menuItems()).toHaveLength(1);
    await user.keyboard('{ArrowDown}{Enter}');
    await waitFor(() => {
      expect(runs['settings.language.ar']).toHaveBeenCalledTimes(1);
    });
    expect(runs['settings.language.ckb']).not.toHaveBeenCalled();
  });

  it('closes with Escape, runs nothing and returns focus to the palette button', async () => {
    const user = userEvent.setup();
    const { items, runs } = fixture();
    renderPalette(items);
    await user.tab();
    const trigger = screen.getByRole('button', { name: text('commandPalette.open.label') });
    expect(trigger).toHaveFocus();
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(paletteDialog()).not.toBeNull();
    });
    await user.keyboard('{ArrowDown}{Escape}');
    await waitFor(() => {
      expect(paletteDialog()).toBeNull();
    });
    for (const spy of Object.values(runs)) {
      expect(spy).not.toHaveBeenCalled();
    }
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  it('announces how many results there are, and says when nothing matches', async () => {
    const user = userEvent.setup();
    renderPalette(fixture().items);
    await openWithShortcut(user);
    expect(within(openPalette()).getByRole('status')).toHaveTextContent('6 results');
    await user.keyboard('zzzz-no-such-command');
    expect(screen.getByText(text('commandPalette.noResults'))).toBeVisible();
    expect(within(openPalette()).getByRole('status')).toHaveTextContent('0 results');
  });

  it('recognises Ctrl+K (Cmd+K on Apple) on the physical K key, in any keyboard layout', () => {
    const key = (init: KeyboardEventInit): KeyboardEvent => new KeyboardEvent('keydown', init);
    expect(isPaletteShortcut(key({ key: 'k', code: 'KeyK', ctrlKey: true }), false)).toBe(true);
    // An Arabic or Sorani layout reports another character for the same key.
    expect(isPaletteShortcut(key({ key: 'ن', code: 'KeyK', ctrlKey: true }), false)).toBe(true);
    expect(isPaletteShortcut(key({ key: 'k', code: 'KeyK', metaKey: true }), true)).toBe(true);
    expect(isPaletteShortcut(key({ key: 'k', code: 'KeyK', metaKey: true }), false)).toBe(false);
    expect(isPaletteShortcut(key({ key: 'k', code: 'KeyK', ctrlKey: true, shiftKey: true }), false)).toBe(false);
    expect(isPaletteShortcut(key({ key: 'k', code: 'KeyK' }), false)).toBe(false);
    expect(isPaletteShortcut(key({ key: 'j', code: 'KeyJ', ctrlKey: true }), false)).toBe(false);
  });

  it('opens from the physical key on a right-to-left layout', async () => {
    renderPalette(fixture().items);
    fireEvent.keyDown(window, { key: 'ن', code: 'KeyK', ctrlKey: true });
    await waitFor(() => {
      expect(paletteDialog()).not.toBeNull();
    });
  });

  it('does nothing on Ctrl+K while another dialog is open (no stacked modals)', async () => {
    const user = userEvent.setup();
    const guard = createModalStackGuard();
    render(
      <PaletteHarness guard={guard} items={fixture().items}>
        <Modal isOpen onOpenChange={() => undefined} aria-label={text('sign.title')}>
          <p>{text('sign.review.heading')}</p>
        </Modal>
      </PaletteHarness>,
    );
    expect(guard.isHeld()).toBe(true);
    await user.keyboard('{Control>}k{/Control}');
    expect(paletteDialog()).toBeNull();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });
});
