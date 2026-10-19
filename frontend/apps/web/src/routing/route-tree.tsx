/**
 * The web app's routes, built in code (docs/specs/modules/design-system.md §4, §5; CTRL-0016-5; OQ-142).
 *
 * ```
 * __root__                 clinical: false   the workspace frame (AppFrame)
 * ├── /                    clinical: false   the start page
 * └── _clinical            clinical: true    the clinical layout: banner, patient context, chooser
 *     └── /demo/banner     clinical: true    demo builds only: the banner demonstration
 * ```
 *
 * Every route declares `staticData.clinical` (required by type, src/routing/static-data.ts). Clinical routes
 * sit under the `_clinical` layout, which renders the patient banner. The demo's routes come from the demo
 * module, which only demo builds contain (vite.config.ts), so the production route tree has no `/demo`. The
 * clinical layout is registered only when it has routes: a production build has no clinical route until the
 * clinical work packages add one (KA-044).
 *
 * The tree is built afresh by each call, so a test can build the production and the demo tree side by side
 * (TanStack routes are linked to their children in place).
 */
import { Message } from '@hms/design-system';
import {
  createRootRoute,
  createRoute,
  createRouter,
  Navigate,
  type AnyRoute,
  type RouterHistory,
} from '@tanstack/react-router';
import type { ReactNode } from 'react';
import type { DemoModule } from '../demo/demo-module.ts';
import { AppFrame } from '../frame/app-frame.tsx';
import { CLINICAL_LAYOUT_ID, ClinicalLayout } from './clinical-layout.tsx';
import { parseSearch, stringifySearch, useAppSearch } from './search.ts';

function HomePage(): ReactNode {
  return (
    <h1 className="hms-page-title">
      <Message id="app.name" />
    </h1>
  );
}

/** An address that matches no route goes to the start page, keeping the app-wide parameters. */
function NotFound(): ReactNode {
  const { locale, density } = useAppSearch();
  return <Navigate href={`/${stringifySearch({ locale, density })}`} replace />;
}

export function createAppRouteTree(demo: DemoModule | null): AnyRoute {
  const root = createRootRoute({
    staticData: { clinical: false },
    component: AppFrame,
    notFoundComponent: NotFound,
  });
  const home = createRoute({
    getParentRoute: () => root,
    path: '/',
    staticData: { clinical: false },
    component: HomePage,
  });
  const clinicalLayout = createRoute({
    getParentRoute: () => root,
    id: CLINICAL_LAYOUT_ID,
    staticData: { clinical: true },
    component: ClinicalLayout,
  });
  const clinicalRoutes = demo?.createClinicalRoutes(clinicalLayout) ?? [];
  return root.addChildren(
    clinicalRoutes.length === 0 ? [home] : [home, clinicalLayout.addChildren([...clinicalRoutes])],
  );
}

export interface AppRouterOptions {
  readonly demo: DemoModule | null;
  /** The router's history; the browser's by default. Tests pass a memory history. */
  readonly history?: RouterHistory;
}

export function createAppRouter({ demo, history }: AppRouterOptions) {
  return createRouter({
    routeTree: createAppRouteTree(demo),
    parseSearch,
    stringifySearch,
    ...(history === undefined ? {} : { history }),
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;
