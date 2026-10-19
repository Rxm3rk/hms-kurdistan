/**
 * UnitTest:palette-selects-patient-via-confirmation (docs/specs/modules/design-system.md §2.4, §2.2, §9;
 * CTRL-0016-6): choosing another patient in the palette closes the palette first; the switch confirmation
 * opens only after it has closed, and never over it.
 *
 * The window's patient context is ui-core's real machine, with the window's modal stack guard as its modal
 * state, so a request made while the palette still held the guard would be refused with
 * `patientContext.switch.blockedByModal`. The switch confirmation here is a stand-in `Modal` that opens
 * while the machine is in `switch-pending-confirmation`.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { useSyncExternalStore, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { LocaleProvider, Message, Modal } from '../../src/index.ts';
import { CommandPalette, type PaletteItem } from '../../src/command-palette/index.ts';
import { ModalStackTestProvider } from '../../src/testing.tsx';
import { banner, NURSE, PATIENT_A, PATIENT_B, TestWindow, text, WINDOW_MS } from '../sign/harness.tsx';
import { paletteDialog } from './harness.tsx';

interface Observation {
  readonly guardHeld: boolean;
  readonly paletteInDocument: boolean;
  readonly dialogs: number;
  readonly messageKey: string | undefined;
  readonly outcome: string;
}

function App({
  window,
  observations,
}: {
  readonly window: TestWindow;
  readonly observations: Observation[];
}): ReactNode {
  const snapshot = useSyncExternalStore(window.subscribe, window.getSnapshot, window.getSnapshot);
  const items: PaletteItem[] = [PATIENT_A, PATIENT_B].map((patientId) => ({
    kind: 'patient',
    id: patientId,
    banner: banner(patientId),
    open: () => {
      const guardHeld = window.guard.isHeld();
      const paletteInDocument = paletteDialog() !== null;
      const dialogs = document.querySelectorAll('[role="dialog"]').length;
      const result = window.select(patientId, banner(patientId), NURSE);
      observations.push({
        guardHeld,
        paletteInDocument,
        dialogs,
        messageKey: result.messageKey,
        outcome: result.outcome,
      });
    },
  }));
  return (
    <LocaleProvider locale="en">
      <ModalStackTestProvider guard={window.guard}>
        <CommandPalette items={items} />
        <Modal
          isOpen={snapshot.state === 'switch-pending-confirmation'}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              window.send({ type: 'CancelSwitch' });
            }
          }}
          aria-label={text('patientContext.switch.title')}
        >
          <p>
            <Message id="patientContext.switch.body" />
          </p>
        </Modal>
      </ModalStackTestProvider>
    </LocaleProvider>
  );
}

describe('palette-selects-patient-via-confirmation', () => {
  it('closes the palette first; the confirmation opens after it has closed, never over it', async () => {
    const user = userEvent.setup();
    const window = TestWindow.holding(PATIENT_A, WINDOW_MS * 2);
    const observations: Observation[] = [];
    render(<App window={window} observations={observations} />);

    await user.keyboard('{Control>}k{/Control}');
    await waitFor(() => {
      expect(paletteDialog()).not.toBeNull();
    });
    await user.keyboard('100232');
    await user.keyboard('{ArrowDown}{Enter}');

    await waitFor(() => {
      expect(observations).toHaveLength(1);
    });
    // When the patient was requested, the palette had gone and no modal was open.
    expect(observations[0]).toEqual({
      guardHeld: false,
      paletteInDocument: false,
      dialogs: 0,
      messageKey: undefined,
      outcome: 'transitioned',
    });
    expect(window.snapshot.state).toBe('switch-pending-confirmation');
    // The current patient stays until the switch is confirmed.
    expect(window.snapshot.patient?.patientId).toBe(PATIENT_A);
    expect(window.snapshot.requested?.patientId).toBe(PATIENT_B);

    const confirmation = await screen.findByRole('dialog', { name: text('patientContext.switch.title') });
    expect(confirmation).toBeVisible();
    expect(paletteDialog()).toBeNull();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('choosing the patient already open changes nothing and opens no confirmation', async () => {
    const user = userEvent.setup();
    const window = TestWindow.holding(PATIENT_A, WINDOW_MS * 2);
    const observations: Observation[] = [];
    render(<App window={window} observations={observations} />);
    const versionBefore = window.snapshot.lastChange.version;

    await user.keyboard('{Control>}k{/Control}');
    await waitFor(() => {
      expect(paletteDialog()).not.toBeNull();
    });
    await user.keyboard('100231');
    await user.keyboard('{ArrowDown}{Enter}');
    await waitFor(() => {
      expect(observations).toHaveLength(1);
    });
    expect(window.snapshot.state).toBe('patient-selected');
    expect(window.snapshot.lastChange.version).toBe(versionBefore);
    expect(screen.queryAllByRole('dialog')).toHaveLength(0);
  });
});
