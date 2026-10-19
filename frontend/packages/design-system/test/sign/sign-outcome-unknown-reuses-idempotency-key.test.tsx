/**
 * UnitTest:sign-outcome-unknown-reuses-idempotency-key (docs/specs/modules/design-system.md §2.3, §9;
 * BUILD-PROMPT.md §6.2): a rejected command shows `sign.failed`; a timeout shows `sign.outcomeUnknown` and a
 * retry sends the same idempotency key, so the server can never record the signature twice.
 *
 * A transport error or a malformed answer is also "unknown", never "not signed": the signature may have been
 * saved. A server refusal for re-verification returns to the re-verification step; any other refusal is a
 * rejection.
 */
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SIGN_SUBMIT_TIMEOUT_MS } from '../../src/sign/index.ts';
import {
  dialog,
  dialogButton,
  DOCTOR,
  FakeServer,
  NURSE,
  openAction,
  PATIENT_A,
  renderSign,
  steps,
  TestWindow,
  text,
  WINDOW_MS,
} from './harness.tsx';

type User = ReturnType<typeof userEvent.setup>;

/** Opens the sign dialog on a settled window (no re-verification), authenticates and presses Sign. */
async function signOnce(user: User): Promise<void> {
  await user.click(openAction('sign'));
  await user.click(dialogButton('sign.authenticate.simulated'));
  await waitFor(() => {
    expect(dialogButton('sign.action')).toBeEnabled();
  });
  await user.click(dialogButton('sign.action'));
}

const alertText = (): string => within(dialog()).getByRole('alert').textContent;

describe('sign-outcome-unknown-reuses-idempotency-key', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('a rejection shows sign.failed, keeps the dialog open, and a retry keeps the key', async () => {
    const user = userEvent.setup();
    const window = TestWindow.holding(PATIENT_A, WINDOW_MS + 1);
    const server = new FakeServer({ status: 'rejected' }, { status: 'accepted' });
    renderSign({ window, server });
    await signOnce(user);

    await waitFor(() => {
      expect(alertText()).toBe(text('sign.failed'));
    });
    expect(window.snapshot.state).toBe('signing');
    expect(dialogButton('sign.action')).toBeEnabled();

    await user.click(dialogButton('sign.action'));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(server.commands.map((command) => command.idempotencyKey)).toEqual(['idem-1', 'idem-1']);
    expect(screen.getByTestId('hms-sign-status')).toHaveTextContent(text('sign.done'));
  });

  it('a timeout shows sign.outcomeUnknown and a retry sends the same idempotency key', async () => {
    // The submit timeout is the real 30 s default, on fake timers that move only when the test moves
    // them: the result does not depend on how busy the host is.
    const user = userEvent.setup();
    const window = TestWindow.holding(PATIENT_A, WINDOW_MS + 1);
    const server = new FakeServer('never', { status: 'accepted' });
    renderSign({ window, server, submitTimeoutMs: DEFAULT_SIGN_SUBMIT_TIMEOUT_MS });
    await user.click(openAction('sign'));
    await user.click(dialogButton('sign.authenticate.simulated'));
    await waitFor(() => {
      expect(dialogButton('sign.action')).toBeEnabled();
    });

    // Only setTimeout and clearTimeout are fake, from the press of Sign until the timeout has run out.
    // The press is a plain click event: user-event's calls wait on a setTimeout(0), which would never run.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    fireEvent.click(dialogButton('sign.action'));
    expect(window.snapshot.state).toBe('submitting');
    expect(dialogButton('sign.action')).toBeDisabled();
    expect(dialogButton('sign.cancel')).toBeDisabled();
    // Focus leaves the disabled Sign control for the intent and sign section.
    expect(screen.getByTestId('hms-sign-section')).toHaveFocus();

    // One millisecond short of the timeout: still waiting, and nothing says "not signed".
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEFAULT_SIGN_SUBMIT_TIMEOUT_MS - 1);
    });
    expect(window.snapshot.state).toBe('submitting');
    expect(alertText()).toBe('');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    vi.useRealTimers();
    await waitFor(() => {
      expect(alertText()).toBe(text('sign.outcomeUnknown'));
    });
    expect(alertText()).not.toBe(text('sign.failed'));
    expect(window.snapshot.state).toBe('signing');

    await user.click(dialogButton('sign.action'));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(server.commands).toHaveLength(2);
    expect(server.commands[1]?.idempotencyKey).toBe(server.commands[0]?.idempotencyKey);
  });

  it('a lost response (transport error) is unknown, never "not signed"', async () => {
    const user = userEvent.setup();
    const window = TestWindow.holding(PATIENT_A, WINDOW_MS + 1);
    renderSign({ window, server: new FakeServer('throw') });
    await signOnce(user);
    await waitFor(() => {
      expect(alertText()).toBe(text('sign.outcomeUnknown'));
    });
  });

  it('a malformed answer is unknown', async () => {
    const user = userEvent.setup();
    const window = TestWindow.holding(PATIENT_A, WINDOW_MS + 1);
    const server = new FakeServer({ status: 'maybe' } as unknown as { status: 'unknown' });
    renderSign({ window, server });
    await signOnce(user);
    await waitFor(() => {
      expect(alertText()).toBe(text('sign.outcomeUnknown'));
    });
  });

  it('Escape while submitting does not close the dialog', async () => {
    const user = userEvent.setup();
    const window = TestWindow.holding(PATIENT_A, WINDOW_MS + 1);
    renderSign({ window, server: new FakeServer('never') });
    await signOnce(user);
    await user.keyboard('{Escape}');
    expect(window.snapshot.state).toBe('submitting');
    expect(screen.getByRole('dialog')).toBeVisible();
  });

  it('a dialog closed while the command is in flight reports the outcome as unknown', async () => {
    const user = userEvent.setup();
    const window = TestWindow.holding(PATIENT_A, WINDOW_MS + 1);
    renderSign({ window, server: new FakeServer('never') });
    await signOnce(user);
    expect(window.snapshot.state).toBe('submitting');

    // A change of user clears the context and closes the dialog without signing (DN-028).
    act(() => {
      window.send({ type: 'UserChanged', userId: DOCTOR });
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('hms-sign-status')).toHaveTextContent(text('sign.outcomeUnknown'));
  });

  it('a refusal for re-verification returns to the re-verification step with the same key', async () => {
    const user = userEvent.setup();
    const window = TestWindow.holding(PATIENT_A, WINDOW_MS + 1);
    const server = new FakeServer({ status: 'refused', reason: 'reverification-required' });
    renderSign({ window, server });
    await signOnce(user);
    await waitFor(() => {
      expect(window.snapshot.state).toBe('re-verification-required');
    });
    expect(steps()).toContain('reverify');
    expect(alertText()).toBe(text('sign.refused.reverify'));
    expect(within(dialog()).queryByText(/changed in the last/)).toBeNull();

    // The earlier authentication no longer counts: the signer signs in again in this step before the
    // patient can be confirmed, and that sign-in is the one the signature uses.
    expect(dialogButton('sign.reverify.confirm')).toBeDisabled();
    expect(dialogButton('sign.action')).toBeDisabled();
    await user.click(dialogButton('sign.authenticate.simulated'));
    await waitFor(() => {
      expect(dialogButton('sign.reverify.confirm')).toBeEnabled();
    });
    await user.click(dialogButton('sign.reverify.confirm'));
    expect(window.snapshot.reverification?.confirmedBy).toBe(NURSE);
    await user.click(dialogButton('sign.action'));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(server.commands.map((command) => command.idempotencyKey)).toEqual(['idem-1', 'idem-1']);
  });

  it('any other refusal is a rejection: sign.failed', async () => {
    const user = userEvent.setup();
    const window = TestWindow.holding(PATIENT_A, WINDOW_MS + 1);
    renderSign({ window, server: new FakeServer({ status: 'refused', reason: 'synthetic-other' }) });
    await signOnce(user);
    await waitFor(() => {
      expect(alertText()).toBe(text('sign.failed'));
    });
    expect(window.snapshot.state).toBe('signing');
  });

  it('a new sign session gets a new key', async () => {
    const user = userEvent.setup();
    const window = TestWindow.holding(PATIENT_A, WINDOW_MS + 1);
    const { server } = renderSign({ window });
    await signOnce(user);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await signOnce(user);
    await waitFor(() => {
      expect(server.commands).toHaveLength(2);
    });
    expect(server.commands.map((command) => command.idempotencyKey)).toEqual(['idem-1', 'idem-2']);
  });
});
