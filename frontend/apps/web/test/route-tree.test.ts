/**
 * ArchTest:banner-present-on-every-clinical-route (route-tree.test.ts; docs/specs/modules/design-system.md §4,
 * §5, §9; CTRL-0016-5; OQ-142).
 *
 * Walks the route trees of a production build and of a demo build and fails when a route lacks
 * `staticData.clinical`, when a clinical route is outside the `_clinical` layout, or when `/demo` is in the
 * production route tree. It then renders every clinical route of the demo tree with a patient in the window
 * and checks that the banner is there, and with no patient that the chooser is there and no banner. A tree
 * built wrong on purpose shows that the walk finds each defect.
 */
import { createRootRoute, createRoute, type AnyRoute } from '@tanstack/react-router';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { demoModule as productionDemoModule } from '../src/demo/selected.ts';
import { ClinicalLayout, CLINICAL_LAYOUT_ID } from '../src/routing/clinical-layout.tsx';
import { createAppRouteTree } from '../src/routing/route-tree.tsx';
import { isDemoBuild } from '../vite.config.ts';
import { address, bannerRegion, demoModule, patientIdOf, renderApp, text } from './harness.tsx';
import { auditRouteTree, fullPathOf, walkRoutes } from './route-audit.ts';

const productionTree = (): AnyRoute => createAppRouteTree(productionDemoModule);
const demoTree = (): AnyRoute => createAppRouteTree(demoModule);

/** The clinical routes that render a page (the layout's leaves), with their paths. */
function clinicalPages(tree: AnyRoute): string[] {
  return walkRoutes(tree)
    .filter(({ route }) => {
      const flag = (route.options as { staticData?: { clinical?: unknown } }).staticData?.clinical;
      const children: unknown = route.children;
      const hasChildren = Array.isArray(children) ? children.length > 0 : children !== undefined;
      return flag === true && !hasChildren;
    })
    .map(fullPathOf);
}

describe('ArchTest:banner-present-on-every-clinical-route', () => {
  it('a production build gets no demo module', () => {
    expect(productionDemoModule).toBeNull();
    expect(isDemoBuild({})).toBe(false);
    expect(isDemoBuild({ VITE_HMS_DEMO: '0' })).toBe(false);
    expect(isDemoBuild({ VITE_HMS_DEMO: 'true' })).toBe(false);
    expect(isDemoBuild({ VITE_HMS_DEMO: '1' })).toBe(true);
  });

  it('every route declares staticData.clinical and every clinical route sits under _clinical', () => {
    expect(auditRouteTree(productionTree(), { production: true })).toEqual([]);
    expect(auditRouteTree(demoTree(), { production: false })).toEqual([]);
  });

  it('/demo is absent from the production route tree and present in the demo tree', () => {
    const productionPaths = walkRoutes(productionTree()).map(fullPathOf);
    expect(productionPaths.filter((path) => path.startsWith('/demo'))).toEqual([]);
    const demoPaths = walkRoutes(demoTree()).map(fullPathOf);
    expect(demoPaths).toContain('/demo/banner');
    // The demo route is a clinical page under the layout, so the rendered check below covers it.
    expect(clinicalPages(demoTree())).toEqual(['/demo/banner']);
  });

  it('finds each defect in a tree built wrong on purpose', () => {
    const root = createRootRoute({ staticData: { clinical: false } });
    const stray = createRoute({
      getParentRoute: () => root,
      path: 'stray-chart',
      staticData: { clinical: true },
    });
    const unflagged = createRoute({
      getParentRoute: () => root,
      path: 'unflagged',
      // A route built around the types, as a later change might.
      staticData: {} as { clinical: boolean },
    });
    const fakeLayout = createRoute({
      getParentRoute: () => root,
      id: CLINICAL_LAYOUT_ID,
      staticData: { clinical: true },
    });
    const notClinical = createRoute({
      getParentRoute: () => fakeLayout,
      path: 'demo/settings',
      staticData: { clinical: false },
    });
    const tree = root.addChildren([stray, unflagged, fakeLayout.addChildren([notClinical])]);
    const problems = auditRouteTree(tree, { production: true }).map((finding) => finding.problem);
    expect(problems).toEqual(
      expect.arrayContaining([
        'clinical-outside-layout',
        'no-clinical-flag',
        'layout-without-banner',
        'not-clinical-inside-layout',
        'demo-route',
      ]),
    );
    // The real layout is the one that renders the banner.
    const layout = walkRoutes(demoTree()).find(
      ({ route }) => (route.options as { id?: unknown }).id === CLINICAL_LAYOUT_ID,
    );
    expect((layout?.route.options as { component?: unknown } | undefined)?.component).toBe(ClinicalLayout);
  });

  it.each(clinicalPages(demoTree()))(
    '%s renders the banner when the window holds a patient',
    async (path) => {
      const patientId = patientIdOf('complete');
      const { router } = await renderApp(`${path}?patient=${patientId}`);
      const main = await screen.findByRole('main');
      const banner = await within(main).findByRole('region', { name: text('banner.region.label') });
      expect(banner).toBeInTheDocument();
      expect(within(banner).getByText('Hêmin Azad Omer')).toBeInTheDocument();
      expect(address(router)).toBe(`${path}?patient=${patientId}`);
    },
  );

  it.each(clinicalPages(demoTree()))(
    '%s shows the patient chooser and no banner with no patient',
    async (path) => {
      await renderApp(path);
      expect(await screen.findByTestId('patient-chooser')).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { level: 1, name: text('patientContext.none') }),
      ).toBeInTheDocument();
      expect(bannerRegion()).toBeNull();
    },
  );

  it('a production build shows no clinical route: /demo/banner goes to the start page', async () => {
    const { router } = await renderApp('/demo/banner?locale=ckb', null);
    await screen.findByRole('heading', { level: 1 });
    expect(router.state.location.pathname).toBe('/');
    expect(router.state.location.searchStr).toBe('?locale=ckb');
    expect(bannerRegion()).toBeNull();
    expect(screen.queryByTestId('demo-watermark')).toBeNull();
  });
});
