/**
 * Test harness for the web app (slice S6): the whole app of one window (its services, its query cache, its
 * router on a memory history) rendered in jsdom, with the demo module of demo builds or none, as a
 * production build has. The patients are the demo's synthetic fixtures (§18.10: synthetic only, NOT FOR
 * CLINICAL USE).
 */
import { CATALOGUES, type MessageKey } from '@hms/i18n';
import { createMemoryHistory } from '@tanstack/react-router';
import { configure, render, screen, waitFor, type RenderResult } from '@testing-library/react';
import { expect, vi } from 'vitest';
import { App } from '../src/app/app.tsx';
import { createAppServices } from '../src/app/create-services.ts';
import type { AppServices } from '../src/app/services.tsx';
import { demoModule } from '../src/demo/index.ts';
import type { DemoModule } from '../src/demo/demo-module.ts';
import { DEMO_FIXTURES } from '../src/demo/fixtures.ts';
import { createAppRouter, type AppRouter } from '../src/routing/route-tree.tsx';

// Whole-app renders with React Aria dialogs take 1 to 3 s each in jsdom on a busy host; the package defaults
// (5 s a test, 1 s a waitFor) made them fail on load alone. A longer limit only delays the report of a test
// that fails; it lets no failing assertion pass.
vi.setConfig({ testTimeout: 20_000 });
configure({ asyncUtilTimeout: 5_000 });

// jsdom has no layout, so its window.scrollTo only reports "Not implemented"; the router calls it on every
// navigation (scroll restoration). Nothing here tests scrolling.
window.scrollTo = () => undefined;

export { demoModule };

export const text = (key: MessageKey): string => CATALOGUES.en[key];

export interface RenderedApp {
  readonly services: AppServices;
  readonly router: AppRouter;
  readonly view: RenderResult;
}

/** Renders the app of one window at `path`, with the demo module (the default) or none. */
export async function renderApp(path: string, demo: DemoModule | null = demoModule): Promise<RenderedApp> {
  const services = createAppServices({ demo });
  const router = createAppRouter({ demo, history: createMemoryHistory({ initialEntries: [path] }) });
  const view = render(<App services={services} router={router} />);
  await waitFor(() => {
    expect(router.state.status).toBe('idle');
    expect(document.getElementById('main')).not.toBeNull();
  });
  return { services, router, view };
}

/** The patient banner region, if one is shown. */
export const bannerRegion = (): HTMLElement | null =>
  screen.queryByRole('region', { name: text('banner.region.label') });

/** The current address: path and search. */
export function address(router: AppRouter): string {
  const { pathname, searchStr } = router.state.location;
  return `${pathname}${searchStr}`;
}

/** The patient id of a demo fixture. */
export function patientIdOf(fixtureId: string): string {
  const fixture = DEMO_FIXTURES.find((entry) => entry.id === fixtureId);
  if (fixture === undefined) {
    throw new Error(`no demo fixture ${fixtureId}`);
  }
  return fixture.patientId;
}
