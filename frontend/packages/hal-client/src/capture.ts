/**
 * Captures bound to the window's patient (docs/specs/hal/README.md, "Windows and patients";
 * docs/specs/modules/design-system.md §2.2; SI-16, CTRL-0016-6).
 *
 * The HAL request carries no patient identifier. Instead, when hal.camera.photo, hal.scan.document,
 * hal.id.read or hal.sign.capture is sent, the binding records the window's patient id and its last context
 * change (the change counter and the change time); when the result arrives it reads them again. If any of
 * them differs, or either reading fails, the result is discarded: the screen shows
 * `hal.capture.discardedAfterContextChange`, and a blob the result names is released. While the capture
 * waits, it holds the window's modal guard and counts as waiting (`waiting()`, for the patient-context
 * machine's `isHalCaptureWaiting`), so no patient switch starts meanwhile (the noModalOpen guard).
 */
import type { AuditId, CaptureCallName, HalCallResult, HalRequest } from './contract.ts';
import type { HalTransport } from './transport.ts';

export const CAPTURE_DISCARDED_MESSAGE_KEY = 'hal.capture.discardedAfterContextChange';

/**
 * The window's patient context as the binding reads it. From ui-core's patient-context snapshot:
 * `patientId` is `snapshot.patient?.patientId ?? null`, `changeVersion` is `snapshot.lastChange.version` and
 * `changedAt` is `snapshot.lastChange.monotonicMs ?? null`.
 */
export interface WindowPatientContext {
  /** The patient of the window, or null when no patient is open. */
  readonly patientId: string | null;
  /** Counts the window's patient-context changes; null when unknown. */
  readonly changeVersion: number | null;
  /** The monotonic time of the window's last patient-context change; null when unknown. */
  readonly changedAt: number | null;
}

export interface CaptureBindingOptions {
  readonly transport: HalTransport;
  /** Reads the window's patient context now. */
  readonly context: () => WindowPatientContext;
  /**
   * Takes the window's modal guard for the time the capture waits and returns its release. When it throws
   * (another modal is open), the capture is not sent and the error propagates, as for a stacked modal.
   */
  readonly holdModalGuard?: () => () => void;
}

export type CaptureOutcome<C extends CaptureCallName> =
  | { readonly status: 'delivered'; readonly result: HalCallResult<C> }
  | {
      readonly status: 'discarded';
      readonly messageKey: typeof CAPTURE_DISCARDED_MESSAGE_KEY;
      /** The audit ID of the call whose result was discarded. */
      readonly auditId: AuditId;
    };

export interface CaptureBinding {
  capture<C extends CaptureCallName>(call: C, request: HalRequest<C>): Promise<CaptureOutcome<C>>;
  /** How many captures of this window are waiting for a device. */
  waiting(): number;
}

function readContext(context: () => WindowPatientContext): WindowPatientContext | null {
  try {
    const { patientId, changeVersion, changedAt } = context();
    return { patientId, changeVersion, changedAt };
  } catch {
    return null;
  }
}

/**
 * Whether the result still belongs to the window: both readings succeeded and name the same patient and
 * the same last change. With a patient open and neither the change counter nor the change time known,
 * nothing proves that the context did not change, so it does not count as the same (fails closed).
 */
function sameContext(before: WindowPatientContext | null, after: WindowPatientContext | null): boolean {
  if (before === null || after === null) {
    return false;
  }
  if (
    before.patientId !== after.patientId ||
    before.changeVersion !== after.changeVersion ||
    before.changedAt !== after.changedAt
  ) {
    return false;
  }
  return before.patientId === null || before.changeVersion !== null || before.changedAt !== null;
}

function blobOf(result: HalCallResult<CaptureCallName>): string | null {
  if (!result.ok) {
    return null;
  }
  return 'blobRef' in result.value ? result.value.blobRef : null;
}

export function createCaptureBinding(options: CaptureBindingOptions): CaptureBinding {
  const { transport, context } = options;
  let waiting = 0;
  return {
    async capture<C extends CaptureCallName>(call: C, request: HalRequest<C>): Promise<CaptureOutcome<C>> {
      const release = options.holdModalGuard?.() ?? (() => undefined);
      waiting += 1;
      let result: HalCallResult<C>;
      let before: WindowPatientContext | null;
      try {
        before = readContext(context);
        result = await transport.call(call, request);
      } finally {
        waiting -= 1;
        release();
      }
      if (sameContext(before, readContext(context))) {
        return { status: 'delivered', result };
      }
      const blobRef = blobOf(result);
      if (blobRef !== null) {
        await transport.releaseBlob(blobRef);
      }
      return { status: 'discarded', messageKey: CAPTURE_DISCARDED_MESSAGE_KEY, auditId: result.auditId };
    },
    waiting: () => waiting,
  };
}
