/**
 * The patient context of one client window (BUILD-PROMPT.md §2.1 SI-16 clauses e and f, §6.5, §9.4):
 * the client machine of docs/specs/state-machines/patient-context.yaml, with the rules of
 * docs/specs/modules/design-system.md §2.2 and §2.3. Controls CTRL-0016-6 and CTRL-0016-7 (client part).
 *
 * - TRANSITIONS restates the YAML's transitions one for one (from, on, guard, to); a test reads the YAML and
 *   fails on any difference. PREDICATES implements each named predicate of the YAML once; the complements
 *   (`bannerIdentityInvalid`, `contextStableBeyondWindow`, ...) are defined as the negation of their base.
 * - transition() is a pure function of the snapshot, the event and the injected dependencies (the clock and
 *   the window's modal state), so property tests can drive it with a fake clock. Nothing is generated yet:
 *   WP-0.5 builds the generator, and the generated model must pass the same tests.
 * - This is the client half only. The server-side context and the server's refusal to sign without
 *   re-verification (CTRL-0016-1, CTRL-0016-7) are not built (KA-025); the 60 s window is a constant here
 *   until the WP-0.3 configuration chain.
 *
 * The readings it encodes are the stricter defaults of decisions DN-026, DN-027, DN-028 and DN-032, which are
 * the CSO's to confirm: the 60 s window is inclusive; an unknown change time, an unreadable clock or a
 * negative elapsed time counts as within the window; a re-verification counts only for the user who
 * confirmed it; "Not this patient" keeps the identity disputed until a change or a re-verification.
 */
import type { BannerModel } from './banner-model.ts';
import { readMonotonicMs, readWallTimeMs, type Clock } from './clock.ts';

// ---------------------------------------------------------------------------------------------------------
// States, events and the snapshot
// ---------------------------------------------------------------------------------------------------------

export const PATIENT_CONTEXT_STATES = [
  'no-patient',
  'patient-selected',
  'switch-pending-confirmation',
  're-verification-required',
  'signing',
  'submitting',
  'window-closed',
] as const;
export type PatientContextState = (typeof PATIENT_CONTEXT_STATES)[number];
export const TERMINAL_STATES: readonly PatientContextState[] = ['window-closed'];

/**
 * The re-verification window, 60 000 ms, read inclusively (DN-026). Vendor-locked: a tenant may lengthen it
 * and never shorten it (CTRL-0016-1).
 */
export const REVERIFICATION_WINDOW_MS = 60_000;

/** The window in force: a configured value is used only when it lengthens the vendor minimum. */
export function effectiveReverificationWindowMs(configuredMs?: number): number {
  if (
    configuredMs === undefined ||
    !Number.isFinite(configuredMs) ||
    configuredMs < REVERIFICATION_WINDOW_MS
  ) {
    return REVERIFICATION_WINDOW_MS;
  }
  return configuredMs;
}

/** A session user's id, as the Trust Plane will issue it (WP-0.4). */
export type UserId = string;

/** A patient the window holds or was asked to open. `banner` is null until its data has been loaded. */
export interface PatientCandidate {
  readonly patientId: string;
  readonly banner: BannerModel | null;
}

/** The window's last patient-context change. `version` counts changes; the times are unknown if unreadable. */
export interface ContextChange {
  readonly version: number;
  readonly monotonicMs: number | undefined;
  readonly wallTimeMs: number | undefined;
}

/** A confirmed re-verification: who confirmed it, after which change, and when. */
export interface Reverification {
  readonly contextVersion: number;
  readonly confirmedBy: UserId;
  readonly monotonicMs: number | undefined;
  readonly wallTimeMs: number | undefined;
}

export type SignKind = 'sign' | 'cosign';

/** The open sign or co-sign dialog. */
export interface SignSession {
  readonly kind: SignKind;
  /** Created when the sign step opened; every submission of this dialog reuses it (§6.2). */
  readonly idempotencyKey: string;
  /** The context the dialog was opened in (contextUnchangedSinceSignOpened). */
  readonly openedFor: { readonly patientId: string; readonly contextVersion: number };
  /** Whether this signature relies on a re-verification (reverificationHeldBySigner). */
  readonly reverificationDue: boolean;
}

export interface PatientContextSnapshot {
  readonly state: PatientContextState;
  /** The window's patient: none or exactly one (CTRL-0016-6). */
  readonly patient: PatientCandidate | null;
  /** The patient a pending switch would open; the current patient stays until the switch is confirmed. */
  readonly requested: PatientCandidate | null;
  /** The session user the context was opened under; a different session user clears it (DN-028). */
  readonly contextUser: UserId | null;
  readonly lastChange: ContextChange;
  /** The re-verification confirmed since the last change, if any. Cleared by every change. */
  readonly reverification: Reverification | null;
  /** The last answer in the re-verification step since the last change was "Not this patient" (DN-027). */
  readonly disputed: boolean;
  readonly sign: SignSession | null;
}

/** The empty window. */
export function initialPatientContext(): PatientContextSnapshot {
  return {
    state: 'no-patient',
    patient: null,
    requested: null,
    contextUser: null,
    lastChange: { version: 0, monotonicMs: undefined, wallTimeMs: undefined },
    reverification: null,
    disputed: false,
    sign: null,
  };
}

/** The outcome of authenticating the signer (WP-0.4's Trust Plane; simulated in the WP-0.7 demo). */
export type SignerAuthentication =
  | {
      readonly status: 'authenticated';
      readonly userId: UserId;
      /** A co-signature needs badge tap plus PIN (§12.8). */
      readonly factors: 'single' | 'badge-and-pin';
    }
  | { readonly status: 'failed' };

export type PatientContextEvent =
  /** A patient was requested: from a list, the command palette, a deep link or the browser history. */
  | { readonly type: 'SelectPatient'; readonly patient: PatientCandidate; readonly user: UserId }
  /**
   * Sent only by the confirm control of the switch confirmation, when the user activates it (never by a
   * default action or Enter alone), naming the requested patient the dialog showed.
   */
  | { readonly type: 'ConfirmSwitch'; readonly requestedPatientId: string }
  | { readonly type: 'CancelSwitch' }
  | { readonly type: 'ClosePatient' }
  | { readonly type: 'OpenSign'; readonly kind: SignKind }
  /**
   * Sent only by the "This is the right patient" control of the re-verification step, naming the patient the
   * step showed and the session user who activated it.
   */
  | { readonly type: 'Reverify'; readonly patientId: string; readonly confirmedBy: UserId }
  /** Sent only by the "Not this patient" control of the re-verification step. */
  | { readonly type: 'RejectPatient' }
  | { readonly type: 'CancelSign' }
  | { readonly type: 'SubmitSign'; readonly authentication: SignerAuthentication }
  | { readonly type: 'SignAccepted' }
  /**
   * The server refused the sign command. `reason` is the server's refusal code; only
   * `reverification-required` has a transition. Any other refusal is a rejection: send SignRejected.
   */
  | { readonly type: 'SignRefused'; readonly reason: string }
  | { readonly type: 'SignRejected' }
  | { readonly type: 'SignOutcomeUnknown' }
  | { readonly type: 'UserChanged'; readonly userId: UserId | null }
  | { readonly type: 'WindowClosed' };
export type PatientContextEventType = PatientContextEvent['type'];

/** What the machine needs to know about the window, read when a guard needs it. */
export interface WindowFacts {
  /** A modal dialog is open in this window (the design system's stack guard). */
  isModalOpen(): boolean;
  /** A HAL capture (photo, document scan, ID read, signature) is waiting for a device; it counts as a modal. */
  isHalCaptureWaiting(): boolean;
}

export interface PatientContextDeps {
  readonly clock: Clock;
  readonly window: WindowFacts;
  /**
   * A new idempotency key for a sign command (a random UUID); called once when a sign step opens. Each app
   * supplies its own source (the web app uses Web Crypto's randomUUID; the mobile app uses its platform's),
   * because ui-core assumes no platform API beyond ECMAScript (OQ-158).
   */
  readonly newIdempotencyKey: () => string;
  /** A configured window; only a value above REVERIFICATION_WINDOW_MS takes effect. */
  readonly reverificationWindowMs?: number;
}

/** The catalogue keys (design-system §10) the machine asks the shell to show. */
export type PatientContextMessageKey =
  | 'patientContext.switch.blockedByModal'
  | 'patientContext.switch.requestedInvalid'
  | 'patientContext.clearedByUserChange'
  | 'sign.blockedByBanner'
  | 'sign.reverify.rejected'
  | 'sign.reverify.signerDiffers'
  | 'sign.refused.reverify'
  | 'sign.contextChanged'
  | 'sign.done'
  | 'sign.failed'
  | 'sign.outcomeUnknown';

/**
 * The sign command's safety fields (CTRL-0016-7): the time of the last context change, the re-verification
 * and the idempotency key, so the server can refuse a signature without re-verification and never record one
 * twice. The server side is not built in WP-0.7 (KA-025). Wall-clock times are null when unreadable.
 */
export interface SignCommand {
  readonly kind: SignKind;
  readonly patientId: string;
  readonly signerUserId: UserId;
  readonly idempotencyKey: string;
  readonly lastContextChangeWallTimeMs: number | null;
  readonly reverification: { readonly confirmedBy: UserId; readonly wallTimeMs: number | null } | null;
}

export interface TransitionResult {
  readonly snapshot: PatientContextSnapshot;
  /** `refused` when no transition of the YAML applies; the snapshot is then unchanged. */
  readonly outcome: 'transitioned' | 'refused';
  /** A message for the user, if the spec names one for this outcome. */
  readonly messageKey: PatientContextMessageKey | undefined;
  /**
   * Set when the window's patient id changed: the shell clears the previous patient's query cache, and
   * discards device captures bound to the previous context.
   */
  readonly contextChange:
    { readonly previousPatientId: string | null; readonly patientId: string | null } | undefined;
  /** Set on SubmitSign → submitting: the command to send. */
  readonly signCommand: SignCommand | undefined;
}

// ---------------------------------------------------------------------------------------------------------
// Predicates: each named predicate of patient-context.yaml, implemented once
// ---------------------------------------------------------------------------------------------------------

interface GuardInput {
  readonly snapshot: PatientContextSnapshot;
  readonly event: PatientContextEvent;
  /** The monotonic clock, read once per event; undefined when unreadable. */
  readonly nowMs: number | undefined;
  readonly windowMs: number;
  readonly deps: PatientContextDeps;
}

function holdsCurrentBannerIdentity(snapshot: PatientContextSnapshot): boolean {
  const patient = snapshot.patient;
  const banner = patient?.banner ?? null;
  if (patient === null || banner === null) {
    return false;
  }
  return (
    banner.patientId.status === 'valid' &&
    banner.patientId.value === patient.patientId &&
    !banner.signingBlocked
  );
}

function holdsRequestedIdentity(snapshot: PatientContextSnapshot): boolean {
  const requested = snapshot.requested;
  const banner = requested?.banner ?? null;
  if (requested === null || banner === null) {
    return false;
  }
  return (
    banner.patientId.status === 'valid' &&
    banner.patientId.value === requested.patientId &&
    !banner.errorState
  );
}

function changedWithinWindow({ snapshot, nowMs, windowMs }: GuardInput): boolean {
  const changedAt = snapshot.lastChange.monotonicMs;
  if (changedAt === undefined || nowMs === undefined) {
    return true; // unknown change time or unreadable clock: fail closed
  }
  const elapsed = nowMs - changedAt;
  return elapsed < 0 || elapsed <= windowMs; // negative elapsed time fails closed; 60.000 s is inside
}

function reverifiedSinceChange({ snapshot }: GuardInput): boolean {
  return (
    snapshot.lastChange.monotonicMs !== undefined &&
    snapshot.reverification !== null &&
    snapshot.reverification.contextVersion === snapshot.lastChange.version
  );
}

function signerAuthenticatedFor({ snapshot, event }: GuardInput): boolean {
  if (event.type !== 'SubmitSign' || event.authentication.status !== 'authenticated') {
    return false;
  }
  const { userId, factors } = event.authentication;
  if (userId.length === 0 || snapshot.sign === null) {
    return false;
  }
  return snapshot.sign.kind === 'cosign' ? factors === 'badge-and-pin' : true;
}

function reverificationHeld({ snapshot, event }: GuardInput): boolean {
  const sign = snapshot.sign;
  if (sign === null || event.type !== 'SubmitSign' || event.authentication.status !== 'authenticated') {
    return false;
  }
  if (!sign.reverificationDue) {
    return true;
  }
  const reverification = snapshot.reverification;
  return (
    reverification !== null &&
    reverification.contextVersion === snapshot.lastChange.version &&
    reverification.confirmedBy === event.authentication.userId
  );
}

function contextUnchangedSinceOpen({ snapshot }: GuardInput): boolean {
  const sign = snapshot.sign;
  return (
    sign !== null &&
    snapshot.patient !== null &&
    snapshot.patient.patientId === sign.openedFor.patientId &&
    snapshot.lastChange.version === sign.openedFor.contextVersion
  );
}

function noModal({ deps }: GuardInput): boolean {
  try {
    return !deps.window.isModalOpen() && !deps.window.isHalCaptureWaiting();
  } catch {
    return false; // unknown modal state: refuse (fail closed)
  }
}

export const PREDICATES = {
  noModalOpen: noModal,
  differentPatientRequested: ({ snapshot, event }: GuardInput): boolean =>
    event.type === 'SelectPatient' &&
    snapshot.patient !== null &&
    event.patient.patientId !== snapshot.patient.patientId,
  samePatientRequested: ({ snapshot, event }: GuardInput): boolean =>
    event.type === 'SelectPatient' &&
    snapshot.patient !== null &&
    event.patient.patientId === snapshot.patient.patientId,
  switchConfirmedByUser: ({ snapshot, event }: GuardInput): boolean =>
    event.type === 'ConfirmSwitch' &&
    snapshot.requested !== null &&
    event.requestedPatientId === snapshot.requested.patientId,
  requestedPatientIdentityValid: ({ snapshot }: GuardInput): boolean => holdsRequestedIdentity(snapshot),
  bannerIdentityValid: ({ snapshot }: GuardInput): boolean => holdsCurrentBannerIdentity(snapshot),
  bannerIdentityInvalid: ({ snapshot }: GuardInput): boolean => !holdsCurrentBannerIdentity(snapshot),
  contextChangedWithinWindow: changedWithinWindow,
  contextStableBeyondWindow: (input: GuardInput): boolean => !changedWithinWindow(input),
  reverifiedSinceLastChange: reverifiedSinceChange,
  notReverifiedSinceLastChange: (input: GuardInput): boolean => !reverifiedSinceChange(input),
  identityDisputed: ({ snapshot }: GuardInput): boolean => snapshot.disputed,
  identityNotDisputed: ({ snapshot }: GuardInput): boolean => !snapshot.disputed,
  reverificationConfirmedBySigner: ({ snapshot, event }: GuardInput): boolean =>
    event.type === 'Reverify' &&
    event.confirmedBy.length > 0 &&
    snapshot.patient !== null &&
    event.patientId === snapshot.patient.patientId,
  patientRejectedBySigner: ({ event }: GuardInput): boolean => event.type === 'RejectPatient',
  signerAuthenticated: signerAuthenticatedFor,
  reverificationHeldBySigner: reverificationHeld,
  reverificationNotHeldBySigner: (input: GuardInput): boolean => !reverificationHeld(input),
  contextUnchangedSinceSignOpened: contextUnchangedSinceOpen,
  contextChangedSinceSignOpened: (input: GuardInput): boolean => !contextUnchangedSinceOpen(input),
  serverRequiresReverification: ({ event }: GuardInput): boolean =>
    event.type === 'SignRefused' && event.reason === 'reverification-required',
} as const satisfies Record<string, (input: GuardInput) => boolean>;
export type PredicateName = keyof typeof PREDICATES;

// ---------------------------------------------------------------------------------------------------------
// Transitions: patient-context.yaml, one for one, each with what it does to the window's context
// ---------------------------------------------------------------------------------------------------------

interface EffectInput extends GuardInput {
  readonly wallTimeMs: number | undefined;
}

interface Effect {
  readonly snapshot: Omit<PatientContextSnapshot, 'state'>;
  readonly messageKey?: PatientContextMessageKey;
  readonly signCommand?: SignCommand;
}

export interface TransitionDefinition {
  readonly from: readonly PatientContextState[] | '*';
  readonly on: PatientContextEventType;
  readonly guard: readonly PredicateName[];
  readonly to: PatientContextState;
  readonly effect: (input: EffectInput) => Effect;
}

/** A context change: the patient id changes; the time is recorded and re-verification state is cleared. */
function changeContext(
  input: EffectInput,
  patient: PatientCandidate | null,
  contextUser: UserId | null,
): Effect {
  const { snapshot } = input;
  return {
    snapshot: {
      patient,
      requested: null,
      contextUser,
      lastChange: {
        version: snapshot.lastChange.version + 1,
        monotonicMs: input.nowMs,
        wallTimeMs: input.wallTimeMs,
      },
      reverification: null,
      disputed: false,
      sign: null,
    },
  };
}

function unchanged({ snapshot }: EffectInput): Effect {
  return { snapshot };
}

function openSign(reverificationDue: boolean) {
  return (input: EffectInput): Effect => {
    const { snapshot, event, deps } = input;
    const patient = snapshot.patient;
    if (event.type !== 'OpenSign' || patient === null) {
      throw new Error('openSign: guarded transition reached without an OpenSign event and a patient');
    }
    return {
      snapshot: {
        ...snapshot,
        sign: {
          kind: event.kind,
          idempotencyKey: deps.newIdempotencyKey(),
          openedFor: { patientId: patient.patientId, contextVersion: snapshot.lastChange.version },
          reverificationDue,
        },
      },
    };
  };
}

function closeSign(messageKey?: PatientContextMessageKey) {
  return ({ snapshot }: EffectInput): Effect => ({
    snapshot: { ...snapshot, sign: null },
    ...(messageKey === undefined ? {} : { messageKey }),
  });
}

/** Back to re-verification: the re-verification on record no longer counts for this signature. */
function requireReverificationAgain(messageKey: PatientContextMessageKey) {
  return ({ snapshot }: EffectInput): Effect => ({
    snapshot: {
      ...snapshot,
      reverification: null,
      sign: snapshot.sign === null ? null : { ...snapshot.sign, reverificationDue: true },
    },
    messageKey,
  });
}

function message(messageKey: PatientContextMessageKey) {
  return ({ snapshot }: EffectInput): Effect => ({ snapshot, messageKey });
}

export const TRANSITIONS: readonly TransitionDefinition[] = [
  // Opening the first patient in an empty window: a context change, no confirmation.
  {
    from: ['no-patient'],
    on: 'SelectPatient',
    guard: ['noModalOpen'],
    to: 'patient-selected',
    effect: (input) => {
      if (input.event.type !== 'SelectPatient') {
        throw new Error('guarded transition reached without SelectPatient');
      }
      return changeContext(input, input.event.patient, input.event.user);
    },
  },
  // The patient already open: nothing changes; lastChange is not reset.
  {
    from: ['patient-selected'],
    on: 'SelectPatient',
    guard: ['samePatientRequested'],
    to: 'patient-selected',
    effect: unchanged,
  },
  // Another patient: the confirmation opens; the current patient stays.
  {
    from: ['patient-selected'],
    on: 'SelectPatient',
    guard: ['differentPatientRequested', 'noModalOpen'],
    to: 'switch-pending-confirmation',
    effect: (input) => {
      if (input.event.type !== 'SelectPatient') {
        throw new Error('guarded transition reached without SelectPatient');
      }
      return { snapshot: { ...input.snapshot, requested: input.event.patient } };
    },
  },
  // Confirmed: the context is replaced (a context change).
  {
    from: ['switch-pending-confirmation'],
    on: 'ConfirmSwitch',
    guard: ['switchConfirmedByUser', 'requestedPatientIdentityValid'],
    to: 'patient-selected',
    effect: (input) => changeContext(input, input.snapshot.requested, input.snapshot.contextUser),
  },
  // Cancelled: the current patient stays; lastChange is not reset.
  {
    from: ['switch-pending-confirmation'],
    on: 'CancelSwitch',
    guard: [],
    to: 'patient-selected',
    effect: ({ snapshot }) => ({ snapshot: { ...snapshot, requested: null } }),
  },
  // Closing the patient: a context change to none.
  {
    from: ['patient-selected'],
    on: 'ClosePatient',
    guard: ['noModalOpen'],
    to: 'no-patient',
    effect: (input) => changeContext(input, null, null),
  },
  // The sign step cannot open on an invalid banner identity.
  {
    from: ['patient-selected'],
    on: 'OpenSign',
    guard: ['bannerIdentityInvalid'],
    to: 'patient-selected',
    effect: message('sign.blockedByBanner'),
  },
  {
    from: ['patient-selected'],
    on: 'OpenSign',
    guard: ['bannerIdentityValid', 'contextChangedWithinWindow', 'notReverifiedSinceLastChange'],
    to: 're-verification-required',
    effect: openSign(true),
  },
  {
    from: ['patient-selected'],
    on: 'OpenSign',
    guard: ['bannerIdentityValid', 'identityDisputed'],
    to: 're-verification-required',
    effect: openSign(true),
  },
  {
    from: ['patient-selected'],
    on: 'OpenSign',
    guard: ['bannerIdentityValid', 'contextStableBeyondWindow', 'identityNotDisputed'],
    to: 'signing',
    effect: openSign(false),
  },
  {
    from: ['patient-selected'],
    on: 'OpenSign',
    guard: [
      'bannerIdentityValid',
      'contextChangedWithinWindow',
      'reverifiedSinceLastChange',
      'identityNotDisputed',
    ],
    to: 'signing',
    effect: openSign(true),
  },
  // Re-verification confirmed: recorded with the confirming user; the dispute is resolved.
  {
    from: ['re-verification-required'],
    on: 'Reverify',
    guard: ['reverificationConfirmedBySigner'],
    to: 'signing',
    effect: (input) => {
      if (input.event.type !== 'Reverify') {
        throw new Error('guarded transition reached without Reverify');
      }
      return {
        snapshot: {
          ...input.snapshot,
          reverification: {
            contextVersion: input.snapshot.lastChange.version,
            confirmedBy: input.event.confirmedBy,
            monotonicMs: input.nowMs,
            wallTimeMs: input.wallTimeMs,
          },
          disputed: false,
        },
      };
    },
  },
  // "Not this patient": nothing is signed; the identity stays disputed until a change or a re-verification.
  {
    from: ['re-verification-required'],
    on: 'RejectPatient',
    guard: ['patientRejectedBySigner'],
    to: 'patient-selected',
    effect: ({ snapshot }) => ({
      snapshot: { ...snapshot, reverification: null, disputed: true, sign: null },
      messageKey: 'sign.reverify.rejected',
    }),
  },
  {
    from: ['re-verification-required', 'signing'],
    on: 'CancelSign',
    guard: [],
    to: 'patient-selected',
    effect: closeSign(),
  },
  {
    from: ['signing'],
    on: 'SubmitSign',
    guard: ['contextChangedSinceSignOpened'],
    to: 'patient-selected',
    effect: closeSign('sign.contextChanged'),
  },
  {
    from: ['signing'],
    on: 'SubmitSign',
    guard: ['contextUnchangedSinceSignOpened', 'bannerIdentityInvalid'],
    to: 'patient-selected',
    effect: closeSign('sign.blockedByBanner'),
  },
  {
    from: ['signing'],
    on: 'SubmitSign',
    guard: [
      'contextUnchangedSinceSignOpened',
      'bannerIdentityValid',
      'signerAuthenticated',
      'reverificationNotHeldBySigner',
    ],
    to: 're-verification-required',
    effect: requireReverificationAgain('sign.reverify.signerDiffers'),
  },
  {
    from: ['signing'],
    on: 'SubmitSign',
    guard: [
      'contextUnchangedSinceSignOpened',
      'bannerIdentityValid',
      'signerAuthenticated',
      'reverificationHeldBySigner',
    ],
    to: 'submitting',
    effect: ({ snapshot, event }) => {
      const sign = snapshot.sign;
      const patient = snapshot.patient;
      if (
        sign === null ||
        patient === null ||
        event.type !== 'SubmitSign' ||
        event.authentication.status !== 'authenticated'
      ) {
        throw new Error(
          'guarded transition reached without a sign session, a patient and an authenticated signer',
        );
      }
      const reverification = snapshot.reverification;
      return {
        snapshot,
        signCommand: {
          kind: sign.kind,
          patientId: patient.patientId,
          signerUserId: event.authentication.userId,
          idempotencyKey: sign.idempotencyKey,
          lastContextChangeWallTimeMs: snapshot.lastChange.wallTimeMs ?? null,
          reverification:
            reverification === null
              ? null
              : { confirmedBy: reverification.confirmedBy, wallTimeMs: reverification.wallTimeMs ?? null },
        },
      };
    },
  },
  {
    from: ['submitting'],
    on: 'SignAccepted',
    guard: [],
    to: 'patient-selected',
    effect: closeSign('sign.done'),
  },
  {
    from: ['submitting'],
    on: 'SignRefused',
    guard: ['serverRequiresReverification'],
    to: 're-verification-required',
    effect: requireReverificationAgain('sign.refused.reverify'),
  },
  // Nothing was saved; the dialog stays open and keeps its idempotency key.
  { from: ['submitting'], on: 'SignRejected', guard: [], to: 'signing', effect: message('sign.failed') },
  // The outcome is unknown; a retry reuses the same idempotency key, so at most one signature is recorded.
  {
    from: ['submitting'],
    on: 'SignOutcomeUnknown',
    guard: [],
    to: 'signing',
    effect: message('sign.outcomeUnknown'),
  },
  // A change of user clears the context; any open dialog closes without signing (DN-028).
  {
    from: [
      'patient-selected',
      'switch-pending-confirmation',
      're-verification-required',
      'signing',
      'submitting',
    ],
    on: 'UserChanged',
    guard: [],
    to: 'no-patient',
    effect: (input) => ({
      ...changeContext(input, null, null),
      messageKey: 'patientContext.clearedByUserChange',
    }),
  },
  {
    from: '*',
    on: 'WindowClosed',
    guard: [],
    to: 'window-closed',
    effect: ({ snapshot }) => ({
      snapshot: { ...snapshot, patient: null, requested: null, reverification: null, sign: null },
    }),
  },
];

// ---------------------------------------------------------------------------------------------------------
// Running the machine
// ---------------------------------------------------------------------------------------------------------

const DIALOG_STATES: readonly PatientContextState[] = [
  'switch-pending-confirmation',
  're-verification-required',
  'signing',
  'submitting',
];

/** The message for an event that no transition accepts, where the spec names one. */
function refusalMessage(input: GuardInput): PatientContextMessageKey | undefined {
  const { snapshot, event } = input;
  if (snapshot.state === 'window-closed') {
    return undefined;
  }
  if (event.type === 'SelectPatient' || event.type === 'ClosePatient') {
    if (DIALOG_STATES.includes(snapshot.state) || !PREDICATES.noModalOpen(input)) {
      return 'patientContext.switch.blockedByModal';
    }
  }
  if (event.type === 'ConfirmSwitch' && snapshot.state === 'switch-pending-confirmation') {
    if (!PREDICATES.requestedPatientIdentityValid(input)) {
      return 'patientContext.switch.requestedInvalid';
    }
  }
  return undefined;
}

/** The transitions of the YAML that accept this event in this snapshot, guards included. */
export function enabledTransitions(
  snapshot: PatientContextSnapshot,
  event: PatientContextEvent,
  deps: PatientContextDeps,
): readonly TransitionDefinition[] {
  const input = guardInput(snapshot, event, deps, readMonotonicMs(deps.clock));
  return matching(input);
}

function guardInput(
  snapshot: PatientContextSnapshot,
  event: PatientContextEvent,
  deps: PatientContextDeps,
  nowMs: number | undefined,
): GuardInput {
  return {
    snapshot,
    event,
    nowMs,
    windowMs: effectiveReverificationWindowMs(deps.reverificationWindowMs),
    deps,
  };
}

function matching(input: GuardInput): readonly TransitionDefinition[] {
  return TRANSITIONS.filter(
    (definition) =>
      definition.on === input.event.type &&
      (definition.from === '*' || definition.from.includes(input.snapshot.state)) &&
      definition.guard.every((name) => PREDICATES[name](input)),
  );
}

function refused(
  snapshot: PatientContextSnapshot,
  messageKey: PatientContextMessageKey | undefined,
): TransitionResult {
  return { snapshot, outcome: 'refused', messageKey, contextChange: undefined, signCommand: undefined };
}

/**
 * Applies one event. When no transition accepts it, the snapshot is returned unchanged with outcome
 * `refused` (and the spec's message where it names one); nothing is queued. If transitions to different
 * states were enabled at once, the event is refused: the guards of the YAML are meant to exclude that, and a
 * test checks it for every combination of predicate values.
 */
export function transition(
  snapshot: PatientContextSnapshot,
  event: PatientContextEvent,
  deps: PatientContextDeps,
): TransitionResult {
  const nowMs = readMonotonicMs(deps.clock);
  const input = guardInput(snapshot, event, deps, nowMs);
  const enabled = matching(input);
  const chosen = enabled[0];
  if (chosen === undefined) {
    return refused(snapshot, refusalMessage(input));
  }
  if (enabled.some((definition) => definition.to !== chosen.to)) {
    return refused(snapshot, undefined);
  }
  const effect = chosen.effect({ ...input, wallTimeMs: readWallTimeMs(deps.clock) });
  const next: PatientContextSnapshot = { ...effect.snapshot, state: chosen.to };
  const previousPatientId = snapshot.patient?.patientId ?? null;
  const patientId = next.patient?.patientId ?? null;
  return {
    snapshot: next,
    outcome: 'transitioned',
    messageKey: effect.messageKey,
    contextChange:
      next.lastChange.version === snapshot.lastChange.version ? undefined : { previousPatientId, patientId },
    signCommand: effect.signCommand,
  };
}

/**
 * Stores banner data loaded for `patientId` on the current or the requested patient. Data for any other
 * patient is ignored: the context, never the data, decides whose banner the window shows. The banner's own
 * patient id must still match for the identity predicates to hold.
 */
export function updateBannerData(
  snapshot: PatientContextSnapshot,
  patientId: string,
  banner: BannerModel,
): PatientContextSnapshot {
  if (snapshot.patient !== null && snapshot.patient.patientId === patientId) {
    return { ...snapshot, patient: { patientId, banner } };
  }
  if (snapshot.requested !== null && snapshot.requested.patientId === patientId) {
    return { ...snapshot, requested: { patientId, banner } };
  }
  return snapshot;
}

/**
 * True when the window holds a patient opened under another user than the session's (or with no session
 * user): the shell then sends UserChanged, which clears the context (DN-028). Checked when the window gains
 * focus and before every clinical action.
 */
export function contextUserMismatch(snapshot: PatientContextSnapshot, sessionUser: UserId | null): boolean {
  return snapshot.patient !== null && (sessionUser === null || snapshot.contextUser !== sessionUser);
}
