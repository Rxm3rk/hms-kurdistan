/**
 * Supplies the window's modal stack guard to `Modal` and to HAL captures, and holds the polite live region
 * that tells the user a modal was refused in production builds (`modal.blocked`;
 * docs/specs/modules/design-system.md §2.8). It renders inside `LocaleProvider`, because the message comes
 * from the catalogues.
 *
 * - One guard per window: `ModalStackProvider` always uses `windowModalStackGuard()`. A provider nested in
 *   another one with a different guard throws, because two guards would let modals stack. Only the test entry
 *   point (`@hms/design-system/testing`) supplies another guard, and it fails in production builds.
 * - The refusal is announced and shown. The region carries `data-live-announcer`, so React Aria's
 *   `ariaHideOutside` leaves it exposed while the open modal hides the rest of the page (a refusal only
 *   happens while something holds the guard); while it has something to say it is visible above the modal
 *   layer, so a user without assistive technology also learns why nothing opened.
 */
import { createContext, use, useSyncExternalStore, type ReactNode } from 'react';
import { Message } from '../message/message.tsx';
import { windowModalStackGuard, type ModalStackGuard } from './modal-stack.ts';

const ModalStackContext = createContext<ModalStackGuard | null>(null);

export interface ModalStackProviderProps {
  readonly children?: ReactNode;
}

/** The provider an application renders, once per window, with the window's guard. */
export function ModalStackProvider({ children }: ModalStackProviderProps): ReactNode {
  return <ModalStackGuardProvider guard={windowModalStackGuard()}>{children}</ModalStackGuardProvider>;
}

export interface ModalStackGuardProviderProps {
  readonly guard: ModalStackGuard;
  readonly children?: ReactNode;
}

/**
 * Not exported from the package: `ModalStackProvider` and the test entry point render it. Inside a provider
 * of the same guard it adds nothing (no second region); inside a provider of another guard it throws.
 */
export function ModalStackGuardProvider({ guard, children }: ModalStackGuardProviderProps): ReactNode {
  const parent = use(ModalStackContext);
  if (parent !== null && parent !== guard) {
    throw new Error(
      'ModalStackProvider: a second modal stack guard inside another one would let modals stack (one guard per window, §6.5)',
    );
  }
  if (parent === guard) {
    return children;
  }
  return (
    <ModalStackContext value={guard}>
      {children}
      <ModalStackStatus guard={guard} />
    </ModalStackContext>
  );
}

function ModalStackStatus({ guard }: { readonly guard: ModalStackGuard }): ReactNode {
  const { refusedWhileHeld } = useSyncExternalStore(guard.subscribe, guard.getSnapshot, guard.getSnapshot);
  const refused = refusedWhileHeld > 0;
  return (
    // Present from the first render, so that assistive technology registers the region before it speaks.
    // Hidden only visually while empty; visible while a refusal stands, until the holder releases the guard.
    <div
      role="status"
      data-live-announcer="true"
      className={refused ? 'hms-modal-stack-status' : 'hms-visually-hidden'}
      data-testid="hms-modal-stack-status"
    >
      {refused ? (
        // A new key per refusal adds a new node, so a repeated refusal is announced again.
        <span key={refusedWhileHeld}>
          <Message id="modal.blocked" />
        </span>
      ) : null}
    </div>
  );
}

/**
 * The guard of the nearest `ModalStackProvider`. Throws when there is none: a modal without the guard could
 * stack, so the missing provider is a wiring defect that must fail at once (fail closed).
 */
export function useModalStackGuard(): ModalStackGuard {
  const guard = use(ModalStackContext);
  if (guard === null) {
    throw new Error('useModalStackGuard: render inside <ModalStackProvider> (no stacked modals, §6.5)');
  }
  return guard;
}

/** True while a modal or a HAL capture holds the window's guard; re-renders when that changes. */
export function useIsModalOpen(): boolean {
  const guard = useModalStackGuard();
  const snapshot = useSyncExternalStore(guard.subscribe, guard.getSnapshot, guard.getSnapshot);
  return snapshot.holder !== null;
}
