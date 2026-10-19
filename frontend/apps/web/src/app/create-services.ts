/**
 * Creates the services of one browser window (docs/specs/modules/design-system.md §2.2 "One patient context
 * per window"): one query cache, one patient-context store on the window's modal stack guard, and the
 * patient directory and session user of the build (the demo's synthetic ones in demo builds; none in
 * production builds until WP-0.4, KA-044).
 */
import { windowModalStackGuard, type ModalStackGuard } from '@hms/design-system';
import type { Clock } from '@hms/ui-core';
import type { DemoModule } from '../demo/demo-module.ts';
import { NO_PATIENT_DIRECTORY } from '../patient/directory.ts';
import { createPatientContextStore } from '../patient/patient-context-store.ts';
import { createAppQueryClient } from '../patient/patient-queries.ts';
import type { AppServices } from './services.tsx';

export interface CreateServicesOptions {
  readonly demo: DemoModule | null;
  /** The window's modal stack guard; the window's own by default. */
  readonly guard?: ModalStackGuard;
  /** The monotonic clock; the system's by default. Tests pass a fake clock. */
  readonly clock?: Clock;
}

export function createAppServices({ demo, guard, clock }: CreateServicesOptions): AppServices {
  const queryClient = createAppQueryClient();
  const directory = demo?.directory ?? NO_PATIENT_DIRECTORY;
  const store = createPatientContextStore({
    guard: guard ?? windowModalStackGuard(),
    queryClient,
    directory,
    sessionUser: demo?.sessionUser ?? null,
    ...(clock === undefined ? {} : { clock }),
  });
  return { store, queryClient, directory, demo };
}
