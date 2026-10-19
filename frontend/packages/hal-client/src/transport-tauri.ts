/**
 * The transport to the Tauri 2 workstation shell (ADR-019; BUILD-PROMPT.md §12.8, §13.5).
 *
 * The IPC binding [P] (OQ-157), which the shell's commands implement (slice S9):
 *  - `hal_call` with `{ contractVersion, call, request }` for the ten request and reply calls;
 *  - `hal_subscribe` with `{ contractVersion, call, request, onEvent }` for hal.scan.onBarcode and
 *    hal.auth.onBadge, where `onEvent` is a Tauri channel that carries the events of this window's
 *    subscription only (barcode reads only while the window has the focus);
 *  - `hal_release_blob` with `{ blobRef }`, a release of session bytes, best effort; not a HAL call.
 *
 * Every request is checked against the contract before it is sent: a request that does not match is refused
 * here (refusedRequest) and never reaches the shell, so a field outside the contract cannot cross the
 * bridge. Every reply is checked too: a reply that does not match the call's result schema, a rejected
 * invoke, a thrown error and a reply that has not come by the client's deadline all become an error result
 * (unusableReply, deadlinePassed), never an exception and never a promise that does not settle. Events that
 * do not match the contract, or that name another subscription, are dropped. A reply with the reason
 * `no-shell` is unusable too: only hal-client gives that reason. In WP-0.7 the shell does not implement
 * hal.id.read or hal.pay.request (KA-027): a success reply to hal.id.read becomes `unavailable` /
 * `not-implemented`, and one to hal.pay.request the unusable-reply error, whose outcome is unknown, because
 * money may have moved.
 */
import { Channel, invoke as tauriInvoke } from '@tauri-apps/api/core';
import {
  halError,
  HAL_CONTRACT_VERSION,
  NOT_IMPLEMENTED_CALLS,
  parseEvent,
  parseRequest,
  parseResult,
  type BlobRef,
  type CallName,
  type HalCallResult,
  type HalEvent,
  type HalRequest,
  type RequestCallName,
  type SubscriptionCallName,
} from './contract.ts';
import {
  deadlinePassed,
  freshAuditId,
  refusedRequest,
  unusableReply,
  type HalSubscription,
  type HalTransport,
} from './transport.ts';

/** The shell's command names (OQ-157). */
export const TAURI_COMMANDS = {
  call: 'hal_call',
  subscribe: 'hal_subscribe',
  releaseBlob: 'hal_release_blob',
} as const;

/** How many events may wait for the reply that names their subscription; later ones are dropped. */
export const MAX_PENDING_EVENTS = 64;

/**
 * How long the client waits for the shell's reply to one invoke before it gives up [P] (OQ-157). It must be
 * longer than the shell's own time limit for every call, a patient's signature included, so that the shell's
 * `timeout` answer normally comes first; the client's deadline only ends a call the shell never answers, so
 * that a capture cannot hold the window's modal guard for ever.
 */
export const DEFAULT_CALL_DEADLINE_MS = 180_000;

/** The part of a Tauri channel the transport uses. */
export interface EventChannel {
  onmessage: (message: unknown) => void;
}

export type TauriInvoke = (command: string, args: Record<string, unknown>) => Promise<unknown>;

export interface TauriTransportOptions {
  /** Tauri's invoke; replaced in tests. */
  readonly invoke?: TauriInvoke;
  /** Creates the channel that carries a subscription's events; replaced in tests. */
  readonly createChannel?: () => EventChannel;
  /** The client's deadline for each invoke, in milliseconds; DEFAULT_CALL_DEADLINE_MS by default. */
  readonly deadlineMs?: number;
}

/** What an invoke came to: the shell's reply, a rejection, or no reply by the deadline. */
type InvokeOutcome =
  { readonly kind: 'reply'; readonly reply: unknown } | { readonly kind: 'failed' | 'late' };

/** The blob a success reply names, if any, so that bytes the client will not use can be released. */
function blobOfReply(reply: unknown): BlobRef | null {
  if (typeof reply !== 'object' || reply === null || !('value' in reply)) {
    return null;
  }
  const { value } = reply;
  if (typeof value === 'object' && value !== null && 'blobRef' in value) {
    const { blobRef } = value;
    return typeof blobRef === 'string' && blobRef.startsWith('hal-blob:') ? blobRef : null;
  }
  return null;
}

export function createTauriTransport(options: TauriTransportOptions = {}): HalTransport {
  const invoke: TauriInvoke = options.invoke ?? ((command, args) => tauriInvoke<unknown>(command, args));
  const createChannel = options.createChannel ?? (() => new Channel<unknown>());
  const deadlineMs = options.deadlineMs ?? DEFAULT_CALL_DEADLINE_MS;

  /** Best effort: the shell deletes every blob of the session when the session ends anyway. */
  async function release(blobRef: BlobRef): Promise<void> {
    try {
      await invoke(TAURI_COMMANDS.releaseBlob, { blobRef });
    } catch {
      // Nothing more to do; see above.
    }
  }

  /**
   * Invokes a command and waits for its reply until the deadline. A reply that comes after the deadline is
   * not used; the bytes of a blob it names are released.
   */
  function invokeWithDeadline(command: string, args: Record<string, unknown>): Promise<InvokeOutcome> {
    return new Promise<InvokeOutcome>((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        settled = true;
        resolve({ kind: 'late' });
      }, deadlineMs);
      const settle = (outcome: InvokeOutcome): void => {
        if (settled) {
          const blobRef = outcome.kind === 'reply' ? blobOfReply(outcome.reply) : null;
          if (blobRef !== null) {
            void release(blobRef);
          }
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolve(outcome);
      };
      let pending: Promise<unknown>;
      try {
        pending = invoke(command, args);
      } catch {
        settle({ kind: 'failed' });
        return;
      }
      pending.then(
        (reply) => {
          settle({ kind: 'reply', reply });
        },
        () => {
          settle({ kind: 'failed' });
        },
      );
    });
  }

  /** Parses a reply; anything the client cannot use becomes an error result. */
  function accept<C extends CallName>(call: C, reply: unknown): HalCallResult<C> {
    const result = parseResult(call, reply);
    if (result === null || (!result.ok && result.error.reason === 'no-shell')) {
      return unusableReply(call);
    }
    if (result.ok && NOT_IMPLEMENTED_CALLS.has(call)) {
      const blobRef = blobOfReply(reply);
      if (blobRef !== null) {
        void release(blobRef);
      }
      // hal.id.read changes nothing on a device: it is simply not available with this shell, and retrying
      // cannot help. A payment may have moved money, so it keeps the unusable-reply error (outcome unknown).
      return call === 'hal.id.read'
        ? { ok: false, error: halError(call, 'unavailable', 'not-implemented'), auditId: freshAuditId() }
        : unusableReply(call);
    }
    return result;
  }

  /** The result of an invoke that brought no reply: rejected, or not answered by the deadline. */
  function noReply<C extends CallName>(call: C, outcome: InvokeOutcome): HalCallResult<C> {
    return outcome.kind === 'late' ? deadlinePassed(call) : unusableReply(call);
  }

  return {
    kind: 'tauri',
    async call<C extends RequestCallName>(call: C, request: HalRequest<C>): Promise<HalCallResult<C>> {
      const checked = parseRequest(call, request);
      if (checked === null) {
        return refusedRequest(call);
      }
      const outcome = await invokeWithDeadline(TAURI_COMMANDS.call, {
        contractVersion: HAL_CONTRACT_VERSION,
        call,
        request: checked,
      });
      return outcome.kind === 'reply' ? accept(call, outcome.reply) : noReply(call, outcome);
    },

    async subscribe<C extends SubscriptionCallName>(
      call: C,
      request: HalRequest<C>,
      onEvent: (event: HalEvent<C>) => void,
    ): Promise<HalSubscription<C>> {
      const checked = parseRequest(call, request);
      if (checked === null) {
        return { result: refusedRequest(call), close: () => undefined };
      }
      let open = true;
      let subscriptionId: string | null = null;
      const pending: unknown[] = [];
      const deliver = (message: unknown): void => {
        const event = parseEvent(call, message);
        if (!open || event === null) {
          return;
        }
        if (event.subscriptionId !== subscriptionId) {
          // An event of another subscription never reaches this one.
          return;
        }
        try {
          onEvent(event);
        } catch {
          // A failing handler must not break the channel for the events after it.
        }
      };
      let channel: EventChannel;
      try {
        channel = createChannel();
      } catch {
        return { result: unusableReply(call), close: () => undefined };
      }
      // Events can arrive before the reply names the subscription; they wait until it does.
      channel.onmessage = (message) => {
        if (subscriptionId === null) {
          if (open && pending.length < MAX_PENDING_EVENTS) {
            pending.push(message);
          }
        } else {
          deliver(message);
        }
      };
      const close = (): void => {
        open = false;
        pending.length = 0;
        channel.onmessage = () => undefined;
      };

      const outcome = await invokeWithDeadline(TAURI_COMMANDS.subscribe, {
        contractVersion: HAL_CONTRACT_VERSION,
        call,
        request: checked,
        onEvent: channel,
      });
      // A subscription the shell opens only after the deadline stays closed here: its events are dropped.
      const result = outcome.kind === 'reply' ? accept(call, outcome.reply) : noReply(call, outcome);
      if (!result.ok) {
        close();
        return { result, close };
      }
      subscriptionId = result.value.subscriptionId;
      for (const message of pending.splice(0)) {
        deliver(message);
      }
      return { result, close };
    },

    releaseBlob(blobRef: BlobRef): Promise<void> {
      return release(blobRef);
    },
  };
}
