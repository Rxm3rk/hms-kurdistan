/**
 * Workspace wiring for @hms/web (slice S1): the workspace packages, TanStack Router and Query, and React
 * Aria Components resolve, and React renders into jsdom.
 */
import { UI_LOCALES } from '@hms/i18n';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRootRoute, createRouter } from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { Group } from 'react-aria-components';
import { describe, expect, it, vi } from 'vitest';

// The first import of the workspace packages takes several seconds when this package's other test files load
// beside it on a busy host; the 5 s default failed on load alone. A longer limit lets no failing assertion pass.
vi.setConfig({ testTimeout: 20_000 });

describe('web workspace wiring', () => {
  // Dynamic imports inside the test, so that a workspace package whose entry point throws while loading fails
  // this test.
  it('imports the workspace packages without error', async () => {
    const entryPoints = Promise.all([
      import('@hms/design-system'),
      import('@hms/hal-client'),
      import('@hms/ui-core'),
    ]);
    await expect(entryPoints).resolves.toHaveLength(3);
    expect(UI_LOCALES).toContain('ckb');
  });

  it('creates a TanStack router', () => {
    const router = createRouter({ routeTree: createRootRoute() });
    expect(router.routeTree.id).toBe('__root__');
  });

  it('renders React Aria Components inside a TanStack Query provider in jsdom', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <Group data-testid="smoke" />
      </QueryClientProvider>,
    );
    expect(screen.getByTestId('smoke')).toHaveAttribute('role', 'group');
  });
});
