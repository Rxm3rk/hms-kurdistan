/**
 * The web app's URL search parameters (docs/specs/modules/design-system.md §2.9, §4, §5).
 *
 * - `locale` (`en`, `ckb`, `ar`) and `density` (`comfortable`, `compact`), on every route; both are kept
 *   when the app navigates.
 * - `patient`, on clinical routes: a patient id. It is a request to the window's patient context, never a
 *   selection: the context decides whose data is shown (§2.2, §4).
 *
 * Every value is a plain string. The router's default search format reads JSON, so `?patient=1e3` would
 * arrive as the number 1000; this format keeps each value exactly as written, and an unknown or malformed
 * value is ignored rather than guessed (Zod, with `catch`).
 */
import { DENSITIES } from '@hms/design-system';
import { UI_LOCALES } from '@hms/i18n';
import { useRouter, useRouterState } from '@tanstack/react-router';
import { useCallback } from 'react';
import { z } from 'zod';

/** Patient ids: as ui-core's banner model accepts them (ASCII letters, digits and `.`, `_`, `:`, `-`). */
const PATIENT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export const appSearchSchema = z.object({
  locale: z.enum(UI_LOCALES).optional().catch(undefined),
  density: z.enum(DENSITIES).optional().catch(undefined),
  patient: z.string().regex(PATIENT_ID).optional().catch(undefined),
});
export type AppSearch = z.infer<typeof appSearchSchema>;

/** The search string as a flat record of strings; repeated keys keep their first value. */
export function parseSearch(searchString: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(searchString)) {
    if (!Object.hasOwn(result, key)) {
      result[key] = value;
    }
  }
  return result;
}

/** The search string of a record: string values only, in insertion order; empty when there are none. */
export function stringifySearch(search: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (typeof value === 'string') {
      params.append(key, value);
    }
  }
  const text = params.toString();
  return text.length === 0 ? '' : `?${text}`;
}

/** Reads the app's parameters from a parsed search object. */
export function readAppSearch(search: unknown): AppSearch {
  const parsed = appSearchSchema.safeParse(search);
  return parsed.success ? parsed.data : {};
}

/** The current location's app parameters; re-renders when they change. */
export function useAppSearch(): AppSearch {
  const search: unknown = useRouterState({ select: (state): unknown => state.location.search });
  return readAppSearch(search);
}

/** A parsed search object as a record of its string values. */
export function searchRecord(search: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (typeof search === 'object' && search !== null) {
    for (const [key, value] of Object.entries(search)) {
      if (typeof value === 'string') {
        result[key] = value;
      }
    }
  }
  return result;
}

export type SearchPatch = Partial<Record<keyof AppSearch, string | undefined>>;

/**
 * Changes app parameters on the current path: a value sets the parameter, undefined removes it, and every
 * other parameter is kept. `replace` replaces the history entry instead of adding one.
 */
export function useUpdateSearch(): (patch: SearchPatch, options?: { readonly replace?: boolean }) => void {
  const router = useRouter();
  return useCallback(
    (patch: SearchPatch, options: { readonly replace?: boolean } = {}) => {
      const location = router.state.location;
      const next: Record<string, string | undefined> = { ...searchRecord(location.search) };
      for (const [key, value] of Object.entries(patch)) {
        next[key] = value;
      }
      void router.navigate({
        href: `${location.pathname}${stringifySearch(next)}`,
        replace: options.replace ?? false,
      });
    },
    [router],
  );
}
