/**
 * `Modal`: the React Aria modal dialog behind the window's stack guard (BUILD-PROMPT.md §6.5 "No stacked
 * modals", §14.2; docs/specs/modules/design-system.md §2.8).
 *
 * When `isOpen` turns true the modal asks the guard for the window's single modal slot. Only a granted
 * modal renders. A refused request is not queued: the modal stays closed even after the open one closes,
 * until its `isOpen` turns false and true again. In development and tests the refusal throws (to the
 * nearest error boundary); in production `onOpenChange(false)` and `onRefused` are called and the provider
 * announces and shows `modal.blocked`.
 *
 * Steps inside one dialog (review, re-verification, authentication, sign) are views of one modal, never
 * modals of their own.
 */
import {
  useEffectEvent,
  useId,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { Dialog, ModalOverlay, Modal as AriaModal, type DialogProps } from 'react-aria-components';
import type { ModalOwner } from './modal-stack.ts';
import { useModalStackGuard } from './modal-stack-provider.tsx';

export interface ModalProps {
  /** Whether the caller wants the modal open. It opens only if the stack guard grants it. */
  readonly isOpen: boolean;
  /** Called with false when the user dismisses the modal, and when the guard refuses it in production. */
  readonly onOpenChange: (isOpen: boolean) => void;
  /** Called when the guard refuses this modal in production builds. */
  readonly onRefused?: () => void;
  /** Whether a press outside closes the modal. Off by default: a clinical dialog closes on purpose. */
  readonly isDismissable?: boolean;
  /** Whether Escape is ignored. Escape closes by default. */
  readonly isKeyboardDismissDisabled?: boolean;
  /** The dialog's accessible name, from the catalogues, when it has no `Heading slot="title"`. */
  readonly 'aria-label'?: string;
  readonly 'aria-labelledby'?: string;
  /** The dialog's role: `alertdialog` for a confirmation that interrupts. */
  readonly role?: 'dialog' | 'alertdialog';
  readonly children: DialogProps['children'];
}

export function Modal({
  isOpen,
  onOpenChange,
  onRefused,
  isDismissable = false,
  isKeyboardDismissDisabled = false,
  role = 'dialog',
  children,
  ...labels
}: ModalProps): ReactNode {
  const guard = useModalStackGuard();
  const label = useId();
  // One owner object per Modal instance: the guard compares owners by identity, so a modal shows only while
  // it holds the guard itself, never because another holder carries the same label (a hydrated root or a
  // second copy of React can repeat useId values).
  const [owner] = useState<ModalOwner>(() => Object.freeze({ label: `modal ${label}` }));
  const snapshot = useSyncExternalStore(guard.subscribe, guard.getSnapshot, guard.getSnapshot);

  const refused = useEffectEvent(() => {
    onOpenChange(false);
    onRefused?.();
  });

  // A layout effect, so a granted modal renders before the browser paints and a refused one never shows.
  useLayoutEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    // Throws ModalStackError in development and tests; returns null in production.
    const hold = guard.acquire('modal', owner);
    if (hold === null) {
      refused();
      return undefined;
    }
    return () => {
      guard.release(hold);
    };
  }, [isOpen, guard, owner]);

  const granted = isOpen && snapshot.holder?.owner === owner;

  return (
    <ModalOverlay
      isOpen={granted}
      onOpenChange={onOpenChange}
      isDismissable={isDismissable}
      isKeyboardDismissDisabled={isKeyboardDismissDisabled}
      className="hms-modal-overlay"
    >
      <AriaModal className="hms-modal">
        <Dialog className="hms-dialog" role={role} {...labels}>
          {children}
        </Dialog>
      </AriaModal>
    </ModalOverlay>
  );
}
