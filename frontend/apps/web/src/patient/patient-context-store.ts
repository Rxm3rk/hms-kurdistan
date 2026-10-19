/**
 * The patient context of one browser window (BUILD-PROMPT.md §2.1 SI-16, §6.5 "one patient context per
 * window"; docs/specs/modules/design-system.md §2.2, §4; CTRL-0016-6).
 *
 * The store holds ui-core's patient-context snapshot and applies every event through ui-core's `transition`,
 * so the machine of docs/specs/state-machines/patient-context.yaml, and only it, decides: the store adds no
 * rule of its own. What it adds is the wiring of the window:
 *
 * - **The machine's dependencies**: the monotonic system clock; the window's modal stack guard as the modal
 *   state (a dialog holds it as `modal`, a HAL capture waiting for a device as `hal-capture`); a random
 *   idempotency key from Web Crypto for each sign step (OQ-158).
 * - **The query cache keyed by patient**: after every transition it keeps only the queries of the context's
 *   patient, of a patient whose switch waits for confirmation and of the one request still loading, so the
 *   previous patient's data is gone after a switch, a close or a change of user, and a cancelled request
 *   leaves nothing behind.
 * - **Requests**: `requestPatient` loads the requested patient's banner data through the query cache and then
 *   sends `SelectPatient` with the session user. The machine opens the first patient of an empty window,
 *   asks for confirmation when another patient is open, and refuses while a dialog is open. With no session
 *   user (a production build before WP-0.4) nothing is requested (fail closed). A patient the directory does
 *   not know is never sent to the machine (OQ-163).
 * - **Only the latest request counts** (CTRL-0016-6): each request has a number; a request that a newer one or
 *   `cancelPatientRequest` has overtaken while it was loading sends nothing when its data arrives, so the
 *   machine is never asked for a patient the address no longer names.
 * - **Messages**: the last message the machine named, for the frame's status region.
 */
import type { QueryClient } from '@tanstack/react-query';
import type { ModalStackGuard } from '@hms/design-system';
import {
  systemClock,
  initialPatientContext,
  transition,
  updateBannerData,
  type BannerModel,
  type Clock,
  type PatientContextDeps,
  type PatientContextEvent,
  type PatientContextMessageKey,
  type PatientContextSnapshot,
  type TransitionResult,
  type UserId,
} from '@hms/ui-core';
import type { PatientDirectory } from './directory.ts';
import { bannerQueryOptions, keepOnlyPatients } from './patient-queries.ts';

/** A message the machine named, numbered so that a repeated message is announced again. */
export interface ContextMessage {
  readonly key: PatientContextMessageKey;
  readonly seq: number;
}

/** What became of a patient request. */
export type PatientRequestOutcome =
  /** No session user (a production build before WP-0.4): nothing was requested. */
  | { readonly kind: 'no-session-user' }
  /** The directory does not know the patient: nothing was sent to the machine. */
  | { readonly kind: 'unknown-patient' }
  /** A newer request, or a cancel, overtook this one while it loaded: nothing was sent. */
  | { readonly kind: 'superseded' }
  /** `SelectPatient` was sent; the machine's result. */
  | { readonly kind: 'sent'; readonly result: TransitionResult };

export interface PatientContextStore {
  readonly getSnapshot: () => PatientContextSnapshot;
  readonly getMessage: () => ContextMessage | null;
  readonly subscribe: (listener: () => void) => () => void;
  /** Applies one event (ui-core `transition`) and returns the result. */
  readonly send: (event: PatientContextEvent) => TransitionResult;
  /**
   * Requests a patient for this window: loads the banner data through the query cache, then sends
   * `SelectPatient` unless the patient is unknown or the request was overtaken. Overtakes any request still
   * loading.
   */
  readonly requestPatient: (patientId: string) => Promise<PatientRequestOutcome>;
  /** Drops the request still loading, if any: it will send nothing, and its data leaves the cache. */
  readonly cancelPatientRequest: () => void;
  /** Stores newer banner data for the context's patient or the requested one (ui-core `updateBannerData`). */
  readonly updateBanner: (patientId: string, banner: BannerModel) => void;
  /** The session user of this window, or null before sign-in exists (WP-0.4). */
  readonly sessionUser: UserId | null;
  /** The dependencies the machine runs with; the sign dialog reads the re-verification window from them. */
  readonly deps: PatientContextDeps;
}

export interface PatientContextStoreOptions {
  readonly guard: ModalStackGuard;
  readonly queryClient: QueryClient;
  readonly directory: PatientDirectory;
  readonly sessionUser: UserId | null;
  readonly clock?: Clock;
  readonly newIdempotencyKey?: () => string;
}

/**
 * A random (version 4) UUID from `crypto.getRandomValues`, which, unlike `crypto.randomUUID`, also exists
 * outside secure contexts.
 */
export function randomUuid(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = 0x40 | ((bytes[6] ?? 0) & 0x0f);
  bytes[8] = 0x80 | ((bytes[8] ?? 0) & 0x3f);
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * The patients whose queries the cache may keep: the context's patient, a requested one whose switch waits,
 * and the one whose request is still loading.
 */
function patientsInUse(snapshot: PatientContextSnapshot, loading: string | undefined): Set<string> {
  const keep = new Set<string>();
  if (loading !== undefined) {
    keep.add(loading);
  }
  if (snapshot.patient !== null) {
    keep.add(snapshot.patient.patientId);
  }
  if (snapshot.requested !== null) {
    keep.add(snapshot.requested.patientId);
  }
  return keep;
}

export function createPatientContextStore(options: PatientContextStoreOptions): PatientContextStore {
  const { guard, queryClient, directory, sessionUser } = options;
  let snapshot = initialPatientContext();
  let message: ContextMessage | null = null;
  const listeners = new Set<() => void>();
  /** The number of the latest request, and the patient it is loading (undefined once it has finished). */
  let latestRequest = 0;
  let loading: string | undefined;
  const prune = (): void => {
    keepOnlyPatients(queryClient, patientsInUse(snapshot, loading));
  };

  const deps: PatientContextDeps = {
    clock: options.clock ?? systemClock,
    window: {
      isModalOpen: () => guard.getSnapshot().holder?.kind === 'modal',
      isHalCaptureWaiting: () => guard.getSnapshot().holder?.kind === 'hal-capture',
    },
    newIdempotencyKey: options.newIdempotencyKey ?? randomUuid,
  };

  const notify = (): void => {
    for (const listener of listeners) {
      listener();
    }
  };

  const send = (event: PatientContextEvent): TransitionResult => {
    const result = transition(snapshot, event, deps);
    snapshot = result.snapshot;
    if (result.messageKey !== undefined) {
      message = { key: result.messageKey, seq: (message?.seq ?? 0) + 1 };
    }
    if (result.outcome === 'transitioned') {
      prune();
    }
    notify();
    return result;
  };

  return {
    getSnapshot: () => snapshot,
    getMessage: () => message,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    send,
    requestPatient: async (patientId) => {
      if (sessionUser === null) {
        return { kind: 'no-session-user' };
      }
      latestRequest += 1;
      const request = latestRequest;
      loading = patientId;
      const current = (): boolean => request === latestRequest;
      let banner: BannerModel | null;
      try {
        banner = await queryClient.query(bannerQueryOptions(directory, patientId));
      } catch (error) {
        // A query removed from the cache while it loaded (an overtaken request) is cancelled.
        if (!current()) {
          return { kind: 'superseded' };
        }
        loading = undefined;
        prune();
        throw error;
      }
      if (!current()) {
        // Overtaken while loading: the data of this request must not stay behind in the cache.
        prune();
        return { kind: 'superseded' };
      }
      loading = undefined;
      if (banner === null) {
        prune();
        return { kind: 'unknown-patient' };
      }
      const result = send({ type: 'SelectPatient', patient: { patientId, banner }, user: sessionUser });
      if (result.outcome === 'refused') {
        // Nothing was opened: the loaded data must not stay behind in the cache.
        prune();
      }
      return { kind: 'sent', result };
    },
    cancelPatientRequest: () => {
      if (loading === undefined) {
        return;
      }
      latestRequest += 1;
      loading = undefined;
      prune();
    },
    updateBanner: (patientId, banner) => {
      const next = updateBannerData(snapshot, patientId, banner);
      if (next !== snapshot) {
        snapshot = next;
        notify();
      }
    },
    sessionUser,
    deps,
  };
}
