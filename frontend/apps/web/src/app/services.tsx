/**
 * What one browser window of the web app runs with (docs/specs/modules/design-system.md §2.2, §4, §5): its
 * patient-context store, its query cache, its patient directory and, in demo builds only, the demo module.
 * One set per window, created at start-up (main.tsx) or by a test, and given to React through context.
 */
import type { QueryClient } from '@tanstack/react-query';
import { createContext, use, useSyncExternalStore, type ReactNode } from 'react';
import type { PatientContextSnapshot } from '@hms/ui-core';
import type { DemoModule } from '../demo/demo-module.ts';
import type { PatientDirectory } from '../patient/directory.ts';
import type { ContextMessage, PatientContextStore } from '../patient/patient-context-store.ts';

export interface AppServices {
  readonly store: PatientContextStore;
  readonly queryClient: QueryClient;
  readonly directory: PatientDirectory;
  /** The demo module in demo builds (`VITE_HMS_DEMO=1`); null in production builds. */
  readonly demo: DemoModule | null;
}

const ServicesContext = createContext<AppServices | null>(null);

export function AppServicesProvider({
  services,
  children,
}: {
  readonly services: AppServices;
  readonly children?: ReactNode;
}): ReactNode {
  return <ServicesContext value={services}>{children}</ServicesContext>;
}

/** The window's services. Throws outside the provider, so a wiring defect fails at once. */
export function useAppServices(): AppServices {
  const services = use(ServicesContext);
  if (services === null) {
    throw new Error('useAppServices: render inside <AppServicesProvider>');
  }
  return services;
}

/** The window's patient-context snapshot; re-renders on every change. */
export function usePatientContext(): PatientContextSnapshot {
  const { store } = useAppServices();
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

/** The last message the patient-context machine named, if any. */
export function usePatientContextMessage(): ContextMessage | null {
  const { store } = useAppServices();
  return useSyncExternalStore(store.subscribe, store.getMessage, store.getMessage);
}
