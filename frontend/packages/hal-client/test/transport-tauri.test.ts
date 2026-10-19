/**
 * The Tauri transport against a fake invoke and a fake channel (no Tauri runtime in Node.js): it passes the
 * shell's contract replies through unchanged, refuses a request outside the contract without sending it,
 * turns every unusable or missing reply into an error result instead of throwing or hanging, fails closed on
 * a success reply to hal.id.read or hal.pay.request (KA-027), and delivers only well-formed events of its
 * own subscription, never after close.
 */
import { describe, expect, it } from 'vitest';
import { createCaptureBinding } from '../src/capture.ts';
import {
  CALL_NAMES,
  halError,
  isSubscriptionCall,
  UUID7_PATTERN,
  type CallName,
  type HalRequest,
  type RequestCallName,
  type SubscriptionCallName,
} from '../src/contract.ts';
import { createHalClient } from '../src/client.ts';
import { refusedRequestError } from '../src/transport.ts';
import {
  createTauriTransport,
  MAX_PENDING_EVENTS,
  TAURI_COMMANDS,
  type EventChannel,
  type TauriTransportOptions,
} from '../src/transport-tauri.ts';
import { copy, fixtureFiles, okRequest } from './support.ts';

interface Invocation {
  readonly command: string;
  readonly args: Record<string, unknown>;
}

function fakeShell(reply: (invocation: Invocation) => unknown, options: TauriTransportOptions = {}) {
  const invocations: Invocation[] = [];
  const channels: EventChannel[] = [];
  const transport = createTauriTransport({
    ...options,
    invoke: (command, args) => {
      const invocation = { command, args };
      invocations.push(invocation);
      try {
        return Promise.resolve(reply(invocation));
      } catch (error) {
        return Promise.reject(error instanceof Error ? error : new Error(String(error)));
      }
    },
    createChannel: () => {
      const channel: EventChannel = { onmessage: () => undefined };
      channels.push(channel);
      return channel;
    },
  });
  return { transport, invocations, channels };
}

const shellFixtures = fixtureFiles.filter(
  ({ fixture }) => fixture.audit.writtenBy === 'shell' && !isSubscriptionCall(fixture.call),
);

function fixtureFor(call: CallName) {
  const found = fixtureFiles.find(({ fixture }) => fixture.fixture === `${call}.ok`);
  if (found === undefined) {
    throw new Error(call);
  }
  return found.fixture;
}

/** Lets the promise callbacks that are already due run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('transport-tauri', () => {
  it.each(shellFixtures.map(({ file, fixture }) => [file, fixture] as const))(
    '%s: sends hal_call and returns the shell reply as the contract defines it',
    async (_file, fixture) => {
      const call = fixture.call as RequestCallName;
      const { transport, invocations } = fakeShell(() => copy(fixture.response));
      const result = await transport.call(call, fixture.request as HalRequest<RequestCallName>);
      expect(invocations).toStrictEqual([
        { command: TAURI_COMMANDS.call, args: { contractVersion: 1, call, request: fixture.request } },
      ]);
      if (fixture.response.ok && (call === 'hal.id.read' || call === 'hal.pay.request')) {
        // Not implemented in WP-0.7: a success reply fails closed. hal.id.read is simply unavailable (nothing
        // to retry); a payment may have moved money, so its outcome is unknown. The audit ID is a fresh one:
        // the shell's record says ok and the result says error (KA-040).
        expect(result.ok ? null : result.error).toStrictEqual(
          call === 'hal.id.read'
            ? halError(call, 'unavailable', 'not-implemented')
            : halError(call, 'device-error', 'device-fault'),
        );
        expect(result.ok ? null : result.error.retryable).toBe(false);
        expect(result.auditId).toMatch(UUID7_PATTERN);
        expect(result.auditId).not.toBe(fixture.response.auditId);
      } else {
        expect(result).toStrictEqual(fixture.response);
      }
    },
  );

  const unusable: readonly [string, (call: CallName) => unknown][] = [
    ['no reply', () => undefined],
    ['a string', () => 'ok'],
    ['an extra field', (call) => ({ ...copy(fixtureFor(call).response), message: 'SYN-PRINTER-SAYS-HELLO' })],
    [
      'an error the call cannot return',
      () => ({
        ok: false,
        error: {
          kind: 'cancelled',
          reason: 'user-cancelled',
          retryable: true,
          outcomeUnknown: false,
          messageKey: 'hal.error.cancelled',
        },
        auditId: '019a3c00-0000-7000-8000-0000000000e1',
      }),
    ],
    [
      'a value of another call',
      () => ({
        ok: true,
        value: { subscriptionId: '019a3c00-0000-7000-8000-0000000000e5' },
        auditId: '019a3c00-0000-7000-8000-0000000000e2',
      }),
    ],
    [
      'a no-shell refusal, which only hal-client gives',
      (call) => ({
        ok: false,
        error: halError(call, 'unavailable', 'no-shell'),
        auditId: '019a3c00-0000-7000-8000-0000000000e6',
      }),
    ],
  ];

  it.each(unusable)(
    'turns %s into an error result for print, kiosk and capabilities calls',
    async (_name, reply) => {
      for (const call of ['hal.print.label', 'hal.kiosk.lock', 'hal.capabilities'] as const) {
        const { transport } = fakeShell(() => reply(call));
        const result = await transport.call(call, okRequest(call) as HalRequest<typeof call>);
        expect(result.ok).toBe(false);
        expect(result.auditId).toMatch(UUID7_PATTERN);
        // A fresh audit ID, never the reply's: the shell's record of that reply does not match this result.
        const replied = reply(call);
        const replyAuditId =
          typeof replied === 'object' && replied !== null && 'auditId' in replied ? replied.auditId : null;
        expect(result.auditId).not.toBe(replyAuditId);
        const error = result.ok ? null : result.error;
        if (call === 'hal.print.label') {
          // The job may have printed: outcome unknown, never retried on its own.
          expect(error).toMatchObject({
            kind: 'device-error',
            reason: 'device-fault',
            retryable: false,
            outcomeUnknown: true,
          });
        } else {
          expect(error).toMatchObject({ kind: 'unavailable', reason: 'not-implemented', retryable: false });
        }
      }
    },
  );

  it('turns a rejected invoke into an error result and never throws', async () => {
    const { transport } = fakeShell(() => {
      throw new Error('IPC failure');
    });
    const result = await transport.call('hal.camera.photo', { purpose: 'patient-photo' });
    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'device-error', retryable: true, outcomeUnknown: false },
    });
    await expect(
      transport.releaseBlob('hal-blob:019a3c00-0000-7000-8000-0000000000e3'),
    ).resolves.toBeUndefined();
  });

  it('delivers only well-formed events of its own subscription, including those that came before the reply', async () => {
    const fixture = fixtureFor('hal.auth.onBadge');
    const [completed, refused] = fixture.events ?? [];
    const { transport, invocations, channels } = fakeShell((invocation) => {
      // The shell sends one event before its reply names the subscription.
      const channel = invocation.args.onEvent as EventChannel;
      channel.onmessage(copy(completed));
      return copy(fixture.response);
    });
    const events: unknown[] = [];
    const subscription = await transport.subscribe(
      'hal.auth.onBadge',
      { deviceId: 'SIM-BADGE-01' },
      (event) => events.push(event),
    );
    expect(subscription.result).toStrictEqual(fixture.response);
    expect(invocations[0]?.command).toBe(TAURI_COMMANDS.subscribe);
    const channel = channels[0];
    if (channel === undefined) {
      throw new Error('no channel');
    }
    channel.onmessage(copy(refused));
    channel.onmessage({ ...copy(refused), subscriptionId: '019a3c00-0000-7000-8000-0000000000e4' });
    channel.onmessage({ ...copy(refused), badgeCredential: 'SYN-CREDENTIAL' });
    // A completed step-up without its reference, and a refused one with a reference: both break the rule
    // "stepUpRef only, and always, on completion" (the key is absent, not undefined) and are dropped.
    const { stepUpRef, ...completedWithoutRef } = copy(completed ?? {});
    expect(stepUpRef).toBeTypeOf('string');
    expect('stepUpRef' in completedWithoutRef).toBe(false);
    channel.onmessage(completedWithoutRef);
    channel.onmessage({ ...copy(refused), stepUpRef });
    expect(events).toStrictEqual([completed, refused]);

    subscription.close();
    channel.onmessage(copy(refused));
    expect(events).toHaveLength(2);
  });

  it('delivers no event when the subscription fails', async () => {
    const failed = fixtureFiles.find(({ fixture }) => fixture.fixture === 'hal.scan.onBarcode.not-permitted');
    const { transport, channels } = fakeShell(() => copy(failed?.fixture.response));
    const events: unknown[] = [];
    const subscription = await transport.subscribe('hal.scan.onBarcode', {}, (event) => events.push(event));
    expect(subscription.result.ok).toBe(false);
    channels[0]?.onmessage(copy(fixtureFor('hal.scan.onBarcode').events?.[0]));
    expect(events).toHaveLength(0);
  });

  it('is what createHalClient chooses inside the shell', () => {
    expect(createHalClient({ shellPresent: () => true }).kind).toBe('tauri');
  });

  describe('requests outside the contract', () => {
    const requestCalls = CALL_NAMES.filter((call) => !isSubscriptionCall(call)) as RequestCallName[];

    it.each(requestCalls)('%s: a request with an extra field is refused and never sent', async (call) => {
      const { transport, invocations } = fakeShell(() => copy(fixtureFor(call).response));
      const request = { ...okRequest(call), patientName: 'SYN-PATIENT-NAME' };
      const result = await transport.call(call, request as unknown as HalRequest<typeof call>);
      expect(invocations).toHaveLength(0);
      expect(result).toStrictEqual({ ok: false, error: refusedRequestError(call), auditId: result.auditId });
      expect(result.auditId).toMatch(UUID7_PATTERN);
      expect(result.ok ? null : result.error.retryable).toBe(false);
    });

    it.each(['hal.scan.onBarcode', 'hal.auth.onBadge'] as const)(
      '%s: a malformed subscription request is refused, never sent, and opens no channel',
      async (call: SubscriptionCallName) => {
        const { transport, invocations, channels } = fakeShell(() => copy(fixtureFor(call).response));
        for (const request of [
          { deviceId: 'SIM-01', patientId: 'SYN-MRN-0001' },
          { deviceId: 'has space' },
        ]) {
          const subscription = await transport.subscribe(call, request, () => undefined);
          expect(subscription.result.ok ? null : subscription.result.error).toStrictEqual(
            halError(call, 'not-permitted', 'capability-not-granted'),
          );
        }
        expect(invocations).toHaveLength(0);
        expect(channels).toHaveLength(0);
      },
    );
  });

  describe('the client deadline', () => {
    /** A shell that answers nothing until the test says so; a blob release is answered at once. */
    function silentShell(deadlineMs: number) {
      const answers: ((reply: unknown) => void)[] = [];
      const invocations: Invocation[] = [];
      const channels: EventChannel[] = [];
      const transport = createTauriTransport({
        deadlineMs,
        invoke: (command, args) => {
          invocations.push({ command, args });
          if (command === TAURI_COMMANDS.releaseBlob) {
            return Promise.resolve(null);
          }
          return new Promise((resolve) => answers.push(resolve));
        },
        createChannel: () => {
          const channel: EventChannel = { onmessage: () => undefined };
          channels.push(channel);
          return channel;
        },
      });
      return { transport, answers, invocations, channels };
    }

    it('ends a call the shell never answers with the call timeout error', async () => {
      const { transport } = silentShell(5);
      const print = await transport.call(
        'hal.print.label',
        okRequest('hal.print.label') as HalRequest<'hal.print.label'>,
      );
      // The label may have printed: outcome unknown, never retried on its own.
      expect(print.ok ? null : print.error).toStrictEqual(
        halError('hal.print.label', 'timeout', 'device-timeout'),
      );
      expect(print.ok ? null : print.error.outcomeUnknown).toBe(true);
      expect(print.auditId).toMatch(UUID7_PATTERN);
      const photo = await transport.call('hal.camera.photo', { purpose: 'patient-photo' });
      expect(photo.ok ? null : photo.error).toMatchObject({ kind: 'timeout', retryable: true });
      const lock = await transport.call('hal.kiosk.lock', { state: 'locked' });
      expect(lock.ok ? null : lock.error).toStrictEqual(
        halError('hal.kiosk.lock', 'unavailable', 'not-implemented'),
      );
    });

    it('releases the blob of a capture that answers after the deadline', async () => {
      const { transport, answers, invocations } = silentShell(5);
      const result = await transport.call('hal.camera.photo', { purpose: 'patient-photo' });
      expect(result.ok).toBe(false);
      answers[0]?.(copy(fixtureFor('hal.camera.photo').response));
      await settle();
      expect(invocations.at(-1)).toStrictEqual({
        command: TAURI_COMMANDS.releaseBlob,
        args: { blobRef: 'hal-blob:019a3c00-0000-7000-8000-000000000044' },
      });
    });

    it('ends a subscription the shell never answers, and delivers none of its events', async () => {
      const { transport, answers, channels } = silentShell(5);
      const events: unknown[] = [];
      const subscription = await transport.subscribe('hal.auth.onBadge', {}, (event) => events.push(event));
      expect(subscription.result.ok ? null : subscription.result.error).toStrictEqual(
        halError('hal.auth.onBadge', 'device-error', 'device-fault'),
      );
      const fixture = fixtureFor('hal.auth.onBadge');
      answers[0]?.(copy(fixture.response));
      await settle();
      channels[0]?.onmessage(copy(fixture.events?.[1]));
      expect(events).toHaveLength(0);
    });

    it('lets a capture that waits on a silent shell give the modal guard back', async () => {
      const { transport } = silentShell(5);
      let held = 0;
      const binding = createCaptureBinding({
        transport,
        context: () => ({ patientId: 'SYN-PATIENT-0001', changeVersion: 1, changedAt: 100 }),
        holdModalGuard: () => {
          held += 1;
          return () => {
            held -= 1;
          };
        },
      });
      const pending = binding.capture(
        'hal.sign.capture',
        okRequest('hal.sign.capture') as HalRequest<'hal.sign.capture'>,
      );
      expect(binding.waiting()).toBe(1);
      expect(held).toBe(1);
      const outcome = await pending;
      expect(outcome.status === 'delivered' && !outcome.result.ok ? outcome.result.error.kind : null).toBe(
        'timeout',
      );
      expect(binding.waiting()).toBe(0);
      expect(held).toBe(0);
    });
  });

  describe('subscriptions that fail closed', () => {
    const badge = () => fixtureFor('hal.auth.onBadge');

    it('turns a rejected hal_subscribe into device-error / device-fault and delivers no event', async () => {
      const { transport, channels } = fakeShell(() => {
        throw new Error('IPC failure');
      });
      const events: unknown[] = [];
      const subscription = await transport.subscribe('hal.auth.onBadge', {}, (event) => events.push(event));
      expect(subscription.result.ok ? null : subscription.result.error).toStrictEqual(
        halError('hal.auth.onBadge', 'device-error', 'device-fault'),
      );
      channels[0]?.onmessage(copy(badge().events?.[1]));
      expect(events).toHaveLength(0);
    });

    it('turns a channel that cannot be created into device-error / device-fault without invoking the shell', async () => {
      const invocations: string[] = [];
      const transport = createTauriTransport({
        invoke: (command) => {
          invocations.push(command);
          return Promise.resolve(copy(badge().response));
        },
        createChannel: () => {
          throw new Error('no channel');
        },
      });
      const subscription = await transport.subscribe('hal.scan.onBarcode', {}, () => undefined);
      expect(subscription.result.ok ? null : subscription.result.error).toStrictEqual(
        halError('hal.scan.onBarcode', 'device-error', 'device-fault'),
      );
      expect(invocations).toHaveLength(0);
    });

    it('holds at most MAX_PENDING_EVENTS events that come before the reply', async () => {
      const fixture = badge();
      const refused = fixture.events?.[1];
      const { transport } = fakeShell((invocation) => {
        const channel = invocation.args.onEvent as EventChannel;
        for (let index = 0; index <= MAX_PENDING_EVENTS; index += 1) {
          channel.onmessage(copy(refused));
        }
        return copy(fixture.response);
      });
      const events: unknown[] = [];
      const subscription = await transport.subscribe('hal.auth.onBadge', {}, (event) => events.push(event));
      expect(subscription.result.ok).toBe(true);
      expect(MAX_PENDING_EVENTS).toBe(64);
      expect(events).toHaveLength(MAX_PENDING_EVENTS);
    });

    it('closes the channel when the subscribe reply is unusable', async () => {
      const fixture = badge();
      const { transport, channels } = fakeShell((invocation) => {
        (invocation.args.onEvent as EventChannel).onmessage(copy(fixture.events?.[1]));
        return { ...copy(fixture.response), extra: 'SYN' };
      });
      const events: unknown[] = [];
      const subscription = await transport.subscribe('hal.auth.onBadge', {}, (event) => events.push(event));
      expect(subscription.result.ok ? null : subscription.result.error).toStrictEqual(
        halError('hal.auth.onBadge', 'device-error', 'device-fault'),
      );
      channels[0]?.onmessage(copy(fixture.events?.[1]));
      expect(events).toHaveLength(0);
    });
  });
});
