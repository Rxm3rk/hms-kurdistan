/**
 * Moving between screens. Every address keeps the app-wide parameters (`?locale=`, `?density=`), so a
 * screen never drops the user's language.
 *
 *   const href = useScreenHref();
 *   <LinkButton href={href('ward')}>…</LinkButton>
 *   const goTo = useGoTo();
 *   goTo('lab', { patient: 'SYN-PAT-0102' });   // opens the patient's lab results (asks first if another patient is open)
 */
import { useRouter, useRouterState } from '@tanstack/react-router';
import { useCallback } from 'react';
import { stringifySearch, useAppSearch } from '../../routing/search.ts';
import { SCREENS, screenOfPath, type ScreenId, type ScreenInfo } from './screens.ts';

/** Extra search parameters: `patient` asks the window's patient context for that patient. */
export interface ScreenParams {
  readonly patient?: string;
  readonly [key: string]: string | undefined;
}

/** A function that builds a screen's address with the current locale and density. */
export function useScreenHref(): (screen: ScreenId, params?: ScreenParams) => string {
  const { locale, density } = useAppSearch();
  return useCallback(
    (screen, params = {}) => `${SCREENS[screen].path}${stringifySearch({ locale, density, ...params })}`,
    [locale, density],
  );
}

/** A function that navigates to a screen (with optional `patient` and other parameters). */
export function useGoTo(): (screen: ScreenId, params?: ScreenParams) => void {
  const router = useRouter();
  const href = useScreenHref();
  return useCallback(
    (screen, params) => {
      void router.navigate({ href: href(screen, params) });
    },
    [router, href],
  );
}

/** The screen being shown, if any. */
export function useCurrentScreen(): ScreenInfo | undefined {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return screenOfPath(pathname);
}

/** A search parameter of the current address (screens may keep their own, e.g. `?tab=results`). */
export function useSearchParam(name: string): string | undefined {
  const search: unknown = useRouterState({ select: (state): unknown => state.location.search });
  if (typeof search === 'object' && search !== null) {
    const value = (search as Record<string, unknown>)[name];
    return typeof value === 'string' ? value : undefined;
  }
  return undefined;
}
