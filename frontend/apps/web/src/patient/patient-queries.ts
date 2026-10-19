/**
 * The TanStack Query cache of one window, keyed by patient (docs/specs/modules/design-system.md §2.2 "What a
 * switch clears", §4).
 *
 * - Every query that holds patient data has the key `['patient', <patientId>, ...]`, so the patient it
 *   belongs to is part of its identity and a query for one patient can never answer for another.
 * - After every change of the window's patient context the cache keeps only the queries of the context's
 *   patient and of a patient whose switch waits for confirmation; the previous patient's entries are removed
 *   (keepOnlyPatients, called by the patient-context store).
 * - No query goes to the network in WP-0.7 (§4 "No request leaves the cell's origin"). The queries read the
 *   window's patient directory, which is in memory in demo builds and empty in production builds.
 */
import { QueryClient, queryOptions } from '@tanstack/react-query';
import type { BannerModel } from '@hms/ui-core';
import { loadBannerModel, type PatientDirectory } from './directory.ts';

/** The first element of every patient-data query key. */
export const PATIENT_QUERY_ROOT = 'patient';

/** A query key for data of one patient. */
export function patientQueryKey(patientId: string, ...parts: readonly string[]): readonly string[] {
  return [PATIENT_QUERY_ROOT, patientId, ...parts];
}

/** The banner data of one patient; null when the directory does not know the patient. */
export function bannerQueryOptions(directory: PatientDirectory, patientId: string) {
  return queryOptions<BannerModel | null>({
    queryKey: patientQueryKey(patientId, 'banner'),
    queryFn: () => loadBannerModel(directory, patientId),
  });
}

/** Removes every patient-data query whose patient is not in `keep`. */
export function keepOnlyPatients(queryClient: QueryClient, keep: ReadonlySet<string>): void {
  queryClient.removeQueries({
    queryKey: [PATIENT_QUERY_ROOT],
    predicate: (query) => {
      const patientId = query.queryKey[1];
      return typeof patientId !== 'string' || !keep.has(patientId);
    },
  });
}

/** The patient ids whose queries a cache may hold: the patient-data query keys present now. */
export function cachedPatientIds(queryClient: QueryClient): string[] {
  const ids = new Set<string>();
  for (const query of queryClient.getQueryCache().findAll({ queryKey: [PATIENT_QUERY_ROOT] })) {
    const patientId = query.queryKey[1];
    if (typeof patientId === 'string') {
      ids.add(patientId);
    }
  }
  return [...ids];
}

/**
 * The window's query client. The data is local (in memory, or the cell's own API later), so queries never
 * pause for the browser's online state, never retry on their own and never refetch on focus or reconnect:
 * patient data changes only when the patient context changes or the app asks for it.
 */
export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        networkMode: 'always',
        retry: false,
        staleTime: Number.POSITIVE_INFINITY,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
      mutations: { networkMode: 'always', retry: false },
    },
  });
}
