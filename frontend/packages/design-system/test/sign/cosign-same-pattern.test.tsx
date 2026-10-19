/**
 * UnitTest:cosign-same-pattern (docs/specs/modules/design-system.md §2.3, §9; BUILD-PROMPT.md §6.5 "one
 * pattern everywhere", §12.8, §14.2; CTRL-0016-7, client part): co-sign uses the same steps, controls and
 * re-verification rule against the co-signer's window, and its authentication step asks for badge tap plus
 * PIN (simulated until WP-0.4, KA-032).
 */
import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createSimulatedAuthenticator } from '../../src/sign/index.ts';
import {
  dialog,
  dialogButton,
  DOCTOR,
  fixedAuthenticator,
  NURSE,
  openAction,
  PATIENT_A,
  renderSign,
  steps,
  TestWindow,
  text,
  WINDOW_MS,
} from './harness.tsx';

/** The roles and names of the dialog's controls, in order, with the action's own name normalised. */
function controlShape(actionKey: 'sign.action' | 'sign.cosign.action'): string[] {
  return within(dialog())
    .getAllByRole('button')
    .map((button) => button.textContent)
    .map((name) => (name === text(actionKey) ? 'ACTION' : name));
}

describe('cosign-same-pattern', () => {
  it('uses the same steps, in the same order, with the same controls; only the intent differs', async () => {
    const user = userEvent.setup();
    const signWindow = TestWindow.holding(PATIENT_A, 0);
    const signView = renderSign({ window: signWindow });
    await user.click(openAction('sign'));
    const signSteps = steps();
    const signControls = controlShape('sign.action');
    expect(within(dialog()).getByText(text('sign.intent.author'))).toBeVisible();
    signView.unmount();

    const cosignWindow = TestWindow.holding(PATIENT_A, 0);
    renderSign({ window: cosignWindow });
    await user.click(openAction('cosign'));
    expect(steps()).toEqual(signSteps);
    expect(controlShape('sign.cosign.action')).toEqual(signControls);
    expect(within(dialog()).getByRole('heading', { name: text('sign.cosign.title') })).toBeVisible();
    expect(within(dialog()).getByText(text('sign.intent.cosign'))).toBeVisible();
    expect(within(dialog()).queryByText(text('sign.intent.author'))).toBeNull();
  });

  it('applies the re-verification rule to the co-signer’s own window', async () => {
    const user = userEvent.setup();
    // The co-signer's window changed patient 10 s ago: re-verification there.
    const recent = TestWindow.holding(PATIENT_A, 10_000);
    const first = renderSign({ window: recent, sessionUser: DOCTOR });
    await user.click(openAction('cosign'));
    expect(recent.snapshot.state).toBe('re-verification-required');
    expect(steps()).toContain('reverify');
    expect(dialogButton('sign.cosign.action')).toBeDisabled();
    first.unmount();

    // A co-signer's window that has held the patient for longer than the window: no re-verification.
    const settled = TestWindow.holding(PATIENT_A, WINDOW_MS + 1);
    renderSign({ window: settled, sessionUser: DOCTOR });
    await user.click(openAction('cosign'));
    expect(settled.snapshot.state).toBe('signing');
    expect(steps()).toEqual(['review', 'authenticate', 'sign']);
  });

  it('asks for a badge tap plus a PIN, and enables Co-sign only after both', async () => {
    const user = userEvent.setup();
    const window = TestWindow.holding(PATIENT_A, WINDOW_MS + 1);
    const { server } = renderSign({ window, sessionUser: DOCTOR });
    await user.click(openAction('cosign'));

    expect(within(dialog()).getByText(text('sign.authenticate.cosignPin'))).toBeVisible();
    const pin = screen.getByTestId('hms-sign-pin');
    expect(pin).toHaveAttribute('type', 'password');
    expect(pin).toHaveAccessibleDescription(text('sign.authenticate.cosignPin'));
    // The simulated badge tap waits for the PIN.
    expect(dialogButton('sign.authenticate.simulated')).toBeDisabled();
    expect(dialogButton('sign.cosign.action')).toBeDisabled();

    await user.type(pin, '4321');
    await user.click(dialogButton('sign.authenticate.simulated'));
    await waitFor(() => {
      expect(dialogButton('sign.cosign.action')).toBeEnabled();
    });
    // The PIN is not kept once used.
    expect(pin).toHaveValue('');

    await user.click(dialogButton('sign.cosign.action'));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(server.commands).toEqual([
      expect.objectContaining({ kind: 'cosign', signerUserId: DOCTOR, reverification: null }),
    ]);
  });

  it('refuses a co-signature authenticated without badge and PIN', async () => {
    const user = userEvent.setup();
    const window = TestWindow.holding(PATIENT_A, WINDOW_MS + 1);
    const { server } = renderSign({
      window,
      sessionUser: DOCTOR,
      authenticator: fixedAuthenticator(DOCTOR, 'single'),
    });
    await user.click(openAction('cosign'));
    await user.type(screen.getByTestId('hms-sign-pin'), '4321');
    await user.click(dialogButton('sign.authenticate.simulated'));
    await waitFor(() => {
      expect(within(dialog()).getByRole('alert')).toHaveTextContent(text('hal.reason.stepUpRefused'));
    });
    expect(dialogButton('sign.cosign.action')).toBeDisabled();
    expect(server.commands).toEqual([]);
  });

  it('a simulated PIN that is not 4 to 8 digits is not accepted', async () => {
    const user = userEvent.setup();
    const window = TestWindow.holding(PATIENT_A, WINDOW_MS + 1);
    renderSign({ window, sessionUser: DOCTOR, authenticator: createSimulatedAuthenticator(DOCTOR) });
    await user.click(openAction('cosign'));
    await user.type(screen.getByTestId('hms-sign-pin'), '12');
    await user.click(dialogButton('sign.authenticate.simulated'));
    await waitFor(() => {
      expect(within(dialog()).getByRole('alert')).toHaveTextContent(text('hal.reason.stepUpRefused'));
    });
    expect(dialogButton('sign.cosign.action')).toBeDisabled();
  });

  it('returns to re-verification when the co-signer is not the person who confirmed the patient', async () => {
    const user = userEvent.setup();
    // The nurse's workstation; the context changed 5 s ago; the doctor co-signs there.
    const window = TestWindow.holding(PATIENT_A, 5_000);
    const { server } = renderSign({
      window,
      sessionUser: NURSE,
      authenticator: createSimulatedAuthenticator(DOCTOR),
    });
    await user.click(openAction('cosign'));
    await user.click(dialogButton('sign.reverify.confirm'));
    expect(window.snapshot.reverification?.confirmedBy).toBe(NURSE);

    await user.type(screen.getByTestId('hms-sign-pin'), '4321');
    await user.click(dialogButton('sign.authenticate.simulated'));
    await waitFor(() => {
      expect(dialogButton('sign.cosign.action')).toBeEnabled();
    });
    await user.click(dialogButton('sign.cosign.action'));

    expect(window.snapshot.state).toBe('re-verification-required');
    expect(steps()).toContain('reverify');
    expect(within(dialog()).getByRole('alert')).toHaveTextContent(text('sign.reverify.signerDiffers'));
    // The reason shown on open (a recent change) is not why the step is back.
    expect(within(dialog()).queryByText(/changed in the last/)).toBeNull();
    expect(server.commands).toEqual([]);

    // The earlier authentication no longer counts: whoever is at the keyboard (the nurse, here) cannot
    // confirm the patient for the co-signer. Confirm and Co-sign stay disabled until the co-signer
    // authenticates again, badge and PIN, in this step.
    expect(dialogButton('sign.reverify.confirm')).toBeDisabled();
    expect(dialogButton('sign.cosign.action')).toBeDisabled();
    await user.click(dialogButton('sign.reverify.confirm'));
    expect(window.snapshot.state).toBe('re-verification-required');
    expect(window.snapshot.reverification).toBeNull();
    expect(dialogButton('sign.authenticate.simulated')).toBeDisabled();

    const pin = within(dialog()).getByTestId('hms-sign-pin');
    expect(pin).toHaveValue('');
    expect(pin).toHaveAccessibleName(text('sign.authenticate.heading'));
    await user.type(pin, '8765');
    await user.click(dialogButton('sign.authenticate.simulated'));
    await waitFor(() => {
      expect(dialogButton('sign.reverify.confirm')).toBeEnabled();
    });
    // Focus leaves the sign-in control, now disabled, for the step's heading, never for a control.
    expect(document.activeElement).toBe(
      within(dialog()).getByRole('heading', { name: text('sign.reverify.title') }),
    );
    expect(dialogButton('sign.cosign.action')).toBeDisabled();

    // The co-signer confirms the patient; the re-verification is now theirs and the co-signature goes.
    await user.click(dialogButton('sign.reverify.confirm'));
    expect(window.snapshot.reverification?.confirmedBy).toBe(DOCTOR);
    expect(dialogButton('sign.cosign.action')).toBeEnabled();
    await user.click(dialogButton('sign.cosign.action'));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(server.commands).toEqual([
      expect.objectContaining({
        kind: 'cosign',
        signerUserId: DOCTOR,
        reverification: expect.objectContaining({ confirmedBy: DOCTOR }) as unknown,
      }),
    ]);
  });

  it('after a return to re-verification, a failed authentication confirms nothing', async () => {
    const user = userEvent.setup();
    const window = TestWindow.holding(PATIENT_A, 5_000);
    let factors: 'single' | 'badge-and-pin' = 'badge-and-pin';
    const { server } = renderSign({
      window,
      sessionUser: NURSE,
      authenticator: {
        authenticate: () => Promise.resolve({ status: 'authenticated', userId: DOCTOR, factors }),
      },
    });
    await user.click(openAction('cosign'));
    await user.click(dialogButton('sign.reverify.confirm'));
    await user.type(screen.getByTestId('hms-sign-pin'), '4321');
    await user.click(dialogButton('sign.authenticate.simulated'));
    await waitFor(() => {
      expect(dialogButton('sign.cosign.action')).toBeEnabled();
    });
    await user.click(dialogButton('sign.cosign.action'));
    expect(window.snapshot.state).toBe('re-verification-required');

    // The second authentication comes back without badge and PIN: refused, and nothing is confirmed.
    factors = 'single';
    await user.type(within(dialog()).getByTestId('hms-sign-pin'), '4321');
    await user.click(dialogButton('sign.authenticate.simulated'));
    await waitFor(() => {
      expect(within(dialog()).getByRole('alert')).toHaveTextContent(text('hal.reason.stepUpRefused'));
    });
    expect(dialogButton('sign.reverify.confirm')).toBeDisabled();
    expect(dialogButton('sign.cosign.action')).toBeDisabled();
    expect(window.snapshot.reverification).toBeNull();
    expect(server.commands).toEqual([]);
  });
});
