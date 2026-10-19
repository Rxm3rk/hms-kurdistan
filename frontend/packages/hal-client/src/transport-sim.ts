/**
 * A simulated shell for tests and the demo (§3.7: simulators before partners; KA-035: simulated devices
 * only). It answers as the WP-0.7 shell does: it checks each request against the contract, returns typed
 * results with UUIDv7 audit IDs, writes one audit record (`writtenBy: shell`) per call and per event, and
 * returns `unavailable` / `not-implemented` for hal.id.read and hal.pay.request (KA-027). Every result and
 * record it produces is checked against the contract, so the simulator cannot drift from it.
 *
 * Its devices are those of fixture hal.capabilities.ok. Scripts replace the default answer of a call, for
 * example with an error or with a promise that a test resolves later. Barcode reads reach the subscriptions
 * only while the simulated window has the focus; badge taps always do (README, "Windows and patients").
 * All data is synthetic, NOT FOR CLINICAL USE.
 */
import {
  auditRecordSchema,
  halError,
  HAL_CONTRACT_VERSION,
  NOT_IMPLEMENTED_CALLS,
  opaqueIdSchema,
  parseEvent,
  parseRequest,
  parseResult,
  type AuditRecord,
  type BlobRef,
  type CallName,
  type ErrorKind,
  type ErrorReason,
  type HalCallResult,
  type HalError,
  type HalEvent,
  type HalRequest,
  type HalValue,
  type RequestCallName,
  type SubscriptionCallName,
} from './contract.ts';
import { refusedRequestError, type HalSubscription, type HalTransport } from './transport.ts';
import { uuid7 } from './uuid7.ts';

/** What a script answers: a value, or an error by kind and reason (the flags follow from the contract). */
export type SimOutcome<C extends CallName> =
  | { readonly ok: true; readonly value: HalValue<C> }
  | { readonly ok: false; readonly kind: ErrorKind; readonly reason: ErrorReason };

type ScriptableCall = Exclude<RequestCallName, 'hal.id.read' | 'hal.pay.request'>;

/** An error instead of opening a subscription. */
export interface SimSubscriptionFailure {
  readonly kind: ErrorKind;
  readonly reason: ErrorReason;
}

/** Replaces the default answer of a call. hal.id.read and hal.pay.request cannot be scripted (KA-027). */
export type SimScript = {
  readonly [C in ScriptableCall]?: (request: HalRequest<C>) => SimOutcome<C> | Promise<SimOutcome<C>>;
} & Partial<Record<SubscriptionCallName, () => SimSubscriptionFailure | null>>;

export interface SimTransportOptions {
  readonly workstationId?: string;
  readonly sessionRef?: () => string | null;
  readonly audit?: (record: AuditRecord) => void;
  readonly now?: () => Date;
  readonly script?: SimScript;
}

export interface SimBarcodeRead {
  readonly deviceId?: string;
  readonly symbology: HalEvent<'hal.scan.onBarcode'>['symbology'];
  readonly aimId?: string;
  readonly data: string;
}

export interface SimBadgeTap {
  readonly readerId?: string;
  readonly outcome: HalEvent<'hal.auth.onBadge'>['outcome'];
}

export interface SimTransport extends HalTransport {
  readonly kind: 'sim';
  /** A read from the simulated scanner; delivered only while the window has the focus. */
  emitBarcode(read: SimBarcodeRead): void;
  /** A tap on the simulated badge reader after a simulated step-up (KA-032); delivered to every window. */
  emitBadge(tap: SimBadgeTap): void;
  /** Whether the simulated window has the input focus (true at first). */
  setFocused(focused: boolean): void;
  /** Blob handles the simulator holds, and those released. */
  heldBlobs(): ReadonlySet<BlobRef>;
  releasedBlobs(): ReadonlySet<BlobRef>;
}

export const SIM_DEVICES = {
  labelPrinter: 'SIM-LABEL-01',
  rawPrinter: 'SIM-RAW-01',
  documentPrinter: 'SIM-DOC-01',
  barcodeScanner: 'SIM-SCANNER-01',
  documentScanner: 'SIM-DOCSCAN-01',
  badgeReader: 'SIM-BADGE-01',
  signaturePad: 'SIM-SIGNPAD-01',
  camera: 'SIM-CAMERA-01',
} as const;

const SIM_SHELL_VERSION = '0.1.0';

/** The simulated workstation profile, as fixture hal.capabilities.ok. */
function simCapabilities(): HalValue<'hal.capabilities'> {
  const device = (
    deviceId: string,
    deviceClass: HalValue<'hal.capabilities'>['devices'][number]['class'],
  ): HalValue<'hal.capabilities'>['devices'][number] => ({
    deviceId,
    class: deviceClass,
    status: 'healthy',
    permitted: true,
    simulated: true,
  });
  return {
    contractVersion: HAL_CONTRACT_VERSION,
    supportedContractVersions: [HAL_CONTRACT_VERSION],
    shell: { version: SIM_SHELL_VERSION, simulated: true },
    workstationProfile: 'SYN-PROFILE-WARD-NURSE',
    devices: [
      device(SIM_DEVICES.labelPrinter, 'label-printer'),
      device(SIM_DEVICES.rawPrinter, 'raw-printer'),
      device(SIM_DEVICES.documentPrinter, 'document-printer'),
      device(SIM_DEVICES.barcodeScanner, 'barcode-scanner'),
      device(SIM_DEVICES.documentScanner, 'document-scanner'),
      device(SIM_DEVICES.badgeReader, 'badge-reader'),
      device(SIM_DEVICES.signaturePad, 'signature-pad'),
      device(SIM_DEVICES.camera, 'camera'),
    ],
    calls: {
      'hal.print.label': 'available',
      'hal.print.raw': 'available',
      'hal.print.document': 'available',
      'hal.scan.onBarcode': 'available',
      'hal.scan.document': 'available',
      'hal.id.read': 'not-implemented',
      'hal.auth.onBadge': 'available',
      'hal.sign.capture': 'available',
      'hal.pay.request': 'not-implemented',
      'hal.camera.photo': 'available',
      'hal.kiosk.lock': 'available',
      'hal.capabilities': 'available',
    },
  };
}

/** The number of bytes a request's content stands for, without decoding it into memory twice. */
function contentByteLength(content: string, encoding: 'utf-8' | 'base64'): number {
  if (encoding === 'utf-8') {
    return new TextEncoder().encode(content).length;
  }
  const padding = content.endsWith('==') ? 2 : content.endsWith('=') ? 1 : 0;
  return Math.max(1, Math.floor((content.length * 3) / 4) - padding);
}

/** The optional fields of an audit record that the simulator fills in; undefined ones are left out. */
type AuditExtras = {
  readonly [K in 'event' | 'deviceId' | 'jobId' | 'templateId' | 'templateVersion' | 'reprintOf']?:
    AuditRecord[K] | undefined;
};

interface OpenSubscription {
  readonly call: SubscriptionCallName;
  readonly subscriptionId: string;
  readonly deviceId: string | undefined;
  readonly onEvent: (event: unknown) => void;
  open: boolean;
}

export function createSimTransport(options: SimTransportOptions = {}): SimTransport {
  const workstationId = options.workstationId ?? 'SIM-WS-0001';
  const sessionRef = options.sessionRef ?? (() => 'SIM-SESSION-0001');
  const audit = options.audit ?? (() => undefined);
  const now = options.now ?? (() => new Date());
  const script: SimScript = options.script ?? {};
  const subscriptions: OpenSubscription[] = [];
  const held = new Set<BlobRef>();
  const released = new Set<BlobRef>();
  let focused = true;

  /** The simulated shell's clock; the system clock when the injected one fails or gives no valid time. */
  const currentTime = (): Date => {
    try {
      const at = now();
      if (at instanceof Date && Number.isFinite(at.getTime()) && at.getTime() >= 0) {
        return at;
      }
    } catch {
      // Falls through to the system clock.
    }
    return new Date();
  };
  const newId = (): string => uuid7(currentTime().getTime());
  /** The session reference when it is a well-formed opaque identifier, otherwise null (as transport-none). */
  const currentSessionRef = (): string | null => {
    try {
      const ref = sessionRef();
      return opaqueIdSchema.safeParse(ref).success ? ref : null;
    } catch {
      return null;
    }
  };
  const newBlob = (): BlobRef => {
    const blobRef: BlobRef = `hal-blob:${newId()}`;
    held.add(blobRef);
    return blobRef;
  };
  /** A synthetic SHA-256-shaped value: the simulator holds no bytes. */
  const syntheticSha256 = (): string => (newId() + newId()).replace(/-/g, '');

  function writeAudit(record: AuditRecord): void {
    const checked = auditRecordSchema.parse(record);
    try {
      audit(checked);
    } catch {
      // The simulator's audit sink failing does not change the call's result.
    }
  }

  function record(call: CallName, auditId: string, error: HalError | null, extra: AuditExtras): void {
    const base: AuditRecord = {
      auditId,
      writtenBy: 'shell',
      contractVersion: HAL_CONTRACT_VERSION,
      call,
      at: currentTime().toISOString(),
      outcome: error === null ? 'ok' : 'error',
      workstationId,
      sessionRef: currentSessionRef(),
    };
    const withError: AuditRecord =
      error === null ? base : { ...base, errorKind: error.kind, errorReason: error.reason };
    const extras = Object.fromEntries(Object.entries(extra).filter(([, value]) => value !== undefined));
    writeAudit({ ...withError, ...extras });
  }

  /** The default answer of the simulated shell. */
  function defaultOutcome<C extends RequestCallName>(call: C, request: HalRequest<C>): SimOutcome<C> {
    const answer = (value: HalValue<RequestCallName>): SimOutcome<C> =>
      ({ ok: true, value }) as SimOutcome<C>; // value is HalValue<C> for the case that builds it
    switch (call) {
      case 'hal.id.read':
      case 'hal.pay.request':
        return { ok: false, kind: 'unavailable', reason: 'not-implemented' };
      case 'hal.print.label': {
        const label = request as HalRequest<'hal.print.label'>;
        return answer({
          jobId: newId(),
          printerId: label.printerId ?? SIM_DEVICES.labelPrinter,
          status: 'sent',
        });
      }
      case 'hal.print.document': {
        const document = request as HalRequest<'hal.print.document'>;
        return answer({
          jobId: newId(),
          printerId: document.printerId ?? SIM_DEVICES.documentPrinter,
          status: 'sent',
        });
      }
      case 'hal.print.raw': {
        const raw = request as HalRequest<'hal.print.raw'>;
        return answer({
          jobId: newId(),
          printerId: raw.printerId,
          bytesSent: contentByteLength(raw.content, raw.contentEncoding),
        });
      }
      case 'hal.scan.document': {
        const scan = request as HalRequest<'hal.scan.document'>;
        return answer({
          mediaType: scan.mediaType,
          blobRef: newBlob(),
          sha256: syntheticSha256(),
          byteLength: 1024,
          pageCount: 1,
        });
      }
      case 'hal.sign.capture':
        return answer({
          mediaType: 'image/svg+xml',
          blobRef: newBlob(),
          sha256: syntheticSha256(),
          byteLength: 512,
          strokeCount: 1,
          capturedAt: currentTime().toISOString(),
        });
      case 'hal.camera.photo':
        return answer({
          mediaType: 'image/jpeg',
          blobRef: newBlob(),
          sha256: syntheticSha256(),
          byteLength: 2048,
          widthPx: 640,
          heightPx: 480,
        });
      case 'hal.kiosk.lock':
        return answer({ state: (request as HalRequest<'hal.kiosk.lock'>).state });
      case 'hal.capabilities':
        return answer(simCapabilities());
    }
  }

  /**
   * The device and print fields the shell's audit record keeps for a call (no payload). `request` is a
   * request that passed the contract's check, or undefined for a refused one: nothing of a refused request
   * reaches the record.
   */
  function auditExtras(call: CallName, request: unknown, value: unknown): AuditExtras {
    const field = (source: unknown, name: string): string | undefined => {
      if (typeof source === 'object' && source !== null && name in source) {
        const fieldValue: unknown = (source as Record<string, unknown>)[name];
        return typeof fieldValue === 'string' ? fieldValue : undefined;
      }
      return undefined;
    };
    switch (call) {
      case 'hal.print.label':
      case 'hal.print.document':
        return {
          deviceId: field(value, 'printerId') ?? field(request, 'printerId'),
          jobId: field(value, 'jobId'),
          templateId: field(request, 'templateId'),
          templateVersion: field(request, 'templateVersion'),
          reprintOf: field(request, 'reprintOf'),
        };
      case 'hal.print.raw':
        return { deviceId: field(request, 'printerId'), jobId: field(value, 'jobId') };
      case 'hal.kiosk.lock':
      case 'hal.capabilities':
        return {};
      default:
        return { deviceId: field(request, 'deviceId') ?? field(request, 'terminalId') };
    }
  }

  function finish<C extends CallName>(
    call: C,
    request: HalRequest<C> | undefined,
    outcome: SimOutcome<C>,
  ): HalCallResult<C> {
    const auditId = newId();
    const reply = outcome.ok
      ? { ok: true, value: outcome.value, auditId }
      : { ok: false, error: halError(call, outcome.kind, outcome.reason), auditId };
    const result = parseResult(call, reply);
    if (result === null) {
      throw new Error(`transport-sim: the simulated answer to ${call} does not match the contract`);
    }
    record(
      call,
      auditId,
      result.ok ? null : result.error,
      auditExtras(call, request, result.ok ? result.value : undefined),
    );
    return result;
  }

  /** Delivers an event to every open subscription of the call that listens to the device. */
  function emit(
    call: SubscriptionCallName,
    device: string | undefined,
    build: (subscription: OpenSubscription) => unknown,
  ): void {
    for (const subscription of subscriptions) {
      const listens =
        subscription.deviceId === undefined || device === undefined || subscription.deviceId === device;
      if (!subscription.open || subscription.call !== call || !listens) {
        continue;
      }
      const event = parseEvent(call, build(subscription));
      if (event === null) {
        throw new Error(`transport-sim: the simulated ${call} event does not match the contract`);
      }
      const isRefusal =
        call === 'hal.auth.onBadge' && 'outcome' in event && event.outcome === 'step-up-refused';
      record(call, event.auditId, isRefusal ? halError(call, 'not-permitted', 'step-up-refused') : null, {
        event: call === 'hal.scan.onBarcode' ? 'barcode-read' : 'badge-tap',
        deviceId: 'deviceId' in event ? event.deviceId : 'readerId' in event ? event.readerId : undefined,
      });
      try {
        subscription.onEvent(event);
      } catch {
        // A failing handler does not stop delivery to the other subscriptions.
      }
    }
  }

  /** The answer to a request that does not match the contract (transport.ts, refusedRequestError). */
  function refusal<C extends CallName>(call: C): SimOutcome<C> {
    const { kind, reason } = refusedRequestError(call);
    return { ok: false, kind, reason };
  }

  return {
    kind: 'sim',

    async call<C extends RequestCallName>(call: C, request: HalRequest<C>): Promise<HalCallResult<C>> {
      const checked = parseRequest(call, request);
      if (checked === null) {
        return finish(call, undefined, refusal(call));
      }
      if (NOT_IMPLEMENTED_CALLS.has(call)) {
        return finish(call, checked, defaultOutcome(call, checked));
      }
      const scripted = script[call as ScriptableCall] as
        ((request: HalRequest<C>) => SimOutcome<C> | Promise<SimOutcome<C>>) | undefined;
      const outcome = scripted === undefined ? defaultOutcome(call, checked) : await scripted(checked);
      return finish(call, checked, outcome);
    },

    subscribe<C extends SubscriptionCallName>(
      call: C,
      request: HalRequest<C>,
      onEvent: (event: HalEvent<C>) => void,
    ): Promise<HalSubscription<C>> {
      const checked = parseRequest(call, request);
      if (checked === null) {
        return Promise.resolve({ result: finish(call, undefined, refusal(call)), close: () => undefined });
      }
      const failure = script[call]?.();
      if (failure !== undefined && failure !== null) {
        const outcome: SimOutcome<C> = { ok: false, kind: failure.kind, reason: failure.reason };
        return Promise.resolve({ result: finish(call, checked, outcome), close: () => undefined });
      }
      const subscriptionId = newId();
      const subscription: OpenSubscription = {
        call,
        subscriptionId,
        deviceId: checked.deviceId,
        onEvent: onEvent as (event: unknown) => void,
        open: true,
      };
      const result = finish(call, checked, { ok: true, value: { subscriptionId } } as SimOutcome<C>);
      subscriptions.push(subscription);
      return Promise.resolve({
        result,
        close: () => {
          subscription.open = false;
        },
      });
    },

    releaseBlob(blobRef: BlobRef): Promise<void> {
      if (held.delete(blobRef)) {
        released.add(blobRef);
      }
      return Promise.resolve();
    },

    emitBarcode(read: SimBarcodeRead): void {
      if (!focused) {
        // The shell delivers a read only to the focused window; with no focused window, to none.
        return;
      }
      emit('hal.scan.onBarcode', read.deviceId, (subscription) => ({
        subscriptionId: subscription.subscriptionId,
        deviceId: read.deviceId ?? subscription.deviceId ?? SIM_DEVICES.barcodeScanner,
        symbology: read.symbology,
        ...(read.aimId === undefined ? {} : { aimId: read.aimId }),
        data: read.data,
        auditId: newId(),
      }));
    },

    emitBadge(tap: SimBadgeTap): void {
      emit('hal.auth.onBadge', tap.readerId, (subscription) => ({
        subscriptionId: subscription.subscriptionId,
        readerId: tap.readerId ?? subscription.deviceId ?? SIM_DEVICES.badgeReader,
        outcome: tap.outcome,
        // A synthetic single-use reference; the simulated step-up stands in for WP-0.4's (KA-032).
        ...(tap.outcome === 'step-up-completed'
          ? { stepUpRef: `SYN-STEPUP-${newId().replace(/-/g, '')}` }
          : {}),
        auditId: newId(),
      }));
    },

    setFocused(value: boolean): void {
      focused = value;
    },

    heldBlobs: () => new Set(held),
    releasedBlobs: () => new Set(released),
  };
}
