/**
 * UnitTest:sign-requires-reverification (docs/specs/modules/design-system.md §2.3, §9; BUILD-PROMPT.md §2.1
 * SI-16 clause f; CTRL-0016-7, client part): within the re-verification window the dialog shows
 * re-verification before authentication; Sign stays disabled until it is confirmed; "Not this patient" ends
 * the dialog with `sign.reverify.rejected` and moves focus away from clinical actions.
 *
 * The window is 60 s read inclusively (DN-026): exactly 60.000 s still requires re-verification, 60.001 s
 * does not. The rule itself is ui-core's (PropertyTest:SI-16-re-verification-at-signing-after-recent-
 * context-change); this test checks that the dialog shows and obeys it. The server-side refusal is not
 * built (KA-025).
 */
import { act, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  bannerWithoutDob,
  dialog,
  dialogButton,
  NURSE,
  openAction,
  PATIENT_A,
  renderSign,
  steps,
  TestWindow,
  text,
  WINDOW_MS,
} from './harness.tsx';

describe('sign-requires-reverification', () => {
  it('shows re-verification before authentication within the window, with Sign disabled', async () => {
    const user = userEvent.setup();
    const window = TestWindow.holding(PATIENT_A, 5_000);
    renderSign({ window });

    await user.click(openAction('sign'));

    expect(window.snapshot.state).toBe('re-verification-required');
    expect(steps()).toEqual(['review', 'reverify', 'sign']);
    expect(within(dialog()).getByRole('heading', { name: text('sign.reverify.title') })).toBeVisible();
    expect(within(dialog()).queryByText(text('sign.authenticate.heading'))).toBeNull();
    expect(within(dialog()).queryByRole('button', { name: text('sign.authenticate.simulated') })).toBeNull();
    expect(dialogButton('sign.action')).toBeDisabled();
  });

  it('shows the patient to confirm: photo state, every name form, MRN and date of birth, whole', async () => {
    const user = userEvent.setup();
    const window = TestWindow.holding(PATIENT_A, 0);
    renderSign({ window });
    await user.click(openAction('sign'));

    const identity = within(dialog());
    expect(identity.getByText(text('banner.photo.missing'))).toBeVisible();
    expect(identity.getByText('هێمن ئازاد عومەر کەریم')).toBeVisible();
    expect(identity.getByText('هيمن آزاد عمر كريم')).toBeVisible();
    expect(identity.getByText('Hêmin Azad Omer Kerîm 1')).toBeVisible();
    expect(identity.getByText('SYN-100231-7')).toBeVisible();
    expect(identity.getByText('1984-03')).toBeVisible();
    expect(identity.getByText(text('banner.dob.approximateFlag'))).toBeVisible();
    // sign.reverify.reason with windowSeconds = 60 (the `other` branch in English).
    expect(identity.getByText(/changed in the last 60 seconds\./)).toBeVisible();
  });

  it('focuses no control on open, and Enter on open confirms nothing', async () => {
    const user = userEvent.setup();
    const window = TestWindow.holding(PATIENT_A, 0);
    renderSign({ window });
    await user.click(openAction('sign'));

    const active = document.activeElement;
    // The dialog holds focus (not the page behind it), and no control of it has focus.
    expect(active).not.toBeNull();
    expect(dialog().contains(active)).toBe(true);
    expect(within(dialog()).queryAllByRole('button')).not.toContain(active);
    expect(active).not.toBe(dialogButton('sign.reverify.confirm'));
    expect(active).not.toBe(dialogButton('sign.action'));
    await user.keyboard('{Enter}');
    expect(window.snapshot.state).toBe('re-verification-required');
    expect(window.snapshot.reverification).toBeNull();
  });

  it('enables authentication only after the patient is confirmed, and Sign only after authentication', async () => {
    const user = userEvent.setup();
    const window = TestWindow.holding(PATIENT_A, 30_000);
    const { server } = renderSign({ window });
    await user.click(openAction('sign'));

    await user.click(dialogButton('sign.reverify.confirm'));
    expect(window.snapshot.state).toBe('signing');
    expect(window.snapshot.reverification?.confirmedBy).toBe(NURSE);
    expect(steps()).toEqual(['review', 'authenticate', 'sign']);
    // Focus moves to the new step's heading, never to a control.
    expect(document.activeElement).toBe(
      within(dialog()).getByRole('heading', { name: text('sign.authenticate.heading') }),
    );
    expect(dialogButton('sign.action')).toBeDisabled();

    await user.click(dialogButton('sign.authenticate.simulated'));
    await waitFor(() => {
      expect(dialogButton('sign.action')).toBeEnabled();
    });
    // Focus leaves the sign-in control, now disabled, for the intent and sign section: never for Sign.
    expect(screen.getByTestId('hms-sign-section')).toHaveFocus();
    expect(dialogButton('sign.authenticate.simulated')).toBeDisabled();
    await user.click(dialogButton('sign.action'));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(server.commands).toHaveLength(1);
    expect(server.commands[0]).toMatchObject({
      kind: 'sign',
      patientId: PATIENT_A,
      signerUserId: NURSE,
      idempotencyKey: 'idem-1',
      reverification: { confirmedBy: NURSE },
    });
    expect(server.commands[0]?.lastContextChangeWallTimeMs).toEqual(expect.any(Number));
    expect(screen.getByTestId('hms-sign-status')).toHaveTextContent(text('sign.done'));
  });

  it('still requires re-verification at exactly 60.000 s, and not at 60.001 s', async () => {
    const user = userEvent.setup();
    const atLimit = TestWindow.holding(PATIENT_A, WINDOW_MS);
    const first = renderSign({ window: atLimit });
    await user.click(openAction('sign'));
    expect(steps()).toContain('reverify');
    first.unmount();

    const beyond = TestWindow.holding(PATIENT_A, WINDOW_MS + 1);
    renderSign({ window: beyond });
    await user.click(openAction('sign'));
    expect(beyond.snapshot.state).toBe('signing');
    expect(steps()).toEqual(['review', 'authenticate', 'sign']);
  });

  it('"Not this patient" ends the dialog with sign.reverify.rejected and focuses the banner close control', async () => {
    const user = userEvent.setup();
    const window = TestWindow.holding(PATIENT_A, 1_000);
    const { server } = renderSign({ window });
    await user.click(openAction('sign'));

    await user.click(dialogButton('sign.reverify.reject'));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(server.commands).toEqual([]);
    expect(screen.getByTestId('hms-sign-status')).toHaveTextContent(text('sign.reverify.rejected'));
    await waitFor(() => {
      expect(screen.getByTestId('banner-close')).toHaveFocus();
    });
    await act(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    expect(screen.getByTestId('banner-close')).toHaveFocus();
    expect(openAction('sign')).not.toHaveFocus();

    // The identity stays disputed: even after the window has passed, signing asks again.
    window.clock.advance(5 * WINDOW_MS);
    await user.click(openAction('sign'));
    expect(steps()).toContain('reverify');
    // The step does not claim a recent change: the identity is disputed, not recently changed.
    expect(within(dialog()).queryByText(/changed in the last/)).toBeNull();
    expect(dialogButton('sign.reverify.confirm')).toBeEnabled();
  });

  it('without the banner control, focus goes to the status message, never to a clinical action', async () => {
    const user = userEvent.setup();
    const window = TestWindow.holding(PATIENT_A, 0);
    renderSign({ window, withCloseControl: false });
    await user.click(openAction('sign'));
    await user.click(dialogButton('sign.reverify.reject'));
    await waitFor(() => {
      expect(screen.getByTestId('hms-sign-status')).toHaveFocus();
    });
  });

  it('shows the machine’s own window: a configured 120 s window reads 120 seconds', async () => {
    const user = userEvent.setup();
    const window = new TestWindow(2 * WINDOW_MS);
    window.select(PATIENT_A);
    window.clock.advance(WINDOW_MS + 1);
    renderSign({ window });
    await user.click(openAction('sign'));
    expect(window.snapshot.state).toBe('re-verification-required');
    expect(within(dialog()).getByText(/changed in the last 120 seconds\./)).toBeVisible();
  });

  it('never confirms a patient whose identity is unavailable or incomplete (fail closed)', async () => {
    const user = userEvent.setup();
    const window = TestWindow.holding(PATIENT_A, 0);
    renderSign({ window });
    await user.click(openAction('sign'));
    expect(dialogButton('sign.reverify.confirm')).toBeEnabled();

    // The dialog is a view of the window's snapshot: if that snapshot ever loses the identity while the
    // step is open, the confirmation is disabled; only "Not this patient" and Cancel remain.
    act(() => {
      window.snapshot = { ...window.snapshot, patient: { patientId: PATIENT_A, banner: null } };
      window.send({ type: 'SignAccepted' }); // refused by the machine; it only notifies the view
    });
    expect(within(dialog()).getByText(text('banner.dataUnavailable'))).toBeVisible();
    expect(dialogButton('sign.reverify.confirm')).toBeDisabled();
    await user.click(dialogButton('sign.reverify.confirm'));
    expect(window.snapshot.state).toBe('re-verification-required');
    expect(window.snapshot.reverification).toBeNull();
    expect(dialogButton('sign.reverify.reject')).toBeEnabled();
    expect(dialogButton('sign.cancel')).toBeEnabled();

    act(() => {
      window.snapshot = {
        ...window.snapshot,
        patient: { patientId: PATIENT_A, banner: bannerWithoutDob(PATIENT_A) },
      };
      window.send({ type: 'SignAccepted' });
    });
    expect(dialogButton('sign.reverify.confirm')).toBeDisabled();
  });

  it('cannot open on an incomplete identity: the action is disabled and says why', () => {
    const window = TestWindow.holding(PATIENT_A, 0, bannerWithoutDob(PATIENT_A));
    renderSign({ window });
    expect(openAction('sign')).toBeDisabled();
    expect(openAction('cosign')).toBeDisabled();
    expect(screen.getAllByText(text('sign.blockedByBanner'))).toHaveLength(2);
    // The machine refuses on its own as well.
    expect(window.send({ type: 'OpenSign', kind: 'sign' }).messageKey).toBe('sign.blockedByBanner');
    expect(window.snapshot.state).toBe('patient-selected');
  });

  it('cancelling leaves nothing signed and keeps the patient', async () => {
    const user = userEvent.setup();
    const window = TestWindow.holding(PATIENT_A, 0);
    const { server } = renderSign({ window });
    await user.click(openAction('sign'));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(window.snapshot.state).toBe('patient-selected');
    expect(window.snapshot.patient?.patientId).toBe(PATIENT_A);
    expect(server.commands).toEqual([]);
  });
});
