/**
 * The per-window modal stack guard (BUILD-PROMPT.md §6.5 "No stacked modals", §14.2;
 * docs/specs/modules/design-system.md §2.8).
 *
 * At most one holder at a time: a `Modal`, or a HAL capture that waits for a device (§2.2, §6), which holds
 * the guard as a modal does. While the guard is held, a request to acquire it is refused. A refusal is never
 * queued: the refused request does not open later when the holder releases the guard.
 *
 * In development and tests a refusal throws `ModalStackError`, so the defect is found. In production the
 * second holder is not granted and the refusal is published, so that `ModalStackProvider` can announce
 * `modal.blocked` in a polite live region. The patient-context machine reads `isHeld()` to refuse a patient
 * switch while a dialog or a capture is open (`patientContext.switch.blockedByModal`).
 *
 * The guard is plain TypeScript with no DOM, so that a HAL capture can hold it without React. Only the code
 * that acquired the guard can release it (the hold is an opaque token the snapshot never exposes), and a
 * window has one guard: the package exports `windowModalStackGuard`, while `createModalStackGuard` is
 * reachable only through the test entry point `@hms/design-system/testing`, which fails in production builds.
 */

/** What holds or asks for the guard: a dialog or a HAL capture waiting for a device. */
export type ModalHolderKind = 'modal' | 'hal-capture';

/** How the guard answers a refused request. */
export type ModalRefusalMode = 'throw' | 'announce';

/**
 * Who holds or asks for the guard. The guard compares owners by identity, never by label: each `Modal` and
 * each capture makes its own owner object, so no other code (another React root whose `useId` values
 * collide, say) can pass for it.
 */
export interface ModalOwner {
  /** For diagnostics only, for example the component's `useId` value or the capture's call. */
  readonly label: string;
}

declare const holdBrand: unique symbol;

/**
 * A granted hold: an opaque token that only the code that acquired the guard receives. The snapshot never
 * exposes it, so no other code can release the guard. Releasing it twice, or releasing a stale hold, does
 * nothing.
 */
export interface ModalHold {
  readonly [holdBrand]: true;
}

/** What subscribers see of the current hold. It cannot release the guard. */
export interface ModalHolder {
  readonly kind: ModalHolderKind;
  readonly owner: ModalOwner;
}

/** A snapshot for subscribers (`useSyncExternalStore`). A new object on every change. */
export interface ModalStackSnapshot {
  /** The current holder, or null when nothing holds the guard. */
  readonly holder: ModalHolder | null;
  /**
   * How many requests were refused while the current holder held the guard; 0 when nothing is held.
   * The provider announces `modal.blocked` while it is above 0.
   */
  readonly refusedWhileHeld: number;
}

/** The functions do not use `this`, so they can be passed on their own (to `useSyncExternalStore`, say). */
export interface ModalStackGuard {
  /**
   * Grants the guard to a new holder, or refuses: in 'throw' mode a refusal throws `ModalStackError`; in
   * 'announce' mode it returns null and publishes the refusal.
   */
  readonly acquire: (kind: ModalHolderKind, owner: ModalOwner) => ModalHold | null;
  /** Releases a hold. Anything but the current holder's own token (a stale hold, a snapshot) is ignored. */
  readonly release: (hold: ModalHold) => void;
  /** True while a modal or a HAL capture holds the guard. */
  readonly isHeld: () => boolean;
  readonly getSnapshot: () => ModalStackSnapshot;
  readonly subscribe: (listener: () => void) => () => void;
  readonly refusalMode: ModalRefusalMode;
}

/** Thrown in development and tests when a second modal or capture is requested while one is open. */
export class ModalStackError extends Error {
  readonly holderKind: ModalHolderKind;
  readonly requestedKind: ModalHolderKind;

  constructor(holderKind: ModalHolderKind, requestedKind: ModalHolderKind) {
    super(
      `No stacked modals (BUILD-PROMPT.md §6.5): a ${requestedKind} was requested while a ${holderKind} is open`,
    );
    this.name = 'ModalStackError';
    this.holderKind = holderKind;
    this.requestedKind = requestedKind;
  }
}

const EMPTY: ModalStackSnapshot = Object.freeze({ holder: null, refusedWhileHeld: 0 });

/**
 * Creates a guard. An application has one per window (`windowModalStackGuard`); only tests create their own,
 * through `@hms/design-system/testing`. The default mode throws in development and test builds and
 * announces in production builds.
 */
export function createModalStackGuard(refusalMode: ModalRefusalMode = defaultRefusalMode()): ModalStackGuard {
  let snapshot: ModalStackSnapshot = EMPTY;
  // The current holder's token, kept here only: release() compares by identity.
  let token: ModalHold | null = null;
  const listeners = new Set<() => void>();

  const publish = (next: ModalStackSnapshot): void => {
    snapshot = next;
    for (const listener of [...listeners]) {
      listener();
    }
  };

  return {
    refusalMode,
    acquire: (kind, owner) => {
      const { holder } = snapshot;
      if (holder !== null) {
        if (refusalMode === 'throw') {
          throw new ModalStackError(holder.kind, kind);
        }
        publish({ holder, refusedWhileHeld: snapshot.refusedWhileHeld + 1 });
        return null;
      }
      const hold = Object.freeze({}) as ModalHold;
      token = hold;
      publish({ holder: Object.freeze({ kind, owner }), refusedWhileHeld: 0 });
      return hold;
    },
    release: (hold) => {
      if (token === null || hold !== token) {
        return;
      }
      token = null;
      publish(EMPTY);
    },
    isHeld: () => {
      return snapshot.holder !== null;
    },
    getSnapshot: () => {
      return snapshot;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** 'throw' in Vite development and test builds (Vitest sets DEV), 'announce' in production builds. */
function defaultRefusalMode(): ModalRefusalMode {
  return import.meta.env.DEV ? 'throw' : 'announce';
}

let windowGuard: ModalStackGuard | undefined;

/**
 * The guard of this window. A JavaScript realm is one window (a browser tab, a Tauri window), so a
 * module-level guard is per window, as §2.8 requires.
 */
export function windowModalStackGuard(): ModalStackGuard {
  windowGuard ??= createModalStackGuard();
  return windowGuard;
}
