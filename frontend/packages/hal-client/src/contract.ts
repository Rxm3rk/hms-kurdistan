/**
 * HAL contract v1 as TypeScript types and Zod schemas (docs/specs/hal/README.md, hal-v1.schema.json;
 * BUILD-PROMPT.md §12.8, §13.5; OQ-150).
 *
 * The JSON Schema is the contract of record. These schemas repeat it so that the client can check every
 * reply from the shell at run time without shipping a JSON Schema validator; the `hal-contract-fixtures`
 * test validates every fixture with both and checks that they agree. Every object is closed (strict), so a
 * field outside the contract cannot carry data across the bridge in either direction.
 *
 * Every call returns {ok: true, value, auditId} or {ok: false, error, auditId}, and nothing else. An error
 * carries no display text and no device output: the UI shows the catalogue text for its message keys.
 */
import { z } from 'zod';

/** The contract version this client implements. Version 1 changes only by addition (README, "Versioning"). */
export const HAL_CONTRACT_VERSION = 1;

// ---------------------------------------------------------------------------------------------- primitives

/** A UUIDv7 in lower-case canonical form. */
export const UUID7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const uuid7Schema = z.string().regex(UUID7_PATTERN);
/** The identifier of the audit record a call or an event produced. */
export const auditIdSchema = uuid7Schema;
export const utcTimestampSchema = z
  .string()
  .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,9})?Z$/);
export const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);
/** A handle to bytes the shell holds for the session (a scan, a photo or a signature). */
export const blobRefSchema = z
  .string()
  .regex(/^hal-blob:[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
/** An opaque identifier of a device, printer, terminal, workstation, template or session; never a patient's. */
export const opaqueIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/);
/** A message key of the @hms/i18n catalogues. */
export const messageKeySchema = z.string().regex(/^[a-z][a-zA-Z0-9-]*(?:\.[a-z][a-zA-Z0-9-]*)+$/);
/** A non-negative decimal amount as a string. Nothing in the client or the shell computes with it. */
export const decimalAmountSchema = z.string().regex(/^(0|[1-9][0-9]{0,14})(\.[0-9]{1,3})?$/);

export type Uuid7 = z.output<typeof uuid7Schema>;
export type AuditId = Uuid7;
export type BlobRef = z.output<typeof blobRefSchema>;

// ---------------------------------------------------------------------------------------------- calls

/** The twelve calls of §12.8, unchanged. */
export const CALL_NAMES = [
  'hal.print.label',
  'hal.print.raw',
  'hal.print.document',
  'hal.scan.onBarcode',
  'hal.scan.document',
  'hal.id.read',
  'hal.auth.onBadge',
  'hal.sign.capture',
  'hal.pay.request',
  'hal.camera.photo',
  'hal.kiosk.lock',
  'hal.capabilities',
] as const;
export type CallName = (typeof CALL_NAMES)[number];

/** The calls that open a subscription; each event carries its own audit ID. */
export const SUBSCRIPTION_CALLS = ['hal.scan.onBarcode', 'hal.auth.onBadge'] as const;
export type SubscriptionCallName = (typeof SUBSCRIPTION_CALLS)[number];
export type RequestCallName = Exclude<CallName, SubscriptionCallName>;

/**
 * The capture calls. hal-client binds each to the window's patient and discards a result that arrives after
 * the window's patient context changed (README, "Windows and patients").
 */
export const CAPTURE_CALLS = [
  'hal.camera.photo',
  'hal.scan.document',
  'hal.id.read',
  'hal.sign.capture',
] as const;
export type CaptureCallName = (typeof CAPTURE_CALLS)[number];

/**
 * Calls whose device may already have acted when a timeout or a device error comes back: the job may have
 * printed, the card may have been charged. Their errors then have outcomeUnknown true and retryable false.
 */
export const OUTCOME_UNKNOWN_CALLS: ReadonlySet<CallName> = new Set<CallName>([
  'hal.print.label',
  'hal.print.raw',
  'hal.print.document',
  'hal.pay.request',
]);

/**
 * Calls the shell does not implement in WP-0.7: it returns unavailable / not-implemented until the ID-card
 * and MRZ reader simulators (WP-1.2) and the card-terminal simulator (WP-1.9) exist (KA-027).
 */
export const NOT_IMPLEMENTED_CALLS: ReadonlySet<CallName> = new Set<CallName>([
  'hal.id.read',
  'hal.pay.request',
]);

export function isCallName(value: unknown): value is CallName {
  return typeof value === 'string' && (CALL_NAMES as readonly string[]).includes(value);
}

export function isSubscriptionCall(call: CallName): call is SubscriptionCallName {
  return (SUBSCRIPTION_CALLS as readonly string[]).includes(call);
}

export function isCaptureCall(call: CallName): call is CaptureCallName {
  return (CAPTURE_CALLS as readonly string[]).includes(call);
}

// ---------------------------------------------------------------------------------------------- errors

export const ERROR_KINDS = [
  'unavailable',
  'not-permitted',
  'invalid-request',
  'device-error',
  'timeout',
  'cancelled',
] as const;
export type ErrorKind = (typeof ERROR_KINDS)[number];

export const ERROR_REASONS = [
  'no-shell',
  'not-implemented',
  'no-device',
  'capability-not-granted',
  'step-up-refused',
  'invalid-request',
  'unsupported-format',
  'unknown-device',
  'device-offline',
  'media-out',
  'device-fault',
  'device-timeout',
  'user-timeout',
  'user-cancelled',
] as const;
export type ErrorReason = (typeof ERROR_REASONS)[number];

/** The reasons each kind allows (README, "Errors"). */
export const REASONS_BY_KIND = {
  unavailable: ['no-shell', 'not-implemented', 'no-device'],
  'not-permitted': ['capability-not-granted', 'step-up-refused'],
  'invalid-request': ['invalid-request', 'unsupported-format', 'unknown-device'],
  'device-error': ['device-offline', 'media-out', 'device-fault'],
  timeout: ['device-timeout', 'user-timeout'],
  cancelled: ['user-cancelled'],
} as const satisfies Record<ErrorKind, readonly ErrorReason[]>;

/** The catalogue key each kind carries. */
export const MESSAGE_KEY_BY_KIND = {
  unavailable: 'hal.error.unavailable',
  'not-permitted': 'hal.error.notPermitted',
  'invalid-request': 'hal.error.invalidRequest',
  'device-error': 'hal.error.deviceError',
  timeout: 'hal.error.timeout',
  cancelled: 'hal.error.cancelled',
} as const satisfies Record<ErrorKind, string>;
export type HalErrorMessageKey = (typeof MESSAGE_KEY_BY_KIND)[ErrorKind];

/** What the screen shows instead of the kind's message after a print or payment whose outcome is unknown. */
export const OUTCOME_UNKNOWN_MESSAGE_KEY = 'hal.error.outcomeUnknown';

/** The error kinds each call can return (the "Errors" column of the README's table of calls). */
const PRINT_KINDS = ['unavailable', 'not-permitted', 'invalid-request', 'device-error', 'timeout'] as const;
const SUBSCRIPTION_KINDS = ['unavailable', 'not-permitted', 'device-error'] as const;
export const ERROR_KINDS_BY_CALL = {
  'hal.print.label': PRINT_KINDS,
  'hal.print.raw': PRINT_KINDS,
  'hal.print.document': PRINT_KINDS,
  'hal.scan.onBarcode': SUBSCRIPTION_KINDS,
  'hal.scan.document': ERROR_KINDS,
  'hal.id.read': ERROR_KINDS,
  'hal.auth.onBadge': SUBSCRIPTION_KINDS,
  'hal.sign.capture': ERROR_KINDS,
  'hal.pay.request': ERROR_KINDS,
  'hal.camera.photo': ERROR_KINDS,
  'hal.kiosk.lock': ['unavailable', 'not-permitted', 'invalid-request'],
  'hal.capabilities': ['unavailable'],
} as const satisfies Record<CallName, readonly ErrorKind[]>;

export interface HalError {
  readonly kind: ErrorKind;
  readonly reason: ErrorReason;
  readonly retryable: boolean;
  readonly outcomeUnknown: boolean;
  readonly messageKey: HalErrorMessageKey;
}

export function isReasonOfKind(kind: ErrorKind, reason: ErrorReason): boolean {
  return (REASONS_BY_KIND[kind] as readonly ErrorReason[]).includes(reason);
}

export function isKindOfCall(call: CallName, kind: ErrorKind): boolean {
  return (ERROR_KINDS_BY_CALL[call] as readonly ErrorKind[]).includes(kind);
}

/** The retryable and outcomeUnknown flags, which the call and the kind fix. */
export function errorFlags(
  call: CallName,
  kind: ErrorKind,
): { readonly retryable: boolean; readonly outcomeUnknown: boolean } {
  switch (kind) {
    case 'unavailable':
    case 'not-permitted':
    case 'invalid-request':
      return { retryable: false, outcomeUnknown: false };
    case 'cancelled':
      return { retryable: true, outcomeUnknown: false };
    case 'device-error':
    case 'timeout':
      return OUTCOME_UNKNOWN_CALLS.has(call)
        ? { retryable: false, outcomeUnknown: true }
        : { retryable: true, outcomeUnknown: false };
  }
}

/**
 * Builds the one error the contract allows for a call, a kind and a reason. Throws on a combination the
 * contract does not allow: that is a defect in the caller, not a runtime condition.
 */
export function halError(call: CallName, kind: ErrorKind, reason: ErrorReason): HalError {
  if (!isKindOfCall(call, kind) || !isReasonOfKind(kind, reason)) {
    throw new Error(`HAL contract v1 has no error ${kind}/${reason} for ${call}`);
  }
  return { kind, reason, ...errorFlags(call, kind), messageKey: MESSAGE_KEY_BY_KIND[kind] };
}

/** The catalogue key of a reason: hal.reason.<reason in lower camel case>, for example hal.reason.noShell. */
export function reasonMessageKey(reason: ErrorReason): string {
  return `hal.reason.${reason.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())}`;
}

/**
 * The two catalogue keys a screen shows for an error: the message (hal.error.outcomeUnknown when the device
 * may already have acted, so the user checks the printer or terminal and nothing repeats the call on its
 * own) and the reason.
 */
export function errorMessageKeys(error: HalError): { readonly message: string; readonly reason: string } {
  return {
    message: error.outcomeUnknown ? OUTCOME_UNKNOWN_MESSAGE_KEY : error.messageKey,
    reason: reasonMessageKey(error.reason),
  };
}

/** The error schema of one call: kind, reason, flags and message key exactly as the contract ties them. */
export function errorSchemaFor(call: CallName) {
  return z
    .strictObject({
      kind: z.enum(ERROR_KINDS),
      reason: z.enum(ERROR_REASONS),
      retryable: z.boolean(),
      outcomeUnknown: z.boolean(),
      messageKey: z.enum(Object.values(MESSAGE_KEY_BY_KIND) as [HalErrorMessageKey, ...HalErrorMessageKey[]]),
    })
    .superRefine((error, ctx) => {
      if (!isKindOfCall(call, error.kind)) {
        ctx.addIssue({ code: 'custom', path: ['kind'], message: `${call} cannot return ${error.kind}` });
        return;
      }
      if (!isReasonOfKind(error.kind, error.reason)) {
        ctx.addIssue({
          code: 'custom',
          path: ['reason'],
          message: `${error.reason} is not a ${error.kind} reason`,
        });
      }
      if (error.messageKey !== MESSAGE_KEY_BY_KIND[error.kind]) {
        ctx.addIssue({
          code: 'custom',
          path: ['messageKey'],
          message: `wrong message key for ${error.kind}`,
        });
      }
      const flags = errorFlags(call, error.kind);
      if (error.retryable !== flags.retryable || error.outcomeUnknown !== flags.outcomeUnknown) {
        ctx.addIssue({
          code: 'custom',
          path: ['retryable'],
          message: `wrong flags for ${call} ${error.kind}`,
        });
      }
    });
}

// ---------------------------------------------------------------------------------------------- requests

const reprintOfSchema = uuid7Schema;
const contentSchema = z.string().min(1).max(1048576);

export const printLabelRequestSchema = z
  .strictObject({
    printerId: opaqueIdSchema.exactOptional(),
    labelType: z.enum(['wristband', 'specimen', 'medication', 'general']),
    format: z.enum(['zpl', 'pdf']),
    content: contentSchema,
    contentEncoding: z.enum(['utf-8', 'base64']),
    templateId: opaqueIdSchema,
    templateVersion: opaqueIdSchema,
    reprintOf: reprintOfSchema.exactOptional(),
    copies: z.int().min(1).max(10),
  })
  .superRefine((request, ctx) => {
    if (request.format === 'pdf' && request.contentEncoding !== 'base64') {
      ctx.addIssue({ code: 'custom', path: ['contentEncoding'], message: 'a PDF label is base64' });
    }
  });

export const printRawRequestSchema = z.strictObject({
  printerId: opaqueIdSchema,
  language: z.enum(['zpl', 'esc-pos']),
  content: contentSchema,
  contentEncoding: z.enum(['utf-8', 'base64']),
});

export const printDocumentRequestSchema = z.strictObject({
  printerId: opaqueIdSchema.exactOptional(),
  mediaType: z.literal('application/pdf'),
  content: z.string().min(1).max(33554432),
  contentEncoding: z.literal('base64'),
  templateId: opaqueIdSchema,
  templateVersion: opaqueIdSchema,
  reprintOf: reprintOfSchema.exactOptional(),
  copies: z.int().min(1).max(10),
  duplex: z.boolean(),
  tray: opaqueIdSchema.exactOptional(),
});

export const subscribeRequestSchema = z.strictObject({ deviceId: opaqueIdSchema.exactOptional() });

export const scanDocumentRequestSchema = z.strictObject({
  deviceId: opaqueIdSchema.exactOptional(),
  mediaType: z.enum(['application/pdf', 'image/png']),
  resolutionDpi: z.union([z.literal(150), z.literal(200), z.literal(300)]),
  colour: z.enum(['colour', 'greyscale', 'mono']),
  duplex: z.boolean(),
});

const idDocumentTypeSchema = z.enum(['national-card-barcode', 'residency-card-barcode', 'passport-mrz']);

export const idReadRequestSchema = z.strictObject({
  type: idDocumentTypeSchema,
  deviceId: opaqueIdSchema.exactOptional(),
});

export const signCaptureRequestSchema = z.strictObject({
  purpose: z.enum(['consent', 'receipt', 'document']),
  promptKey: messageKeySchema,
  deviceId: opaqueIdSchema.exactOptional(),
});

const currencySchema = z.enum(['IQD', 'USD']);

export const payRequestRequestSchema = z.strictObject({
  terminalId: opaqueIdSchema.exactOptional(),
  amount: decimalAmountSchema,
  currency: currencySchema,
  reference: opaqueIdSchema,
});

export const cameraPhotoRequestSchema = z.strictObject({
  purpose: z.enum(['patient-photo', 'clinical-photo', 'document']),
  deviceId: opaqueIdSchema.exactOptional(),
});

const kioskStateSchema = z.enum(['locked', 'unlocked']);
export const kioskLockRequestSchema = z.strictObject({ state: kioskStateSchema });
export const emptyRequestSchema = z.strictObject({});

// ---------------------------------------------------------------------------------------------- values

export const printJobValueSchema = z.strictObject({
  jobId: uuid7Schema,
  printerId: opaqueIdSchema,
  status: z.enum(['sent', 'completed']),
});

export const printRawValueSchema = z.strictObject({
  jobId: uuid7Schema,
  printerId: opaqueIdSchema,
  bytesSent: z.int().min(1),
});

export const subscriptionValueSchema = z.strictObject({ subscriptionId: uuid7Schema });

export const scanDocumentValueSchema = z.strictObject({
  mediaType: z.enum(['application/pdf', 'image/png']),
  blobRef: blobRefSchema,
  sha256: sha256Schema,
  byteLength: z.int().min(1),
  pageCount: z.int().min(1),
});

export const idReadValueSchema = z.strictObject({
  type: idDocumentTypeSchema,
  format: z.enum(['pdf417', 'qr', 'datamatrix', 'mrz-td1', 'mrz-td2', 'mrz-td3', 'other']),
  raw: z.string().min(1).max(8192),
  mrzCheckDigitsValid: z.boolean().exactOptional(),
});

export const signCaptureValueSchema = z.strictObject({
  mediaType: z.enum(['image/svg+xml', 'image/png']),
  blobRef: blobRefSchema,
  sha256: sha256Schema,
  byteLength: z.int().min(1),
  strokeCount: z.int().min(1),
  capturedAt: utcTimestampSchema,
});

export const payRequestValueSchema = z.strictObject({
  outcome: z.enum(['approved', 'declined']),
  amount: decimalAmountSchema,
  currency: currencySchema,
  terminalId: opaqueIdSchema,
  terminalTransactionId: opaqueIdSchema,
  batchId: opaqueIdSchema,
});

export const cameraPhotoValueSchema = z.strictObject({
  mediaType: z.enum(['image/jpeg', 'image/png']),
  blobRef: blobRefSchema,
  sha256: sha256Schema,
  byteLength: z.int().min(1),
  widthPx: z.int().min(1),
  heightPx: z.int().min(1),
});

export const kioskLockValueSchema = z.strictObject({ state: kioskStateSchema });

export const DEVICE_CLASSES = [
  'label-printer',
  'document-printer',
  'raw-printer',
  'barcode-scanner',
  'document-scanner',
  'id-reader',
  'badge-reader',
  'signature-pad',
  'payment-terminal',
  'camera',
] as const;

export const deviceSchema = z.strictObject({
  deviceId: opaqueIdSchema,
  class: z.enum(DEVICE_CLASSES),
  status: z.enum(['healthy', 'degraded', 'offline']),
  permitted: z.boolean(),
  simulated: z.boolean(),
  model: opaqueIdSchema.exactOptional(),
});

export const CALL_AVAILABILITIES = ['available', 'not-permitted', 'no-device', 'not-implemented'] as const;
const callAvailabilitySchema = z.enum(CALL_AVAILABILITIES);

export const capabilitiesValueSchema = z.strictObject({
  contractVersion: z.literal(HAL_CONTRACT_VERSION),
  supportedContractVersions: z
    .array(z.int().min(1))
    .min(1)
    .refine((versions) => new Set(versions).size === versions.length, 'contract versions repeat'),
  shell: z.strictObject({
    version: z.string().regex(/^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$/),
    simulated: z.boolean(),
  }),
  workstationProfile: opaqueIdSchema,
  devices: z.array(deviceSchema),
  calls: z.strictObject({
    'hal.print.label': callAvailabilitySchema,
    'hal.print.raw': callAvailabilitySchema,
    'hal.print.document': callAvailabilitySchema,
    'hal.scan.onBarcode': callAvailabilitySchema,
    'hal.scan.document': callAvailabilitySchema,
    'hal.id.read': callAvailabilitySchema,
    'hal.auth.onBadge': callAvailabilitySchema,
    'hal.sign.capture': callAvailabilitySchema,
    'hal.pay.request': callAvailabilitySchema,
    'hal.camera.photo': callAvailabilitySchema,
    'hal.kiosk.lock': callAvailabilitySchema,
    'hal.capabilities': callAvailabilitySchema,
  }),
});

// ---------------------------------------------------------------------------------------------- events

export const barcodeEventSchema = z.strictObject({
  subscriptionId: uuid7Schema,
  deviceId: opaqueIdSchema,
  symbology: z.enum(['code128', 'gs1-128', 'datamatrix', 'gs1-datamatrix', 'qr', 'pdf417', 'ean13', 'other']),
  aimId: z
    .string()
    .regex(/^\][A-Za-z][0-9A-Za-z]$/)
    .exactOptional(),
  /** Exactly as read, with GS1 FNC1 sent as the group separator U+001D. */
  data: z.string().min(1).max(4096),
  auditId: auditIdSchema,
});

export const badgeEventSchema = z
  .strictObject({
    subscriptionId: uuid7Schema,
    readerId: opaqueIdSchema,
    outcome: z.enum(['step-up-completed', 'step-up-refused']),
    /** Only on a completed step-up: opaque, single-use, short-lived. Never logged, never stored. */
    stepUpRef: z
      .string()
      .regex(/^[A-Za-z0-9_-]{16,128}$/)
      .exactOptional(),
    auditId: auditIdSchema,
  })
  .superRefine((event, ctx) => {
    if ((event.outcome === 'step-up-completed') !== (event.stepUpRef !== undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: ['stepUpRef'],
        message: 'stepUpRef only, and always, on completion',
      });
    }
  });

// ---------------------------------------------------------------------------------------------- audit

/**
 * The local audit record of one call or event: a closed allowlist with no PHI (H13, SI-20; CTRL-0020-7's
 * principle). No patient identifier or name, no payload content or hash, no credential, no amount.
 */
export const auditRecordSchema = z
  .strictObject({
    auditId: auditIdSchema,
    writtenBy: z.enum(['shell', 'hal-client']),
    contractVersion: z.literal(HAL_CONTRACT_VERSION),
    call: z.enum(CALL_NAMES),
    event: z.enum(['call', 'barcode-read', 'badge-tap']).exactOptional(),
    at: utcTimestampSchema,
    outcome: z.enum(['ok', 'error']),
    errorKind: z.enum(ERROR_KINDS).exactOptional(),
    errorReason: z.enum(ERROR_REASONS).exactOptional(),
    workstationId: opaqueIdSchema.nullable(),
    sessionRef: opaqueIdSchema.nullable(),
    deviceId: opaqueIdSchema.exactOptional(),
    jobId: uuid7Schema.exactOptional(),
    templateId: opaqueIdSchema.exactOptional(),
    templateVersion: opaqueIdSchema.exactOptional(),
    reprintOf: uuid7Schema.exactOptional(),
  })
  .superRefine((record, ctx) => {
    if (record.outcome === 'error') {
      if (record.errorKind === undefined || record.errorReason === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['errorKind'],
          message: 'an error record names its kind and reason',
        });
      } else if (!isReasonOfKind(record.errorKind, record.errorReason)) {
        ctx.addIssue({
          code: 'custom',
          path: ['errorReason'],
          message: 'reason does not belong to the kind',
        });
      }
    } else if (record.errorKind !== undefined || record.errorReason !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['errorKind'], message: 'an ok record has no error' });
    }
    // hal-client writes a record only for its own no-shell refusal, and only it writes those.
    if ((record.writtenBy === 'hal-client') !== (record.errorReason === 'no-shell')) {
      ctx.addIssue({
        code: 'custom',
        path: ['writtenBy'],
        message: 'hal-client writes exactly the no-shell records',
      });
    }
    const event = record.event ?? 'call';
    const allowed =
      event === 'call' ||
      (event === 'barcode-read' && record.call === 'hal.scan.onBarcode') ||
      (event === 'badge-tap' && record.call === 'hal.auth.onBadge');
    if (!allowed) {
      ctx.addIssue({
        code: 'custom',
        path: ['event'],
        message: `${event} is not an event of ${record.call}`,
      });
    }
  });
export type AuditRecord = z.output<typeof auditRecordSchema>;

// ---------------------------------------------------------------------------------------------- per call

export const REQUEST_SCHEMAS = {
  'hal.print.label': printLabelRequestSchema,
  'hal.print.raw': printRawRequestSchema,
  'hal.print.document': printDocumentRequestSchema,
  'hal.scan.onBarcode': subscribeRequestSchema,
  'hal.scan.document': scanDocumentRequestSchema,
  'hal.id.read': idReadRequestSchema,
  'hal.auth.onBadge': subscribeRequestSchema,
  'hal.sign.capture': signCaptureRequestSchema,
  'hal.pay.request': payRequestRequestSchema,
  'hal.camera.photo': cameraPhotoRequestSchema,
  'hal.kiosk.lock': kioskLockRequestSchema,
  'hal.capabilities': emptyRequestSchema,
} as const satisfies Record<CallName, z.ZodType>;

export const VALUE_SCHEMAS = {
  'hal.print.label': printJobValueSchema,
  'hal.print.raw': printRawValueSchema,
  'hal.print.document': printJobValueSchema,
  'hal.scan.onBarcode': subscriptionValueSchema,
  'hal.scan.document': scanDocumentValueSchema,
  'hal.id.read': idReadValueSchema,
  'hal.auth.onBadge': subscriptionValueSchema,
  'hal.sign.capture': signCaptureValueSchema,
  'hal.pay.request': payRequestValueSchema,
  'hal.camera.photo': cameraPhotoValueSchema,
  'hal.kiosk.lock': kioskLockValueSchema,
  'hal.capabilities': capabilitiesValueSchema,
} as const satisfies Record<CallName, z.ZodType>;

export const EVENT_SCHEMAS = {
  'hal.scan.onBarcode': barcodeEventSchema,
  'hal.auth.onBadge': badgeEventSchema,
} as const satisfies Record<SubscriptionCallName, z.ZodType>;

export type HalRequest<C extends CallName> = z.output<(typeof REQUEST_SCHEMAS)[C]>;
export type HalValue<C extends CallName> = z.output<(typeof VALUE_SCHEMAS)[C]>;
export type HalEvent<C extends SubscriptionCallName> = z.output<(typeof EVENT_SCHEMAS)[C]>;

/** What every HAL call returns, and nothing else. */
export type HalResult<V> =
  | { readonly ok: true; readonly value: V; readonly auditId: AuditId }
  | { readonly ok: false; readonly error: HalError; readonly auditId: AuditId };

export type HalCallResult<C extends CallName> = HalResult<HalValue<C>>;

/** The result schema of one call: the closed envelope, the call's value and the call's errors. */
export function resultSchemaFor<C extends CallName>(call: C) {
  return z.discriminatedUnion('ok', [
    z.strictObject({ ok: z.literal(true), value: VALUE_SCHEMAS[call], auditId: auditIdSchema }),
    z.strictObject({ ok: z.literal(false), error: errorSchemaFor(call), auditId: auditIdSchema }),
  ]);
}

/** Parses a reply as the result of a call; null when it does not match the contract. */
export function parseResult<C extends CallName>(call: C, reply: unknown): HalCallResult<C> | null {
  const parsed = resultSchemaFor(call).safeParse(reply);
  // The schema's output is the call's value and the contract's error, so this is HalCallResult<C>; the
  // indexed generic is beyond what TypeScript can relate on its own.
  return parsed.success ? (parsed.data as HalCallResult<C>) : null;
}

/** Parses a subscription event; null when it does not match the contract. */
export function parseEvent<C extends SubscriptionCallName>(call: C, event: unknown): HalEvent<C> | null {
  const parsed = EVENT_SCHEMAS[call].safeParse(event);
  return parsed.success ? (parsed.data as HalEvent<C>) : null;
}

/** Parses a request; null when it does not match the contract. */
export function parseRequest<C extends CallName>(call: C, request: unknown): HalRequest<C> | null {
  const parsed = REQUEST_SCHEMAS[call].safeParse(request);
  return parsed.success ? (parsed.data as HalRequest<C>) : null;
}
