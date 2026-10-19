/**
 * The demo module's shape (docs/specs/modules/design-system.md §5; OQ-142). Demo builds (`VITE_HMS_DEMO=1`)
 * get `src/demo/index.ts`; production builds get `src/demo/selected.ts`, which is null, and vite.config.ts
 * never lets a production bundle import the demo files.
 */
import type { MessageKey } from '@hms/i18n';
import type { AnyRoute } from '@tanstack/react-router';
import type { SignAuthenticator, SignSubmitter } from '@hms/design-system';
import type { UserId } from '@hms/ui-core';
import type { PatientDirectory } from '../patient/directory.ts';

/** A page of the demo, for the main navigation and the command palette. */
export interface DemoPage {
  readonly path: string;
  readonly label: MessageKey;
}

export interface DemoModule {
  /** The synthetic patients (§18.10: synthetic only, NOT FOR CLINICAL USE). */
  readonly directory: PatientDirectory;
  /** The synthetic session user, until WP-0.4 brings sign-in (KA-044). */
  readonly sessionUser: UserId;
  /** The simulated sign-in of the sign dialog (KA-032). */
  readonly authenticator: SignAuthenticator;
  /** The simulated server answer to a sign command; nothing is stored (KA-025). */
  readonly submit: SignSubmitter;
  /** The demo pages. */
  readonly pages: readonly DemoPage[];
  /** The clinical route that opens a patient chosen in the palette (`?patient=<id>`). */
  readonly patientPath: string;
  /** The demo's routes under the `_clinical` layout, created afresh for each route tree. */
  readonly createClinicalRoutes: (clinicalLayout: AnyRoute) => readonly AnyRoute[];
}
