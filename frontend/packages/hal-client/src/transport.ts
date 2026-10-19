/**
 * The transport interface every HAL client uses: the Tauri shell (transport-tauri.ts), no shell
 * (transport-none.ts) or the simulator (transport-sim.ts). A transport never throws across the bridge: a
 * transport failure, a panic in a driver or a malformed reply becomes an error result (README, "The result").
 */
import {
  halError,
  isKindOfCall,
  type AuditId,
  type BlobRef,
  type CallName,
  type HalCallResult,
  type HalError,
  type HalEvent,
  type HalRequest,
  type RequestCallName,
  type SubscriptionCallName,
} from './contract.ts';
import { uuid7 } from './uuid7.ts';

export type TransportKind = 'tauri' | 'none' | 'sim';

/**
 * An open subscription. `result` is the call's result as the contract defines it; `close` is a local
 * unlisten, not a HAL call. No event is delivered after close, and none ever on an error result.
 */
export interface HalSubscription<C extends SubscriptionCallName> {
  readonly result: HalCallResult<C>;
  close(): void;
}

export interface HalTransport {
  readonly kind: TransportKind;
  /** One of the ten request and reply calls. */
  call<C extends RequestCallName>(call: C, request: HalRequest<C>): Promise<HalCallResult<C>>;
  /** hal.scan.onBarcode or hal.auth.onBadge; each event carries its own audit ID. */
  subscribe<C extends SubscriptionCallName>(
    call: C,
    request: HalRequest<C>,
    onEvent: (event: HalEvent<C>) => void,
  ): Promise<HalSubscription<C>>;
  /**
   * Releases the bytes behind a blob handle, for example a capture discarded after a context change. Best
   * effort: it never throws, and the shell deletes every blob of the session when the session ends anyway.
   */
  releaseBlob(blobRef: BlobRef): Promise<void>;
}

/**
 * The error result for a reply the client could not use: the transport failed, the call threw, the reply
 * does not match the contract, or no reply came before the client's deadline. It is `device-error` /
 * `device-fault` with the call's flags, so after a print or a payment the screen says the outcome is unknown
 * and nothing repeats the call. hal.kiosk.lock and hal.capabilities cannot return a device error, so for them
 * it is `unavailable` / `not-implemented`: the call cannot be used with this shell.
 *
 * The audit ID is always a fresh one that names no record (OQ-157, KA-040). It is never the reply's own: the
 * shell's record of that reply may say `ok`, or another kind, and the result and its record must agree on the
 * outcome (README, "Fixtures", cross-checks). Contract v1 lets hal-client write records only for its no-shell
 * refusal, so the client writes none for this error.
 */
export function unusableReply<C extends CallName>(call: C): HalCallResult<C> {
  const error = isKindOfCall(call, 'device-error')
    ? halError(call, 'device-error', 'device-fault')
    : halError(call, 'unavailable', 'not-implemented');
  return { ok: false, error, auditId: freshAuditId() };
}

/**
 * The error result for a request that does not match the contract, so it is never sent (a field outside the
 * contract must not cross the bridge). `invalid-request` / `invalid-request` where the call allows it; a
 * subscription has no invalid-request kind, so it is `not-permitted` / `capability-not-granted`;
 * hal.capabilities has only `unavailable`, so it is `unavailable` / `not-implemented`. None of these is
 * retryable: the same request would be refused again.
 */
export function refusedRequest<C extends CallName>(call: C): HalCallResult<C> {
  return { ok: false, error: refusedRequestError(call), auditId: freshAuditId() };
}

export function refusedRequestError(call: CallName): HalError {
  if (isKindOfCall(call, 'invalid-request')) {
    return halError(call, 'invalid-request', 'invalid-request');
  }
  if (isKindOfCall(call, 'not-permitted')) {
    return halError(call, 'not-permitted', 'capability-not-granted');
  }
  return halError(call, 'unavailable', 'not-implemented');
}

/**
 * The error result when the shell has not answered by the client's deadline: `timeout` / `device-timeout`
 * where the call allows it (with the call's flags, so the outcome of a print is unknown), otherwise the
 * unusable-reply error.
 */
export function deadlinePassed<C extends CallName>(call: C): HalCallResult<C> {
  return isKindOfCall(call, 'timeout')
    ? { ok: false, error: halError(call, 'timeout', 'device-timeout'), auditId: freshAuditId() }
    : unusableReply(call);
}

/** A UUIDv7 for a result the client makes itself; never throws (a broken clock falls back to time 0). */
export function freshAuditId(): AuditId {
  try {
    return uuid7();
  } catch {
    return uuid7(0);
  }
}
