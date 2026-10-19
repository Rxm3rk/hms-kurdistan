/**
 * UnitTest:palette-never-preselects-patient (docs/specs/modules/design-system.md §2.4, §9; BUILD-PROMPT.md
 * §6.5 "defaults never select a patient"): nothing is highlighted on open or on new results; Enter with
 * nothing highlighted does nothing.
 *
 * "New results" covers both kinds of change: the user typing, and the result list changing under the user
 * (results arriving while the palette is open). A highlight is never carried onto another result list, even
 * when the highlighted item is still in it, and even when only one result is left.
 */
import { waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { foldForSearch, matchesQuery, type PaletteItem } from '../../src/command-palette/index.ts';
import {
  banner,
  fixture,
  highlighted,
  menuItems,
  NOTHING_HIGHLIGHTED,
  paletteDialog,
  PaletteHarness,
  renderPalette,
  searchField,
} from './harness.tsx';

type User = ReturnType<typeof userEvent.setup>;

/**
 * Types forward as a browser does: each character is preceded by a `beforeinput` event of type
 * `insertText`, which is what React Aria's "focus the first item while typing" reacts to (jsdom and
 * user-event do not set inputType themselves).
 */
async function typeForward(user: User, text: string): Promise<void> {
  for (const character of text) {
    searchField().dispatchEvent(
      new InputEvent('beforeinput', { inputType: 'insertText', data: character, bubbles: true }),
    );
    await user.keyboard(character);
  }
}

async function open(user: User): Promise<void> {
  await user.keyboard('{Control>}k{/Control}');
  await waitFor(() => {
    expect(paletteDialog()).not.toBeNull();
  });
}

describe('palette-never-preselects-patient', () => {
  it('highlights nothing when it opens', async () => {
    const user = userEvent.setup();
    renderPalette(fixture().items);
    await open(user);
    expect(menuItems().length).toBeGreaterThan(0);
    expect(highlighted()).toEqual(NOTHING_HIGHLIGHTED);
    // Typing that leaves the list as it was (a space) highlights nothing either.
    await typeForward(user, ' ');
    expect(menuItems()).toHaveLength(6);
    expect(highlighted()).toEqual(NOTHING_HIGHLIGHTED);
  });

  it('highlights nothing when typing leaves a single patient, and Enter then does nothing', async () => {
    const user = userEvent.setup();
    const { items, runs } = fixture();
    renderPalette(items);
    await open(user);
    // The two synthetic patients differ only in the first name.
    await typeForward(user, 'Rêbaz');
    expect(menuItems()).toHaveLength(1);
    expect(menuItems()[0]).toHaveAttribute('data-kind', 'patient');
    expect(highlighted()).toEqual(NOTHING_HIGHLIGHTED);
    // More typing that leaves the same single result still highlights nothing.
    await typeForward(user, ' Az');
    expect(menuItems()).toHaveLength(1);
    expect(highlighted()).toEqual(NOTHING_HIGHLIGHTED);

    await user.keyboard('{Enter}');
    expect(paletteDialog()).not.toBeNull();
    for (const spy of Object.values(runs)) {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it('drops the highlight when typing changes the results', async () => {
    const user = userEvent.setup();
    const { items, runs } = fixture();
    renderPalette(items);
    await open(user);
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(highlighted().items).toHaveLength(1);
    // Narrow to the patients: the highlighted patient is still listed, but no longer highlighted.
    await typeForward(user, 'Azad');
    expect(menuItems()).toHaveLength(2);
    expect(highlighted()).toEqual(NOTHING_HIGHLIGHTED);
    await user.keyboard('{Enter}');
    expect(paletteDialog()).not.toBeNull();
    expect(runs['SYN-PAT-0001']).not.toHaveBeenCalled();
    expect(runs['SYN-PAT-0002']).not.toHaveBeenCalled();
  });

  it('drops the highlight when the results change while the palette is open', async () => {
    const user = userEvent.setup();
    const { items, runs } = fixture();
    const view = renderPalette(items);
    await open(user);
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    const before = highlighted().items[0];
    expect(before).toHaveAttribute('data-kind', 'patient');

    // New results arrive: a third patient; the highlighted one is still in the list.
    const third: PaletteItem = {
      kind: 'patient',
      id: 'SYN-PAT-0003',
      banner: banner('SYN-PAT-0003', { latin: 'Soran Azad Omer Kerîm' }),
      open: () => {
        runs['SYN-PAT-0001']?.();
      },
    };
    view.rerender(<PaletteHarness guard={view.guard} items={[...items, third]} />);
    await waitFor(() => {
      expect(menuItems()).toHaveLength(items.length + 1);
    });
    expect(highlighted()).toEqual(NOTHING_HIGHLIGHTED);

    await user.keyboard('{Enter}');
    expect(paletteDialog()).not.toBeNull();
    for (const spy of Object.values(runs)) {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it('runs only what the user highlighted, once highlighted on purpose', async () => {
    const user = userEvent.setup();
    const { items, runs } = fixture();
    renderPalette(items);
    await open(user);
    await typeForward(user, 'Rêbaz');
    await user.keyboard('{ArrowDown}');
    expect(highlighted().items).toHaveLength(1);
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(runs['SYN-PAT-0002']).toHaveBeenCalledTimes(1);
    });
    expect(runs['SYN-PAT-0001']).not.toHaveBeenCalled();
  });

  it('finds a Sorani name typed with Arabic letter forms, for matching only', () => {
    // ی (U+06CC) is stored; ي (U+064A) is typed on an Arabic keyboard. The same for ک and ك.
    expect(matchesQuery('هێمن ئازاد عومەر کەریم', 'كەريم')).toBe(true);
    expect(foldForSearch('ي ك')).toBe('ی ک');
    expect(matchesQuery('Hêmin Azad', 'azad hêmin')).toBe(true);
    expect(matchesQuery('Hêmin Azad', 'rêbaz')).toBe(false);
  });
});
