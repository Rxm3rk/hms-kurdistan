/**
 * The transport when no shell is present (a plain browser): every call fails closed with
 * `unavailable` / `no-shell`, hal.capabilities, hal.id.read and hal.pay.request included. It cannot know
 * what a shell would implement, and "no shell" is what the user can act on (README, "Fail closed").
 * Printing without the shell therefore fails too; there is no site print service yet (KA-028).
 *
 * hal-client writes its own audit record for each refusal (`writtenBy: hal-client`, the only records it
 * writes). The record has no workstation, because without the shell there is none, and nothing from the
 * request: the request is never read, so no payload can reach the record.
 */
import {
  halError,
  HAL_CONTRACT_VERSION,
  type AuditRecord,
  type CallName,
  opaqueIdSchema,
  UUID7_PATTERN,
  type HalCallResult,
  type RequestCallName,
  type SubscriptionCallName,
} from './contract.ts';
import type { HalSubscription, HalTransport } from './transport.ts';
import { uuid7 } from './uuid7.ts';

export interface NoShellTransportOptions {
  /** The opaque staff-session reference for the audit record; null before sign-in (the default). */
  readonly sessionRef?: () => string | null;
  /** Receives each audit record. The default keeps nothing; WP-0.4 brings the audit store (KA-034). */
  readonly audit?: (record: AuditRecord) => void;
  /** The wall clock for the record's time. */
  readonly now?: () => Date;
  /** The UUIDv7 source, for tests. */
  readonly newId?: (unixMs: number) => string;
}

export function createNoShellTransport(options: NoShellTransportOptions = {}): HalTransport {
  const sessionRef = options.sessionRef ?? (() => null);
  const audit = options.audit ?? (() => undefined);
  const now = options.now ?? (() => new Date());
  const newId = options.newId ?? ((unixMs: number) => uuid7(unixMs));

  /** The session reference when it is a well-formed opaque identifier, otherwise null (fails closed). */
  function currentSessionRef(): string | null {
    try {
      const ref = sessionRef();
      return opaqueIdSchema.safeParse(ref).success ? ref : null;
    } catch {
      return null;
    }
  }

  /** The record's time: the injected clock, or the system clock when that fails or gives no valid time. */
  function currentTime(): Date {
    try {
      const at = now();
      if (at instanceof Date && Number.isFinite(at.getTime()) && at.getTime() >= 0) {
        return at;
      }
    } catch {
      // Falls through to the system clock.
    }
    return new Date();
  }

  /** A UUIDv7 for the refusal: the injected source, or the built-in one when that fails or is malformed. */
  function refusalId(unixMs: number): string {
    try {
      const id = newId(unixMs);
      if (UUID7_PATTERN.test(id)) {
        return id;
      }
    } catch {
      // Falls through to the built-in generator.
    }
    return uuid7();
  }

  function refuse<C extends CallName>(call: C): HalCallResult<C> {
    const at = currentTime();
    const error = halError(call, 'unavailable', 'no-shell');
    const auditId = refusalId(at.getTime());
    const record: AuditRecord = {
      auditId,
      writtenBy: 'hal-client',
      contractVersion: HAL_CONTRACT_VERSION,
      call,
      at: at.toISOString(),
      outcome: 'error',
      errorKind: error.kind,
      errorReason: error.reason,
      workstationId: null,
      sessionRef: currentSessionRef(),
    };
    try {
      audit(record);
    } catch {
      // A failing audit sink must not turn the refusal into an exception; the call is refused either way.
    }
    return { ok: false, error, auditId };
  }

  return {
    kind: 'none',
    // The request and the event handler are never read: no payload reaches the record, and no event comes.
    // The refusal is built inside the promise, so nothing can escape call() as a synchronous exception.
    call<C extends RequestCallName>(call: C): Promise<HalCallResult<C>> {
      return new Promise((resolve) => {
        resolve(refuse(call));
      });
    },
    subscribe<C extends SubscriptionCallName>(call: C): Promise<HalSubscription<C>> {
      return new Promise((resolve) => {
        resolve({ result: refuse(call), close: () => undefined });
      });
    },
    releaseBlob(): Promise<void> {
      // Without a shell there are no blobs to release.
      return Promise.resolve();
    },
  };
}
