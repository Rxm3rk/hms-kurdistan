/**
 * `DensityProvider`: the density mode (BUILD-PROMPT.md §6.5 "Density modes"; docs/specs/modules/design-system.md
 * §2.5).
 *
 * Two modes, `comfortable` (the default) and `compact`, set as `data-density` on `<html>`; the tokens in
 * tokens.css change spacing and the type scale under it. Targets stay at least 24 × 24 CSS px and text
 * contrast at least 4.5:1 in both modes (tokens-contrast; E2E targets-24px). The choice is stored per user on
 * the device, under a key built from the user key the application passes (a staff identifier, never patient
 * data). Without a user key it is kept in memory only.
 */
import { createContext, use, useLayoutEffect, useState, type ReactNode } from 'react';

export const DENSITIES = ['comfortable', 'compact'] as const;
export type Density = (typeof DENSITIES)[number];
export const DEFAULT_DENSITY: Density = 'comfortable';

export function isDensity(value: unknown): value is Density {
  return typeof value === 'string' && (DENSITIES as readonly string[]).includes(value);
}

/** The device storage key for one user's density. */
export function densityStorageKey(userKey: string): string {
  return `hms.density.${userKey}`;
}

/** The stored density of a user; an absent, unreadable or unknown value gives the default. */
export function loadDensity(
  userKey: string | undefined,
  storage: Storage | undefined = safeLocalStorage(),
): Density {
  if (userKey === undefined || storage === undefined) {
    return DEFAULT_DENSITY;
  }
  try {
    const stored = storage.getItem(densityStorageKey(userKey));
    return isDensity(stored) ? stored : DEFAULT_DENSITY;
  } catch {
    return DEFAULT_DENSITY;
  }
}

function saveDensity(userKey: string | undefined, density: Density, storage: Storage | undefined): void {
  if (userKey === undefined || storage === undefined) {
    return;
  }
  try {
    storage.setItem(densityStorageKey(userKey), density);
  } catch {
    // Storage full or blocked: the choice still applies in this window; it is just not remembered.
  }
}

function safeLocalStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export interface DensityContextValue {
  readonly density: Density;
  readonly setDensity: (density: Density) => void;
}

const DensityContext = createContext<DensityContextValue | null>(null);

export interface DensityProviderProps {
  /** The signed-in user's key; the density is stored per user on the device. Omit it to keep it in memory. */
  readonly userKey?: string;
  /** Storage to use; the window's localStorage by default. */
  readonly storage?: Storage;
  readonly children?: ReactNode;
}

export function DensityProvider({ userKey, storage, children }: DensityProviderProps): ReactNode {
  const store = storage ?? safeLocalStorage();
  const [state, setState] = useState(() => ({ userKey, density: loadDensity(userKey, store) }));
  // A different user brings their own stored density (adjusting state while rendering, as React advises,
  // rather than in an effect).
  let density = state.density;
  if (state.userKey !== userKey) {
    density = loadDensity(userKey, store);
    setState({ userKey, density });
  }

  useLayoutEffect(() => {
    document.documentElement.dataset.density = density;
  }, [density]);

  const setDensity = (next: Density): void => {
    setState({ userKey, density: next });
    saveDensity(userKey, next, store);
  };

  return <DensityContext value={{ density, setDensity }}>{children}</DensityContext>;
}

/** The density and its setter. Throws outside a `DensityProvider`, so a missing provider is found at once. */
export function useDensity(): DensityContextValue {
  const value = use(DensityContext);
  if (value === null) {
    throw new Error('useDensity: render inside <DensityProvider>');
  }
  return value;
}
