/**
 * The demo module (docs/specs/modules/design-system.md §5; OQ-142). Only demo builds contain it: a build with
 * `VITE_HMS_DEMO=1` resolves `./selected.ts` to this file (vite.config.ts), and no other module imports it.
 * SYNTHETIC DATA AND SIMULATED SIGN-IN, NOT FOR CLINICAL USE.
 *
 * - The synthetic patients of fixtures.ts as the window's patient directory.
 * - A synthetic session user and the design system's simulated sign-in (KA-032), which itself refuses to
 *   exist in a production build without the demo flag.
 * - A simulated server for sign commands: it accepts every command and stores nothing (KA-025).
 * - The route `/demo/banner` under the `_clinical` layout. `?fixture=<id>` names a fixture (§5); it is turned
 *   into the patient request `?patient=<id>` that every clinical route reads, replacing the history entry.
 */
import { createSimulatedAuthenticator, type SignSubmitter } from '@hms/design-system';
import { parseBannerData, SYNTHETIC_BANNER_VOCABULARIES, type UserId } from '@hms/ui-core';
import { createRoute, redirect, type AnyRoute } from '@tanstack/react-router';
import { createElement } from 'react';
import type { PatientDirectory } from '../patient/directory.ts';
import { searchRecord, stringifySearch } from '../routing/search.ts';
import { DemoBannerPage } from './demo-banner-page.tsx';
import type { DemoModule } from './demo-module.ts';
import { DEMO_FIXTURES, findFixture } from './fixtures.ts';

const DEMO_BANNER_PATH = '/demo/banner';

/** The demo's session user (synthetic), until WP-0.4 brings sign-in. */
const DEMO_USER: UserId = 'user-synthetic-demo';

const directory: PatientDirectory = {
  vocabularies: SYNTHETIC_BANNER_VOCABULARIES,
  list: () =>
    DEMO_FIXTURES.map((fixture) => ({
      patientId: fixture.patientId,
      identity: parseBannerData(fixture.data, SYNTHETIC_BANNER_VOCABULARIES),
    })),
  loadBannerData: (patientId) =>
    Promise.resolve(DEMO_FIXTURES.find((fixture) => fixture.patientId === patientId)?.data),
};

/** Accepts every sign command and stores nothing: there is no server yet (KA-025). */
const submit: SignSubmitter = () => Promise.resolve({ status: 'accepted' });

function createClinicalRoutes(clinicalLayout: AnyRoute): readonly AnyRoute[] {
  return [
    createRoute({
      getParentRoute: () => clinicalLayout,
      path: 'demo/banner',
      staticData: { clinical: true, titleKey: 'demo.banner.title' },
      beforeLoad: ({ location }) => {
        const search = searchRecord(location.search);
        const fixtureId = search.fixture;
        if (fixtureId === undefined) {
          return;
        }
        const rest = Object.fromEntries(Object.entries(search).filter(([key]) => key !== 'fixture'));
        const patientId = findFixture(fixtureId)?.patientId;
        // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router's redirect is thrown
        throw redirect({
          href: `${location.pathname}${stringifySearch(patientId === undefined ? rest : { ...rest, patient: patientId })}`,
          replace: true,
        });
      },
      component: () => createElement(DemoBannerPage, { demo: demoModule }),
    }),
  ];
}

export const demoModule: DemoModule = {
  directory,
  sessionUser: DEMO_USER,
  authenticator: createSimulatedAuthenticator(DEMO_USER),
  submit,
  pages: [{ path: DEMO_BANNER_PATH, label: 'demo.banner.title' }],
  patientPath: DEMO_BANNER_PATH,
  createClinicalRoutes,
};
