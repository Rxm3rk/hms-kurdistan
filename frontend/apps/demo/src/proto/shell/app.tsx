/**
 * The prototype app for one browser window: its services (patient context, query cache, synthetic patient
 * directory, simulated sign-in) and its router.
 */
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { AppServicesProvider, type AppServices } from '../../app/services.tsx';
import type { ProtoRouter } from './routes.tsx';

export function ProtoApp({ services, router }: { readonly services: AppServices; readonly router: ProtoRouter }): ReactNode {
  return (
    <QueryClientProvider client={services.queryClient}>
      <AppServicesProvider services={services}>
        <RouterProvider router={router} />
      </AppServicesProvider>
    </QueryClientProvider>
  );
}
