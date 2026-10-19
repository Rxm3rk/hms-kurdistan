/**
 * The window's patient, for screens (docs/specs/modules/design-system.md §2.2: one patient per window).
 *
 * - `useCurrentPatient()`: the patient open in the window (any screen), or null.
 * - `useOpenPatient()`: open a patient on a patient-scoped screen. It puts `?patient=<id>` in the address;
 *   the clinical layout passes that request to the window's patient context, which opens it at once in an
 *   empty window or asks "Change patient?" when another patient is open (the real safety pattern).
 * - `useClosePatient()`: close the record (the clinical screens then show the chooser).
 * - `usePatientChooser().openChooser()`: open the chooser dialog from anywhere.
 * - On a patient-scoped screen use `useClinicalPatient()` (./clinical-layout.tsx): never null there.
 */
import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAppServices, usePatientContext } from '../../app/services.tsx';
import { findPatient } from '../data/patients.ts';
import type { Patient } from '../data/types.ts';
import { useCurrentScreen, useGoTo } from './navigation.ts';
import { SCREENS, type ScreenId } from './screens.ts';

/** The id of the patient open in the window, or null. */
export function useCurrentPatientId(): string | null {
  return usePatientContext().patient?.patientId ?? null;
}

/** The patient open in the window (synthetic data record), or null. */
export function useCurrentPatient(): Patient | null {
  return findPatient(useCurrentPatientId()) ?? null;
}

/**
 * Opens a patient on a patient-scoped screen: `chart` by default; a hospital-wide screen id falls back to
 * `chart`.
 */
export function useOpenPatient(): (patientId: string, screen?: ScreenId) => void {
  const goTo = useGoTo();
  return useCallback(
    (patientId, screen = 'chart') => {
      goTo(SCREENS[screen].clinical ? screen : 'chart', { patient: patientId });
    },
    [goTo],
  );
}

/** Closes the window's patient record. */
export function useClosePatient(): () => void {
  const { store } = useAppServices();
  return useCallback(() => {
    store.send({ type: 'ClosePatient' });
  }, [store]);
}

interface ChooserState {
  readonly isOpen: boolean;
  /** The screen to open the chosen patient on. */
  readonly target: ScreenId;
}

interface ChooserContextValue {
  readonly state: ChooserState;
  readonly openChooser: (screen?: ScreenId) => void;
  readonly closeChooser: () => void;
  /** Closes the dialog, then opens the patient once the dialog has released the window's modal slot. */
  readonly choose: (patientId: string) => void;
}

const ChooserContext = createContext<ChooserContextValue | null>(null);

export function ChooserProvider({ children }: { readonly children?: ReactNode }): ReactNode {
  const screen = useCurrentScreen();
  const openPatient = useOpenPatient();
  const [state, setState] = useState<ChooserState>({ isOpen: false, target: 'chart' });
  const pending = useRef<{ readonly patientId: string; readonly target: ScreenId } | null>(null);

  useEffect(() => {
    // Runs after the dialog's layout effect released the modal slot, so the switch confirmation can open.
    if (!state.isOpen && pending.current !== null) {
      const { patientId, target } = pending.current;
      pending.current = null;
      openPatient(patientId, target);
    }
  }, [state.isOpen, openPatient]);

  const value: ChooserContextValue = {
    state,
    openChooser: (target) => {
      const fallback: ScreenId = screen?.clinical === true ? screen.id : 'chart';
      setState({ isOpen: true, target: target ?? fallback });
    },
    closeChooser: () => {
      setState((current) => ({ ...current, isOpen: false }));
    },
    choose: (patientId) => {
      pending.current = { patientId, target: state.target };
      setState((current) => ({ ...current, isOpen: false }));
    },
  };
  return <ChooserContext value={value}>{children}</ChooserContext>;
}

function useChooserContext(): ChooserContextValue {
  const value = use(ChooserContext);
  if (value === null) {
    throw new Error('usePatientChooser: render inside the prototype frame (ChooserProvider)');
  }
  return value;
}

/** Opens the patient chooser dialog; the chosen patient opens on `screen` (the current clinical screen, else chart). */
export function usePatientChooser(): { readonly openChooser: (screen?: ScreenId) => void } {
  const { openChooser } = useChooserContext();
  return { openChooser };
}

/** For the frame's chooser dialog. */
export function useChooserDialogState(): ChooserContextValue {
  return useChooserContext();
}
