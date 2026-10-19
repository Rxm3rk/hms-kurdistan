/**
 * The web app for one browser window: its services, its query cache and its router.
 */
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import type { AppRouter } from '../routing/route-tree.tsx';
import { AppServicesProvider, type AppServices } from './services.tsx';

export interface AppProps {
  readonly services: AppServices;
  readonly router: AppRouter;
}

export function App({ services, router }: AppProps): ReactNode {
  return (
    <QueryClientProvider client={services.queryClient}>
      <AppServicesProvider services={services}>
        <RouterProvider router={router} />
      </AppServicesProvider>
    </QueryClientProvider>
  );
}
